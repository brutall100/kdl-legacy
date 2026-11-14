/* ==========================================================================
   KD Legacy – viešos svetainės sąveikos (be bibliotekų)
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const html = document.documentElement;

  /* ---------- Švarūs adresai: be #grotažymių ---------- */
  // Paspaudus nuorodą į skiltį (#apie, #kontaktai…) puslapis nuslenka, bet adresas lieka švarus.
  const cleanUrl = () => {
    if (window.location.hash || window.location.search.includes('sent=')) {
      history.replaceState(null, '', window.location.pathname);
    }
  };
  const scrollToId = (id, smooth) => {
    const target = id && document.getElementById(id);
    if (!target) return false;
    if (id === 'main') {
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      return true;
    }
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    return true;
  };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    // galerijos nuotraukos ir „Pereiti prie turinio“ (klaviatūrai) – įprastas elgesys
    if (link.hasAttribute('data-lb') || link.classList.contains('skip-link')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
    const id = decodeURIComponent(url.hash.slice(1));
    if (!scrollToId(id, true)) return;
    e.preventDefault();
    cleanUrl();
  });
  // Atėjus iš kito puslapio (pvz. /naujienos → /#kontaktai): nuslenkam ir išvalom adresą.
  if (window.location.hash) {
    const id = decodeURIComponent(window.location.hash.slice(1));
    window.addEventListener('load', () => {
      scrollToId(id, false);
      cleanUrl();
    });
  } else {
    cleanUrl();
  }

  /* ---------- Fono vaizdo įrašo garsas ---------- */
  const heroVideo = $('#hero-video');
  const soundBtn = $('[data-sound]');
  if (heroVideo && soundBtn) {
    const label = $('[data-sound-label]', soundBtn);
    soundBtn.addEventListener('click', () => {
      const on = heroVideo.muted;
      heroVideo.muted = !on;
      if (on) {
        heroVideo.volume = 1;
        heroVideo.play().catch(() => {});
      }
      soundBtn.setAttribute('aria-pressed', String(on));
      label.textContent = on ? soundBtn.dataset.on : soundBtn.dataset.off;
    });
  }

  /* ---------- Antraštė ---------- */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobilus meniu ---------- */
  const burger = $('[data-burger]');
  const nav = $('#site-nav');
  function setNav(open) {
    html.classList.toggle('nav-open', open);
    if (burger) burger.setAttribute('aria-expanded', String(open));
  }
  if (burger && nav) {
    burger.addEventListener('click', () => setNav(!html.classList.contains('nav-open')));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && html.classList.contains('nav-open')) {
        setNav(false);
        burger.focus();
      }
    });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', () => setNav(false));
  }

  /* ---------- Atsiradimo animacijos ---------- */
  const reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window && reveals.length) {
    // Greta esantys elementai atsiranda vienas po kito.
    reveals.forEach((el) => {
      const siblings = Array.from(el.parentElement.children).filter((x) => x.hasAttribute('data-reveal'));
      el.style.setProperty('--i', String(Math.min(siblings.indexOf(el), 6)));
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Tvarkaraštis: filtras ir šiandienos diena ---------- */
  const filters = $('[data-filters]');
  if (filters) {
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      const value = btn.dataset.filter;
      $$('[data-filter]', filters).forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      $$('.day').forEach((day) => {
        let any = false;
        $$('.slot', day).forEach((slot) => {
          const match = !value || slot.dataset.class === value;
          slot.classList.toggle('is-dim', !match);
          if (match) any = true;
        });
        day.classList.toggle('is-dim', !any);
      });
    });
  }
  const weekday = ((new Date().getDay() + 6) % 7) + 1; // 1 = pirmadienis
  const today = $(`.day[data-day="${weekday}"]`);
  if (today) today.classList.add('is-today');

  /* ---------- „Noriu išbandyti“ -> parenka stilių formoje ---------- */
  const classSelect = $('[data-class-select]');
  $$('[data-pick-class]').forEach((link) => {
    link.addEventListener('click', () => {
      if (!classSelect) return;
      const opt = Array.from(classSelect.options).find((o) => o.value === link.dataset.pickClass);
      if (opt) classSelect.value = opt.value;
    });
  });

  /* ---------- Registracijos forma ---------- */
  const form = $('[data-register-form]');
  if (form) {
    const errorBox = $('[data-form-error]', form);
    const okBox = $('[data-form-ok]');
    const submit = $('button[type="submit"]', form);
    const label = $('[data-submit-label]', form);
    const labelText = label ? label.textContent : '';

    const showError = (msg) => {
      errorBox.textContent = msg;
      errorBox.hidden = false;
    };

    form.addEventListener('submit', async (e) => {
      if (!window.fetch || !window.URLSearchParams) return; // paprastas siuntimas be JS
      e.preventDefault();
      errorBox.hidden = true;
      submit.disabled = true;
      if (label) label.textContent = form.dataset.sending;
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          form.hidden = true;
          okBox.hidden = false;
          okBox.classList.add('is-visible');
          okBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
          showError(data.error || form.dataset.err);
        }
      } catch {
        showError(form.dataset.err);
      } finally {
        submit.disabled = false;
        if (label) label.textContent = labelText;
      }
    });
  }

  /* ---------- Žemėlapis įkeliamas tik paspaudus ---------- */
  $$('[data-map]').forEach((frame) => {
    const btn = $('[data-map-load]', frame);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = frame.dataset.map;
      iframe.title = frame.dataset.title || 'Map';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.setAttribute('allowfullscreen', '');
      frame.innerHTML = '';
      frame.appendChild(iframe);
    });
  });

  /* ---------- Nuotraukų peržiūra (lightbox) ---------- */
  const lb = $('#lightbox');
  if (lb) {
    const img = $('[data-lb-img]', lb);
    const caption = $('[data-lb-caption]', lb);
    let group = [];
    let index = 0;
    let lastFocus = null;

    const show = (i) => {
      index = (i + group.length) % group.length;
      const link = group[index];
      img.src = link.href;
      img.alt = link.dataset.caption || '';
      caption.textContent = link.dataset.caption || '';
      // iš anksto įkeliam gretimą nuotrauką
      if (group.length > 1) new Image().src = group[(index + 1) % group.length].href;
    };
    const open = (link) => {
      const scope = link.closest('[data-gallery]');
      group = scope ? $$('[data-lb]', scope) : [link];
      lastFocus = document.activeElement;
      lb.classList.toggle('is-single', group.length < 2);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      show(group.indexOf(link));
      $('[data-lb-close]', lb).focus();
    };
    const close = () => {
      lb.hidden = true;
      img.removeAttribute('src');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-lb]');
      if (!link) return;
      e.preventDefault();
      open(link);
    });
    $('[data-lb-close]', lb).addEventListener('click', close);
    $('[data-lb-prev]', lb).addEventListener('click', () => show(index - 1));
    $('[data-lb-next]', lb).addEventListener('click', () => show(index + 1));
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('lightbox__figure')) close();
    });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'Tab') {
        // fokusas lieka peržiūros lange
        const items = $$('button', lb).filter((b) => b.offsetParent !== null && getComputedStyle(b).visibility !== 'hidden');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    // braukimas telefone
    let touchX = null;
    lb.addEventListener('touchstart', (e) => (touchX = e.changedTouches[0].clientX), { passive: true });
    lb.addEventListener(
      'touchend',
      (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 50 && group.length > 1) show(index + (dx < 0 ? 1 : -1));
      },
      { passive: true }
    );
  }
})();
