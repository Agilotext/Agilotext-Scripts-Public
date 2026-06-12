/**
 * agilo-voice-dashboard-popup.js
 * Popup dashboard pour inciter à configurer l'empreinte vocale.
 *
 * Intégration Webflow (pages dashboard) :
 * <script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/shared/agilo-voice-dashboard-popup.js"></script>
 *
 * Mode test :
 *   ?agilo_voice_popup_test=1
 */
(function () {
  'use strict';

  if (window.__AGILO_VOICE_DASHBOARD_POPUP__) return;
  window.__AGILO_VOICE_DASHBOARD_POPUP__ = true;

  var DEFAULTS = {
    showDelayMs: 1500,
    showDelayTestMs: 250,
    reappearDays: 7,
    storageDismissedKey: 'agilo:voice-popup:dismissedAt',
    popupId: 'agilo-voice-popup',
    styleId: 'agilo-voice-popup-styles',
    badge: 'Empreinte vocale',
    title: 'Configurez votre voix',
    description:
      'Enregistrez 15 à 45 secondes de votre voix pour être reconnu(e) automatiquement dans vos transcriptions.',
    meta: 'Configuration en 1 minute · Mon compte',
    primaryCta: 'Configurer maintenant',
    secondaryCta: 'Plus tard'
  };

  var cfg = Object.assign({}, DEFAULTS, window.AGILO_VOICE_DASHBOARD_CONFIG || {});

  var MIC_ICON =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="22" height="22">' +
    '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function getTestMode() {
    try {
      return new URLSearchParams(window.location.search || '').get('agilo_voice_popup_test') === '1';
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
    return /^\/app\/(free|premium|business)\/dashboard$/.test(p);
  }

  function isFreeDashboard() {
    return inferEditionFromPath() === 'free';
  }

  function getPopupContent() {
    if (isFreeDashboard()) {
      return {
        badge: 'Empreinte vocale',
        title: 'Identifiez chaque intervenant',
        description: 'Enregistrez votre voix et celles de vos collègues pour être reconnu(e) automatiquement dans vos transcriptions.',
        meta: 'Inclus dans Pro et Business · Essai gratuit',
        primaryCta: 'Découvrir Pro',
        primaryUrl: '/pricing'
      };
    }
    return {
      badge: cfg.badge,
      title: cfg.title,
      description: cfg.description,
      meta: cfg.meta,
      primaryCta: cfg.primaryCta,
      primaryUrl: profileUrl()
    };
  }

  function inferEditionFromPath() {
    var p = normalizedPathname();
    var m = p.match(/^\/app\/([^/]+)\/dashboard$/);
    if (!m) return 'free';
    var seg = String(m[1] || '').toLowerCase();
    if (seg === 'business' || seg === 'ent' || seg === 'enterprise') return 'business';
    if (seg === 'premium' || seg === 'pro') return 'premium';
    return 'free';
  }

  function profileUrl() {
    return '/app/' + inferEditionFromPath() + '/profile?tab=profile#agilo-voice-settings';
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

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function waitForMemberstack(timeoutMs) {
    var started = Date.now();
    while (Date.now() - started < (timeoutMs || 10000)) {
      if (window.$memberstackDom) return window.$memberstackDom;
      await sleep(120);
    }
    return null;
  }

  async function readVoiceEnrolledFlag() {
    var ms = await waitForMemberstack();
    if (!ms || typeof ms.getCurrentMember !== 'function') return undefined;
    try {
      var res = await ms.getCurrentMember();
      var member = (res && res.data) || res || null;
      var cf = (member && member.customFields) || {};
      return cf['voice-enrolled'];
    } catch (e) {
      console.warn('[agilo-voice-popup] getCurrentMember failed', e);
      return undefined;
    }
  }

  function isDismissedRecently() {
    var dismissedAt = readTs(cfg.storageDismissedKey);
    if (!dismissedAt) return false;
    var reappearMs = cfg.reappearDays * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < reappearMs;
  }

  async function shouldShow() {
    var testMode = getTestMode();
    if (!testMode && !isDashboardPath()) return false;
    if (!testMode && isDismissedRecently()) return false;

    if (testMode) return true;

    if (isFreeDashboard()) return true;

    var voiceEnrolled = await readVoiceEnrolledFlag();
    if (voiceEnrolled === 'true' || voiceEnrolled === 'skipped') return false;
    return true;
  }

  function injectStyles() {
    if (document.getElementById(cfg.styleId)) return;
    var css = [
      '#' + cfg.popupId + '{',
      'position:fixed;',
      'right:24px;',
      'bottom:-560px;',
      'width:min(390px, calc(100vw - 32px));',
      'display:flex;',
      'flex-direction:column;',
      'border-radius:20px;',
      'overflow:hidden;',
      'background:linear-gradient(180deg,#021224 0%,#001427 100%);',
      'color:#ffffff;',
      'box-shadow:0 28px 80px rgba(0,0,0,.36);',
      'border:1px solid rgba(23,74,150,.22);',
      'z-index:2147482999;',
      'opacity:0;',
      'pointer-events:none;',
      'transition:bottom .55s cubic-bezier(.16,1,.3,1),opacity .35s ease;',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'box-sizing:border-box;',
      '}',
      '#' + cfg.popupId + '.agilo-voice-popup--visible{bottom:24px;opacity:1;pointer-events:auto;}',
      '#' + cfg.popupId + ' *{box-sizing:border-box;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__header{',
      'position:relative;',
      'display:flex;',
      'align-items:flex-start;',
      'justify-content:space-between;',
      'gap:12px;',
      'padding:18px 18px 0;',
      'background:radial-gradient(circle at top right,rgba(23,74,150,.18),transparent 42%),linear-gradient(180deg,#05182c 0%,#02111f 100%);',
      '}',
      '#' + cfg.popupId + ' .agilo-voice-popup__badge{',
      'display:inline-flex;align-items:center;gap:8px;',
      'padding:8px 12px;border-radius:999px;',
      'background:rgba(0,20,39,.68);backdrop-filter:blur(10px);',
      'font-size:12px;font-weight:700;color:#6FA8FF;',
      '}',
      '#' + cfg.popupId + ' .agilo-voice-popup__badge-icon{display:inline-flex;color:#6FA8FF;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__close{',
      'appearance:none;border:none;width:34px;height:34px;border-radius:999px;',
      'background:rgba(0,20,39,.68);backdrop-filter:blur(10px);color:#fff;cursor:pointer;font-size:20px;line-height:1;',
      '}',
      '#' + cfg.popupId + ' .agilo-voice-popup__close:hover{background:rgba(0,20,39,.9);}',
      '#' + cfg.popupId + ' .agilo-voice-popup__content{display:flex;flex-direction:column;gap:12px;padding:16px 18px 18px;min-width:0;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__title{margin:0;color:#ffffff;font-size:22px;line-height:1.1;font-weight:800;letter-spacing:-.03em;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__desc{margin:0;font-size:15px;line-height:1.5;color:rgba(255,255,255,.82);}',
      '#' + cfg.popupId + ' .agilo-voice-popup__meta{margin:0;font-size:13px;font-weight:600;color:#C7D7EF;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__actions{display:flex;gap:10px;flex-wrap:nowrap;margin-top:2px;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__cta{',
      'display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 16px;border-radius:13px;',
      'text-decoration:none;font-weight:700;font-size:14px;border:none;cursor:pointer;font-family:inherit;',
      '}',
      '#' + cfg.popupId + ' .agilo-voice-popup__cta--primary{flex:1 1 auto;background:#174A96;color:#fff;box-shadow:0 10px 22px rgba(23,74,150,.32);}',
      '#' + cfg.popupId + ' .agilo-voice-popup__cta--secondary{flex:0 0 auto;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:#fff;min-width:112px;}',
      '@media (max-width: 767px){',
      '#' + cfg.popupId + '{right:50%;transform:translateX(50%);width:calc(100vw - 24px);max-width:360px;}',
      '#' + cfg.popupId + '.agilo-voice-popup--visible{bottom:12px;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__actions{flex-wrap:wrap;}',
      '#' + cfg.popupId + ' .agilo-voice-popup__cta--secondary{flex:1 1 100%;min-width:0;}',
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
    popup.classList.remove('agilo-voice-popup--visible');
    setTimeout(function () {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 450);
  }

  function onDismiss() {
    writeTs(cfg.storageDismissedKey);
    removePopup();
  }

  function onClickCta() {
    removePopup();
    var content = getPopupContent();
    window.location.href = content.primaryUrl || profileUrl();
  }

  function buildPopup() {
    if (document.getElementById(cfg.popupId)) return null;
    injectStyles();

    var content = getPopupContent();
    var root = document.createElement('aside');
    root.id = cfg.popupId;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', content.title);
    root.innerHTML =
      '<div class="agilo-voice-popup__header">' +
      '<div class="agilo-voice-popup__badge">' +
      '<span class="agilo-voice-popup__badge-icon">' + MIC_ICON + '</span>' +
      content.badge +
      '</div>' +
      '<button type="button" class="agilo-voice-popup__close" aria-label="Fermer">&times;</button>' +
      '</div>' +
      '<div class="agilo-voice-popup__content">' +
      '<h3 class="agilo-voice-popup__title">' + content.title + '</h3>' +
      '<p class="agilo-voice-popup__desc">' + content.description + '</p>' +
      '<p class="agilo-voice-popup__meta">' + content.meta + '</p>' +
      '<div class="agilo-voice-popup__actions">' +
      '<button type="button" class="agilo-voice-popup__cta agilo-voice-popup__cta--primary">' + content.primaryCta + '</button>' +
      '<button type="button" class="agilo-voice-popup__cta agilo-voice-popup__cta--secondary">' + cfg.secondaryCta + '</button>' +
      '</div>' +
      '</div>';

    var closeBtn = root.querySelector('.agilo-voice-popup__close');
    var secondaryBtn = root.querySelector('.agilo-voice-popup__cta--secondary');
    var primaryBtn = root.querySelector('.agilo-voice-popup__cta--primary');

    closeBtn.addEventListener('click', onDismiss);
    secondaryBtn.addEventListener('click', onDismiss);
    primaryBtn.addEventListener('click', onClickCta);

    return root;
  }

  async function showPopup() {
    var ok = await shouldShow();
    if (!ok) return;
    var root = buildPopup();
    if (!root) return;
    document.body.appendChild(root);
    requestAnimationFrame(function () {
      root.classList.add('agilo-voice-popup--visible');
    });
  }

  function boot() {
    if (!document.body) return;
    var delay = getTestMode() ? cfg.showDelayTestMs : cfg.showDelayMs;
    setTimeout(function () {
      showPopup().catch(function (e) {
        console.warn('[agilo-voice-popup] show failed', e);
      });
    }, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
