// Agilotext – Anonymisation transcript v3
(function () {
  'use strict';

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_ENDPOINT = API_BASE + '/getToken';
  const ANON_TEXT_ENDPOINT = API_BASE + '/anonText';
  const REQUEST_TIMEOUT_MS = 60000;
  const TOKEN_RETRY_MAX = 3;
  const TOKEN_RETRY_DELAY_MS = 800;
  const DEFAULT_ENTITY_TYPES = ['PER', 'ORG', 'LOC'];
  const GENERIC_SPEAKER_RE = /^(speaker[_\s-]?[a-z0-9]+|intervenant\s*\d+|locuteur\s*\d+)$/i;

  let abortController = null;

  const state = {
    ui: null,
    saveBridgeReady: false,
    originalTranscriptState: null,
    anonymizedDraftState: null,
    hasUnsavedAnonymizedDraft: false,
    hasSavedAnonymizedDraft: false,
    previewText: '',
    previewSegments: null,
    previewJobId: '',
    currentJobId: '',
    anonymizationConfig: {
      goal: 'export',
      entityTypes: DEFAULT_ENTITY_TYPES.slice()
    }
  };

  function logEvent(name, payload) {
    try {
      console.info('[AGILO:ANON:EVENT]', name, payload || {});
    } catch (_) {}
  }

  function notify(msg) {
    if (typeof window.toast === 'function') {
      window.toast(msg);
    } else {
      console.warn('[AGILO:ANON]', msg);
    }
  }

  function normalizeEdition(raw) {
    const v = String(raw || '').toLowerCase().trim();
    if (['enterprise', 'entreprise', 'business', 'team', 'ent'].includes(v)) return 'ent';
    if (v.startsWith('pro')) return 'pro';
    if (v.startsWith('free') || v === 'gratuit') return 'free';
    return 'ent';
  }

  function getEditorRoot() {
    return document.querySelector('#editorRoot');
  }

  function getJobId() {
    return new URLSearchParams(location.search).get('jobId')
      || getEditorRoot()?.dataset.jobId
      || document.querySelector('.rail-item.is-active')?.dataset.jobId
      || '';
  }

  function resolveEdition() {
    return normalizeEdition(
      window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || getEditorRoot()?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'ent'
    );
  }

  async function getMemberstackEmail() {
    const ms = window.$memberstackDom;
    if (!ms || typeof ms.getCurrentMember !== 'function') return null;
    try {
      const result = await ms.getCurrentMember({ cache: 'reload' });
      const member = result && result.data;
      const email = member && (member.email || (member.auth && member.auth.email));
      return email ? String(email).trim() : null;
    } catch (_) {
      return null;
    }
  }

  async function resolveEmail() {
    const fromMs = await getMemberstackEmail();
    if (fromMs) return fromMs;
    return (
      getEditorRoot()?.dataset.username
      || document.querySelector('[name="memberEmail"]')?.value
      || window.memberEmail
      || window.__agiloOrchestrator?.credentials?.email
      || document.querySelector('[data-ms-member="email"]')?.textContent?.trim()
      || localStorage.getItem('agilo:username')
      || ''
    ) || null;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const localController = new AbortController();
    const timer = setTimeout(() => localController.abort(), timeoutMs);
    const signals = [localController.signal];
    if (abortController) signals.push(abortController.signal);
    const signal = signals.length > 1 && AbortSignal.any ? AbortSignal.any(signals) : signals[0];
    try {
      return await fetch(url, { ...options, signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchToken(email, edition, attempt) {
    const current = typeof attempt === 'number' ? attempt : 0;
    try {
      const url = TOKEN_ENDPOINT + '?username=' + encodeURIComponent(email) + '&edition=' + encodeURIComponent(edition);
      const response = await fetchWithTimeout(url, { method: 'GET' }, 20000);
      const data = await response.json();
      if (data && data.status === 'OK' && data.token) return data.token;
      throw new Error((data && (data.userErrorMessage || data.errorMessage)) || 'Token invalide');
    } catch (err) {
      if (current < TOKEN_RETRY_MAX) {
        await new Promise((resolve) => setTimeout(resolve, TOKEN_RETRY_DELAY_MS * (current + 1)));
        return fetchToken(email, edition, current + 1);
      }
      throw err;
    }
  }

  async function ensureAuth() {
    const edition = resolveEdition();
    const email = await resolveEmail();
    if (!email) throw new Error('Email introuvable. Vérifiez que vous êtes connecté.');
    const token = await fetchToken(email, edition);
    localStorage.setItem('agilo:username', email);
    localStorage.setItem('agilo:edition', edition);
    return { email, token, edition };
  }

  function getActiveTab() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!tab) return null;
    if (tab.id === 'tab-transcript') return 'transcript';
    if (tab.id === 'tab-summary') return 'summary';
    if (tab.id === 'tab-chat') return 'chat';
    return null;
  }

  function getTranscriptRoot() {
    return document.getElementById('transcriptEditor')
      || document.querySelector('[data-editor="transcript"]');
  }

  function getVisibleText(node) {
    if (!node) return '';
    if (typeof window.visibleTextFromBox === 'function') return window.visibleTextFromBox(node);
    return node.textContent || node.innerText || '';
  }

  function getSummaryContent() {
    const el = document.getElementById('summaryEditor')
      || document.getElementById('pane-summary')
      || document.querySelector('[data-editor="summary"]');
    if (!el) return '';
    return el.textContent || el.innerText || '';
  }

  function cloneSegments(segments) {
    return (segments || []).map((seg, index) => ({
      id: seg.id || `s${index}`,
      start: seg.start ?? seg.startSec ?? seg.milli_start ?? null,
      end: seg.end ?? seg.endSec ?? seg.milli_end ?? null,
      speaker: String(seg.speaker || '').trim(),
      text: String(seg.text || '').replace(/\r\n?/g, '\n'),
      lang: seg.lang || 'fr'
    }));
  }

  function extractSegmentsFromDom(root) {
    const rows = Array.from(root?.querySelectorAll('.ag-seg') || []);
    if (!rows.length) return [];
    return rows.map((seg, index) => {
      const box = seg.querySelector('.ag-seg__text') || seg;
      return {
        id: seg.dataset.id || `s${index}`,
        start: seg.dataset.start ?? null,
        end: seg.dataset.end ?? null,
        speaker: String(seg.dataset.speaker || seg.querySelector('.speaker')?.textContent || '').trim(),
        text: String(getVisibleText(box) || '').trim(),
        lang: seg.getAttribute('lang') || 'fr'
      };
    });
  }

  function getTranscriptSegments() {
    if (Array.isArray(window._segments) && window._segments.length) {
      return cloneSegments(window._segments);
    }
    return extractSegmentsFromDom(getTranscriptRoot());
  }

  function getTranscriptContent() {
    const segs = getTranscriptSegments();
    if (segs.length) {
      return segs.map((seg) => {
        const speaker = String(seg.speaker || '').trim();
        const text = String(seg.text || '').trim();
        return speaker ? `${speaker}: ${text}` : text;
      }).join('\n\n');
    }
    const el = getTranscriptRoot();
    return el ? getVisibleText(el) : '';
  }

  function captureTranscriptState() {
    const root = getTranscriptRoot();
    return {
      jobId: getJobId(),
      html: root ? root.innerHTML : '',
      segments: getTranscriptSegments()
    };
  }

  function isGenericSpeaker(label) {
    return GENERIC_SPEAKER_RE.test(String(label || '').trim());
  }

  function normalizeSpeakerForSegment(originalSeg, parsedSeg) {
    const originalSpeaker = String(originalSeg?.speaker || '').trim();
    if (isGenericSpeaker(originalSpeaker)) return originalSpeaker;
    const parsedSpeaker = String(parsedSeg?.speaker || '').trim();
    return parsedSpeaker || originalSpeaker;
  }

  function parseSpeakerAndText(block) {
    const text = String(block || '').trim();
    const match = text.match(/^([^:\n]{1,120})\s*:\s*([\s\S]+)$/);
    if (!match) return { speaker: '', text };
    return {
      speaker: String(match[1] || '').trim(),
      text: String(match[2] || '').trim()
    };
  }

  function splitPreviewBlocks(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function mapPreviewToOriginalSegments(outputText, originalSegments) {
    let parsed = null;
    if (typeof window.parseRawTranscript === 'function') {
      try {
        parsed = window.parseRawTranscript(outputText);
      } catch (_) {}
    }
    if (Array.isArray(parsed) && parsed.length === originalSegments.length) {
      return originalSegments.map((originalSeg, index) => ({
        ...originalSeg,
        speaker: normalizeSpeakerForSegment(originalSeg, parsed[index]),
        text: String(parsed[index]?.text || '').trim()
      }));
    }

    const blocks = splitPreviewBlocks(outputText);
    if (blocks.length !== originalSegments.length) return null;

    return originalSegments.map((originalSeg, index) => {
      const parsedBlock = parseSpeakerAndText(blocks[index]);
      return {
        ...originalSeg,
        speaker: normalizeSpeakerForSegment(originalSeg, parsedBlock),
        text: parsedBlock.text
      };
    });
  }

  function buildSegmentElement(seg, index, sourceRow) {
    const article = document.createElement('article');
    article.className = 'ag-seg';
    article.dataset.id = seg.id || `s${index}`;
    if (seg.start != null && seg.start !== '') article.dataset.start = String(seg.start);
    if (seg.end != null && seg.end !== '') article.dataset.end = String(seg.end);
    article.dataset.speaker = String(seg.speaker || '');
    if (seg.lang) article.setAttribute('lang', seg.lang);

    const header = sourceRow?.querySelector('.ag-seg__head')?.cloneNode(true) || document.createElement('header');
    if (!header.className) header.className = 'ag-seg__head';
    const timeBtn = header.querySelector('.time');
    if (timeBtn && seg.start != null && seg.start !== '') {
      timeBtn.dataset.t = String(seg.start);
    }
    const speakerEl = header.querySelector('.speaker');
    if (speakerEl) speakerEl.textContent = String(seg.speaker || '');
    article.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ag-seg__text';
    body.contentEditable = 'true';
    body.spellcheck = false;
    body.textContent = String(seg.text || '');
    article.appendChild(body);
    return article;
  }

  function renderTranscriptSegments(segments) {
    const root = getTranscriptRoot();
    if (!root) throw new Error('Éditeur de transcript introuvable.');

    if (typeof window.renderSegments === 'function') {
      try {
        window.renderSegments(segments);
        window._segments = cloneSegments(segments);
        root.dispatchEvent(new Event('input', { bubbles: true }));
        root.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      } catch (_) {}
    }

    const sourceRows = Array.from(root.querySelectorAll('.ag-seg'));
    root.innerHTML = '';
    segments.forEach((seg, index) => {
      root.appendChild(buildSegmentElement(seg, index, sourceRows[index]));
    });
    window._segments = cloneSegments(segments);
    root.dispatchEvent(new Event('input', { bubbles: true }));
    root.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function restoreTranscriptState(snapshot) {
    if (!snapshot || !snapshot.segments) return;
    renderTranscriptSegments(snapshot.segments);
  }

  function resolveEntityTypes() {
    const stored = localStorage.getItem('agilo:anon2:entityTypes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (_) {}
    }
    return DEFAULT_ENTITY_TYPES.slice();
  }

  function persistConfig() {
    try {
      localStorage.setItem('agilo:anon2:entityTypes', JSON.stringify(state.anonymizationConfig.entityTypes));
      localStorage.setItem('agilo:anon2:goal', state.anonymizationConfig.goal);
    } catch (_) {}
  }

  function restoreConfig() {
    state.anonymizationConfig.entityTypes = resolveEntityTypes();
    const goal = localStorage.getItem('agilo:anon2:goal');
    if (goal === 'apply' || goal === 'export') {
      state.anonymizationConfig.goal = goal;
    }
  }

  async function requestAnonymisedText(content, entityTypes) {
    const creds = await ensureAuth();
    const payload = new FormData();
    payload.append('username', creds.email);
    payload.append('token', creds.token);
    payload.append('edition', creds.edition);
    payload.append('forceTextFormat', 'true');
    payload.append('fileUpload1', new Blob([content], { type: 'text/plain;charset=utf-8' }), 'input.txt');
    payload.append('entityTypes', JSON.stringify(entityTypes && entityTypes.length ? entityTypes : DEFAULT_ENTITY_TYPES));

    const response = await fetchWithTimeout(ANON_TEXT_ENDPOINT, { method: 'POST', body: payload }, REQUEST_TIMEOUT_MS);
    const rawText = await response.text();

    if (!response.ok) {
      try {
        const json = JSON.parse(rawText);
        throw new Error(json.userErrorMessage || json.errorMessage || 'Erreur de traitement.');
      } catch (_) {
        throw new Error(rawText && rawText.length < 300 ? rawText : 'Erreur de traitement.');
      }
    }

    let json = null;
    try { json = JSON.parse(rawText); } catch (_) {}
    if (json && json.status === 'KO') {
      throw new Error(json.userErrorMessage || json.errorMessage || 'Erreur de traitement.');
    }

    return (json && typeof json.anonymisedText === 'string') ? json.anonymisedText : rawText;
  }

  function downloadTextFile(text, fileName) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function createUi() {
    if (state.ui) return state.ui;
    if (!document.body || !document.head) return null;

    const style = document.createElement('style');
    style.textContent = `
      .agilo-anon-overlay{position:fixed;inset:0;z-index:999999;background:rgba(12,18,31,.52);display:none;align-items:center;justify-content:center;padding:24px}
      .agilo-anon-overlay.is-open{display:flex}
      .agilo-anon-modal{width:min(760px,100%);max-height:85vh;overflow:auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 32px 80px rgba(0,0,0,.24);font-family:inherit;color:#171717}
      .agilo-anon-title{margin:0 0 8px;font-size:1.35rem;font-weight:700}
      .agilo-anon-text{margin:0 0 16px;color:#525252;line-height:1.45}
      .agilo-anon-grid{display:grid;gap:16px}
      .agilo-anon-card{border:1px solid rgba(0,0,0,.1);border-radius:16px;padding:16px;background:#fafafa}
      .agilo-anon-card h4{margin:0 0 12px;font-size:1rem}
      .agilo-anon-choice,.agilo-anon-check{display:flex;align-items:flex-start;gap:10px;margin:10px 0}
      .agilo-anon-choice input,.agilo-anon-check input{margin-top:3px}
      .agilo-anon-preview{width:100%;min-height:180px;border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:12px;background:#fff;white-space:pre-wrap;overflow:auto;font-family:inherit;color:#171717}
      .agilo-anon-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
      .agilo-anon-btn{appearance:none;border:none;border-radius:999px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}
      .agilo-anon-btn--primary{background:#111827;color:#fff}
      .agilo-anon-btn--secondary{background:#e5e7eb;color:#111827}
      .agilo-anon-btn--ghost{background:transparent;color:#111827;border:1px solid rgba(0,0,0,.12)}
      .agilo-anon-btn[disabled]{opacity:.45;cursor:not-allowed}
      .agilo-anon-status{margin-top:12px;font-size:.92rem;color:#4b5563}
      .agilo-anon-banner{display:none;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px;padding:14px 16px;border-radius:16px;background:#fff8dc;border:1px solid #f4d67a}
      .agilo-anon-banner.is-visible{display:flex}
      .agilo-anon-banner.is-saved{background:#e9f9ef;border-color:#93d7a6}
      .agilo-anon-banner-copy{min-width:0}
      .agilo-anon-banner-title{font-weight:700;color:#2b2b2b}
      .agilo-anon-banner-text{font-size:.92rem;color:#575757;margin-top:2px}
      .agilo-anon-banner-actions{display:flex;flex-wrap:wrap;gap:10px}
      @media (max-width:700px){
        .agilo-anon-overlay{padding:12px}
        .agilo-anon-modal{padding:16px;border-radius:16px}
        .agilo-anon-banner{flex-direction:column;align-items:flex-start}
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'agilo-anon-overlay';
    overlay.innerHTML = `
      <div class="agilo-anon-modal" role="dialog" aria-modal="true" aria-labelledby="agilo-anon-title">
        <h3 id="agilo-anon-title" class="agilo-anon-title">Anonymiser le transcript</h3>
        <p class="agilo-anon-text">Le transcript original n’est pas écrasé tant que vous n’avez pas cliqué sur Sauvegarder.</p>
        <div class="agilo-anon-grid">
          <section class="agilo-anon-card">
            <h4>Objectif</h4>
            <label class="agilo-anon-choice">
              <input type="radio" name="agilo-anon-goal" value="export">
              <span>Exporter anonymisé<br><small>Aucun changement visuel dans l’éditeur.</small></span>
            </label>
            <label class="agilo-anon-choice">
              <input type="radio" name="agilo-anon-goal" value="apply">
              <span>Remplacer mon transcript dans l’éditeur<br><small>Création d’un brouillon anonymisé local avant sauvegarde.</small></span>
            </label>
          </section>
          <section class="agilo-anon-card">
            <h4>Types de données</h4>
            <label class="agilo-anon-check"><input type="checkbox" value="PER"><span>PER</span></label>
            <label class="agilo-anon-check"><input type="checkbox" value="ORG"><span>ORG</span></label>
            <label class="agilo-anon-check"><input type="checkbox" value="LOC"><span>LOC</span></label>
          </section>
          <section class="agilo-anon-card">
            <h4>Prévisualisation</h4>
            <div class="agilo-anon-preview" id="agiloAnonPreview">Aucune prévisualisation pour le moment.</div>
            <div class="agilo-anon-status" id="agiloAnonStatus">Prévisualisez d’abord la version anonymisée, puis choisissez l’action finale.</div>
          </section>
        </div>
        <div class="agilo-anon-actions">
          <button type="button" class="agilo-anon-btn agilo-anon-btn--primary" data-action="preview">Prévisualiser</button>
          <button type="button" class="agilo-anon-btn agilo-anon-btn--secondary" data-action="download" disabled>Télécharger</button>
          <button type="button" class="agilo-anon-btn agilo-anon-btn--secondary" data-action="apply" disabled>Appliquer au transcript</button>
          <button type="button" class="agilo-anon-btn agilo-anon-btn--ghost" data-action="close">Annuler</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const banner = document.createElement('div');
    banner.className = 'agilo-anon-banner';
    banner.innerHTML = `
      <div class="agilo-anon-banner-copy">
        <div class="agilo-anon-banner-title">Brouillon anonymisé non sauvegardé</div>
        <div class="agilo-anon-banner-text">Le transcript visible est anonymisé localement. Sauvegardez pour en faire la version serveur.</div>
      </div>
      <div class="agilo-anon-banner-actions">
        <button type="button" class="agilo-anon-btn agilo-anon-btn--secondary" data-action="save">Sauvegarder</button>
        <button type="button" class="agilo-anon-btn agilo-anon-btn--ghost" data-action="revert">Revenir à l’original</button>
        <button type="button" class="agilo-anon-btn agilo-anon-btn--secondary" data-action="redo-summary" disabled>Régénérer le compte-rendu</button>
      </div>
    `;

    const transcriptPane = document.getElementById('pane-transcript');
    if (transcriptPane?.parentNode) {
      transcriptPane.parentNode.insertBefore(banner, transcriptPane);
    }

    const ui = {
      overlay,
      banner,
      preview: overlay.querySelector('#agiloAnonPreview'),
      status: overlay.querySelector('#agiloAnonStatus'),
      goalInputs: Array.from(overlay.querySelectorAll('input[name="agilo-anon-goal"]')),
      entityInputs: Array.from(overlay.querySelectorAll('.agilo-anon-check input')),
      previewBtn: overlay.querySelector('[data-action="preview"]'),
      downloadBtn: overlay.querySelector('[data-action="download"]'),
      applyBtn: overlay.querySelector('[data-action="apply"]'),
      closeBtn: overlay.querySelector('[data-action="close"]'),
      bannerTitle: banner.querySelector('.agilo-anon-banner-title'),
      bannerText: banner.querySelector('.agilo-anon-banner-text'),
      bannerSaveBtn: banner.querySelector('[data-action="save"]'),
      bannerRevertBtn: banner.querySelector('[data-action="revert"]'),
      bannerRedoBtn: banner.querySelector('[data-action="redo-summary"]')
    };

    ui.goalInputs.forEach((input) => {
      input.addEventListener('change', () => {
        state.anonymizationConfig.goal = input.value;
        persistConfig();
      });
    });
    ui.entityInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const selected = ui.entityInputs.filter((item) => item.checked).map((item) => item.value);
        state.anonymizationConfig.entityTypes = selected.length ? selected : DEFAULT_ENTITY_TYPES.slice();
        persistConfig();
      });
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    ui.closeBtn.addEventListener('click', closeModal);
    ui.previewBtn.addEventListener('click', () => runModalAction('preview'));
    ui.downloadBtn.addEventListener('click', () => runModalAction('download'));
    ui.applyBtn.addEventListener('click', () => runModalAction('apply'));
    ui.bannerSaveBtn.addEventListener('click', () => triggerSave());
    ui.bannerRevertBtn.addEventListener('click', () => revertDraft());
    ui.bannerRedoBtn.addEventListener('click', () => triggerRedoSummary());

    state.ui = ui;
    syncConfigToUi();
    return ui;
  }

  function syncConfigToUi() {
    const ui = createUi();
    if (!ui) return;
    ui.goalInputs.forEach((input) => {
      input.checked = input.value === state.anonymizationConfig.goal;
    });
    const selected = new Set(state.anonymizationConfig.entityTypes || DEFAULT_ENTITY_TYPES);
    ui.entityInputs.forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function openModal() {
    const ui = createUi();
    if (!ui) {
      throw new Error('Interface d’anonymisation indisponible. Rechargez la page.');
    }
    syncConfigToUi();
    ui.preview.textContent = 'Aucune prévisualisation pour le moment.';
    ui.status.textContent = 'Prévisualisez d’abord la version anonymisée, puis choisissez l’action finale.';
    ui.downloadBtn.disabled = true;
    ui.applyBtn.disabled = true;
    state.previewText = '';
    state.previewSegments = null;
    state.previewJobId = getJobId();
    ui.overlay.classList.add('is-open');
    logEvent('modal_open', { jobId: state.previewJobId });
  }

  function closeModal() {
    const ui = createUi();
    if (!ui) return;
    ui.overlay.classList.remove('is-open');
  }

  function setModalBusy(isBusy, text) {
    const ui = createUi();
    if (!ui) return;
    [ui.previewBtn, ui.downloadBtn, ui.applyBtn, ui.closeBtn].forEach((button) => {
      button.disabled = !!isBusy || (button === ui.downloadBtn || button === ui.applyBtn ? !state.previewText : false);
    });
    if (text) ui.status.textContent = text;
  }

  async function buildPreview() {
    if (getActiveTab() !== 'transcript') {
      throw new Error('Anonymisation disponible uniquement sur l’onglet Transcription.');
    }
    const content = getTranscriptContent();
    if (!content || !content.trim()) {
      throw new Error('Aucun transcript à anonymiser.');
    }

    const entityTypes = state.anonymizationConfig.entityTypes && state.anonymizationConfig.entityTypes.length
      ? state.anonymizationConfig.entityTypes
      : DEFAULT_ENTITY_TYPES.slice();

    abortController = new AbortController();
    const outputText = await requestAnonymisedText(content, entityTypes);
    const originalSegments = getTranscriptSegments();
    const mapped = mapPreviewToOriginalSegments(outputText, originalSegments);

    state.previewText = outputText;
    state.previewSegments = mapped;
    state.previewJobId = getJobId();

    const ui = createUi();
    if (!ui) return;
    ui.preview.textContent = outputText || 'Aucune donnée renvoyée.';
    ui.downloadBtn.disabled = false;
    ui.applyBtn.disabled = !mapped;
    ui.status.textContent = mapped
      ? 'Prévisualisation prête. Vous pouvez télécharger ou appliquer le brouillon au transcript.'
      : 'Prévisualisation prête, mais la structure du transcript ne peut pas être reconstruite proprement. Téléchargement uniquement.';

    if (!mapped) {
      logEvent('segment_rebuild_failed', { jobId: state.previewJobId, previewLength: outputText.length });
    }
  }

  async function runModalAction(action) {
    const ui = createUi();
    try {
      if (action === 'preview' || !state.previewText || state.previewJobId !== getJobId()) {
        setModalBusy(true, 'Anonymisation en cours…');
        await buildPreview();
      }

      if (action === 'download') {
        downloadTextFile(state.previewText, 'Transcript_anonymise.txt');
        notify('Fichier téléchargé : Transcript_anonymise.txt');
        logEvent('download', { jobId: state.previewJobId });
        closeModal();
        return;
      }

      if (action === 'apply') {
        if (!state.previewSegments) {
          throw new Error('Impossible d’appliquer cette version dans l’éditeur. Téléchargement uniquement.');
        }
        applyPreviewToTranscript();
        closeModal();
        return;
      }
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.message === 'AbortError')) {
        notify('Anonymisation annulée.');
      } else if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        notify('Erreur réseau. Vérifiez votre connexion et réessayez.');
      } else {
        notify('Erreur : ' + ((err && err.message) || 'Une erreur est survenue.'));
      }
      logEvent('error', { step: action, message: err?.message || String(err) });
    } finally {
      abortController = null;
      ui.previewBtn.disabled = false;
      ui.closeBtn.disabled = false;
      ui.downloadBtn.disabled = !state.previewText;
      ui.applyBtn.disabled = !state.previewSegments;
    }
  }

  function applyPreviewToTranscript() {
    const currentJobId = getJobId();
    const originalState = captureTranscriptState();
    renderTranscriptSegments(state.previewSegments);
    state.originalTranscriptState = originalState;
    state.anonymizedDraftState = {
      jobId: currentJobId,
      segments: cloneSegments(state.previewSegments)
    };
    state.hasUnsavedAnonymizedDraft = true;
    state.hasSavedAnonymizedDraft = false;
    state.currentJobId = currentJobId;
    updateBanner();
    notify('Brouillon anonymisé appliqué localement. Sauvegardez pour l’enregistrer.');
    logEvent('apply', { jobId: currentJobId, segments: state.previewSegments.length });
  }

  function revertDraft() {
    if (!state.hasUnsavedAnonymizedDraft || !state.originalTranscriptState) return;
    restoreTranscriptState(state.originalTranscriptState);
    clearDraftState();
    updateBanner();
    notify('Transcript original restauré.');
    logEvent('revert', { jobId: getJobId() });
  }

  function clearDraftState() {
    state.originalTranscriptState = null;
    state.anonymizedDraftState = null;
    state.hasUnsavedAnonymizedDraft = false;
    state.hasSavedAnonymizedDraft = false;
  }

  function updateBanner() {
    const ui = createUi();
    if (!ui) return;
    const visible = state.hasUnsavedAnonymizedDraft || state.hasSavedAnonymizedDraft;
    ui.banner.classList.toggle('is-visible', visible);
    ui.banner.classList.toggle('is-saved', state.hasSavedAnonymizedDraft && !state.hasUnsavedAnonymizedDraft);
    if (!visible) return;

    if (state.hasSavedAnonymizedDraft) {
      ui.bannerTitle.textContent = 'Transcript anonymisé sauvegardé';
      ui.bannerText.textContent = 'La version serveur est désormais anonymisée. Vous pouvez régénérer le compte-rendu.';
      ui.bannerSaveBtn.style.display = 'none';
      ui.bannerRevertBtn.style.display = 'none';
      ui.bannerRedoBtn.disabled = false;
    } else {
      ui.bannerTitle.textContent = 'Brouillon anonymisé non sauvegardé';
      ui.bannerText.textContent = 'Le transcript visible est anonymisé localement. Sauvegardez pour en faire la version serveur.';
      ui.bannerSaveBtn.style.display = '';
      ui.bannerRevertBtn.style.display = '';
      ui.bannerRedoBtn.disabled = true;
    }
  }

  async function triggerSave() {
    if (!window.__agiloAnonWrappedSave) {
      notify('Sauvegarde indisponible pour le moment. Réessayez dans quelques secondes.');
      return;
    }
    try {
      const result = await window.__agiloAnonWrappedSave();
      if (!result || result.ok !== true) return result;
      state.hasUnsavedAnonymizedDraft = false;
      state.hasSavedAnonymizedDraft = true;
      state.originalTranscriptState = null;
      updateBanner();
      logEvent('save_success', { jobId: getJobId() });
      return result;
    } catch (err) {
      logEvent('save_error', { jobId: getJobId(), message: err?.message || String(err) });
      throw err;
    }
  }

  function triggerRedoSummary() {
    if (!state.hasSavedAnonymizedDraft) return;
    const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
    if (!btn) {
      notify('Le bouton de régénération du compte-rendu est introuvable.');
      return;
    }
    btn.click();
    logEvent('redo_summary', { jobId: getJobId() });
  }

  function setupSaveBridge() {
    if (state.saveBridgeReady) return;
    const originalSave = window.agiloSaveNow;
    if (typeof originalSave !== 'function') return;

    window.__agiloAnonWrappedSave = async function wrappedSave() {
      return originalSave();
    };

    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (saveBtn && !saveBtn.__agiloAnonSaveAttached) {
      saveBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        await triggerSave();
      }, true);
      saveBtn.__agiloAnonSaveAttached = true;
    }

    state.saveBridgeReady = true;
  }

  function updateButtonVisibility() {
    const btn = document.querySelector('[data-action="anonymiser"]');
    if (!btn) return;
    const tab = getActiveTab();
    if (tab === 'transcript') {
      btn.style.display = '';
      btn.style.visibility = '';
      btn.removeAttribute('hidden');
      btn.removeAttribute('aria-hidden');
      btn.title = 'Anonymiser le transcript';
    } else {
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
    }
  }

  function setupTabObserver() {
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => tab.addEventListener('click', () => setTimeout(updateButtonVisibility, 100)));

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((item) => item.type === 'attributes' && item.attributeName === 'aria-selected')) {
        setTimeout(updateButtonVisibility, 50);
      }
    });
    tabs.forEach((tab) => observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected', 'class'] }));
  }

  function monitorJobChanges() {
    state.currentJobId = getJobId();
    setInterval(() => {
      const latestJobId = getJobId();
      if (!latestJobId || latestJobId === state.currentJobId) {
        setupSaveBridge();
        return;
      }
      state.currentJobId = latestJobId;
      clearDraftState();
      state.previewText = '';
      state.previewSegments = null;
      updateBanner();
      closeModal();
    }, 800);
  }

  function anonymiser() {
    if (getActiveTab() !== 'transcript') {
      notify('Anonymisation disponible uniquement sur l’onglet Transcription.');
      return;
    }
    openModal();
  }

  function init() {
    if (window.__agiloAnonymiserInitialized) return;
    window.__agiloAnonymiserInitialized = true;

    restoreConfig();
    window.agiloAnonymiser = anonymiser;

    let attempts = 0;
    const maxAttempts = 20;

    function trySetup() {
      attempts += 1;
      const btn = document.querySelector('[data-action="anonymiser"]');
      setupSaveBridge();
      if (btn) {
        createUi();
        updateBanner();
        if (!btn.__anonymiserListenerAttached) {
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            anonymiser();
          });
          btn.__anonymiserListenerAttached = true;
        }
        updateButtonVisibility();
        setupTabObserver();
        monitorJobChanges();
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(trySetup, 500);
      } else {
        console.error('[AGILO:ANON] Bouton non trouvé. Assurez-vous que data-action="anonymiser" est présent dans Webflow.');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trySetup, { once: true });
    } else {
      trySetup();
    }
  }

  init();
})();
