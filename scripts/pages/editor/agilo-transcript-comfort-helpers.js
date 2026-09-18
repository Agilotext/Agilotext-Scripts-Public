/**
 * Helpers purs : suivi lecture transcription + trim split locuteur.
 * Tests : node scripts/pages/editor/agilo-transcript-comfort-helpers.test.mjs
 */
(function (root) {
  'use strict';

  function trimSplitNewlines(left, right) {
    const leftClean = String(left ?? '').replace(/\n+$/, '');
    const rightClean = String(right ?? '').replace(/^\n+/, '');
    return { left: leftClean, right: rightClean };
  }

  function shouldScrollFollow(armed, outOfView) {
    return !!armed && !!outOfView;
  }

  function resolveActiveSegmentIndex(currentTime, segments, activeSeg) {
    if (!Array.isArray(segments) || !segments.length) return -1;
    const t = Number(currentTime) || 0;
    const inSeg = (s) => Number.isFinite(s.start) && Number.isFinite(s.end) && t >= s.start && t < s.end;
    let k = activeSeg;
    if (k < 0 || !inSeg(segments[k])) k = segments.findIndex(inSeg);
    return k;
  }

  function foldSpeakerSearch(s) {
    return String(s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function isJunkSpeakerLabel(s) {
    const t = String(s ?? '').trim();
    if (!t) return true;
    return /^(speaker|locuteur|spk)[\s._-]*\d+$/i.test(t);
  }

  function filterSpeakerRoster(names, query) {
    const list = Array.isArray(names) ? names : [];
    const q = foldSpeakerSearch(query);
    if (!q) return list.slice();
    return list.filter((n) => foldSpeakerSearch(n).includes(q));
  }

  function shouldCreateSpeakerFromQuery(query, names) {
    const q = foldSpeakerSearch(String(query ?? '').trim());
    if (!q) return false;
    const list = Array.isArray(names) ? names : [];
    return !list.some((n) => foldSpeakerSearch(n) === q);
  }

  function speakerRosterStorageKey(jobId) {
    const id = String(jobId ?? '').trim();
    if (!id) return '';
    return 'agilo:speaker-roster:' + id;
  }

  function computePopoverPlace({ anchor, size, viewport, pad, stickyBottom } = {}) {
    const a = anchor || {};
    const w = Number(size && size.width) || 0;
    const h = Number(size && size.height) || 0;
    const vw = Number(viewport && viewport.width) || 0;
    const vh = Number(viewport && viewport.height) || 0;
    const p = Number.isFinite(Number(pad)) ? Number(pad) : 8;
    const minTop = Math.max(0, Number(stickyBottom) || 0) + p;
    let left = Number(a.left) || 0;
    left = Math.max(p, Math.min(left, vw - w - p));
    let top = (Number(a.bottom) || 0) + p;
    if (top + h > vh - p) top = (Number(a.top) || 0) - h - p;
    top = Math.max(minTop, Math.min(top, vh - h - p));
    return { top, left };
  }

  function anchorVisibleInPane(anchor, pane) {
    const a = anchor || {};
    const view = pane || {};
    const ar = {
      left: Number(a.left) || 0,
      top: Number(a.top) || 0,
      right: Number.isFinite(Number(a.right)) ? Number(a.right) : (Number(a.left) || 0),
      bottom: Number.isFinite(Number(a.bottom)) ? Number(a.bottom) : (Number(a.top) || 0)
    };
    const pr = {
      left: Number(view.left) || 0,
      top: Number(view.top) || 0,
      right: Number.isFinite(Number(view.right)) ? Number(view.right) : Infinity,
      bottom: Number.isFinite(Number(view.bottom)) ? Number(view.bottom) : Infinity
    };
    return !(ar.right <= pr.left || ar.left >= pr.right || ar.bottom <= pr.top || ar.top >= pr.bottom);
  }

  function createFollowController(opts) {
    let armed = true;
    let programmatic = false;
    const onChange = opts && typeof opts.onChange === 'function' ? opts.onChange : null;

    function setArmed(next) {
      const v = !!next;
      if (armed === v) return;
      armed = v;
      if (onChange) onChange(armed);
    }

    return {
      get armed() { return armed; },
      get programmatic() { return programmatic; },
      arm() { setArmed(true); },
      disarm() {
        if (programmatic) return;
        setArmed(false);
      },
      beginProgrammatic() { programmatic = true; },
      endProgrammatic() { programmatic = false; },
      shouldScroll(outOfView) { return shouldScrollFollow(armed, outOfView); }
    };
  }

  root.AgiloTranscriptComfort = {
    trimSplitNewlines,
    shouldScrollFollow,
    resolveActiveSegmentIndex,
    foldSpeakerSearch,
    isJunkSpeakerLabel,
    filterSpeakerRoster,
    shouldCreateSpeakerFromQuery,
    speakerRosterStorageKey,
    computePopoverPlace,
    anchorVisibleInPane,
    createFollowController
  };
})(typeof window !== 'undefined' ? window : globalThis);
