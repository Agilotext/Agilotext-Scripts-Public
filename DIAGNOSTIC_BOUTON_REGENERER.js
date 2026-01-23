// ============================================
// DIAGNOSTIC BOUTON RÉGÉNÉRER
// ============================================
// Copiez-collez ce script dans la console du navigateur (F12)
// pour comprendre pourquoi le bouton est visible

(function diagnostic() {
  console.log('%c🔍 DIAGNOSTIC BOUTON RÉGÉNÉRER', 'font-size: 16px; font-weight: bold; color: #174a96;');
  console.log('===========================================\n');

  // 1. Vérifier editorRoot et summaryEmpty
  const editorRoot = document.getElementById('editorRoot');
  console.log('1️⃣ EDITOR ROOT:');
  console.log('   - Existe:', !!editorRoot);
  if (editorRoot) {
    console.log('   - jobId:', editorRoot.dataset.jobId);
    console.log('   - summaryEmpty:', editorRoot.dataset.summaryEmpty);
    console.log('   - edition:', editorRoot.dataset.edition);
    console.log('   - username:', editorRoot.dataset.username);
  }
  console.log('');

  // 2. Vérifier le bouton
  const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
  console.log('2️⃣ BOUTON RÉGÉNÉRER:');
  console.log('   - Existe:', !!btn);
  if (btn) {
    console.log('   - Visible (display):', window.getComputedStyle(btn).display !== 'none');
    console.log('   - Visible (visibility):', window.getComputedStyle(btn).visibility !== 'hidden');
    console.log('   - Opacité:', window.getComputedStyle(btn).opacity);
    console.log('   - Classe agilo-force-hide:', btn.classList.contains('agilo-force-hide'));
    console.log('   - Attribut hidden:', btn.hasAttribute('hidden'));
    console.log('   - Attribut aria-hidden:', btn.getAttribute('aria-hidden'));
    console.log('   - Disabled:', btn.disabled);
    console.log('   - data-loading:', btn.getAttribute('data-loading'));
    console.log('   - Style inline:', btn.style.cssText);
  }
  console.log('');

  // 3. Vérifier summaryEditor et message d'erreur
  const summaryEl = document.getElementById('summaryEditor') 
    || document.getElementById('ag-summary') 
    || document.querySelector('[data-editor="summary"]');
  console.log('3️⃣ SUMMARY EDITOR:');
  console.log('   - Existe:', !!summaryEl);
  if (summaryEl) {
    const text = summaryEl.textContent || summaryEl.innerText || '';
    const html = summaryEl.innerHTML || '';
    console.log('   - Texte (100 premiers chars):', text.substring(0, 100));
    console.log('   - Contient "pas encore disponible":', text.toLowerCase().includes('pas encore disponible'));
    console.log('   - Contient "fichier manquant":', text.toLowerCase().includes('fichier manquant'));
    console.log('   - Contient "non publié":', text.toLowerCase().includes('non publié'));
    console.log('   - HTML contient ag-alert:', html.includes('ag-alert'));
    
    // Vérifier les alertes
    const alerts = summaryEl.querySelectorAll('.ag-alert, .ag-alert--warn, .ag-alert__title');
    console.log('   - Nombre d\'alertes:', alerts.length);
    alerts.forEach((alert, i) => {
      console.log(`   - Alerte ${i+1}:`, alert.textContent?.substring(0, 100));
    });
  }
  console.log('');

  // 4. Vérifier l'état d'erreur stocké dans localStorage
  const jobId = editorRoot?.dataset.jobId || new URLSearchParams(location.search).get('jobId') || '';
  console.log('4️⃣ ÉTAT D\'ERREUR STOCKÉ (localStorage):');
  if (jobId) {
    const errorKey = `agilo:summary-error:${jobId}`;
    const errorData = localStorage.getItem(errorKey);
    console.log('   - jobId:', jobId);
    console.log('   - Clé:', errorKey);
    console.log('   - Données stockées:', errorData);
    if (errorData) {
      try {
        const parsed = JSON.parse(errorData);
        console.log('   - hasError:', parsed.hasError);
        console.log('   - errorCode:', parsed.errorCode);
        console.log('   - timestamp:', new Date(parsed.timestamp).toLocaleString());
        console.log('   - Âge:', Math.round((Date.now() - parsed.timestamp) / 1000), 'secondes');
      } catch (e) {
        console.log('   - Erreur parsing:', e);
      }
    }
  }
  console.log('');

  // 5. Vérifier les logs du script staging
  console.log('5️⃣ LOGS SCRIPT STAGING:');
  console.log('   - Vérifiez la console pour les logs [AGILO:RELANCE]');
  console.log('   - Filtrez avec: [AGILO:RELANCE]');
  console.log('');

  // 6. Vérifier les événements récents
  console.log('6️⃣ ÉVÉNEMENTS:');
  console.log('   - Dernier agilo:load:', window.__agiloLastLoad || 'Non enregistré');
  console.log('   - Dernier agilo:beforeload:', window.__agiloLastBeforeLoad || 'Non enregistré');
  console.log('');

  // 7. Test de la fonction hasErrorMessageInDOM (si disponible)
  console.log('7️⃣ TEST FONCTION hasErrorMessageInDOM:');
  if (typeof window.hasErrorMessageInDOM === 'function') {
    const result = window.hasErrorMessageInDOM();
    console.log('   - Résultat:', result);
  } else {
    console.log('   - Fonction non disponible (script staging non chargé?)');
  }
  console.log('');

  // 8. Vérifier si le script staging est chargé
  console.log('8️⃣ SCRIPT STAGING:');
  console.log('   - __agiloEditorRelanceInit:', window.__agiloEditorRelanceInit);
  console.log('   - relancerCompteRendu existe:', typeof window.relancerCompteRendu === 'function');
  console.log('');

  // 9. Résumé et recommandations
  console.log('%c📊 RÉSUMÉ', 'font-size: 14px; font-weight: bold; color: #fd7e14;');
  console.log('===========================================');
  
  const problems = [];
  
  if (editorRoot?.dataset.summaryEmpty === '1') {
    console.log('✅ summaryEmpty=1 détecté (le script principal indique pas de CR)');
  } else if (editorRoot?.dataset.summaryEmpty === '0') {
    problems.push('❌ summaryEmpty=0 (le script principal pense qu\'il y a un CR)');
  } else {
    problems.push('⚠️ summaryEmpty non défini');
  }
  
  if (btn && !btn.classList.contains('agilo-force-hide')) {
    problems.push('❌ Bouton n\'a PAS la classe agilo-force-hide');
  }
  
  if (btn && window.getComputedStyle(btn).display !== 'none') {
    problems.push('❌ Bouton est visible (display !== none)');
  }
  
  if (summaryEl) {
    const hasErrorMsg = (summaryEl.textContent || '').toLowerCase().includes('pas encore disponible');
    if (hasErrorMsg) {
      console.log('✅ Message d\'erreur détecté dans le DOM');
    } else {
      problems.push('⚠️ Message d\'erreur NON détecté dans le DOM');
    }
  }
  
  if (problems.length > 0) {
    console.log('\n🔴 PROBLÈMES DÉTECTÉS:');
    problems.forEach(p => console.log('   ', p));
  } else {
    console.log('\n✅ Aucun problème détecté dans les vérifications de base');
  }
  
  console.log('\n💡 ACTIONS RECOMMANDÉES:');
  console.log('   1. Vérifiez les logs [AGILO:RELANCE] dans la console');
  console.log('   2. Vérifiez si updateButtonVisibility() est appelée');
  console.log('   3. Vérifiez si hasErrorMessageInDOM() retourne true');
  console.log('   4. Testez: window.updateButtonVisibility?.()');
  console.log('   5. Testez: window.hasErrorMessageInDOM?.()');
  
  console.log('\n===========================================');
})();

// ============================================
// COMMANDES UTILES À EXÉCUTER APRÈS
// ============================================

console.log('\n%c📋 COMMANDES UTILES', 'font-size: 14px; font-weight: bold; color: #174a96;');
console.log('===========================================');
console.log('// Forcer la mise à jour de la visibilité:');
console.log('window.updateButtonVisibility?.()');
console.log('');
console.log('// Tester la détection d\'erreur:');
console.log('window.hasErrorMessageInDOM?.()');
console.log('');
console.log('// Cacher manuellement le bouton:');
console.log('const btn = document.querySelector(\'[data-action="relancer-compte-rendu"]\');');
console.log('if (btn) btn.classList.add(\'agilo-force-hide\');');
console.log('');
console.log('// Voir tous les logs [AGILO:RELANCE]:');
console.log('// Filtrez la console avec: [AGILO:RELANCE]');
console.log('');
console.log('// Vérifier l\'état du script staging:');
console.log('console.log(window.__agiloEditorRelanceInit);');
console.log('');

