# KD Legacy – šokių studijos svetainė

Šokių studijos **KD Legacy** (Turgaus g. 11, Jonava) svetainė su valdymo (admin) panele.
Studija pati gali kelti nuotraukas, rašyti naujienas, skelbti renginius, keisti tvarkaraštį ir kainas – be programuotojo.

- **Dvi kalbos:** lietuvių (`/`) ir anglų (`/en`). Kalbą perjungia mygtukas LT / EN viršuje.
- **Dvi spalvos:** juoda ir neoninė rožinė (`#ff2e93`), baltas tekstas.
- **Logotipas:** originalus KD Legacy logotipas perpieštas į vektorinį formatą (SVG) – baltos raidės ir rožinė šokėja.
- **Animacijos:** neoniniai šokantys siluetai ir prožektoriai pradiniame ekrane, plaukiojančios muzikos / šokio ikonos fone, bėganti šokių stilių juosta. Vietoje animacijos galima įkelti savo fono vaizdo įrašą.
- **Technologijos:** Node.js + Express + SQLite. Jokių išorinių paslaugų – šriftai ir viskas kita laikoma pačiame serveryje.

![Socialinių tinklų peržiūra](public/img/og-image.jpg)

---

## Turinys

1. [Svetainės skiltys](#svetainės-skiltys)
2. [Admin panelė – kaip naudotis](#admin-panelė--kaip-naudotis)
3. [Paleidimas savo kompiuteryje](#paleidimas-savo-kompiuteryje)
4. [Talpinimas internete](#talpinimas-internete)
5. [Nustatymai (.env)](#nustatymai-env)
6. [Atsarginės kopijos](#atsarginės-kopijos)
7. [Projekto struktūra](#projekto-struktūra)
8. [Ką dar reikia sutvarkyti](#ką-dar-reikia-sutvarkyti)

---

## Svetainės skiltys

**Pradinis puslapis** (`/`, `/en`):

| Skiltis | Turinys | Kur keisti admin panelėje |
| --- | --- | --- |
| Pradinis ekranas | Logotipas, šūkis, prisistatymas, mygtukai, animacija arba vaizdo įrašas | Nustatymai → Pradinis ekranas |
| Apie mus | Tekstas, iki 3 skaičių (pvz. „10+ metų patirties“) | Nustatymai → Apie mus |
| Šokių stiliai | Kortelės su aprašymu, amžiumi, lygiu, nuotrauka | Šokių stiliai |
| Tvarkaraštis | Savaitės treniruotės pagal dienas, filtras pagal stilių, šiandienos diena paryškinta | Tvarkaraštis |
| Treneriai | Nuotrauka, vardas, pareigos, aprašymas, Instagram | Treneriai |
| Kainos | Abonementai, „populiariausias“ planas išskiriamas | Kainos |
| Renginiai | Artėjantys renginiai | Renginiai |
| Naujienos | 3 naujausios | Naujienos |
| Galerija | 8 pirmos nuotraukos (paspaudus – peržiūra per visą ekraną) | Galerija |
| Atsiliepimai | Rodoma tik jei yra bent vienas | Atsiliepimai |
| D.U.K. | Dažni klausimai | D.U.K. |
| Registracija | Forma į bandomąją pamoką → patenka į „Registracijos“ | Registracijos |
| Kontaktai | Adresas, telefonas, el. paštas, darbo laikas, žemėlapis, socialiniai tinklai | Nustatymai → Kontaktai / Socialiniai tinklai |

**Kiti puslapiai:** Naujienos (`/naujienos`, `/en/news`), Renginiai (`/renginiai`, `/en/events`), Galerija (`/galerija`, `/en/gallery`), Privatumo politika (`/privatumas`, `/en/privacy`).

Taip pat: `sitemap.xml` ir `robots.txt` paieškos sistemoms, Facebook / Messenger nuorodų peržiūros paveikslėlis, Google „LocalBusiness“ duomenys, pritaikyta telefonams, veikia su klaviatūra ir ekrano skaitytuvais, gerbiamas „mažiau animacijų“ nustatymas.

> **Skiltys be turinio paslepiamos.** Pvz. ištrynus visas kainas, skiltis „Kainos“ ir jos meniu punktas dings.

---

## Admin panelė – kaip naudotis

Adresas: **`https://jūsų-svetainė.lt/admin`**

### Pirmas prisijungimas

Paleidus svetainę pirmą kartą, sukuriamas administratorius:

- vartotojo vardas – `admin` (arba `ADMIN_USER` reikšmė),
- slaptažodis – `ADMIN_PASSWORD` reikšmė, o jei ji nenurodyta – **sugeneruojamas ir parodomas serverio konsolėje** (tik vieną kartą).

Prisijungus slaptažodį pakeiskite: **Slaptažodis** (kairėje meniu).

Pamiršote slaptažodį? Serveryje paleiskite:

```bash
npm run reset-password                      # sugeneruos naują slaptažodį vartotojui admin
npm run reset-password -- admin NaujasSlapt  # nustatys konkretų slaptažodį (bent 10 simbolių)
```

### Kasdieniai darbai

| Noriu… | Kur |
| --- | --- |
| Parašyti naujieną | **Naujienos → Nauja naujiena**. Tekstą galima formatuoti (paryškinti, sąrašai, nuorodos). |
| Paskelbti renginį | **Renginiai → Naujas renginys**. Praėję renginiai automatiškai perkeliami į „Įvykę renginiai“. |
| Įkelti nuotraukas | **Galerija** → nutempkite kelias nuotraukas į rėmelį arba „Pasirinkti nuotraukas“. Tvarką keiskite tempdami arba rodyklėmis. |
| Pakeisti tvarkaraštį | **Tvarkaraštis** – kiekviena eilutė yra viena treniruotė (diena, laikas, stilius, grupė, treneris). |
| Pamatyti registracijas | **Registracijos**. Būseną keiskite (Nauja → Susisiekta → Užbaigta). „Atsisiųsti CSV“ atsidaro su Excel. |
| Pakeisti kontaktus, tekstus, fono video | **Nustatymai** |
| Paslėpti naujieną / renginį neištrinant | Atidarykite įrašą ir išjunkite „Rodyti svetainėje“. |

**Dvi kalbos.** Kiekvienas tekstinis laukas turi LT ir EN versiją. EN pildyti nebūtina – jei tuščias, angliškoje versijoje rodomas lietuviškas tekstas.

**Nuotraukos** automatiškai pasukamos, sumažinamos (iki 2000 px), paverčiamos greitu WebP formatu, o iš jų pašalinami metaduomenys (pvz. GPS vieta). Tinka JPG, PNG, WebP, GIF, iki 20 MB.

**Fono vaizdo įrašas** (Nustatymai → Pradinis ekranas): tinka MP4, MOV (iPhone), WebM ir kt. – svetainė pati fone paverčia jį į MP4 (H.264, iki 1280 px, iki 45 s, garsas išsaugomas – lankytojas jį įjungia garso mygtuku), todėl jis groja visose naršyklėse, ir telefone. Konvertavimas trunka ~0,5–1 min. Svetainėje jis rodomas juodai-rožiniu (dviejų spalvų) stiliumi, kad derėtų prie dizaino. Pašalinus – vėl rodomi animuoti šokėjai.

**Logotipas.** Svetainė naudoja vektorinį KD Legacy logotipą (`public/img/logo.svg`). Jei įkelsite kitą logotipą Nustatymuose, jis bus rodomas vietoje esamo.

**Pavyzdinis turinys.** Pirmą kartą paleidus įrašomi pavyzdiniai šokių stiliai, tvarkaraštis, kainos, treneriai, renginiai ir galerijos iliustracijos, o viršuje rodoma juosta „Svetainė dar pildoma“. Pakeitę pavyzdinį turinį tikru, juostą paslėpkite mygtuku **Skydelyje**.

---

## Paleidimas savo kompiuteryje

Reikia **Node.js 22** ar naujesnės versijos.

```bash
npm install
npm start
```

Atidarykite <http://localhost:3000> (svetainė) ir <http://localhost:3000/admin> (admin panelė).
Prisijungimo duomenys parodomi konsolėje.

Kūrimo režimas (serveris persikrauna pakeitus kodą): `npm run dev`
Testai: `npm test`

---

## Talpinimas internete

Svetainei reikia serverio, kuriame veikia **Node.js** ir yra **nuolatinis diskas** (ten saugoma duomenų bazė ir nuotraukos). Žemiau – trys būdai.

### A. VPS serveris (pvz. Hetzner, DigitalOcean, Hostinger VPS) – ~4–6 €/mėn.

```bash
# 1. Serveryje (Ubuntu): įdiekite Node.js 22, git, nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# 2. Parsisiųskite kodą ir įdiekite
git clone https://github.com/brutall100/kdl-legacy.git /srv/kdlegacy
cd /srv/kdlegacy
npm ci --omit=dev
cp .env.example .env && nano .env      # įrašykite SITE_URL, ADMIN_PASSWORD ir kt.

# 3. Paleiskite kaip nuolat veikiančią paslaugą
sudo npm install -g pm2
pm2 start server.js --name kdlegacy
pm2 save && pm2 startup                # paleis automatiškai po serverio perkrovimo
```

Nginx (`/etc/nginx/sites-available/kdlegacy`):

```nginx
server {
    server_name kdlegacy.lt www.kdlegacy.lt;
    client_max_body_size 160m;          # leidžia įkelti vaizdo įrašus

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kdlegacy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx   # nemokamas HTTPS
```

Atnaujinimas: `cd /srv/kdlegacy && git pull && npm ci --omit=dev && pm2 restart kdlegacy`

### B. Docker

```bash
cp .env.example .env    # užpildykite
docker compose up -d --build
```

Duomenys saugomi Docker tome `kdlegacy-data` (`/data` konteineryje).

### Bandymui: Render.com (nemokamai)

Saugykloje yra paruoštas [`render.yaml`](render.yaml).

1. Užsiregistruokite <https://render.com> (galima prisijungti per GitHub).
2. **New → Blueprint** → pasirinkite saugyklą `kdl-legacy` (jei nematote – „Configure GitHub“ ir suteikite prieigą).
3. Įveskite `ADMIN_PASSWORD` (bent 10 simbolių) → **Apply**.
4. Po ~3–5 min. svetainė veiks adresu `https://kdlegacy-xxxx.onrender.com`, admin – `/admin`.

Nemokamo plano apribojimai: po 15 min. neveiklumo svetainė „užmiega“ (pirmas atidarymas ~30–60 s), o įkeltos nuotraukos ir pakeitimai **dingsta po perkrovimo** – tinka tik pasižiūrėti.

### Tikra svetainė Render'e kliento vardu

Paruoštas atskiras failas [`render.production.yaml`](render.production.yaml) (Starter planas 7 $/mėn. + 1 GB diskas).
Bandomoji versija (`render.yaml`, nemokama) lieka atskirai.

1. **Klientas:** užsiregistruoja <https://render.com> savo el. paštu → **Billing** → įveda kortelę.
2. **Klientas:** **Workspace Settings → Members → Invite** → kūrėjo el. paštas, rolė **Admin**.
3. **Kūrėjas:** priima kvietimą, viršuje kairėje persijungia į kliento darbo erdvę.
4. **Kūrėjas:** **New → Blueprint** → saugykla `kdl-legacy` → **Blueprint Path**: `render.production.yaml`
   → įveda `ADMIN_PASSWORD` (ir `SITE_URL`, jei domenas jau yra) → **Apply**.
5. Domenas: paslaugoje **Settings → Custom Domains**, DNS įrašai – pas domeno registratorių.

### Tikra svetainė Render'e (mokamas planas su disku)

Tą pačią bandomąją paslaugą galima paversti tikra svetaine – adresas ir nustatymai išlieka.
Kadangi paslauga sukurta per Blueprint, keičiama **`render.yaml`** (kitaip kitas sinchronizavimas grąžintų nemokamą planą):

```yaml
    plan: starter            # vietoje free
    disk:
      name: data
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: DATA_DIR
        value: /data
      - key: SITE_URL
        value: https://www.kdlegacy.lt
```

Tada Render'e: **Settings → Custom Domains** → pridėkite domeną ir pas domeno registratorių nustatykite Render nurodytus DNS įrašus (HTTPS sertifikatas suteikiamas automatiškai).

Svarbu: administratorius sukuriamas tik pirmą kartą (kai diske dar nėra duomenų bazės), vėliau slaptažodis keičiamas admin panelėje.

### C. Debesų platformos (Railway, Render, Fly.io)

1. Sukurkite naują projektą iš šios GitHub saugyklos (naudojamas `Dockerfile` arba `npm start`).
2. **Būtinai** prijunkite nuolatinį diską (Railway „Volume“, Render „Disk“, Fly „Volume“) prie `/data` ir nustatykite `DATA_DIR=/data`. Be disko po kiekvieno atnaujinimo dings nuotraukos ir naujienos.
3. Nustatykite aplinkos kintamuosius iš `.env.example` (bent `SITE_URL`, `ADMIN_PASSWORD`, `NODE_ENV=production`).

---

## Nustatymai (.env)

Visi nustatymai aprašyti faile [`.env.example`](.env.example). Svarbiausi:

| Kintamasis | Paskirtis |
| --- | --- |
| `PORT` | Portas (numatytasis 3000) |
| `SITE_URL` | Pilnas svetainės adresas, pvz. `https://www.kdlegacy.lt` |
| `NODE_ENV=production` | Įjungia saugius (HTTPS) slapukus ir kešavimą |
| `DATA_DIR` | Duomenų katalogas (DB + nuotraukos) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Pirmojo administratoriaus duomenys |
| `TRUST_PROXY` | Kiek proxy serverių prieš programą (už Nginx – `1`) |
| `SMTP_*` | El. laiškai apie naujas registracijas (nebūtina). Gavėją nurodykite admin panelėje: Nustatymai → Registracija ir SEO. |

---

## Atsarginės kopijos

Visa svetainės informacija yra kataloge `DATA_DIR` (numatytasis `./data`):

- `kdlegacy.sqlite` – naujienos, renginiai, tvarkaraštis, registracijos, nustatymai,
- `uploads/` – įkeltos nuotraukos ir vaizdo įrašai.

Paprasčiausia – admin panelėje **Atsarginė kopija → Atsisiųsti** (ZIP su duomenų baze ir nuotraukomis). Atkūrimas: sustabdyti svetainę, ZIP turinį įkelti į `DATA_DIR` ir paleisti iš naujo.

Serveryje galima ir automatiškai – pakanka reguliariai kopijuoti šį katalogą, pvz. kartą per parą:

```bash
# crontab -e
0 3 * * * cd /srv/kdlegacy && sqlite3 data/kdlegacy.sqlite ".backup data/backup.sqlite" && tar czf ~/kdlegacy-$(date +\%F).tgz data/backup.sqlite data/uploads
```

---

## Projekto struktūra

```
server.js              paleidimas
src/
  app.js               Express programa, saugumo antraštės
  config.js            nustatymai iš .env
  db.js                SQLite duomenų bazė
  resources.js         turinio tipai (naujienos, renginiai, …) ir jų laukai – iš čia kuriamos admin formos
  seed.js              pradinis (pavyzdinis) turinys
  uploads.js           nuotraukų apdorojimas (sharp → WebP)
  routes/public.js     viešieji puslapiai, registracijos forma, sitemap
  routes/admin.js      admin panelė: prisijungimas, turinio valdymas, registracijos, nustatymai
views/
  public/              svetainės šablonai (EJS)
  admin/               admin panelės šablonai
  partials/logo-sprite.ejs   vektorinis logotipas
locales/lt.json, en.json     sąsajos tekstai abiem kalbomis
public/
  css/site.css, admin.css    stiliai
  js/fx.js             fono animacijos (neoniniai šokėjai, ikonos)
  js/site.js           meniu, tvarkaraščio filtras, galerijos peržiūra, registracijos forma
  js/admin.js          teksto redaktorius, nuotraukų įkėlimas, tvarkos keitimas tempiant
  fonts/               šriftai (Unbounded, Manrope, Kaushan Script – SIL Open Font License)
  img/                 logotipas, ikona, socialinių tinklų paveikslėlis
seed-assets/           pavyzdinės galerijos iliustracijos
scripts/reset-password.js
test/                  automatiniai testai (npm test)
```

**Naujas turinio tipas ar laukas.** Admin formos ir duomenų bazės lentelės kuriamos automatiškai pagal `src/resources.js`. Pridėjus lauką ten, jis atsiras admin formoje, o DB stulpelis bus sukurtas paleidus serverį iš naujo.

**Sąsajos tekstai** (meniu, mygtukai, antraštės) – `locales/lt.json` ir `locales/en.json`.

**Spalvos ir šriftai** – `public/css/site.css` pradžioje (`:root` kintamieji `--pink`, `--bg` ir kt.).

### Saugumas

- Slaptažodžiai saugomi `bcrypt` maišos funkcija, prisijungimo bandymai ribojami.
- Visos admin formos apsaugotos CSRF žetonu, sesijos slapukai `HttpOnly` / `SameSite`.
- Naujienų tekstas išvalomas nuo pavojingo HTML, įkeliamos tik nuotraukos (perkoduojamos į WebP).
- Registracijos formoje – apsauga nuo robotų (paslėptas laukas, laiko žetonas, užklausų ribojimas).
- Griežta turinio saugumo politika (CSP); „Google Maps“ žemėlapis įkeliamas tik lankytojui paspaudus.

---

## Ką dar reikia sutvarkyti

Kontaktai (adresas, telefonas, el. paštas, Facebook, Instagram) jau įrašyti iš studijos Facebook puslapio. Liko:

- [ ] **Tikras tvarkaraštis, kainos ir treneriai** – dabar pavyzdiniai.
- [ ] **Nuotraukos** – pakeiskite pavyzdines galerijos iliustracijas tikromis treniruočių / pasirodymų nuotraukomis; pridėkite trenerių ir stilių nuotraukas.
- [ ] **Darbo laikas** – Nustatymai → Kontaktai.
- [ ] **Apie mus** tekstas ir skaičiai (pvz. metų patirtis, šokėjų skaičius).
- [ ] Paslėpkite juostą „Svetainė dar pildoma“ (Skydelis).
- [ ] (Nebūtina) SMTP nustatymai, kad apie registracijas ateitų el. laiškai.
