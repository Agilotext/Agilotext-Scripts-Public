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
    DOCK_ID: DOCK_ID,
    ROW_ID: ROW_ID,
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
      '-webkit-backdrop-filter:blur(20px) saturate(180%);border-radius:8px}',
      '.ag-editor-chrome-dock.is-floating{position:fixed;',
      'top:var(--ag-confidence-floating-top,8px);',
      'left:var(--ag-confidence-floating-left,16px);',
      'width:var(--ag-confidence-floating-width,min(760px,calc(100vw - 32px)));',
      'max-width:calc(100vw - 32px);z-index:25;',
      'box-shadow:0 10px 26px rgba(15,23,42,.16)}',
      '.ag-editor-chrome-dock:has(.ag-confidence-panel.is-disabled){',
      'background:rgba(241,245,249,.78)}',
      '.ag-editor-chrome-dock-sentinel{display:block;height:1px;margin:0;padding:0;pointer-events:none}',
      '.ag-editor-audio-row{display:none;box-sizing:border-box;width:100%;max-width:100%;margin:0}',
      '.ag-editor-audio-row.is-open{display:block;padding:4px 0 8px}',
      '.agilo-audio-sticky{display:none;align-items:center;gap:8px;flex-wrap:nowrap;',
      'box-sizing:border-box;padding:6px 10px;width:100%;max-width:100%;',
      'background:#fff;border:1px solid rgba(23,74,150,.18);border-radius:8px;',
      'font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#262626}',
      '.ag-editor-audio-row.is-open .agilo-audio-sticky{display:flex}',
      '.agilo-audio-sticky.is-disabled{opacity:.6;pointer-events:none}',
      '.agilo-audio-sticky__btn{flex:0 0 auto;height:2rem;min-width:2rem;padding:0 .55rem;',
      'border-radius:6px;border:1px solid rgba(52,58,64,.18);background:#fff;color:#174a96;',
      'cursor:pointer;font:600 12px/1 inherit}',
      '.agilo-audio-sticky__btn:hover{background:rgba(23,74,150,.06)}',
      '.agilo-audio-sticky__btn.is-primary{background:#174a96;border-color:#174a96;color:#fff}',
      '.agilo-audio-sticky__btn:focus-visible{outline:2px solid rgba(23,74,150,.55);outline-offset:2px}',
      '.agilo-audio-sticky__ico{display:none}',
      '.agilo-audio-sticky__track{flex:1 1 120px;position:relative;height:.42rem;min-width:72px;',
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
      '.agilo-audio-sticky__time{min-width:4.5rem;font-size:10px}',
      '}',
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
      '<button type="button" class="agilo-audio-sticky__btn" data-act="back" aria-label="Reculer de 15 secondes">',
      '<span class="agilo-audio-sticky__txt">15s</span><span class="agilo-audio-sticky__ico" aria-hidden="true">‹‹</span>',
      '</button>',
      '<button type="button" class="agilo-audio-sticky__btn is-primary" data-act="play" aria-pressed="false" aria-controls="agilo-audio">Lire</button>',
      '<button type="button" class="agilo-audio-sticky__btn" data-act="fwd" aria-label="Avancer de 30 secondes">',
      '<span class="agilo-audio-sticky__txt">30s</span><span class="agilo-audio-sticky__ico" aria-hidden="true">››</span>',
      '</button>',
      '<button type="button" class="agilo-audio-sticky__btn" data-act="speed" aria-label="Vitesse de lecture">1x</button>',
      '<div class="agilo-audio-sticky__track" data-act="track" role="slider" aria-label="Position de lecture" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">',
      '  <div class="agilo-audio-sticky__progress"></div>',
      '</div>',
      '<span class="agilo-audio-sticky__time">0:00 / 0:00</span>'
    ].join('');
    host.appendChild(bar);
    bindBar(bar);
    return bar;
  }

  function bindBar(el) {
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn || btn.getAttribute('data-act') === 'track') return;
      var act = btn.getAttribute('data-act');
      if (act === 'play') proxyClick('agilo-play');
      else if (act === 'back') proxyClick('agilo-skip-back');
      else if (act === 'fwd') proxyClick('agilo-skip-fwd');
      else if (act === 'speed') proxyClick('agilo-speed');
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
  }

  function openRow() {
    var host = ensureRow();
    ensureBar();
    host.classList.add('is-open');
    host.removeAttribute('aria-hidden');
    host.removeAttribute('inert');
    if (bar) bar.classList.toggle('is-disabled', isLocked(getWrap()));
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
