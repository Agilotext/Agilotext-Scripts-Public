/* ================================================================
   AGILOTEXT — conversion URL de partage (API servlet → page Webflow)
   Prefix historique : d8478fa34a (UrlSharerBuilder.D8478FA34A)
   API : https://api.agilotext.com/api/d8478fa34a{uuid}
   Page : https://www.agilotext.com/auth/share?token=d8478fa34a{uuid}
   Suffixe -download = export zip (ne pas l’utiliser pour la lecture).
   ================================================================ */
(function (root) {
  'use strict';

  var PREFIX = 'd8478fa34a';
  var API_ORIGIN = 'https://api.agilotext.com';
  var WWW_ORIGIN = 'https://www.agilotext.com';
  var STAGING_ORIGIN = 'https://agilotext-test.webflow.io';
  var PAGE_PATH = '/auth/share';

  function stripDownload(s) {
    return String(s || '').replace(/-download\/?$/i, '').replace(/\/+$/, '');
  }

  function parseShareToken(urlOrToken) {
    var s = stripDownload(String(urlOrToken || '').trim());
    if (!s) return '';
    var fromPath = s.match(/\/api\/(d8478fa34a[a-zA-Z0-9-]+)/i);
    if (fromPath) return fromPath[1];
    var fromQuery = s.match(/[?&]token=([^&#]+)/i);
    if (fromQuery) {
      try { return decodeURIComponent(fromQuery[1]).replace(/-download$/i, ''); }
      catch (_) { return fromQuery[1]; }
    }
    if (/^d8478fa34a/i.test(s)) return s;
    if (/^[a-f0-9-]{32,}$/i.test(s)) return PREFIX + s.replace(/-/g, '');
    return '';
  }

  function sharePageOrigin(hostname) {
    var host = String(hostname || (typeof location !== 'undefined' ? location.hostname : '') || '');
    if (/agilotext-test\.webflow\.io/i.test(host)) return STAGING_ORIGIN;
    return WWW_ORIGIN;
  }

  function toWebflowShareUrl(urlOrToken, hostname) {
    var token = parseShareToken(urlOrToken);
    if (!token) return '';
    return sharePageOrigin(hostname) + PAGE_PATH + '?token=' + encodeURIComponent(token);
  }

  function toApiShareUrl(urlOrToken) {
    var token = parseShareToken(urlOrToken);
    if (!token) return '';
    return API_ORIGIN + '/api/' + token;
  }

  function toApiDownloadUrl(urlOrToken) {
    var api = toApiShareUrl(urlOrToken);
    if (!api) return '';
    return api + '-download';
  }

  var api = {
    PREFIX: PREFIX,
    PAGE_PATH: PAGE_PATH,
    API_ORIGIN: API_ORIGIN,
    WWW_ORIGIN: WWW_ORIGIN,
    STAGING_ORIGIN: STAGING_ORIGIN,
    parseShareToken: parseShareToken,
    sharePageOrigin: sharePageOrigin,
    toWebflowShareUrl: toWebflowShareUrl,
    toApiShareUrl: toApiShareUrl,
    toApiDownloadUrl: toApiDownloadUrl
  };

  root.AgiloShareUrl = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
