'use strict';

const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const config = require('../config');
const { db, getSettings, setSettings } = require('../db');
const { resources, columnsFor, settingsGroups, settingsFields, WEEKDAYS } = require('../resources');
const SqliteStore = require('../session-store');
const up = require('../uploads');
const h = require('../helpers');

const router = express.Router();

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const STATUSES = { new: 'Nauja', contacted: 'Susisiekta', done: 'Užbaigta' };
const STATUS_TABS = { new: 'Naujos', contacted: 'Susisiekta', done: 'Užbaigtos' };

/* ------------------------------------------------------------------ */
/* Sesija, CSRF, bendri kintamieji                                     */
/* ------------------------------------------------------------------ */

router.use(
  session({
    name: 'kdlegacy.sid',
    secret: config.SESSION_SECRET,
    store: new SqliteStore(db, { ttlMs: SESSION_TTL }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: SESSION_TTL, path: '/admin' },
  })
);

router.use(express.urlencoded({ extended: false, limit: '2mb' }));
router.use(express.json({ limit: '200kb' }));

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('base64url');

  res.locals.csrf = req.session.csrf;
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.resources = resources;
  res.locals.active = '';
  res.locals.s = getSettings();
  res.locals.fmtDate = (iso) => h.fmtDate(iso, 'lt', 'medium');
  res.locals.weekdayName = (n) => (WEEKDAYS.find((w) => w.value === Number(n)) || {}).label || '';
  res.locals.statuses = STATUSES;
  res.locals.statusTabs = STATUS_TABS;
  res.locals.newInquiries = req.session.user
    ? db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'").get().n
    : 0;
  next();
});

// CSRF: visoms keičiančioms užklausoms. Multipart formos žetoną perduoda per ?_csrf=
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = String(req.get('x-csrf-token') || req.query._csrf || (req.body && req.body._csrf) || '');
  const expected = String(req.session.csrf || '');
  const ok =
    sent.length === expected.length &&
    expected.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) {
    return res.status(403).render('admin/error', {
      title: 'Sesija nebegalioja',
      message: 'Saugumo žetonas nebegalioja. Grįžkite atgal, perkraukite puslapį ir bandykite dar kartą.',
    });
  }
  next();
});

const flash = (req, type, msg) => {
  req.session.flash = { type, msg };
};

/* ------------------------------------------------------------------ */
/* Prisijungimas                                                       */
/* ------------------------------------------------------------------ */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: false,
  handler: (req, res) =>
    res.status(429).render('admin/login', {
      error: 'Per daug nesėkmingų bandymų. Pabandykite po 15 minučių.',
      username: '',
    }),
});

// Netikras hash – kad neegzistuojančio vartotojo patikra truktų tiek pat.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('admin/login', { error: null, username: '' });
});

router.post('/login', loginLimiter, (req, res, next) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH) && Boolean(user);
  if (!ok) {
    return res.status(401).render('admin/login', {
      error: 'Neteisingas vartotojo vardas arba slaptažodis.',
      username,
    });
  }
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = { id: user.id, username: user.username };
    req.session.csrf = crypto.randomBytes(24).toString('base64url');
    req.session.save(() => res.redirect('/admin'));
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('kdlegacy.sid', { path: '/admin' });
    res.redirect('/admin/login');
  });
});

router.use((req, res, next) => {
  if (req.session.user) return next();
  if (req.method === 'GET') return res.redirect('/admin/login');
  res.status(401).render('admin/login', { error: 'Prisijunkite iš naujo.', username: '' });
});

/* ------------------------------------------------------------------ */
/* Formų apdorojimas                                                   */
/* ------------------------------------------------------------------ */

const MAX_LEN = { text: 300, textarea: 6000, lines: 3000, richtext: 60000, url: 500 };

function fieldNames(f) {
  return f.i18n ? [`${f.name}_lt`, `${f.name}_en`] : [f.name];
}

function loadOptions(fields) {
  const out = {};
  for (const f of fields) {
    if (f.options) out[f.name] = f.options;
    else if (f.optionsFrom) {
      out[f.name] = db
        .prepare(`SELECT id AS value, ${f.optionsFrom.label} AS label FROM ${f.optionsFrom.table} ORDER BY sort, id`)
        .all();
    }
  }
  return out;
}

function defaultsFor(fields) {
  const row = {};
  for (const f of fields) {
    const d = typeof f.default === 'function' ? f.default() : f.default;
    for (const n of fieldNames(f)) row[n] = d ?? (f.type === 'checkbox' ? 0 : '');
  }
  return row;
}

