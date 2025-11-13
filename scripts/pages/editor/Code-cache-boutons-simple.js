// Agilotext - Cache Boutons Simple (Solution Directe)
// ⚠️ Ce script cache directement les boutons selon l'onglet actif
// À charger APRÈS tous les autres scripts

(function() {
  'use strict';
  
  console.log('[AGILO:CACHE] ✅ Script de cache simple chargé');
  
  // ============================================
  // FONCTION PRINCIPALE : Cacher/Afficher les boutons
  // ============================================
  
  function cacheBoutons() {
    // 1. Bouton Sauvegarder
    const saveBtn = document.querySelector('[data-action="save-transcript"]') || 
                    document.querySelector('button.button.save[data-opentech-ux-zone-id]') || 
                    document.querySelector('button.button.save');
    
    // 2. Bouton Régénérer
    const regenBtn = document.querySelector('[data-action="relancer-compte-rendu"]');
    
    // 3. Détecter l'onglet actif (plusieurs méthodes pour être sûr)
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const paneChat = document.querySelector('#pane-chat');
    const paneSummary = document.querySelector('#pane-summary');
    const paneTranscript = document.querySelector('#pane-transcript');
    
    // Vérifier quel panneau est visible
    const isChatActive = (activeTab?.id === 'tab-chat') || 
                         (paneChat && !paneChat.hasAttribute('hidden') && 
                          (paneChat.classList.contains('is-active') || 
                           window.getComputedStyle(paneChat).display !== 'none'));
    
    const isSummaryActive = (activeTab?.id === 'tab-summary') || 
                            (paneSummary && !paneSummary.hasAttribute('hidden') && 
                             (paneSummary.classList.contains('is-active') || 
                              window.getComputedStyle(paneSummary).display !== 'none'));
    
    const isTranscriptActive = (activeTab?.id === 'tab-transcript') || 
                               (paneTranscript && !paneTranscript.hasAttribute('hidden') && 
                                (paneTranscript.classList.contains('is-active') || 
                                 window.getComputedStyle(paneTranscript).display !== 'none'));
    
    console.log('[AGILO:CACHE] 🔍 État onglets:', {
      activeTabId: activeTab?.id,
      isChatActive,
      isSummaryActive,
      isTranscriptActive,
      saveBtnExists: !!saveBtn,
      regenBtnExists: !!regenBtn
    });
    
    // ============================================
    // BOUTON SAUVEGARDER
    // ============================================
    if (saveBtn) {
      if (isChatActive || isSummaryActive) {
        // CACHER avec animation
        saveBtn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        saveBtn.style.opacity = '0';
        saveBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          saveBtn.style.setProperty('display', 'none', 'important');
          saveBtn.style.setProperty('visibility', 'hidden', 'important');
          saveBtn.style.setProperty('pointer-events', 'none', 'important');
          saveBtn.classList.add('agilo-hide-save');
        }, 300);
        console.log('[AGILO:CACHE] ✅ Bouton Sauvegarder caché (onglet Conversation ou Compte-rendu)');
      } else if (isTranscriptActive) {
        // AFFICHER avec animation
        saveBtn.style.setProperty('display', 'flex', 'important');
        saveBtn.style.setProperty('visibility', 'visible', 'important');
        saveBtn.style.setProperty('pointer-events', 'auto', 'important');
        saveBtn.classList.remove('agilo-hide-save');
        setTimeout(() => {
          saveBtn.style.opacity = '1';
          saveBtn.style.transform = 'scale(1)';
        }, 10);
        console.log('[AGILO:CACHE] ✅ Bouton Sauvegarder affiché (onglet Transcription)');
      }
    }
    
    // ============================================
    // BOUTON RÉGÉNÉRER
    // ============================================
    if (regenBtn) {
      // Vérifier si un compte-rendu existe
      const editorRoot = document.querySelector('#editorRoot');
      const summaryEmpty = editorRoot?.dataset.summaryEmpty === '1';
      
      // Vérifier aussi dans le DOM
      const summaryEditor = document.querySelector('#summaryEditor');
      const hasSummaryContent = summaryEditor && 
                                summaryEditor.innerHTML && 
                                !summaryEditor.innerHTML.includes('pas encore disponible') &&
                                !summaryEditor.innerHTML.includes('Résumé en préparation') &&
                                !summaryEditor.querySelector('.summary-loading-indicator');
      
      const shouldShowRegen = !summaryEmpty && hasSummaryContent && (isSummaryActive || (isTranscriptActive && !summaryEmpty));
      
      console.log('[AGILO:CACHE] 🔍 État bouton Régénérer:', {
        summaryEmpty,
        hasSummaryContent,
        shouldShowRegen,
        isSummaryActive,
        isTranscriptActive
      });
      
      if (shouldShowRegen) {
        // AFFICHER avec animation
        regenBtn.style.setProperty('display', 'flex', 'important');
        regenBtn.style.setProperty('visibility', 'visible', 'important');
        regenBtn.style.setProperty('pointer-events', 'auto', 'important');
        regenBtn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => {
          regenBtn.style.opacity = '1';
          regenBtn.style.transform = 'scale(1)';
        }, 10);
        console.log('[AGILO:CACHE] ✅ Bouton Régénérer affiché');
      } else {
        // CACHER avec animation
        regenBtn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        regenBtn.style.opacity = '0';
        regenBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          regenBtn.style.setProperty('display', 'none', 'important');
          regenBtn.style.setProperty('visibility', 'hidden', 'important');
          regenBtn.style.setProperty('pointer-events', 'none', 'important');
        }, 300);
        console.log('[AGILO:CACHE] ✅ Bouton Régénérer caché (pas de compte-rendu ou mauvais onglet)');
      }
    }
  }
  
  // ============================================
  // ÉCOUTER LES CHANGEMENTS D'ONGLETS
  // ============================================
  
  function setupListeners() {
    // 1. Écouter les clics sur les onglets
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) {
        console.log('[AGILO:CACHE] 🖱️ Clic sur onglet:', tab.id);
        setTimeout(cacheBoutons, 100); // Attendre que le DOM se mette à jour
        setTimeout(cacheBoutons, 300); // Double vérification
      }
    }, true); // Capture phase pour intercepter avant les autres scripts
    
    // 2. Observer les changements d'attributs
    const observer = new MutationObserver(() => {
      cacheBoutons();
    });
    
    // Observer les onglets
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      observer.observe(tab, { 
        attributes: true, 
        attributeFilter: ['aria-selected', 'class'] 
      });
    });
    
    // Observer les panneaux
    const panes = document.querySelectorAll('#pane-chat, #pane-summary, #pane-transcript');
    panes.forEach(pane => {
      observer.observe(pane, { 
        attributes: true, 
        attributeFilter: ['hidden', 'class'] 
      });
    });
    
    // Observer le dataset de editorRoot (pour summaryEmpty)
    const editorRoot = document.querySelector('#editorRoot');
    if (editorRoot) {
      observer.observe(editorRoot, { 
        attributes: true, 
        attributeFilter: ['data-summary-empty'] 
      });
    }
    
    console.log('[AGILO:CACHE] ✅ Listeners configurés');
  }
  
  // ============================================
  // INITIALISATION
  // ============================================
  
  function init() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          setupListeners();
          cacheBoutons();
        }, 500);
      });
    } else {
      setTimeout(() => {
        setupListeners();
        cacheBoutons();
      }, 500);
    }
    
    // Vérifier plusieurs fois au cas où
    setTimeout(cacheBoutons, 1000);
    setTimeout(cacheBoutons, 2000);
    setTimeout(cacheBoutons, 3000);
  }
  
  // Exposer la fonction globalement pour debug
  window.agiloCacheBoutons = cacheBoutons;
  
  init();
  
  console.log('[AGILO:CACHE] ✅ Script initialisé');
})();

