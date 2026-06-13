/**
 * agilo-cgv-modal.js
 * Modale CGV dashboard — Webflow embed (Before </body> sur dashboards Free/Pro/Business)
 *
 * <script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/shared/agilo-cgv-modal.js?v=1.09-voice10"></script>
 *
 * Émet agilo:cgv-dismissed après fermeture (popup voix dashboard).
 */
(function () {
  'use strict';

  if (window.__AGILO_CGV_MODAL__) return;
  window.__AGILO_CGV_MODAL__ = true;

  var CGV_VERSION = '2026-01-20';
  var MODAL_DELAY = 1000;
  var MEMBERSTACK_WAIT_MAX = 50;
  var INIT_DELAY = 300;
  var HIDE_DELAY = 50;

  var DEBUG =
    window.location.hostname === 'localhost' ||
    window.location.hostname.indexOf('test') !== -1 ||
    window.location.hostname.indexOf('webflow.io') !== -1 ||
    window.location.search.indexOf('debug=true') !== -1;

  function log(message) {
    if (DEBUG) console.log('[CGU Script]', message);
  }

  function getISODate() {
    return new Date().toISOString();
  }

  function notifyCgvDismissed() {
    try {
      window.dispatchEvent(new CustomEvent('agilo:cgv-dismissed'));
    } catch (e) {
      log('dispatch agilo:cgv-dismissed failed');
    }
  }

  function notifyCgvReady(detail) {
    try {
      window.dispatchEvent(new CustomEvent('agilo:cgv-ready', { detail: detail || {} }));
    } catch (e) {
      log('dispatch agilo:cgv-ready failed');
    }
  }

  function agiloResumeTourAfterCgu() {
    var started = false;
    function tryStart() {
      if (started) return;
      if (!window.__agiloPendingFirstTour) return;
      if (typeof window.agiloStartDeferredFirstVisitTour !== 'function') return;
      started = true;
      window.__agiloPendingFirstTour = false;
      window.agiloStartDeferredFirstVisitTour();
    }
    setTimeout(function () {
      var n = 0;
      var id = setInterval(function () {
        tryStart();
        if (started || ++n >= 45) clearInterval(id);
      }, 150);
    }, 550);
  }

  function waitForMemberstack(callback, maxAttempts) {
    var attempts = 0;
    var max = maxAttempts || MEMBERSTACK_WAIT_MAX;
    var checkInterval = setInterval(function () {
      attempts++;
      var wrapper = document.querySelector('.wrapper-id-profil');
      if (!wrapper) {
        if (attempts >= max) {
          clearInterval(checkInterval);
          log('Wrapper .wrapper-id-profil non trouvé');
          callback();
        }
        return;
      }

      var memberId = wrapper.querySelector('[data-ms-member="id"]');
      var memberEmail = wrapper.querySelector('[data-ms-member="email"]');
      var hasMemberId =
        memberId &&
        (memberId.textContent.trim() ||
          memberId.getAttribute('src').trim() ||
          memberId.value.trim());
      var hasMemberEmail =
        memberEmail &&
        (memberEmail.textContent.trim() ||
          memberEmail.getAttribute('src').trim() ||
          memberEmail.value.trim());

      if (hasMemberId || hasMemberEmail) {
        clearInterval(checkInterval);
        log('Memberstack chargé après ' + attempts + ' tentatives');
        callback();
      } else if (attempts >= max) {
        clearInterval(checkInterval);
        log('Timeout: Memberstack non chargé');
        callback();
      }
    }, 100);
  }

  function getMemberData(key) {
    var wrapper = document.querySelector('.wrapper-id-profil');
    if (!wrapper) return null;
    var element = wrapper.querySelector('[data-ms-member="' + key + '"]');
    if (!element) return null;
    if (element.tagName === 'INPUT') return (element.value || '').trim();
    return (element.textContent || '').trim() || (element.getAttribute('src') || '').trim();
  }

  function checkCGVAccepted() {
    var cgvAccepted = getMemberData('cgv-accepted');
    var cgvVersion = getMemberData('cgv-version');
    var isAccepted = cgvAccepted === 'true' || cgvAccepted === '1' || cgvAccepted === true;
    return isAccepted && cgvVersion === CGV_VERSION;
  }

  window.checkCGVAccepted = checkCGVAccepted;

  function hideModal(options) {
    var silent = options && options.silent;
    var wrapper = document.querySelector('.cgv-onboarding-wrapper');
    if (!wrapper) {
      if (!silent) notifyCgvDismissed();
      return;
    }

    wrapper.style.transition = 'opacity 0.3s ease-out';
    wrapper.style.opacity = '0';

    setTimeout(function () {
      wrapper.style.display = 'none';
      wrapper.style.visibility = 'hidden';
      wrapper.style.opacity = '1';
      document.body.style.overflow = '';
      log('Modal caché avec animation');
      if (!silent) notifyCgvDismissed();
    }, 300);
  }

  function hideModalSilently() {
    hideModal({ silent: true });
  }

  function showModal() {
    var wrapper = document.querySelector('.cgv-onboarding-wrapper');
    if (!wrapper) {
      console.error('CGU: Wrapper non trouvé');
      return;
    }

    log('Affichage du modal CGU');
    wrapper.style.display = 'flex';
    wrapper.style.visibility = 'visible';
    wrapper.style.opacity = '0';
    wrapper.style.transition = 'opacity 0.3s ease-in';
    wrapper.offsetHeight;
    setTimeout(function () {
      wrapper.style.opacity = '1';
    }, 10);
    document.body.style.overflow = 'hidden';
    setupFormHandlers();
  }

  function setupFormHandlers() {
    var form = document.getElementById('wf-form-CGV');
    if (!form || form.dataset.agiloCgvHandlers === '1') return;
    form.dataset.agiloCgvHandlers = '1';

    var checkbox = document.getElementById('cgv-checkbox');
    var submitBtn = form.querySelector('input[type="submit"]');
    var cgvVersionInput = document.getElementById('cgv-version');
    var cgvAcceptedAtInput = document.getElementById('cgv-accepted-at');
    var errorText = document.querySelector('.cgv-error-text');

    if (!checkbox) {
      console.error('CGU: Checkbox non trouvée');
      return;
    }

    if (cgvVersionInput) cgvVersionInput.value = CGV_VERSION;
    if (cgvAcceptedAtInput) cgvAcceptedAtInput.value = getISODate();

    if (errorText) {
      errorText.classList.add('hidden');
      errorText.style.display = 'none';
      errorText.style.opacity = '0';
    }

    if (submitBtn) submitBtn.disabled = true;

    checkbox.addEventListener('change', function () {
      if (submitBtn) submitBtn.disabled = !checkbox.checked;
      if (errorText && checkbox.checked) {
        errorText.classList.add('hidden');
        errorText.style.display = 'none';
        errorText.style.opacity = '0';
      }
    });

    form.addEventListener('submit', function (e) {
      if (!checkbox.checked) {
        e.preventDefault();
        e.stopPropagation();
        if (errorText) {
          errorText.classList.remove('hidden');
          errorText.style.display = 'block';
          errorText.style.opacity = '1';
          setTimeout(function () {
            errorText.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
        }
        checkbox.focus();
        return false;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        var buttonText = submitBtn.parentElement && submitBtn.parentElement.querySelector('div');
        if (buttonText) buttonText.textContent = 'Traitement...';
      }

      var retryCount = 0;
      var maxRetries = 3;

      function fillFields() {
        var allFilled = true;

        if (cgvVersionInput) {
          if (cgvVersionInput.value !== CGV_VERSION) {
            cgvVersionInput.value = CGV_VERSION;
            cgvVersionInput.dispatchEvent(new Event('input', { bubbles: true }));
            cgvVersionInput.dispatchEvent(new Event('change', { bubbles: true }));
            allFilled = false;
          }
        } else {
          e.preventDefault();
          alert('Erreur: champ version non trouvé. Veuillez recharger la page.');
          return false;
        }

        if (cgvAcceptedAtInput) {
          var expectedDate = getISODate();
          if (cgvAcceptedAtInput.value !== expectedDate) {
            cgvAcceptedAtInput.value = expectedDate;
            cgvAcceptedAtInput.dispatchEvent(new Event('input', { bubbles: true }));
            cgvAcceptedAtInput.dispatchEvent(new Event('change', { bubbles: true }));
            allFilled = false;
          }
        } else {
          e.preventDefault();
          alert('Erreur: champ date non trouvé. Veuillez recharger la page.');
          return false;
        }

        if (!allFilled && retryCount < maxRetries) {
          retryCount++;
          setTimeout(fillFields, 50);
          return;
        }

        if (checkbox.checked) checkbox.value = 'true';

        setTimeout(function () {
          hideModal();
          agiloResumeTourAfterCgu();
        }, HIDE_DELAY);
      }

      fillFields();
    });
  }

  function initCGUCheck() {
    log('Initialisation CGV');
    hideModalSilently();

    waitForMemberstack(function () {
      var accepted = checkCGVAccepted();
      notifyCgvReady({ accepted: accepted, needsModal: !accepted });

      if (!accepted) {
        log('CGU non acceptées — affichage dans ' + MODAL_DELAY + 'ms');
        setTimeout(showModal, MODAL_DELAY);
      } else {
        log('CGU déjà acceptées');
        notifyCgvDismissed();
        agiloResumeTourAfterCgu();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initCGUCheck, INIT_DELAY);
    });
  } else {
    setTimeout(initCGUCheck, INIT_DELAY);
  }
})();
