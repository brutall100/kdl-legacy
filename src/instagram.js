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
 * Du prijungimo būdai (pasirenkama aplinkos kintamaisiais):
 *  A) Instagram Login (rekomenduojamas, nereikia Facebook puslapio ir verslo portfelio):
 *     IG_APP_ID, IG_APP_SECRET – „API setup with Instagram login“ skiltyje (Instagram app ID / secret).
 *     Raktas galioja 60 d., svetainė jį pratęsia automatiškai.
 *  B) Facebook Login (per Facebook puslapį): META_APP_ID, META_APP_SECRET [, META_CONFIG_ID].
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
// „Facebook Login for Business“ programėlėms – konfigūracijos ID (tada leidimai imami iš jos)
const CONFIG_ID = process.env.META_CONFIG_ID || '';
const SCOPES = ['instagram_basic', 'pages_show_list', 'pages_read_engagement'];

// Instagram Login
const IG_APP_ID = process.env.IG_APP_ID || '';
const IG_APP_SECRET = process.env.IG_APP_SECRET || '';
const IG_AUTH = (process.env.IG_AUTH_URL || 'https://www.instagram.com').replace(/\/+$/, '');
const IG_API = (process.env.IG_API_URL || 'https://api.instagram.com').replace(/\/+$/, '');
const IG_GRAPH = (process.env.IG_GRAPH_URL || 'https://graph.instagram.com').replace(/\/+$/, '');
const IG_MODE = Boolean(IG_APP_ID && IG_APP_SECRET);
const REFRESH_BEFORE_MS = 20 * 24 * 60 * 60 * 1000; // pratęsti likus < 20 d.
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

const configured = () => IG_MODE || Boolean(APP_ID && APP_SECRET);
const isConnected = () => Boolean(getSettings().ig_page_token && getSettings().ig_user_id);

class GraphError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function request(url, params = {}, init = {}) {
  url = new URL(url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || data.error_message) {
    const e = data.error || {};
    throw new GraphError(e.message || data.error_message || `API klaida (${res.status})`, e.code || data.code);
  }
  return data;
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
  if (IG_MODE) {
    const iu = new URL(`${IG_AUTH}/oauth/authorize`);
    iu.searchParams.set('client_id', IG_APP_ID);
    iu.searchParams.set('redirect_uri', redirectUri(origin));
    iu.searchParams.set('response_type', 'code');
    iu.searchParams.set('scope', 'instagram_business_basic');
    iu.searchParams.set('state', state);
    return iu.toString();
  }
  const u = new URL(`${DIALOG}/${VERSION}/dialog/oauth`);
  u.searchParams.set('client_id', APP_ID);
  u.searchParams.set('redirect_uri', redirectUri(origin));
  u.searchParams.set('state', state);
  u.searchParams.set('response_type', 'code');
  if (CONFIG_ID) u.searchParams.set('config_id', CONFIG_ID);
  else u.searchParams.set('scope', SCOPES.join(','));
  return u.toString();
}

/**
 * Užbaigia prisijungimą: kodas → raktai → Instagram paskyra.
 * @returns {Promise<{username: string, pages: number}>}
 */
