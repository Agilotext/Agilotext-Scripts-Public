/* ================================================================
   AGILOTEXT - VOICE ENROLLMENT INVITE (page invité)
   Page : /auth/voice-invite
   URLs :
     - Production : https://www.agilotext.com/auth/voice-invite?inviteToken=sv_...
     - Staging    : https://agilotext-test.webflow.io/auth/voice-invite?inviteToken=sv_...
   Déploiement Webflow :
     1. Embed : <div id="agilo-voice-invite"></div>
     2. Script (pin SHA) :
        https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@a4323ea/scripts/pages/auth/voice-enrollment-invite.js?v=1.09-voice25
   API : POST submitSpeakerVoiceInvite (inviteToken, fullName, voiceFile)
   Styles : sync avec voice-enrollment-settings.js injectStyles (voice21)
   ================================================================ */

(function () {
  'use strict';

  if (!/^\/auth\/voice-invite\/?$/.test(window.location.pathname || '')) return;
  if (window.__agiloVoiceInviteInit) return;
  window.__agiloVoiceInviteInit = true;

  var API_BASE = 'https://api.agilotext.com/api/v1';
  var MIN_RECORD_SEC = 15;
  var MAX_RECORD_SEC = 45;
  var RESERVED_LABELS = new Set(['S1', 'S2', 'UU']);
  var AGILO_RADIUS = 'var(--0-5_radius,0.5rem)';

  var READING_PASSAGES = [
    {
      id: 'proust',
      labelShort: 'Proust',
      text: 'Longtemps, je me suis couché de bonne heure. Parfois, à peine ma bougie éteinte, mes yeux se fermaient si vite que je n\'avais pas le temps de me dire : « Je m\'endors. » Et, une demi-heure après, la pensée qu\'il était temps de chercher le sommeil m\'éveillait ; je voulais poser le volume que je croyais avoir encore dans les mains et souffler ma lumière ; je n\'avais pas cessé en dormant de faire des réflexions sur ce que je venais de lire, mais ces réflexions avaient pris un tour un peu particulier.',
      author: 'Marcel Proust',
      work: 'Du côté de chez Swann (1913)'
    },
    {
      id: 'prevert',
      labelShort: 'Prévert',
      text: 'Il cassait les œufs dans une assiette bleue. Il tournait en riant le dos au papier peint jaune où je devais faire l\'effet d\'une grande vague bleue. Il tournait en riant vers moi et les tremblements de son rire me faisaient trembler sur la chaise. Il tournait en riant le dos au papier peint jaune.',
      author: 'Jacques Prévert',
      work: 'Paroles — Déjeuner du matin (1945)'
    },
    {
      id: 'hugo',
      labelShort: 'Hugo',
      text: 'Demain, dès l\'aube, à l\'heure où blanchit la campagne, je partirai. Vois-tu, je sais que tu m\'attends. J\'irai par la forêt, j\'irai par la montagne. Je ne puis demeurer loin de toi plus longtemps.',
      author: 'Victor Hugo',
      work: 'Les Contemplations — Demain, dès l\'aube (1856)'
    }
  ];

  var READING_RULES_HTML = [
    '<p class="agilo-voice-reading-rules-title"><strong>Consignes d\'enregistrement</strong></p>',
    '<ul class="agilo-voice-reading-rules">',
    '  <li>Parlez seul(e), à voix haute et naturelle</li>',
    '  <li>Aucun bruit parasite : pas de feuilletage, clavier, pas de page tournée</li>',
    '  <li>Endroit calme, micro à 20–30 cm de votre bouche</li>',
    '  <li>Durée : entre 15 et 45 secondes</li>',
    '</ul>'
  ].join('');

  function pickReadingPassage() {
    return READING_PASSAGES[Math.floor(Math.random() * READING_PASSAGES.length)];
  }

  function buildReadingPanelHtml(passage) {
    return [
      '<blockquote class="agilo-voice-reading-quote">' + escapeHtml(passage.text) + '</blockquote>',
      '<p class="agilo-voice-reading-attrib">— ' + escapeHtml(passage.author) + ', <em>' + escapeHtml(passage.work) + '</em></p>',
      READING_RULES_HTML
    ].join('');
  }

  var MIC_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHECK_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/><path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var STOP_SVG = '<svg class="agilo-voice-hero-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
  var WEBFLOW_SAVE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" class="icon-1x1-small white" aria-hidden="true"><path d="M15.25 4.5C15.25 4.22386 15.0261 4 14.75 4H9.25C8.97386 4 8.75 4.22386 8.75 4.5V7.59998C8.75 7.73805 8.86193 7.84998 9 7.84998H15C15.1381 7.84998 15.25 7.73805 15.25 7.59998V4.5Z" fill="currentColor"></path><path d="M8.25 20C8.25 20.2761 8.47386 20.5 8.75 20.5H15.25C15.5261 20.5 15.75 20.2761 15.75 20V15C15.75 14.8619 15.6381 14.75 15.5 14.75H8.5C8.36193 14.75 8.25 14.8619 8.25 15V20Z" fill="currentColor"></path><path d="M7.25 7.59998C7.25 8.56647 8.0335 9.34998 9 9.34998H15C15.9665 9.34998 16.75 8.56647 16.75 7.59998V4.27627C16.75 4.02369 16.8737 4 17.0263 4C17.1722 4 17.3108 4.06373 17.4058 4.17448L20.3685 7.62867C20.7791 8.1074 20.9936 8.72364 20.9689 9.35387L20.6273 18.0976C20.5749 19.4393 19.4719 20.5 18.1292 20.5H17.75C17.4739 20.5 17.25 20.2761 17.25 20V15C17.25 14.0335 16.4665 13.25 15.5 13.25H8.5C7.5335 13.25 6.75 14.0335 6.75 15V20C6.75 20.2761 6.52614 20.5 6.25 20.5H6.11291C4.90908 20.5 3.89276 19.6055 3.73989 18.4114C3.24597 14.5534 3.2247 10.6495 3.67653 6.78632L3.73742 6.26575C3.8885 4.97395 4.983 4 6.28361 4H6.75C7.02614 4 7.25 4.22386 7.25 4.5V7.59998Z" fill="currentColor"></path></svg>';

  var ERROR_MESSAGES = {
    error_voice_file_duration_too_short: 'L\'extrait audio doit durer au moins 15 secondes.',
    error_voice_file_duration_too_long: 'L\'extrait audio ne doit pas dépasser 45 secondes.',
    error_invalid_audio_file_content: 'Le fichier ne peut pas être lu comme un audio valide.',
    error_reserved_speaker_label: 'Ce nom est réservé. Utilisez votre prénom et nom (pas S1, S2 ou UU).',
    error_multiple_speakers_in_voice_enrollment: 'L\'audio contient plusieurs voix. Merci d\'envoyer un extrait avec une seule voix.',
    error_speaker_identifier_not_found: 'Voix non identifiable. Parlez plus distinctement et plus près du micro.'
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function decodeParam(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(String(value).replace(/\+/g, ' ')).trim().slice(0, 160);
    } catch (e) {
      return String(value).trim().slice(0, 160);
    }
  }

  function getUrlParams() {
    var qs = new URLSearchParams(window.location.search || '');
    return {
      inviteToken: decodeParam(qs.get('inviteToken')),
      recipientName: decodeParam(qs.get('recipientName')),
      invitedBy: decodeParam(qs.get('invitedBy'))
    };
  }

  function validateDisplayName(full) {
    var name = String(full || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) return 'Indiquez votre prénom et votre nom.';
    if (!/\s/.test(name)) return 'Indiquez votre prénom et votre nom (deux mots minimum).';
    if (RESERVED_LABELS.has(name.toUpperCase())) return ERROR_MESSAGES.error_reserved_speaker_label;
    var parts = name.split(' ');
    for (var i = 0; i < parts.length; i++) {
      if (RESERVED_LABELS.has(parts[i].toUpperCase())) return ERROR_MESSAGES.error_reserved_speaker_label;
    }
    return '';
  }

  function decodeHtmlEntities(text) {
    var el = document.createElement('textarea');
    el.innerHTML = String(text || '');
    return el.value;
  }

  function warnEditionBackendError(inviteToken, rawText) {
    console.warn('[agilo-voice-invite] backend edition check failed — known P0 submitSpeakerVoiceInvite', {
      inviteTokenPrefix: String(inviteToken || '').slice(0, 12),
      backendMessage: rawText
    });
  }

  function matchVoiceError(text, inviteToken) {
    var t = String(text || '').toLowerCase();
    if (!t) return null;
    if (t.indexOf('pas disponible pour ce compte') !== -1) {
      warnEditionBackendError(inviteToken, text);
      return {
        message: 'L\'enregistrement n\'a pas pu être finalisé. La personne qui vous a invité doit contacter le support Agilotext — réf. invitation vocale.',
        reason: 'edition_unavailable'
      };
    }
    if (
      t.indexOf('plusieurs voix') !== -1 ||
      t.indexOf('une seule voix') !== -1 ||
      t.indexOf('audio contient plusieurs voix') !== -1 ||
      t.indexOf('multiple speakers') !== -1
    ) {
      return {
        message: ERROR_MESSAGES.error_multiple_speakers_in_voice_enrollment,
        reason: 'multiple_speakers'
      };
    }
    if (t.indexOf('no spoken audio') !== -1 || t.indexOf('silent') !== -1 || t.indexOf('silenc') !== -1 || t.indexOf('aucune voix') !== -1) {
      return {
        message: 'Aucune voix détectée. Vérifiez votre micro et parlez plus fort, plus près, pendant au moins 15 secondes.',
        reason: 'silent_audio'
      };
    }
    if (t.indexOf('speaker identifier not found') !== -1 || t.indexOf('voix non identifiable') !== -1) {
      return {
        message: ERROR_MESSAGES.error_speaker_identifier_not_found,
        reason: 'speaker_not_found'
      };
    }
    if (t.indexOf('invalid audio') !== -1 || t.indexOf('job rejected') !== -1) {
      return {
        message: 'Votre enregistrement n\'a pas pu être analysé. Essayez un fichier MP3 ou WAV de 15 secondes minimum.',
        reason: 'invalid_audio'
      };
    }
    if (t.indexOf('invalide') !== -1 || t.indexOf('expir') !== -1 || t.indexOf('introuvable') !== -1 || t.indexOf('not found') !== -1) {
      return {
        message: 'Ce lien n\'est plus valide ou a expiré. Demandez un nouveau lien à la personne qui vous a invité(e).',
        reason: 'invite_expired'
      };
    }
    if (t.indexOf('too short') !== -1 || t.indexOf('trop court') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('short') !== -1)) {
      return { message: ERROR_MESSAGES.error_voice_file_duration_too_short, reason: 'duration_too_short' };
    }
    if (t.indexOf('too long') !== -1 || t.indexOf('trop long') !== -1 || (t.indexOf('duration') !== -1 && t.indexOf('long') !== -1)) {
      return { message: ERROR_MESSAGES.error_voice_file_duration_too_long, reason: 'duration_too_long' };
    }
    if (t.indexOf('fichier audio') !== -1 && t.indexOf('reçu') !== -1) {
      return {
        message: 'Aucun fichier audio valide. Enregistrez votre voix ou importez un fichier.',
        reason: 'missing_audio_file'
      };
    }
    if (t.indexOf('speechmatics') !== -1 || t.indexOf('enrollment job') !== -1 || t.indexOf('n\'a pas pu') !== -1) {
      return {
        message: 'L\'enregistrement vocal n\'a pas été accepté. Parlez clairement pendant 15 à 45 secondes dans un endroit calme.',
        reason: 'enrollment_rejected'
      };
    }
    return null;
  }

  function matchVoiceErrorMessage(text, inviteToken) {
    var err = matchVoiceError(text, inviteToken);
    return err ? err.message : '';
  }

  function isStrictVoiceEnrollmentSuccess(combined) {
    var t = String(combined || '').toLowerCase();
    return /empreinte vocale.*enregistr|a bien été enregistr|voice enrolled|enregistrée avec succès|enrollment (was )?successful|succ[eè]s.*enregistr/i.test(t);
  }

  function parseSubmitHtml(html, inviteToken) {
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    var h1 = decodeHtmlEntities((doc.querySelector('h1') || {}).textContent || '').trim();
    var p = decodeHtmlEntities((doc.querySelector('p') || {}).textContent || '').trim();
    var combined = (h1 + ' ' + p).trim();

    var voiceErr = matchVoiceError(combined, inviteToken) || matchVoiceError(p, inviteToken) || matchVoiceError(h1, inviteToken);
    if (voiceErr) {
      return { ok: false, title: h1, message: voiceErr.message, reason: voiceErr.reason };
    }

    if (isStrictVoiceEnrollmentSuccess(combined)) {
      return {
        ok: true,
        title: h1,
        message: p || h1 || 'Votre empreinte vocale a bien été enregistrée.'
      };
    }

    if (/n'a pas pu|pas disponible|invalide|expir|introuvable/i.test(combined)) {
      var mapped = matchVoiceErrorMessage(combined, inviteToken) || matchVoiceErrorMessage(p, inviteToken) || p || h1;
      return { ok: false, title: h1, message: mapped, reason: 'backend_rejection' };
    }

    if (h1 || p) {
      return {
        ok: false,
        title: h1,
        message: matchVoiceErrorMessage(combined, inviteToken) || p || h1 || 'Impossible d\'envoyer l\'empreinte vocale. Réessayez.',
        reason: 'ambiguous_response'
      };
    }

    return {
      ok: false,
      title: 'Erreur',
      message: 'Impossible d\'envoyer l\'empreinte vocale. Réessayez.',
      reason: 'empty_response'
    };
  }

  function getWebflowSaveIconHtml() {
    var svgs = document.querySelectorAll('.button.save svg.icon-1x1-small, button.save svg.icon-1x1-small');
    for (var i = 0; i < svgs.length; i++) {
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

  function injectStyles() {
    if (document.getElementById('agilo-voice-enroll-styles')) return;
    var style = document.createElement('style');
    style.id = 'agilo-voice-enroll-styles';
    style.textContent = [
      '@keyframes agilo-voice-pulse{0%{transform:scale(.92);opacity:.55}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}',
      '.agilo-voice-wrap{max-width:720px;width:100%;margin:0 auto;font-family:inherit;color:var(--color--gris_foncé,#020202)}',
      '#agilo-voice-invite{scroll-margin-top:5.5rem}',
      '.agilo-voice-card{background:transparent;border:none;border-radius:0;padding:0}',
      '.agilo-voice-lead{margin:0 0 1.25rem;color:var(--color--gris,#525252);font-size:.95rem;line-height:1.55}',
      '.agilo-voice-lead strong{color:var(--color--gris_foncé,#020202)}',
      '.agilo-voice-reading-toggle{display:inline-flex;margin:0 0 1rem;padding:0;border:0;background:none;color:var(--color--blue,#174a96);font:inherit;font-size:.88rem;font-weight:600;text-decoration:underline;cursor:pointer}',
      '.agilo-voice-reading-panel{display:none;margin:0 0 1rem;padding:12px 14px;border-radius:' + AGILO_RADIUS + ';background:rgba(23,74,150,.06);border:1px solid rgba(23,74,150,.15);font-size:.88rem;line-height:1.55;color:var(--color--gris,#525252)}',
      '.agilo-voice-reading-panel.is-open{display:block}',
      '.agilo-voice-reading-quote{margin:0 0 10px;padding:0;border:none;font-style:italic;color:var(--color--gris_foncé,#020202);line-height:1.6}',
      '.agilo-voice-reading-attrib{margin:0 0 14px;font-size:.82rem;color:var(--color--gris,#525252)}',
      '.agilo-voice-reading-attrib em{font-style:normal}',
      '.agilo-voice-reading-rules-title{margin:14px 0 8px;padding-top:12px;border-top:1px solid rgba(23,74,150,.12);font-size:.85rem}',
      '.agilo-voice-reading-rules{margin:0;padding-left:1.15rem;font-size:.84rem;line-height:1.55}',
      '.agilo-voice-reading-rules li{margin-bottom:4px}',
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
      '.agilo-voice-submit-row{margin-top:.5rem;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;width:100%}',
      '.agilo-voice-submit-row .agilo-voice-btn-submit{margin:0 auto}',
      '.agilo-voice-record-area{display:flex;flex-direction:column;gap:.75rem}',
      '.agilo-voice-label{display:block;margin:0 0 .45rem;font-size:.9rem;font-weight:500}',
      '.agilo-voice-input{width:100%;box-sizing:border-box;border:1px solid rgba(82,82,82,.25);border-radius:' + AGILO_RADIUS + ';background:#fff;padding:10px 12px;font:inherit}',
      '.agilo-voice-input:focus{outline:none;border-color:var(--color--blue,#174a96);box-shadow:0 0 0 2px rgba(23,74,150,.12)}',
      '.agilo-voice-hint{font-size:.85rem;color:var(--color--gris,#525252);margin:.35rem 0 0;text-align:center;line-height:1.45}',
      '.agilo-voice-file-alt{display:none;margin:.35rem 0 0;text-align:center;font-size:.82rem;color:var(--color--blue,#174a96);cursor:pointer;background:none;border:none;font:inherit;text-decoration:underline;width:100%;padding:0}',
      '.agilo-voice-record-area.is-preview-ready .agilo-voice-drop-zone{display:none}',
      '.agilo-voice-record-area.is-preview-ready .agilo-voice-file-alt{display:block}',
      '.agilo-voice-btn-submit{display:none}',
      '.agilo-voice-btn-submit.is-visible{display:inline-flex}',
      '.agilo-voice-hero-ring{position:absolute;inset:0;border-radius:50%;background:rgba(23,74,150,.1);border:1px solid rgba(23,74,150,.18)}',
      '.agilo-voice-hero.is-recording .agilo-voice-hero-ring{background:rgba(168,38,51,.1);border-color:rgba(168,38,51,.25)}',
      '.agilo-voice-hero.is-preview .agilo-voice-hero-ring{background:rgba(28,102,26,.1);border-color:rgba(28,102,26,.22)}',
      '.agilo-voice-hero-icon{position:relative;z-index:2;width:44px;height:44px;color:var(--color--blue,#174a96);pointer-events:none}',
      '.agilo-voice-hero.is-recording .agilo-voice-hero-icon{color:var(--color--rouge,#a82633)}',
      '.agilo-voice-hero.is-preview .agilo-voice-hero-icon{color:var(--color--vert,#1c661a)}',
      '.agilo-voice-waves{position:absolute;inset:0;pointer-events:none}',
      '.agilo-voice-wave{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(168,38,51,.35);animation:agilo-voice-pulse 2s ease-out infinite}',
      '.agilo-voice-wave:nth-child(2){animation-delay:.55s}',
      '.agilo-voice-wave:nth-child(3){animation-delay:1.1s}',
      '.agilo-voice-status{margin-top:.75rem;padding:10px 12px;border-radius:' + AGILO_RADIUS + ';font-size:.9rem;display:none}',
      '.agilo-voice-status.is-error{display:block;background:rgba(168,38,51,.08);color:var(--color--rouge,#a82633)}',
      '.agilo-voice-status.is-success{display:block;background:rgba(28,102,26,.1);color:var(--color--vert,#1c661a)}',
      '.agilo-voice-status.is-info{display:block;background:rgba(23,74,150,.08);color:var(--color--blue,#174a96)}',
      '.agilo-voice-success-panel{text-align:center;padding:24px 12px}',
      '.agilo-voice-success-panel .agilo-voice-hero{margin-bottom:12px}',
      '.agilo-voice-error-panel{padding:20px 0;text-align:center}',
      '.agilo-voice-error-panel h2{margin:0 0 8px;font-size:1.25rem}',
      '.agilo-voice-error-panel p{margin:0;color:var(--color--gris,#525252);line-height:1.5}'
    ].join('');
    document.head.appendChild(style);
  }

  function setStatus(el, type, message) {
    if (!el) return;
    el.className = 'agilo-voice-status';
    if (!message) return;
    el.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
    el.textContent = message;
  }

  function getSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return 'audio/webm';
    var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return 'audio/webm';
  }

  function getEnrollmentFileName(mimeType) {
    var mime = String(mimeType || '');
    if (mime.indexOf('mp4') !== -1) return 'voice-enrollment.mp4';
    if (mime.indexOf('ogg') !== -1) return 'voice-enrollment.ogg';
    return 'voice-enrollment.webm';
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
          reject(new Error(ERROR_MESSAGES.error_invalid_audio_file_content));
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

  function validateVoiceFileDuration(file) {
    return measureAudioDuration(file).then(function (duration) {
      if (duration < MIN_RECORD_SEC) throw new Error(ERROR_MESSAGES.error_voice_file_duration_too_short);
      if (duration > MAX_RECORD_SEC) throw new Error(ERROR_MESSAGES.error_voice_file_duration_too_long);
      return duration;
    });
  }

  function trackInviteEvent(success, extra) {
    if (!window.posthog || typeof window.posthog.capture !== 'function') return;
    try {
      window.posthog.capture('voice_invite_submitted', Object.assign({ success: !!success }, extra || {}));
    } catch (e) { /* noop */ }
  }

  async function submitInviteVoice(inviteToken, fullName, voiceFile) {
    var fd = new FormData();
    fd.append('inviteToken', inviteToken);
    fd.append('fullName', fullName);
    fd.append('voiceFile', voiceFile, voiceFile.name);
    var r = await fetch(API_BASE + '/submitSpeakerVoiceInvite', {
      method: 'POST',
      body: fd,
      credentials: 'omit'
    });
    var ct = String(r.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') !== -1) {
      var json = await r.json();
      if (json.status === 'OK') return { ok: true, message: json.message || 'Empreinte vocale enregistrée.' };
      var raw = json.errorMessage || json.message || json.error || '';
      var errMatch = matchVoiceError(String(raw), inviteToken);
      if (errMatch) return { ok: false, message: errMatch.message, reason: errMatch.reason };
      return { ok: false, message: String(raw) || 'Erreur serveur.', reason: 'api_error' };
    }
    return parseSubmitHtml(await r.text(), inviteToken);
  }

  function submitInviteVoiceFormFallback(inviteToken, fullName, voiceFile) {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = API_BASE + '/submitSpeakerVoiceInvite';
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';

    function addField(name, value) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    addField('inviteToken', inviteToken);
    addField('fullName', fullName);

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'voiceFile';
    var dt = new DataTransfer();
    dt.items.add(voiceFile);
    fileInput.files = dt.files;
    form.appendChild(fileInput);

    document.body.appendChild(form);
    form.submit();
  }

  function renderMissingToken(container) {
    container.innerHTML = [
      '<div class="agilo-voice-error-panel">',
      '  <h2>Lien incomplet</h2>',
      '  <p>Ce lien d\'invitation est invalide ou incomplet. Ouvrez le lien reçu par email ou demandez une nouvelle invitation.</p>',
      '</div>'
    ].join('');
  }

  function renderSuccess(container, message) {
    container.innerHTML = [
      '<div class="agilo-voice-success-panel">',
      '  <div class="agilo-voice-hero-wrap">',
      '    <div class="agilo-voice-hero is-preview" aria-hidden="true">',
      '      <div class="agilo-voice-hero-ring"></div>',
      '      <div>' + CHECK_SVG + '</div>',
      '    </div>',
      '    <p class="agilo-voice-hero-label"><strong>Merci !</strong></p>',
      '  </div>',
      '  <p class="agilo-voice-lead" style="text-align:center">' + escapeHtml(message || 'Votre empreinte vocale a bien été enregistrée. Vous pouvez fermer cette page.') + '</p>',
      '</div>'
    ].join('');
  }

  function buildLeadText(params) {
    var parts = [];
    if (params.recipientName) {
      parts.push('Bonjour <strong>' + escapeHtml(params.recipientName) + '</strong>.');
    }
    if (params.invitedBy) {
      parts.push('<strong>' + escapeHtml(params.invitedBy) + '</strong> vous invite à enregistrer votre empreinte vocale pour Agilotext.');
    }
    if (!parts.length) {
      parts.push('Enregistrez votre empreinte vocale pour qu\'Agilotext reconnaisse votre voix lors des réunions.');
    }
    parts.push('Parlez seul(e), clairement, entre <strong>15 et 45 secondes</strong>.');
    return parts.join(' ');
  }

  function mountRecordForm(container, params, statusEl) {
    var displayName = params.recipientName || '';
    var readingPassage = pickReadingPassage();
    var readingToggleLabel = 'Un passage à lire — ' + readingPassage.labelShort;

    container.innerHTML = [
      '<p class="agilo-voice-lead">' + buildLeadText(params) + '</p>',
      '<button type="button" class="agilo-voice-reading-toggle" id="agilo-voice-reading-toggle" aria-expanded="false" aria-controls="agilo-voice-reading-panel">' + escapeHtml(readingToggleLabel) + '</button>',
      '<div class="agilo-voice-reading-panel" id="agilo-voice-reading-panel" hidden>' + buildReadingPanelHtml(readingPassage) + '</div>',
      '<div class="agilo-voice-record-area" id="agilo-voice-record-area">',
      '  <div class="agilo-voice-name-single">',
      '    <label class="agilo-voice-label" for="agilo-voice-display-name">Prénom &amp; Nom</label>',
      '    <input class="agilo-voice-input" id="agilo-voice-display-name" type="text" maxlength="160" placeholder="Ex. Marie Dupont" value="' + escapeHtml(displayName) + '">',
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

    var readingToggle = container.querySelector('#agilo-voice-reading-toggle');
    var readingPanel = container.querySelector('#agilo-voice-reading-panel');
    readingToggle.addEventListener('click', function () {
      var open = readingPanel.classList.toggle('is-open');
      readingPanel.hidden = !open;
      readingToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

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
      recordArea: container.querySelector('#agilo-voice-record-area'),
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
      els.hero.classList.remove('is-idle', 'is-recording', 'is-preview', 'is-retry');
      els.timer.classList.remove('is-visible');
      els.rerecord.style.display = 'none';
      els.miniPlayer.classList.remove('is-visible');
      els.hero.style.pointerEvents = '';
      els.hero.style.opacity = '';
      els.recordArea.classList.toggle('is-preview-ready', state.uiState === 'preview');

      if (state.uiState === 'recording') {
        els.hero.classList.add('is-recording');
        if (_lastIconState !== 'recording') { els.heroIcon.innerHTML = STOP_SVG; _lastIconState = 'recording'; }
        els.waves.style.display = 'block';
        if (state.elapsedMs < MIN_RECORD_SEC * 1000) {
          var remainingSec = Math.max(1, Math.ceil((MIN_RECORD_SEC * 1000 - state.elapsedMs) / 1000));
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
        if (_lastIconState !== 'preview') { els.heroIcon.innerHTML = CHECK_SVG; _lastIconState = 'preview'; }
        els.waves.style.display = 'none';
        els.heroLabel.textContent = state.uiState === 'preview' ? 'Enregistrement prêt' : 'Fichier prêt à envoyer';
        els.rerecord.style.display = state.uiState === 'preview' ? 'block' : 'none';
        if (state.uiState === 'preview') {
          els.miniPlayer.classList.add('is-visible');
          updatePlayTimeLabel();
        }
        els.hint.textContent = state.uiState === 'preview' ? 'Écoutez votre enregistrement, puis validez.' : 'Validez pour enregistrer cette voix.';
        els.submitBtn.classList.add('is-visible');
      } else if (state.uiState === 'retry') {
        els.hero.classList.add('is-idle', 'is-retry');
        if (_lastIconState !== 'idle') { els.heroIcon.innerHTML = MIC_SVG; _lastIconState = 'idle'; }
        els.waves.style.display = 'none';
        els.heroLabel.textContent = 'Recommencez avec une seule voix';
        els.hint.textContent = 'Enregistrez un nouvel extrait, seul(e), entre 15 et 45 secondes.';
        els.submitBtn.classList.remove('is-visible');
      } else {
        els.hero.classList.add('is-idle');
        if (_lastIconState !== 'idle') { els.heroIcon.innerHTML = MIC_SVG; _lastIconState = 'idle'; }
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

    function resetAfterRejectedVoice(message) {
      els.submitBtn.disabled = false;
      els.hero.style.pointerEvents = '';
      applyWebflowSaveButton(els.submitBtn, 'Enregistrer cette voix');
      state.fileMode = false;
      els.fileInput.value = '';
      updateDropZoneLabel('');
      state.recordedBlob = null;
      state.previewDurationMs = 0;
      state.elapsedMs = 0;
      els.preview.pause();
      els.preview.removeAttribute('src');
      els.playBtn.textContent = '▶';
      state.uiState = 'retry';
      updateUIState();
      setStatus(statusEl, 'error', message || 'Impossible d\'enregistrer cette voix.');
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

    function applySelectedFile(file) {
      return validateVoiceFileDuration(file).then(function () {
        setStatus(statusEl, '', '');
        state.fileMode = true;
        state.recordedBlob = null;
        els.preview.removeAttribute('src');
        updateDropZoneLabel(file.name);
        state.uiState = 'file';
        updateUIState();
      }).catch(function (err) {
        els.fileInput.value = '';
        state.fileMode = false;
        updateDropZoneLabel('');
        state.uiState = 'idle';
        updateUIState();
        setStatus(statusEl, 'error', err.message || ERROR_MESSAGES.error_invalid_audio_file_content);
      });
    }

    function startRecording() {
      setStatus(statusEl, '', '');
      if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
        setStatus(statusEl, 'error', 'Micro non disponible. Importez un fichier audio.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        els.fileInput.value = '';
        state.fileMode = false;
        updateDropZoneLabel('');
        if (state.uiState === 'preview') resetRecording();
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
      }).catch(function () {
        setStatus(statusEl, 'error', 'Accès micro refusé. Importez un fichier audio.');
        cleanupStream();
      });
    }

    function stopRecording() {
      if (!state.recording || !state.mediaRecorder || state.elapsedMs < MIN_RECORD_SEC * 1000) return;
      state.recording = false;
      clearInterval(state.timerId);
      state.timerId = null;
      try { if (state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop(); } catch (e) { /* noop */ }
      cleanupStream();
    }

    var heroBusy = false;
    function handleHeroAction() {
      if (heroBusy) return;
      if (state.uiState === 'recording') {
        heroBusy = true;
        stopRecording();
        setTimeout(function () { heroBusy = false; }, 300);
      } else if (state.uiState === 'idle' || state.uiState === 'retry') {
        startRecording();
      }
    }

    els.hero.addEventListener('click', handleHeroAction);
    els.hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHeroAction(); }
    });
    els.rerecord.addEventListener('click', function () {
      if (state.recording) return;
      resetRecording();
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
    els.fileAlt.addEventListener('click', function () { if (!state.recording) els.fileInput.click(); });
    els.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!state.recording) els.fileInput.click(); }
    });
    els.dropZone.addEventListener('dragover', function (e) { e.preventDefault(); els.dropZone.classList.add('is-dragover'); });
    els.dropZone.addEventListener('dragleave', function () { els.dropZone.classList.remove('is-dragover'); });
    els.dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      els.dropZone.classList.remove('is-dragover');
      if (state.recording) return;
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) applySelectedFile(file);
    });
    els.fileInput.addEventListener('change', function () {
      if (!els.fileInput.files || !els.fileInput.files[0]) {
        state.fileMode = false;
        updateDropZoneLabel('');
        if (!state.recordedBlob) state.uiState = 'idle';
        updateUIState();
        return;
      }
      applySelectedFile(els.fileInput.files[0]);
    });

    els.submitBtn.addEventListener('click', function () {
      setStatus(statusEl, '', '');
      var nameErr = validateDisplayName(els.displayName.value);
      if (nameErr) {
        setStatus(statusEl, 'error', nameErr);
        return;
      }
      var voiceFile = getVoiceFile();
      if (!voiceFile) {
        setStatus(statusEl, 'error', 'Enregistrez votre voix ou importez un fichier.');
        return;
      }
      var fullName = els.displayName.value.trim().replace(/\s+/g, ' ');
      var submitPromise = state.fileMode ? validateVoiceFileDuration(voiceFile) : Promise.resolve();
      submitPromise.then(function () {
        if (!state.fileMode && state.elapsedMs < MIN_RECORD_SEC * 1000 && state.recordedBlob) {
          throw new Error(ERROR_MESSAGES.error_voice_file_duration_too_short);
        }
        els.submitBtn.disabled = true;
        els.hero.style.pointerEvents = 'none';
        applyWebflowSaveButton(els.submitBtn, 'Envoi en cours…');
        setStatus(statusEl, 'info', 'Envoi de l\'empreinte vocale…');
        return submitInviteVoice(params.inviteToken, fullName, voiceFile);
      }).then(function (result) {
        if (!result) return;
        if (result.ok) {
          trackInviteEvent(true, { invite_token_prefix: String(params.inviteToken).slice(0, 8) });
          renderSuccess(container.parentElement || container, result.message);
          if (statusEl) statusEl.textContent = '';
          return;
        }
        trackInviteEvent(false, { reason: result.reason || result.message });
        resetAfterRejectedVoice(result.message || 'Impossible d\'enregistrer cette voix.');
      }).catch(function (err) {
        if (String(err && err.message || '').indexOf('Failed to fetch') !== -1) {
          setStatus(statusEl, 'info', 'Redirection vers l\'envoi sécurisé…');
          submitInviteVoiceFormFallback(params.inviteToken, fullName, voiceFile);
          return;
        }
        trackInviteEvent(false, { reason: err && err.message });
        resetAfterRejectedVoice((err && err.message) || 'Impossible d\'enregistrer cette voix.');
      });
    });

    updateUIState();
  }

  function init() {
    injectStyles();
    var root = document.getElementById('agilo-voice-invite');
    if (!root) {
      console.warn('[agilo-voice-invite] #agilo-voice-invite introuvable');
      return;
    }

    var params = getUrlParams();
    root.innerHTML = '<div class="agilo-voice-wrap"><div class="agilo-voice-card" id="agilo-voice-invite-body"></div><div class="agilo-voice-status" id="agilo-voice-invite-status" aria-live="polite"></div></div>';

    var body = document.getElementById('agilo-voice-invite-body');
    var statusEl = document.getElementById('agilo-voice-invite-status');

    if (!params.inviteToken || !/^sv_[a-zA-Z0-9._-]+$/.test(params.inviteToken)) {
      renderMissingToken(body);
      return;
    }

    mountRecordForm(body, params, statusEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
