// Agilotext - Ready Count
// ⚠️ Ce fichier est chargé depuis GitHub
// Met à jour le compteur de jobs prêts dans le menu

(function() {
  'use strict';
  
  let checkTokenInterval = null;
  
  function fetchAndUpdateReadyCount(globalToken) {
    const userEmailElement = document.querySelector('[name="memberEmail"]');
    const userEmail = userEmailElement ? userEmailElement.value : null;
    if (!userEmail || !globalToken) {
      if (window.AGILO_DEBUG) console.error("Email utilisateur ou token global non disponible");
      return;
    }

    const url = `https://api.agilotext.com/api/v1/getJobsInfo?username=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(globalToken)}&edition=ent&limit=1000&offset=0`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    })
    .then(response => {
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (data.status === "OK") {
        let readyCount = 0;
        data.jobsInfoDtos.forEach(job => {
          if (job.transcriptStatus === "READY_SUMMARY_READY") {
            readyCount++;
          }
        });
        const countEl = document.getElementById('readyCount');
        if (countEl) countEl.textContent = readyCount;
      } else {
        if (window.AGILO_DEBUG) console.error("Erreur lors de la récupération des jobs:", data.errorMessage);
      }
    })
    .catch(error => {
      clearTimeout(timeout);
      if (error.name !== 'AbortError' && window.AGILO_DEBUG) {
        console.error("Erreur lors de l'appel à l'API getJobsInfo:", error);
      }
    });
  }

  function init() {
    const tryOnce = () => {
      if (typeof globalToken !== 'undefined' && globalToken) {
        if (checkTokenInterval) {
          clearInterval(checkTokenInterval);
          checkTokenInterval = null;
        }
        fetchAndUpdateReadyCount(globalToken);
        return true;
      }
      return false;
    };

    window.addEventListener('agilo:token', () => { tryOnce(); }, { passive: true });
    window.addEventListener('agilo:credsUpdated', (e) => {
      const tok = (e && e.detail && e.detail.token) || (typeof globalToken !== 'undefined' ? globalToken : '');
      if (tok) fetchAndUpdateReadyCount(tok);
    }, { passive: true });

    if (tryOnce()) return;

    checkTokenInterval = setInterval(() => {
      if (tryOnce()) return;
    }, 120);

    setTimeout(() => {
      if (checkTokenInterval) {
        clearInterval(checkTokenInterval);
        checkTokenInterval = null;
        if (window.AGILO_DEBUG) console.warn('[ready-count] Token non disponible après 10s');
      }
    }, 10000);
  }

  // Cleanup
  const cleanup = () => {
    if (checkTokenInterval) {
      clearInterval(checkTokenInterval);
      checkTokenInterval = null;
    }
  };

  // DOMContentLoaded : assez tôt pour enregistrer agilo:token, sans attendre images/fonts (load est trop tard pour le badge).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('beforeunload', cleanup);
})();

