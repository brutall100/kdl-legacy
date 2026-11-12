'use strict';

const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const config = require('../config');
const { db, getSettings } = require('../db');
const h = require('../helpers');
const { notifyInquiry } = require('../mailer');
const { withSizes } = require('../uploads');

const router = express.Router();

const dicts = {
  lt: require('../../locales/lt.json'),
  en: require('../../locales/en.json'),
};

const PATHS = {
  lt: { home: '/', news: '/naujienos', events: '/renginiai', gallery: '/galerija', privacy: '/privatumas', register: '/registracija' },
  en: { home: '/en', news: '/en/news', events: '/en/events', gallery: '/en/gallery', privacy: '/en/privacy', register: '/en/register' },
};

const NEWS_PER_PAGE = 12;
const FORM_MIN_MS = Number(process.env.FORM_MIN_MS ?? 1500);
const FORM_MAX_MS = 48 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Pagalbinės funkcijos                                                */
/* ------------------------------------------------------------------ */

const all = (sql, ...params) => db.prepare(sql).all(...params);
const get = (sql, ...params) => db.prepare(sql).get(...params);

function siteUrl(req) {
  return config.SITE_URL || `${req.protocol}://${req.get('host')}`;
}

const sign = (ts) =>
  crypto.createHmac('sha256', config.SESSION_SECRET).update(`form:${ts}`).digest('base64url').slice(0, 24);

function formToken() {
  const ts = Date.now().toString(36);
  return `${ts}.${sign(ts)}`;
}

function checkFormToken(token) {
  const [ts, sig] = String(token || '').split('.');
  if (!ts || !sig) return false;
  const expected = sign(ts);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const age = Date.now() - parseInt(ts, 36);
  return age >= FORM_MIN_MS && age < FORM_MAX_MS;
}

const itemSlug = (row, lang) => {
  const title = row[`title_${lang}`] || row.title_lt;
  const s = h.slugify(title);
  return s ? `${row.id}-${s}` : String(row.id);
};

/** Paruošia bendrus šablono kintamuosius. */
function setLocals(req, res, lang, extra = {}) {
  const s = getSettings();
  const dict = dicts[lang];
  const other = lang === 'lt' ? 'en' : 'lt';
  const root = siteUrl(req);
  const S = (name) => String(s[`${name}_${lang}`] || s[`${name}_lt`] || '').trim();
  const page = {
    title: '',
    description: S('seo_description'),
    alt: PATHS[other].home,
    image: '',
    ...extra,
  };
  const siteName = s.site_name || 'KD Legacy';
  Object.assign(res.locals, {
    lang,
    other,
    t: (key) => dict[key] ?? dicts.lt[key] ?? key,
    s,
    S,
    L: (row, name) => String((row && (row[`${name}_${lang}`] || row[`${name}_lt`])) || '').trim(),
    paths: PATHS[lang],
    siteName,
    page,
    fullTitle: page.title ? `${page.title} · ${siteName}` : `${siteName} – ${dict['footer.tagline']}`,
    root,
    canonical: root + (req.path === '/' ? '/' : req.path.replace(/\/+$/, '')),
    altUrl: page.alt,
    fmtDate: (iso, style) => h.fmtDate(iso, lang, style),
    paragraphs: h.paragraphs,
    lines: h.lines,
    slug: (row) => itemSlug(row, lang),
    socials: ['facebook', 'instagram', 'tiktok', 'youtube']
      .map((k) => ({ key: k, url: h.safeUrl(s[k]) }))
      .filter((x) => x.url),
    year: new Date().getFullYear(),
    isHome: false,
    // Kurios skiltys turi turinio (navigacijai)
    has: Object.fromEntries(
      ['classes', 'schedule', 'trainers', 'prices', 'gallery'].map((tbl) => [
        tbl,
        get(`SELECT EXISTS (SELECT 1 FROM ${tbl}) AS x`).x === 1,
      ])
    ),
  });
}

