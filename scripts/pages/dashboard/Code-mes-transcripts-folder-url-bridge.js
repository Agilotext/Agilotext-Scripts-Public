// Agilotext — pont autonome URL ?folderId= -> tableau "Mes transcriptions"
// Version 2.0.0
//
// Objectif:
// - filtrer les lignes par dossier depuis folderId (all, root, N)
// - conserver un tri date création asc/desc
// - fonctionner même sans hooks internes du script inline Webflow

(function () {
  'use strict';

  if (window.__agiloMesTranscriptsFolderBridge && window.__agiloMesTranscriptsFolderBridge.version) return;

  const BRIDGE_VERSION = '2.0.0';
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const EDITION_FALLBACK = 'ent';

  const state = {
    jobsById: new Map(),
    filter: 'all',
    sortDir: 'desc',
    observer: null,
    applyRaf: 0,
    applying: false,
    loadingPromise: null,
    retryTimer: null,
    retryCount: 0
  };

  const dbg = (...args) => window.AGILO_DEBUG && console.debug('[MesTranscriptsBridge]', ...args);

  function isMesTranscriptsPage() {
    return /\/mes-transcripts(\/|$)/.test(location.pathname || '');
  }

  function valFromEl(el) {
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

  function normalizeEdition(v) {
    v = String(v || '').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return EDITION_FALLBACK;
  }

  function getEdition() {
    return normalizeEdition(
      new URLSearchParams(location.search).get('edition') ||
      document.documentElement?.getAttribute('data-edition') ||
      localStorage.getItem('agilo:edition') ||
      EDITION_FALLBACK
    );
  }

  function readEmail() {
    const selectors = [
      '#memberEmail',
      '[name="memberEmail"]',
      '[data-ms-member="email"]',
      '[data-ms-member-email]',
      '[data-member-email]',
      '.memberemail',
      '#email',
      'input[type="email"]'
    ];
    for (let i = 0; i < selectors.length; i++) {
      const v = valFromEl(document.querySelector(selectors[i]));
      if (v) return v;
    }
    return String(localStorage.getItem('memberEmail') || localStorage.getItem('agilo:username') || window.memberEmail || '').trim();
  }

  function tokenKey(email, edition) {
    return `agilo:token:${normalizeEdition(edition)}:${String(email || '').toLowerCase()}`;
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

  function readToken(email, edition) {
    let bootstrapToken = '';
    try {
      if (globalToken) bootstrapToken = String(globalToken);
    } catch (_) {}
    return String(
      bootstrapToken ||
      (typeof window.globalToken === 'string' ? window.globalToken : '') ||
      localStorage.getItem(tokenKey(email, edition)) ||
      localStorage.getItem('agilo:token') ||
      findAnyAgiloTokenInStorage() ||
      ''
    ).trim();
  }

  function readAuthSnapshot() {
    const email = readEmail();
    const edition = getEdition();
    const token = readToken(email, edition);
    return { email, token, edition };
  }

  async function ensureAuth(timeoutMs = 12000) {
    const t0 = Date.now();
    let snap = readAuthSnapshot();
    if (snap.email && snap.token) return snap;
    while ((Date.now() - t0) < timeoutMs) {
      await new Promise((r) => setTimeout(r, 120));
      snap = readAuthSnapshot();
      if (snap.email && snap.token) return snap;
    }
    return snap;
  }

  function parseFolderFilter(raw) {
    if (raw === null || raw === undefined || raw === '') return 'all';
    if (String(raw) === '0') return 'root';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 'all';
  }

  function readFolderFilterFromUrl() {
    try {
      return parseFolderFilter(new URLSearchParams(location.search || '').get('folderId'));
    } catch (_) {
      return 'all';
    }
  }

  function parseDateFlexible(raw) {
    const s = String(raw || '').trim();
    if (!s) return 0;
    const m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const y = Number(m[3]);
      const hh = Number(m[4] || 0);
      const mm = Number(m[5] || 0);
      const ss = Number(m[6] || 0);
      const t = new Date(y, mo, d, hh, mm, ss).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    const isoTs = Date.parse(s);
    return Number.isFinite(isoTs) ? isoTs : 0;
  }

  function rowJobId(row) {
    if (!row) return null;
    const direct = Number(row.getAttribute('data-job-id'));
    if (Number.isFinite(direct) && direct > 0) return direct;
    const byCheckbox = Number(row.querySelector('.job-select')?.getAttribute('data-job-id'));
    if (Number.isFinite(byCheckbox) && byCheckbox > 0) return byCheckbox;
    const byDelete = Number(row.querySelector('.delete-job-button_to-confirm')?.getAttribute('data-job-id'));
    if (Number.isFinite(byDelete) && byDelete > 0) return byDelete;
    return null;
  }

  function isDataRow(row) {
    if (!row) return false;
    if (rowJobId(row)) return true;
    if (row.classList?.contains('transparent') && row.classList?.contains('responsive')) return true;
    return false;
  }

  function getJobsContainer() {
    return document.getElementById('jobs-container');
  }

  function getRows() {
    const container = getJobsContainer();
    if (!container) return [];
    return Array.from(container.children).filter(isDataRow);
  }

  function matchesFilter(filter, folderId) {
    if (filter === 'all') return true;
    if (filter === 'root') return !Number.isFinite(folderId) || folderId <= 0;
    return Number(folderId) === Number(filter);
  }

  function setSortDirUi() {
    const nodes = document.querySelectorAll('#sort-button, .sort-wrapper');
    nodes.forEach((el) => {
      el.setAttribute('data-sort-dir', state.sortDir);
      el.setAttribute('title', state.sortDir === 'desc' ? 'Tri décroissant' : 'Tri croissant');
    });
  }

  function updateReadyCount(visibleRows) {
    const readyCountEl = document.getElementById('readyCount');
    if (!readyCountEl) return;
    let n = 0;
    visibleRows.forEach((row) => {
      const jobId = rowJobId(row);
      if (!jobId) return;
      const meta = state.jobsById.get(jobId);
      if (!meta) return;
      if (String(meta.transcriptStatus || '').toUpperCase() === 'READY_SUMMARY_READY') n += 1;
    });
    readyCountEl.textContent = String(n);
  }

  function applyFilterAndSort() {
    if (state.applying) return;
    const container = getJobsContainer();
    if (!container) return;
    const rows = getRows();
    if (!rows.length) return;

    state.applying = true;
    try {
      const rowsWithMeta = rows.map((row) => {
        const jobId = rowJobId(row);
        const meta = jobId ? state.jobsById.get(jobId) : null;
        const folderId = Number(meta?.folderId);
        const ts =
          parseDateFlexible(meta?.dtCreation) ||
          parseDateFlexible(row.getAttribute('data-creation-date')) ||
          parseDateFlexible(row.querySelector('.creation-date')?.textContent) ||
          0;
        return { row, folderId, ts };
      });

      const visibleRows = [];
      rowsWithMeta.forEach((it) => {
        const visible = matchesFilter(state.filter, it.folderId);
        it.row.style.display = visible ? '' : 'none';
        it.row.setAttribute('data-agilo-filter-visible', visible ? '1' : '0');
        if (visible) visibleRows.push(it.row);
      });

      rowsWithMeta.sort((a, b) => {
        if (state.sortDir === 'asc') return a.ts - b.ts;
        return b.ts - a.ts;
      });
      rowsWithMeta.forEach((it) => container.appendChild(it.row));

      updateReadyCount(visibleRows);
      setSortDirUi();
    } finally {
      state.applying = false;
    }
  }

  function scheduleApply() {
    if (state.applyRaf) return;
    state.applyRaf = requestAnimationFrame(() => {
      state.applyRaf = 0;
      applyFilterAndSort();
    });
  }

  function bindSort() {
    const nodes = document.querySelectorAll('#sort-button, .sort-wrapper');
    nodes.forEach((el) => {
      if (el.getAttribute('data-agilo-sort-bound') === '1') return;
      el.setAttribute('data-agilo-sort-bound', '1');
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
        scheduleApply();
      });
    });
    setSortDirUi();
  }

  async function fetchJobsMap(auth, retried = false) {
    const url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(auth.email)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}&limit=9999&offset=0`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store'
    });

    if ((response.status === 401 || response.status === 403) && !retried && auth.email && typeof window.getToken === 'function') {
      try {
        window.getToken(auth.email, auth.edition);
      } catch (_) {}
      const fresh = await ensureAuth(8000);
      if (fresh.token) return fetchJobsMap(fresh, true);
    }

    if (!response.ok) {
      throw new Error(`getJobsInfo http ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    if (!payload || String(payload.status).toUpperCase() !== 'OK' || !Array.isArray(payload.jobsInfoDtos)) {
      throw new Error('getJobsInfo payload invalid');
    }

    const map = new Map();
    payload.jobsInfoDtos.forEach((job) => {
      const id = Number(job.jobid != null ? job.jobid : job.jobId);
      if (!Number.isFinite(id) || id <= 0) return;
      map.set(id, {
        folderId: Number(job.folderId),
        dtCreation: String(job.dtCreation || ''),
        transcriptStatus: String(job.transcriptStatus || '')
      });
    });
    return map;
  }

  function clearRetry() {
    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
    state.retryCount = 0;
  }

  function scheduleRetry(reason) {
    if (state.retryTimer) return;
    state.retryCount += 1;
    const delay = Math.min(800 + (state.retryCount * 700), 7000);
    dbg('retry', state.retryCount, reason || '', `(${delay}ms)`);
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null;
      refreshData(true);
    }, delay);
  }

  async function refreshData(force) {
    if (!isMesTranscriptsPage()) return state.jobsById;
    if (state.loadingPromise && !force) return state.loadingPromise;

    state.loadingPromise = (async () => {
      const auth = await ensureAuth(12000);
      if (!auth.email || !auth.token) {
        throw new Error('auth incomplet');
      }
      const map = await fetchJobsMap(auth);
      state.jobsById = map;
      clearRetry();
      dbg('jobs map loaded', map.size);
      scheduleApply();
      return map;
    })().catch((err) => {
      dbg('refreshData error', err);
      scheduleRetry(err?.message || 'load-fail');
      return state.jobsById;
    }).finally(() => {
      state.loadingPromise = null;
    });

    return state.loadingPromise;
  }

  function syncFromUrl() {
    state.filter = readFolderFilterFromUrl();
    scheduleApply();
  }

  function observeRows() {
    const container = getJobsContainer();
    if (!container) return;
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => {
      bindSort();
      scheduleApply();
    });
    state.observer.observe(container, { childList: true });
  }

  function installListeners() {
    window.addEventListener('agilo:nav-folder-url-changed', syncFromUrl, { passive: true });
    window.addEventListener('popstate', syncFromUrl, { passive: true });
    window.addEventListener('agilo:token', () => refreshData(true), { passive: true });
    window.addEventListener('agilotext:token', () => refreshData(true), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshData(false);
    }, { passive: true });
  }

  async function boot() {
    if (!isMesTranscriptsPage()) return;
    syncFromUrl();
    bindSort();
    observeRows();
    await refreshData(false);
    scheduleApply();
  }

  window.__agiloMesTranscriptsFolderBridge = {
    version: BRIDGE_VERSION,
    refresh: () => refreshData(true),
    apply: syncFromUrl,
    setSort: (dir) => {
      const d = String(dir || '').toLowerCase();
      state.sortDir = d === 'asc' ? 'asc' : 'desc';
      scheduleApply();
    }
  };

  installListeners();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
