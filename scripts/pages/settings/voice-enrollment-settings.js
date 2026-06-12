/* ================================================================
   AGILOTEXT - VOICE ENROLLMENT SETTINGS (API V2)
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

  const AGILO_VOICE_CONFIG = { containerId: 'agilo-voice-settings' };
  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  const MIN_RECORD_SEC = 15;
  const MAX_RECORD_SEC = 45;
  const RESERVED_LABELS = new Set(['S1', 'S2', 'UU']);

  const MIC_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/><path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const AGILO_RADIUS = 'var(--0-5_radius,0.5rem)';

  const ERROR_MESSAGES = {
    error_invalid_speaker_label: 'Le prénom ou le nom est invalide ou vide.',
    error_reserved_speaker_label: 'Ce nom est réservé. Utilisez votre prénom (pas S1, S2 ou UU).',
    error_voice_file_not_found: 'Aucun fichier audio trouvé. Choisissez un fichier ou recommencez l\'enregistrement.',
    error_speaker_identifier_not_found: 'Voix non identifiable. Parlez plus distinctement et plus près du micro.',
    error_multiple_speakers_in_voice_enrollment: 'Plusieurs voix détectées. Enregistrez-vous seul(e), dans un endroit calme.',
    error_speaker_voice_not_available_for_edition: 'La reconnaissance vocale n\'est pas disponible avec votre abonnement. Passez en Pro ou Business.',
    error_speaker_voice_limit_reached: 'Vous avez atteint le nombre maximum de voix pour votre abonnement.',
    error_voice_file_duration_too_short: 'L\'extrait audio doit durer au moins 15 secondes.',
    error_voice_file_duration_too_long: 'L\'extrait audio ne doit pas dépasser 45 secondes.',
    error_audio_format_not_supported: 'Format audio non pris en charge. Utilisez un fichier MP3 ou WAV.',
    error_invalid_audio_file_content: 'Le fichier ne peut pas être lu comme un audio valide.',
    error_invalid_speaker_voice_id: 'Cette voix est introuvable. Rechargez la page.',
    error_speaker_voice_not_found: 'Cette voix est introuvable. Rechargez la page.',
    error_speaker_voice_label_already_exists: 'Une voix existe déjà avec ce prénom et ce nom.',
    error_invalid_recipient_email: 'L\'adresse email du destinataire est invalide.',
    error_invalid_recipient_name: 'Le nom du destinataire est invalide.'
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
      return 'Votre enregistrement n\'a pas pu être analysé. Essayez d\'importer un fichier MP3 ou WAV de 15 secondes minimum.';
    }
    if (t.indexOf('no spoken audio') !== -1 || t.indexOf('silent') !== -1 || t.indexOf('silenc') !== -1) {
      return 'Aucune voix détectée. Vérifiez votre micro et parlez plus fort, plus près, pendant au moins 15 secondes.';
    }
    if (t.indexOf('too short') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('short') !== -1)) {
      return ERROR_MESSAGES.error_voice_file_duration_too_short;
    }
    if (t.indexOf('too long') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('long') !== -1)) {
      return ERROR_MESSAGES.error_voice_file_duration_too_long;
    }
    if (t.indexOf('multiple speakers') !== -1) return ERROR_MESSAGES.error_multiple_speakers_in_voice_enrollment;
    if (t.indexOf('speaker identifier not found') !== -1) return ERROR_MESSAGES.error_speaker_identifier_not_found;
    if (t.indexOf('speechmatics') !== -1 || t.indexOf('enrollment job') !== -1) {
      return 'L\'enregistrement vocal n\'a pas été accepté. Parlez clairement pendant 15 à 45 secondes dans un endroit calme.';
    }
    return '';
  }

  function isTechnicalErrorMessage(msg) {
    return /speechmatics|http\s*\d{3}|^\s*\{|"\s*code\s*"\s*:|exception/i.test(String(msg || ''));
  }

  function logVoiceApiError(tag, data) {
    console.warn(tag, data);
  }

  function formatApiError(data, fallback) {
    if (!data) return fallback || 'Une erreur est survenue.';
    var raw = data.errorMessage || data.message || data.error || '';
    if (typeof raw !== 'string') raw = String(raw);
    var codes = Object.keys(ERROR_MESSAGES);
    for (var i = 0; i < codes.length; i++) {
      if (raw.indexOf(codes[i]) !== -1 || data.exceptionName === codes[i]) return ERROR_MESSAGES[codes[i]];
    }
    var matched = matchVoiceErrorMessage(parseEmbeddedApiError(raw)) || matchVoiceErrorMessage(raw);
    if (matched) return matched;
    if (isTechnicalErrorMessage(raw)) return fallback || 'Impossible d\'enregistrer votre voix. Réessayez avec un enregistrement plus long et plus clair.';
    if (data.status === 'KO' && !raw) return fallback || 'Une erreur est survenue.';
    if (raw && raw.length <= 140 && !/[{}\[\]]/.test(raw)) return raw;
    return fallback || 'Une erreur est survenue.';
  }

  async function parseApiResponse(r) {
    var ct = String(r.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') === -1) {
      var text = await r.text();
      try { return JSON.parse(text); } catch (e) {
        throw new Error('Réponse serveur inattendue. Réessayez dans quelques instants.');
      }
    }
    return r.json();
  }

  function isInvalidAudioApiError(data) {
    if (!data) return false;
    var raw = String(data.errorMessage || data.message || data.error || '');
    var t = (raw + ' ' + parseEmbeddedApiError(raw)).toLowerCase();
    return t.indexOf('invalid audio') !== -1 || t.indexOf('job rejected') !== -1;
  }

  function getEnrollmentFileName(mimeType) {
    var mime = String(mimeType || '');
    if (mime.indexOf('mp4') !== -1) return 'voice-enrollment.mp4';
    if (mime.indexOf('ogg') !== -1) return 'voice-enrollment.ogg';
    return 'voice-enrollment.webm';
  }

  function validateName(firstName, lastName) {
    var fn = String(firstName || '').trim();
    var ln = String(lastName || '').trim();
    if (!fn || !ln) return 'Le prénom et le nom sont obligatoires.';
    if (RESERVED_LABELS.has(fn.toUpperCase()) || RESERVED_LABELS.has(ln.toUpperCase())) {
      return ERROR_MESSAGES.error_reserved_speaker_label;
    }
    return '';
  }

  function measureAudioDuration(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = function () {
        URL.revokeObjectURL(url);
        var d = audio.duration;
        if (!isFinite(d) || d <= 0) {
          reject(new Error('Impossible de lire la durée du fichier audio.'));
          return;
        }
        resolve(d);
      };
      audio.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error(ERROR_MESSAGES.error_invalid_audio_file_content));
      };
      audio.src = url;
    });
  }

  async function validateVoiceFileDuration(file) {
    var duration = await measureAudioDuration(file);
    if (duration < MIN_RECORD_SEC) throw new Error(ERROR_MESSAGES.error_voice_file_duration_too_short);
    if (duration > MAX_RECORD_SEC) throw new Error(ERROR_MESSAGES.error_voice_file_duration_too_long);
    return duration;
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
    var d = await parseApiResponse(r);
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
    return fetchAgiloTokenDirect(username, edition);
  }

  async function getCredentials() {
    var ms = await waitForMemberstack();
    var email = '';
    var firstName = '';
    var lastName = '';
    var edition = normEdition(localStorage.getItem('agilo:edition') || inferEditionFromLocation() || 'free');
    var member = null;
    if (ms) {
      try {
        var res = await ms.getCurrentMember();
        member = (res && res.data) || res || null;
        email = (member && member.auth && member.auth.email) || '';
        var cf = (member && member.customFields) || {};
        firstName = cf['first-name'] || cf.firstName || '';
        lastName = cf['last-name'] || cf.lastName || '';
      } catch (e) {
        console.warn('[agilo-voice-settings] getCurrentMember failed', e);
      }
      if (member) {
        edition = normEdition(localStorage.getItem('agilo:edition') || inferEditionFromLocation() || inferEditionFromMember(member));
      }
    }
    email = email || localStorage.getItem('agilo:username') || '';
    var token = await resolveToken(email, edition);
    return { username: email, token: token, edition: edition, firstName: firstName, lastName: lastName, memberstack: ms };
  }

  async function updateVoiceEnrolledFlag(ms, voicesCount) {
    if (!ms || typeof ms.updateMember !== 'function') return;
    var value = voicesCount > 0 ? 'true' : '';
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

  async function getSpeakerVoices(creds) {
    var body = buildAuthBody(creds);
    var r = await fetch(API_BASE + '/getSpeakerVoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'omit'
    });
    var d = await parseApiResponse(r);
    if (d.status === 'OK') {
      return { maxVoices: d.maxVoices || 0, voices: Array.isArray(d.voices) ? d.voices : [] };
    }
    throw new Error(formatApiError(d, 'Impossible de charger les empreintes vocales.'));
  }

  async function enrollSpeakerVoice(creds, firstName, lastName, voiceFile) {
    var form = new FormData();
    form.append('username', creds.username);
    form.append('token', creds.token);
    form.append('edition', creds.edition);
    form.append('firstName', String(firstName).trim());
    form.append('lastName', String(lastName).trim());
    form.append('voiceFile', voiceFile, voiceFile.name);
    var r = await fetch(API_BASE + '/enrollSpeakerVoice', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
      credentials: 'omit'
    });
    var d = await parseApiResponse(r);
    if (d.status === 'OK' && d.voiceId) return d;
    throw new Error(formatApiError(d, 'Impossible d\'enregistrer cette voix.'));
  }

  async function updateSpeakerVoice(creds, voiceId, firstName, lastName) {
    var body = buildAuthBody(creds);
    body.append('voiceId', String(voiceId));
    body.append('firstName', String(firstName).trim());
    body.append('lastName', String(lastName).trim());
    var r = await fetch(API_BASE + '/updateSpeakerVoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'omit'
    });
    var d = await parseApiResponse(r);
    if (d.status === 'OK') return d;
    throw new Error(formatApiError(d, 'Impossible de renommer cette voix.'));
  }

  async function deleteSpeakerVoice(creds, voiceId) {
    var body = buildAuthBody(creds);
    body.append('voiceId', String(voiceId));
    var r = await fetch(API_BASE + '/deleteSpeakerVoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'omit'
    });
    var d = await parseApiResponse(r);
    if (d.status === 'OK') return d;
    throw new Error(formatApiError(d, 'Impossible de supprimer cette voix.'));
  }

  async function createSpeakerVoiceInvite(creds, recipientName, recipientEmail) {
    var body = buildAuthBody(creds);
    body.append('recipientName', String(recipientName).trim());
    body.append('recipientEmail', String(recipientEmail).trim());
    var r = await fetch(API_BASE + '/createSpeakerVoiceInvite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'omit'
    });
    var d = await parseApiResponse(r);
    if (d.status === 'OK') return d;
    throw new Error(formatApiError(d, 'Impossible d\'envoyer l\'invitation.'));
  }

  function formatVoiceDate(raw) {
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return escapeHtml(String(raw));
    return escapeHtml(d.toLocaleString('fr-FR'));
  }

  function editionLabel(edition) {
    var e = normEdition(edition);
    if (e === 'ent') return 'Business';
    if (e === 'pro') return 'Pro';
    return 'Free';
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
      '.agilo-voice-quota{margin:0 0 16px;font-size:.9rem;color:var(--color--gris,#525252)}',
      '.agilo-voice-list{list-style:none;margin:0 0 16px;padding:0}',
      '.agilo-voice-item{padding:14px 0;border-bottom:1px solid rgba(82,82,82,.12)}',
      '.agilo-voice-item:last-child{border-bottom:none}',
      '.agilo-voice-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.agilo-voice-item-label{font-weight:600;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-item-meta{font-size:.82rem;color:var(--color--gris,#525252);margin-top:4px}',
      '.agilo-voice-item-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.agilo-voice-rename-row{display:none;flex-direction:column;gap:.5rem;margin-top:10px}',
      '.agilo-voice-rename-row.is-open{display:flex}',
      '.agilo-voice-name-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}',
      '.agilo-voice-section{margin-top:18px;padding-top:18px;border-top:1px solid rgba(82,82,82,.12)}',
      '.agilo-voice-section-title{margin:0 0 10px;font-size:1rem;font-weight:600}',
      '.agilo-voice-empty{margin:0 0 12px;color:var(--color--gris,#525252);font-size:.9rem;line-height:1.45}',
      '.agilo-voice-hero{position:relative;display:flex;align-items:center;justify-content:center;width:112px;height:112px;margin:0 auto 1.25rem}',
      '.agilo-voice-hero-ring{position:absolute;inset:0;border-radius:50%;background:rgba(23,74,150,.1);border:1px solid rgba(23,74,150,.18)}',
      '.agilo-voice-hero.is-recording .agilo-voice-hero-ring{background:rgba(168,38,51,.1);border-color:rgba(168,38,51,.25)}',
      '.agilo-voice-hero.is-preview .agilo-voice-hero-ring{background:rgba(28,102,26,.1);border-color:rgba(28,102,26,.22)}',
      '.agilo-voice-hero-icon{position:relative;z-index:2;width:44px;height:44px;color:var(--color--blue,#174a96)}',
      '.agilo-voice-hero.is-recording .agilo-voice-hero-icon{color:var(--color--rouge,#a82633)}',
      '.agilo-voice-hero.is-preview .agilo-voice-hero-icon{color:var(--color--vert,#1c661a)}',
      '.agilo-voice-waves{position:absolute;inset:0;pointer-events:none}',
      '.agilo-voice-wave{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(168,38,51,.35);animation:agilo-voice-pulse 2s ease-out infinite}',
      '.agilo-voice-wave:nth-child(2){animation-delay:.55s}',
      '.agilo-voice-wave:nth-child(3){animation-delay:1.1s}',
      '.agilo-voice-record-area{display:flex;flex-direction:column;gap:.75rem}',
      '.agilo-voice-label{display:block;margin:0;font-size:.9rem;font-weight:500}',
      '.agilo-voice-input{width:100%;box-sizing:border-box;border:1px solid rgba(82,82,82,.25);border-radius:' + AGILO_RADIUS + ';background:#fff;padding:10px 12px;font:inherit}',
      '.agilo-voice-input:disabled{opacity:.7;background:#f5f5f5}',
      '.agilo-voice-input:focus{outline:none;border-color:var(--color--blue,#174a96);box-shadow:0 0 0 2px rgba(23,74,150,.12)}',
      '.agilo-voice-record-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:52px;padding:.75rem 1.25rem;border:none;border-radius:' + AGILO_RADIUS + ';background:var(--color--blue,#174a96);color:#fff;font:inherit;font-weight:600;cursor:pointer}',
      '.agilo-voice-record-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.agilo-voice-record-btn.is-recording{background:var(--color--rouge,#a82633)}',
      '.agilo-voice-bar-row{display:none;flex-direction:column;gap:.35rem}',
      '.agilo-voice-bar-row.is-visible{display:flex}',
      '.agilo-voice-timer{font-size:.85rem;font-weight:600;color:var(--color--gris,#525252);text-align:center}',
      '.agilo-voice-progress{height:5px;background:rgba(82,82,82,.15);border-radius:999px;overflow:hidden}',
      '.agilo-voice-progress-bar{height:100%;width:0;background:var(--color--blue,#174a96);transition:width .1s linear}',
      '.agilo-voice-hint{font-size:.85rem;color:var(--color--gris,#525252);margin:0;text-align:center;line-height:1.45}',
      '.agilo-voice-audio{width:100%}',
      '.agilo-voice-file-link{display:block;margin:.5rem auto 0;text-align:center;font-size:.85rem;color:var(--color--blue,#174a96);cursor:pointer}',
      '.agilo-voice-file-panel{display:none;margin-top:.5rem}',
      '.agilo-voice-file-panel.is-open{display:block}',
      '.agilo-voice-file{width:100%;box-sizing:border-box;padding:8px;border:1px solid rgba(82,82,82,.25);border-radius:' + AGILO_RADIUS + ';background:#fff}',
      '.agilo-voice-btn{display:inline-block;cursor:pointer;border-radius:' + AGILO_RADIUS + ';padding:8px 14px;font:inherit;font-weight:600;border:1px solid rgba(82,82,82,.25);background:#fff;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-btn-primary{background:var(--color--blue,#174a96);color:#fff;border-color:transparent;width:100%}',
      '.agilo-voice-btn-danger{color:var(--color--rouge,#a82633);border-color:rgba(168,38,51,.25)}',
      '.agilo-voice-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.agilo-voice-btn-submit{display:none;width:100%}',
      '.agilo-voice-btn-submit.is-visible{display:inline-block}',
      '.agilo-voice-status{margin-top:.5rem;padding:10px 12px;border-radius:' + AGILO_RADIUS + ';font-size:.9rem;display:none}',
      '.agilo-voice-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '.agilo-voice-status.is-success{display:block;background:rgba(28,102,26,.1);color:var(--color--vert,#1c661a)}',
      '.agilo-voice-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '.agilo-voice-free-badge{margin-top:12px;padding:10px 14px;background:rgba(23,74,150,.08);border:1px solid rgba(23,74,150,.2);border-radius:' + AGILO_RADIUS + '}',
      '.agilo-voice-free-badge a{color:var(--color--blue,#174a96);font-weight:600;text-decoration:none}',
      '.agilo-voice-panel{display:none}',
      '.agilo-voice-panel.is-open{display:block}',
      '@media(max-width:560px){.agilo-voice-name-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
  }

  function getSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return 'audio/webm';
    var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return 'audio/webm';
  }

  function setStatusEl(el, type, message) {
    if (!el) return;
    el.className = 'agilo-voice-status';
    if (!message) return;
    el.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
    el.textContent = message;
  }

  function mountRecordForm(container, creds, options, statusEl) {
    options = options || {};
    var locked = !!options.lockNames;
    var firstName = options.firstName || creds.firstName || '';
    var lastName = options.lastName || creds.lastName || '';

    container.innerHTML = [
      '<div class="agilo-voice-hero is-idle" id="agilo-voice-hero">',
      '  <div class="agilo-voice-waves" id="agilo-voice-waves" style="display:none"><span class="agilo-voice-wave"></span><span class="agilo-voice-wave"></span><span class="agilo-voice-wave"></span></div>',
      '  <div class="agilo-voice-hero-ring"></div>',
      '  <div id="agilo-voice-hero-icon">' + MIC_SVG + '</div>',
      '</div>',
      '<div class="agilo-voice-record-area">',
      '  <div class="agilo-voice-name-grid">',
      '    <div><label class="agilo-voice-label" for="agilo-voice-first-name">Prénom</label>',
      '    <input class="agilo-voice-input" id="agilo-voice-first-name" type="text" maxlength="80" value="' + escapeHtml(firstName) + '"' + (locked ? ' disabled' : '') + '></div>',
      '    <div><label class="agilo-voice-label" for="agilo-voice-last-name">Nom</label>',
      '    <input class="agilo-voice-input" id="agilo-voice-last-name" type="text" maxlength="80" value="' + escapeHtml(lastName) + '"' + (locked ? ' disabled' : '') + '></div>',
      '  </div>',
      '  <button type="button" class="agilo-voice-record-btn button-wp2024 next w-button" id="agilo-voice-record-btn">',
      '    <span id="agilo-voice-record-btn-label">Démarrer l\'enregistrement</span>',
      '  </button>',
      '  <div class="agilo-voice-bar-row" id="agilo-voice-bar-row"><div class="agilo-voice-timer" id="agilo-voice-timer"></div>',
      '  <div class="agilo-voice-progress"><div class="agilo-voice-progress-bar" id="agilo-voice-progress"></div></div></div>',
      '  <audio class="agilo-voice-audio" id="agilo-voice-preview" controls style="display:none"></audio>',
      '  <p class="agilo-voice-hint" id="agilo-voice-hint">Parlez clairement, seul(e), 15 à 45 secondes.</p>',
      '</div>',
      '<a class="agilo-voice-file-link" id="agilo-voice-toggle-file" href="#" role="button">Importer un fichier audio</a>',
      '<div class="agilo-voice-file-panel" id="agilo-voice-file-panel">',
      '  <input class="agilo-voice-file" id="agilo-voice-file" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/webm,audio/*">',
      '  <p class="agilo-voice-hint">MP3, WAV, webm ou mp4 — 15 à 45 secondes de votre voix seule.</p>',
      '</div>',
      '<button type="button" class="agilo-voice-btn agilo-voice-btn-primary agilo-voice-btn-submit button-wp2024 next w-button" id="agilo-voice-submit">Enregistrer cette voix</button>'
    ].join('');

    var state = { uiState: 'idle', recording: false, elapsedMs: 0, timerId: null, mediaRecorder: null, mediaStream: null, audioChunks: [], recordedBlob: null, recordedFileName: 'voice-enrollment.webm', fileMode: false };
    var els = {
      hero: container.querySelector('#agilo-voice-hero'),
      heroIcon: container.querySelector('#agilo-voice-hero-icon'),
      waves: container.querySelector('#agilo-voice-waves'),
      firstName: container.querySelector('#agilo-voice-first-name'),
      lastName: container.querySelector('#agilo-voice-last-name'),
      recordBtn: container.querySelector('#agilo-voice-record-btn'),
      recordBtnLabel: container.querySelector('#agilo-voice-record-btn-label'),
      barRow: container.querySelector('#agilo-voice-bar-row'),
      timer: container.querySelector('#agilo-voice-timer'),
      progress: container.querySelector('#agilo-voice-progress'),
      hint: container.querySelector('#agilo-voice-hint'),
      preview: container.querySelector('#agilo-voice-preview'),
      fileLink: container.querySelector('#agilo-voice-toggle-file'),
      filePanel: container.querySelector('#agilo-voice-file-panel'),
      fileInput: container.querySelector('#agilo-voice-file'),
      submitBtn: container.querySelector('#agilo-voice-submit')
    };

    function formatTime(ms) {
      var sec = Math.floor(ms / 1000);
      return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }

    function updateTimerUI() {
      if (state.uiState === 'recording' || state.uiState === 'preview') {
        els.barRow.classList.add('is-visible');
        els.timer.textContent = formatTime(state.elapsedMs) + ' / 00:45';
        els.progress.style.width = Math.min(100, (state.elapsedMs / (MAX_RECORD_SEC * 1000)) * 100) + '%';
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
        els.recordBtn.disabled = state.elapsedMs < MIN_RECORD_SEC * 1000;
        els.hint.textContent = 'Parlez naturellement — minimum 15 secondes.';
        els.preview.style.display = 'none';
        els.submitBtn.classList.remove('is-visible');
      } else if (state.uiState === 'preview' || state.uiState === 'file') {
        els.hero.classList.add('is-preview');
        els.heroIcon.innerHTML = CHECK_SVG;
        els.waves.style.display = 'none';
        els.recordBtn.classList.remove('is-recording');
        els.recordBtnLabel.textContent = state.uiState === 'preview' ? 'Réenregistrer' : 'Démarrer l\'enregistrement';
        els.recordBtn.disabled = false;
        els.hint.textContent = state.uiState === 'preview' ? 'Écoutez votre enregistrement, puis validez.' : 'Fichier sélectionné — validez pour envoyer.';
        els.preview.style.display = state.uiState === 'preview' ? 'block' : 'none';
        els.submitBtn.classList.add('is-visible');
      } else {
        els.hero.classList.add('is-idle');
        els.heroIcon.innerHTML = MIC_SVG;
        els.waves.style.display = 'none';
        els.recordBtn.classList.remove('is-recording');
        els.recordBtnLabel.textContent = 'Démarrer l\'enregistrement';
        els.recordBtn.disabled = false;
        els.hint.textContent = 'Parlez clairement, seul(e), 15 à 45 secondes.';
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

    function getVoiceFile() {
      if (state.fileMode && els.fileInput.files && els.fileInput.files[0]) return els.fileInput.files[0];
      if (state.recordedBlob) return new File([state.recordedBlob], state.recordedFileName, { type: state.recordedBlob.type || 'audio/webm' });
      return null;
    }

    async function startRecording() {
      setStatusEl(statusEl, '', '');
      if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
        setStatusEl(statusEl, 'error', 'Micro non disponible. Importez un fichier audio.');
        return;
      }
      try {
        if (state.uiState === 'preview') {
          state.recordedBlob = null;
          els.preview.removeAttribute('src');
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
          if (!state.audioChunks.length) return;
          state.recordedBlob = new Blob(state.audioChunks, { type: mimeType });
          els.preview.src = URL.createObjectURL(state.recordedBlob);
          state.uiState = 'preview';
          updateUIState();
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
        setStatusEl(statusEl, 'error', 'Accès micro refusé. Importez un fichier audio.');
        cleanupStream();
      }
    }

    function stopRecording() {
      if (!state.recording || !state.mediaRecorder || state.elapsedMs < MIN_RECORD_SEC * 1000) return;
      state.recording = false;
      clearInterval(state.timerId);
      state.timerId = null;
      try { if (state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop(); } catch (e) { /* noop */ }
      cleanupStream();
    }

    els.recordBtn.addEventListener('click', function () {
      if (state.uiState === 'recording') stopRecording();
      else startRecording();
    });

    els.fileLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (state.recording) return;
      var open = els.filePanel.classList.toggle('is-open');
      els.fileLink.textContent = open ? 'Masquer l\'import de fichier' : 'Importer un fichier audio';
    });

    els.fileInput.addEventListener('change', async function () {
      setStatusEl(statusEl, '', '');
      if (!els.fileInput.files || !els.fileInput.files[0]) {
        state.fileMode = false;
        if (!state.recordedBlob) state.uiState = 'idle';
        updateUIState();
        return;
      }
      try {
        await validateVoiceFileDuration(els.fileInput.files[0]);
        state.fileMode = true;
        state.recordedBlob = null;
        els.preview.removeAttribute('src');
        state.uiState = 'file';
        updateUIState();
      } catch (err) {
        els.fileInput.value = '';
        state.fileMode = false;
        state.uiState = 'idle';
        updateUIState();
        setStatusEl(statusEl, 'error', err.message || ERROR_MESSAGES.error_invalid_audio_file_content);
      }
    });

    els.submitBtn.addEventListener('click', async function () {
      setStatusEl(statusEl, '', '');
      var nameErr = validateName(els.firstName.value, els.lastName.value);
      if (nameErr) {
        setStatusEl(statusEl, 'error', nameErr);
        return;
      }
      var voiceFile = getVoiceFile();
      if (!voiceFile) {
        setStatusEl(statusEl, 'error', 'Enregistrez votre voix ou importez un fichier.');
        return;
      }
      if (state.fileMode) {
        try {
          await validateVoiceFileDuration(voiceFile);
        } catch (err) {
          setStatusEl(statusEl, 'error', err.message);
          return;
        }
      } else if (state.elapsedMs < MIN_RECORD_SEC * 1000 && state.recordedBlob) {
        setStatusEl(statusEl, 'error', ERROR_MESSAGES.error_voice_file_duration_too_short);
        return;
      }
      els.submitBtn.disabled = true;
      els.recordBtn.disabled = true;
      setStatusEl(statusEl, 'info', 'Envoi de l\'empreinte vocale…');
      try {
        await enrollSpeakerVoice(creds, els.firstName.value, els.lastName.value, voiceFile);
        setStatusEl(statusEl, 'success', 'Voix enregistrée.');
        if (typeof options.onSuccess === 'function') await options.onSuccess();
      } catch (e) {
        setStatusEl(statusEl, 'error', e.message || 'Impossible d\'enregistrer cette voix.');
        if (isInvalidAudioApiError({ errorMessage: e.message })) els.filePanel.classList.add('is-open');
      } finally {
        els.submitBtn.disabled = false;
        els.recordBtn.disabled = false;
      }
    });

    updateUIState();
  }

  function buildMainMarkup(data, creds) {
    var isFree = normEdition(creds.edition) === 'free';
    var voices = data.voices || [];
    var maxVoices = data.maxVoices || 0;
    var atQuota = !isFree && maxVoices > 0 && voices.length >= maxVoices;

    var listHtml = voices.length
      ? voices.map(function (v) {
          var label = escapeHtml(v.speakerLabel || ((v.firstName || '') + ' ' + (v.lastName || '')).trim() || '—');
          var date = formatVoiceDate(v.dtUpdate);
          return [
            '<li class="agilo-voice-item" data-voice-id="' + escapeHtml(String(v.voiceId)) + '">',
            '  <div class="agilo-voice-item-head">',
            '    <div><div class="agilo-voice-item-label">' + label + '</div>',
            date ? ('      <div class="agilo-voice-item-meta">Mise à jour : ' + date + '</div>') : '',
            '    </div></div>',
            '  <div class="agilo-voice-item-actions">',
            '    <button type="button" class="agilo-voice-btn agilo-voice-rename-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" data-first="' + escapeHtml(v.firstName || '') + '" data-last="' + escapeHtml(v.lastName || '') + '">Renommer</button>',
            '    <button type="button" class="agilo-voice-btn agilo-voice-replace-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" data-first="' + escapeHtml(v.firstName || '') + '" data-last="' + escapeHtml(v.lastName || '') + '">Remplacer l\'audio</button>',
            '    <button type="button" class="agilo-voice-btn agilo-voice-btn-danger agilo-voice-delete-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" data-label="' + label + '">Supprimer</button>',
            '  </div>',
            '  <div class="agilo-voice-rename-row" id="agilo-voice-rename-' + escapeHtml(String(v.voiceId)) + '">',
            '    <div class="agilo-voice-name-grid">',
            '      <div><label class="agilo-voice-label">Prénom</label><input class="agilo-voice-input agilo-voice-rename-first" type="text" value="' + escapeHtml(v.firstName || '') + '"></div>',
            '      <div><label class="agilo-voice-label">Nom</label><input class="agilo-voice-input agilo-voice-rename-last" type="text" value="' + escapeHtml(v.lastName || '') + '"></div>',
            '    </div>',
            '    <button type="button" class="agilo-voice-btn agilo-voice-btn-primary agilo-voice-save-rename" data-voice-id="' + escapeHtml(String(v.voiceId)) + '">Enregistrer le nom</button>',
            '  </div>',
            '  <div class="agilo-voice-panel agilo-voice-replace-panel" id="agilo-voice-replace-' + escapeHtml(String(v.voiceId)) + '"></div>',
            '</li>'
          ].join('');
        }).join('')
      : '<p class="agilo-voice-empty">Aucune voix enregistrée pour le moment.</p>';

    var quotaText = isFree
      ? 'Disponible avec un abonnement Pro ou Business.'
      : (voices.length + ' / ' + maxVoices + ' voix enregistrées (' + editionLabel(creds.edition) + ')');

    return [
      '<div class="agilo-voice-wrap">',
      '  <div class="agilo-voice-card">',
      '    <h2 class="agilo-voice-title heading-style-h2">Empreinte vocale</h2>',
      '    <p class="agilo-voice-quota">' + escapeHtml(quotaText) + '</p>',
      '    <div class="agilo-voice-list-wrap">' + (voices.length ? '<ul class="agilo-voice-list">' + listHtml + '</ul>' : listHtml) + '</div>',
      '    <div class="agilo-voice-status" id="agilo-voice-main-status" role="status"></div>',
      isFree ? '<div class="agilo-voice-free-badge text-size-small">La reconnaissance automatique de votre voix dans les transcriptions est disponible avec un abonnement <a href="/pricing">Pro ou Business</a>.</div>' : '',
      !isFree && !atQuota ? [
        '    <div class="agilo-voice-section">',
        '      <h3 class="agilo-voice-section-title">Ajouter une voix</h3>',
        '      <button type="button" class="agilo-voice-btn agilo-voice-btn-primary" id="agilo-voice-toggle-add">+ Ajouter une voix</button>',
        '      <div class="agilo-voice-panel" id="agilo-voice-add-panel"></div>',
        '    </div>',
        '    <div class="agilo-voice-section">',
        '      <h3 class="agilo-voice-section-title">Inviter par email</h3>',
        '      <p class="agilo-voice-empty">Agilotext enverra un email avec un lien d\'enregistrement — aucun compte requis pour l\'invité.</p>',
        '      <div class="agilo-voice-name-grid">',
        '        <div><label class="agilo-voice-label" for="agilo-voice-invite-name">Nom affiché</label>',
        '        <input class="agilo-voice-input" id="agilo-voice-invite-name" type="text" placeholder="Ex. Marie Dupont"></div>',
        '        <div><label class="agilo-voice-label" for="agilo-voice-invite-email">Email</label>',
        '        <input class="agilo-voice-input" id="agilo-voice-invite-email" type="email" placeholder="collegue@entreprise.com"></div>',
        '      </div>',
        '      <button type="button" class="agilo-voice-btn agilo-voice-btn-primary" id="agilo-voice-send-invite" style="margin-top:10px">Envoyer l\'invitation</button>',
        '    </div>'
      ].join('') : '',
      atQuota ? '<p class="agilo-voice-empty">Quota atteint. Supprimez une voix pour en ajouter ou inviter quelqu\'un.</p>' : '',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderMainView(container, creds, data, reload) {
    injectStyles();
    container.innerHTML = buildMainMarkup(data, creds);
    var statusEl = container.querySelector('#agilo-voice-main-status');
    var isFree = normEdition(creds.edition) === 'free';

    container.querySelectorAll('.agilo-voice-rename-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-voice-id');
        var row = container.querySelector('#agilo-voice-rename-' + id);
        if (row) row.classList.toggle('is-open');
      });
    });

    container.querySelectorAll('.agilo-voice-save-rename').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-voice-id');
        var row = container.querySelector('#agilo-voice-rename-' + id);
        var fn = row.querySelector('.agilo-voice-rename-first').value;
        var ln = row.querySelector('.agilo-voice-rename-last').value;
        var nameErr = validateName(fn, ln);
        if (nameErr) {
          setStatusEl(statusEl, 'error', nameErr);
          return;
        }
        btn.disabled = true;
        setStatusEl(statusEl, 'info', 'Mise à jour du nom…');
        try {
          await updateSpeakerVoice(creds, id, fn, ln);
          setStatusEl(statusEl, 'success', 'Nom mis à jour.');
          await reload();
        } catch (e) {
          setStatusEl(statusEl, 'error', e.message);
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll('.agilo-voice-replace-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-voice-id');
        var panel = container.querySelector('#agilo-voice-replace-' + id);
        if (!panel) return;
        var isOpen = panel.classList.toggle('is-open');
        if (!isOpen) {
          panel.innerHTML = '';
          return;
        }
        mountRecordForm(panel, creds, {
          lockNames: true,
          firstName: btn.getAttribute('data-first') || '',
          lastName: btn.getAttribute('data-last') || '',
          onSuccess: reload
        }, statusEl);
      });
    });

    container.querySelectorAll('.agilo-voice-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-voice-id');
        var label = btn.getAttribute('data-label') || 'cette voix';
        if (!window.confirm('Supprimer la voix « ' + label + ' » ?')) return;
        btn.disabled = true;
        setStatusEl(statusEl, 'info', 'Suppression…');
        try {
          await deleteSpeakerVoice(creds, id);
          setStatusEl(statusEl, 'success', 'Voix supprimée.');
          await reload();
        } catch (e) {
          setStatusEl(statusEl, 'error', e.message);
          btn.disabled = false;
        }
      });
    });

    if (!isFree) {
      var toggleAdd = container.querySelector('#agilo-voice-toggle-add');
      var addPanel = container.querySelector('#agilo-voice-add-panel');
      if (toggleAdd && addPanel) {
        toggleAdd.addEventListener('click', function () {
          var isOpen = addPanel.classList.toggle('is-open');
          toggleAdd.textContent = isOpen ? 'Masquer le formulaire' : '+ Ajouter une voix';
          if (isOpen && !addPanel.dataset.mounted) {
            addPanel.dataset.mounted = '1';
            mountRecordForm(addPanel, creds, { onSuccess: reload }, statusEl);
          }
        });
      }

      var inviteBtn = container.querySelector('#agilo-voice-send-invite');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', async function () {
          var nameInput = container.querySelector('#agilo-voice-invite-name');
          var emailInput = container.querySelector('#agilo-voice-invite-email');
          var recipientName = String(nameInput && nameInput.value || '').trim();
          var recipientEmail = String(emailInput && emailInput.value || '').trim();
          if (!recipientName) {
            setStatusEl(statusEl, 'error', ERROR_MESSAGES.error_invalid_recipient_name);
            return;
          }
          if (!recipientEmail || recipientEmail.indexOf('@') === -1) {
            setStatusEl(statusEl, 'error', ERROR_MESSAGES.error_invalid_recipient_email);
            return;
          }
          inviteBtn.disabled = true;
          setStatusEl(statusEl, 'info', 'Envoi de l\'invitation…');
          try {
            await createSpeakerVoiceInvite(creds, recipientName, recipientEmail);
            setStatusEl(statusEl, 'success', 'Invitation envoyée à ' + recipientEmail + '. Votre collègue recevra un email Agilotext pour enregistrer sa voix.');
            if (nameInput) nameInput.value = '';
            if (emailInput) emailInput.value = '';
          } catch (e) {
            setStatusEl(statusEl, 'error', e.message);
          } finally {
            inviteBtn.disabled = false;
          }
        });
      }
    }
  }

  async function init() {
    var container = document.getElementById(AGILO_VOICE_CONFIG.containerId);
    if (!container) {
      console.warn('[agilo-voice-settings] Container #' + AGILO_VOICE_CONFIG.containerId + ' introuvable.');
      return;
    }

    container.innerHTML = '<p style="color:#666">Chargement des empreintes vocales…</p>';

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
        var data = await getSpeakerVoices(creds);
        await updateVoiceEnrolledFlag(creds.memberstack, (data.voices || []).length);
        renderMainView(container, creds, data, reload);
      } catch (e) {
        console.error('[agilo-voice-settings] reload failed', e);
        container.innerHTML = '<p style="color:#580808">Impossible de charger les empreintes vocales. Rechargez la page.</p>';
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
