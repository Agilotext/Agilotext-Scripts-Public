// Agilotext - Editor Main Loader
// ⚠️ Ce fichier est chargé depuis GitHub
// Charge tous les scripts de la page éditeur dans le bon ordre

(function() {
  'use strict';
  
  // Configuration DEBUG (mettre à false en production)
  window.AGILO_DEBUG = false;
  
  const BASE_URL = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/';
  
  const scripts = [
    'token-resolver.js',      // 1. Résolution des tokens
    'orchestrator.js',        // 2. Orchestration des jobs
    'ready-count.js',         // 3. Compteur de jobs prêts
    'relance-compte-rendu.js' // 4. Relance compte-rendu (déjà existant)
  ];
  
  let loaded = 0;
  let failed = 0;
  
  function loadScript(src, index) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = BASE_URL + src;
      script.async = false; // Chargement séquentiel
      script.onload = () => {
        loaded++;
        if (window.AGILO_DEBUG) console.log(`[Editor] Script ${index + 1}/${scripts.length} chargé:`, src);
        resolve();
      };
      script.onerror = () => {
        failed++;
        if (window.AGILO_DEBUG) console.error(`[Editor] Erreur chargement script:`, src);
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(script);
    });
  }
  
  async function loadAllScripts() {
    try {
      for (let i = 0; i < scripts.length; i++) {
        await loadScript(scripts[i], i);
      }
      if (window.AGILO_DEBUG) {
        console.log(`[Editor] ✅ Tous les scripts chargés (${loaded}/${scripts.length})`);
      }
    } catch (err) {
      if (window.AGILO_DEBUG) {
        console.error(`[Editor] ❌ Erreur chargement scripts:`, err);
      }
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllScripts);
  } else {
    loadAllScripts();
  }
})();

