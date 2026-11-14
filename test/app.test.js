'use strict';

/**
 * Integraciniai testai: paleidžiama tikra programa su laikina duomenų baze.
 * Paleidimas: npm test
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kdlegacy-test-'));
process.env.DATA_DIR = DATA_DIR;
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test-password-123';
process.env.FORM_MIN_MS = '0';
process.env.FORM_RATE_LIMIT = '1000';
process.env.LOGIN_RATE_LIMIT = '1000';

const { ensureAdminUser, db } = require('../src/db');
const { seed } = require('../src/seed');
const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  await seed();
  ensureAdminUser();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

/* --- paprastas „naršyklės“ klientas su slapukais --- */
function client() {
  const jar = new Map();
  return async function req(url, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(base + url, { redirect: 'manual', ...opts, headers });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
}

const csrfFrom = (html) => (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];
const form = (obj) => new URLSearchParams(obj).toString();
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

async function login() {
  const req = client();
  const page = await (await req('/admin/login')).text();
  const res = await req('/admin/login', {
    method: 'POST',
    headers: FORM,
    body: form({ _csrf: csrfFrom(page), username: 'admin', password: 'test-password-123' }),
  });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin');
  return req;
}

/* ------------------------------------------------------------------ */

test('viešieji puslapiai veikia LT ir EN kalbomis', async () => {
  for (const url of ['/', '/en', '/naujienos', '/en/news', '/renginiai', '/en/events', '/galerija', '/en/gallery', '/privatumas', '/en/privacy']) {
    const res = await fetch(base + url);
    assert.equal(res.status, 200, url);
  }
  const lt = await (await fetch(base + '/')).text();
  assert.match(lt, /<html lang="lt">/);
  assert.match(lt, /id="kd-logo"/, 'logotipas įtrauktas');
  assert.match(lt, /Turgaus g\. 11/);
  assert.match(lt, /Sukūrė <a href="https:\/\/aldas-portfolio\.site\/"/);
  assert.match(lt, /facebook\.com\/share\/1EAW7RiHc2/);
  const en = await (await fetch(base + '/en')).text();
  assert.match(en, /<html lang="en">/);
  assert.match(en, /Book a trial class/);
});

test('naujienos straipsnis pasiekiamas, neteisingas adresas peradresuojamas', async () => {
  const id = db.prepare('SELECT id FROM news ORDER BY id LIMIT 1').get().id;
  const res = await fetch(`${base}/naujienos/${id}-bet-kas`, { redirect: 'manual' });
  assert.equal(res.status, 301);
  const ok = await fetch(base + res.headers.get('location'));
  assert.equal(ok.status, 200);
});

test('nežinomas puslapis grąžina 404', async () => {
  const res = await fetch(base + '/tokio-nera');
  assert.equal(res.status, 404);
});

test('robots.txt ir sitemap.xml', async () => {
  assert.match(await (await fetch(base + '/robots.txt')).text(), /Disallow: \/admin/);
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  assert.match(sm, /<urlset/);
  assert.match(sm, /\/en\/news\//);
});

test('registracijos forma išsaugo užklausą', async () => {
  const page = await (await fetch(base + '/')).text();
  const token = page.match(/name="token" value="([^"]+)"/)[1];
  const before = db.prepare('SELECT COUNT(*) n FROM inquiries').get().n;
  const res = await fetch(base + '/registracija', {
    method: 'POST',
    headers: { ...FORM, accept: 'application/json' },
    body: form({ token, name: 'Testas Testaitis', phone: '+37060000000', consent: '1', website: '' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM inquiries').get().n, before + 1);
});

test('registracijos forma atmeta neteisingus duomenis ir robotus', async () => {
  const page = await (await fetch(base + '/')).text();
  const token = page.match(/name="token" value="([^"]+)"/)[1];
  const post = (body) =>
    fetch(base + '/registracija', { method: 'POST', headers: { ...FORM, accept: 'application/json' }, body: form(body) });

  assert.equal((await post({ token, name: 'A', phone: '', consent: '1' })).status, 400);
  assert.equal((await post({ token, name: 'Jonas', phone: '+370', consent: '' })).status, 400);
  assert.equal((await post({ token: 'blogas.zetonas', name: 'Jonas', phone: '+370', consent: '1' })).status, 400);

  // užpildytas paslėptas laukas – „sėkmė“, bet niekas neišsaugoma
  const n = db.prepare('SELECT COUNT(*) n FROM inquiries').get().n;
  const bot = await post({ token, name: 'Bot', phone: '+370', consent: '1', website: 'http://spam' });
  assert.equal(bot.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM inquiries').get().n, n);
});

test('admin panelė be prisijungimo nepasiekiama', async () => {
  const res = await fetch(base + '/admin/r/news', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin/login');
});

test('neteisingas slaptažodis atmetamas', async () => {
  const req = client();
  const page = await (await req('/admin/login')).text();
  const res = await req('/admin/login', {
    method: 'POST',
    headers: FORM,
    body: form({ _csrf: csrfFrom(page), username: 'admin', password: 'neteisingas' }),
  });
  assert.equal(res.status, 401);
});

test('admin: naujienos sukūrimas, CSRF apsauga ir HTML valymas', async () => {
  const req = await login();
  const page = await (await req('/admin/r/news/new')).text();
  const csrf = csrfFrom(page) || page.match(/_csrf=([^"&]+)/)[1];

  // be CSRF žetono – draudžiama
  const fd0 = new FormData();
  fd0.append('title_lt', 'Be žetono');
  fd0.append('published_at', '2026-01-01');
  assert.equal((await req('/admin/r/news', { method: 'POST', body: fd0 })).status, 403);

  const fd = new FormData();
  fd.append('title_lt', 'Testinė naujiena');
  fd.append('title_en', 'Test news');
  fd.append('body_lt', '<p>Sveiki <strong>visi</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>');
  fd.append('published_at', '2026-01-02');
  fd.append('published', '1');
  const res = await req(`/admin/r/news?_csrf=${encodeURIComponent(decodeURIComponent(csrf))}`, { method: 'POST', body: fd });
  assert.equal(res.status, 302);

  const row = db.prepare("SELECT * FROM news WHERE title_lt = 'Testinė naujiena'").get();
  assert.ok(row);
  assert.equal(row.body_lt, '<p>Sveiki <strong>visi</strong></p>');

  const pub = await (await fetch(base + '/naujienos')).text();
  assert.match(pub, /Testinė naujiena/);
  const en = await (await fetch(base + '/en/news')).text();
  assert.match(en, /Test news/);
});

test('admin: nuotraukos įkėlimas į galeriją ir netinkamo failo atmetimas', async () => {
  const req = await login();
  const page = await (await req('/admin/r/gallery')).text();
  const csrf = decodeURIComponent(page.match(/_csrf=([^"&]+)/)[1]);
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ff2e93' } }).png().toBuffer();

  const fd = new FormData();
  fd.append('files', new Blob([png], { type: 'image/png' }), 'nuotrauka.png');
  fd.append('files', new Blob(['ne nuotrauka'], { type: 'text/plain' }), 'tekstas.txt');
  const before = db.prepare('SELECT COUNT(*) n FROM gallery').get().n;
  const res = await req(`/admin/r/gallery/bulk?_csrf=${encodeURIComponent(csrf)}`, {
    method: 'POST',
    body: fd,
    headers: { accept: 'application/json' },
  });
  const data = await res.json();
  assert.equal(data.saved, 1);
  assert.deepEqual(data.failed, ['tekstas.txt']);
  const row = db.prepare('SELECT * FROM gallery ORDER BY id DESC LIMIT 1').get();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gallery').get().n, before + 1);
  assert.match(row.image, /^[a-f0-9]{24}\.webp$/);
  assert.equal((await fetch(`${base}/uploads/${row.image}`)).status, 200);
});

test('įkeltų failų kataloge negalima išeiti už jo ribų', async () => {
  const res = await fetch(base + '/uploads/..%2F..%2Fkdlegacy.sqlite');
  assert.notEqual(res.status, 200);
});

test('admin: atsarginė kopija atsisiunčiama kaip ZIP', async () => {
  const req = await login();
  assert.equal((await req('/admin/backup')).status, 200);
  const res = await req('/admin/backup.zip');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/zip');
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  assert.ok(buf.includes(Buffer.from('kdlegacy.sqlite')));
  assert.ok(buf.includes(Buffer.from('uploads/')));
  const anon = await fetch(base + '/admin/backup.zip', { redirect: 'manual' });
  assert.equal(anon.status, 302);
});

test('admin: .mov vaizdo įrašas konvertuojamas į MP4 fone', { skip: !require('../src/video').available }, async () => {
  const { execFileSync } = require('child_process');
  const ffmpeg = require('ffmpeg-static');
  const mov = path.join(DATA_DIR, 'test.mov');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mov', mov]);
  const req = await login();
  const page = await (await req('/admin/settings')).text();
  const csrf = decodeURIComponent(page.match(/_csrf=([^"&]+)/)[1]);
  const fd = new FormData();
  fd.append('site_name', 'KD Legacy');
  fd.append('hero_video', new Blob([fs.readFileSync(mov)], { type: 'video/quicktime' }), 'telefonas.mov');
  const res = await req(`/admin/settings?_csrf=${encodeURIComponent(csrf)}`, { method: 'POST', body: fd });
  assert.equal(res.status, 302);
  const get = () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  for (let i = 0; i < 100 && get().hero_video_status === 'converting'; i++) await new Promise((r) => setTimeout(r, 200));
  const s = get();
  assert.equal(s.hero_video_status, '');
  assert.match(s.hero_video, /^[a-f0-9]{24}\.mp4$/);
  const vid = await fetch(`${base}/uploads/${s.hero_video}`);
  assert.equal(vid.status, 200);
  assert.match(vid.headers.get('content-type'), /video\/mp4/);
});
