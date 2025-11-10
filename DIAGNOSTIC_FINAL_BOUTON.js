// ============================================
// DIAGNOSTIC FINAL - BOUTON RÉGÉNÉRER
// ============================================
// Copiez-collez TOUT ce script dans la console (F12)

(function diagnosticFinal() {
  console.clear();
  console.log('%c🔍 DIAGNOSTIC FINAL - BOUTON RÉGÉNÉRER', 'font-size: 20px; font-weight: bold; color: #fff; background: #d32f2f; padding: 15px; border-radius: 5px;');
  console.log('===========================================\n');

  // 1. COMPTER LES BOUTONS
  const allButtons = Array.from(document.querySelectorAll('[data-action="relancer-compte-rendu"]'));
  console.log('%c1️⃣ NOMBRE DE BOUTONS', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  console.log('   Total trouvé:', allButtons.length);
  if (allButtons.length > 1) {
    console.error('   ❌ PROBLÈME: Il y a', allButtons.length, 'boutons ! Il y a une duplication !');
  }
  allButtons.forEach((btn, i) => {
    const styles = window.getComputedStyle(btn);
    console.log(`   Bouton ${i+1}:`, {
      visible: styles.display !== 'none',
      opacity: styles.opacity,
      hasForceHide: btn.classList.contains('agilo-force-hide'),
      hasHidden: btn.hasAttribute('hidden'),
      parent: btn.parentElement?.className || 'N/A',
      id: btn.id || 'pas d\'id'
    });
  });
  console.log('');

  // 2. ÉTAT DU DOM
  const editorRoot = document.getElementById('editorRoot');
  const summaryEl = document.getElementById('summaryEditor') || document.querySelector('[data-editor="summary"]');
  const jobId = editorRoot?.dataset.jobId || new URLSearchParams(location.search).get('jobId') || '';
  
  console.log('%c2️⃣ ÉTAT DU DOM', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  console.log('   editorRoot existe:', !!editorRoot);
  console.log('   summaryEmpty:', editorRoot?.dataset.summaryEmpty);
  console.log('   jobId:', jobId);
  console.log('   summaryEditor existe:', !!summaryEl);
  
  if (summaryEl) {
    const text = (summaryEl.textContent || summaryEl.innerText || '').trim();
    const html = summaryEl.innerHTML || '';
    const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
    const hasExact = text.includes(exactMsg) || html.includes(exactMsg);
    const hasPattern = text.toLowerCase().includes('pas encore disponible') || 
                      text.toLowerCase().includes('fichier manquant');
    
    console.log('   Message exact présent:', hasExact);
    console.log('   Pattern erreur présent:', hasPattern);
    console.log('   Texte (200 premiers caractères):', text.substring(0, 200));
    
    // Vérifier les alertes
    const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title');
    console.log('   Nombre d\'alertes:', alerts.length);
    alerts.forEach((alert, i) => {
      const alertText = alert.textContent || alert.innerText || '';
      console.log(`   Alerte ${i+1}:`, alertText.substring(0, 150));
    });
  }
  console.log('');

  // 3. ÉTAT DU SCRIPT STAGING
  console.log('%c3️⃣ ÉTAT DU SCRIPT STAGING', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  console.log('   __agiloEditorRelanceInit:', window.__agiloEditorRelanceInit);
  console.log('   hasErrorMessageInDOM existe:', typeof window.hasErrorMessageInDOM === 'function');
  console.log('   updateButtonVisibility existe:', typeof window.updateButtonVisibility === 'function');
  console.log('   hideButton existe:', typeof window.hideButton === 'function');
  console.log('   showButton existe:', typeof window.showButton === 'function');
  
  // Tester hasErrorMessageInDOM
  if (typeof window.hasErrorMessageInDOM === 'function') {
    try {
      const result = window.hasErrorMessageInDOM();
      console.log('   hasErrorMessageInDOM() retourne:', result);
    } catch (e) {
      console.error('   ❌ Erreur hasErrorMessageInDOM:', e);
    }
  } else {
    console.error('   ❌ hasErrorMessageInDOM() non disponible !');
  }
  console.log('');

  // 4. LOCALSTORAGE
  console.log('%c4️⃣ LOCALSTORAGE', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  if (jobId) {
    const errorKey = `agilo:summary-error:${jobId}`;
    const errorData = localStorage.getItem(errorKey);
    console.log('   Clé erreur:', errorKey);
    console.log('   Données stockées:', errorData);
    if (errorData) {
      try {
        const parsed = JSON.parse(errorData);
        console.log('   hasError:', parsed.hasError);
        console.log('   errorCode:', parsed.errorCode);
      } catch (e) {
        console.error('   Erreur parsing:', e);
      }
    }
  }
  console.log('');

  // 5. FORCER LE MASQUAGE IMMÉDIAT
  console.log('%c5️⃣ ACTION IMMÉDIATE - FORCER LE MASQUAGE', 'font-size: 16px; font-weight: bold; color: #d32f2f; background: #ffebee; padding: 10px;');
  
  allButtons.forEach((btn, i) => {
    console.log(`   Traitement bouton ${i+1}...`);
    
    // Vérifier si le message d'erreur est présent
    const shouldHide = editorRoot?.dataset.summaryEmpty === '1' || 
                      (summaryEl && (
                        (summaryEl.textContent || '').includes("Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).") ||
                        (summaryEl.textContent || '').toLowerCase().includes('pas encore disponible') ||
                        (summaryEl.textContent || '').toLowerCase().includes('fichier manquant')
                      ));
    
    if (shouldHide) {
      console.log(`   ✅ Bouton ${i+1} DOIT être caché - Application du masquage FORCÉ...`);
      
      // Masquage ultra-agressif
      btn.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;';
      btn.classList.add('agilo-force-hide');
      btn.setAttribute('hidden', '');
      btn.setAttribute('aria-hidden', 'true');
      btn.disabled = true;
      
      // Cacher tous les enfants
      Array.from(btn.querySelectorAll('*')).forEach(child => {
        child.style.setProperty('display', 'none', 'important');
      });
      
      console.log(`   ✅ Bouton ${i+1} caché avec toutes les méthodes`);
    } else {
      console.log(`   ⚠️ Bouton ${i+1} ne devrait PAS être caché (message d'erreur non détecté)`);
    }
  });
  console.log('');

  // 6. SUPPRIMER LES DOUBLONS
  if (allButtons.length > 1) {
    console.log('%c6️⃣ SUPPRESSION DES DOUBLONS', 'font-size: 16px; font-weight: bold; color: #d32f2f; background: #ffebee; padding: 10px;');
    console.log('   Suppression des boutons en double (garder seulement le premier)...');
    
    // Garder le premier, supprimer les autres
    for (let i = 1; i < allButtons.length; i++) {
      const btn = allButtons[i];
      console.log(`   Suppression bouton ${i+1}...`);
      btn.remove();
    }
    
    // Supprimer aussi les compteurs en double
    const counters = Array.from(document.querySelectorAll('#regeneration-info'));
    if (counters.length > 1) {
      console.log('   Suppression des compteurs en double...');
      for (let i = 1; i < counters.length; i++) {
        counters[i].remove();
      }
    }
    
    console.log('   ✅ Doublons supprimés');
  }
  console.log('');

  // 7. RÉSUMÉ
  console.log('%c7️⃣ RÉSUMÉ', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  console.log('===========================================');
  
  const problems = [];
  if (allButtons.length > 1) {
    problems.push(`❌ ${allButtons.length} boutons trouvés (duplication)`);
  }
  
  if (editorRoot?.dataset.summaryEmpty !== '1') {
    problems.push('⚠️ summaryEmpty n\'est pas "1"');
  } else {
    console.log('✅ summaryEmpty=1 détecté');
  }
  
  if (summaryEl) {
    const text = (summaryEl.textContent || '').toLowerCase();
    if (text.includes('pas encore disponible')) {
      console.log('✅ Message d\'erreur détecté dans le DOM');
    } else {
      problems.push('⚠️ Message d\'erreur NON détecté dans le DOM');
    }
  }
  
  if (!window.__agiloEditorRelanceInit) {
    problems.push('❌ Script staging NON initialisé');
  } else {
    console.log('✅ Script staging initialisé');
  }
  
  if (problems.length > 0) {
    console.log('\n🔴 PROBLÈMES DÉTECTÉS:');
    problems.forEach(p => console.log('   ', p));
  } else {
    console.log('\n✅ Aucun problème détecté');
  }
  
  console.log('\n===========================================');
  console.log('%c📋 COMMANDES DE FORÇAGE', 'font-size: 16px; font-weight: bold; color: #174a96;');
  console.log('===========================================');
  console.log('// Forcer le masquage de TOUS les boutons');
  console.log('document.querySelectorAll(\'[data-action="relancer-compte-rendu"]\').forEach(btn => {');
  console.log('  btn.style.cssText = \'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;\';');
  console.log('  btn.classList.add(\'agilo-force-hide\');');
  console.log('  btn.setAttribute(\'hidden\', \'\');');
  console.log('  btn.setAttribute(\'aria-hidden\', \'true\');');
  console.log('  btn.disabled = true;');
  console.log('});');
  console.log('');
  console.log('// Supprimer les doublons');
  console.log('const btns = Array.from(document.querySelectorAll(\'[data-action="relancer-compte-rendu"]\'));');
  console.log('if (btns.length > 1) { for (let i = 1; i < btns.length; i++) btns[i].remove(); }');
  console.log('');
  
  return {
    nbBoutons: allButtons.length,
    summaryEmpty: editorRoot?.dataset.summaryEmpty,
    hasErrorMsg: summaryEl ? (summaryEl.textContent || '').includes('pas encore disponible') : false,
    scriptInit: window.__agiloEditorRelanceInit,
    problems
  };
})();

