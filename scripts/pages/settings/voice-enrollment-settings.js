/* ================================================================
   AGILOTEXT - VOICE ENROLLMENT SETTINGS
   Pages : /app/free/profile, /app/premium/profile, /app/business/profile
   Déploiement Webflow :
     1. Embed : <div id="agilo-voice-settings"></div>
     2. Coller ce script dans "Before </body>" de la page
   ================================================================ */

(function () {
  'use strict';

  if (!/^\/app\/(free|premium|business)\/profile\/?$/.test(window.location.pathname || '')) return;
  if (window.__agiloVoiceSettingsInit) return;
  window.__agiloVoiceSettingsInit = true;

  const AGILO_VOICE_CONFIG = {
    containerId: 'agilo-voice-settings'
  };

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;
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

  const sleep = function (ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  };

  function normEdition(v) {
    v = String(v || '').toLowerCase().trim();
    if (v === 'business' || v === 'enterprise' || v === 'entreprise' || v === 'biz') return 'ent';
    if (v === 'premium' || v === 'pro') return 'pro';
    return v || 'free';
  }

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
      return 'Votre enregistrement n\'a pas pu être analysé par Speechmatics. Essayez d\'importer un fichier MP3 ou WAV de 15 secondes minimum à la place.';
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

  async function waitForMemberstack(timeoutMs) {
    var started = Date.now();
    while (Date.now() - started < (timeoutMs || 12000)) {
      if (window.$memberstackDom) return window.$memberstackDom;
      await sleep(120);
    }
    return null;
  }

  function inferEditionFromLocation() {
    var p = window.location.pathname;
    if (p.indexOf('/app/free/') !== -1) return 'free';
    if (p.indexOf('/app/pro/') !== -1 || p.indexOf('/app/premium/') !== -1) return 'pro';
    if (p.indexOf('/app/ent/') !== -1 || p.indexOf('/app/business/') !== -1) return 'ent';
    return null;
  }

  function inferEditionFromMember(member) {
    var plans = Array.isArray(member && member.planConnections) ? member.planConnections : [];
    for (var i = 0; i < plans.length; i++) {
      var id = String((plans[i] && plans[i].planId) || '').toLowerCase();
      if (id.indexOf('business') !== -1 || id.indexOf('ent') !== -1) return 'ent';
      if (id.indexOf('pro') !== -1 || id.indexOf('premium') !== -1) return 'pro';
    }
    return 'free';
  }

  async function fetchAgiloTokenDirect(username, edition) {
    edition = normEdition(edition);
    var email = String(username || '').toLowerCase();
    if (!email) throw new Error('Email utilisateur introuvable.');

    var key = 'agilo:token:' + edition + ':' + email;
    var tsKey = 'agilo:tokenIssuedAt:' + edition + ':' + email;
    var cached = localStorage.getItem(key);
    var age = Date.now() - parseInt(localStorage.getItem(tsKey) || '0', 10);
    if (cached && age < TOKEN_MAX_AGE_MS) return cached;

    var url = API_BASE + '/getToken?username=' + encodeURIComponent(email) + '&edition=' + encodeURIComponent(edition);
    var r = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    var d = await r.json();
    if (d.status === 'OK' && d.token) {
      localStorage.setItem(key, d.token);
      localStorage.setItem(tsKey, String(Date.now()));
      localStorage.setItem('agilo:username', email);
      localStorage.setItem('agilo:edition', edition);
      return d.token;
    }
    throw new Error(formatApiError(d, 'Impossible d\'obtenir le token API.'));
  }

  async function resolveToken(username, edition) {
    if (typeof window.getToken === 'function') {
      var t = await window.getToken(username, edition);
      if (t) return t;
    }
    return await fetchAgiloTokenDirect(username, edition);
  }

  async function getCredentials() {
    var ms = await waitForMemberstack();
    var email = '';
    var firstName = '';
    var edition = normEdition(localStorage.getItem('agilo:edition') || inferEditionFromLocation() || 'free');
    var member = null;

    if (ms) {
      try {
        var res = await ms.getCurrentMember();
        member = (res && res.data) || res || null;
        email = (member && member.auth && member.auth.email) || '';
        var cf = (member && member.customFields) || {};
        firstName = cf['first-name'] || cf.firstName || '';
      } catch (e) {
        console.warn('[agilo-voice-settings] getCurrentMember failed', e);
      }
      if (member) {
        edition = normEdition(localStorage.getItem('agilo:edition') || inferEditionFromLocation() || inferEditionFromMember(member));
      }
    }

    email = email || localStorage.getItem('agilo:username') || '';
    var token = await resolveToken(email, edition);
    return { username: email, token: token, edition: edition, firstName: firstName, memberstack: ms };
  }

  function buildFreePlanBadge() {
    return '<div class="agilo-voice-free-badge text-size-small">La reconnaissance automatique de votre voix dans les transcriptions est disponible avec un abonnement <a href="/pricing">Pro ou Business</a>.</div>';
  }

  function maybeAppendFreeBadge(root, edition) {
    if (normEdition(edition) !== 'free') return;
    var card = root.querySelector('.agilo-voice-card');
    if (!card) return;
    var existing = root.querySelector('.agilo-voice-free-badge');
    if (existing) existing.remove();
    card.insertAdjacentHTML('beforeend', buildFreePlanBadge());
  }

  async function updateVoiceEnrolledFlag(ms, value) {
    if (!ms || typeof ms.updateMember !== 'function') return;
    try {
      await ms.updateMember({ customFields: { 'voice-enrolled': value } });
    } catch (e) {
      console.warn('[agilo-voice-settings] updateMember voice-enrolled failed', e);
    }
  }

  function buildAuthBody(creds) {
    var body = new URLSearchParams();
    body.append('username', creds.username);
    body.append('token', creds.token);
    body.append('edition', creds.edition);
    return body;
  }

  async function getSpeakerVoice(creds) {
    var body = buildAuthBody(creds);
    var r = await fetch(API_BASE + '/getSpeakerVoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      credentials: 'omit'
    });
    var d = await r.json();
    if (d.status === 'OK') return d;
    throw new Error(formatApiError(d, 'Impossible de récupérer l\'empreinte vocale.'));
  }

  async function deleteSpeakerVoice(creds) {
    var body = buildAuthBody(creds);
    var r = await fetch(API_BASE + '/deleteSpeakerVoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      credentials: 'omit'
    });
    var d = await r.json();
    if (d.status === 'OK') return d;
    throw new Error(formatApiError(d, 'Impossible de supprimer l\'empreinte vocale.'));
  }

  function injectStyles() {
    if (document.getElementById('agilo-voice-enroll-styles')) return;
    var style = document.createElement('style');
    style.id = 'agilo-voice-enroll-styles';
    style.textContent = [
      '@keyframes agilo-voice-pulse{0%{transform:scale(.92);opacity:.55}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}',
      '.agilo-voice-wrap{max-width:100%;width:100%;font-family:inherit;color:var(--color--gris_foncé,#020202);margin-bottom:1rem}',
      '.agilo-voice-card{background:var(--color--blanc_gris,#f8f9fa);border:1px solid rgba(82,82,82,.12);border-radius:' + AGILO_RADIUS + ';padding:20px;margin-bottom:16px}',
      '.agilo-voice-title{margin:0 0 6px;font-size:1.25rem;font-weight:600;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-sub{margin:0 0 18px;color:var(--color--gris,#525252);line-height:1.45}',
      '.agilo-voice-intro{margin:0 0 1.25rem;text-align:center}',
      '.agilo-voice-intro-title{margin:0 0 .35rem;font-size:1.05rem;font-weight:600;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-intro-sub{margin:0;color:var(--color--gris,#525252);line-height:1.5}',
      '.agilo-voice-hero{position:relative;display:flex;align-items:center;justify-content:center;width:112px;height:112px;margin:0 auto 1.25rem}',
      '.agilo-voice-hero-ring{position:absolute;inset:0;border-radius:50%;background:rgba(23,74,150,.1);border:1px solid rgba(23,74,150,.18);transition:background .25s,border-color .25s}',
      '.agilo-voice-hero.is-recording .agilo-voice-hero-ring{background:rgba(168,38,51,.1);border-color:rgba(168,38,51,.25)}',
      '.agilo-voice-hero.is-preview .agilo-voice-hero-ring{background:rgba(28,102,26,.1);border-color:rgba(28,102,26,.22)}',
      '.agilo-voice-hero-icon{position:relative;z-index:2;width:44px;height:44px;color:var(--color--blue,#174a96)}',
      '.agilo-voice-hero.is-recording .agilo-voice-hero-icon{color:var(--color--rouge,#a82633)}',
      '.agilo-voice-hero.is-preview .agilo-voice-hero-icon{color:var(--color--vert,#1c661a)}',
      '.agilo-voice-waves{position:absolute;inset:0;pointer-events:none}',
      '.agilo-voice-wave{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(168,38,51,.35);animation:agilo-voice-pulse 2s ease-out infinite}',
      '.agilo-voice-wave:nth-child(2){animation-delay:.55s}',
      '.agilo-voice-wave:nth-child(3){animation-delay:1.1s}',
      '.agilo-voice-record-area{display:flex;flex-direction:column;align-items:stretch;gap:.75rem}',
      '.agilo-voice-label{display:block;margin:0;font-size:.9rem;font-weight:500;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-input.agilo-voice-input{width:100%;box-sizing:border-box;margin:0;border:1px solid var(--color--noir_25,rgba(82,82,82,.25));border-radius:' + AGILO_RADIUS + ';background:var(--color--white,#fff);padding:10px 12px;font:inherit;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-input.agilo-voice-input:focus{outline:none;border-color:var(--color--blue,#174a96);box-shadow:0 0 0 2px rgba(23,74,150,.12)}',
      '.agilo-voice-record-btn.agilo-voice-record-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:52px;padding:.75rem 1.25rem;border:none;border-radius:' + AGILO_RADIUS + ';background:var(--color--blue,#174a96);color:var(--color--white,#fff);font:inherit;font-weight:600;font-size:.95rem;cursor:pointer;transition:background .2s,filter .15s;box-shadow:inset 0 6px 12px #ffffff1f,inset 0 1px 1px #fff3,0 4px 4px #08080814,0 1px 2px #08080833}',
      '.agilo-voice-record-btn.agilo-voice-record-btn:hover:not(:disabled){filter:brightness(1.05)}',
      '.agilo-voice-record-btn.agilo-voice-record-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.agilo-voice-record-btn.agilo-voice-record-btn.is-recording{background:var(--color--rouge,#a82633)}',
      '.agilo-voice-record-btn-icon{display:inline-flex;width:18px;height:18px}',
      '.agilo-voice-bar-row{display:none;flex-direction:column;gap:.35rem}',
      '.agilo-voice-bar-row.is-visible{display:flex}',
      '.agilo-voice-timer-inline{font-size:.85rem;font-weight:600;color:var(--color--gris,#525252);text-align:center}',
      '.agilo-voice-progress{height:5px;background:rgba(82,82,82,.15);border-radius:999px;overflow:hidden}',
      '.agilo-voice-progress-bar{height:100%;width:0;background:var(--color--blue,#174a96);transition:width .1s linear}',
      '.agilo-voice-hero.is-recording~.agilo-voice-record-area .agilo-voice-progress-bar{background:var(--color--rouge,#a82633)}',
      '.agilo-voice-hint{font-size:.85rem;color:var(--color--gris,#525252);margin:0;text-align:center;line-height:1.45}',
      '.agilo-voice-audio{width:100%;margin:0}',
      '.agilo-voice-file-link{display:block;margin:.5rem auto 0;text-align:center;font-size:.85rem;color:var(--color--blue,#174a96);text-decoration:underline;cursor:pointer}',
      '.agilo-voice-file-link:hover{color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-file-panel{display:none;margin-top:.5rem}',
      '.agilo-voice-file-panel.is-open{display:block}',
      '.agilo-voice-file{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--color--noir_25,rgba(82,82,82,.25));border-radius:' + AGILO_RADIUS + ';background:var(--color--white,#fff)}',
      '.agilo-voice-form-actions{margin-top:1rem;display:flex;flex-direction:column;align-items:stretch;gap:.75rem}',
      '.agilo-voice-btn-submit{display:none;width:100%}',
      '.agilo-voice-btn-submit.is-visible{display:inline-block}',
      '.agilo-voice-btn-cancel{display:none;width:100%;background:transparent;color:var(--color--gris,#525252);border:none;padding:10px 0;font:inherit;cursor:pointer;text-align:center}',
      '.agilo-voice-btn-cancel.is-visible{display:inline-block}',
      '.agilo-voice-status{margin-top:.5rem;padding:10px 12px;border-radius:' + AGILO_RADIUS + ';font-size:.9rem;display:none}',
      '.agilo-voice-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '.agilo-voice-status.is-success{display:block;background:rgba(28,102,26,.1);color:var(--color--vert,#1c661a)}',
      '.agilo-voice-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '.agilo-voice-enrolled{background:rgba(28,102,26,.08);border:1px solid rgba(28,102,26,.2);border-radius:' + AGILO_RADIUS + ';padding:14px 16px;color:var(--color--vert,#1c661a);text-align:center;margin-bottom:12px}',
      '.agilo-voice-enrolled strong{display:block;margin-bottom:4px;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;margin-top:8px}',
      '.agilo-voice-btn.agilo-voice-btn{display:inline-block;cursor:pointer}',
      '.agilo-voice-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.agilo-voice-btn-secondary.agilo-voice-btn-secondary{background:var(--color--white,#fff);color:var(--color--gris_foncé,#020202);border:1px solid rgba(82,82,82,.25);border-radius:' + AGILO_RADIUS + ';margin-right:8px}',
      '.agilo-voice-btn-danger.agilo-voice-btn-danger{background:var(--color--white,#fff);color:var(--color--rouge,#a82633);border:1px solid rgba(168,38,51,.25);border-radius:' + AGILO_RADIUS + '}',
      '.agilo-voice-confirm{background:rgba(168,38,51,.06);border:1px solid rgba(168,38,51,.2);border-radius:' + AGILO_RADIUS + ';padding:12px;margin-top:12px}',
      '.agilo-voice-free-badge{margin-top:12px;padding:10px 14px;background:rgba(23,74,150,.08);border:1px solid rgba(23,74,150,.2);border-radius:' + AGILO_RADIUS + ';color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-free-badge a{color:var(--color--blue,#174a96);font-weight:600;text-decoration:none}'
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

  function buildEnrolledMarkup(info) {
    var label = escapeHtml(info.speakerLabel || '—');
    var date = escapeHtml(info.dtUpdate || '');
    return [
      '<div class="agilo-voice-wrap">',
      '  <div class="agilo-voice-card">',
      '    <h2 class="agilo-voice-title heading-style-h2">Empreinte vocale</h2>',
      '    <div class="agilo-voice-hero is-preview" id="agilo-voice-enrolled-hero">',
      '      <div class="agilo-voice-hero-ring"></div>',
      '      <div>' + CHECK_SVG + '</div>',
      '    </div>',
      '    <div class="agilo-voice-enrolled" id="agilo-voice-enrolled-card">',
      '      <strong>Voix enregistrée — ' + label + '</strong>',
      date ? ('      <span>Mise à jour : ' + date + '</span>') : '',
      '    </div>',
      '    <div class="agilo-voice-actions">',
      '      <button type="button" class="agilo-voice-btn agilo-voice-btn-secondary button-wp2024" id="agilo-voice-edit">Modifier</button>',
      '      <button type="button" class="agilo-voice-btn agilo-voice-btn-danger button-secondary" id="agilo-voice-delete">Supprimer</button>',
      '    </div>',
      '    <div id="agilo-voice-delete-confirm" class="agilo-voice-confirm" style="display:none">',
      '      <p style="margin:0 0 10px">Supprimer votre empreinte vocale ? Vous devrez vous ré-enregistrer pour être reconnu(e) automatiquement.</p>',
      '      <button type="button" class="agilo-voice-btn agilo-voice-btn-danger button-secondary" id="agilo-voice-delete-confirm-btn">Confirmer la suppression</button>',
      '      <button type="button" class="agilo-voice-btn agilo-voice-btn-cancel is-visible" id="agilo-voice-delete-cancel">Annuler</button>',
      '    </div>',
      '    <div class="agilo-voice-status" id="agilo-voice-status" role="status"></div>',
      '    <div id="agilo-voice-form-slot"></div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildEmptyMarkup() {
    return [
      '<div class="agilo-voice-wrap">',
      '  <div class="agilo-voice-card">',
      '    <h2 class="agilo-voice-title heading-style-h2">Empreinte vocale</h2>',
      '    <div class="agilo-voice-intro">',
      '      <p class="agilo-voice-intro-title">Faites reconnaître votre voix</p>',
      '      <p class="agilo-voice-intro-sub text-size-small">Enregistrez 10 à 30 secondes de votre voix pour être reconnu(e) automatiquement dans vos transcriptions.</p>',
      '    </div>',
      '    <div class="agilo-voice-status" id="agilo-voice-status" role="status"></div>',
      '    <div id="agilo-voice-form-slot"></div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildFormMarkup(firstName, speakerLabel, showCancel) {
    var labelValue = escapeHtml(speakerLabel || firstName || '');
    return [
      '<div class="agilo-voice-hero is-idle" id="agilo-voice-hero">',
      '  <div class="agilo-voice-waves" id="agilo-voice-waves" style="display:none" aria-hidden="true">',
      '    <span class="agilo-voice-wave"></span>',
      '    <span class="agilo-voice-wave"></span>',
      '    <span class="agilo-voice-wave"></span>',
      '  </div>',
      '  <div class="agilo-voice-hero-ring"></div>',
      '  <div id="agilo-voice-hero-icon">' + MIC_SVG + '</div>',
      '</div>',
      '<div class="agilo-voice-record-area">',
      '  <label class="agilo-voice-label" for="agilo-voice-speaker-label">Votre prénom dans les transcriptions</label>',
      '  <input class="agilo-voice-input select-input input-field w-input" id="agilo-voice-speaker-label" type="text" maxlength="80" value="' + labelValue + '" placeholder="Ex. Nicolas">',
      '  <button type="button" class="agilo-voice-record-btn button-wp2024 next w-button" id="agilo-voice-record-btn">',
      '    <span class="agilo-voice-record-btn-icon" id="agilo-voice-record-btn-icon" aria-hidden="true">',
      '      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="12" cy="12" r="6"/></svg>',
      '    </span>',
      '    <span id="agilo-voice-record-btn-label">Démarrer l\'enregistrement</span>',
      '  </button>',
      '  <div class="agilo-voice-bar-row" id="agilo-voice-bar-row">',
      '    <div class="agilo-voice-timer-inline" id="agilo-voice-timer"></div>',
      '    <div class="agilo-voice-progress"><div class="agilo-voice-progress-bar" id="agilo-voice-progress"></div></div>',
      '  </div>',
      '  <audio class="agilo-voice-audio" id="agilo-voice-preview" controls style="display:none"></audio>',
      '  <p class="agilo-voice-hint text-size-small" id="agilo-voice-hint">Parlez clairement, seul(e), dans un endroit calme.</p>',
      '</div>',
      '<a class="agilo-voice-file-link" id="agilo-voice-toggle-file" href="#" role="button">Importer un fichier audio à la place</a>',
      '<div class="agilo-voice-file-panel" id="agilo-voice-file-panel">',
      '  <input class="agilo-voice-file select-input input-field w-input" id="agilo-voice-file" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/*,video/*">',
      '  <p class="agilo-voice-hint text-size-small">Formats recommandés : MP3 ou WAV, 15 secondes minimum (10 à 30 s de votre voix).</p>',
      '</div>',
      '<div class="agilo-voice-form-actions">',
      '  <button type="button" class="agilo-voice-btn-submit button-wp2024 next w-button" id="agilo-voice-submit">Enregistrer ma voix</button>',
      '  <button type="button" class="agilo-voice-btn-cancel' + (showCancel ? ' is-visible' : '') + '" id="agilo-voice-cancel-form">Annuler</button>',
      '  <div class="agilo-voice-status" id="agilo-voice-form-status" role="status"></div>',
      '</div>'
    ].join('');
  }

  function mountEnrollmentForm(root, creds, options) {
    options = options || {};
    var slot = root.querySelector('#agilo-voice-form-slot');
    if (!slot) return;

    slot.innerHTML = buildFormMarkup(creds.firstName, options.speakerLabel, !!options.showCancel);

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
      credentials: creds
    };

    var els = {
      hero: slot.querySelector('#agilo-voice-hero'),
      heroIcon: slot.querySelector('#agilo-voice-hero-icon'),
      waves: slot.querySelector('#agilo-voice-waves'),
      speakerLabel: slot.querySelector('#agilo-voice-speaker-label'),
      recordBtn: slot.querySelector('#agilo-voice-record-btn'),
      recordBtnLabel: slot.querySelector('#agilo-voice-record-btn-label'),
      recordBtnIcon: slot.querySelector('#agilo-voice-record-btn-icon'),
      barRow: slot.querySelector('#agilo-voice-bar-row'),
      timer: slot.querySelector('#agilo-voice-timer'),
      progress: slot.querySelector('#agilo-voice-progress'),
      hint: slot.querySelector('#agilo-voice-hint'),
      preview: slot.querySelector('#agilo-voice-preview'),
      fileLink: slot.querySelector('#agilo-voice-toggle-file'),
      filePanel: slot.querySelector('#agilo-voice-file-panel'),
      fileInput: slot.querySelector('#agilo-voice-file'),
      submitBtn: slot.querySelector('#agilo-voice-submit'),
      cancelBtn: slot.querySelector('#agilo-voice-cancel-form'),
      status: root.querySelector('#agilo-voice-status') || slot.querySelector('#agilo-voice-form-status')
    };

    var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="12" cy="12" r="6"/></svg>';
    var STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';

    function setStatus(type, message) {
      if (!els.status) return;
      els.status.className = 'agilo-voice-status';
      if (!message) return;
      els.status.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
      els.status.textContent = message;
    }

    function setBusy(busy) {
      els.submitBtn.disabled = busy;
      els.recordBtn.disabled = busy && state.uiState !== 'recording';
      if (els.cancelBtn) els.cancelBtn.disabled = busy;
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
        els.heroIcon.innerHTML = MIC_SVG;
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
        els.heroIcon.innerHTML = CHECK_SVG;
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
        els.heroIcon.innerHTML = CHECK_SVG;
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
        els.heroIcon.innerHTML = MIC_SVG;
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
        console.error('[agilo-voice-settings] startRecording', e);
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

      var credsLocal = state.credentials;
      var form = new FormData();
      form.append('username', credsLocal.username);
      form.append('token', credsLocal.token);
      form.append('edition', credsLocal.edition);
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
          await updateVoiceEnrolledFlag(credsLocal.memberstack, 'true');
          setStatus('success', 'Empreinte vocale enregistrée.');
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess({
              speakerLabel: d.speakerLabel || String(els.speakerLabel.value).trim(),
              dtUpdate: new Date().toLocaleString('fr-FR')
            });
          }
          return;
        }
        logVoiceApiError('[agilo-voice-settings] enrollSpeakerVoice failed', d);
        setStatus('error', formatApiError(d, 'Impossible d\'enregistrer votre voix. Réessayez avec un enregistrement plus long et plus clair.'));
        if (isInvalidAudioApiError(d)) openFileImportPanel();
      } catch (e) {
        console.error('[agilo-voice-settings] enrollVoice', e);
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

    if (els.cancelBtn) {
      els.cancelBtn.addEventListener('click', function () {
        resetRecording();
        slot.innerHTML = '';
        if (typeof options.onCancel === 'function') options.onCancel();
      });
    }

    updateUIState();
  }

  function renderEnrolledView(container, creds, voiceInfo, reload) {
    injectStyles();
    container.innerHTML = buildEnrolledMarkup(voiceInfo);
    maybeAppendFreeBadge(container, creds.edition);

    var statusEl = container.querySelector('#agilo-voice-status');
    var editBtn = container.querySelector('#agilo-voice-edit');
    var deleteBtn = container.querySelector('#agilo-voice-delete');
    var confirmBox = container.querySelector('#agilo-voice-delete-confirm');
    var confirmBtn = container.querySelector('#agilo-voice-delete-confirm-btn');
    var cancelBtn = container.querySelector('#agilo-voice-delete-cancel');
    var enrolledCard = container.querySelector('#agilo-voice-enrolled-card');

    function setStatus(type, message) {
      statusEl.className = 'agilo-voice-status';
      if (!message) return;
      statusEl.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
      statusEl.textContent = message;
    }

    editBtn.addEventListener('click', function () {
      var enrolledHero = container.querySelector('#agilo-voice-enrolled-hero');
      if (enrolledHero) enrolledHero.style.display = 'none';
      enrolledCard.style.display = 'none';
      editBtn.style.display = 'none';
      deleteBtn.style.display = 'none';
      confirmBox.style.display = 'none';
      mountEnrollmentForm(container, creds, {
        speakerLabel: voiceInfo.speakerLabel,
        showCancel: true,
        onCancel: function () { reload(); },
        onSuccess: function () { reload(); }
      });
    });

    deleteBtn.addEventListener('click', function () {
      confirmBox.style.display = 'block';
    });

    cancelBtn.addEventListener('click', function () {
      confirmBox.style.display = 'none';
    });

    confirmBtn.addEventListener('click', async function () {
      confirmBtn.disabled = true;
      deleteBtn.disabled = true;
      setStatus('info', 'Suppression en cours…');
      try {
        await deleteSpeakerVoice(creds);
        await updateVoiceEnrolledFlag(creds.memberstack, 'false');
        setStatus('success', 'Empreinte vocale supprimée.');
        setTimeout(reload, 500);
      } catch (e) {
        console.error('[agilo-voice-settings] delete', e);
        setStatus('error', e.message || 'Impossible de supprimer l\'empreinte vocale.');
        confirmBtn.disabled = false;
        deleteBtn.disabled = false;
      }
    });
  }

  function renderEmptyView(container, creds, reload) {
    injectStyles();
    container.innerHTML = buildEmptyMarkup();
    maybeAppendFreeBadge(container, creds.edition);
    mountEnrollmentForm(container, creds, {
      onSuccess: function () { reload(); }
    });
  }

  async function init() {
    var container = document.getElementById(AGILO_VOICE_CONFIG.containerId);
    if (!container) {
      console.warn('[agilo-voice-settings] Container #' + AGILO_VOICE_CONFIG.containerId + ' introuvable.');
      return;
    }

    container.innerHTML = '<p style="color:#666">Chargement de l\'empreinte vocale…</p>';

    var creds;
    try {
      creds = await getCredentials();
    } catch (e) {
      console.error('[agilo-voice-settings] credentials failed', e);
      container.innerHTML = '<p style="color:#580808">Impossible de charger vos informations. Rechargez la page.</p>';
      return;
    }

    async function reload() {
      try {
        var info = await getSpeakerVoice(creds);
        if (info.enrolled) {
          renderEnrolledView(container, creds, info, reload);
        } else {
          renderEmptyView(container, creds, reload);
        }
      } catch (e) {
        console.error('[agilo-voice-settings] reload failed', e);
        container.innerHTML = '<p style="color:#580808">Impossible de charger l\'empreinte vocale. Rechargez la page.</p>';
      }
    }

    await reload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
