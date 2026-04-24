/**
 * upload_ent_v2.js — Agilotext Business
 * ──────────────────────────────────────────────────────────────────
 * Version adaptée du script upload Ent pour le nouveau dashboard
 * avec 3 onglets source (Fichier | YouTube | Dictée).
 *
 * Changements par rapport à upload_ent.js (V1) :
 *   - Gestion tabs custom (.source-tab[data-tab]) au lieu de w-tabs
 *   - Création dynamique de <input name="fileToUpload"> si absent
 *   - Sélecteurs YouTube adaptés (#panel-youtube, #youtube-url-input)
 *   - Garde submit si onglet dictée actif
 *   - Expose ensureValidToken / sendWithRetry / showError /
 *     globalToken / edition / checkTranscriptStatus sur window
 *     pour mount-streaming.js
 *
 * Dépendances CDN (à charger AVANT ce script) :
 *   - filepond.js + filepond-plugin-file-validate-type + size
 *   - v1.06 : agilo-summary-dashboard-embed.js (iframe CR) — charger avant ce script
 *
 * Après ce script, charger (optionnel, streaming) :
 *   - streaming-ent-loader.js (qui charge agilo-live-transcribe + mount-streaming)
 *
 * v1.01+ : jeton sur actions longues — refresh avant upload, retry receiveText/Summary
 * après invalidToken, refresh proactif pendant poll (~10 min), sendWithRetry si error_invalid_token.
 * ──────────────────────────────────────────────────────────────────
 */

/* ====================== Helpers réseau ====================== */
function fetchWithTimeout(url, options) {
  options = options || {};
  var TIMEOUT = options.timeout || (3 * 60 * 60 * 1000);
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);

  return fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    signal: ctrl.signal,
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store'
  })
    .then(function (response) {
      clearTimeout(timer);
      if (!response.ok) {
        var status = response.status;
        if (status === 401 || status === 403) return Promise.reject({ type: 'invalidToken', status: status, message: 'Session expirée' });
        if (status === 429) return Promise.reject({ type: 'tooMuchTraffic', status: status, message: 'Trop de requêtes' });
        if (status >= 500) return Promise.reject({ type: 'serverError', status: status, message: 'Erreur serveur' });
        return Promise.reject({ type: 'httpError', status: status, message: 'Erreur HTTP ' + status });
      }
      return response;
    })
    .catch(function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') return Promise.reject({ type: 'timeout' });
      if (err && err.type) return Promise.reject(err);
      return Promise.reject({ type: 'unreachable' });
    });
}

