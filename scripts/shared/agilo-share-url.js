/* ================================================================
   AGILOTEXT — conversion URL de partage
   Historique : d8478fa34a → /auth/share?token=…  (−download = zip servlet)
   Guest 11.0.5 : token opaque 43 chars → /auth/share#token=…
   ================================================================ */
(function (root) {
  'use strict';

  var PREFIX = 'd8478fa34a';
  var API_ORIGIN = 'https://api.agilotext.com';
  var WWW_ORIGIN = 'https://www.agilotext.com';
  var STAGING_ORIGIN = 'https://agilotext-test.webflow.io';
  var PAGE_PATH = '/auth/share';
  var GUEST_TOKEN_LENGTH = 43;
  var GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

  function stripDownload(s) {
    return String(s || '').replace(/-download\/?$/i, '').replace(/\/+$/, '');
  }

  function decodePart(s) {
    try { return decodeURIComponent(String(s || '')); }
    catch (_) { return String(s || ''); }
  }

  function isGuestToken(s) {
    return GUEST_TOKEN_RE.test(String(s || ''));
  }

  function parseShareToken(urlOrToken) {
    var s = stripDownload(String(urlOrToken || '').trim());
    if (!s) return '';
    if (isGuestToken(s)) return '';
    var fromPath = s.match(/\/api\/(d8478fa34a[a-zA-Z0-9-]+)/i);
    if (fromPath) return fromPath[1];
    var fromQuery = s.match(/[?&]token=([^&#]+)/i);
    if (fromQuery) {
      var q = decodePart(fromQuery[1]).replace(/-download$/i, '');
      if (isGuestToken(q)) return '';
      if (/^d8478fa34a/i.test(q)) return q;
      if (/^[a-f0-9-]{32,}$/i.test(q)) return PREFIX + q.replace(/-/g, '');
      return '';
    }
    if (/^d8478fa34a/i.test(s)) return s;
    if (/^[a-f0-9-]{32,}$/i.test(s) && s.length !== GUEST_TOKEN_LENGTH) {
      return PREFIX + s.replace(/-/g, '');
    }
    return '';
  }

  function parseGuestToken(urlOrToken) {
    var raw = String(urlOrToken || '').trim();
    if (!raw) return '';
    var fromHash = raw.match(/#token=([^&]+)/i);
    if (fromHash) {
      var h = decodePart(fromHash[1]);
      if (isGuestToken(h)) return h;
    }
    var fromQuery = raw.match(/[?&]token=([^&#]+)/i);
    if (fromQuery) {
      var q = decodePart(fromQuery[1]);
      if (isGuestToken(q)) return q;
    }
    if (isGuestToken(raw)) return raw;
    return '';
  }

  function parseGuestTokenFromLocation(loc) {
    var place = loc || (typeof location !== 'undefined' ? location : {});
    return parseGuestToken(place.href || '') ||
      parseGuestToken(place.hash || '') ||
      parseGuestToken(place.search || '');
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

  function toGuestPageUrl(urlOrToken, hostname) {
    var token = parseGuestToken(urlOrToken);
    if (!token) return '';
    return sharePageOrigin(hostname) + PAGE_PATH + '#token=' + token;
  }

  function rewriteSharePageOrigin(url, hostname) {
    var s = String(url || '').trim();
    if (!s) return '';
    var origin = sharePageOrigin(hostname);
    var m = s.match(/^(https?:\/\/[^/?#]+)(\/auth\/share\/?)([?#].*)?$/i);
    if (!m) return s;
    return origin + PAGE_PATH + (m[3] || '');
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
    GUEST_TOKEN_LENGTH: GUEST_TOKEN_LENGTH,
    isGuestToken: isGuestToken,
    parseShareToken: parseShareToken,
    parseGuestToken: parseGuestToken,
    parseGuestTokenFromLocation: parseGuestTokenFromLocation,
    sharePageOrigin: sharePageOrigin,
    toWebflowShareUrl: toWebflowShareUrl,
    toGuestPageUrl: toGuestPageUrl,
    rewriteSharePageOrigin: rewriteSharePageOrigin,
    toApiShareUrl: toApiShareUrl,
    toApiDownloadUrl: toApiDownloadUrl
  };

  root.AgiloShareUrl = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
