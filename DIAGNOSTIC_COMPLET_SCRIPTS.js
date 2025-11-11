/* 🔬 DIAGNOSTIC COMPLET - Conflits et Performance
   À exécuter dans la console pour comprendre les problèmes
*/

(function() {
  console.log('🔬 ===========================================');
  console.log('🔬 DIAGNOSTIC COMPLET - CONFLITS & PERFORMANCE');
  console.log('🔬 ===========================================\n');
  
  // 1. Vérifier les scripts chargés
  console.log('1️⃣ SCRIPTS CHARGÉS');
  const allScripts = Array.from(document.querySelectorAll('script[src]'));
  const relanceScripts = allScripts.filter(s => s.src.includes('relance'));
  console.log('   Scripts relance trouvés:', relanceScripts.length);
  relanceScripts.forEach((s, i) => {
    console.log(`   ${i+1}. ${s.src}`);
    console.log(`      - Async: ${s.async}`);
    console.log(`      - Defer: ${s.defer}`);
  });
  
  // 2. Vérifier les erreurs JavaScript
  console.log('\n2️⃣ ERREURS JAVASCRIPT');
  const originalError = console.error;
  const errors = [];
  console.error = function(...args) {
    errors.push(args);
    originalError.apply(console, args);
  };
  setTimeout(() => {
    console.log('   Erreurs capturées:', errors.length);
    errors.forEach((e, i) => {
      console.log(`   ${i+1}.`, e);
    });
    console.error = originalError;
  }, 2000);
  
  // 3. Vérifier les conflits de noms
  console.log('\n3️⃣ CONFLITS DE NOMS');
  const checkConflicts = [
    '__agiloRelanceSimpleClickBound',
    '__agiloRelanceSimpleInit',
    '__agiloEditorRelanceInit',
    'relancerCompteRendu',
    'updateButtonVisibility',
    'shouldHideButton'
  ];
  checkConflicts.forEach(name => {
    const val = window[name];
    if (val !== undefined) {
      console.log(`   ⚠️ ${name}:`, typeof val, val);
    }
  });
  
  // 4. Vérifier les event listeners
  console.log('\n4️⃣ EVENT LISTENERS SUR DOCUMENT');
  const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
  if (btn) {
    console.log('   Bouton trouvé:', btn);
    console.log('   Event listeners (approximatif):');
    // On ne peut pas vraiment lire les listeners, mais on peut tester
    const testEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const before = testEvent.defaultPrevented;
    btn.dispatchEvent(testEvent);
    console.log('   - Test dispatch:', testEvent.defaultPrevented !== before ? 'Handler présent' : 'Pas de handler');
  }
  
  // 5. Vérifier le temps de chargement
  console.log('\n5️⃣ PERFORMANCE');
  console.log('   DOMContentLoaded:', performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart, 'ms');
  console.log('   Load complet:', performance.timing.loadEventEnd - performance.timing.navigationStart, 'ms');
  console.log('   Temps depuis navigation:', Date.now() - performance.timing.navigationStart, 'ms');
  
  // 6. Vérifier les scripts bloquants
  console.log('\n6️⃣ SCRIPTS BLOQUANTS');
  const blockingScripts = allScripts.filter(s => !s.async && !s.defer);
  console.log('   Scripts synchrones (bloquants):', blockingScripts.length);
  blockingScripts.slice(0, 10).forEach((s, i) => {
    console.log(`   ${i+1}. ${s.src || 'inline'}`);
  });
  
  // 7. Vérifier le transcript
  console.log('\n7️⃣ ÉTAT DU TRANSCRIPT');
  const transcriptEl = document.getElementById('transcriptEditor') || document.querySelector('[data-editor="transcript"]');
  if (transcriptEl) {
    console.log('   transcriptEditor trouvé:', {
      exists: true,
      hasContent: transcriptEl.children.length > 0 || transcriptEl.textContent.trim().length > 0,
      contentLength: transcriptEl.textContent.length,
      innerHTML: transcriptEl.innerHTML.substring(0, 100) + '...'
    });
  } else {
    console.log('   ❌ transcriptEditor NON TROUVÉ');
  }
  
  // 8. Vérifier le bouton Relancer
  console.log('\n8️⃣ BOUTON RELANCER');
  if (btn) {
    console.log('   Bouton:', {
      exists: true,
      disabled: btn.disabled,
      visible: window.getComputedStyle(btn).display !== 'none',
      hasForceHide: btn.classList.contains('agilo-force-hide'),
      dataAction: btn.getAttribute('data-action'),
      onClick: btn.onclick ? 'Oui' : 'Non'
    });
    
    // Tester le clic manuellement
    console.log('\n   🧪 TEST CLIC MANUEL');
    const testClick = () => {
      console.log('   → Simulation clic...');
      const evt = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      btn.dispatchEvent(evt);
    };
    console.log('   Exécutez dans la console: testClick()');
    window.testClick = testClick;
  } else {
    console.log('   ❌ Bouton NON TROUVÉ');
  }
  
  // 9. Vérifier les fonctions globales
  console.log('\n9️⃣ FONCTIONS GLOBALES');
  const globalFuncs = [
    'relancerCompteRendu',
    'updateButtonVisibility',
    'shouldHideButton',
    'attachClickHandler'
  ];
  globalFuncs.forEach(name => {
    const func = window[name];
    if (typeof func === 'function') {
      console.log(`   ✅ ${name}: fonction disponible`);
    } else {
      console.log(`   ❌ ${name}: non disponible`);
    }
  });
  
  // 10. Recommandations
  console.log('\n🔟 RECOMMANDATIONS');
  console.log('   Pour tester le clic manuellement:');
  console.log('   → testClick()');
  console.log('\n   Pour voir les erreurs en temps réel:');
  console.log('   → Ouvrez l\'onglet Console et filtrez par "Error"');
  console.log('\n   Pour désactiver temporairement le script SIMPLE:');
  console.log('   → Supprimez le script de la page ou commentez-le');
  
  console.log('\n===========================================');
  return {
    scripts: allScripts.length,
    relanceScripts: relanceScripts.length,
    blockingScripts: blockingScripts.length,
    transcriptExists: !!transcriptEl,
    buttonExists: !!btn,
    testClick: window.testClick
  };
})();

