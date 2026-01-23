// ============================================
// SCRIPT DE NORMALISATION DE LA LARGEUR DU COMPTE-RENDU
// À ajouter dans votre page Webflow
// ============================================

(function() {
  'use strict';
  
  /**
   * Normaliser le HTML du compte-rendu pour qu'il prenne toute la largeur
   * Cette fonction est appelée après chaque chargement de compte-rendu
   */
  function normalizeSummaryWidth() {
    const summaryEditor = document.getElementById('summaryEditor');
    if (!summaryEditor) return;
    
    // Trouver toutes les tables
    const tables = summaryEditor.querySelectorAll('table');
    tables.forEach(table => {
      // Modifier le style inline
      const style = table.getAttribute('style') || '';
      let newStyle = style
        // Remplacer width: 70%, 75%, 80%, 85%, etc. par 100%
        .replace(/width\s*:\s*[67]\d%/gi, 'width: 100%')
        .replace(/width\s*:\s*[89]\d%/gi, 'width: 100%')
        // Retirer margin: auto
        .replace(/margin\s*:\s*auto/gi, 'margin: 0')
        .replace(/margin-left\s*:\s*auto/gi, 'margin-left: 0')
        .replace(/margin-right\s*:\s*auto/gi, 'margin-right: 0');
      
      // Si pas de width dans le style, l'ajouter
      if (!/width\s*:/i.test(newStyle)) {
        newStyle = (newStyle ? newStyle + '; ' : '') + 'width: 100%';
      }
      
      // Si pas de margin dans le style, s'assurer qu'il n'y a pas de margin auto
      if (!/margin\s*:/i.test(newStyle)) {
        newStyle = (newStyle ? newStyle + '; ' : '') + 'margin: 0';
      }
      
      table.setAttribute('style', newStyle);
    });
    
    // Traiter aussi les divs et autres éléments avec width problématique
    const elements = summaryEditor.querySelectorAll('[style*="width"]');
    elements.forEach(el => {
      const style = el.getAttribute('style') || '';
      // Si width est 70-90%, le remplacer par 100%
      if (/width\s*:\s*[67]\d%/i.test(style) || /width\s*:\s*[89]\d%/i.test(style)) {
        let newStyle = style.replace(/width\s*:\s*\d+%/gi, 'width: 100%');
        newStyle = newStyle.replace(/margin\s*:\s*auto/gi, 'margin: 0');
        el.setAttribute('style', newStyle);
      }
    });
  }
  
  /**
   * Observer les changements dans summaryEditor pour normaliser automatiquement
   */
  function setupSummaryWidthNormalizer() {
    const summaryEditor = document.getElementById('summaryEditor');
    if (!summaryEditor) {
      // Réessayer après un délai si l'élément n'existe pas encore
      setTimeout(setupSummaryWidthNormalizer, 500);
      return;
    }
    
    // Normaliser immédiatement
    normalizeSummaryWidth();
    
    // Observer les changements de contenu
    const observer = new MutationObserver(function(mutations) {
      let shouldNormalize = false;
      
      mutations.forEach(function(mutation) {
        // Si du contenu a été ajouté
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldNormalize = true;
        }
        // Si un attribut style a changé
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          shouldNormalize = true;
        }
      });
      
      if (shouldNormalize) {
        // Attendre un peu que le DOM soit stable
        setTimeout(normalizeSummaryWidth, 100);
      }
    });
    
    observer.observe(summaryEditor, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
    
    // Normaliser aussi quand l'onglet Compte-rendu est ouvert
    const summaryTab = document.getElementById('tab-summary');
    if (summaryTab) {
      summaryTab.addEventListener('click', function() {
        setTimeout(normalizeSummaryWidth, 200);
      });
    }
    
    // Normaliser après un changement d'onglet (via MutationObserver)
    const paneSummary = document.getElementById('pane-summary');
    if (paneSummary) {
      const tabObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'hidden') {
            // Si l'onglet devient visible
            if (!paneSummary.hasAttribute('hidden')) {
              setTimeout(normalizeSummaryWidth, 200);
            }
          }
        });
      });
      
      tabObserver.observe(paneSummary, { attributes: true });
    }
  }
  
  // Démarrer quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSummaryWidthNormalizer);
  } else {
    setupSummaryWidthNormalizer();
  }
  
  // Exposer la fonction globalement pour pouvoir l'appeler manuellement
  window.normalizeSummaryWidth = normalizeSummaryWidth;
  
})();

