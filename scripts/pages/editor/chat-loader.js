// Agilotext - Chat Loader (un seul script Webflow)
// 1) Styles (fetch chat-embed-styles.css, même contenu qu’avant via Code-chat-css.js)
// 2) Markup (chat-submission-embed.html)
// 3) Code-chat_V05.js
// Ancien enchaînement Code-chat-css.js + V05 : remplacé par ce loader seul.
(function () {
  if (window.__agiloChatLoaderLoaded) return;
  window.__agiloChatLoaderLoaded = true;

  function getCdnRef() {
    const current = document.currentScript?.src || '';
    const fromScript = current.match(/Agilotext-Scripts-Public@([^/]+)\/scripts\/pages\/editor\/chat-loader\.js/i)?.[1];
    if (fromScript) return fromScript;
    try {
      const fromQuery = new URLSearchParams(location.search).get('agilo_cdn_branch');
      if (fromQuery) return String(fromQuery).replace(/[^a-zA-Z0-9._-]/g, '');
    } catch { }
    return 'main';
  }

  const REF = getCdnRef();
  const BASE = `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${REF}/scripts/pages/editor`;

  /** Optionnel : ?agilo_cdn_bust=20260423-1 sur la page éditeur pour forcer un re-fetch (CDN intermédiaire). */
  function extraBust() {
    try {
      return new URLSearchParams(location.search).get('agilo_cdn_bust') || '';
    } catch { return ''; }
  }
  const BUSTQ = (() => {
    const b = extraBust();
    return b ? `&bust=${encodeURIComponent(b)}` : '';
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
      /* Code-chat_V05 s’exécute après ; il réinitialise si document déjà prêt. */
      await loadScript('Code-chat_V05.js');
      window.dispatchEvent(new CustomEvent('agilo:chat-loader-ready', { detail: { ref: REF } }));
    } catch (e) {
      console.error('[agilo:chat-loader]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
