'use strict';

/**
 * Instagram įrašų sinchronizavimas per Meta Graph API (Instagram Business paskyra,
 * susieta su Facebook puslapiu).
 *
 * Eiga:
 *  1. Admin paspaudžia „Prijungti Instagram“ → Facebook prisijungimas (Facebook Login).
 *  2. Gauname ilgalaikį naudotojo raktą → Facebook puslapio raktą (jis nesibaigia)
 *     ir prie puslapio prijungtos Instagram paskyros ID.
 *  3. Kas valandą parsisiunčiame naujausius įrašus, jų nuotraukas laikome svetainėje.
 *
 * Reikalingi aplinkos kintamieji: META_APP_ID, META_APP_SECRET.
 */

const crypto = require('crypto');
const config = require('./config');
const { db, getSettings, setSettings } = require('./db');
const { saveImage, deleteImage } = require('./uploads');

const GRAPH = (process.env.META_GRAPH_URL || 'https://graph.facebook.com').replace(/\/+$/, '');
const DIALOG = (process.env.META_DIALOG_URL || 'https://www.facebook.com').replace(/\/+$/, '');
const VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const APP_ID = process.env.META_APP_ID || '';
const APP_SECRET = process.env.META_APP_SECRET || '';
const SCOPES = ['instagram_basic', 'pages_show_list', 'pages_read_engagement', 'business_management'];
const KEEP = 12; // kiek įrašų laikome
const SYNC_EVERY_MS = 60 * 60 * 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS ig_auto (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ig_id      TEXT NOT NULL UNIQUE,
    permalink  TEXT,
    caption    TEXT,
    media_type TEXT,
    image      TEXT,
    taken_at   TEXT
  );
`);

const configured = () => Boolean(APP_ID && APP_SECRET);
const isConnected = () => Boolean(getSettings().ig_page_token && getSettings().ig_user_id);

class GraphError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function graph(path, params = {}) {
  const url = new URL(`${GRAPH}/${VERSION}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new GraphError(e.message || `Graph API klaida (${res.status})`, e.code);
  }
  return data;
}

function redirectUri(origin) {
  return `${config.SITE_URL || origin}/admin/instagram/callback`;
}

function loginUrl(origin, state) {
  const u = new URL(`${DIALOG}/${VERSION}/dialog/oauth`);
  u.searchParams.set('client_id', APP_ID);
  u.searchParams.set('redirect_uri', redirectUri(origin));
  u.searchParams.set('state', state);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPES.join(','));
  return u.toString();
}

/**
 * Užbaigia prisijungimą: kodas → raktai → Instagram paskyra.
 * @returns {Promise<{username: string, pages: number}>}
 */
async function connect(code, origin) {
  const short = await graph('oauth/access_token', {
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: redirectUri(origin),
    code,
  });
  const long = await graph('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: short.access_token,
  });
  const pages = await graph('me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    access_token: long.access_token,
  });
  const page = (pages.data || []).find((p) => p.instagram_business_account);
  if (!page) {
    throw new GraphError(
      'Nerasta Instagram verslo paskyra, susieta su Facebook puslapiu. Patikrinkite, ar prisijungimo metu pažymėjote studijos puslapį ir Instagram paskyrą.'
    );
  }
  const ig = page.instagram_business_account;
  setSettings({
    ig_page_token: page.access_token,
    ig_user_id: ig.id,
    ig_username: ig.username || '',
    ig_page_name: page.name || '',
    ig_status: 'ok',
    ig_error: '',
  });
  await sync();
  return { username: ig.username, pages: (pages.data || []).length };
}

function disconnect() {
  for (const row of db.prepare('SELECT image FROM ig_auto').all()) deleteImage(row.image);
  db.prepare('DELETE FROM ig_auto').run();
  setSettings({ ig_page_token: '', ig_user_id: '', ig_username: '', ig_page_name: '', ig_status: '', ig_error: '', ig_synced_at: '' });
}

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Nepavyko parsisiųsti nuotraukos (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

let syncing = null;

/** Parsisiunčia naujausius įrašus. Klaidos įrašomos į nustatymus, neišmetamos. */
function sync() {
  if (syncing) return syncing;
  syncing = (async () => {
    const s = getSettings();
    if (!s.ig_page_token || !s.ig_user_id) return { ok: false, skipped: true };
    try {
      const data = await graph(`${s.ig_user_id}/media`, {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
        limit: String(KEEP),
        access_token: s.ig_page_token,
      });
      const items = (data.data || []).slice(0, KEEP);
      const existing = new Map(db.prepare('SELECT * FROM ig_auto').all().map((r) => [r.ig_id, r]));
      const keep = new Set();
      let added = 0;
      for (const m of items) {
        keep.add(m.id);
        const old = existing.get(m.id);
        if (old) {
          db.prepare('UPDATE ig_auto SET caption = ?, permalink = ? WHERE id = ?').run(m.caption || '', m.permalink || '', old.id);
          continue;
        }
        const src = m.media_type === 'VIDEO' ? m.thumbnail_url || m.media_url : m.media_url;
        if (!src) continue;
        try {
          const image = await saveImage(await download(src), { max: 1080, thumb: 600 });
          db.prepare(
            'INSERT INTO ig_auto (ig_id, permalink, caption, media_type, image, taken_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(m.id, m.permalink || '', m.caption || '', m.media_type || 'IMAGE', image, m.timestamp || '');
          added++;
        } catch (err) {
          console.warn('[instagram]', err.message);
        }
      }
      for (const [igId, row] of existing) {
        if (!keep.has(igId)) {
          deleteImage(row.image);
          db.prepare('DELETE FROM ig_auto WHERE id = ?').run(row.id);
        }
      }
      setSettings({ ig_status: 'ok', ig_error: '', ig_synced_at: new Date().toISOString() });
      return { ok: true, added, total: items.length };
    } catch (err) {
      console.warn('[instagram] sinchronizavimas nepavyko:', err.message);
      // 190 – raktas nebegalioja (pvz. pakeistas Facebook slaptažodis ar atšauktas leidimas)
      setSettings({ ig_status: err.code === 190 ? 'expired' : 'error', ig_error: err.message.slice(0, 300) });
      return { ok: false, error: err.message };
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

function startScheduler() {
  const tick = () => {
    if (isConnected()) sync();
  };
  setTimeout(tick, 15000).unref();
  setInterval(tick, SYNC_EVERY_MS).unref();
}

/** Įrašai svetainei: pirma rankiniai (admin), tada automatiniai. */
function feed(limit = 8) {
  const manual = db
    .prepare('SELECT * FROM instagram ORDER BY sort, id')
    .all()
    .map((r) => ({ manual: true, image: r.image, link: r.link, caption_lt: r.caption_lt, caption_en: r.caption_en, video: Boolean(r.video) }));
  const auto = db
    .prepare('SELECT * FROM ig_auto ORDER BY taken_at DESC, id DESC')
    .all()
    .map((r) => ({ manual: false, image: r.image, link: r.permalink, caption_lt: r.caption, caption_en: r.caption, video: r.media_type === 'VIDEO' }));
  return [...manual, ...auto].slice(0, limit);
}

const newState = () => crypto.randomBytes(16).toString('hex');

module.exports = { configured, isConnected, loginUrl, connect, disconnect, sync, startScheduler, feed, newState, redirectUri };
