/**
 * pro_v2.js — Agilotext PRO dashboard (fichier externe)
 * v1.06 — compte-rendu : iframe (XHR sync → agilo-summary-dashboard-embed.js) + onglet CR
 * v1.01 (branche GitHub `1.01`) — rafraîchissement jeton Agilotext + libellés UX — voir webflow-login-speed-reduce-florian.md
 * v1.01+ : retry receiveText/Summary après invalidToken, refresh proactif pendant poll (~10 min).
 * Remplace le code inline du footer Webflow Pro.
 * Ne pas modifier pro.js (version precedente, encore live).
 */

/* ====================== Helpers réseau ====================== */
function fetchWithTimeout(url, options = {}) {
  const TIMEOUT = options.timeout || (3 * 60 * 60 * 1000); // 3 h par défaut
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);

  return fetch(url, {
    ...options,
    signal: ctrl.signal,
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store'
  })
    .then(response => {
      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          return Promise.reject({ type: 'invalidToken', status, message: 'Session expirée' });
        } else if (status === 429) {
          return Promise.reject({ type: 'tooMuchTraffic', status, message: 'Trop de requêtes' });
        } else if (status >= 500) {
          return Promise.reject({ type: 'serverError', status, message: 'Erreur serveur' });
        }
        return Promise.reject({ type: 'httpError', status, message: `Erreur HTTP ${status}` });
      }
      return response;
    })
    .finally(() => clearTimeout(timer))
    .catch(err => {
      if (err.name === 'AbortError') return Promise.reject({ type: 'timeout' });
      if (err.type) return Promise.reject(err);
      return Promise.reject({ type: 'unreachable' });
    });
}

