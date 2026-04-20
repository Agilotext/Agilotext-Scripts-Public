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
//   data-folder-name-max="14" → longueur max affichée des noms de dossier (4–80, défaut 14) + ellipse CSS

(function () {
  'use strict';

  /** Toujours présent si ce fichier est parsé (évite « undefined » en console ; refresh réel après init). */
  try {
    window.__agiloNavFolders = Object.assign(
      { version: '1.7.7', refresh: function () {} },
      window.__agiloNavFolders || {}
    );
  } catch (_) {}

  function runNavFoldersApp() {
  const byId = (id) => document.getElementById(id);
  const $ = (s, r = document) => r.querySelector(s);

  const mount = byId('agilo-nav-folders-root');
  if (!mount) return;
  if (mount.getAttribute('data-agilo-nav-folders-bound') === '1') return;

  const APP_VERSION = '1.7.7';
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

  function readValueFromEl(el) {
    if (!el) return '';
    return String(
      el.value ??
      el.getAttribute?.('value') ??
      el.getAttribute?.('src') ??
      el.getAttribute?.('data-ms-member-email') ??
      el.getAttribute?.('data-member-email') ??
      el.textContent ??
      ''
    ).trim();
  }

  function readFirstNonEmpty(selList) {
    for (let i = 0; i < selList.length; i++) {
      const el = $(selList[i]);
      const v = readValueFromEl(el);
      if (v) return v;
    }
    return '';
  }

  function findAnyAgiloTokenInStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k === 'agilo:token' || k.indexOf('agilo:token:') === 0) {
          const v = String(localStorage.getItem(k) || '').trim();
          if (v) return v;
        }
      }
    } catch (_) {}
    return '';
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
      readValueFromEl(byId('memberEmail')) ||
      readFirstNonEmpty([
        '[name="memberEmail"]',
        'input#memberEmail',
        '#email',
        'input[type="email"]',
        '[data-ms-member-email]',
        '[data-member-email]',
        '[data-ms-member="email"]',
        '.memberemail'
      ]) ||
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
      findAnyAgiloTokenInStorage() ||
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

  async function postForm(endpoint, fields) {
    const body = new URLSearchParams(fields);
    let resp;
    try {
      resp = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (e) {
      return { ok: false, error: e?.message || 'réseau' };
    }
    const raw = await resp.text();
    let j = null;
    try {
      j = JSON.parse(raw);
    } catch (_) {
      return { ok: false, error: raw || 'réponse invalide' };
    }
    if (j && String(j.status).toUpperCase() === 'OK') return { ok: true, data: j };
    const msg = j?.message || j?.errorMessage || j?.userErrorMessage || j?.error || 'Erreur API';
    return { ok: false, error: String(msg), data: j };
  }

  async function createFolder(auth, folderName) {
    return postForm('createTranscriptFolder', {
      username: auth.username,
      token: auth.token,
      edition: auth.edition,
      folderName: String(folderName || '').trim()
    });
  }

  async function renameFolder(auth, folderId, newName) {
    const cleanName = String(newName || '').trim();
    const candidates = [
      'renameTranscriptFolder',
      'renameTranscriptFolderName',
      'updateTranscriptFolder',
      'updateTranscriptFolderName'
    ];
    for (let i = 0; i < candidates.length; i++) {
      const endpoint = candidates[i];
      const res = await postForm(endpoint, {
        username: auth.username,
        token: auth.token,
        edition: auth.edition,
        folderId: String(folderId),
        folderName: cleanName,
        newFolderName: cleanName,
        name: cleanName
      });
      if (res.ok) return res;
      if ((res.error || '').toLowerCase().includes('invalid token')) return res;
    }
    return { ok: false, error: 'Renommage dossier non disponible (API).' };
  }

  async function fetchTranscriptFoldersList(auth, retried = false) {
    const url = `${API_BASE}/getTranscriptFolders?username=${encodeURIComponent(auth.username)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
    let resp;
    try {
      resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      dbg('getTranscriptFolders network', e);
      return { rootJobsCount: 0, folders: [] };
    }
    if ((resp.status === 401 || resp.status === 403) && !retried && auth.username && typeof window.getToken === 'function') {
      try {
        window.getToken(auth.username, auth.edition);
      } catch {}
      const a2 = await ensureAuth(8000);
      if (a2.token) return fetchTranscriptFoldersList(a2, true);
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
    const v = String(mount.getAttribute('data-agilo-folder-accent-mode') || 'auto')
      .trim()
      .toLowerCase();
    if (v === 'sequence' || v === 'order' || v === 'list') return 'sequence';
    if (v === 'palette' || v === 'palette-hash') return 'palette';
    return 'auto';
  }

  function stableHash(value) {
    let h = 0;
    const s = String(value == null ? '' : value);
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function folderAccentForIdPalette(folderId, palette) {
    const pal = palette && palette.length ? palette : DEFAULT_FOLDER_PALETTE;
    return pal[stableHash(folderId) % pal.length];
  }

  /** Couleur d’icône dossier : génération HSL stable (illimitée) */
  function folderAccentForIdAuto(folderId) {
    const n = Number(folderId);
    const base = Number.isFinite(n) && n > 0 ? (n * 137.508) : stableHash(folderId);
    const hue = Math.round(base % 360);
    const sat = 68;
    const light = 52;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  function folderAccentForListIndex(listIndex, palette) {
    const pal = palette && palette.length ? palette : DEFAULT_FOLDER_PALETTE;
    const i = Math.max(0, Number(listIndex) || 0);
    return pal[i % pal.length];
  }

  function pickFolderAccent(folderId, listIndex, palette, mode) {
    if (mode === 'sequence') return folderAccentForListIndex(listIndex, palette);
    if (mode === 'palette') return folderAccentForIdPalette(folderId, palette);
    return folderAccentForIdAuto(folderId);
  }

  function shouldShowAllRow() {
    const v = String(mount.getAttribute('data-show-all-row') || 'false').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
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

  /** Longueur max affichée (caractères) pour les noms de dossier ; `data-folder-name-max` sur le mount (6–80). */
  function folderNameMaxChars() {
    const raw = Number(mount.getAttribute('data-folder-name-max'));
    if (Number.isFinite(raw) && raw >= 4 && raw <= 80) return Math.floor(raw);
    return 14;
  }

  function displayFolderNavName(full) {
    const s = String(full || '').trim();
    const max = folderNameMaxChars();
    if (s.length <= max) return { text: s, titleAttr: null };
    return { text: `${s.slice(0, Math.max(1, max - 1))}…`, titleAttr: s };
  }

  const FOLDER_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"/></svg>';
  /** Icône dossiers empilés (viewBox 576×512) — fill `currentColor` pour le thème (remplace #fff du SVG source). */
  const SUMMARY_STACKED_FOLDERS_MARKUP =
    '<span class="agilo-nav-folders__summary-icon-slot agilo-nav-folders__summary-fa-folder-wrap" aria-hidden="true">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true" class="agilo-nav-folders__summary-fa-folder">' +
    '<path d="M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32v96V384c0 35.3 28.7 64 64 64H256V384H64V160H256V96H64V32zM288 192c0 17.7 14.3 32 32 32H544c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32H445.3c-8.5 0-16.6-3.4-22.6-9.4L409.4 9.4c-6-6-14.1-9.4-22.6-9.4H320c-17.7 0-32 14.3-32 32V192zm0 288c0 17.7 14.3 32 32 32H544c17.7 0 32-14.3 32-32V352c0-17.7-14.3-32-32-32H445.3c-8.5 0-16.6-3.4-22.6-9.4l-13.3-13.3c-6-6-14.1-9.4-22.6-9.4H320c-17.7 0-32 14.3-32 32V480z"/>' +
    '</svg></span>';
  const STACK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z"/></svg>';
  const ROOT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 7.5 9-4.5 9 4.5-9 4.5-9-4.5Zm0 0V16.5L12 21l9-4.5V7.5" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PLUS_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const CHECK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4 10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const X_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const PENCIL_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.12 2.12 0 1 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let __loading = false;
  let __retryAttempt = 0;
  let __retryTimer = null;

  function summaryLabelText() {
    const raw = String(mount.getAttribute('data-summary-label') || 'Dossiers').trim();
    if (!raw) return 'Dossiers';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function fallbackCreateAction(auth) {
    const targetSelector = String(mount.getAttribute('data-folder-create-selector') || '').trim();
    if (targetSelector) {
      const target = document.querySelector(targetSelector);
      if (target && typeof target.click === 'function') {
        target.click();
        return;
      }
    }
    const href = String(mount.getAttribute('data-folder-create-href') || '').trim();
    if (href) {
      try {
        location.href = new URL(href, location.origin).toString();
        return;
      } catch (_) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('agilo:nav-folder-create', { detail: { auth } }));
    } catch (_) {}
  }

  function closeInlineCreate(list) {
    if (!list) return;
    const row = list.querySelector('.agilo-nav-folders__row--inline-create');
    if (row) row.remove();
  }

  async function submitInlineCreate(auth, list, inputEl) {
    const raw = String(inputEl?.value || '').trim();
    if (!raw) {
      closeInlineCreate(list);
      return;
    }
    if (!auth?.username || !auth?.token) {
      window.alert('Authentification manquante, recharge la page.');
      closeInlineCreate(list);
      return;
    }
    inputEl.disabled = true;
    const created = await createFolder(auth, raw);
    if (!created.ok) {
      inputEl.disabled = false;
      window.alert(created.error || 'Création du dossier impossible.');
      inputEl.focus();
      inputEl.select();
      return;
    }
    closeInlineCreate(list);
    await load();
  }

  function openInlineCreate(auth, list, useMatchNav) {
    if (!list) {
      fallbackCreateAction(auth);
      return;
    }
    const existing = list.querySelector('.agilo-nav-folders__row--inline-create');
    if (existing) {
      const oldInput = existing.querySelector('.agilo-nav-folders__input');
      oldInput?.focus();
      oldInput?.select();
      return;
    }

    const row = document.createElement('div');
    row.className = [
      'agilo-nav-folders__row',
      'agilo-nav-folders__row--inline-create',
      useMatchNav ? 'agilo-nav-folders__row--match-nav' : ''
    ].filter(Boolean).join(' ');

    const iconWrapClass = useMatchNav
      ? 'icon-small w-embed agilo-nav-folders__icon-wrap'
      : 'agilo-nav-folders__icon';

    row.innerHTML = `
      <div class="${iconWrapClass}">${FOLDER_SVG}</div>
      <input class="agilo-nav-folders__input" type="text" maxlength="60" placeholder="Nouveau dossier" />
      <span class="agilo-nav-folders__inline-actions">
        <button type="button" class="agilo-nav-folders__inline-btn agilo-nav-folders__inline-btn--ok" aria-label="Valider">${CHECK_SVG}</button>
        <button type="button" class="agilo-nav-folders__inline-btn agilo-nav-folders__inline-btn--cancel" aria-label="Annuler">${X_SVG}</button>
      </span>
    `;

    const input = row.querySelector('.agilo-nav-folders__input');
    const btnOk = row.querySelector('.agilo-nav-folders__inline-btn--ok');
    const btnCancel = row.querySelector('.agilo-nav-folders__inline-btn--cancel');

    const onSubmit = () => submitInlineCreate(auth, list, input);
    const onCancel = () => closeInlineCreate(list);

    btnOk?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onSubmit();
    });
    btnCancel?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onCancel();
    });
    input?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        onSubmit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        onCancel();
      }
    });

    list.insertBefore(row, list.firstChild || null);
    input?.focus();
    input?.select();
  }

  function createSummary(auth) {
    const sum = document.createElement('summary');
    const summaryExtra = extraClasses('data-summary-class');
    sum.className = ['agilo-nav-folders__summary', summaryExtra].filter(Boolean).join(' ');

    const main = document.createElement('span');
    main.className = 'agilo-nav-folders__summary-main';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'agilo-nav-folders__summary-icon-root';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = SUMMARY_STACKED_FOLDERS_MARKUP;

    const txt = document.createElement('span');
    txt.className = 'agilo-nav-folders__summary-text';
    txt.textContent = summaryLabelText();

    const chev = document.createElement('span');
    chev.className = 'agilo-nav-folders__chev';
    chev.setAttribute('aria-hidden', 'true');

    main.appendChild(iconWrap);
    main.appendChild(txt);
    main.appendChild(chev);

    const actions = document.createElement('span');
    actions.className = 'agilo-nav-folders__summary-actions';

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'agilo-nav-folders__create-btn';
    createBtn.setAttribute('aria-label', 'Créer un dossier');
    createBtn.setAttribute('title', 'Créer un dossier');
    createBtn.innerHTML = PLUS_SVG;

    actions.appendChild(createBtn);
    sum.appendChild(main);
    sum.appendChild(actions);
    return sum;
  }

  function clearRetry() {
    if (__retryTimer) {
      clearTimeout(__retryTimer);
      __retryTimer = null;
    }
    __retryAttempt = 0;
  }

  function scheduleRetry(reason) {
    if (__retryTimer) return;
    __retryAttempt += 1;
    const delay = Math.min(900 + (__retryAttempt * 700), 7000);
    dbg('retry', __retryAttempt, reason || '', `(${delay}ms)`);
    __retryTimer = setTimeout(() => {
      __retryTimer = null;
      load();
    }, delay);
  }

  function renderLoading() {
    mount.innerHTML = '';
    mount.removeAttribute('hidden');
    const details = document.createElement('details');
    details.className = 'agilo-nav-folders-details';
    const sum = createSummary(null);
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
    const sum = createSummary(null);
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

    const sum = createSummary(auth);

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

    async function renameFolderFromRow(folderId, currentName) {
      if (!auth?.username || !auth?.token) {
        window.alert('Authentification manquante, recharge la page.');
        return;
      }
      const nextName = window.prompt('Nouveau nom du dossier :', currentName || '');
      if (nextName == null) return;
      const clean = String(nextName || '').trim();
      if (!clean || clean === String(currentName || '').trim()) return;
      const renamed = await renameFolder(auth, folderId, clean);
      if (!renamed.ok) {
        window.alert(renamed.error || 'Renommage du dossier impossible.');
        return;
      }
      await load();
    }

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
      if (isFolderRow) a.dataset.folderId = String(Number(filter));
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
        const renameHtml = isFolderRow
          ? `<button type="button" class="agilo-nav-folders__rename-btn" aria-label="Renommer le dossier" title="Renommer">${PENCIL_SVG}</button>`
          : '';
        const middle = isFolderRow
          ? `<div class="agilo-nav-folders__name-block"><div class="${nameClasses}"></div>${renameHtml}</div>`
          : `<div class="${nameClasses}"></div>`;
        a.innerHTML = `<div class="${iconWrapClass}">${iconHtml}</div>${middle}<span class="${countClasses}"></span>`;
      } else {
        const renameHtml = isFolderRow
          ? `<button type="button" class="agilo-nav-folders__rename-btn" aria-label="Renommer le dossier" title="Renommer">${PENCIL_SVG}</button>`
          : '';
        const middle = isFolderRow
          ? `<span class="agilo-nav-folders__name-block"><span class="agilo-nav-folders__name"></span>${renameHtml}</span>`
          : `<span class="agilo-nav-folders__name"></span>`;
        a.innerHTML = `<span class="agilo-nav-folders__icon">${iconHtml}</span>${middle}<span class="agilo-nav-folders__count"></span>`;
      }
      const nameEl = a.querySelector('.agilo-nav-folders__name');
      const countEl = a.querySelector('.agilo-nav-folders__count');
      if (nameEl) {
        if (isFolderRow) {
          const { text, titleAttr } = displayFolderNavName(label);
          nameEl.textContent = text;
          if (titleAttr) nameEl.setAttribute('title', titleAttr);
          else nameEl.removeAttribute('title');
        } else {
          nameEl.textContent = String(label || '');
          nameEl.removeAttribute('title');
        }
      }
      if (countEl) countEl.textContent = String(count);
      const renameBtn = a.querySelector('.agilo-nav-folders__rename-btn');
      if (renameBtn && isFolderRow) {
        renameBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          renameFolderFromRow(Number(filter), label);
        });
      }
      list.appendChild(a);
    }

    const rootCount = merged.rootJobsCount;
    if (shouldShowAllRow()) {
      addRow('all', 'Tous les fichiers', totalAll, STACK_SVG, ACCENT_ALL);
    }
    addRow('root', 'Non classé', rootCount, ROOT_SVG, ACCENT_ROOT);

    const sortedFolders = (Array.isArray(merged.folders) ? merged.folders.slice() : []).sort((a, b) =>
      String(a.folderName || '').localeCompare(String(b.folderName || ''), 'fr', { sensitivity: 'base' })
    );

    sortedFolders.forEach((f, idx) => {
      const accent = pickFolderAccent(f.folderId, idx, folderPalette, accentMode);
      addRow(Number(f.folderId), f.folderName, f.jobsCount, FOLDER_SVG, accent);
    });

    nav.appendChild(list);
    details.appendChild(sum);
    details.appendChild(nav);
    mount.appendChild(details);

    const createBtn = details.querySelector('.agilo-nav-folders__create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (auth?.username && auth?.token) {
          openInlineCreate(auth, list, useMatchNav);
        } else {
          ensureAuth(8000)
            .then((fresh) => {
              if (fresh?.username && fresh?.token) openInlineCreate(fresh, list, useMatchNav);
              else fallbackCreateAction(auth);
            })
            .catch(() => fallbackCreateAction(auth));
        }
      });
    }

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
        renderLoading();
        scheduleRetry('missing-auth');
        __loading = false;
        return;
      }

      const [foldersData, jobsRows] = await Promise.all([fetchTranscriptFoldersList(auth), fetchJobsInfoAll(auth)]);
      const derived = deriveFolderCountsFromJobs(jobsRows);
      const merged = mergeFoldersCacheWithDerived(foldersData, derived);
      const totalAll = Array.isArray(jobsRows) ? jobsRows.length : 0;

      renderMerged(auth, merged, totalAll, derived);
      clearRetry();
    } catch (e) {
      dbg(e);
      renderError('Dossiers indisponibles pour le moment.');
      scheduleRetry('exception');
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
  window.addEventListener('focus', () => load(), { passive: true });
  window.addEventListener('pageshow', () => load(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  }, { passive: true });
  window.addEventListener('storage', (e) => {
    if (!e || typeof e.key !== 'string') return;
    if (e.key === 'memberEmail' || e.key === 'agilo:username' || e.key === 'agilo:token' || e.key.indexOf('agilo:token:') === 0) {
      load();
    }
  }, { passive: true });
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
    window.__agiloNavFolders.version = APP_VERSION;
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
