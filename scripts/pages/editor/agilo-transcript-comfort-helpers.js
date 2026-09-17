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
    createFollowController
  };
})(typeof window !== 'undefined' ? window : globalThis);
