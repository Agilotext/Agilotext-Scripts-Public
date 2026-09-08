/* ================================================================
   AGILOTEXT - Rangée audio in-flow (éditeur)
   Page : /app/{free|pro|business}/editor
   Charge : après Code-lecteur-audio-V3.4.js
   Un seul <audio id="agilo-audio">. Pas de follow-playhead.
   Pas d’overlay fixed : le slot pousse le transcript.
   ================================================================ */

(function () {
  'use strict';

  if (window.__agiloAudioSticky) return;
  window.__agiloAudioSticky = true;

  var ROOT = typeof document !== 'undefined' ? document.documentElement : null;
  var DOCK_VAR = '--ag-editor-audio-dock-height';
  var CHROME_VAR = '--ag-editor-chrome-top';
  var SLOT_ID = 'ag-editor-audio-slot';
  var IO_ROOT_MARGIN = '40px 0px 0px 0px';
  var IO_SHOW_RATIO = 0.12;

  function getEditorChromeTop(doc) {
    doc = doc || document;
    if (!doc || !doc.querySelector) return 0;
    var selectors = [
      'main.ed-main nav.ed-tabs',
      'main.ed-main [data-tour="ed-tabs"]',
      'nav.ed-tabs'
    ];
    var bottom = 0;
    for (var i = 0; i < selectors.length; i++) {
      var el = doc.querySelector(selectors[i]);
      if (!el || typeof el.getBoundingClientRect !== 'function') continue;
      var rect = el.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.bottom) || rect.height <= 0) continue;
      if (rect.bottom <= 0) continue;
      bottom = Math.max(bottom, rect.bottom);
    }
    return Math.max(0, bottom);
  }

  function computeAudioSlotState(opts) {
    opts = opts || {};
    var wrapIntersecting = !!opts.wrapIntersecting;
    var tabOk = opts.transcriptTabActive !== false;
    var unavailable = !!opts.audioUnavailable;
    var chromeTop = Math.max(0, Number(opts.chromeTop) || 0);
    return {
      shouldShow: !wrapIntersecting && tabOk && !unavailable,
      chromeTop: chromeTop
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

  window.AgiloAudioSticky = {
    computeAudioSlotState: computeAudioSlotState,
    getEditorChromeTop: getEditorChromeTop,
    applyIoHysteresis: applyIoHysteresis,
    SLOT_ID: SLOT_ID,
    IO_ROOT_MARGIN: IO_ROOT_MARGIN,
    IO_SHOW_RATIO: IO_SHOW_RATIO
  };

  if (window.AGILO_AUDIO_STICKY_SKIP_BOOT) return;
  if (typeof document === 'undefined') return;

  var slot = null;
  var bar = null;
  var wrapObserved = null;
  var io = null;
  var wrapIntersecting = true;
  var wrapInert = false;
  var raf = 0;
  var lastDockHeight = -1;
  var lastChromeTop = -1;

  function injectCss() {
    if (document.getElementById('agilo-audio-sticky-css')) return;
    var s = document.createElement('style');
    s.id = 'agilo-audio-sticky-css';
    s.textContent = [
      '.ag-editor-audio-slot{display:block;height:0;overflow:hidden;margin:0;padding:0;',
      'position:sticky;top:var(--ag-editor-chrome-top,0px);z-index:4;box-sizing:border-box;',
      'max-width:100%;pointer-events:none}',
      '.ag-editor-audio-slot.is-open{height:auto;overflow:visible;margin:0 0 8px;pointer-events:auto}',
      '.agilo-audio-sticky{display:none;align-items:center;gap:8px;flex-wrap:nowrap;',
      'box-sizing:border-box;padding:6px 10px;width:100%;max-width:100%;',
      'background:#fff;border:1px solid rgba(23,74,150,.18);border-radius:8px;',
      'font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#262626}',
      '.ag-editor-audio-slot.is-open .agilo-audio-sticky{display:flex}',
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
      '.ag-editor-audio-slot,.agilo-audio-sticky{transition:none}',
      '}'
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

  function setChromeTop(px) {
    if (!ROOT || !ROOT.style) return;
    var n = Math.max(0, Number(px) || 0);
    if (n === lastChromeTop) return;
    lastChromeTop = n;
    if (n <= 0) ROOT.style.removeProperty(CHROME_VAR);
    else ROOT.style.setProperty(CHROME_VAR, n + 'px');
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

  function findSlotAnchor() {
    var pane = document.getElementById('pane-transcript');
    var toolbar = document.querySelector('main.ed-main .ed-toolbar, .ed-toolbar');
    return { pane: pane, toolbar: toolbar };
  }

  function ensureSlot() {
    if (slot && slot.isConnected) return slot;
    injectCss();
    slot = document.getElementById(SLOT_ID);
    if (!slot) {
      slot = document.createElement('div');
      slot.id = SLOT_ID;
    }
    slot.className = 'ag-editor-audio-slot';
    slot.setAttribute('aria-hidden', 'true');
    var anchor = findSlotAnchor();
    if (anchor.pane) {
      if (slot.parentNode !== anchor.pane) {
        anchor.pane.insertBefore(slot, anchor.pane.firstChild);
      }
    } else if (anchor.toolbar && anchor.toolbar.parentNode) {
      if (slot.parentNode !== anchor.toolbar.parentNode) {
        anchor.toolbar.parentNode.insertBefore(slot, anchor.toolbar.nextSibling);
      }
    } else if (!slot.parentNode) {
      document.body.appendChild(slot);
    }
    return slot;
  }

  function ensureBar() {
    var host = ensureSlot();
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

  function hideSlot() {
    var host = ensureSlot();
    host.classList.remove('is-open');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    setWrapInert(false);
    setDockHeight(0);
  }

  function openSlot() {
    var host = ensureSlot();
    ensureBar();
    host.classList.add('is-open');
    host.removeAttribute('aria-hidden');
    host.removeAttribute('inert');
    if (bar) bar.classList.toggle('is-disabled', isLocked(getWrap()));
    setWrapInert(true);
    var h = (bar && bar.getBoundingClientRect().height) || host.getBoundingClientRect().height || 44;
    setDockHeight(Math.round(h));
    syncFromAudio();
  }

  function update() {
    var wrap = getWrap();
    var audio = getAudio();
    var chromeTop = getEditorChromeTop(document);
    setChromeTop(chromeTop);
    if (!wrap || !audio) {
      hideSlot();
      return;
    }
    var state = computeAudioSlotState({
      wrapIntersecting: wrapIntersecting,
      transcriptTabActive: isTranscriptTabActive(),
      audioUnavailable: isAudioUnavailable(wrap),
      chromeTop: chromeTop
    });
    if (!state.shouldShow) hideSlot();
    else openSlot();
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
    ensureSlot();
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
