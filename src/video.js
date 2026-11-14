'use strict';

/**
 * Vaizdo įrašų konvertavimas į MP4 (H.264) su ffmpeg (paketas ffmpeg-static).
 *
 * Kodėl MP4, o ne WebM: H.264 rodomas visose naršyklėse (ir iPhone Safari),
 * o mažame serveryje (Render 0,5 CPU / 512 MB) koduojamas greičiau ir su mažiau atminties.
 * Pradinio ekrano fonui: iki 45 s, be garso, iki 1280 px pločio.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const config = require('./config');

let ffmpegPath = process.env.FFMPEG_PATH || '';
if (!ffmpegPath) {
  try {
    ffmpegPath = require('ffmpeg-static') || '';
  } catch {
    ffmpegPath = '';
  }
}
const available = Boolean(ffmpegPath) && fs.existsSync(ffmpegPath);

const MAX_SECONDS = Number(process.env.VIDEO_MAX_SECONDS) || 45;
const TIMEOUT_MS = 15 * 60 * 1000;

let busy = false;

/**
 * Konvertuoja failą į MP4 ir padeda į uploads katalogą.
 * @param {string} input laikino failo kelias
 * @returns {Promise<string>} naujo failo pavadinimas (pvz. `ab12….mp4`)
 */
function convertToMp4(input) {
  if (!available) return Promise.reject(new Error('ffmpeg nepasiekiamas'));
  const name = `${crypto.randomBytes(12).toString('hex')}.mp4`;
  const out = path.join(config.UPLOAD_DIR, name);
  const part = `${out}.part`;
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-t', String(MAX_SECONDS),
    '-an',
    '-vf', "scale='min(1280,iw)':-2,fps=30",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-threads', '1',
    '-f', 'mp4', part,
  ];
  busy = true;
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-2000);
    });
    const timer = setTimeout(() => proc.kill('SIGKILL'), TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      busy = false;
      fs.rm(part, { force: true }, () => {});
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      busy = false;
      if (code === 0 && fs.existsSync(part) && fs.statSync(part).size > 0) {
        fs.renameSync(part, out);
        resolve(name);
      } else {
        fs.rm(part, { force: true }, () => {});
        reject(new Error(`ffmpeg baigė darbą su klaida (${code}): ${stderr.trim()}`));
      }
    });
  });
}

module.exports = { available, convertToMp4, isBusy: () => busy, MAX_SECONDS };
