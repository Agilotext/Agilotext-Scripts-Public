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
    // Vérification de la disponibilité du token global avant d'exécuter la fonction de mise à jour
    checkTokenInterval = setInterval(() => {
      if (typeof globalToken !== 'undefined' && globalToken) {
        clearInterval(checkTokenInterval);
        checkTokenInterval = null;
        fetchAndUpdateReadyCount(globalToken);
      }
    }, 100); // Interval de vérification toutes les 100ms
    
    // Timeout de sécurité : arrêter après 10 secondes si le token n'arrive pas
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

  if (document.readyState === 'loading') {
    window.addEventListener('load', init);
    window.addEventListener('beforeunload', cleanup);
  } else {
    init();
    window.addEventListener('beforeunload', cleanup);
  }
})();

