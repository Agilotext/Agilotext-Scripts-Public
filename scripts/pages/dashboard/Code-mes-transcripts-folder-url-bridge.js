// Agilotext — pont autonome URL ?folderId= -> tableau "Mes transcriptions"
// Version 2.1.1
//
// Objectif:
// - filtrer les lignes par dossier depuis folderId (all, root, N)
// - conserver un tri date création asc/desc
// - ajouter un contrôle "Déplacer vers dossier" depuis la barre bulk
// - fonctionner même sans hooks internes du script inline Webflow

(function () {
  'use strict';

  if (window.__agiloMesTranscriptsFolderBridge && window.__agiloMesTranscriptsFolderBridge.version) return;

  const BRIDGE_VERSION = '2.1.1';
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const EDITION_FALLBACK = 'ent';

  const state = {
    jobsById: new Map(),
    folders: [],
    auth: null,
    filter: 'all',
    sortDir: 'desc',
    observer: null,
    applyRaf: 0,
    applying: false,
    ignoreMutations: false,
    loadingPromise: null,
    retryTimer: null,
    retryCount: 0,
    bulkUiMounted: false
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

  async function postForm(endpoint, fields) {
    const body = new URLSearchParams(fields);
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      credentials: 'omit',
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => null);
    if (payload && String(payload.status).toUpperCase() === 'OK') return { ok: true, data: payload };
    const msg =
      payload?.message ||
      payload?.errorMessage ||
      payload?.userErrorMessage ||
      payload?.error ||
      `http ${response.status}`;
    return { ok: false, error: String(msg), data: payload };
  }

  function sortFoldersByName(list) {
    return (Array.isArray(list) ? list.slice() : []).sort((a, b) =>
      String(a.folderName || '').localeCompare(String(b.folderName || ''), 'fr', { sensitivity: 'base' })
    );
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

  function activeFolderLabel() {
    if (state.filter === 'all') return 'Tous les fichiers';
    if (state.filter === 'root') return 'Non classé';
    const id = Number(state.filter);
    if (!Number.isFinite(id) || id <= 0) return 'Tous les fichiers';
    const f = state.folders.find((x) => Number(x.folderId) === id);
    return f?.folderName || `Dossier ${id}`;
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
      let mustReorder = false;
      for (let i = 0; i < rowsWithMeta.length; i++) {
        if (rows[i] !== rowsWithMeta[i].row) {
          mustReorder = true;
          break;
        }
      }
      if (mustReorder) {
        state.ignoreMutations = true;
        try {
          const frag = document.createDocumentFragment();
          rowsWithMeta.forEach((it) => frag.appendChild(it.row));
          container.appendChild(frag);
        } finally {
          state.ignoreMutations = false;
        }
      }

      updateReadyCount(visibleRows);
      setSortDirUi();
      updateBulkMoveUiState();
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

  function selectedJobIds() {
    const rows = Array.from(document.querySelectorAll('#jobs-container .wrapper-content_item-row'));
    const ids = [];
    rows.forEach((row) => {
      const cb =
        row.querySelector('.job-select:checked') ||
        row.querySelector('input[type="checkbox"]:checked');
      if (!cb) return;
      const id = rowJobId(row);
      if (id) ids.push(id);
    });
    return Array.from(new Set(ids));
  }

  function ensureBulkMoveCss() {
    if (document.getElementById('agilo-bulk-folder-move-style')) return;
    const style = document.createElement('style');
    style.id = 'agilo-bulk-folder-move-style';
    style.textContent = `
      .agilo-bulk-folder-move{
        display:inline-flex;
        align-items:center;
        gap:.5rem;
        margin-left:.6rem;
        flex-wrap:wrap;
      }
      .agilo-bulk-folder-current{
        display:inline-flex;
        align-items:center;
        min-height:40px;
        padding:0 .72rem;
        border:1px solid rgba(82, 82, 82, .16);
        border-radius:10px;
        background:#fff;
        font-size:.86rem;
        line-height:1.2;
        color:#525252;
        white-space:nowrap;
      }
      .agilo-bulk-folder-current strong{
        color:#202124;
        font-weight:600;
        margin-left:.2rem;
      }
      .agilo-bulk-folder-controls{
        display:inline-flex;
        align-items:center;
        gap:.38rem;
      }
      .agilo-bulk-folder-controls[hidden]{
        display:none !important;
      }
      .agilo-bulk-folder-move__select{
        min-width:182px;
        max-width:260px;
        height:40px;
        border:1px solid rgba(82, 82, 82, .2);
        border-radius:10px;
        background:#fff;
        font-size:.92rem;
        line-height:1.2;
        padding:0 .8rem;
      }
      .agilo-bulk-folder-move__btn{
        height:40px;
        border-radius:10px;
        font-size:.92rem;
        line-height:1.2;
        padding:0 .95rem;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        white-space:nowrap;
      }
      .agilo-bulk-folder-move__btn[disabled],
      .agilo-bulk-folder-move__select[disabled]{
        opacity:.55;
        cursor:not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  function fillBulkMoveOptions(selectEl) {
    if (!selectEl) return;
    const previous = selectEl.value;
    const options = ['<option value="">Déplacer vers…</option>', '<option value="0">Non classé</option>'];
    sortFoldersByName(state.folders).forEach((f) => {
      options.push(`<option value="${String(f.folderId)}">${String(f.folderName)}</option>`);
    });
    selectEl.innerHTML = options.join('');
    if (previous) selectEl.value = previous;
  }

  function updateBulkMoveUiState() {
    const box = document.getElementById('agilo-bulk-folder-move');
    const currentChip = document.getElementById('agilo-bulk-folder-current');
    const controls = document.getElementById('agilo-bulk-folder-controls');
    const n = selectedJobIds().length;
    if (currentChip) {
      if (n > 0) {
        currentChip.hidden = false;
        currentChip.innerHTML = `Dossier actuel : <strong>${activeFolderLabel()}</strong>`;
      } else {
        currentChip.innerHTML = '';
        currentChip.hidden = true;
      }
    }
    if (controls) controls.hidden = n === 0;
    /* Tout le bloc (libellé + liste + bouton) masqué sans sélection — évite « Dossier… » visible à tort */
    if (box) {
      box.hidden = n === 0;
      box.setAttribute('aria-hidden', n === 0 ? 'true' : 'false');
    }
  }

  function ensureBulkMoveUi() {
    const bar = document.querySelector('.bulk-actions-bar');
    if (!bar) return;
    ensureBulkMoveCss();

    let box = document.getElementById('agilo-bulk-folder-move');
    if (!box) {
      box = document.createElement('span');
      box.id = 'agilo-bulk-folder-move';
      box.className = 'agilo-bulk-folder-move';
      box.innerHTML = `
        <span id="agilo-bulk-folder-current" class="agilo-bulk-folder-current"></span>
        <span id="agilo-bulk-folder-controls" class="agilo-bulk-folder-controls" hidden>
          <select id="agilo-bulk-folder-select" class="agilo-bulk-folder-move__select" aria-label="Choisir dossier destination"></select>
          <button type="button" id="agilo-bulk-folder-apply" class="button-secondary black agilo-bulk-folder-move__btn">Déplacer</button>
        </span>
      `;
      bar.appendChild(box);
    }

    const selectEl = document.getElementById('agilo-bulk-folder-select');
    const applyBtn = document.getElementById('agilo-bulk-folder-apply');
    fillBulkMoveOptions(selectEl);
    updateBulkMoveUiState();

    if (!state.bulkUiMounted && applyBtn && selectEl) {
      state.bulkUiMounted = true;
      document.addEventListener('change', (ev) => {
        const t = ev?.target;
        if (!t) return;
        if (t.id === 'select-all' || t.classList?.contains('job-select')) {
          updateBulkMoveUiState();
        }
      }, { capture: true, passive: true });

      applyBtn.addEventListener('click', async () => {
        const folderValue = String(selectEl.value || '');
        if (!folderValue) {
          window.alert('Choisis un dossier de destination.');
          return;
        }
        const ids = selectedJobIds();
        if (!ids.length) {
          window.alert('Sélectionne au moins un transcript.');
          return;
        }

        let auth = state.auth;
        if (!auth?.email || !auth?.token) auth = await ensureAuth(8000);
        if (!auth?.email || !auth?.token) {
          window.alert('Authentification manquante, recharge la page.');
          return;
        }

        applyBtn.disabled = true;
        selectEl.disabled = true;
        let moved = 0;
        let failed = 0;
        for (let i = 0; i < ids.length; i++) {
          const jobId = ids[i];
          try {
            const r = await moveJobToFolder(auth, jobId, folderValue);
            if (r.ok) {
              moved += 1;
              const meta = state.jobsById.get(jobId);
              if (meta) meta.folderId = Number(folderValue);
            } else {
              failed += 1;
            }
          } catch (_) {
            failed += 1;
          }
        }

        Array.from(document.querySelectorAll('#jobs-container .wrapper-content_item-row')).forEach((row) => {
          const cb =
            row.querySelector('.job-select:checked') ||
            row.querySelector('input[type="checkbox"]:checked');
          if (!cb) return;
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });

        try {
          state.folders = await fetchFolders(auth);
        } catch (_) {}
        fillBulkMoveOptions(selectEl);
        updateBulkMoveUiState();
        scheduleApply();
        window.__agiloNavFolders?.refresh?.();

        applyBtn.disabled = false;
        selectEl.disabled = false;
        if (failed > 0) {
          window.alert(`Déplacement terminé : ${moved} OK, ${failed} en échec.`);
        }
      });
    }
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

  async function fetchFolders(auth, retried = false) {
    const url = `${API_BASE}/getTranscriptFolders?username=${encodeURIComponent(auth.email)}&token=${encodeURIComponent(auth.token)}&edition=${encodeURIComponent(auth.edition)}`;
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
      if (fresh.token) return fetchFolders(fresh, true);
    }

    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    if (!payload || String(payload.status).toUpperCase() !== 'OK') return [];
    const raw = payload.folders || payload.transcriptFolderDtos || payload.transcriptFolders || payload.folderDtos || [];
    return sortFoldersByName(
      (Array.isArray(raw) ? raw : [])
        .map((f) => ({
          folderId: Number(f.folderId != null ? f.folderId : f.id),
          folderName: String(f.folderName != null ? f.folderName : f.name || '').trim()
        }))
        .filter((f) => Number.isFinite(f.folderId) && f.folderId > 0 && f.folderName)
    );
  }

  async function moveJobToFolder(auth, jobId, folderId) {
    return postForm('moveTranscriptToFolder', {
      username: auth.email,
      token: auth.token,
      edition: auth.edition,
      jobId: String(jobId),
      folderId: String(folderId)
    });
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
      const [map, folders] = await Promise.all([fetchJobsMap(auth), fetchFolders(auth)]);
      state.jobsById = map;
      state.folders = folders;
      state.auth = auth;
      clearRetry();
      dbg('jobs map loaded', map.size);
      ensureBulkMoveUi();
      updateBulkMoveUiState();
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
    updateBulkMoveUiState();
    scheduleApply();
  }

  function observeRows() {
    const container = getJobsContainer();
    if (!container) return;
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => {
      if (state.ignoreMutations || state.applying) return;
      bindSort();
      ensureBulkMoveUi();
      updateBulkMoveUiState();
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
    ensureBulkMoveUi();
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
