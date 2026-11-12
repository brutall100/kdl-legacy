'use strict';

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { resources, columnsFor, settingsFields } = require('./resources');

const db = new Database(path.join(config.DATA_DIR, 'kdlegacy.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    sid     TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inquiries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT,
    email      TEXT,
    age        TEXT,
    class_name TEXT,
    message    TEXT,
    lang       TEXT,
    status     TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
`);

// Resursų lentelės kuriamos (ir papildomos naujais stulpeliais) pagal aprašus.
for (const r of Object.values(resources)) {
  const cols = columnsFor(r);
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${r.table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols
      .map(([n, t]) => `${n} ${t}`)
      .join(', ')})`
  );
  const existing = new Set(db.prepare(`PRAGMA table_info(${r.table})`).all().map((c) => c.name));
  for (const [n, t] of cols) {
    if (!existing.has(n)) db.exec(`ALTER TABLE ${r.table} ADD COLUMN ${n} ${t}`);
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

let settingsCache = null;

function getSettings() {
  if (!settingsCache) {
    settingsCache = {};
    for (const row of db.prepare('SELECT key, value FROM settings').all()) {
      settingsCache[row.key] = row.value ?? '';
    }
  }
  return settingsCache;
}

const upsertSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function setSettings(values) {
  const tx = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) upsertSetting.run(k, v == null ? '' : String(v));
  });
  tx(values);
  settingsCache = null;
}

/** Visi leidžiami nustatymų raktai (pagal laukų aprašus). */
function settingKeys() {
  const keys = [];
  for (const f of settingsFields) {
    if (f.i18n) keys.push(`${f.name}_lt`, `${f.name}_en`);
    else keys.push(f.name);
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

function ensureAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return null;
  const username = (process.env.ADMIN_USER || 'admin').trim();
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    username,
    bcrypt.hashSync(password, 12),
    new Date().toISOString()
  );
  return { username, password, generated };
}

module.exports = { db, getSettings, setSettings, settingKeys, ensureAdminUser };