function scheduleByDay() {
  const rows = all(`
    SELECT s.*, c.name_lt AS class_lt, c.name_en AS class_en, t.name AS trainer
    FROM schedule s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN trainers t ON t.id = s.trainer_id
    ORDER BY s.weekday, s.start_time, s.id
  `);
  const days = new Map();
  for (const r of rows) {
    if (!days.has(r.weekday)) days.set(r.weekday, []);
    days.get(r.weekday).push(r);
  }
  return [...days.entries()].map(([weekday, items]) => ({ weekday, items }));
}

const upcomingEvents = (limit) =>
  all(
    `SELECT * FROM events
     WHERE published = 1 AND COALESCE(NULLIF(end_date, ''), date) >= ?
     ORDER BY date ASC, time ASC, id ASC LIMIT ?`,
    h.todayLocal(),
    limit
  );

function jsonLd(req, s, S) {
  const root = siteUrl(req);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    additionalType: 'https://schema.org/SportsActivityLocation',
    name: s.site_name || 'KD Legacy',
    description: S('seo_description'),
    url: root + '/',
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.address || undefined,
      addressLocality: s.city || 'Jonava',
      addressCountry: 'LT',
    },
    telephone: s.phone || undefined,
    email: s.email || undefined,
    image: s.logo ? `${root}/uploads/${s.logo}` : `${root}/img/og-image.jpg`,
    sameAs: ['facebook', 'instagram', 'tiktok', 'youtube'].map((k) => h.safeUrl(s[k])).filter(Boolean),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/* ------------------------------------------------------------------ */
/* Puslapiai                                                           */
/* ------------------------------------------------------------------ */

function home(lang) {
  return async (req, res) => {
    setLocals(req, res, lang, { alt: PATHS[lang === 'lt' ? 'en' : 'lt'].home });
    const { s, S } = res.locals;
    res.render('public/home', {
      isHome: true,
      classes: all('SELECT * FROM classes ORDER BY sort, id'),
      schedule: scheduleByDay(),
      trainers: all('SELECT * FROM trainers ORDER BY sort, id'),
      prices: all('SELECT * FROM prices ORDER BY sort, id'),
      faq: all('SELECT * FROM faq ORDER BY sort, id'),
      testimonials: all('SELECT * FROM testimonials ORDER BY sort, id'),
      news: all('SELECT * FROM news WHERE published = 1 ORDER BY published_at DESC, id DESC LIMIT 3'),
      events: upcomingEvents(4),
      gallery: await withSizes(all('SELECT * FROM gallery ORDER BY sort, id LIMIT 8')),
      galleryCount: get('SELECT COUNT(*) AS n FROM gallery').n,
      formToken: formToken(),
      sent: req.query.sent === '1',
      jsonLd: jsonLd(req, s, S),
    });
  };
}

function newsList(lang) {
  return (req, res) => {
    const other = lang === 'lt' ? 'en' : 'lt';
    const total = get('SELECT COUNT(*) AS n FROM news WHERE published = 1').n;
    const pages = Math.max(1, Math.ceil(total / NEWS_PER_PAGE));
    const current = Math.min(pages, Math.max(1, parseInt(req.query.p, 10) || 1));
    setLocals(req, res, lang, { title: dicts[lang]['news.pageTitle'], alt: PATHS[other].news, section: 'news' });
    res.render('public/news-list', {
      items: all(
        'SELECT * FROM news WHERE published = 1 ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?',
        NEWS_PER_PAGE,
        (current - 1) * NEWS_PER_PAGE
      ),
      pages,
      current,
    });
  };
}

