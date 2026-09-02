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
      document.querySelectorAll(
        'a[href*="receiveText"], a[href*="receiveSummary"], a[href*="receiveAudio"]'
      ).forEach(a => {
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

  // Avant ouverture des téléchargements API : le href contient un token figé (souvent périmé si onglet ouvert longtemps).
  // On force toujours un getToken frais puis on reconstruit l’URL (évite Invalid Token sur receiveText / receiveSummary).
  const AGILO_API_V1 = 'https://api.agilotext.com/api/v1';
  const FREE_RESTRICTED_FORMATS = new Set(['doc', 'pdf']);
  const AUDIO_EXPIRED_MESSAGE = (typeof window.agiloRetentionMessages === 'function'
    ? window.agiloRetentionMessages('', 'audio_expired')
    : (window.agiloAudioExpiredMessage
      || 'Cet audio n’est plus disponible : il a été supprimé selon la durée de conservation de votre offre.'));
  const AUTH_HINT_RE = /(invalid token|expired token|token invalide|jeton invalide|unauthorized|forbidden|authentication|authentification|missing token|error_invalid_token|error_token)/i;

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  function isAudioExpiredPayload(payload) {
    if (typeof window.agiloIsAudioExpiredPayload === 'function') {
      try { return !!window.agiloIsAudioExpiredPayload(payload); } catch (_) {}
    }
    const txt = (payload == null) ? '' : String(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return txt.toLowerCase().includes('error_audio_file_expired');
  }

  function isAuthPayload(payload, statusCode) {
    if (statusCode === 401 || statusCode === 403) return true;
    if (!payload) return false;
    const txt = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return AUTH_HINT_RE.test(String(txt || ''));
  }

  function formatFailureMessage(payload, fallbackPrimary) {
    if (typeof window.agiloJobErrorParts === 'function') {
      try {
        const parts = window.agiloJobErrorParts(
          typeof payload === 'object' && payload ? payload : { userErrorMessage: String(payload || '') },
          fallbackPrimary
        );
        return parts?.primary || fallbackPrimary;
      } catch (_) {}
    }
    return fallbackPrimary;
  }

  function isAudioReceiveUrl(url) {
    return /\/receiveAudio(?:[/?#]|$)/i.test(String(url || ''));
  }

  async function verifyAudioAsset(url) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          Range: 'bytes=0-0',
          Accept: 'audio/*,application/octet-stream,application/json,text/plain,text/html;q=0.9'
        }
      });
      clearTimeout(timer);

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const cd = r.headers.get('content-disposition') || '';
      const binaryOk = r.ok && (
        ct.indexOf('audio/') === 0 ||
        ct.indexOf('application/octet-stream') === 0 ||
        /attachment|filename=/i.test(cd)
      );

      if (binaryOk) {
        try { await r.body?.cancel?.(); } catch (_) {}
        return { ok: true };
      }

      const text = await r.text().catch(() => '');
      const payload = tryParseJson(text) || text;

      if (isAudioExpiredPayload(payload)) {
        return { ok: false, type: 'audio_expired', message: AUDIO_EXPIRED_MESSAGE };
      }
      if (isAuthPayload(payload, r.status)) {
        return { ok: false, type: 'auth' };
      }
      if (typeof payload === 'object' && payload && String(payload.status || '').toUpperCase() === 'OK') {
        return { ok: true };
      }

      return {
        ok: false,
        type: 'generic',
        message: formatFailureMessage(payload, 'Impossible de récupérer cet audio pour le moment.')
      };
    } catch (err) {
      if (window.AGILO_DEBUG) console.error('[Orch] verifyAudioAsset error:', err);
      return {
        ok: false,
        type: 'generic',
        message: 'Impossible de récupérer cet audio pour le moment.'
      };
    }
  }

  const downloadClickHandler = (e) => {
    const a = e.target.closest?.(
      'a[href*="/api/v1/receiveText"], a[href*="/api/v1/receiveSummary"], a[href*="/api/v1/receiveAudio"]'
    );
    if (!a || a.getAttribute('data-agilo-skip-token-refresh') === 'true') return;
    const href = a.getAttribute('href');
    if (!href || !href.includes('api.agilotext.com')) return;

    e.preventDefault();
    e.stopPropagation();

    const email = (
      orch.credentials.email
      || localStorage.getItem('agilo:username')
      || document.querySelector('[name="memberEmail"]')?.value
      || ''
    ).trim();
    const edition = orch.credentials.edition || getEdition();
    const targetWin = a.getAttribute('target') || '_blank';

    try {
      const initialUrl = new URL(href, location.href);
      const fmt = String(initialUrl.searchParams.get('format') || '').toLowerCase();
      if (normEdition(edition) === 'free' && FREE_RESTRICTED_FORMATS.has(fmt)) {
        if (window.AgiloGate?.showUpgrade) {
          window.AgiloGate.showUpgrade('pro', 'Formats DOC/PDF');
        } else {
          window.alert('Format réservé aux offres Pro et Business.');
        }
        return;
      }
    } catch (_) {
      // no-op: fallback to legacy flow below
    }

    const openWithHref = (url) => {
      if (targetWin === '_blank') window.open(url, '_blank', 'noopener,noreferrer');
      else window.location.assign(url);
    };

    const fallbackFetchToken = async () => {
      if (!email) return;
      try {
        const url = `${AGILO_API_V1}/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(edition)}`;
        const r = await fetch(url, { cache: 'no-store', credentials: 'omit' });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.status === 'OK' && data?.token) {
          window.globalToken = data.token;
          orch.setCredentials({ token: data.token, email, edition });
        }
      } catch (err) {
        if (window.AGILO_DEBUG) console.error('[Orch] getToken fallback:', err);
      }
    };

    (async () => {
      try {
        if (email && typeof window.getToken === 'function') {
          await window.getToken(email, edition, true);
        } else if (email) {
          await fallbackFetchToken();
        }
      } catch (err) {
        if (window.AGILO_DEBUG) console.error('[Orch] refresh avant téléchargement:', err);
      }

      const tok = window.globalToken || orch.credentials.token;
      if (!tok) {
        window.alert(
          'Impossible de renouveler votre accès Agilotext (jeton manquant). Rechargez la page puis réessayez le téléchargement.'
        );
        return;
      }

      try {
        const u = new URL(href, location.href);
        u.searchParams.set('token', tok);
        if (email) u.searchParams.set('username', email);
        const root = document.getElementById('editorRoot');
        if (root?.dataset?.edition) u.searchParams.set('edition', root.dataset.edition);
        const nextUrl = u.toString();

        if (isAudioReceiveUrl(nextUrl)) {
          const check = await verifyAudioAsset(nextUrl);
          if (!check.ok) {
            if (check.type === 'audio_expired') {
              const jobId = u.searchParams.get('jobId') || '';
              window.dispatchEvent(new CustomEvent('agilo:audioUnavailable', {
                detail: { jobId, code: 'error_audio_file_expired', message: check.message || AUDIO_EXPIRED_MESSAGE }
              }));
              window.alert(check.message || AUDIO_EXPIRED_MESSAGE);
              return;
            }
            if (check.type === 'auth') {
              window.alert(
                'Impossible de renouveler votre accès Agilotext (jeton invalide ou expiré). Rechargez la page puis réessayez le téléchargement.'
              );
              return;
            }
            window.alert(check.message || 'Impossible de récupérer cet audio pour le moment.');
            return;
          }
        }

        openWithHref(nextUrl);
      } catch (err) {
        if (window.AGILO_DEBUG) console.error('[Orch] URL téléchargement:', err);
        openWithHref(href);
      }
    })();
  };
  document.addEventListener('click', downloadClickHandler, true);
  cleanupFunctions.push(() => document.removeEventListener('click', downloadClickHandler, true));

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
