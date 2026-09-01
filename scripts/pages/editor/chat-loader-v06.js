// Agilotext - Chat Loader V06 (test Webflow branche 1.09)
// Charge Code-chat_V06.js (logo Mistral sur l’indicateur « réfléchit »).
// Prod actuelle : chat-loader.js → Code-chat_V05.js
// 1) chat-embed-styles.css  2) chat-submission-embed.html  3) agilo-speech-dictate.js  4) Code-chat_V06.js
(function () {
  if (window.__agiloChatLoaderComplete) return;
  if (window.__agiloChatLoaderRunning) return;
  window.__agiloChatLoaderRunning = true;

  function getCdnRef() {
    const currentScript = document.currentScript;
    const fromData = currentScript && currentScript.getAttribute('data-cdn-ref');
    if (fromData) return String(fromData).replace(/[^a-zA-Z0-9._-]/g, '');
    const current = (currentScript && currentScript.src) || '';
    const fromScript = current.match(/Agilotext-Scripts-Public@([^/]+)\/scripts\/pages\/editor\/chat-loader(?:-v06)?\.js/i)?.[1];
    if (fromScript) return fromScript;
    try {
      const fromQuery = new URLSearchParams(location.search).get('agilo_cdn_branch');
      if (fromQuery) return String(fromQuery).replace(/[^a-zA-Z0-9._-]/g, '');
    } catch { }
    return 'main';
  }

  const REF = getCdnRef();
  const BASE = `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${REF}/scripts/pages/editor`;
  const SHARED_BASE = `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${REF}/scripts/shared`;

  window.__agiloChatLoaderDiag = function () {
    return {
      ref: REF,
      base: BASE,
      brancheDetectee: REF,
      complete: !!window.__agiloChatLoaderComplete,
      running: !!window.__agiloChatLoaderRunning,
      aSubmission: !!document.getElementById('agilo-chat-submission'),
      styles: !!document.getElementById('agilo-chat-styles'),
      v05: Array.from(document.scripts).some((s) => /Code-chat_V05\.js/.test(String(s.src || ''))),
      v06: Array.from(document.scripts).some((s) => /Code-chat_V06\.js/.test(String(s.src || ''))),
      loader: 'v06-mistral',
      srcDesScripts: Array.from(document.scripts).map((s) => s.src).filter(Boolean)
    };
  };

  /** Optionnel : ?agilo_cdn_bust=20260423-1 sur la page éditeur pour forcer un re-fetch (CDN intermédiaire). */
  function extraBust() {
    try {
      return new URLSearchParams(location.search).get('agilo_cdn_bust') || '';
    } catch { return ''; }
  }
  const BUSTQ = (() => {
    const b = extraBust();
    return b ? `&bust=${encodeURIComponent(b)}` : '&bust=v05.2';
  })();

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const src = `${BASE}/${file}?v=${REF}${BUSTQ}`;
      const already = Array.from(document.scripts).some((s) => String(s.src || '').includes(`/scripts/pages/editor/${file}`));
      if (already) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Echec de chargement: ${src}`));
      document.head.appendChild(s);
    });
  }

  function loadSharedScript(file) {
    return new Promise((resolve, reject) => {
      const src = `${SHARED_BASE}/${file}?v=${REF}${BUSTQ}`;
      const already = Array.from(document.scripts).some((s) => String(s.src || '').includes(`/scripts/shared/${file}`));
      if (already) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Echec de chargement: ${src}`));
      document.head.appendChild(s);
    });
  }

  /** Même rôle que l’ancien Code-chat-css.js : #agilo-chat-styles pour ne pas dupliquer si déjà présent. */
  async function injectChatStylesIfNeeded() {
    if (document.getElementById('agilo-chat-styles')) return;
    const url = `${BASE}/chat-embed-styles.css?v=${REF}${BUSTQ}`;
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(String(res.status));
      const s = document.createElement('style');
      s.id = 'agilo-chat-styles';
      s.setAttribute('data-agilo-injected', 'chat-loader');
      s.textContent = await res.text();
      document.head.appendChild(s);
    } catch (e) {
      const link = document.createElement('link');
      link.id = 'agilo-chat-styles';
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-agilo-fallback', 'link');
      document.head.appendChild(link);
    }
  }

  async function injectMarkupIfNeeded() {
    if (document.getElementById('agilo-chat-submission')) return;
    const target = document.getElementById('agilo-chat-mount') || document.querySelector('[data-agilo-chat-mount]') || document.getElementById('pane-chat') || document.body;
    if (!target) return;
    const url = `${BASE}/chat-submission-embed.html?v=${REF}${BUSTQ}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`Echec de chargement markup chat (${res.status})`);
    const html = await res.text();
    target.insertAdjacentHTML('beforeend', html);
  }

  async function start() {
    try {
      await injectChatStylesIfNeeded();
      await injectMarkupIfNeeded();
      await loadSharedScript('agilo-speech-dictate.js');
      /* Code-chat_V06 — logo Mistral + indicateur réfléchit */
      await loadScript('Code-chat_V06.js');
      window.__agiloChatLoaderComplete = true;
      window.__agiloChatLoaderLoaded = true;
      window.dispatchEvent(new CustomEvent('agilo:chat-loader-ready', { detail: { ref: REF, base: BASE } }));
    } catch (e) {
      console.error('[agilo:chat-loader]', e);
    } finally {
      window.__agiloChatLoaderRunning = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