/**
 * Nuskaito ir patikrina formos laukus.
 * Failai apdorojami tik tada, kai tekstiniai laukai teisingi.
 * @returns {Promise<{values: object, errors: string[], stale: string[]}>}
 */
async function readFields(fields, req, existing = {}) {
  const body = req.body || {};
  const files = req.files || [];
  const options = loadOptions(fields);
  const values = {};
  const errors = [];
  const stale = []; // seni failai, kuriuos reikia ištrinti po sėkmingo išsaugojimo

  for (const name of req.rejectedFiles || []) {
    errors.push(`Failo „${name}“ formatas nepalaikomas. Nuotraukoms naudokite JPG, PNG arba WebP, vaizdo įrašui – MP4 arba WebM.`);
  }

  for (const f of fields) {
    for (const n of fieldNames(f)) {
      const raw = body[n];
      switch (f.type) {
        case 'checkbox':
          values[n] = raw ? 1 : 0;
          break;
        case 'richtext':
          values[n] = h.cleanRichText(String(raw || '').slice(0, MAX_LEN.richtext));
          break;
        case 'date': {
          const v = String(raw || '').trim();
          values[n] = h.isDate(v) ? v : '';
          if (v && !values[n]) errors.push(`„${f.label}“: neteisinga data.`);
          break;
        }
        case 'time': {
          const v = String(raw || '').trim().slice(0, 5);
          values[n] = h.isTime(v) ? v : '';
          if (v && !values[n]) errors.push(`„${f.label}“: neteisingas laikas.`);
          break;
        }
        case 'url': {
          const v = String(raw || '').trim().slice(0, MAX_LEN.url);
          values[n] = h.safeUrl(v);
          if (v && !values[n]) errors.push(`„${f.label}“: neteisinga nuoroda (turi prasidėti https://).`);
          break;
        }
        case 'select': {
          const opts = options[f.name] || [];
          const match = opts.find((o) => String(o.value) === String(raw ?? ''));
          values[n] = match ? match.value : f.int ? null : '';
          break;
        }
        case 'image':
        case 'video':
          values[n] = existing[n] || '';
          break;
        default:
          values[n] = String(raw || '')
            .replace(/\r\n/g, '\n')
            .trim()
            .slice(0, MAX_LEN[f.type] || MAX_LEN.text);
      }
    }
  }

  // Privalomi laukai (dvikalbiams – privaloma tik lietuviška versija)
  for (const f of fields) {
    if (!f.required) continue;
    const n = f.i18n ? `${f.name}_lt` : f.name;
    if (f.type === 'image') {
      const hasFile = files.some((x) => x.fieldname === n);
      if (!hasFile && (!existing[n] || body[`${n}__remove`])) errors.push(`Įkelkite failą: „${f.label}“.`);
    } else if (values[n] === '' || values[n] == null) {
      errors.push(`Laukas „${f.label}“ yra privalomas.`);
    }
  }
  if (errors.length) return { values, errors, stale };

  // Failai
  for (const f of fields) {
    if (f.type !== 'image' && f.type !== 'video') continue;
    for (const n of fieldNames(f)) {
      const file = files.find((x) => x.fieldname === n);
      if (file) {
        try {
          values[n] = f.type === 'video' ? up.saveVideo(file) : await up.saveImage(file.path);
          if (existing[n]) stale.push(existing[n]);
        } catch (err) {
          errors.push(`Nepavyko apdoroti failo „${file.originalname}“. Naudokite JPG, PNG arba WebP.`);
        }
      } else if (body[`${n}__remove`] && existing[n]) {
        stale.push(existing[n]);
        values[n] = '';
      }
    }
  }
  return { values, errors, stale };
}

function removeFiles(names) {
  for (const n of names) {
    up.deleteImage(n);
    up.deleteVideo(n);
  }
}

/** Multer su draugiškais klaidų pranešimais. */
function upload(instance) {
  const mw = instance.any();
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      up.cleanupTmp(req.files);
      const msg =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? `Failas per didelis. Didžiausias leidžiamas dydis: nuotraukai ${config.MAX_IMAGE_MB} MB, vaizdo įrašui ${config.MAX_VIDEO_MB} MB.`
          : 'Nepavyko įkelti failo. Bandykite dar kartą.';
      if ((req.get('accept') || '').includes('application/json')) return res.status(400).json({ ok: false, error: msg });
      flash(req, 'error', msg);
      res.redirect(req.get('referer') || '/admin');
    });
  };
}

/* ------------------------------------------------------------------ */
/* Skydelis                                                            */
/* ------------------------------------------------------------------ */

