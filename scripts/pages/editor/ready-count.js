// Agilotext - Ready Count
// ⚠️ Ce fichier est chargé depuis GitHub
// Met à jour le compteur de jobs prêts dans le menu (tous plans : free / pro / ent)

(function () {
  'use strict';

  let checkTokenInterval = null;

  const POLL_MS = 200;
  /** Après 10 s on arrêtait le polling : si le jeton arrive à 11 s (Memberstack lent), le badge restait vide. */
  const POLL_MAX_MS = 120000;

  function normalizeEdition(v) {
    v = String(v || '').trim().toLowerCase();
    if (/(^ent$|enterprise|entreprise|business|team|biz)/.test(v)) return 'ent';
    if (/^pro/.test(v)) return 'pro';
    if (/^free|gratuit/.test(v)) return 'free';
    return 'ent';
  }

  /** Aligné token-resolver / rail : query → editorRoot → html → localStorage */
  function resolveEdition() {
    try {
      const qs = new URLSearchParams(location.search).get('edition');
      const root = document.getElementById('editorRoot')?.dataset?.edition;
      const html = document.documentElement.getAttribute('data-edition');
      const ls = localStorage.getItem('agilo:edition');
      return normalizeEdition(qs || root || html || ls || 'ent');
    } catch {
      return 'ent';
    }
  }

  function pickEdition(override) {
    if (override != null && String(override).trim() !== '') {
      return normalizeEdition(override);
    }
    return resolveEdition();
  }

  /** Email parfois rempli après le token (Memberstack) — même sources que les autres scripts */
  function getUserEmail() {
    const v =
      document.querySelector('[name="memberEmail"]')?.value ||
      document.getElementById('memberEmail')?.value ||
      window.memberEmail ||
      localStorage.getItem('agilo:username') ||
      '';
    const t = String(v || '').trim();
    return t || null;
  }

  function fetchAndUpdateReadyCount(token, editionOverride) {
    const userEmail = getUserEmail();
    if (!userEmail || !token) {
      if (window.AGILO_DEBUG) console.error('[ready-count] Email ou token indisponible');
      return;
    }

    const edition = pickEdition(editionOverride);

    const url =
      'https://api.agilotext.com/api/v1/getJobsInfo?username=' +
      encodeURIComponent(userEmail) +
      '&token=' +
      encodeURIComponent(token) +
      '&edition=' +
      encodeURIComponent(edition) +
      '&limit=1000&offset=0';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.status === 'OK') {
          let readyCount = 0;
          data.jobsInfoDtos.forEach((job) => {
            if (job.transcriptStatus === 'READY_SUMMARY_READY') {
              readyCount++;
            }
          });
          const countEl = document.getElementById('readyCount');
          if (countEl) countEl.textContent = readyCount;
        } else {
          if (window.AGILO_DEBUG) console.error('[ready-count] API:', data.errorMessage);
        }
      })
      .catch((error) => {
        clearTimeout(timeout);
        if (error.name !== 'AbortError' && window.AGILO_DEBUG) {
          console.error('[ready-count] getJobsInfo:', error);
        }
      });
  }

  function refreshIfToken(editionHint) {
    if (typeof globalToken !== 'undefined' && globalToken) {
      if (checkTokenInterval) {
        clearInterval(checkTokenInterval);
        checkTokenInterval = null;
      }
      fetchAndUpdateReadyCount(globalToken, editionHint);
      return true;
    }
    return false;
  }

  function init() {
    window.addEventListener(
      'agilo:token',
      (e) => {
        refreshIfToken(e?.detail?.edition);
      },
      { passive: true }
    );

    window.addEventListener(
      'agilo:credsUpdated',
      (e) => {
        const tok = e?.detail?.token || (typeof globalToken !== 'undefined' ? globalToken : '');
        if (tok) fetchAndUpdateReadyCount(tok, e?.detail?.edition);
      },
      { passive: true }
    );

    window.addEventListener(
      'popstate',
      () => {
        if (typeof globalToken !== 'undefined' && globalToken) {
          fetchAndUpdateReadyCount(globalToken);
        }
      },
      { passive: true }
    );

    // Autre onglet / écriture tardive du jeton dans localStorage
    window.addEventListener(
      'storage',
      (e) => {
        if (!e.key) return;
        if (!e.key.startsWith('agilo:token') && e.key !== 'agilo:username') return;
        if (typeof globalToken !== 'undefined' && globalToken) {
          fetchAndUpdateReadyCount(globalToken);
        }
      },
      { passive: true }
    );

    // Onglet reprend le focus : email peut être enfin injecté
    window.addEventListener(
      'focus',
      () => {
        if (typeof globalToken !== 'undefined' && globalToken) {
          fetchAndUpdateReadyCount(globalToken);
        }
      },
      { passive: true }
    );

    if (refreshIfToken()) return;

    const pollStart = Date.now();
    checkTokenInterval = setInterval(() => {
      if (refreshIfToken()) return;
      if (Date.now() - pollStart > POLL_MAX_MS) {
        clearInterval(checkTokenInterval);
        checkTokenInterval = null;
        if (window.AGILO_DEBUG) {
          console.warn('[ready-count] Pas de jeton après', POLL_MAX_MS / 1000, 's — vérifier Memberstack / ordre des scripts');
        }
      }
    }, POLL_MS);
  }

  const cleanup = () => {
    if (checkTokenInterval) {
      clearInterval(checkTokenInterval);
      checkTokenInterval = null;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('beforeunload', cleanup);
})();
