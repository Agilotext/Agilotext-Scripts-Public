/* ================================================================
   AGILOTEXT - Dock chrome (panel + audio compact) dans le transcript
   Page : /app/{free|pro|business}/editor
   Charge : après Code-lecteur-audio-V3.4.js
   Un seul <audio id="agilo-audio">. Pas de follow-playhead.
   Sticky puis is-floating sous les onglets. Pas de lock html, pas de fit 100dvh.
   ================================================================ */

(function () {
  'use strict';

  if (window.__agiloAudioSticky) return;
  window.__agiloAudioSticky = true;

  var ROOT = typeof document !== 'undefined' ? document.documentElement : null;
  var DOCK_ID = 'ag-editor-chrome-dock';
  var SENTINEL_CLASS = 'ag-editor-chrome-dock-sentinel';
  var ROW_ID = 'ag-editor-audio-row';
  var LEGACY_SLOT_ID = 'ag-editor-audio-slot';
  var LEGACY_PIN_ID = 'ag-editor-pin-host';
  var IO_ROOT_MARGIN = '40px 0px 0px 0px';
  var IO_SHOW_RATIO = 0.12;
  var FOLLOW_BTN_ID = 'agilo-transcript-follow';
  var FOLLOW_HINT_ID = 'agilo-transcript-follow-hint';
  var FOLLOW_HINT_TEXT = 'L\'écran descend avec l\'audio. Si vous scrollez ou vous corrigez le texte, ça s\'arrête. Cliquez sur Suivre pour reprendre.';
  var DELETE_BTN_ID = 'agilo-audio-delete';
  var DELETE_PANEL_ID = 'agilo-audio-delete-panel';

  function apiBaseForHost(hostname) {
    if (hostname === 'agilotext-test.webflow.io') return 'https://apitest.agilotext.com/api/v1';
    return 'https://api.agilotext.com/api/v1';
  }

  function canOfferDeleteAudio(opts) {
    opts = opts || {};
    var path = String(opts.path || '');
    if (path.indexOf('/auth/share') !== -1) return false;
    if (!opts.token) return false;
    if (!opts.jobId) return false;
    if (opts.audioUnavailable) return false;
    return true;
  }

  function resolveFollowHost(opts) {
    opts = opts || {};
    if (opts.rowOpen && opts.stickyBar) {
      return { mode: 'sticky', host: opts.stickyBar, before: opts.trackEl || null, after: opts.speedEl || null };
    }
    if (opts.speedEl && opts.speedEl.parentNode) {
      return { mode: 'wrap', host: opts.speedEl.parentNode, before: opts.speedEl.nextSibling || opts.speedEl.nextElementSibling || null, after: opts.speedEl };
    }
    if (opts.dock) {
      return { mode: 'dock', host: opts.dock, before: opts.rowEl || null, after: null };
    }
    return { mode: 'none', host: null, before: null, after: null };
  }

  function computeAudioRowState(opts) {
    opts = opts || {};
    var wrapIntersecting = !!opts.wrapIntersecting;
    var unavailable = !!opts.audioUnavailable;
    return {
      shouldShow: !wrapIntersecting && !unavailable
    };
  }

  function applyIoHysteresis(prevIntersecting, entry) {
    if (!entry) return !!prevIntersecting;
    if (!entry.isIntersecting) return false;
    var ratio = Number(entry.intersectionRatio);
    if (!Number.isFinite(ratio)) ratio = entry.isIntersecting ? 1 : 0;
    if (ratio >= IO_SHOW_RATIO) return true;
    return !!prevIntersecting;
  }

  function getEditorChromeBottom(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelector !== 'function') return 0;
    var selectors = [
      'main.ed-main nav.ed-tabs',
      'main.ed-main [data-tour="ed-tabs"]',
      'nav.ed-tabs',
      '[role="tablist"]',
      'main.ed-main .ed-toolbar',
      '.ed-toolbar',
      'header.ed-header',
      '.ed-header'
    ];
    var bottom = 0;
    for (var i = 0; i < selectors.length; i++) {
      var el = doc.querySelector(selectors[i]);
      if (!el || typeof el.getBoundingClientRect !== 'function') continue;
      var rect = el.getBoundingClientRect();
      if (rect && Number.isFinite(rect.bottom) && rect.height > 0) {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    return bottom;
  }

  function resolveConfidenceChromeBottom(chromeBottom, fallbacks) {
    fallbacks = fallbacks || {};
    var measured = Number(chromeBottom);
    if (Number.isFinite(measured) && measured > 0) return measured;
    var tabsBottom = Number(fallbacks.tabsBottom);
    if (Number.isFinite(tabsBottom) && tabsBottom > 0) return tabsBottom;
    var paneTop = Number(fallbacks.paneTop);
    if (Number.isFinite(paneTop) && paneTop > 0) return Math.max(8, paneTop);
    return 8;
  }

  function computeChromeDockFloatingBox(sentinelRect, containerRect, chromeBottom, innerWidth, fallbacks) {
    var measuredChrome = Math.max(0, Number(chromeBottom) || 0);
    var safeChrome = resolveConfidenceChromeBottom(chromeBottom, fallbacks);
    var floatThreshold = measuredChrome > 0 ? Math.max(8, measuredChrome + 4) : 8;
    var viewportW = Number.isFinite(innerWidth) ? innerWidth : 1024;
    var cLeft = Number(containerRect && containerRect.left) || 0;
    var cWidth = Number(containerRect && containerRect.width) || 0;
    var cBottom = Number(containerRect && containerRect.bottom) || 0;
    var sTop = Number(sentinelRect && sentinelRect.top) || 0;
    var shouldFloat = sTop < floatThreshold && cBottom > safeChrome + 72;
    if (!shouldFloat) {
      return { shouldFloat: false, left: 0, width: 0, top: 0, chromeBottom: safeChrome };
    }
    return {
      shouldFloat: true,
      left: Math.max(12, cLeft),
      width: Math.max(260, Math.min(cWidth || 260, viewportW - 24)),
      top: safeChrome + 8,
      chromeBottom: safeChrome
    };
  }

  function placeChromeDock(dock, doc) {
    doc = doc || document;
    if (!dock || !doc) return false;
    var pane = typeof doc.getElementById === 'function' ? doc.getElementById('pane-transcript') : null;
    if (!pane) return false;
    var editor = typeof doc.getElementById === 'function' ? doc.getElementById('transcriptEditor') : null;
    if (editor && editor.parentNode === pane) {
      if (dock.parentNode === pane && dock.nextElementSibling === editor) return true;
      pane.insertBefore(dock, editor);
      return true;
    }
    if (dock.parentNode !== pane) {
      pane.insertBefore(dock, pane.firstChild || null);
    }
    return true;
  }

  function placeAudioRow(row, doc) {
    doc = doc || document;
    if (!row || !doc) return false;
    var dock = typeof doc.getElementById === 'function' ? doc.getElementById(DOCK_ID) : null;
    if (!dock) return false;
    if (row.parentNode === dock) return true;
    if (typeof dock.appendChild === 'function') dock.appendChild(row);
    else if (typeof dock.insertBefore === 'function') dock.insertBefore(row, null);
    else return false;
    return true;
  }

  function getChromeDockState(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    var dock = doc && typeof doc.getElementById === 'function' ? doc.getElementById(DOCK_ID) : null;
    var sentinel = dock && dock.previousElementSibling && String(dock.previousElementSibling.className || '').indexOf(SENTINEL_CLASS) >= 0
      ? dock.previousElementSibling
      : null;
    var sRect = sentinel && typeof sentinel.getBoundingClientRect === 'function'
      ? sentinel.getBoundingClientRect()
      : null;
    return {
      dockConnected: !!(dock && dock.isConnected),
      isFloating: !!(dock && dock.classList && dock.classList.contains('is-floating')),
      chromeBottom: getEditorChromeBottom(doc),
      sentinelTop: sRect ? sRect.top : null
    };
  }

  window.AgiloAudioSticky = {
    computeAudioRowState: computeAudioRowState,
    applyIoHysteresis: applyIoHysteresis,
    placeChromeDock: placeChromeDock,
    placeAudioRow: placeAudioRow,
    getEditorChromeBottom: getEditorChromeBottom,
    resolveConfidenceChromeBottom: resolveConfidenceChromeBottom,
    computeChromeDockFloatingBox: computeChromeDockFloatingBox,
    getChromeDockState: getChromeDockState,
    resolveFollowHost: resolveFollowHost,
    apiBaseForHost: apiBaseForHost,
    canOfferDeleteAudio: canOfferDeleteAudio,
    DOCK_ID: DOCK_ID,
    ROW_ID: ROW_ID,
    FOLLOW_BTN_ID: FOLLOW_BTN_ID,
    FOLLOW_HINT_ID: FOLLOW_HINT_ID,
    DELETE_BTN_ID: DELETE_BTN_ID,
    DELETE_PANEL_ID: DELETE_PANEL_ID,
    IO_ROOT_MARGIN: IO_ROOT_MARGIN,
    IO_SHOW_RATIO: IO_SHOW_RATIO
  };

  if (window.AGILO_AUDIO_STICKY_SKIP_BOOT) return;
  if (typeof document === 'undefined') return;

  var dock = null;
  var sentinel = null;
  var row = null;
  var bar = null;
  var wrapObserved = null;
  var paneObserved = null;
  var io = null;
  var paneMo = null;
  var wrapIntersecting = true;
  var wrapInert = false;
  var raf = 0;
  var floatBound = false;

  function injectCss() {
    if (document.getElementById('agilo-audio-sticky-css')) return;
    var s = document.createElement('style');
    s.id = 'agilo-audio-sticky-css';
    s.textContent = [
      '.ag-editor-chrome-dock{position:sticky;top:8px;z-index:20;box-sizing:border-box;',
      'width:100%;max-width:100%;background:rgba(255,255,255,.72);',
      'backdrop-filter:blur(20px) saturate(180%);',
      '-webkit-backdrop-filter:blur(20px) saturate(180%);border-radius:8px;overflow:visible}',
      '.ag-editor-chrome-dock.is-floating{position:fixed;',
      'top:var(--ag-confidence-floating-top,8px);',
      'left:var(--ag-confidence-floating-left,16px);',
      'width:var(--ag-confidence-floating-width,min(760px,calc(100vw - 32px)));',
      'max-width:calc(100vw - 32px);z-index:25;',
      'box-shadow:0 10px 26px rgba(15,23,42,.16)}',
      '.ag-editor-chrome-dock-sentinel{display:block;height:1px;margin:0;padding:0;pointer-events:none}',
      '.ag-editor-audio-row{display:none;box-sizing:border-box;width:100%;max-width:100%;margin:0}',
      '.ag-editor-audio-row.is-open{display:block;padding:4px 0 8px}',
      '.agilo-audio-sticky{display:none;align-items:center;gap:8px;flex-wrap:nowrap;position:relative;',
      'box-sizing:border-box;padding:6px 10px;width:100%;max-width:100%;',
      'background:#fff;border:1px solid rgba(23,74,150,.18);border-radius:8px;',
      'font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#262626}',
      '.ag-editor-audio-row.is-open .agilo-audio-sticky{display:flex}',
      '.agilo-audio-sticky.is-disabled{opacity:.6;pointer-events:none}',
      '.agilo-audio-sticky__btn{flex:0 0 auto;height:2rem;min-width:2rem;padding:0 .55rem;',
      'border-radius:6px;border:1px solid rgba(52,58,64,.18);background:#fff;color:#174a96;',
      'cursor:pointer;font:600 12px/1 inherit}',
      '.agilo-audio-sticky__btn:hover{background:rgba(23,74,150,.06)}',
      '.agilo-audio-sticky__btn.is-primary,.agilo-audio-sticky__btn.is-on{background:#174a96;border-color:#174a96;color:#fff}',
      '.agilo-audio-sticky__btn:focus-visible{outline:2px solid rgba(23,74,150,.55);outline-offset:2px}',
      '.agilo-audio-sticky__ico{display:none}',
      '#agilo-transcript-follow{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;',
      'width:auto;max-width:none}',
      '.agilo-audio-sticky__follow-label{display:inline}',
      '.agilo-audio-sticky__follow-hint{display:none;position:absolute;left:0;top:calc(100% + 6px);',
      'z-index:24;width:max-content;max-width:16rem;padding:8px 10px;border-radius:6px;',
      'background:#174a96;color:#fff;font:500 12px/1.35 system-ui,sans-serif;',
      'box-shadow:0 8px 20px rgba(15,23,42,.18);pointer-events:none;white-space:normal;text-align:left}',
      '#agilo-transcript-follow:hover .agilo-audio-sticky__follow-hint,',
      '#agilo-transcript-follow:focus-visible .agilo-audio-sticky__follow-hint{display:block}',
      '#agilo-audio-wrap #agilo-transcript-follow{align-self:center;margin:0 0 0 8px;vertical-align:middle}',
      '#ag-editor-chrome-dock>#agilo-transcript-follow{margin:4px 10px 8px;align-self:flex-start}',
      '.agilo-audio-sticky__track{flex:1 1 80px;position:relative;height:.42rem;min-width:0;',
      'border-radius:999px;background:rgba(2,2,2,.10);cursor:pointer}',
      '.agilo-audio-sticky__progress{position:absolute;inset:0 auto 0 0;height:100%;width:0%;',
      'border-radius:inherit;background:#174a96;pointer-events:none}',
      '.agilo-audio-sticky__time{flex:0 0 auto;font:600 11px/1 system-ui,sans-serif;color:#525252;',
      'white-space:nowrap;min-width:5.5rem;text-align:right}',
      '@media (max-width:40rem){',
      '.agilo-audio-sticky{gap:6px;padding:6px 8px}',
      '.agilo-audio-sticky__txt{display:none}',
      '.agilo-audio-sticky__ico{display:inline}',
      '.agilo-audio-sticky__btn[data-act="back"],.agilo-audio-sticky__btn[data-act="fwd"]{',
      'min-width:2rem;padding:0 .35rem}',
      '.agilo-audio-sticky__follow-label{display:inline}',
      '.agilo-audio-sticky__time{min-width:4.5rem;font-size:10px}',
      '}',
      '#agilo-audio-delete{display:inline-flex;align-items:center;justify-content:center;padding:0 .45rem}',
      '#agilo-audio-delete svg{display:block;width:14px;height:14px}',
      '#agilo-audio-delete:disabled{opacity:.55;cursor:default}',
      '#agilo-audio-delete-panel{position:absolute;z-index:30;top:calc(100% + 6px);right:0;width:16rem;',
      'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;padding:8px 10px;',
      'background:#fff;border:1px solid rgba(23,74,150,.18);border-radius:8px;',
      'box-shadow:0 10px 26px rgba(15,23,42,.16)}',
      '#agilo-audio-delete-panel[hidden]{display:none}',
      '#agilo-audio-delete-panel p{margin:0;flex:1 1 12rem;font:500 12px/1.35 system-ui,sans-serif;color:#262626}',
      '#agilo-audio-delete-panel button{height:2rem;padding:0 .7rem;border-radius:6px;border:1px solid rgba(52,58,64,.18);',
      'background:#fff;color:#174a96;cursor:pointer;font:600 12px/1 inherit}',
      '#agilo-audio-delete-panel button[data-del="confirm"]{background:#9f1239;border-color:#9f1239;color:#fff}',
      '#agilo-audio-delete-panel button:disabled{opacity:.55;cursor:default}',
      '#agilo-audio-delete-panel .agilo-audio-delete-error{flex:1 1 100%;color:#9f1239}',
      '@media (prefers-reduced-motion:reduce){',
      '.ag-editor-audio-row,.agilo-audio-sticky,.ag-editor-chrome-dock{transition:none}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  function clearLegacyVars() {
    if (!ROOT || !ROOT.style) return;
    ROOT.style.removeProperty('--ag-editor-chrome-top');
    ROOT.style.removeProperty('--ag-editor-audio-dock-height');
    if (ROOT.classList) {
      ROOT.classList.remove('ag-editor-shell-fit');
      ROOT.classList.remove('ag-editor-shell-lock');
    }
  }

  function removeLegacyHosts() {
    var oldSlot = document.getElementById(LEGACY_SLOT_ID);
    if (oldSlot && oldSlot !== row) oldSlot.remove();
    var oldPin = document.getElementById(LEGACY_PIN_ID);
    if (oldPin) oldPin.remove();
    var chip = document.getElementById('ag-confidence-chip-host');
    if (chip) chip.remove();
  }

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var h = (s / 3600) | 0;
    var m = ((s % 3600) / 60) | 0;
    var sec = (s % 60) | 0;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    var ss = String(sec).padStart(2, '0');
    return h ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
  }

  function getAudio() {
    return document.getElementById('agilo-audio');
  }

  function getWrap() {
    return document.getElementById('agilo-audio-wrap');
  }

  function getDuration(audio) {
    var d1 = Number.isFinite(audio && audio.duration) ? audio.duration : 0;
    var dur = (d1 > 0 && d1 < 1e6) ? d1 : 0;
    var expected = window.__agiloExpectedDuration || 0;
    if (expected > 0 && dur > expected * 1.5) return expected * 1.1;
    if (dur > 21600) return expected > 0 ? expected * 1.1 : 0;
    return dur || expected;
  }

  function isAudioUnavailable(wrap) {
    if (!wrap) return true;
    if (wrap.dataset && wrap.dataset.audioUnavailable) return true;
    var note = wrap.querySelector('.agilo-audio-unavailable');
    if (!note) return false;
    try {
      return getComputedStyle(note).display !== 'none';
    } catch (e) {
      return note.style.display !== 'none';
    }
  }

  function isLocked(wrap) {
    return !!(wrap && wrap.classList.contains('is-locked'));
  }

  function setWrapInert(on) {
    var wrap = getWrap();
    if (!wrap) return;
    wrapInert = !!on;
    if (on) {
      wrap.setAttribute('inert', '');
      wrap.setAttribute('aria-hidden', 'true');
    } else {
      wrap.removeAttribute('inert');
      wrap.removeAttribute('aria-hidden');
    }
  }

  function withWrapInteractive(fn) {
    var wrap = getWrap();
    var had = !!(wrap && wrap.hasAttribute('inert'));
    if (had) wrap.removeAttribute('inert');
    try {
      return fn();
    } finally {
      if (had && wrapInert) wrap.setAttribute('inert', '');
    }
  }

  function proxyClick(id) {
    withWrapInteractive(function () {
      var el = document.getElementById(id);
      if (el && typeof el.click === 'function') el.click();
    });
  }

  function toggleFollow() {
    var follow = window.AgiloTranscriptFollow;
    if (!follow) return;
    if (follow.armed) follow.disarm();
    else follow.arm();
  }

  function syncFollow(armed) {
    var btn = ensureFollowBtn();
    if (!btn) return;
    if (typeof armed !== 'boolean') {
      armed = window.AgiloTranscriptFollow ? !!window.AgiloTranscriptFollow.armed : true;
    }
    btn.classList.toggle('is-on', armed);
    btn.setAttribute('aria-pressed', String(armed));
  }

  function ensureFollowBtn() {
    var btn = document.getElementById(FOLLOW_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = FOLLOW_BTN_ID;
      btn.className = 'agilo-audio-sticky__btn is-on';
      btn.setAttribute('data-act', 'follow');
      btn.setAttribute('aria-label', 'Suivre la lecture : l\'écran suit l\'audio');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-describedby', FOLLOW_HINT_ID);
      var label = document.createElement('span');
      label.className = 'agilo-audio-sticky__follow-label';
      label.textContent = 'Suivre';
      var hint = document.createElement('span');
      hint.id = FOLLOW_HINT_ID;
      hint.className = 'agilo-audio-sticky__follow-hint';
      hint.setAttribute('role', 'tooltip');
      hint.textContent = FOLLOW_HINT_TEXT;
      btn.appendChild(label);
      btn.appendChild(hint);
    }
    if (!btn.__agiloFollowBound) {
      btn.__agiloFollowBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleFollow();
      });
    }
    return btn;
  }

  function readMemberEmail() {
    var byName = document.querySelector('[name="memberEmail"]');
    if (byName && byName.value) return byName.value.trim();
    var byId = document.getElementById('memberEmail');
    if (byId && byId.value) return byId.value.trim();
    var byText = document.querySelector('[data-ms-member="email"]');
    if (byText) {
      var txt = (byText.value || byText.getAttribute('src') || byText.textContent || '').trim();
      if (txt) return txt;
    }
    var fromWindow = (window.memberEmail || '').trim();
    if (fromWindow) return fromWindow;
    try { return (localStorage.getItem('agilo:username') || '').trim(); } catch (e) { return ''; }
  }

  function readMemberToken() {
    var fromWindow = '';
    if (typeof window.globalToken === 'string') fromWindow = window.globalToken.trim();
    else if (window.globalToken) fromWindow = String(window.globalToken).trim();
    if (fromWindow) return fromWindow;
    try {
      if (typeof globalToken !== 'undefined' && globalToken) return String(globalToken).trim();
    } catch (e) {}
    return '';
  }

  function normalizeEdition(v) {
    var s = String(v || '').trim().toLowerCase();
    if (s === 'ent' || s === 'enterprise' || s === 'entreprise' || s === 'business' || s === 'team' || s === 'biz') return 'ent';
    if (s.indexOf('pro') === 0) return 'pro';
    if (s.indexOf('free') === 0 || s === 'gratuit') return 'free';
    return s || 'pro';
  }

  function readEdition() {
    var path = (location && location.pathname) || '';
    if (/\/app\/business(\/|$)/i.test(path)) return 'ent';
    var editorRoot = document.getElementById('editorRoot');
    if (editorRoot && editorRoot.dataset && editorRoot.dataset.edition) return normalizeEdition(editorRoot.dataset.edition);
    var editionBadge = document.getElementById('edition');
    if (editionBadge && editionBadge.textContent) return normalizeEdition(editionBadge.textContent);
    try {
      var p = new URLSearchParams(location.search || '');
      if (p.get('edition')) return normalizeEdition(p.get('edition'));
      return normalizeEdition(localStorage.getItem('agilo:edition') || 'pro');
    } catch (e) {
      return 'pro';
    }
  }

  function readJobId() {
    try {
      var p = new URLSearchParams(location.search || '');
      if (p.get('jobId')) return p.get('jobId');
    } catch (e) {}
    var wrap = getWrap();
    if (wrap && wrap.dataset && wrap.dataset.jobId) return wrap.dataset.jobId;
    var editorRoot = document.getElementById('editorRoot');
    if (editorRoot && editorRoot.dataset && editorRoot.dataset.jobId) return editorRoot.dataset.jobId;
    return '';
  }

  function currentDeleteOffer() {
    var wrap = getWrap();
    return canOfferDeleteAudio({
      path: (location && location.pathname) || '',
      token: readMemberToken(),
      jobId: readJobId(),
      audioUnavailable: !!(wrap && wrap.dataset && wrap.dataset.audioUnavailable)
    });
  }

  function trashIconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/></svg>';
  }

  var deleteInFlight = false;

  function ensureDeletePanel() {
    var panel = document.getElementById(DELETE_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = DELETE_PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Confirmer la suppression du fichier audio');
    panel.innerHTML = '<p>Supprimer le fichier audio ? La transcription reste.</p>'
      + '<button type="button" data-del="cancel">Annuler</button>'
      + '<button type="button" data-del="confirm">Supprimer</button>'
      + '<p class="agilo-audio-delete-error" hidden></p>';
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      var t = e.target && e.target.closest ? e.target.closest('[data-del]') : null;
      if (!t) return;
      if (t.getAttribute('data-del') === 'cancel') closeDeletePanel();
      else submitDeleteAudio();
    });
    return panel;
  }

  function closeDeletePanel() {
    var panel = document.getElementById(DELETE_PANEL_ID);
    if (!panel) return;
    panel.hidden = true;
    var err = panel.querySelector('.agilo-audio-delete-error');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
  }

  function openDeletePanel() {
    var panel = ensureDeletePanel();
    var btn = document.getElementById(DELETE_BTN_ID);
    if (btn && btn.parentNode && panel.previousElementSibling !== btn) {
      btn.insertAdjacentElement('afterend', panel);
    }
    panel.hidden = false;
  }

  function showDeleteError(message) {
    var panel = ensureDeletePanel();
    panel.hidden = false;
    var err = panel.querySelector('.agilo-audio-delete-error');
    if (!err) return;
    err.hidden = false;
    err.textContent = message || 'Suppression impossible.';
  }

  function setDeleteBusy(busy) {
    var btn = document.getElementById(DELETE_BTN_ID);
    var panel = document.getElementById(DELETE_PANEL_ID);
    if (btn) btn.disabled = !!busy;
    if (!panel) return;
    var nodes = panel.querySelectorAll('button');
    for (var i = 0; i < nodes.length; i++) nodes[i].disabled = !!busy;
  }

  function applyDeletedAudio(jobId) {
    var audio = getAudio();
    if (audio) {
      try { audio.pause(); } catch (e) {}
      try {
        var src = audio.currentSrc || audio.src || '';
        if (String(src).indexOf('blob:') === 0 && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          URL.revokeObjectURL(src);
        }
      } catch (e2) {}
      try {
        audio.removeAttribute('src');
        if (typeof audio.load === 'function') audio.load();
      } catch (e3) {}
    }
    var wrap = getWrap();
    if (wrap && wrap.dataset) wrap.dataset.audioUnavailable = 'audio_deleted';
    try {
      window.dispatchEvent(new CustomEvent('agilo:audioUnavailable', {
        detail: {
          jobId: jobId,
          code: 'audio_deleted',
          message: 'Le fichier audio a été supprimé.'
        }
      }));
    } catch (e4) {}
    var dl = document.getElementById('agilo-download');
    if (dl) {
      dl.style.display = 'none';
      dl.removeAttribute('href');
    }
    closeDeletePanel();
    placeFollowControl();
  }

  function submitDeleteAudio() {
    if (deleteInFlight) return;
    if (!currentDeleteOffer()) return;
    var jobId = readJobId();
    var email = readMemberEmail();
    var token = readMemberToken();
    if (!email || !token || !jobId) {
      showDeleteError('Session incomplète. Rechargez la page.');
      return;
    }
    deleteInFlight = true;
    setDeleteBusy(true);
    var url = apiBaseForHost(location.hostname)
      + '/apiDeleteAudioJob?username=' + encodeURIComponent(email)
      + '&token=' + encodeURIComponent(token)
      + '&edition=' + encodeURIComponent(readEdition())
      + '&jobId=' + encodeURIComponent(jobId);
    fetch(url, { method: 'GET', credentials: 'omit' })
      .then(function (res) {
        return res.json().catch(function () { return { status: 'KO', errorMessage: 'Réponse illisible' }; });
      })
      .then(function (data) {
        if (data && data.status === 'OK') {
          applyDeletedAudio(jobId);
          return;
        }
        var msg = (data && (data.errorMessage || data.message)) || 'Suppression impossible.';
        showDeleteError(msg);
      })
      .catch(function () {
        showDeleteError('Suppression impossible. L\'audio est toujours là.');
      })
      .then(function () {
        deleteInFlight = false;
        setDeleteBusy(false);
      });
  }

  function ensureDeleteAudioBtn() {
    var btn = document.getElementById(DELETE_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = DELETE_BTN_ID;
      btn.className = 'agilo-audio-sticky__btn';
      btn.setAttribute('data-act', 'delete');
      btn.setAttribute('aria-label', 'Supprimer le fichier audio');
      btn.innerHTML = trashIconSvg();
    }
    if (!btn.__agiloDeleteBound) {
      btn.__agiloDeleteBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (deleteInFlight) return;
        var panel = document.getElementById(DELETE_PANEL_ID);
        if (panel && !panel.hidden) closeDeletePanel();
        else openDeletePanel();
      });
    }
    return btn;
  }

  function placeDeleteControl(followBtn) {
    var btn = ensureDeleteAudioBtn();
    var panel = ensureDeletePanel();
    if (!currentDeleteOffer() || !followBtn || !followBtn.parentNode) {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      return;
    }
    var host = followBtn.parentNode;
    if (host && host.style && host.id !== 'ag-editor-chrome-dock' && !String(host.className || '').includes('agilo-audio-sticky')) {
      if (!host.style.position) host.style.position = 'relative';
    }
    if (btn.previousElementSibling !== followBtn) {
      if (typeof followBtn.insertAdjacentElement === 'function') followBtn.insertAdjacentElement('afterend', btn);
      else if (followBtn.nextSibling) host.insertBefore(btn, followBtn.nextSibling);
      else host.appendChild(btn);
    }
    if (panel.parentNode !== host || panel.previousElementSibling !== btn) {
      if (typeof btn.insertAdjacentElement === 'function') btn.insertAdjacentElement('afterend', panel);
      else if (btn.nextSibling) host.insertBefore(panel, btn.nextSibling);
      else host.appendChild(panel);
    }
  }

  function placeFollowControl() {
    injectCss();
    var btn = ensureFollowBtn();
    if (!btn) return btn;
    var rowOpen = !!(row && row.classList && row.classList.contains('is-open') && bar && bar.isConnected);
    var speedInBar = bar && typeof bar.querySelector === 'function' ? bar.querySelector('[data-act="speed"]') : null;
    var trackInBar = bar && typeof bar.querySelector === 'function' ? bar.querySelector('.agilo-audio-sticky__track') : null;
    var speedLive = document.getElementById('agilo-speed');
    var hostDock = dock && dock.isConnected ? dock : document.getElementById(DOCK_ID);
    var placed = resolveFollowHost({
      rowOpen: rowOpen,
      stickyBar: bar,
      trackEl: trackInBar,
      speedEl: rowOpen ? speedInBar : speedLive,
      dock: hostDock,
      rowEl: row
    });
    if (!placed.host) return btn;
    if (placed.mode === 'wrap' && placed.after && typeof placed.after.insertAdjacentElement === 'function') {
      if (btn.previousElementSibling !== placed.after) {
        placed.after.insertAdjacentElement('afterend', btn);
      }
      syncFollow();
      placeDeleteControl(btn);
      return btn;
    }
    var before = placed.before;
    if (before && before.parentNode !== placed.host) before = null;
    if (btn.parentNode !== placed.host || (before && btn.nextElementSibling !== before && btn !== before)) {
      if (before) placed.host.insertBefore(btn, before);
      else placed.host.appendChild(btn);
    }
    syncFollow();
    placeDeleteControl(btn);
    return btn;
  }

  function bindFollowState() {
    if (window.__agiloFollowStateBound) return;
    window.__agiloFollowStateBound = true;
    document.addEventListener('agilo:transcript-follow', function (e) {
      var armed = e && e.detail && typeof e.detail.armed === 'boolean'
        ? e.detail.armed
        : undefined;
      syncFollow(armed);
    });
    var tries = 0;
    function poll() {
      placeFollowControl();
      syncFollow();
      if (window.AgiloTranscriptFollow || tries > 20) return;
      tries += 1;
      window.setTimeout(poll, 100);
    }
    poll();
  }

  function ensureChromeDock() {
    injectCss();
    removeLegacyHosts();
    if (dock && dock.isConnected) {
      placeChromeDock(dock, document);
      ensureSentinel();
      return dock;
    }
    dock = document.getElementById(DOCK_ID);
    if (!dock) {
      dock = document.createElement('div');
      dock.id = DOCK_ID;
    }
    dock.className = 'ag-editor-chrome-dock';
    if (!placeChromeDock(dock, document) && !dock.parentNode) return dock;
    ensureSentinel();
    return dock;
  }

  function ensureSentinel() {
    if (!dock || !dock.parentNode) return null;
    var prev = dock.previousElementSibling;
    if (prev && String(prev.className || '').indexOf(SENTINEL_CLASS) >= 0) {
      sentinel = prev;
      return sentinel;
    }
    sentinel = document.createElement('span');
    sentinel.className = SENTINEL_CLASS;
    dock.parentNode.insertBefore(sentinel, dock);
    return sentinel;
  }

  function ensureRow() {
    var host = ensureChromeDock();
    if (row && row.isConnected) {
      if (row.parentNode !== host) host.appendChild(row);
      return row;
    }
    row = document.getElementById(ROW_ID);
    if (!row) {
      row = document.createElement('div');
      row.id = ROW_ID;
    }
    row.className = 'ag-editor-audio-row';
    row.setAttribute('aria-hidden', 'true');
    if (row.parentNode !== host) host.appendChild(row);
    return row;
  }

  function ensureBar() {
    var host = ensureRow();
    if (bar && bar.isConnected) return bar;
    injectCss();
    bar = document.createElement('div');
    bar.id = 'agilo-audio-sticky';
    bar.className = 'agilo-audio-sticky';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Lecture audio');
    bar.innerHTML = [
      '<button type="button" class="agilo-audio-sticky__btn" data-act="back" aria-label="Reculer de 10 secondes">',
      '<span class="agilo-audio-sticky__txt">10s</span><span class="agilo-audio-sticky__ico" aria-hidden="true">‹‹</span>',
      '</button>',
      '<button type="button" class="agilo-audio-sticky__btn is-primary" data-act="play" aria-pressed="false" aria-controls="agilo-audio">Lire</button>',
      '<button type="button" class="agilo-audio-sticky__btn" data-act="fwd" aria-label="Avancer de 10 secondes">',
      '<span class="agilo-audio-sticky__txt">10s</span><span class="agilo-audio-sticky__ico" aria-hidden="true">››</span>',
      '</button>',
      '<button type="button" class="agilo-audio-sticky__btn" data-act="speed" aria-label="Vitesse de lecture">1x</button>',
      '<div class="agilo-audio-sticky__track" data-act="track" role="slider" aria-label="Position de lecture" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">',
      '  <div class="agilo-audio-sticky__progress"></div>',
      '</div>',
      '<span class="agilo-audio-sticky__time">0:00 / 0:00</span>'
    ].join('');
    host.appendChild(bar);
    bindBar(bar);
    placeFollowControl();
    return bar;
  }

  function bindBar(el) {
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn || btn.getAttribute('data-act') === 'track') return;
      var act = btn.getAttribute('data-act');
      if (act === 'delete') return;
      if (act === 'play') proxyClick('agilo-play');
      else if (act === 'back') proxyClick('agilo-skip-back');
      else if (act === 'fwd') proxyClick('agilo-skip-fwd');
      else if (act === 'speed') proxyClick('agilo-speed');
      else if (act === 'follow') return;
    });

    var track = el.querySelector('[data-act="track"]');
    if (!track) return;

    var seekFromClientX = function (clientX) {
      var audio = getAudio();
      var wrap = getWrap();
      if (!audio || isLocked(wrap)) return;
      var dur = getDuration(audio);
      if (!dur) return;
      var rect = track.getBoundingClientRect();
      var p = rect.width ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
      try { audio.currentTime = p * dur; } catch (err) { /* ignore */ }
      syncFromAudio();
    };

    track.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      seekFromClientX(e.clientX);
    });
  }

  function formatRate(val) {
    var n = Number(val) || 1;
    return n.toFixed(2).replace(/\.00$|0$/, '') + 'x';
  }

  function syncFromAudio() {
    if (!bar) return;
    var audio = getAudio();
    var playBtn = bar.querySelector('[data-act="play"]');
    var speedBtn = bar.querySelector('[data-act="speed"]');
    var progress = bar.querySelector('.agilo-audio-sticky__progress');
    var timeEl = bar.querySelector('.agilo-audio-sticky__time');
    var track = bar.querySelector('[data-act="track"]');
    if (!audio) return;
    var playing = !audio.paused && !audio.ended;
    if (playBtn) {
      playBtn.textContent = playing ? 'Pause' : 'Lire';
      playBtn.setAttribute('aria-pressed', String(playing));
    }
    if (speedBtn) speedBtn.textContent = formatRate(audio.playbackRate || 1);
    var dur = getDuration(audio);
    var cur = audio.currentTime || 0;
    var pct = dur ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
    if (progress) progress.style.width = pct + '%';
    if (timeEl) timeEl.textContent = fmt(cur) + ' / ' + fmt(dur);
    if (track) {
      track.setAttribute('aria-valuemax', String(Math.round(dur || 0)));
      track.setAttribute('aria-valuenow', String(Math.round(cur)));
    }
  }

  function hideRow() {
    var host = ensureRow();
    host.classList.remove('is-open');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    setWrapInert(false);
    placeFollowControl();
  }

  function openRow() {
    var host = ensureRow();
    ensureBar();
    host.classList.add('is-open');
    host.removeAttribute('aria-hidden');
    host.removeAttribute('inert');
    if (bar) bar.classList.toggle('is-disabled', isLocked(getWrap()));
    placeFollowControl();
    setWrapInert(true);
    syncFromAudio();
  }

  function updateFloat() {
    var host = ensureChromeDock();
    var mark = sentinel || ensureSentinel();
    if (!host || !mark || typeof mark.getBoundingClientRect !== 'function') return;
    var pane = document.getElementById('pane-transcript') || host.parentElement;
    var sRect = mark.getBoundingClientRect();
    var cRect = pane && typeof pane.getBoundingClientRect === 'function'
      ? pane.getBoundingClientRect()
      : { left: 16, width: 760, bottom: 800 };
    var measuredChrome = getEditorChromeBottom(document);
    var box = computeChromeDockFloatingBox(sRect, cRect, measuredChrome, window.innerWidth, {
      tabsBottom: measuredChrome,
      paneTop: cRect.top
    });
    if (box.shouldFloat) {
      host.style.setProperty('--ag-confidence-floating-left', box.left + 'px');
      host.style.setProperty('--ag-confidence-floating-width', box.width + 'px');
      host.style.setProperty('--ag-confidence-floating-top', box.top + 'px');
      host.classList.add('is-floating');
    } else {
      host.classList.remove('is-floating');
      host.style.removeProperty('--ag-confidence-floating-left');
      host.style.removeProperty('--ag-confidence-floating-width');
      host.style.removeProperty('--ag-confidence-floating-top');
    }
  }

  function update() {
    var wrap = getWrap();
    var audio = getAudio();
    if (!wrap || !audio) hideRow();
    else {
      var unavailable = isAudioUnavailable(wrap);
      var rowState = computeAudioRowState({
        wrapIntersecting: wrapIntersecting,
        audioUnavailable: unavailable
      });
      if (!rowState.shouldShow) hideRow();
      else openRow();
    }
    updateFloat();
    placeFollowControl();
  }

  function schedule() {
    if (raf) return;
    raf = window.requestAnimationFrame(function () {
      raf = 0;
      update();
    });
  }

  function observeWrap() {
    var wrap = getWrap();
    if (!wrap || wrap === wrapObserved) return;
    if (io) {
      try { io.disconnect(); } catch (e) { /* ignore */ }
    }
    wrapObserved = wrap;
    wrapIntersecting = true;
    if (typeof IntersectionObserver !== 'function') {
      wrapIntersecting = false;
      schedule();
      return;
    }
    io = new IntersectionObserver(function (entries) {
      var entry = entries && entries[0];
      wrapIntersecting = applyIoHysteresis(wrapIntersecting, entry);
      schedule();
    }, { threshold: [0, IO_SHOW_RATIO, 1], root: null, rootMargin: IO_ROOT_MARGIN });
    io.observe(wrap);
  }

  function observePane() {
    var pane = document.getElementById('pane-transcript');
    if (!pane) return;
    if (pane === paneObserved) return;
    if (paneMo) {
      try { paneMo.disconnect(); } catch (e) { /* ignore */ }
    }
    paneObserved = pane;
    if (typeof MutationObserver !== 'function') return;
    paneMo = new MutationObserver(function () {
      ensureChromeDock();
      ensureRow();
      schedule();
    });
    paneMo.observe(pane, { childList: true });
  }

  function bindAudioEvents() {
    var audio = getAudio();
    if (!audio || audio.__agiloStickyBound) return;
    audio.__agiloStickyBound = true;
    ['play', 'pause', 'timeupdate', 'ratechange', 'ended', 'durationchange'].forEach(function (ev) {
      audio.addEventListener(ev, syncFromAudio);
    });
  }

  function bindFloatListeners() {
    if (floatBound) return;
    floatBound = true;
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    try {
      if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    } catch (e) { /* ignore */ }
  }

  function start() {
    injectCss();
    clearLegacyVars();
    ensureChromeDock();
    ensureRow();
    observePane();
    observeWrap();
    bindAudioEvents();
    bindFloatListeners();
    bindFollowState();
    if ((!getWrap() || !document.getElementById('pane-transcript')) && typeof MutationObserver === 'function') {
      var bootMo = new MutationObserver(function () {
        if (document.getElementById('pane-transcript')) observePane();
        if (!getWrap()) return;
        bootMo.disconnect();
        observeWrap();
        bindAudioEvents();
        schedule();
      });
      bootMo.observe(document.documentElement, { childList: true, subtree: true });
    }
    update();
    window.addEventListener('agilo:load', function () {
      wrapObserved = null;
      paneObserved = null;
      observePane();
      ensureChromeDock();
      ensureRow();
      observeWrap();
      bindAudioEvents();
      schedule();
    });
    var wrap = getWrap();
    if (wrap && typeof MutationObserver === 'function') {
      var mo = new MutationObserver(schedule);
      mo.observe(wrap, { attributes: true, attributeFilter: ['class', 'data-audio-unavailable'], childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
