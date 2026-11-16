'use strict';

/** Instagram Login (be Facebook): prijungimas, rakto pratęsimas ir sinchronizavimas su netikru API. */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

let mock;
let mockBase;
let posts;
let refreshed = 0;

function startMock() {
  return new Promise((resolve) => {
    mock = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://x');
      const json = (o, code = 200) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(o));
      };
      if (u.pathname === '/oauth/authorize') {
        assert.equal(u.searchParams.get('scope'), 'instagram_business_basic');
        res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=TESTCODE%23_&state=${u.searchParams.get('state')}` });
        return res.end();
      }
      if (u.pathname === '/oauth/access_token' && req.method === 'POST') {
        let body = '';
        for await (const c of req) body += c;
        const f = new URLSearchParams(body);
        assert.equal(f.get('client_id'), 'IGAPP');
        assert.equal(f.get('client_secret'), 'IGSECRET');
        assert.equal(f.get('code'), 'TESTCODE');
        return json({ access_token: 'SHORT', user_id: 'IG1' });
      }
      if (u.pathname === '/access_token') {
        assert.equal(u.searchParams.get('grant_type'), 'ig_exchange_token');
        assert.equal(u.searchParams.get('access_token'), 'SHORT');
        return json({ access_token: 'LONG', token_type: 'bearer', expires_in: 5184000 });
      }
      if (u.pathname === '/refresh_access_token') {
        refreshed += 1;
        return json({ access_token: 'REFRESHED', expires_in: 5184000 });
      }
      if (u.pathname === '/v21.0/me') {
        return json({ user_id: 'IG1', username: 'kdlegacystudija' });
      }
      if (u.pathname === '/v21.0/me/media') {
        if (!['LONG', 'REFRESHED'].includes(u.searchParams.get('access_token'))) return json({ error: { message: 'bad token', code: 190 } }, 400);
        return json({ data: posts });
      }
      if (u.pathname.startsWith('/img/')) {
        const sharp = require('sharp');
        const buf = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#4d8dff' } }).jpeg().toBuffer();
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        return res.end(buf);
      }
      json({ error: { message: 'not found' } }, 404);
    });
    mock.listen(0, () => {
      mockBase = `http://127.0.0.1:${mock.address().port}`;
      resolve();
    });
  });
}

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-login-test-'));
let server;
let base;
let db;

before(async () => {
  await startMock();
  Object.assign(process.env, {
    DATA_DIR,
    ADMIN_USER: 'admin',
    ADMIN_PASSWORD: 'test-password-123',
    LOGIN_RATE_LIMIT: '1000',
    IG_APP_ID: 'IGAPP',
    IG_APP_SECRET: 'IGSECRET',
    IG_AUTH_URL: mockBase,
    IG_API_URL: mockBase,
    IG_GRAPH_URL: mockBase,
  });
  posts = [
    { id: 'm1', caption: 'Kalėdinis koncertas ✨', media_type: 'IMAGE', media_url: `${mockBase}/img/1.jpg`, permalink: 'https://www.instagram.com/p/AAA/', timestamp: '2026-11-10T10:00:00+0000' },
    { id: 'm2', caption: 'Reels', media_type: 'VIDEO', media_url: `${mockBase}/v.mp4`, thumbnail_url: `${mockBase}/img/2.jpg`, permalink: 'https://www.instagram.com/reel/BBB/', timestamp: '2026-11-09T10:00:00+0000' },
  ];
  ({ db } = require('../src/db'));
  const { ensureAdminUser } = require('../src/db');
  const { seed } = require('../src/seed');
  const { createApp } = require('../src/app');
  await seed();
  ensureAdminUser();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  mock.close();
  db.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

function client() {
  const jar = new Map();
  return async function req(url, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(url.startsWith('http') ? url : base + url, { redirect: 'manual', ...opts, headers });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
}

test('Instagram Login: prijungimas, įrašų parsisiuntimas ir rodymas svetainėje', async () => {
  const req = client();
  const page = await (await req('/admin/login')).text();
  const csrf = page.match(/name="_csrf" value="([^"]+)"/)[1];
  await req('/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ _csrf: csrf, username: 'admin', password: 'test-password-123' }).toString(),
  });

  assert.match(await (await req('/admin/instagram')).text(), /Prijungti Instagram/);

  // 1) svetainė nukreipia į „Facebook“ dialogą
  const go = await req('/admin/instagram/connect');
  assert.equal(go.status, 302);
  const dialog = go.headers.get('location');
  assert.ok(dialog.startsWith(`${mockBase}/oauth/authorize`));
  assert.match(dialog, /client_id=IGAPP/);
  // 2) „Facebook“ grąžina kodą
  const back = await fetch(dialog, { redirect: 'manual' });
  const cb = await req(back.headers.get('location'));
  assert.equal(cb.status, 302);

  const admin = await (await req('/admin/instagram')).text();
  assert.match(admin, /@kdlegacystudija/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ig_auto').get().n, 2);

  const home = await (await fetch(base + '/')).text();
  assert.match(home, /id="instagram"/);
  assert.match(home, /instagram\.com\/p\/AAA/);
  assert.match(home, /class="ig-badge"/, 'vaizdo įrašas pažymėtas');

  // 3) pakartotinis atnaujinimas: vienas įrašas dingo Instagram'e, atsirado naujas
  posts = [{ id: 'm3', caption: 'Naujas', media_type: 'IMAGE', media_url: `${mockBase}/img/3.jpg`, permalink: 'https://www.instagram.com/p/CCC/', timestamp: '2026-11-12T10:00:00+0000' }, posts[0]];
  const p2 = await (await req('/admin/instagram')).text();
  const c2 = p2.match(/name="_csrf" value="([^"]+)"/)[1];
  await req('/admin/instagram/sync', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `_csrf=${encodeURIComponent(c2)}` });
  const ids = db.prepare('SELECT ig_id FROM ig_auto ORDER BY taken_at DESC').all().map((r) => r.ig_id);
  assert.deepEqual(ids, ['m3', 'm1']);
  assert.equal(refreshed, 0, 'naujo rakto nepratęsiame');

  // 3b) raktas greitai baigsis → pratęsiamas automatiškai
  require('../src/db').setSettings({ ig_token_expires: String(Date.now() + 86400000) });
  assert.equal((await require('../src/instagram').sync()).ok, true);
  assert.equal(refreshed, 1);
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'ig_page_token'").get().value, 'REFRESHED');

  // 4) netinkamas raktas → būsena „expired“, svetainė nelūžta
  db.prepare("UPDATE settings SET value = 'BAD' WHERE key = 'ig_page_token'").run();
  require('../src/db').setSettings({});
  const r = await require('../src/instagram').sync();
  assert.equal(r.ok, false);
  assert.match(await (await req('/admin/instagram')).text(), /Prijunkite iš naujo|Prijungti iš naujo/);
  assert.equal((await fetch(base + '/')).status, 200);

  // 5) atjungimas
  const p3 = await (await req('/admin/instagram')).text();
  const c3 = p3.match(/name="_csrf" value="([^"]+)"/)[1];
  await req('/admin/instagram/disconnect', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `_csrf=${encodeURIComponent(c3)}` });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ig_auto').get().n, 0);
  assert.doesNotMatch(await (await fetch(base + '/')).text(), /id="instagram"/);
});
