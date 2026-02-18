(function () {
  'use strict';
  // UTF-8; textes FR avec accents
  window.__AGILO_EMBED_ANON_VERSION__ = '1.0.2';

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_ENDPOINT = API_BASE + '/getToken';
  const ANON_ENDPOINT = API_BASE + '/anonOfficeText';
  const ANON_TEXT_ENDPOINT = API_BASE + '/anonText';
  const CLEANUP_ENDPOINT = API_BASE + '/cleanupOldJobs';
  const VERSION_ENDPOINT = API_BASE + '/getVersion';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES = 12;
  const SUPPORTED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'json', 'fec'];
  const IMAGE_EXT = ['png', 'jpg', 'jpeg'];
  const REQUEST_TIMEOUT = 7200000; // 2 h (FEC 40+ min)
  const query = new URLSearchParams(window.location.search);
  const runtimeFeatureFlags = window.AGILO_FEATURE_FLAGS || {};
  const FEATURE_AVAILABILITY = Object.freeze({
    pseudo: runtimeFeatureFlags.pseudo === true || query.get('featurePseudo') === '1',
    inclusion: runtimeFeatureFlags.inclusion === true || query.get('featureInclusion') === '1'
  });

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
    processedItems: [],
    edition: 'free',
    mode: 'anonymiser',
    email: null,
    token: '',
    processing: false,
    resultUrl: null,
    resultFilename: 'document_anonymisé',
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
  const ENTITY_TYPES_TAG = ['PR', 'MAIL', 'PHON', 'AGE', 'TR', 'DT', 'CIE', 'CID', 'ACT', 'PROD', 'ORG', 'FILE', 'ADR', 'POST', 'LOC', 'GEO', 'BANK', 'CARD', 'REF', 'MT', 'IBAN', 'URL', 'IP', 'CLAUSE', 'FRNIR', 'FRPASS', 'FRCNI', 'SIREN', 'SIRET', 'TVA', 'BIC', 'OTHER'];
  const PLACEHOLDER_RE = /\[([A-Za-z0-9_]{2,32})\]/g;
  /** Backend (Nicolas/spacy-anon) placeholders → code affiché dans l’UI. Tous les tags backend doivent avoir une entrée pour éviter OTHER. */
  const TAG_ALIAS = {
    PR: 'PR',
    PERSON: 'PR',
    PERSON_NAME: 'PR',
    PER: 'PR',
    NAME: 'PR',
    MAIL: 'MAIL',
    EMAIL: 'MAIL',
    E_MAIL: 'MAIL',
    PHON: 'PHON',
    PHONE: 'PHON',
    TEL: 'PHON',
    TELEPHONE: 'PHON',
    MOBILE: 'PHON',
    ADR: 'ADR',
    ADDRESS: 'ADR',
    STREET_ADDRESS: 'ADR',
    POST: 'POST',
    POSTAL: 'POST',
    POSTCODE: 'POST',
    POSTAL_CODE: 'POST',
    ZIP: 'POST',
    ZIP_CODE: 'POST',
    LOC: 'LOC',
    LOCATION: 'LOC',
    LOCALISATION: 'LOC',
    GPE: 'LOC',
    CITY: 'LOC',
    REGION: 'LOC',
    ORG: 'ORG',
    ORGANIZATION: 'ORG',
    ORGANISATION: 'ORG',
    COMPANY: 'ORG',
    CIE: 'ORG',
    CID: 'SIREN',
    SIREN: 'SIREN',
    SIRET: 'SIRET',
    TVA: 'TVA',
    VAT: 'TVA',
    IBAN: 'IBAN',
    RIB: 'IBAN',
    RIB_KEY: 'IBAN',
    BIC: 'BIC',
    SWIFT: 'BIC',
    FRNIR: 'FRNIR',
    NIR: 'FRNIR',
    NSS: 'FRNIR',
    DT: 'DT',
    DATE: 'DT',
    DATETIME: 'DT',
    TIME: 'DT',
    BIRTH_DATE: 'DT',
    BIRTH_PLACE: 'LOC',
    URL: 'URL',
    URSSAF_ID: 'SIREN',
    FISCAL_ID: 'SIREN',
    APE: 'SIREN',
    OTHER: 'OTHER'
  };
  const API_READY_VALUES = ['person_name', 'email', 'phone', 'birth', 'role', 'address', 'company', 'siren', 'accounting', 'product', 'contract', 'bank'];
  /** Types proposés dans la grille (doivent correspondre à des data-entity présents dans #agfTypeGrid). POST/URL activés dynamiquement même si disabled dans le HTML. */
  const TYPES_AVAILABLE = ['PR', 'MAIL', 'PHON', 'DT', 'CID', 'ORG', 'LOC', 'IBAN', 'FRNIR', 'POST', 'URL'];
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const storage = createSafeStorage();

  const ui = {
    form: document.getElementById('agfForm'),
    tabs: Array.from(document.querySelectorAll('.agf-tab')),
    panels: { file: document.getElementById('agfPanel-file'), text: document.getElementById('agfPanel-text'), restore: document.getElementById('agfPanel-restore') },
    dropzone: document.getElementById('agfDropzone'),
    input: document.getElementById('agfFileInput'),
    fileList: document.getElementById('agfFileList'),
    titleFileList: document.getElementById('agfTitleFileList'),
    processedWrap: document.getElementById('agfProcessedWrap'),
    processedList: document.getElementById('agfProcessedList'),
    clearProcessed: document.getElementById('agfClearProcessed'),
    downloadZip: document.getElementById('agfDownloadZip'),
    actionsSubmit: document.getElementById('agfActionsSubmit'),
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
    pseudoSavedBadge: document.getElementById('agfPseudoSavedBadge'),
    pseudoAvailabilityHint: document.getElementById('agfPseudoAvailabilityHint'),
    inclusionAvailabilityHint: document.getElementById('agfInclusionAvailabilityHint'),
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
    modalTypesBetaOverlay: document.getElementById('agfModalTypesBetaOverlay'),
    modalTypesBetaClose: document.getElementById('agfModalTypesBetaClose'),
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
    pseudoReadonlyZone: document.getElementById('agfPseudoReadonlyZone'),
    pseudoPreviewNote: document.getElementById('agfPseudoPreviewNote'),
    saveTypes: document.getElementById('agfSaveTypes'),
    saveInclusion: document.getElementById('agfSaveInclusion'),
    inclusionDefaults: document.getElementById('agfInclusionDefaults'),
    inclusionReadonlyZone: document.getElementById('agfInclusionReadonlyZone'),
    inclusionPreviewNote: document.getElementById('agfInclusionPreviewNote'),
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

  const DEFAULT_ENTITIES = ['PR', 'MAIL', 'PHON', 'DT', 'CID', 'ORG', 'LOC', 'IBAN', 'FRNIR', 'POST', 'URL'];
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
    const inclusionTerms = isFeatureEnabled('inclusion') ? (state.includeTerms || []) : [];
    const exclusionTerms = isFeatureEnabled('inclusion') ? (state.excludeTerms || []) : [];
    const pseudoCfg = isFeatureEnabled('pseudo') ? (state.pseudoConfig || {}) : {};
    return [
      (text || '').trim(),
      state.mode,
      toSortedJson(selectedVisualEntities()),
      toSortedJson(selectedEntities()),
      inclusionTerms.join('|'),
      exclusionTerms.join('|'),
      toSortedJson(pseudoCfg)
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
    let value = '';
    document.querySelectorAll('#agfInputText').forEach(el => {
      const v = (el.value || '').trim();
      if (v) value = v;
    });
    if (!value || value.length < MIN_TEXT_LENGTH_FOR_API) return;
    scheduleDebouncedText();
  }

  function setStatus(kind, message) {
    const statuses = document.querySelectorAll('#agfStatus');
    statuses.forEach((statusEl) => {
      if (!message) {
        statusEl.classList.remove('is-visible');
        statusEl.removeAttribute('data-kind');
        statusEl.textContent = '';
        return;
      }
      statusEl.classList.add('is-visible');
      statusEl.setAttribute('data-kind', kind);
      statusEl.textContent = '';
      if (kind === 'loading') {
        const spinner = document.createElement('span');
        spinner.className = 'agf-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        statusEl.appendChild(spinner);
      }
      const txt = document.createElement('span');
      txt.textContent = message;
      statusEl.appendChild(txt);
    });
  }

  function isFeatureEnabled(featureName) {
    return !!FEATURE_AVAILABILITY[featureName];
  }

  function setReadonlyControls(root, readonly) {
    if (!root) return;
    const controls = root.querySelectorAll('input, select, textarea, button');
    controls.forEach((node) => {
      if (!Object.prototype.hasOwnProperty.call(node.dataset, 'agfInitiallyDisabled')) {
        node.dataset.agfInitiallyDisabled = node.disabled ? '1' : '0';
      }
      const initiallyDisabled = node.dataset.agfInitiallyDisabled === '1';
      node.disabled = readonly || initiallyDisabled;
    });
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
    if (el === ui.modals.types && ui.modalTypesBetaOverlay) ui.modalTypesBetaOverlay.classList.remove('is-dismissed');
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

  function revokeAllProcessedUrls() {
    state.processedItems.forEach((item) => {
      if (item.resultUrl) {
        URL.revokeObjectURL(item.resultUrl);
        item.resultUrl = null;
      }
      item.resultBlob = null;
    });
  }

  function updateActions() {
    const hasPending = state.files.length > 0;
    const hasProcessed = state.processedItems.length > 0;

    document.querySelectorAll('#agfSubmit').forEach(el => { el.disabled = state.processing || !hasPending; });
    document.querySelectorAll('#agfActionsSubmit').forEach(el => { el.hidden = !hasPending; });
    document.querySelectorAll('#agfProcessedWrap').forEach(el => { el.hidden = !hasProcessed; });
    document.querySelectorAll('#agfFileList').forEach(el => { el.hidden = !hasPending; });
    document.querySelectorAll('#agfTitleFileList').forEach(el => { el.hidden = !hasPending; });

    const doneCount = state.processedItems.filter((p) => p.status === 'done' && (p.resultBlob || p.resultUrl)).length;
    document.querySelectorAll('#agfDownloadZip').forEach(el => {
      el.hidden = doneCount < 2;
      el.title = doneCount >= 2 ? 'Télécharger les fichiers terminés en une archive (.zip)' : '';
      el.disabled = state.processing || doneCount < 2;
    });
  }

  function createFileRow(item) {
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
    return row;
  }

  function renderFileList() {
    const lists = document.querySelectorAll('#agfFileList');
    lists.forEach((list) => {
      list.textContent = '';
      if (state.files.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'agf-empty';
        empty.textContent = 'Aucun fichier pour l\'instant. Glissez-déposez ou cliquez au-dessus pour en ajouter.';
        list.appendChild(empty);
      } else {
        state.files.forEach((item) => {
          list.appendChild(createFileRow(item));
        });
      }
    });
    updateActions();
  }


  function createProcessedCard(item) {
    const card = document.createElement('div');
    card.className = 'agf-processed-card agf-processed-card--' + item.status;
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-status', item.status);

    const original = document.createElement('div');
    original.className = 'agf-processed-original';
    original.innerHTML = '<div class="agf-file-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg></div><div class="agf-file-info"><p class="agf-file-name" title="' + escapeHtml(item.fileName) + '">' + escapeHtml(item.fileName) + '</p><p class="agf-file-meta">' + formatSize(item.size) + '</p></div>';
    card.appendChild(original);

    const arrow = document.createElement('div');
    arrow.className = 'agf-processed-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    card.appendChild(arrow);

    const result = document.createElement('div');
    result.className = 'agf-processed-result';
    if (item.status === 'pending') {
      result.innerHTML = '<div class="agf-file-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/></svg></div><div class="agf-file-info"><p class="agf-file-name">En attente</p><p class="agf-file-meta">—</p></div>';
    } else if (item.status === 'processing') {
      result.innerHTML = '<div class="agf-file-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg></div><div class="agf-file-info" style="flex:1;min-width:0"><p class="agf-file-name">Traitement en cours…</p><div class="agf-processed-progress"><div class="agf-processed-progress-bar" style="width:70%"></div></div></div>';
    } else if (item.status === 'error') {
      result.innerHTML = '<div class="agf-file-icon agf-file-icon--error"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></div><div class="agf-file-info"><p class="agf-file-name">Erreur</p><p class="agf-file-meta">' + escapeHtml(sanitizeApiErrorMessage(item.errorMessage || 'Échec')) + '</p></div>';
    } else {
      const name = (item.resultFilename || item.fileName) + '';
      result.innerHTML = '<div class="agf-file-icon agf-file-icon--done" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></div><div class="agf-file-info"><p class="agf-file-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</p><p class="agf-file-meta">' + (item.resultSize ? formatSize(item.resultSize) : '—') + '</p></div>';
      const actions = document.createElement('div');
      actions.className = 'agf-processed-actions';
      const dl = document.createElement('a');
      dl.href = item.resultUrl || '#';
      dl.setAttribute('download', item.resultFilename || name);
      dl.className = 'agf-btn-icon';
      dl.title = 'Télécharger';
      dl.setAttribute('aria-label', 'Télécharger ' + name);
      dl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';
      actions.appendChild(dl);
      result.appendChild(actions);
    }
    card.appendChild(result);
    if (item.justDone) {
      card.classList.add('agf-processed-card--just-done');
      setTimeout(function () { card.classList.remove('agf-processed-card--just-done'); }, 2200);
    }
    return card;
  }

  function renderProcessedList() {
    const lists = document.querySelectorAll('#agfProcessedList');
    lists.forEach((list) => {
      list.textContent = '';
      state.processedItems.forEach((item) => {
        list.appendChild(createProcessedCard(item));
      });
    });
    // Clear justDone flag after rendering all lists
    state.processedItems.forEach((item) => { item.justDone = false; });
    updateActions();
  }

  function validateFile(file) {
    if (!file || file.size > MAX_FILE_SIZE) return false;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return SUPPORTED_EXT.includes(ext);
  }

  function getRejectReason(file) {
    if (!file) return 'format';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (IMAGE_EXT.includes(ext)) return 'image';
    if (file.size > MAX_FILE_SIZE) return 'size';
    if (!SUPPORTED_EXT.includes(ext)) return 'format';
    return null;
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const rejectedImages = [];
    const rejectedOther = [];
    const maxToAdd = MAX_FILES - state.files.length;
    if (maxToAdd <= 0) {
      setStatus('error', 'Maximum ' + MAX_FILES + ' fichiers. Retirez-en avant d\'en ajouter.');
      renderFileList();
      return;
    }
    const toAdd = files.slice(0, maxToAdd);
    toAdd.forEach((file) => {
      const reason = getRejectReason(file);
      if (reason === 'image') rejectedImages.push(file.name);
      else if (reason) rejectedOther.push(file.name);
      else state.files.push({ id: uid(), file, fileName: file.name, size: file.size });
    });
    if (files.length > maxToAdd) {
      setStatus('error', 'Maximum ' + MAX_FILES + ' fichiers. Seuls les ' + maxToAdd + ' premiers ont été ajoutés.');
    } else if (rejectedImages.length > 0) {
      setStatus('error', 'Les images (PNG, JPEG, etc.) ne sont pas encore prises en charge. Ce sera disponible prochainement.');
    } else if (rejectedOther.length > 0) {
      const short = rejectedOther.slice(0, 2).join(', ');
      const more = rejectedOther.length > 2 ? ' +' + (rejectedOther.length - 2) + ' autre(s)' : '';
      setStatus('error', 'Format non accepté ou fichier > 10 Mo : ' + short + more + '.');
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
      .filter((c) => !c.disabled && c.checked)
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
    if (ui.savedTypesInfo) ui.savedTypesInfo.textContent = total + ' type(s) actif(s) (dont ' + apiReady + ' envoyés à l\'API).';

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
      } catch (e) { }
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
    const canEdit = isFeatureEnabled('inclusion');
    if (!wrap) return;

    wrap.textContent = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'agf-term-empty';
      empty.textContent = kind === 'include'
        ? 'Pas encore de terme à inclure.'
        : 'Pas encore de terme à exclure.';
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
      rm.disabled = !canEdit;
      if (canEdit) {
        rm.addEventListener('click', () => {
          if (kind === 'include') state.includeTerms.splice(idx, 1);
          else state.excludeTerms.splice(idx, 1);
          syncHiddenTermFields();
          renderTermList(kind);
          renderInclusionSummary();
          resetTextCache();
          refreshTextIfNeeded();
        });
      }
      row.appendChild(txt);
      row.appendChild(rm);
      wrap.appendChild(row);
    });
  }

  function renderInclusionSummary() {
    const i = state.includeTerms.length;
    const e = state.excludeTerms.length;
    const previewSuffix = isFeatureEnabled('inclusion') ? '' : ' · aperçu non appliqué';
    if (ui.incSummary) ui.incSummary.textContent = 'Inclusion: ' + i + ' · Exclusion: ' + e + previewSuffix;
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

  function setMode(mode, options) {
    const opts = options || {};
    const wantsPseudo = mode === 'pseudonymiser';
    const pseudoEnabled = isFeatureEnabled('pseudo');
    if (wantsPseudo && !pseudoEnabled) {
      state.mode = 'anonymiser';
      if (!opts.silent) setStatus('info', 'Pseudonymisation en mode aperçu pour le moment. Activation backend en cours.');
    } else {
      state.mode = wantsPseudo ? 'pseudonymiser' : 'anonymiser';
    }
    const pseudoActive = state.mode === 'pseudonymiser';
    if (ui.pseudoMode) ui.pseudoMode.classList.toggle('is-active', pseudoActive);
    if (ui.pseudoBadge) {
      if (!pseudoEnabled) ui.pseudoBadge.textContent = 'Bientôt';
      else ui.pseudoBadge.textContent = pseudoActive ? 'Actif' : 'Paramétrer';
    }
    const anonRadio = (ui.modeRadios || []).find((r) => r.value === 'anonymiser');
    if (anonRadio) anonRadio.checked = !pseudoActive;
    storage.set(STORAGE_MODE, state.mode);
    resetTextCache();
    renderPseudoSummary();
  }

  function renderPseudoSummary() {
    const cfg = state.pseudoConfig || DEFAULT_PSEUDO_CONFIG;
    if (ui.pseudoSummary) {
      if (!isFeatureEnabled('pseudo')) {
        ui.pseudoSummary.textContent = 'Pseudo: aperçu disponible · activation backend en cours';
        return;
      }
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
          const mapped = parsed.map((item) => legacyMap[item] || item);
          entities = mapped.filter((code) => TYPES_AVAILABLE.includes(code));
          if (entities.length === 0) entities = DEFAULT_ENTITIES;
        }
      } catch (e) { }
    }
    const availableSet = new Set(TYPES_AVAILABLE);
    Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
      const code = chk.getAttribute('data-entity');
      const isAvailable = availableSet.has(code);
      // Dynamically enable/disable based on TYPES_AVAILABLE (overrides HTML disabled attr)
      chk.disabled = !isAvailable;
      const label = chk.closest('.agf-entity-option');
      if (label) {
        if (isAvailable) {
          label.classList.remove('agf-entity-option--unavailable');
        } else {
          label.classList.add('agf-entity-option--unavailable');
        }
      }
      chk.checked = isAvailable && entities.includes(code);
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
    } catch (e) { }
    applyPseudoToUi(state.pseudoConfig);
    renderPseudoSummary();
    const storedMode = storage.get(STORAGE_MODE);
    setMode(storedMode === 'pseudonymiser' ? 'pseudonymiser' : 'anonymiser', { silent: true });

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
    const fromPage = document.querySelector('[name="memberEmail"]')?.value || document.querySelector('[data-ms-member="email"]')?.textContent?.trim() || document.getElementById('memberEmail')?.value || null;
    if (fromPage) return fromPage;
    return (typeof storage !== 'undefined' && storage.get('agilo:username')) || null;
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
      throw new Error(sanitizeApiErrorMessage((data && (data.userErrorMessage || data.errorMessage)) || 'Token invalide'));
    } catch (err) {
      if (current < maxRetry) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (current + 1)));
        return getToken(email, edition, current + 1);
      }
      throw err;
    }
  }

  var BAD_MANUAL_TOKEN = 'admin124*$';
  function getManualAuth() {
    const username = (ui.manualUsername && ui.manualUsername.value || '').trim();
    const token = (ui.manualToken && ui.manualToken.value || '').trim();
    const edition = (ui.manualEdition && ui.manualEdition.value || '').trim();
    if (!username || !token || !edition) return null;
    if (token === BAD_MANUAL_TOKEN || token.indexOf('admin124') !== -1) {
      if (ui.manualToken) ui.manualToken.value = '';
      return null;
    }
    return { username, token, edition };
  }

  async function ensureAuth() {
    const manual = getManualAuth();
    if (manual) {
      state.email = manual.username;
      state.token = manual.token;
      state.edition = manual.edition;
      return;
    }
    if (!state.email) state.email = await getUserEmail();
    if (!state.email) state.email = (document.querySelector('[name="memberEmail"]')?.value || storage.get('agilo:username') || '').trim() || null;
    if (!state.email && typeof window !== 'undefined' && window.globalToken) state.email = (storage.get('agilo:username') || '').trim() || null;
    if (!state.token && typeof window !== 'undefined' && window.globalToken) state.token = window.globalToken;
    if (!state.email) throw new Error('Email utilisateur introuvable. Vérifiez que vous êtes connecté ou ajoutez le script Token Resolver en tête de page.');
    if (!state.token) await getToken(state.email, state.edition, 0);
  }

  async function runSessionMaintenance() {
    if (!state.email || !state.token) return;
    const cleanupUrl = CLEANUP_ENDPOINT + '?username=' + encodeURIComponent(state.email) + '&token=' + encodeURIComponent(state.token) + '&edition=' + encodeURIComponent(state.edition || 'free');
    try { await fetchWithTimeout(cleanupUrl, { method: 'GET' }, 15000); } catch (e) { }
  }

  async function loadApiVersion() {
    try {
      const response = await fetchWithTimeout(VERSION_ENDPOINT, { method: 'GET' }, 10000);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.status === 'OK' && data.version && ui.apiMeta) ui.apiMeta.textContent = 'API: ' + data.version;
    } catch (e) { }
  }

  /** Ne jamais afficher un message d'erreur API qui pourrait contenir un token/mot de passe. */
  function sanitizeApiErrorMessage(msg) {
    if (!msg || typeof msg !== 'string') return 'Erreur de traitement.';
    const m = msg.trim();
    if (m.indexOf('error_invalid_token') !== -1) return 'Erreur d\'authentification. Reconnectez-vous ou vérifiez votre accès.';
    if (m.indexOf('error_internal') !== -1) return 'Erreur serveur. Réessayez plus tard.';
    return m;
  }

  function parseFilename(contentDisposition, fallbackFileName) {
    if (fallbackFileName) {
      const base = fallbackFileName.replace(/\.[^.]+$/, '').trim();
      const ext = (fallbackFileName.match(/\.[^.]+$/) || ['.bin'])[0];
      const suffix = '_anonymisé';
      if (/_\s*anonymis(?:e|é|ed)?\s*$/i.test(base)) return base + ext;
      return (base || 'document') + suffix + ext;
    }
    const match = (contentDisposition || '').match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
    if (match && match[1]) return match[1].replace(/^['"]|['"]$/g, '').trim();
    return 'document_anonymisé';
  }

  function buildFormDataForOneFile(file, fileName) {
    const formData = new FormData();
    formData.append('username', state.email);
    formData.append('token', state.token);
    formData.append('edition', state.edition);
    formData.append('fileUpload[]', file, fileName);
    const entities = selectedEntities();
    if (entities.length) formData.append('entityTypes', JSON.stringify(entities));
    if (isFeatureEnabled('inclusion')) {
      const inc = (state.includeTerms || []).join('\n').trim();
      if (inc) formData.append('includeTerms', inc);
      const exc = (state.excludeTerms || []).join('\n').trim();
      if (exc) formData.append('excludeTerms', exc);
    }
    if (isFeatureEnabled('pseudo') && state.mode === 'pseudonymiser' && state.pseudoConfig) {
      formData.append('processingMode', 'pseudonymiser');
      formData.append('pseudoStrategy', state.pseudoConfig.strategy || '');
      formData.append('pseudoScope', state.pseudoConfig.scope || '');
      formData.append('pseudoKeyMode', state.pseudoConfig.keyMode || '');
      formData.append('pseudoRestoreWindow', state.pseudoConfig.restoreWindow || '');
      formData.append('pseudoDeterministic', state.pseudoConfig.deterministic ? 'true' : 'false');
      formData.append('pseudoPreserveFormat', state.pseudoConfig.preserveFormat ? 'true' : 'false');
    }
    return formData;
  }

  async function processOneFile(item) {
    item.status = 'processing';
    renderProcessedList();
    try {
      const formData = buildFormDataForOneFile(item.file, item.fileName);
      const response = await fetchWithTimeout(ANON_ENDPOINT, { method: 'POST', body: formData }, REQUEST_TIMEOUT);
      if (!response.ok) {
        const raw = await response.text();
        let msg = 'Erreur de traitement.';
        try {
          const json = JSON.parse(raw);
          const code = json && (json.errorCode || json.error_code);
          if (code === 'error_invalid_office_extension') msg = 'Format non accepté.';
          else if (code === 'error_content_size_too_big') msg = 'Fichier trop volumineux.';
          else if (code === 'error_too_many_files') msg = 'Trop de fichiers.';
          else if (json && (json.userErrorMessage || json.errorMessage)) msg = sanitizeApiErrorMessage(json.userErrorMessage || json.errorMessage);
        } catch (e) { if (raw && raw.length < 180) msg = sanitizeApiErrorMessage(raw); }
        throw new Error(msg);
      }
      const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
      const blob = await response.blob();
      if (contentType.indexOf('application/json') !== -1) {
        const raw = await blob.text();
        try {
          const json = JSON.parse(raw);
          if (json && (json.status === 'KO' || json.status === 'ko')) {
            const msg = sanitizeApiErrorMessage(json.userErrorMessage || json.errorMessage || 'Erreur de traitement.');
            throw new Error(msg);
          }
        } catch (e) {
          if (e instanceof SyntaxError) { /* pas du JSON attendu */ }
          else throw e;
        }
      }
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      item.resultBlob = blob;
      item.resultUrl = URL.createObjectURL(blob);
      item.resultFilename = parseFilename(contentDisposition, item.fileName);
      item.resultSize = blob.size;
      item.status = 'done';
      item.justDone = true;
    } catch (err) {
      item.status = 'error';
      item.errorMessage = err && err.name === 'AbortError' ? 'Délai dépassé.' : sanitizeApiErrorMessage((err && err.message) ? err.message : 'Échec');
    }
    renderProcessedList();
  }

  async function submitFiles(event) {
    event.preventDefault();
    if (state.activeTab !== 'file' || state.processing || state.files.length === 0) return;

    try { await ensureAuth(); } catch (e) { setStatus('error', e.message || 'Connexion impossible. Vérifiez que vous êtes bien identifié.'); return; }

    state.processing = true;
    revokeResultUrl();
    revokeAllProcessedUrls();
    ui.download.href = '#';
    ui.download.removeAttribute('download');
    ui.download.classList.remove('is-visible');

    state.processedItems = state.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      size: f.size,
      file: f.file,
      status: 'pending',
      resultUrl: null,
      resultBlob: null,
      resultFilename: null,
      resultSize: null,
      errorMessage: null
    }));
    state.files = [];
    renderFileList();
    updateActions();
    setStatus('loading', 'Traitement en cours (un fichier après l\'autre)…');

    for (let i = 0; i < state.processedItems.length; i++) {
      await processOneFile(state.processedItems[i]);
      const done = state.processedItems.filter((p) => p.status === 'done').length;
      const err = state.processedItems.filter((p) => p.status === 'error').length;
      if (i < state.processedItems.length - 1) {
        setStatus('loading', 'Traitement en cours… ' + done + ' prêt(s)' + (err ? ', ' + err + ' en erreur' : '') + '.');
      }
    }

    state.processing = false;
    const doneCount = state.processedItems.filter((p) => p.status === 'done').length;
    const errCount = state.processedItems.filter((p) => p.status === 'error').length;
    if (errCount === state.processedItems.length) {
      setStatus('error', 'Aucun fichier n\'a pu être traité.');
    } else if (errCount > 0) {
      setStatus('success', 'C\'est prêt. ' + doneCount + ' fichier(s) téléchargeable(s). ' + errCount + ' en erreur.');
    } else {
      setStatus('success', 'C\'est prêt. Téléchargez vos documents ci-dessus ou tout en .zip.');
    }
    updateActions();
  }

  function resetFiles() {
    if (state.processing) return;
    state.files = [];
    state.processedItems = [];
    revokeResultUrl();
    revokeAllProcessedUrls();
    ui.download.href = '#';
    ui.download.removeAttribute('download');
    ui.download.classList.remove('is-visible');
    setStatus('', '');
    renderFileList();
    renderProcessedList();
    updateActions();
  }

  function clearProcessedOnly() {
    if (state.processing) return;
    state.processedItems = [];
    revokeAllProcessedUrls();
    setStatus('', '');
    renderProcessedList();
    updateActions();
  }

  function buildAndDownloadZip(items, blobs) {
    const zip = new window.JSZip();
    items.forEach((item, i) => { zip.file(item.resultFilename || ('file_' + (i + 1)), blobs[i]); });
    zip.generateAsync({ type: 'blob' }).then((zipBlob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = 'documents_anonymisés.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    });
  }

  function downloadAllAsZip() {
    const blobsToZip = state.processedItems.filter((p) => p.status === 'done' && (p.resultBlob || p.resultUrl));
    if (blobsToZip.length < 2) return;
    setStatus('loading', 'Préparation du zip…');
    Promise.all(blobsToZip.map((item) => {
      if (item.resultBlob) return Promise.resolve(item.resultBlob);
      if (!item.resultUrl) return Promise.reject(new Error('missing-result-url'));
      return fetch(item.resultUrl).then((r) => {
        if (!r.ok) throw new Error('zip-fetch-failed');
        return r.blob();
      });
    })).then((blobs) => {
      function runZip() {
        if (typeof window.JSZip !== 'undefined') {
          buildAndDownloadZip(blobsToZip, blobs);
          setStatus('success', 'Téléchargement du zip lancé.');
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
        script.onload = () => { buildAndDownloadZip(blobsToZip, blobs); setStatus('success', 'Téléchargement du zip lancé.'); };
        script.onerror = () => { setStatus('error', 'Impossible de charger la bibliothèque zip. Réessayez.'); };
        document.head.appendChild(script);
      }
      runZip();
    }).catch(() => { setStatus('error', 'Impossible de créer le fichier zip. Réessayez.'); });
  }

  async function processText() {
    let value = '';
    document.querySelectorAll('#agfInputText').forEach(el => {
      const v = (el.value || '').trim();
      if (v) value = v;
    });
    const cacheKey = currentTextConfigKey(value);

    if (!value) {
      resetTextCache();
      setTextOutput('Collez ou tapez un texte ci-dessus pour l\'anonymiser.', false, null, null, 0);
      document.querySelectorAll('#agfOutputText').forEach(el => {
        el.classList.remove('agf-text-output--loading');
        el.setAttribute('aria-busy', 'false');
      });
      return;
    }
    if (value.length < MIN_TEXT_LENGTH_FOR_API) {
      resetTextCache();
      setTextOutput('Entrez au moins ' + MIN_TEXT_LENGTH_FOR_API + ' caractères pour lancer l\'anonymisation.', false, null, null, 0);
      document.querySelectorAll('#agfOutputText').forEach(el => {
        el.classList.remove('agf-text-output--loading');
        el.setAttribute('aria-busy', 'false');
      });
      return;
    }
    if (state.textProcessing) {
      textProcessQueued = true;
      return;
    }
    if (lastProcessedCacheKey === cacheKey && lastProcessedResult !== null) {
      setTextOutput(lastProcessedResult, lastProcessedHasTags, lastProcessedHtml, lastProcessedStats, lastProcessedCounts);
      document.querySelectorAll('#agfOutputText').forEach(el => {
        el.classList.remove('agf-text-output--loading');
        el.setAttribute('aria-busy', 'false');
      });
      return;
    }
    state.textProcessing = true;
    const requestSerial = ++textRequestSerial;
    document.querySelectorAll('#agfOutputText').forEach(el => {
      el.textContent = 'Traitement en cours… Les gros fichiers peuvent prendre un moment.';
      el.classList.add('agf-text-output--loading');
      el.setAttribute('aria-busy', 'true');
    });

    try { await ensureAuth(); } catch (e) {
      setTextOutput(e.message || 'Connexion impossible. Vérifiez que vous êtes bien identifié.', false, null, null, 0);
      state.textProcessing = false;
      document.querySelectorAll('#agfOutputText').forEach(el => {
        el.classList.remove('agf-text-output--loading');
        el.setAttribute('aria-busy', 'false');
      });
      return;
    }

    const payload = new FormData();
    payload.append('username', state.email);
    payload.append('token', state.token);
    payload.append('edition', state.edition);
    payload.append('forceTextFormat', 'true');
    const entities = selectedEntities();
    if (entities.length) payload.append('entityTypes', JSON.stringify(entities));
    if (isFeatureEnabled('inclusion')) {
      const inc = (state.includeTerms || []).join('\n').trim();
      if (inc) payload.append('includeTerms', inc);
      const exc = (state.excludeTerms || []).join('\n').trim();
      if (exc) payload.append('excludeTerms', exc);
    }
    if (isFeatureEnabled('pseudo') && state.mode === 'pseudonymiser' && state.pseudoConfig) {
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
        try { const json = JSON.parse(raw); if (json && (json.userErrorMessage || json.errorMessage)) msg = sanitizeApiErrorMessage(json.userErrorMessage || json.errorMessage); }
        catch (err) { if (raw && raw.length < 220) msg = sanitizeApiErrorMessage(raw); }
        throw new Error(msg);
      }
      const blob = await response.blob();
      const raw = await blob.text();
      // Backend peut renvoyer 200 avec status KO (ex: timeout)
      let json;
      try { json = JSON.parse(raw); } catch (_) { json = null; }
      if (json && json.status === 'KO') {
        const msg = sanitizeApiErrorMessage(json.userErrorMessage || json.errorMessage || 'Erreur de traitement.');
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
      if (err && err.name === 'AbortError') setTextOutput('Texte trop long ou serveur occupé. Réessayez avec un texte plus court.', false, null, null, 0);
      else if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) setTextOutput('Erreur réseau. Vérifiez votre connexion et réessayez.', false, null, null, 0);
      else setTextOutput(sanitizeApiErrorMessage((err && err.message) ? err.message : 'Une erreur s\'est produite. Réessayez ou contactez le support si le problème continue.'), false, null, null, 0);
    } finally {
      state.textProcessing = false;
      document.querySelectorAll('#agfOutputText').forEach(el => {
        el.classList.remove('agf-text-output--loading');
        el.setAttribute('aria-busy', 'false');
      });
      if (textProcessQueued) {
        textProcessQueued = false;
        processText();
      }
    }
  }

  function setTextOutput(plain, useTags, html, stats, total) {
    document.querySelectorAll('#agfOutputText').forEach(el => {
      if (useTags && html) el.innerHTML = html;
      else el.textContent = plain || 'Le résultat s\'affichera ici après anonymisation.';
    });
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

  /** Map backend tag names to UI codes for display/CSS only. Does NOT change backend classification. */
  function normalizeEntityCode(code) {
    const raw = (code || '').toString().trim();
    if (!raw) return '';
    const clean = raw.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!clean) return '';
    if (TAG_ALIAS[clean]) return TAG_ALIAS[clean];
    if (ENTITY_TYPES_TAG.includes(clean)) return clean;
    return 'OTHER';
  }

  /** Render backend placeholders [XXX] as colored spans. No client-side anonymization: we only map tag names (e.g. PERSON→PR, LOCATION→LOC) for display. */
  function buildOutputWithTags(processedText) {
    if (!processedText) return { plain: processedText || '', useTags: false };
    const escaped = escapeHtml(processedText);
    let replaced = false;
    const html = escaped.replace(/\[([A-Za-z0-9_]{2,32})\]/g, (_, rawType) => {
      replaced = true;
      const type = normalizeEntityCode(rawType);
      if (!type) return '[' + rawType + ']';
      return '<span class="agf-tag agf-tag-' + type + '">' + type + '</span>';
    });
    if (!replaced || html === escaped) return { plain: processedText, useTags: false };
    return { plain: processedText, useTags: true, html };
  }

  function extractEntityStats(processedText) {
    const counts = {};
    if (!processedText) return counts;
    let match;
    while ((match = PLACEHOLDER_RE.exec(processedText)) !== null) {
      const code = normalizeEntityCode(match[1]);
      if (!code) continue;
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
      .map((entry) => [entry[0], Math.max(0, Math.floor(Number(entry[1] || 0)))])
      .filter((entry) => entry[1] > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      });
    const total = typeof explicitTotal === 'number'
      ? explicitTotal
      : entries.reduce((sum, item) => sum + item[1], 0);

    document.querySelectorAll('#agfOutputEntities').forEach(el => { el.textContent = ''; });
    if (total === 0) {
      document.querySelectorAll('#agfOutputSummary').forEach(el => { el.textContent = 'Aucune donnée personnelle détectée pour l\'instant.'; });
      document.querySelectorAll('#agfLastMaskInfo').forEach(el => { el.textContent = 'Champs anonymisés (texte): 0'; });
      return;
    }

    document.querySelectorAll('#agfOutputSummary').forEach(el => { el.textContent = total + ' donnée(s) personnelle(s) détectée(s) sur le dernier traitement.'; });
    document.querySelectorAll('#agfLastMaskInfo').forEach(el => { el.textContent = 'Champs anonymisés (texte): ' + total; });

    document.querySelectorAll('#agfOutputEntities').forEach(container => {
      entries.forEach((entry) => {
        const chip = document.createElement('span');
        chip.className = 'agf-output-entity-chip agf-tag-' + entry[0];
        chip.textContent = entry[0] + ': ' + entry[1];
        container.appendChild(chip);
      });
    });
  }

  function applyStructuredResponse(raw) {
    let plain = (raw && raw.trim()) ? raw : 'Le serveur n\'a renvoyé aucun résultat. Réessayez.';
    let stats = null;
    let total = null;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data.processedText === 'string') plain = data.processedText;
      if (data && data.audit && data.audit.entityCounts && typeof data.audit.entityCounts === 'object') {
        stats = {};
        Object.entries(data.audit.entityCounts).forEach((entry) => {
          const code = normalizeEntityCode(entry[0]);
          if (!code) return;
          const count = Math.max(0, Math.floor(Number(entry[1] || 0)));
          stats[code] = (stats[code] || 0) + count;
        });
      } else if (data && Array.isArray(data.entities)) {
        stats = {};
        data.entities.forEach((entity) => {
          const code = normalizeEntityCode(entity && entity.type);
          if (!code) return;
          stats[code] = (stats[code] || 0) + 1;
        });
      }
      if (stats) {
        total = Object.values(stats).reduce((sum, n) => sum + Number(n || 0), 0);
      }
    } catch (e) { }
    const built = buildOutputWithTags(plain);
    return { plain, useTags: built.useTags, html: built.html, stats, total };
  }

  function applyEditionLocks() {
    ui.openTypes.classList.remove('is-locked');
    ui.openInclusion.classList.remove('is-locked');
  }

  function applyFeatureAvailability() {
    const pseudoEnabled = isFeatureEnabled('pseudo');
    const inclusionEnabled = isFeatureEnabled('inclusion');

    if (ui.pseudoMode) ui.pseudoMode.classList.toggle('is-preview', !pseudoEnabled);
    if (ui.pseudoSaved) ui.pseudoSaved.classList.toggle('is-preview', !pseudoEnabled);
    if (ui.openInclusion) ui.openInclusion.classList.toggle('is-preview', !inclusionEnabled);

    if (ui.pseudoBadge) ui.pseudoBadge.textContent = pseudoEnabled ? 'Paramétrer' : 'Bientôt';
    if (ui.pseudoSavedBadge) ui.pseudoSavedBadge.textContent = pseudoEnabled ? 'Gérer' : 'Aperçu';
    if (ui.pseudoAvailabilityHint) ui.pseudoAvailabilityHint.hidden = pseudoEnabled;
    if (ui.inclusionAvailabilityHint) ui.inclusionAvailabilityHint.hidden = inclusionEnabled;
    if (ui.pseudoPreviewNote) ui.pseudoPreviewNote.hidden = pseudoEnabled;
    if (ui.inclusionPreviewNote) ui.inclusionPreviewNote.hidden = inclusionEnabled;

    if (!pseudoEnabled && state.mode === 'pseudonymiser') {
      setMode('anonymiser', { silent: true });
    }

    if (ui.modals.pseudo) {
      const pseudoModal = ui.modals.pseudo.querySelector('.agf-modal');
      if (pseudoModal) pseudoModal.classList.toggle('is-readonly', !pseudoEnabled);
    }
    if (ui.modals.inclusion) {
      const inclusionModal = ui.modals.inclusion.querySelector('.agf-modal');
      if (inclusionModal) inclusionModal.classList.toggle('is-readonly', !inclusionEnabled);
    }

    setReadonlyControls(ui.pseudoReadonlyZone, !pseudoEnabled);
    setReadonlyControls(ui.inclusionReadonlyZone, !inclusionEnabled);

    if (ui.pseudoDefaults) ui.pseudoDefaults.disabled = !pseudoEnabled;
    if (ui.savePseudo) {
      ui.savePseudo.disabled = !pseudoEnabled;
      ui.savePseudo.textContent = pseudoEnabled ? 'Enregistrer la politique' : 'Activation backend en attente';
    }

    if (ui.includeInput) ui.includeInput.disabled = !inclusionEnabled;
    if (ui.excludeInput) ui.excludeInput.disabled = !inclusionEnabled;
    if (ui.includeAdd) ui.includeAdd.disabled = !inclusionEnabled;
    if (ui.excludeAdd) ui.excludeAdd.disabled = !inclusionEnabled;
    if (ui.inclusionDefaults) ui.inclusionDefaults.disabled = !inclusionEnabled;
    if (ui.saveInclusion) {
      ui.saveInclusion.disabled = !inclusionEnabled;
      ui.saveInclusion.textContent = inclusionEnabled ? 'Enregistrer les listes' : 'Activation backend en attente';
    }
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
    if (ui.reset) ui.reset.addEventListener('click', resetFiles);
    if (ui.clearProcessed) ui.clearProcessed.addEventListener('click', clearProcessedOnly);
    if (ui.downloadZip) ui.downloadZip.addEventListener('click', downloadAllAsZip);

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
      setTextOutput('Le résultat s\'affichera ici après anonymisation.', false, null, null, 0);
      if (debounceTextTimer) {
        clearTimeout(debounceTextTimer);
        debounceTextTimer = null;
      }
    });
    if (ui.textCopy) ui.textCopy.addEventListener('click', () => { const t = lastProcessedResult != null ? lastProcessedResult : (ui.textOutput.innerText || '').trim(); if (t && t !== 'Le résultat s\'affichera ici après anonymisation.') { navigator.clipboard.writeText(t).then(() => { ui.textCopy.innerHTML = 'Copié\u00a0!'; setTimeout(() => { ui.textCopy.innerHTML = '<span class="agf-icon-copy" aria-hidden="true"></span>Copier'; }, 1200); }).catch(() => { setStatus('error', 'Copie impossible. Vous pouvez sélectionner le texte et copier à la main.'); }); } });

    ui.modeRadios.forEach((radio) => radio.addEventListener('change', () => {
      setMode(radio.value);
      refreshTextIfNeeded();
    }));

    ui.pseudoMode.addEventListener('click', () => {
      openModal(ui.modals.pseudo);
      if (!isFeatureEnabled('pseudo')) setStatus('info', 'Pseudonymisation en aperçu: activation backend en cours.');
    });
    ui.pseudoSaved.addEventListener('click', () => {
      openModal(ui.modals.pseudo);
      if (!isFeatureEnabled('pseudo')) setStatus('info', 'Pseudonymes en aperçu: gestion active dès branchement backend.');
    });
    ui.openTypes.addEventListener('click', () => openModal(ui.modals.types));
    ui.openInclusion.addEventListener('click', () => {
      openModal(ui.modals.inclusion);
      if (!isFeatureEnabled('inclusion')) setStatus('info', 'Inclusion / Exclusion en aperçu: activation backend en cours.');
    });
    if (ui.upgradeRestore) {
      ui.upgradeRestore.addEventListener('click', () => {
        openModal(ui.modals.pseudo);
        if (!isFeatureEnabled('pseudo')) setStatus('info', 'Restauration et pseudonymisation seront activées ensemble côté backend.');
      });
    }

    ui.modalTypesClose.addEventListener('click', () => closeModal(ui.modals.types));
    if (ui.modalTypesBetaClose && ui.modalTypesBetaOverlay) {
      ui.modalTypesBetaClose.addEventListener('click', () => ui.modalTypesBetaOverlay.classList.add('is-dismissed'));
    }
    if (ui.modalPseudoClose) ui.modalPseudoClose.addEventListener('click', () => closeModal(ui.modals.pseudo));
    ui.modalIncClose.addEventListener('click', () => closeModal(ui.modals.inclusion));

    ui.defaultsTypes.addEventListener('click', () => {
      Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
        if (chk.disabled) return;
        chk.checked = DEFAULT_ENTITIES.includes(chk.getAttribute('data-entity'));
      });
      resetTextCache();
      renderTypeCount();
      refreshTextIfNeeded();
    });

    if (ui.detectAllTypes) ui.detectAllTypes.addEventListener('click', () => {
      Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
        if (!chk.disabled) chk.checked = true;
      });
      resetTextCache();
      renderTypeCount();
      refreshTextIfNeeded();
    });

    if (ui.ignoreAllTypes) ui.ignoreAllTypes.addEventListener('click', () => {
      Array.from(document.querySelectorAll('#agfTypeGrid input[type="checkbox"][data-entity]')).forEach((chk) => {
        if (!chk.disabled) chk.checked = false;
      });
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
      if (!isFeatureEnabled('pseudo')) {
        setStatus('info', 'Paramètres de pseudonymisation visibles en aperçu uniquement pour l’instant.');
        return;
      }
      state.pseudoConfig = { ...DEFAULT_PSEUDO_CONFIG };
      applyPseudoToUi(state.pseudoConfig);
      renderPseudoSummary();
    });

    if (ui.savePseudo) ui.savePseudo.addEventListener('click', () => {
      if (!isFeatureEnabled('pseudo')) {
        setStatus('info', 'Pseudonymisation non activée côté backend. Configuration conservée en aperçu.');
        return;
      }
      state.pseudoConfig = readPseudoFromUi();
      storage.set(STORAGE_PSEUDO, JSON.stringify(state.pseudoConfig));
      resetTextCache();
      setMode('pseudonymiser');
      setStatus('success', 'Paramètres enregistrés.');
      closeModal(ui.modals.pseudo);
      refreshTextIfNeeded();
    });

    if (ui.includeAdd) ui.includeAdd.addEventListener('click', () => {
      if (!isFeatureEnabled('inclusion')) {
        setStatus('info', 'Inclusion / Exclusion en aperçu: modification backend non disponible pour l’instant.');
        return;
      }
      if (addTerm('include', ui.includeInput ? ui.includeInput.value : '')) {
        if (ui.includeInput) ui.includeInput.value = '';
        if (ui.includeInput) ui.includeInput.focus();
        resetTextCache();
        refreshTextIfNeeded();
      }
    });

    if (ui.excludeAdd) ui.excludeAdd.addEventListener('click', () => {
      if (!isFeatureEnabled('inclusion')) {
        setStatus('info', 'Inclusion / Exclusion en aperçu: modification backend non disponible pour l’instant.');
        return;
      }
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
        if (!isFeatureEnabled('inclusion')) {
          setStatus('info', 'Inclusion / Exclusion en aperçu: modification backend non disponible pour l’instant.');
          return;
        }
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
        if (!isFeatureEnabled('inclusion')) {
          setStatus('info', 'Inclusion / Exclusion en aperçu: modification backend non disponible pour l’instant.');
          return;
        }
        if (addTerm('exclude', ui.excludeInput.value)) {
          ui.excludeInput.value = '';
          resetTextCache();
          refreshTextIfNeeded();
        }
      }
    });

    if (ui.inclusionDefaults) ui.inclusionDefaults.addEventListener('click', () => {
      if (!isFeatureEnabled('inclusion')) {
        setStatus('info', 'Listes en aperçu: le reset sera disponible à l’activation backend.');
        return;
      }
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
      if (!isFeatureEnabled('inclusion')) {
        setStatus('info', 'Inclusion / Exclusion non activée côté backend. Aperçu conservé.');
        return;
      }
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
      setStatus('success', 'Listes enregistrées.');
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

  function applyTokenFromEvent(detail) {
    if (!detail || !detail.token) return;
    state.token = detail.token;
    if (detail.email) state.email = detail.email;
    if (detail.edition) state.edition = detail.edition;
  }

  async function init() {
    if (window.__agiloEmbedAnonymisationMounted) return;
    if (!ui.form || !ui.submit || !ui.dropzone) return;
    window.__agiloEmbedAnonymisationMounted = true;

    window.addEventListener('agilo:token', (e) => { applyTokenFromEvent(e && e.detail); });

    await waitForMemberstack(10000, 200);
    state.edition = await detectEdition();
    const editionFromUrl = new URLSearchParams(window.location.search).get('edition');
    if (editionFromUrl) {
      const n = editionFromUrl.toLowerCase();
      if (['free', 'pro', 'ent', 'business', 'anonymisation'].includes(n)) state.edition = n === 'business' ? 'ent' : n;
    }
    storage.set('agilo:edition', state.edition);
    if (ui.manualEdition) ui.manualEdition.value = state.edition;

    if (window.globalToken && storage.get('agilo:username')) {
      state.token = window.globalToken;
      state.email = storage.get('agilo:username');
      const cachedEdition = storage.get('agilo:edition');
      if (cachedEdition) state.edition = cachedEdition;
    } else {
      state.email = await getUserEmail();
      if (state.email && !getManualAuth()) await getToken(state.email, state.edition, 0).catch(() => { });
    }

    bindEvents();
    setActiveTab('file');
    loadPreferences();
    applyEditionLocks();
    applyFeatureAvailability();
    renderFileList();
    updateActions();
    if (shouldCallApiMeta()) {
      runSessionMaintenance();
      loadApiVersion();
    }
  }

  if (window.__agiloEmbedAnonymisationMounted) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
