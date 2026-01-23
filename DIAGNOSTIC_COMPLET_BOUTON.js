// ============================================
// DIAGNOSTIC COMPLET BOUTON RÉGÉNÉRER
// ============================================
// Copiez-collez TOUT ce script dans la console (F12)

(function diagnosticComplet() {
  console.clear();
  console.log('%c🔍 DIAGNOSTIC COMPLET BOUTON RÉGÉNÉRER', 'font-size: 18px; font-weight: bold; color: #174a96; background: #f0f4ff; padding: 10px; border-radius: 5px;');
  console.log('===========================================\n');

  // 1. Éléments de base
  const editorRoot = document.getElementById('editorRoot');
  const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
  const summaryEl = document.getElementById('summaryEditor') || document.querySelector('[data-editor="summary"]');
  const jobId = editorRoot?.dataset.jobId || new URLSearchParams(location.search).get('jobId') || '';

  console.log('%c1️⃣ ÉLÉMENTS DE BASE', 'font-size: 14px; font-weight: bold; color: #174a96;');
  console.log('   editorRoot existe:', !!editorRoot);
  console.log('   editorRoot.dataset.summaryEmpty:', editorRoot?.dataset.summaryEmpty);
  console.log('   editorRoot.dataset.jobId:', editorRoot?.dataset.jobId);
  console.log('   Bouton existe:', !!btn);
  console.log('   summaryEditor existe:', !!summaryEl);
  console.log('   jobId:', jobId);
  console.log('');

  // 2. État du bouton
  console.log('%c2️⃣ ÉTAT DU BOUTON', 'font-size: 14px; font-weight: bold; color: #174a96;');
  if (btn) {
    const styles = window.getComputedStyle(btn);
    console.log('   display:', styles.display);
    console.log('   visibility:', styles.visibility);
    console.log('   opacity:', styles.opacity);
    console.log('   position:', styles.position);
    console.log('   left:', styles.left);
    console.log('   width:', styles.width);
    console.log('   height:', styles.height);
    console.log('   Classe agilo-force-hide:', btn.classList.contains('agilo-force-hide'));
    console.log('   Attribut hidden:', btn.hasAttribute('hidden'));
    console.log('   Attribut aria-hidden:', btn.getAttribute('aria-hidden'));
    console.log('   Disabled:', btn.disabled);
    console.log('   Style inline:', btn.style.cssText.substring(0, 200));
    console.log('   Est visible?', styles.display !== 'none' && styles.visibility !== 'hidden');
  } else {
    console.log('   ❌ BOUTON NON TROUVÉ');
  }
  console.log('');

  // 3. Message d'erreur dans le DOM
  console.log('%c3️⃣ MESSAGE D\'ERREUR DANS LE DOM', 'font-size: 14px; font-weight: bold; color: #174a96;');
  if (summaryEl) {
    const text = summaryEl.textContent || summaryEl.innerText || '';
    const html = summaryEl.innerHTML || '';
    const exactMsg = "Le compte-rendu n'est pas encore disponible (fichier manquant/non publié).";
    
    console.log('   Texte complet:', text.substring(0, 200));
    console.log('   Contient message exact:', text.includes(exactMsg));
    console.log('   Contient "pas encore disponible":', text.toLowerCase().includes('pas encore disponible'));
    console.log('   Contient "fichier manquant":', text.toLowerCase().includes('fichier manquant'));
    console.log('   Contient "non publié":', text.toLowerCase().includes('non publié'));
    
    // Vérifier les alertes
    const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title');
    console.log('   Nombre d\'alertes:', alerts.length);
    alerts.forEach((alert, i) => {
      const alertText = alert.textContent || alert.innerText || '';
      console.log(`   Alerte ${i+1}:`, alertText.substring(0, 150));
      console.log(`   Alerte ${i+1} contient message exact:`, alertText.includes(exactMsg));
    });
  } else {
    console.log('   ❌ SUMMARY EDITOR NON TROUVÉ');
  }
  console.log('');

  // 4. Script staging
  console.log('%c4️⃣ SCRIPT STAGING', 'font-size: 14px; font-weight: bold; color: #174a96;');
  console.log('   __agiloEditorRelanceInit:', window.__agiloEditorRelanceInit);
  console.log('   relancerCompteRendu existe:', typeof window.relancerCompteRendu === 'function');
  console.log('   updateButtonVisibility existe:', typeof window.updateButtonVisibility === 'function');
  console.log('   hasErrorMessageInDOM existe:', typeof window.hasErrorMessageInDOM === 'function');
  console.log('   hideButton existe:', typeof window.hideButton === 'function');
  
  // Vérifier si le script est chargé
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const stagingScript = scripts.find(s => s.src.includes('relance-compte-rendu'));
  console.log('   Script staging chargé:', !!stagingScript);
  if (stagingScript) {
    console.log('   URL script:', stagingScript.src);
  }
  console.log('');

  // 5. LocalStorage
  console.log('%c5️⃣ LOCALSTORAGE', 'font-size: 14px; font-weight: bold; color: #174a96;');
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
        console.log('   timestamp:', new Date(parsed.timestamp).toLocaleString());
      } catch (e) {
        console.log('   Erreur parsing:', e);
      }
    }
  }
  console.log('');

  // 6. Test des fonctions
  console.log('%c6️⃣ TEST DES FONCTIONS', 'font-size: 14px; font-weight: bold; color: #174a96;');
  if (typeof window.hasErrorMessageInDOM === 'function') {
    try {
      const result = window.hasErrorMessageInDOM();
      console.log('   hasErrorMessageInDOM():', result);
    } catch (e) {
      console.log('   ❌ Erreur hasErrorMessageInDOM:', e);
    }
  } else {
    console.log('   ❌ hasErrorMessageInDOM() non disponible');
  }
  
  if (typeof window.updateButtonVisibility === 'function') {
    console.log('   ✅ updateButtonVisibility() disponible - Appel...');
    try {
      window.updateButtonVisibility().then(() => {
        console.log('   ✅ updateButtonVisibility() terminé');
        // Vérifier après
        setTimeout(() => {
          const btnAfter = document.querySelector('[data-action="relancer-compte-rendu"]');
          if (btnAfter) {
            const stylesAfter = window.getComputedStyle(btnAfter);
            console.log('   État après updateButtonVisibility:');
            console.log('     display:', stylesAfter.display);
            console.log('     visibility:', stylesAfter.visibility);
            console.log('     agilo-force-hide:', btnAfter.classList.contains('agilo-force-hide'));
          }
        }, 500);
      }).catch(e => {
        console.log('   ❌ Erreur updateButtonVisibility:', e);
      });
    } catch (e) {
      console.log('   ❌ Erreur appel updateButtonVisibility:', e);
    }
  } else {
    console.log('   ❌ updateButtonVisibility() non disponible');
  }
  console.log('');

  // 7. Logs du script staging
  console.log('%c7️⃣ LOGS SCRIPT STAGING', 'font-size: 14px; font-weight: bold; color: #174a96;');
  console.log('   Vérifiez les logs [AGILO:RELANCE] dans la console');
  console.log('   Filtrez avec: [AGILO:RELANCE]');
  console.log('');

  // 8. Résumé et actions
  console.log('%c8️⃣ RÉSUMÉ ET ACTIONS', 'font-size: 14px; font-weight: bold; color: #fd7e14;');
  console.log('===========================================');
  
  const problems = [];
  const solutions = [];
  
  if (!window.__agiloEditorRelanceInit) {
    problems.push('❌ Script staging NON initialisé');
    solutions.push('→ Le script staging n\'est peut-être pas chargé ou a une erreur');
  }
  
  if (editorRoot?.dataset.summaryEmpty === '1') {
    console.log('✅ summaryEmpty=1 détecté');
  } else {
    problems.push('⚠️ summaryEmpty n\'est pas "1"');
  }
  
  if (summaryEl) {
    const text = (summaryEl.textContent || '').toLowerCase();
    if (text.includes('pas encore disponible')) {
      console.log('✅ Message d\'erreur détecté dans le DOM');
    } else {
      problems.push('⚠️ Message d\'erreur NON détecté dans le DOM');
    }
  }
  
  if (btn) {
    const styles = window.getComputedStyle(btn);
    if (styles.display !== 'none' && !btn.classList.contains('agilo-force-hide')) {
      problems.push('❌ Bouton est VISIBLE alors qu\'il ne devrait pas l\'être');
      solutions.push('→ Exécuter: window.hideButton?.(document.querySelector(\'[data-action="relancer-compte-rendu"]\'), \'manual-fix\')');
    }
  }
  
  if (problems.length > 0) {
    console.log('\n🔴 PROBLÈMES DÉTECTÉS:');
    problems.forEach(p => console.log('   ', p));
    console.log('\n💡 SOLUTIONS:');
    solutions.forEach(s => console.log('   ', s));
  } else {
    console.log('\n✅ Aucun problème détecté');
  }
  
  console.log('\n===========================================');
  console.log('%c📋 COMMANDES À EXÉCUTER', 'font-size: 14px; font-weight: bold; color: #174a96;');
  console.log('===========================================');
  console.log('// 1. Forcer la mise à jour');
  console.log('window.updateButtonVisibility?.()');
  console.log('');
  console.log('// 2. Tester la détection');
  console.log('window.hasErrorMessageInDOM?.()');
  console.log('');
  console.log('// 3. Cacher manuellement le bouton');
  console.log('const btn = document.querySelector(\'[data-action="relancer-compte-rendu"]\');');
  console.log('if (btn) {');
  console.log('  btn.classList.add(\'agilo-force-hide\');');
  console.log('  btn.style.cssText = \'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;\';');
  console.log('  btn.setAttribute(\'hidden\', \'\');');
  console.log('  btn.setAttribute(\'aria-hidden\', \'true\');');
  console.log('  btn.disabled = true;');
  console.log('}');
  console.log('');
  console.log('// 4. Vérifier les logs');
  console.log('// Filtrez la console avec: [AGILO:RELANCE]');
  console.log('');
  
  return {
    editorRoot: !!editorRoot,
    summaryEmpty: editorRoot?.dataset.summaryEmpty,
    btnExists: !!btn,
    btnVisible: btn ? window.getComputedStyle(btn).display !== 'none' : false,
    hasErrorMsg: summaryEl ? (summaryEl.textContent || '').includes('pas encore disponible') : false,
    scriptInit: window.__agiloEditorRelanceInit,
    problems,
    solutions
  };
})();

