/**
 * Format erreurs API transcript / job Agilotext : prioritise userErrorMessage pour l’UX,
 * garde javaException + stack comme détails techniques (support / diagnostic).
 *
 * Optionnel dans Webflow : charger ce fichier une fois avant les scripts métier pour
 * exposer window.agiloJobErrorParts. Sinon les scripts peuvent contenir une copie tolérée
 * du bloc ensureAgiloJobErrorParts ci-dessous.
 *
 * @version 1.10
 */
(function (w) {
  'use strict';

  var AUDIO_EXPIRED_CODE = 'error_audio_file_expired';

  function retentionMsg(kind, opts) {
    if (w && typeof w.agiloRetentionMessages === 'function') {
      return w.agiloRetentionMessages((opts && opts.edition) || '', kind, opts);
    }
    if (kind === 'audio_expired') {
      return 'Cet audio n’est plus disponible : il a été supprimé selon la durée de conservation de votre offre.';
    }
    if (kind === 'ghost_transcript') {
      return 'Cette transcription n’est plus sur le serveur. Contactez le support avec le numéro du job.';
    }
    return 'Cette transcription ou ce compte rendu n’est plus disponible.';
  }

  var AUDIO_EXPIRED_MESSAGE = retentionMsg('audio_expired');
  var TEXT_ASSET_EXPIRED_MESSAGE = retentionMsg('text_retention');
  var GHOST_TRANSCRIPT_MESSAGE = retentionMsg('ghost_transcript');

  function trimStr(s) {
    return (s === undefined || s === null) ? '' : String(s).trim();
  }

  function truncate(s, max) {
    if (!s || !max || s.length <= max) return s || '';
    return String(s).slice(0, max - 3) + '...';
  }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function payloadContainsCode(payload, code, depth, seen) {
    if (!payload || !code) return false;
    if (!depth) depth = 0;
    if (!seen) seen = [];
    if (depth > 4) return false;

    if (typeof payload === 'string') {
      var txt = trimStr(payload);
      if (!txt) return false;
      if (txt.toLowerCase().indexOf(String(code).toLowerCase()) !== -1) return true;
      var parsed = safeJsonParse(txt);
      return parsed ? payloadContainsCode(parsed, code, depth + 1, seen) : false;
    }

    if (typeof payload !== 'object') return false;
    if (seen.indexOf(payload) !== -1) return false;
    seen.push(payload);

    if (Array.isArray(payload)) {
      for (var i = 0; i < payload.length; i++) {
        if (payloadContainsCode(payload[i], code, depth + 1, seen)) return true;
      }
      return false;
    }

    var keys = Object.keys(payload);
    for (var k = 0; k < keys.length; k++) {
      if (payloadContainsCode(payload[keys[k]], code, depth + 1, seen)) return true;
    }
    return false;
  }

  function isAudioExpiredPayload(payload) {
    return payloadContainsCode(payload, AUDIO_EXPIRED_CODE);
  }

  /**
   * @param {{ userErrorMessage?: string, javaException?: string, javaStackTrace?: string, exceptionStackTrace?: string }} data
   * @param {string} [fallbackPrimary] Libellé si userErrorMessage absent
   * @returns {{ primary: string, technical: string, alertText: string }}
   */
  function jobErrorParts(data, fallbackPrimary) {
    var audioExpired = isAudioExpiredPayload(data) || isAudioExpiredPayload(fallbackPrimary);
    var jEx = trimStr(data && data.javaException);
    if (audioExpired) {
      return {
        primary: AUDIO_EXPIRED_MESSAGE,
        technical: '',
        alertText: AUDIO_EXPIRED_MESSAGE
      };
    }
    if (jEx && jEx.toLowerCase().indexOf('error_transcript_file_not_exists') !== -1) {
      return {
        primary: GHOST_TRANSCRIPT_MESSAGE,
        technical: '',
        alertText: GHOST_TRANSCRIPT_MESSAGE
      };
    }
    if (jEx && jEx.toLowerCase().indexOf('error_summary_transcript_file_not_exists') !== -1) {
      return {
        primary: TEXT_ASSET_EXPIRED_MESSAGE,
        technical: '',
        alertText: TEXT_ASSET_EXPIRED_MESSAGE
      };
    }

    var primary = trimStr(data && data.userErrorMessage);
    if (!primary) primary = trimStr(fallbackPrimary) || 'Une erreur est survenue.';

    var parts = [];
    if (jEx) parts.push(jEx);
    var st = trimStr(data && (data.javaStackTrace || data.exceptionStackTrace));
    if (st) parts.push(st);
    var technical = parts.filter(Boolean).join('\n\n');

    if (technical && primary && technical.indexOf(primary) === 0) {
      technical = trimStr(technical.slice(primary.length)).replace(/^[\s:]+/, '');
    }
    if (!technical.trim()) technical = '';

    var alertText = technical
      ? primary + '\n\n— Détails techniques —\n' + truncate(technical, 2000)
      : primary;

    return { primary: primary, technical: technical, alertText: alertText };
  }

  /** Idempotent pour ré-inclusion ou copie tolérée en tête d’autre bundle. */
  function ensureInstall() {
    if (!w.AGILO_AUDIO_EXPIRED_CODE) w.AGILO_AUDIO_EXPIRED_CODE = AUDIO_EXPIRED_CODE;
    if (!w.agiloAudioExpiredMessage) w.agiloAudioExpiredMessage = AUDIO_EXPIRED_MESSAGE;
    if (typeof w.agiloIsAudioExpiredPayload !== 'function') w.agiloIsAudioExpiredPayload = isAudioExpiredPayload;
    if (typeof w.agiloJobErrorParts !== 'function') {
      w.agiloJobErrorParts = jobErrorParts;
    }
  }

  ensureInstall();
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