/* ====================== Main logic ====================== */
document.addEventListener('DOMContentLoaded', () => {
  (function agiloEnsureDashboardSummaryEmbedV106() {
    if (window.AgilotextDashboardSummary && typeof window.AgilotextDashboardSummary.inject === 'function') return;
    const url = (typeof window.AGILO_DASHBOARD_SUMMARY_EMBED_URL === 'string' && window.AGILO_DASHBOARD_SUMMARY_EMBED_URL) ||
      'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.06/scripts/pages/dashboard/agilo-summary-dashboard-embed.js';
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (xhr.status === 200 && xhr.responseText) (0, eval)(xhr.responseText);
    } catch (e) {
      console.warn('[Agilotext] Chargement synchrone du module compte-rendu (iframe) impossible — fallback innerHTML.', e);
    }
  })();

  /* ─── Source tabs (Fichier / YouTube / Dictée) ─────────────── */
  const sourceTabs = document.querySelectorAll('.source-tab[data-tab]');
  const sourcePanels = document.querySelectorAll('.source-panel[id^="panel-"]');

  sourceTabs.forEach(btn => btn.setAttribute('type', 'button'));

  function activateSourceTab(tabValue) {
    sourceTabs.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabValue;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    sourcePanels.forEach(panel => {
      const panelKey = (panel.id || '').replace('panel-', '');
      panel.classList.toggle('active', panelKey === tabValue);
    });
    const sub = document.getElementById('submit-button');
    if (sub) sub.style.display = (tabValue === 'dictee') ? 'none' : '';
  }

  sourceTabs.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      activateSourceTab(btn.getAttribute('data-tab'));
    });
  });

  /* ─── Envoi multiple → redirection ──────────────────────────── */
  const multiToggle = document.querySelector('.checkbox-component.multiple-audios .checkbox_toggle');
  if (multiToggle) {
    multiToggle.addEventListener('click', e => {
      e.preventDefault();
      window.location.href = '/app/pro/dashboard/multi-file-upload';
    });
  }

  /* ---------------- FilePond init ---------------- */
  if (typeof FilePond !== 'undefined' && FilePond.registerPlugin) {
    if (typeof FilePondPluginFileValidateSize !== 'undefined') FilePond.registerPlugin(FilePondPluginFileValidateSize);
    if (typeof FilePondPluginFileValidateType !== 'undefined') FilePond.registerPlugin(FilePondPluginFileValidateType);
  }
  document.querySelectorAll('form[ms-code-file-upload="form"]').forEach(f => f.setAttribute('enctype', 'multipart/form-data'));

  let inputEl = document.querySelector('input[name="fileToUpload"]');

  if (!inputEl) {
    const uploaderDiv = document.querySelector('.uploader');
    if (uploaderDiv) {
      const placeholder = uploaderDiv.querySelector('.upload-zone-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      inputEl = document.createElement('input');
      inputEl.type = 'file';
      inputEl.name = 'fileToUpload';
      inputEl.setAttribute('accept', 'audio/*,video/*,video/mp4,audio/mp4,audio/x-m4a,audio/ogg');
      uploaderDiv.appendChild(inputEl);
    }
  }

  let pond = null;
  if (inputEl && typeof FilePond !== 'undefined') {
    pond = FilePond.create(inputEl, {
      credits: false,
      storeAsFile: true,
      allowMultiple: false,
      name: 'fileToUpload',
      acceptedFileTypes: ['audio/*', 'video/*', 'video/mp4', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'],
      labelIdle: 'Glissez-déposez votre fichier audio (M4A, MP3, MP4, MPEG, WAV) ou <span class="filepond--label-action">Parcourir</span>',
      labelFileTypeNotAllowed: 'Type non autorisé (seuls les fichiers audio/vidéo comme MP3, WAV, etc. sont acceptés)'
    });
  }

  /* ---------------- Variables UI ---------------- */
  const edition = 'pro';
  const form = document.querySelector('form[ms-code-file-upload="form"]');
  const successDiv = document.getElementById('form_success');
  const formLoadingDiv = document.getElementById('form_loading');
  const loadingAnimDiv = document.getElementById('loading_animation');
  const readyAnimDiv = document.getElementById('ready_animation');
  const transcriptContainer = document.getElementById('tabs-container');
  const summaryContainer = document.getElementById('summaryTextContainer');
  const submitBtn = document.getElementById('submit-button');
  const loadingSummary = document.getElementById('loading-summary');
  const checkIcon = document.getElementById('check-icon');
  const summaryText = document.getElementById('summaryText');
  const newFormBtn = document.getElementById('newForm');
  const newBtn = document.getElementById('newButton');

  // Tabs résultats (Transcription / Summary)
  const summaryTabLink = document.querySelector('[data-w-tab="Summary"]');
  const transcriptionTabLink = document.querySelector('[data-w-tab="Transcription"]');
  const tabsMenu = (summaryTabLink && summaryTabLink.closest('.w-tab-menu')) || document.querySelector('.w-tab-menu');

  // Options formulaire
  const speakersCheckbox = document.getElementById('toggle-speakers');
  const summaryCheckbox = document.getElementById('toggle-summary');
  const formatCheckbox = document.getElementById('toggle-format-transcript');
  const speakersSelect = document.getElementById('speakers-select');
  const translateCheckbox = document.getElementById('toggle-translate');
  const translateSelect = document.getElementById('translate-select');

  const youtubeInput = document.getElementById('youtube-url-input');

  /* ------------ Erreurs UI ------------- */
  const errorMessageDivs = {
    default: document.getElementById('form_error'),
    tooMuchTraffic: document.getElementById('form_limitation'),
    audioTooLong: document.getElementById('form_audio-too_long'),
    audioFormat: document.getElementById('form_error_audio_format'),
    audioNotFound: document.getElementById('form_error_audio_not_found'),
    invalidToken: document.getElementById('form_error_invalid_token'),
    invalidAudioContent: document.getElementById('form_error'),
    summaryLimit: document.getElementById('form_error_summary_limit'),
    offline: document.getElementById('form_error_offline'),
    timeout: document.getElementById('form_error_timeout'),
    tooManyHours: document.getElementById('form_error_too_many_hours'),
    unreachable: document.getElementById('form_error_unreachable'),
    youtubeInvalid: document.getElementById('form_error'),
    youtubePrivate: document.getElementById('form_error'),
    youtubeNotFound: document.getElementById('form_error'),
    serverError: document.getElementById('form_error'),
    httpError: document.getElementById('form_error')
  };

  /* ---------------- Helpers UI ---------------- */
  const hideAllErrors = () => { Object.values(errorMessageDivs).forEach(d => d && (d.style.display = 'none')); };
  const showError = key => {
    hideAllErrors();
    if (successDiv) successDiv.style.display = 'none';
    (errorMessageDivs[key] || errorMessageDivs.default)?.style && ((errorMessageDivs[key] || errorMessageDivs.default).style.display = 'block');
  };
  const showSuccess = () => { hideAllErrors(); if (successDiv) successDiv.style.display = 'flex'; };
  const scrollToEl = (el, offset = 0) => { if (!el) return; const top = el.getBoundingClientRect().top + window.pageYOffset + offset; window.scrollTo({ top, behavior: 'smooth' }); };

  function getActiveSourceTab() {
    const active = document.querySelector('.source-tab.active');
    return active ? active.getAttribute('data-tab') : 'file';
  }

  function getActiveUploadSource() {
    const tab = getActiveSourceTab();
    if (tab === 'youtube') return 'youtube';
    if (tab === 'dictee') return 'dictation';
    return 'file';
  }

  function validateYouTubeUrl(url) {
    if (!url || !url.trim()) return { valid: false, error: 'Veuillez saisir une URL YouTube' };
    const trimmed = url.trim();
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    const isValid = patterns.some(p => p.test(trimmed));
    if (!isValid) return { valid: false, error: 'URL YouTube invalide. Format attendu : https://www.youtube.com/watch?v=... ou https://youtu.be/...' };
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
    return { valid: true, url: trimmed, videoId: match ? match[1] : null };
  }

  function adjustHtmlContent(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('center').forEach(c => { c.outerHTML = c.innerHTML; });
    tmp.querySelectorAll('table').forEach(t => { t.style.width = '100%'; });
    return tmp.innerHTML;
  }

  function updateProgressUI(status) {
    if (!loadingAnimDiv) return;
    const oldStatus = loadingAnimDiv.querySelector('.progress-status');
    if (oldStatus) oldStatus.remove();
    if (status === 'READY_SUMMARY_PENDING') {
      const statusText = document.createElement('div');
      statusText.className = 'progress-status';
      statusText.style.cssText = 'margin-top: 12px; font-size: 14px; text-align: center; font-weight: 500;';
      statusText.textContent = '✓ Transcription terminée - Génération du compte-rendu...';
      loadingAnimDiv.appendChild(statusText);
    }
  }

  async function refreshAgiloTokenFromApi(email) {
    const em = email && String(email).trim();
    if (!em) return false;
    try {
      const response = await fetch(
        `https://api.agilotext.com/api/v1/getToken?username=${encodeURIComponent(em)}&edition=${edition}`
      );
      const data = await response.json();
      if (data.status === 'OK' && data.token) {
        globalToken = data.token;
        try {
          window.globalToken = data.token;
        } catch (e) { /* ignore */ }
        return true;
      }
    } catch (err) { console.error('Erreur lors de la récupération du token:', err); }
    return false;
  }

  async function ensureValidToken(email, forceRefresh) {
    if (!forceRefresh && globalToken) return true;
    const ok = await refreshAgiloTokenFromApi(email);
    if (ok) console.log(forceRefresh ? 'Token Agilotext rafraîchi (getToken)' : 'Token récupéré automatiquement');
    return ok;
  }

  function setSummaryUI(state) {
    if (tabsMenu) tabsMenu.style.display = '';
    const hide = el => { if (el) el.style.display = 'none'; };
    const show = el => { if (el) el.style.display = ''; };
    if (!summaryTabLink) return;

    if (state === 'hidden') {
      if (summaryTabLink.classList.contains('w--current') && transcriptionTabLink) transcriptionTabLink.click();
      hide(summaryTabLink); hide(summaryContainer); hide(loadingSummary); hide(checkIcon); return;
    }
    show(summaryTabLink);
    if (state === 'loading') { show(loadingSummary); hide(checkIcon); }
    else if (state === 'ready') { hide(loadingSummary); show(checkIcon); show(summaryContainer); }
    else if (state === 'error') { hide(loadingSummary); hide(checkIcon); }
  }

  /* ------------------- Sécurités FilePond (anti "trop vite") ------------------- */
  const setSubmitEnabled = (enabled) => { if (submitBtn) submitBtn.disabled = !enabled; };
  setSubmitEnabled(false);
  pond?.on('addfile', () => setSubmitEnabled(true));
  pond?.on('removefile', () => setSubmitEnabled(false));

  async function waitPondFileReady(maxWaitMs = 3000) {
    const start = Date.now();
    while (true) {
      const item = pond?.getFiles()?.[0];
      if (item && item.file instanceof File) return item.file;
      if (Date.now() - start > maxWaitMs) return null;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  /* -------------- Fetch helpers (retry 1× si token expiré pendant job long) -------------- */
  /** @param {{ focusTranscription?: boolean }} [opts] */
  function applyTranscriptTextUI(txt, opts) {
    const focusTranscription = !opts || opts.focusTranscription !== false;
    const ta = document.getElementById('transcriptText');
    if (ta) ta.value = txt;
    window.dispatchEvent(new CustomEvent('agilo:transcript-ready', { detail: { text: txt } }));
    if (transcriptContainer) transcriptContainer.style.display = 'block';
    if (submitBtn) submitBtn.style.display = 'none';
    if (focusTranscription && transcriptionTabLink) transcriptionTabLink.click();
  }

  async function fetchTranscriptText(jobId, email, fetchOpts) {
    if (!email) return;
    const url = () =>
      `https://api.agilotext.com/api/v1/receiveText?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=txt`;
    const run = async () => {
      if (!globalToken) throw { type: 'invalidToken' };
      const r = await fetchWithTimeout(url(), { timeout: 2 * 60 * 1000 });
      return r.text();
    };
    try {
      const txt = await run();
      applyTranscriptTextUI(txt, fetchOpts);
    } catch (err) {
      if (err && err.type === 'invalidToken' && (await refreshAgiloTokenFromApi(String(email).trim()))) {
        try {
          const txt2 = await run();
          applyTranscriptTextUI(txt2, fetchOpts);
          return;
        } catch (err2) {
          console.error('receiveText (après refresh):', err2);
          showError(err2.type || 'default');
          return;
        }
      }
      console.error('receiveText:', err);
      showError(err.type || 'default');
    }
  }

  function applySummaryTextUI(html) {
    const adjusted = adjustHtmlContent(html);
    if (summaryText) {
      if (window.AgilotextDashboardSummary && typeof window.AgilotextDashboardSummary.inject === 'function') {
        window.AgilotextDashboardSummary.inject(summaryText, adjusted);
      } else {
        summaryText.innerHTML = adjusted;
      }
    }
    setSummaryUI('ready');
    if (summaryContainer) summaryContainer.style.display = 'block';
    if (newFormBtn) newFormBtn.style.display = 'flex';
    if (newBtn) newBtn.style.display = 'flex';
    if (submitBtn) submitBtn.style.display = 'none';
    if (summaryTabLink) summaryTabLink.click();
    window.dispatchEvent(new Event('agilo:rehighlight'));
  }

  async function fetchSummaryText(jobId, email) {
    if (!email) return;
    const url = () =>
      `https://api.agilotext.com/api/v1/receiveSummary?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=html`;
    const run = async () => {
      if (!globalToken) throw { type: 'invalidToken' };
      const r = await fetchWithTimeout(url(), { timeout: 2 * 60 * 1000 });
      return r.text();
    };
    try {
      const html = await run();
      applySummaryTextUI(html);
    } catch (err) {
      if (err && err.type === 'invalidToken' && (await refreshAgiloTokenFromApi(String(email).trim()))) {
        try {
          const html2 = await run();
          applySummaryTextUI(html2);
          return;
        } catch (err2) {
          console.error('receiveSummary (après refresh):', err2);
          showError(err2.type || 'default');
          return;
        }
      }
      console.error('receiveSummary:', err);
      setSummaryUI('error');
      showError(err.type || 'default');
    }
  }

  /* -------------- Poll status -------------- */
  function checkTranscriptStatus(jobId, email) {
    if (!globalToken) { console.error('Token manquant'); return; }
    if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

    const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000;
    const startTime = Date.now();
    let fetched = false;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;
    let pollCount = 0;

    const intId = setInterval(async () => {
      pollCount++;
      const elapsed = Date.now() - startTime;
      if (elapsed > GLOBAL_TIMEOUT) {
        clearInterval(intId); window._agiloStatusInt = null;
        if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
        if (readyAnimDiv) readyAnimDiv.style.display = 'none';
        showError('timeout');
        alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
        return;
      }

      const tokenValid = await ensureValidToken(email, false);
      if (!tokenValid) {
        clearInterval(intId); window._agiloStatusInt = null;
        if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
        showError('invalidToken');
        alert(
          'Le jeton d’accès Agilotext a expiré ou a été renouvelé. Rechargez la page pour continuer — vous restez connecté à votre compte.'
        );
        return;
      }

      if (pollCount % 6 === 0) {
        const minutes = Math.floor(elapsed / 60000);
        console.log(`⏳ Traitement en cours depuis ${minutes} minute(s)...`);
      }

      // Jobs longs (jusqu'à 2 h) : refresh ~toutes les 10 min (120 × 5 s)
      if (pollCount > 1 && pollCount % 120 === 0) {
        await refreshAgiloTokenFromApi(String(email).trim());
      }

      fetchWithTimeout(
        `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(globalToken)}&edition=${edition}`,
        { timeout: 30 * 1000 }
      )
        .then(r => r.json())
        .then(data => {
          consecutiveErrors = 0;
          updateProgressUI(data.transcriptStatus);

          switch (data.transcriptStatus) {
            case 'READY_SUMMARY_PENDING':
              if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
              if (readyAnimDiv) readyAnimDiv.style.display = 'block';
              if (summaryCheckbox && summaryCheckbox.checked) setSummaryUI('loading'); else setSummaryUI('hidden');
              if (!fetched) { fetchTranscriptText(jobId, email); fetched = true; }
              break;

            case 'READY_SUMMARY_READY': {
              clearInterval(intId); window._agiloStatusInt = null;
              if (loadingAnimDiv) {
                loadingAnimDiv.style.display = 'none';
                loadingAnimDiv.querySelector('.progress-status')?.remove();
              }
              if (readyAnimDiv) readyAnimDiv.style.display = 'block';
              fetchTranscriptText(
                jobId,
                email,
                summaryCheckbox && summaryCheckbox.checked ? { focusTranscription: false } : undefined
              );
              if (summaryCheckbox && summaryCheckbox.checked) {
                setSummaryUI('ready');
                fetchSummaryText(jobId, email);
              } else {
                setSummaryUI('hidden');
                transcriptionTabLink && transcriptionTabLink.click();
              }
              break;
            }

            case 'ON_ERROR':
            case 'READY_SUMMARY_ON_ERROR': {
              clearInterval(intId); window._agiloStatusInt = null;
              if (loadingAnimDiv) {
                loadingAnimDiv.querySelector('.progress-status')?.remove();
                loadingAnimDiv.style.display = 'none';
              }
              if (summaryCheckbox && summaryCheckbox.checked) setSummaryUI('error'); else setSummaryUI('hidden');
              showError('default');
              alert(data.javaException || 'Erreur inconnue');
              break;
            }

            default:
              console.warn('Statut transcript inconnu:', data.transcriptStatus);
          }
        })
        .catch(async err => {
          consecutiveErrors++;
          console.error(`getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);

          if (err.type === 'invalidToken') {
            const renewed = await refreshAgiloTokenFromApi(email);
            if (renewed) {
              consecutiveErrors = 0;
              console.warn('Token Agilotext renouvelé pendant le suivi du job.');
              return;
            }
            clearInterval(intId); window._agiloStatusInt = null;
            if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
            showError('invalidToken');
            alert(
              'Le jeton d’accès Agilotext a expiré ou a été renouvelé. Rechargez la page pour continuer — vous restez connecté à votre compte.'
            );
            return;
          }

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            clearInterval(intId); window._agiloStatusInt = null;
            if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
            if (readyAnimDiv) readyAnimDiv.style.display = 'none';
            loadingAnimDiv?.querySelector?.('.progress-status')?.remove();

            if (err.type === 'timeout') {
              showError('timeout');
              alert('Connexion trop lente ou instable. Le traitement a été interrompu après plusieurs tentatives échouées. Veuillez vérifier votre connexion internet et réessayer.');
            } else if (err.type === 'offline') {
              showError('offline');
              alert('Vous êtes hors ligne. Veuillez vérifier votre connexion internet.');
            } else if (err.type === 'serverError') {
              showError('default');
              alert('Erreur serveur. Veuillez réessayer dans quelques instants.');
            } else {
              showError('unreachable');
              alert('Impossible de contacter le serveur après plusieurs tentatives. Veuillez vérifier votre connexion internet et réessayer.');
            }
          } else if (consecutiveErrors === 3) {
            console.warn('⚠️ Plusieurs erreurs de connexion détectées. Le processus continue...');
          }
        });
    }, 5000);

    window._agiloStatusInt = intId;
    const cleanup = () => {
      if (window._agiloStatusInt === intId) {
        clearInterval(intId); window._agiloStatusInt = null;
        console.log('Polling nettoyé (changement de page)');
      }
    };
    window.addEventListener('beforeunload', cleanup);
  }

  /* -------------- Retry helpers -------------- */
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const waitForOnline = () => new Promise(resolve => {
    if (navigator.onLine) return resolve();
    const on = () => { window.removeEventListener('online', on); resolve(); };
    window.addEventListener('online', on);
  });

  async function sendWithRetry(data, max = 3, isYouTube = false) {
    const url = isYouTube ? 'https://api.agilotext.com/api/v1/sendYoutubeUrl'
                          : 'https://api.agilotext.com/api/v1/sendMultipleAudio';

    console.log(`🌐 Envoi vers: ${url} (YouTube: ${isYouTube})`);

    const fetchOptions = { method: 'POST', timeout: 10 * 60 * 1000 };
    if (isYouTube) {
      const body = new URLSearchParams();
      Object.keys(data).forEach(key => body.append(key, String(data[key] || '')));
      fetchOptions.body = body.toString();
      fetchOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
      console.log('📤 Payload URLSearchParams pour YouTube:', data);
    } else {
      fetchOptions.body = data; // FormData
    }

    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        if (!navigator.onLine) await waitForOnline();

        const res = await fetchWithTimeout(url, fetchOptions);
        const textResponse = await res.text();
        console.log('📄 Réponse brute:', textResponse);

        let responseData = {};
        try { responseData = JSON.parse(textResponse); } catch (e) { console.error('❌ Erreur parsing JSON:', e, textResponse); }

        console.log(`📥 Réponse API (tentative ${attempt}/${max}):`, {
          status: res.status, ok: res.ok, data: responseData
        });

        if (res.ok && responseData && responseData.status === 'OK') {
          console.log('✅ Succès!');
          return responseData;
        }

        const em = (responseData && responseData.errorMessage) || '';

        if (em.includes('error_invalid_token') && attempt < max) {
          const emailForRefresh = isYouTube
            ? data && data.username
            : typeof data.get === 'function'
              ? data.get('username')
              : '';
          if (emailForRefresh && (await refreshAgiloTokenFromApi(String(emailForRefresh)))) {
            if (isYouTube) data.token = globalToken;
            else if (typeof data.set === 'function') data.set('token', globalToken);
            continue;
          }
        }

        if (
          em.includes('error_audio_format_not_supported') ||
          em.includes('error_max_file_size_exceeded') ||
          em.includes('error_duration_is_too_long_for_summary') ||
          em.includes('error_duration_is_too_long') ||
          em.includes('error_max_duration_exceeded') ||
          em.includes('error_audio_file_not_found') ||
          em.includes('error_invalid_token') ||
          em.includes('error_too_many_hours_for_last_30_days') ||
          em.includes('error_account_pending_validation') ||
          em.includes('error_limit_reached_for_user') ||
          em.includes('error_quota_exceeded') ||
          em.includes('error_pro_quota_exceeded') ||
          em.includes('error_subscription_quota') ||
          em.includes('error_plan_limit_reached') ||
          em.includes('error_subscription_limit') ||
          em.includes('error_limit_reached') ||
          em.includes('error_invalid_audio_file_content') ||
          em.includes('error_silent_audio_file') ||
          em.includes('error_transcript_too_long_for_summary') ||
          em.includes('error_too_many_devices_used_for_account') ||
          em.includes('error_too_many_calls') ||
          em.includes('ERROR_CANNOT_DONWLOAD_YOUTUBE_URL') ||
          em.includes('ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL') ||
          em.includes('ERROR_INVALID_YOUTUBE_URL')
        ) {
          return responseData;
        }

        const retryableHttp = [408, 425, 429, 500, 502, 503, 504].includes(res.status);
        const retryableApi = em === 'error_too_much_traffic';

        if ((retryableHttp || retryableApi) && attempt < max) {
          const backoff = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
          await delay(backoff);
          continue;
        }

        return responseData;
      } catch (err) {
        if (attempt < max && err && err.type === 'invalidToken') {
          const emailForRefresh = isYouTube
            ? data && data.username
            : typeof data.get === 'function'
              ? data.get('username')
              : '';
          if (emailForRefresh && (await refreshAgiloTokenFromApi(String(emailForRefresh)))) {
            if (isYouTube) data.token = globalToken;
            else if (typeof data.set === 'function') data.set('token', globalToken);
            continue;
          }
        }
        if (attempt < max && err && (err.type === 'offline' || err.type === 'timeout' || err.type === 'unreachable')) {
          if (err.type === 'offline') await waitForOnline();
          else {
            const backoff = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
            await delay(backoff);
          }
          continue;
        }
        throw err;
      }
    }

    throw new Error('upload_failed');
  }

  /* -------------- SUBMIT -------------- */
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      hideAllErrors();
      if (successDiv) successDiv.style.display = 'none';

      if (form.dataset.sending === '1') return;
      form.dataset.sending = '1';

      const beforeUnloadGuard = ev => {
        if (form.dataset.sending === '1') { ev.preventDefault(); ev.returnValue = ''; }
      };
      window.addEventListener('beforeunload', beforeUnloadGuard);

      const uploadSource = getActiveUploadSource();
      console.log('📤 Submit - Source détectée:', uploadSource);

      const fd = uploadSource === 'youtube' ? new FormData() : new FormData(form);

      // Email
      let email;
      if (uploadSource === 'youtube') {
        const emailInput = document.querySelector('input[name="memberEmail"]');
        email = emailInput?.value || emailInput?.getAttribute('src') || emailInput?.getAttribute('data-src') || '';
        console.log('📧 Email récupéré pour YouTube:', email);
      } else {
        email = fd.get('memberEmail');
      }

      if (!email || !String(email).trim()) {
        console.error('❌ Email non trouvé !');
        showError('invalidToken');
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }

      // Validation selon la source
      if (uploadSource === 'dictation') {
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }
      if (uploadSource === 'youtube') {
        if (!youtubeInput || !youtubeInput.value) {
          showError('youtubeInvalid'); alert('Veuillez saisir une URL YouTube');
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }
        const validation = validateYouTubeUrl(youtubeInput.value);
        if (!validation.valid) {
          showError('youtubeInvalid'); alert(validation.error);
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }
      } else {
        if (!pond || pond.getFiles().length === 0) {
          showError('audioNotFound');
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }
      }

      const tokenFresh = await ensureValidToken(String(email).trim(), true);
      if (!tokenFresh || !globalToken) {
        console.error('Token non disponible');
        if (submitBtn) submitBtn.disabled = false;
        if (formLoadingDiv) formLoadingDiv.style.display = 'none';
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        showError('invalidToken');
        alert(
          'Impossible d’obtenir un jeton d’accès Agilotext. Rechargez la page pour continuer (vous restez connecté à votre compte) ou vérifiez votre connexion.'
        );
        return;
      }

      if (formLoadingDiv) formLoadingDiv.style.display = 'block';
      if (submitBtn) submitBtn.disabled = true;

      const speakersChecked = !!(speakersCheckbox && speakersCheckbox.checked);
      const summaryChecked = !!(summaryCheckbox && summaryCheckbox.checked);
      const formatChecked = !!(formatCheckbox && formatCheckbox.checked);
      const speakersExpected = speakersSelect ? speakersSelect.value : '';
      setSummaryUI(summaryChecked ? 'loading' : 'hidden');

      let payload;

      if (uploadSource === 'youtube') {
        const memberIdInput = document.querySelector('input[name="memberId"]');
        const deviceIdInput = document.querySelector('input[name="deviceId"]');
        const memberId = memberIdInput?.value || memberIdInput?.getAttribute('src') || memberIdInput?.getAttribute('data-src') || '';
        const validation = validateYouTubeUrl(youtubeInput.value);

        payload = {
          token: globalToken,
          username: email,
          edition,
          timestampTranscript: speakersChecked ? 'true' : 'false',
          formatTranscript: speakersChecked ? 'false' : (formatChecked ? 'true' : 'false'),
          doSummary: summaryChecked ? 'true' : 'false',
          url: validation.url,
          deviceId: deviceIdInput?.value || window.DEVICE_ID || '',
          mailTranscription: 'true'
        };
        if (memberId) payload.memberId = memberId;
        if (speakersChecked) payload.speakersExpected = speakersExpected;
        if (translateCheckbox && translateCheckbox.checked) payload.translateTo = translateSelect.value;

      } else {
        const file = await waitPondFileReady(3000);
        if (!(file instanceof File)) {
          showError('audioNotFound');
          alert('Le fichier n\u2019est pas encore prêt. Réessayez.');
          if (formLoadingDiv) formLoadingDiv.style.display = 'none';
          if (submitBtn) submitBtn.disabled = false;
          form.dataset.sending = '0';
          window.removeEventListener('beforeunload', beforeUnloadGuard);
          return;
        }

        fd.append('token', globalToken);
        fd.append('username', email);
        fd.append('edition', edition);
        fd.append('timestampTranscript', speakersChecked ? 'true' : 'false');
        if (speakersChecked) {
          fd.append('speakersExpected', speakersExpected);
          fd.append('formatTranscript', 'false');
        } else {
          fd.append('formatTranscript', formatChecked ? 'true' : 'false');
        }
        fd.append('doSummary', summaryChecked ? 'true' : 'false');
        if (translateCheckbox && translateCheckbox.checked) fd.append('translateTo', translateSelect.value);

        fd.delete('fileToUpload');
        fd.delete('audioFile');
        fd.append('fileUpload1', file, file.name);

        fd.append('deviceId', window.DEVICE_ID || '');
        fd.append('mailTranscription', 'true');
        payload = fd;
      }

      sendWithRetry(payload, 3, uploadSource === 'youtube')
        .then(data => {
          if (formLoadingDiv) formLoadingDiv.style.display = 'none';

          if (data && data.status === 'OK') {
            showSuccess();
            const jobId = data.jobIdList && data.jobIdList[0];
            if (jobId) {
              localStorage.setItem('currentJobId', jobId);
              document.dispatchEvent(new CustomEvent('newJobIdAvailable'));
              var sessionInput = form && form.querySelector('input[name="agilo_record_session_id"]');
              var recordSessionId = sessionInput ? sessionInput.value : undefined;
              document.dispatchEvent(new CustomEvent('agilo-upload-confirmed', { detail: { sessionId: recordSessionId, jobId: jobId } }));
            }
            if (successDiv) successDiv.style.display = 'flex';
            if (loadingAnimDiv) loadingAnimDiv.style.display = 'block';
            checkTranscriptStatus(jobId, email);
            if (loadingAnimDiv) scrollToEl(loadingAnimDiv, -80);
          } else {
            document.dispatchEvent(new CustomEvent('agilo-upload-failed', { detail: { errorMessage: (data && data.errorMessage) || '' } }));
            const err = (data && data.errorMessage) || '';
            if (err === 'error_too_much_traffic') showError('tooMuchTraffic');
            else if (
              err.includes('error_account_pending_validation') ||
              err.includes('error_limit_reached_for_user') ||
              err.includes('error_quota_exceeded') ||
              err.includes('error_pro_quota_exceeded') ||
              err.includes('error_subscription_quota') ||
              err.includes('error_plan_limit_reached') ||
              err.includes('error_subscription_limit') ||
              err.includes('error_limit_reached')
            ) showError('tooMuchTraffic');
            else if (err.includes('error_duration_is_too_long_for_summary')) showError('summaryLimit');
            else if (err.includes('error_duration_is_too_long') || err.includes('error_max_duration_exceeded')) showError('audioTooLong');
            else if (err.includes('error_transcript_too_long_for_summary')) showError('summaryLimit');
            else if (err.includes('error_audio_format_not_supported') || err.includes('error_max_file_size_exceeded')) showError('audioFormat');
            else if (err.includes('error_invalid_audio_file_content')) showError('invalidAudioContent');
            else if (err.includes('error_silent_audio_file')) showError('audioFormat');
            else if (err.includes('error_audio_file_not_found')) showError('audioNotFound');
            else if (err.includes('error_invalid_token')) showError('invalidToken');
            else if (
              err.includes('error_too_many_hours_for_last_30_days') ||
              err.includes('error_quota_exceeded') ||
              err.includes('error_pro_quota_exceeded') ||
              err.includes('error_subscription_quota') ||
              err.includes('error_plan_limit_reached') ||
              err.includes('error_subscription_limit') ||
              err.includes('error_limit_reached')
            ) showError('tooManyHours');
            else if (err.includes('error_too_many_devices_used_for_account')) { showError('default'); alert('Trop d\'appareils utilisés pour ce compte. Veuillez contacter le support.'); }
            else if (err.includes('error_too_many_calls')) showError('tooMuchTraffic');
            else if (err.includes('ERROR_INVALID_YOUTUBE_URL') || (err.toLowerCase().includes('youtube') && err.toLowerCase().includes('invalid'))) showError('youtubeInvalid');
            else if (err.includes('ERROR_CANNOT_DONWLOAD_YOUTUBE_URL') || err.includes('ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL') || (err.toLowerCase().includes('youtube') && err.toLowerCase().includes('private'))) showError('youtubePrivate');
            else if (err.toLowerCase().includes('youtube') && err.toLowerCase().includes('not found')) showError('youtubeNotFound');
            else { console.error('❌ Erreur non mappée:', err); showError('default'); if (err && err.trim()) alert('Erreur: ' + err); }
          }
        })
        .catch(err => {
          console.error('Erreur lors de l\'envoi:', err);
          document.dispatchEvent(new CustomEvent('agilo-upload-failed', { detail: { errorMessage: err && err.message || '' } }));
          showError(err.type || 'default');
        })
        .finally(() => {
          if (formLoadingDiv) formLoadingDiv.style.display = 'none';
          if (submitBtn) submitBtn.disabled = false;
          form.dataset.sending = '0';
          window.removeEventListener('beforeunload', beforeUnloadGuard);
        });
    });
  }

  setSummaryUI('hidden');

  // Expose globals for mount-streaming.js (dictee en direct)
  window.ensureValidToken = ensureValidToken;
  window.sendWithRetry = sendWithRetry;
  window.checkTranscriptStatus = checkTranscriptStatus;
  window.showError = showError;
  window.edition = edition;
});