/* ====================== Main logic ====================== */
document.addEventListener('DOMContentLoaded', function () {

  /* ─── Source tabs (Fichier / YouTube / Dictée) ─────────────── */
  var sourceTabs = document.querySelectorAll('.source-tab[data-tab]');
  var sourcePanels = document.querySelectorAll('.source-panel[id^="panel-"]');

  sourceTabs.forEach(function (btn) { btn.setAttribute('type', 'button'); });

  function activateSourceTab(tabValue) {
    sourceTabs.forEach(function (btn) {
      var isActive = btn.getAttribute('data-tab') === tabValue;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    sourcePanels.forEach(function (panel) {
      var panelKey = (panel.id || '').replace('panel-', '');
      panel.classList.toggle('active', panelKey === tabValue);
    });
    var sub = document.getElementById('submit-button');
    if (sub) sub.style.display = (tabValue === 'dictee') ? 'none' : '';
  }

  sourceTabs.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      activateSourceTab(btn.getAttribute('data-tab'));
    });
  });

  /* ─── Envoi multiple → redirection ──────────────────────────── */
  var multiToggle = document.querySelector('.checkbox-component.multiple-audios .checkbox_toggle');
  if (multiToggle) {
    multiToggle.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = '/app/business/dashboard/multi-file-upload';
    });
  }

  /* ─── FilePond ─────────────────────────────────────────────── */
  if (typeof FilePond !== 'undefined' && FilePond.registerPlugin) {
    if (typeof FilePondPluginFileValidateSize !== 'undefined') FilePond.registerPlugin(FilePondPluginFileValidateSize);
    if (typeof FilePondPluginFileValidateType !== 'undefined') FilePond.registerPlugin(FilePondPluginFileValidateType);
  }

  document.querySelectorAll('form[ms-code-file-upload="form"]').forEach(function (f) {
    f.setAttribute('enctype', 'multipart/form-data');
  });

  var inputEl = document.querySelector('input[name="fileToUpload"]');

  if (!inputEl) {
    var uploaderDiv = document.querySelector('.uploader');
    var placeholder = document.querySelector('.upload-zone-placeholder');
    if (uploaderDiv) {
      if (placeholder) placeholder.style.display = 'none';
      inputEl = document.createElement('input');
      inputEl.type = 'file';
      inputEl.name = 'fileToUpload';
      inputEl.setAttribute('accept', 'audio/*,video/*,video/mp4,audio/mp4,audio/x-m4a,audio/ogg');
      uploaderDiv.appendChild(inputEl);
    }
  }

  var pond = null;
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

  /* ─── Variables UI ─────────────────────────────────────────── */
  var edition = 'ent';
  globalToken = window.globalToken || '';
  var form = document.querySelector('form[ms-code-file-upload="form"]');
  var successDiv = document.getElementById('form_success');
  var formLoadingDiv = document.getElementById('form_loading');
  var loadingAnimDiv = document.getElementById('loading_animation');
  var readyAnimDiv = document.getElementById('ready_animation');
  var transcriptContainer = document.getElementById('tabs-container');
  var summaryContainer = document.getElementById('summaryTextContainer');
  var submitBtn = document.getElementById('submit-button');
  var loadingSummary = document.getElementById('loading-summary');
  var checkIcon = document.getElementById('check-icon');
  var summaryText = document.getElementById('summaryText');
  var newFormBtn = document.getElementById('newForm');
  var newBtn = document.getElementById('newButton');

  var summaryTabLink = document.querySelector('[data-w-tab="Summary"]');
  var transcriptionTabLink = document.querySelector('[data-w-tab="Transcription"]');
  var tabsMenu = (summaryTabLink && summaryTabLink.closest('.w-tab-menu')) || document.querySelector('.w-tab-menu');

  var speakersCheckbox = document.getElementById('toggle-speakers');
  var summaryCheckbox = document.getElementById('toggle-summary');
  var formatCheckbox = document.getElementById('toggle-format-transcript');
  var speakersSelect = document.getElementById('speakers-select');
  var translateCheckbox = document.getElementById('toggle-translate');
  var translateSelect = document.getElementById('translate-select');

  var youtubeInput = document.getElementById('youtube-url-input');

  /* ─── Erreurs UI ───────────────────────────────────────────── */
  var errorMessageDivs = {
    default:             document.getElementById('form_error'),
    tooMuchTraffic:      document.getElementById('form_limitation'),
    audioTooLong:        document.getElementById('form_audio-too_long'),
    audioFormat:         document.getElementById('form_error_audio_format'),
    audioNotFound:       document.getElementById('form_error_audio_not_found'),
    invalidToken:        document.getElementById('form_error_invalid_token'),
    invalidAudioContent: document.getElementById('form_error'),
    summaryLimit:        document.getElementById('form_error_summary_limit'),
    offline:             document.getElementById('form_error_offline'),
    timeout:             document.getElementById('form_error_timeout'),
    tooManyHours:        document.getElementById('form_error_too_many_hours'),
    unreachable:         document.getElementById('form_error_unreachable'),
    youtubeInvalid:      document.getElementById('form_error'),
    youtubePrivate:      document.getElementById('form_error'),
    youtubeNotFound:     document.getElementById('form_error')
  };

  /* ─── Helpers UI ───────────────────────────────────────────── */
  function hideAllErrors() {
    Object.keys(errorMessageDivs).forEach(function (k) {
      var d = errorMessageDivs[k];
      if (d) d.style.display = 'none';
    });
  }

  function showError(key) {
    hideAllErrors();
    if (successDiv) successDiv.style.display = 'none';
    var el = errorMessageDivs[key] || errorMessageDivs['default'];
    if (el) el.style.display = 'block';
  }

  function showSuccess() { hideAllErrors(); if (successDiv) successDiv.style.display = 'flex'; }

  function scrollToEl(el, offset) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset + (offset || 0);
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  /* ─── Source detection ─────────────────────────────────────── */
  function getActiveSourceTab() {
    var active = document.querySelector('.source-tab.active');
    return active ? active.getAttribute('data-tab') : 'file';
  }

  function getActiveUploadSource() {
    var tab = getActiveSourceTab();
    if (tab === 'youtube') return 'youtube';
    if (tab === 'dictee') return 'dictation';
    return 'file';
  }

  /* ─── YouTube validation ───────────────────────────────────── */
  function validateYouTubeUrl(url) {
    if (!url || !url.trim()) return { valid: false, error: 'Veuillez saisir une URL YouTube' };
    var trimmed = url.trim();
    var patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    var isValid = patterns.some(function (p) { return p.test(trimmed); });
    if (!isValid) return { valid: false, error: 'URL YouTube invalide. Format attendu : https://www.youtube.com/watch?v=... ou https://youtu.be/...' };
    var match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
    return { valid: true, url: trimmed, videoId: match ? match[1] : null };
  }

  function adjustHtmlContent(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('center').forEach(function (c) { c.outerHTML = c.innerHTML; });
    tmp.querySelectorAll('table').forEach(function (t) { t.style.width = '100%'; });
    return tmp.innerHTML;
  }

  function updateProgressUI(status) {
    if (!loadingAnimDiv) return;
    var oldStatus = loadingAnimDiv.querySelector('.progress-status');
    if (oldStatus) oldStatus.remove();
    if (status === 'READY_SUMMARY_PENDING') {
      var statusText = document.createElement('div');
      statusText.className = 'progress-status';
      statusText.style.cssText = 'margin-top: 12px; font-size: 14px; color: #5d2de6; text-align: center; font-weight: 500;';
      statusText.textContent = '\u2713 Transcription terminée - Génération du compte-rendu...';
      loadingAnimDiv.appendChild(statusText);
    }
  }

  /* ─── Token (aligné ent.js v1.01+) ─────────────────────────── */
  async function refreshAgiloTokenFromApi(email) {
    var em = email && String(email).trim();
    if (!em) return false;
    try {
      var response = await fetch(
        'https://api.agilotext.com/api/v1/getToken?username=' + encodeURIComponent(em) + '&edition=' + edition
      );
      var data = await response.json();
      if (data.status === 'OK' && data.token) {
        globalToken = data.token;
        try {
          window.globalToken = data.token;
        } catch (e) { /* ignore */ }
        return true;
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du token:', err);
    }
    return false;
  }

  async function ensureValidToken(email, forceRefresh) {
    if (!forceRefresh && globalToken) return true;
    var ok = await refreshAgiloTokenFromApi(email);
    if (ok) console.log(forceRefresh ? 'Token Agilotext rafraîchi (getToken)' : 'Token récupéré automatiquement');
    return ok;
  }

  /* ─── Summary UI ───────────────────────────────────────────── */
  function setSummaryUI(state) {
    if (tabsMenu) tabsMenu.style.display = '';
    if (!summaryTabLink) return;
    if (state === 'hidden') {
      if (summaryTabLink.classList.contains('w--current') && transcriptionTabLink) transcriptionTabLink.click();
      if (summaryTabLink) summaryTabLink.style.display = 'none';
      if (summaryContainer) summaryContainer.style.display = 'none';
      if (loadingSummary) loadingSummary.style.display = 'none';
      if (checkIcon) checkIcon.style.display = 'none';
      return;
    }
    summaryTabLink.style.display = '';
    if (state === 'loading') { if (loadingSummary) loadingSummary.style.display = ''; if (checkIcon) checkIcon.style.display = 'none'; }
    else if (state === 'ready') { if (loadingSummary) loadingSummary.style.display = 'none'; if (checkIcon) checkIcon.style.display = ''; if (summaryContainer) summaryContainer.style.display = ''; }
    else if (state === 'error') { if (loadingSummary) loadingSummary.style.display = 'none'; if (checkIcon) checkIcon.style.display = 'none'; }
  }

  /* ─── Submit guard ─────────────────────────────────────────── */
  function setSubmitEnabled(enabled) { if (submitBtn) submitBtn.disabled = !enabled; }
  setSubmitEnabled(false);
  if (pond) {
    pond.on('addfile', function () { setSubmitEnabled(true); });
    pond.on('removefile', function () { setSubmitEnabled(false); });
  }

  function waitPondFileReady(maxWaitMs) {
    maxWaitMs = maxWaitMs || 3000;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        var item = pond && pond.getFiles && pond.getFiles()[0];
        if (item && item.file instanceof File) return resolve(item.file);
        if (Date.now() - start > maxWaitMs) return resolve(null);
        setTimeout(check, 50);
      })();
    });
  }

  /* ─── Fetch transcript / summary (retry 1× si token expiré) ─ */
  function applyTranscriptTextUI(txt, opts) {
    var focusTranscription = !opts || opts.focusTranscription !== false;
    var ta = document.getElementById('transcriptText');
    if (ta) ta.value = txt;
    window.dispatchEvent(new CustomEvent('agilo:transcript-ready', { detail: { text: txt } }));
    if (transcriptContainer) transcriptContainer.style.display = 'block';
    if (submitBtn) submitBtn.style.display = 'none';
    if (focusTranscription && transcriptionTabLink) transcriptionTabLink.click();
  }

  async function fetchTranscriptText(jobId, email, fetchOpts) {
    if (!email) return;
    var url = function () {
      return 'https://api.agilotext.com/api/v1/receiveText?jobId=' + encodeURIComponent(jobId) + '&username=' + encodeURIComponent(email) + '&token=' + encodeURIComponent(globalToken) + '&edition=' + edition + '&format=txt';
    };
    var run = async function () {
      if (!globalToken) throw { type: 'invalidToken' };
      var r = await fetchWithTimeout(url(), { timeout: 2 * 60 * 1000 });
      return r.text();
    };
    try {
      var txt = await run();
      applyTranscriptTextUI(txt, fetchOpts);
    } catch (err) {
      if (err && err.type === 'invalidToken' && (await refreshAgiloTokenFromApi(String(email).trim()))) {
        try {
          var txt2 = await run();
          applyTranscriptTextUI(txt2, fetchOpts);
          return;
        } catch (err2) {
          console.error('receiveText (après refresh):', err2);
          showError(err2.type || 'default');
          return;
        }
      }
      console.error('receiveText:', err);
      if (err && (err.type === 'httpError' || err.type === 'serverError') && err.status === 404) return;
      showError((err && err.type) || 'default');
    }
  }

  function applySummaryTextUI(html) {
    var adjusted = adjustHtmlContent(html);
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
    var url = function () {
      return 'https://api.agilotext.com/api/v1/receiveSummary?jobId=' + encodeURIComponent(jobId) + '&username=' + encodeURIComponent(email) + '&token=' + encodeURIComponent(globalToken) + '&edition=' + edition + '&format=html';
    };
    var run = async function () {
      if (!globalToken) throw { type: 'invalidToken' };
      var r = await fetchWithTimeout(url(), { timeout: 2 * 60 * 1000 });
      return r.text();
    };
    try {
      var html = await run();
      applySummaryTextUI(html);
    } catch (err) {
      if (err && err.type === 'invalidToken' && (await refreshAgiloTokenFromApi(String(email).trim()))) {
        try {
          var html2 = await run();
          applySummaryTextUI(html2);
          return;
        } catch (err2) {
          console.error('receiveSummary (après refresh):', err2);
          showError(err2.type || 'default');
          return;
        }
      }
      console.error('receiveSummary:', err);
      if (err && (err.type === 'httpError' || err.type === 'serverError') && err.status === 404) { setSummaryUI('hidden'); return; }
      setSummaryUI('error');
      showError((err && err.type) || 'default');
    }
  }

  /* ─── Polling status ───────────────────────────────────────── */
  function checkTranscriptStatus(jobId, email) {
    if (!globalToken) { console.error('Token manquant'); return; }
    if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

    var GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000;
    var startTime = Date.now();
    var fetched = false;
    var consecutiveErrors = 0;
    var MAX_CONSECUTIVE_ERRORS = 10;
    var pollCount = 0;

    var intId = setInterval(function () {
      (async function () {
      pollCount++;
      var elapsed = Date.now() - startTime;
      if (elapsed > GLOBAL_TIMEOUT) {
        clearInterval(intId); window._agiloStatusInt = null;
        if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
        if (readyAnimDiv) readyAnimDiv.style.display = 'none';
        showError('timeout');
        alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
        return;
      }

      var tokenValid = await ensureValidToken(email, false);
      if (!tokenValid) {
        clearInterval(intId); window._agiloStatusInt = null;
        if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
        showError('invalidToken');
        alert('Le jeton d’accès Agilotext a expiré ou a été renouvelé. Rechargez la page pour continuer — vous restez connecté à votre compte.');
        return;
      }

      if (pollCount % 6 === 0) {
        console.log('⏳ Traitement en cours depuis ' + Math.floor(elapsed / 60000) + ' minute(s)...');
      }

      if (pollCount > 1 && pollCount % 120 === 0) {
        await refreshAgiloTokenFromApi(String(email).trim());
      }

      fetchWithTimeout(
          'https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=' + encodeURIComponent(jobId) + '&username=' + encodeURIComponent(email) + '&token=' + encodeURIComponent(globalToken) + '&edition=' + edition,
          { timeout: 30 * 1000 }
        )
          .then(function (r) { return r.json(); })
          .then(function (data) {
            consecutiveErrors = 0;
            updateProgressUI(data.transcriptStatus);

            switch (data.transcriptStatus) {
              case 'READY_SUMMARY_PENDING':
                if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
                if (readyAnimDiv) readyAnimDiv.style.display = 'block';
                if (summaryCheckbox && summaryCheckbox.checked) setSummaryUI('loading'); else setSummaryUI('hidden');
                if (!fetched) { fetchTranscriptText(jobId, email); fetched = true; }
                break;

              case 'READY_SUMMARY_READY':
                clearInterval(intId); window._agiloStatusInt = null;
                if (loadingAnimDiv) { loadingAnimDiv.style.display = 'none'; var ps = loadingAnimDiv.querySelector('.progress-status'); if (ps) ps.remove(); }
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
                  if (transcriptionTabLink) transcriptionTabLink.click();
                }
                break;

              case 'ON_ERROR':
              case 'READY_SUMMARY_ON_ERROR':
                clearInterval(intId); window._agiloStatusInt = null;
                if (loadingAnimDiv) { var ps2 = loadingAnimDiv.querySelector('.progress-status'); if (ps2) ps2.remove(); loadingAnimDiv.style.display = 'none'; }
                if (summaryCheckbox && summaryCheckbox.checked) setSummaryUI('error'); else setSummaryUI('hidden');
                showError('default');
                alert(data.javaException || 'Erreur inconnue');
                break;

              default:
                console.warn('Statut de transcription inattendu:', data.transcriptStatus);
            }
          })
          .catch(async function (err) {
            consecutiveErrors++;
            console.error('getTranscriptStatus (tentative ' + pollCount + ', erreurs: ' + consecutiveErrors + '/' + MAX_CONSECUTIVE_ERRORS + '):', err);
            if (err.type === 'invalidToken') {
              var renewed = await refreshAgiloTokenFromApi(email);
              if (renewed) {
                consecutiveErrors = 0;
                console.warn('Token Agilotext renouvelé pendant le suivi du job.');
                return;
              }
              clearInterval(intId); window._agiloStatusInt = null;
              if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
              showError('invalidToken');
              alert('Le jeton d’accès Agilotext a expiré ou a été renouvelé. Rechargez la page pour continuer — vous restez connecté à votre compte.');
              return;
            }
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              clearInterval(intId); window._agiloStatusInt = null;
              if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
              if (readyAnimDiv) readyAnimDiv.style.display = 'none';
              if (err.type === 'timeout') { showError('timeout'); alert('Connexion trop lente ou instable.'); }
              else if (err.type === 'offline') { showError('offline'); alert('Vous êtes hors ligne.'); }
              else if (err.type === 'serverError') { showError('default'); alert('Erreur serveur.'); }
              else { showError('unreachable'); alert('Impossible de contacter le serveur.'); }
            }
          });
      })();
    }, 5000);

    window._agiloStatusInt = intId;
    window.addEventListener('beforeunload', function cleanup() {
      if (window._agiloStatusInt === intId) { clearInterval(intId); window._agiloStatusInt = null; }
    });
  }

  /* ─── Retry helpers ────────────────────────────────────────── */
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitForOnline() {
    return new Promise(function (resolve) {
      if (navigator.onLine) return resolve();
      function on() { window.removeEventListener('online', on); resolve(); }
      window.addEventListener('online', on);
    });
  }

  async function sendWithRetry(data, max, isYouTube) {
    max = max || 3;
    var url = isYouTube ? 'https://api.agilotext.com/api/v1/sendYoutubeUrl' : 'https://api.agilotext.com/api/v1/sendMultipleAudio';
    console.log('🌐 Envoi vers: ' + url + ' (YouTube: ' + !!isYouTube + ')');

    var fetchOptions = { method: 'POST', timeout: 10 * 60 * 1000 };
    if (isYouTube) {
      var body = new URLSearchParams();
      Object.keys(data).forEach(function (key) { body.append(key, String(data[key] || '')); });
      fetchOptions.body = body.toString();
      fetchOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
    } else {
      fetchOptions.body = data;
    }

    for (var attempt = 1; attempt <= max; attempt++) {
      try {
        if (!navigator.onLine) await waitForOnline();

        var res = await fetchWithTimeout(url, fetchOptions);
        var textResponse = await res.text();
        var responseData = {};
        try { responseData = JSON.parse(textResponse); } catch (e) { console.error('Erreur parsing JSON:', e); }

        if (res.ok && responseData && responseData.status === 'OK') return responseData;

        var em = (responseData && responseData.errorMessage) || '';
        if (em.indexOf('error_invalid_token') !== -1 && attempt < max) {
          var emailForRefresh = isYouTube
            ? (data && data.username)
            : (typeof data.get === 'function' ? data.get('username') : '');
          if (emailForRefresh && (await refreshAgiloTokenFromApi(String(emailForRefresh)))) {
            if (isYouTube) data.token = globalToken;
            else if (typeof data.set === 'function') data.set('token', globalToken);
            continue;
          }
        }
        if (
          em.indexOf('error_audio_format_not_supported') !== -1 ||
          em.indexOf('error_duration_is_too_long_for_summary') !== -1 ||
          em.indexOf('error_duration_is_too_long') !== -1 ||
          em.indexOf('error_audio_file_not_found') !== -1 ||
          em.indexOf('error_invalid_token') !== -1 ||
          em.indexOf('error_too_many_hours_for_last_30_days') !== -1 ||
          em.indexOf('ERROR_CANNOT_DONWLOAD_YOUTUBE_URL') !== -1 ||
          em.indexOf('ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL') !== -1 ||
          em.indexOf('ERROR_INVALID_YOUTUBE_URL') !== -1
        ) {
          return responseData;
        }

        var retryableHttp = [408, 425, 429, 500, 502, 503, 504].indexOf(res.status) !== -1;
        var retryableApi = em === 'error_too_much_traffic';
        if ((retryableHttp || retryableApi) && attempt < max) {
          var backoff = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
          await delay(backoff);
          continue;
        }
        return responseData;
      } catch (err) {
        if (attempt < max && err && err.type === 'invalidToken') {
          var emailForRefresh2 = isYouTube
            ? (data && data.username)
            : (typeof data.get === 'function' ? data.get('username') : '');
          if (emailForRefresh2 && (await refreshAgiloTokenFromApi(String(emailForRefresh2)))) {
            if (isYouTube) data.token = globalToken;
            else if (typeof data.set === 'function') data.set('token', globalToken);
            continue;
          }
        }
        if (attempt < max && err && (err.type === 'offline' || err.type === 'timeout' || err.type === 'unreachable')) {
          if (err.type === 'offline') await waitForOnline();
          else {
            var backoff2 = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
            await delay(backoff2);
          }
          continue;
        }
        throw err;
      }
    }
  }

  /* ─── SUBMIT ───────────────────────────────────────────────── */
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAllErrors();
      if (successDiv) successDiv.style.display = 'none';
      if (form.dataset.sending === '1') return;
      form.dataset.sending = '1';

      var uploadSource = getActiveUploadSource();

      if (uploadSource === 'dictation') {
        form.dataset.sending = '0';
        alert('Pour la dictée en direct, utilisez le bouton « Stop & envoyer » dans le panneau Dictée.');
        return;
      }

      var beforeUnloadGuard = function (ev) { if (form.dataset.sending === '1') { ev.preventDefault(); ev.returnValue = ''; } };
      window.addEventListener('beforeunload', beforeUnloadGuard);

      var fd = uploadSource === 'youtube' ? new FormData() : new FormData(form);
      var email;
      if (uploadSource === 'youtube') {
        var emailInput = document.querySelector('input[name="memberEmail"]');
        email = (emailInput && (emailInput.value || emailInput.getAttribute('src') || emailInput.getAttribute('data-src'))) || '';
      } else {
        email = fd.get('memberEmail');
      }

      if (!email || !String(email).trim()) {
        showError('invalidToken'); form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
      }

      if (uploadSource === 'youtube') {
        if (!youtubeInput || !youtubeInput.value) {
          showError('youtubeInvalid'); alert('Veuillez saisir une URL YouTube');
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }
        var ytVal = validateYouTubeUrl(youtubeInput.value);
        if (!ytVal.valid) {
          showError('youtubeInvalid'); alert(ytVal.error);
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }
      } else {
        if (!pond || pond.getFiles().length === 0) {
          showError('audioNotFound');
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }
      }

      ensureValidToken(String(email).trim(), true).then(function (tokenOk) {
        if (!tokenOk || !globalToken) {
          showError('invalidToken');
          alert('Votre session a expiré ou n\'a pas pu être initialisée. Veuillez rafraîchir la page.');
          form.dataset.sending = '0'; window.removeEventListener('beforeunload', beforeUnloadGuard); return;
        }

        if (formLoadingDiv) formLoadingDiv.style.display = 'block';
        if (submitBtn) submitBtn.disabled = true;

        var speakersChecked = !!(speakersCheckbox && speakersCheckbox.checked);
        var summaryChecked = !!(summaryCheckbox && summaryCheckbox.checked);
        var formatChecked = !!(formatCheckbox && formatCheckbox.checked);
        var speakersExpected = speakersSelect ? speakersSelect.value : '';
        setSummaryUI(summaryChecked ? 'loading' : 'hidden');

        var buildAndSend;

        if (uploadSource === 'youtube') {
          var memberIdInput = document.querySelector('input[name="memberId"]');
          var deviceIdInput = document.querySelector('input[name="deviceId"]');
          var memberId = (memberIdInput && (memberIdInput.value || memberIdInput.getAttribute('src') || memberIdInput.getAttribute('data-src'))) || '';
          var validation = validateYouTubeUrl(youtubeInput.value);

          var payload = {
            token: globalToken, username: email, edition: edition,
            timestampTranscript: speakersChecked ? 'true' : 'false',
            formatTranscript: speakersChecked ? 'false' : (formatChecked ? 'true' : 'false'),
            doSummary: summaryChecked ? 'true' : 'false',
            url: validation.url,
            deviceId: (deviceIdInput && deviceIdInput.value) || window.DEVICE_ID || '',
            mailTranscription: 'true'
          };
          if (memberId) payload.memberId = memberId;
          if (speakersChecked) payload.speakersExpected = speakersExpected;
          if (translateCheckbox && translateCheckbox.checked && translateSelect) payload.translateTo = translateSelect.value;

          buildAndSend = Promise.resolve(sendWithRetry(payload, 3, true));
        } else {
          buildAndSend = waitPondFileReady(3000).then(function (file) {
            if (!(file instanceof File)) {
              showError('audioNotFound');
              alert('Le fichier n\'est pas encore prêt. Réessayez.');
              if (formLoadingDiv) formLoadingDiv.style.display = 'none';
              if (submitBtn) submitBtn.disabled = false;
              form.dataset.sending = '0';
              window.removeEventListener('beforeunload', beforeUnloadGuard);
              return null;
            }

            fd.append('token', globalToken);
            fd.append('username', email);
            fd.append('edition', edition);
            fd.append('timestampTranscript', speakersChecked ? 'true' : 'false');
            if (speakersChecked) { fd.append('speakersExpected', speakersExpected); fd.append('formatTranscript', 'false'); }
            else { fd.append('formatTranscript', formatChecked ? 'true' : 'false'); }
            fd.append('doSummary', summaryChecked ? 'true' : 'false');
            if (translateCheckbox && translateCheckbox.checked && translateSelect) fd.append('translateTo', translateSelect.value);
            fd.delete('fileToUpload'); fd.delete('audioFile');
            fd.append('fileUpload1', file, file.name);
            fd.append('deviceId', window.DEVICE_ID || '');
            fd.append('mailTranscription', 'true');
            return sendWithRetry(fd, 3, false);
          });
        }

        buildAndSend
          .then(function (data) {
            if (!data) return;
            if (formLoadingDiv) formLoadingDiv.style.display = 'none';
            if (data && data.status === 'OK') {
              showSuccess();
              var jobId = data.jobIdList && data.jobIdList[0];
              if (jobId) {
                localStorage.setItem('currentJobId', jobId);
                document.dispatchEvent(new CustomEvent('newJobIdAvailable'));
                var sessionInput = form.querySelector('input[name="agilo_record_session_id"]');
                var recordSessionId = sessionInput ? sessionInput.value : undefined;
                document.dispatchEvent(new CustomEvent('agilo-upload-confirmed', { detail: { sessionId: recordSessionId, jobId: jobId } }));
              }
              if (successDiv) successDiv.style.display = 'flex';
              if (loadingAnimDiv) loadingAnimDiv.style.display = 'block';
              checkTranscriptStatus(jobId, email);
              scrollToEl(loadingAnimDiv, -80);
            } else {
              document.dispatchEvent(new CustomEvent('agilo-upload-failed', { detail: { errorMessage: (data && data.errorMessage) || '' } }));
              var err = (data && data.errorMessage) || '';
              if (err === 'error_too_much_traffic') showError('tooMuchTraffic');
              else if (err.includes('error_account_pending_validation') || err.includes('error_limit_reached')) showError('tooMuchTraffic');
              else if (err.includes('error_duration_is_too_long_for_summary')) showError('summaryLimit');
              else if (err.includes('error_duration_is_too_long') || err.includes('error_max_duration_exceeded')) showError('audioTooLong');
              else if (err.includes('error_transcript_too_long_for_summary')) showError('summaryLimit');
              else if (err.includes('error_audio_format_not_supported') || err.includes('error_max_file_size_exceeded')) showError('audioFormat');
              else if (err.includes('error_invalid_audio_file_content') || err.includes('error_silent_audio_file')) showError('audioFormat');
              else if (err.includes('error_audio_file_not_found')) showError('audioNotFound');
              else if (err.includes('error_invalid_token')) showError('invalidToken');
              else if (err.includes('error_too_many_hours') || err.includes('error_quota_exceeded') || err.includes('error_subscription')) showError('tooManyHours');
              else if (err.includes('error_too_many_devices')) { showError('default'); alert('Trop d\'appareils utilisés pour ce compte.'); }
              else if (err.includes('error_too_many_calls')) showError('tooMuchTraffic');
              else if (err.includes('ERROR_INVALID_YOUTUBE_URL') || (err.toLowerCase().indexOf('youtube') !== -1 && err.toLowerCase().indexOf('invalid') !== -1)) showError('youtubeInvalid');
              else if (err.includes('ERROR_CANNOT_DONWLOAD_YOUTUBE_URL') || err.includes('ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL')) showError('youtubePrivate');
              else if (err.toLowerCase().indexOf('youtube') !== -1 && err.toLowerCase().indexOf('not found') !== -1) showError('youtubeNotFound');
              else { showError('default'); if (err && err.trim()) alert('Erreur: ' + err); }
            }
          })
          .catch(function (err) {
            console.error('Erreur lors de l\'envoi:', err);
            document.dispatchEvent(new CustomEvent('agilo-upload-failed', { detail: { errorMessage: (err && err.message) || '' } }));
            showError((err && err.type) || 'default');
          })
          .finally(function () {
            if (formLoadingDiv) formLoadingDiv.style.display = 'none';
            if (submitBtn) submitBtn.disabled = false;
            form.dataset.sending = '0';
            window.removeEventListener('beforeunload', beforeUnloadGuard);
          });
      }).catch(function (err) {
        console.error('ensureValidToken (submit):', err);
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        showError('default');
      });
    });
  }

  setSummaryUI('hidden');

  /* ─── Expose globals for mount-streaming.js ────────────────── */
  window.edition = edition;
  try {
    window.globalToken = globalToken;
  } catch (e) { /* ignore */ }
  window.ensureValidToken = ensureValidToken;
  window.sendWithRetry = sendWithRetry;
  window.showError = showError;
  window.checkTranscriptStatus = checkTranscriptStatus;
});
