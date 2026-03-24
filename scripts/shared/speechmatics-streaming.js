/**
 * Fichier de compatibilité : les intégrations anciennes pointent encore ici.
 * Charge le bundle renommé agilo-live-transcribe.js (même répertoire, même query).
 */
(function () {
  var cur = document.currentScript;
  if (!cur || !cur.src) return;
  var u = cur.src.replace(/speechmatics-streaming\.js/i, "agilo-live-transcribe.js");
  if (u === cur.src) return;
  var s = document.createElement("script");
  s.src = u;
  s.async = false;
  cur.parentNode.insertBefore(s, cur.nextSibling);
})();
