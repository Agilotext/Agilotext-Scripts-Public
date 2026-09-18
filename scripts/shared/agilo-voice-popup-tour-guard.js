/**
 * Garde tour Driver.js vs popup empreinte vocale.
 * Tests : node scripts/shared/agilo-voice-popup-tour-guard.test.mjs
 * Copie runtime dans agilo-voice-dashboard-popup.js (un seul pin jsDelivr).
 */
(function (root) {
  'use strict';

  var GRACE_MS = 2500;
  var DEBOUNCE_MS = 400;
  var FIRST_SEEN_KEY = 'agilo_tour_first_seen_v25';

  function isVisibleEl(el, doc) {
    if (!el) return false;
    var view = doc && doc.defaultView;
    if (view && typeof view.getComputedStyle === 'function') {
      try {
        var cs = view.getComputedStyle(el);
        if (cs) {
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (parseFloat(cs.opacity) === 0) return false;
        }
      } catch (e) { /* ignore */ }
    } else if (el.style) {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    }
    return true;
  }

  function isTourBlocking(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return false;
    var overlay = doc.querySelector('.driver-overlay');
    var popover = doc.querySelector('.driver-popover');
    return isVisibleEl(overlay, doc) || isVisibleEl(popover, doc);
  }

  function shouldHoldVoicePopup(opts) {
    opts = opts || {};
    var blocking = !!opts.blocking;
    var pendingFirstTour = !!opts.pendingFirstTour;
    var firstSeen = !!opts.firstSeen;
    var seenOverlayThisVisit = !!opts.seenOverlayThisVisit;
    var waitedMs = Number(opts.waitedMs) || 0;
    var idleMs = Number(opts.idleMs) || 0;
    var graceMs = opts.graceMs != null ? Number(opts.graceMs) : GRACE_MS;
    var debounceMs = opts.debounceMs != null ? Number(opts.debounceMs) : DEBOUNCE_MS;

    if (blocking) return true;

    var awaitingFirstTour = pendingFirstTour || !firstSeen;
    if (awaitingFirstTour && waitedMs < graceMs) return true;

    if (seenOverlayThisVisit && idleMs < debounceMs) return true;

    return false;
  }

  root.AgiloVoicePopupGuard = {
    GRACE_MS: GRACE_MS,
    DEBOUNCE_MS: DEBOUNCE_MS,
    FIRST_SEEN_KEY: FIRST_SEEN_KEY,
    isVisibleEl: isVisibleEl,
    isTourBlocking: isTourBlocking,
    shouldHoldVoicePopup: shouldHoldVoicePopup
  };
})(typeof window !== 'undefined' ? window : globalThis);
