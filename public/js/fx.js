/* ==========================================================================
   KD Legacy – fono animacijos
   1) Plaukiojančios šokio / muzikos ikonos per visą puslapį (#bg-fx)
   2) Neoniniai šokantys siluetai pradiniame ekrane (#hero-dancers)
   Be išorinių bibliotekų. Gerbia „prefers-reduced-motion“.
   ========================================================================== */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;
  const PINK = '255, 46, 147';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  function fitCanvas(canvas, maxDpr) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return { w, h, dpr };
  }

  /* ------------------------------------------------------------------ */
  /* 1. Plaukiojančios ikonos                                            */
  /* ------------------------------------------------------------------ */

  // Kiekviena ikona piešiama vienetinėje erdvėje (-0.5 … 0.5).
  const ICONS = [
    // aštuntinė nata
    (c) => {
      c.beginPath();
      c.ellipse(-0.12, 0.3, 0.17, 0.12, -0.4, 0, TAU);
      c.stroke();
      c.beginPath();
      c.moveTo(0.04, 0.26);
      c.lineTo(0.04, -0.42);
      c.quadraticCurveTo(0.14, -0.2, 0.34, -0.12);
      c.stroke();
    },
    // dvi sujungtos natos
    (c) => {
      c.beginPath();
      c.ellipse(-0.26, 0.32, 0.14, 0.1, -0.4, 0, TAU);
      c.stroke();
      c.beginPath();
      c.ellipse(0.24, 0.22, 0.14, 0.1, -0.4, 0, TAU);
      c.stroke();
      c.beginPath();
      c.moveTo(-0.13, 0.29);
      c.lineTo(-0.13, -0.3);
      c.lineTo(0.37, -0.42);
      c.lineTo(0.37, 0.19);
      c.moveTo(-0.13, -0.16);
      c.lineTo(0.37, -0.28);
      c.stroke();
    },
    // žvaigždutė (blizgesys)
    (c) => {
      c.beginPath();
      c.moveTo(0, -0.46);
      c.quadraticCurveTo(0.06, -0.06, 0.46, 0);
      c.quadraticCurveTo(0.06, 0.06, 0, 0.46);
      c.quadraticCurveTo(-0.06, 0.06, -0.46, 0);
      c.quadraticCurveTo(-0.06, -0.06, 0, -0.46);
      c.stroke();
    },
    // vinilo plokštelė
    (c) => {
      c.beginPath();
      c.arc(0, 0, 0.44, 0, TAU);
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 0.15, 0, TAU);
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 0.3, -0.5, 0.4);
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 0.3, 2.6, 3.5);
      c.stroke();
    },
    // karūna („legacy“)
    (c) => {
      c.beginPath();
      c.moveTo(-0.42, 0.26);
      c.lineTo(-0.46, -0.22);
      c.lineTo(-0.2, 0.02);
      c.lineTo(0, -0.34);
      c.lineTo(0.2, 0.02);
      c.lineTo(0.46, -0.22);
      c.lineTo(0.42, 0.26);
      c.closePath();
      c.stroke();
    },
    // žaibas (energija)
    (c) => {
      c.beginPath();
      c.moveTo(0.1, -0.46);
      c.lineTo(-0.26, 0.06);
      c.lineTo(0.0, 0.06);
      c.lineTo(-0.1, 0.46);
      c.lineTo(0.26, -0.08);
      c.lineTo(0.0, -0.08);
      c.closePath();
      c.stroke();
    },
    // žiedas
    (c) => {
      c.beginPath();
      c.arc(0, 0, 0.3, 0, TAU);
      c.stroke();
    },
  ];

  function initBackground(canvas) {
    const ctx = canvas.getContext('2d');
    let size = fitCanvas(canvas, 1.5);
    let items = [];

    // Deterministinis „atsitiktinumas“, kad ikonos nešokinėtų keičiant lango dydį.
    let seed = 20241;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    function build() {
      seed = 20241;
      const count = Math.round(Math.min(34, Math.max(12, (size.w * size.h) / 52000)));
      items = Array.from({ length: count }, (_, i) => ({
        icon: ICONS[i % ICONS.length],
        x: rnd(),
        y: rnd(),
        size: 16 + rnd() * 34,
        depth: 0.25 + rnd() * 0.75,
        speed: 5 + rnd() * 12,
        sway: 10 + rnd() * 26,
        swaySpeed: 0.15 + rnd() * 0.3,
        phase: rnd() * TAU,
        rot: rnd() * TAU,
        rotSpeed: (rnd() - 0.5) * 0.35,
        alpha: 0.07 + rnd() * 0.13,
      }));
    }

    function draw(t) {
      const { w, h, dpr } = size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const margin = 120;
      const span = h + margin * 2;
      const scroll = window.scrollY || 0;
      for (const p of items) {
        const y = mod(p.y * span - t * p.speed - scroll * p.depth * 0.22, span) - margin;
        const x = p.x * w + Math.sin(t * p.swaySpeed + p.phase) * p.sway;
        const s = p.size * (0.6 + p.depth * 0.6);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + t * p.rotSpeed);
        ctx.scale(s, s);
        ctx.lineWidth = 1.5 / s;
        ctx.strokeStyle = `rgba(${PINK}, ${p.alpha * (0.5 + p.depth * 0.5)})`;
        p.icon(ctx);
        ctx.restore();
      }
    }

    function resize() {
      size = fitCanvas(canvas, 1.5);
      build();
      draw(performance.now() / 1000);
    }

    build();
    return { draw, resize };
  }

  /* ------------------------------------------------------------------ */
  /* 2. Neoniniai šokėjai                                                */
  /* ------------------------------------------------------------------ */

  // Kūno proporcijos (figūros aukščio dalimis).
  // Moters proporcijos: siauresni pečiai, platesni klubai, ryškesnis liemuo.
  const ADULT = {
    torso: 0.27,
    neck: 0.032,
    head: 0.058,
    shoulder: 0.084,
    hip: 0.068,
    waist: 0.78,
    female: true, // moteriška figūra su sijonėliu
    armU: 0.145,
    armL: 0.14,
    legU: 0.235,
    legL: 0.235,
    foot: 0.055,
  };

  // Vaiko proporcijos: didesnė galva, trumpesnės galūnės, siauresni pečiai.
  const CHILD = {
    torso: 0.245,
    neck: 0.022,
    head: 0.088,
    shoulder: 0.082,
    hip: 0.05,
    armU: 0.13,
    armL: 0.12,
    legU: 0.205,
    legL: 0.205,
    foot: 0.05,
    waist: 0.6,
  };

  /*
   * Poza: [stuburas, galva, kR žastas, kR dilbis, dR žastas, dR dilbis,
   *        k šlaunis, k blauzda, d šlaunis, d blauzda, šuolis]
   * Kampai laipsniais: 0 = žemyn, + = į dešinę (ekrane), 180 = aukštyn.
   * „k“ = kairė ekrano pusė, „d“ = dešinė.
   */
  const POSES = {
    idle: [0, 0, -14, -6, 14, 6, -7, -3, 7, 3, 0],
    grooveR: [7, -6, -38, 24, 48, -34, -14, -4, 18, 26, 0],
    grooveL: [-7, 6, -48, 34, 38, -24, -18, -26, 14, 4, 0],
    vUp: [0, 0, -148, -166, 148, 166, -22, -14, 22, 14, 0.035],
    point: [11, 14, -42, 38, 136, 146, -6, -6, 30, 14, 0],
    dab: [-12, -30, -112, -104, -72, -128, -24, -8, 18, 10, 0],
    crouch: [14, 8, -58, 46, 62, -42, -44, 20, 44, -20, 0],
    kick: [-15, -4, -102, -114, 76, 102, -4, 0, 74, 66, 0],
    arabesque: [24, -12, -112, -102, 114, 124, -80, -86, 2, 0, 0],
    passe: [0, 0, -158, 168, 158, -168, 0, 0, 64, -40, 0],
    waveA: [-4, -8, -92, -52, 90, 126, -11, -4, 12, 6, 0],
    waveB: [4, 8, -90, -126, 92, 52, -12, -6, 11, 4, 0],
    lean: [-21, -10, -142, -152, 44, 84, -30, -30, 26, 6, 0],
    salsa: [6, 6, -74, -150, 62, 142, 8, 14, 22, -6, 0],
    jump: [0, -6, -128, -150, 128, 150, -34, 24, 34, -24, 0.09],
    lock: [-6, 0, -64, -160, 64, 20, -16, -10, 20, 4, 0],
  };

  const mirror = (p) => [-p[0], -p[1], -p[4], -p[5], -p[2], -p[3], -p[8], -p[9], -p[6], -p[7], p[10]];
  for (const k of ['point', 'dab', 'kick', 'arabesque', 'passe', 'lean', 'salsa', 'lock']) {
    POSES[`${k}M`] = mirror(POSES[k]);
  }

  // Choreografijos – po vieną pozą kiekvienam taktui.
  const ROUTINES = [
    ['grooveR', 'grooveL', 'grooveR', 'point', 'grooveL', 'grooveR', 'grooveL', 'pointM',
     'crouch', 'vUp', 'crouch', 'jump', 'waveA', 'waveB', 'waveA', 'waveB',
     'lock', 'lockM', 'dab', 'dabM', 'kick', 'crouch', 'kickM', 'crouch',
     'salsa', 'salsaM', 'passe', 'arabesque', 'lean', 'leanM', 'vUp', 'idle'],
    ['waveA', 'waveB', 'salsa', 'salsaM', 'passe', 'arabesque', 'passeM', 'arabesqueM',
     'grooveL', 'grooveR', 'pointM', 'point', 'crouch', 'jump', 'crouch', 'vUp',
     'lean', 'leanM', 'lockM', 'lock', 'kickM', 'crouch', 'dab', 'idle'],
  ];

  const ARM_IDX = new Set([2, 3, 4, 5]);

  function lerpPose(a, b, k) {
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      let d = b[i] - a[i];
      // rankos sukasi trumpiausiu keliu
      if (ARM_IDX.has(i)) d = mod(d + 180, 360) - 180;
      out[i] = a[i] + d * k;
    }
    return out;
  }

  /** Iš pozos apskaičiuoja sąnarių koordinates (pėdos ant y = 0, aukštyn – neigiama). */
  function solve(p, BODY = ADULT) {
    const sp = p[0] * D2R;
    const up = { x: Math.sin(sp), y: -Math.cos(sp) };
    const rt = { x: Math.cos(sp), y: Math.sin(sp) };
    const seg = (o, deg, len) => ({ x: o.x + Math.sin(deg * D2R) * len, y: o.y + Math.cos(deg * D2R) * len });

    const hipC = { x: 0, y: 0 };
    const chest = { x: up.x * BODY.torso, y: up.y * BODY.torso };
    const shL = { x: chest.x - rt.x * BODY.shoulder, y: chest.y - rt.y * BODY.shoulder };
    const shR = { x: chest.x + rt.x * BODY.shoulder, y: chest.y + rt.y * BODY.shoulder };
    const ha = (p[0] + p[1]) * D2R;
    const headC = {
      x: chest.x + Math.sin(ha) * (BODY.neck + BODY.head),
      y: chest.y - Math.cos(ha) * (BODY.neck + BODY.head),
    };
    const hipL = { x: -BODY.hip, y: 0 };
    const hipR = { x: BODY.hip, y: 0 };
    const elL = seg(shL, p[2], BODY.armU);
    const haL = seg(elL, p[3], BODY.armL);
    const elR = seg(shR, p[4], BODY.armU);
    const haR = seg(elR, p[5], BODY.armL);
    const knL = seg(hipL, p[6], BODY.legU);
    const ftL = seg(knL, p[7], BODY.legL);
    const knR = seg(hipR, p[8], BODY.legU);
    const ftR = seg(knR, p[9], BODY.legL);
    // pėdos – trumpas brūkšnys į išorę
    const toeL = { x: ftL.x - BODY.foot * (p[7] > 60 ? 0.2 : 1), y: ftL.y + (p[7] < -50 ? -BODY.foot * 0.6 : 0) };
    const toeR = { x: ftR.x + BODY.foot * (p[9] < -60 ? 0.2 : 1), y: ftR.y + (p[9] > 50 ? -BODY.foot * 0.6 : 0) };

    const neck = { x: chest.x + Math.sin(ha) * BODY.neck, y: chest.y - Math.cos(ha) * BODY.neck };
    const J = { hipC, chest, neck, shL, shR, headC, hipL, hipR, elL, haL, elR, haR, knL, ftL, knR, ftR, toeL, toeR };
    const ground = Math.max(ftL.y, ftR.y) + p[10];
    for (const k in J) J[k] = { x: J[k].x, y: J[k].y - ground };
    return J;
  }

  function tracePath(c, J, body, hair) {
    if (body.female) return traceFemale(c, J, body, hair);
    const R = body.head;
    const pinch = body.waist || 0.55;
    // liemuo – kontūras su įlinkiu ties juosmeniu
    const waist = (sh, hp) => ({
      x: sh.x * 0.42 + hp.x * 0.58 + (J.hipC.x * 0.6 + J.chest.x * 0.4 - (sh.x * 0.42 + hp.x * 0.58)) * pinch,
      y: sh.y * 0.42 + hp.y * 0.58 + (J.hipC.y * 0.6 + J.chest.y * 0.4 - (sh.y * 0.42 + hp.y * 0.58)) * pinch,
    });
    const wL = waist(J.shL, J.hipL);
    const wR = waist(J.shR, J.hipR);
    c.beginPath();
    c.moveTo(J.shL.x, J.shL.y);
    c.lineTo(J.shR.x, J.shR.y);
    c.quadraticCurveTo(wR.x, wR.y, J.hipR.x, J.hipR.y);
    c.lineTo(J.hipL.x, J.hipL.y);
    c.quadraticCurveTo(wL.x, wL.y, J.shL.x, J.shL.y);
    // kaklas
    c.moveTo(J.chest.x, J.chest.y);
    c.lineTo(J.neck.x, J.neck.y);
    c.moveTo(J.shL.x, J.shL.y);
    c.lineTo(J.elL.x, J.elL.y);
    c.lineTo(J.haL.x, J.haL.y);
    c.moveTo(J.shR.x, J.shR.y);
    c.lineTo(J.elR.x, J.elR.y);
    c.lineTo(J.haR.x, J.haR.y);
    c.moveTo(J.hipL.x, J.hipL.y);
    c.lineTo(J.knL.x, J.knL.y);
    c.lineTo(J.ftL.x, J.ftL.y);
    c.lineTo(J.toeL.x, J.toeL.y);
    c.moveTo(J.hipR.x, J.hipR.y);
    c.lineTo(J.knR.x, J.knR.y);
    c.lineTo(J.ftR.x, J.ftR.y);
    c.lineTo(J.toeR.x, J.toeR.y);
    c.moveTo(J.headC.x + R, J.headC.y);
    c.arc(J.headC.x, J.headC.y, R, 0, TAU);
    if (hair) traceHair(c, J, R, hair.style, hair.off);
  }

  /** Moteriška figūra: krūtinės linija, siaura talija, klubai ir plazdantis sijonėlis. */
  function traceFemale(c, J, body, hair) {
    const R = body.head;
    const off = hair ? hair.off : 0;
    const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    const axis = (k) => lerp(J.chest, J.hipC, k);
    // taškas ant liemens kontūro: k – aukštis (0 pečiai, 1 klubai), out – plotis nuo ašies
    const side = (sh, hp, k, out) => {
      const a = axis(k);
      const e = lerp(sh, hp, k);
      return { x: a.x + (e.x - a.x) * out, y: a.y + (e.y - a.y) * out };
    };
    const curve = (sh, hp) => ({
      bust: side(sh, hp, 0.24, 1.08),
      waist: side(sh, hp, 0.62, 0.66),
      hip: side(sh, hp, 1.0, 1.28),
    });
    const L = curve(J.shL, J.hipL);
    const Rt = curve(J.shR, J.hipR);

    c.beginPath();
    // pečiai ir liemens šonai
    c.moveTo(J.shL.x, J.shL.y);
    c.lineTo(J.shR.x, J.shR.y);
    for (const [sh, k] of [[J.shR, Rt], [J.shL, L]]) {
      c.moveTo(sh.x, sh.y);
      c.bezierCurveTo(k.bust.x, k.bust.y, k.waist.x, k.waist.y - 0.02, k.waist.x, k.waist.y);
      c.quadraticCurveTo(
        k.hip.x + (k.hip.x - J.hipC.x) * 0.15,
        (k.waist.y + k.hip.y) / 2 + 0.02,
        k.hip.x,
        k.hip.y
      );
    }
    // krūtinės linija
    const b1 = side(J.shL, J.hipL, 0.3, 0.55);
    const b2 = side(J.shR, J.hipR, 0.3, 0.55);
    const bm = axis(0.36);
    c.moveTo(b1.x, b1.y);
    c.quadraticCurveTo(bm.x, bm.y + 0.012, b2.x, b2.y);

    // sijonėlis: kraštai platėja žemyn klubų linijos statmena kryptimi, plazda kartu su plaukais
    let hx = Rt.hip.x - L.hip.x;
    let hy = Rt.hip.y - L.hip.y;
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl;
    hy /= hl;
    const dx = -hy; // „žemyn“ nuo klubų linijos
    const dy = hx;
    const len = 0.17;
    const flare = 0.085;
    const sway = Math.max(-0.035, Math.min(0.035, off * 0.6));
    const hemL = { x: L.hip.x + dx * len - hx * flare + sway, y: L.hip.y + dy * len - hy * flare };
    const hemR = { x: Rt.hip.x + dx * len + hx * flare + sway, y: Rt.hip.y + dy * len + hy * flare };
    c.moveTo(L.hip.x, L.hip.y);
    c.lineTo(Rt.hip.x, Rt.hip.y);
    c.moveTo(L.hip.x, L.hip.y);
    c.quadraticCurveTo(L.hip.x - hx * flare * 0.3 + sway * 0.5, (L.hip.y + hemL.y) / 2, hemL.x, hemL.y);
    c.moveTo(Rt.hip.x, Rt.hip.y);
    c.quadraticCurveTo(Rt.hip.x + hx * flare * 0.3 + sway * 0.5, (Rt.hip.y + hemR.y) / 2, hemR.x, hemR.y);
    // banguotas apačios kraštas
    c.moveTo(hemL.x, hemL.y);
    const waves = 4;
    for (let i = 0; i < waves; i++) {
      const a = lerp(hemL, hemR, i / waves);
      const b = lerp(hemL, hemR, (i + 1) / waves);
      c.quadraticCurveTo((a.x + b.x) / 2 + dx * 0.024, (a.y + b.y) / 2 + dy * 0.024, b.x, b.y);
    }

    // kaklas ir rankos
    c.moveTo(J.chest.x, J.chest.y);
    c.lineTo(J.neck.x, J.neck.y);
    c.moveTo(J.shL.x, J.shL.y);
    c.lineTo(J.elL.x, J.elL.y);
    c.lineTo(J.haL.x, J.haL.y);
    c.moveTo(J.shR.x, J.shR.y);
    c.lineTo(J.elR.x, J.elR.y);
    c.lineTo(J.haR.x, J.haR.y);
    // kojos – matomos iš po sijonėlio
    for (const [hp, hip, kn, ft, toe] of [
      [J.hipL, L.hip, J.knL, J.ftL, J.toeL],
      [J.hipR, Rt.hip, J.knR, J.ftR, J.toeR],
    ]) {
      const top = lerp(hp, hip, 0.4);
      const start = lerp(top, kn, Math.min(0.9, 0.12 / (Math.hypot(kn.x - top.x, kn.y - top.y) || 1)));
      c.moveTo(start.x, start.y);
      c.lineTo(kn.x, kn.y);
      c.lineTo(ft.x, ft.y);
      c.lineTo(toe.x, toe.y);
    }
    // galva ir plaukai
    c.moveTo(J.headC.x + R, J.headC.y);
    c.arc(J.headC.x, J.headC.y, R, 0, TAU);
    if (hair) traceHair(c, J, R, hair.style, hair.off);
  }

  /**
   * Plaukai. `off` – siūbavimas (kūno vienetais), kad plaukai „vėluotų“ už galvos judesio.
   * Stiliai: long (ilgi palaidi), ponytail (uodegėlė), pigtails (dvi kasytės).
   */
  function traceHair(c, J, R, style, off) {
    const h = J.headC;
    // galvos „aukštyn“ kryptis (pagal kaklą) ir „dešinėn“
    let ux = h.x - J.neck.x;
    let uy = h.y - J.neck.y;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const rx = -uy;
    const ry = ux;
    const at = (a, b) => ({ x: h.x + rx * a * R + ux * b * R, y: h.y + ry * a * R + uy * b * R });

    if (style === 'long') {
      // dvi išorinės sruogos nuo viršugalvio iki žemiau pečių + dvi vidinės
      for (const side of [-1, 1]) {
        const top = at(side * 0.25, 1.0);
        const c1 = at(side * 1.55, 0.7);
        const c2 = { x: h.x + side * R * 1.5 + off * 0.6, y: h.y + R * 1.9 };
        const tip = { x: h.x + side * R * 1.05 + off, y: h.y + R * 3.6 };
        c.moveTo(top.x, top.y);
        c.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, tip.x, tip.y);
        const s0 = at(side * 0.85, 0.2);
        const tip2 = { x: h.x + side * R * 0.95 + off * 0.8, y: h.y + R * 2.9 };
        c.moveTo(s0.x, s0.y);
        c.quadraticCurveTo(h.x + side * R * 1.15 + off * 0.3, h.y + R * 1.6, tip2.x, tip2.y);
      }
    } else if (style === 'ponytail') {
      // gumytė viršugalvyje ir uodegėlė, kuri švytruoja
      const base = at(0.55, 0.85);
      const c1 = { x: base.x + R * 1.3 + off * 0.5, y: base.y - R * 0.2 };
      const tip = { x: base.x + R * 1.35 + off * 1.4, y: base.y + R * 1.9 };
      c.moveTo(base.x, base.y);
      c.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
      c.moveTo(base.x + R * 0.05, base.y + R * 0.08);
      c.quadraticCurveTo(c1.x - R * 0.25, c1.y + R * 0.4, tip.x - R * 0.35, tip.y - R * 0.25);
    } else if (style === 'pigtails') {
      for (const side of [-1, 1]) {
        const base = at(side * 0.95, 0.35);
        const c1 = { x: base.x + side * R * 0.9 + off * 0.4, y: base.y + R * 0.1 };
        const tip = { x: base.x + side * R * 0.75 + off, y: base.y + R * 1.5 };
        c.moveTo(base.x, base.y);
        c.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
      }
    }
  }

  class Dancer {
    constructor({ routine, offset, flip, bpm }) {
      this.routine = ROUTINES[routine % ROUTINES.length];
      this.offset = offset;
      this.flip = flip;
      this.beat = 60 / bpm;
      this.trails = { haL: [], haR: [], ftL: [], ftR: [] };
      this.body = ADULT;
      this.trailLen = 16;
      this.hairStyle = 'long';
      this.hair = { off: 0, vel: 0, lastX: null };
    }

    /** Plaukų siūbavimas: spyruoklė, kuri seka galvos judesį su vėlavimu. */
    hairOffset(J, t, still) {
      const hs = this.hair;
      if (still) {
        hs.lastX = null;
        return 0;
      }
      const x = J.headC.x;
      const dx = hs.lastX == null ? 0 : x - hs.lastX;
      hs.lastX = x;
      const target = Math.max(-0.07, Math.min(0.07, -dx * 9)) + Math.sin(t * 2.4) * 0.006;
      hs.vel = (hs.vel + (target - hs.off) * 0.18) * 0.8;
      hs.off += hs.vel;
      return hs.off;
    }

    poseAt(t) {
      const n = this.routine.length;
      const pos = t / this.beat + this.offset;
      const i = Math.floor(pos);
      const frac = pos - i;
      let a = POSES[this.routine[mod(i, n)]];
      let b = POSES[this.routine[mod(i + 1, n)]];
      if (this.flip) {
        a = mirror(a);
        b = mirror(b);
      }
      // Poza „laikoma“, tada staigiai pereina į kitą – atrodo ritmiškiau.
      const p = lerpPose(a, b, ease(clamp01((frac - 0.34) / 0.66)));
      // „Groove“: lengvas pritūpimas ir siūbavimas į taktą.
      const bend = (1 - Math.cos(frac * TAU)) * 3.2;
      p[6] -= bend;
      p[7] += bend * 1.2;
      p[8] += bend;
      p[9] -= bend * 1.2;
      p[0] += Math.sin(pos * Math.PI) * 1.6;
      return p;
    }

    /**
     * @param {CanvasRenderingContext2D} c
     * @param {number} t     laikas sekundėmis
     * @param {number} x     figūros centro x (px)
     * @param {number} gy    grindų y (px)
     * @param {number} H     figūros aukštis (px)
     * @param {number} alpha ryškumas 0…1
     * @param {boolean} still nejudantis kadras (be pėdsakų)
     */
    draw(c, t, x, gy, H, alpha, still) {
      const J = solve(this.poseAt(t), this.body);
      const lw = Math.max(2.2, H * 0.0125);
      const hairInfo = this.hairStyle ? { style: this.hairStyle, off: this.hairOffset(J, t, still) } : null;

      // šviesos dėmė ant grindų
      c.save();
      c.translate(x, gy);
      c.scale(1, 0.16);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, H * 0.42);
      g.addColorStop(0, `rgba(${PINK}, ${0.5 * alpha})`);
      g.addColorStop(1, `rgba(${PINK}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, H * 0.42, 0, TAU);
      c.fill();
      c.restore();

      c.save();
      c.translate(x, gy);
      c.scale(H, H);
      c.lineCap = 'round';
      c.lineJoin = 'round';

      // judesio pėdsakai (rankos ir kojos)
      if (!still) {
        for (const key in this.trails) {
          const tr = this.trails[key];
          tr.push({ x: J[key].x, y: J[key].y });
          if (tr.length > this.trailLen) tr.shift();
          for (let i = 1; i < tr.length; i++) {
            const k = i / tr.length;
            c.strokeStyle = `rgba(${PINK}, ${k * k * 0.42 * alpha})`;
            c.lineWidth = (lw * (0.4 + k * 1.3)) / H;
            c.beginPath();
            c.moveTo(tr[i - 1].x, tr[i - 1].y);
            c.lineTo(tr[i].x, tr[i].y);
            c.stroke();
          }
        }
      }

      // neoninis vamzdis: platus švytėjimas + ryški šerdis
      c.shadowColor = `rgba(${PINK}, ${0.95 * alpha})`;
      c.shadowBlur = lw * 5.5;
      c.strokeStyle = `rgba(${PINK}, ${alpha})`;
      c.lineWidth = lw / H;
      tracePath(c, J, this.body, hairInfo);
      c.stroke();
      c.shadowBlur = lw * 1.5;
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = `rgba(255, 224, 240, ${0.92 * alpha})`;
      c.lineWidth = (lw * 0.36) / H;
      tracePath(c, J, this.body, hairInfo);
      c.stroke();
      c.restore();
    }
  }

  /**
   * Vaikas, kuris bando atkartoti pagrindinio šokėjo judesius:
   * šiek tiek vėluoja, judesiai mažesni ir ne visai tikslūs, kartais pastrykčioja.
   */
  class Kid extends Dancer {
    constructor({ leader, lag, accuracy, seed, hairStyle }) {
      super({ routine: 0, offset: 0, flip: false, bpm: 104 });
      this.leader = leader;
      this.lag = lag; // kiek taktų vėluoja
      this.accuracy = accuracy; // 1 = tiksliai kaip suaugęs
      this.seed = seed;
      this.body = CHILD;
      this.trailLen = 10;
      this.hairStyle = hairStyle;
    }

    poseAt(t) {
      const beat = this.leader.beat;
      // Vėlavimas „plaukia“ – kartais pasiveja, kartais atsilieka.
      const lag = this.lag + 0.14 * Math.sin(t * 0.37 + this.seed * 3.1);
      const p = this.leader.poseAt(t - lag * beat);
      const idle = POSES.idle;
      for (let i = 0; i < 10; i++) {
        // Mažesnė judesio amplitudė (vaikas dar ne viską pasiekia)…
        p[i] = idle[i] + (p[i] - idle[i]) * this.accuracy;
        // …ir šiek tiek „netvarkingi“ rankų / kojų kampai.
        p[i] += Math.sin(t * (2.1 + i * 0.37) + this.seed * (i + 1)) * (i >= 2 && i <= 5 ? 6 : 2.5);
      }
      // Iš džiaugsmo pastrykčioja.
      const hop = Math.sin((t / beat) * Math.PI + this.seed);
      p[10] += Math.max(0, hop) * 0.035;
      p[0] += Math.sin(t * 1.3 + this.seed) * 3;
      return p;
    }
  }

  function initDancers(canvas) {
    const ctx = canvas.getContext('2d');
    let size = fitCanvas(canvas, 2);
    const lead = new Dancer({ routine: 0, offset: 0, flip: false, bpm: 104 });
    const crew = [
      new Kid({ leader: lead, lag: 0.32, accuracy: 0.78, seed: 1.7, hairStyle: 'ponytail' }),
      new Kid({ leader: lead, lag: 0.5, accuracy: 0.68, seed: 4.2, hairStyle: 'pigtails' }),
      lead,
    ];

    function layout() {
      const { w, h } = size;
      if (w < 860) {
        // Telefone – vienas šokėjas virš teksto (kad neuždengtų logotipo).
        const inner = document.querySelector('.hero__inner');
        const top = inner ? inner.offsetTop : h * 0.5;
        const gy = Math.max(h * 0.3, top - 18);
        const H = Math.min(gy - 96, w * 0.62);
        if (H < 110) return [null, null, null];
        const x = w * 0.66;
        const kidH = H * 0.56;
        return [
          { x: x - H * 0.5, gy: gy + 4, H: kidH, alpha: 0.8 },
          { x: Math.min(w - kidH * 0.32, x + H * 0.52), gy: gy + 4, H: kidH * 0.92, alpha: 0.8 },
          { x, gy, H, alpha: 0.85 },
        ];
      }
      // Kompiuteryje: suaugęs šokėjas, o abipus jo – du mažesni vaikai.
      const H = Math.min(h * 0.66, w * 0.38);
      const gy = h * 0.88;
      const x = w * 0.74;
      return [
        { x: x - H * 0.52, gy: gy + H * 0.04, H: H * 0.58, alpha: 0.92 },
        { x: Math.min(w - H * 0.2, x + H * 0.54), gy: gy + H * 0.05, H: H * 0.52, alpha: 0.88 },
        { x, gy, H, alpha: 1 },
      ];
    }

    let slots = layout();

    function draw(t, still) {
      const { w, h, dpr } = size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      crew.forEach((d, i) => {
        const s = slots[i];
        if (s) d.draw(ctx, t, s.x, s.gy, s.H, s.alpha, still);
      });
    }

    function resize() {
      size = fitCanvas(canvas, 2);
      slots = layout();
      crew.forEach((d) => {
        for (const k in d.trails) d.trails[k].length = 0;
      });
      draw(performance.now() / 1000, true);
    }

    return { draw, resize };
  }

  /* ------------------------------------------------------------------ */
  /* Paleidimas                                                          */
  /* ------------------------------------------------------------------ */

  const bgCanvas = document.getElementById('bg-fx');
  const heroCanvas = document.getElementById('hero-dancers');
  const bg = bgCanvas ? initBackground(bgCanvas) : null;
  const dancers = heroCanvas ? initDancers(heroCanvas) : null;

  // Viešas API (naudojamas ir pavyzdinėms galerijos iliustracijoms generuoti).
  window.KDFX = { POSES, ROUTINES, Dancer, solve, mirror };

  if (dancers && document.fonts && document.fonts.ready) document.fonts.ready.then(() => dancers.resize());

  let heroVisible = true;
  if (heroCanvas && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
    }).observe(heroCanvas);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (bg) bg.resize();
      if (dancers) dancers.resize();
    }, 120);
  });

  if (reduceMotion) {
    // Statinis kadras: graži poza, be judesio.
    if (bg) bg.draw(3);
    if (dancers) dancers.draw(0.577 * 11, true);
    window.addEventListener('scroll', () => bg && bg.draw(3), { passive: true });
    return;
  }

  let frame = 0;
  function loop(now) {
    const t = now / 1000;
    frame++;
    if (!document.hidden) {
      if (dancers && heroVisible) dancers.draw(t, false);
      if (bg && frame % 2 === 0) bg.draw(t); // ~30 kadrų/s pakanka
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
