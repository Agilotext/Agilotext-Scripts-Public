/* ================================================================
   AGILOTEXT - Rangée audio in-flow (éditeur)
   Page : /app/{free|pro|business}/editor
   Charge : après Code-lecteur-audio-V3.4.js
   Un seul <audio id="agilo-audio">. Pas de follow-playhead.
   Pin-host in-flow. Pas de lock html, pas d’overlay.
   ================================================================ */

(function () {
  'use strict';

  if (window.__agiloAudioSticky) return;
  window.__agiloAudioSticky = true;

  var ROOT = typeof document !== 'undefined' ? document.documentElement : null;
  var PIN_HOST_ID = 'ag-editor-pin-host';
  var ROW_ID = 'ag-editor-audio-row';
  var LEGACY_SLOT_ID = 'ag-editor-audio-slot';
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

  function placePinHost(host, doc) {
    doc = doc || document;
    if (!host || !doc || typeof doc.querySelector !== 'function') return false;
    var main = doc.querySelector('main.ed-main');
    if (main) {
      var pane = typeof main.querySelector === 'function' ? main.querySelector('.edtr-pane') : null;
      if (pane) {
        if (host.parentNode === main && host.nextElementSibling === pane) return true;
        main.insertBefore(host, pane);
        return true;
      }
      if (host.parentNode !== main) {
        if (typeof main.appendChild === 'function') main.appendChild(host);
        else main.insertBefore(host, null);
      }
      return true;
    }
    var fallbackPane = typeof doc.getElementById === 'function'
      ? doc.getElementById('pane-transcript')
      : null;
    if (fallbackPane) {
      if (host.parentNode !== fallbackPane) {
        fallbackPane.insertBefore(host, fallbackPane.firstChild || null);
      }
      return true;
    }
    return false;
  }

  function placeAudioRow(row, doc) {
    doc = doc || document;
    if (!row || !doc) return false;
    var pin = typeof doc.getElementById === 'function' ? doc.getElementById(PIN_HOST_ID) : null;
    if (!pin) return false;
    if (row.parentNode === pin) return true;
    if (typeof pin.appendChild === 'function') pin.appendChild(row);
    else if (typeof pin.insertBefore === 'function') pin.insertBefore(row, null);
    else return false;
    return true;
  }

  window.AgiloAudioSticky = {
    computeAudioRowState: computeAudioRowState,
    applyIoHysteresis: applyIoHysteresis,
    placePinHost: placePinHost,
    placeAudioRow: placeAudioRow,
    PIN_HOST_ID: PIN_HOST_ID,
    ROW_ID: ROW_ID,
    IO_ROOT_MARGIN: IO_ROOT_MARGIN,
    IO_SHOW_RATIO: IO_SHOW_RATIO
  };

  if (window.AGILO_AUDIO_STICKY_SKIP_BOOT) return;
  if (typeof document === 'undefined') return;

  var pinHost = null;
  var row = null;
  var bar = null;
  var wrapObserved = null;
  var mainObserved = null;
  var io = null;
  var mainMo = null;
  var wrapIntersecting = true;
  var wrapInert = false;
  var raf = 0;

  function injectCss() {
    if (document.getElementById('agilo-audio-sticky-css')) return;
    var s = document.createElement('style');
    s.id = 'agilo-audio-sticky-css';
    s.textContent = [
      '.ag-editor-pin-host{display:block;box-sizing:border-box;width:100%;max-width:100%;',
      'flex:0 0 auto;margin:0;background:#fff}',
      '.ag-editor-audio-row{display:none;box-sizing:border-box;width:100%;max-width:100%;',
      'flex:0 0 auto;margin:0}',
      '.ag-editor-audio-row.is-open{display:block;padding:6px 1.25rem 8px;',
      'background:#fff;border-bottom:1px solid rgba(23,74,150,.14)}',
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
      '.ag-editor-audio-row,.agilo-audio-sticky{transition:none}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  function clearLegacyVars() {
    if (!ROOT || !ROOT.style) return;
    ROOT.style.removeProperty('--ag-editor-chrome-top');
    ROOT.style.removeProperty('--ag-editor-audio-dock-height');
  }

  function removeLegacySlot() {
    var old = document.getElementById(LEGACY_SLOT_ID);
    if (old && old !== row) old.remove();
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

  function ensurePinHost() {
    injectCss();
    if (pinHost && pinHost.isConnected) {
      placePinHost(pinHost, document);
      return pinHost;
    }
    pinHost = document.getElementById(PIN_HOST_ID);
    if (!pinHost) {
      pinHost = document.createElement('div');
      pinHost.id = PIN_HOST_ID;
    }
    pinHost.className = 'ag-editor-pin-host';
    if (!placePinHost(pinHost, document) && !pinHost.parentNode) {
      document.body.appendChild(pinHost);
    }
    return pinHost;
  }

  function ensureRow() {
    injectCss();
    removeLegacySlot();
    var host = ensurePinHost();
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

  function update() {
    var wrap = getWrap();
    var audio = getAudio();
    if (!wrap || !audio) {
      hideRow();
      return;
    }
    var unavailable = isAudioUnavailable(wrap);
    var rowState = computeAudioRowState({
      wrapIntersecting: wrapIntersecting,
      audioUnavailable: unavailable
    });
    if (!rowState.shouldShow) hideRow();
    else openRow();
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

  function observeMain() {
    var main = document.querySelector('main.ed-main');
    if (!main) return;
    if (main === mainObserved) return;
    if (mainMo) {
      try { mainMo.disconnect(); } catch (e) { /* ignore */ }
    }
    mainObserved = main;
    if (typeof MutationObserver !== 'function') return;
    mainMo = new MutationObserver(function () {
      ensurePinHost();
      ensureRow();
      schedule();
    });
    mainMo.observe(main, { childList: true });
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
    clearLegacyVars();
    ensurePinHost();
    ensureRow();
    observeMain();
    observeWrap();
    bindAudioEvents();
    if ((!getWrap() || !document.querySelector('main.ed-main')) && typeof MutationObserver === 'function') {
      var bootMo = new MutationObserver(function () {
        if (document.querySelector('main.ed-main')) observeMain();
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
      observeMain();
      ensurePinHost();
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
