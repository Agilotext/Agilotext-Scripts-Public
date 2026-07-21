/**
 * Agilotext — accessibilité légère (Webflow / Memberstack)
 * Ne s'exécute que si l'URL contient /app/
 *
 * Pin CDN recommandé : hash de commit (pas @1.10 tip).
 * @see scripts/pages/dashboard/a11y/README.md
 * @see scripts/pages/dashboard/a11y/PLAN_DEPLOIEMENT_VILLETTE_1.10.txt
 */
(function () {
  'use strict';

  if (!/\/app\//i.test(location.pathname)) return;

  if (window.__agiloA11yLiteLoaded) return;
  window.__agiloA11yLiteLoaded = true;

  document.documentElement.classList.add('agilo-a11y-app');
  document.body.classList.add('agilo-a11y-app');

  var live = document.createElement('div');
  live.id = 'agilo-a11y-live';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-relevant', 'additions text');
  live.className = 'agilo-a11y-sr-only';

  var skip = document.createElement('a');
  skip.className = 'agilo-a11y-skip';
  skip.href = '#agilo-main-focus';
  skip.textContent = 'Aller au contenu principal';

  /**
   * Keep the skip link as the first focusable in <body> when possible.
   * Finsweet Cookie Consent (fs-cc) often injects a banner that steals the first Tab —
   * after dismiss / close, we re-promote the skip link to document.body.firstChild.
   */
  function ensureSkipFirst() {
    try {
      if (!document.body) return;
      if (skip.parentNode !== document.body || document.body.firstChild !== skip) {
        document.body.insertBefore(skip, document.body.firstChild);
      }
      if (live.parentNode !== document.body) {
        document.body.insertBefore(live, skip.nextSibling);
      } else if (skip.nextSibling !== live) {
        document.body.insertBefore(live, skip.nextSibling);
      }
    } catch (_) {}
  }

  ensureSkipFirst();

  window.AgilotextA11y = window.AgilotextA11y || {};
  window.AgilotextA11y.announce = function (msg) {
    if (msg == null || String(msg).trim() === '') return;
    live.textContent = '';
    setTimeout(function () {
      live.textContent = String(msg);
    }, 50);
  };

  function setSkipTarget(id) {
    if (id) skip.setAttribute('href', '#' + id);
  }

  function setupLandmarks() {
    var dash = document.querySelector('.dashboard');
    if (!dash) {
      var mainFallback = document.querySelector('main') || document.getElementById('agilo-main-focus');
      if (mainFallback && !mainFallback.id) mainFallback.id = 'agilo-main-focus';
      if (mainFallback) setSkipTarget(mainFallback.id || 'agilo-main-focus');
      return;
    }

    var kids = Array.prototype.filter.call(dash.children, function (n) {
      return n.nodeType === 1;
    });

    var navEl = document.getElementById('agiloSidebar');
    if (!navEl && kids[0]) {
      navEl = kids[0];
      if (!navEl.id) navEl.id = 'agiloSidebar';
    }
    if (navEl) {
      if (!navEl.getAttribute('role')) navEl.setAttribute('role', 'navigation');
      if (!navEl.getAttribute('aria-label')) navEl.setAttribute('aria-label', 'Menu principal');
    }

    var mainEl = null;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].id === 'agiloSidebar') continue;
      if (kids[i].getAttribute && kids[i].getAttribute('role') === 'navigation') continue;
      mainEl = kids[i];
      break;
    }
    if (!mainEl && kids.length > 1) mainEl = kids[1];
    if (!mainEl) mainEl = document.querySelector('.dashboard-result') || dash;

    if (mainEl) {
      if (!mainEl.getAttribute('role')) mainEl.setAttribute('role', 'main');
      if (!mainEl.getAttribute('aria-label')) mainEl.setAttribute('aria-label', 'Contenu principal');
      if (!mainEl.id) mainEl.id = 'agilo-main-focus';
      setSkipTarget(mainEl.id);
    }
  }

  function fixWebflowFormMessages() {
    document.querySelectorAll('.w-form-done div').forEach(function (d) {
      var t = (d.textContent || '').trim();
      if (/thank you/i.test(t)) {
        d.textContent = 'Merci ! Votre envoi a bien été reçu.';
      }
    });
    document.querySelectorAll('.w-form-fail div').forEach(function (d) {
      var t = (d.textContent || '').trim();
      if (/oops/i.test(t)) {
        d.textContent = "Une erreur s'est produite lors de l'envoi du formulaire.";
      }
    });
  }

  function bindCookieConsentSkipRepair() {
    // Finsweet Cookie Consent: reopen / close often mutates body children.
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest('[fs-cc], .fs-cc-banner_component, .fs-cc-prefs_component, [fs-cc-element]')) {
          setTimeout(ensureSkipFirst, 0);
          setTimeout(ensureSkipFirst, 300);
        }
      },
      true
    );
    // MutationObserver: if a banner is removed or added at body start, re-assert skip.
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var mo = new MutationObserver(function () {
        // Avoid fighting while cookie UI is open as first focusable — after close, promote skip.
        var bannerOpen = document.querySelector(
          '.fs-cc-banner_component:not([style*="display: none"]), [fs-cc="banner"]:not([style*="display: none"])'
        );
        if (!bannerOpen) ensureSkipFirst();
      });
      mo.observe(document.body, { childList: true, subtree: false });
    }
    // Short delayed passes for late Finsweet inject
    setTimeout(ensureSkipFirst, 500);
    setTimeout(ensureSkipFirst, 1500);
  }

  function init() {
    ensureSkipFirst();
    setupLandmarks();
    fixWebflowFormMessages();
    bindCookieConsentSkipRepair();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
