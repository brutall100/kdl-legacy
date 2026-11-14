'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

// Taupus atminties naudojimas mažame serveryje (pvz. Render 512 MB):
// be libvips talpyklos ir po vieną apdorojimo giją – nuotraukos apdorojamos šiek tiek lėčiau,
// bet atminties užimtumas daug mažesnis ir stabilus.
sharp.cache(false);
sharp.concurrency(Number(process.env.SHARP_CONCURRENCY) || 1);
const config = require('./config');

const IMAGE_RE = /^[a-f0-9]{24}\.webp$/;
const VIDEO_RE = /^[a-f0-9]{24}\.(mp4|webm)$/;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/tiff']);
const VIDEO_MIMES = { 'video/mp4': 'mp4', 'video/webm': 'webm' };

const TMP_DIR = path.join(config.DATA_DIR, 'tmp');
fs.rmSync(TMP_DIR, { recursive: true, force: true }); // išvalom nebaigtus įkėlimus
fs.mkdirSync(TMP_DIR, { recursive: true });

const newId = () => crypto.randomBytes(12).toString('hex');

function fileFilter(req, file, cb) {
  const ok = file.fieldname === 'hero_video' ? Boolean(VIDEO_MIMES[file.mimetype]) : IMAGE_MIMES.has(file.mimetype);
  // Atmestus failus įsimename, kad forma galėtų parodyti aiškų pranešimą.
  if (!ok) (req.rejectedFiles ||= []).push(file.originalname);
  cb(null, ok);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => cb(null, newId()),
});

/** Paveikslėlių įkėlimas (resursų formos, galerija). */
const imageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.MAX_IMAGE_MB * 1024 * 1024, files: 40 },
});

/** Nustatymų forma: paveikslėliai + fono vaizdo įrašas (didesnis limitas). */
const settingsUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.MAX_VIDEO_MB * 1024 * 1024, files: 4 },
});

/**
 * Apdoroja paveikslėlį: pasuka pagal EXIF, pašalina metaduomenis (pvz. GPS),
 * sumažina ir išsaugo WebP + miniatiūrą.
 * @param {string|Buffer} input failo kelias arba buferis
 * @returns {Promise<string>} failo pavadinimas (pvz. `ab12….webp`)
 */
async function saveImage(input, { max = 2000, thumb = 720 } = {}) {
  const id = newId();
  const full = path.join(config.UPLOAD_DIR, `${id}.webp`);
  const small = path.join(config.UPLOAD_DIR, `${id}-thumb.webp`);
  try {
    const base = sharp(input, { failOn: 'none', limitInputPixels: 80_000_000 }).rotate();
    await base
      .clone()
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(full);
    await base
      .clone()
      .resize({ width: thumb, height: thumb, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 74 })
      .toFile(small);
  } catch (err) {
    fs.rmSync(full, { force: true });
    fs.rmSync(small, { force: true });
    throw err;
  }
  return `${id}.webp`;
}

/** Perkelia įkeltą vaizdo įrašą iš laikino katalogo į `uploads`. */
function saveVideo(file) {
  const ext = VIDEO_MIMES[file.mimetype];
  if (!ext) throw new Error('Nepalaikomas vaizdo įrašo formatas.');
  const name = `${newId()}.${ext}`;
  const target = path.join(config.UPLOAD_DIR, name);
  try {
    fs.renameSync(file.path, target);
  } catch {
    fs.copyFileSync(file.path, target); // kitas diskas / skirsnis
    fs.rmSync(file.path, { force: true });
  }
  return name;
}

function removeUpload(name) {
  fs.rm(path.join(config.UPLOAD_DIR, name), { force: true }, () => {});
}

function deleteImage(name) {
  if (!name || !IMAGE_RE.test(name)) return;
  sizeCache.delete(name);
  removeUpload(name);
  removeUpload(name.replace('.webp', '-thumb.webp'));
}

/**
 * Miniatiūros matmenys (kad naršyklė iš anksto rezervuotų vietą ir puslapis „nešokinėtų“).
 * Rezultatai laikomi atmintyje.
 */
const sizeCache = new Map();
async function imageSize(name) {
  if (!name || !IMAGE_RE.test(name)) return null;
  if (sizeCache.has(name)) return sizeCache.get(name);
  try {
    const meta = await sharp(path.join(config.UPLOAD_DIR, name.replace('.webp', '-thumb.webp'))).metadata();
    const size = { w: meta.width, h: meta.height };
    sizeCache.set(name, size);
    return size;
  } catch {
    return null;
  }
}

/** Prideda `_w` ir `_h` prie eilučių su paveikslėliu. */
async function withSizes(rows, field = 'image') {
  await Promise.all(
    rows.map(async (row) => {
      const size = await imageSize(row[field]);
      row._w = size ? size.w : null;
      row._h = size ? size.h : null;
    })
  );
  return rows;
}

function deleteVideo(name) {
  if (!name || !VIDEO_RE.test(name)) return;
  removeUpload(name);
}

/** Ištrina laikinus multer failus po užklausos. */
function cleanupTmp(files) {
  for (const f of files || []) {
    if (f && f.path && f.path.startsWith(TMP_DIR)) fs.rm(f.path, { force: true }, () => {});
  }
}

const thumbName = (name) => (name ? name.replace(/\.webp$/, '-thumb.webp') : '');

module.exports = {
  imageUpload,
  settingsUpload,
  saveImage,
  saveVideo,
  deleteImage,
  deleteVideo,
  imageSize,
  withSizes,
  cleanupTmp,
  thumbName,
  IMAGE_RE,
  VIDEO_RE,
};
