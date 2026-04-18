// Agilotext — léger rattrapage rail quand l’auth change hors événement token
// (onglet rev visible, autre onglet a mis à jour localStorage, etc.)
// Dépend de Code-changement-audio.js qui écoute agilo:refresh-rail.
(function () {
  'use strict';
  if (window.__agiloAuthSync) return;
  window.__agiloAuthSync = true;

  let t = null;
  function bump() {
    if (t) clearTimeout(t);
    t = setTimeout(function () {
      t = null;
      window.dispatchEvent(new CustomEvent('agilo:refresh-rail'));
    }, 160);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') bump();
  });

  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key.indexOf('agilo:token') === 0 || e.key === 'agilo:username') bump();
  });

  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) bump();
  });
})();
