// Agilotext — liste dossiers dans la nav (sous Transcriptions), repli <details> par défaut
// ⚠️ Charger après getToken / agilotext:token.
//
// Webflow — #agilo-nav-folders-root (attributs personnalisés) :
//   Placer la <div id="agilo-nav-folders-root"> AVANT les <script> GitHub (sinon init différée 10 s max).
//   Liste « Mes transcriptions » : le filtre dossier est souvent dans le JS inline Webflow (__selectedFolderFilter).
//   Synchroniser avec ?folderId= : voir scripts/pages/dashboard/Code-mes-transcripts-folder-url-bridge.js + commentaires en tête de ce fichier.
//   data-link-class, data-summary-class, data-agilo-folders-start, data-base-href
//   data-agilo-folder-palette="--color--blue,--color--orange,..." (optionnel, virgules)
//   data-agilo-folder-accent-mode="hash" | "sequence"
//     — hash (défaut) : couleur stable par folderId, palette répétée en boucle (illimité)
//     — sequence : couleur par position dans la liste (1er = 1re teinte, …)
//   data-row-structure="match-nav" → DOM type menu (icon-small, readycount)
//   data-icon-class, data-name-class, data-count-class → surcharges classes match-nav

(function () {
  'use strict';

  /** Toujours présent si ce fichier est parsé (évite « undefined » en console ; refresh réel après init). */
  try {
    window.__agiloNavFolders = Object.assign(
      { version: '1.5.1', refresh: function () {} },
      window.__agiloNavFolders || {}
    );
  } catch (_) {}

  function runNavFoldersApp() {
  const byId = (id) => document.getElementById(id);
  const $ = (s, r = document) => r.querySelector(s);

  const mount = byId('agilo-nav-folders-root');
  if (!mount) return;
  if (mount.getAttribute('data-agilo-nav-folders-bound') === '1') return;

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const EDITION_FALLBACK = 'ent';

  const dbg = (...a) => window.AGILO_DEBUG && console.debug('[NavFolders]', ...a);

  function normalizeEdition(v) {
    v = String(v || '').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return EDITION_FALLBACK;
  }

  function getEdition() {
    const fromQS = new URLSearchParams(location.search).get('edition');
    const fromRoot = byId('editorRoot')?.dataset?.edition;
    const fromHtml = document.documentElement?.getAttribute('data-edition');
    const fromLS = localStorage.getItem('agilo:edition');
    return normalizeEdition(fromQS || fromRoot || fromHtml || fromLS || EDITION_FALLBACK);
  }

  function tokenKey(email, edition) {
    return `agilo:token:${normalizeEdition(edition)}:${String(email || '').toLowerCase()}`;
  }

  /**
   * Script inline Agilotext : `let globalToken` + dispatch `agilotext:token` (pas `window.globalToken`).
   * try/catch : TDZ si ce script s’exécute avant l’init du jeton.
   */
  function readBootstrapGlobalToken() {
    try {
      if (globalToken) return String(globalToken);
    } catch (_) {}
    return '';
  }

  function readAuthSnapshot() {
    const edition = getEdition();
    const email =
      byId('editorRoot')?.dataset?.username ||
      byId('memberEmail')?.value ||
      $('[name="memberEmail"]')?.value ||
      $('input#memberEmail')?.value ||
      $('input#email')?.value ||
      $('input[type="email"]')?.value ||
      $('[data-ms-member-email]')?.getAttribute?.('data-ms-member-email') ||
      $('[data-member-email]')?.getAttribute?.('data-member-email') ||
      localStorage.getItem('agilo:username') ||
      localStorage.getItem('memberEmail') ||
      window.memberEmail ||
      '';
    const token =
      byId('editorRoot')?.dataset?.token ||
      readBootstrapGlobalToken() ||
      (typeof window.globalToken === 'string' ? window.globalToken : '') ||
      localStorage.getItem(tokenKey(String(email || '').trim(), edition)) ||
      localStorage.getItem('agilo:token') ||
      '';
    return { username: String(email || '').trim(), token: String(token || ''), edition };
  }

  function waitForTokenEvent(timeoutMs, wantEmail, wantEdition) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let done = false;
      const finish = (res) => {
        if (!done) {
          done = true;
          resolve(res);
        }
      };
      const onEvt = (e) => {
        const d = e?.detail || {};
        const okEmail = wantEmail
          ? String(d.email || '').toLowerCase() === String(wantEmail || '').toLowerCase()
          : true;
        const okEd = wantEdition ? normalizeEdition(d.edition) === normalizeEdition(wantEdition) : true;
        if (d.token && okEmail && okEd) {
          removeTokenListeners(onEvt);
          const post = readAuthSnapshot();
          finish({
            username: String(d.email || d.username || post.username || '').trim(),
            token: String(d.token || post.token || ''),
            edition: normalizeEdition(d.edition || post.edition)
          });
        }
      };
      function removeTokenListeners(handler) {
        window.removeEventListener('agilo:token', handler);
        window.removeEventListener('agilotext:token', handler);
      }
      window.addEventListener('agilo:token', onEvt, { passive: true });
      window.addEventListener('agilotext:token', onEvt, { passive: true });
      (function loop() {
        if (done) return;
        const snap = readAuthSnapshot();
        if (snap.username && snap.token) {
          removeTokenListeners(onEvt);
          finish(snap);
          return;
        }
        if (performance.now() - t0 > timeoutMs) {
          removeTokenListeners(onEvt);
          finish(readAuthSnapshot());
          return;
        }
        requestAnimationFrame(loop);
      })();
    });
  }

  async function ensureAuth(timeoutMs = 12000) {
    const snap = readAuthSnapshot();
    if (snap.username && snap.token) return snap;
    if (!snap.token && snap.username && typeof window.getToken === 'function') {
      try {
        window.getToken(snap.username, snap.edition);
      } catch {}
    }
    const final = await waitForTokenEvent(timeoutMs, snap.username, snap.edition);
    const post = readAuthSnapshot();
    return {
      username: String(final.username || snap.username || post.username || '').trim(),
      token: String(final.token || snap.token || post.token || ''),
      edition: final.edition || snap.edition || post.edition
    };
  }

  function folderDtoJobsCount(f) {
    const v =
      f.jobsCount ??
      f.count ??
      f.jobCount ??
      f.nbJobs ??
      f.totalJobs ??
      f.jobs_count ??
      f.numJobs ??
      f.numberOfJobs;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function fetchTranscriptFoldersList(auth) {
    const url = `${API_BASE}/getTranscriptFolders?username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
    let resp;
    try {
      resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      dbg('getTranscriptFolders network', e);
      return { rootJobsCount: 0, folders: [] };
    }
    if (!resp.ok) return { rootJobsCount: 0, folders: [] };
    const j = await resp.json().catch(() => null);
    if (!j || String(j.status).toUpperCase() !== 'OK') return { rootJobsCount: 0, folders: [] };
    const rawList = j.folders || j.transcriptFolderDtos || j.transcriptFolders || j.folderDtos || [];
    const folders = (Array.isArray(rawList) ? rawList : [])
      .map((f) => ({
        folderId: Number(f.folderId != null ? f.folderId : f.id) || 0,
        folderName: String(f.folderName != null ? f.folderName : f.name || '').trim(),
        jobsCount: folderDtoJobsCount(f)
      }))
      .filter((f) => f.folderId > 0 && f.folderName);
    const rootJobsCount = Number(j.rootJobsCount != null ? j.rootJobsCount : j.rootCount) || 0;
    return { rootJobsCount, folders };
  }

  function mapJobsInfoDtos(j) {
    if (!j || String(j.status).toUpperCase() !== 'OK' || !Array.isArray(j.jobsInfoDtos)) return [];
    return j.jobsInfoDtos.map((x) => ({
      folderId: x.folderId != null ? Number(x.folderId) : 0
    }));
  }

  async function fetchJobsInfoAll(auth, retried = false) {
    const url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}&limit=200&offset=0`;
    let resp;
    try {
      resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      dbg('getJobsInfo network', e);
      return [];
    }
    if ((resp.status === 401 || resp.status === 403) && !retried && auth.username && typeof window.getToken === 'function') {
      try {
        window.getToken(auth.username, auth.edition);
      } catch {}
      const a2 = await ensureAuth(8000);
      if (a2.token) return fetchJobsInfoAll(a2, true);
    }
    if (!resp.ok) return [];
    const j = await resp.json().catch(() => null);
    return mapJobsInfoDtos(j);
  }

  function deriveFolderCountsFromJobs(jobs) {
    let rootJobsCount = 0;
    const byFolder = new Map();
    if (!Array.isArray(jobs)) return { rootJobsCount, byFolder };
    jobs.forEach((j) => {
      const fid = Number(j.folderId);
      if (!Number.isFinite(fid) || fid < 0) return;
      if (fid === 0) rootJobsCount++;
      else byFolder.set(fid, (byFolder.get(fid) || 0) + 1);
    });
    return { rootJobsCount, byFolder };
  }

  function mergeFoldersCacheWithDerived(cache, derived) {
    const apiRoot = Number(cache?.rootJobsCount) || 0;
    const mergedRoot = Math.max(apiRoot, derived.rootJobsCount);
    const doLog = window.AGILO_DEBUG;
    if (doLog && mergedRoot > apiRoot) {
      console.debug('[NavFolders] rootJobsCount API', apiRoot, 'dérivé', derived.rootJobsCount, '→', mergedRoot);
    }
    const folders = (Array.isArray(cache?.folders) ? cache.folders : []).map((f) => {
      const fid = Number(f.folderId);
      const api = Number(f.jobsCount) || 0;
      const d = Number.isFinite(fid) && fid > 0 ? derived.byFolder.get(fid) || 0 : 0;
      const m = Math.max(api, d);
      if (doLog && m > api) {
        console.debug('[NavFolders] dossier', f.folderName, fid, 'API', api, 'dérivé', d, '→', m);
      }
      return { ...f, jobsCount: m };
    });
    return { rootJobsCount: mergedRoot, folders };
  }

  const ACCENT_ALL =
    'var(--color--blue, var(--agilo-primary, #174a96))';
  const ACCENT_ROOT =
    'var(--color--gris, var(--agilo-dim, #525252))';

  const DEFAULT_FOLDER_PALETTE = [
    'var(--color--blue, var(--agilo-primary, #174a96))',
    'var(--color--orange, #fd7e14)',
    'var(--color--vert, #1c661a)',
    'var(--color--rouge, #a82633)'
  ];

  function normalizePaletteToken(t) {
    t = String(t || '').trim();
    if (!t) return null;
    if (/^--[a-zA-Z0-9_-]+$/.test(t)) return `var(${t})`;
    return t;
  }

  function getFolderPalette() {
    const raw = mount.getAttribute('data-agilo-folder-palette');
    if (raw == null || !String(raw).trim()) return DEFAULT_FOLDER_PALETTE.slice();
    const parts = String(raw)
      .split(',')
      .map((s) => normalizePaletteToken(s))
      .filter(Boolean);
    return parts.length ? parts : DEFAULT_FOLDER_PALETTE.slice();
  }

  function getFolderAccentMode() {
    const v = String(mount.getAttribute('data-agilo-folder-accent-mode') || 'hash')
      .trim()
      .toLowerCase();
    if (v === 'sequence' || v === 'order' || v === 'list') return 'sequence';
    return 'hash';
  }

  /** Couleur d’icône dossier : palette charte, répétée en boucle (nombre de dossiers illimité) */
  function folderAccentForId(folderId, palette) {
    const pal = palette && palette.length ? palette : DEFAULT_FOLDER_PALETTE;
    let h = 0;
    const s = String(folderId);
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return pal[Math.abs(h) % pal.length];
  }

  function folderAccentForListIndex(listIndex, palette) {
    const pal = palette && palette.length ? palette : DEFAULT_FOLDER_PALETTE;
    const i = Math.max(0, Number(listIndex) || 0);
    return pal[i % pal.length];
  }

  function pickFolderAccent(folderId, listIndex, palette, mode) {
    if (mode === 'sequence') return folderAccentForListIndex(listIndex, palette);
    return folderAccentForId(folderId, palette);
  }

  /** Segment après /app/ (free, pro, business, …) — aligné Code-ed-header / profil */
  function getAppTierFromLocation() {
    const m = location.pathname.match(/^\/app\/([^/]+)/);
    return m ? m[1] : null;
  }

  function resolveBaseHref() {
    const raw = mount.getAttribute('data-base-href');
    if (raw != null && String(raw).trim() !== '') {
      try {
        return new URL(String(raw).trim(), location.origin).pathname;
      } catch {
        /* fallthrough */
      }
    }
    const tier = getAppTierFromLocation();
    if (tier) {
      return `/app/${tier}/mes-transcripts`;
    }
    const navLink = $('a[href*="mes-transcripts"]');
    if (navLink) {
      try {
        return new URL(navLink.getAttribute('href'), location.origin).pathname;
      } catch {}
    }
    return '/app/business/mes-transcripts';
  }

  function hrefForFilter(basePath, filter) {
    const u = new URL(basePath, location.origin);
    const ed = new URLSearchParams(location.search).get('edition');
    if (ed) u.searchParams.set('edition', ed);
    if (filter === 'all') {
      u.searchParams.delete('folderId');
    } else if (filter === 'root') {
      u.searchParams.set('folderId', '0');
    } else {
      u.searchParams.set('folderId', String(filter));
    }
    return u.pathname + u.search;
  }

  function mesTranscriptsPathname() {
    return resolveBaseHref();
  }

  function currentFilterFromUrl() {
    if (location.pathname !== mesTranscriptsPathname()) return null;
    const q = new URLSearchParams(location.search).get('folderId');
    if (q === null || q === '') return 'all';
    const n = Number(q);
    if (!Number.isFinite(n)) return 'all';
    if (n === 0) return 'root';
    return n;
  }

  /** Repli par défaut ; `auto` = ouvrir si un folderId est dans l’URL (page Mes transcripts). */
  function shouldDetailsStartOpen() {
    const v = (mount.getAttribute('data-agilo-folders-start') || 'closed').trim().toLowerCase();
    if (v === 'open') return true;
    if (v === 'closed') return false;
    if (location.pathname !== mesTranscriptsPathname()) return false;
    const q = new URLSearchParams(location.search).get('folderId');
    return q !== null && q !== '';
  }

  function extraClasses(attr) {
    return String(mount.getAttribute(attr) || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
  }

  const FOLDER_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"/></svg>';
  const STACK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z"/></svg>';
  const ROOT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z"/></svg>';

  let __loading = false;

  function renderLoading() {
    mount.innerHTML = '';
    mount.removeAttribute('hidden');
    const details = document.createElement('details');
    details.className = 'agilo-nav-folders-details';
    const sum = document.createElement('summary');
    sum.className = ['agilo-nav-folders__summary', extraClasses('data-summary-class')].filter(Boolean).join(' ');
    sum.innerHTML =
      '<span class="agilo-nav-folders__summary-text">Dossiers</span><span class="agilo-nav-folders__chev" aria-hidden="true"></span>';
    const inner = document.createElement('div');
    inner.className = 'agilo-nav-folders agilo-nav-folders--loading';
    inner.setAttribute('role', 'status');
    inner.innerHTML = '<div class="agilo-nav-folders__placeholder">Chargement…</div>';
    details.appendChild(sum);
    details.appendChild(inner);
    mount.appendChild(details);
  }

  function renderError(msg) {
    mount.innerHTML = '';
    mount.removeAttribute('hidden');
    const details = document.createElement('details');
    details.className = 'agilo-nav-folders-details';
    const sum = document.createElement('summary');
    sum.className = ['agilo-nav-folders__summary', extraClasses('data-summary-class')].filter(Boolean).join(' ');
    sum.innerHTML =
      '<span class="agilo-nav-folders__summary-text">Dossiers</span><span class="agilo-nav-folders__chev" aria-hidden="true"></span>';
    const inner = document.createElement('div');
    inner.className = 'agilo-nav-folders';
    inner.innerHTML = `<div class="agilo-nav-folders__empty">${msg}</div>`;
    details.appendChild(sum);
    details.appendChild(inner);
    mount.appendChild(details);
  }

  function renderMerged(auth, merged, totalAll, jobsDerived) {
    try {
      renderMergedInner(auth, merged, totalAll, jobsDerived);
    } catch (e) {
      dbg('renderMerged', e);
      renderError('Affichage des dossiers impossible.');
    }
  }

  function renderMergedInner(auth, merged, totalAll, jobsDerived) {
    const basePath = resolveBaseHref();
    const active = currentFilterFromUrl();

    mount.innerHTML = '';
    mount.removeAttribute('hidden');

    const details = document.createElement('details');
    details.className = 'agilo-nav-folders-details';
    if (shouldDetailsStartOpen()) details.setAttribute('open', '');

    const sum = document.createElement('summary');
    sum.className = ['agilo-nav-folders__summary', extraClasses('data-summary-class')].filter(Boolean).join(' ');
    sum.innerHTML =
      '<span class="agilo-nav-folders__summary-text">Dossiers</span><span class="agilo-nav-folders__chev" aria-hidden="true"></span>';

    const nav = document.createElement('nav');
    nav.className = 'agilo-nav-folders';
    nav.setAttribute('aria-label', 'Dossiers transcriptions');

    const useMatchNav = mount.getAttribute('data-row-structure') === 'match-nav';
    const nameExtra = extraClasses('data-name-class');
    const countExtra = extraClasses('data-count-class');
    const iconExtra = extraClasses('data-icon-class');

    const list = document.createElement('div');
    list.className = ['agilo-nav-folders__list', useMatchNav ? 'agilo-nav-folders__list--match-nav' : '']
      .filter(Boolean)
      .join(' ');

    const linkExtra = extraClasses('data-link-class');
    const folderPalette = getFolderPalette();
    const accentMode = getFolderAccentMode();

    function addRow(filter, label, count, iconHtml, accentCss) {
      const isFolderRow = typeof filter === 'number' && Number.isFinite(filter);
      const a = document.createElement('a');
      a.className = [
        'agilo-nav-folders__row',
        linkExtra,
        useMatchNav ? 'agilo-nav-folders__row--match-nav' : '',
        isFolderRow ? 'agilo-nav-folders__row--folder' : ''
      ]
        .filter(Boolean)
        .join(' ');
      a.href = hrefForFilter(basePath, filter);
      a.dataset.filter =
        filter === 'all' || filter === 'root' ? filter : String(Number(filter));
      if (accentCss) a.style.setProperty('--agilo-folder-accent', accentCss);
      else a.style.removeProperty('--agilo-folder-accent');

      const isAct =
        active !== null &&
        (filter === active ||
          (filter === 'all' && active === 'all') ||
          (filter === 'root' && active === 'root') ||
          (typeof filter === 'number' && typeof active === 'number' && filter === active));
      if (isAct) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }

      if (useMatchNav) {
        const iconWrapClass = iconExtra
          ? ['agilo-nav-folders__icon-wrap', iconExtra].filter(Boolean).join(' ')
          : ['icon-small', 'w-embed', 'agilo-nav-folders__icon-wrap'].join(' ');
        const nameClasses = ['agilo-nav-folders__name', nameExtra].filter(Boolean).join(' ');
        const countClasses = ['readycount', 'agilo-nav-folders__count', countExtra].filter(Boolean).join(' ');
        a.innerHTML = `<div class="${iconWrapClass}">${iconHtml}</div><div class="${nameClasses}"></div><span class="${countClasses}"></span>`;
      } else {
        a.innerHTML = `<span class="agilo-nav-folders__icon">${iconHtml}</span><span class="agilo-nav-folders__name"></span><span class="agilo-nav-folders__count"></span>`;
      }
      const nameEl = a.querySelector('.agilo-nav-folders__name');
      const countEl = a.querySelector('.agilo-nav-folders__count');
      if (nameEl) nameEl.textContent = label;
      if (countEl) countEl.textContent = String(count);
      list.appendChild(a);
    }

    const rootCount = merged.rootJobsCount;
    addRow('all', 'Tous les fichiers', totalAll, STACK_SVG, ACCENT_ALL);
    addRow('root', 'Non classé', rootCount, ROOT_SVG, ACCENT_ROOT);

    merged.folders.forEach((f, idx) => {
      const accent = pickFolderAccent(f.folderId, idx, folderPalette, accentMode);
      addRow(Number(f.folderId), f.folderName, f.jobsCount, FOLDER_SVG, accent);
    });

    nav.appendChild(list);
    details.appendChild(sum);
    details.appendChild(nav);
    mount.appendChild(details);

    try {
      window.dispatchEvent(new CustomEvent('agilo:nav-folders-rendered', { detail: { auth: !!auth.token } }));
    } catch {}

    dbg('rendu', merged.folders.length, 'dossiers, total liste', totalAll);
  }

  async function load() {
    if (__loading) return;
    __loading = true;
    renderLoading();
    try {
      let auth = await ensureAuth(12000);
      const snapLate = readAuthSnapshot();
      auth = {
        username: (auth.username || snapLate.username || '').trim(),
        token: (auth.token || snapLate.token || '').trim(),
        edition: auth.edition || snapLate.edition
      };
      if (!auth.username || !auth.token) {
        mount.setAttribute('hidden', '');
        mount.innerHTML = '';
        __loading = false;
        return;
      }

      const [foldersData, jobsRows] = await Promise.all([fetchTranscriptFoldersList(auth), fetchJobsInfoAll(auth)]);
      const derived = deriveFolderCountsFromJobs(jobsRows);
      const merged = mergeFoldersCacheWithDerived(foldersData, derived);
      const totalAll = Array.isArray(jobsRows) ? jobsRows.length : 0;

      renderMerged(auth, merged, totalAll, derived);
    } catch (e) {
      dbg(e);
      renderError('Dossiers indisponibles pour le moment.');
    } finally {
      __loading = false;
    }
  }

  function updateActiveRowsOnly() {
    const nav = mount.querySelector('.agilo-nav-folders__list');
    if (!nav) return;
    const active = currentFilterFromUrl();
    nav.querySelectorAll('.agilo-nav-folders__row').forEach((el) => {
      const f = el.dataset.filter;
      let match = false;
      if (active !== null) {
        if (f === 'all' && active === 'all') match = true;
        else if (f === 'root' && active === 'root') match = true;
        else if (f !== 'all' && f !== 'root' && typeof active === 'number' && Number(f) === active) {
          match = true;
        }
      }
      el.classList.toggle('is-active', match);
      if (match) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  window.__agiloNavFolders.refresh = load;

  window.addEventListener('agilo:token', () => load(), { passive: true });
  window.addEventListener('agilotext:token', () => load(), { passive: true });
  window.addEventListener('popstate', () => {
    updateActiveRowsOnly();
    try {
      window.dispatchEvent(new CustomEvent('agilo:nav-folder-url-changed'));
    } catch (_) {}
  }, { passive: true });

  function scheduleFirstLoad() {
    const run = function () {
      setTimeout(load, 150);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }
  scheduleFirstLoad();

  try {
    mount.setAttribute('data-agilo-nav-folders-bound', '1');
    window.__agiloNavFolders.version = '1.5.1';
  } catch (_) {}
  }

  function scheduleNavFolders() {
    if (document.getElementById('agilo-nav-folders-root')) {
      runNavFoldersApp();
      return;
    }
    var attempts = 0;
    var tid = setInterval(function () {
      if (document.getElementById('agilo-nav-folders-root')) {
        clearInterval(tid);
        runNavFoldersApp();
      } else if (++attempts > 100) {
        clearInterval(tid);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleNavFolders, { once: true });
  } else {
    scheduleNavFolders();
  }
})();