function newsItem(lang) {
  return (req, res, next) => {
    const other = lang === 'lt' ? 'en' : 'lt';
    const id = parseInt(req.params.slug, 10);
    const item = id ? get('SELECT * FROM news WHERE id = ? AND published = 1', id) : null;
    if (!item) return next();
    const canonicalSlug = itemSlug(item, lang);
    if (req.params.slug !== canonicalSlug) return res.redirect(301, `${PATHS[lang].news}/${canonicalSlug}`);
    setLocals(req, res, lang, {
      title: item[`title_${lang}`] || item.title_lt,
      description: item[`summary_${lang}`] || item.summary_lt || h.stripTags(item[`body_${lang}`] || item.body_lt).slice(0, 180),
      alt: `${PATHS[other].news}/${itemSlug(item, other)}`,
      image: item.image,
      type: 'article',
      section: 'news',
    });
    res.render('public/article', {
      kind: 'news',
      item,
      others: all(
        'SELECT * FROM news WHERE published = 1 AND id != ? ORDER BY published_at DESC, id DESC LIMIT 3',
        item.id
      ),
    });
  };
}

function eventsList(lang) {
  return (req, res) => {
    const other = lang === 'lt' ? 'en' : 'lt';
    setLocals(req, res, lang, { title: dicts[lang]['events.pageTitle'], alt: PATHS[other].events, section: 'events' });
    res.render('public/events', {
      upcoming: upcomingEvents(100),
      past: all(
        `SELECT * FROM events
         WHERE published = 1 AND COALESCE(NULLIF(end_date, ''), date) < ?
         ORDER BY date DESC, id DESC LIMIT 40`,
        h.todayLocal()
      ),
    });
  };
}

function eventItem(lang) {
  return (req, res, next) => {
    const other = lang === 'lt' ? 'en' : 'lt';
    const id = parseInt(req.params.slug, 10);
    const item = id ? get('SELECT * FROM events WHERE id = ? AND published = 1', id) : null;
    if (!item) return next();
    const canonicalSlug = itemSlug(item, lang);
    if (req.params.slug !== canonicalSlug) return res.redirect(301, `${PATHS[lang].events}/${canonicalSlug}`);
    setLocals(req, res, lang, {
      title: item[`title_${lang}`] || item.title_lt,
      description: h.stripTags(item[`description_${lang}`] || item.description_lt).slice(0, 180),
      alt: `${PATHS[other].events}/${itemSlug(item, other)}`,
      image: item.image,
      type: 'article',
      section: 'events',
    });
    res.render('public/article', { kind: 'events', item, others: [] });
  };
}

function gallery(lang) {
  return async (req, res) => {
    const other = lang === 'lt' ? 'en' : 'lt';
    setLocals(req, res, lang, { title: dicts[lang]['gallery.pageTitle'], alt: PATHS[other].gallery, section: 'gallery' });
    res.render('public/gallery', { items: await withSizes(all('SELECT * FROM gallery ORDER BY sort, id')) });
  };
}

function privacy(lang) {
  return (req, res) => {
    const other = lang === 'lt' ? 'en' : 'lt';
    setLocals(req, res, lang, { title: dicts[lang]['privacy.title'], alt: PATHS[other].privacy });
    res.render('public/privacy');
  };
}

/* ------------------------------------------------------------------ */
/* Registracijos forma                                                 */
/* ------------------------------------------------------------------ */

const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.FORM_RATE_LIMIT) || 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: false,
  handler: (req, res) => respond(req, res, 429, 'register.errRate'),
});

const wantsJson = (req) => (req.get('accept') || '').includes('application/json');

function respond(req, res, status, errorKey) {
  const lang = req.path.startsWith('/en') ? 'en' : 'lt';
  if (wantsJson(req)) {
    return res.status(status).json(errorKey ? { ok: false, error: dicts[lang][errorKey] } : { ok: true });
  }
  if (!errorKey) return res.redirect(303, `${PATHS[lang].home}?sent=1#registracija`);
  setLocals(req, res, lang, { title: dicts[lang]['register.label'] });
  res.status(status).render('public/message', {
    heading: dicts[lang]['error.title'],
    text: dicts[lang][errorKey],
    backUrl: `${PATHS[lang].home}#registracija`,
  });
}

