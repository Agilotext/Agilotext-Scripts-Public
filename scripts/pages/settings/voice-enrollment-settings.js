/* ================================================================
   AGILOTEXT - VOICE ENROLLMENT SETTINGS (API V2)
   Pages : /app/free/profile, /app/premium/profile, /app/business/profile
   Déploiement Webflow :
     1. Embed : <div id="agilo-voice-settings"></div>
     2. Script (pin SHA après push) :
        <script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@552f642/scripts/pages/settings/voice-enrollment-settings.js?v=1.09-voice19"></script>
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
  const TARIFS_URL = 'https://www.agilotext.com/tarifs';
  const INVITE_STORAGE_VERSION = 'v1';
  const INVITE_MAX_COUNT = 50;
  const INVITE_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;

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
    error_invalid_recipient_name: 'Le nom du destinataire est invalide.',
    error_speaker_voice_invite_not_found: 'L\'invitation n\'a pas pu être confirmée par le serveur. Vérifiez si l\'email est arrivé avant de réessayer.'
  };

  const ICON_EDIT = '<svg class="agilo-voice-btn-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_MIC_SM = '<svg class="agilo-voice-btn-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_TRASH = '<svg class="agilo-voice-btn-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_EMPTY_MIC = '<svg class="agilo-voice-empty-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STOP_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
  const WEBFLOW_SAVE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" class="icon-1x1-small white" aria-hidden="true"><path d="M15.25 4.5C15.25 4.22386 15.0261 4 14.75 4H9.25C8.97386 4 8.75 4.22386 8.75 4.5V7.59998C8.75 7.73805 8.86193 7.84998 9 7.84998H15C15.1381 7.84998 15.25 7.73805 15.25 7.59998V4.5Z" fill="currentColor"></path><path d="M8.25 20C8.25 20.2761 8.47386 20.5 8.75 20.5H15.25C15.5261 20.5 15.75 20.2761 15.75 20V15C15.75 14.8619 15.6381 14.75 15.5 14.75H8.5C8.36193 14.75 8.25 14.8619 8.25 15V20Z" fill="currentColor"></path><path d="M7.25 7.59998C7.25 8.56647 8.0335 9.34998 9 9.34998H15C15.9665 9.34998 16.75 8.56647 16.75 7.59998V4.27627C16.75 4.12369 16.8737 4 17.0263 4C17.1722 4 17.3108 4.06373 17.4058 4.17448L20.3685 7.62867C20.7791 8.1074 20.9936 8.72364 20.9689 9.35387L20.6273 18.0976C20.5749 19.4393 19.4719 20.5 18.1292 20.5H17.75C17.4739 20.5 17.25 20.2761 17.25 20V15C17.25 14.0335 16.4665 13.25 15.5 13.25H8.5C7.5335 13.25 6.75 14.0335 6.75 15V20C6.75 20.2761 6.52614 20.5 6.25 20.5H6.11291C4.90908 20.5 3.89276 19.6055 3.73989 18.4114C3.24597 14.5534 3.2247 10.6495 3.67653 6.78632L3.73742 6.26575C3.8885 4.97395 4.983 4 6.28361 4H6.75C7.02614 4 7.25 4.22386 7.25 4.5V7.59998Z" fill="currentColor"></path></svg>';
  const WEBFLOW_UPGRADE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" viewBox="0 0 24 24" class="icon-1x1-small white" aria-hidden="true"><rect fill="none" height="24" width="24"></rect><path d="M9.68,13.69L12,11.93l2.31,1.76l-0.88-2.85L15.75,9h-2.84L12,6.19L11.09,9H8.25l2.31,1.84L9.68,13.69z M20,10 c0-4.42-3.58-8-8-8s-8,3.58-8,8c0,2.03,0.76,3.87,2,5.28V23l6-2l6,2v-7.72C19.24,13.87,20,12.03,20,10z M12,4c3.31,0,6,2.69,6,6 s-2.69,6-6,6s-6-2.69-6-6S8.69,4,12,4z" fill="currentColor"></path></svg>';

  function getWebflowSaveIconHtml() {
    var svgs = document.querySelectorAll('.button.save svg.icon-1x1-small, button.save svg.icon-1x1-small');
    for (var i = 0; i < svgs.length; i++) {
      if (svgs[i].closest('#agilo-voice-submit, #agilo-voice-settings .button.save')) continue;
      var clone = svgs[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      return clone.outerHTML;
    }
    return WEBFLOW_SAVE_ICON;
  }

  function getWebflowUpgradeIconHtml() {
    var svgs = document.querySelectorAll('.button.upgrade svg.icon-1x1-small, button.upgrade svg.icon-1x1-small');
    for (var i = 0; i < svgs.length; i++) {
      if (svgs[i].closest('#agilo-voice-settings')) continue;
      var clone = svgs[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      return clone.outerHTML;
    }
    return WEBFLOW_UPGRADE_ICON;
  }

  function applyWebflowSaveButton(el, label) {
    if (!el) return;
    el.innerHTML = getWebflowSaveIconHtml() + '<div>' + escapeHtml(label) + '</div>';
  }

  function applyWebflowUpgradeButton(el, label) {
    if (!el) return;
    el.innerHTML = getWebflowUpgradeIconHtml() + '<div>' + escapeHtml(label) + '</div>';
  }

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

  function extractApiErrorCode(data) {
    if (!data) return '';
    if (data.exceptionName) return String(data.exceptionName);
    var raw = data.errorMessage || data.message || data.error || '';
    if (typeof raw !== 'string') raw = String(raw);
    var codes = Object.keys(ERROR_MESSAGES);
    for (var i = 0; i < codes.length; i++) {
      if (raw.indexOf(codes[i]) !== -1) return codes[i];
    }
    return '';
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

  function validateDisplayName(full) {
    var name = String(full || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) return 'Indiquez le prénom et le nom de la personne.';
    if (RESERVED_LABELS.has(name.toUpperCase())) return ERROR_MESSAGES.error_reserved_speaker_label;
    var parts = name.split(' ');
    for (var i = 0; i < parts.length; i++) {
      if (RESERVED_LABELS.has(parts[i].toUpperCase())) return ERROR_MESSAGES.error_reserved_speaker_label;
    }
    return '';
  }

  function splitDisplayName(full) {
    var name = String(full || '').trim().replace(/\s+/g, ' ');
    if (!name) return { firstName: '', lastName: '' };
    var idx = name.indexOf(' ');
    if (idx === -1) return { firstName: name, lastName: name };
    var lastName = name.slice(idx + 1).trim();
    return { firstName: name.slice(0, idx), lastName: lastName || name.slice(0, idx) };
  }

  function formatDisplayName(voiceOrFirst, lastName) {
    if (voiceOrFirst && typeof voiceOrFirst === 'object') {
      var v = voiceOrFirst;
      if (v.speakerLabel) return String(v.speakerLabel).trim();
      var fn = String(v.firstName || '').trim();
      var ln = String(v.lastName || '').trim();
      return (fn + ' ' + ln).trim();
    }
    return (String(voiceOrFirst || '').trim() + ' ' + String(lastName || '').trim()).trim();
  }

  function buildDefaultDisplayName(creds) {
    return formatDisplayName(creds) || '';
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

  async function fetchSpeakerVoiceAudio(creds, voiceId) {
    var body = buildAuthBody(creds);
    body.append('voiceId', String(voiceId));
    var r = await fetch(API_BASE + '/getSpeakerVoiceAudio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'audio/*, application/json' },
      body: body.toString(),
      credentials: 'omit'
    });
    var ct = String(r.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('audio/') !== -1) {
      if (!r.ok) throw new Error('Impossible de lire l\'audio enregistré.');
      return r.blob();
    }
    if (r.status === 404) {
      var missing = new Error('Lecture indisponible — mise à jour API en cours.');
      missing.agiloCode = 'endpoint_not_found';
      throw missing;
    }
    var d = await parseApiResponse(r);
    if (d.status === 'OK' && d.audioBase64) {
      var bin = atob(String(d.audioBase64));
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: d.mimeType || 'audio/mpeg' });
    }
    throw new Error(formatApiError(d, 'Impossible de lire l\'audio enregistré.'));
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
    console.warn('[agilo-voice-settings] createSpeakerVoiceInvite failed', { httpStatus: r.status, response: d });
    var inviteErr = new Error(formatApiError(d, 'Impossible d\'envoyer l\'invitation.'));
    inviteErr.agiloCode = extractApiErrorCode(d);
    throw inviteErr;
  }

  async function getSpeakerVoiceInvites(creds) {
    var body = buildAuthBody(creds);
    var r = await fetch(API_BASE + '/getSpeakerVoiceInvites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'omit'
    });
    if (r.status === 404) throw new Error('endpoint_not_available');
    var d = await parseApiResponse(r);
    if (d.status === 'OK') return d;
    throw new Error(formatApiError(d, 'Impossible de charger les invitations.'));
  }

  function getInviteStorageKey(creds) {
    return 'agilo:voice-invites:' + INVITE_STORAGE_VERSION + ':' + normEdition(creds.edition) + ':' + String(creds.username || '').toLowerCase();
  }

  function loadLocalInvites(creds) {
    try {
      var raw = localStorage.getItem(getInviteStorageKey(creds));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalInvites(creds, list) {
    try {
      localStorage.setItem(getInviteStorageKey(creds), JSON.stringify(list.slice(0, INVITE_MAX_COUNT)));
    } catch (e) {
      console.warn('[agilo-voice-settings] saveLocalInvites failed', e);
    }
  }

  function normalizeInviteLabel(str) {
    return String(str || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function voiceDisplayLabel(v) {
    return normalizeInviteLabel(v.speakerLabel || ((v.firstName || '') + ' ' + (v.lastName || '')).trim());
  }

  function inviteMatchesVoice(invite, voices) {
    var target = normalizeInviteLabel(invite.recipientName);
    if (!target) return false;
    for (var i = 0; i < voices.length; i++) {
      if (voiceDisplayLabel(voices[i]) === target) return true;
    }
    return false;
  }

  function reconcileLocalInvites(invites, voices) {
    var now = Date.now();
    var result = invites.map(function (inv) {
      var copy = Object.assign({}, inv);
      if (copy.status === 'completed') return copy;
      if (inviteMatchesVoice(copy, voices || [])) {
        copy.status = 'completed';
        return copy;
      }
      if (copy.status === 'pending' && copy.sentAt && (now - copy.sentAt) > INVITE_EXPIRE_MS) {
        copy.status = 'expired';
      }
      return copy;
    });
    result.sort(function (a, b) { return (b.sentAt || 0) - (a.sentAt || 0); });
    return result.slice(0, INVITE_MAX_COUNT);
  }

  function syncAndSaveLocalInvites(creds, voices) {
    var reconciled = reconcileLocalInvites(loadLocalInvites(creds), voices);
    saveLocalInvites(creds, reconciled);
    return reconciled;
  }

  function upsertLocalInvite(creds, recipientName, recipientEmail) {
    var list = loadLocalInvites(creds);
    var emailKey = String(recipientEmail || '').toLowerCase().trim();
    var now = Date.now();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].recipientEmail || '').toLowerCase().trim() === emailKey) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      list[idx].recipientName = String(recipientName).trim();
      list[idx].sentAt = now;
      list[idx].status = 'pending';
      list[idx].source = 'local';
    } else {
      list.unshift({
        id: 'inv_' + now + '_' + Math.random().toString(36).slice(2, 8),
        recipientName: String(recipientName).trim(),
        recipientEmail: emailKey,
        sentAt: now,
        status: 'pending',
        source: 'local'
      });
    }
    list.sort(function (a, b) { return (b.sentAt || 0) - (a.sentAt || 0); });
    saveLocalInvites(creds, list);
    return list;
  }

  function removeLocalInvite(creds, inviteId) {
    var list = loadLocalInvites(creds).filter(function (inv) { return inv.id !== inviteId; });
    saveLocalInvites(creds, list);
    return list;
  }

  async function loadInvites(creds, voices) {
    try {
      var d = await getSpeakerVoiceInvites(creds);
      if (d && Array.isArray(d.invites)) {
        return {
          source: 'api',
          invites: d.invites.map(function (inv) {
            return {
              id: String(inv.inviteId || inv.id || ''),
              recipientName: inv.recipientName || '',
              recipientEmail: inv.recipientEmail || '',
              sentAt: inv.dtSent ? new Date(inv.dtSent).getTime() : (inv.sentAt || 0),
              status: inv.status || 'pending',
              source: 'api'
            };
          })
        };
      }
    } catch (e) {
      console.warn('[agilo-voice-settings] invites API fallback local', e);
    }
    return { source: 'local', invites: syncAndSaveLocalInvites(creds, voices || []) };
  }

  function countPendingInvites(inviteData) {
    return ((inviteData && inviteData.invites) || [])
      .filter(function (i) { return i.status === 'pending'; }).length;
  }

  function formatQuotaBadge(used, max) {
    var label = max === 1 ? 'empreinte vocale' : 'empreintes vocales';
    return used + ' / ' + max + ' ' + label;
  }

  function inviteStatusLabel(status) {
    if (status === 'completed') return 'Enregistrée';
    if (status === 'expired') return 'Expirée';
    return 'En attente';
  }

  function inviteStatusClass(status) {
    if (status === 'completed') return 'agilo-voice-invite-status--completed';
    if (status === 'expired') return 'agilo-voice-invite-status--expired';
    return 'agilo-voice-invite-status--pending';
  }

  function buildInviteHistoryHtml(inviteData) {
    var invites = (inviteData && inviteData.invites) || [];
    var source = (inviteData && inviteData.source) || 'local';
    var noteHtml = source === 'api'
      ? ''
      : '<p class="agilo-voice-invite-history-note">Historique local à cet appareil — synchronisation serveur prochaine.</p>';

    if (!invites.length) {
      return [
        '<div class="agilo-voice-invite-history" id="agilo-voice-invite-history">',
        '  <h4 class="agilo-voice-invite-history-title">Invitations envoyées</h4>',
        '  <p class="agilo-voice-empty">Aucune invitation enregistrée sur cet appareil.</p>',
        noteHtml,
        '</div>'
      ].join('');
    }

    var items = invites.map(function (inv) {
      var initials = escapeHtml(voiceInitials('', '', inv.recipientName));
      var name = escapeHtml(inv.recipientName || '—');
      var email = escapeHtml(inv.recipientEmail || '');
      var date = inv.sentAt ? formatVoiceDate(new Date(inv.sentAt).toISOString()) : '';
      var status = inv.status || 'pending';
      var actionsHtml = status === 'completed' ? '' : [
        '    <div class="agilo-voice-item-actions">',
        '      <button type="button" class="agilo-voice-btn agilo-voice-btn-ghost agilo-voice-resend-invite" data-name="' + escapeHtml(inv.recipientName || '') + '" data-email="' + escapeHtml(inv.recipientEmail || '') + '">Renvoyer</button>',
        inv.source !== 'api' ? '      <button type="button" class="agilo-voice-btn agilo-voice-btn-ghost agilo-voice-remove-invite" data-invite-id="' + escapeHtml(inv.id) + '">Retirer</button>' : '',
        '    </div>'
      ].join('');
      return [
        '<li class="agilo-voice-item agilo-voice-invite-item" data-invite-id="' + escapeHtml(inv.id) + '">',
        '  <div class="agilo-voice-avatar" aria-hidden="true">' + initials + '</div>',
        '  <div class="agilo-voice-item-body">',
        '    <div class="agilo-voice-item-label">' + name + ' <span class="agilo-voice-invite-status ' + inviteStatusClass(status) + '">' + escapeHtml(inviteStatusLabel(status)) + '</span></div>',
        '    <div class="agilo-voice-item-meta">' + email + (date ? ' · Envoyée le ' + date : '') + '</div>',
        actionsHtml,
        '  </div>',
        '</li>'
      ].join('');
    }).join('');

    return [
      '<div class="agilo-voice-invite-history" id="agilo-voice-invite-history">',
      '  <h4 class="agilo-voice-invite-history-title">Invitations envoyées</h4>',
      '  <ul class="agilo-voice-list">' + items + '</ul>',
      noteHtml,
      '</div>'
    ].join('');
  }

  async function sendInviteAndPersist(creds, recipientName, recipientEmail, statusEl) {
    try {
      await createSpeakerVoiceInvite(creds, recipientName, recipientEmail);
      upsertLocalInvite(creds, recipientName, recipientEmail);
      setStatusEl(statusEl, 'success', 'Invitation envoyée à ' + recipientEmail + '. Votre collègue recevra un email Agilotext pour enregistrer sa voix.');
      return true;
    } catch (e) {
      if (e && e.agiloCode === 'error_speaker_voice_invite_not_found') {
        upsertLocalInvite(creds, recipientName, recipientEmail);
        setStatusEl(statusEl, 'info', 'Email probablement envoyé à ' + recipientEmail + '. Vérifiez la boîte de votre collègue avant de réessayer.');
        return true;
      }
      setStatusEl(statusEl, 'error', e.message || 'Impossible d\'envoyer l\'invitation.');
      return false;
    }
  }

  function voiceInitials(firstName, lastName, speakerLabel) {
    var fn = String(firstName || '').trim();
    var ln = String(lastName || '').trim();
    if (fn || ln) return ((fn.charAt(0) || '') + (ln.charAt(0) || '')).toUpperCase() || '?';
    var parts = String(speakerLabel || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return '?';
  }

  function isVoiceSettingsDeepLink() {
    return (window.location.hash || '').replace(/^#/, '') === 'agilo-voice-settings';
  }

  function activateProfileTabIfNeeded() {
    if (typeof window.ensureTab === 'function') {
      window.ensureTab('profile');
      return;
    }
    var link = document.querySelector('.account-link[data-tab="profile"]');
    if (link) link.click();
  }

  function scrollToVoiceSectionIfNeeded() {
    if (!isVoiceSettingsDeepLink()) return;

    activateProfileTabIfNeeded();

    function doScroll(attempt) {
      var target = document.getElementById('agilo-voice-settings');
      if (!target) {
        if (attempt < 24) setTimeout(function () { doScroll(attempt + 1); }, 150);
        return;
      }

      var panel = target.closest('#profile, [data-panel="profile"]');
      if (panel && panel.hidden) activateProfileTabIfNeeded();

      requestAnimationFrame(function () {
        var offset = 88;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
    }

    setTimeout(function () { doScroll(0); }, 180);
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
      '.agilo-voice-wrap{max-width:100%;width:100%;font-family:inherit;color:var(--color--gris_foncé,#020202)}',
      '#agilo-voice-settings{scroll-margin-top:5.5rem}',
      '.agilo-voice-card{background:transparent;border:none;border-radius:0;padding:0;margin-bottom:0}',
      '.agilo-voice-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin-bottom:18px}',
      '.agilo-voice-quota-badge{display:inline-flex;align-items:center;padding:4px 11px;font-size:.78rem;font-weight:600;color:var(--color--blue,#174a96);background:rgba(23,74,150,.08);border-radius:999px;line-height:1.3}',
      '.agilo-voice-list{list-style:none;margin:0 0 8px;padding:0}',
      '.agilo-voice-item{display:flex;gap:14px;align-items:flex-start;padding:16px 0;border-bottom:1px solid rgba(82,82,82,.1)}',
      '.agilo-voice-item:last-child{border-bottom:none}',
      '.agilo-voice-avatar{flex-shrink:0;width:44px;height:44px;border-radius:50%;background:rgba(23,74,150,.1);color:var(--color--blue,#174a96);font-weight:700;font-size:.82rem;letter-spacing:.02em;display:flex;align-items:center;justify-content:center}',
      '.agilo-voice-item-body{flex:1;min-width:0}',
      '.agilo-voice-item-label{font-weight:600;font-size:1rem;color:var(--color--gris_foncé,#020202);line-height:1.3}',
      '.agilo-voice-item-meta{font-size:.8rem;color:var(--color--gris,#525252);margin-top:4px}',
      '.agilo-voice-item-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.agilo-voice-rename-row{display:none;flex-direction:column;gap:.5rem;margin-top:12px}',
      '.agilo-voice-rename-row.is-open{display:flex}',
      '.agilo-voice-name-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}',
      '.agilo-voice-name-single{display:flex;flex-direction:column;gap:.45rem}',
      '.agilo-voice-listen-panel{display:none;flex-direction:column;gap:.5rem;margin-top:10px}',
      '.agilo-voice-listen-panel.is-open{display:flex}',
      '.agilo-voice-listen-status{font-size:.82rem;color:var(--color--gris,#525252);margin:0}',
      '.agilo-voice-listen-player{display:none;align-items:center;gap:10px}',
      '.agilo-voice-listen-player.is-visible{display:flex}',
      '.agilo-voice-section{margin-top:22px;padding-top:22px;border-top:1px solid rgba(82,82,82,.1)}',
      '.agilo-voice-section-title{margin:0 0 10px;font-size:1rem;font-weight:600;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-section-desc{margin:0 0 1.25rem;color:var(--color--gris,#525252);font-size:.88rem;line-height:1.5}',
      '.agilo-voice-lead{margin-top:0;margin-bottom:1rem;color:var(--color--gris,#525252);font-size:.9rem;line-height:1.5}',
      '.agilo-voice-empty{margin:0;color:var(--color--gris,#525252);font-size:.88rem;line-height:1.5}',
      '.agilo-voice-empty-state{display:flex;flex-direction:column;align-items:center;text-align:center;padding:28px 16px 20px;margin-bottom:8px}',
      '.agilo-voice-empty-icon{width:52px;height:52px;border-radius:50%;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96);display:flex;align-items:center;justify-content:center;margin-bottom:12px}',
      '.agilo-voice-empty-icon-svg{width:26px;height:26px}',
      '.agilo-voice-empty-title{margin:0 0 6px;font-weight:600;font-size:1rem;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-hero{position:relative;display:flex;align-items:center;justify-content:center;width:112px;height:112px;margin:0 auto;cursor:pointer;transition:transform .15s ease}',
      '.agilo-voice-hero:hover{transform:scale(1.03)}',
      '.agilo-voice-hero-wrap{text-align:center;margin:.75rem 0 .5rem}',
      '.agilo-voice-hero-label{margin:.75rem 0 0;font-size:.88rem;color:var(--color--gris,#525252);line-height:1.4}',
      '.agilo-voice-timer-compact{display:none;margin-top:.5rem;font-size:1rem;font-weight:700;color:var(--color--rouge,#a82633);letter-spacing:.02em}',
      '.agilo-voice-timer-compact.is-visible{display:block}',
      '.agilo-voice-rerecord-link{display:none;margin:.5rem auto 0;text-align:center;font-size:.85rem;color:var(--color--blue,#174a96);cursor:pointer;background:none;border:none;font:inherit;text-decoration:underline}',
      '.agilo-voice-mini-player{display:none;align-items:center;justify-content:center;gap:10px;margin-top:.5rem}',
      '.agilo-voice-mini-player.is-visible{display:flex}',
      '.agilo-voice-play-btn{width:36px;height:36px;border-radius:50%;border:1px solid rgba(82,82,82,.22);background:#fff;color:var(--color--gris_foncé,#020202);cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center}',
      '.agilo-voice-play-time{font-size:.85rem;color:var(--color--gris,#525252);font-weight:600}',
      '.agilo-voice-audio{display:none}',
      '.agilo-voice-drop-zone{margin:.5rem 0 0;border:2px dashed #9eb4d7;border-radius:10px;padding:18px 14px;text-align:center;background:#f8fbff;color:var(--color--gris,#525252);cursor:pointer;transition:border-color .15s,background-color .15s;font-size:.88rem;line-height:1.5}',
      '.agilo-voice-drop-zone strong{display:block;margin-bottom:6px;color:var(--color--gris_foncé,#020202);font-size:1rem}',
      '.agilo-voice-drop-zone.is-dragover{border-color:var(--color--blue,#174a96);background:#edf4ff}',
      '.agilo-voice-drop-zone.is-filled{border-style:solid;border-color:rgba(23,74,150,.35);background:rgba(23,74,150,.04)}',
      '.agilo-voice-submit-row{margin-top:.5rem}',
      '.agilo-voice-free-upsell-block{display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0 4px}',
      '.agilo-voice-benefits{margin:14px 0 18px;padding:0 0 0 1.1rem;text-align:left;color:var(--color--gris,#525252);font-size:.9rem;line-height:1.55}',
      '.agilo-voice-benefits li{margin-bottom:6px}',
      '.agilo-voice-free-link{display:inline-block;margin-top:12px;font-size:.88rem;color:var(--color--blue,#174a96);font-weight:600;text-decoration:none}',
      '.agilo-voice-free-link:hover{text-decoration:underline}',
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
      '.agilo-voice-label{display:block;margin:0 0 .45rem;font-size:.9rem;font-weight:500}',
      '.agilo-voice-input{width:100%;box-sizing:border-box;border:1px solid rgba(82,82,82,.25);border-radius:' + AGILO_RADIUS + ';background:#fff;padding:10px 12px;font:inherit}',
      '.agilo-voice-input:disabled{opacity:.7;background:#f5f5f5}',
      '.agilo-voice-input:focus{outline:none;border-color:var(--color--blue,#174a96);box-shadow:0 0 0 2px rgba(23,74,150,.12)}',
      '.agilo-voice-hint{font-size:.85rem;color:var(--color--gris,#525252);margin:.35rem 0 0;text-align:center;line-height:1.45}',
      '.agilo-voice-file-alt{display:none;margin:.35rem 0 0;text-align:center;font-size:.82rem;color:var(--color--blue,#174a96);cursor:pointer;background:none;border:none;font:inherit;text-decoration:underline;width:100%;padding:0}',
      '.agilo-voice-file-alt:hover{text-decoration:underline}',
      '.agilo-voice-record-area.is-preview-ready .agilo-voice-drop-zone{display:none}',
      '.agilo-voice-record-area.is-preview-ready .agilo-voice-file-alt{display:block}',
      '.agilo-voice-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;border-radius:' + AGILO_RADIUS + ';padding:8px 14px;font:inherit;font-size:.88rem;font-weight:600;border:1px solid rgba(82,82,82,.22);background:#fff;color:var(--color--gris_foncé,#020202);transition:background .15s,border-color .15s,transform .15s,box-shadow .15s}',
      '.agilo-voice-btn-ghost{background:transparent}',
      '.agilo-voice-btn-ghost:hover{background:rgba(23,74,150,.05);border-color:rgba(23,74,150,.25)}',
      '.agilo-voice-btn-primary{background:var(--color--blue,#174a96);color:#fff;border-color:transparent;box-shadow:0 1px 2px rgba(23,74,150,.18)}',
      '.agilo-voice-btn-primary:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(23,74,150,.22)}',
      '.agilo-voice-btn-primary.agilo-voice-btn-block{width:100%}',
      '.agilo-voice-btn-icon{font-size:1.05rem;line-height:1;font-weight:700}',
      '.agilo-voice-btn-svg{width:14px;height:14px;flex-shrink:0}',
      '.agilo-voice-btn-danger{color:var(--color--rouge,#a82633);border-color:rgba(168,38,51,.22);background:transparent}',
      '.agilo-voice-btn-danger:hover{background:rgba(168,38,51,.06)}',
      '.agilo-voice-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}',
      '.agilo-voice-btn-submit{display:none}',
      '.agilo-voice-btn-submit.is-visible{display:inline-flex}',
      '.agilo-voice-invite-actions{display:flex;justify-content:flex-end;margin-top:14px}',
      '.agilo-voice-invite-history{margin-top:20px;padding-top:18px;border-top:1px solid rgba(82,82,82,.08)}',
      '.agilo-voice-invite-history-title{margin:0 0 12px;font-size:.95rem;font-weight:600;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-invite-history-note{margin:10px 0 0;font-size:.78rem;color:var(--color--gris,#525252);line-height:1.45}',
      '.agilo-voice-invite-status{display:inline-flex;align-items:center;margin-left:8px;padding:2px 8px;font-size:.72rem;font-weight:600;border-radius:999px;vertical-align:middle}',
      '.agilo-voice-invite-status--pending{color:var(--color--blue,#174a96);background:rgba(23,74,150,.1)}',
      '.agilo-voice-invite-status--completed{color:var(--color--vert,#1c661a);background:rgba(28,102,26,.1)}',
      '.agilo-voice-invite-status--expired{color:var(--color--gris,#525252);background:rgba(82,82,82,.12)}',
      '.agilo-voice-status{margin-top:.5rem;padding:10px 12px;border-radius:' + AGILO_RADIUS + ';font-size:.9rem;display:none}',
      '.agilo-voice-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '.agilo-voice-status.is-success{display:block;background:rgba(28,102,26,.1);color:var(--color--vert,#1c661a)}',
      '.agilo-voice-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '.agilo-voice-free-badge{margin-top:12px;padding:10px 14px;background:rgba(23,74,150,.08);border:1px solid rgba(23,74,150,.2);border-radius:' + AGILO_RADIUS + '}',
      '.agilo-voice-free-badge a{color:var(--color--blue,#174a96);font-weight:600;text-decoration:none}',
      '.agilo-voice-panel{display:none}',
      '.agilo-voice-panel.is-open{display:block;margin-top:1.5rem}',
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
    var displayName = options.displayName != null
      ? String(options.displayName).trim()
      : buildDefaultDisplayName(creds);

    container.innerHTML = [
      '<div class="agilo-voice-record-area">',
      '  <div class="agilo-voice-name-single">',
      '    <label class="agilo-voice-label" for="agilo-voice-display-name">Prénom &amp; Nom</label>',
      '    <input class="agilo-voice-input" id="agilo-voice-display-name" type="text" maxlength="160" placeholder="Ex. Marie Dupont" value="' + escapeHtml(displayName) + '"' + (locked ? ' disabled' : '') + '>',
      '  </div>',
      '  <div class="agilo-voice-hero-wrap">',
      '    <div class="agilo-voice-hero is-idle" id="agilo-voice-hero" role="button" tabindex="0" aria-label="Démarrer l\'enregistrement vocal">',
      '      <div class="agilo-voice-waves" id="agilo-voice-waves" style="display:none"><span class="agilo-voice-wave"></span><span class="agilo-voice-wave"></span><span class="agilo-voice-wave"></span></div>',
      '      <div class="agilo-voice-hero-ring"></div>',
      '      <div id="agilo-voice-hero-icon">' + MIC_SVG + '</div>',
      '    </div>',
      '    <p class="agilo-voice-hero-label" id="agilo-voice-hero-label">Appuyez pour enregistrer votre voix</p>',
      '    <div class="agilo-voice-timer-compact" id="agilo-voice-timer"></div>',
      '    <button type="button" class="agilo-voice-rerecord-link" id="agilo-voice-rerecord">Réenregistrer</button>',
      '    <div class="agilo-voice-mini-player" id="agilo-voice-mini-player">',
      '      <button type="button" class="agilo-voice-play-btn" id="agilo-voice-play-btn" aria-label="Écouter">▶</button>',
      '      <span class="agilo-voice-play-time" id="agilo-voice-play-time">0:00 / 0:00</span>',
      '    </div>',
      '  </div>',
      '  <audio class="agilo-voice-audio" id="agilo-voice-preview"></audio>',
      '  <p class="agilo-voice-hint" id="agilo-voice-hint">Parlez clairement, seul(e), 15 à 45 secondes.</p>',
      '  <div class="agilo-voice-submit-row">',
      '    <button type="button" class="agilo-voice-btn-submit button save" id="agilo-voice-submit">Enregistrer cette voix</button>',
      '  </div>',
      '  <button type="button" class="agilo-voice-file-alt" id="agilo-voice-file-alt">Importer un fichier audio à la place</button>',
      '  <div class="agilo-voice-drop-zone" id="agilo-voice-drop-zone" role="button" tabindex="0">',
      '    <strong>Glissez votre fichier audio ici</strong>',
      '    <span>ou cliquez pour sélectionner · MP3, WAV, webm, mp4 · 15 à 45 s</span>',
      '  </div>',
      '  <input class="agilo-voice-file" id="agilo-voice-file" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/webm,audio/*" hidden>',
      '</div>'
    ].join('');

    var state = { uiState: 'idle', recording: false, elapsedMs: 0, timerId: null, mediaRecorder: null, mediaStream: null, audioChunks: [], recordedBlob: null, recordedFileName: 'voice-enrollment.webm', fileMode: false, previewDurationMs: 0 };
    var els = {
      hero: container.querySelector('#agilo-voice-hero'),
      heroIcon: container.querySelector('#agilo-voice-hero-icon'),
      heroLabel: container.querySelector('#agilo-voice-hero-label'),
      waves: container.querySelector('#agilo-voice-waves'),
      displayName: container.querySelector('#agilo-voice-display-name'),
      timer: container.querySelector('#agilo-voice-timer'),
      rerecord: container.querySelector('#agilo-voice-rerecord'),
      miniPlayer: container.querySelector('#agilo-voice-mini-player'),
      playBtn: container.querySelector('#agilo-voice-play-btn'),
      playTime: container.querySelector('#agilo-voice-play-time'),
      hint: container.querySelector('#agilo-voice-hint'),
      preview: container.querySelector('#agilo-voice-preview'),
      recordArea: container.querySelector('.agilo-voice-record-area'),
      dropZone: container.querySelector('#agilo-voice-drop-zone'),
      fileAlt: container.querySelector('#agilo-voice-file-alt'),
      fileInput: container.querySelector('#agilo-voice-file'),
      submitBtn: container.querySelector('#agilo-voice-submit')
    };

    applyWebflowSaveButton(els.submitBtn, 'Enregistrer cette voix');

    function formatTime(ms) {
      var sec = Math.floor(ms / 1000);
      return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }

    function updateDropZoneLabel(fileName) {
      if (!fileName) {
        els.dropZone.classList.remove('is-filled');
        els.dropZone.innerHTML = '<strong>Glissez votre fichier audio ici</strong><span>ou cliquez pour sélectionner · MP3, WAV, webm, mp4 · 15 à 45 s</span>';
        return;
      }
      els.dropZone.classList.add('is-filled');
      els.dropZone.innerHTML = '<strong>Fichier sélectionné</strong><span>' + escapeHtml(fileName) + '</span>';
    }

    function updatePlayTimeLabel() {
      var cur = els.preview.currentTime ? Math.floor(els.preview.currentTime * 1000) : 0;
      var total = state.previewDurationMs || (els.preview.duration ? Math.floor(els.preview.duration * 1000) : state.elapsedMs);
      els.playTime.textContent = formatTime(cur) + ' / ' + formatTime(total);
    }

    var _lastIconState = null;

    function updateUIState() {
      els.hero.classList.remove('is-idle', 'is-recording', 'is-preview');
      els.timer.classList.remove('is-visible');
      els.rerecord.style.display = 'none';
      els.miniPlayer.classList.remove('is-visible');
      els.hero.style.pointerEvents = '';
      els.hero.style.opacity = '';
      if (els.recordArea) {
        els.recordArea.classList.toggle('is-preview-ready', state.uiState === 'preview');
      }

      if (state.uiState === 'recording') {
        els.hero.classList.add('is-recording');
        if (_lastIconState !== 'recording') {
          els.heroIcon.innerHTML = STOP_SVG;
          _lastIconState = 'recording';
        }
        els.waves.style.display = 'block';
        var remainingSec = Math.max(1, Math.ceil((MIN_RECORD_SEC * 1000 - state.elapsedMs) / 1000));
        if (state.elapsedMs < MIN_RECORD_SEC * 1000) {
          els.heroLabel.textContent = 'Encore ' + remainingSec + ' s minimum…';
          els.hint.textContent = 'Le bouton s\'active à 15 secondes.';
          els.hero.style.opacity = '0.55';
          els.hero.style.pointerEvents = 'none';
        } else {
          els.heroLabel.textContent = 'Appuyez pour arrêter';
          els.hint.textContent = 'Parlez naturellement — vous pouvez arrêter l\'enregistrement.';
        }
        els.timer.classList.add('is-visible');
        els.timer.textContent = formatTime(state.elapsedMs) + ' / 00:45';
        els.submitBtn.classList.remove('is-visible');
      } else if (state.uiState === 'preview' || state.uiState === 'file') {
        els.hero.classList.add('is-preview');
        if (_lastIconState !== 'preview') {
          els.heroIcon.innerHTML = CHECK_SVG;
          _lastIconState = 'preview';
        }
        els.waves.style.display = 'none';
        els.heroLabel.textContent = state.uiState === 'preview' ? 'Enregistrement prêt' : 'Fichier prêt à envoyer';
        els.rerecord.style.display = state.uiState === 'preview' ? 'block' : 'none';
        if (state.uiState === 'preview') {
          els.miniPlayer.classList.add('is-visible');
          updatePlayTimeLabel();
        }
        els.hint.textContent = state.uiState === 'preview' ? 'Écoutez votre enregistrement, puis validez.' : 'Validez pour enregistrer cette voix.';
        els.submitBtn.classList.add('is-visible');
      } else {
        els.hero.classList.add('is-idle');
        if (_lastIconState !== 'idle') {
          els.heroIcon.innerHTML = MIC_SVG;
          _lastIconState = 'idle';
        }
        els.waves.style.display = 'none';
        els.heroLabel.textContent = 'Appuyez pour enregistrer votre voix';
        els.hint.textContent = 'Parlez clairement, seul(e), 15 à 45 secondes.';
        els.submitBtn.classList.remove('is-visible');
      }
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

    function resetRecording() {
      state.recordedBlob = null;
      state.previewDurationMs = 0;
      els.preview.pause();
      els.preview.removeAttribute('src');
      els.playBtn.textContent = '▶';
      if (!state.fileMode) state.uiState = 'idle';
      updateUIState();
    }

    async function applySelectedFile(file) {
      setStatusEl(statusEl, '', '');
      try {
        await validateVoiceFileDuration(file);
        state.fileMode = true;
        state.recordedBlob = null;
        els.preview.removeAttribute('src');
        updateDropZoneLabel(file.name);
        state.uiState = 'file';
        updateUIState();
      } catch (err) {
        els.fileInput.value = '';
        state.fileMode = false;
        updateDropZoneLabel('');
        state.uiState = 'idle';
        updateUIState();
        setStatusEl(statusEl, 'error', err.message || ERROR_MESSAGES.error_invalid_audio_file_content);
      }
    }

    async function startRecording() {
      setStatusEl(statusEl, '', '');
      if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
        setStatusEl(statusEl, 'error', 'Micro non disponible. Importez un fichier audio.');
        return;
      }
      try {
        els.fileInput.value = '';
        state.fileMode = false;
        updateDropZoneLabel('');
        if (state.uiState === 'preview') resetRecording();
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
          state.previewDurationMs = state.elapsedMs;
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

    function handleHeroClick() {
      if (state.uiState === 'recording') stopRecording();
      else if (state.uiState === 'idle') startRecording();
    }

    els.hero.addEventListener('click', handleHeroClick);
    els.hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHeroClick(); }
    });

    els.rerecord.addEventListener('click', function () {
      if (state.recording) return;
      resetRecording();
      startRecording();
    });

    els.playBtn.addEventListener('click', function () {
      if (!els.preview.src) return;
      if (els.preview.paused) {
        els.preview.play();
        els.playBtn.textContent = '❚❚';
      } else {
        els.preview.pause();
        els.playBtn.textContent = '▶';
      }
    });
    els.preview.addEventListener('timeupdate', updatePlayTimeLabel);
    els.preview.addEventListener('ended', function () { els.playBtn.textContent = '▶'; });

    els.dropZone.addEventListener('click', function () {
      if (state.recording) return;
      els.fileInput.click();
    });
    if (els.fileAlt) {
      els.fileAlt.addEventListener('click', function () {
        if (state.recording) return;
        els.fileInput.click();
      });
    }
    els.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!state.recording) els.fileInput.click(); }
    });
    els.dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      els.dropZone.classList.add('is-dragover');
    });
    els.dropZone.addEventListener('dragleave', function () {
      els.dropZone.classList.remove('is-dragover');
    });
    els.dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      els.dropZone.classList.remove('is-dragover');
      if (state.recording) return;
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) applySelectedFile(file);
    });

    els.fileInput.addEventListener('change', async function () {
      if (!els.fileInput.files || !els.fileInput.files[0]) {
        state.fileMode = false;
        updateDropZoneLabel('');
        if (!state.recordedBlob) state.uiState = 'idle';
        updateUIState();
        return;
      }
      await applySelectedFile(els.fileInput.files[0]);
    });

    els.submitBtn.addEventListener('click', async function () {
      setStatusEl(statusEl, '', '');
      var nameErr = validateDisplayName(els.displayName.value);
      if (nameErr) {
        setStatusEl(statusEl, 'error', nameErr);
        return;
      }
      var split = splitDisplayName(els.displayName.value);
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
      els.hero.style.pointerEvents = 'none';
      setStatusEl(statusEl, 'info', 'Envoi de l\'empreinte vocale…');
      try {
        await enrollSpeakerVoice(creds, split.firstName, split.lastName, voiceFile);
        setStatusEl(statusEl, 'success', 'Voix enregistrée avec succès !');
        await new Promise(function (r) { setTimeout(r, 1500); });
        if (typeof options.onSuccess === 'function') {
          await options.onSuccess();
          var section = document.getElementById('agilo-voice-settings');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (e) {
        setStatusEl(statusEl, 'error', e.message || 'Impossible d\'enregistrer cette voix.');
        els.submitBtn.disabled = false;
        els.hero.style.pointerEvents = '';
        updateUIState();
      }
    });

    updateUIState();
  }

  function buildMainMarkup(data, creds, inviteData) {
    var isFree = normEdition(creds.edition) === 'free';
    var voices = data.voices || [];
    var maxVoices = data.maxVoices || 0;
    var pendingCount = countPendingInvites(inviteData);
    var usedCount = voices.length + pendingCount;
    var atQuotaEnroll = !isFree && maxVoices > 0 && voices.length >= maxVoices;
    var atQuotaFull = !isFree && maxVoices > 0 && usedCount >= maxVoices;

    var freeContentHtml = isFree ? [
      '<div class="agilo-voice-free-upsell-block">',
      '  <div class="agilo-voice-empty-icon">' + ICON_EMPTY_MIC + '</div>',
      '  <p class="agilo-voice-empty-title">Empreinte vocale</p>',
      '  <ul class="agilo-voice-benefits">',
      '    <li>Identifiez automatiquement votre voix dans chaque transcription</li>',
      '    <li>Distinction claire entre les intervenants en réunion</li>',
      '    <li>Invitez vos collègues à enregistrer leur empreinte vocale</li>',
      '  </ul>',
      '  <a href="' + TARIFS_URL + '" target="_blank" rel="noopener noreferrer" class="button upgrade agilo-voice-free-cta">Essayer Pro gratuitement</a>',
      '  <a href="' + TARIFS_URL + '" target="_blank" rel="noopener noreferrer" class="agilo-voice-free-link">Voir les offres Pro et Business</a>',
      '</div>'
    ].join('') : '';

    var listHtml = isFree
      ? freeContentHtml
      : (voices.length
      ? voices.map(function (v) {
          var displayName = formatDisplayName(v);
          var label = escapeHtml(displayName || '—');
          var date = formatVoiceDate(v.dtUpdate);
          var initials = escapeHtml(voiceInitials(v.firstName, v.lastName, v.speakerLabel));
          return [
            '<li class="agilo-voice-item" data-voice-id="' + escapeHtml(String(v.voiceId)) + '">',
            '  <div class="agilo-voice-avatar" aria-hidden="true">' + initials + '</div>',
            '  <div class="agilo-voice-item-body">',
            '    <div class="agilo-voice-item-label">' + label + '</div>',
            date ? ('    <div class="agilo-voice-item-meta">Mise à jour : ' + date + '</div>') : '',
            '    <div class="agilo-voice-item-actions">',
            '      <button type="button" class="agilo-voice-btn agilo-voice-btn-ghost agilo-voice-listen-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '">▶ Écouter l\'audio</button>',
            '      <button type="button" class="agilo-voice-btn agilo-voice-btn-ghost agilo-voice-rename-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" data-display-name="' + escapeHtml(displayName) + '">' + ICON_EDIT + ' Renommer</button>',
            '      <button type="button" class="agilo-voice-btn agilo-voice-btn-ghost agilo-voice-replace-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" data-display-name="' + escapeHtml(displayName) + '">' + ICON_MIC_SM + ' Remplacer l\'audio</button>',
            '      <button type="button" class="agilo-voice-btn agilo-voice-btn-danger agilo-voice-delete-btn" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" data-label="' + label + '">' + ICON_TRASH + ' Supprimer</button>',
            '    </div>',
            '    <div class="agilo-voice-listen-panel" id="agilo-voice-listen-' + escapeHtml(String(v.voiceId)) + '">',
            '      <p class="agilo-voice-listen-status" id="agilo-voice-listen-status-' + escapeHtml(String(v.voiceId)) + '"></p>',
            '      <div class="agilo-voice-listen-player" id="agilo-voice-listen-player-' + escapeHtml(String(v.voiceId)) + '">',
            '        <button type="button" class="agilo-voice-play-btn agilo-voice-listen-play" data-voice-id="' + escapeHtml(String(v.voiceId)) + '" aria-label="Écouter">▶</button>',
            '        <span class="agilo-voice-play-time agilo-voice-listen-time" id="agilo-voice-listen-time-' + escapeHtml(String(v.voiceId)) + '">0:00 / 0:00</span>',
            '      </div>',
            '      <audio class="agilo-voice-audio agilo-voice-listen-audio" id="agilo-voice-listen-audio-' + escapeHtml(String(v.voiceId)) + '"></audio>',
            '    </div>',
            '    <div class="agilo-voice-rename-row" id="agilo-voice-rename-' + escapeHtml(String(v.voiceId)) + '">',
            '      <div class="agilo-voice-name-single">',
            '        <label class="agilo-voice-label">Prénom &amp; Nom</label>',
            '        <input class="agilo-voice-input agilo-voice-rename-display" type="text" maxlength="160" placeholder="Ex. Marie Dupont" value="' + escapeHtml(displayName) + '">',
            '      </div>',
            '      <button type="button" class="agilo-voice-btn agilo-voice-btn-primary agilo-voice-save-rename" data-voice-id="' + escapeHtml(String(v.voiceId)) + '">Enregistrer le nom</button>',
            '    </div>',
            '    <div class="agilo-voice-panel agilo-voice-replace-panel" id="agilo-voice-replace-' + escapeHtml(String(v.voiceId)) + '"></div>',
            '  </div>',
            '</li>'
          ].join('');
        }).join('')
      : [
        '<div class="agilo-voice-empty-state">',
        '  <div class="agilo-voice-empty-icon">' + ICON_EMPTY_MIC + '</div>',
        '  <p class="agilo-voice-empty-title">Aucune empreinte vocale configurée</p>',
        '  <p class="agilo-voice-empty">Enregistrez la vôtre ou invitez un collègue pour identifier automatiquement chaque intervenant dans vos transcriptions.</p>',
        '</div>'
      ].join(''));

    var quotaBadge = isFree
      ? 'Pro ou Business'
      : formatQuotaBadge(usedCount, maxVoices);

    var leadHtml = isFree
      ? ''
      : '<p class="agilo-voice-section-desc agilo-voice-lead">Identifiez automatiquement chaque intervenant dans vos transcriptions.</p>';

    var quotaMsgHtml = '';
    if (!isFree && atQuotaEnroll && !atQuotaFull) {
      quotaMsgHtml = '<p class="agilo-voice-empty">Quota d\'enregistrements directs atteint. Invitez un collègue par email ou attendez qu\'une invitation en cours soit finalisée.</p>';
    } else if (!isFree && atQuotaFull) {
      quotaMsgHtml = '<p class="agilo-voice-empty">Quota atteint (empreintes + invitations en attente). Supprimez une empreinte ou attendez qu\'un invité termine son enregistrement.</p>';
    }

    var addSectionHtml = !isFree && !atQuotaEnroll ? [
      '    <div class="agilo-voice-section">',
      '      <h3 class="agilo-voice-section-title">Ajouter une voix</h3>',
      '      <p class="agilo-voice-section-desc">Enregistrez directement la voix d\'un collègue présent avec vous — nom affiché et extrait audio de 15 à 45 secondes.</p>',
      '      <button type="button" class="agilo-voice-btn agilo-voice-btn-primary" id="agilo-voice-toggle-add"><span class="agilo-voice-btn-icon" aria-hidden="true">+</span> Ajouter une voix</button>',
      '      <div class="agilo-voice-panel" id="agilo-voice-add-panel"></div>',
      '    </div>'
    ].join('') : '';

    var inviteQuotaNote = atQuotaFull
      ? '<p class="agilo-voice-status is-info agilo-voice-invite-quota-info" role="status">Impossible d\'envoyer une nouvelle invitation : quota atteint. Vous pouvez renvoyer une invitation existante.</p>'
      : '';

    var inviteSectionHtml = !isFree ? [
      '    <div class="agilo-voice-section">',
      '      <h3 class="agilo-voice-section-title">Inviter par email</h3>',
      '      <p class="agilo-voice-section-desc">Envoyez un lien par email à un collègue distant — aucun compte Agilotext requis pour l\'invité.</p>',
      '      <div class="agilo-voice-name-grid">',
      '        <div><label class="agilo-voice-label" for="agilo-voice-invite-name">Nom affiché</label>',
      '        <input class="agilo-voice-input" id="agilo-voice-invite-name" type="text" placeholder="Ex. Marie Dupont"' + (atQuotaFull ? ' disabled' : '') + '></div>',
      '        <div><label class="agilo-voice-label" for="agilo-voice-invite-email">Email</label>',
      '        <input class="agilo-voice-input" id="agilo-voice-invite-email" type="email" placeholder="collegue@entreprise.com"' + (atQuotaFull ? ' disabled' : '') + '></div>',
      '      </div>',
      inviteQuotaNote,
      '      <div class="agilo-voice-invite-actions">',
      '        <button type="button" class="agilo-voice-btn agilo-voice-btn-primary" id="agilo-voice-send-invite"' + (atQuotaFull ? ' disabled' : '') + '>Envoyer l\'invitation</button>',
      '      </div>',
      buildInviteHistoryHtml(inviteData),
      '    </div>'
    ].join('') : '';

    return [
      '<div class="agilo-voice-wrap"' + (atQuotaFull ? ' data-quota-full="1"' : '') + '>',
      '  <div class="agilo-voice-card">',
      '    <h2 class="h1-small">Empreinte vocale</h2>',
      '    <div class="spacer-10"></div>',
      leadHtml,
      '    <div class="agilo-voice-head">',
      '      <span class="agilo-voice-quota-badge">' + escapeHtml(quotaBadge) + '</span>',
      '    </div>',
      '    <div class="agilo-voice-list-wrap">' + (voices.length ? '<ul class="agilo-voice-list">' + listHtml + '</ul>' : listHtml) + '</div>',
      '    <div class="agilo-voice-status" id="agilo-voice-main-status" role="status"></div>',
      quotaMsgHtml,
      addSectionHtml,
      inviteSectionHtml,
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderMainView(container, creds, data, reload, inviteData) {
    injectStyles();
    container.innerHTML = buildMainMarkup(data, creds, inviteData);
    var statusEl = container.querySelector('#agilo-voice-main-status');
    var isFree = normEdition(creds.edition) === 'free';

    if (isFree) {
      applyWebflowUpgradeButton(container.querySelector('.agilo-voice-free-cta'), 'Essayer Pro gratuitement');
    }

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
        var displayInput = row.querySelector('.agilo-voice-rename-display');
        var nameErr = validateDisplayName(displayInput.value);
        if (nameErr) {
          setStatusEl(statusEl, 'error', nameErr);
          return;
        }
        var split = splitDisplayName(displayInput.value);
        btn.disabled = true;
        setStatusEl(statusEl, 'info', 'Mise à jour du nom…');
        try {
          await updateSpeakerVoice(creds, id, split.firstName, split.lastName);
          setStatusEl(statusEl, 'success', 'Nom mis à jour.');
          await reload();
        } catch (e) {
          setStatusEl(statusEl, 'error', e.message);
          btn.disabled = false;
        }
      });
    });

    var listenState = { objectUrl: '', voiceId: '' };

    function formatListenTime(sec) {
      sec = Math.floor(sec || 0);
      return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }

    function closeListenPanels(exceptId) {
      container.querySelectorAll('.agilo-voice-listen-panel.is-open').forEach(function (panel) {
        var id = panel.id.replace('agilo-voice-listen-', '');
        if (exceptId && id === String(exceptId)) return;
        panel.classList.remove('is-open');
        var audio = panel.querySelector('.agilo-voice-listen-audio');
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
        }
        var player = panel.querySelector('.agilo-voice-listen-player');
        if (player) player.classList.remove('is-visible');
        var status = panel.querySelector('.agilo-voice-listen-status');
        if (status) status.textContent = '';
        var playBtn = panel.querySelector('.agilo-voice-listen-play');
        if (playBtn) playBtn.textContent = '▶';
      });
      if (listenState.objectUrl && (!exceptId || listenState.voiceId !== String(exceptId))) {
        URL.revokeObjectURL(listenState.objectUrl);
        listenState.objectUrl = '';
        listenState.voiceId = '';
      }
    }

    container.querySelectorAll('.agilo-voice-listen-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-voice-id');
        var panel = container.querySelector('#agilo-voice-listen-' + id);
        if (!panel) return;
        if (panel.classList.contains('is-open')) {
          closeListenPanels();
          return;
        }
        closeListenPanels(id);
        panel.classList.add('is-open');
        var statusNode = panel.querySelector('.agilo-voice-listen-status');
        var player = panel.querySelector('.agilo-voice-listen-player');
        var audio = panel.querySelector('.agilo-voice-listen-audio');
        var playBtn = panel.querySelector('.agilo-voice-listen-play');
        var timeEl = panel.querySelector('.agilo-voice-listen-time');
        if (statusNode) statusNode.textContent = 'Chargement de l\'audio…';
        if (player) player.classList.remove('is-visible');
        btn.disabled = true;
        try {
          var blob = await fetchSpeakerVoiceAudio(creds, id);
          if (listenState.objectUrl) URL.revokeObjectURL(listenState.objectUrl);
          listenState.objectUrl = URL.createObjectURL(blob);
          listenState.voiceId = String(id);
          audio.src = listenState.objectUrl;
          if (statusNode) statusNode.textContent = '';
          if (player) player.classList.add('is-visible');
          if (timeEl) timeEl.textContent = '0:00 / 0:00';
          audio.onloadedmetadata = function () {
            if (timeEl && isFinite(audio.duration)) {
              timeEl.textContent = '0:00 / ' + formatListenTime(audio.duration);
            }
          };
          audio.ontimeupdate = function () {
            if (!timeEl) return;
            var total = isFinite(audio.duration) ? audio.duration : 0;
            timeEl.textContent = formatListenTime(audio.currentTime) + ' / ' + formatListenTime(total);
          };
          audio.onended = function () {
            if (playBtn) playBtn.textContent = '▶';
          };
          if (playBtn) {
            playBtn.textContent = '▶';
            playBtn.onclick = function () {
              if (audio.paused) {
                audio.play();
                playBtn.textContent = '❚❚';
              } else {
                audio.pause();
                playBtn.textContent = '▶';
              }
            };
          }
        } catch (e) {
          if (statusNode) statusNode.textContent = e.message || 'Impossible de lire l\'audio enregistré.';
        } finally {
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
          displayName: btn.getAttribute('data-display-name') || '',
          onSuccess: reload
        }, statusEl);
      });
    });

    container.querySelectorAll('.agilo-voice-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-voice-id');
        var label = btn.getAttribute('data-label') || 'cette voix';
        if (!window.confirm('Supprimer l\'empreinte vocale « ' + label + ' » ?')) return;
        btn.disabled = true;
        setStatusEl(statusEl, 'info', 'Suppression…');
        try {
          await deleteSpeakerVoice(creds, id);
          setStatusEl(statusEl, 'success', 'Empreinte vocale supprimée.');
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
          toggleAdd.innerHTML = isOpen
            ? 'Masquer le formulaire'
            : '<span class="agilo-voice-btn-icon" aria-hidden="true">+</span> Ajouter une voix';
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
          if (container.querySelector('.agilo-voice-wrap[data-quota-full="1"]')) {
            setStatusEl(statusEl, 'info', 'Impossible d\'envoyer une nouvelle invitation : quota atteint. Vous pouvez renvoyer une invitation existante.');
            return;
          }
          inviteBtn.disabled = true;
          setStatusEl(statusEl, 'info', 'Envoi de l\'invitation…');
          var sent = await sendInviteAndPersist(creds, recipientName, recipientEmail, statusEl);
          inviteBtn.disabled = false;
          if (sent) {
            if (nameInput) nameInput.value = '';
            if (emailInput) emailInput.value = '';
            await reload();
          }
        });
      }

      container.querySelectorAll('.agilo-voice-resend-invite').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var recipientName = String(btn.getAttribute('data-name') || '').trim();
          var recipientEmail = String(btn.getAttribute('data-email') || '').trim();
          if (!recipientName || !recipientEmail) return;
          btn.disabled = true;
          setStatusEl(statusEl, 'info', 'Renvoi de l\'invitation…');
          var sent = await sendInviteAndPersist(creds, recipientName, recipientEmail, statusEl);
          btn.disabled = false;
          if (sent) await reload();
        });
      });

      container.querySelectorAll('.agilo-voice-remove-invite').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var inviteId = btn.getAttribute('data-invite-id');
          if (!inviteId) return;
          if (!window.confirm('Retirer cette invitation de la liste ?')) return;
          removeLocalInvite(creds, inviteId);
          setStatusEl(statusEl, 'success', 'Invitation retirée de la liste.');
          await reload();
        });
      });
    }

    scrollToVoiceSectionIfNeeded();
  }

  async function init() {
    if (isVoiceSettingsDeepLink()) {
      activateProfileTabIfNeeded();
    }

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
        if (normEdition(creds.edition) === 'free') {
          renderMainView(container, creds, { voices: [], maxVoices: 0 }, reload, { source: 'local', invites: [] });
          return;
        }
        var data = await getSpeakerVoices(creds);
        var inviteData = await loadInvites(creds, data.voices || []);
        await updateVoiceEnrolledFlag(creds.memberstack, (data.voices || []).length);
        renderMainView(container, creds, data, reload, inviteData);
      } catch (e) {
        console.error('[agilo-voice-settings] reload failed', e);
        container.innerHTML = '<p style="color:#580808">Impossible de charger les empreintes vocales. Rechargez la page.</p>';
      }
    }

    await reload();
  }

  window.addEventListener('hashchange', scrollToVoiceSectionIfNeeded);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
