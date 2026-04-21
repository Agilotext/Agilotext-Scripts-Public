// Agilotext - Token Resolver
// ⚠️ Ce fichier est chargé depuis GitHub
// Gère la résolution et le rafraîchissement automatique des tokens
//
// TTL Web ~4 h (API) : on ne doit pas réutiliser indéfiniment le jeton en localStorage
// sans rappeler getToken — sinon receiveText / receiveSummary renvoient error_invalid_token.

(function () {
  'use strict';

  const API_BASE = 'https://api.agilotext.com/api/v1';
  /** Marge sous le TTL Web (4 h) pour rafraîchir avant expiration */
  const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  /** Rafraîchissement périodique si l’onglet reste ouvert (session longue) */
  const PERIODIC_REFRESH_MS = 2 * 60 * 60 * 1000;

  if (typeof window.globalToken === 'undefined') window.globalToken = '';
  /** @type {Promise<void> | null} */
  let inflightPromise = null;

  function normEdition(v) {
    v = String(v || '').toLowerCase().trim();
    if (v === 'business' || v === 'enterprise' || v === 'entreprise' || v === 'biz') return 'ent';
    if (v === 'premium' || v === 'pro') return 'pro';
    return v || 'free';
  }

  function inferEditionFromLocation() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/business')) return 'ent';
    if (path.includes('/premium')) return 'pro';
    if (path.includes('/free')) return 'free';
    return '';
  }

  function tokenKey(email, edition) {
    return `agilo:token:${normEdition(edition)}:${String(email || '').toLowerCase()}`;
  }

  function tokenIssuedAtKey(email, edition) {
    return `agilo:tokenIssuedAt:${normEdition(edition)}:${String(email || '').toLowerCase()}`;
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
      await new Promise((r) => setTimeout(r, 100));
    }
    return '';
  }

  /**
   * @param {{ token: string, email: string, edition: string, fromApi?: boolean }} p
   * fromApi === true : enregistre la date d’émission (getToken API).
   * fromApi === false : réhydrate l’UI sans faire croire que le jeton vient d’être émis.
   */
  function broadcast({ token, email, edition, fromApi }) {
    if (!token) return;
    window.globalToken = token;
    try {
      localStorage.setItem(tokenKey(email, edition), token);
      localStorage.setItem('agilo:username', email);
      localStorage.setItem('agilo:edition', normEdition(edition));
      if (fromApi === true) {
        localStorage.setItem(tokenIssuedAtKey(email, edition), String(Date.now()));
      }
    } catch (err) {
      if (window.AGILO_DEBUG) console.error('[agilo] localStorage error:', err);
    }
    ensureMemberEmailInput(email);
    window.dispatchEvent(new CustomEvent('agilo:token', { detail: { token, email, edition: normEdition(edition) } }));
    if (window.AGILO_DEBUG) console.log('[agilo] token prêt');
  }

  /**
   * @param {{ force?: boolean }} [opts] force=true : attendre tout appel en cours puis refaire un getToken
   *   (liens téléchargement receiveText/receiveSummary avec jeton périmé dans l’URL).
   */
  function fetchTokenFromAPI(email, edition, opts) {
    if (!email) return Promise.resolve();
    const force = !!(opts && opts.force);
    if (inflightPromise && !force) return inflightPromise;

    const previousInflight = force ? inflightPromise : null;

    const p = (async () => {
      if (previousInflight) {
        try {
          await previousInflight;
        } catch {
          /* ignore */
        }
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const url = `${API_BASE}/getToken?username=${encodeURIComponent(email)}&edition=${encodeURIComponent(normEdition(edition))}`;
        const r = await fetch(url, {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal
        });
        clearTimeout(timeout);

        const ct = r.headers.get('content-type') || '';
        const txt = await r.text();

        let data = null;
        if (ct.includes('application/json')) {
          try { data = JSON.parse(txt); } catch { /* ignore */ }
        }
        if (!data) {
          try { data = JSON.parse(txt); } catch (err) {
            if (window.AGILO_DEBUG) console.error('[agilo] getToken non-JSON:', txt.slice(0, 300));
          }
        }

        if (r.ok && data?.status === 'OK' && data?.token) {
          broadcast({ token: data.token, email, edition, fromApi: true });
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
      }
    })();

    inflightPromise = p;
    p.finally(() => {
      if (inflightPromise === p) inflightPromise = null;
    });

    return p;
  }

  /**
   * @param {string} email
   * @param {string} edition
   * @param {boolean} [forceRefresh] si true, rappelle toujours l’API (ex. avant téléchargement)
   */
  async function getToken(email, edition, forceRefresh) {
    if (!email) return;
    if (!forceRefresh && window.globalToken) {
      ensureMemberEmailInput(email);
      return;
    }
    await fetchTokenFromAPI(email, edition, forceRefresh ? { force: true } : undefined);
  }

  function schedulePeriodicTokenRefresh() {
    if (window.__agiloTokenRefreshScheduled) return;
    window.__agiloTokenRefreshScheduled = true;
    setInterval(() => {
      const email = (localStorage.getItem('agilo:username') || '').trim();
      if (!email) return;
      const edition = normEdition(
        window.AGILO_EDITION
        || new URLSearchParams(location.search).get('edition')
        || document.getElementById('editorRoot')?.dataset.edition
        || localStorage.getItem('agilo:edition')
        || 'free'
      );
      fetchTokenFromAPI(email, edition);
    }, PERIODIC_REFRESH_MS);
  }

  const init = async () => {
    const edition = normEdition(
      window.AGILO_EDITION
      || new URLSearchParams(location.search).get('edition')
      || document.getElementById('editorRoot')?.dataset.edition
      || inferEditionFromLocation()
      || localStorage.getItem('agilo:edition')
      || 'free'
    );
    if (window.AGILO_DEBUG) console.log('[agilo] Édition détectée :', edition);
    const email = await resolveEmail();
    if (!email) {
      if (window.AGILO_DEBUG) console.warn('[agilo] Email utilisateur non trouvé');
      return;
    }

    const cached = localStorage.getItem(tokenKey(email, edition));
    const issued = parseInt(localStorage.getItem(tokenIssuedAtKey(email, edition)) || '0', 10);
    const cacheUsable = cached && issued > 0 && (Date.now() - issued < TOKEN_MAX_AGE_MS);

    if (cacheUsable) {
      broadcast({ token: cached, email, edition, fromApi: false });
    }

    await fetchTokenFromAPI(email, edition);
    schedulePeriodicTokenRefresh();
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
})();
