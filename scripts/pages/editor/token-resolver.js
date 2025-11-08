// Agilotext - Token Resolver
// ⚠️ Ce fichier est chargé depuis GitHub
// Gère la résolution et le rafraîchissement automatique des tokens

(function () {
  'use strict';
  
  const API_BASE = 'https://api.agilotext.com/api/v1';
  if (typeof window.globalToken === 'undefined') window.globalToken = '';
  let inflight = false;

  function normEdition(v){
    v = String(v||'').toLowerCase().trim();
    if (v==='business' || v==='enterprise' || v==='entreprise' || v==='biz') return 'ent';
    return v || 'free';
  }
  
  function tokenKey(email, edition){
    return `agilo:token:${normEdition(edition)}:${String(email||'').toLowerCase()}`;
  }
  
  function ensureMemberEmailInput(email) {
    if (!email) return;
    let el = document.querySelector('[name="memberEmail"]');
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = 'memberEmail';
      document.body.appendChild(el);
    }
    el.value = email;
  }
  
  async function resolveEmail() {
    const direct = document.getElementById('memberEmail')?.value
      || document.querySelector('[name="memberEmail"]')?.value
      || window.memberEmail
      || localStorage.getItem('agilo:username')
      || document.querySelector('[data-ms-member="email"]')?.textContent
      || '';
    if (direct) return direct.trim();

    if (window.$memberstackDom?.getMember) {
      try { 
        const r = await window.$memberstackDom.getMember(); 
        if (r?.data?.email) return r.data.email.trim(); 
      } catch (err) {
        if (window.AGILO_DEBUG) console.error('[agilo] getMember error:', err);
      }
    }
    
    for (let i = 0; i < 30; i++) {
      const v = document.getElementById('memberEmail')?.value
             || document.querySelector('[data-ms-member="email"]')?.textContent
             || '';
      if (v) return v.trim();
      await new Promise(r => setTimeout(r, 100));
    }
    return '';
  }

  function broadcast({ token, email, edition }) {
    if (!token) return;
    window.globalToken = token;
    try {
      localStorage.setItem(tokenKey(email, edition), token);
      localStorage.setItem('agilo:username', email);
      localStorage.setItem('agilo:edition', normEdition(edition));
    } catch (err) {
      if (window.AGILO_DEBUG) console.error('[agilo] localStorage error:', err);
    }
    ensureMemberEmailInput(email);
    window.dispatchEvent(new CustomEvent('agilo:token', { detail: { token, email, edition: normEdition(edition) }}));
    if (window.AGILO_DEBUG) console.log('[agilo] token prêt');
  }

  async function getToken(email, edition) {
    if (!email) return;
    if (window.globalToken) { ensureMemberEmailInput(email); return; }
    if (inflight) return;
    inflight = true;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const url = `${API_BASE}/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(normEdition(edition))}`;
      const r = await fetch(url, { 
        cache: 'no-store', 
        credentials: 'omit',
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      const ct  = r.headers.get('content-type') || '';
      const txt = await r.text();

      let data = null;
      if (ct.includes('application/json')) {
        try { data = JSON.parse(txt); } catch {}
      }
      if (!data) {
        try { data = JSON.parse(txt); } catch (err) { 
          if (window.AGILO_DEBUG) console.error('[agilo] getToken non-JSON:', txt.slice(0, 300)); 
        }
      }

      if (r.ok && data?.status === 'OK' && data?.token) {
        broadcast({ token: data.token, email, edition });
      } else {
        const msg = data?.errorMessage || (r.ok ? 'Réponse inattendue' : `HTTP ${r.status}`);
        if (window.AGILO_DEBUG) console.error('[agilo] Erreur getToken:', msg);
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        if (window.AGILO_DEBUG) console.error('[agilo] Erreur API getToken: timeout');
      } else {
        if (window.AGILO_DEBUG) console.error('[agilo] Erreur API getToken:', err);
      }
    } finally {
      inflight = false;
    }
  }

  // Cleanup function
  const cleanup = () => {
    // Nettoyer les event listeners si nécessaire
  };

  const init = async () => {
    const edition = normEdition(
      window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || document.getElementById('editorRoot')?.dataset.edition
      || localStorage.getItem('agilo:edition')
      || 'free'
    );
    const email = await resolveEmail();
    if (!email) { 
      if (window.AGILO_DEBUG) console.warn('[agilo] Email utilisateur non trouvé'); 
      return; 
    }

    const cached = localStorage.getItem(tokenKey(email, edition));
    if (cached) { broadcast({ token: cached, email, edition }); return; }

    getToken(email, edition);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const tokenHandler = (e) => {
    if (e?.detail?.email) ensureMemberEmailInput(e.detail.email);
  };
  
  window.addEventListener('agilo:token', tokenHandler);
  window.getToken = getToken;

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
})();

