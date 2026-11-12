'use strict';

const sanitizeHtml = require('sanitize-html');

const LANGS = ['lt', 'en'];

/** Lietuviškas tekstas -> URL dalis: „Šokių šventė“ -> `sokiu-svente`. */
function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/** Leidžiamas tik saugus, paprastas HTML iš teksto redaktoriaus. */
function cleanRichText(html) {
  const out = sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
      b: 'strong',
      i: 'em',
      div: 'p',
      h1: 'h2',
    },
  }).trim();
  // Tuščias redaktorius grąžina <p><br></p> ir pan.
  return out.replace(/<(p|h2|h3)>(\s|<br\s*\/?>|&nbsp;)*<\/\1>/g, '').trim() ? out : '';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Paprastas tekstas -> pastraipos (tuščia eilutė = nauja pastraipa). */
function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function lines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function stripTags(html) {
  return sanitizeHtml(String(html || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tik http(s) nuorodos; kitaip – tuščia. */
function safeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? `https://${s}` : '';
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

const MONTHS_SHORT = {
  lt: ['saus.', 'vas.', 'kov.', 'bal.', 'geg.', 'birž.', 'liep.', 'rugp.', 'rugs.', 'spal.', 'lapkr.', 'gruod.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const dateFormatters = {};
function fmtDate(iso, lang, style = 'long') {
  if (!isDate(iso)) return '';
  if (style === 'month') return (MONTHS_SHORT[lang] || MONTHS_SHORT.lt)[Number(iso.slice(5, 7)) - 1] || '';
  const key = `${lang}:${style}`;
  if (!dateFormatters[key]) {
    const locale = lang === 'en' ? 'en-GB' : 'lt-LT';
    const opts =
      style === 'day'
        ? { day: '2-digit' }
        : style === 'weekday'
            ? { weekday: 'long' }
            : { dateStyle: style };
    dateFormatters[key] = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });
  }
  return dateFormatters[key].format(new Date(`${iso}T00:00:00Z`));
}

/** Šiandienos data studijos laiko juostoje (Europe/Vilnius), YYYY-MM-DD. */
function todayLocal() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vilnius' }).format(new Date());
}

module.exports = {
  LANGS,
  slugify,
  cleanRichText,
  escapeHtml,
  paragraphs,
  lines,
  stripTags,
  safeUrl,
  isDate,
  isTime,
  fmtDate,
  todayLocal,
};
