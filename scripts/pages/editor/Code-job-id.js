// Agilotext - Affichage du Job ID dans l'en-tête de l'éditeur
// Affiche le jobId avec préfixe lisible + copie au clic (.ed-wrap .ri-job-id)

(function ready(fn) {
  if (window.__agiloJobIdLoaded) return;
  window.__agiloJobIdLoaded = true;

  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn, { once: true });
})(() => {
  'use strict';

  function formatJobId(jobId) {
    if (!jobId) return '';
    return 'Job #' + String(jobId).trim();
  }

  function getCurrentJobId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlJobId = urlParams.get('jobId');
    if (urlJobId) {
      if (window.AGILO_DEBUG) console.log('[JobID] Trouvé dans URL:', urlJobId);
      return urlJobId;
    }

    const editorRoot = document.getElementById('editorRoot');
    if (editorRoot) {
      const dataJobId = editorRoot.dataset.jobId || editorRoot.getAttribute('data-job-id');
      if (dataJobId) {
        if (window.AGILO_DEBUG) console.log('[JobID] Trouvé dans #editorRoot:', dataJobId);
        return dataJobId;
      }
    }

    try {
      const storedJobId = localStorage.getItem('agilo:lastJobId');
      if (storedJobId) {
        if (window.AGILO_DEBUG) console.log('[JobID] Trouvé dans localStorage:', storedJobId);
        return storedJobId;
      }
    } catch (_e) {
      /* localStorage non accessible */
    }

    if (window.AGILO_DEBUG) console.log('[JobID] Aucun jobId trouvé');
    return null;
  }

  function bindCopy(jobIdElement, jobId) {
    if (jobIdElement.__copyBound) return;
    jobIdElement.__copyBound = true;
    jobIdElement.addEventListener('click', () => {
      const write = navigator.clipboard?.writeText?.(jobId);
      if (!write) return;
      write.then(() => {
        const orig = jobIdElement.textContent;
        jobIdElement.textContent = 'Copié !';
        setTimeout(() => { jobIdElement.textContent = orig; }, 1200);
      }).catch(() => {});
    });
  }

  function updateEditorJobId() {
    const jobId = getCurrentJobId();
    if (!jobId) {
      if (window.AGILO_DEBUG) console.log('[JobID] Aucun jobId à afficher');
      return 0;
    }

    const jobIdElement = document.querySelector('.ed-wrap .ri-job-id');
    if (!jobIdElement) {
      if (window.AGILO_DEBUG) console.log('[JobID] Élément .ed-wrap .ri-job-id non trouvé');
      return 0;
    }

    const formatted = formatJobId(jobId);
    if (!formatted) return 0;

    jobIdElement.textContent = formatted;
    jobIdElement.title = 'ID : ' + jobId + ' — Cliquer pour copier';
    jobIdElement.style.cursor = 'pointer';
    jobIdElement.style.display = '';
    bindCopy(jobIdElement, jobId);

    if (window.AGILO_DEBUG) console.log('[JobID] Job ID mis à jour:', formatted);
    return 1;
  }

  updateEditorJobId();

  const editorRoot = document.getElementById('editorRoot');
  if (editorRoot) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-job-id') {
          if (window.AGILO_DEBUG) console.log('[JobID] data-job-id modifié, mise à jour...');
          setTimeout(updateEditorJobId, 100);
        }
      });
    });

    observer.observe(editorRoot, {
      attributes: true,
      attributeFilter: ['data-job-id']
    });

    if (window.AGILO_DEBUG) console.log('[JobID] Observer attaché à #editorRoot');
  }

  window.addEventListener('agilo:load', (e) => {
    if (window.AGILO_DEBUG) console.log('[JobID] Event agilo:load reçu', e.detail);

    const newJobId = e?.detail?.jobId || e?.detail;
    if (newJobId) {
      try {
        localStorage.setItem('agilo:lastJobId', newJobId);
      } catch (_e) {
        /* localStorage non accessible */
      }
    }

    setTimeout(updateEditorJobId, 100);
  });

  const checkForElement = setInterval(() => {
    const element = document.querySelector('.ed-wrap .ri-job-id');
    if (element) {
      if (window.AGILO_DEBUG) console.log('[JobID] Élément .ri-job-id détecté, mise à jour...');
      updateEditorJobId();
      clearInterval(checkForElement);
    }
  }, 500);

  setTimeout(() => clearInterval(checkForElement), 10000);

  window.AgiloJobId = window.AgiloJobId || {
    formatJobId,
    updateEditorJobId,
    getCurrentJobId
  };

  if (window.AGILO_DEBUG) console.log('[JobID] Script chargé et initialisé (mode éditeur)');
});
