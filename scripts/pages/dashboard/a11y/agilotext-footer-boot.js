/**
 * Injecte CSS a11y + sidebar, met à jour .current_year.
 * Compense le freeform Webflow (link tags) quand le footer raw est indisponible.
 * Pin : même hash que a11y-lite / sidebar-toggle.
 */
(function () {
  'use strict';
  var HASH = '49215d8';
  var BASE = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@' + HASH;
  try {
    var y = document.querySelector('.current_year');
    if (y) y.textContent = String(new Date().getFullYear());
  } catch (_) {}
  [
    BASE + '/scripts/pages/dashboard/a11y/agilotext-a11y-lite.css?v=' + HASH,
    BASE + '/scripts/pages/dashboard/Code-sidebar-toggle.css?v=' + HASH
  ].forEach(function (href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  });
})();
