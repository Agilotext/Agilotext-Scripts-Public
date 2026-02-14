/**
 * Loader Agiloshield Anonymisation
 * Récupère FINAL.html depuis le CDN, injecte styles + contenu, puis charge le script principal.
 * Usage Webflow : un seul embed avec ce script. Optionnel : un div avec id="agf-embed-root".
 */
(function () {
  'use strict';

  var CDN_BASE = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/CNOEC_Agiloshield_Docs/Front_END';
  var EMBED_HTML_URL = CDN_BASE + '/FINAL.html';
  var MAIN_SCRIPT_URL = CDN_BASE + '/agiloshield-embed-anonymisation.js';
  var ROOT_ID = 'agf-embed-root';

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

        // 1) Styles dans le head pour que tout s’applique comme dans FINAL.html
        var styles = doc.querySelectorAll('style');
        for (var i = 0; i < styles.length; i++) {
          var style = document.createElement('style');
          style.textContent = styles[i].textContent;
          document.head.appendChild(style);
        }

        // 2) Contenu : form + modales (tout ce qui n’est pas <style> dans body)
        var body = doc.body || doc.querySelector('body');
        var fragment = document.createDocumentFragment();
        if (body && body.childNodes) {
          for (var j = 0; j < body.childNodes.length; j++) {
            var node = body.childNodes[j];
            if (node.nodeType === 1 && node.tagName.toLowerCase() !== 'style') {
              fragment.appendChild(node.cloneNode(true));
            }
          }
        }
        root.appendChild(fragment);

        // 3) Charger le script principal une fois le DOM en place
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
