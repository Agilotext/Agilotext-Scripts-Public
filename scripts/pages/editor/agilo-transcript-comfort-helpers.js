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

  function speakerRosterStorageKey(jobId) {
    const id = String(jobId ?? '').trim();
    if (!id) return '';
    return 'agilo:speaker-roster:' + id;
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
    speakerRosterStorageKey,
    createFollowController
  };
})(typeof window !== 'undefined' ? window : globalThis);
