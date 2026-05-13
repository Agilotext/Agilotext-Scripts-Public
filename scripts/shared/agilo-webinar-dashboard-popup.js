/**
 * agilo-webinar-dashboard-popup.js
 * Popup webinar pour les dashboards connectés Agilotext.
 *
 * Intégration Webflow :
 * <script>
 *   window.AGILO_WEBINAR_DASHBOARD_CONFIG = {
 *     imageUrl: 'https://.../cover.png'
 *   };
 * </script>
 * <script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/shared/agilo-webinar-dashboard-popup.js"></script>
 *
 * Mode test :
 *   ?agilo_webinar_test=1
 */
(function () {
  'use strict';

  if (window.__AGILO_WEBINAR_DASHBOARD_POPUP__) return;
  window.__AGILO_WEBINAR_DASHBOARD_POPUP__ = true;

  var DEFAULTS = {
    targetUrl:
      'https://www.agilotext.com/webinaire/comment-obtenir-des-comptes-rendus-professionnels-avec-agilotext-methode-bonnes-pratiques-et-cas-reel',
    eventEndIso: '2026-05-20T12:00:00+02:00',
    showDelayMs: 1500,
    showDelayTestMs: 250,
    reappearDays: 3,
    imageUrl:
      'https://cdn.prod.website-files.com/6815bee5a9c0b57da1835531/6a01fed41b8d33ba789efeba_1%20(1).png',
    title: 'De l’audio au compte-rendu pro',
    description:
      'Transformez réunions, entretiens et appels en comptes-rendus exploitables.',
    meta: '20 mai 2026 · 12h',
    badge: 'Webinaire Agilotext',
    primaryCta: 'Je m’inscris',
    secondaryCta: 'Plus tard',
    storageDismissedKey: 'agilo:webinar:2026-05-20:dismissedAt',
    storageClickedKey: 'agilo:webinar:2026-05-20:clickedAt',
    popupId: 'agilo-webinar-popup',
    styleId: 'agilo-webinar-popup-styles'
  };

  var cfg = Object.assign(
    {},
    DEFAULTS,
    window.AGILO_WEBINAR_DASHBOARD_CONFIG || {}
  );

  function getTestMode() {
    try {
      return new URLSearchParams(window.location.search || '').get(
        'agilo_webinar_test'
      ) === '1';
    } catch (e) {
      return false;
    }
  }

  function normalizedPathname() {
    var p = window.location.pathname || '';
    if (!p) return '/';
    return p.replace(/\/+$/, '') || '/';
  }

  function isDashboardPath() {
    var p = normalizedPathname();
    return /^\/app\/[^/]+\/dashboard$/.test(p);
  }

  function isExpired() {
    var endTs = Date.parse(cfg.eventEndIso);
    return !isNaN(endTs) && Date.now() >= endTs;
  }

  function readTs(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var n = parseInt(raw, 10);
      return isNaN(n) ? null : n;
    } catch (e) {
      return null;
    }
  }

  function writeTs(key) {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch (e) {
      /* ignore */
    }
  }

  function shouldShow() {
    var testMode = getTestMode();
    if (!testMode && !isDashboardPath()) return false;
    if (!testMode && isExpired()) return false;

    var clickedAt = readTs(cfg.storageClickedKey);
    if (!testMode && clickedAt) return false;

    var dismissedAt = readTs(cfg.storageDismissedKey);
    if (!testMode && dismissedAt) {
      var reappearMs = cfg.reappearDays * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < reappearMs) return false;
    }
    return true;
  }

  function injectStyles() {
    if (document.getElementById(cfg.styleId)) return;
    var css = [
      '#' + cfg.popupId + '{',
      'position:fixed;',
      'left:24px;',
      'bottom:-420px;',
      'width:min(460px, calc(100vw - 32px));',
      'display:grid;',
      'grid-template-columns:112px 1fr;',
      'gap:16px;',
      'padding:16px;',
      'border-radius:18px;',
      'background:#001427;',
      'color:#ffffff;',
      'box-shadow:0 18px 48px rgba(0,0,0,.28);',
      'border:1px solid rgba(253,126,20,.22);',
      'z-index:2147483000;',
      'opacity:0;',
      'pointer-events:none;',
      'transition:bottom .55s cubic-bezier(.16,1,.3,1),opacity .35s ease;',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'box-sizing:border-box;',
      '}',
      '#' + cfg.popupId + '.agilo-webinar-popup--visible{bottom:24px;opacity:1;pointer-events:auto;}',
      '#' + cfg.popupId + ' *{box-sizing:border-box;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media{align-self:stretch;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media img{width:100%;height:100%;min-height:132px;object-fit:cover;border-radius:14px;display:block;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__content{display:flex;flex-direction:column;gap:10px;min-width:0;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#FD7E14;text-transform:none;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__close{appearance:none;border:none;background:transparent;color:rgba(255,255,255,.72);cursor:pointer;font-size:20px;line-height:1;padding:0 0 0 8px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__close:hover{color:#fff;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__title{margin:0;font-size:22px;line-height:1.08;font-weight:800;letter-spacing:-.02em;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__desc{margin:0;font-size:14px;line-height:1.45;color:rgba(255,255,255,.82);}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__meta{margin:0;font-size:12px;font-weight:700;color:#E7E0DA;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta--primary{background:#FD7E14;color:#fff;box-shadow:0 8px 18px rgba(253,126,20,.28);}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta--secondary{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;}',
      '@media (max-width: 767px){',
      '#' + cfg.popupId + '{left:50%;transform:translateX(-50%);width:calc(100vw - 24px);max-width:360px;grid-template-columns:1fr;gap:12px;padding:14px;}',
      '#' + cfg.popupId + '.agilo-webinar-popup--visible{bottom:12px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media img{min-height:104px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__title{font-size:20px;}',
      '}'
    ].join('');

    var style = document.createElement('style');
    style.id = cfg.styleId;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function removePopup() {
    var popup = document.getElementById(cfg.popupId);
    if (!popup) return;
    popup.classList.remove('agilo-webinar-popup--visible');
    setTimeout(function () {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 450);
  }

  function onDismiss() {
    writeTs(cfg.storageDismissedKey);
    removePopup();
  }

  function onClickCta() {
    writeTs(cfg.storageClickedKey);
    removePopup();
  }

  function buildPopup() {
    if (document.getElementById(cfg.popupId)) return null;
    injectStyles();

    var root = document.createElement('aside');
    root.id = cfg.popupId;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', cfg.badge);
    root.innerHTML =
      '<div class="agilo-webinar-popup__media">' +
      '<img src="' + cfg.imageUrl + '" alt="Visuel du webinaire Agilotext" loading="lazy">' +
      '</div>' +
      '<div class="agilo-webinar-popup__content">' +
      '<div class="agilo-webinar-popup__top">' +
      '<div class="agilo-webinar-popup__badge">● ' + cfg.badge + '</div>' +
      '<button type="button" class="agilo-webinar-popup__close" aria-label="Fermer">&times;</button>' +
      '</div>' +
      '<h3 class="agilo-webinar-popup__title">' + cfg.title + '</h3>' +
      '<p class="agilo-webinar-popup__desc">' + cfg.description + '</p>' +
      '<p class="agilo-webinar-popup__meta">' + cfg.meta + '</p>' +
      '<div class="agilo-webinar-popup__actions">' +
      '<a class="agilo-webinar-popup__cta agilo-webinar-popup__cta--primary" href="' + cfg.targetUrl + '" target="_blank" rel="noopener noreferrer">' + cfg.primaryCta + '</a>' +
      '<button type="button" class="agilo-webinar-popup__cta agilo-webinar-popup__cta--secondary">' + cfg.secondaryCta + '</button>' +
      '</div>' +
      '</div>';

    var closeBtn = root.querySelector('.agilo-webinar-popup__close');
    var secondaryBtn = root.querySelector('.agilo-webinar-popup__cta--secondary');
    var primaryBtn = root.querySelector('.agilo-webinar-popup__cta--primary');

    closeBtn.addEventListener('click', onDismiss);
    secondaryBtn.addEventListener('click', onDismiss);
    primaryBtn.addEventListener('click', onClickCta);

    return root;
  }

  function showPopup() {
    if (!shouldShow()) return;
    var root = buildPopup();
    if (!root) return;
    document.body.appendChild(root);
    requestAnimationFrame(function () {
      root.classList.add('agilo-webinar-popup--visible');
    });
  }

  function boot() {
    if (!document.body) return;
    var delay = getTestMode() ? cfg.showDelayTestMs : cfg.showDelayMs;
    setTimeout(showPopup, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