router.get('/', (req, res) => {
  const s = getSettings();
  const counts = {};
  for (const r of Object.values(resources)) {
    counts[r.key] = db.prepare(`SELECT COUNT(*) AS n FROM ${r.table}`).get().n;
  }
  const todo = [];
  if (!s.phone && !s.email) todo.push({ text: 'Įrašykite telefoną ir el. paštą', href: '/admin/settings#contacts' });
  if (!s.address) todo.push({ text: 'Įrašykite studijos adresą (atsiras žemėlapis)', href: '/admin/settings#contacts' });
  if (!s.facebook && !s.instagram) todo.push({ text: 'Pridėkite Facebook / Instagram nuorodas', href: '/admin/settings#social' });
  if (s.demo_content === '1') {
    todo.push({ text: 'Peržiūrėkite pavyzdinį tvarkaraštį', href: '/admin/r/schedule' });
    todo.push({ text: 'Peržiūrėkite pavyzdines kainas', href: '/admin/r/prices' });
    todo.push({ text: 'Pakeiskite pavyzdinius trenerius tikrais', href: '/admin/r/trainers' });
    todo.push({ text: 'Pakeiskite pavyzdinius renginius ir galerijos nuotraukas', href: '/admin/r/events' });
  }
  res.render('admin/dashboard', {
    active: 'dashboard',
    counts,
    todo,
    demo: s.demo_content === '1',
    inquiries: db.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT 5').all(),
  });
});

router.post('/demo-off', (req, res) => {
  setSettings({ demo_content: '0' });
  flash(req, 'ok', 'Juosta „svetainė dar pildoma“ paslėpta.');
  res.redirect('/admin');
});

/* ------------------------------------------------------------------ */
/* Resursai (bendras CRUD)                                             */
/* ------------------------------------------------------------------ */

router.param('resource', (req, res, next, key) => {
  if (!Object.prototype.hasOwnProperty.call(resources, key)) {
    return res.status(404).render('admin/error', { title: 'Nerasta', message: 'Tokio puslapio nėra.' });
  }
  req.resource = resources[key];
  res.locals.resource = req.resource;
  res.locals.active = key;
  next();
});

const orderOf = (r) => r.orderBy || 'sort ASC, id ASC';

function listRows(r) {
  if (r.key === 'schedule') {
    return db
      .prepare(
        `SELECT s.*, COALESCE(NULLIF(s.title_lt, ''), c.name_lt, '—') AS _title
         FROM schedule s LEFT JOIN classes c ON c.id = s.class_id ORDER BY ${orderOf(r)}`
      )
      .all();
  }
  return db.prepare(`SELECT * FROM ${r.table} ORDER BY ${orderOf(r)}`).all();
}

function nextSort(r) {
  if (!r.sortable) return undefined;
  const row = db.prepare(`SELECT MIN(sort) AS lo, MAX(sort) AS hi FROM ${r.table}`).get();
  return r.newFirst ? (row.lo ?? 1) - 1 : (row.hi ?? 0) + 1;
}

function insertRow(r, values) {
  const row = { ...values, created_at: new Date().toISOString() };
  if (r.sortable) row.sort = nextSort(r);
  const cols = columnsFor(r)
    .map(([n]) => n)
    .filter((n) => n in row);
  return db
    .prepare(`INSERT INTO ${r.table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`)
    .run(row).lastInsertRowid;
}

function updateRow(r, id, values) {
  const cols = columnsFor(r)
    .map(([n]) => n)
    .filter((n) => n in values);
  db.prepare(`UPDATE ${r.table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({
    ...values,
    id,
  });
}

function setOrder(r, ids) {
  const stmt = db.prepare(`UPDATE ${r.table} SET sort = ? WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))();
}

const getRow = (r, id) => db.prepare(`SELECT * FROM ${r.table} WHERE id = ?`).get(Number(id) || 0);

router.get('/r/:resource', (req, res) => {
  res.render('admin/list', { rows: listRows(req.resource) });
});

router.get('/r/:resource/new', (req, res) => {
  const r = req.resource;
  res.render('admin/form', {
    row: defaultsFor(r.fields),
    isNew: true,
    errors: [],
    options: loadOptions(r.fields),
    action: `/admin/r/${r.key}`,
  });
});

router.post('/r/:resource', upload(up.imageUpload), async (req, res, next) => {
  const r = req.resource;
  try {
    const { values, errors, stale } = await readFields(r.fields, req);
    if (errors.length) {
      return res.status(400).render('admin/form', {
        row: values,
        isNew: true,
        errors,
        options: loadOptions(r.fields),
        action: `/admin/r/${r.key}`,
      });
    }
    insertRow(r, values);
    removeFiles(stale);
    flash(req, 'ok', 'Išsaugota.');
    res.redirect(`/admin/r/${r.key}`);
  } catch (err) {
    next(err);
  } finally {
    up.cleanupTmp(req.files);
  }
});

