// Agilotext - Chat Loader (single script for Webflow)
// Injecte le markup de composition + charge Code-chat-css.js puis Code-chat_V05.js.
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

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const src = `${BASE}/${file}?v=${REF}`;
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

  async function injectMarkupIfNeeded() {
    if (document.getElementById('agilo-chat-submission')) return;
    const target = document.getElementById('agilo-chat-mount') || document.querySelector('[data-agilo-chat-mount]') || document.getElementById('pane-chat') || document.body;
    if (!target) return;
    const url = `${BASE}/chat-submission-embed.html?v=${REF}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`Echec de chargement markup chat (${res.status})`);
    const html = await res.text();
    target.insertAdjacentHTML('beforeend', html);
  }

  async function start() {
    try {
      await injectMarkupIfNeeded();
      await loadScript('Code-chat-css.js');
      /* Code-chat_V05 s’exécute après DOMContentLoaded : il doit s’init si document.readyState !== "loading" */
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
