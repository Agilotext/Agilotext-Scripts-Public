/**
 * URLs popup empreinte (dashboard → Mon compte).
 * Tests : node scripts/shared/agilo-voice-popup-urls.test.mjs
 * Copie runtime dans agilo-voice-dashboard-popup.js (un seul pin jsDelivr).
 */
(function (root) {
  'use strict';

  var TARIFS_URL = 'https://www.agilotext.com/tarifs';
  var PROFILE_HASH = 'agilo-voice-settings';

  function normalizePathname(pathname) {
    var p = String(pathname || '');
    if (!p) return '/';
    return p.replace(/\/+$/, '') || '/';
  }

  function inferEditionFromPath(pathname) {
    var p = normalizePathname(pathname);
    var m = p.match(/^\/app\/([^/]+)\/(dashboard|voice|profile)$/);
    if (!m) return 'free';
    var seg = String(m[1] || '').toLowerCase();
    if (seg === 'business' || seg === 'ent' || seg === 'enterprise') return 'business';
    if (seg === 'premium' || seg === 'pro') return 'premium';
    return 'free';
  }

  function profileUrlFromPath(pathname) {
    var edition = inferEditionFromPath(pathname);
    if (edition === 'free') return null;
    return '/app/' + edition + '/profile#' + PROFILE_HASH;
  }

  function primaryCtaFromPath(pathname) {
    var profileUrl = profileUrlFromPath(pathname);
    if (!profileUrl) {
      return { url: TARIFS_URL, openInNewTab: true };
    }
    return { url: profileUrl, openInNewTab: false };
  }

  function shouldReofferAfterRemoval(opts) {
    opts = opts || {};
    if (opts.dismissed) return false;
    return !!opts.tourHide;
  }

  root.AgiloVoicePopupUrls = {
    TARIFS_URL: TARIFS_URL,
    PROFILE_HASH: PROFILE_HASH,
    normalizePathname: normalizePathname,
    inferEditionFromPath: inferEditionFromPath,
    profileUrlFromPath: profileUrlFromPath,
    primaryCtaFromPath: primaryCtaFromPath,
    shouldReofferAfterRemoval: shouldReofferAfterRemoval
  };
})(typeof window !== 'undefined' ? window : globalThis);
