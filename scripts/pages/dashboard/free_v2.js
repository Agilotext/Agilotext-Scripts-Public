/**
 * free_v2.js — Agilotext FREE dashboard (fichier externe)
 * Remplace le code inline du footer Webflow Free.
 * Ne pas modifier free.js (version precedente, encore live).
 */

/* ====================== Helpers réseau ====================== */
function fetchWithTimeout(url, options = {}) {
  const TIMEOUT = options.timeout || (3 * 60 * 60 * 1000); // 3 h par défaut
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);

  // Options CORS
  return fetch(url, { ...options, signal: ctrl.signal, mode: 'cors', credentials: 'omit', cache: 'no-store' })
    .then(response => {
      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) return Promise.reject({ type: 'invalidToken', status, message: 'Session expirée' });
        if (status === 429) return Promise.reject({ type: 'tooMuchTraffic', status, message: 'Trop de requêtes' });
        if (status >= 500)   return Promise.reject({ type: 'serverError', status, message: 'Erreur serveur' });
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

  /* ─── Envoi multiple : masqué en Free (réservé Pro/Business) ── */
  const multiRow = document.querySelector('.checkbox-component.multiple-audios');
  if (multiRow) multiRow.style.display = 'none';

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

  /* ---------------- Variables ---------------- */
  const edition = 'free';
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

  // Form options
  const speakersCheckbox = document.getElementById('toggle-speakers');
  const summaryCheckbox = document.getElementById('toggle-summary');
  const formatCheckbox = document.getElementById('toggle-format-transcript');
  const speakersSelect = document.getElementById('speakers-select');
  const translateCheckbox = document.getElementById('toggle-translate');
  const translateSelect = document.getElementById('translate-select');

  const youtubeInput = document.getElementById('youtube-url-input');

  /* ------------ Error mapping ------------- */
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

  /* ---------------- Helpers ---------------- */
  const hideAllErrors = () => Object.values(errorMessageDivs).forEach(d => d && (d.style.display = 'none'));

  const showError = key => {
    hideAllErrors();
    if (successDiv) successDiv.style.display = 'none';
    const target = errorMessageDivs[key] || errorMessageDivs.default;
    if (target) target.style.display = 'block';
  };

  const showSuccess = () => {
    hideAllErrors();
    if (successDiv) successDiv.style.display = 'flex';
  };

  const scrollToEl = (el, offset = 0) =>
    window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset + offset, behavior: 'smooth' });

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

  // Valider l'URL YouTube
  function validateYouTubeUrl(url) {
    if (!url || !url.trim()) return { valid: false, error: 'Veuillez saisir une URL YouTube' };
    const trimmed = url.trim();
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    const isValid = patterns.some(pattern => pattern.test(trimmed));
    if (!isValid) {
      return { valid: false, error: 'URL YouTube invalide. Format attendu : https://www.youtube.com/watch?v=... ou https://youtu.be/...' };
    }
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
    return { valid: true, url: trimmed, videoId: match ? match[1] : null };
  }

  function adjustHtmlContent(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('center').forEach(c => c.outerHTML = c.innerHTML);
    tmp.querySelectorAll('table').forEach(t => t.style.width = '100%');
    return tmp.innerHTML;
  }

  // UX OPTIMISÉE : Afficher seulement l'étape quand elle change
  function updateProgressUI(status) {
    if (!loadingAnimDiv) return;
    const oldStatus = loadingAnimDiv.querySelector('.progress-status');
    if (oldStatus) oldStatus.remove();
    if (status === 'READY_SUMMARY_PENDING') {
      const statusText = document.createElement('div');
      statusText.className = 'progress-status';
      statusText.style.cssText = 'margin-top: 12px; font-size: 14px; color: #5d2de6; text-align: center; font-weight: 500;';
      statusText.textContent = '✓ Transcription terminée - Génération du compte-rendu...';
      loadingAnimDiv.appendChild(statusText);
    }
  }

  // Fonction pour vérifier/rafraîchir le token
  async function ensureValidToken(email) {
    if (!globalToken) {
      try {
        const response = await fetch(`https://api.agilotext.com/api/v1/getToken?username=${encodeURIComponent(email)}&edition=${edition}`);
        const data = await response.json();
        if (data.status === 'OK') {
          globalToken = data.token;
          console.log('Token récupéré automatiquement');
          return true;
        }
      } catch (err) {
        console.error('Erreur lors de la récupération du token:', err);
      }
      return false;
    }
    return true;
  }

  // UI du Compte-rendu (Summary)
  function setSummaryUI(state) {
    if (tabsMenu) tabsMenu.style.display = '';
    const hide = el => { if (el) el.style.display = 'none'; };
    const show = el => { if (el) el.style.display = '';   };

    if (!summaryTabLink) return;

    if (state === 'hidden') {
      if (summaryTabLink.classList.contains('w--current') && transcriptionTabLink) {
        transcriptionTabLink.click();
      }
      hide(summaryTabLink);
      hide(summaryContainer);
      hide(loadingSummary);
      hide(checkIcon);
      return;
    }

    show(summaryTabLink);

    if (state === 'loading') {
      show(loadingSummary);
      hide(checkIcon);
    } else if (state === 'ready') {
      hide(loadingSummary);
      show(checkIcon);
      show(summaryContainer);
    } else if (state === 'error') {
      hide(loadingSummary);
      hide(checkIcon);
    }
  }

  /* ------------------- Sécurités FilePond (anti "trop vite") ------------------- */
  const setSubmitEnabled = (enabled) => { if (submitBtn) submitBtn.disabled = !enabled; };
  setSubmitEnabled(false);
  pond?.on('addfile', () => setSubmitEnabled(true));
  pond?.on('removefile', () => setSubmitEnabled(false));

  // Attend que FilePond ait vraiment un File (évite la course au 1er tick)
  async function waitPondFileReady(maxWaitMs = 3000) {
    const start = Date.now();
    while (true) {
      const item = pond?.getFiles()?.[0];
      if (item && item.file instanceof File) return item.file; // prêt
      if (Date.now() - start > maxWaitMs) return null;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  /* -------------- Fetch helpers -------------- */
  function fetchTranscriptText(jobId, email) {
    if (!globalToken) return console.error('Token manquant');

    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/receiveText?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(globalToken)}&edition=${edition}&format=txt`,
      { timeout: 2 * 60 * 1000 }
    )
      .then(r => r.text())
      .then(txt => {
        const ta = document.getElementById('transcriptText');
        if (ta) ta.value = txt;
        window.dispatchEvent(new CustomEvent('agilo:transcript-ready', { detail: { text: txt } }));
        if (transcriptContainer) transcriptContainer.style.display = 'block';
        if (submitBtn) submitBtn.style.display = 'none';
        transcriptionTabLink && transcriptionTabLink.click();
      })
      .catch(err => {
        console.error('receiveText:', err);
        if (err && err.type === 'httpError' && err.status === 404) {
          if (transcriptContainer) transcriptContainer.style.display = 'none';
          setSummaryUI('hidden');
        } else {
          showError(err.type || 'default');
        }
      });
  }

  function fetchSummaryText(jobId, email) {
    if (!globalToken) return console.error('Token manquant');

    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/receiveSummary?jobId=${encodeURIComponent(jobId)}&username=${encodeURIComponent(email)}&token=${encodeURIComponent(globalToken)}&edition=${edition}&format=html`,
      { timeout: 2 * 60 * 1000 }
    )
      .then(r => r.text())
      .then(html => {
        summaryText.innerHTML = adjustHtmlContent(html);
        setSummaryUI('ready');
        if (summaryContainer) summaryContainer.style.display = 'block';
        if (newFormBtn) newFormBtn.style.display = 'flex';
        if (newBtn) newBtn.style.display = 'flex';
        if (submitBtn) submitBtn.style.display = 'none';
        summaryTabLink && summaryTabLink.click();
        window.dispatchEvent(new Event('agilo:rehighlight'));
      })
      .catch(err => {
        console.error('receiveSummary:', err);
        if (err && err.type === 'httpError' && err.status === 404) {
          setSummaryUI('hidden');
        } else {
          setSummaryUI('error');
          showError(err.type || 'default');
        }
      });
  }

  /* -------------- Poll status -------------- */
  function checkTranscriptStatus(jobId, email) {
    if (!globalToken) return console.error('Token manquant');
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
        clearInterval(intId);
        window._agiloStatusInt = null;
        if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
        if (readyAnimDiv) readyAnimDiv.style.display = 'none';
        showError('timeout');
        alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
        return;
      }

      const tokenValid = await ensureValidToken(email);
      if (!tokenValid) {
        clearInterval(intId);
        window._agiloStatusInt = null;
        if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
        showError('invalidToken');
        alert('Votre session a expiré. Veuillez rafraîchir la page.');
        return;
      }

      if (pollCount % 6 === 0) {
        const minutes = Math.floor(elapsed / 60000);
        console.log(`⏳ Traitement en cours depuis ${minutes} minute(s)...`);
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
              if (summaryCheckbox.checked) setSummaryUI('loading'); else setSummaryUI('hidden');
              if (!fetched) {
                fetchTranscriptText(jobId, email);
                fetched = true;
              }
              break;

            case 'READY_SUMMARY_READY':
              clearInterval(intId);
              window._agiloStatusInt = null;
              if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
              if (readyAnimDiv) readyAnimDiv.style.display = 'none';
              const progressStatus = loadingAnimDiv && loadingAnimDiv.querySelector('.progress-status');
              if (progressStatus) progressStatus.remove();
              if (readyAnimDiv) readyAnimDiv.style.display = 'block';
              fetchTranscriptText(jobId, email);
              if (summaryCheckbox.checked) {
                setSummaryUI('ready');
                fetchSummaryText(jobId, email);
                summaryTabLink && summaryTabLink.click();
              } else {
                setSummaryUI('hidden');
                transcriptionTabLink && transcriptionTabLink.click();
              }
              break;

            case 'ON_ERROR':
            case 'READY_SUMMARY_ON_ERROR':
              clearInterval(intId);
              window._agiloStatusInt = null;
              if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
              const progressStatusErr = loadingAnimDiv && loadingAnimDiv.querySelector('.progress-status');
              if (progressStatusErr) progressStatusErr.remove();
              if (summaryCheckbox.checked) setSummaryUI('error'); else setSummaryUI('hidden');
              showError('default');
              alert(data.javaException || 'Erreur inconnue');
              break;

            default:
              console.warn('Statut transcript inconnu:', data.transcriptStatus);
              break;
          }
        })
        .catch(err => {
          consecutiveErrors++;
          console.error(`getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);

          if (err.type === 'invalidToken') {
            clearInterval(intId);
            window._agiloStatusInt = null;
            if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
            showError('invalidToken');
            alert('Votre session a expiré. Veuillez rafraîchir la page.');
            return;
          }

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            clearInterval(intId);
            window._agiloStatusInt = null;
            if (loadingAnimDiv) loadingAnimDiv.style.display = 'none';
            if (readyAnimDiv) readyAnimDiv.style.display = 'none';
            const progressStatusErr2 = loadingAnimDiv && loadingAnimDiv.querySelector('.progress-status');
            if (progressStatusErr2) progressStatusErr2.remove();

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
            return;
          }

          if (consecutiveErrors === 3) {
            console.warn('⚠️ Plusieurs erreurs de connexion détectées. Le processus continue...');
          }
        });
    }, 5000);

    window._agiloStatusInt = intId;

    const cleanup = () => {
      if (window._agiloStatusInt === intId) {
        clearInterval(intId);
        window._agiloStatusInt = null;
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
    const url = isYouTube
      ? 'https://api.agilotext.com/api/v1/sendYoutubeUrl'
      : 'https://api.agilotext.com/api/v1/sendMultipleAudio';

    console.log(`🌐 Envoi vers: ${url} (YouTube: ${isYouTube})`);

    const fetchOptions = { method: 'POST', timeout: 10 * 60 * 1000 };

    if (isYouTube) {
      const body = new URLSearchParams();
      Object.keys(data).forEach(key => { body.append(key, String(data[key] || '')); });
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
        try { responseData = JSON.parse(textResponse); } catch (e) { console.error('❌ Erreur parsing JSON:', e); console.error('📄 Réponse texte brute:', textResponse); }

        console.log(`📥 Réponse API (tentative ${attempt}/${max}):`, { status: res.status, ok: res.ok, data: responseData });

        if (res.ok && responseData && responseData.status === 'OK') {
          console.log('✅ Succès!');
          return responseData;
        }

        const em = (responseData && responseData.errorMessage) || '';

        // ⭐ non retryables (backend)
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
          return responseData; // retourner pour pouvoir afficher le message exact
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
        if (attempt < max && err && (err.type === 'offline' || err.type === 'timeout' || err.type === 'unreachable')) {
          if (err.type === 'offline') { await waitForOnline(); }
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

      const beforeUnloadGuard = (ev) => {
        if (form.dataset.sending === '1') { ev.preventDefault(); ev.returnValue = ''; }
      };
      window.addEventListener('beforeunload', beforeUnloadGuard);

      const uploadSource = getActiveUploadSource();
      console.log('📤 Submit - Source détectée:', uploadSource);

      const fd = uploadSource === 'youtube' ? new FormData() : new FormData(form);

      // Récupérer l'email
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
        showUpsell();
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }
      if (!pond || pond.getFiles().length === 0) {
        showError('audioNotFound');
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }

      if (!globalToken) {
        console.error('Token non disponible');
        if (submitBtn) submitBtn.disabled = false;
        if (formLoadingDiv) formLoadingDiv.style.display = 'none';
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        showError('invalidToken');
        alert('Votre session a expiré ou n\'a pas pu être initialisée. Veuillez rafraîchir la page ou vous reconnecter.');
        return;
      }

      if (formLoadingDiv) formLoadingDiv.style.display = 'block';
      if (submitBtn) submitBtn.disabled = true;

      const speakersChecked = speakersCheckbox.checked;
      const summaryChecked = summaryCheckbox.checked;
      const formatChecked = formatCheckbox.checked;
      const speakersExpected = speakersSelect.value;

      setSummaryUI(summaryChecked ? 'loading' : 'hidden');

      let payload;

      // ✅ Anti "trop vite" : attendre que FilePond retourne un File natif
      const file = await waitPondFileReady(3000);
      if (!(file instanceof File)) {
        showError('audioNotFound');
        alert('Le fichier n\u2019est pas encore pr\u00eat. R\u00e9essayez.');
        if (formLoadingDiv) formLoadingDiv.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }

      // Remplir proprement le FormData pour l'API
      fd.append('token', globalToken);
      fd.append('username', email);
      fd.append('edition', edition);
      fd.append('timestampTranscript', speakersChecked ? 'true' : 'false');
      if (speakersChecked) {
        fd.append('speakersExpected', speakersExpected || '');
        fd.append('formatTranscript', 'false');
      } else {
        fd.append('formatTranscript', formatChecked ? 'true' : 'false');
      }
      fd.append('doSummary', summaryChecked ? 'true' : 'false');
      if (translateCheckbox && translateCheckbox.checked) {
        fd.append('translateTo', translateSelect.value);
      }

      // 🧹 Nettoyage des anciens noms + mapping vers ce que l'API attend
      fd.delete('fileToUpload');
      fd.delete('audioFile');
      fd.append('fileUpload1', file, file.name);

      fd.append('deviceId', window.DEVICE_ID || '');
      fd.append('mailTranscription', 'true');
      payload = fd;

      sendWithRetry(payload, 3, false)
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

            // ⭐ Gestion COMPLÈTE des erreurs backend
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

  // ⭐ BLOCAGE YOUTUBE POUR FREE : Fonctionnalité réservée aux abonnements Pro & Business
  const TIMEOUT_TOAST = 6000;

  const toast = (msg, extra = null, ms = TIMEOUT_TOAST) => {
    const el = Object.assign(document.createElement("div"), { innerHTML: msg });
    el.style.cssText = "position:fixed;left:20px;bottom:20px;background:#111;color:#fff;padding:8px 14px;border-radius:6px;font-size:14px;z-index:999999;opacity:0;transition:opacity .25s;max-width:92vw;box-shadow:0 8px 24px rgba(0,0,0,.25)";
    if (extra) el.appendChild(extra);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = 1);
    if (ms !== Infinity) setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 350) }, ms);
    return el;
  };

  const triggerUpgrade = () => {
    const existing = document.querySelector('[data-ms-price\\:update^="prc_pro-"]') ||
                     document.querySelector('[data-ms-price\\:update*="pro"]') ||
                     document.querySelector('a[href*="pro"]') ||
                     document.querySelector('a[href*="upgrade"]');
    if (existing) { existing.click(); return; }
    toast("Veuillez passer à un abonnement Pro ou Business pour accéder à cette fonctionnalité.");
  };

  const showUpsell = () => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Passer en Pro";
    btn.style.cssText = "background:#28a745;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-weight:600";
    btn.onclick = triggerUpgrade;
    wrap.appendChild(btn);

    toast("🚫 Fonction réservée aux offres Pro & Business. Passez en Pro pour débloquer la transcription YouTube.", wrap, TIMEOUT_TOAST);
  };

  // Expose globals for mount-streaming.js (dictee en direct)
  window.ensureValidToken = ensureValidToken;
  window.sendWithRetry = sendWithRetry;
  window.checkTranscriptStatus = checkTranscriptStatus;
  window.showError = showError;
  window.edition = edition;
});
