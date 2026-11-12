'use strict';

/** Mažas linijinių SVG ikonų rinkinys (24×24, stroke = currentColor). */
const paths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
  news: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  spark: '<path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.9c1.9.6 3.1 2.1 3.5 4.6"/>',
  tag: '<path d="M4 4.5h7.5l8.5 8.5-7.5 7.5L4 12z"/><circle cx="8.3" cy="8.8" r="1.3"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9"/><path d="M12 16.8v.2"/>',
  quote: '<path d="M9.5 7C6.8 8 5 10.3 5 13.5V17h5v-5H7.6c.2-1.7 1.1-2.7 2.6-3.3zM18.5 7c-2.7 1-4.5 3.3-4.5 6.5V17h5v-5h-2.4c.2-1.7 1.1-2.7 2.6-3.3z"/>',
  inbox: '<path d="M4 13.5 6.5 5h11L20 13.5V19H4z"/><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  logout: '<path d="M10 4.5H5.5v15H10"/><path d="M14.5 8 19 12l-4.5 4M19 12H9"/>',
  external: '<path d="M13.5 4.5h6v6M19.5 4.5l-9 9"/><path d="M17 13.5v6H4.5V7h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4.5 19.5 5.5 15 16 4.5l3.5 3.5L9 18.5z"/><path d="M13.5 7 17 10.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/><path d="M10 10.5v5.5M14 10.5v5.5"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M4.5 15.5v4h15v-4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.200A2 2 0 0 1 6.5 4z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  pin: '<path d="M12 21s6.500-5.800 6.500-11a6.500 6.500 0 0 0-13 0c0 5.200 6.500 11 6.500 11z"/><circle cx="12" cy="10" r="2.3"/>',
  facebook: '<path d="M13.500 20.500v-7h2.600l.400-3h-3V8.700c0-.9.300-1.500 1.600-1.500h1.500V4.600c-.300 0-1.200-.1-2.200-.1-2.200 0-3.700 1.300-3.700 3.800v2.200H8.200v3h2.500v7z"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.500"/><circle cx="12" cy="12" r="3.600"/><circle cx="16.700" cy="7.300" r=".6"/>',
  tiktok: '<path d="M14 4v10.500a3.300 3.300 0 1 1-3.300-3.300"/><path d="M14 4c.3 2.400 1.800 4 4.500 4.300"/>',
  youtube: '<rect x="3" y="6" width="18" height="12" rx="3.500"/><path d="m10.500 9.500 4.500 2.500-4.500 2.500z"/>',
};

function icon(name, size = 20) {
  const body = paths[name];
  if (!body) return '';
  return `<svg class="ico ico-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

module.exports = { icon };
