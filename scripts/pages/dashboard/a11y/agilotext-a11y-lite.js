/**
 * Agilotext — accessibilité légère (Webflow / Memberstack)
 * Ne s'exécute que si l'URL contient /app/
 *
 * @see scripts/pages/dashboard/a11y/README.md
 * @see scripts/pages/dashboard/a11y/ANCHORS.md
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
  document.body.insertBefore(live, document.body.firstChild);

  window.AgilotextA11y = window.AgilotextA11y || {};
  window.AgilotextA11y.announce = function (msg) {
    if (msg == null || String(msg).trim() === '') return;
    live.textContent = '';
    setTimeout(function () {
      live.textContent = String(msg);
    }, 50);
  };

  var skip = document.createElement('a');
  skip.className = 'agilo-a11y-skip';
  skip.href = '#agilo-main-focus';
  skip.textContent = 'Aller au contenu principal';
  document.body.insertBefore(skip, document.body.firstChild);

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

  function init() {
    setupLandmarks();
    fixWebflowFormMessages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
