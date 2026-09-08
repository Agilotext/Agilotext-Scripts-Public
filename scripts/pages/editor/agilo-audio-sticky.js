/* ================================================================
   AGILOTEXT - Mini-barre audio flottante (éditeur)
   Page : /app/{free|pro|business}/editor
   Charge : après Code-lecteur-audio-V3.4.js
   Un seul <audio id="agilo-audio">. Pas de follow-playhead.
   ================================================================ */

(function () {
  'use strict';

  if (window.__agiloAudioSticky) return;
  window.__agiloAudioSticky = true;

  var DOCK_GAP = 8;
  var ROOT = typeof document !== 'undefined' ? document.documentElement : null;
  var DOCK_VAR = '--ag-editor-audio-dock-height';

  function getEditorChromeBottom(doc) {
    doc = doc || document;
    if (!doc || !doc.querySelector) return 0;
    var selectors = [
      'main.ed-main nav.ed-tabs',
      'main.ed-main [data-tour="ed-tabs"]',
      'nav.ed-tabs',
      'main.ed-main .ed-toolbar',
      '.ed-toolbar'
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

  function computeAudioStickyBox(wrapRect, containerRect, chromeBottom, innerWidth, opts) {
    opts = opts || {};
    var safeChrome = Math.max(0, Number(chromeBottom) || 0);
    var viewportW = Number.isFinite(innerWidth) ? innerWidth : 1024;
    var cLeft = Number(containerRect && containerRect.left) || 0;
    var cWidth = Number(containerRect && containerRect.width) || 0;
    var cBottom = Number(containerRect && containerRect.bottom) || 0;
    var wrapIntersecting = !!opts.wrapIntersecting;
    var tabOk = opts.transcriptTabActive !== false;
    var unavailable = !!opts.audioUnavailable;
    var shouldShow = !wrapIntersecting
      && tabOk
      && !unavailable
      && safeChrome > 0
      && cBottom > safeChrome + 40;
    if (!shouldShow) {
      return { shouldShow: false, left: 0, width: 0, top: 0, chromeBottom: safeChrome };
    }
    return {
      shouldShow: true,
      left: Math.max(12, cLeft),
      width: Math.max(260, Math.min(cWidth || 260, viewportW - 24)),
      top: safeChrome + DOCK_GAP,
      chromeBottom: safeChrome
    };
  }

  window.AgiloAudioSticky = {
    computeAudioStickyBox: computeAudioStickyBox,
    getEditorChromeBottom: getEditorChromeBottom,
    DOCK_GAP: DOCK_GAP
  };

  if (window.AGILO_AUDIO_STICKY_SKIP_BOOT) return;
  if (typeof document === 'undefined') return;

  var bar = null;
  var wrapObserved = null;
  var io = null;
  var wrapIntersecting = true;
  var wrapInert = false;
  var raf = 0;
  var lastDockHeight = -1;

  function injectCss() {
    if (document.getElementById('agilo-audio-sticky-css')) return;
    var s = document.createElement('style');
    s.id = 'agilo-audio-sticky-css';
    s.textContent = [
      '.agilo-audio-sticky{display:none;align-items:center;gap:8px;flex-wrap:nowrap;',
      'position:fixed;z-index:26;box-sizing:border-box;padding:6px 10px;',
      'background:rgba(248,249,250,.96);border:1px solid rgba(23,74,150,.20);',
      'border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.16);',
      'backdrop-filter:blur(8px);font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial;',
      'color:#262626;max-width:calc(100vw - 24px)}',
      '.agilo-audio-sticky.is-visible{display:flex}',
      '.agilo-audio-sticky.is-disabled{opacity:.6;pointer-events:none}',
      '.agilo-audio-sticky__btn{flex:0 0 auto;height:2rem;min-width:2rem;padding:0 .55rem;',
      'border-radius:6px;border:1px solid rgba(52,58,64,.18);background:#fff;color:#174a96;',
      'cursor:pointer;font:600 12px/1 inherit}',
      '.agilo-audio-sticky__btn:hover{background:rgba(23,74,150,.06)}',
      '.agilo-audio-sticky__btn.is-primary{background:#174a96;border-color:#174a96;color:#fff}',
      '.agilo-audio-sticky__btn:focus-visible{outline:2px solid rgba(23,74,150,.55);outline-offset:2px}',
      '.agilo-audio-sticky__track{flex:1 1 120px;position:relative;height:.42rem;min-width:72px;',
      'border-radius:999px;background:rgba(2,2,2,.10);cursor:pointer}',
      '.agilo-audio-sticky__progress{position:absolute;inset:0 auto 0 0;height:100%;width:0%;',
      'border-radius:inherit;background:#174a96;pointer-events:none}',
      '.agilo-audio-sticky__time{flex:0 0 auto;font:600 11px/1 system-ui,sans-serif;color:#525252;',
      'white-space:nowrap;min-width:5.5rem;text-align:right}',
      '@media (max-width:40rem){.agilo-audio-sticky__btn[data-act="back"],',
      '.agilo-audio-sticky__btn[data-act="fwd"]{min-width:2rem;padding:0 .35rem}}',
      '@media (prefers-reduced-motion:reduce){.agilo-audio-sticky{transition:none}}'
    ].join('');
    document.head.appendChild(s);
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

  function isTranscriptTabActive() {
    var pane = document.getElementById('pane-transcript');
    if (pane) {
      if (pane.classList.contains('is-active')) return true;
      if (pane.hasAttribute('hidden')) return false;
      try {
        if (getComputedStyle(pane).display === 'none') return false;
      } catch (e) { /* ignore */ }
    }
    var tab = document.getElementById('tab-transcript');
    if (tab) {
      if (tab.getAttribute('aria-selected') === 'true') return true;
      if (tab.classList.contains('is-active')) return true;
      return false;
    }
    return !document.getElementById('tab-summary');
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

  function getTranscriptContainer() {
    var pane = document.getElementById('pane-transcript')
      || document.querySelector('#pane-transcript, .edtr-pane.is-active, main.ed-main');
    return pane || document.getElementById('editorRoot') || document.body;
  }

  function setDockHeight(px) {
    if (!ROOT || !ROOT.style) return;
    var n = Math.max(0, Number(px) || 0);
    if (n === lastDockHeight) return;
    lastDockHeight = n;
    if (n <= 0) ROOT.style.removeProperty(DOCK_VAR);
    else ROOT.style.setProperty(DOCK_VAR, n + 'px');
    try {
      window.dispatchEvent(new CustomEvent('agilo:audio-dock-change', { detail: { height: n } }));
    } catch (e) { /* ignore */ }
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

  function ensureBar() {
    if (bar && bar.isConnected) return bar;
    injectCss();
    bar = document.createElement('div');
    bar.id = 'agilo-audio-sticky';
    bar.className = 'agilo-audio-sticky';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Lecture audio');
    bar.innerHTML = [
      '<button type="button" class="agilo-audio-sticky__btn" data-act="back" aria-label="Reculer de 15 secondes">15s</button>',
      '<button type="button" class="agilo-audio-sticky__btn is-primary" data-act="play" aria-pressed="false" aria-controls="agilo-audio">Lire</button>',
      '<button type="button" class="agilo-audio-sticky__btn" data-act="fwd" aria-label="Avancer de 30 secondes">30s</button>',
      '<button type="button" class="agilo-audio-sticky__btn" data-act="speed" aria-label="Vitesse de lecture">1x</button>',
      '<div class="agilo-audio-sticky__track" data-act="track" role="slider" aria-label="Position de lecture" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">',
      '  <div class="agilo-audio-sticky__progress"></div>',
      '</div>',
      '<span class="agilo-audio-sticky__time">0:00 / 0:00</span>'
    ].join('');
    document.body.appendChild(bar);
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

  function hideBar() {
    if (bar) bar.classList.remove('is-visible');
    setWrapInert(false);
    setDockHeight(0);
  }

  function applyBox(box) {
    var el = ensureBar();
    el.style.left = box.left + 'px';
    el.style.width = box.width + 'px';
    el.style.top = box.top + 'px';
    el.classList.toggle('is-disabled', isLocked(getWrap()));
    el.classList.add('is-visible');
    setWrapInert(true);
    var h = el.getBoundingClientRect().height || 44;
    setDockHeight(Math.round(h));
    syncFromAudio();
  }

  function update() {
    var wrap = getWrap();
    var audio = getAudio();
    if (!wrap || !audio) {
      hideBar();
      return;
    }
    var container = getTranscriptContainer();
    var box = computeAudioStickyBox(
      wrap.getBoundingClientRect(),
      container.getBoundingClientRect(),
      getEditorChromeBottom(document),
      window.innerWidth,
      {
        wrapIntersecting: wrapIntersecting,
        transcriptTabActive: isTranscriptTabActive(),
        audioUnavailable: isAudioUnavailable(wrap)
      }
    );
    if (!box.shouldShow) hideBar();
    else applyBox(box);
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
      wrapIntersecting = !!(entry && entry.isIntersecting);
      schedule();
    }, { threshold: 0, root: null });
    io.observe(wrap);
  }

  function bindAudioEvents() {
    var audio = getAudio();
    if (!audio || audio.__agiloStickyBound) return;
    audio.__agiloStickyBound = true;
    ['play', 'pause', 'timeupdate', 'ratechange', 'ended', 'durationchange'].forEach(function (ev) {
      audio.addEventListener(ev, syncFromAudio);
    });
  }

  function start() {
    injectCss();
    observeWrap();
    bindAudioEvents();
    if (!getWrap() && typeof MutationObserver === 'function') {
      var bootMo = new MutationObserver(function () {
        if (!getWrap()) return;
        bootMo.disconnect();
        observeWrap();
        bindAudioEvents();
        schedule();
      });
      bootMo.observe(document.documentElement, { childList: true, subtree: true });
    }
    update();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    try {
      if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    } catch (e) { /* ignore */ }
    window.addEventListener('agilo:load', function () {
      wrapObserved = null;
      observeWrap();
      bindAudioEvents();
      schedule();
    });
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('#tab-transcript, #tab-summary, #tab-chat, [data-tab], nav.ed-tabs button, nav.ed-tabs a');
      if (t) schedule();
    }, true);
    var wrap = getWrap();
    if (wrap && typeof MutationObserver === 'function') {
      var mo = new MutationObserver(schedule);
      mo.observe(wrap, { attributes: true, attributeFilter: ['class', 'data-audio-unavailable'], childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
