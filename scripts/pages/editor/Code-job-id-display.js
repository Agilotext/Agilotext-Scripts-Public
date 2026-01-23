// Agilotext - Affichage du Job ID dans l'en-tête de l'éditeur
// Affiche le jobId complet avec formatage pour la lisibilité (dans .ed-wrap)
// ⚠️ Ce fichier est chargé depuis GitHub

(function ready(fn){
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn, { once:true });
})(() => {
  'use strict';

  /**
   * Formate le jobId : garde le numéro tel quel, sans espaces
   * Exemple: "1000013145" → "1000013145"
   */
  function formatJobId(jobId) {
    if (!jobId) return '';
    return String(jobId).trim();
  }
  
  /**
   * Récupère le jobId du job actuellement chargé dans l'éditeur
   */
  function getCurrentJobId() {
    // Priorité 1 : depuis l'URL (?jobId=...)
    const urlParams = new URLSearchParams(window.location.search);
    const urlJobId = urlParams.get('jobId');
    if (urlJobId) {
      if (window.AGILO_DEBUG) console.log('[JobID] Trouvé dans URL:', urlJobId);
      return urlJobId;
    }
    
    // Priorité 2 : depuis #editorRoot data-job-id
    const editorRoot = document.getElementById('editorRoot');
    if (editorRoot) {
      const dataJobId = editorRoot.dataset.jobId || editorRoot.getAttribute('data-job-id');
      if (dataJobId) {
        if (window.AGILO_DEBUG) console.log('[JobID] Trouvé dans #editorRoot:', dataJobId);
        return dataJobId;
      }
    }
    
    // Priorité 3 : depuis localStorage
    try {
      const storedJobId = localStorage.getItem('agilo:lastJobId');
      if (storedJobId) {
        if (window.AGILO_DEBUG) console.log('[JobID] Trouvé dans localStorage:', storedJobId);
        return storedJobId;
      }
    } catch (e) {
      // localStorage non accessible
    }
    
    if (window.AGILO_DEBUG) console.log('[JobID] Aucun jobId trouvé');
    return null;
  }
  
  /**
   * Met à jour l'affichage du jobId dans l'en-tête de l'éditeur (.ed-wrap .ri-job-id)
   */
  function updateEditorJobId() {
    // Récupérer le jobId actuel
    const jobId = getCurrentJobId();
    
    if (!jobId) {
      if (window.AGILO_DEBUG) {
        console.log('[JobID] Aucun jobId à afficher');
      }
      return 0;
    }
    
    // Trouver l'élément .ri-job-id dans l'en-tête éditeur (.ed-wrap)
    const jobIdElement = document.querySelector('.ed-wrap .ri-job-id');
    
    if (!jobIdElement) {
      if (window.AGILO_DEBUG) {
        console.log('[JobID] Élément .ed-wrap .ri-job-id non trouvé');
      }
      return 0;
    }
    
    // Afficher le jobId brut (sans préfixe, sans espaces)
    const formatted = formatJobId(jobId);
    
    if (formatted) {
      jobIdElement.textContent = formatted;
      jobIdElement.style.display = '';
      
      if (window.AGILO_DEBUG) {
        console.log('[JobID] Job ID mis à jour:', formatted);
      }
      
      return 1;
    }
    
    return 0;
  }
  
  /**
   * Initialisation au chargement
   */
  updateEditorJobId();
  
  /**
   * Observer les changements sur #editorRoot pour détecter les changements de job
   */
  const editorRoot = document.getElementById('editorRoot');
  
  if (editorRoot) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Détecter si l'attribut data-job-id a changé
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-job-id') {
          if (window.AGILO_DEBUG) {
            console.log('[JobID] data-job-id modifié, mise à jour...');
          }
          setTimeout(updateEditorJobId, 100);
        }
      });
    });
    
    observer.observe(editorRoot, {
      attributes: true,
      attributeFilter: ['data-job-id']
    });
    
    if (window.AGILO_DEBUG) {
      console.log('[JobID] Observer attaché à #editorRoot');
    }
  }
  
  /**
   * Écouter les événements de chargement de job
   */
  window.addEventListener('agilo:load', (e) => {
    if (window.AGILO_DEBUG) {
      console.log('[JobID] Event agilo:load reçu', e.detail);
    }
    
    // Si un jobId est fourni dans l'event, le sauvegarder
    const newJobId = e?.detail?.jobId || e?.detail;
    if (newJobId) {
      try {
        localStorage.setItem('agilo:lastJobId', newJobId);
      } catch (err) {
        // localStorage non accessible
      }
    }
    
    setTimeout(updateEditorJobId, 100);
  });
  
  /**
   * Observer l'apparition de l'élément .ed-wrap .ri-job-id si pas encore présent
   */
  const checkForElement = setInterval(() => {
    const element = document.querySelector('.ed-wrap .ri-job-id');
    if (element) {
      if (window.AGILO_DEBUG) {
        console.log('[JobID] Élément .ri-job-id détecté, mise à jour...');
      }
      updateEditorJobId();
      clearInterval(checkForElement);
    }
  }, 500);
  
  // Arrêter de chercher après 10 secondes
  setTimeout(() => clearInterval(checkForElement), 10000);
  
  // Export pour usage externe et debug
  window.AgiloJobId = window.AgiloJobId || { 
    formatJobId, 
    updateEditorJobId,
    getCurrentJobId
  };
  
  if (window.AGILO_DEBUG) {
    console.log('[JobID] Script chargé et initialisé (mode éditeur)');
  }
});

