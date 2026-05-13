/**
 * agilo-webinar-public-sticky.js
 * Bandeau sticky webinar pour les pages marketing publiques.
 *
 * Intégration Webflow :
 * <script>
 *   window.AGILO_WEBINAR_PUBLIC_CONFIG = {
 *     imageUrl: 'https://.../cover.png'
 *   };
 * </script>
 * <script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/shared/agilo-webinar-public-sticky.js"></script>
 *
 * Mode test :
 *   ?agilo_webinar_test=1
 */
(function () {
  'use strict';

  if (window.__AGILO_WEBINAR_PUBLIC_STICKY__) return;
  window.__AGILO_WEBINAR_PUBLIC_STICKY__ = true;

  var DEFAULTS = {
    targetUrl:
      'https://www.agilotext.com/webinaire/comment-obtenir-des-comptes-rendus-professionnels-avec-agilotext-methode-bonnes-pratiques-et-cas-reel',
    eventEndIso: '2026-05-20T12:00:00+02:00',
    showDelayMs: 1000,
    hideHours: 24,
    imageUrl:
      'https://cdn.prod.website-files.com/6815bee5a9c0b57da1835531/6a01fed41b8d33ba789efeba_1%20(1).png',
    label: '🎙️ Webinaire Agilotext',
    text: 'Comment obtenir des comptes-rendus professionnels vraiment exploitables',
    meta: '20 mai · 12h',
    cta: 'S’inscrire',
    exactAllowPaths: ['/', '/tarifs'],
    prefixAllowPaths: [
      '/blog',
      '/tools',
      '/anonymisation',
      '/extension-chrome'
    ],
    prefixDenyPaths: ['/webinaire', '/auth', '/app', '/style-guide'],
    storageDismissedKey: 'agilo:webinar:2026-05-20:publicDismissedAt',
    storageClickedKey: 'agilo:webinar:2026-05-20:publicClickedAt',
    bannerId: 'agilo-webinar-public-banner',
    styleId: 'agilo-webinar-public-banner-styles'
  };

  var cfg = Object.assign(
    {},
    DEFAULTS,
    window.AGILO_WEBINAR_PUBLIC_CONFIG || {}
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
    return p.replace(/\/+$/, '') || '/';
  }

  function isAllowedPath() {
    var p = normalizedPathname();
    var i;
    for (i = 0; i < cfg.prefixDenyPaths.length; i++) {
      if (
        p === cfg.prefixDenyPaths[i] ||
        p.indexOf(cfg.prefixDenyPaths[i] + '/') === 0
      ) {
        return false;
      }
    }
    if (cfg.exactAllowPaths.indexOf(p) >= 0) return true;
    for (i = 0; i < cfg.prefixAllowPaths.length; i++) {
      if (
        p === cfg.prefixAllowPaths[i] ||
        p.indexOf(cfg.prefixAllowPaths[i] + '/') === 0
      ) {
        return true;
      }
    }
    return false;
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
    if (!testMode && !isAllowedPath()) return false;
    if (!testMode && isExpired()) return false;

    var clickedAt = readTs(cfg.storageClickedKey);
    if (!testMode && clickedAt) return false;

    var dismissedAt = readTs(cfg.storageDismissedKey);
    if (!testMode && dismissedAt) {
      var hideMs = cfg.hideHours * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < hideMs) return false;
    }
    return true;
  }

  function injectStyles() {
    if (document.getElementById(cfg.styleId)) return;
    var css = [
      '#' + cfg.bannerId + '{',
      'position:fixed;',
      'left:50%;',
      'bottom:16px;',
      'transform:translateX(-50%) translateY(120%);',
      'width:min(920px, calc(100vw - 32px));',
      'display:flex;',
      'align-items:center;',
      'gap:14px;',
      'padding:12px 14px;',
      'background:rgba(0,20,39,.96);',
      'color:#fff;',
      'border:1px solid rgba(253,126,20,.2);',
      'border-radius:16px;',
      'box-shadow:0 12px 34px rgba(0,0,0,.22);',
      'z-index:2147482900;',
      'opacity:0;',
      'pointer-events:none;',
      'transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .28s ease;',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'box-sizing:border-box;',
      '}',
      '#' + cfg.bannerId + '.agilo-webinar-public-banner--visible{transform:translateX(-50%) translateY(0);opacity:1;pointer-events:auto;}',
      '#' + cfg.bannerId + ' *{box-sizing:border-box;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__thumb{width:76px;height:52px;border-radius:10px;overflow:hidden;flex:0 0 auto;background:#021b33;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__thumb img{width:100%;height:100%;object-fit:cover;display:block;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__body{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:2px;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__label{font-size:12px;font-weight:700;color:#FD7E14;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__text{font-size:14px;font-weight:700;line-height:1.35;color:#fff;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__meta{font-size:12px;color:rgba(231,224,218,.88);}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__cta{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:10px 16px;border-radius:10px;background:#FD7E14;color:#fff;text-decoration:none;font-weight:700;font-size:14px;white-space:nowrap;flex:0 0 auto;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__close{appearance:none;border:none;background:transparent;color:rgba(255,255,255,.72);cursor:pointer;font-size:20px;line-height:1;padding:0 2px;flex:0 0 auto;}',
      '@media (max-width: 767px){',
      '#' + cfg.bannerId + '{width:calc(100vw - 20px);align-items:flex-start;gap:10px;padding:12px;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__thumb{display:none;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__text{font-size:13px;}',
      '#' + cfg.bannerId + ' .agilo-webinar-public-banner__cta{min-height:38px;padding:9px 12px;font-size:13px;}',
      '}'
    ].join('');

    var style = document.createElement('style');
    style.id = cfg.styleId;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeBanner() {
    var banner = document.getElementById(cfg.bannerId);
    if (!banner) return;
    banner.classList.remove('agilo-webinar-public-banner--visible');
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 400);
  }

  function onDismiss() {
    writeTs(cfg.storageDismissedKey);
    removeBanner();
  }

  function onClickCta() {
    writeTs(cfg.storageClickedKey);
    removeBanner();
  }

  function buildBanner() {
    if (document.getElementById(cfg.bannerId)) return null;
    injectStyles();

    var root = document.createElement('aside');
    root.id = cfg.bannerId;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', cfg.label);
    root.innerHTML =
      '<div class="agilo-webinar-public-banner__thumb">' +
      '<img src="' + cfg.imageUrl + '" alt="Visuel du webinaire Agilotext" loading="lazy">' +
      '</div>' +
      '<div class="agilo-webinar-public-banner__body">' +
      '<div class="agilo-webinar-public-banner__label">' + cfg.label + '</div>' +
      '<div class="agilo-webinar-public-banner__text">' + cfg.text + '</div>' +
      '<div class="agilo-webinar-public-banner__meta">' + cfg.meta + '</div>' +
      '</div>' +
      '<a class="agilo-webinar-public-banner__cta" href="' + cfg.targetUrl + '">' + cfg.cta + '</a>' +
      '<button type="button" class="agilo-webinar-public-banner__close" aria-label="Fermer">&times;</button>';

    root
      .querySelector('.agilo-webinar-public-banner__close')
      .addEventListener('click', onDismiss);
    root
      .querySelector('.agilo-webinar-public-banner__cta')
      .addEventListener('click', onClickCta);

    return root;
  }

  function showBanner() {
    if (!shouldShow()) return;
    var root = buildBanner();
    if (!root) return;
    document.body.appendChild(root);
    requestAnimationFrame(function () {
      root.classList.add('agilo-webinar-public-banner--visible');
    });
  }

  function boot() {
    if (!document.body) return;
    setTimeout(showBanner, cfg.showDelayMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
