/* ================================================================
   AGILOTEXT — Mapping segments partage (guest / owner)
   milli_start (ms) → start en secondes, comme l’éditeur.
   Charge AVANT share-view-invite.js.
   ================================================================ */
(function (root) {
  'use strict';

  function mapGuestSegments(arr) {
    return (arr || []).map(function (r, i) {
      var hasMilli = r.milli_start != null || r.milliStart != null;
      var raw = hasMilli
        ? (r.milli_start != null ? r.milli_start : r.milliStart)
        : r.start;
      var n = Number(raw);
      if (!Number.isFinite(n) || n < 0) n = 0;
      var startSec = hasMilli
        ? Math.floor(n / 1000)
        : Math.floor(n > 1e6 ? n / 1000 : n);
      return {
        speaker: String(r.speaker || '').trim() || ('Intervenant ' + (i + 1)),
        start: Math.max(0, startSec),
        text: String(r.text || '').replace(/\\n/g, '\n')
      };
    }).filter(function (s) {
      return String(s.text || '').trim();
    });
  }

  var api = { mapGuestSegments: mapGuestSegments };
  root.AgiloShareSegments = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
