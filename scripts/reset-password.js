'use strict';

/**
 * Administratoriaus slaptažodžio atstatymas.
 *
 *   npm run reset-password                 -> sugeneruoja naują slaptažodį vartotojui „admin“
 *   npm run reset-password -- vardas       -> kitam vartotojui (sukuria, jei nėra)
 *   npm run reset-password -- vardas slapt -> nustato konkretų slaptažodį
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../src/db');

const username = (process.argv[2] || process.env.ADMIN_USER || 'admin').trim();
const password = process.argv[3] || crypto.randomBytes(9).toString('base64url');

if (password.length < 10) {
  console.error('Slaptažodis turi būti bent 10 simbolių.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
} else {
  db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    username,
    hash,
    new Date().toISOString()
  );
}
db.prepare('DELETE FROM sessions').run();

console.log(`\n  Vartotojas:  ${username}`);
console.log(`  Slaptažodis: ${process.argv[3] ? '(nustatytas jūsų nurodytas)' : password}`);
console.log('  Visos ankstesnės sesijos atjungtos.\n');
