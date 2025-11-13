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
    
    if (!saveBtn) return; // Pas de bouton, on arrête
    
    // 2. Bouton Régénérer
    const regenBtn = document.querySelector('[data-action="relancer-compte-rendu"]');
    
    // 3. ✅ DÉTECTION ULTRA-ROBUSTE : Priorité absolue à aria-selected
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    
    // Si on a un onglet avec aria-selected="true", c'est la source de vérité absolue
    let isChatActive = false;
    let isSummaryActive = false;
    let isTranscriptActive = false;
    
    if (activeTab) {
      // Source de vérité : aria-selected="true"
      if (activeTab.id === 'tab-chat') {
        isChatActive = true;
      } else if (activeTab.id === 'tab-summary') {
        isSummaryActive = true;
      } else if (activeTab.id === 'tab-transcript') {
        isTranscriptActive = true;
      }
    } else {
      // Fallback : vérifier les panneaux
      const paneChat = document.querySelector('#pane-chat');
      const paneSummary = document.querySelector('#pane-summary');
      const paneTranscript = document.querySelector('#pane-transcript');
      
      isChatActive = paneChat && !paneChat.hasAttribute('hidden') && 
                     (paneChat.classList.contains('is-active') || 
                      window.getComputedStyle(paneChat).display !== 'none');
      
      isSummaryActive = paneSummary && !paneSummary.hasAttribute('hidden') && 
                        (paneSummary.classList.contains('is-active') || 
                         window.getComputedStyle(paneSummary).display !== 'none');
      
      isTranscriptActive = paneTranscript && !paneTranscript.hasAttribute('hidden') && 
                           (paneTranscript.classList.contains('is-active') || 
                            window.getComputedStyle(paneTranscript).display !== 'none');
    }
    
    console.log('[AGILO:CACHE] 🔍 État onglets:', {
      activeTabId: activeTab?.id,
      isChatActive,
      isSummaryActive,
      isTranscriptActive,
      saveBtnExists: !!saveBtn,
      regenBtnExists: !!regenBtn
    });
    
    // ============================================
    // BOUTON SAUVEGARDER - FORCE ABSOLUE
    // ============================================
    if (isChatActive || isSummaryActive) {
      // ✅ CACHER IMMÉDIATEMENT ET FORCER avec !important
      // Pas d'animation, on force directement pour éviter qu'un autre script le réaffiche
      saveBtn.style.setProperty('display', 'none', 'important');
      saveBtn.style.setProperty('visibility', 'hidden', 'important');
      saveBtn.style.setProperty('opacity', '0', 'important');
      saveBtn.style.setProperty('pointer-events', 'none', 'important');
      saveBtn.style.setProperty('position', 'absolute', 'important');
      saveBtn.style.setProperty('left', '-9999px', 'important');
      saveBtn.classList.add('agilo-hide-save');
      saveBtn.setAttribute('aria-hidden', 'true');
      saveBtn.setAttribute('hidden', 'true');
      
      // ✅ Créer un style CSS global pour forcer le cache (au cas où)
      if (!document.querySelector('#agilo-force-hide-save-style')) {
        const style = document.createElement('style');
        style.id = 'agilo-force-hide-save-style';
        style.textContent = `
          button[data-action="save-transcript"].agilo-hide-save,
          button.button.save.agilo-hide-save {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
          }
        `;
        document.head.appendChild(style);
      }
      
      const tabName = isChatActive ? 'Conversation' : 'Compte-rendu';
      console.log(`[AGILO:CACHE] ✅✅✅ Bouton Sauvegarder FORCÉ à être caché (onglet ${tabName})`, {
        activeTabId: activeTab?.id,
        computedDisplay: window.getComputedStyle(saveBtn).display,
        styleDisplay: saveBtn.style.display
      });
    } else if (isTranscriptActive) {
      // AFFICHER uniquement si on est vraiment sur Transcription
      saveBtn.style.removeProperty('display');
      saveBtn.style.removeProperty('visibility');
      saveBtn.style.removeProperty('opacity');
      saveBtn.style.removeProperty('pointer-events');
      saveBtn.style.removeProperty('position');
      saveBtn.style.removeProperty('left');
      saveBtn.classList.remove('agilo-hide-save');
      saveBtn.removeAttribute('aria-hidden');
      saveBtn.removeAttribute('hidden');
      console.log('[AGILO:CACHE] ✅ Bouton Sauvegarder affiché (onglet Transcription)');
    } else {
      // Par défaut, cacher (sécurité)
      saveBtn.style.setProperty('display', 'none', 'important');
      saveBtn.style.setProperty('visibility', 'hidden', 'important');
      saveBtn.style.setProperty('opacity', '0', 'important');
      saveBtn.style.setProperty('pointer-events', 'none', 'important');
      saveBtn.classList.add('agilo-hide-save');
      console.log('[AGILO:CACHE] ✅ Bouton Sauvegarder caché par défaut (onglet inconnu)');
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
    // 1. ✅ Écouter les clics sur les onglets EN PHASE DE CAPTURE (avant tout)
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) {
        console.log('[AGILO:CACHE] 🖱️ Clic sur onglet:', tab.id);
        // Forcer immédiatement
        cacheBoutons();
        // Puis vérifier plusieurs fois pour être sûr
        setTimeout(cacheBoutons, 50);
        setTimeout(cacheBoutons, 100);
        setTimeout(cacheBoutons, 200);
        setTimeout(cacheBoutons, 500);
      }
    }, true); // Capture phase pour intercepter AVANT les autres scripts
    
    // ✅ NOUVEAU : Surveiller en continu avec un intervalle (solution de force brute)
    setInterval(() => {
      const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
      if (activeTab && (activeTab.id === 'tab-chat' || activeTab.id === 'tab-summary')) {
        const saveBtn = document.querySelector('[data-action="save-transcript"]') || 
                        document.querySelector('button.button.save');
        if (saveBtn && window.getComputedStyle(saveBtn).display !== 'none') {
          // Un autre script l'a réaffiché, on le cache à nouveau
          console.warn('[AGILO:CACHE] ⚠️ Bouton réaffiché par un autre script, re-cache...');
          cacheBoutons();
        }
      }
    }, 500); // Vérifier toutes les 500ms
    
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

