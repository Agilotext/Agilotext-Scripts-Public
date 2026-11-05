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
      const p = window.location.pathname;
      const qs = new URLSearchParams(window.location.search).get('edition');
      const root = document.getElementById('editorRoot')?.dataset.edition;
      
      if (p.includes('/app/free/')) return 'free';
      if (p.includes('/app/pro/') || p.includes('/app/premium/')) return 'pro';
      if (p.includes('/app/ent/') || p.includes('/app/business/')) return 'ent';

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

  function countsFromFolderApi(payload) {
    const body = payload || {};
    const rootRaw = body.rootJobsCount != null ? body.rootJobsCount : body.rootCount;
    let rootJobsCount = Number(rootRaw);
    if (!Number.isFinite(rootJobsCount) || rootJobsCount < 0) rootJobsCount = 0;
    const rawList = body.folders || body.transcriptFolderDtos || body.transcriptFolders || body.folderDtos || [];
    let folderSum = 0;
    (Array.isArray(rawList) ? rawList : []).forEach((folder) => {
      const folderId = Number(folder.folderId != null ? folder.folderId : folder.id) || 0;
      const folderName = String(folder.folderName != null ? folder.folderName : folder.name || '').trim();
      if (folderId <= 0 || !folderName) return;
      const jobsCount = Number(folder.jobsCount != null ? folder.jobsCount : folder.count);
      if (Number.isFinite(jobsCount) && jobsCount > 0) folderSum += jobsCount;
    });
    return rootJobsCount + folderSum;
  }

  function fetchAndUpdateReadyCount(token, editionOverride) {
    const userEmail = getUserEmail();
    if (!userEmail || !token) {
      if (window.AGILO_DEBUG) console.error('[ready-count] Email ou token indisponible');
      return;
    }

    const edition = pickEdition(editionOverride);

    const url =
      'https://api.agilotext.com/api/v1/getTranscriptFolders?username=' +
      encodeURIComponent(userEmail) +
      '&token=' +
      encodeURIComponent(token) +
      '&edition=' +
      encodeURIComponent(edition);

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
        if (String(data.status || '').toUpperCase() === 'OK') {
          const countEl = document.getElementById('readyCount');
          if (countEl) countEl.textContent = String(countsFromFolderApi(data));
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
