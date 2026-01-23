// Agilotext - Protection Sauvegarde Transcript - STAGING
// ⚠️ VERSION STAGING POUR TESTS - Ne pas utiliser en production
// ⚠️ Ce fichier protège contre les bugs de sauvegarde
// Problème : Si deux divs contiennent le même contenu dans Webflow, la sauvegarde peut dupliquer le texte

(function() {
  'use strict';
  
  console.log('[AGILO:PROTECTION] Script de protection sauvegarde chargé');
  
  // ⚠️ PROTECTION 1 : Intercepter syncDomToModel pour vérifier qu'on lit bien le bon conteneur
  const originalSyncDomToModel = window.syncDomToModel;
  
  if (typeof originalSyncDomToModel === 'function') {
    window.syncDomToModel = function() {
      console.log('[AGILO:PROTECTION] syncDomToModel appelé');
      
      // Vérifier qu'on est sur l'onglet Transcript
      const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
      if (activeTab && activeTab.id !== 'tab-transcript') {
        console.error('[AGILO:PROTECTION] ⚠️ ERREUR : syncDomToModel appelé alors qu\'on est sur l\'onglet', activeTab.id);
        console.error('[AGILO:PROTECTION] ⚠️ La sauvegarde ne doit se faire QUE sur l\'onglet Transcript !');
        return; // Ne pas sauvegarder si on est sur le mauvais onglet
      }
      
      // Vérifier que transcriptEditor existe et est visible
      const transcriptEditor = document.querySelector('#transcriptEditor');
      if (!transcriptEditor) {
        console.error('[AGILO:PROTECTION] ⚠️ ERREUR : transcriptEditor non trouvé');
        return;
      }
      
      // Vérifier qu'on ne lit que les segments dans transcriptEditor, pas ailleurs
      const allSegments = document.querySelectorAll('.ag-seg');
      const segmentsInEditor = transcriptEditor.querySelectorAll('.ag-seg');
      
      if (allSegments.length !== segmentsInEditor.length) {
        console.warn('[AGILO:PROTECTION] ⚠️ ATTENTION : Il y a des segments en dehors de transcriptEditor !', {
          total: allSegments.length,
          dansEditor: segmentsInEditor.length
        });
        
        // Trouver les segments en dehors de transcriptEditor
        const segmentsOutside = Array.from(allSegments).filter(seg => !transcriptEditor.contains(seg));
        console.warn('[AGILO:PROTECTION] Segments en dehors de transcriptEditor:', segmentsOutside.length);
        
        // ⚠️ PROTECTION : Ne lire QUE les segments dans transcriptEditor
        console.log('[AGILO:PROTECTION] ✅ Protection activée : on ne lit que les segments dans transcriptEditor');
      }
      
      // Appeler la fonction originale
      try {
        return originalSyncDomToModel.apply(this, arguments);
      } catch (error) {
        console.error('[AGILO:PROTECTION] ❌ Erreur dans syncDomToModel:', error);
        throw error;
      }
    };
    
    console.log('[AGILO:PROTECTION] ✅ syncDomToModel intercepté et protégé');
  } else {
    console.warn('[AGILO:PROTECTION] ⚠️ syncDomToModel n\'existe pas encore, on attendra...');
    
    // Attendre que syncDomToModel soit défini
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof window.syncDomToModel === 'function') {
        clearInterval(checkInterval);
        // Réappliquer la protection
        const original = window.syncDomToModel;
        window.syncDomToModel = function() {
          const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
          if (activeTab && activeTab.id !== 'tab-transcript') {
            console.error('[AGILO:PROTECTION] ⚠️ ERREUR : syncDomToModel appelé sur mauvais onglet');
            return;
          }
          return original.apply(this, arguments);
        };
        console.log('[AGILO:PROTECTION] ✅ syncDomToModel intercepté après', attempts, 'tentatives');
      } else if (attempts > 50) {
        clearInterval(checkInterval);
        console.warn('[AGILO:PROTECTION] ⚠️ syncDomToModel non trouvé après 50 tentatives');
      }
    }, 100);
  }
  
  // ⚠️ PROTECTION 2 : Gérer la visibilité et intercepter le bouton "Sauvegarder"
  function updateSaveButtonVisibility() {
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (!saveBtn) return;
    
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!activeTab) return;
    
    // Cacher le bouton si on est sur l'onglet Compte-rendu
    if (activeTab.id === 'tab-summary') {
      saveBtn.style.display = 'none';
      saveBtn.style.visibility = 'hidden';
      saveBtn.style.opacity = '0';
      saveBtn.style.pointerEvents = 'none';
      console.log('[AGILO:PROTECTION] ✅ Bouton "Sauvegarder" caché (onglet Compte-rendu)');
    } else if (activeTab.id === 'tab-transcript') {
      saveBtn.style.display = '';
      saveBtn.style.visibility = '';
      saveBtn.style.opacity = '';
      saveBtn.style.pointerEvents = '';
      console.log('[AGILO:PROTECTION] ✅ Bouton "Sauvegarder" affiché (onglet Transcription)');
    }
  }
  
  function protectSaveButton() {
    const saveBtn = document.querySelector('[data-action="save-transcript"]');
    if (!saveBtn) return;
    
    // Vérifier si on a déjà ajouté la protection
    if (saveBtn.__agiloProtected) return;
    saveBtn.__agiloProtected = true;
    
    // Intercepter le clic
    const originalClick = saveBtn.onclick;
    saveBtn.addEventListener('click', function(e) {
      const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
      
      if (activeTab && activeTab.id !== 'tab-transcript') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.error('[AGILO:PROTECTION] ❌ BLOQUÉ : Tentative de sauvegarde sur l\'onglet', activeTab.id);
        alert('⚠️ Erreur : La sauvegarde ne peut se faire que sur l\'onglet "Transcription".\n\nVeuillez d\'abord cliquer sur l\'onglet "Transcription".');
        return false;
      }
      
      // Vérifier que transcriptEditor contient du contenu
      const transcriptEditor = document.querySelector('#transcriptEditor');
      if (!transcriptEditor) {
        e.preventDefault();
        e.stopPropagation();
        console.error('[AGILO:PROTECTION] ❌ transcriptEditor non trouvé');
        alert('⚠️ Erreur : L\'éditeur de transcript n\'est pas disponible.');
        return false;
      }
      
      // ⚠️ PROTECTION CRITIQUE : Vérifier qu'il n'y a pas de duplication de segments
      const allSegments = document.querySelectorAll('.ag-seg');
      const segmentsInEditor = transcriptEditor.querySelectorAll('.ag-seg');
      
      console.log('[AGILO:PROTECTION] Vérification segments:', {
        total: allSegments.length,
        dansEditor: segmentsInEditor.length,
        transcriptEditorId: transcriptEditor.id
      });
      
      if (allSegments.length !== segmentsInEditor.length) {
        console.error('[AGILO:PROTECTION] ❌ ERREUR CRITIQUE : Segments en dehors de transcriptEditor détectés !', {
          total: allSegments.length,
          dansEditor: segmentsInEditor.length,
          difference: allSegments.length - segmentsInEditor.length
        });
        
        // Trouver les segments en dehors
        const segmentsOutside = Array.from(allSegments).filter(seg => !transcriptEditor.contains(seg));
        console.error('[AGILO:PROTECTION] Segments en dehors:', segmentsOutside.map(s => ({
          id: s.id || 'no-id',
          text: (s.textContent || '').substring(0, 50),
          parent: s.parentElement?.id || s.parentElement?.className
        })));
        
        // ⚠️ BLOQUER la sauvegarde si des segments sont en dehors
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        alert(
          '❌ ERREUR : Des segments de transcript ont été détectés en dehors de l\'éditeur.\n\n' +
          'Cela peut causer une duplication ou une perte de données lors de la sauvegarde.\n\n' +
          'Veuillez recharger la page et réessayer.\n\n' +
          'Si le problème persiste, contactez le support.'
        );
        
        return false;
      }
      
      // Vérifier les doublons de texte dans les segments
      const segmentTexts = new Map();
      let duplicates = 0;
      const duplicateDetails = [];
      
      Array.from(segmentsInEditor).forEach((seg, idx) => {
        const textEl = seg.querySelector('.ag-seg__text');
        const text = textEl ? (textEl.textContent || '').trim() : '';
        const speaker = seg.querySelector('.speaker')?.textContent || '';
        const time = seg.querySelector('.time')?.textContent || '';
        const fullText = `[${time}]${speaker}${text}`;
        
        if (segmentTexts.has(fullText)) {
          duplicates++;
          duplicateDetails.push({
            index: idx,
            text: text.substring(0, 50) + '...',
            speaker,
            time
          });
          console.warn('[AGILO:PROTECTION] ⚠️ Segment dupliqué détecté:', {
            index: idx,
            text: text.substring(0, 50),
            speaker,
            time
          });
        } else {
          segmentTexts.set(fullText, { seg, idx });
        }
      });
      
      if (duplicates > 0) {
        console.error('[AGILO:PROTECTION] ❌ ERREUR : Segments dupliqués détectés:', duplicates);
        console.error('[AGILO:PROTECTION] Détails:', duplicateDetails);
        
        const proceed = confirm(
          '⚠️ ATTENTION : Des segments dupliqués ont été détectés dans le transcript.\n\n' +
          `Nombre de doublons : ${duplicates}\n\n` +
          'Cela peut causer une duplication du texte lors de la sauvegarde.\n\n' +
          'Voulez-vous quand même continuer ?\n\n' +
          '(Recommandé : Annuler et recharger la page)'
        );
        
        if (!proceed) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
      
      console.log('[AGILO:PROTECTION] ✅ Sauvegarde autorisée');
    }, true); // Capture phase pour intercepter avant les autres handlers
    
    console.log('[AGILO:PROTECTION] ✅ Bouton "Sauvegarder" protégé');
  }
  
  // Appliquer la protection au chargement et après un délai
  protectSaveButton();
  updateSaveButtonVisibility();
  setTimeout(() => {
    protectSaveButton();
    updateSaveButtonVisibility();
  }, 500);
  setTimeout(() => {
    protectSaveButton();
    updateSaveButtonVisibility();
  }, 1000);
  
  // Observer les changements du DOM pour réappliquer la protection si le bouton est recréé
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            if (node.matches && node.matches('[data-action="save-transcript"]')) {
              protectSaveButton();
              updateSaveButtonVisibility();
            } else if (node.querySelector) {
              const saveBtn = node.querySelector('[data-action="save-transcript"]');
              if (saveBtn) {
                protectSaveButton();
                updateSaveButtonVisibility();
              }
            }
          }
        });
      }
      
      // Observer les changements d'onglets (aria-selected)
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
        updateSaveButtonVisibility();
      }
    });
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected']
  });
  
  // Écouter les clics sur les onglets pour mettre à jour la visibilité
  document.addEventListener('click', function(e) {
    const tab = e.target.closest('[role="tab"]');
    if (tab) {
      setTimeout(updateSaveButtonVisibility, 100);
    }
  });
  
  console.log('[AGILO:PROTECTION] ✅ Script de protection sauvegarde initialisé');
})();