async function connectInstagram(code, origin) {
  const body = new URLSearchParams({
    client_id: IG_APP_ID,
    client_secret: IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(origin),
    code: code.replace(/#_$/, ''),
  });
  const short = await request(`${IG_API}/oauth/access_token`, {}, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const long = await request(`${IG_GRAPH}/access_token`, {
    grant_type: 'ig_exchange_token',
    client_secret: IG_APP_SECRET,
    access_token: short.access_token,
  });
  const me = await request(`${IG_GRAPH}/${VERSION}/me`, { fields: 'user_id,username', access_token: long.access_token });
  setSettings({
    ig_mode: 'instagram',
    ig_page_token: long.access_token,
    ig_token_expires: String(Date.now() + (Number(long.expires_in) || 60 * 24 * 3600) * 1000),
    ig_user_id: String(me.user_id || me.id || short.user_id || 'me'),
    ig_username: me.username || '',
    ig_page_name: '',
    ig_status: 'ok',
    ig_error: '',
  });
  await sync();
  return { username: me.username, pages: 0 };
}

/** Instagram Login raktas galioja 60 d. – pratęsiame iš anksto. */
async function refreshIfNeeded(s) {
  if (s.ig_mode !== 'instagram') return s.ig_page_token;
  const exp = Number(s.ig_token_expires) || 0;
  if (exp - Date.now() > REFRESH_BEFORE_MS) return s.ig_page_token;
  const r = await request(`${IG_GRAPH}/refresh_access_token`, { grant_type: 'ig_refresh_token', access_token: s.ig_page_token });
  setSettings({
    ig_page_token: r.access_token,
    ig_token_expires: String(Date.now() + (Number(r.expires_in) || 60 * 24 * 3600) * 1000),
  });
  return r.access_token;
}

async function connect(code, origin) {
  if (IG_MODE) return connectInstagram(code, origin);
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
  const fields = 'id,name,access_token,instagram_business_account{id,username}';
  const pages = await graph('me/accounts', { fields, access_token: long.access_token });
  let list = pages.data || [];

  // „Facebook Login for Business“: puslapiai gali būti nepateikti per me/accounts –
  // tada jų ID imame iš suteiktų leidimų (granular_scopes) ir užklausiame kiekvieno atskirai.
  if (!list.some((p) => p.instagram_business_account)) {
    try {
      const dbg = await graph('debug_token', { input_token: long.access_token, access_token: `${APP_ID}|${APP_SECRET}` });
      const ids = new Set();
      for (const g of (dbg.data && dbg.data.granular_scopes) || []) {
        if (/^pages_/.test(g.scope)) (g.target_ids || []).forEach((id) => ids.add(id));
      }
      for (const id of ids) {
        if (list.some((p) => p.id === id)) continue;
        try {
          list.push(await graph(id, { fields, access_token: long.access_token }));
        } catch (err) {
          console.warn('[instagram] puslapis', id, err.message);
        }
      }
    } catch (err) {
      console.warn('[instagram] debug_token:', err.message);
    }
  }

  const page = list.find((p) => p.instagram_business_account && p.access_token);
  if (!page) {
    const names = list.map((p) => `„${p.name}“${p.instagram_business_account ? '' : ' (be Instagram)'}`).join(', ');
    throw new GraphError(
      list.length
        ? `Rasti Facebook puslapiai: ${names}, bet nė vienas neturi prijungtos Instagram verslo paskyros. Instagram programėlėje patikrinkite: Nustatymai → Paskyros centras / „Bendrinti su kitais“ → Facebook puslapis.`
        : 'Facebook negrąžino nė vieno puslapio. Prisijungimo lange reikia pažymėti studijos Facebook puslapį ir Instagram paskyrą (jei pasirinkimo nebuvo – programėlės konfigūracijoje turi būti pažymėti „Pages“ ir „Instagram accounts“ ištekliai).'
    );
  }
  const ig = page.instagram_business_account;
  setSettings({
    ig_mode: 'facebook',
    ig_page_token: page.access_token,
    ig_user_id: ig.id,
    ig_username: ig.username || '',
    ig_page_name: page.name || '',
    ig_status: 'ok',
    ig_error: '',
  });
  await sync();
  return { username: ig.username, pages: list.length };
}

function disconnect() {
  for (const row of db.prepare('SELECT image FROM ig_auto').all()) deleteImage(row.image);
  db.prepare('DELETE FROM ig_auto').run();
  setSettings({ ig_mode: '', ig_token_expires: '', ig_page_token: '', ig_user_id: '', ig_username: '', ig_page_name: '', ig_status: '', ig_error: '', ig_synced_at: '' });
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
      const fieldsList = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
      let data;
      if (s.ig_mode === 'instagram') {
        const token = await refreshIfNeeded(s);
        data = await request(`${IG_GRAPH}/${VERSION}/me/media`, { fields: fieldsList, limit: String(KEEP), access_token: token });
      } else {
        data = await graph(`${s.ig_user_id}/media`, { fields: fieldsList, limit: String(KEEP), access_token: s.ig_page_token });
      }
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

module.exports = { mode: () => (IG_MODE ? 'instagram' : 'facebook'), configured, isConnected, loginUrl, connect, disconnect, sync, startScheduler, feed, newState, redirectUri };
