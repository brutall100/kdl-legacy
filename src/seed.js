'use strict';

/**
 * Pradinis (pavyzdinis) turinys. Įrašomas tik vieną kartą – kai DB tuščia.
 * Viską galima pakeisti arba ištrinti per admin panelę.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { db, getSettings, setSettings } = require('./db');
const { saveImage } = require('./uploads');

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function insert(table, row) {
  const keys = Object.keys(row);
  const info = db
    .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .run(...keys.map((k) => row[k]));
  return info.lastInsertRowid;
}

const defaults = {
  site_name: 'KD Legacy',
  hero_overline_lt: 'Šokių studija · Jonava',
  hero_overline_en: 'Dance studio · Jonava',
  hero_tagline_lt: 'Šok. Kurk. Palik pėdsaką.',
  hero_tagline_en: 'Dance. Create. Leave a legacy.',
  hero_text_lt:
    'Šokių treniruotės Jonavoje – vaikams, jaunimui ir suaugusiems. Hip-hop, šiuolaikinis šokis, Lotynų ritmai ir dancehall. Ateik į bandomąją pamoką ir rask savo ritmą!',
  hero_text_en:
    'Dance classes in Jonava – for kids, teens and adults. Hip-hop, contemporary, Latin rhythms and dancehall. Come to a trial class and find your rhythm!',
  about_title_lt: 'Šokis – daugiau nei judesys',
  about_title_en: 'Dance is more than movement',
  about_text_lt: [
    'KD Legacy – šokių studija Jonavoje, kurioje kiekvienas randa savo ritmą: nuo pirmųjų žingsnių iki pasirodymų scenoje.',
    'Mums šokis – tai disciplina, laisvė ir bendruomenė viename. Treniruotėse mokomės technikos, muzikalumo ir sceninės laikysenos, o svarbiausia – drąsos būti savimi.',
    'Kviečiame vaikus, jaunimą ir suaugusiuosius – nesvarbu, ar šoki pirmą kartą, ar jau turi patirties.',
  ].join('\n\n'),
  about_text_en: [
    'KD Legacy is a dance studio in Jonava where everyone finds their own rhythm – from the very first steps to performing on stage.',
    'For us, dance is discipline, freedom and community in one. In class we work on technique, musicality and stage presence – and above all, the courage to be yourself.',
    "Kids, teens and adults are all welcome – whether it's your first time dancing or you already have experience.",
  ].join('\n\n'),
  // Kontaktai iš studijos Facebook puslapio
  address: 'Turgaus g. 11',
  city: 'Jonava',
  phone: '+370 673 24960',
  email: 'k.dulinskaite@gmail.com',
  instagram: 'https://www.instagram.com/kdlegacystudija/',
  map_query: 'Turgaus g. 11, 55149 Jonava',
  seo_description_lt:
    'KD Legacy – šokių studija Jonavoje. Hip-hop, šiuolaikinis šokis, jazz-funk, pramoginiai ir Lotynų šokiai, dancehall, afro, heels. Registruokis į bandomąją pamoką!',
  seo_description_en:
    'KD Legacy – a dance studio in Jonava, Lithuania. Hip-hop, contemporary, jazz-funk, ballroom & Latin, dancehall, afro and heels. Book your trial class!',
  demo_content: '1',
};

async function seedGallery() {
  const dir = path.join(config.ROOT, 'seed-assets');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(webp|png|jpe?g)$/i.test(f)).sort();
  } catch {
    return;
  }
  let sort = files.length;
  for (const file of files) {
    try {
      const image = await saveImage(path.join(dir, file));
      insert('gallery', { image, caption_lt: '', caption_en: '', sort: sort--, created_at: new Date().toISOString() });
    } catch (err) {
      console.warn(`[seed] nepavyko įkelti ${file}: ${err.message}`);
    }
  }
}

async function seed() {
  if (getSettings().seeded) return false;
  const now = new Date().toISOString();

  setSettings(defaults);

  /* --- Šokių stiliai --- */
  const classIds = {};
  const classes = [
    {
      key: 'hiphop',
      name_lt: 'Hip-hop / gatvės šokiai',
      name_en: 'Hip-hop / Street dance',
      description_lt:
        'Groove, energija ir laisvė. Mokomės hip-hop pagrindų, breaking, popping ir locking elementų, freestyle ir choreografijų.',
      description_en:
        'Groove, energy and freedom. We learn hip-hop foundations, elements of breaking, popping and locking, freestyle and choreography.',
      age_lt: 'nuo 6 m.',
      age_en: 'ages 6+',
      level_lt: 'Visi lygiai',
      level_en: 'All levels',
    },
    {
      key: 'contemporary',
      name_lt: 'Šiuolaikinis / jazz-funk',
      name_en: 'Contemporary / Jazz-funk',
      description_lt:
        'Emocija, plastika ir sceninė išraiška. Šiuolaikinio šokio technika, jazz-funk choreografijos ir pasirodymų ruošimas.',
      description_en:
        'Emotion, flow and stage expression. Contemporary technique, jazz-funk choreography and show preparation.',
      age_lt: 'nuo 8 m.',
      age_en: 'ages 8+',
      level_lt: 'Pradedantieji ir pažengę',
      level_en: 'Beginners & advanced',
    },
    {
      key: 'latin',
      name_lt: 'Pramoginiai / Lotynų',
      name_en: 'Ballroom / Latin',
      description_lt:
        'Salsa, bachata, ča ča ča ir kiti poriniai šokiai. Ritmas, laikysena ir bendravimas šokio kalba.',
      description_en:
        'Salsa, bachata, cha-cha and other partner dances. Rhythm, posture and connection through dance.',
      age_lt: 'vaikams ir suaugusiems',
      age_en: 'kids & adults',
      level_lt: 'Visi lygiai',
      level_en: 'All levels',
    },
    {
      key: 'dancehall',
      name_lt: 'Dancehall / Afro / Heels',
      name_en: 'Dancehall / Afro / Heels',
      description_lt:
        'Karšti ritmai ir pasitikėjimas savimi. Dancehall ir afro žingsniai, high heels choreografijos ir daug geros nuotaikos.',
      description_en:
        'Hot rhythms and confidence. Dancehall and afro steps, high heels choreography and plenty of good vibes.',
      age_lt: 'nuo 14 m.',
      age_en: 'ages 14+',
      level_lt: 'Visi lygiai',
      level_en: 'All levels',
    },
  ];
  classes.forEach((c, i) => {
    const { key, ...row } = c;
    classIds[key] = insert('classes', { ...row, image: '', sort: i + 1, created_at: now });
  });

  /* --- Treneriai (pavyzdiniai) --- */
  const trainerIds = [
    { role_lt: 'Hip-hop / gatvės šokiai', role_en: 'Hip-hop / Street dance' },
    { role_lt: 'Šiuolaikinis šokis / jazz-funk', role_en: 'Contemporary / Jazz-funk' },
    { role_lt: 'Pramoginiai ir Lotynų šokiai', role_en: 'Ballroom & Latin' },
  ].map((t, i) =>
    insert('trainers', {
      name: 'Vardas Pavardė',
      ...t,
      bio_lt: 'Čia bus trumpas trenerio aprašymas – patirtis, stiliai ir pasiekimai.',
      bio_en: "A short trainer bio will go here – experience, styles and achievements.",
      image: '',
      instagram: '',
      sort: i + 1,
      created_at: now,
    })
  );

  /* --- Tvarkaraštis (pavyzdinis) --- */
  const kids = ['Vaikai 6–9 m.', 'Kids 6–9'];
  const teens = ['Jaunimas 10–14 m.', 'Teens 10–14'];
  const adults = ['Suaugusieji', 'Adults'];
  const slots = [
    [1, '16:00', '17:00', 'hiphop', kids, 0],
    [1, '17:15', '18:15', 'hiphop', teens, 0],
    [1, '18:30', '19:30', 'dancehall', ['Jaunimas ir suaugusieji 14+', 'Teens & adults 14+'], 0],
    [2, '16:30', '17:30', 'latin', ['Vaikai 7–12 m.', 'Kids 7–12'], 2],
    [2, '17:45', '18:45', 'contemporary', teens, 1],
    [2, '19:00', '20:00', 'latin', adults, 2],
    [3, '16:00', '17:00', 'hiphop', kids, 0],
    [3, '17:15', '18:15', 'hiphop', teens, 0],
    [3, '18:30', '19:30', 'dancehall', ['Jaunimas ir suaugusieji 14+', 'Teens & adults 14+'], 0],
    [4, '16:30', '17:30', 'latin', ['Vaikai 7–12 m.', 'Kids 7–12'], 2],
    [4, '17:45', '18:45', 'contemporary', teens, 1],
    [4, '19:00', '20:00', 'latin', adults, 2],
    [6, '11:00', '12:30', 'contemporary', ['Pasirodymų grupė', 'Show team'], 1],
  ];
  for (const [weekday, start, end, cls, grp, tr] of slots) {
    insert('schedule', {
      weekday,
      start_time: start,
      end_time: end,
      class_id: classIds[cls],
      title_lt: '',
      title_en: '',
      group_name_lt: grp[0],
      group_name_en: grp[1],
      trainer_id: trainerIds[tr],
      hall: '',
      created_at: now,
    });
  }

  /* --- Kainos (pavyzdinės) --- */
  [
    {
      name_lt: 'Vienkartinis',
      name_en: 'Drop-in',
      price: '8 €',
      period_lt: '/ treniruotė',
      period_en: '/ class',
      features_lt: 'Viena pasirinkta treniruotė\nTinka išbandyti naują stilių',
      features_en: 'One class of your choice\nGreat for trying a new style',
      highlighted: 0,
    },
    {
      name_lt: 'Mėnesio abonementas',
      name_en: 'Monthly pass',
      price: '40 €',
      period_lt: '/ mėn.',
      period_en: '/ month',
      features_lt: '8 treniruotės per mėnesį\nViena pasirinkta grupė\nDalyvavimas studijos pasirodymuose',
      features_en: '8 classes per month\nOne group of your choice\nTake part in studio shows',
      highlighted: 1,
    },
    {
      name_lt: 'Neribotas',
      name_en: 'Unlimited',
      price: '60 €',
      period_lt: '/ mėn.',
      period_en: '/ month',
      features_lt: 'Visos tavo amžiaus grupės treniruotės\nKeli šokių stiliai\nDalyvavimas studijos pasirodymuose',
      features_en: 'All classes for your age group\nMultiple dance styles\nTake part in studio shows',
      highlighted: 0,
    },
  ].forEach((p, i) => insert('prices', { ...p, sort: i + 1, created_at: now }));

  /* --- D.U.K. --- */
  [
    [
      'Ar reikia turėti šokių patirties?',
      'Ne. Turime grupes pradedantiesiems – svarbiausia noras šokti. Treneris padės pasirinkti tinkamiausią grupę.',
      'Do I need any dance experience?',
      'No. We have groups for beginners – all you need is the wish to dance. The trainer will help you choose the right group.',
    ],
    [
      'Ką apsirengti ir pasiimti į treniruotę?',
      'Patogią, judesių nevaržančią aprangą, švarią sportinę avalynę ir vandens.',
      'What should I wear and bring to class?',
      'Comfortable clothes you can move in, clean indoor trainers and a bottle of water.',
    ],
    [
      'Nuo kelių metų priimate vaikus?',
      'Tai priklauso nuo šokių stiliaus – amžius nurodytas prie kiekvienos grupės. Jei abejojate, parašykite mums – patarsime.',
      'From what age can children join?',
      "It depends on the dance style – the age is listed next to each group. If you're unsure, drop us a message and we'll advise.",
    ],
    [
      'Kaip užsiregistruoti?',
      'Užpildykite registracijos formą šiame puslapyje arba susisiekite su mumis – suderinsime bandomosios pamokos laiką.',
      'How do I sign up?',
      "Fill in the registration form on this page or get in touch – we'll arrange a time for your trial class.",
    ],
    [
      'Ar galima prisijungti sezono viduryje?',
      'Taip, jei grupėje yra laisvų vietų. Susisiekite ir pasiūlysime tinkamiausią grupę.',
      'Can I join in the middle of the season?',
      "Yes, as long as there is space in the group. Get in touch and we'll suggest the best fit.",
    ],
  ].forEach(([qlt, alt, qen, aen], i) =>
    insert('faq', { question_lt: qlt, answer_lt: alt, question_en: qen, answer_en: aen, sort: i + 1, created_at: now })
  );

  /* --- Naujienos --- */
  insert('news', {
    title_lt: 'Registracija į naujas grupes',
    title_en: 'Sign-ups for new groups are open',
    summary_lt: 'Kviečiame vaikus, jaunimą ir suaugusiuosius prisijungti prie KD Legacy šokėjų šeimos.',
    summary_en: 'Kids, teens and adults are invited to join the KD Legacy dance family.',
    body_lt:
      '<p>Kviečiame vaikus, jaunimą ir suaugusiuosius prisijungti prie KD Legacy šokėjų šeimos.</p><p>Užpildykite <strong>registracijos formą</strong> pradiniame puslapyje – susisieksime ir suderinsime bandomosios pamokos laiką.</p>',
    body_en:
      '<p>Kids, teens and adults are invited to join the KD Legacy dance family.</p><p>Fill in the <strong>registration form</strong> on the home page – we will get in touch and arrange your trial class.</p>',
    image: '',
    published_at: addDays(-2),
    published: 1,
    created_at: now,
  });
  insert('news', {
    title_lt: 'Sveiki atvykę į naująją KD Legacy svetainę!',
    title_en: 'Welcome to the new KD Legacy website!',
    summary_lt: 'Nuo šiol tvarkaraštį, naujienas, renginius ir nuotraukas rasite vienoje vietoje.',
    summary_en: 'From now on you will find our schedule, news, events and photos in one place.',
    body_lt:
      '<p>Džiaugiamės galėdami pristatyti naują studijos svetainę. Čia rasite:</p><ul><li>treniruočių tvarkaraštį ir šokių stilius,</li><li>naujienas ir artėjančius renginius,</li><li>nuotraukų galeriją,</li><li>registraciją į bandomąją pamoką.</li></ul><p>Iki pasimatymo salėje!</p>',
    body_en:
      '<p>We are happy to present the new studio website. Here you will find:</p><ul><li>the class schedule and dance styles,</li><li>news and upcoming events,</li><li>a photo gallery,</li><li>sign-up for a trial class.</li></ul><p>See you on the dance floor!</p>',
    image: '',
    published_at: addDays(-7),
    published: 1,
    created_at: now,
  });

  /* --- Renginiai (pavyzdiniai) --- */
  insert('events', {
    title_lt: 'Atvirų durų diena',
    title_en: 'Open day',
    date: addDays(21),
    time: '12:00',
    end_date: '',
    location_lt: 'KD Legacy studija, Turgaus g. 11, Jonava',
    location_en: 'KD Legacy studio, Turgaus g. 11, Jonava',
    description_lt:
      '<p>Ateik susipažinti su treneriais, išbandyk skirtingus šokių stilius ir pasirink sau tinkamiausią grupę.</p>',
    description_en:
      '<p>Come and meet the trainers, try different dance styles and pick the group that suits you best.</p>',
    image: '',
    link: '',
    published: 1,
    created_at: now,
  });
  insert('events', {
    title_lt: 'Studijos sezono koncertas',
    title_en: 'Studio season showcase',
    date: addDays(48),
    time: '18:00',
    end_date: '',
    location_lt: 'Jonava',
    location_en: 'Jonava',
    description_lt: '<p>Visų studijos grupių pasirodymai vienoje scenoje. Kviečiame šeimas ir draugus!</p>',
    description_en: '<p>All studio groups on one stage. Families and friends are welcome!</p>',
    image: '',
    link: '',
    published: 1,
    created_at: now,
  });

  await seedGallery();

  setSettings({ seeded: '1' });
  return true;
}

module.exports = { seed };
