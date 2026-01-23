(function() {
  console.log('=== DIAGNOSTIC COMPLET BOUTON SAVE ===\n');
  
  // 1. Vérifier si le script est chargé
  console.log('1. SCRIPT SAVE:');
  const scriptLoaded1 = typeof window.__agiloSave_FULL_12_JSON_CONTENT !== 'undefined';
  const scriptLoaded2 = typeof window.__agiloSave_MANUAL_SIMPLE !== 'undefined';
  console.log('   ✅ __agiloSave_FULL_12_JSON_CONTENT:', scriptLoaded1 ? 'OUI' : '❌ NON');
  console.log('   ✅ __agiloSave_MANUAL_SIMPLE:', scriptLoaded2 ? 'OUI' : '❌ NON');
  console.log('   ✅ agiloSaveNow:', typeof window.agiloSaveNow === 'function' ? 'OUI' : '❌ NON');
  console.log('   ✅ agiloGetState:', typeof window.agiloGetState === 'function' ? 'OUI' : '❌ NON');
  
  if (!scriptLoaded1 && !scriptLoaded2) {
    console.log('   ❌ PROBLÈME: Aucun script save n\'est chargé !');
    console.log('   💡 Vérifiez que le script est bien dans Webflow et que la page est publiée');
  }
  
  // 2. Vérifier le bouton
  console.log('\n2. BOUTON:');
  const btn1 = document.querySelector('[data-action="save-transcript"]');
  const btn2 = document.querySelector('button.button.save[data-opentech-ux-zone-id]');
  const btn3 = document.querySelector('button.button.save');
  const btn = btn1 || btn2 || btn3;
  
  console.log('   ✅ data-action="save-transcript":', btn1 ? 'TROUVÉ' : '❌ NON TROUVÉ');
  console.log('   ✅ button.button.save[data-opentech]:', btn2 ? 'TROUVÉ' : 'NON TROUVÉ');
  console.log('   ✅ button.button.save:', btn3 ? 'TROUVÉ' : 'NON TROUVÉ');
  
  if (btn) {
    console.log('   ✅ Bouton final:', btn);
    console.log('   ✅ Text:', btn.textContent);
    console.log('   ✅ Visible:', btn.offsetParent !== null ? 'OUI' : '❌ NON');
    console.log('   ✅ Disabled:', btn.disabled ? '❌ OUI' : 'NON');
    console.log('   ✅ Data-action:', btn.getAttribute('data-action') || 'AUCUN');
    console.log('   ✅ Classes:', btn.className);
    console.log('   ✅ Style display:', window.getComputedStyle(btn).display);
    console.log('   ✅ Style visibility:', window.getComputedStyle(btn).visibility);
    console.log('   ✅ Style opacity:', window.getComputedStyle(btn).opacity);
    
    // Vérifier les event listeners (si disponible)
    if (typeof getEventListeners === 'function') {
      try {
        const listeners = getEventListeners(btn);
        console.log('   ✅ Event listeners:', Object.keys(listeners).length > 0 ? Object.keys(listeners) : 'AUCUN');
      } catch (e) {
        console.log('   💡 getEventListeners non disponible (Chrome DevTools uniquement)');
      }
    } else {
      console.log('   💡 Pour voir les event listeners: Ouvrez DevTools > Elements > Sélectionnez le bouton > Onglet Event Listeners');
    }
    
    // Tester un clic manuel
    console.log('\n   🧪 TEST CLIC MANUEL:');
    console.log('   💡 Exécutez: btn.click()');
    window.__testBtn = btn;
  } else {
    console.log('   ❌ AUCUN BOUTON TROUVÉ');
    console.log('   🔍 Recherche de tous les boutons avec "save" dans le texte:');
    const allButtons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    const saveButtons = allButtons.filter(b => 
      (b.textContent || '').toLowerCase().includes('sauvegard') ||
      (b.getAttribute('data-action') || '').includes('save')
    );
    saveButtons.forEach((b, i) => {
      console.log(`      ${i+1}. "${b.textContent.trim()}" - data-action="${b.getAttribute('data-action')}" - classes="${b.className}"`);
    });
  }
  
  // 3. Vérifier les credentials
  console.log('\n3. CREDENTIALS:');
  if (typeof window.agiloGetState === 'function') {
    try {
      const state = window.agiloGetState();
      console.log('   ✅ Edition:', state.edition || '❌ MANQUANT');
      console.log('   ✅ Email:', state.email || '❌ MANQUANT');
      console.log('   ✅ Token:', state.hasToken ? 'PRÉSENT' : '❌ MANQUANT');
      console.log('   ✅ JobId:', state.jobId || '❌ MANQUANT');
      
      if (!state.email || !state.hasToken || !state.jobId) {
        console.log('   ❌ PROBLÈME: Credentials incomplets !');
      }
    } catch (e) {
      console.log('   ❌ Erreur agiloGetState:', e.message);
    }
  } else {
    console.log('   ❌ agiloGetState non disponible');
  }
  
  // 4. Vérifier le transcript
  console.log('\n4. TRANSCRIPT:');
  const root = document.getElementById('transcriptEditor')
    || document.getElementById('ag-transcript')
    || document.querySelector('[data-editor="transcript"]');
  console.log('   ✅ Root:', root ? 'TROUVÉ' : '❌ NON TROUVÉ');
  if (root) {
    const segs = Array.from(root.querySelectorAll('.ag-seg,[data-seg],.segment,.ag-seg-segment'));
    const textLen = (root.innerText || root.textContent || '').trim().length;
    console.log('   ✅ Segments:', segs.length);
    console.log('   ✅ Text length:', textLen);
    console.log('   ✅ _segments:', Array.isArray(window._segments) ? `${window._segments.length} segments` : 'NON DÉFINI');
    
    if (segs.length === 0 && textLen < 10) {
      console.log('   ❌ PROBLÈME: Transcript vide ou non chargé !');
    }
  } else {
    console.log('   ❌ PROBLÈME: transcriptEditor non trouvé !');
  }
  
  // 5. Vérifier l'onglet actif
  console.log('\n5. ONGLET ACTIF:');
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  console.log('   ✅ Onglet:', activeTab ? (activeTab.id || 'sans-id') : 'AUCUN');
  if (activeTab) {
    console.log('   ✅ ID:', activeTab.id);
    console.log('   ✅ Est transcript?', activeTab.id === 'tab-transcript' ? '✅ OUI' : '❌ NON');
    
    if (activeTab.id !== 'tab-transcript') {
      console.log('   ❌ PROBLÈME: Vous n\'êtes pas sur l\'onglet Transcription !');
      console.log('   💡 Cliquez sur l\'onglet "Transcription" avant de sauvegarder');
    }
  } else {
    console.log('   ⚠️ Aucun onglet actif trouvé (peut être normal si pas de système d\'onglets)');
  }
  
  // 6. Vérifier les scripts chargés
  console.log('\n6. SCRIPTS CHARGÉS:');
  const scripts = Array.from(document.scripts);
  const saveScripts = scripts.filter(s => 
    s.src && (
      s.src.includes('save_transcript') || 
      s.src.includes('save-transcript') ||
      s.src.includes('Code-save')
    )
  );
  console.log('   ✅ Scripts save dans DOM:', saveScripts.length);
  saveScripts.forEach((s, i) => {
    console.log(`      ${i+1}. ${s.src}`);
    console.log(`         ✅ ReadyState: ${s.readyState} (complete=4, loaded=3, loading=2, uninitialized=0)`);
  });
  
  if (saveScripts.length === 0) {
    console.log('   ❌ PROBLÈME: Aucun script save trouvé dans le DOM !');
    console.log('   💡 Vérifiez que le script est bien dans Webflow et que la page est publiée');
  }
  
  // 7. Vérifier les dépendances
  console.log('\n7. DÉPENDANCES:');
  console.log('   ✅ visibleTextFromBox:', typeof window.visibleTextFromBox === 'function' ? 'OUI' : '❌ NON');
  console.log('   ✅ toast:', typeof window.toast === 'function' ? 'OUI' : 'NON (utilisera alert)');
  console.log('   ✅ Main Editor chargé:', typeof window.renderSegments === 'function' ? 'OUI' : 'NON');
  
  // 8. Tester la sauvegarde directe
  console.log('\n8. TEST DIRECT:');
  if (typeof window.agiloSaveNow === 'function') {
    console.log('   ✅ Fonction agiloSaveNow disponible');
    console.log('   💡 Pour tester, exécutez:');
    console.log('      window.agiloSaveNow().then(r => console.log("✅ Résultat:", r)).catch(e => console.error("❌ Erreur:", e));');
    
    // Tester automatiquement si tout est OK
    if (btn && typeof window.agiloGetState === 'function') {
      const state = window.agiloGetState();
      if (state.email && state.hasToken && state.jobId) {
        console.log('   🧪 Test automatique dans 2 secondes...');
        setTimeout(() => {
          console.log('   🧪 Exécution du test...');
          window.agiloSaveNow()
            .then(r => {
              console.log('   ✅ Test réussi:', r);
            })
            .catch(e => {
              console.error('   ❌ Test échoué:', e);
            });
        }, 2000);
      } else {
        console.log('   ⚠️ Test automatique ignoré (credentials incomplets)');
      }
    }
  } else {
    console.log('   ❌ agiloSaveNow non disponible');
    console.log('   💡 Le script n\'est pas chargé ou a rencontré une erreur');
  }
  
  // 9. Vérifier les erreurs console
  console.log('\n9. ERREURS:');
  console.log('   💡 Vérifiez l\'onglet Console pour des erreurs en rouge');
  console.log('   💡 Vérifiez l\'onglet Network (F12 > Network) pour des requêtes échouées');
  console.log('   💡 Filtrez par "save" ou "transcript" dans Network pour voir les appels API');
  
  // 10. Vérifier les conflits potentiels
  console.log('\n10. CONFLITS POTENTIELS:');
  const allIdentifiers = Object.keys(window).filter(k => 
    (k.includes('agilo') && k.includes('Save')) ||
    (k.includes('save') && k.includes('transcript'))
  );
  console.log('   ✅ Identifiants trouvés:', allIdentifiers.length);
  allIdentifiers.forEach(id => {
    console.log(`      - ${id}:`, typeof window[id]);
  });
  
  if (allIdentifiers.length > 1) {
    console.log('   ⚠️ Plusieurs identifiants trouvés - possible conflit');
  }
  
  // 11. Instructions finales
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Si le script n\'est pas chargé:');
  console.log('   - Vérifiez que le script est bien dans Webflow');
  console.log('   - Publiez la page dans Webflow');
  console.log('   - Videz le cache (Cmd+Shift+R)');
  console.log('   - Rechargez la page');
  console.log('');
  console.log('2. Si le bouton ne réagit pas:');
  console.log('   - Vérifiez qu\'il n\'est pas disabled');
  console.log('   - Vérifiez qu\'il est visible (display !== none)');
  console.log('   - Testez avec: window.__testBtn.click()');
  console.log('   - Ou testez avec: window.agiloSaveNow()');
  console.log('');
  console.log('3. Si les credentials sont manquants:');
  console.log('   - Vérifiez que vous êtes connecté');
  console.log('   - Vérifiez que jobId est présent dans l\'URL');
  console.log('');
  console.log('4. Si le transcript est vide:');
  console.log('   - Attendez que le transcript se charge');
  console.log('   - Rechargez la page si nécessaire');
  console.log('');
  console.log('=== FIN DIAGNOSTIC ===');
  
  // Exposer des helpers pour tests manuels
  window.__testSave = {
    btn: btn,
    testClick: () => {
      if (btn) {
        console.log('🧪 Test clic sur le bouton...');
        btn.click();
      } else {
        console.error('❌ Bouton non trouvé');
      }
    },
    testSave: () => {
      if (typeof window.agiloSaveNow === 'function') {
        console.log('🧪 Test sauvegarde directe...');
        return window.agiloSaveNow()
          .then(r => {
            console.log('✅ Résultat:', r);
            return r;
          })
          .catch(e => {
            console.error('❌ Erreur:', e);
            throw e;
          });
      } else {
        console.error('❌ agiloSaveNow non disponible');
      }
    },
    getState: () => {
      if (typeof window.agiloGetState === 'function') {
        return window.agiloGetState();
      } else {
        console.error('❌ agiloGetState non disponible');
      }
    }
  };
  
  console.log('\n💡 HELPERS DISPONIBLES:');
  console.log('   - window.__testSave.testClick() : Tester un clic sur le bouton');
  console.log('   - window.__testSave.testSave() : Tester la sauvegarde directe');
  console.log('   - window.__testSave.getState() : Voir l\'état actuel');
})();

