/**
 * Format erreurs API transcript / job Agilotext : prioritise userErrorMessage pour l’UX,
 * garde javaException + stack comme détails techniques (support / diagnostic).
 *
 * Charger avant les scripts dashboard upload (upload_ent_v2, pro_v2, free_v2).
 *
 * @version 1.10
 */
(function (w) {
  'use strict';

  var AUDIO_EXPIRED_CODE = 'error_audio_file_expired';
  var AUDIO_EXPIRED_MESSAGE = 'Cet audio n’est plus disponible : il a été supprimé selon la durée de conservation de votre offre. La transcription et le compte rendu restent accessibles s’ils sont encore conservés par votre offre.';
  var TEXT_ASSET_EXPIRED_MESSAGE = 'Cette transcription ou ce compte rendu n’est plus disponible : il a été supprimé selon la durée de conservation de votre offre.';

  var AUDIO_EMPTY_USER_PLAIN = 'Le fichier envoyé semble vide, silencieux ou illisible. Vérifiez l’enregistrement sur votre appareil, puis renvoyez un autre fichier.';
  var AUDIO_EMPTY_USER_HTML =
    '<strong>Audio non exploitable</strong><br>' +
    'Le fichier envoyé semble vide, silencieux ou illisible.<br>' +
    'Vérifiez l’enregistrement sur votre appareil, puis renvoyez un autre fichier.<br>' +
    'Si le problème persiste, écrivez-nous à contact@agilotext.com.';

  var AUDIO_EMPTY_CODE_PATTERNS = [
    'error_invalid_audio_file_content',
    'error_silent_audio_file'
  ];

  var AUDIO_EMPTY_TEXT_PATTERNS = [
    'could not get duration',
    'error getting audio duration',
    'wrong value returned',
    '"duration":0',
    'duration":0',
    'vide, trop court ou silencieux',
    'trop court ou silencieux'
  ];

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

  function collectErrorBlob(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    var chunks = [];
    if (payload.userErrorMessage) chunks.push(payload.userErrorMessage);
    if (payload.errorMessage) chunks.push(payload.errorMessage);
    if (payload.javaException) chunks.push(payload.javaException);
    if (payload.javaStackTrace) chunks.push(payload.javaStackTrace);
    if (payload.exceptionStackTrace) chunks.push(payload.exceptionStackTrace);
    return chunks.filter(Boolean).join('\n');
  }

  function containsServerPath(text) {
    return /\/home\/admin\//i.test(String(text || ''));
  }

  function isAudioEmptyPayload(payload) {
    var blob = collectErrorBlob(payload);
    if (!blob) return false;
    var lower = blob.toLowerCase();
    var i;
    for (i = 0; i < AUDIO_EMPTY_CODE_PATTERNS.length; i++) {
      if (lower.indexOf(AUDIO_EMPTY_CODE_PATTERNS[i]) !== -1) return true;
    }
    for (i = 0; i < AUDIO_EMPTY_TEXT_PATTERNS.length; i++) {
      if (lower.indexOf(AUDIO_EMPTY_TEXT_PATTERNS[i]) !== -1) return true;
    }
    if (containsServerPath(blob) && lower.indexOf('duration') !== -1) return true;
    return false;
  }

  function classifyAgiloUploadError(payload) {
    if (isAudioExpiredPayload(payload)) {
      return {
        kind: 'audio_expired',
        userHtml: '',
        userPlain: AUDIO_EXPIRED_MESSAGE,
        logTechnical: collectErrorBlob(payload),
        showAlert: false
      };
    }
    if (isAudioEmptyPayload(payload)) {
      return {
        kind: 'audio_empty',
        userHtml: AUDIO_EMPTY_USER_HTML,
        userPlain: AUDIO_EMPTY_USER_PLAIN,
        logTechnical: collectErrorBlob(payload),
        showAlert: false
      };
    }
    var err = typeof payload === 'string'
      ? payload
      : trimStr(payload && payload.errorMessage);
    var lower = err.toLowerCase();
    if (err.indexOf('error_audio_format_not_supported') !== -1 || err.indexOf('error_max_file_size_exceeded') !== -1) {
      return { kind: 'audio_format', userHtml: '', userPlain: '', logTechnical: err, showAlert: false, showErrorKey: 'audioFormat' };
    }
    if (err.indexOf('error_invalid_token') !== -1) {
      return { kind: 'invalid_token', userHtml: '', userPlain: '', logTechnical: err, showAlert: false, showErrorKey: 'invalidToken' };
    }
    return null;
  }

  function sanitizeUserPrimary(text) {
    var primary = trimStr(text);
    if (!primary || containsServerPath(primary)) return '';
    if (primary.indexOf('java.io.IOException') === 0) return '';
    if (primary.indexOf('error_') === 0 && primary.indexOf(' ') === -1) return '';
    return primary;
  }

  /**
   * @param {{ userErrorMessage?: string, javaException?: string, javaStackTrace?: string, exceptionStackTrace?: string, errorMessage?: string }} data
   * @param {string} [fallbackPrimary]
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
    if (jEx && jEx.toLowerCase().indexOf('error_summary_transcript_file_not_exists') !== -1) {
      return {
        primary: 'Transcription ou compte rendu archivé — politique de conservation des données.',
        technical: '',
        alertText: TEXT_ASSET_EXPIRED_MESSAGE
      };
    }

    var classified = classifyAgiloUploadError(data || fallbackPrimary);
    if (classified && classified.kind === 'audio_empty') {
      return {
        primary: classified.userPlain,
        technical: classified.logTechnical || jEx,
        alertText: classified.userPlain
      };
    }

    var primary = sanitizeUserPrimary(data && data.userErrorMessage);
    if (!primary && isAudioEmptyPayload(data || fallbackPrimary)) {
      primary = AUDIO_EMPTY_USER_PLAIN;
    }
    if (!primary) primary = sanitizeUserPrimary(fallbackPrimary);
    if (!primary) primary = 'Une erreur est survenue.';

    var parts = [];
    if (jEx) parts.push(jEx);
    var st = trimStr(data && (data.javaStackTrace || data.exceptionStackTrace));
    if (st) parts.push(st);
    var technical = parts.filter(Boolean).join('\n\n');

    if (technical && primary && technical.indexOf(primary) === 0) {
      technical = trimStr(technical.slice(primary.length)).replace(/^[\s:]+/, '');
    }
    if (!trimStr(technical)) technical = '';

    var alertText = (classified && classified.kind === 'audio_empty') || isAudioEmptyPayload(data)
      ? primary
      : (technical ? primary + '\n\n— Détails techniques —\n' + truncate(technical, 2000) : primary);

    return { primary: primary, technical: technical, alertText: alertText };
  }

  function includesAny(haystack, needles) {
    var h = String(haystack || '');
    for (var i = 0; i < needles.length; i++) {
      if (h.indexOf(needles[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Mapping réponse sendMultipleAudio / sendYoutubeUrl → action UI dashboard.
   * @returns {{ action: 'business'|'key'|'alert', key?: string, message?: string, log?: string, alertMsg?: string }}
   */
  function mapUploadErrorResponse(data) {
    var err = trimStr(data && data.errorMessage);
    var classified = classifyAgiloUploadError(data || err);
    if (classified && classified.kind === 'audio_empty') {
      return { action: 'business', message: classified.userPlain, log: classified.logTechnical };
    }
    if (classified && classified.showErrorKey) {
      return { action: 'key', key: classified.showErrorKey, log: classified.logTechnical || err };
    }

    if (err === 'error_too_much_traffic') return { action: 'key', key: 'tooMuchTraffic' };
    if (includesAny(err, [
      'error_account_pending_validation',
      'error_limit_reached_for_user',
      'error_quota_exceeded',
      'error_pro_quota_exceeded',
      'error_subscription_quota',
      'error_plan_limit_reached',
      'error_subscription_limit',
      'error_limit_reached'
    ])) return { action: 'key', key: 'tooMuchTraffic' };
    if (err.indexOf('error_duration_is_too_long_for_summary') !== -1) return { action: 'key', key: 'summaryLimit' };
    if (err.indexOf('error_duration_is_too_long') !== -1 || err.indexOf('error_max_duration_exceeded') !== -1) {
      return { action: 'key', key: 'audioTooLong' };
    }
    if (err.indexOf('error_transcript_too_long_for_summary') !== -1) return { action: 'key', key: 'summaryLimit' };
    if (err.indexOf('error_audio_format_not_supported') !== -1 || err.indexOf('error_max_file_size_exceeded') !== -1) {
      return { action: 'key', key: 'audioFormat' };
    }
    if (err.indexOf('error_invalid_audio_file_content') !== -1 || err.indexOf('error_silent_audio_file') !== -1) {
      return { action: 'business', message: AUDIO_EMPTY_USER_PLAIN, log: err };
    }
    if (err.indexOf('error_audio_file_not_found') !== -1) return { action: 'key', key: 'audioNotFound' };
    if (err.indexOf('error_invalid_token') !== -1) return { action: 'key', key: 'invalidToken' };
    if (includesAny(err, [
      'error_too_many_hours_for_last_30_days',
      'error_quota_exceeded',
      'error_pro_quota_exceeded',
      'error_subscription_quota',
      'error_plan_limit_reached',
      'error_subscription_limit',
      'error_limit_reached'
    ])) return { action: 'key', key: 'tooManyHours' };
    if (err.indexOf('error_too_many_devices_used_for_account') !== -1) {
      return {
        action: 'alert',
        alertMsg: 'Trop d’appareils utilisés pour ce compte. Veuillez contacter le support.',
        log: err
      };
    }
    if (err.indexOf('error_too_many_calls') !== -1) return { action: 'key', key: 'tooMuchTraffic' };

    var el = err.toLowerCase();
    if (err.indexOf('ERROR_INVALID_YOUTUBE_URL') !== -1 || (el.indexOf('youtube') !== -1 && el.indexOf('invalid') !== -1)) {
      return { action: 'key', key: 'youtubeInvalid' };
    }
    if (
      err.indexOf('ERROR_CANNOT_DONWLOAD_YOUTUBE_URL') !== -1 ||
      err.indexOf('ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL') !== -1 ||
      (el.indexOf('youtube') !== -1 && el.indexOf('private') !== -1)
    ) {
      return { action: 'key', key: 'youtubePrivate' };
    }
    if (el.indexOf('youtube') !== -1 && el.indexOf('not found') !== -1) {
      return { action: 'key', key: 'youtubeNotFound' };
    }

    if (isAudioEmptyPayload(data || err)) {
      return { action: 'business', message: AUDIO_EMPTY_USER_PLAIN, log: collectErrorBlob(data || err) };
    }

    var parts = jobErrorParts(data, err);
    return { action: 'business', message: parts.primary, log: parts.technical || err };
  }

  function isNonRetryableUploadErrorMessage(errorMessage) {
    var em = trimStr(errorMessage);
    if (!em) return false;
    if (isAudioEmptyPayload(em)) return true;
    return includesAny(em, [
      'error_audio_format_not_supported',
      'error_max_file_size_exceeded',
      'error_duration_is_too_long_for_summary',
      'error_duration_is_too_long',
      'error_max_duration_exceeded',
      'error_audio_file_not_found',
      'error_invalid_token',
      'error_too_many_hours_for_last_30_days',
      'error_account_pending_validation',
      'error_limit_reached_for_user',
      'error_quota_exceeded',
      'error_pro_quota_exceeded',
      'error_subscription_quota',
      'error_plan_limit_reached',
      'error_subscription_limit',
      'error_limit_reached',
      'error_invalid_audio_file_content',
      'error_silent_audio_file',
      'error_transcript_too_long_for_summary',
      'error_too_many_devices_used_for_account',
      'error_too_many_calls',
      'ERROR_CANNOT_DONWLOAD_YOUTUBE_URL',
      'ERROR_CANNOT_DOWNLOAD_YOUTUBE_URL',
      'ERROR_INVALID_YOUTUBE_URL',
      'could not get duration',
      'error getting audio duration'
    ]);
  }

  function buildBusinessErrorHtml(message, defaultErrorHtml) {
    if (isAudioEmptyPayload(message)) return AUDIO_EMPTY_USER_HTML;
    var classified = classifyAgiloUploadError(message);
    if (classified && classified.kind === 'audio_empty') return classified.userHtml;
    var text = trimStr(message);
    var normalized = text.toLowerCase();
    if (normalized.indexOf('vide') !== -1 && (normalized.indexOf('silencieux') !== -1 || normalized.indexOf('silent') !== -1 || normalized.indexOf('trop court') !== -1)) {
      return AUDIO_EMPTY_USER_HTML;
    }
    if (!text) return defaultErrorHtml || '';
    if (containsServerPath(text)) return AUDIO_EMPTY_USER_HTML;
    return '<strong>Traitement interrompu</strong><br>' + String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }

  function ensureInstall() {
    w.__agiloUploadErrorVersion = '1.10.0';
    w.AGILO_AUDIO_EXPIRED_CODE = AUDIO_EXPIRED_CODE;
    w.agiloAudioExpiredMessage = AUDIO_EXPIRED_MESSAGE;
    w.agiloIsAudioExpiredPayload = isAudioExpiredPayload;
    w.agiloAudioEmptyUserHtml = AUDIO_EMPTY_USER_HTML;
    w.agiloAudioEmptyUserPlain = AUDIO_EMPTY_USER_PLAIN;
    w.agiloClassifyUploadError = classifyAgiloUploadError;
    w.agiloMapUploadErrorResponse = mapUploadErrorResponse;
    w.agiloIsNonRetryableUploadErrorMessage = isNonRetryableUploadErrorMessage;
    w.agiloBuildBusinessErrorHtml = buildBusinessErrorHtml;
    w.agiloJobErrorParts = jobErrorParts;
  }

  ensureInstall();
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
