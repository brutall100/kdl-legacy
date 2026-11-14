'use strict';

/**
 * Turinio tipų (resursų) aprašai.
 *
 * Iš šių aprašų automatiškai sukuriamos DB lentelės, admin sąrašai ir formos.
 * Laukas su `i18n: true` turi du stulpelius: `<name>_lt` ir `<name>_en`.
 *
 * Lauko tipai: text, textarea, richtext, lines, date, time, url, checkbox,
 *              select, image.
 */

const WEEKDAYS = [
  { value: 1, label: 'Pirmadienis' },
  { value: 2, label: 'Antradienis' },
  { value: 3, label: 'Trečiadienis' },
  { value: 4, label: 'Ketvirtadienis' },
  { value: 5, label: 'Penktadienis' },
  { value: 6, label: 'Šeštadienis' },
  { value: 7, label: 'Sekmadienis' },
];

const today = () => new Date().toISOString().slice(0, 10);

const resources = {
  news: {
    table: 'news',
    label: 'Naujienos',
    addLabel: 'Nauja naujiena',
    icon: 'news',
    intro: 'Studijos naujienos. Naujausios trys rodomos pradiniame puslapyje.',
    orderBy: 'published_at DESC, id DESC',
    list: [
      { field: 'image', label: '', type: 'image' },
      { field: 'title_lt', label: 'Pavadinimas', main: true },
      { field: 'published_at', label: 'Data', type: 'date' },
      { field: 'published', label: 'Rodoma', type: 'bool' },
    ],
    fields: [
      { name: 'title', label: 'Pavadinimas', type: 'text', i18n: true, required: true },
      { name: 'summary', label: 'Trumpas aprašymas', type: 'textarea', i18n: true, rows: 3, help: 'Rodomas naujienų sąraše (1–2 sakiniai).' },
      { name: 'body', label: 'Tekstas', type: 'richtext', i18n: true },
      { name: 'image', label: 'Nuotrauka', type: 'image' },
      { name: 'published_at', label: 'Data', type: 'date', required: true, default: today },
      { name: 'published', label: 'Rodyti svetainėje', type: 'checkbox', default: 1 },
    ],
  },

  events: {
    table: 'events',
    label: 'Renginiai',
    addLabel: 'Naujas renginys',
    icon: 'calendar',
    intro: 'Koncertai, varžybos, stovyklos, atvirų durų dienos ir kiti įvykiai.',
    orderBy: 'date DESC, time DESC, id DESC',
    list: [
      { field: 'image', label: '', type: 'image' },
      { field: 'title_lt', label: 'Pavadinimas', main: true },
      { field: 'date', label: 'Data', type: 'date' },
      { field: 'time', label: 'Laikas' },
      { field: 'published', label: 'Rodoma', type: 'bool' },
    ],
    fields: [
      { name: 'title', label: 'Pavadinimas', type: 'text', i18n: true, required: true },
      { name: 'date', label: 'Data', type: 'date', required: true, default: today },
      { name: 'time', label: 'Pradžios laikas', type: 'time' },
      { name: 'end_date', label: 'Pabaigos data', type: 'date', help: 'Pildykite tik jei renginys trunka kelias dienas.' },
      { name: 'location', label: 'Vieta', type: 'text', i18n: true },
      { name: 'description', label: 'Aprašymas', type: 'richtext', i18n: true },
      { name: 'image', label: 'Nuotrauka / plakatas', type: 'image' },
      { name: 'link', label: 'Nuoroda (bilietai, registracija, Facebook įvykis)', type: 'url' },
      { name: 'published', label: 'Rodyti svetainėje', type: 'checkbox', default: 1 },
    ],
  },

  gallery: {
    table: 'gallery',
    label: 'Galerija',
    addLabel: 'Pridėti vieną nuotrauką',
    icon: 'image',
    intro: 'Nuotraukos automatiškai sumažinamos ir optimizuojamos. Galite įkelti kelias iš karto.',
    sortable: true,
    newFirst: true,
    bulkUpload: true,
    grid: true,
    list: [
      { field: 'image', label: '', type: 'image' },
      { field: 'caption_lt', label: 'Aprašas', main: true },
    ],
    fields: [
      { name: 'image', label: 'Nuotrauka', type: 'image', required: true },
      { name: 'caption', label: 'Aprašas (nebūtina)', type: 'text', i18n: true },
    ],
  },

  classes: {
    table: 'classes',
    label: 'Šokių stiliai',
    addLabel: 'Naujas stilius',
    icon: 'spark',
    intro: 'Šokių stiliai ir grupės, kurias siūlo studija.',
    sortable: true,
    list: [
      { field: 'image', label: '', type: 'image' },
      { field: 'name_lt', label: 'Pavadinimas', main: true },
      { field: 'age_lt', label: 'Amžius' },
      { field: 'level_lt', label: 'Lygis' },
    ],
    fields: [
      { name: 'name', label: 'Pavadinimas', type: 'text', i18n: true, required: true },
      { name: 'description', label: 'Aprašymas', type: 'textarea', i18n: true, rows: 4 },
      { name: 'age', label: 'Amžius', type: 'text', i18n: true, placeholder: 'pvz. nuo 7 m.' },
      { name: 'level', label: 'Lygis', type: 'text', i18n: true, placeholder: 'pvz. Pradedantieji ir pažengę' },
      { name: 'image', label: 'Nuotrauka (nebūtina)', type: 'image' },
    ],
  },

  schedule: {
    table: 'schedule',
    label: 'Tvarkaraštis',
    addLabel: 'Nauja treniruotė',
    icon: 'clock',
    intro: 'Savaitės treniruočių tvarkaraštis.',
    orderBy: 'weekday ASC, start_time ASC, id ASC',
    list: [
      { field: 'weekday', label: 'Diena', type: 'weekday' },
      { field: 'start_time', label: 'Nuo' },
      { field: 'end_time', label: 'Iki' },
      { field: '_title', label: 'Treniruotė', main: true },
      { field: 'group_name_lt', label: 'Grupė' },
      { field: 'hall', label: 'Salė' },
    ],
    fields: [
      { name: 'weekday', label: 'Savaitės diena', type: 'select', int: true, required: true, options: WEEKDAYS, default: 1 },
      { name: 'start_time', label: 'Pradžia', type: 'time', required: true, default: '17:00' },
      { name: 'end_time', label: 'Pabaiga', type: 'time', default: '18:00' },
      { name: 'class_id', label: 'Šokių stilius', type: 'select', int: true, optionsFrom: { table: 'classes', label: 'name_lt' }, emptyLabel: '— kita (įrašykite pavadinimą žemiau) —' },
      { name: 'title', label: 'Pavadinimas', type: 'text', i18n: true, help: 'Pildykite tik jei nepasirinkote stiliaus arba norite kitokio pavadinimo.' },
      { name: 'group_name', label: 'Grupė', type: 'text', i18n: true, placeholder: 'pvz. Vaikai 7–10 m.' },
      { name: 'trainer_id', label: 'Treneris', type: 'select', int: true, optionsFrom: { table: 'trainers', label: 'name' }, emptyLabel: '— nenurodyta —' },
      { name: 'hall', label: 'Salė / vieta', type: 'text' },
    ],
  },

  trainers: {
    table: 'trainers',
    label: 'Treneriai',
    addLabel: 'Naujas treneris',
    icon: 'users',
    intro: 'Studijos treneriai ir choreografai.',
    sortable: true,
    list: [
      { field: 'image', label: '', type: 'image' },
      { field: 'name', label: 'Vardas', main: true },
      { field: 'role_lt', label: 'Pareigos' },
    ],
    fields: [
      { name: 'name', label: 'Vardas ir pavardė', type: 'text', required: true },
      { name: 'role', label: 'Pareigos / stiliai', type: 'text', i18n: true, placeholder: 'pvz. Hip-hop trenerė' },
      { name: 'bio', label: 'Aprašymas', type: 'textarea', i18n: true, rows: 4 },
      { name: 'image', label: 'Nuotrauka', type: 'image' },
      { name: 'instagram', label: 'Instagram nuoroda', type: 'url' },
    ],
  },

  prices: {
    table: 'prices',
    label: 'Kainos',
    addLabel: 'Naujas planas',
    icon: 'tag',
    intro: 'Abonementai ir vienkartiniai apsilankymai.',
    sortable: true,
    list: [
      { field: 'name_lt', label: 'Pavadinimas', main: true },
      { field: 'price', label: 'Kaina' },
      { field: 'period_lt', label: 'Laikotarpis' },
      { field: 'highlighted', label: 'Išskirtas', type: 'bool' },
    ],
    fields: [
      { name: 'name', label: 'Pavadinimas', type: 'text', i18n: true, required: true },
      { name: 'price', label: 'Kaina', type: 'text', required: true, placeholder: 'pvz. 45 €' },
      { name: 'period', label: 'Laikotarpis', type: 'text', i18n: true, placeholder: 'pvz. / mėn.' },
      { name: 'features', label: 'Kas įeina', type: 'lines', i18n: true, rows: 5, help: 'Kiekvienas punktas – naujoje eilutėje.' },
      { name: 'highlighted', label: 'Išskirti (populiariausias)', type: 'checkbox', default: 0 },
    ],
  },

  faq: {
    table: 'faq',
    label: 'D.U.K.',
    addLabel: 'Naujas klausimas',
    icon: 'help',
    intro: 'Dažniausiai užduodami klausimai.',
    sortable: true,
    list: [{ field: 'question_lt', label: 'Klausimas', main: true }],
    fields: [
      { name: 'question', label: 'Klausimas', type: 'text', i18n: true, required: true },
      { name: 'answer', label: 'Atsakymas', type: 'textarea', i18n: true, rows: 4, required: true },
    ],
  },

  testimonials: {
    table: 'testimonials',
    label: 'Atsiliepimai',
    addLabel: 'Naujas atsiliepimas',
    icon: 'quote',
    intro: 'Šokėjų ir tėvų atsiliepimai. Skiltis svetainėje rodoma tik tada, kai yra bent vienas atsiliepimas.',
    sortable: true,
    list: [
      { field: 'author', label: 'Autorius', main: true },
      { field: 'text_lt', label: 'Tekstas' },
    ],
    fields: [
      { name: 'author', label: 'Autorius', type: 'text', required: true },
      { name: 'role', label: 'Kas jis (-i)', type: 'text', i18n: true, placeholder: 'pvz. šokėjos mama' },
      { name: 'text', label: 'Atsiliepimas', type: 'textarea', i18n: true, rows: 4, required: true },
    ],
  },
};

