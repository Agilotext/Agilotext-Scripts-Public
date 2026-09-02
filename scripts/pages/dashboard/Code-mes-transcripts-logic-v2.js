/* =============================================================================
   AGILOTEXT — Mes transcripts logic v2.2.8-retention-honest
   v2.2.8-retention-honest — messages audio / fantôme honnêtes, Pro ≠ Business.
   v2.2.7-demo-row — ligne exemple : plus de badge, une hauteur, clics bloqués.
   v2.2.6-empty-demo — liste vide Free n’est plus une erreur ; 1 ligne exemple hors cache.
   v2.2.5-summary-probe — GET receiveSummary html sur la page visible avant le menu formats.
   v2.2.4-summary-guard — filet CR en capture document (stoppe target=_blank / IX Webflow).
   v2.2.3-summary-guard — filet receiveSummary KO (READY menteur / STALE) :
   clic CR → fetch, si fichier absent lock « Indisponible » au lieu du JSON.
   v2.2.2-fullclient — fetch all (progressive 100→2000), tri/pagination client,
   cache invalidation, polling 60s (API ignore sortDir)
   Remplacer l'embed v1 sur agilotext-test — ne jamais charger v1 et v2 ensemble.
   =============================================================================
   AGILOTEXT DASHBOARD LOGIC (UNIFIED NICKEL VERSION)
   - Rendering & Rename (v1.1.4 FIXED for Extension issue)
   - Bulk Actions Module (v2.4.0)
   - v1.06: receiveSummary pour download_wrapper-link_summary_* (compte rendu)
   - v1.06.1: ne pas forcer display:inline-block sur les liens (laisser le flex Webflow)
   - v1.08: liste blanche receiveText ; verrou téléchargements vides ; tooltips État ;
            icônes SVG alignées editor ; data-creation-date ; aria-expanded fermé au rendu.
   ============================================================================= */

