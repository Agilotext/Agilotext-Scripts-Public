// Agilotext - Job Orchestrator
// ⚠️ Ce fichier est chargé depuis GitHub
// Gère l'orchestration des jobs et la synchronisation des credentials

(function initJobOrchestrator() {
  'use strict';
  
  if (window.__agiloOrchestrator) return;
  
  function normEdition(v){
    v = String(v||'').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v))  return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }
  
  function getEdition(){
    const qs   = new URLSearchParams(location.search).get('edition');
    const root = document.getElementById('editorRoot')?.dataset.edition;
    const ls   = localStorage.getItem('agilo:edition');
    return normEdition(qs || root || ls || 'ent');
  }
  
  function applyCreds({ token, email, edition }) {
    if (!token || !email) return;
    
    const root = document.getElementById('editorRoot');
    if (root) {
      root.dataset.token    = token;
      root.dataset.username = email;
      root.dataset.edition  = root.dataset.edition || edition || 'ent';
    }
    
    try {
      document.querySelectorAll('a[href*="receiveText"], a[href*="receiveSummary"]').forEach(a => {
        const href = a.getAttribute('href'); 
        if (!href) return;
        const u = new URL(href, location.href);
        u.searchParams.set('username', email);
        u.searchParams.set('token', token);
        if (root?.dataset.edition) u.searchParams.set('edition', root.dataset.edition);
        a.setAttribute('href', u.toString());
      });
    } catch (err) {
      if (window.AGILO_DEBUG) console.error('[Orch] applyCreds error:', err);
    }
    
    const wrap = document.getElementById('agilo-audio-wrap');
    if (wrap) wrap.dataset.edition = root?.dataset.edition || edition || 'ent';
    
    if (window.AGILO_DEBUG) console.log('[Orch] Credentials appliquées:', { email, edition, token: token?.slice(0,8) + '...' });
  }
  
  const orch = {
    currentJobId: '',
    currentSeq: 0,
    lastDispatchTime: 0,
    minGapMs: 500,
    
    credentials: {
      token: '',
      email: '',
      edition: 'ent'
    },
    
    subscribers: new Map(),
    
    subscribe(name, handlers) {
      if (!handlers || typeof handlers.cancel !== 'function') {
        if (window.AGILO_DEBUG) console.warn(`[Orch] ${name} n'a pas de handler.cancel()`);
        return;
      }
      this.subscribers.set(name, handlers);
      if (window.AGILO_DEBUG) console.log(`[Orch] ${name} inscrit`);
    },
    
    cancelAll() {
      this.subscribers.forEach((h, name) => {
        try { h.cancel?.(); } 
        catch (e) { 
          if (window.AGILO_DEBUG) console.error(`[Orch] ${name} cancel error:`, e); 
        }
      });
    },
    
    setCredentials(creds) {
      if (!creds) return;
      const { token, email, edition } = creds;
      if (token) this.credentials.token = token;
      if (email) this.credentials.email = email;
      if (edition) this.credentials.edition = normEdition(edition);
      
      applyCreds(this.credentials);
      
      window.dispatchEvent(new CustomEvent('agilo:credsUpdated', {
        detail: this.credentials
      }));
    },
    
    async loadJob(jobId, opts = {}) {
      const now = Date.now();
      
      if (now - this.lastDispatchTime < this.minGapMs) {
        if (window.AGILO_DEBUG) console.log(`[Orch] Trop rapide, ignoré`);
        return;
      }
      
      if (jobId === this.currentJobId) {
        if (window.AGILO_DEBUG) console.log(`[Orch] Job ${jobId} déjà actif`);
        return;
      }
      
      this.lastDispatchTime = now;
      this.currentSeq++;
      this.currentJobId = jobId;
      const seq = this.currentSeq;
      
      if (window.AGILO_DEBUG) console.log(`[Orch] Changement vers job ${jobId} (seq=${seq})`);
      
      this.cancelAll();
      await new Promise(r => setTimeout(r, 50));
      
      if (seq !== this.currentSeq) {
        if (window.AGILO_DEBUG) console.log(`[Orch] Seq ${seq} annulée`);
        return;
      }
      
      const autoplay = opts.autoplay ?? false;
      window.dispatchEvent(new CustomEvent('agilo:load', {
        detail: { jobId, autoplay, __orchSeq: seq }
      }));
    }
  };
  
  window.__agiloOrchestrator = orch;
  window.__agiloLoadSeq = () => orch.currentSeq;
  
  // === FUSION : Force edition + écoute token ===
  
  // 1) Force edition dès que possible
  const forceEdition = () => {
    const root = document.getElementById('editorRoot');
    if (root && !root.dataset.edition) {
      const editionFromPage = new URLSearchParams(location.search).get('edition') 
                            || document.documentElement.getAttribute('data-edition')
                            || 'ent';
      root.dataset.edition = editionFromPage;
      if (window.AGILO_DEBUG) console.log('[Orch] Edition forcée:', editionFromPage);
    }
  };
  
  // Essayer immédiatement (si editorRoot existe déjà)
  forceEdition();
  
  // Cleanup functions
  const cleanupFunctions = [];
  
  const forceEditionHandler = () => forceEdition();
  document.addEventListener('DOMContentLoaded', forceEditionHandler);
  cleanupFunctions.push(() => document.removeEventListener('DOMContentLoaded', forceEditionHandler));
  
  // 2) Écoute le token et maj les credentials
  const tokenHandler = (e) => {
    if (e?.detail?.token) {
      orch.setCredentials({
        token:   e.detail.token,
        email:   e.detail.email,
        edition: e.detail.edition
      });
    }
  };
  window.addEventListener('agilo:token', tokenHandler);
  cleanupFunctions.push(() => window.removeEventListener('agilo:token', tokenHandler));
  
  // 3) Au DOMContentLoaded, charge les credentials en cache
  const loadCredsHandler = () => {
    const edition = getEdition();
    const email   = (localStorage.getItem('agilo:username') || '').trim();
    const kUser   = `agilo:token:${edition}:${email.toLowerCase()}`;
    const kEd     = `agilo:token:${edition}`;
    const token   = window.globalToken
                 || localStorage.getItem(kUser)
                 || localStorage.getItem(kEd)
                 || localStorage.getItem('agilo:token')
                 || '';
    
    if (token && email) {
      orch.setCredentials({ token, email, edition });
    }
  };
  document.addEventListener('DOMContentLoaded', loadCredsHandler);
  cleanupFunctions.push(() => document.removeEventListener('DOMContentLoaded', loadCredsHandler));
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cleanupFunctions.forEach(fn => {
      try { fn(); } catch (e) {
        if (window.AGILO_DEBUG) console.error('[Orch] Cleanup error:', e);
      }
    });
  });
  
  if (window.AGILO_DEBUG) console.log('[Orch] Initié. Auth + Orchestration active.');
})();

