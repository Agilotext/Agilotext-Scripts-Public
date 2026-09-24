/* ================================================================
   AGILOTEXT — Suivre l’audio + couleurs locuteurs (page /auth/share)
   Copie courte de l’éditeur. Pas de save, pas de confidence, pas de rename.
   Charge AVANT agilo-audio-sticky.js (bouton Suivre lit AgiloTranscriptFollow).
   ================================================================ */
(function (root) {
  'use strict';

  var SPK_COLORS = [
    '#174a96', '#fd7e14', '#1c661a', '#a82633',
    '#6f42c1', '#0891b2', '#b45309', '#be185d',
    '#0ea5e9', '#15803d', '#d946ef', '#854d0e',
    '#4b5563', '#4338ca', '#0f766e', '#9f1239',
    '#a16207', '#7c2d12', '#374151', '#1d4ed8'
  ];

  var activeSeg = -1;
  var boundAudio = null;
  var pauseBound = false;
  var seekBound = false;

  function createFollowController(opts) {
    var armed = true;
    var programmatic = false;
    var onChange = opts && typeof opts.onChange === 'function' ? opts.onChange : null;
    function setArmed(next) {
      var v = !!next;
      if (armed === v) return;
      armed = v;
      if (onChange) onChange(armed);
    }
    return {
      get armed() { return armed; },
      get programmatic() { return programmatic; },
      arm: function () { setArmed(true); },
      disarm: function () { if (!programmatic) setArmed(false); },
      beginProgrammatic: function () { programmatic = true; },
      endProgrammatic: function () { programmatic = false; },
      shouldScroll: function (outOfView) { return !!armed && !!outOfView; }
    };
  }

  function dispatchTranscriptFollow(armed) {
    try {
      document.dispatchEvent(new CustomEvent('agilo:transcript-follow', { detail: { armed: !!armed } }));
    } catch (_) { /* ignore */ }
  }

  var follow = createFollowController({
    onChange: function (armed) {
      dispatchTranscriptFollow(armed);
      if (armed) scrollToActive({ force: true });
    }
  });
  root.AgiloTranscriptFollow = follow;

  function getSpeakerColor(name) {
    if (!name) return '#666';
    var hash = 0;
    var i;
    for (i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return SPK_COLORS[Math.abs(hash) % SPK_COLORS.length];
  }

  function setSpeakerStyle(el, name) {
    if (!el) return;
    el.style.color = getSpeakerColor(name);
    el.style.fontWeight = '600';
  }

  function resolveActiveSegmentIndex(currentTime, segments, currentActive) {
    if (!Array.isArray(segments) || !segments.length) return -1;
    var t = Number(currentTime) || 0;
    function inSeg(s) {
      return Number.isFinite(s.start) && Number.isFinite(s.end) && t >= s.start && t < s.end;
    }
    var k = currentActive;
    if (k < 0 || !segments[k] || !inSeg(segments[k])) {
      k = -1;
      var i;
      for (i = 0; i < segments.length; i++) {
        if (inSeg(segments[i])) { k = i; break; }
      }
    }
    return k;
  }

  function withSegmentEnds(segments, duration) {
    var list = Array.isArray(segments) ? segments : [];
    var lastEnd = Number(duration);
    if (!Number.isFinite(lastEnd) || lastEnd <= 0) lastEnd = 0;
    return list.map(function (seg, i) {
      var start = Number(seg && seg.start);
      if (!Number.isFinite(start) || start < 0) start = 0;
      var end = Number(seg && seg.end);
      if (!Number.isFinite(end) || end <= start) {
        var nextStart = list[i + 1] != null ? Number(list[i + 1].start) : NaN;
        if (Number.isFinite(nextStart) && nextStart > start) end = nextStart;
        else if (lastEnd > start) end = lastEnd;
        else end = start + 1;
      }
      return {
        speaker: String((seg && seg.speaker) || ''),
        start: start,
        end: end,
        text: String((seg && seg.text) || '')
      };
    });
  }

  function applySpeakerColors(rootEl) {
    var rootNode = rootEl || document.getElementById('transcriptEditor');
    if (!rootNode) return;
    var nodes = rootNode.querySelectorAll('.speaker');
    var i;
    for (i = 0; i < nodes.length; i++) {
      setSpeakerStyle(nodes[i], (nodes[i].textContent || '').trim());
    }
  }

  function isOutOfView(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    var r = el.getBoundingClientRect();
    var top = 100;
    var dock = document.getElementById('ag-editor-chrome-dock');
    if (dock && dock.classList && dock.classList.contains('is-floating')) {
      top = Math.max(top, dock.getBoundingClientRect().bottom + 8);
    }
    return r.top < top || r.bottom > window.innerHeight - 120;
  }

  function scrollToActive(opts) {
    opts = opts || {};
    if (!follow.armed && !opts.force) return;
    var rootNode = document.getElementById('transcriptEditor');
    var audio = document.getElementById('agilo-audio');
    var segs = root._segments;
    if (!rootNode || !audio || !Array.isArray(segs) || !segs.length) return;
    var k = resolveActiveSegmentIndex(audio.currentTime || 0, segs, activeSeg);
    if (k < 0) return;
    var el = rootNode.children[k];
    if (!el) return;
    if (k !== activeSeg) {
      if (activeSeg >= 0 && rootNode.children[activeSeg]) {
        rootNode.children[activeSeg].classList.remove('is-active');
      }
      activeSeg = k;
    }
    el.classList.add('is-active');
    var out = isOutOfView(el);
    if (!opts.force && !follow.shouldScroll(out)) return;
    follow.beginProgrammatic();
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {
      el.scrollIntoView(true);
    }
    requestAnimationFrame(function () { follow.endProgrammatic(); });
  }

  function onUserScroll() {
    follow.disarm();
  }

  function bindPauseOnce() {
    if (pauseBound) return;
    pauseBound = true;
    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchmove', onUserScroll, { passive: true });
  }

  function audioDurationReady(audio) {
    return !!(audio && Number.isFinite(audio.duration) && audio.duration > 0);
  }

  function waitForDuration(audio) {
    if (audioDurationReady(audio)) return Promise.resolve(audio.duration);
    if (!audio || typeof audio.addEventListener !== 'function') return Promise.resolve(0);
    return new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        try {
          audio.removeEventListener('loadedmetadata', done);
          audio.removeEventListener('durationchange', done);
        } catch (_) { /* ignore */ }
        resolve(Number(audio.duration) || 0);
      }
      audio.addEventListener('loadedmetadata', done);
      audio.addEventListener('durationchange', done);
      setTimeout(done, 2000);
    });
  }

  function setExpectedDuration(segs, audio) {
    var last = 0;
    if (Array.isArray(segs) && segs.length) {
      last = Number(segs[segs.length - 1].end) || 0;
    }
    var dur = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
    var expected = Math.max(last, dur);
    if (expected > 0) {
      try { window.__agiloExpectedDuration = expected; } catch (_) { /* ignore */ }
    }
    return expected;
  }

  function applySeek(audio, sec) {
    var t = Number(sec);
    if (!audio || !Number.isFinite(t) || t < 0) return false;
    try { audio.currentTime = t; } catch (_) { /* ignore */ }
    follow.arm();
    if (audio.paused) {
      try {
        var p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay blocked */ });
      } catch (_) { /* ignore */ }
    }
    scrollToActive({ force: true });
    return true;
  }

  function seekTo(audio, sec) {
    if (audioDurationReady(audio)) {
      applySeek(audio, sec);
      return Promise.resolve(true);
    }
    return waitForDuration(audio).then(function () {
      applySeek(audio, sec);
      return true;
    });
  }

  function closestSeekBtn(node) {
    var el = node;
    if (el && el.nodeType === 3) el = el.parentElement;
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('button.time[data-action="seek"]');
  }

  function bindSeekOnce() {
    if (seekBound) return;
    seekBound = true;
    document.addEventListener('click', function (ev) {
      var btn = closestSeekBtn(ev.target);
      if (!btn) return;
      var audio = document.getElementById('agilo-audio');
      if (!audio) return;
      var sec = Number(btn.getAttribute('data-t'));
      if (!Number.isFinite(sec)) return;
      ev.preventDefault();
      seekTo(audio, sec);
    });
  }

  function bindAudio(audio) {
    if (!audio || audio.__agiloShareFollowBound) return;
    audio.__agiloShareFollowBound = true;
    function onTick() { scrollToActive({}); }
    audio.addEventListener('timeupdate', onTick);
    audio.addEventListener('play', function () {
      follow.arm();
      scrollToActive({ force: true });
    });
    audio.addEventListener('loadedmetadata', function () {
      var segs = withSegmentEnds(root._segments || [], audio.duration);
      root._segments = segs;
      window._segments = segs;
      setExpectedDuration(segs, audio);
    });
  }

  function bind(opts) {
    opts = opts || {};
    var duration = Number(opts.duration);
    var audio = document.getElementById('agilo-audio');
    if ((!Number.isFinite(duration) || duration <= 0) && audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      duration = audio.duration;
    }
    var segs = withSegmentEnds(opts.segments || [], duration);
    root._segments = segs;
    window._segments = segs;
    activeSeg = -1;
    setExpectedDuration(segs, audio);
    applySpeakerColors(opts.root || document.getElementById('transcriptEditor'));
    bindPauseOnce();
    bindSeekOnce();
    if (audio && audio !== boundAudio) {
      bindAudio(audio);
      boundAudio = audio;
    }
    scrollToActive({ force: false });
    return segs;
  }

  root.AgiloShareFollow = {
    SPK_COLORS: SPK_COLORS,
    getSpeakerColor: getSpeakerColor,
    setSpeakerStyle: setSpeakerStyle,
    resolveActiveSegmentIndex: resolveActiveSegmentIndex,
    withSegmentEnds: withSegmentEnds,
    createFollowController: createFollowController,
    applySpeakerColors: applySpeakerColors,
    seekTo: seekTo,
    setExpectedDuration: setExpectedDuration,
    bind: bind
  };
})(typeof window !== 'undefined' ? window : globalThis);
