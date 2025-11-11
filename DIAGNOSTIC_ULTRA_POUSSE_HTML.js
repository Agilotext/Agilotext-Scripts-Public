// ============================================
// DIAGNOSTIC ULTRA POUSSÉ - ANALYSE HTML
// ============================================
// Copiez-collez ce script dans la console pour analyser tous les problèmes

(function diagnosticUltraPousse() {
  console.clear();
  console.log('%c🔬 DIAGNOSTIC ULTRA POUSSÉ - ANALYSE HTML', 'font-size: 20px; font-weight: bold; color: #fff; background: #d32f2f; padding: 15px; border-radius: 5px;');
  console.log('===========================================\n');

  // 1. ANALYSE DES SCRIPTS CHARGÉS
  console.log('%c1️⃣ SCRIPTS CHARGÉS', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  const allScripts = Array.from(document.querySelectorAll('script[src]'));
  const relanceScripts = allScripts.filter(s => 
    s.src.includes('relance-compte-rendu') || 
    s.src.includes('relance')
  );
  
  console.log('   Scripts relance trouvés:', relanceScripts.length);
  relanceScripts.forEach((script, i) => {
    console.log(`   ${i+1}. ${script.src}`);
    console.log(`      - Chargé: ${script.parentElement ? 'Oui' : 'Non'}`);
    console.log(`      - Async: ${script.async}`);
    console.log(`      - Defer: ${script.defer}`);
  });
  
  // Vérifier les scripts inline
  const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
  const relanceInline = inlineScripts.filter(s => 
    s.textContent.includes('relance-compte-rendu') ||
    s.textContent.includes('relancer-compte-rendu') ||
    s.textContent.includes('__agiloEditorRelanceInit')
  );
  console.log('   Scripts inline relance:', relanceInline.length);
  relanceInline.forEach((script, i) => {
    const preview = script.textContent.substring(0, 200).replace(/\n/g, ' ');
    console.log(`   ${i+1}. ${preview}...`);
  });
  console.log('');

  // 2. ANALYSE DES BOUTONS
  console.log('%c2️⃣ BOUTONS RÉGÉNÉRER', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  const allButtons = Array.from(document.querySelectorAll('[data-action="relancer-compte-rendu"]'));
  console.log('   Nombre de boutons:', allButtons.length);
  
  allButtons.forEach((btn, i) => {
    const styles = window.getComputedStyle(btn);
    const parent = btn.parentElement;
    console.log(`   Bouton ${i+1}:`, {
      id: btn.id || 'pas d\'id',
      className: btn.className,
      visible: styles.display !== 'none' && styles.visibility !== 'hidden',
      opacity: styles.opacity,
      disabled: btn.disabled,
      hasForceHide: btn.classList.contains('agilo-force-hide'),
      parent: parent?.className || parent?.tagName || 'N/A',
      parentId: parent?.id || 'pas d\'id',
      text: btn.textContent?.trim() || btn.innerText?.trim() || 'N/A'
    });
  });
  console.log('');

  // 3. ANALYSE DES COMPTEURS
  console.log('%c3️⃣ COMPTEURS RÉGÉNÉRATION', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  const counters = Array.from(document.querySelectorAll('.regeneration-counter, #regeneration-info'));
  console.log('   Nombre de compteurs:', counters.length);
  counters.forEach((counter, i) => {
    const styles = window.getComputedStyle(counter);
    console.log(`   Compteur ${i+1}:`, {
      id: counter.id || 'pas d\'id',
      className: counter.className,
      visible: styles.display !== 'none' && styles.visibility !== 'hidden',
      text: counter.textContent?.trim() || 'N/A',
      parent: counter.parentElement?.className || 'N/A'
    });
  });
  console.log('');

  // 4. ANALYSE DE L'ÉTAT DU DOM
  console.log('%c4️⃣ ÉTAT DU DOM', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  const editorRoot = document.getElementById('editorRoot');
  const summaryEl = document.getElementById('summaryEditor') || document.querySelector('[data-editor="summary"]');
  const jobId = editorRoot?.dataset.jobId || new URLSearchParams(location.search).get('jobId') || '';
  
  console.log('   editorRoot:', {
    exists: !!editorRoot,
    summaryEmpty: editorRoot?.dataset.summaryEmpty,
    jobId: editorRoot?.dataset.jobId,
    edition: editorRoot?.dataset.edition,
    username: editorRoot?.dataset.username ? 'présent' : 'absent'
  });
  
  console.log('   summaryEditor:', {
    exists: !!summaryEl,
    hasContent: summaryEl ? (summaryEl.textContent || summaryEl.innerText || '').length > 0 : false,
    contentLength: summaryEl ? (summaryEl.textContent || summaryEl.innerText || '').length : 0,
    hasErrorMsg: summaryEl ? (summaryEl.textContent || '').includes('pas encore disponible') : false
  });
  console.log('');

  // 5. ANALYSE DES SCRIPTS INITIALISÉS
  console.log('%c5️⃣ INITIALISATION DES SCRIPTS', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  console.log('   __agiloEditorRelanceInit:', window.__agiloEditorRelanceInit);
  console.log('   __agiloSave_FULL_12_JSON_CONTENT:', window.__agiloSave_FULL_12_JSON_CONTENT);
  console.log('   __agiloOrchestrator:', !!window.__agiloOrchestrator);
  console.log('   hasErrorMessageInDOM:', typeof window.hasErrorMessageInDOM === 'function');
  console.log('   updateButtonVisibility:', typeof window.updateButtonVisibility === 'function');
  console.log('   hideButton:', typeof window.hideButton === 'function');
  console.log('   showButton:', typeof window.showButton === 'function');
  console.log('   relancerCompteRendu:', typeof window.relancerCompteRendu === 'function');
  console.log('');

  // 6. ANALYSE DE L'ORDRE DE CHARGEMENT
  console.log('%c6️⃣ ORDRE DE CHARGEMENT', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  const scriptOrder = [];
  document.querySelectorAll('script[src*="relance"]').forEach((s, i) => {
    scriptOrder.push({
      order: i + 1,
      src: s.src,
      async: s.async,
      defer: s.defer,
      loaded: s.readyState === 'complete' || s.readyState === 'loaded'
    });
  });
  console.log('   Ordre des scripts relance:', scriptOrder);
  console.log('');

  // 7. ANALYSE DES CONFLITS POTENTIELS
  console.log('%c7️⃣ CONFLITS POTENTIELS', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  const problems = [];
  
  if (allButtons.length > 1) {
    problems.push(`❌ ${allButtons.length} boutons détectés (duplication)`);
  }
  
  if (counters.length > 1) {
    problems.push(`❌ ${counters.length} compteurs détectés (duplication)`);
  }
  
  if (!window.__agiloEditorRelanceInit && relanceScripts.length > 0) {
    problems.push('❌ Script staging chargé mais non initialisé');
  }
  
  if (relanceScripts.length === 0) {
    problems.push('❌ Aucun script relance chargé');
  }
  
  if (editorRoot?.dataset.summaryEmpty === '1' && allButtons.some(b => {
    const s = window.getComputedStyle(b);
    return s.display !== 'none' && s.visibility !== 'hidden';
  })) {
    problems.push('❌ summaryEmpty=1 mais bouton visible');
  }
  
  if (problems.length > 0) {
    console.log('   🔴 PROBLÈMES DÉTECTÉS:');
    problems.forEach(p => console.log('      ', p));
  } else {
    console.log('   ✅ Aucun problème détecté');
  }
  console.log('');

  // 8. TEST DE FONCTIONNEMENT
  console.log('%c8️⃣ TEST DE FONCTIONNEMENT', 'font-size: 16px; font-weight: bold; color: #d32f2f;');
  
  if (typeof window.hasErrorMessageInDOM === 'function') {
    try {
      const hasError = window.hasErrorMessageInDOM();
      console.log('   hasErrorMessageInDOM():', hasError);
    } catch (e) {
      console.error('   ❌ Erreur hasErrorMessageInDOM:', e);
    }
  } else {
    console.log('   ❌ hasErrorMessageInDOM() non disponible');
  }
  
  if (typeof window.updateButtonVisibility === 'function') {
    console.log('   ✅ updateButtonVisibility() disponible');
    try {
      window.updateButtonVisibility().then(() => {
        console.log('   ✅ updateButtonVisibility() exécuté');
      }).catch(e => {
        console.error('   ❌ Erreur updateButtonVisibility:', e);
      });
    } catch (e) {
      console.error('   ❌ Erreur appel updateButtonVisibility:', e);
    }
  } else {
    console.log('   ❌ updateButtonVisibility() non disponible');
  }
  console.log('');

  // 9. RECOMMANDATIONS
  console.log('%c9️⃣ RECOMMANDATIONS', 'font-size: 16px; font-weight: bold; color: #174a96;');
  console.log('===========================================');
  
  if (relanceScripts.length === 0) {
    console.log('   ⚠️ Ajouter le script fallback dans Webflow:');
    console.log('   <script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu-fallback.js"></script>');
  }
  
  if (allButtons.length > 1) {
    console.log('   ⚠️ Supprimer les doublons de boutons');
  }
  
  if (!window.__agiloEditorRelanceInit) {
    console.log('   ⚠️ Le script staging ne s\'initialise pas - vérifier les erreurs console');
  }
  
  console.log('\n===========================================');
  
  return {
    scripts: relanceScripts.length,
    buttons: allButtons.length,
    counters: counters.length,
    initialized: !!window.__agiloEditorRelanceInit,
    problems: problems.length,
    summaryEmpty: editorRoot?.dataset.summaryEmpty
  };
})();