// Kelių nuotraukų įkėlimas iš karto (galerija)
router.post('/r/:resource/bulk', upload(up.imageUpload), async (req, res, next) => {
  const r = req.resource;
  const json = (req.get('accept') || '').includes('application/json');
  if (!r.bulkUpload) return res.status(404).end();
  try {
    let saved = 0;
    const failed = [...(req.rejectedFiles || [])];
    for (const file of req.files || []) {
      try {
        const image = await up.saveImage(file.path);
        insertRow(r, { ...defaultsFor(r.fields), image });
        saved++;
      } catch {
        failed.push(file.originalname);
      }
    }
    if (json) return res.status(saved || !failed.length ? 200 : 400).json({ ok: saved > 0, saved, failed });
    if (saved) flash(req, 'ok', `Įkelta nuotraukų: ${saved}.${failed.length ? ` Nepavyko: ${failed.join(', ')}.` : ''}`);
    else flash(req, 'error', 'Nepavyko įkelti nuotraukų. Naudokite JPG, PNG arba WebP failus.');
    res.redirect(`/admin/r/${r.key}`);
  } catch (err) {
    next(err);
  } finally {
    up.cleanupTmp(req.files);
  }
});

router.post('/r/:resource/reorder', (req, res) => {
  const r = req.resource;
  if (!r.sortable) return res.status(400).json({ ok: false });
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  const known = new Set(db.prepare(`SELECT id FROM ${r.table}`).all().map((x) => x.id));
  if (!ids.length || ids.some((id) => !known.has(id))) return res.status(400).json({ ok: false });
  setOrder(r, ids);
  res.json({ ok: true });
});

router.get('/r/:resource/:id/edit', (req, res) => {
  const r = req.resource;
  const row = getRow(r, req.params.id);
  if (!row) return res.status(404).render('admin/error', { title: 'Nerasta', message: 'Įrašas nerastas.' });
  res.render('admin/form', {
    row,
    isNew: false,
    errors: [],
    options: loadOptions(r.fields),
    action: `/admin/r/${r.key}/${row.id}`,
  });
});

router.post('/r/:resource/:id', upload(up.imageUpload), async (req, res, next) => {
  const r = req.resource;
  try {
    const existing = getRow(r, req.params.id);
    if (!existing) return res.status(404).render('admin/error', { title: 'Nerasta', message: 'Įrašas nerastas.' });
    const { values, errors, stale } = await readFields(r.fields, req, existing);
    if (errors.length) {
      return res.status(400).render('admin/form', {
        row: { ...existing, ...values },
        isNew: false,
        errors,
        options: loadOptions(r.fields),
        action: `/admin/r/${r.key}/${existing.id}`,
      });
    }
    updateRow(r, existing.id, values);
    removeFiles(stale);
    flash(req, 'ok', 'Pakeitimai išsaugoti.');
    res.redirect(`/admin/r/${r.key}`);
  } catch (err) {
    next(err);
  } finally {
    up.cleanupTmp(req.files);
  }
});

router.post('/r/:resource/:id/move', (req, res) => {
  const r = req.resource;
  if (r.sortable) {
    const ids = db.prepare(`SELECT id FROM ${r.table} ORDER BY ${orderOf(r)}`).all().map((x) => x.id);
    const i = ids.indexOf(Number(req.params.id));
    const j = req.body.dir === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < ids.length) {
      [ids[i], ids[j]] = [ids[j], ids[i]];
      setOrder(r, ids);
    }
  }
  res.redirect(`/admin/r/${r.key}`);
});

router.post('/r/:resource/:id/delete', (req, res) => {
  const r = req.resource;
  const row = getRow(r, req.params.id);
  if (row) {
    db.transaction(() => {
      // Tvarkaraščio įrašai neturi „pamesti“ pavadinimo ištrynus stilių / trenerį.
      if (r.key === 'classes') {
        db.prepare(
          `UPDATE schedule SET
             title_lt = CASE WHEN COALESCE(title_lt, '') = '' THEN ? ELSE title_lt END,
             title_en = CASE WHEN COALESCE(title_en, '') = '' THEN ? ELSE title_en END,
             class_id = NULL
           WHERE class_id = ?`
        ).run(row.name_lt || '', row.name_en || '', row.id);
      }
      if (r.key === 'trainers') db.prepare('UPDATE schedule SET trainer_id = NULL WHERE trainer_id = ?').run(row.id);
      db.prepare(`DELETE FROM ${r.table} WHERE id = ?`).run(row.id);
    })();
    removeFiles(r.fields.filter((f) => f.type === 'image').flatMap((f) => fieldNames(f).map((n) => row[n])).filter(Boolean));
    flash(req, 'ok', 'Ištrinta.');
  }
  res.redirect(`/admin/r/${r.key}`);
});

