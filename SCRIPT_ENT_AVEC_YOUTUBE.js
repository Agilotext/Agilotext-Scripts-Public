<!-- Agilotext BUSINESS – Upload & Dashboard logic (offline / timeout / unreachable ready) -->
<!-- 1) FilePond & plugins -->
<script src="https://unpkg.com/filepond@4.30.1/dist/filepond.js"></script>
<script src="https://unpkg.com/filepond-plugin-file-validate-type/dist/filepond-plugin-file-validate-type.js"></script>
<script src="https://unpkg.com/filepond-plugin-file-validate-size/dist/filepond-plugin-file-validate-size.js"></script>

<!-- 2) Helper: fetch with timeout + smart network errors -->
<script>
function fetchWithTimeout(url, options = {}) {
  const TIMEOUT = options.timeout || (3 * 60 * 60 * 1000); // 3 h par défaut
  
  if (!navigator.onLine) return Promise.reject({ type: 'offline' });
  
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  
  return fetch(url, { ...options, signal: ctrl.signal })
    .then(response => {
      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          return Promise.reject({ type: 'invalidToken', status, message: 'Session expirée' });
        } else if (status >= 500) {
          return Promise.reject({ type: 'serverError', status, message: 'Erreur serveur' });
        } else if (status === 429) {
          return Promise.reject({ type: 'tooMuchTraffic', status, message: 'Trop de requêtes' });
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
</script>

<!-- 3) Main logic -->
<script>
document.addEventListener('DOMContentLoaded', () => {
  /* ---------------- FilePond init ---------------- */
  FilePond.registerPlugin(FilePondPluginFileValidateSize, FilePondPluginFileValidateType);
  document.querySelectorAll('form[ms-code-file-upload="form"]').forEach(f => f.setAttribute('enctype', 'multipart/form-data'));
  const inputEl = document.querySelector('input[name="fileToUpload"]');
  if (inputEl) {
    FilePond.create(inputEl, {
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
  const edition = 'ent';
  const form                 = document.querySelector('form[ms-code-file-upload="form"]');
  const successDiv           = document.getElementById('form_success');
  const formLoadingDiv       = document.getElementById('form_loading');
  const loadingAnimDiv       = document.getElementById('loading_animation');
  const readyAnimDiv         = document.getElementById('ready_animation');
  const transcriptContainer  = document.getElementById('tabs-container');
  const summaryContainer     = document.getElementById('summaryTextContainer');
  const submitBtn            = document.getElementById('submit-button');
  const loadingSummary       = document.getElementById('loading-summary');
  const checkIcon            = document.getElementById('check-icon');
  const summaryText          = document.getElementById('summaryText');
  const newFormBtn           = document.getElementById('newForm');
  const newBtn               = document.getElementById('newButton');

  // Tabs
  const summaryTabLink       = document.querySelector('[data-w-tab="Summary"]');
  const transcriptionTabLink = document.querySelector('[data-w-tab="Transcription"]');
  const tabsMenu             = (summaryTabLink && summaryTabLink.closest('.w-tab-menu')) || document.querySelector('.w-tab-menu');

  // Form options
  const speakersCheckbox     = document.getElementById('toggle-speakers');
  const summaryCheckbox      = document.getElementById('toggle-summary');
  const formatCheckbox       = document.getElementById('toggle-format-transcript');
  const speakersSelect       = document.getElementById('speakers-select');
  const translateCheckbox    = document.getElementById('toggle-translate');
  const translateSelect      = document.getElementById('translate-select');

  // ⭐ YOUTUBE : Variables pour YouTube
  const fileTabLink          = document.querySelector('[data-w-tab="File"]');
  const youtubeTabLink       = document.querySelector('[data-w-tab="YouTube"]');
  const youtubeInput         = document.getElementById('youtube-url-input');
  const youtubeContainer     = document.querySelector('.youtube-input-container');
  const youtubeToggleLink    = document.querySelector('.youtube-toggle-link');

  /* ------------ Error mapping ------------- */
  const errorMessageDivs = {
    default:      document.getElementById('form_error'),
    tooMuchTraffic:document.getElementById('form_limitation'),
    audioTooLong: document.getElementById('form_audio-too_long'),
    audioFormat:  document.getElementById('form_error_audio_format'),
    audioNotFound:document.getElementById('form_error_audio_not_found'),
    invalidToken: document.getElementById('form_error_invalid_token'),
    invalidAudioContent: document.getElementById('form_error'),
    summaryLimit: document.getElementById('form_error_summary_limit'),
    offline:      document.getElementById('form_error_offline'),
    timeout:      document.getElementById('form_error_timeout'),
    tooManyHours: document.getElementById('form_error_too_many_hours'),
    unreachable:  document.getElementById('form_error_unreachable'),
    // ⭐ YOUTUBE : Erreurs spécifiques YouTube
    youtubeInvalid: document.getElementById('form_error'),
    youtubePrivate: document.getElementById('form_error'),
    youtubeNotFound: document.getElementById('form_error'),
  };

  /* ---------------- Helpers ---------------- */
  const hideAllErrors = () => Object.values(errorMessageDivs).forEach(d => d && (d.style.display='none'));
  const showError = key => {
    hideAllErrors();
    if (successDiv) successDiv.style.display = 'none';
    if (errorMessageDivs[key]) errorMessageDivs[key].style.display='block';
  };
  const showSuccess = () => {
    hideAllErrors();
    if (successDiv) successDiv.style.display = 'flex';
  };
  const scrollToEl = (el, offset=0) => window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset + offset, behavior:'smooth'});

  function adjustHtmlContent(html){
    const tmp=document.createElement('div'); tmp.innerHTML=html;
    tmp.querySelectorAll('center').forEach(c=>c.outerHTML=c.innerHTML);
    tmp.querySelectorAll('table').forEach(t=>t.style.width='100%');
    return tmp.innerHTML;
  }

  // ⭐ YOUTUBE : Détecter la source active (Fichier ou YouTube)
  function getActiveUploadSource() {
    // Si onglets présents, utiliser la logique des onglets
    if (fileTabLink && fileTabLink.classList.contains('w--current')) return 'file';
    if (youtubeTabLink && youtubeTabLink.classList.contains('w--current')) return 'youtube';
    
    // Sinon, détection automatique selon ce qui est rempli
    // Priorité : si input YouTube a une valeur, utiliser YouTube
    if (youtubeInput && youtubeInput.value && youtubeInput.value.trim()) {
      return 'youtube';
    }
    
    // Sinon, vérifier si un fichier est présent dans FilePond
    const pond = FilePond.find(inputEl);
    if (pond && pond.getFiles().length > 0) {
      return 'file';
    }
    
    // Par défaut, mode fichier (comportement existant)
    return 'file';
  }

  // ⭐ YOUTUBE : Valider l'URL YouTube
  function validateYouTubeUrl(url) {
    if (!url || !url.trim()) return { valid: false, error: 'Veuillez saisir une URL YouTube' };
    
    const trimmed = url.trim();
    // Patterns YouTube acceptés
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];
    
    const isValid = patterns.some(pattern => pattern.test(trimmed));
    if (!isValid) {
      return { valid: false, error: 'URL YouTube invalide. Format attendu : https://www.youtube.com/watch?v=... ou https://youtu.be/...' };
    }
    
    // Extraire l'ID de la vidéo
    let videoId = null;
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
    if (match) videoId = match[1];
    
    return { valid: true, url: trimmed, videoId };
  }

  // --- UI du Compte-rendu (Summary) ---
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

  /* -------------- Fetch helpers -------------- */
  function fetchTranscriptText(jobId,email){
    if(!globalToken) return console.error('Token manquant');
    
    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/receiveText?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=txt`,
      { timeout: 2 * 60 * 1000 }
    )
      .then(r=>{
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.text();
      })
      .then(txt=>{
        const ta = document.getElementById('transcriptText');
        if (ta) ta.value = txt;
        window.dispatchEvent(new CustomEvent('agilo:transcript-ready', { detail:{ text: txt }}));
        transcriptContainer.style.display='block';
        submitBtn.style.display='none';
        transcriptionTabLink && transcriptionTabLink.click();
      })
      .catch(err=>{ 
        console.error('receiveText:',err); 
        showError(err.type||'default'); 
      });
  }

  function fetchSummaryText(jobId,email){
    if(!globalToken) return console.error('Token manquant');
    
    fetchWithTimeout(
      `https://api.agilotext.com/api/v1/receiveSummary?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}&format=html`,
      { timeout: 2 * 60 * 1000 }
    )
      .then(r=>{
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.text();
      })
      .then(html=>{
        summaryText.innerHTML = adjustHtmlContent(html);
        setSummaryUI('ready');
        summaryContainer.style.display='block';
        newFormBtn.style.display = newBtn.style.display = 'flex';
        submitBtn.style.display='none';
        summaryTabLink && summaryTabLink.click();
        window.dispatchEvent(new Event('agilo:rehighlight'));
      })
      .catch(err=>{ 
        console.error('receiveSummary:',err); 
        showError(err.type||'default'); 
      });
  }

  /* -------------- Poll status -------------- */
  function checkTranscriptStatus(jobId,email){
    if(!globalToken) return console.error('Token manquant');
    if (window._agiloStatusInt) clearInterval(window._agiloStatusInt);

    const GLOBAL_TIMEOUT = 2 * 60 * 60 * 1000;
    const startTime = Date.now();
    let fetched=false;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;
    let pollCount = 0;

    const intId=setInterval(()=>{
      pollCount++;
      
      const elapsed = Date.now() - startTime;
      if (elapsed > GLOBAL_TIMEOUT) {
        clearInterval(intId);
        window._agiloStatusInt = null;
        loadingAnimDiv.style.display='none';
        readyAnimDiv.style.display='none';
        showError('timeout');
        alert('Le traitement prend plus de temps que prévu (plus de 2 heures). Veuillez réessayer plus tard ou contacter le support si le problème persiste.');
        return;
      }

      if (pollCount % 6 === 0) {
        const minutes = Math.floor(elapsed / 60000);
        console.log(`⏳ Traitement en cours depuis ${minutes} minute(s)...`);
      }

      fetchWithTimeout(
        `https://api.agilotext.com/api/v1/getTranscriptStatus?jobId=${jobId}&username=${email}&token=${globalToken}&edition=${edition}`,
        { timeout: 30 * 1000 }
      )
        .then(r=>{
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}`);
          }
          return r.json();
        })
        .then(data=>{
          consecutiveErrors = 0;
          
          switch(data.transcriptStatus){
            case 'READY_SUMMARY_PENDING':
              loadingAnimDiv.style.display='none';
              readyAnimDiv.style.display='block';
              if (summaryCheckbox.checked) setSummaryUI('loading'); else setSummaryUI('hidden');
              if(!fetched){ fetchTranscriptText(jobId,email); fetched=true; }
              break;

            case 'READY_SUMMARY_READY':
              clearInterval(intId);
              window._agiloStatusInt = null;
              loadingAnimDiv.style.display='none';
              readyAnimDiv.style.display='block';
              fetchTranscriptText(jobId,email);
              if (summaryCheckbox.checked) {
                setSummaryUI('ready');
                fetchSummaryText(jobId,email);
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
              loadingAnimDiv.style.display='none';
              if (summaryCheckbox.checked) setSummaryUI('error'); else setSummaryUI('hidden');
              showError('default');
              alert(data.javaException||'Erreur inconnue');
              break;
          }
        })
        .catch(err=>{
          consecutiveErrors++;
          console.error(`getTranscriptStatus (tentative ${pollCount}, erreurs: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);
          
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            clearInterval(intId);
            window._agiloStatusInt = null;
            loadingAnimDiv.style.display='none';
            readyAnimDiv.style.display='none';
            
            if (err.type === 'timeout') {
              showError('timeout');
              alert('Connexion trop lente ou instable. Le traitement a été interrompu après plusieurs tentatives échouées. Veuillez vérifier votre connexion internet et réessayer.');
            } else if (err.type === 'offline') {
              showError('offline');
              alert('Vous êtes hors ligne. Veuillez vérifier votre connexion internet.');
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
    },5000);

    window._agiloStatusInt = intId;
  }

  /* -------------- Retry helpers -------------- */
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const waitForOnline = () => new Promise(resolve => {
    if (navigator.onLine) return resolve();
    const on = () => { window.removeEventListener('online', on); resolve(); };
    window.addEventListener('online', on);
  });

  async function sendWithRetry(fd, max = 3) {
    const url = 'https://api.agilotext.com/api/v1/sendMultipleAudio';
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        if (!navigator.onLine) await waitForOnline();

        const res = await fetchWithTimeout(url, { method: 'POST', body: fd, timeout: 10 * 60 * 1000 });
        let data = {};
        try { data = await res.json(); } catch (_) {}

        if (res.ok && data && data.status === 'OK') return data;

        const em = (data && data.errorMessage) || '';
        if (
          em.includes('error_audio_format_not_supported') ||
          em.includes('error_duration_is_too_long_for_summary') ||
          em.includes('error_duration_is_too_long') ||
          em.includes('error_audio_file_not_found') ||
          em.includes('error_invalid_token') ||
          em.includes('error_too_many_hours_for_last_30_days')
        ) {
          return data;
        }

        const retryableHttp = [408, 425, 429, 500, 502, 503, 504].includes(res.status);
        const retryableApi  = em === 'error_too_much_traffic';
        if ((retryableHttp || retryableApi) && attempt < max) {
          const backoff = Math.min(12000, 1200 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
          await delay(backoff);
          continue;
        }
        return data;

      } catch (err) {
        if (attempt < max && err && (err.type === 'offline' || err.type === 'timeout' || err.type === 'unreachable')) {
          if (err.type === 'offline') {
            await waitForOnline();
          } else {
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
  form.addEventListener('submit', e => {
    e.preventDefault();
    hideAllErrors();
    if (successDiv) successDiv.style.display='none';

    if (form.dataset.sending === '1') return;
    form.dataset.sending = '1';
    const beforeUnloadGuard = (ev)=>{ if (form.dataset.sending === '1') { ev.preventDefault(); ev.returnValue=''; } };
    window.addEventListener('beforeunload', beforeUnloadGuard);

    // ⭐ YOUTUBE : Détecter la source (fichier ou YouTube)
    const uploadSource = getActiveUploadSource();
    const fd=new FormData(form);
    const email=fd.get('memberEmail');

    // ⭐ YOUTUBE : Validation selon la source
    if (uploadSource === 'youtube') {
      // Mode YouTube : valider l'URL
      if (!youtubeInput || !youtubeInput.value) {
        showError('youtubeInvalid');
        alert('Veuillez saisir une URL YouTube');
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }
      
      const validation = validateYouTubeUrl(youtubeInput.value);
      if (!validation.valid) {
        showError('youtubeInvalid');
        alert(validation.error);
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }
    } else {
      // Mode Fichier : vérifier qu'un fichier est présent
      const pond = FilePond.find(inputEl);
      if (!pond || pond.getFiles().length === 0) {
        showError('audioNotFound');
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
        return;
      }
    }

    if(!globalToken){
      console.error('Token non disponible');
      submitBtn.disabled=false;
      formLoadingDiv.style.display='none';
      form.dataset.sending = '0';
      window.removeEventListener('beforeunload', beforeUnloadGuard);
      return;
    }

    formLoadingDiv.style.display='block';
    submitBtn.disabled=true;

    const speakersChecked=speakersCheckbox.checked;
    const summaryChecked=summaryCheckbox.checked;
    const formatChecked =formatCheckbox.checked;
    const speakersExpected=speakersSelect.value;

    setSummaryUI(summaryChecked ? 'loading' : 'hidden');

    fd.append('token',globalToken);
    fd.append('username',email);
    fd.append('edition',edition);
    fd.append('timestampTranscript', speakersChecked?'true':'false');
    if(speakersChecked){
      fd.append('speakersExpected',speakersExpected);
      fd.append('formatTranscript','false');
    } else {
      fd.append('formatTranscript',formatChecked?'true':'false');
    }
    fd.append('doSummary', summaryChecked?'true':'false');

    if (translateCheckbox && translateCheckbox.checked) {
      fd.append('translateTo', translateSelect.value);
    }

    // ⭐ YOUTUBE : Ajouter la source (fichier ou YouTube)
    if (uploadSource === 'youtube') {
      const validation = validateYouTubeUrl(youtubeInput.value);
      fd.append('youtubeUrl', validation.url);
    } else {
      fd.append('fileUpload1',fd.get('audioFile')); fd.delete('audioFile');
    }
    
    fd.append('deviceId', window.DEVICE_ID || '');
    fd.append('mailTranscription','true');

    sendWithRetry(fd)
      .then(data=>{
        formLoadingDiv.style.display='none';
        if(data.status==='OK'){
          showSuccess();
          const jobId=data.jobIdList[0];
          localStorage.setItem('currentJobId',jobId);
          document.dispatchEvent(new CustomEvent('newJobIdAvailable'));
          successDiv.style.display='flex';
          loadingAnimDiv.style.display='block';
          checkTranscriptStatus(jobId,email);
          scrollToEl(loadingAnimDiv,-80);
        } else {
          const err=data.errorMessage||'';
          if(err==='error_too_much_traffic')                               showError('tooMuchTraffic');
          else if(err.includes('error_duration_is_too_long_for_summary'))  showError('summaryLimit');
          else if(err.includes('error_duration_is_too_long'))              showError('audioTooLong');
          else if(err.includes('error_audio_format_not_supported'))        showError('audioFormat');
          else if(err.includes('error_audio_file_not_found'))              showError('audioNotFound');
          else if(err.includes('error_invalid_token'))                     showError('invalidToken');
          else if(err.includes('error_too_many_hours_for_last_30_days'))   showError('tooManyHours');
          // ⭐ YOUTUBE : Gestion des erreurs YouTube
          else if(err.includes('youtube') && err.includes('invalid'))      showError('youtubeInvalid');
          else if(err.includes('youtube') && err.includes('private'))    showError('youtubePrivate');
          else if(err.includes('youtube') && err.includes('not found'))    showError('youtubeNotFound');
          else                                                             showError('default');
        }
      })
      .catch(err=>{
        console.error('sendMultipleAudio:',err);
        showError(err.type||'default');
      })
      .finally(()=>{
        formLoadingDiv.style.display='none';
        submitBtn.disabled=false;
        form.dataset.sending = '0';
        window.removeEventListener('beforeunload', beforeUnloadGuard);
      });
  });

  setSummaryUI('hidden');

  // ⭐ YOUTUBE : Gérer l'ouverture/fermeture du container YouTube
  if (youtubeToggleLink && youtubeContainer) {
    youtubeToggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const isVisible = youtubeContainer.classList.contains('is-visible');
      
      if (isVisible) {
        youtubeContainer.classList.remove('is-visible');
        youtubeToggleLink.classList.remove('is-open');
      } else {
        youtubeContainer.classList.add('is-visible');
        youtubeToggleLink.classList.add('is-open');
        // Focus sur l'input après l'ouverture
        setTimeout(() => {
          if (youtubeInput) youtubeInput.focus();
        }, 200);
      }
    });
  }
});
</script>

