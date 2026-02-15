(function () {
  'use strict';
  // UTF-8; textes FR avec accents

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_ENDPOINT = API_BASE + '/getToken';
  const ANON_ENDPOINT = API_BASE + '/anonOfficeText';
  const ANON_TEXT_ENDPOINT = API_BASE + '/anonText';
  const CLEANUP_ENDPOINT = API_BASE + '/cleanupOldJobs';
  const VERSION_ENDPOINT = API_BASE + '/getVersion';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const SUPPORTED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'json', 'fec', 'png', 'jpg', 'jpeg'];
  const REQUEST_TIMEOUT = 180000;

  const STORAGE_TYPES = 'agilo:futures:types:v1';
  const STORAGE_INC = 'agilo:futures:include:v1';
  const STORAGE_EXC = 'agilo:futures:exclude:v1';
  const STORAGE_PSEUDO = 'agilo:futures:pseudo:v1';
  const STORAGE_MODE = 'agilo:futures:mode:v1';

  const DEFAULT_PSEUDO_CONFIG = {
    strategy: 'placeholders',
    scope: 'document',
    keyMode: 'server',
    restoreWindow: '30d',
    deterministic: true,
    preserveFormat: true
  };

  const state = {
    activeTab: 'file',
    files: [],
    edition: 'free',
    mode: 'anonymiser',
    email: null,
    token: '',
    processing: false,
    resultUrl: null,
    resultFilename: 'document_anonymise',
    textProcessing: false,
    includeTerms: [],
    excludeTerms: [],
    pseudoConfig: { ...DEFAULT_PSEUDO_CONFIG }
  };
  const DEBOUNCE_TEXT_MS = 1000;
  const MIN_TEXT_LENGTH_FOR_API = 10;
  let debounceTextTimer = null;
  let textProcessQueued = false;
  let textRequestSerial = 0;
  let lastProcessedCacheKey = null;
  let lastProcessedResult = null;
  let lastProcessedHasTags = false;
  let lastProcessedHtml = null;
  let lastProcessedStats = null;
  let lastProcessedCounts = null;
  const ENTITY_TYPES_TAG = ['PR', 'MAIL', 'PHON', 'AGE', 'TR', 'CIE', 'CID', 'ACT', 'PROD', 'ADR', 'POST', 'LOC', 'GEO', 'CARD', 'BANK', 'MT', 'IBAN', 'ORG', 'URL', 'IP', 'REF', 'FILE', 'CLAUSE', 'DT', 'FRNIR', 'FRPASS', 'FRCNI', 'SIREN', 'SIRET', 'OTHER'];
  const PLACEHOLDER_RE = /\[([A-Z0-9_]{2,12})\]/g;
  const API_READY_VALUES = ['person_name', 'email', 'phone', 'birth', 'role', 'address', 'company', 'siren', 'accounting', 'product', 'contract', 'bank'];
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const storage = createSafeStorage();

  const ui = {
    form: document.getElementById('agfForm'),
    tabs: Array.from(document.querySelectorAll('.agf-tab')),
    panels: { file: document.getElementById('agfPanel-file'), text: document.getElementById('agfPanel-text'), restore: document.getElementById('agfPanel-restore') },
    dropzone: document.getElementById('agfDropzone'),
    input: document.getElementById('agfFileInput'),
    fileList: document.getElementById('agfFileList'),
    submit: document.getElementById('agfSubmit'),
    reset: document.getElementById('agfReset'),
    download: document.getElementById('agfDownload'),
    status: document.getElementById('agfStatus'),
    textInput: document.getElementById('agfInputText'),
    textOutput: document.getElementById('agfOutputText'),
    textClear: document.getElementById('agfTextClear'),
    textCopy: document.getElementById('agfTextCopy'),
    outputSummary: document.getElementById('agfOutputSummary'),
    outputEntities: document.getElementById('agfOutputEntities'),
    savedTypesInfo: document.getElementById('agfSavedTypesInfo'),
    lastMaskInfo: document.getElementById('agfLastMaskInfo'),
    pseudoSummary: document.getElementById('agfPseudoSummary'),
    pseudoBadge: document.getElementById('agfPseudoBadge'),
    modeRadios: Array.from(document.querySelectorAll('input[name="agfMode"]')),
    pseudoMode: document.getElementById('agfPseudoMode'),
    pseudoSaved: document.getElementById('agfPseudoSaved'),
    openTypes: document.getElementById('agfOpenTypes'),
    openInclusion: document.getElementById('agfOpenInclusion'),
    inclusionChip: document.getElementById('agfInclusionChip'),
    typesCount: document.getElementById('agfTypesCount'),
    upgradeRestore: document.getElementById('agfUpgradeRestore'),
    apiMeta: document.getElementById('agfApiMeta'),
    modals: {
      types: document.getElementById('agfModalTypesWrap'),
      pseudo: document.getElementById('agfModalPseudoWrap'),
      inclusion: document.getElementById('agfModalInclusionWrap')
    },
    modalTypesClose: document.getElementById('agfModalTypesClose'),
    modalPseudoClose: document.getElementById('agfModalPseudoClose'),
    modalIncClose: document.getElementById('agfModalIncClose'),
    defaultsTypes: document.getElementById('agfDefaultsTypes'),
    detectAllTypes: document.getElementById('agfDetectAllTypes'),
    ignoreAllTypes: document.getElementById('agfIgnoreAllTypes'),
    pseudoDefaults: document.getElementById('agfPseudoDefaults'),
    savePseudo: document.getElementById('agfSavePseudo'),
    pseudoStrategyRadios: Array.from(document.querySelectorAll('input[name="agfPseudoStrategy"]')),
    pseudoScope: document.getElementById('agfPseudoScope'),
    pseudoKeyMode: document.getElementById('agfPseudoKeyMode'),
    pseudoRestoreWindow: document.getElementById('agfPseudoRestoreWindow'),
    pseudoDeterministic: document.getElementById('agfPseudoDeterministic'),
    pseudoPreserveFormat: document.getElementById('agfPseudoPreserveFormat'),
    saveTypes: document.getElementById('agfSaveTypes'),
    saveInclusion: document.getElementById('agfSaveInclusion'),
    inclusionDefaults: document.getElementById('agfInclusionDefaults'),
    incSummary: document.getElementById('agfIncSummary'),
    includeTerms: document.getElementById('agfIncludeTerms'),
    excludeTerms: document.getElementById('agfExcludeTerms'),
    includeInput: document.getElementById('agfIncludeInput'),
    excludeInput: document.getElementById('agfExcludeInput'),
    includeAdd: document.getElementById('agfIncludeAdd'),
    excludeAdd: document.getElementById('agfExcludeAdd'),
    includeList: document.getElementById('agfIncludeList'),
    excludeList: document.getElementById('agfExcludeList'),
    manualAuth: document.getElementById('agfManualAuth'),
    manualAuthToggle: document.getElementById('agfManualAuthToggle'),
    manualAuthFields: document.getElementById('agfManualAuthFields'),
    manualUsername: document.getElementById('agfManualUsername'),
    manualToken: document.getElementById('agfManualToken'),
    manualEdition: document.getElementById('agfManualEdition')
  };

  const DEFAULT_ENTITIES = ['PR', 'MAIL', 'PHON', 'AGE', 'TR', 'CIE', 'CID', 'ACT', 'PROD', 'ADR', 'POST', 'LOC', 'BANK', 'CARD', 'REF', 'CLAUSE', 'DT'];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 2) + ' ' + units[idx];
  };

  function createSafeStorage() {
    const mem = {};
    try {
      const probeKey = '__agilo_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return {
        get: (k) => window.localStorage.getItem(k),
        set: (k, v) => window.localStorage.setItem(k, v),
        remove: (k) => window.localStorage.removeItem(k)
      };
    } catch (e) {
      return {
        get: (k) => Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null,
        set: (k, v) => { mem[k] = String(v); },
        remove: (k) => { delete mem[k]; }
      };
    }
  }

  function toSortedJson(value) {
    if (Array.isArray(value)) return JSON.stringify(value.slice().sort());
    if (value && typeof value === 'object') {
      const keys = Object.keys(value).sort();
      const ordered = {};
      keys.forEach((k) => { ordered[k] = value[k]; });
      return JSON.stringify(ordered);
    }
    return JSON.stringify(value);
  }

  function currentTextConfigKey(text) {
    return [
      (text || '').trim(),
      state.mode,
      toSortedJson(selectedVisualEntities()),
      toSortedJson(selectedEntities()),
      (state.includeTerms || []).join('|'),
      (state.excludeTerms || []).join('|'),
      toSortedJson(state.pseudoConfig || {})
    ].join('::');
  }

  function resetTextCache() {
    lastProcessedCacheKey = null;
    lastProcessedResult = null;
    lastProcessedHasTags = false;
    lastProcessedHtml = null;
    lastProcessedStats = null;
    lastProcessedCounts = null;
  }

  function refreshTextIfNeeded() {
    const value = (ui.textInput && ui.textInput.value || '').trim();
    if (!value || value.length < MIN_TEXT_LENGTH_FOR_API) return;
    scheduleDebouncedText();
  }

  function setStatus(kind, message) {
    if (!message) {
      ui.status.classList.remove('is-visible');
      ui.status.removeAttribute('data-kind');
      ui.status.textContent = '';
      return;
    }
    ui.status.classList.add('is-visible');
    ui.status.setAttribute('data-kind', kind);
    ui.status.textContent = '';
    if (kind === 'loading') {
      const spinner = document.createElement('span');
      spinner.className = 'agf-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      ui.status.appendChild(spinner);
    }
    const txt = document.createElement('span');
    txt.textContent = message;
    ui.status.appendChild(txt);
  }

  let lastFocusBeforeModal = null;
  let activeModal = null;
  let previousBodyOverflow = '';

  function focusableNodes(el) {
    return Array.from(el.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter((n) => !n.hasAttribute('disabled') && n.getAttribute('aria-hidden') !== 'true');
  }

  function openModal(el) {
    if (!el) return;
    lastFocusBeforeModal = document.activeElement;
    activeModal = el;
    previousBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    const focusables = focusableNodes(el);
    const initial = el.querySelector('.agf-close') || focusables[0];
    if (initial) setTimeout(() => initial.focus(), 0);
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (activeModal === el) activeModal = null;
    if (!activeModal) document.body.style.overflow = previousBodyOverflow;
    if (lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === 'function') {
      setTimeout(() => lastFocusBeforeModal.focus(), 0);
    }
  }
  function closeAllModals() { Object.keys(ui.modals).forEach((k) => closeModal(ui.modals[k])); }

  function trapModalFocus(e) {
    if (!activeModal || e.key !== 'Tab') return;
    const nodes = focusableNodes(activeModal);
    if (!nodes.length) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function revokeResultUrl() {
    if (state.resultUrl) {
      URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = null;
    }
  }

  function updateActions() { ui.submit.disabled = state.processing || state.files.length === 0; }

  function renderFileList() {
    ui.fileList.textContent = '';
    if (state.files.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'agf-empty';
      empty.textContent = 'Les fichiers sélectionnés apparaîtront ici';
      ui.fileList.appendChild(empty);
      updateActions();
      return;
    }
    state.files.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'agf-file';
      row.setAttribute('role', 'listitem');

      const left = document.createElement('div');
      const name = document.createElement('p');
      name.className = 'agf-file-name';
      name.title = item.fileName;
      name.textContent = item.fileName;
      const meta = document.createElement('p');
      meta.className = 'agf-file-meta';
      meta.textContent = formatSize(item.size);
      left.appendChild(name);
      left.appendChild(meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agf-remove';
      btn.textContent = 'Retirer';
      btn.addEventListener('click', function () {
        if (state.processing) return;
        state.files = state.files.filter((f) => f.id !== item.id);
        renderFileList();
      });

      row.appendChild(left);
      row.appendChild(btn);
      ui.fileList.appendChild(row);
    });
    updateActions();
  }

  function validateFile(file) {
    if (!file || file.size > MAX_FILE_SIZE) return false;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return SUPPORTED_EXT.includes(ext);
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const rejected = [];
    files.forEach((file) => {
      if (!validateFile(file)) { rejected.push(file.name); return; }
      state.files.push({ id: uid(), file, fileName: file.name, size: file.size });
    });
    if (rejected.length > 0) {
      const short = rejected.slice(0, 2).join(', ');
      const more = rejected.length > 2 ? ' +' + (rejected.length - 2) + ' autre(s)' : '';
      setStatus('error', 'Format non supporté ou fichier > 10 Mo : ' + short + more + '.');
    } else {
      setStatus('', '');
    }
    renderFileList();
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    ui.tabs.forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === tab;
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    Object.keys(ui.panels).forEach((key) => {
      const active = key === tab;
      ui.panels[key].setAttribute('aria-hidden', active ? 'false' : 'true');
      ui.panels[key].hidden = !active;
    });
  }

  function selectedVisualEntities() {
    return Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]'))
      .filter((c) => c.checked)
      .map((c) => c.getAttribute('data-entity'));
  }

  function selectedEntities() {
    const values = [];
    Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((c) => {
      if (!c.checked) return;
      const apiValue = (c.getAttribute('data-api') || '').trim();
      if (!apiValue || !API_READY_VALUES.includes(apiValue)) return;
      if (!values.includes(apiValue)) values.push(apiValue);
    });
    return values;
  }

  function renderTypeCount() {
    const total = selectedVisualEntities().length;
    const apiReady = selectedEntities().length;
    ui.typesCount.textContent = String(total);
    if (ui.savedTypesInfo) ui.savedTypesInfo.textContent = 'Types actifs: ' + total + ' (API actifs: ' + apiReady + ')';

    Array.from(document.querySelectorAll('#agfTypeGrid .agf-type-card')).forEach((card) => {
      const selectedInGroup = card.querySelectorAll('input[type="checkbox"][data-entity]:checked').length;
      const badge = card.querySelector('.agf-type-card-count');
      if (badge) badge.textContent = String(selectedInGroup);
    });
  }

  function normalizeTerm(raw) {
    return (raw || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeTermKey(raw) {
    return normalizeTerm(raw)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function parseStoredTerms(raw) {
    if (!raw) return [];
    const t = String(raw).trim();
    if (!t) return [];
    let terms = [];
    if (t.charAt(0) === '[') {
      try {
        const arr = JSON.parse(t);
        if (Array.isArray(arr)) terms = arr.map((x) => normalizeTerm(x)).filter(Boolean);
      } catch (e) {}
    }
    if (!terms.length) terms = t.split(/\r?\n/).map((x) => normalizeTerm(x)).filter(Boolean);
    const seen = new Set();
    return terms.filter((item) => {
      const key = normalizeTermKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function syncHiddenTermFields() {
    if (ui.includeTerms) ui.includeTerms.value = state.includeTerms.join('\n');
    if (ui.excludeTerms) ui.excludeTerms.value = state.excludeTerms.join('\n');
  }

  function renderTermList(kind) {
    const list = kind === 'include' ? state.includeTerms : state.excludeTerms;
    const wrap = kind === 'include' ? ui.includeList : ui.excludeList;
    if (!wrap) return;

    wrap.textContent = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'agf-term-empty';
      empty.textContent = kind === 'include'
        ? 'Aucun terme inclus pour le moment.'
        : 'Aucun terme exclu pour le moment.';
      wrap.appendChild(empty);
      return;
    }

    list.forEach((term, idx) => {
      const row = document.createElement('div');
      row.className = 'agf-term-item';
      const txt = document.createElement('span');
      txt.textContent = term;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'agf-term-remove';
      rm.textContent = 'Retirer';
      rm.addEventListener('click', () => {
        if (kind === 'include') state.includeTerms.splice(idx, 1);
        else state.excludeTerms.splice(idx, 1);
        syncHiddenTermFields();
        renderTermList(kind);
        renderInclusionSummary();
        resetTextCache();
        refreshTextIfNeeded();
      });
      row.appendChild(txt);
      row.appendChild(rm);
      wrap.appendChild(row);
    });
  }

  function renderInclusionSummary() {
    const i = state.includeTerms.length;
    const e = state.excludeTerms.length;
    if (ui.incSummary) ui.incSummary.textContent = 'Inclusion: ' + i + ' · Exclusion: ' + e;
    if (ui.inclusionChip) ui.inclusionChip.textContent = i + ' / ' + e;
  }

  function addTerm(kind, rawValue) {
    const value = normalizeTerm(rawValue);
    if (!value) return false;
    const list = kind === 'include' ? state.includeTerms : state.excludeTerms;
    const key = normalizeTermKey(value);
    if (!key) return false;
    if (list.some((x) => normalizeTermKey(x) === key)) return false;
    list.push(value);
    syncHiddenTermFields();
    renderTermList(kind);
    renderInclusionSummary();
    return true;
  }

  function applyPseudoToUi(config) {
    if (!config) return;
    const strategy = config.strategy || DEFAULT_PSEUDO_CONFIG.strategy;
    if (ui.pseudoStrategyRadios && ui.pseudoStrategyRadios.length) {
      ui.pseudoStrategyRadios.forEach((r) => { r.checked = r.value === strategy; });
    }
    if (ui.pseudoScope) ui.pseudoScope.value = config.scope || DEFAULT_PSEUDO_CONFIG.scope;
    if (ui.pseudoKeyMode) ui.pseudoKeyMode.value = config.keyMode || DEFAULT_PSEUDO_CONFIG.keyMode;
    if (ui.pseudoRestoreWindow) ui.pseudoRestoreWindow.value = config.restoreWindow || DEFAULT_PSEUDO_CONFIG.restoreWindow;
    if (ui.pseudoDeterministic) ui.pseudoDeterministic.checked = config.deterministic !== false;
    if (ui.pseudoPreserveFormat) ui.pseudoPreserveFormat.checked = config.preserveFormat !== false;
  }

  function readPseudoFromUi() {
    const selectedRadio = (ui.pseudoStrategyRadios || []).find((r) => r.checked);
    return {
      strategy: selectedRadio ? selectedRadio.value : DEFAULT_PSEUDO_CONFIG.strategy,
      scope: ui.pseudoScope ? ui.pseudoScope.value : DEFAULT_PSEUDO_CONFIG.scope,
      keyMode: ui.pseudoKeyMode ? ui.pseudoKeyMode.value : DEFAULT_PSEUDO_CONFIG.keyMode,
      restoreWindow: ui.pseudoRestoreWindow ? ui.pseudoRestoreWindow.value : DEFAULT_PSEUDO_CONFIG.restoreWindow,
      deterministic: !!(ui.pseudoDeterministic && ui.pseudoDeterministic.checked),
      preserveFormat: !!(ui.pseudoPreserveFormat && ui.pseudoPreserveFormat.checked)
    };
  }

  function strategyLabel(strategy) {
    if (strategy === 'stable_hash') return 'Hash stable';
    if (strategy === 'human_alias') return 'Alias métier';
    return 'Placeholders';
  }

  function setMode(mode) {
    state.mode = mode === 'pseudonymiser' ? 'pseudonymiser' : 'anonymiser';
    const pseudoActive = state.mode === 'pseudonymiser';
    if (ui.pseudoMode) ui.pseudoMode.classList.toggle('is-active', pseudoActive);
    if (ui.pseudoBadge) ui.pseudoBadge.textContent = pseudoActive ? 'Actif' : 'Paramétrer';
    const anonRadio = (ui.modeRadios || []).find((r) => r.value === 'anonymiser');
    if (anonRadio) anonRadio.checked = !pseudoActive;
    storage.set(STORAGE_MODE, state.mode);
    resetTextCache();
    renderPseudoSummary();
  }

  function renderPseudoSummary() {
    const cfg = state.pseudoConfig || DEFAULT_PSEUDO_CONFIG;
    if (ui.pseudoSummary) {
      const modeTxt = state.mode === 'pseudonymiser' ? 'actif' : 'configuré';
      ui.pseudoSummary.textContent =
        'Pseudo ' + modeTxt + ': ' + strategyLabel(cfg.strategy) + ' · clé ' + (cfg.keyMode || 'server') + ' · fenêtre ' + (cfg.restoreWindow || '30d');
    }
  }

  function loadPreferences() {
    let entities = DEFAULT_ENTITIES;
    const raw = storage.get(STORAGE_TYPES);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const legacyMap = {
            person_name: 'PR',
            email: 'MAIL',
            phone: 'PHON',
            birth: 'AGE',
            role: 'TR',
            address: 'ADR',
            company: 'CIE',
            siren: 'CID',
            accounting: 'ACT',
            product: 'PROD',
            contract: 'REF',
            bank: 'BANK'
          };
          entities = parsed.map((item) => legacyMap[item] || item);
        }
      } catch (e) {}
    }
    Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
      chk.checked = entities.includes(chk.getAttribute('data-entity'));
    });

    state.includeTerms = parseStoredTerms(storage.get(STORAGE_INC));
    state.excludeTerms = parseStoredTerms(storage.get(STORAGE_EXC));
    syncHiddenTermFields();
    renderTermList('include');
    renderTermList('exclude');
    renderInclusionSummary();

    try {
      const pseudoRaw = storage.get(STORAGE_PSEUDO);
      if (pseudoRaw) {
        const parsed = JSON.parse(pseudoRaw);
        if (parsed && typeof parsed === 'object') state.pseudoConfig = { ...DEFAULT_PSEUDO_CONFIG, ...parsed };
      }
    } catch (e) {}
    applyPseudoToUi(state.pseudoConfig);
    renderPseudoSummary();
    const storedMode = storage.get(STORAGE_MODE);
    setMode(storedMode === 'pseudonymiser' ? 'pseudonymiser' : 'anonymiser');

    renderTypeCount();
  }

  async function waitForMemberstack(maxWait, interval) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === 'function') return true;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return false;
  }

  async function detectEdition() {
    const ms = window.$memberstackDom;
    if (ms && typeof ms.getCurrentMember === 'function') {
      try {
        const result = await ms.getCurrentMember({ cache: 'reload' });
        const member = result && result.data;
        if (member) {
          const ACTIVE = ['ACTIVE', 'TRIALING', 'GRACE'];
          const plans = member.planConnections || [];
          const hasPlan = (prefix) => plans.some((p) => ACTIVE.includes(p.status) && p.planId && p.planId.indexOf(prefix) === 0);
          const teams = member.teams || { belongsToTeam: false, ownedTeams: [] };
          if (teams.belongsToTeam && (teams.ownedTeams || []).length === 0) return 'ent';
          if (hasPlan('pln_business')) return 'ent';
          if (hasPlan('pln_pro')) return 'pro';
          if (hasPlan('pln_free')) return 'free';
          if (hasPlan('pln_anonymisation')) return 'anonymisation';
        }
      } catch (e) { console.warn('detectEdition error', e); }
    }

    const fromQuery = new URLSearchParams(window.location.search).get('edition');
    if (fromQuery) {
      const n = fromQuery.toLowerCase();
      if (['free', 'pro', 'ent', 'business', 'anonymisation'].includes(n)) return n === 'business' ? 'ent' : n;
    }
    const stored = storage.get('agilo:edition');
    if (stored && ['free', 'pro', 'ent', 'anonymisation'].includes(stored)) return stored;
    if (window.location.pathname.includes('/business/') || window.location.pathname.includes('/ent/')) return 'ent';
    if (window.location.pathname.includes('/pro/')) return 'pro';
    return 'free';
  }

  async function getUserEmail() {
    const ms = window.$memberstackDom;
    if (ms && typeof ms.getCurrentMember === 'function') {
      try {
        const result = await ms.getCurrentMember({ cache: 'reload' });
        const member = result && result.data;
        if (member && member.email) return member.email;
      } catch (e) { console.warn('getUserEmail error', e); }
    }
    return document.querySelector('[name="memberEmail"]')?.value || document.querySelector('[data-ms-member="email"]')?.textContent?.trim() || document.getElementById('memberEmail')?.value || null;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    } finally { clearTimeout(timer); }
  }

  async function getToken(email, edition, retry) {
    const current = typeof retry === 'number' ? retry : 0;
    const maxRetry = 3;
    try {
      const url = TOKEN_ENDPOINT + '?username=' + encodeURIComponent(email) + '&edition=' + encodeURIComponent(edition);
      const response = await fetchWithTimeout(url, { method: 'GET' }, 20000);
      const data = await response.json();
      if (data && data.status === 'OK' && data.token) { state.token = data.token; return data.token; }
      throw new Error((data && (data.userErrorMessage || data.errorMessage)) || 'Token invalide');
    } catch (err) {
      if (current < maxRetry) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (current + 1)));
        return getToken(email, edition, current + 1);
      }
      throw err;
    }
  }

  function getManualAuth() {
    const username = (ui.manualUsername && ui.manualUsername.value || '').trim();
    const token = (ui.manualToken && ui.manualToken.value || '').trim();
    const edition = (ui.manualEdition && ui.manualEdition.value || '').trim();
    if (username && token && edition) return { username, token, edition };
    return null;
  }

  async function ensureAuth() {
    const manual = getManualAuth();
    if (manual) {
      state.email = manual.username;
      state.token = manual.token;
      state.edition = manual.edition;
      return;
    }
    state.email = await getUserEmail();
    if (!state.email) throw new Error('Email utilisateur introuvable.');
    if (!state.token) await getToken(state.email, state.edition, 0);
  }

  async function runSessionMaintenance() {
    if (!state.email || !state.token) return;
    const cleanupUrl = CLEANUP_ENDPOINT + '?username=' + encodeURIComponent(state.email) + '&token=' + encodeURIComponent(state.token) + '&edition=' + encodeURIComponent(state.edition || 'free');
    try { await fetchWithTimeout(cleanupUrl, { method: 'GET' }, 15000); } catch (e) {}
  }

  async function loadApiVersion() {
    try {
      const response = await fetchWithTimeout(VERSION_ENDPOINT, { method: 'GET' }, 10000);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.status === 'OK' && data.version && ui.apiMeta) ui.apiMeta.textContent = 'API: ' + data.version;
    } catch (e) {}
  }

  function parseFilename(contentDisposition) {
    const match = (contentDisposition || '').match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
    if (!match || !match[1]) return 'document_anonymise';
    return match[1].replace(/^['"]|['"]$/g, '').trim();
  }

  async function submitFiles(event) {
    event.preventDefault();
    if (state.activeTab !== 'file' || state.processing || state.files.length === 0) return;

    try { await ensureAuth(); } catch (e) { setStatus('error', e.message || 'Authentification indisponible.'); return; }

    state.processing = true;
    updateActions();
    revokeResultUrl();
    ui.download.href = '#';
    ui.download.removeAttribute('download');
    ui.download.classList.remove('is-visible');
    setStatus('loading', 'Traitement en cours...');

    const formData = new FormData();
    formData.append('username', state.email);
    formData.append('token', state.token);
    formData.append('edition', state.edition);
    const entities = selectedEntities();
    if (entities.length) formData.append('entityTypes', JSON.stringify(entities));
    const inc = (state.includeTerms || []).join('\n').trim();
    if (inc) formData.append('includeTerms', inc);
    const exc = (state.excludeTerms || []).join('\n').trim();
    if (exc) formData.append('excludeTerms', exc);
    if (state.mode === 'pseudonymiser' && state.pseudoConfig) {
      formData.append('processingMode', 'pseudonymiser');
      formData.append('pseudoStrategy', state.pseudoConfig.strategy || '');
      formData.append('pseudoScope', state.pseudoConfig.scope || '');
      formData.append('pseudoKeyMode', state.pseudoConfig.keyMode || '');
      formData.append('pseudoRestoreWindow', state.pseudoConfig.restoreWindow || '');
      formData.append('pseudoDeterministic', state.pseudoConfig.deterministic ? 'true' : 'false');
      formData.append('pseudoPreserveFormat', state.pseudoConfig.preserveFormat ? 'true' : 'false');
    }
    state.files.forEach((item) => formData.append('fileUpload[]', item.file, item.fileName));

    try {
      const response = await fetchWithTimeout(ANON_ENDPOINT, { method: 'POST', body: formData }, REQUEST_TIMEOUT);
      if (!response.ok) {
        const raw = await response.text();
        let msg = 'Erreur de traitement. Vérifiez puis réessayez.';
        try { const json = JSON.parse(raw); if (json && (json.userErrorMessage || json.errorMessage)) msg = json.userErrorMessage || json.errorMessage; }
        catch (e) { if (raw && raw.length < 220) msg = raw; }
        throw new Error(msg);
      }
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const blob = await response.blob();
      state.resultUrl = URL.createObjectURL(blob);
      state.resultFilename = parseFilename(contentDisposition);
      ui.download.href = state.resultUrl;
      ui.download.setAttribute('download', state.resultFilename);
      ui.download.classList.add('is-visible');
      setStatus('success', 'Traitement terminé. Téléchargez le résultat.');
    } catch (err) {
      if (err && err.name === 'AbortError') setStatus('error', 'Délai dépassé. Réessayez avec un lot plus petit.');
      else setStatus('error', (err && err.message) ? err.message : 'Erreur inattendue.');
    } finally {
      state.processing = false;
      updateActions();
    }
  }

  function resetFiles() {
    if (state.processing) return;
    state.files = [];
    revokeResultUrl();
    ui.download.href = '#';
    ui.download.removeAttribute('download');
    ui.download.classList.remove('is-visible');
    setStatus('', '');
    renderFileList();
  }

  async function processText() {
    const value = (ui.textInput.value || '').trim();
    const cacheKey = currentTextConfigKey(value);
    if (!value) {
      resetTextCache();
      setTextOutput('Ajoutez un texte à traiter.', false, null, null, 0);
      ui.textOutput.classList.remove('agf-text-output--loading');
      ui.textOutput.setAttribute('aria-busy', 'false');
      return;
    }
    if (value.length < MIN_TEXT_LENGTH_FOR_API) {
      resetTextCache();
      setTextOutput('Saisissez au moins ' + MIN_TEXT_LENGTH_FOR_API + ' caractères pour lancer le traitement.', false, null, null, 0);
      ui.textOutput.classList.remove('agf-text-output--loading');
      ui.textOutput.setAttribute('aria-busy', 'false');
      return;
    }
    if (state.textProcessing) {
      textProcessQueued = true;
      return;
    }
    if (lastProcessedCacheKey === cacheKey && lastProcessedResult !== null) {
      setTextOutput(lastProcessedResult, lastProcessedHasTags, lastProcessedHtml, lastProcessedStats, lastProcessedCounts);
      ui.textOutput.classList.remove('agf-text-output--loading');
      ui.textOutput.setAttribute('aria-busy', 'false');
      return;
    }
    state.textProcessing = true;
    const requestSerial = ++textRequestSerial;
    ui.textOutput.textContent = 'Traitement en cours...';
    ui.textOutput.classList.add('agf-text-output--loading');
    ui.textOutput.setAttribute('aria-busy', 'true');

    try { await ensureAuth(); } catch (e) {
      setTextOutput(e.message || 'Authentification indisponible.', false, null, null, 0);
      state.textProcessing = false;
      ui.textOutput.classList.remove('agf-text-output--loading');
      ui.textOutput.setAttribute('aria-busy', 'false');
      return;
    }

    const payload = new FormData();
    payload.append('username', state.email);
    payload.append('token', state.token);
    payload.append('edition', state.edition);
    payload.append('forceTextFormat', 'true');
    const entities = selectedEntities();
    if (entities.length) payload.append('entityTypes', JSON.stringify(entities));
    const inc = (state.includeTerms || []).join('\n').trim();
    if (inc) payload.append('includeTerms', inc);
    const exc = (state.excludeTerms || []).join('\n').trim();
    if (exc) payload.append('excludeTerms', exc);
    if (state.mode === 'pseudonymiser' && state.pseudoConfig) {
      payload.append('processingMode', 'pseudonymiser');
      payload.append('pseudoStrategy', state.pseudoConfig.strategy || '');
      payload.append('pseudoScope', state.pseudoConfig.scope || '');
      payload.append('pseudoKeyMode', state.pseudoConfig.keyMode || '');
      payload.append('pseudoRestoreWindow', state.pseudoConfig.restoreWindow || '');
      payload.append('pseudoDeterministic', state.pseudoConfig.deterministic ? 'true' : 'false');
      payload.append('pseudoPreserveFormat', state.pseudoConfig.preserveFormat ? 'true' : 'false');
    }
    payload.append('fileUpload1', new Blob([value], { type: 'text/plain;charset=utf-8' }), 'input.txt');

    try {
      const response = await fetchWithTimeout(ANON_TEXT_ENDPOINT, { method: 'POST', body: payload }, REQUEST_TIMEOUT);
      if (!response.ok) {
        const raw = await response.text();
        let msg = 'Erreur de traitement du texte.';
        try { const json = JSON.parse(raw); if (json && (json.userErrorMessage || json.errorMessage)) msg = json.userErrorMessage || json.errorMessage; }
        catch (err) { if (raw && raw.length < 220) msg = raw; }
        throw new Error(msg);
      }
      const blob = await response.blob();
      const raw = await blob.text();
      // Backend peut renvoyer 200 avec status KO (ex: timeout)
      let json;
      try { json = JSON.parse(raw); } catch (_) { json = null; }
      if (json && json.status === 'KO') {
        const msg = json.userErrorMessage || json.errorMessage || 'Erreur de traitement.';
        throw new Error(msg);
      }
      const out = applyStructuredResponse(raw);
      if (requestSerial !== textRequestSerial) return;
      lastProcessedCacheKey = cacheKey;
      lastProcessedResult = out.plain;
      lastProcessedHasTags = out.useTags;
      lastProcessedHtml = out.html || null;
      lastProcessedStats = out.stats || null;
      lastProcessedCounts = typeof out.total === 'number' ? out.total : null;
      setTextOutput(out.plain, out.useTags, lastProcessedHtml, out.stats, out.total);
    } catch (err) {
      if (requestSerial !== textRequestSerial) return;
      if (err && err.name === 'AbortError') setTextOutput('Délai dépassé. Réessayez avec un texte plus court.', false, null, null, 0);
      else setTextOutput((err && err.message) ? err.message : 'Erreur inattendue.', false, null, null, 0);
    } finally {
      state.textProcessing = false;
      ui.textOutput.classList.remove('agf-text-output--loading');
      ui.textOutput.setAttribute('aria-busy', 'false');
      if (textProcessQueued) {
        textProcessQueued = false;
        processText();
      }
    }
  }

  function setTextOutput(plain, useTags, html, stats, total) {
    if (useTags && html) ui.textOutput.innerHTML = html;
    else ui.textOutput.textContent = plain || 'Le texte traité apparaîtra ici';
    renderOutputStats(plain || '', stats || null, typeof total === 'number' ? total : null);
  }

  function scheduleDebouncedText() {
    if (debounceTextTimer) clearTimeout(debounceTextTimer);
    debounceTextTimer = setTimeout(() => {
      debounceTextTimer = null;
      processText();
    }, DEBOUNCE_TEXT_MS);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function buildOutputWithTags(processedText) {
    if (!processedText) return { plain: processedText || '', useTags: false };
    const escaped = escapeHtml(processedText);
    const re = new RegExp('\\[(' + ENTITY_TYPES_TAG.join('|') + ')\\]', 'g');
    const html = escaped.replace(re, (_, type) => '<span class="agf-tag agf-tag-' + type + '">' + type + '</span>');
    if (html === escaped) return { plain: processedText, useTags: false };
    return { plain: processedText, useTags: true, html };
  }

  function extractEntityStats(processedText) {
    const counts = {};
    if (!processedText) return counts;
    let match;
    while ((match = PLACEHOLDER_RE.exec(processedText)) !== null) {
      const code = match[1];
      counts[code] = (counts[code] || 0) + 1;
    }
    PLACEHOLDER_RE.lastIndex = 0;
    return counts;
  }

  function renderOutputStats(processedText, explicitStats, explicitTotal) {
    if (!ui.outputSummary || !ui.outputEntities) return;

    const stats = explicitStats && typeof explicitStats === 'object'
      ? explicitStats
      : extractEntityStats(processedText);
    const entries = Object.entries(stats)
      .map((entry) => [entry[0], Number(entry[1] || 0)])
      .filter((entry) => entry[1] > 0)
      .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
      });
    const total = typeof explicitTotal === 'number'
      ? explicitTotal
      : entries.reduce((sum, item) => sum + item[1], 0);

    ui.outputEntities.textContent = '';
    if (total === 0) {
      ui.outputSummary.textContent = 'Aucun champ anonymisé détecté.';
      if (ui.lastMaskInfo) ui.lastMaskInfo.textContent = 'Champs anonymisés (texte): 0';
      return;
    }

    ui.outputSummary.textContent = total + ' champ(s) anonymisé(s) détecté(s) sur le dernier traitement texte.';
    if (ui.lastMaskInfo) ui.lastMaskInfo.textContent = 'Champs anonymisés (texte): ' + total;

    entries.forEach((entry) => {
      const chip = document.createElement('span');
      chip.className = 'agf-output-entity-chip';
      chip.textContent = entry[0] + ': ' + entry[1];
      ui.outputEntities.appendChild(chip);
    });
  }

  function applyStructuredResponse(raw) {
    let plain = (raw && raw.trim()) ? raw : 'Aucun contenu retourné.';
    let stats = null;
    let total = null;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data.processedText === 'string') plain = data.processedText;
      if (data && data.audit && data.audit.entityCounts && typeof data.audit.entityCounts === 'object') {
        stats = data.audit.entityCounts;
      } else if (data && Array.isArray(data.entities)) {
        stats = {};
        data.entities.forEach((entity) => {
          const code = entity && entity.type;
          if (!code || typeof code !== 'string') return;
          stats[code] = (stats[code] || 0) + 1;
        });
      }
      if (stats) {
        total = Object.values(stats).reduce((sum, n) => sum + Number(n || 0), 0);
      }
    } catch (e) {}
    const built = buildOutputWithTags(plain);
    return { plain, useTags: built.useTags, html: built.html, stats, total };
  }

  function applyEditionLocks() {
    ui.openTypes.classList.remove('is-locked');
    ui.openInclusion.classList.remove('is-locked');
  }

  function shouldCallApiMeta() {
    if (!ui.apiMeta) return false;
    const footer = ui.apiMeta.closest('.agf-api-footer');
    if (!footer) return false;
    const styles = window.getComputedStyle(footer);
    return styles.display !== 'none' && styles.visibility !== 'hidden';
  }

  function bindEvents() {
    ui.form.addEventListener('submit', submitFiles);
    ui.reset.addEventListener('click', resetFiles);

    ui.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => setActiveTab(tab.getAttribute('data-tab')));
      tab.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        let nextIndex = index;
        if (e.key === 'ArrowRight') nextIndex = (index + 1) % ui.tabs.length;
        if (e.key === 'ArrowLeft') nextIndex = (index - 1 + ui.tabs.length) % ui.tabs.length;
        if (e.key === 'Home') nextIndex = 0;
        if (e.key === 'End') nextIndex = ui.tabs.length - 1;
        const nextTab = ui.tabs[nextIndex];
        if (!nextTab) return;
        setActiveTab(nextTab.getAttribute('data-tab'));
        nextTab.focus();
      });
    });

    ui.dropzone.addEventListener('click', () => ui.input.click());
    ui.dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.input.click(); } });
    ui.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); ui.dropzone.classList.add('is-dragover'); });
    ['dragleave', 'dragend'].forEach((evt) => ui.dropzone.addEventListener(evt, () => ui.dropzone.classList.remove('is-dragover')));
    ui.dropzone.addEventListener('drop', (e) => { e.preventDefault(); ui.dropzone.classList.remove('is-dragover'); if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
    ui.input.addEventListener('change', (e) => { if (e.target.files) addFiles(e.target.files); ui.input.value = ''; });

    ui.textInput.addEventListener('input', scheduleDebouncedText);
    ui.textInput.addEventListener('keyup', scheduleDebouncedText);
    ui.textClear.addEventListener('click', () => {
      textRequestSerial += 1;
      textProcessQueued = false;
      ui.textInput.value = '';
      resetTextCache();
      setTextOutput('Le texte traité apparaîtra ici', false, null, null, 0);
      if (debounceTextTimer) {
        clearTimeout(debounceTextTimer);
        debounceTextTimer = null;
      }
    });
    if (ui.textCopy) ui.textCopy.addEventListener('click', () => { const t = lastProcessedResult != null ? lastProcessedResult : (ui.textOutput.innerText || '').trim(); if (t && t !== 'Le texte traité apparaîtra ici') { navigator.clipboard.writeText(t).then(() => { ui.textCopy.innerHTML = 'Copié\u00a0!'; setTimeout(() => { ui.textCopy.innerHTML = '<span class="agf-icon-copy" aria-hidden="true"></span>Copier'; }, 1200); }); } });

    ui.modeRadios.forEach((radio) => radio.addEventListener('change', () => {
      setMode(radio.value);
      refreshTextIfNeeded();
    }));

    ui.pseudoMode.addEventListener('click', () => openModal(ui.modals.pseudo));
    ui.pseudoSaved.addEventListener('click', () => openModal(ui.modals.pseudo));
    ui.openTypes.addEventListener('click', () => openModal(ui.modals.types));
    ui.openInclusion.addEventListener('click', () => openModal(ui.modals.inclusion));
    ui.upgradeRestore.addEventListener('click', () => openModal(ui.modals.pseudo));

    ui.modalTypesClose.addEventListener('click', () => closeModal(ui.modals.types));
    if (ui.modalPseudoClose) ui.modalPseudoClose.addEventListener('click', () => closeModal(ui.modals.pseudo));
    ui.modalIncClose.addEventListener('click', () => closeModal(ui.modals.inclusion));

    ui.defaultsTypes.addEventListener('click', () => {
      Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
        chk.checked = DEFAULT_ENTITIES.includes(chk.getAttribute('data-entity'));
      });
      resetTextCache();
      renderTypeCount();
      refreshTextIfNeeded();
    });

    if (ui.detectAllTypes) ui.detectAllTypes.addEventListener('click', () => {
      Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => { chk.checked = true; });
      resetTextCache();
      renderTypeCount();
      refreshTextIfNeeded();
    });

    if (ui.ignoreAllTypes) ui.ignoreAllTypes.addEventListener('click', () => {
      Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => { chk.checked = false; });
      resetTextCache();
      renderTypeCount();
      refreshTextIfNeeded();
    });

    ui.saveTypes.addEventListener('click', () => {
      storage.set(STORAGE_TYPES, JSON.stringify(selectedVisualEntities()));
      resetTextCache();
      renderTypeCount();
      closeModal(ui.modals.types);
      refreshTextIfNeeded();
    });

    if (ui.pseudoDefaults) ui.pseudoDefaults.addEventListener('click', () => {
      state.pseudoConfig = { ...DEFAULT_PSEUDO_CONFIG };
      applyPseudoToUi(state.pseudoConfig);
      renderPseudoSummary();
    });

    if (ui.savePseudo) ui.savePseudo.addEventListener('click', () => {
      state.pseudoConfig = readPseudoFromUi();
      storage.set(STORAGE_PSEUDO, JSON.stringify(state.pseudoConfig));
      resetTextCache();
      setMode('pseudonymiser');
      setStatus('success', 'Politique de pseudonymisation enregistrée.');
      closeModal(ui.modals.pseudo);
      refreshTextIfNeeded();
    });

    if (ui.includeAdd) ui.includeAdd.addEventListener('click', () => {
      if (addTerm('include', ui.includeInput ? ui.includeInput.value : '')) {
        if (ui.includeInput) ui.includeInput.value = '';
        if (ui.includeInput) ui.includeInput.focus();
        resetTextCache();
        refreshTextIfNeeded();
      }
    });

    if (ui.excludeAdd) ui.excludeAdd.addEventListener('click', () => {
      if (addTerm('exclude', ui.excludeInput ? ui.excludeInput.value : '')) {
        if (ui.excludeInput) ui.excludeInput.value = '';
        if (ui.excludeInput) ui.excludeInput.focus();
        resetTextCache();
        refreshTextIfNeeded();
      }
    });

    if (ui.includeInput) ui.includeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (addTerm('include', ui.includeInput.value)) {
          ui.includeInput.value = '';
          resetTextCache();
          refreshTextIfNeeded();
        }
      }
    });

    if (ui.excludeInput) ui.excludeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (addTerm('exclude', ui.excludeInput.value)) {
          ui.excludeInput.value = '';
          resetTextCache();
          refreshTextIfNeeded();
        }
      }
    });

    if (ui.inclusionDefaults) ui.inclusionDefaults.addEventListener('click', () => {
      state.includeTerms = [];
      state.excludeTerms = [];
      syncHiddenTermFields();
      renderTermList('include');
      renderTermList('exclude');
      renderInclusionSummary();
      resetTextCache();
      refreshTextIfNeeded();
    });

    ui.saveInclusion.addEventListener('click', () => {
      if (ui.includeInput && ui.includeInput.value) {
        addTerm('include', ui.includeInput.value);
        ui.includeInput.value = '';
      }
      if (ui.excludeInput && ui.excludeInput.value) {
        addTerm('exclude', ui.excludeInput.value);
        ui.excludeInput.value = '';
      }
      syncHiddenTermFields();
      storage.set(STORAGE_INC, (ui.includeTerms && ui.includeTerms.value) || '');
      storage.set(STORAGE_EXC, (ui.excludeTerms && ui.excludeTerms.value) || '');
      resetTextCache();
      setStatus('success', "Listes d'inclusion/exclusion enregistrées.");
      closeModal(ui.modals.inclusion);
      refreshTextIfNeeded();
    });

    if (ui.manualAuthToggle && ui.manualAuth && ui.manualAuthFields) {
      ui.manualAuthToggle.addEventListener('click', () => {
        const collapsed = ui.manualAuth.classList.toggle('is-collapsed');
        ui.manualAuthFields.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
        ui.manualAuthToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        ui.manualAuthToggle.textContent = collapsed ? 'Utiliser des identifiants manuels' : 'Masquer les identifiants manuels';
      });
    }

    document.addEventListener('keydown', (e) => {
      trapModalFocus(e);
      if (e.key === 'Escape') closeAllModals();
    });

    Object.keys(ui.modals).forEach((key) => {
      const overlay = ui.modals[key];
      if (!overlay) return;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
    });

    Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
      chk.addEventListener('change', () => {
        renderTypeCount();
        resetTextCache();
        refreshTextIfNeeded();
      });
    });

    [ui.manualUsername, ui.manualToken, ui.manualEdition].forEach((field) => {
      if (!field) return;
      field.addEventListener('change', () => {
        state.token = '';
        resetTextCache();
      });
    });
  }

  async function init() {
    await waitForMemberstack(10000, 200);
    state.edition = await detectEdition();
    const editionFromUrl = new URLSearchParams(window.location.search).get('edition');
    if (editionFromUrl) {
      const n = editionFromUrl.toLowerCase();
      if (['free', 'pro', 'ent', 'business', 'anonymisation'].includes(n)) state.edition = n === 'business' ? 'ent' : n;
    }
    storage.set('agilo:edition', state.edition);
    if (ui.manualEdition) ui.manualEdition.value = state.edition;

    state.email = await getUserEmail();
    if (state.email && !getManualAuth()) await getToken(state.email, state.edition, 0).catch(() => {});

    bindEvents();
    setActiveTab('file');
    loadPreferences();
    applyEditionLocks();
    renderFileList();
    updateActions();
    if (shouldCallApiMeta()) {
      runSessionMaintenance();
      loadApiVersion();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