/* ------------------------------------------------------------------ */
/* Registracijos (užklausos)                                           */
/* ------------------------------------------------------------------ */

router.get('/inquiries', (req, res) => {
  const filter = Object.prototype.hasOwnProperty.call(STATUSES, req.query.status) ? req.query.status : '';
  const rows = filter
    ? db.prepare('SELECT * FROM inquiries WHERE status = ? ORDER BY id DESC').all(filter)
    : db.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT 500').all();
  res.render('admin/inquiries', { active: 'inquiries', rows, filter });
});

router.get('/inquiries.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all();
  // Apsauga nuo formulių injekcijos atidarius Excel programoje.
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['Data', 'Vardas', 'Telefonas', 'El. paštas', 'Amžius', 'Stilius', 'Žinutė', 'Kalba', 'Būsena'];
  const lines = rows.map((r) =>
    [r.created_at, r.name, r.phone, r.email, r.age, r.class_name, r.message, r.lang, STATUSES[r.status] || r.status]
      .map(cell)
      .join(';')
  );
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="registracijos.csv"');
  res.send('﻿' + [head.map(cell).join(';'), ...lines].join('\r\n'));
});

router.post('/inquiries/:id/status', (req, res) => {
  if (Object.prototype.hasOwnProperty.call(STATUSES, req.body.status)) {
    db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id) || 0);
  }
  res.redirect(req.get('referer') || '/admin/inquiries');
});

router.post('/inquiries/:id/delete', (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(Number(req.params.id) || 0);
  flash(req, 'ok', 'Registracija ištrinta.');
  res.redirect(req.get('referer') || '/admin/inquiries');
});

/* ------------------------------------------------------------------ */
/* Nustatymai                                                          */
/* ------------------------------------------------------------------ */

router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    active: 'settings',
    groups: settingsGroups,
    row: { ...defaultsFor(settingsFields), ...getSettings() },
    errors: [],
    options: {},
  });
});

router.post('/settings', upload(up.settingsUpload), async (req, res, next) => {
  try {
    const existing = getSettings();
    const { values, errors, stale } = await readFields(settingsFields, req, existing);
    if (errors.length) {
      return res.status(400).render('admin/settings', {
        active: 'settings',
        groups: settingsGroups,
        row: { ...existing, ...values },
        errors,
        options: {},
      });
    }
    setSettings(values);
    removeFiles(stale);
    flash(req, 'ok', 'Nustatymai išsaugoti.');
    res.redirect('/admin/settings');
  } catch (err) {
    next(err);
  } finally {
    up.cleanupTmp(req.files);
  }
});

/* ------------------------------------------------------------------ */
/* Paskyra                                                             */
/* ------------------------------------------------------------------ */

router.get('/account', (req, res) => {
  res.render('admin/account', { active: 'account', errors: [] });
});

router.post('/account', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  const current = String(req.body.current || '');
  const next1 = String(req.body.password || '');
  const next2 = String(req.body.password2 || '');
  const errors = [];
  if (!user || !bcrypt.compareSync(current, user.password_hash)) errors.push('Dabartinis slaptažodis neteisingas.');
  if (next1.length < 10) errors.push('Naujas slaptažodis turi būti bent 10 simbolių.');
  if (next1.length > 200) errors.push('Naujas slaptažodis per ilgas.');
  if (next1 !== next2) errors.push('Nauji slaptažodžiai nesutampa.');
  if (errors.length) return res.status(400).render('admin/account', { active: 'account', errors });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next1, 12), user.id);
  // Atjungiam visas kitas sesijas.
  db.prepare('DELETE FROM sessions WHERE sid != ?').run(req.sessionID);
  flash(req, 'ok', 'Slaptažodis pakeistas.');
  res.redirect('/admin/account');
});

/* ------------------------------------------------------------------ */
/* 404 ir klaidos                                                      */
/* ------------------------------------------------------------------ */

router.use((req, res) => {
  res.status(404).render('admin/error', { title: 'Nerasta', message: 'Tokio puslapio nėra.' });
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  console.error(err);
  up.cleanupTmp(req.files);
  if (res.headersSent) return;
  res.status(err.status && err.status < 500 ? err.status : 500).render('admin/error', {
    title: 'Klaida',
    message: 'Įvyko klaida. Bandykite dar kartą.',
  });
});

module.exports = router;
