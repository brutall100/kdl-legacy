/* ==========================================================================
   KD Legacy – valdymo panelės sąveikos (be bibliotekų)
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const html = document.documentElement;
  html.classList.add('js');
  const csrf = ($('meta[name="csrf"]') || {}).content || '';

  /* ---------- Šoninis meniu (telefone) ---------- */
  const toggle = $('[data-side-toggle]');
  const setSide = (open) => {
    html.classList.toggle('side-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
  };
  if (toggle) toggle.addEventListener('click', () => setSide(!html.classList.contains('side-open')));
  $$('[data-side-close]').forEach((el) => el.addEventListener('click', () => setSide(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSide(false);
  });

  /* ---------- Patvirtinimai ---------- */
  document.addEventListener('submit', (e) => {
    const msg = e.target.dataset && e.target.dataset.confirm;
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  /* ---------- Automatinis formos siuntimas (būsenos pasirinkimas) ---------- */
  $$('[data-autosubmit]').forEach((el) => el.addEventListener('change', () => el.form.submit()));

  /* ---------- Pranešimas dingsta savaime ---------- */
  const flash = $('[data-flash]');
  if (flash && flash.classList.contains('flash--ok')) setTimeout(() => flash.remove(), 6000);

  /* ---------- Neišsaugotų pakeitimų įspėjimas ---------- */
  $$('form[data-dirty]').forEach((form) => {
    let dirty = false;
    form.addEventListener('input', () => (dirty = true));
    form.addEventListener('submit', () => (dirty = false));
    window.addEventListener('beforeunload', (e) => {
      if (dirty) e.preventDefault();
    });
  });

  /* ---------- Nuotraukos peržiūra prieš įkeliant ---------- */
  $$('[data-upload]').forEach((box) => {
    const input = $('input[type="file"]', box);
    const preview = $('[data-preview]', box);
    if (!input || !preview) return;
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const img = document.createElement('img');
      img.alt = 'Pasirinkta nuotrauka';
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      preview.innerHTML = '';
      preview.appendChild(img);
      preview.classList.remove('is-empty');
    });
  });

  /* ---------- Teksto redaktorius ---------- */
  $$('[data-rte]').forEach((rte) => {
    const bar = $('.rte__bar', rte);
    const area = $('.rte__area', rte);
    const src = $('.rte__src', rte);
    area.innerHTML = src.value; // turinys jau išvalytas serveryje
    bar.hidden = false;
    area.hidden = false;
    src.hidden = true;
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* nepalaikoma – nesvarbu */
    }

    // Tekstas, parašytas ne pastraipoje, įdedamas į <p> (tik siunčiamoje kopijoje –
    // gyvo redaktoriaus neliečiam, kad nešokinėtų žymeklis).
    const BLOCKS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'DIV']);
    const sync = () => {
      const copy = area.cloneNode(true);
      let run = [];
      const flush = (before) => {
        if (run.some((n) => n.textContent.trim())) {
          const p = document.createElement('p');
          copy.insertBefore(p, before);
          run.forEach((n) => p.appendChild(n));
        } else {
          run.forEach((n) => n.remove());
        }
        run = [];
      };
      Array.from(copy.childNodes).forEach((n) => {
        if (n.nodeType === 1 && BLOCKS.has(n.nodeName)) flush(n);
        else run.push(n);
      });
      flush(null);
      src.value = copy.innerHTML;
    };
    area.addEventListener('input', sync);
    area.addEventListener('blur', sync);
    area.addEventListener('focus', () => {
      if (!area.textContent.trim() && !area.querySelector('li, img')) {
        area.innerHTML = '<p><br></p>';
        const range = document.createRange();
        range.setStart(area.firstChild, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    if (src.form) src.form.addEventListener('submit', sync);

    // Įklijuojamas tik paprastas tekstas – be svetimo formatavimo.
    area.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      area.focus();
      const cmd = btn.dataset.cmd;
      if (cmd === 'link') {
        const url = window.prompt('Nuorodos adresas (https://…). Palikite tuščią, jei norite nuorodą pašalinti:', 'https://');
        if (url === null) return;
        if (!url.trim() || url.trim() === 'https://') document.execCommand('unlink');
        else document.execCommand('createLink', false, url.trim());
      } else if (cmd === 'h2' || cmd === 'blockquote') {
        const current = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
        document.execCommand('formatBlock', false, current === cmd ? 'p' : cmd);
      } else {
        document.execCommand(cmd, false, null);
      }
      sync();
    });
  });

  /* ---------- Kelių nuotraukų įkėlimas (galerija) ---------- */
  $$('[data-dropzone]').forEach((zone) => {
    const input = $('[data-dropzone-input]', zone);
    const status = $('[data-dropzone-status]', zone);
    const progress = $('[data-dropzone-progress]', zone);
    const bar = progress ? $('span', progress) : null;
    let busy = false;

    async function uploadAll(fileList) {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (!files.length || busy) return;
      busy = true;
      progress.hidden = false;
      let done = 0;
      const failed = [];
      // Po vieną – patikimiau lėtame ryšyje ir su didelėmis nuotraukomis.
      for (const file of files) {
        status.textContent = `Keliama ${done + 1} iš ${files.length}…`;
        const body = new FormData();
        body.append('files', file);
        try {
          const res = await fetch(zone.action, { method: 'POST', body, headers: { Accept: 'application/json' } });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) failed.push(file.name);
        } catch {
          failed.push(file.name);
        }
        done++;
        bar.style.width = `${Math.round((done / files.length) * 100)}%`;
      }
      busy = false;
      if (failed.length) {
        status.textContent = `Įkelta ${files.length - failed.length} iš ${files.length}. Nepavyko: ${failed.join(', ')}`;
        if (failed.length < files.length) setTimeout(() => window.location.reload(), 3500);
      } else {
        status.textContent = 'Įkelta! Atnaujinama…';
        window.location.reload();
      }
    }

    input.addEventListener('change', () => uploadAll(input.files));
    zone.addEventListener('submit', (e) => {
      e.preventDefault();
      uploadAll(input.files);
    });
    ['dragenter', 'dragover'].forEach((type) =>
      zone.addEventListener(type, (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
          zone.classList.add('is-over');
        }
      })
    );
    ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, () => zone.classList.remove('is-over')));
    zone.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      uploadAll(e.dataTransfer.files);
    });
  });

  /* ---------- Tvarkos keitimas tempiant ---------- */
  $$('[data-sortable]').forEach((list) => {
    let dragged = null;
    let before = '';
    const items = () => $$('[data-id]', list);
    const order = () => items().map((el) => el.dataset.id);

    list.addEventListener('dragstart', (e) => {
      const item = e.target.closest('[data-id]');
      if (!item) return;
      dragged = item;
      before = order().join(',');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
      requestAnimationFrame(() => item.classList.add('is-dragging'));
    });
    list.addEventListener('dragover', (e) => {
      if (!dragged) return;
      e.preventDefault();
      const target = e.target.closest('[data-id]');
      if (!target || target === dragged) return;
      const rect = target.getBoundingClientRect();
      const horizontal = list.classList.contains('tiles');
      const after = horizontal ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
      target.parentNode.insertBefore(dragged, after ? target.nextSibling : target);
    });
    list.addEventListener('dragend', async () => {
      if (!dragged) return;
      dragged.classList.remove('is-dragging');
      dragged = null;
      const ids = order();
      if (ids.join(',') === before) return;
      try {
        const res = await fetch(list.dataset.sortable, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
          body: JSON.stringify({ ids: ids.map(Number) }),
        });
        if (!res.ok) throw new Error('reorder failed');
      } catch {
        window.alert('Nepavyko išsaugoti naujos tvarkos. Puslapis bus perkrautas.');
        window.location.reload();
      }
    });
  });
})();
