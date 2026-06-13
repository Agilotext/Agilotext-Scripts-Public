/* ================================================================
   AGILOTEXT - VOICE ENROLLMENT ONBOARDING
   Page : /auth/setup
   URLs :
     - Production : https://www.agilotext.com/auth/setup
     - Staging    : https://agilotext-test.webflow.io/auth/setup
   Déploiement Webflow :
     1. Embed (w-embed) dans le DERNIER form_step, AVANT button-group.is-form :
        <div id="agilo-voice-onboarding"></div>
     2. Ce script dans Before </body> (ou symbole Code-Onboarding_V1), PAS dans l'Embed
     3. Ne pas placer l'Embed après Terminer ni en dehors des form_step
   ================================================================ */

(function () {
  'use strict';

  function isVoiceOnboardingPage() {
    var path = window.location.pathname || '';
    // Même chemin /auth/setup sur prod et staging Webflow (le domaine n'importe pas).
    return /^\/auth\/setup\/?$/.test(path);
  }

  if (!isVoiceOnboardingPage()) return;
  if (window.__agiloVoiceOnboardingInit) return;
  window.__agiloVoiceOnboardingInit = true;

  function getVisibleOnboardingStep() {
    var steps = document.querySelectorAll('[data-form="step"]');
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var cs = window.getComputedStyle(step);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && step.offsetHeight > 0) {
        return step;
      }
    }
    return null;
  }

  function findUnansweredRadioInStep(step) {
    if (!step) return null;
    var groups = {};
    var radios = step.querySelectorAll('input[type="radio"][name]');
    for (var i = 0; i < radios.length; i++) {
      var name = radios[i].name;
      if (!name) continue;
      if (!groups[name]) groups[name] = { answered: false, firstEl: radios[i] };
      if (radios[i].checked) groups[name].answered = true;
    }
    var key;
    for (key in groups) {
      if (!groups[key].answered) return groups[key].firstEl;
    }
    return null;
  }

  function getOnboardingForm() {
    return document.getElementById('wf-form-Onboarding');
  }

  function getFormRadioValue(form, name) {
    if (!form) return '';
    var checked = form.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return checked ? String(checked.value || '').trim() : '';
  }

  function clearInvalidHighlights(form) {
    if (!form) return;
    form.querySelectorAll('.agilo-setup-field-invalid').forEach(function (el) {
      el.classList.remove('agilo-setup-field-invalid');
    });
  }

  function markRadioGroupInvalid(form, groupName) {
    if (!form || !groupName) return;
    clearInvalidHighlights(form);
    form.querySelectorAll('input[type="radio"][name="' + groupName + '"]').forEach(function (radio) {
      var wrap = radio.closest('.ms-dropdown-cb-wrap, .w-radio, label');
      if (wrap) wrap.classList.add('agilo-setup-field-invalid');
    });
  }

  function showSetupStepError(step, message) {
    if (step) {
      var err = step.querySelector('.form_error-message') || step.querySelector('[data-text="error-message"]');
      if (err) {
        err.textContent = message;
        err.style.display = 'block';
        err.style.visibility = 'visible';
        err.style.opacity = '1';
        err.style.height = 'auto';
        err.style.marginTop = '0.5rem';
        err.style.marginBottom = '0.5rem';
        err.style.color = '#a82633';
      }
    }
    var voiceStatus = document.getElementById('agilo-voice-status');
    if (voiceStatus) {
      voiceStatus.className = 'agilo-voice-status is-error';
      voiceStatus.textContent = message;
    }

    try {
      window.dispatchEvent(new CustomEvent('agilo:onboarding-validation-error', { detail: { message: message } }));
    } catch (err) { /* noop */ }
  }

  function hideSetupStepError(step) {
    if (!step) return;
    var err = step.querySelector('.form_error-message') || step.querySelector('[data-text="error-message"]');
    if (err) {
      err.style.display = 'none';
      err.style.visibility = 'hidden';
      err.style.opacity = '0';
    }
    var voiceStatus = document.getElementById('agilo-voice-status');
    if (voiceStatus && voiceStatus.classList.contains('is-error')) {
      voiceStatus.className = 'agilo-voice-status';
      voiceStatus.textContent = '';
    }
  }

  function validateOnboardingBeforeFinish(form) {
    var activeStep = getVisibleOnboardingStep();
    var unanswered = findUnansweredRadioInStep(activeStep);
    if (unanswered) {
      return {
        ok: false,
        message: 'Veuillez sélectionner une option.',
        focusEl: unanswered,
        groupName: unanswered.name,
        step: activeStep
      };
    }

    var persona = getFormRadioValue(form, 'persona');
    if (persona === 'Autre') {
      var other = form.querySelector('input[name="persona_other"]');
      if (other && !other.value.trim()) {
        return {
          ok: false,
          message: 'Veuillez préciser votre activité.',
          focusEl: other,
          step: activeStep
        };
      }
    }

    var requiredGroups = ['use_case', 'meeting_volume', 'meeting_tool', 'persona'];
    for (var i = 0; i < requiredGroups.length; i++) {
      if (!getFormRadioValue(form, requiredGroups[i])) {
        var first = form.querySelector('input[type="radio"][name="' + requiredGroups[i] + '"]');
        return {
          ok: false,
          message: 'Veuillez compléter toutes les étapes avant de terminer.',
          focusEl: first,
          groupName: requiredGroups[i],
          step: (first && first.closest('[data-form="step"]')) || activeStep
        };
      }
    }

    return { ok: true };
  }

  function wireFinishButtonValidation() {
    var form = getOnboardingForm();
    if (!form || form.dataset.agiloFinishGuard === '1') return;
    form.dataset.agiloFinishGuard = '1';

    function runGuard(e) {
      var submitter = e.target && e.target.closest && e.target.closest('[data-form="submit-btn"], input[type="submit"]');
      if (e.type !== 'submit' && !submitter) return;

      var result = validateOnboardingBeforeFinish(form);
      if (!result.ok) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (result.groupName) markRadioGroupInvalid(form, result.groupName);
        showSetupStepError(result.step || getVisibleOnboardingStep(), result.message);
        if (result.focusEl && result.focusEl.scrollIntoView) {
          result.focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }

      clearInvalidHighlights(form);
    }

    form.addEventListener('click', runGuard, true);
    form.addEventListener('submit', runGuard, true);
    form.addEventListener('change', function (e) {
      if (!e.target || e.target.type !== 'radio') return;
      clearInvalidHighlights(form);
      hideSetupStepError(e.target.closest('[data-form="step"]'));
    });
  }

  function clickFinishButton() {
    var activeStep = getVisibleOnboardingStep();
    var btn = (activeStep && activeStep.querySelector('[data-form="submit-btn"]'))
      || document.querySelector('[data-form="submit-btn"]')
      || (activeStep && activeStep.querySelector('[data-form="next-btn"]'))
      || document.querySelector('[data-form="next-btn"]');
    if (btn) {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }

  function finishOnboardingWithGuard(statusEl, pendingMessage) {
    var form = getOnboardingForm();
    var result = validateOnboardingBeforeFinish(form);
    if (!result.ok) {
      if (result.groupName) markRadioGroupInvalid(form, result.groupName);
      showSetupStepError(result.step || getVisibleOnboardingStep(), pendingMessage || result.message);
      if (result.focusEl && result.focusEl.scrollIntoView) {
        result.focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    clickFinishButton();
    return true;
  }

  const AGILO_VOICE_CONFIG = {
    containerId: 'agilo-voice-onboarding'
  };

  const API_BASE = 'https://api.agilotext.com/api/v1';
  const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  const MIN_RECORD_SEC = 15;
  const MAX_RECORD_SEC = 45;
  const RESERVED_LABELS = new Set(['S1', 'S2', 'UU']);

  const MIC_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TEASER_MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/><path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STOP_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
  const WEBFLOW_SAVE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" class="icon-1x1-small white" aria-hidden="true"><path d="M15.25 4.5C15.25 4.22386 15.0261 4 14.75 4H9.25C8.97386 4 8.75 4.22386 8.75 4.5V7.59998C8.75 7.73805 8.86193 7.84998 9 7.84998H15C15.1381 7.84998 15.25 7.73805 15.25 7.59998V4.5Z" fill="currentColor"></path><path d="M8.25 20C8.25 20.2761 8.47386 20.5 8.75 20.5H15.25C15.5261 20.5 15.75 20.2761 15.75 20V15C15.75 14.8619 15.6381 14.75 15.5 14.75H8.5C8.36193 14.75 8.25 14.8619 8.25 15V20Z" fill="currentColor"></path><path d="M7.25 7.59998C7.25 8.56647 8.0335 9.34998 9 9.34998H15C15.9665 9.34998 16.75 8.56647 16.75 7.59998V4.27627C16.75 4.12369 16.8737 4 17.0263 4C17.1722 4 17.3108 4.06373 17.4058 4.17448L20.3685 7.62867C20.7791 8.1074 20.9936 8.72364 20.9689 9.35387L20.6273 18.0976C20.5749 19.4393 19.4719 20.5 18.1292 20.5H17.75C17.4739 20.5 17.25 20.2761 17.25 20V15C17.25 14.0335 16.4665 13.25 15.5 13.25H8.5C7.5335 13.25 6.75 14.0335 6.75 15V20C6.75 20.2761 6.52614 20.5 6.25 20.5H6.11291C4.90908 20.5 3.89276 19.6055 3.73989 18.4114C3.24597 14.5534 3.2247 10.6495 3.67653 6.78632L3.73742 6.26575C3.8885 4.97395 4.983 4 6.28361 4H6.75C7.02614 4 7.25 4.22386 7.25 4.5V7.59998Z" fill="currentColor"></path></svg>';

  function getWebflowSaveIconHtml() {
    var svgs = document.querySelectorAll('.button.save svg.icon-1x1-small, button.save svg.icon-1x1-small');
    for (var i = 0; i < svgs.length; i++) {
      if (svgs[i].closest('#agilo-voice-submit')) continue;
      var clone = svgs[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      return clone.outerHTML;
    }
    return WEBFLOW_SAVE_ICON;
  }

  function applyWebflowSaveButton(el, label) {
    if (!el) return;
    el.innerHTML = getWebflowSaveIconHtml() + '<div>' + escapeHtml(label) + '</div>';
  }
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
    error_speaker_voice_label_already_exists: 'Une voix existe déjà avec ce prénom et ce nom.'
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
      return 'Aucune voix détectée. Vérifiez votre micro et parlez plus fort, plus près, pendant au moins 15 secondes.';
    }
    if (t.indexOf('too short') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('short') !== -1)) {
      return ERROR_MESSAGES.error_voice_file_duration_too_short;
    }
    if (t.indexOf('too long') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('long') !== -1)) {
      return ERROR_MESSAGES.error_voice_file_duration_too_long;
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
      return 'L\'enregistrement vocal n\'a pas été accepté. Parlez clairement pendant 15 à 45 secondes dans un endroit calme, puis réessayez.';
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

  function validateNames(firstName, lastName) {
    var fn = String(firstName || '').trim();
    var ln = String(lastName || '').trim();
    if (!fn || !ln) return 'Le prénom et le nom sont obligatoires.';
    if (RESERVED_LABELS.has(fn.toUpperCase()) || RESERVED_LABELS.has(ln.toUpperCase())) {
      return ERROR_MESSAGES.error_reserved_speaker_label;
    }
    return '';
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

  function inferEditionFromMember(member) {
    var plans = Array.isArray(member && member.planConnections) ? member.planConnections : [];
    for (var i = 0; i < plans.length; i++) {
      var id = String((plans[i] && plans[i].planId) || '').toLowerCase();
      if (id.indexOf('business') !== -1 || id.indexOf('ent') !== -1) return 'ent';
      if (id.indexOf('pro') !== -1 || id.indexOf('premium') !== -1) return 'pro';
    }
    return 'free';
  }

  async function fetchAgiloToken(username, edition) {
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

  async function getCredentials() {
    var ms = await waitForMemberstack();
    var email = '';
    var firstName = '';
    var lastName = '';
    var edition = normEdition(localStorage.getItem('agilo:edition') || 'free');
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
        console.warn('[agilo-voice-onboarding] getCurrentMember failed', e);
      }
      if (member) edition = normEdition(localStorage.getItem('agilo:edition') || inferEditionFromMember(member));
    }

    email = email || localStorage.getItem('agilo:username') || '';
    var token = await fetchAgiloToken(email, edition);
    return { username: email, token: token, edition: edition, firstName: firstName, lastName: lastName, memberstack: ms };
  }

  async function updateVoiceEnrolledFlag(ms, value) {
    if (!ms || typeof ms.updateMember !== 'function') return;
    try {
      await ms.updateMember({ customFields: { 'voice-enrolled': value } });
    } catch (e) {
      console.warn('[agilo-voice-onboarding] updateMember voice-enrolled failed', e);
    }
  }

  function injectStyles() {
    if (document.getElementById('agilo-voice-enroll-styles')) return;
    var style = document.createElement('style');
    style.id = 'agilo-voice-enroll-styles';
    style.textContent = [
      '@keyframes agilo-voice-pulse{0%{transform:scale(.92);opacity:.55}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}',
      '.agilo-voice-wrap{max-width:100%;width:100%;font-family:inherit;color:var(--color--gris_foncé,#020202);margin-top:1.75rem;padding-top:1.5rem;border-top:1px solid rgba(82,82,82,.12)}',
      '.agilo-voice-intro{margin:0 0 1.25rem;text-align:center}',
      '.agilo-voice-intro-title{margin:0 0 .35rem;font-size:1.05rem;font-weight:600;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-intro-sub{margin:0;color:var(--color--gris,#525252);line-height:1.5}',
      '.agilo-voice-hero{position:relative;display:flex;align-items:center;justify-content:center;width:112px;height:112px;margin:0 auto;cursor:pointer;transition:transform .15s ease}',
      '.agilo-voice-hero:hover{transform:scale(1.03)}',
      '.agilo-voice-hero-wrap{text-align:center;margin:.75rem 0 .5rem}',
      '.agilo-voice-hero-label{margin:.75rem 0 0;font-size:.88rem;color:var(--color--gris,#525252);line-height:1.4}',
      '.agilo-voice-timer-compact{display:none;margin-top:.5rem;font-size:1rem;font-weight:700;color:var(--color--rouge,#a82633)}',
      '.agilo-voice-timer-compact.is-visible{display:block}',
      '.agilo-voice-rerecord-link{display:none;margin:.5rem auto 0;text-align:center;font-size:.85rem;color:var(--color--blue,#174a96);cursor:pointer;background:none;border:none;font:inherit;text-decoration:underline}',
      '.agilo-voice-mini-player{display:none;align-items:center;justify-content:center;gap:10px;margin-top:.5rem}',
      '.agilo-voice-mini-player.is-visible{display:flex}',
      '.agilo-voice-play-btn{width:36px;height:36px;border-radius:50%;border:1px solid rgba(82,82,82,.22);background:#fff;color:var(--color--gris_foncé,#020202);cursor:pointer;font-size:.75rem}',
      '.agilo-voice-play-time{font-size:.85rem;color:var(--color--gris,#525252);font-weight:600}',
      '.agilo-voice-drop-zone{margin:.5rem 0 0;border:2px dashed #9eb4d7;border-radius:10px;padding:18px 14px;text-align:center;background:#f8fbff;color:var(--color--gris,#525252);cursor:pointer;font-size:.88rem;line-height:1.5}',
      '.agilo-voice-drop-zone strong{display:block;margin-bottom:6px;color:var(--color--gris_foncé,#020202);font-size:1rem}',
      '.agilo-voice-drop-zone.is-dragover{border-color:var(--color--blue,#174a96);background:#edf4ff}',
      '.agilo-voice-drop-zone.is-filled{border-style:solid;border-color:rgba(23,74,150,.35);background:rgba(23,74,150,.04)}',
      '.agilo-voice-submit-row{margin-top:.5rem}',
      '.agilo-voice-hint{font-size:.85rem;color:var(--color--gris,#525252);margin:.35rem 0 0;text-align:center;line-height:1.45}',
      '.agilo-voice-file-alt{display:none;margin:.35rem 0 0;text-align:center;font-size:.82rem;color:var(--color--blue,#174a96);cursor:pointer;background:none;border:none;font:inherit;text-decoration:underline;width:100%;padding:0}',
      '.agilo-voice-file-alt:hover{text-decoration:underline}',
      '.agilo-voice-record-area.is-preview-ready .agilo-voice-drop-zone{display:none}',
      '.agilo-voice-record-area.is-preview-ready .agilo-voice-file-alt{display:block}',
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
      '.agilo-voice-label{display:block;margin:0 0 .45rem;font-size:.9rem;font-weight:500;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-input.agilo-voice-input{width:100%;box-sizing:border-box;margin:0;border:1px solid var(--color--noir_25,rgba(82,82,82,.25));border-radius:' + AGILO_RADIUS + ';background:var(--color--white,#fff);padding:10px 12px;font:inherit;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-input.agilo-voice-input:focus{outline:none;border-color:var(--color--blue,#174a96);box-shadow:0 0 0 2px rgba(23,74,150,.12)}',
      '.agilo-voice-audio{display:none}',
      '.agilo-voice-actions{margin-top:.75rem;display:flex;flex-direction:column;align-items:stretch;gap:.75rem}',
      '.agilo-voice-btn-submit{display:none}',
      '.agilo-voice-btn-submit.is-visible{display:inline-flex}',
      '.agilo-voice-status{margin-top:.5rem;padding:10px 12px;border-radius:' + AGILO_RADIUS + ';font-size:.9rem;display:none}',
      '.agilo-voice-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '.agilo-voice-status.is-success{display:block;background:rgba(28,102,26,.1);color:var(--color--vert,#1c661a)}',
      '.agilo-voice-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '.agilo-voice-skip-link{display:block;margin:.25rem auto 0;text-align:center;font-size:.82rem;color:var(--color--gris,#525252);text-decoration:none;cursor:pointer}',
      '.agilo-voice-skip-link:hover{text-decoration:underline;color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-teaser{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:rgba(23,74,150,.06);border-left:3px solid var(--color--blue,#174a96);border-radius:0 ' + AGILO_RADIUS + ' ' + AGILO_RADIUS + ' 0;color:var(--color--gris,#525252);font-size:.875rem;line-height:1.45;margin-top:1rem}',
      '.agilo-voice-teaser-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:' + AGILO_RADIUS + ';background:rgba(23,74,150,.12);color:var(--color--blue,#174a96)}',
      '.agilo-voice-teaser-icon svg{width:18px;height:18px;display:block}',
      '.agilo-voice-teaser.is-hidden{display:none!important}',
      '.agilo-voice-name-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}',
      '.agilo-voice-free-upsell{padding:14px 16px;background:rgba(23,74,150,.08);border:1px solid rgba(23,74,150,.2);border-radius:' + AGILO_RADIUS + ';text-align:center}',
      '.agilo-voice-free-upsell p{margin:0 0 12px;color:var(--color--gris,#525252);line-height:1.5;font-size:.9rem}',
      '.agilo-voice-free-upsell a{color:var(--color--blue,#174a96);font-weight:600;text-decoration:none}',
      '.agilo-setup-field-invalid{outline:2px solid var(--color--rouge,#a82633)!important;outline-offset:2px;border-radius:0.5rem}',
      '.agilo-setup-field-invalid .ms-dropdown-cb-label{color:var(--color--rouge,#a82633)}',
      '@media(max-width:560px){.agilo-voice-name-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
  }

  function injectStep1Teaser() {
    try {
      injectStyles();
      if (document.getElementById('agilo-voice-teaser')) return;

      var steps = document.querySelectorAll('.form_step.onboarding[data-form="step"], [data-form="step"].form_step.onboarding');
      if (!steps.length) {
        steps = document.querySelectorAll('[data-form="step"]');
      }
      if (!steps.length) return;

      var firstStep = steps[0];
      var buttonGroup = firstStep.querySelector('.button-group.is-form, .button-group');
      if (!buttonGroup || !buttonGroup.parentNode) return;

      var teaser = document.createElement('div');
      teaser.id = 'agilo-voice-teaser';
      teaser.className = 'agilo-voice-teaser';
      teaser.innerHTML = '<span class="agilo-voice-teaser-icon">' + TEASER_MIC_SVG + '</span><span>À la dernière étape, configurez votre empreinte vocale pour être reconnu(e) automatiquement dans vos transcriptions.</span>';
      // buttonGroup n'est pas enfant direct de firstStep → insérer via son parent réel
      buttonGroup.parentNode.insertBefore(teaser, buttonGroup);

      function hideTeaser() {
        teaser.classList.add('is-hidden');
      }

      document.querySelectorAll('[data-form="next-btn"]').forEach(function (btn) {
        btn.addEventListener('click', hideTeaser);
      });
      document.querySelectorAll('[data-form="progress"]').forEach(function (progress) {
        progress.addEventListener('click', hideTeaser);
      });
    } catch (e) {
      console.warn('[agilo-voice-onboarding] injectStep1Teaser failed', e);
    }
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

  function buildMarkup(firstName, lastName) {
    return [
      '<div class="agilo-voice-wrap">',
      '  <div class="agilo-voice-intro">',
      '    <p class="agilo-voice-intro-title">Faites reconnaître votre voix</p>',
      '    <p class="agilo-voice-intro-sub text-size-small">15 à 45 secondes suffisent pour apparaître automatiquement dans vos transcriptions.</p>',
      '  </div>',
      '  <div class="agilo-voice-record-area">',
      '    <div class="agilo-voice-name-grid">',
      '      <div><label class="agilo-voice-label" for="agilo-voice-first-name">Prénom</label>',
      '      <input class="agilo-voice-input select-input input-field w-input" id="agilo-voice-first-name" type="text" maxlength="80" value="' + escapeHtml(firstName) + '" placeholder="Ex. Nicolas"></div>',
      '      <div><label class="agilo-voice-label" for="agilo-voice-last-name">Nom</label>',
      '      <input class="agilo-voice-input select-input input-field w-input" id="agilo-voice-last-name" type="text" maxlength="80" value="' + escapeHtml(lastName) + '" placeholder="Ex. Dupont"></div>',
      '    </div>',
      '    <div class="agilo-voice-hero-wrap">',
      '      <div class="agilo-voice-hero is-idle" id="agilo-voice-hero" role="button" tabindex="0" aria-label="Démarrer l\'enregistrement vocal">',
      '        <div class="agilo-voice-waves" id="agilo-voice-waves" style="display:none" aria-hidden="true">',
      '          <span class="agilo-voice-wave"></span><span class="agilo-voice-wave"></span><span class="agilo-voice-wave"></span>',
      '        </div>',
      '        <div class="agilo-voice-hero-ring"></div>',
      '        <div id="agilo-voice-hero-icon">' + MIC_SVG + '</div>',
      '      </div>',
      '      <p class="agilo-voice-hero-label" id="agilo-voice-hero-label">Appuyez pour enregistrer votre voix</p>',
      '      <div class="agilo-voice-timer-compact" id="agilo-voice-timer"></div>',
      '      <button type="button" class="agilo-voice-rerecord-link" id="agilo-voice-rerecord">Réenregistrer</button>',
      '      <div class="agilo-voice-mini-player" id="agilo-voice-mini-player">',
      '        <button type="button" class="agilo-voice-play-btn" id="agilo-voice-play-btn" aria-label="Écouter">▶</button>',
      '        <span class="agilo-voice-play-time" id="agilo-voice-play-time">0:00 / 0:00</span>',
      '      </div>',
      '    </div>',
      '    <audio class="agilo-voice-audio" id="agilo-voice-preview"></audio>',
      '    <p class="agilo-voice-hint text-size-small" id="agilo-voice-hint">Parlez clairement, seul(e), dans un endroit calme.</p>',
      '    <div class="agilo-voice-submit-row">',
      '      <button type="button" class="agilo-voice-btn-submit button save" id="agilo-voice-submit">Enregistrer ma voix</button>',
      '    </div>',
      '    <button type="button" class="agilo-voice-file-alt" id="agilo-voice-file-alt">Importer un fichier audio à la place</button>',
      '    <div class="agilo-voice-drop-zone" id="agilo-voice-drop-zone" role="button" tabindex="0">',
      '      <strong>Glissez votre fichier audio ici</strong>',
      '      <span>ou cliquez pour sélectionner · MP3, WAV, webm, mp4 · 15 à 45 s</span>',
      '    </div>',
      '    <input class="agilo-voice-file" id="agilo-voice-file" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/webm,audio/*,video/*" hidden>',
      '  </div>',
      '  <div class="agilo-voice-actions">',
      '    <div class="agilo-voice-status" id="agilo-voice-status" role="status"></div>',
      '    <a class="agilo-voice-skip-link" id="agilo-voice-skip" href="#" role="button">Passer cette étape</a>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildFreeMarkup() {
    return [
      '<div class="agilo-voice-wrap">',
      '  <div class="agilo-voice-intro">',
      '    <p class="agilo-voice-intro-title">Reconnaissance vocale</p>',
      '  </div>',
      '  <div class="agilo-voice-free-upsell">',
      '    <p>La reconnaissance vocale est incluse dans les abonnements <a href="/pricing">Pro et Business</a>. Vous pourrez configurer votre voix depuis Mon compte après votre upgrade.</p>',
      '  </div>',
      '  <div class="agilo-voice-status" id="agilo-voice-status" role="status"></div>',
      '</div>'
    ].join('');
  }

  function mountFreeUI(container, creds) {
    injectStyles();
    container.innerHTML = buildFreeMarkup();
    updateVoiceEnrolledFlag(creds.memberstack, 'skipped');
  }

  function mountUI(container, creds) {
    injectStyles();
    container.innerHTML = buildMarkup(creds.firstName, creds.lastName);

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
      previewDurationMs: 0,
      credentials: creds
    };

    var els = {
      hero: container.querySelector('#agilo-voice-hero'),
      heroIcon: container.querySelector('#agilo-voice-hero-icon'),
      heroLabel: container.querySelector('#agilo-voice-hero-label'),
      waves: container.querySelector('#agilo-voice-waves'),
      firstName: container.querySelector('#agilo-voice-first-name'),
      lastName: container.querySelector('#agilo-voice-last-name'),
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
      submitBtn: container.querySelector('#agilo-voice-submit'),
      skipBtn: container.querySelector('#agilo-voice-skip'),
      status: container.querySelector('#agilo-voice-status')
    };

    applyWebflowSaveButton(els.submitBtn, 'Enregistrer ma voix');

    function setStatus(type, message) {
      els.status.className = 'agilo-voice-status';
      if (!message) return;
      els.status.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
      els.status.textContent = message;
    }

    function setBusy(busy) {
      els.submitBtn.disabled = busy;
      if (busy && state.uiState !== 'recording') els.hero.style.pointerEvents = 'none';
      else els.hero.style.pointerEvents = '';
      els.skipBtn.style.pointerEvents = busy ? 'none' : '';
      els.skipBtn.style.opacity = busy ? '0.5' : '';
    }

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
        els.heroIcon.innerHTML = STOP_SVG;
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
        els.heroIcon.innerHTML = CHECK_SVG;
        els.waves.style.display = 'none';
        els.heroLabel.textContent = state.uiState === 'preview' ? 'Enregistrement prêt' : 'Fichier prêt à envoyer';
        els.rerecord.style.display = state.uiState === 'preview' ? 'block' : 'none';
        if (state.uiState === 'preview') {
          els.miniPlayer.classList.add('is-visible');
          updatePlayTimeLabel();
        }
        els.hint.textContent = state.uiState === 'preview' ? 'Écoutez votre enregistrement, puis validez.' : 'Validez pour enregistrer votre voix.';
        els.submitBtn.classList.add('is-visible');
      } else {
        els.hero.classList.add('is-idle');
        els.heroIcon.innerHTML = MIC_SVG;
        els.waves.style.display = 'none';
        els.heroLabel.textContent = 'Appuyez pour enregistrer votre voix';
        els.hint.textContent = 'Parlez clairement, seul(e), dans un endroit calme.';
        els.submitBtn.classList.remove('is-visible');
      }
    }

    function cleanupStream() {
      if (state.mediaStream) state.mediaStream.getTracks().forEach(function (t) { t.stop(); });
      state.mediaStream = null;
      state.mediaRecorder = null;
    }

    function resetRecordingState() {
      if (state.timerId) clearInterval(state.timerId);
      state.timerId = null;
      state.recording = false;
      state.recordedBlob = null;
      state.previewDurationMs = 0;
      els.preview.pause();
      els.preview.removeAttribute('src');
      els.playBtn.textContent = '▶';
      cleanupStream();
      if (!state.fileMode) state.uiState = 'idle';
      updateUIState();
    }

    async function applySelectedFile(file) {
      setStatus('', '');
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
        setStatus('error', err.message || ERROR_MESSAGES.error_invalid_audio_file_content);
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
        els.fileInput.value = '';
        state.fileMode = false;
        updateDropZoneLabel('');
        if (state.uiState === 'preview') resetRecordingState();
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
        console.error('[agilo-voice-onboarding] startRecording', e);
        setStatus('error', 'Accès micro refusé ou indisponible. Importez un fichier audio à la place.');
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

    function getVoiceFile() {
      if (state.fileMode && els.fileInput.files && els.fileInput.files[0]) return els.fileInput.files[0];
      if (state.recordedBlob) return new File([state.recordedBlob], state.recordedFileName, { type: state.recordedBlob.type || 'audio/webm' });
      return null;
    }

    function validateSpeakerLabel() {
      return validateNames(els.firstName.value, els.lastName.value);
    }

    async function enrollVoice() {
      setStatus('', '');
      var labelErr = validateSpeakerLabel();
      if (labelErr) {
        setStatus('error', labelErr);
        return;
      }
      var voiceFile = getVoiceFile();
      if (!voiceFile) {
        setStatus('error', 'Enregistrez votre voix ou importez un fichier avant de continuer.');
        return;
      }
      if (state.fileMode) {
        try {
          await validateVoiceFileDuration(voiceFile);
        } catch (err) {
          setStatus('error', err.message);
          return;
        }
      } else if (state.recordedBlob && state.elapsedMs < MIN_RECORD_SEC * 1000) {
        setStatus('error', ERROR_MESSAGES.error_voice_file_duration_too_short);
        return;
      }

      var creds = state.credentials;
      if (!creds.token) {
        try {
          creds = await getCredentials();
          state.credentials = creds;
        } catch (e) {
          setStatus('error', 'Impossible de récupérer votre session. Rechargez la page.');
          return;
        }
      }

      var form = new FormData();
      form.append('username', creds.username);
      form.append('token', creds.token);
      form.append('edition', creds.edition);
      form.append('firstName', String(els.firstName.value).trim());
      form.append('lastName', String(els.lastName.value).trim());
      form.append('voiceFile', voiceFile, voiceFile.name);

      setBusy(true);
      setStatus('info', 'Envoi de votre empreinte vocale…');

      try {
        var r = await fetch(API_BASE + '/enrollSpeakerVoice', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: form,
          credentials: 'omit'
        });
        var d = await parseApiResponse(r);
        if (d.status === 'OK' && d.voiceId) {
          await updateVoiceEnrolledFlag(creds.memberstack, 'true');
          setStatus('success', 'Empreinte vocale enregistrée.');
          setTimeout(function () {
            var advanced = finishOnboardingWithGuard(
              els.status,
              'Empreinte vocale enregistrée. Répondez à la question ci-dessus puis cliquez sur Terminer.'
            );
            if (advanced) setStatus('success', 'Empreinte vocale enregistrée. Redirection…');
          }, 600);
          return;
        }
        logVoiceApiError('[agilo-voice-onboarding] enrollSpeakerVoice failed', d);
        setStatus('error', formatApiError(d, 'Impossible d\'enregistrer votre voix. Réessayez avec un enregistrement plus long et plus clair.'));
        if (isInvalidAudioApiError(d)) els.dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        console.error('[agilo-voice-onboarding] enrollVoice', e);
        setStatus('error', 'Erreur de connexion. Vérifiez votre connexion et réessayez.');
      } finally {
        setBusy(false);
      }
    }

    async function skipStep(e) {
      if (e) e.preventDefault();
      setBusy(true);
      await updateVoiceEnrolledFlag(state.credentials.memberstack, 'skipped');
      setStatus('info', 'Étape ignorée.');
      setTimeout(function () {
        finishOnboardingWithGuard(
          els.status,
          'Répondez à la question ci-dessus puis cliquez sur Terminer.'
        );
      }, 250);
    }

    els.hero.addEventListener('click', handleHeroClick);
    els.hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHeroClick(); }
    });
    els.rerecord.addEventListener('click', function () {
      if (state.recording) return;
      resetRecordingState();
      startRecording();
    });
    els.playBtn.addEventListener('click', function () {
      if (!els.preview.src) return;
      if (els.preview.paused) { els.preview.play(); els.playBtn.textContent = '❚❚'; }
      else { els.preview.pause(); els.playBtn.textContent = '▶'; }
    });
    els.preview.addEventListener('timeupdate', updatePlayTimeLabel);
    els.preview.addEventListener('ended', function () { els.playBtn.textContent = '▶'; });
    els.dropZone.addEventListener('click', function () { if (!state.recording) els.fileInput.click(); });
    els.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!state.recording) els.fileInput.click(); }
    });
    if (els.fileAlt) {
      els.fileAlt.addEventListener('click', function () {
        if (state.recording) return;
        els.fileInput.click();
      });
    }
    els.dropZone.addEventListener('dragover', function (e) { e.preventDefault(); els.dropZone.classList.add('is-dragover'); });
    els.dropZone.addEventListener('dragleave', function () { els.dropZone.classList.remove('is-dragover'); });
    els.dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      els.dropZone.classList.remove('is-dragover');
      if (state.recording) return;
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) applySelectedFile(file);
    });
    els.submitBtn.addEventListener('click', enrollVoice);
    els.skipBtn.addEventListener('click', skipStep);
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

    updateUIState();
  }

  async function init() {
    injectStyles();
    wireFinishButtonValidation();

    var container = document.getElementById(AGILO_VOICE_CONFIG.containerId);
    if (!container) {
      console.warn('[agilo-voice-onboarding] Container #' + AGILO_VOICE_CONFIG.containerId + ' introuvable.');
      return;
    }

    container.innerHTML = '<p style="color:var(--color--gris,#525252);text-align:center;margin:1rem 0">Chargement de l\'empreinte vocale…</p>';

    injectStep1Teaser();

    try {
      var creds = await getCredentials();
      if (normEdition(creds.edition) === 'free') {
        mountFreeUI(container, creds);
      } else {
        mountUI(container, creds);
      }
    } catch (e) {
      console.error('[agilo-voice-onboarding] init failed', e);
      var fallbackCreds = {
        username: localStorage.getItem('agilo:username') || '',
        token: '',
        edition: normEdition(localStorage.getItem('agilo:edition') || 'free'),
        firstName: '',
        lastName: '',
        memberstack: window.$memberstackDom || null
      };
      if (normEdition(fallbackCreds.edition) === 'free') {
        mountFreeUI(container, fallbackCreds);
      } else {
        mountUI(container, fallbackCreds);
        var statusEl = container.querySelector('#agilo-voice-status');
        if (statusEl) {
          statusEl.className = 'agilo-voice-status is-info';
          statusEl.textContent = 'Session en cours de chargement. Si l\'enregistrement échoue, rechargez la page.';
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