function register(lang) {
  return (req, res) => {
    const b = req.body || {};
    const clip = (v, n) => String(v || '').trim().slice(0, n);

    // Užklausa turi ateiti iš tos pačios svetainės.
    const origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) return respond(req, res, 403, 'register.errGeneric');
      } catch {
        return respond(req, res, 403, 'register.errGeneric');
      }
    }
    // Spąstai robotams: paslėptas laukas turi likti tuščias.
    if (clip(b.website, 200)) return respond(req, res, 200);
    if (!checkFormToken(b.token)) return respond(req, res, 400, 'register.errGeneric');

    const inquiry = {
      name: clip(b.name, 120),
      phone: clip(b.phone, 40),
      email: clip(b.email, 160),
      age: clip(b.age, 20),
      class_name: clip(b.class_name, 120),
      message: clip(b.message, 2000),
      lang,
    };
    if (inquiry.name.length < 2 || (!inquiry.phone && !inquiry.email)) {
      return respond(req, res, 400, 'register.errRequired');
    }
    if (inquiry.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inquiry.email)) {
      return respond(req, res, 400, 'register.errEmail');
    }
    if (!b.consent) return respond(req, res, 400, 'register.errConsent');

    db.prepare(
      `INSERT INTO inquiries (name, phone, email, age, class_name, message, lang, status, created_at)
       VALUES (@name, @phone, @email, @age, @class_name, @message, @lang, 'new', @created_at)`
    ).run({ ...inquiry, created_at: new Date().toISOString() });

    notifyInquiry(inquiry, getSettings()).catch((err) =>
      console.warn(`[mail] nepavyko išsiųsti pranešimo: ${err.message}`)
    );

    respond(req, res, 200);
  };
}

/* ------------------------------------------------------------------ */
/* Maršrutai                                                           */
/* ------------------------------------------------------------------ */

const formBody = express.urlencoded({ extended: false, limit: '30kb' });

/** Async maršrutų klaidos perduodamos klaidų tvarkytuvui. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

for (const lang of h.LANGS) {
  const p = PATHS[lang];
  router.get(p.home, wrap(home(lang)));
  router.get(p.news, newsList(lang));
  router.get(`${p.news}/:slug`, newsItem(lang));
  router.get(p.events, eventsList(lang));
  router.get(`${p.events}/:slug`, eventItem(lang));
  router.get(p.gallery, wrap(gallery(lang)));
  router.get(p.privacy, privacy(lang));
  router.post(p.register, registerLimiter, formBody, register(lang));
}

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\n\nSitemap: ${siteUrl(req)}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const root = siteUrl(req);
  const urls = [];
  for (const lang of h.LANGS) {
    const p = PATHS[lang];
    urls.push(p.home, p.news, p.events, p.gallery, p.privacy);
    for (const n of all('SELECT * FROM news WHERE published = 1')) urls.push(`${p.news}/${itemSlug(n, lang)}`);
    for (const e of all('SELECT * FROM events WHERE published = 1')) urls.push(`${p.events}/${itemSlug(e, lang)}`);
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${h.escapeHtml(root + u)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  res.type('application/xml').send(xml);
});

/* --- 404 ir klaidos --- */

router.use((req, res) => {
  const lang = req.path === '/en' || req.path.startsWith('/en/') ? 'en' : 'lt';
  setLocals(req, res, lang, { title: dicts[lang]['notFound.title'] });
  res.status(404).render('public/message', {
    heading: '404',
    text: `${dicts[lang]['notFound.title']}. ${dicts[lang]['notFound.text']}`,
    backUrl: PATHS[lang].home,
  });
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return;
  const lang = req.path === '/en' || req.path.startsWith('/en/') ? 'en' : 'lt';
  const status = err.status && err.status < 500 ? err.status : 500;
  try {
    setLocals(req, res, lang, { title: dicts[lang]['error.title'] });
    res.status(status).render('public/message', {
      heading: dicts[lang]['error.title'],
      text: dicts[lang]['error.text'],
      backUrl: PATHS[lang].home,
    });
  } catch {
    res.status(status).type('text').send('Server error');
  }
});

module.exports = router;
module.exports.PATHS = PATHS;
