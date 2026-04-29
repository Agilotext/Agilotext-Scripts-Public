/**
 * Format erreurs API transcript / job Agilotext : prioritise userErrorMessage pour l’UX,
 * garde javaException + stack comme détails techniques (support / diagnostic).
 *
 * Optionnel dans Webflow : charger ce fichier une fois avant les scripts métier pour
 * exposer window.agiloJobErrorParts. Sinon les scripts peuvent contenir une copie tolérée
 * du bloc ensureAgiloJobErrorParts ci-dessous.
 *
 * @version 1.07
 */
(function (w) {
  'use strict';

  function trimStr(s) {
    return (s === undefined || s === null) ? '' : String(s).trim();
  }

  function truncate(s, max) {
    if (!s || !max || s.length <= max) return s || '';
    return String(s).slice(0, max - 3) + '...';
  }

  /**
   * @param {{ userErrorMessage?: string, javaException?: string, javaStackTrace?: string, exceptionStackTrace?: string }} data
   * @param {string} [fallbackPrimary] Libellé si userErrorMessage absent
   * @returns {{ primary: string, technical: string, alertText: string }}
   */
  function jobErrorParts(data, fallbackPrimary) {
    var primary = trimStr(data && data.userErrorMessage);
    if (!primary) primary = trimStr(fallbackPrimary) || 'Une erreur est survenue.';

    var parts = [];
    var jEx = trimStr(data && data.javaException);
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
    if (typeof w.agiloJobErrorParts !== 'function') {
      w.agiloJobErrorParts = jobErrorParts;
    }
  }

  ensureInstall();
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