(function () {
  'use strict';

  if (window.__AGILO_LOGIC_ACTIVE) return;
  window.__AGILO_LOGIC_ACTIVE = true;
  window.__agiloMesTranscriptsLogicVersion = '2.2.8-retention-honest';

  const PAGE_SIZE = 25;
  const FETCH_LIMIT_TOTAL = 2000;
  const FETCH_LIMIT_INITIAL = 100;
  const POLLING_INTERVAL_MS = 60000;
  const DEFAULT_SORT_DIR = 'desc';
  const JOBS_MAP_TOTAL_KEYS = ['total', 'totalCount', 'totalJobs', 'jobsCount', 'nbJobs'];
  const API_BASE = 'https://api.agilotext.com/api/v1';
  function retentionMessage(kind, opts) {
    const edition = (opts && opts.edition) || getEdition();
    if (typeof window.agiloRetentionMessages === 'function') {
      return window.agiloRetentionMessages(edition, kind, opts);
    }
    const jobId = opts && (opts.jobId || opts.jobid);
    const job = jobId ? ' (job ' + jobId + ')' : '';
    if (kind === 'audio_expired') {
      if (edition === 'free') return 'Cet audio n’est plus disponible : il a été supprimé après 24 heures (offre Gratuit).';
      if (edition === 'pro') return 'Cet audio n’est plus disponible : il a été supprimé après 30 jours (offre Pro).';
      return 'Cet audio n’est plus disponible : il a été supprimé après 30 jours (offre Business).';
    }
    if (kind === 'ghost_transcript') {
      if (edition === 'ent') {
        return 'Cette transcription n’est plus sur le serveur. Ce n’est pas le comportement prévu de l’offre Business. Contactez le support avec le numéro du job' + job + '.';
      }
      return 'Cette transcription n’est plus sur le serveur. Contactez le support avec le numéro du job' + job + '.';
    }
    if (edition === 'free') return 'Cette transcription ou ce compte rendu n’est plus disponible : conservation 7 jours (offre Gratuit).';
    if (edition === 'pro') return 'Cette transcription ou ce compte rendu n’est plus disponible : conservation 1 an (offre Pro).';
    return 'Cette transcription n’est plus sur le serveur. Ce n’est pas le comportement prévu de l’offre Business. Contactez le support avec le numéro du job' + job + '.';
  }
  const AUDIO_EXPIRED_MESSAGE = window.agiloAudioExpiredMessage || retentionMessage('audio_expired');
  const AUTH_AUDIO_MESSAGE = 'Votre accès audio a expiré ou n’est plus valide. Rechargez la page puis réessayez.';
  const AUDIO_GENERIC_MESSAGE = 'Impossible de récupérer cet audio pour le moment.';
  const AUDIO_AUTH_HINT_RE = /(invalid token|expired token|token invalide|jeton invalide|unauthorized|forbidden|authentication|authentification|missing token|error_invalid_token|error_token)/i;
  const TEXT_ASSET_EXPIRED_MESSAGE = retentionMessage('text_retention');
  const SUMMARY_MISSING_MESSAGE = 'Le compte-rendu n’est plus disponible.';
  const SUMMARY_MISSING_HINT_RE = /(error_summary_transcript_file_not_exists|summary_transcript_file_not_exists|file_not_exists)/i;
  const SUMMARY_PROBE_POOL = 4;
  const summaryProbeByJobId = new Map();
  const summaryProbeInflight = new Map();
  let summaryProbeAbort = null;
  let lastSummaryCreds = { userEmail: '', token: '', edition: 'ent' };

  function tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function isAudioExpiredPayload(payload) {
    if (typeof window.agiloIsAudioExpiredPayload === 'function') {
      try {
        return !!window.agiloIsAudioExpiredPayload(payload);
      } catch (_) {}
    }
    const txt =
      payload == null ? '' : String(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return txt.toLowerCase().includes('error_audio_file_expired');
  }

  function isAudioAuthPayload(payload, statusCode) {
    if (statusCode === 401 || statusCode === 403) return true;
    if (!payload) return false;
    const txt = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return AUDIO_AUTH_HINT_RE.test(String(txt || ''));
  }

  function getAudioFailureMessage(payload, fallbackPrimary) {
    if (typeof window.agiloJobErrorParts === 'function') {
      try {
        const parts = window.agiloJobErrorParts(
          typeof payload === 'object' && payload ? payload : { userErrorMessage: String(payload || '') },
          fallbackPrimary
        );
        return parts?.primary || fallbackPrimary;
      } catch (_) {}
    }
    return fallbackPrimary;
  }

  async function refreshTokenForAudioDownload(userEmail, edition) {
    const email = String(userEmail || '').trim();
    const ed = String(edition || getEdition() || 'ent').trim();
    if (!email) return '';
    const tokenBefore = String(window.globalToken || '');

    try {
      if (typeof window.getToken === 'function') {
        await window.getToken(email, ed, true);
      }
    } catch (err) {
      console.warn('[Agilo][MesTranscripts][v2] window.getToken failed before audio download', err);
    }

    for (let i = 0; i < 8; i++) {
      if (window.globalToken && String(window.globalToken) !== tokenBefore) return window.globalToken;
      if (window.globalToken && !tokenBefore) return window.globalToken;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (window.globalToken) return window.globalToken;

    try {
      const url = `${API_BASE}/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(ed)}`;
      const r = await fetch(url, { cache: 'no-store', credentials: 'omit' });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data?.status === 'OK' && data?.token) {
        window.globalToken = data.token;
        return data.token;
      }
    } catch (err) {
      console.warn('[Agilo][MesTranscripts][v2] getToken fallback failed', err);
    }

    return window.globalToken || '';
  }

  function buildAudioDownloadUrl({ jobId, userEmail, token, edition }) {
    return `${API_BASE}/receiveAudio?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(
      userEmail
    )}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(edition)}`;
  }

  async function verifyAudioDownloadUrl(url) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          Range: 'bytes=0-0',
          Accept: 'audio/*,application/octet-stream,application/json,text/plain,text/html;q=0.9'
        }
      });
      clearTimeout(timer);

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const cd = r.headers.get('content-disposition') || '';
      const binaryOk = r.ok && (
        ct.indexOf('audio/') === 0 ||
        ct.indexOf('application/octet-stream') === 0 ||
        /attachment|filename=/i.test(cd)
      );

      if (binaryOk) {
        try {
          await r.body?.cancel?.();
        } catch (_) {}
        return { ok: true };
      }

      const text = await r.text().catch(() => '');
      const payload = tryParseJson(text) || text;

      if (isAudioExpiredPayload(payload)) {
        return { ok: false, type: 'audio_expired', message: AUDIO_EXPIRED_MESSAGE };
      }
      if (isAudioAuthPayload(payload, r.status)) {
        return { ok: false, type: 'auth', message: AUTH_AUDIO_MESSAGE };
      }
      if (typeof payload === 'object' && payload && String(payload.status || '').toUpperCase() === 'OK') {
        return { ok: true };
      }

      return {
        ok: false,
        type: 'generic',
        message: getAudioFailureMessage(payload, AUDIO_GENERIC_MESSAGE)
      };
    } catch (err) {
      console.warn('[Agilo][MesTranscripts][v2] verifyAudioDownloadUrl failed', err);
      return { ok: false, type: 'generic', message: AUDIO_GENERIC_MESSAGE };
    }
  }

  function bindAudioDownloadGuard(anchorEl, { job, userEmail, edition }) {
    if (!anchorEl || anchorEl.__agiloAudioGuardBound) return;
    anchorEl.__agiloAudioGuardBound = true;
    anchorEl.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const freshToken = await refreshTokenForAudioDownload(userEmail, edition);
      if (!freshToken) {
        window.alert(AUTH_AUDIO_MESSAGE);
        return;
      }

      const freshUrl = buildAudioDownloadUrl({
        jobId: job.jobid,
        userEmail,
        token: freshToken,
        edition
      });
      const check = await verifyAudioDownloadUrl(freshUrl);

      if (!check.ok) {
        window.alert(check.message || AUDIO_GENERIC_MESSAGE);
        return;
      }

      anchorEl.href = freshUrl;
      const tempLink = document.createElement('a');
      tempLink.href = freshUrl;
      tempLink.target = '_blank';
      tempLink.rel = 'noopener noreferrer';
      tempLink.download = anchorEl.getAttribute('download') || '';
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
    });
  }

  function summaryJobKey(jobOrId) {
    if (jobOrId && typeof jobOrId === 'object') return String(jobOrId.jobid || '');
    return String(jobOrId || '');
  }

  function rememberSummaryProbe(jobOrId, state) {
    const id = summaryJobKey(jobOrId);
    if (!id || (state !== 'ok' && state !== 'missing')) return;
    summaryProbeByJobId.set(id, state);
  }

  function applySummaryProbeToJob(job) {
    if (!job) return job;
    const id = summaryJobKey(job);
    if (id && summaryProbeByJobId.get(id) === 'missing') {
      job.__agiloSummaryUnavailable = true;
      job.__agiloSummaryUnavailableTitle = job.__agiloSummaryUnavailableTitle || SUMMARY_MISSING_MESSAGE;
    }
    return job;
  }

  function markSummaryUnavailable(job, title) {
    if (!job) return;
    rememberSummaryProbe(job, 'missing');
    job.__agiloSummaryUnavailable = true;
    job.__agiloSummaryUnavailableTitle = title || SUMMARY_MISSING_MESSAGE;
    if (Array.isArray(allJobsCache)) {
      const cached = allJobsCache.find((j) => String(j?.jobid) === String(job.jobid));
      if (cached) {
        cached.__agiloSummaryUnavailable = true;
        cached.__agiloSummaryUnavailableTitle = job.__agiloSummaryUnavailableTitle;
      }
    }
  }

  function isSummaryMissingPayload(payload, statusCode, byteLength) {
    if (statusCode === 404) return true;
    if (payload && typeof payload === 'object') {
      const status = String(payload.status || '').toUpperCase();
      const err = String(payload.errorMessage || payload.javaException || payload.exceptionName || '');
      if (status === 'KO' && (SUMMARY_MISSING_HINT_RE.test(err) || !err)) return true;
      if (SUMMARY_MISSING_HINT_RE.test(err)) return true;
    }
    if (typeof payload === 'string' && SUMMARY_MISSING_HINT_RE.test(payload)) return true;
    if (Number.isFinite(byteLength) && byteLength > 0 && byteLength < 80 && payload && typeof payload === 'object') {
      return true;
    }
    return false;
  }

  async function verifySummaryDownloadUrl(url, signal) {
    try {
      const res = await fetch(url, { credentials: 'omit', cache: 'no-store', signal });
      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      const buf = await res.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buf);
      const json = tryParseJson(text.trim()) || (text.trim().startsWith('{') ? tryParseJson(text) : null);

      if (json && isSummaryMissingPayload(json, res.status, buf.byteLength)) {
        return { ok: false, missing: true };
      }
      if (ct.includes('json') || (text.trim().startsWith('{') && json && String(json.status || '').toUpperCase() === 'KO')) {
        return { ok: false, missing: true };
      }
      if (!res.ok && isSummaryMissingPayload(json || text, res.status, buf.byteLength)) {
        return { ok: false, missing: true };
      }
      if (!res.ok && buf.byteLength < 400 && SUMMARY_MISSING_HINT_RE.test(text)) {
        return { ok: false, missing: true };
      }
      if (!res.ok) {
        return { ok: false, missing: false };
      }

      return {
        ok: true,
        blob: new Blob([buf], { type: ct || 'application/octet-stream' })
      };
    } catch (err) {
      if (err && err.name === 'AbortError') return { ok: false, missing: false, aborted: true };
      console.warn('[Agilo][MesTranscripts][v2] verifySummaryDownloadUrl failed', err);
      return { ok: false, missing: false };
    }
  }

  function buildSummaryHtmlUrl(job, userEmail, token, edition) {
    return `${API_BASE}/receiveSummary?jobId=${encodeURIComponent(
      job.jobid
    )}&username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(
      token
    )}&format=html&edition=${encodeURIComponent(edition)}`;
  }

  function beginSummaryProbeWave() {
    if (summaryProbeAbort) {
      try {
        summaryProbeAbort.abort();
      } catch (_) {}
    }
    summaryProbeAbort = new AbortController();
    return summaryProbeAbort;
  }

  function findRowByJobId(jobId) {
    const id = String(jobId || '');
    if (!id) return null;
    const root = document.getElementById('jobs-container');
    if (!root) return null;
    const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '');
    return root.querySelector(`.wrapper-content_item-row[data-job-id="${safe}"]`);
  }

  async function runSummaryProbePool(items, worker) {
    let index = 0;
    async function next() {
      while (index < items.length) {
        const current = items[index];
        index += 1;
        await worker(current);
      }
    }
    const n = Math.min(SUMMARY_PROBE_POOL, items.length);
    await Promise.all(Array.from({ length: n }, () => next()));
  }

  async function probeSummaryJob(job, { userEmail, token, edition, signal, url }) {
    const id = summaryJobKey(job);
    if (!id) return null;
    const known = summaryProbeByJobId.get(id);
    if (known) return known;
    if (summaryProbeInflight.has(id)) return summaryProbeInflight.get(id);

    const run = (async () => {
      const probeUrl = url || buildSummaryHtmlUrl(job, userEmail, token, edition);
      const check = await verifySummaryDownloadUrl(probeUrl, signal);
      if (check.aborted || signal?.aborted) return null;
      if (check.missing) {
        markSummaryUnavailable(job, SUMMARY_MISSING_MESSAGE);
        const row = findRowByJobId(id);
        if (row) setSummaryCellState(row, job);
        return 'missing';
      }
      if (check.ok) {
        rememberSummaryProbe(job, 'ok');
        return 'ok';
      }
      return null;
    })();

    summaryProbeInflight.set(id, run);
    try {
      return await run;
    } finally {
      summaryProbeInflight.delete(id);
    }
  }

  async function probeVisibleSummaries(jobs, creds) {
    const need = (jobs || []).filter((job) => {
      const id = summaryJobKey(job);
      if (!id || job.__agiloDemo || summaryProbeByJobId.has(id)) return false;
      return getSummaryAvailability(job).downloadable;
    });
    if (!need.length) return;
    await runSummaryProbePool(need, async (job) => {
      if (creds.signal?.aborted) return;
      await probeSummaryJob(job, creds);
    });
  }

  function triggerBlobDownload(blob, filename) {
    const href = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = href;
    tempLink.download = filename || 'summary';
    tempLink.rel = 'noopener noreferrer';
    tempLink.style.display = 'none';
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }

  function findJobForSummaryAnchor(anchorEl) {
    const row = anchorEl && anchorEl.closest ? anchorEl.closest('.wrapper-content_item-row') : null;
    const jobId = row && row.getAttribute('data-job-id');
    const cached = Array.isArray(allJobsCache)
      ? allJobsCache.find((j) => String(j?.jobid) === String(jobId))
      : null;
    return { row, job: cached || (jobId ? { jobid: jobId } : null) };
  }

  async function handleSummaryDownloadClick(anchorEl) {
    const url = String(anchorEl.getAttribute('href') || '').trim();
    if (!url || url === '#' || !url.includes('receiveSummary')) return;
    const { row, job } = findJobForSummaryAnchor(anchorEl);
    if (job?.__agiloSummaryUnavailable || summaryProbeByJobId.get(summaryJobKey(job)) === 'missing') {
      if (row && job) setSummaryCellState(row, job);
      return;
    }
    const check = await verifySummaryDownloadUrl(url);
    if (!check.ok) {
      if (check.missing && job) {
        markSummaryUnavailable(job, SUMMARY_MISSING_MESSAGE);
        if (row) setSummaryCellState(row, job);
      }
      return;
    }
    if (job) rememberSummaryProbe(job, 'ok');
    triggerBlobDownload(check.blob, anchorEl.getAttribute('download') || 'summary');
  }

  function isSummaryOptionsCell(el) {
    return !!(el && el.querySelector && el.querySelector('[class*="download_wrapper-link_summary_"]'));
  }

  function closeOtherDownloadPanels(keepPanel) {
    const root = document.getElementById('jobs-container');
    if (!root) return;
    root.querySelectorAll('.download_link-options').forEach((panel) => {
      if (panel !== keepPanel) panel.style.display = 'none';
    });
    root.querySelectorAll('.custom-element.options.is-open').forEach((box) => {
      if (keepPanel && box.contains(keepPanel)) return;
      box.classList.remove('is-open');
    });
  }

  function openSummaryFormatPanel(optionsEl) {
    if (!optionsEl) return;
    const panel = optionsEl.querySelector('.download_link-options');
    closeOtherDownloadPanels(panel);
    if (!panel) return;
    panel.style.display = 'block';
    optionsEl.classList.add('is-open');
    const toggle = optionsEl.querySelector('.download-link');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  async function handleSummaryToggleClick(event) {
    const optionsEl =
      event.target && event.target.closest ? event.target.closest('.custom-element.options') : null;
    if (!optionsEl || !isSummaryOptionsCell(optionsEl)) return;
    if (optionsEl.closest && optionsEl.closest('[data-agilo-demo="1"]')) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      return;
    }
    if (event.target.closest && event.target.closest('a[href*="receiveSummary"]')) return;

    const row = optionsEl.closest('.wrapper-content_item-row');
    const jobId = row && row.getAttribute('data-job-id');
    const job = (allJobsCache || []).find((j) => String(j?.jobid) === String(jobId));
    const state = jobId ? summaryProbeByJobId.get(String(jobId)) : null;

    if (state === 'ok') return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    if (state === 'missing' || job?.__agiloSummaryUnavailable) {
      if (row && job) setSummaryCellState(row, job);
      return;
    }

    if (!job) return;

    const htmlLink = optionsEl.querySelector('a[href*="receiveSummary"][href*="format=html"]');
    const anyLink = htmlLink || optionsEl.querySelector('a[href*="receiveSummary"]');
    const url = anyLink && String(anyLink.getAttribute('href') || '');
    const probed = await probeSummaryJob(job, {
      ...lastSummaryCreds,
      url: url && url.includes('receiveSummary') ? url : undefined
    });
    if (probed === 'missing') return;
    if (probed === 'ok' || summaryProbeByJobId.get(String(jobId)) === 'ok') {
      openSummaryFormatPanel(optionsEl);
    }
  }

  function isSummaryDownloadAnchor(node) {
    if (!node || node.tagName !== 'A') return false;
    const href = String(node.getAttribute('href') || '');
    return href.includes('receiveSummary');
  }

  function neutralizeSummaryNavigation(anchorEl) {
    if (!anchorEl) return;
    anchorEl.removeAttribute('target');
    anchorEl.removeAttribute('data-w-id');
    anchorEl.setAttribute('rel', 'nofollow');
  }

  function bindSummaryDownloadGuard(anchorEl) {
    if (!anchorEl) return;
    neutralizeSummaryNavigation(anchorEl);
  }

  function installSummaryDownloadGuard() {
    if (window.__agiloSummaryDownloadGuard) return;
    window.__agiloSummaryDownloadGuard = true;
    const intercept = (event) => {
      const anchorEl =
        event.target && event.target.closest ? event.target.closest('a[href*="receiveSummary"]') : null;
      if (!anchorEl || !isSummaryDownloadAnchor(anchorEl)) return;
      if (event.type === 'click' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      handleSummaryDownloadClick(anchorEl);
    };
    document.addEventListener('click', intercept, true);
    document.addEventListener('auxclick', (event) => {
      const anchorEl =
        event.target && event.target.closest ? event.target.closest('a[href*="receiveSummary"]') : null;
      if (!anchorEl || !isSummaryDownloadAnchor(anchorEl)) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }, true);
  }

  function installSummaryMenuGate() {
    if (window.__agiloSummaryMenuGate) return;
    window.__agiloSummaryMenuGate = true;
    document.addEventListener('click', handleSummaryToggleClick, true);
  }

  function installDemoClickGuard() {
    if (window.__agiloDemoClickGuard) return;
    window.__agiloDemoClickGuard = true;
    const block = (event) => {
      const row =
        event.target && event.target.closest ? event.target.closest('[data-agilo-demo="1"]') : null;
      if (!row) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    };
    document.addEventListener('click', block, true);
    document.addEventListener('auxclick', block, true);
  }

  installSummaryDownloadGuard();
  installSummaryMenuGate();
  installDemoClickGuard();

  let allJobsCache = null;
  let cacheKey = '';
  let cacheTotalKnown = false;
  let pollTimer = null;
  let loadPageFromCacheFn = null;
  let currentPollingEdition = 'ent';

  function readSortDirFromUrl() {
    const v = new URLSearchParams(window.location.search).get('sortDir');
    return v === 'asc' ? 'asc' : DEFAULT_SORT_DIR;
  }

  let currentSortDir = readSortDirFromUrl();

  (function injectAgiloMesTranscriptsLockStyles() {
    if (document.getElementById('agilo-mes-transcripts-lock-style')) return;
    const style = document.createElement('style');
    style.id = 'agilo-mes-transcripts-lock-style';
    style.textContent =
      '#jobs-container .custom-element.options.agilo-download-locked{' +
      'pointer-events:none;opacity:.5;cursor:not-allowed;}' +
      '#jobs-container .custom-element.options.agilo-download-locked .download-link,' +
      '#jobs-container .custom-element.options.agilo-download-locked svg.options{cursor:not-allowed;}' +
      '#agilo-pagination{display:flex;align-items:center;justify-content:center;gap:12px;padding:16px 0;font-size:13px;color:#525252;}' +
      '#agilo-pagination button{height:34px;padding:0 14px;border:1px solid rgba(82,82,82,.2);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;color:#374151;}' +
      '#agilo-pagination button:disabled{opacity:.4;cursor:default;}' +
      '#agilo-pagination .agilo-page-info{color:#6b7280;}' +
      '.agilo-loading-row{grid-column:1/-1;padding:40px 20px;text-align:center;color:#6b7280;font-size:14px;}';
    document.head.appendChild(style);
    cleanupBulkPageHint();
  })();

  function readPageFromUrl() {
    try {
      const raw = new URLSearchParams(window.location.search).get('page');
      const n = parseInt(raw || '1', 10);
      if (!Number.isFinite(n) || n <= 1) return 0;
      return n - 1;
    } catch {
      return 0;
    }
  }

  function updateUrlPage(page0) {
    try {
      const url = new URL(window.location.href);
      if (page0 <= 0) url.searchParams.delete('page');
      else url.searchParams.set('page', String(page0 + 1));
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function extractTotalFromResponse(data) {
    if (!data || typeof data !== 'object') return null;
    for (let i = 0; i < JOBS_MAP_TOTAL_KEYS.length; i++) {
      const n = Number(data[JOBS_MAP_TOTAL_KEYS[i]]);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  }

  function updateUrlSortDir(sortDir) {
    try {
      const url = new URL(window.location.href);
      if (sortDir === DEFAULT_SORT_DIR) url.searchParams.delete('sortDir');
      else url.searchParams.set('sortDir', sortDir);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function bindSortToggle() {
    const nodes = document.querySelectorAll('#sort-button, .sort-wrapper');
    nodes.forEach((el) => {
      el.style.display = '';
      el.removeAttribute('data-agilo-pagination-hidden');
      el.setAttribute('data-sort-dir', currentSortDir);
      el.setAttribute(
        'title',
        currentSortDir === 'desc'
          ? "Date — plus récent d'abord (clic pour inverser)"
          : "Date — plus ancien d'abord (clic pour inverser)"
      );
      if (el.getAttribute('data-agilo-sort-bound') === '1') return;
      el.setAttribute('data-agilo-sort-bound', '1');
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
        updateUrlSortDir(currentSortDir);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('page');
          history.replaceState(null, '', url.pathname + url.search + url.hash);
        } catch (_) {}
        if (loadPageFromCacheFn) loadPageFromCacheFn(0);
        else if (window.__agiloMesTranscriptsReload) window.__agiloMesTranscriptsReload(0);
      });
    });
  }

  function invalidateCache(reason) {
    console.info('[Agilo] cache invalidated:', reason);
    if (summaryProbeAbort) {
      try {
        summaryProbeAbort.abort();
      } catch (_) {}
    }
    allJobsCache = null;
    cacheKey = '';
    cacheTotalKnown = false;
    const bar = document.getElementById('agilo-refresh-banner');
    if (bar) bar.remove();
  }

  window.__agiloMesTranscriptsInvalidate = invalidateCache;

  function cleanupBulkPageHint() {
    const hint = document.getElementById('agilo-bulk-page-hint');
    if (hint) hint.remove();
    document.querySelectorAll('.agilo-bulk-count-wrap').forEach((el) => {
      el.classList.remove('agilo-bulk-count-wrap');
    });
  }

  function getPaginationMount() {
    const container = document.getElementById('jobs-container');
    if (!container) return null;
    let mount = document.getElementById('agilo-pagination');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'agilo-pagination';
      mount.setAttribute('role', 'navigation');
      mount.setAttribute('aria-label', 'Pagination des transcriptions');
      container.insertAdjacentElement('afterend', mount);
    }
    return mount;
  }

  function renderPaginationWidget(paginationState, onPageChange) {
    const mount = getPaginationMount();
    if (!mount) return;

    const { currentPage, totalJobs, hasMore, pageItemCount } = paginationState;
    const showPager = currentPage > 0 || hasMore || (totalJobs != null && totalJobs > PAGE_SIZE);

    if (!showPager && pageItemCount === 0) {
      mount.innerHTML = '';
      mount.hidden = true;
      return;
    }

    mount.hidden = false;
    const totalPages =
      totalJobs != null ? Math.max(1, Math.ceil(totalJobs / PAGE_SIZE)) : hasMore ? currentPage + 2 : currentPage + 1;
    const suffix =
      totalJobs != null
        ? cacheTotalKnown
          ? ` — ${totalJobs} fichier${totalJobs > 1 ? 's' : ''}`
          : ' — chargement...'
        : '';
    const pageLabel = `Page ${currentPage + 1} / ${totalPages}${suffix}`;

    mount.innerHTML =
      `<button type="button" id="agilo-prev" ${currentPage <= 0 ? 'disabled' : ''}>← Précédent</button>` +
      `<span class="agilo-page-info" id="agilo-page-info">${pageLabel}</span>` +
      `<button type="button" id="agilo-next" ${!hasMore && (totalJobs == null || currentPage + 1 >= totalPages) ? 'disabled' : ''}>Suivant →</button>`;

    const prev = mount.querySelector('#agilo-prev');
    const next = mount.querySelector('#agilo-next');
    if (prev) prev.addEventListener('click', () => onPageChange(currentPage - 1));
    if (next) next.addEventListener('click', () => onPageChange(currentPage + 1));

    bindSortToggle();

    window.__agiloMesTranscriptsPagination = {
      enabled: true,
      pageSize: PAGE_SIZE,
      currentPage,
      totalJobs,
      hasMore,
      hasMultiplePages: showPager,
      apiSortSupported: false,
      clientPagination: true,
      cacheTotalKnown,
      sortDir: currentSortDir
    };
  }

  function renderLoadingState(container, label) {
    if (!container) return;
    container.innerHTML = `<div class="agilo-loading-row">${label || 'Chargement de vos transcripts...'}</div>`;
    const mount = document.getElementById('agilo-pagination');
    if (mount) {
      mount.innerHTML = '';
      mount.hidden = true;
    }
  }

  function renderEmptyState(container, opts) {
    if (!container) return;
    const folder = !!(opts && opts.folder);
    const title = folder ? 'Ce dossier est vide.' : 'Aucune transcription trouvée';
    const detail = folder
      ? 'Déplacez un fichier ici ou lancez une nouvelle transcription.'
      : 'Lancez une transcription pour créer votre premier fichier.';
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; background: #ffffff; border: 1px dashed #d1d5db; border-radius: 12px; margin: 20px 0; width: 100%;">
        <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${title}</p>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">${detail}</p>
      </div>
    `;
  }

  const DEMO_HINT = 'Exemple. Démarrez une transcription pour créer la vôtre.';

  function isDemoJob(job) {
    return !!(job && (job.__agiloDemo || String(job.jobid || '').indexOf('demo-') === 0));
  }

  function buildDemoJob() {
    return {
      jobid: 'demo-onboarding',
      jobTitle: 'Exemple : réunion d’équipe',
      filename: 'exemple-reunion.mp3',
      transcriptStatus: 'READY_SUMMARY_READY',
      dtCreation: '26-08-2026 10:00:00',
      promptid: 1,
      __agiloDemo: true
    };
  }

  function startTranscriptionPath() {
    const tier = (location.pathname.match(/^\/app\/([^/]+)/) || [])[1] || 'free';
    return `/app/${tier}/dashboard`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: RENDERING & INLINE RENAME (Original Nickel v1.1.4 Logic)
  // ───────────────────────────────────────────────────────────────────────────

  function getEdition() {
    const p = window.location.pathname;
    if (p.includes('/app/free/')) return 'free';
    if (p.includes('/app/pro/') || p.includes('/app/premium/')) return 'pro';
    if (p.includes('/app/ent/') || p.includes('/app/business/')) return 'ent';
    return 'ent'; // Business par défaut si non trouvé
  }

  function displayJobTitle(job) {
    return (job.jobTitle || job.filename || 'Transcript').split('.')[0];
  }

  function convertDateStringToDate(ds) {
    if (!ds) return new Date(0);
    const [d, t] = ds.split(' ');
    const [day, mon, yr] = d.split('-');
    return new Date(`${yr}-${mon}-${day}T${t}`);
  }

  /** Liste blanche : transcript textuel considéré disponible api receiveText ; pas de sous-chaîne ERROR. */
  const TRANSCRIPT_TEXT_DOWNLOAD_STATUSES = new Set([
    'READY',
    'READY_TRANSCRIPT',
    'READY_TEXT',
    'READY_SUMMARY_PENDING',
    'READY_SUMMARY_READY'
  ]);

  function isTranscriptTextDownloadAllowed(status) {
    const st = String(status || '').toUpperCase();
    if (!st || st.includes('ERROR')) return false;
    return TRANSCRIPT_TEXT_DOWNLOAD_STATUSES.has(st);
  }

  async function renameOnServer({ jobId, userEmail, token, edition, jobTitle, originalFilename }) {
    // FIX 20/20 : Extraction de l'extension originale pour éviter "extensions do not match"
    const parts = originalFilename.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    let finalTitle = jobTitle;
    if (ext && !jobTitle.toLowerCase().endsWith('.' + ext.toLowerCase())) {
      finalTitle = `${jobTitle}.${ext}`;
    }

    const body = new URLSearchParams({
      username: userEmail,
      token,
      edition,
      jobId: String(jobId),
      jobTitle: finalTitle
    });

    try {
      const r = await fetch(`${API_BASE}/renameTranscriptTitle`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const data = await r.json();
      if (data.status === 'OK') return { ok: true };
      return {
        ok: false,
        error: data.message || data.errorMessage || data.error || 'Erreur inconnue'
      };
    } catch (e) {
      return { ok: false, error: e?.message || 'Erreur réseau' };
    }
  }

  function setupInlineRename({ anchorEl, buttonEl, job, userEmail, token, edition }) {
    if (!anchorEl || !buttonEl) return;
    buttonEl.setAttribute('type', 'button');
    buttonEl.setAttribute('title', 'Renommer ce fichier');
    buttonEl.setAttribute('aria-label', 'Renommer ce fichier');
    const icon = buttonEl.querySelector('svg');
    if (icon) {
      icon.style.display = 'flex';
      icon.removeAttribute('hidden');
      icon.setAttribute('aria-hidden', 'true');
    }
    buttonEl.addEventListener('click', () => {
      if (anchorEl.__editing) return;
      anchorEl.__editing = true;
      const currentTitle = displayJobTitle(job);
      const input = document.createElement('input');
      input.className = 'file-name-input';
      input.style.width = '100%';
      input.value = currentTitle;
      anchorEl.style.display = 'none';
      anchorEl.parentNode.insertBefore(input, anchorEl);
      input.focus();

      const save = async () => {
        const next = input.value.trim();
        if (next && next !== currentTitle) {
          input.disabled = true;
          const res = await renameOnServer({
            jobId: job.jobid,
            userEmail,
            token,
            edition,
            jobTitle: next,
            originalFilename: job.filename
          });
          if (res.ok) {
            anchorEl.textContent = next;
          } else {
            console.warn('[Agilo][MesTranscripts] renameTranscriptTitle failed', {
              jobId: job.jobid,
              reason: res.error
            });
            alert(`Impossible de renommer ce fichier : ${res.error}`);
          }
        }
        input.remove();
        anchorEl.style.display = '';
        anchorEl.__editing = false;
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          input.remove();
          anchorEl.style.display = '';
          anchorEl.__editing = false;
        }
      });
      input.addEventListener('blur', () => save());
    });
  }

  function jobJavaException(job) {
    return String(
      job?.javaException || job?.exceptionMessage || job?.errorMessage || ''
    ).toLowerCase();
  }

  function isNoSummaryRequested(job) {
    const pid = Number(job?.promptid ?? job?.promptId);
    return pid === -1;
  }

  function isDurationTooLongError(job) {
    return jobJavaException(job).includes('error_duration_is_too_long');
  }

  function retentionAudioDays(edition) {
    const e = String(edition || getEdition()).toLowerCase();
    if (e === 'free') return 1;
    if (e === 'pro') return 30;
    return 30;
  }

  function isGhostTranscriptJob(job) {
    const ex = jobJavaException(job);
    if (ex.includes('error_transcript_file_not_exists')) return true;
    const st = String(job?.transcriptStatus || '').toUpperCase();
    return st === 'ERROR_TRANSCRIPT_FILE_NOT_EXISTS';
  }

  function isExpiredJob(job) {
    if (!job || isDurationTooLongError(job)) return false;
    if (isGhostTranscriptJob(job)) return true;
    const ex = jobJavaException(job);
    if (ex.includes('error_summary_transcript_file_not_exists')) {
      if (isNoSummaryRequested(job)) return false;
      return true;
    }
    const st = String(job?.transcriptStatus || '').toUpperCase();
    return st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS';
  }

  function isNoSummaryCase(job) {
    if (!job || isExpiredJob(job) || isDurationTooLongError(job)) return false;
    if (isNoSummaryRequested(job)) return true;
    return false;
  }

  function archivedJobMessage(job) {
    const jobId = job && (job.jobid || job.jobId);
    if (isGhostTranscriptJob(job || {})) {
      return retentionMessage('ghost_transcript', { jobId });
    }
    return retentionMessage('text_retention', { jobId });
  }

  function jobAgeDays(job) {
    const d = convertDateStringToDate(job?.dtCreation || job?.dt_creation);
    if (!d || !d.getTime()) return 0;
    return (Date.now() - d.getTime()) / 86400000;
  }

  function isSummaryReadyForDownload(transcriptStatus) {
    return String(transcriptStatus || '').toUpperCase() === 'READY_SUMMARY_READY';
  }

  function getSummaryAvailability(job) {
    const probeState = summaryProbeByJobId.get(summaryJobKey(job));
    if (probeState === 'missing' || job?.__agiloSummaryUnavailable) {
      return {
        downloadable: false,
        label: 'Indisponible',
        title: job?.__agiloSummaryUnavailableTitle || SUMMARY_MISSING_MESSAGE
      };
    }
    const status = String(job?.transcriptStatus || '').toUpperCase();
    const detail = getStatusTooltipFrench(job?.transcriptStatus, job);
    if (status === 'READY_SUMMARY_READY') {
      return { downloadable: true, label: 'Télécharger', title: detail };
    }
    if (status === 'READY_SUMMARY_PENDING') {
      return {
        downloadable: false,
        label: 'En cours',
        title: 'Le compte-rendu est en cours de génération.'
      };
    }
    if (isNoSummaryCase(job)) {
      return {
        downloadable: false,
        label: 'Non demandé',
        title: "Aucun compte-rendu n'a été demandé pour cette transcription."
      };
    }
    if (isExpiredJob(job) || status === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS') {
      return {
        downloadable: false,
        label: 'Archivé',
        title: archivedJobMessage(job)
      };
    }
    if (status === 'READY_SUMMARY_ON_ERROR' || status === 'ERROR_SUMMARY_ON_ERROR') {
      return {
        downloadable: false,
        label: 'Indisponible',
        title: detail || "Le compte-rendu n'a pas pu être généré."
      };
    }
    return {
      downloadable: false,
      label: 'Indisponible',
      title: detail || "Le compte-rendu n'est pas disponible pour cette transcription."
    };
  }

  function isRestrictedFreeFormat(fmt) {
    const f = String(fmt || '').toLowerCase();
    return f === 'doc' || f === 'pdf';
  }

  function showProUpgradeForLockedFormat() {
    if (window.AgiloGate?.showUpgrade) {
      window.AgiloGate.showUpgrade('pro', 'Formats DOC/PDF');
      return;
    }
    window.alert('Format réservé aux offres Pro et Business.');
  }

  function lockFormatForFree(link, msg) {
    if (!link) return;
    link.setAttribute('href', '#');
    link.removeAttribute('target');
    link.setAttribute('title', msg);
    link.setAttribute('aria-disabled', 'true');
    if (!link.__agiloPlanLockedClick) {
      link.__agiloPlanLockedClick = true;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showProUpgradeForLockedFormat();
      });
    }
  }

  function getStatusTooltipFrench(status, job) {
    const code = String(status || '').trim() || '—';
    const up = code.toUpperCase();
    const userMsg =
      job && (job.userErrorMessage || job.userMessage || '').toString().trim();
    const errMsg = job && (job.errorMessage || job.exceptionMessage || '').toString().trim();
    let line = '';

    if (job && isExpiredJob(job)) {
      return archivedJobMessage(job);
    }
    if (job && isNoSummaryCase(job)) {
      return "Compte rendu non demandé pour cette transcription.";
    }

    switch (up) {
      case 'PENDING':
        line = 'En attente de traitement';
        break;
      case 'IN_PROGRESS':
      case 'QUEUED':
      case 'UPLOADING':
        line = 'Transcription en cours de traitement';
        break;
      case 'READY_SUMMARY_PENDING':
        line = 'Transcription prête ; compte rendu en cours de génération';
        break;
      case 'READY_SUMMARY_READY':
        if (getEdition() === 'ent' && jobAgeDays(job) > 30) {
          line = 'Audio retiré après 30 jours. Si la transcription ne s’ouvre pas, contactez le support avec le numéro du job.';
        } else {
          line = 'Transcription et compte rendu prêts';
        }
        break;
      case 'READY_SUMMARY_ON_ERROR':
        if (job && isDurationTooLongError(job)) {
          line = "Le compte rendu n'a pas pu être généré : audio trop long pour votre offre.";
        } else {
          line = "Le compte rendu n'a pas pu être généré";
        }
        break;
      case 'ERROR_SUMMARY_ON_ERROR':
        line = "Le compte rendu n'a pas pu être généré";
        break;
      case 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS':
      case 'ERROR_TRANSCRIPT_FILE_NOT_EXISTS':
        line = archivedJobMessage(job || {});
        break;
      case 'ERROR_TOO_MANY_LANGUAGES_CODE':
        line = "Erreur : trop de langues détectées dans l'audio";
        break;
      case 'ON_ERROR':
        line = "Le traitement n'a pas pu aboutir";
        break;
      case 'UNKNOWN':
        line = 'État inconnu';
        break;
      case 'READY':
      case 'READY_TRANSCRIPT':
      case 'READY_TEXT':
        line = 'Transcription prête (téléchargement disponible)';
        break;
      default:
        if (up.includes('ERROR')) line = 'Une erreur est survenue pendant le traitement';
        else if (TRANSCRIPT_TEXT_DOWNLOAD_STATUSES.has(up)) line = 'Transcription prête (téléchargement disponible)';
        else line = 'Traitement en cours';
    }

    if ((up.includes('ERROR') || up === 'READY_SUMMARY_ON_ERROR') && !isNoSummaryCase(job) && !isExpiredJob(job)) {
      if (userMsg) line += ` — ${userMsg}`;
      else if (errMsg) line += ` — ${errMsg}`;
      else if (job && jobJavaException(job) && up === 'READY_SUMMARY_ON_ERROR') {
        line += ` — ${job.javaException}`;
      }
    }

    return line;
  }

  function buildStatusAlertMessage(job) {
    const detail = getStatusTooltipFrench(job?.transcriptStatus, job);
    const title = displayJobTitle(job);
    return `État de la transcription\n\n${title}\n\n${detail}`;
  }

  function setupStatusAlert(row, job) {
    const stateWrap =
      row.querySelector('.custom-element.state') ||
      row.querySelector('.custom-element.select .state') ||
      row.querySelector('.state');
    if (!stateWrap) return;

    const clickHint = 'Cliquer pour voir le détail du statut';
    const detail = getStatusTooltipFrench(job?.transcriptStatus, job);

    stateWrap.style.cursor = 'pointer';
    stateWrap.setAttribute('role', 'button');
    stateWrap.setAttribute('tabindex', '0');
    stateWrap.setAttribute('aria-label', `${detail}. ${clickHint}`);
    stateWrap.setAttribute('title', `${detail} — ${clickHint}`);

    const showAlert = () => {
      window.alert(buildStatusAlertMessage(job));
    };

    stateWrap.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showAlert();
    });

    stateWrap.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      showAlert();
    });
  }

  /**
   * Icônes alignées avec scripts/pages/editor/Code-ed-header.js ; support div fallback + SVG Webflow.
   */
  function updateIconVisibility(clone, status, job) {
    const stateWrap = clone.querySelector('.custom-element.state');
    const st = (status || '').toUpperCase();
    const tip = job ? getStatusTooltipFrench(job.transcriptStatus, job) : '';

    const root = stateWrap || clone;

    root
      .querySelectorAll(
        '.icon-inprogress, .icon-error, .icon-ready, .icon-ready_summary_pending,' +
          ' .icon-ready_summary_ready, .icon-ready_summary_on_error,' +
          ' svg[class^="icon-"]'
      )
      .forEach((node) => {
        node.style.display = 'none';
        node.removeAttribute('title');
        node.removeAttribute('role');
      });

    const map = {
      '.icon-error': ['ON_ERROR', 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TRANSCRIPT_FILE_NOT_EXISTS', 'ERROR_TOO_MANY_LANGUAGES_CODE'],
      '.icon-inprogress': ['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING'],
      '.icon-ready_summary_pending': ['READY_SUMMARY_PENDING'],
      '.icon-ready_summary_ready': ['READY_SUMMARY_READY'],
      '.icon-ready_summary_on_error': ['READY_SUMMARY_ON_ERROR'],
      '.icon-ready': ['READY', 'READY_TRANSCRIPT', 'READY_TEXT']
    };

    function show(sel) {
      const n = root.querySelector(sel);
      if (n) {
        n.style.display = 'block';
        if (tip) {
          n.setAttribute('title', tip);
          n.setAttribute('role', 'img');
        }
        return n;
      }
      return null;
    }

    let shown = null;

    if (
      job &&
      (isExpiredJob(job) || isNoSummaryCase(job)) &&
      (st.includes('ERROR') || st === 'READY_SUMMARY_ON_ERROR' || st === 'ERROR_SUMMARY_TRANSCRIPT_FILE_NOT_EXISTS')
    ) {
      shown = show('.icon-ready_summary_pending');
    }

    if (!shown) {
      for (const sel in map) {
        if (map[sel].includes(st)) {
          shown = show(sel);
          break;
        }
      }
    }

    if (!shown) {
      if (st.includes('ERROR')) shown = show('.icon-error');
      else if (['PENDING', 'IN_PROGRESS', 'QUEUED', 'UPLOADING'].includes(st))
        shown = show('.icon-inprogress');
      else if (isTranscriptTextDownloadAllowed(st)) shown = show('.icon-ready');
      else shown = show('.icon-ready');
    }

    if (stateWrap && tip) {
      stateWrap.setAttribute('aria-label', tip);
      stateWrap.setAttribute('title', tip);
    }
  }

  const FALLBACK_ROW_HTML = `
    <div class="wrapper-content_item-row responsive items-row">
      <div class="custom-element select"><input type="checkbox" class="job-checkbox"></div>
      <div class="custom-element state">
        <div class="icon-inprogress" style="display:none;font-size:1.2rem;">⏳</div>
        <div class="icon-error" style="display:none;font-size:1.2rem;">⚠️</div>
        <div class="icon-ready" style="display:none;font-size:1.2rem;">✅</div>
      </div>
      <div class="custom-element titles">
        <div style="display:flex; align-items:center; gap:8px;">
          <a href="#" class="file-name" style="text-decoration:none; color:inherit; font-weight:600;"></a>
          <button class="rename-btn" style="background:none; border:none; cursor:pointer; padding:0; opacity:0.5; font-size:14px;">✏️</button>
        </div>
      </div>
      <div class="custom-element titles"><a href="#" class="open-link" style="color:#174a96; font-weight:600; text-decoration:none;">Éditer</a></div>
      <div class="custom-element titles transcript-links" style="display:flex; gap:6px; flex-wrap:wrap;">
        <a href="#" class="download_wrapper-link_transcript_txt" title="Télécharger TXT" style="font-size:11px; padding:3px 6px; background:#f3f4f6; border-radius:4px; text-decoration:none; color:#374151; border:1px solid #d1d5db;">TXT</a>
        <a href="#" class="download_wrapper-link_transcript_pdf" title="Télécharger PDF" style="font-size:11px; padding:3px 6px; background:#f3f4f6; border-radius:4px; text-decoration:none; color:#374151; border:1px solid #d1d5db;">PDF</a>
        <a href="#" class="download_wrapper-link_transcript_docx" title="Télécharger DOCX" style="font-size:11px; padding:3px 6px; background:#f3f4f6; border-radius:4px; text-decoration:none; color:#374151; border:1px solid #d1d5db;">DOCX</a>
      </div>
      <div class="custom-element titles horizontal"><div class="creation-date" style="font-size:12px; color:#6b7280;"></div></div>
      <div class="custom-element titles report-links">
        <a href="#" class="download_wrapper-link_summary_doc" title="Télécharger Compte-rendu" style="font-size:11px; padding:3px 6px; background:#eff6ff; border-radius:4px; text-decoration:none; color:#1e40af; border:1px solid #bfdbfe; font-weight:500;">CR</a>
      </div>
      <div class="custom-element titles">
        <button class="delete-job-button" title="Supprimer" style="background:none; border:none; cursor:pointer; color:#991b1b; font-size:16px; padding:4px;">🗑️</button>
      </div>
    </div>
  `;

  function lockDownloadStack(row, lock) {
    const optionsEl = row.querySelector('.custom-element.options');
    const panel = row.querySelector('.download_link-options');
    const dlBtn = row.querySelector('.download-link');
    const dotSvg = row.querySelector('svg.icon-1x1-small.options');

    if (!optionsEl) return;

    const lockedTitle = 'Aucun téléchargement disponible pour ce traitement';

    if (lock) {
      optionsEl.setAttribute('data-agilo-download-locked', '1');
      optionsEl.classList.add('agilo-download-locked');
      if (panel) {
        panel.style.display = 'none';
      }
      if (dlBtn) {
        dlBtn.setAttribute('aria-expanded', 'false');
        dlBtn.setAttribute('title', lockedTitle);
      }
      if (dotSvg) dotSvg.setAttribute('title', lockedTitle);
    } else {
      optionsEl.removeAttribute('data-agilo-download-locked');
      optionsEl.classList.remove('agilo-download-locked');
      if (dlBtn && dlBtn.getAttribute('title') === lockedTitle) {
        dlBtn.removeAttribute('title');
      }
      if (dotSvg && dotSvg.getAttribute('title') === lockedTitle) dotSvg.removeAttribute('title');
      if (dlBtn && !dlBtn.hasAttribute('aria-expanded')) dlBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function setSummaryCellState(row, job) {
    const availability = getSummaryAvailability(job);
    const summaryLinks = Array.from(row.querySelectorAll('[class*="download_wrapper-link_summary_"]'));
    if (!summaryLinks.length) {
      console.warn('[Agilo][MesTranscripts] summary cell missing', {
        jobId: job?.jobid,
        transcriptStatus: job?.transcriptStatus
      });
      return availability;
    }

    const summaryCell = summaryLinks
      .map((link) => link.closest('.custom-element.options') || link.closest('.custom-element') || link.parentElement)
      .find(Boolean);

    if (!summaryCell) {
      console.warn('[Agilo][MesTranscripts] summary container missing', {
        jobId: job?.jobid,
        transcriptStatus: job?.transcriptStatus
      });
      return availability;
    }

    const summaryToggle = summaryCell.querySelector('.download-link');
    const summaryPanel = summaryCell.querySelector('.download_link-options');
    let stateChip = summaryCell.querySelector('.agilo-summary-state');

    summaryLinks.forEach((link) => {
      if (!availability.downloadable) {
        link.style.display = 'none';
        link.removeAttribute('href');
        link.removeAttribute('target');
      }
    });

    summaryCell.setAttribute('title', availability.title || '');
    summaryCell.setAttribute('aria-label', availability.title || '');

    if (availability.downloadable) {
      summaryCell.classList.remove('agilo-download-locked');
      if (summaryToggle) {
        summaryToggle.style.display = '';
        summaryToggle.textContent = 'Télécharger';
        summaryToggle.setAttribute('aria-expanded', 'false');
        summaryToggle.setAttribute('title', availability.title || '');
      }
      if (summaryPanel) summaryPanel.style.display = 'none';
      if (stateChip) stateChip.remove();
      return availability;
    }

    if (summaryToggle) {
      summaryToggle.style.display = 'none';
      summaryToggle.setAttribute('aria-expanded', 'false');
    }
    if (summaryPanel) summaryPanel.style.display = 'none';

    if (!stateChip) {
      stateChip = document.createElement('span');
      stateChip.className = 'agilo-summary-state';
      stateChip.style.display = 'inline-flex';
      stateChip.style.alignItems = 'center';
      stateChip.style.justifyContent = 'center';
      stateChip.style.padding = '6px 10px';
      stateChip.style.borderRadius = '999px';
      stateChip.style.fontSize = '12px';
      stateChip.style.fontWeight = '600';
      stateChip.style.background = '#f3f4f6';
      stateChip.style.color = '#6b7280';
      stateChip.style.border = '1px solid #e5e7eb';
      summaryCell.appendChild(stateChip);
    }

    stateChip.textContent = availability.label;
    stateChip.title = availability.title || '';
    summaryCell.classList.add('agilo-download-locked');
    return availability;
  }

  function buildJobRow({ job, userEmail, token, edition, template, container }) {
    let row;
    let clone;

    // TENTATIVE 1: Utiliser le template de la page
    if (template && template.querySelector && template.querySelector('.wrapper-content_item-row')) {
      clone = document.importNode(template, true);
      row = clone.querySelector('.wrapper-content_item-row');
    }

    // TENTATIVE 2: Fallback si le template est absent ou vide (cas fréquent sur page Free)
    if (!row) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = FALLBACK_ROW_HTML;
      clone = tempDiv;
      row = tempDiv.querySelector('.wrapper-content_item-row');
    }

    if (!row) return;

    if (isDemoJob(job)) {
      row.setAttribute('data-agilo-demo', '1');
      row.setAttribute('data-job-id', 'demo-onboarding');
      row.setAttribute('data-creation-date', job.dtCreation || '');
      row.setAttribute('title', DEMO_HINT);
      updateIconVisibility(clone, job.transcriptStatus, job);

      const creation = clone.querySelector('.creation-date');
      if (creation) {
        creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      const fileNameAnchor = clone.querySelector('.file-name');
      if (fileNameAnchor) {
        fileNameAnchor.textContent = displayJobTitle(job);
      }

      const renameButton = clone.querySelector('.rename-btn');
      if (renameButton) {
        renameButton.disabled = true;
        renameButton.style.visibility = 'hidden';
      }

      row.querySelectorAll('.custom-element.options').forEach((el) => {
        el.setAttribute('data-agilo-download-locked', '1');
      });

      row.querySelectorAll('a').forEach((a) => {
        a.removeAttribute('href');
        a.removeAttribute('target');
        a.removeAttribute('download');
        a.removeAttribute('data-w-id');
        a.removeAttribute('data-editor-url');
        a.setAttribute('title', DEMO_HINT);
      });

      row.querySelectorAll('.button-open, .open-link, .download-link').forEach((el) => {
        el.setAttribute('tabindex', '-1');
        el.setAttribute('title', DEMO_HINT);
      });

      const cb = row.querySelector('.job-select, .job-checkbox');
      if (cb) {
        cb.disabled = true;
        cb.checked = false;
        cb.classList.remove('job-select');
        cb.setAttribute('aria-hidden', 'true');
        cb.tabIndex = -1;
      }

      const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
      formats.forEach((fmt) => {
        const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
        const aS = clone.querySelector(`.download_wrapper-link_summary_${fmt}`);
        [aT, aS].forEach((a) => {
          if (!a) return;
          a.style.removeProperty('display');
        });
      });

      row.querySelectorAll('.delete-job-button, .delete-job-button_to-confirm').forEach((btn) => {
        btn.setAttribute('disabled', 'true');
        btn.setAttribute('tabindex', '-1');
      });

      container.appendChild(row);
      return;
    }

    row.setAttribute('data-job-id', job.jobid);
    row.setAttribute('data-creation-date', job.dtCreation || '');

    updateIconVisibility(clone, job.transcriptStatus, job);
    setupStatusAlert(row, job);

    const creation = clone.querySelector('.creation-date');
    if (creation)
      creation.textContent = convertDateStringToDate(job.dtCreation).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

    const fileNameAnchor = clone.querySelector('.file-name');
    const renameButton = clone.querySelector('.rename-btn');
    const openLink = clone.querySelector('.button-open, .open-link');

    if (fileNameAnchor) {
      fileNameAnchor.textContent = displayJobTitle(job);
      fileNameAnchor.title = 'Fichier original : ' + (job.filename || 'Inconnu');
      fileNameAnchor.href = buildAudioDownloadUrl({
        jobId: job.jobid,
        userEmail,
        token,
        edition
      });
      fileNameAnchor.setAttribute('download', job.filename || `${displayJobTitle(job)}.mp3`);
      bindAudioDownloadGuard(fileNameAnchor, { job, userEmail, edition });
    }

    const tier = location.pathname.match(/^\/app\/([^/]+)/)?.[1] || 'business';
    const editorUrl = `/app/${tier}/editor?jobId=${job.jobid}&edition=${edition}`;
    if (openLink) {
      if (openLink.tagName === 'A') {
        openLink.href = editorUrl;
      } else {
        openLink.setAttribute('data-editor-url', editorUrl);
        if (!openLink.__agiloOpenBound) {
          openLink.__agiloOpenBound = true;
          openLink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = openLink.getAttribute('data-editor-url') || editorUrl;
          });
        }
      }
    }
    if (!fileNameAnchor || !renameButton) {
      console.warn('[Agilo][MesTranscripts] rename UI incomplete', {
        jobId: job.jobid,
        hasAnchor: !!fileNameAnchor,
        hasButton: !!renameButton
      });
    }
    setupInlineRename({ anchorEl: fileNameAnchor, buttonEl: renameButton, job, userEmail, token, edition });

    // Downloads logic v1.1.4+
    let hasAnyTranscriptLink = false;
    let hasAnySummaryLink = false;
    const formats = ['txt', 'rtf', 'docx', 'doc', 'pdf'];
    const isFree = String(edition || '').toLowerCase() === 'free';
    formats.forEach((fmt) => {
      const aT = clone.querySelector(`.download_wrapper-link_transcript_${fmt}`);
      if (aT && isFree && isRestrictedFreeFormat(fmt)) {
        lockFormatForFree(aT, 'Réservé aux offres Pro et Business');
        aT.style.removeProperty('display');
      } else if (aT && isTranscriptTextDownloadAllowed(job.transcriptStatus)) {
        aT.href = `${API_BASE}/receiveText?jobId=${job.jobid}&username=${encodeURIComponent(
          userEmail
        )}&token=${encodeURIComponent(token)}&format=${fmt}&edition=${encodeURIComponent(edition)}`;
        aT.target = '_blank';
        aT.style.removeProperty('display');
        hasAnyTranscriptLink = true;
      } else if (aT) {
        aT.style.display = 'none';
      }
    });

    const summaryFormats = [
      { slot: 'txt', apiFormat: 'html' },
      { slot: 'rtf', apiFormat: 'rtf' },
      { slot: 'doc', apiFormat: 'doc' },
      { slot: 'docx', apiFormat: 'docx' },
      { slot: 'pdf', apiFormat: 'pdf' }
    ];
    summaryFormats.forEach(({ slot, apiFormat }) => {
      const aS = clone.querySelector(`.download_wrapper-link_summary_${slot}`);
      if (aS && isFree && isRestrictedFreeFormat(slot)) {
        lockFormatForFree(aS, 'Réservé aux offres Pro et Business');
        aS.style.removeProperty('display');
      } else if (aS && isSummaryReadyForDownload(job.transcriptStatus)) {
        aS.href = `${API_BASE}/receiveSummary?jobId=${job.jobid}&username=${encodeURIComponent(
          userEmail
        )}&token=${encodeURIComponent(token)}&format=${apiFormat}&edition=${encodeURIComponent(
          edition
        )}`;
        aS.target = '_blank';
        aS.style.removeProperty('display');
        bindSummaryDownloadGuard(aS);
        hasAnySummaryLink = true;
      } else if (aS) {
        aS.style.display = 'none';
      }
    });

    const summaryAvailability = setSummaryCellState(row, job);
    hasAnySummaryLink = !!summaryAvailability.downloadable;
    const hasAnyDownloadable = hasAnyTranscriptLink || hasAnySummaryLink;
    lockDownloadStack(row, !hasAnyDownloadable);

    const optsBox = row.querySelector('.custom-element.options');
    const dlBtnEarly = row.querySelector('.download-link');
    if (dlBtnEarly && optsBox && !optsBox.classList.contains('agilo-download-locked')) {
      dlBtnEarly.setAttribute('aria-expanded', 'false');
    }

    container.appendChild(row);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: BULK ACTIONS MODULE (The v2.4.0 logic provided by user)
  // ───────────────────────────────────────────────────────────────────────────
  // [Note: Simplified integration of the Bulk Module for the file]

  function initializeBulkActions() {
    if (window.AgilotextBulk && typeof window.AgilotextBulk.init === 'function') {
      window.AgilotextBulk.init();
    }
  }

  let activeLoadToken = null;
  let lastKnownToken = null;
  let paginationState = {
    currentPage: 0,
    totalJobs: null,
    hasMore: false,
    pageItemCount: 0
  };

  function sortJobsByCreation(jobs) {
    return (jobs || []).slice().sort((a, b) => {
      const ta = convertDateStringToDate(a.dtCreation)?.getTime() || 0;
      const tb = convertDateStringToDate(b.dtCreation)?.getTime() || 0;
      return currentSortDir === 'asc' ? ta - tb : tb - ta;
    });
  }

  function showRefreshBanner(count) {
    if (document.getElementById('agilo-refresh-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'agilo-refresh-banner';
    bar.style.cssText =
      'position:sticky;top:0;background:#fef3c7;padding:8px 12px;text-align:center;cursor:pointer;font-size:13px;z-index:50';
    bar.textContent = `${count} nouveau(x) fichier(s) disponible(s) — cliquez pour actualiser`;
    bar.onclick = () => {
      invalidateCache('refresh-banner');
      if (lastKnownToken) mainScriptExecution(lastKnownToken, 0);
      bar.remove();
    };
    document.getElementById('jobs-container')?.parentElement?.prepend(bar);
  }

  function startPolling(ed, userEmail, token) {
    if (pollTimer) clearInterval(pollTimer);
    if (localStorage.getItem('agilo:no-poll') === '1') return;
    currentPollingEdition = ed;
    pollTimer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const folderId = new URLSearchParams(window.location.search).get('folderId');
        let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(
          userEmail
        )}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(
          ed
        )}&limit=${FETCH_LIMIT_INITIAL}&offset=0`;
        if (folderId) url += `&folderId=${encodeURIComponent(folderId)}`;
        const r = await fetch(url);
        const data = await r.json();
        if (data.status !== 'OK') return;
        const newIds = new Set((data.jobsInfoDtos || []).map((j) => String(j.jobid)));
        const oldIds = new Set(
          (allJobsCache || []).slice(0, FETCH_LIMIT_INITIAL).map((j) => String(j.jobid))
        );
        const delta = [...newIds].filter((id) => !oldIds.has(id));
        if (delta.length > 0) showRefreshBanner(delta.length);
      } catch (_) {}
    }, POLLING_INTERVAL_MS);
  }

  async function mainScriptExecution(token, forcedPage) {
    const emailInput = document.querySelector('[name="memberEmail"]');
    const userEmail = (
      emailInput?.value ||
      emailInput?.getAttribute('src') ||
      emailInput?.textContent ||
      ''
    ).trim();
    let edition = getEdition();

    if (!userEmail) {
      console.warn('[Agilo] Email utilisateur non trouvé dans le DOM.');
      return;
    }

    if (!token) {
      for (let i = 0; i < 10 && !token; i++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = window.globalToken || '';
      }
    }
    if (!String(token || '').trim()) {
      const el = document.getElementById('jobs-container');
      renderLoadingState(el, 'Chargement de vos transcripts...');
      return;
    }

    lastKnownToken = token;
    lastSummaryCreds = { userEmail, token, edition };
    currentSortDir = readSortDirFromUrl();
    const loadId = Symbol('load');
    activeLoadToken = loadId;

    const container = document.getElementById('jobs-container');
    const templateEl = document.getElementById('template-row');
    if (!container || !templateEl) return;

    let page =
      typeof forcedPage === 'number' && forcedPage >= 0 ? forcedPage : readPageFromUrl();
    paginationState.currentPage = page;

    const folderId = new URLSearchParams(window.location.search).get('folderId') || '';
    const newCacheKey = `${edition}|${folderId}`;

    async function fetchJobsBatch(ed, offset, limit, skipFreeFallback) {
      let url = `${API_BASE}/getJobsInfo?username=${encodeURIComponent(
        userEmail
      )}&token=${encodeURIComponent(token)}&edition=${encodeURIComponent(
        ed
      )}&limit=${limit}&offset=${offset}`;
      if (folderId) url += `&folderId=${encodeURIComponent(folderId)}`;
      const r = await fetch(url);
      const data = await r.json();
      if (
        !skipFreeFallback &&
        ed === 'free' &&
        offset === 0 &&
        data.status === 'OK' &&
        (!data.jobsInfoDtos || data.jobsInfoDtos.length === 0)
      ) {
        try {
          const entResult = await fetchJobsBatch('ent', offset, limit, true);
          const entJobs = (entResult.data && entResult.data.jobsInfoDtos) || [];
          if (entResult.data && entResult.data.status === 'OK' && entJobs.length > 0) {
            return entResult;
          }
        } catch (err) {
          console.warn('[Agilo][MesTranscripts][v2] free→ent empty fallback ignored', err);
        }
        return { data, editionUsed: 'free' };
      }
      return { data, editionUsed: ed };
    }

    async function fetchRemainingBatches(ed) {
      let offset = FETCH_LIMIT_INITIAL;
      let reachedEnd = false;
      while (offset < FETCH_LIMIT_TOTAL && activeLoadToken === loadId) {
        const { data } = await fetchJobsBatch(ed, offset, FETCH_LIMIT_INITIAL, true);
        if (activeLoadToken !== loadId) return;
        const batch = data.jobsInfoDtos || [];
        if (batch.length === 0) {
          reachedEnd = true;
          break;
        }
        const jobsById = new Map(
          (allJobsCache || []).map((job) => [String(job.jobid), job])
        );
        batch.forEach((job) => jobsById.set(String(job.jobid), applySummaryProbeToJob(job)));
        allJobsCache = Array.from(jobsById.values());
        await loadPageFromCache(paginationState.currentPage, { keepRender: true });
        if (batch.length < FETCH_LIMIT_INITIAL) {
          reachedEnd = true;
          break;
        }
        offset += FETCH_LIMIT_INITIAL;
      }
      if (activeLoadToken === loadId) {
        cacheTotalKnown = reachedEnd;
        if (!reachedEnd && (allJobsCache?.length || 0) >= FETCH_LIMIT_TOTAL) {
          console.warn(
            '[Agilo] fetch limit reached:',
            FETCH_LIMIT_TOTAL,
            'jobs; backend cursor pagination is required for a complete list.'
          );
        }
        console.info(
          '[Agilo] fetch all complete',
          allJobsCache?.length || 0,
          'jobs',
          { totalKnown: cacheTotalKnown }
        );
        // Les lots suivants peuvent contenir les jobs les plus récents lorsque
        // l'API renvoie les résultats par ordre ancien -> récent. Il faut donc
        // rerendre la page courante une fois le chargement terminé.
        await loadPageFromCache(paginationState.currentPage);
      }
    }

    function renderOnboardingDemo() {
      const caption = document.createElement('div');
      caption.style.cssText = 'grid-column:1/-1;padding:12px 4px 4px;font-size:13px;color:#4b5563;';
      caption.innerHTML =
        'Voici à quoi ressemble un fichier. Ce n’est pas le vôtre. <a href="' +
        startTranscriptionPath() +
        '" style="color:#174a96;font-weight:600;text-decoration:underline;">Démarrer une transcription</a>';
      container.appendChild(caption);
      buildJobRow({
        job: buildDemoJob(),
        userEmail,
        token,
        edition,
        template: templateEl.content,
        container
      });
    }

    function renderRows(jobs) {
      container.innerHTML = '';
      if (jobs.length === 0) {
        if (folderId) renderEmptyState(container, { folder: true });
        else renderOnboardingDemo();
        return;
      }
      jobs.forEach((job) =>
        buildJobRow({
          job,
          userEmail,
          token,
          edition,
          template: templateEl.content,
          container
        })
      );
      initializeBulkActions();
    }

    async function loadPageFromCache(pageIndex, opts = {}) {
      if (activeLoadToken !== loadId) return;
      if (!allJobsCache) return;

      page = Math.max(0, pageIndex);
      paginationState.currentPage = page;
      updateUrlPage(page);

      const sorted = sortJobsByCreation(allJobsCache);
      const start = page * PAGE_SIZE;
      const pageJobs = sorted.slice(start, start + PAGE_SIZE);

      if (pageJobs.length === 0 && page > 0) {
        return loadPageFromCache(0);
      }

      paginationState.totalJobs = sorted.length;
      paginationState.hasMore = start + PAGE_SIZE < sorted.length;
      paginationState.pageItemCount = pageJobs.length;

      if (!opts.keepRender) {
        const wave = beginSummaryProbeWave();
        renderRows(pageJobs);
        bindSortToggle();
        try {
          window.__agiloMesTranscriptsFolderBridge?.apply?.();
        } catch (_) {}
        probeVisibleSummaries(pageJobs, {
          userEmail,
          token,
          edition,
          signal: wave.signal
        }).catch((err) => {
          if (err && err.name !== 'AbortError') {
            console.warn('[Agilo][MesTranscripts][v2] summary probe failed', err);
          }
        });
      }

      renderPaginationWidget(paginationState, (nextPage) => {
        if (nextPage < 0) return;
        loadPageFromCache(nextPage);
        if (!opts.keepRender) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    loadPageFromCacheFn = loadPageFromCache;

    async function ensureJobsLoaded() {
      if (newCacheKey === cacheKey && allJobsCache) {
        await loadPageFromCache(page);
        return allJobsCache;
      }

      invalidateCache('new-load');
      cacheKey = newCacheKey;
      cacheTotalKnown = false;
      renderLoadingState(container);

      const t0 = performance.now();
      let batchResult;
      try {
        batchResult = await fetchJobsBatch(edition, 0, FETCH_LIMIT_INITIAL, false);
      } catch (err) {
        console.warn('[Agilo] fetch retry after error', err);
        batchResult = await fetchJobsBatch(edition, 0, FETCH_LIMIT_INITIAL, false);
      }

      if (activeLoadToken !== loadId) return null;

      const { data, editionUsed } = batchResult;
      if (editionUsed === 'ent' && edition === 'free') {
        edition = 'ent';
        cacheKey = `${edition}|${folderId}`;
        lastSummaryCreds = { userEmail, token, edition };
      }

      if (data.status !== 'OK') {
        container.innerHTML =
          '<div class="agilo-loading-row">Erreur de chargement. <button type="button" onclick="location.reload()" style="margin-left:8px;padding:4px 10px;cursor:pointer;">Réessayer</button></div>';
        return null;
      }

      allJobsCache = (data.jobsInfoDtos || []).map(applySummaryProbeToJob);
      console.info(
        '[Agilo] fetch all start',
        allJobsCache.length,
        'in',
        Math.round(performance.now() - t0),
        'ms'
      );

      await loadPageFromCache(page);

      if (allJobsCache.length >= FETCH_LIMIT_INITIAL) {
        fetchRemainingBatches(edition).catch((e) =>
          console.warn('[Agilo] bg fetch err', e)
        );
      } else {
        cacheTotalKnown = true;
        await loadPageFromCache(page, { keepRender: true });
      }

      startPolling(edition, userEmail, token);
      return allJobsCache;
    }

    window.__agiloMesTranscriptsReload = (nextPage) => {
      invalidateCache('manual-reload');
      const p =
        typeof nextPage === 'number' && nextPage >= 0 ? nextPage : readPageFromUrl();
      if (lastKnownToken) return mainScriptExecution(lastKnownToken, p);
    };

    try {
      await ensureJobsLoaded();
    } catch (err) {
      if (activeLoadToken !== loadId) return;
      console.error('[Agilo] fetch all failed', err);
      container.innerHTML =
        '<div class="agilo-loading-row">Erreur de chargement. <button type="button" onclick="location.reload()" style="margin-left:8px;padding:4px 10px;cursor:pointer;">Réessayer</button></div>';
    }
  }

  function resetPaginationOnNavigation() {
    invalidateCache('folder-nav');
    updateUrlPage(0);
    if (lastKnownToken) mainScriptExecution(lastKnownToken, 0);
  }

  window.addEventListener('popstate', () => {
    if (!/\/mes-transcripts(\/|$)/.test(location.pathname || '')) return;
    if (lastKnownToken) mainScriptExecution(lastKnownToken, readPageFromUrl());
  });

  window.addEventListener('agilo:nav-folder-url-changed', () => {
    if (!/\/mes-transcripts(\/|$)/.test(location.pathname || '')) return;
    resetPaginationOnNavigation();
  });

  window.addEventListener('agilo:job-deleted', (e) => {
    if (allJobsCache && e.detail?.jobId) {
      allJobsCache = allJobsCache.filter(
        (j) => String(j.jobid) !== String(e.detail.jobId)
      );
      if (loadPageFromCacheFn) loadPageFromCacheFn(paginationState.currentPage);
    }
  });

  window.addEventListener('agilo:job-renamed', (e) => {
    if (allJobsCache && e.detail?.jobId) {
      const job = allJobsCache.find((j) => String(j.jobid) === String(e.detail.jobId));
      if (job && e.detail.jobTitle != null) job.jobTitle = e.detail.jobTitle;
      if (loadPageFromCacheFn) loadPageFromCacheFn(paginationState.currentPage);
    }
  });

  document.addEventListener('click', (e) => {
    if (
      e.target.closest('.delete-job-button_to-confirm, #agilo-bulk-folder-apply, .delete-job-button')
    ) {
      setTimeout(() => invalidateCache('dom-action'), 800);
      setTimeout(() => {
        if (lastKnownToken) mainScriptExecution(lastKnownToken, paginationState.currentPage);
      }, 1000);
    }
  });

  const tmr = setInterval(() => {
    if (typeof globalToken !== 'undefined' && globalToken) {
      clearInterval(tmr);
      mainScriptExecution(globalToken);
    }
  }, 250);
})();
