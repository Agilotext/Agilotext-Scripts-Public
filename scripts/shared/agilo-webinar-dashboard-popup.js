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
      'bottom:-560px;',
      'width:min(430px, calc(100vw - 32px));',
      'display:flex;',
      'flex-direction:column;',
      'border-radius:24px;',
      'overflow:hidden;',
      'background:linear-gradient(180deg,#021224 0%,#001427 100%);',
      'color:#ffffff;',
      'box-shadow:0 28px 80px rgba(0,0,0,.36);',
      'border:1px solid rgba(253,126,20,.14);',
      'z-index:2147483000;',
      'opacity:0;',
      'pointer-events:none;',
      'transition:bottom .55s cubic-bezier(.16,1,.3,1),opacity .35s ease;',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'box-sizing:border-box;',
      '}',
      '#' + cfg.popupId + '.agilo-webinar-popup--visible{bottom:24px;opacity:1;pointer-events:auto;}',
      '#' + cfg.popupId + ' *{box-sizing:border-box;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media{position:relative;background:radial-gradient(circle at top right,rgba(253,126,20,.14),transparent 38%),linear-gradient(180deg,#05182c 0%,#02111f 100%);padding:12px 12px 0;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__image-frame{position:relative;border-radius:18px 18px 0 0;overflow:hidden;background:#02111f;border:1px solid rgba(255,255,255,.05);border-bottom:none;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media img{display:block;width:100%;height:auto;aspect-ratio:16 / 9;object-fit:contain;object-position:center top;background:#02111f;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media-top{position:absolute;top:14px;left:14px;right:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;pointer-events:none;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__badge{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;background:rgba(0,20,39,.68);backdrop-filter:blur(10px);font-size:12px;font-weight:700;color:#FD7E14;pointer-events:auto;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__close{appearance:none;border:none;width:34px;height:34px;border-radius:999px;background:rgba(0,20,39,.68);backdrop-filter:blur(10px);color:#fff;cursor:pointer;font-size:20px;line-height:1;pointer-events:auto;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__close:hover{background:rgba(0,20,39,.9);}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__content{display:flex;flex-direction:column;gap:12px;padding:18px 18px 18px;min-width:0;border-top:1px solid rgba(255,255,255,.05);}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__title{margin:0;color:#ffffff;font-size:24px;line-height:1.06;font-weight:800;letter-spacing:-.03em;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__desc{margin:0;font-size:15px;line-height:1.5;color:rgba(255,255,255,.82);}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__meta-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__meta{margin:0;font-size:13px;font-weight:700;color:#E7E0DA;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__pill{display:inline-flex;align-items:center;min-height:28px;padding:6px 10px;border-radius:999px;background:rgba(253,126,20,.12);border:1px solid rgba(253,126,20,.18);font-size:12px;font-weight:700;color:#FDB066;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__actions{display:flex;gap:10px;flex-wrap:nowrap;margin-top:2px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 16px;border-radius:13px;text-decoration:none;font-weight:700;font-size:14px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta--primary{flex:1 1 auto;background:#FD7E14;color:#fff;box-shadow:0 10px 22px rgba(253,126,20,.32);}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta--secondary{flex:0 0 auto;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:#fff;min-width:112px;}',
      '@media (max-width: 767px){',
      '#' + cfg.popupId + '{left:50%;transform:translateX(-50%);width:calc(100vw - 24px);max-width:360px;}',
      '#' + cfg.popupId + '.agilo-webinar-popup--visible{bottom:12px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__media{padding:10px 10px 0;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__content{padding:14px 14px 16px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__title{font-size:20px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__desc{font-size:14px;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__actions{flex-wrap:wrap;}',
      '#' + cfg.popupId + ' .agilo-webinar-popup__cta--secondary{flex:1 1 100%;min-width:0;}',
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
      '<div class="agilo-webinar-popup__image-frame">' +
      '<img src="' + cfg.imageUrl + '" alt="Visuel du webinaire Agilotext" loading="lazy">' +
      '<div class="agilo-webinar-popup__media-top">' +
      '<div class="agilo-webinar-popup__badge">● ' + cfg.badge + '</div>' +
      '<button type="button" class="agilo-webinar-popup__close" aria-label="Fermer">&times;</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="agilo-webinar-popup__content">' +
      '<h3 class="agilo-webinar-popup__title">' + cfg.title + '</h3>' +
      '<p class="agilo-webinar-popup__desc">' + cfg.description + '</p>' +
      '<div class="agilo-webinar-popup__meta-row">' +
      '<p class="agilo-webinar-popup__meta">' + cfg.meta + '</p>' +
      '<span class="agilo-webinar-popup__pill">Replay + checklist offerts</span>' +
      '</div>' +
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
