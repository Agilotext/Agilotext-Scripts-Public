(function() {
  console.log('=== DIAGNOSTIC COMPLET : SCRIPTS ET CONFLITS ===\n');
  
  // 1. Vérifier TOUS les scripts chargés
  console.log('1. TOUS LES SCRIPTS CHARGÉS:');
  const allScripts = Array.from(document.scripts);
  console.log('   ✅ Total scripts:', allScripts.length);
  
  const relevantScripts = allScripts.filter(s => 
    s.src && (
      s.src.includes('agilotext') ||
      s.src.includes('Agilotext') ||
      s.src.includes('save') ||
      s.src.includes('editor') ||
      s.src.includes('main-editor')
    )
  );
  
  console.log('   ✅ Scripts Agilotext trouvés:', relevantScripts.length);
  relevantScripts.forEach((s, i) => {
    console.log(`      ${i+1}. ${s.src}`);
    console.log(`         ✅ ReadyState: ${s.readyState} (complete=4, loaded=3, loading=2)`);
    console.log(`         ✅ Async: ${s.async}`);
    console.log(`         ✅ Defer: ${s.defer}`);
  });
  
  // 2. Vérifier les identifiants globaux
  console.log('\n2. IDENTIFIANTS GLOBAUX:');
  const identifiers = [
    '__agiloSave_FULL_12_JSON_CONTENT',
    '__agiloSave_MANUAL_SIMPLE',
    '__agiloSave_MANUAL_SIMPLE_STAGING',
    '__agiloSave_FULL_12_JSON_CONTENT_STAGING'
  ];
  
  identifiers.forEach(id => {
    const exists = typeof window[id] !== 'undefined';
    console.log(`   ${exists ? '✅' : '❌'} ${id}:`, exists ? 'OUI' : 'NON');
  });
  
  // 3. Vérifier les fonctions globales
  console.log('\n3. FONCTIONS GLOBALES:');
  const functions = [
    'agiloSaveNow',
    'agiloGetState',
    'agiloGetPayload',
    'visibleTextFromBox',
    'toast',
    'renderSegments',
    'syncDomToModel'
  ];
  
  functions.forEach(fn => {
    const exists = typeof window[fn] === 'function';
    console.log(`   ${exists ? '✅' : '❌'} ${fn}:`, exists ? 'FONCTION' : 'NON');
  });
  
  // 4. Vérifier les erreurs dans la console
  console.log('\n4. ERREURS CONSOLE:');
  console.log('   💡 Regardez l\'onglet Console pour des erreurs en rouge');
  console.log('   💡 Vérifiez particulièrement les erreurs de chargement de script');
  
  // 5. Tester le chargement manuel du script
  console.log('\n5. TEST CHARGEMENT MANUEL:');
  console.log('   💡 Testons le chargement direct du script...');
  
  const testUrl = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/Code-save_transcript-CORRIGE.js?v=' + Date.now();
  
  fetch(testUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(scriptText => {
      console.log('   ✅ Script téléchargé avec succès');
      console.log('   ✅ Taille:', scriptText.length, 'caractères');
      
      // Vérifier la présence de l'identifiant dans le script
      const hasIdentifier = scriptText.includes('__agiloSave_FULL_12_JSON_CONTENT');
      console.log('   ✅ Contient __agiloSave_FULL_12_JSON_CONTENT:', hasIdentifier ? 'OUI' : '❌ NON');
      
      // Vérifier la présence des fonctions
      const hasAgiloSaveNow = scriptText.includes('window.agiloSaveNow');
      console.log('   ✅ Contient window.agiloSaveNow:', hasAgiloSaveNow ? 'OUI' : '❌ NON');
      
      // Tester la syntaxe
      try {
        new Function(scriptText);
        console.log('   ✅ Syntaxe JavaScript valide');
      } catch (e) {
        console.error('   ❌ ERREUR DE SYNTAXE:', e.message);
        return;
      }
      
      // Essayer de charger le script
      console.log('   💡 Chargement du script dans le DOM...');
      const script = document.createElement('script');
      script.src = testUrl;
      script.async = false;
      
      script.onload = function() {
        console.log('   ✅ Script chargé (onload déclenché)');
        setTimeout(() => {
          const loaded = typeof window.__agiloSave_FULL_12_JSON_CONTENT !== 'undefined';
          const hasFunction = typeof window.agiloSaveNow === 'function';
          
          console.log('   ✅ __agiloSave_FULL_12_JSON_CONTENT:', loaded ? 'OUI' : '❌ NON');
          console.log('   ✅ agiloSaveNow:', hasFunction ? 'OUI' : '❌ NON');
          
          if (loaded && hasFunction) {
            console.log('   🎉 SUCCÈS ! Le script fonctionne maintenant.');
            console.log('   💡 Testez avec: window.agiloSaveNow()');
          } else {
            console.log('   ⚠️ Le script s\'est chargé mais les fonctions ne sont pas disponibles.');
            console.log('   💡 Il y a probablement une erreur d\'exécution dans le script.');
            console.log('   💡 Vérifiez les erreurs dans la console.');
          }
        }, 500);
      };
      
      script.onerror = function(e) {
        console.error('   ❌ ERREUR lors du chargement:', e);
      };
      
      document.head.appendChild(script);
    })
    .catch(error => {
      console.error('   ❌ ERREUR lors du téléchargement:', error);
      console.error('   💡 Vérifiez que l\'URL est correcte et accessible');
    });
  
  // 6. Vérifier l'ordre de chargement
  console.log('\n6. ORDRE DE CHARGEMENT:');
  const mainEditorScript = allScripts.find(s => 
    s.src && s.src.includes('Code-main-editor')
  );
  const saveScript = allScripts.find(s => 
    s.src && s.src.includes('Code-save_transcript')
  );
  
  if (mainEditorScript && saveScript) {
    const mainIndex = allScripts.indexOf(mainEditorScript);
    const saveIndex = allScripts.indexOf(saveScript);
    console.log('   ✅ Main Editor index:', mainIndex);
    console.log('   ✅ Save Script index:', saveIndex);
    console.log('   ✅ Ordre correct:', mainIndex < saveIndex ? 'OUI (Main avant Save)' : '❌ NON (Save avant Main)');
  } else {
    console.log('   ⚠️ Scripts non trouvés dans le DOM');
  }
  
  // 7. Vérifier les conflits de noms
  console.log('\n7. CONFLITS POTENTIELS:');
  const allWindowKeys = Object.keys(window).filter(k => 
    k.includes('agilo') || k.includes('save') || k.includes('Save')
  );
  console.log('   ✅ Clés window avec "agilo" ou "save":', allWindowKeys.length);
  allWindowKeys.forEach(key => {
    console.log(`      - ${key}:`, typeof window[key]);
  });
  
  // 8. Instructions finales
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Vérifiez que le script est bien dans Webflow:');
  console.log('   - Page Settings > Custom Code > Footer (ou Head)');
  console.log('   - URL doit être: https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/Code-save_transcript-CORRIGE.js');
  console.log('');
  console.log('2. Vérifiez l\'onglet Network (F12 > Network):');
  console.log('   - Rechargez la page');
  console.log('   - Cherchez "Code-save_transcript-CORRIGE.js"');
  console.log('   - Vérifiez le statut HTTP (doit être 200)');
  console.log('');
  console.log('3. Vérifiez l\'ordre de chargement:');
  console.log('   - Code-main-editor.js doit être chargé AVANT Code-save_transcript-CORRIGE.js');
  console.log('');
  console.log('4. Si le script ne se charge toujours pas:');
  console.log('   - Videz le cache (Cmd+Shift+R)');
  console.log('   - Vérifiez que la page est publiée dans Webflow');
  console.log('   - Vérifiez les erreurs dans la console');
  
  console.log('\n=== FIN DIAGNOSTIC ===');
})();

