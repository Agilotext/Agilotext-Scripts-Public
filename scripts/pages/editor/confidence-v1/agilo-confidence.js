// Agilotext — Confidence transcript V2 (segment-level)
(function () {
  'use strict';

  if (window.__agiloConfidence) return;
  window.__agiloConfidence = true;

  const DEFAULT_API_BASE = 'https://api.agilotext.com/api/v1';
  const LEVELS = new Set(['normal', 'verify', 'low']);

  let __fetchController = null;
  let __currentJobId = '';
  let __confidenceVisible = true;
  let __confidenceJson = null;
  let __reconciledMap = new Map();
  let __localModified = new Set();
  let __navIndex = -1;
  let __navKeys = [];
  let __transcriptRoot = null;

  function debugLog(reason, details) {
    if (window.AGILO_DEBUG) {
      console.warn('[agilo:confidence]', reason, details);
    }
  }

  function isConfidenceEnabled() {
    return window.AGILOTEXT_ENABLE_CONFIDENCE !== false;
  }

  function pct(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n * 100)));
  }

  function badgeLabel(level, score) {
    const p = pct(score);
    if (level === 'low') return `Faible confiance · ${p}%`;
    if (level === 'verify') return `À vérifier · ${p}%`;
    return `${p}%`;
  }

  function tooltipFor(item, modified) {
    const p = pct(item.score);
    if (modified) {
      return `Confiance audio : ${p}% · texte modifié manuellement`;
    }
    return `Confiance audio : ${p}% · calculée sur l'audio original`;
  }

  function abortCurrentConfidenceFetch() {
    try { __fetchController?.abort?.(); } catch { /* ignore */ }
    __fetchController = null;
  }

  function getTranscriptRoot() {
    return __transcriptRoot ||
      document.getElementById('transcriptEditor') ||
      document.getElementById('ag-transcript') ||
      document.querySelector('[data-editor="transcript"]') ||
      null;
  }

  function removeSegmentConfidenceDecorations(art) {
    if (!art) return;
    art.classList.remove('ag-confidence-normal', 'ag-confidence-verify', 'ag-confidence-low', 'is-confidence-nav-active');
    art.removeAttribute('data-confidence-level');
    art.removeAttribute('data-confidence-local-modified');
    art.querySelectorAll('.ag-confidence-badge, .ag-confidence-modified').forEach(el => el.remove());
  }

  function clearConfidenceUi() {
    const root = getTranscriptRoot();
    if (root) {
      root.querySelectorAll('.ag-seg').forEach(removeSegmentConfidenceDecorations);
    }
    const panel = document.getElementById('ag-confidence-panel');
    if (panel) panel.remove();
    __confidenceJson = null;
    __reconciledMap = new Map();
    __localModified = new Set();
    __navIndex = -1;
    __navKeys = [];
  }

  function resetSessionState() {
    abortCurrentConfidenceFetch();
    clearConfidenceUi();
    __currentJobId = '';
    __transcriptRoot = null;
    __confidenceVisible = true;
  }

  /**
   * Réconciliation segment-level stricte (V2).
   * segmentId présent mais introuvable → ignoré (pas de fallback index).
   */
  function reconcileConfidenceSegments(mainSegments, confidenceJson) {
    const result = new Map();
    if (!confidenceJson || confidenceJson.available !== true) return result;
    if (!Array.isArray(mainSegments)) return result;
    if (!Array.isArray(confidenceJson.segmentsConfidence)) return result;

    const byId = new Map();
    mainSegments.forEach((segment, index) => {
      if (segment && segment.id != null) {
        byId.set(String(segment.id), { segment, index });
      }
    });

    confidenceJson.segmentsConfidence.forEach((item) => {
      if (!item || typeof item.score !== 'number') return;
      if (item.score < 0 || item.score > 1) return;
      if (!LEVELS.has(item.level)) return;

      let match = null;

      if (item.segmentId != null && String(item.segmentId) !== '') {
        match = byId.get(String(item.segmentId)) || null;
        if (!match) return;
      } else if (Number.isInteger(item.segmentIndex)) {
        const segment = mainSegments[item.segmentIndex];
        if (!segment) return;
        match = { segment, index: item.segmentIndex };
      }

      if (!match) return;

      const key = match.segment.id != null ? String(match.segment.id) : String(match.index);
      result.set(key, {
        ...item,
        segmentId: key,
        segmentIndex: match.index
      });
    });

    return result;
  }

  function computeSummaryFallback(segmentsConfidence, localModifiedCount) {
    if (!Array.isArray(segmentsConfidence) || !segmentsConfidence.length) return null;

    let weightedSum = 0;
    let totalWords = 0;
    let verifySegments = 0;
    let lowSegments = 0;
    let modifiedSegments = 0;

    segmentsConfidence.forEach((item) => {
      if (!item || typeof item.score !== 'number') return;
      const wc = Number.isFinite(item.wordCount) && item.wordCount > 0 ? item.wordCount : 1;
      weightedSum += item.score * wc;
      totalWords += wc;
      if (item.level === 'verify') verifySegments++;
      if (item.level === 'low') lowSegments++;
      if (item.textModified === true) modifiedSegments++;
    });

    if (localModifiedCount > 0) {
      modifiedSegments = Math.max(modifiedSegments, localModifiedCount);
    }

    return {
      globalScore: totalWords > 0 ? weightedSum / totalWords : 0,
      totalSegments: segmentsConfidence.length,
      verifySegments,
      lowSegments,
      modifiedSegments
    };
  }

  function getSummaryDisplay(confidenceJson, localModifiedCount) {
    if (confidenceJson?.summary && typeof confidenceJson.summary.globalScore === 'number') {
      const s = confidenceJson.summary;
      return {
        globalScore: s.globalScore,
        totalSegments: s.totalSegments ?? 0,
        verifySegments: s.verifySegments ?? 0,
        lowSegments: s.lowSegments ?? 0,
        modifiedSegments: Math.max(s.modifiedSegments ?? 0, localModifiedCount)
      };
    }
    return computeSummaryFallback(confidenceJson?.segmentsConfidence, localModifiedCount);
  }

  function isSegmentModified(item, segmentIndex) {
    return item.textModified === true || __localModified.has(segmentIndex);
  }

  function decorateSegmentWithConfidence(art, item, segmentIndex) {
    if (!art || !item) return;

    removeSegmentConfidenceDecorations(art);

    const level = item.level;
    const modified = isSegmentModified(item, segmentIndex);

    if (level === 'normal' && !modified) return;

    art.classList.add(`ag-confidence-${level}`);
    art.dataset.confidenceLevel = level;
    if (modified) {
      art.dataset.confidenceLocalModified = 'true';
    }

    const head = art.querySelector('.ag-seg__head');
    if (!head) return;

    const badge = document.createElement('span');
    badge.className = 'ag-confidence-badge';
    badge.title = tooltipFor(item, modified);
    badge.textContent = badgeLabel(level, item.score);
    head.appendChild(badge);

    if (modified) {
      const mod = document.createElement('span');
      mod.className = 'ag-confidence-modified';
      mod.textContent = 'Texte modifié';
      head.appendChild(mod);
    }
  }

  function applyConfidenceToDom(transcriptRoot, reconciledMap) {
    if (!transcriptRoot || !reconciledMap?.size) return;

    transcriptRoot.querySelectorAll('.ag-seg').forEach((art) => {
      const segId = art.dataset.id || '';
      const item = reconciledMap.get(segId);
      if (!item) return;
      decorateSegmentWithConfidence(art, item, item.segmentIndex);
    });
  }

  /**
   * Navigation « Zone suivante » : priorité UI low → verify → textModified,
   * puis ordre segmentIndex (aligné avec arbitrage plan client V2).
   */
  function buildNavigationOrder(reconciledMap) {
    const entries = Array.from(reconciledMap.entries());

    entries.sort((a, b) => {
      const itemA = a[1];
      const itemB = b[1];
      const modA = isSegmentModified(itemA, itemA.segmentIndex);
      const modB = isSegmentModified(itemB, itemB.segmentIndex);

      const priA = itemA.level === 'low' ? 0 : itemA.level === 'verify' ? 1 : modA ? 2 : 3;
      const priB = itemB.level === 'low' ? 0 : itemB.level === 'verify' ? 1 : modB ? 2 : 3;
      if (priA !== priB) return priA - priB;

      const idxA = Number.isInteger(itemA.segmentIndex) ? itemA.segmentIndex : 999999;
      const idxB = Number.isInteger(itemB.segmentIndex) ? itemB.segmentIndex : 999999;
      return idxA - idxB;
    });

    return entries
      .filter(([_, item]) => {
        if (item.level === 'low' || item.level === 'verify') return true;
        return isSegmentModified(item, item.segmentIndex);
      })
      .map(([key]) => key);
  }

  function activateNavTarget(segId) {
    const root = getTranscriptRoot();
    if (!root) return;
    root.querySelectorAll('.ag-seg.is-confidence-nav-active').forEach(el => {
      el.classList.remove('is-confidence-nav-active');
    });
    const art = root.querySelector(`.ag-seg[data-id="${CSS.escape(segId)}"]`);
    if (!art) return;
    art.classList.add('is-confidence-nav-active');
    art.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function goToNextConfidenceZone() {
    if (!__navKeys.length) {
      __navKeys = buildNavigationOrder(__reconciledMap);
    }
    if (!__navKeys.length) return;

    __navIndex = (__navIndex + 1) % __navKeys.length;
    activateNavTarget(__navKeys[__navIndex]);

    const countEl = document.getElementById('ag-confidence-nav-count');
    if (countEl) {
      countEl.textContent = `Zone ${__navIndex + 1} / ${__navKeys.length}`;
    }
  }

  function renderConfidencePanel(transcriptRoot, summary) {
    if (!transcriptRoot || !summary) return null;

    let panel = document.getElementById('ag-confidence-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ag-confidence-panel';
      panel.className = 'ag-confidence-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Confidence transcription');
      transcriptRoot.parentElement?.insertBefore(panel, transcriptRoot);
    }

    const globalPct = pct(summary.globalScore);
    panel.innerHTML =
      `<span class="ag-confidence-panel__score">Confidence globale : <strong>${globalPct}%</strong></span>` +
      `<span class="ag-confidence-panel__stat">${summary.verifySegments} zone${summary.verifySegments !== 1 ? 's' : ''} à vérifier</span>` +
      `<span class="ag-confidence-panel__stat">${summary.lowSegments} faible${summary.lowSegments !== 1 ? 's' : ''} confiance${summary.lowSegments !== 1 ? 's' : ''}</span>` +
      `<span class="ag-confidence-panel__stat">${summary.modifiedSegments} segment${summary.modifiedSegments !== 1 ? 's' : ''} modifié${summary.modifiedSegments !== 1 ? 's' : ''}</span>` +
      '<button type="button" class="ag-confidence-panel__btn" id="ag-confidence-next">Zone suivante</button>' +
      '<button type="button" class="ag-confidence-panel__btn ag-confidence-panel__btn--ghost" id="ag-confidence-toggle">Masquer</button>' +
      '<span id="ag-confidence-nav-count" class="ag-confidence-panel__nav-count" aria-live="polite"></span>';

    panel.querySelector('#ag-confidence-next')?.addEventListener('click', goToNextConfidenceZone);
    panel.querySelector('#ag-confidence-toggle')?.addEventListener('click', () => {
      setConfidenceVisible(!__confidenceVisible);
    });

    panel.classList.toggle('is-hidden', !__confidenceVisible);
    return panel;
  }

  function setConfidenceVisible(visible) {
    __confidenceVisible = visible !== false;
    const panel = document.getElementById('ag-confidence-panel');
    if (panel) {
      panel.classList.toggle('is-hidden', !__confidenceVisible);
      const toggleBtn = panel.querySelector('#ag-confidence-toggle');
      if (toggleBtn) toggleBtn.textContent = __confidenceVisible ? 'Masquer' : 'Afficher';
    }

    const root = getTranscriptRoot();
    if (!root) return;

    root.querySelectorAll('.ag-seg').forEach((art) => {
      const segId = art.dataset.id || '';
      const item = __reconciledMap.get(segId);
      if (!item) return;

      if (__confidenceVisible) {
        decorateSegmentWithConfidence(art, item, item.segmentIndex);
      } else {
        removeSegmentConfidenceDecorations(art);
      }
    });
  }

  async function fetchConfidenceJson(apiBaseUrl, credentials, jobId, signal) {
    if (!isConfidenceEnabled()) return null;

    const base = String(apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');
    const body = new URLSearchParams({
      username: String(credentials?.username || credentials?.email || ''),
      token: String(credentials?.token || ''),
      edition: String(credentials?.edition || 'ent'),
      jobId: String(jobId || '')
    });

    try {
      const response = await fetch(`${base}/receiveConfidenceTextJson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        credentials: 'omit',
        cache: 'no-store',
        signal
      });

      if (!response.ok) return null;

      try {
        return await response.json();
      } catch {
        return null;
      }
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      debugLog('fetch failed', e);
      return null;
    }
  }

  function markSegmentModified(idx) {
    if (!Number.isInteger(idx) || idx < 0) return;
    __localModified.add(idx);

    const root = getTranscriptRoot();
    if (!root || !__confidenceVisible) return;

    const art = root.children[idx];
    if (!art || !art.classList.contains('ag-seg')) return;

    const segId = art.dataset.id || '';
    const item = __reconciledMap.get(segId);
    if (!item) return;

    decorateSegmentWithConfidence(art, item, idx);

    const summary = getSummaryDisplay(__confidenceJson, __localModified.size);
    if (summary) renderConfidencePanel(root, summary);
  }

  async function applyConfidenceData({
    jobId,
    confidenceJson,
    mainSegments,
    transcriptRoot
  }) {
    if (String(confidenceJson?.jobId) !== String(jobId) && confidenceJson?.jobId != null) {
      debugLog('jobId mismatch', { expected: jobId, got: confidenceJson.jobId });
      return { applied: false, reason: 'jobId_mismatch' };
    }

    if (!confidenceJson || confidenceJson.available !== true) {
      return { applied: false, reason: 'unavailable' };
    }

    if (!Array.isArray(confidenceJson.segmentsConfidence)) {
      return { applied: false, reason: 'no_segments' };
    }

    const reconciled = reconcileConfidenceSegments(mainSegments, confidenceJson);
    if (!reconciled.size) {
      return { applied: false, reason: 'no_matches' };
    }

    __confidenceJson = confidenceJson;
    __reconciledMap = reconciled;
    __localModified = new Set();
    __navIndex = -1;
    __navKeys = buildNavigationOrder(reconciled);
    __transcriptRoot = transcriptRoot;
    __currentJobId = String(jobId);

    const summary = getSummaryDisplay(confidenceJson, 0);
    renderConfidencePanel(transcriptRoot, summary);
    applyConfidenceToDom(transcriptRoot, reconciled);

    return { applied: true, count: reconciled.size };
  }

  async function reloadConfidenceForCurrentJob(opts = {}) {
    if (!isConfidenceEnabled()) {
      clearConfidenceUi();
      return { applied: false };
    }

    const jobId = String(opts.jobId || __currentJobId || document.getElementById('editorRoot')?.dataset?.jobId || '').trim();
    if (!jobId) return { applied: false };

    const transcriptRoot = opts.transcriptRoot || getTranscriptRoot();
    if (!transcriptRoot) return { applied: false };

    const mainSegments = Array.isArray(opts.mainSegments)
      ? opts.mainSegments
      : (window._segments || []).map((s, i) => ({
        id: String(s.id || `s${i}`),
        text: String(s.text || '')
      }));

    if (!mainSegments.length) return { applied: false };

    abortCurrentConfidenceFetch();
    __fetchController = new AbortController();
    const signal = opts.signal || __fetchController.signal;
    const requestJobId = String(jobId);
    __currentJobId = requestJobId;

    try {
      const confidenceJson = await fetchConfidenceJson(
        opts.apiBaseUrl,
        opts.credentials,
        requestJobId,
        signal
      );

      if (__currentJobId !== requestJobId) {
        return { applied: false, reason: 'stale_job' };
      }

      return await applyConfidenceData({
        jobId: requestJobId,
        confidenceJson,
        mainSegments,
        transcriptRoot
      });
    } catch (e) {
      if (e?.name === 'AbortError') return { applied: false, reason: 'aborted' };
      debugLog('reload failed', e);
      return { applied: false };
    }
  }

  async function applyAfterTranscriptLoad({
    apiBaseUrl,
    credentials,
    jobId,
    mainJson,
    transcriptRoot,
    signal
  }) {
    __currentJobId = String(jobId || '');
    __transcriptRoot = transcriptRoot || getTranscriptRoot();

    const mainSegments = Array.isArray(mainJson?.segments)
      ? mainJson.segments
      : (window._segments || []).map((s, i) => ({
        id: String(s.id || `s${i}`),
        text: String(s.text || '')
      }));

    return reloadConfidenceForCurrentJob({
      jobId,
      apiBaseUrl,
      credentials,
      mainSegments,
      transcriptRoot: __transcriptRoot,
      signal
    });
  }

  function initOrchestrator() {
    if (!window.__agiloOrchestrator || window.__agiloConfidenceOrchestratorBound) return;
    window.__agiloConfidenceOrchestratorBound = true;

    window.__agiloOrchestrator.subscribe('confidence', {
      cancel() {
        abortCurrentConfidenceFetch();
        clearConfidenceUi();
        if (window.AGILO_DEBUG) console.log('[agilo:confidence] Cancelled by orchestrator');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrchestrator);
  } else {
    initOrchestrator();
  }

  window.addEventListener('agilo:beforeload', () => {
    abortCurrentConfidenceFetch();
    clearConfidenceUi();
    __currentJobId = '';
  });

  window.AgiloConfidence = {
    reload: reloadConfidenceForCurrentJob,
    clear: clearConfidenceUi,
    markSegmentModified,
    toggle: setConfidenceVisible,
    // API interne / tests
    isConfidenceEnabled,
    fetchConfidenceJson,
    reconcileConfidenceSegments,
    computeSummaryFallback,
    buildNavigationOrder,
    applyConfidenceData,
    applyAfterTranscriptLoad,
    resetSessionState,
    abortCurrentConfidenceFetch,
    goToNextConfidenceZone,
    getCurrentNavIndex: () => __navIndex
  };
})();
