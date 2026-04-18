// Agilotext - Editor Page Main Loader
// ⚠️ Ce fichier est chargé depuis GitHub
// Charge tous les scripts nécessaires pour la page éditeur dans le bon ordre

(function () {
  // Éviter le double chargement
  if (window.__agiloEditorMainLoaded) return;
  window.__agiloEditorMainLoaded = true;

  // Flag de debug global
  window.AGILO_DEBUG = window.AGILO_DEBUG || new URLSearchParams(location.search).get('debug') === '1';

  // Base URL jsDelivr CDN — défaut @main ; surcharge tests : ?agilo_cdn_branch=1.05
  const __CDN_BRANCH = (() => {
    try {
      const b = new URLSearchParams(location.search).get('agilo_cdn_branch') || 'main';
      return String(b).replace(/[^a-zA-Z0-9._-]/g, '') || 'main';
    } catch {
      return 'main';
    }
  })();
  const CDN_BASE = `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${__CDN_BRANCH}/scripts/pages/editor`;
  if (window.AGILO_DEBUG) {
    console.log('[agilo:loader] Branche CDN jsDelivr :', __CDN_BRANCH, '→', CDN_BASE);
  }

  // Liste des scripts à charger dans l'ordre
  const scripts = [
    // 1. CSS d'abord (pour éviter le FOUC)
    'Code-editor-css.js',
    'Code-rename-menu-css.js',
    'Code-chat-css.js',
    'Code-rail-css.js',
    
    // 2. Utilitaires de base
    'token-resolver.js',
    'orchestrator.js',
    'ready-count.js',
    
    // 3. Composants principaux
    'Code-lecteur-audio.js',
    'Code-main-editor.js',
    'Code-changement-audio.js',
    'Code-editor-auth-sync.js',
    'Code-chat.js',
    'Code-ed-header.js',
    'Code-questions-ia.js',
    'Code-copy-paste-text.js',
    'Code-save_transcript.js',
    
    // 4. Animations et effets
    'Code-gsap.js',
    'Code-lottie.js',
    
    // 5. Scripts additionnels
    'relance-compte-rendu.js'
  ];

  // Fonction pour charger un script
  function loadScript(src, onLoad, onError) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // Chargement séquentiel pour respecter l'ordre
    script.onload = onLoad;
    script.onerror = onError || (() => {
      console.error(`[agilo:loader] Erreur de chargement: ${src}`);
    });
    document.head.appendChild(script);
  }

  // Charger tous les scripts séquentiellement
  let currentIndex = 0;

  function loadNext() {
    if (currentIndex >= scripts.length) {
      if (window.AGILO_DEBUG) {
        console.log('[agilo:loader] ✅ Tous les scripts chargés');
      }
      // Dispatch un événement pour signaler que tout est chargé
      window.dispatchEvent(new CustomEvent('agilo:scripts-loaded'));
      return;
    }

    const scriptName = scripts[currentIndex];
    const scriptUrl = `${CDN_BASE}/${scriptName}`;

    if (window.AGILO_DEBUG) {
      console.log(`[agilo:loader] Chargement: ${scriptName} (${currentIndex + 1}/${scripts.length})`);
    }

    loadScript(scriptUrl, () => {
      currentIndex++;
      loadNext();
    }, () => {
      console.error(`[agilo:loader] ❌ Échec: ${scriptName}`);
      currentIndex++;
      loadNext(); // Continuer même en cas d'erreur
    });
  }

  // Démarrer le chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNext);
  } else {
    loadNext();
  }
})();

