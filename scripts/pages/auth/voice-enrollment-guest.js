/* ================================================================
   DEPRECATED — flux invité géré par le backend (speakerVoiceInvite).
   Ne pas déployer. Page Webflow /auth/voice-guest à retirer du plan.
   ================================================================
   AGILOTEXT - VOICE ENROLLMENT GUEST
   Page : /auth/voice-guest
   URLs :
     - Production : https://www.agilotext.com/auth/voice-guest
     - Staging    : https://agilotext-test.webflow.io/auth/voice-guest
   Déploiement Webflow :
     1. Embed : <div id="agilo-voice-guest"></div>
     2. Ce script dans Before </body> de la page
   Flux : un admin partage un lien ?guestToken=XXX ; le participant
   enregistre sa voix sans compte Agilotext (voix sur le compte admin).
   ================================================================ */

(function () {
  'use strict';

  function isVoiceGuestPage() {
    var path = window.location.pathname || '';
    return /^\/auth\/voice-guest\/?$/.test(path);
  }

  if (!isVoiceGuestPage()) return;
  if (window.__agiloVoiceGuestInit) return;
  window.__agiloVoiceGuestInit = true;

  const AGILO_VOICE_CONFIG = {
    containerId: 'agilo-voice-guest'
  };

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const MIN_RECORD_SEC = 10;
  const MAX_RECORD_SEC = 30;
  const RESERVED_LABELS = new Set(['S1', 'S2', 'UU']);

  const MIC_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/><path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const AGILO_RADIUS = 'var(--0-5_radius,0.5rem)';

  const ERROR_MESSAGES = {
    error_invalid_speaker_label: 'Le prénom est invalide ou vide. Saisissez votre prénom.',
    error_reserved_speaker_label: 'Ce nom est réservé. Utilisez votre prénom (pas S1, S2 ou UU).',
    error_voice_file_not_found: 'Aucun fichier audio trouvé. Choisissez un fichier ou recommencez l\'enregistrement.',
    error_speaker_identifier_not_found: 'Voix non identifiable. Parlez plus distinctement et plus près du micro.',
    error_multiple_speakers_in_voice_enrollment: 'Plusieurs voix détectées. Enregistrez-vous seul(e), dans un endroit calme.'
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseEmbeddedApiError(raw) {
    var text = String(raw || '');
    var jsonMatch = text.match(/\{[\s\S]*\}\s*$/);
    if (!jsonMatch) return text;
    try {
      var parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) return String(parsed.error);
      if (parsed.message) return String(parsed.message);
    } catch (e) { /* ignore */ }
    return text;
  }

  function matchVoiceErrorMessage(text) {
    var t = String(text || '').toLowerCase();
    if (!t) return '';

    if (t.indexOf('invalid audio') !== -1 || t.indexOf('job rejected') !== -1) {
      return 'Votre enregistrement n\'a pas pu être analysé. Essayez d\'importer un fichier MP3 ou WAV de 15 secondes minimum.';
    }
    if (t.indexOf('no spoken audio') !== -1 || t.indexOf('silent') !== -1 || t.indexOf('silenc') !== -1) {
      return 'Aucune voix détectée. Vérifiez votre micro et parlez plus fort, plus près, pendant au moins 10 secondes.';
    }
    if (t.indexOf('too short') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('short') !== -1)) {
      return 'Enregistrement trop court. Parlez au moins 10 secondes avant d\'arrêter.';
    }
    if (t.indexOf('multiple speakers') !== -1 || t.indexOf('error_multiple_speakers') !== -1) {
      return ERROR_MESSAGES.error_multiple_speakers_in_voice_enrollment;
    }
    if (t.indexOf('speaker identifier not found') !== -1 || t.indexOf('error_speaker_identifier_not_found') !== -1) {
      return ERROR_MESSAGES.error_speaker_identifier_not_found;
    }
    if (t.indexOf('invalid_speaker_label') !== -1 || t.indexOf('error_invalid_speaker_label') !== -1) {
      return ERROR_MESSAGES.error_invalid_speaker_label;
    }
    if (t.indexOf('reserved_speaker') !== -1 || t.indexOf('error_reserved_speaker_label') !== -1) {
      return ERROR_MESSAGES.error_reserved_speaker_label;
    }
    if (t.indexOf('voice_file_not_found') !== -1 || t.indexOf('error_voice_file_not_found') !== -1) {
      return ERROR_MESSAGES.error_voice_file_not_found;
    }
    if (t.indexOf('guest') !== -1 && (t.indexOf('expired') !== -1 || t.indexOf('invalid') !== -1)) {
      return 'Ce lien n\'est plus valide ou a expiré. Demandez un nouveau lien à la personne qui vous a invité(e).';
    }
    if (t.indexOf('speechmatics') !== -1 || t.indexOf('enrollment job') !== -1) {
      return 'L\'enregistrement vocal n\'a pas été accepté. Parlez clairement pendant 10 à 30 secondes dans un endroit calme, puis réessayez.';
    }
    return '';
  }

  function isTechnicalErrorMessage(msg) {
    var t = String(msg || '');
    return /speechmatics|http\s*\d{3}|^\s*\{|"\s*code\s*"\s*:|exception/i.test(t);
  }

  function logVoiceApiError(tag, data) {
    console.warn(tag, {
      status: data && data.status,
      exceptionName: data && data.exceptionName,
      errorMessage: data && data.errorMessage,
      message: data && data.message,
      enrolled: data && data.enrolled
    });
  }

  function formatApiError(data, fallback) {
    if (!data) return fallback || 'Une erreur est survenue.';

    var raw = data.errorMessage || data.message || data.error || '';
    if (typeof raw !== 'string') raw = String(raw);

    var i;
    for (i = 0; i < Object.keys(ERROR_MESSAGES).length; i++) {
      var code = Object.keys(ERROR_MESSAGES)[i];
      if (raw.indexOf(code) !== -1 || data.exceptionName === code) {
        return ERROR_MESSAGES[code];
      }
    }

    var inner = parseEmbeddedApiError(raw);
    var matched = matchVoiceErrorMessage(inner) || matchVoiceErrorMessage(raw);
    if (matched) return matched;

    if (isTechnicalErrorMessage(raw)) {
      return fallback || 'Impossible d\'enregistrer votre voix. Réessayez avec un enregistrement plus long et plus clair.';
    }

    if (data.status === 'KO' && !raw) return fallback || 'Une erreur est survenue.';
    if (raw && raw.length <= 140 && !/[{}\[\]]/.test(raw)) return raw;

    return fallback || 'Une erreur est survenue.';
  }

  function isInvalidAudioApiError(data) {
    if (!data) return false;
    var raw = String(data.errorMessage || data.message || data.error || '');
    var inner = parseEmbeddedApiError(raw);
    var t = (raw + ' ' + inner).toLowerCase();
    return t.indexOf('invalid audio') !== -1 || t.indexOf('job rejected') !== -1;
  }

  function getEnrollmentFileName(mimeType) {
    var mime = String(mimeType || '');
    if (mime.indexOf('mp4') !== -1) return 'voice-enrollment.mp4';
    if (mime.indexOf('ogg') !== -1) return 'voice-enrollment.ogg';
    return 'voice-enrollment.webm';
  }

  function getGuestTokenFromUrl() {
    var params = new URLSearchParams(window.location.search || '');
    return String(params.get('guestToken') || params.get('token') || '').trim();
  }

  function injectStyles() {
    if (document.getElementById('agilo-voice-guest-styles')) return;
    var style = document.createElement('style');
    style.id = 'agilo-voice-guest-styles';
    style.textContent = [
      '@keyframes agilo-voice-pulse{0%{transform:scale(.92);opacity:.55}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}',
      '.agilo-voice-guest-wrap{max-width:520px;width:100%;margin:0 auto;font-family:inherit;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-guest-card{background:var(--color--blanc_gris,#f8f9fa);border:1px solid rgba(82,82,82,.12);border-radius:' + AGILO_RADIUS + ';padding:24px 20px}',
      '.agilo-voice-guest-title{margin:0 0 6px;font-size:1.35rem;font-weight:600;text-align:center;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-guest-sub{margin:0 0 1.25rem;text-align:center;color:var(--color--gris,#525252);line-height:1.5;font-size:.95rem}',
      '.agilo-voice-guest-hero{position:relative;display:flex;align-items:center;justify-content:center;width:112px;height:112px;margin:0 auto 1.25rem}',
      '.agilo-voice-guest-hero-ring{position:absolute;inset:0;border-radius:50%;background:rgba(23,74,150,.1);border:1px solid rgba(23,74,150,.18);transition:background .25s,border-color .25s}',
      '.agilo-voice-guest-hero.is-recording .agilo-voice-guest-hero-ring{background:rgba(168,38,51,.1);border-color:rgba(168,38,51,.25)}',
      '.agilo-voice-guest-hero.is-preview .agilo-voice-guest-hero-ring{background:rgba(28,102,26,.1);border-color:rgba(28,102,26,.22)}',
      '.agilo-voice-guest-hero.is-success .agilo-voice-guest-hero-ring{background:rgba(28,102,26,.1);border-color:rgba(28,102,26,.22)}',
      '.agilo-voice-guest-hero-icon{position:relative;z-index:2;width:44px;height:44px;color:var(--color--blue,#174a96)}',
      '.agilo-voice-guest-hero.is-recording .agilo-voice-guest-hero-icon{color:var(--color--rouge,#a82633)}',
      '.agilo-voice-guest-hero.is-preview .agilo-voice-guest-hero-icon,.agilo-voice-guest-hero.is-success .agilo-voice-guest-hero-icon{color:var(--color--vert,#1c661a)}',
      '.agilo-voice-guest-waves{position:absolute;inset:0;pointer-events:none}',
      '.agilo-voice-guest-wave{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(168,38,51,.35);animation:agilo-voice-pulse 2s ease-out infinite}',
      '.agilo-voice-guest-wave:nth-child(2){animation-delay:.55s}',
      '.agilo-voice-guest-wave:nth-child(3){animation-delay:1.1s}',
      '.agilo-voice-guest-record-area{display:flex;flex-direction:column;align-items:stretch;gap:.75rem}',
      '.agilo-voice-guest-label{display:block;margin:0;font-size:.9rem;font-weight:500;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-guest-input{width:100%;box-sizing:border-box;margin:0;border:1px solid var(--color--noir_25,rgba(82,82,82,.25));border-radius:' + AGILO_RADIUS + ';background:var(--color--white,#fff);padding:10px 12px;font:inherit;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-guest-input:focus{outline:none;border-color:var(--color--blue,#174a96);box-shadow:0 0 0 2px rgba(23,74,150,.12)}',
      '.agilo-voice-guest-record-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:52px;padding:.75rem 1.25rem;border:none;border-radius:' + AGILO_RADIUS + ';background:var(--color--blue,#174a96);color:var(--color--white,#fff);font:inherit;font-weight:600;font-size:.95rem;cursor:pointer;transition:background .2s,filter .15s}',
      '.agilo-voice-guest-record-btn:hover:not(:disabled){filter:brightness(1.05)}',
      '.agilo-voice-guest-record-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.agilo-voice-guest-record-btn.is-recording{background:var(--color--rouge,#a82633)}',
      '.agilo-voice-guest-record-btn-icon{display:inline-flex;width:18px;height:18px}',
      '.agilo-voice-guest-bar-row{display:none;flex-direction:column;gap:.35rem}',
      '.agilo-voice-guest-bar-row.is-visible{display:flex}',
      '.agilo-voice-guest-timer{font-size:.85rem;font-weight:600;color:var(--color--gris,#525252);text-align:center}',
      '.agilo-voice-guest-progress{height:5px;background:rgba(82,82,82,.15);border-radius:999px;overflow:hidden}',
      '.agilo-voice-guest-progress-bar{height:100%;width:0;background:var(--color--blue,#174a96);transition:width .1s linear}',
      '.agilo-voice-guest-hero.is-recording~.agilo-voice-guest-record-area .agilo-voice-guest-progress-bar{background:var(--color--rouge,#a82633)}',
      '.agilo-voice-guest-hint{font-size:.85rem;color:var(--color--gris,#525252);margin:0;text-align:center;line-height:1.45}',
      '.agilo-voice-guest-audio{width:100%;margin:0}',
      '.agilo-voice-guest-file-link{display:block;margin:.5rem auto 0;text-align:center;font-size:.85rem;color:var(--color--blue,#174a96);text-decoration:underline;cursor:pointer}',
      '.agilo-voice-guest-file-panel{display:none;margin-top:.5rem}',
      '.agilo-voice-guest-file-panel.is-open{display:block}',
      '.agilo-voice-guest-file{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--color--noir_25,rgba(82,82,82,.25));border-radius:' + AGILO_RADIUS + ';background:var(--color--white,#fff)}',
      '.agilo-voice-guest-actions{margin-top:1rem;display:flex;flex-direction:column;align-items:stretch;gap:.75rem}',
      '.agilo-voice-guest-btn-submit{display:none;width:100%}',
      '.agilo-voice-guest-btn-submit.is-visible{display:inline-block}',
      '.agilo-voice-guest-status{margin-top:.5rem;padding:10px 12px;border-radius:' + AGILO_RADIUS + ';font-size:.9rem;display:none}',
      '.agilo-voice-guest-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '.agilo-voice-guest-status.is-success{display:block;background:rgba(28,102,26,.1);color:var(--color--vert,#1c661a)}',
      '.agilo-voice-guest-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '.agilo-voice-guest-error-card{text-align:center;padding:1rem 0}',
      '.agilo-voice-guest-success-msg{text-align:center;color:var(--color--vert,#1c661a);font-weight:600;margin:0 0 .5rem}'
    ].join('');
    document.head.appendChild(style);
  }

  function getSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return 'audio/webm';
    }
    var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return 'audio/webm';
  }

  function buildErrorMarkup(message) {
    return [
      '<div class="agilo-voice-guest-wrap">',
      '  <div class="agilo-voice-guest-card">',
      '    <div class="agilo-voice-guest-error-card">',
      '      <h1 class="agilo-voice-guest-title">Lien invalide</h1>',
      '      <p class="agilo-voice-guest-sub">' + escapeHtml(message) + '</p>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildSuccessMarkup(label) {
    return [
      '<div class="agilo-voice-guest-wrap">',
      '  <div class="agilo-voice-guest-card">',
      '    <div class="agilo-voice-guest-hero is-success">',
      '      <div class="agilo-voice-guest-hero-ring"></div>',
      '      <div>' + CHECK_SVG.replace('agilo-voice-hero-icon', 'agilo-voice-guest-hero-icon') + '</div>',
      '    </div>',
      '    <p class="agilo-voice-guest-success-msg">Voix enregistrée — ' + escapeHtml(label) + '</p>',
      '    <p class="agilo-voice-guest-sub">Merci ! Votre voix sera reconnue automatiquement dans les transcriptions de l\'équipe. Vous pouvez fermer cette page.</p>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildFormMarkup() {
    return [
      '<div class="agilo-voice-guest-wrap">',
      '  <div class="agilo-voice-guest-card">',
      '    <h1 class="agilo-voice-guest-title">Enregistrer votre voix</h1>',
      '    <p class="agilo-voice-guest-sub">Vous avez été invité(e) à enregistrer votre empreinte vocale pour être reconnu(e) dans les transcriptions. Aucun compte Agilotext n\'est nécessaire.</p>',
      '    <div class="agilo-voice-guest-hero is-idle" id="agilo-voice-guest-hero">',
      '      <div class="agilo-voice-guest-waves" id="agilo-voice-guest-waves" style="display:none" aria-hidden="true">',
      '        <span class="agilo-voice-guest-wave"></span>',
      '        <span class="agilo-voice-guest-wave"></span>',
      '        <span class="agilo-voice-guest-wave"></span>',
      '      </div>',
      '      <div class="agilo-voice-guest-hero-ring"></div>',
      '      <div id="agilo-voice-guest-hero-icon">' + MIC_SVG.replace('agilo-voice-hero-icon', 'agilo-voice-guest-hero-icon') + '</div>',
      '    </div>',
      '    <div class="agilo-voice-guest-record-area">',
      '      <label class="agilo-voice-guest-label" for="agilo-voice-guest-speaker-label">Votre prénom dans les transcriptions</label>',
      '      <input class="agilo-voice-guest-input select-input input-field w-input" id="agilo-voice-guest-speaker-label" type="text" maxlength="80" placeholder="Ex. Gilles">',
      '      <button type="button" class="agilo-voice-guest-record-btn button-wp2024 next w-button" id="agilo-voice-guest-record-btn">',
      '        <span class="agilo-voice-guest-record-btn-icon" id="agilo-voice-guest-record-btn-icon" aria-hidden="true">',
      '          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="12" cy="12" r="6"/></svg>',
      '        </span>',
      '        <span id="agilo-voice-guest-record-btn-label">Démarrer l\'enregistrement</span>',
      '      </button>',
      '      <div class="agilo-voice-guest-bar-row" id="agilo-voice-guest-bar-row">',
      '        <div class="agilo-voice-guest-timer" id="agilo-voice-guest-timer"></div>',
      '        <div class="agilo-voice-guest-progress"><div class="agilo-voice-guest-progress-bar" id="agilo-voice-guest-progress"></div></div>',
      '      </div>',
      '      <audio class="agilo-voice-guest-audio" id="agilo-voice-guest-preview" controls style="display:none"></audio>',
      '      <p class="agilo-voice-guest-hint text-size-small" id="agilo-voice-guest-hint">Parlez clairement, seul(e), dans un endroit calme.</p>',
      '    </div>',
      '    <a class="agilo-voice-guest-file-link" id="agilo-voice-guest-toggle-file" href="#" role="button">Importer un fichier audio à la place</a>',
      '    <div class="agilo-voice-guest-file-panel" id="agilo-voice-guest-file-panel">',
      '      <input class="agilo-voice-guest-file select-input input-field w-input" id="agilo-voice-guest-file" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/*,video/*">',
      '      <p class="agilo-voice-guest-hint text-size-small">Formats recommandés : MP3 ou WAV, 15 secondes minimum (10 à 30 s de votre voix).</p>',
      '    </div>',
      '    <div class="agilo-voice-guest-actions">',
      '      <button type="button" class="agilo-voice-guest-btn-submit button-wp2024 next w-button" id="agilo-voice-guest-submit">Enregistrer ma voix</button>',
      '      <div class="agilo-voice-guest-status" id="agilo-voice-guest-status" role="status"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function mountEnrollmentUI(container, guestToken) {
    injectStyles();
    container.innerHTML = buildFormMarkup();

    var state = {
      uiState: 'idle',
      recording: false,
      elapsedMs: 0,
      timerId: null,
      mediaRecorder: null,
      mediaStream: null,
      audioChunks: [],
      recordedBlob: null,
      recordedFileName: 'voice-enrollment.webm',
      fileMode: false,
      guestToken: guestToken
    };

    var els = {
      hero: container.querySelector('#agilo-voice-guest-hero'),
      heroIcon: container.querySelector('#agilo-voice-guest-hero-icon'),
      waves: container.querySelector('#agilo-voice-guest-waves'),
      speakerLabel: container.querySelector('#agilo-voice-guest-speaker-label'),
      recordBtn: container.querySelector('#agilo-voice-guest-record-btn'),
      recordBtnLabel: container.querySelector('#agilo-voice-guest-record-btn-label'),
      recordBtnIcon: container.querySelector('#agilo-voice-guest-record-btn-icon'),
      barRow: container.querySelector('#agilo-voice-guest-bar-row'),
      timer: container.querySelector('#agilo-voice-guest-timer'),
      progress: container.querySelector('#agilo-voice-guest-progress'),
      hint: container.querySelector('#agilo-voice-guest-hint'),
      preview: container.querySelector('#agilo-voice-guest-preview'),
      fileLink: container.querySelector('#agilo-voice-guest-toggle-file'),
      filePanel: container.querySelector('#agilo-voice-guest-file-panel'),
      fileInput: container.querySelector('#agilo-voice-guest-file'),
      submitBtn: container.querySelector('#agilo-voice-guest-submit'),
      status: container.querySelector('#agilo-voice-guest-status')
    };

    var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="12" cy="12" r="6"/></svg>';
    var STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
    var micIconHtml = MIC_SVG.replace('agilo-voice-hero-icon', 'agilo-voice-guest-hero-icon');
    var checkIconHtml = CHECK_SVG.replace('agilo-voice-hero-icon', 'agilo-voice-guest-hero-icon');

    function setStatus(type, message) {
      els.status.className = 'agilo-voice-guest-status';
      if (!message) return;
      els.status.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
      els.status.textContent = message;
    }

    function setBusy(busy) {
      els.submitBtn.disabled = busy;
      els.recordBtn.disabled = busy && state.uiState !== 'recording';
    }

    function formatTime(ms) {
      var sec = Math.floor(ms / 1000);
      return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }

    function updateTimerUI() {
      if (state.uiState === 'recording' || state.uiState === 'preview') {
        els.barRow.classList.add('is-visible');
        els.timer.textContent = formatTime(state.elapsedMs) + ' / 00:30';
        var pct = Math.min(100, (state.elapsedMs / (MAX_RECORD_SEC * 1000)) * 100);
        els.progress.style.width = pct + '%';
      } else {
        els.barRow.classList.remove('is-visible');
        els.progress.style.width = '0%';
      }
    }

    function updateUIState() {
      els.hero.classList.remove('is-idle', 'is-recording', 'is-preview');

      if (state.uiState === 'recording') {
        els.hero.classList.add('is-recording');
        els.heroIcon.innerHTML = micIconHtml;
        els.waves.style.display = 'block';
        els.recordBtn.classList.add('is-recording');
        els.recordBtnLabel.textContent = 'Arrêter';
        els.recordBtnIcon.innerHTML = STOP_ICON;
        els.recordBtn.disabled = state.elapsedMs < MIN_RECORD_SEC * 1000;
        els.hint.textContent = 'Parlez naturellement — minimum 10 secondes.';
        els.preview.style.display = 'none';
        els.submitBtn.classList.remove('is-visible');
      } else if (state.uiState === 'preview') {
        els.hero.classList.add('is-preview');
        els.heroIcon.innerHTML = checkIconHtml;
        els.waves.style.display = 'none';
        els.recordBtn.classList.remove('is-recording');
        els.recordBtnLabel.textContent = 'Réenregistrer';
        els.recordBtnIcon.innerHTML = PLAY_ICON;
        els.recordBtn.disabled = false;
        els.hint.textContent = 'Écoutez votre enregistrement, puis validez.';
        els.preview.style.display = 'block';
        els.submitBtn.classList.add('is-visible');
      } else if (state.uiState === 'file') {
        els.hero.classList.add('is-preview');
        els.heroIcon.innerHTML = checkIconHtml;
        els.waves.style.display = 'none';
        els.recordBtn.classList.remove('is-recording');
        els.recordBtnLabel.textContent = 'Démarrer l\'enregistrement';
        els.recordBtnIcon.innerHTML = PLAY_ICON;
        els.recordBtn.disabled = false;
        els.hint.textContent = 'Fichier sélectionné — vous pouvez l\'enregistrer ou utiliser le micro.';
        els.preview.style.display = 'none';
        els.submitBtn.classList.add('is-visible');
      } else {
        els.hero.classList.add('is-idle');
        els.heroIcon.innerHTML = micIconHtml;
        els.waves.style.display = 'none';
        els.recordBtn.classList.remove('is-recording');
        els.recordBtnLabel.textContent = 'Démarrer l\'enregistrement';
        els.recordBtnIcon.innerHTML = PLAY_ICON;
        els.recordBtn.disabled = false;
        els.hint.textContent = 'Parlez clairement, seul(e), dans un endroit calme.';
        els.preview.style.display = 'none';
        els.submitBtn.classList.remove('is-visible');
      }

      updateTimerUI();
    }

    function cleanupStream() {
      if (state.mediaStream) state.mediaStream.getTracks().forEach(function (t) { t.stop(); });
      state.mediaStream = null;
      state.mediaRecorder = null;
    }

    function resetRecording() {
      if (state.timerId) clearInterval(state.timerId);
      state.timerId = null;
      state.recording = false;
      state.elapsedMs = 0;
      state.audioChunks = [];
      state.recordedBlob = null;
      state.fileMode = false;
      cleanupStream();
      els.preview.removeAttribute('src');
      els.fileInput.value = '';
      els.filePanel.classList.remove('is-open');
      if (els.fileLink) els.fileLink.textContent = 'Importer un fichier audio à la place';
      state.uiState = 'idle';
      updateUIState();
    }

    function openFileImportPanel() {
      if (!els.filePanel || els.filePanel.classList.contains('is-open')) return;
      els.filePanel.classList.add('is-open');
      if (els.fileLink) els.fileLink.textContent = 'Masquer l\'import de fichier';
    }

    function toggleFilePanel(e) {
      if (e) e.preventDefault();
      if (state.recording) return;
      var open = els.filePanel.classList.toggle('is-open');
      els.fileLink.textContent = open
        ? 'Masquer l\'import de fichier'
        : 'Importer un fichier audio à la place';
      if (!open) {
        els.fileInput.value = '';
        if (!state.recordedBlob) {
          state.uiState = 'idle';
          updateUIState();
        }
      }
    }

    async function startRecording() {
      setStatus('', '');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('error', 'Votre navigateur ne permet pas l\'accès au micro.');
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        setStatus('error', 'Enregistrement micro non supporté. Importez un fichier audio à la place.');
        return;
      }

      try {
        if (state.uiState === 'preview') {
          state.recordedBlob = null;
          els.preview.removeAttribute('src');
          els.preview.style.display = 'none';
        }
        els.fileInput.value = '';
        state.fileMode = false;

        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaStream = stream;
        var mimeType = getSupportedMimeType();
        try {
          state.mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        } catch (err) {
          state.mediaRecorder = new MediaRecorder(stream);
          mimeType = state.mediaRecorder.mimeType || 'audio/webm';
        }

        state.recordedFileName = getEnrollmentFileName(mimeType);
        state.audioChunks = [];
        state.mediaRecorder.ondataavailable = function (ev) {
          if (ev.data && ev.data.size > 0) state.audioChunks.push(ev.data);
        };
        state.mediaRecorder.onstop = function () {
          if (state.audioChunks.length) {
            state.recordedBlob = new Blob(state.audioChunks, { type: mimeType });
            var url = URL.createObjectURL(state.recordedBlob);
            els.preview.src = url;
            state.uiState = 'preview';
            updateUIState();
          }
        };

        state.mediaRecorder.start(250);
        state.recording = true;
        state.elapsedMs = 0;
        state.uiState = 'recording';
        updateUIState();

        state.timerId = setInterval(function () {
          state.elapsedMs += 100;
          updateUIState();
          if (state.elapsedMs >= MAX_RECORD_SEC * 1000) stopRecording();
        }, 100);
      } catch (e) {
        console.error('[agilo-voice-guest] startRecording', e);
        setStatus('error', 'Accès micro refusé ou indisponible. Importez un fichier audio à la place.');
        resetRecording();
      }
    }

    function stopRecording() {
      if (!state.recording || !state.mediaRecorder) return;
      if (state.elapsedMs < MIN_RECORD_SEC * 1000) return;
      state.recording = false;
      if (state.timerId) clearInterval(state.timerId);
      state.timerId = null;
      try {
        if (state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
      } catch (e) { /* noop */ }
      cleanupStream();
    }

    function handleRecordButtonClick() {
      if (state.uiState === 'recording') {
        stopRecording();
        return;
      }
      startRecording();
    }

    function validateSpeakerLabel(label) {
      var trimmed = String(label || '').trim();
      if (!trimmed) return 'Le prénom est obligatoire.';
      if (RESERVED_LABELS.has(trimmed.toUpperCase())) return ERROR_MESSAGES.error_reserved_speaker_label;
      return '';
    }

    function getVoiceFile() {
      if (state.fileMode && els.fileInput.files && els.fileInput.files[0]) {
        return els.fileInput.files[0];
      }
      if (state.recordedBlob) {
        return new File([state.recordedBlob], state.recordedFileName, { type: state.recordedBlob.type || 'audio/webm' });
      }
      return null;
    }

    async function enrollVoice() {
      setStatus('', '');
      var labelErr = validateSpeakerLabel(els.speakerLabel.value);
      if (labelErr) {
        setStatus('error', labelErr);
        return;
      }
      var voiceFile = getVoiceFile();
      if (!voiceFile) {
        setStatus('error', 'Enregistrez votre voix ou importez un fichier avant de continuer.');
        return;
      }
      if (voiceFile.size < 8000) {
        setStatus('error', 'Enregistrement trop court ou vide. Parlez au moins 10 secondes, puis réessayez.');
        return;
      }

      var form = new FormData();
      form.append('guestToken', state.guestToken);
      form.append('speakerLabel', String(els.speakerLabel.value).trim());
      form.append('voiceFile', voiceFile, voiceFile.name);

      setBusy(true);
      setStatus('info', 'Envoi de votre empreinte vocale…');

      try {
        var r = await fetch(API_BASE + '/enrollSpeakerVoice', {
          method: 'POST',
          body: form,
          credentials: 'omit'
        });
        var d = await r.json();
        if (d.status === 'OK' && d.enrolled) {
          var label = d.speakerLabel || String(els.speakerLabel.value).trim();
          container.innerHTML = buildSuccessMarkup(label);
          return;
        }
        logVoiceApiError('[agilo-voice-guest] enrollSpeakerVoice failed', d);
        setStatus('error', formatApiError(d, 'Impossible d\'enregistrer votre voix. Réessayez avec un enregistrement plus long et plus clair.'));
        if (isInvalidAudioApiError(d)) openFileImportPanel();
      } catch (e) {
        console.error('[agilo-voice-guest] enrollVoice', e);
        setStatus('error', 'Erreur de connexion. Vérifiez votre connexion et réessayez.');
      } finally {
        setBusy(false);
      }
    }

    els.recordBtn.addEventListener('click', handleRecordButtonClick);
    els.submitBtn.addEventListener('click', enrollVoice);
    els.fileLink.addEventListener('click', toggleFilePanel);
    els.fileInput.addEventListener('change', function () {
      setStatus('', '');
      if (els.fileInput.files && els.fileInput.files[0]) {
        state.fileMode = true;
        state.recordedBlob = null;
        els.preview.removeAttribute('src');
        els.preview.style.display = 'none';
        state.uiState = 'file';
      } else if (!state.recordedBlob) {
        state.fileMode = false;
        state.uiState = 'idle';
      }
      updateUIState();
    });

    updateUIState();
  }

  function init() {
    var container = document.getElementById(AGILO_VOICE_CONFIG.containerId);
    if (!container) {
      console.warn('[agilo-voice-guest] Container #' + AGILO_VOICE_CONFIG.containerId + ' introuvable.');
      return;
    }

    var guestToken = getGuestTokenFromUrl();
    if (!guestToken) {
      injectStyles();
      container.innerHTML = buildErrorMarkup('Ce lien est incomplet. Vérifiez l\'URL reçue ou demandez un nouveau lien à la personne qui vous a invité(e).');
      return;
    }

    container.innerHTML = '<p style="color:var(--color--gris,#525252);text-align:center;margin:1rem 0">Chargement…</p>';
    mountEnrollmentUI(container, guestToken);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
