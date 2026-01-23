(function() {
  console.log('=== DIAGNOSTIC FINAL SAVE SCRIPT ===\n');
  
  // 1. Vérifier si le script est dans le DOM
  console.log('1. SCRIPT DANS LE DOM:');
  const scripts = Array.from(document.scripts);
  const saveScript = scripts.find(s => 
    s.src && (
      s.src.includes('Code-save_transcript-CORRIGE') ||
      s.src.includes('save_transcript') ||
      s.src.includes('save-transcript')
    )
  );
  
  if (saveScript) {
    console.log('   ✅ Script trouvé dans le DOM');
    console.log('   ✅ URL:', saveScript.src);
    console.log('   ✅ ReadyState:', saveScript.readyState, '(complete=4, loaded=3, loading=2)');
    console.log('   ✅ Async:', saveScript.async);
    console.log('   ✅ Defer:', saveScript.defer);
    
    if (saveScript.readyState !== 'complete' && saveScript.readyState !== 'loaded') {
      console.log('   ⚠️ Script pas encore complètement chargé');
    }
  } else {
    console.log('   ❌ PROBLÈME: Script PAS dans le DOM !');
    console.log('   💡 Vérifiez qu\'il est bien dans Webflow');
    console.log('   💡 Vérifiez l\'URL dans Webflow');
  }
  
  // 2. Vérifier l'URL exacte
  console.log('\n2. VÉRIFICATION URL:');
  if (saveScript) {
    const url = saveScript.src;
    const isMain = url.includes('@main');
    const isCorrectPath = url.includes('Code-save_transcript-CORRIGE.js');
    const hasCacheBuster = url.includes('?v=');
    
    console.log('   ✅ Utilise @main:', isMain ? 'OUI' : '❌ NON');
    console.log('   ✅ Chemin correct:', isCorrectPath ? 'OUI' : '❌ NON');
    console.log('   ✅ Cache buster:', hasCacheBuster ? 'OUI' : '❌ NON');
    
    if (!isMain || !isCorrectPath) {
      console.log('   ❌ PROBLÈME: URL incorrecte !');
      console.log('   💡 URL attendue: https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/Code-save_transcript-CORRIGE.js');
    }
  }
  
  // 3. Tester le chargement direct depuis GitHub
  console.log('\n3. TEST CHARGEMENT DIRECT:');
  const testUrl = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/Code-save_transcript-CORRIGE.js?v=' + Date.now();
  
  console.log('   💡 Téléchargement du script...');
  fetch(testUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(scriptText => {
      console.log('   ✅ Script téléchargé:', scriptText.length, 'caractères');
      
      // Vérifier le contenu
      const hasFullVersion = scriptText.includes('__agiloSave_FULL_12_JSON_CONTENT');
      const hasSimpleVersion = scriptText.includes('__agiloSave_MANUAL_SIMPLE');
      
      console.log('   ✅ Version complète (FULL_12):', hasFullVersion ? 'OUI' : '❌ NON');
      console.log('   ✅ Version simple (MANUAL_SIMPLE):', hasSimpleVersion ? 'OUI' : '❌ NON');
      
      if (!hasFullVersion && hasSimpleVersion) {
        console.log('   ❌ PROBLÈME: Le CDN a encore l\'ancienne version simplifiée !');
        console.log('   💡 Attendez 2-3 minutes pour que le CDN se mette à jour');
        console.log('   💡 Ou utilisez le commit hash directement');
      }
      
      // Charger le script manuellement
      console.log('   💡 Chargement manuel du script...');
      const script = document.createElement('script');
      script.src = testUrl;
      script.async = false;
      
      script.onload = function() {
        console.log('   ✅ Script chargé (onload)');
        setTimeout(() => {
          const loaded = typeof window.__agiloSave_FULL_12_JSON_CONTENT !== 'undefined';
          const hasFunction = typeof window.agiloSaveNow === 'function';
          
          console.log('   ✅ Après chargement:');
          console.log('      __agiloSave_FULL_12_JSON_CONTENT:', loaded ? '✅ OUI' : '❌ NON');
          console.log('      agiloSaveNow:', hasFunction ? '✅ OUI' : '❌ NON');
          
          if (loaded && hasFunction) {
            console.log('   🎉 SUCCÈS ! Le script fonctionne maintenant.');
            console.log('   💡 Testez avec: window.agiloSaveNow()');
            
            // Tester le bouton
            const btn = document.querySelector('[data-action="save-transcript"]') || document.querySelector('button.button.save');
            if (btn) {
              console.log('   💡 Le bouton devrait maintenant fonctionner !');
            }
          } else {
            console.log('   ❌ Le script s\'est chargé mais les fonctions ne sont pas disponibles.');
            console.log('   💡 Il y a probablement une erreur dans le script.');
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
    });
  
  // 4. Vérifier les erreurs console
  console.log('\n4. VÉRIFICATION ERREURS:');
  console.log('   💡 Regardez l\'onglet Console pour des erreurs en rouge');
  console.log('   💡 Regardez l\'onglet Network (F12 > Network)');
  console.log('   💡 Cherchez "Code-save_transcript-CORRIGE.js" dans Network');
  console.log('   💡 Vérifiez le statut HTTP (doit être 200)');
  
  // 5. Vérifier l'ordre de chargement
  console.log('\n5. ORDRE DE CHARGEMENT:');
  const mainEditor = scripts.find(s => s.src && s.src.includes('Code-main-editor'));
  if (mainEditor && saveScript) {
    const mainIndex = scripts.indexOf(mainEditor);
    const saveIndex = scripts.indexOf(saveScript);
    console.log('   ✅ Main Editor index:', mainIndex);
    console.log('   ✅ Save Script index:', saveIndex);
    console.log('   ✅ Ordre correct:', mainIndex < saveIndex ? 'OUI' : '❌ NON');
    
    if (mainIndex >= saveIndex) {
      console.log('   ❌ PROBLÈME: Save script chargé AVANT Main Editor !');
      console.log('   💡 Dans Webflow, Main Editor doit être AVANT Save Script');
    }
  }
  
  // 6. Instructions finales
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Si le script n\'est pas dans le DOM:');
  console.log('   - Vérifiez qu\'il est bien dans Webflow');
  console.log('   - Page Settings > Custom Code > Footer');
  console.log('');
  console.log('2. Si le CDN a encore l\'ancienne version:');
  console.log('   - Attendez 2-3 minutes');
  console.log('   - Ou utilisez cette URL avec commit hash:');
  console.log('     https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f25b503/scripts/pages/editor/Code-save_transcript-CORRIGE.js');
  console.log('');
  console.log('3. Si le script se charge mais les fonctions ne sont pas disponibles:');
  console.log('   - Vérifiez les erreurs dans la console');
  console.log('   - Vérifiez que Main Editor est chargé avant Save Script');
  
  console.log('\n=== FIN DIAGNOSTIC ===');
})();

