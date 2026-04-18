// Agilotext - Ready Count
// ⚠️ Ce fichier est chargé depuis GitHub
// Met à jour le compteur de jobs prêts dans le menu (tous plans : free / pro / ent)

(function () {
  'use strict';

  let checkTokenInterval = null;

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

  function fetchAndUpdateReadyCount(token, editionOverride) {
    const userEmailElement = document.querySelector('[name="memberEmail"]');
    const userEmail = userEmailElement ? userEmailElement.value : null;
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

    // Navigation client (changement ?edition= sans reload complet)
    window.addEventListener(
      'popstate',
      () => {
        if (typeof globalToken !== 'undefined' && globalToken) {
          fetchAndUpdateReadyCount(globalToken);
        }
      },
      { passive: true }
    );

    if (refreshIfToken()) return;

    checkTokenInterval = setInterval(() => {
      if (refreshIfToken()) return;
    }, 120);

    setTimeout(() => {
      if (checkTokenInterval) {
        clearInterval(checkTokenInterval);
        checkTokenInterval = null;
        if (window.AGILO_DEBUG) console.warn('[ready-count] Token non disponible après 10s');
      }
    }, 10000);
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