for (const [key, r] of Object.entries(resources)) r.key = key;

/** Visi resurso DB stulpeliai: [pavadinimas, SQL tipas]. */
function columnsFor(resource) {
  const cols = [];
  for (const f of resource.fields) {
    const type = f.type === 'checkbox' || f.int ? 'INTEGER' : 'TEXT';
    if (f.i18n) cols.push([`${f.name}_lt`, type], [`${f.name}_en`, type]);
    else cols.push([f.name, type]);
  }
  if (resource.sortable) cols.push(['sort', 'INTEGER']);
  cols.push(['created_at', 'TEXT']);
  return cols;
}

/**
 * Nustatymų (settings) laukai – rodomi admin „Nustatymai“ puslapyje.
 */
const settingsGroups = [
  {
    key: 'hero',
    title: 'Pradinis ekranas',
    intro: 'Tai, ką lankytojas pamato pirmiausia.',
    fields: [
      { name: 'site_name', label: 'Studijos pavadinimas', type: 'text', required: true },
      { name: 'hero_overline', label: 'Viršutinė eilutė', type: 'text', i18n: true },
      { name: 'hero_tagline', label: 'Šūkis', type: 'text', i18n: true },
      { name: 'hero_text', label: 'Trumpas prisistatymas', type: 'textarea', i18n: true, rows: 3 },
      { name: 'logo', label: 'Logotipas (nebūtina)', type: 'image', help: 'Jei neįkelsite – bus rodomas tekstinis logotipas. Geriausia PNG permatomu fonu.' },
      { name: 'hero_video', label: 'Fono vaizdo įrašas (nebūtina)', type: 'video', help: 'MP4, MOV (iPhone), WebM ir kt. – automatiškai paverčiamas į MP4: iki 45 s. Garsas išsaugomas, bet svetainėje įsijungia tik lankytojui paspaudus garso mygtuką. Geriausia trumpas (10–30 s). Jei neįkeltas – rodomi animuoti neoniniai šokėjai.' },
    ],
  },
  {
    key: 'about',
    title: 'Apie mus',
    fields: [
      { name: 'about_title', label: 'Antraštė', type: 'text', i18n: true },
      { name: 'about_text', label: 'Tekstas', type: 'textarea', i18n: true, rows: 7, help: 'Tuščia eilutė pradeda naują pastraipą.' },
      { name: 'stat1_value', label: '1 skaičius', type: 'text', placeholder: 'pvz. 10+', help: 'Nebūtina. Pvz. „10+“ ir „metų patirties“.' },
      { name: 'stat1_label', label: '1 skaičiaus aprašas', type: 'text', i18n: true },
      { name: 'stat2_value', label: '2 skaičius', type: 'text' },
      { name: 'stat2_label', label: '2 skaičiaus aprašas', type: 'text', i18n: true },
      { name: 'stat3_value', label: '3 skaičius', type: 'text' },
      { name: 'stat3_label', label: '3 skaičiaus aprašas', type: 'text', i18n: true },
    ],
  },
  {
    key: 'contacts',
    title: 'Kontaktai',
    fields: [
      { name: 'address', label: 'Adresas', type: 'text', placeholder: 'pvz. Žeimių g. 13' },
      { name: 'city', label: 'Miestas', type: 'text' },
      { name: 'phone', label: 'Telefonas', type: 'text', placeholder: '+370 6xx xxxxx' },
      { name: 'email', label: 'El. paštas', type: 'text' },
      { name: 'hours', label: 'Darbo laikas', type: 'textarea', i18n: true, rows: 3 },
      { name: 'map_query', label: 'Žemėlapio paieškos tekstas', type: 'text', help: 'Nebūtina. Pagal nutylėjimą žemėlapis ieško „adresas, miestas“.' },
    ],
  },
  {
    key: 'social',
    title: 'Socialiniai tinklai',
    intro: 'Įklijuokite pilnas nuorodas (https://…). Tuščios nuorodos nerodomos.',
    fields: [
      { name: 'facebook', label: 'Facebook', type: 'url' },
      { name: 'instagram', label: 'Instagram', type: 'url' },
      { name: 'tiktok', label: 'TikTok', type: 'url' },
      { name: 'youtube', label: 'YouTube', type: 'url' },
    ],
  },
  {
    key: 'misc',
    title: 'Registracija ir SEO',
    fields: [
      { name: 'notify_email', label: 'El. paštas pranešimams apie naujas registracijas', type: 'text', help: 'Veikia tik jei serveryje sukonfigūruotas SMTP (žr. README).' },
      { name: 'seo_description', label: 'Aprašymas paieškos sistemoms (Google)', type: 'textarea', i18n: true, rows: 2 },
    ],
  },
];

const settingsFields = settingsGroups.flatMap((g) => g.fields);

module.exports = { resources, columnsFor, settingsGroups, settingsFields, WEEKDAYS };
