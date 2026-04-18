// Agilotext — Header éditeur (titre affiché, téléchargements, export, webhook, suppression)
// Chargé par editor-main.js — aligné API jobTitle + renameTranscriptTitle (branche 1.05+)
// ⚠️ Ne pas dupliquer ce fichier en embed inline Webflow si déjà chargé via CDN.

(function () {
  if (window.__agiloEditorHeader_v5) return;
  window.__agiloEditorHeader_v5 = true;

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const EDITION_DEFAULT = 'ent';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

  const getUserEmail = () =>
    $('[name="memberEmail"]')?.value ||
    window.memberEmail ||
    localStorage.getItem('agilo:username') ||
    '';

  const getToken = () =>
    (typeof window.globalToken !== 'undefined' && window.globalToken) ? window.globalToken : '';

  const getJobId = () => {
    const u = new URL(location.href);
    return u.searchParams.get('jobId')
      || $('#editorRoot')?.dataset.jobId
      || localStorage.getItem('agilotext:lastJobId')
      || '';
  };

  const sanitizeFilename = (name) =>
    String(name || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();

  const splitName = (fn) => {
    const s = String(fn || '');
    const i = s.lastIndexOf('.');
    if (i > 0 && i < s.length - 1) return { base: s.slice(0, i), ext: s.slice(i) };
    return { base: s, ext: '' };
  };

  function stemDisplay(fn) {
    const s = String(fn || '');
    const i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) : s;
  }

  function displayJobTitle(job) {
    if (!job) return 'Transcript';
    const jt = (job.jobTitle != null ? String(job.jobTitle) : '').trim();
    if (jt) return jt;
    const fn = job.filename || '';
    if (fn) return stemDisplay(fn) || fn;
    return 'Transcript';
  }

  function injectTheme() {
    if (document.getElementById('agilo-dialog-theme')) return;
    const css = `
    .agilo-overlay{position:fixed;inset:0;display:none;z-index:99999;background:rgba(0,0,0,.35)}
    .agilo-modal{max-width:560px;margin:6vh auto;background:#fff;border-radius:.5rem;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden;color:#020202}
    .agilo-modal__header{padding:18px 22px;border-bottom:1px solid #343a4040}
    .agilo-modal__title{margin:0;font-size:18px}
    .agilo-modal__subtitle{margin:6px 0 0;color:#525252;font-size:14px}
    .agilo-modal__body{padding:16px 22px;max-height:60vh;overflow:auto}
    .agilo-modal__footer{display:flex;gap:8px;justify-content:flex-end;padding:14px 16px;border-top:1px solid #343a4040;background:#f8f9fa}
    .agilo-block{margin-bottom:14px}
    .agilo-block__heading{font-weight:600;margin-bottom:4px}
    .agilo-block__text{color:#020202;margin-bottom:6px}
    .agilo-block__details summary{cursor:pointer;color:#525252}
    .agilo-block__pre{white-space:pre-wrap;background:#f8f9fa;border:1px solid #343a4040;border-radius:.5rem;padding:8px;margin-top:6px;font-size:12px}
    .agilo-btn{padding:10px 14px;border-radius:.5rem;border:1px solid #343a4040;background:#fff;cursor:pointer}
    .agilo-btn--primary{border-color:#174a96;background:#174a96;color:#fff}
    .agilo-toast{position:fixed;left:20px;bottom:20px;z-index:999999;background:#111;color:#fff;padding:9px 14px;border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,.22);opacity:0;transition:opacity .25s;max-width:92vw}
    .is-disabled{opacity:.6; cursor:not-allowed;}
  `;
    const st = document.createElement('style'); st.id = 'agilo-dialog-theme'; st.textContent = css; document.head.appendChild(st);
  }

  function ensureDialog() {
    injectTheme();
    if (document.getElementById('agilo-dialog')) return;
    const html = `
      <div id="agilo-dialog" role="dialog" aria-modal="true" class="agilo-overlay" lang="fr">
        <div class="agilo-modal">
          <div class="agilo-modal__header">
            <h3 id="agilo-dialog-title" class="agilo-modal__title">Résultat</h3>
            <p id="agilo-dialog-sub" class="agilo-modal__subtitle"></p>
          </div>
          <div id="agilo-dialog-body" class="agilo-modal__body"></div>
          <div class="agilo-modal__footer">
            <button id="agilo-dialog-close" class="agilo-btn">Fermer</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('agilo-dialog-close').addEventListener('click', hideDialog);
    document.getElementById('agilo-dialog').addEventListener('click', (e) => { if (e.target.id === 'agilo-dialog') hideDialog(); });
  }

  function showDialog({ title, subtitle, blocks }) {
    ensureDialog();
    const m = document.getElementById('agilo-dialog');
    $('#agilo-dialog-title').textContent = title || 'Résultat';
    $('#agilo-dialog-sub').textContent = subtitle || '';
    const body = $('#agilo-dialog-body'); body.innerHTML = '';
    (blocks || []).forEach((b) => {
      const box = document.createElement('div');
      box.className = 'agilo-block';
      box.innerHTML = `
        ${b.heading ? `<div class="agilo-block__heading">${b.heading}</div>` : ''}
        ${b.text ? `<div class="agilo-block__text">${b.text}</div>` : ''}
        ${b.html || ''}
        ${b.details ? `<details class="agilo-block__details"><summary>Détails techniques</summary><pre class="agilo-block__pre">${b.details}</pre></details>` : ''}
      `;
      body.appendChild(box);
    });
    m.style.display = 'block';
  }

  function hideDialog() { const m = document.getElementById('agilo-dialog'); if (m) m.style.display = 'none'; }

  function toast(msg, ms = 2200) {
    injectTheme();
    const el = document.createElement('div'); el.className = 'agilo-toast'; el.textContent = msg; document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = 1; });
    if (ms !== Infinity) setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 350); }, ms);
    return el;
  }

  async function ensureAuth(maxMs = 8000) {
    let email = getUserEmail();
    let token = getToken();
    const edition = new URLSearchParams(location.search).get('edition') || $('#editorRoot')?.dataset.edition || EDITION_DEFAULT;

    const t0 = performance.now();
    if (!token && typeof window.getToken === 'function' && email) {
      try { window.getToken(email, edition); } catch { /* ignore */ }
    }
    while ((!email || !token) && performance.now() - t0 < maxMs) {
      await new Promise((r) => setTimeout(r, 120));
      email = getUserEmail() || email;
      token = getToken() || token;
    }
    if (!token && email) {
      try {
        const r = await fetch(`${API_BASE}/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`);
        const j = await r.json(); if (j?.status === 'OK' && j.token) { token = j.token; window.globalToken = token; }
      } catch { /* ignore */ }
    }
    return { email, token, edition };
  }

  async function apiGetJob(jobId, auth) {
    if (!jobId || !auth?.email || !auth?.token) return null;

    const base =
      `${API_BASE}/getJobsInfo?username=${encodeURIComponent(auth.email)}`
      + `&token=${encodeURIComponent(auth.token)}`
      + `&edition=${encodeURIComponent(auth.edition)}`;

    const normalize = (j) => ({
      jobId: String(j.jobid ?? j.jobId ?? ''),
      filename: j.filename || '',
      jobTitle: (j.jobTitle != null ? String(j.jobTitle) : '').trim(),
      folderId: j.folderId != null ? Number(j.folderId) : 0,
      folderName: (j.folderName != null ? String(j.folderName) : '').trim(),
      transcriptStatus: j.transcriptStatus || j.status || '',
      javaException: j.javaException || ''
    });

    try {
      const r1 = await fetch(`${base}&jobId=${encodeURIComponent(jobId)}&limit=5&offset=0`);
      const j1 = await r1.json().catch(() => ({}));
      const hit1 = (j1?.jobsInfoDtos || []).find((x) => String(x.jobid || x.jobId) === String(jobId));
      if (hit1) return normalize(hit1);
    } catch { /* ignore */ }

    try {
      const r2 = await fetch(`${base}&limit=300&offset=0`);
      const j2 = await r2.json().catch(() => ({}));
      const hit2 = (j2?.jobsInfoDtos || []).find((x) => String(x.jobid || x.jobId) === String(jobId));
      if (hit2) return normalize(hit2);
    } catch { /* ignore */ }

    return null;
  }

  async function apiRenameTitle(jobId, newTitle, auth) {
    const body = new URLSearchParams({
      username: auth.email,
      token: auth.token,
      edition: auth.edition,
      jobId: String(jobId),
      jobTitle: String(newTitle || '').trim()
    });
    try {
      const r = await fetch(`${API_BASE}/renameTranscriptTitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const j = await r.json().catch(() => ({}));
      if (j?.status === 'OK') return { ok: true };
      return { ok: false, error: j?.message || j?.errorMessage || j?.userErrorMessage || 'Erreur de renommage' };
    } catch (e) {
      return { ok: false, error: e?.message || 'Erreur réseau' };
    }
  }

  async function apiShare(jobId, auth) {
    const body = new URLSearchParams({ username: auth.email, token: auth.token, edition: auth.edition, jobId: String(jobId) });
    try {
      const r = await fetch(`${API_BASE}/getSharedUrl`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.status === 'OK' && j.url) return { ok: true, url: j.url };
      return { ok: false, error: j?.errorMessage || 'Impossible de générer le lien' };
    } catch (e) {
      return { ok: false, error: e?.message || 'Erreur réseau' };
    }
  }

  async function apiWebhook(jobId, auth, provider = '') {
    const body = new URLSearchParams({ username: auth.email, token: auth.token, edition: auth.edition, jobId: String(jobId) });
    if (provider) body.set('automationProvider', provider);
    try {
      const r = await fetch(`${API_BASE}/webhookResend`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body.toString() });
      const t = await r.text(); let j = {}; try { j = JSON.parse(t || '{}'); } catch { j = { _raw: t }; }
      if (!r.ok) return { ok: false, code: 'http_error_' + r.status, raw: `HTTP ${r.status}` };
      if (j?.status === 'OK') return { ok: true };
      return { ok: false, code: j?.errorMessage || 'unknown', raw: j?.exceptionStackTrace || JSON.stringify(j) };
    } catch (e) {
      return { ok: false, code: 'network_error', raw: e?.message || String(e) };
    }
  }

  async function apiDelete(jobId, auth) {
    try {
      const url = `${API_BASE}/deleteJob?username=${encodeURIComponent(auth.email)}&token=${encodeURIComponent(auth.token)}&jobId=${encodeURIComponent(jobId)}&edition=${encodeURIComponent(auth.edition)}`;
      const r = await fetch(url); const j = await r.json().catch(() => ({}));
      if (j?.status === 'OK') return { ok: true };
      return { ok: false, error: j?.errorMessage || 'Échec de suppression' };
    } catch (e) {
      return { ok: false, error: e?.message || 'Erreur réseau' };
    }
  }

  let AUTH = { email: '', token: '', edition: EDITION_DEFAULT };
  let CURRENT = { full: '', ext: '', base: '' };
  let LAST_JOB = null;

  function applyHeaderFromJob(job) {
    const titleEl = $('.ed-title');
    if (!titleEl || !job) return;
    const full = String(job.filename || '');
    const { base, ext } = splitName(full);
    CURRENT = { full, ext, base };
    titleEl.textContent = displayJobTitle(job);
    titleEl.dataset.filename = full;
    titleEl.dataset.ext = ext;
    titleEl.dataset.jobTitle = job.jobTitle || '';
    if (titleEl.getAttribute('contenteditable') === 'true') titleEl.setAttribute('contenteditable', 'false');
  }

  function fallbackFromRail() {
    const active = document.querySelector('.rail-item.is-active');
    const t = active?.dataset?.title || active?.querySelector?.('.ri-title')?.textContent || '';
    if (!t) return;
    const titleEl = $('.ed-title');
    if (titleEl) {
      titleEl.textContent = t.trim();
      if (LAST_JOB) LAST_JOB.jobTitle = t.trim();
    }
  }

  function updateStatusIcons(status) {
    const wrap = $('.state._100'); if (!wrap) return;
    const map = {
      '.icon-error': ['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TOO_MANY_LANGUAGES_CODE'],
      '.icon-inprogress': ['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING'],
      '.icon-ready_summary_pending': ['READY_SUMMARY_PENDING'],
      '.icon-ready_summary_ready': ['READY_SUMMARY_READY'],
      '.icon-ready_summary_on_error': ['READY_SUMMARY_ON_ERROR'],
      '.icon-ready': ['READY', 'READY_TRANSCRIPT', 'READY_TEXT']
    };
    wrap.querySelectorAll('svg[class^="icon-"]').forEach((n) => { n.style.display = 'none'; });
    const up = String(status || '').toUpperCase();
    for (const sel in map) {
      if (map[sel].includes(up)) { const n = wrap.querySelector(sel); if (n) { n.style.display = 'block'; return; } }
    }
    const def = wrap.querySelector('.icon-ready'); if (def) def.style.display = 'block';
  }

  function closeAllDownloadPanels() {
    $$('.custom-element.options.is-open').forEach((box) => {
      box.classList.remove('is-open');
      const btn = box.querySelector('.download-link');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      const panel = box.querySelector('.download_link-options');
      if (panel) panel.style.display = 'none';
    });
  }

  function togglePanelFrom(el) {
    const box = el.closest('.custom-element.options');
    if (!box) return;

    const alreadyOpen = box.classList.contains('is-open');
    closeAllDownloadPanels();

    if (!alreadyOpen) {
      box.classList.add('is-open');
      const btn = box.querySelector('.download-link');
      if (btn) btn.setAttribute('aria-expanded', 'true');

      const panel = box.querySelector('.download_link-options');
      if (panel) {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
      }

      const first = box.querySelector('.download_link-options a[href]');
      if (first) first.focus({ preventScroll: true });
    }
  }

  function setupDownloadPanels() {
    $$('.custom-element.options').forEach((box) => {
      let linkBtn = null; let dotBtn = null;
      try { linkBtn = box.querySelector(':scope > .download-link'); } catch { linkBtn = box.querySelector('.download-link'); }
      try { dotBtn = box.querySelector(':scope > svg.icon-1x1-small.options'); } catch { dotBtn = box.querySelector('svg.icon-1x1-small.options'); }

      if (linkBtn) on(linkBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); togglePanelFrom(linkBtn); });
      if (dotBtn) on(dotBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); togglePanelFrom(dotBtn); });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-element.options')) closeAllDownloadPanels();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllDownloadPanels();
    });
  }

  function setDownloadLink(link, href, disabledMsg = '', opts = {}) {
    if (!link) return;

    if (link.__clickHandler) {
      link.removeEventListener('click', link.__clickHandler);
      link.__clickHandler = null;
    }

    if (!disabledMsg) {
      link.classList.remove('is-disabled', 'is-verifying');
      link.removeAttribute('aria-disabled');
      link.removeAttribute('title');
      link.style.pointerEvents = '';
      link.style.cursor = '';
      link.setAttribute('href', href);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      return;
    }

    const hard = opts.hard === true;

    link.classList.add('is-disabled');
    link.classList.remove('is-verifying');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('title', disabledMsg);
    link.style.cursor = 'not-allowed';

    if (hard) {
      link.style.pointerEvents = 'none';
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.removeAttribute('download');
    } else {
      link.style.pointerEvents = 'auto';
      link.setAttribute('href', '#');
      link.removeAttribute('target');
      link.removeAttribute('download');

      link.__clickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.alert(disabledMsg || 'Pas de compte-rendu disponible.');
      };
      link.addEventListener('click', link.__clickHandler);
    }
  }

  function setLinkVerifying(link, msg = 'Vérification…') {
    if (!link) return;
    link.classList.add('is-verifying');
    link.removeAttribute('download');
    link.setAttribute('href', '#');
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.removeAttribute('aria-disabled');
    link.title = msg;
    link.style.cursor = 'progress';
    link.style.pointerEvents = 'auto';
  }

  function statusGuardMessages(job) {
    const st = String(job?.transcriptStatus || '').toUpperCase();
    const err = job?.javaException || 'Erreur inconnue';
    const msgErr = `Le traitement a échoué : ${err}`;
    const msgWaitT = 'Le transcript est en cours, merci de patienter.';
    const msgWaitS = 'Le résumé n’est pas encore disponible, merci de patienter.';
    return { st, msgErr, msgWaitT, msgWaitS };
  }

  const _assetOkCache = new Map();

  async function verifyAssetOnce(jobId, url, key) {
    if (_assetOkCache.has(key)) return _assetOkCache.get(key);
    let ok = false;

    try {
      const r = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        headers: { Accept: 'application/octet-stream,application/pdf,application/msword,application/rtf,text/html;q=0.9,application/json;q=0.1' }
      });

      const cd = r.headers.get('content-disposition') || '';
      const ct = (r.headers.get('content-type') || '').toLowerCase();

      if (r.ok && (/attachment|filename=/i.test(cd) ||
          /(application\/pdf|msword|officedocument|rtf)/.test(ct))) {
        ok = true;
      } else {
        const text = await r.text().catch(() => '');

        let j = null; try { j = JSON.parse(text); } catch { /* ignore */ }
        if (j) {
          if (String(j.status).toUpperCase() === 'OK') ok = true;
          else ok = false;
        } else {
          if (/"status"\s*:\s*"KO"/i.test(text) || /error_summary_transcript_file_not_exists/i.test(text)) {
            ok = false;
          } else {
            ok = r.ok && (ct.includes('text/html') || text.trim().length > 0);
          }
        }
      }
    } catch { ok = false; }

    _assetOkCache.set(key, ok);
    return ok;
  }

  function guardClick(a, url, jobId, key, failMsg = 'Résumé indisponible.') {
    if (!a || a.__guarded) return;
    a.__guarded = true;

    a.addEventListener('click', async (e) => {
      if (a.getAttribute('href') && !a.hasAttribute('aria-disabled') && !a.classList.contains('is-verifying')) return;

      e.preventDefault(); e.stopPropagation();
      a.style.cursor = 'progress';
      const assetOk = await verifyAssetOnce(jobId, url, key);
      a.style.cursor = '';

      if (assetOk) {
        setDownloadLink(a, url);
        a.setAttribute('target', '_blank');
        window.open(url, '_blank', 'noopener');
      } else {
        setDownloadLink(a, '#', failMsg);
      }
    }, { passive: false });
  }

  function updateDownloadLinks(jobId, job) {
    if (!jobId || !AUTH.email || !AUTH.token) return;

    const isProPlus = !!window.AgiloGate?.allowed?.('pro');

    if (isProPlus) {
      document.querySelectorAll('.wrapper-message-pro.download, .icon-1x1-small.pro')
        .forEach((el) => { el.style.display = 'none'; });
    }

    const url = (fmt, type = 'text') =>
      `${API_BASE}/receive${type === 'summary' ? 'Summary' : 'Text'}?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(AUTH.email)}&token=${encodeURIComponent(AUTH.token)}&edition=${encodeURIComponent(AUTH.edition)}&format=${fmt}`;

    const { st, msgErr, msgWaitT, msgWaitS } = statusGuardMessages(job);

    ['txt', 'rtf', 'doc', 'docx', 'pdf'].forEach((fmt) => {
      const links = document.querySelectorAll(`.download_link-options a.download_wrapper-link_transcript_${fmt}`);
      links.forEach((a) => {
        if (a.closest('.wrapper-message-pro')) return;

        if (!isProPlus && (fmt === 'doc' || fmt === 'pdf')) {
          setDownloadLink(a, '#', 'Déverrouillez ces formats exclusifs avec la version Pro.');
        } else if (['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TRANSLATE_ON_ERROR'].includes(st)) {
          setDownloadLink(a, '#', msgErr);
        } else if (['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING'].includes(st)) {
          setDownloadLink(a, '#', msgWaitT);
        } else {
          setDownloadLink(a, url(fmt, 'text'));
          a.setAttribute('download', `transcript.${fmt}`);
        }
      });
    });

    const sum = [
      { c: 'html', f: 'html' }, { c: 'rtf', f: 'rtf' }, { c: 'docx', f: 'docx' }, { c: 'doc', f: 'doc' }, { c: 'pdf', f: 'pdf' }, { c: 'txt', f: 'html' }
    ];
    sum.forEach(({ c, f }) => {
      const links = document.querySelectorAll(`.download_link-options a.download_wrapper-link_summary_${c}`);
      links.forEach((a) => {
        if (a.closest('.wrapper-message-pro')) return;

        if (!isProPlus && (c === 'doc' || c === 'pdf')) {
          setDownloadLink(a, '#', 'Déverrouillez ces formats exclusifs avec la version Pro.');
          return;
        }

        const guard = statusGuardMessages(job);

        if (['READY_SUMMARY_ON_ERROR', 'ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS'].includes(guard.st)) {
          setDownloadLink(a, '#', `Le résumé n'est pas disponible${job?.javaException ? ` : ${job.javaException}` : ''}`);
          return;
        }

        if (['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING', 'READY_SUMMARY_PENDING'].includes(guard.st)) {
          setDownloadLink(a, '#', guard.msgWaitS);
          return;
        }

        if (guard.st === 'READY_SUMMARY_READY') {
          const u = url(f, 'summary');
          const key = `${jobId}|${c}|summary|${String(AUTH.edition || '')}`;

          setLinkVerifying(a, 'Vérification…');

          guardClick(a, u, jobId, key, 'Résumé indisponible.');

          verifyAssetOnce(jobId, u, key).then((ok) => {
            if (ok) {
              setDownloadLink(a, u);
              a.setAttribute('download', `summary.${c === 'txt' ? 'html' : c}`);
            } else {
              setDownloadLink(a, '#', 'Résumé indisponible.');
            }
          });
          return;
        }

        setDownloadLink(a, '#', 'Résumé indisponible.');
      });
    });
  }

  function setupRename() {
    const titleEl = $('.ed-title');
    const btn = $('.ed-rename, [data-rename-file]');
    if (!titleEl || !btn) return;

    on(btn, 'click', () => {
      if (titleEl.__editing) return;
      titleEl.__editing = true;

      const input = document.createElement('input');
      input.type = 'text';
      input.value = (LAST_JOB ? displayJobTitle(LAST_JOB) : '') || titleEl.textContent.trim();
      input.placeholder = 'Titre affiché';
      input.className = 'ed-title-input';
      input.style.cssText = 'font:inherit;border:1px solid #343a4040;border-radius:6px;padding:4px 8px;min-width:12ch;';

      titleEl.replaceWith(input);
      input.focus(); input.select();

      const cleanup = () => { input.replaceWith(titleEl); titleEl.__editing = false; };

      const commit = async () => {
        const typed = sanitizeFilename(input.value);
        const prevDisplay = LAST_JOB ? displayJobTitle(LAST_JOB) : (titleEl.textContent || '').trim();
        if (!typed || typed === prevDisplay) { cleanup(); return; }

        const jobId = getJobId();
        if (!jobId) { toast('Job ID introuvable'); cleanup(); return; }

        const res = await apiRenameTitle(jobId, typed, AUTH);
        if (res.ok) {
          if (LAST_JOB) LAST_JOB.jobTitle = typed;
          else LAST_JOB = { jobTitle: typed, filename: CURRENT.full, transcriptStatus: '' };
          applyHeaderFromJob(LAST_JOB);
          const active = document.querySelector('.rail-item.is-active .ri-title');
          if (active) active.textContent = typed;
          const railItem = document.querySelector('.rail-item.is-active');
          if (railItem) railItem.dataset.title = typed;
          toast('Titre mis à jour ✓');
        } else {
          toast(res.error || 'Erreur de renommage', 3600);
        }
        cleanup();
      };

      on(input, 'keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { e.preventDefault(); cleanup(); } });
      on(input, 'blur', commit);
    });
  }

  function setupExport() {
    const btn = document.getElementById('exportBtn'); if (!btn) return;
    on(btn, 'click', async () => {
      const jobId = getJobId(); if (!jobId) return toast('Job ID introuvable');
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      const txt0 = btn.textContent; btn.textContent = 'Génération…';
      const r = await apiShare(jobId, AUTH);
      btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = txt0;
      if (!r.ok) return toast(r.error || 'Erreur export', 3200);
      const shareUrl = r.url.endsWith('-download') ? r.url : `${r.url}-download`;
      const ifr = document.createElement('iframe'); ifr.style.display = 'none'; ifr.src = shareUrl; document.body.appendChild(ifr);
      setTimeout(() => ifr.remove(), 10000);
      toast('Téléchargement lancé ✓');
    });
  }

  const ERROR_TRANSLATIONS = {
    error_no_webhook_configured: {
      title: 'Aucun webhook configuré',
      explain: 'Pour renvoyer l’automatisation, vous devez d’abord configurer un webhook.',
      next: 'Configurer un webhook',
      link: (() => {
        const m = location.pathname.match(/^\/app\/([^/]+)/); const tier = m ? m[1] : 'business';
        return `/app/${tier}/profile#integrations`;
      })()
    },
    error_invalid_automation_provider: {
      title: 'Fournisseur d’automatisation invalide',
      explain: 'Le provider transmis (Make/Zapier/n8n) n’a pas été trouvé.',
      tip: 'Vérifiez « Automation Provider » (MAKE/ZAPIER/N8N) ou laissez vide pour auto-détection.'
    },
    error_transcript_not_ready: {
      title: 'Transcript non prêt',
      explain: 'Aucun transcript à l’état READY (ou fichiers supprimés).',
      tip: 'Attendez la fin du traitement puis rechargez la page.'
    }
  };

  function translateError(code, raw) {
    const t = ERROR_TRANSLATIONS[code];
    return t ? { ...t, raw } : { title: 'Erreur inconnue', explain: 'Une erreur est survenue.', tip: 'Réessayez plus tard.', raw };
  }

  function setupWebhook() {
    const btn = document.getElementById('resendWebhookBtn'); if (!btn) return;
    if (!window.AgiloGate?.allowed?.('ent')) {
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.AgiloGate?.showUpgrade('ent', 'Webhooks'); }, { capture: true });
      return;
    }
    on(btn, 'click', async () => {
      const jobId = getJobId(); if (!jobId) return toast('Job ID introuvable');
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      const lbl = btn.querySelector('div'); const txt0 = lbl?.textContent; if (lbl) lbl.textContent = 'Envoi…';

      const providerVal = document.getElementById('automationProvider')?.value?.trim() || '';
      const r = await apiWebhook(jobId, AUTH, providerVal);

      btn.disabled = false; btn.removeAttribute('aria-busy'); if (lbl) lbl.textContent = txt0 || 'Renvoyer Webhook';
      if (r.ok) return toast('Webhook renvoyé ✓');

      const tr = translateError(r.code, r.raw);
      showDialog({
        title: 'Renvoi du webhook',
        subtitle: '0 OK, 1 échec.',
        blocks: [{
          heading: tr.title,
          text: tr.explain + (tr.tip ? `<div style="margin-top:6px;color:#525252">${tr.tip}</div>` : ''),
          details: `jobId=${jobId}\n${tr.raw || r.code || 'Erreur'}`
        }]
      });
    });
  }

  function setupDelete() {
    const btn = document.querySelector('#bulkDeleteBtn, .delete-job-button, .delete-job-button_to-confirm');
    if (!btn) return;
    on(btn, 'click', () => {
      const jobId = getJobId(); if (!jobId) return toast('Job ID introuvable');
      const popup = document.querySelector('.popup-container');
      if (popup) {
        popup.style.display = 'flex';
        const ok = document.querySelector('.delete-job-button_confirmed');
        if (ok) {
          ok.onclick = async () => {
            const r = await apiDelete(jobId, AUTH);
            popup.style.display = 'none';
            if (r.ok) { toast('Supprimé ✓'); setTimeout(() => { location.href = '/app/business/mes-transcripts'; }, 900); }
            else { toast(r.error || 'Erreur de suppression', 3200); }
          };
        }
      } else if (window.confirm('Supprimer ce transcript ?')) {
        apiDelete(jobId, AUTH).then((r) => {
          if (r.ok) { toast('Supprimé ✓'); setTimeout(() => { location.href = '/app/business/mes-transcripts'; }, 900); }
          else toast(r.error || 'Erreur', 3200);
        });
      }
    });
  }

  async function refreshHeader(jobId) {
    if (!jobId) return;
    const job = await apiGetJob(jobId, AUTH);
    LAST_JOB = job || null;

    if (job && (job.filename || job.jobTitle)) {
      applyHeaderFromJob(job);
      updateStatusIcons(job.transcriptStatus);
    } else {
      fallbackFromRail();
    }
    updateDownloadLinks(jobId, job || {});
    closeAllDownloadPanels();
  }

  async function init() {
    injectTheme();
    setupDownloadPanels();

    closeAllDownloadPanels();
    document.querySelectorAll('.custom-element.options > .download-link').forEach((btn) => {
      if (!btn.getAttribute('href')) btn.setAttribute('href', '#');
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanelFrom(btn); }
      });
    });

    AUTH = await ensureAuth();
    const jobId = getJobId();
    if (!jobId) { console.warn('[Header] Aucun jobId'); return; }

    await refreshHeader(jobId);
    setupRename();
    setupExport();
    setupWebhook();
    setupDelete();
  }

  window.addEventListener('agilo:load', (e) => {
    const id = e.detail?.jobId; if (id) refreshHeader(id);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
