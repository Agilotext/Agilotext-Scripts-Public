/**
 * Loader Agiloshield Anonymisation
 * Récupère FINAL.html depuis le CDN, l'injecte dans la page, puis charge le script principal.
 * Usage Webflow : un seul embed avec ce script. Optionnel : un div avec id="agf-embed-root".
 */
(function () {
  'use strict';

  const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/CNOEC_Agiloshield_Docs/Front_END';
  const EMBED_HTML_URL = CDN_BASE + '/FINAL.html';
  const MAIN_SCRIPT_URL = CDN_BASE + '/agiloshield-embed-anonymisation.js';
  const ROOT_ID = 'agf-embed-root';

  function getRoot() {
    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function loadScript(src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  }

  function injectAndBootstrap() {
    fetch(EMBED_HTML_URL)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var root = getRoot();
        root.innerHTML = doc.body ? doc.body.innerHTML : html;
        loadScript(MAIN_SCRIPT_URL);
      })
      .catch(function (err) {
        console.error('[Agiloshield] Erreur chargement embed:', err);
        getRoot().innerHTML = '<p style="padding:1rem;color:#a82633;">Impossible de charger l’outil d’anonymisation. Vérifiez votre connexion.</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAndBootstrap);
  } else {
    injectAndBootstrap();
  }
})();
