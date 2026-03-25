/**
 * agilo-mobile-app-banner.js
 * Smart banner (bas d'écran) sur le site Webflow quand l'utilisateur
 * est sur mobile (UA + largeur < 1024). Propose l'ouverture App Store / Play Store.
 *
 * IMPORTANT — Ne pas utiliser un « Embed » Webflow pour coller ce fichier brut :
 * - soit Project settings → Custom code → Footer code (recommandé) avec :
 *   <script defer src="https://VOTRE-CDN/agilo-mobile-app-banner.js"></script>
 * - soit Embed avec TOUT le code entouré de <script>...</script> (une seule balise).
 *
 * localStorage : agilo_app_banner_dismissed = timestamp (ms) ; pas de ré-affichage 7 jours.
 *
 * QA sur bureau : ajouter ?agilo_banner_test=1 à l’URL pour forcer l’affichage
 * (ignore UA, largeur, dismiss et délai court).
 *
 * Portée : toutes les pages du site, sauf denylist (ex. /auth/post-login, bridges mobile,
 * /style-guide). Inclut accueil, login, inscription, blog, légal, /app/, outils.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'agilo_app_banner_dismissed';
  var DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
  var SHOW_DELAY_MS = 3000;
  var SHOW_DELAY_TEST_MS = 600;

  var APP_STORE_URL =
    'https://apps.apple.com/fr/app/agilotext-audio-en-texte/id6760418600';
  var PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=com.agilotext.mobile';

  var BANNER_ID = 'agilo-mobile-app-banner';

  /** Pas de bannière sur ces préfixes (redirects courts, bridges mobile, page interne). */
  var PATH_DENYLIST_PREFIXES = [
    '/style-guide',
    '/auth/post-login',
    '/auth/mobile-auth',
    '/auth/auth-mobile-apple'
  ];

  function normalizedPathname() {
    var p = window.location.pathname || '';
    if (p === '' || p === '/') {
      return '/';
    }
    return p.replace(/\/+$/, '');
  }

  function isPathAllowedForBanner() {
    var p = normalizedPathname();
    var i;
    var d;
    for (i = 0; i < PATH_DENYLIST_PREFIXES.length; i++) {
      d = PATH_DENYLIST_PREFIXES[i];
      if (p === d || p.indexOf(d + '/') === 0) {
        return false;
      }
    }
    return true;
  }

  function getTestMode() {
    try {
      return (
        new URLSearchParams(window.location.search || '').get(
          'agilo_banner_test'
        ) === '1'
      );
    } catch (e) {
      return false;
    }
  }

  var TEST_MODE = getTestMode();
  var showDelayMs = TEST_MODE ? SHOW_DELAY_TEST_MS : SHOW_DELAY_MS;

  if (!isPathAllowedForBanner()) {
    return;
  }

  if (!TEST_MODE) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var t0 = parseInt(raw, 10);
        if (!isNaN(t0) && Date.now() - t0 < DISMISS_MS) {
          return;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  function shouldShowForMobile() {
    if (TEST_MODE) {
      return true;
    }
    var ua = navigator.userAgent || '';
    return (
      /iPhone|iPad|iPod|Android/i.test(ua) && window.innerWidth < 1024
    );
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function storeUrl() {
    return isIOS() ? APP_STORE_URL : PLAY_STORE_URL;
  }

  function injectStyles() {
    if (document.getElementById('agilo-mobile-app-banner-styles')) {
      return;
    }
    /* Tokens design Agilotext (Figma « Base ») : gris_foncé #020202, white #ffffff, orange #fd7e14,
       blanc_gris #f8f9fa, Noir_25% rgba(52,58,64,0.25), 0.5_radius 0.5rem */
    var css = [
      '#' + BANNER_ID + '{',
      'position:fixed;',
      'left:0;right:0;bottom:0;',
      'z-index:2147483000;',
      'display:flex;',
      'align-items:center;',
      'gap:12px;',
      'padding:12px 48px 12px 14px;',
      'min-height:56px;',
      'box-sizing:border-box;',
      'background:#020202;',
      'color:#ffffff;',
      'border-radius:0.5rem 0.5rem 0 0;',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'font-size:14px;',
      'line-height:1.35;',
      'box-shadow:0 -6px 28px rgba(52,58,64,0.25);',
      'transform:translateY(100%);',
      'transition:transform .35s ease;',
      '}',
      '#' + BANNER_ID + '.agilo-banner-visible{transform:translateY(0);}',
      '#' + BANNER_ID + ' .agilo-banner-text{flex:1;min-width:0;}',
      '#' + BANNER_ID + ' .agilo-banner-title{font-weight:600;margin:0 0 2px;color:#ffffff;}',
      '#' +
        BANNER_ID +
        ' .agilo-banner-sub{margin:0;font-size:12px;color:#f8f9fa;opacity:.92;}',
      '#' + BANNER_ID + ' .agilo-banner-cta{',
      'flex-shrink:0;',
      'padding:8px 14px;',
      'border-radius:0.5rem;',
      'background:#fd7e14;',
      'color:#ffffff;',
      'font-weight:600;',
      'text-decoration:none;',
      'white-space:nowrap;',
      '}',
      '#' + BANNER_ID + ' .agilo-banner-cta:active{opacity:.92;}',
      '#' + BANNER_ID + ' .agilo-banner-close{',
      'position:absolute;',
      'top:8px;right:8px;',
      'width:36px;height:36px;',
      'border:none;',
      'background:transparent;',
      'color:#ffffff;',
      'font-size:22px;',
      'line-height:1;',
      'cursor:pointer;',
      'padding:0;',
      'border-radius:0.5rem;',
      '}',
      '#' +
        BANNER_ID +
        ' .agilo-banner-close:focus{outline:2px solid #fd7e14;outline-offset:2px;}'
    ];
    if (!TEST_MODE) {
      css.push(
        '@media (min-width:1024px){#' +
          BANNER_ID +
          '{display:none!important;}}'
      );
    }
    css = css.join('');

    var s = document.createElement('style');
    s.id = 'agilo-mobile-app-banner-styles';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function dismiss() {
    if (!TEST_MODE) {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch (e) {
        /* ignore */
      }
    }
    var el = document.getElementById(BANNER_ID);
    if (el) {
      el.classList.remove('agilo-banner-visible');
      setTimeout(function () {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 400);
    }
  }

  function showBanner() {
    if (!shouldShowForMobile()) {
      return;
    }
    if (document.getElementById(BANNER_ID)) {
      return;
    }

    injectStyles();

    var url = storeUrl();
    var label = isIOS() ? 'App Store' : 'Google Play';

    var wrap = document.createElement('div');
    wrap.id = BANNER_ID;
    if (TEST_MODE) {
      wrap.className = 'agilo-banner-test-mode';
      wrap.setAttribute('data-agilo-banner-test', '1');
    }
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Télécharger l’application Agilotext');

    wrap.innerHTML =
      '<div class="agilo-banner-text">' +
      '<p class="agilo-banner-title">Application mobile</p>' +
      '<p class="agilo-banner-sub">Une meilleure expérience sur téléphone : dictée et transcriptions.</p>' +
      '</div>' +
      '<a class="agilo-banner-cta" href="' +
      url +
      '" target="_blank" rel="noopener noreferrer">Ouvrir ' +
      label +
      '</a>' +
      '<button type="button" class="agilo-banner-close" aria-label="Fermer">&times;</button>';

    document.body.appendChild(wrap);

    wrap.querySelector('.agilo-banner-close').addEventListener('click', dismiss);

    requestAnimationFrame(function () {
      wrap.classList.add('agilo-banner-visible');
    });
  }

  window.addEventListener('resize', function () {
    if (TEST_MODE) {
      return;
    }
    var el = document.getElementById(BANNER_ID);
    if (!el) {
      return;
    }
    /* Agrandissement bureau : retirer la bannière sans marquer comme « dismissé » 7 j. */
    if (!shouldShowForMobile()) {
      el.classList.remove('agilo-banner-visible');
      setTimeout(function () {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 400);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(showBanner, showDelayMs);
    });
  } else {
    setTimeout(showBanner, showDelayMs);
  }
})();
