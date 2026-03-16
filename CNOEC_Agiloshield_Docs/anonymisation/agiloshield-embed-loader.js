/**
 * Chargement conditionnel du script Agiloshield anonymisation
 * À placer dans Webflow > Custom Code > Head ou Body (avant le form #agfForm)
 * REMPLACE le <script src="...limited.js"> actuel — ce loader injecte le bon script.
 *
 * Détection : si un élément [data-ms-content="access-agiloshield-unlimited"] ou
 * [data-ms-content="access-business-plus"] existe dans le DOM (après ~300ms pour Memberstack)
 * → charge agiloshield-embed-anonymisation-2026-02-16.js (illimité)
 * Sinon → charge agiloshield-embed-anonymisation-limited.js
 *
 * Prérequis Webflow/Memberstack : ajouter un élément conditionnel "Show when member has:
 * access-agiloshield-unlimited" pour que les utilisateurs add-on chargent le script illimité.
 */
(function () {
  'use strict';
  function loadScript() {
    var hasAddon = !!document.querySelector('[data-ms-content="access-agiloshield-unlimited"]') ||
                   !!document.querySelector('[data-ms-content="access-business-plus"]');
    var base = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/CNOEC_Agiloshield_Docs/anonymisation/';
    var scriptUrl = hasAddon
      ? base + 'agiloshield-embed-anonymisation-2026-02-16.js'
      : base + 'agiloshield-embed-anonymisation-limited.js';
    var s = document.createElement('script');
    s.src = scriptUrl;
    s.async = false;
    document.body.appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadScript, 300);
    });
  } else {
    setTimeout(loadScript, 300);
  }
})();
