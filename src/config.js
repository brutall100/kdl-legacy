'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

// Load .env (if present) without extra dependencies.
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  /* no .env file – fine */
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, '.session-secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch {
    /* generate below */
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

function trustProxy() {
  const v = process.env.TRUST_PROXY;
  if (v === undefined || v === '') return process.env.NODE_ENV === 'production' ? 1 : false;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  SITE_URL: (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, ''),
  SESSION_SECRET: sessionSecret(),
  TRUST_PROXY: trustProxy(),
  IS_PROD: process.env.NODE_ENV === 'production',
  MAX_IMAGE_MB: Number(process.env.MAX_IMAGE_MB) || 20,
  MAX_VIDEO_MB: Number(process.env.MAX_VIDEO_MB) || 150,
  SMTP: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },
};
