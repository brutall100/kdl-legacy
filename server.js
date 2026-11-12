'use strict';

const config = require('./src/config');
const { db, ensureAdminUser } = require('./src/db');
const { seed } = require('./src/seed');
const { createApp } = require('./src/app');

async function main() {
  const seeded = await seed();
  const admin = ensureAdminUser();
  const app = createApp();

  const server = app.listen(config.PORT, config.HOST, () => {
    const url = config.SITE_URL || `http://localhost:${config.PORT}`;
    console.log(`\n  KD Legacy svetainė veikia: ${url}`);
    console.log(`  Admin panelė:              ${url}/admin`);
    if (seeded) console.log('  Įrašytas pradinis (pavyzdinis) turinys.');
    if (admin) {
      console.log('\n  ┌─ Sukurtas administratorius ─────────────────────');
      console.log(`  │ Vartotojas:   ${admin.username}`);
      console.log(`  │ Slaptažodis:  ${admin.generated ? admin.password : '(iš ADMIN_PASSWORD kintamojo)'}`);
      if (admin.generated) console.log('  │ Išsisaugokite jį – daugiau nebus rodomas. Pakeisti galima admin panelėje.');
      console.log('  └──────────────────────────────────────────────────');
    }
    console.log('');
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
