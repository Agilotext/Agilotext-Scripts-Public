// Agilotext - Editor Page Loader (branche test confidence-v1)
// Prod inchangée : ../editor-main.js + ../Code-main-editor-IFRAME_V04.js

(function () {
  if (window.__agiloEditorMainConfidenceLoaded) return;
  window.__agiloEditorMainConfidenceLoaded = true;

  window.AGILO_DEBUG = window.AGILO_DEBUG || new URLSearchParams(location.search).get('debug') === '1';

  const __CDN_BRANCH = (() => {
    try {
      const qp = new URLSearchParams(location.search).get('agilo_cdn_branch');
      if (qp) return String(qp).replace(/[^a-zA-Z0-9._-]/g, '') || '1.09';
      // Hérite de la branche du tag @ dans l'URL du loader (ex. @1.09)
      const src = document.currentScript?.src || '';
      const m = src.match(/Agilotext-Scripts-Public@([^/]+)/);
      if (m && m[1]) return m[1];
      return '1.09';
    } catch {
      return '1.09';
    }
  })();

  const CDN_CONF = `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${__CDN_BRANCH}/scripts/pages/editor/confidence-v1`;
  const CDN_PARENT = `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${__CDN_BRANCH}/scripts/pages/editor`;

  /** Scripts chargés depuis le dossier parent (prod) — évite la duplication. */
  const PARENT_ONLY = new Set([
    'Code-editor-css.js',
    'Code-rename-menu-css.js',
    'Code-chat-css.js',
    'Code-rail-css.js',
    'token-resolver.js',
    'orchestrator.js',
    'ready-count.js',
    'Code-lecteur-audio.js',
    'Code-changement-audio.js',
    'Code-editor-auth-sync.js',
    'Code-chat_V06.js',
    'Code-ed-header.js',
    'Code-save_transcript.js',
    'Code-questions-ia.js',
    'Code-copy-paste-text.js',
    'Code-gsap.js',
    'Code-lottie.js',
    'relance-compte-rendu.js'
  ]);

  if (window.AGILO_DEBUG) {
    console.log('[agilo:loader:confidence] Branche CDN :', __CDN_BRANCH);
    console.log('[agilo:loader:confidence] confidence-v1 →', CDN_CONF);
  }

  const scripts = [
    'Code-editor-css.js',
    'Code-rename-menu-css.js',
    'Code-chat-css.js',
    'Code-rail-css.js',
    'token-resolver.js',
    'orchestrator.js',
    'ready-count.js',
    'Code-lecteur-audio.js',
    'agilo-confidence.css.js',
    'agilo-confidence.js',
    'Code-main-editor-IFRAME_V04-confidence.js',
    'Code-changement-audio.js',
    'Code-editor-auth-sync.js',
    'Code-chat_V06.js',
    'Code-ed-header.js',
    'Code-questions-ia.js',
    'Code-copy-paste-text.js',
    'Code-save_transcript.js',
    'Code-gsap.js',
    'Code-lottie.js',
    'relance-compte-rendu.js'
  ];

  function scriptUrl(name) {
    const base = PARENT_ONLY.has(name) ? CDN_PARENT : CDN_CONF;
    return `${base}/${name}`;
  }

  function loadScript(src, onLoad, onError) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = onLoad;
    script.onerror = onError || (() => {
      console.error(`[agilo:loader:confidence] Erreur: ${src}`);
    });
    document.head.appendChild(script);
  }

  let currentIndex = 0;

  function loadNext() {
    if (currentIndex >= scripts.length) {
      if (window.AGILO_DEBUG) {
        console.log('[agilo:loader:confidence] Tous les scripts chargés');
      }
      window.dispatchEvent(new CustomEvent('agilo:scripts-loaded-confidence'));
      return;
    }

    const scriptName = scripts[currentIndex];
    const url = scriptUrl(scriptName);

    if (window.AGILO_DEBUG) {
      console.log(`[agilo:loader:confidence] ${scriptName} (${currentIndex + 1}/${scripts.length})`);
    }

    loadScript(url, () => {
      currentIndex++;
      loadNext();
    }, () => {
      console.error(`[agilo:loader:confidence] Échec: ${scriptName}`);
      currentIndex++;
      loadNext();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNext);
  } else {
    loadNext();
  }
})();
