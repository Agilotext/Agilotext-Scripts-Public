// 🔍 DIAGNOSTIC COMPLET - Script chargé
// Copier-coller TOUT dans la console

(function diagnosticComplet() {
  console.group('🔍 DIAGNOSTIC SCRIPT CHARGÉ');
  
  // 1. Vérifier tous les scripts chargés
  const allScripts = Array.from(document.querySelectorAll('script[src]'));
  const saveScripts = allScripts.filter(s => {
    const src = s.src || '';
    return src.includes('Code-save_transcript') || src.includes('save_transcript');
  });
  
  console.log('📜 Scripts de sauvegarde trouvés:', saveScripts.length);
  saveScripts.forEach((script, i) => {
    const url = script.src || '';
    const name = url.split('/').pop() || 'unknown';
    const isStaging = name.includes('STAGING');
    console.log(`  ${i + 1}. ${name}`, {
      url: url.substring(0, 100) + '...',
      version: isStaging ? '🎭 STAGING' : '📦 PRODUCTION',
      chargé: script.parentNode ? '✅ OUI' : '❌ NON'
    });
  });
  
  // 2. Vérifier l'identifiant du script
  console.log('\n🔑 Identifiants de script:');
  console.log('  - __agiloSave_FULL_12_JSON_CONTENT:', window.__agiloSave_FULL_12_JSON_CONTENT ? '✅ PRÉSENT' : '❌ ABSENT');
  console.log('  - __agiloSave_FULL_12_JSON_CONTENT_STAGING:', window.__agiloSave_FULL_12_JSON_CONTENT_STAGING ? '✅ PRÉSENT' : '❌ ABSENT');
  
  // 3. Vérifier la version dans les logs (dernier message)
  console.log('\n📋 Dernier message de version:');
  console.log('  → Regardez dans la console pour voir le message:');
  console.log('  → "[agilo:save] ✅ init OK (...)"');
  console.log('  → "[agilo:save:STAGING] ✅ init OK (...)"');
  
  // 4. Vérifier les fonctions exposées
  console.log('\n🔧 Fonctions exposées:');
  console.log('  - agiloSaveNow:', typeof window.agiloSaveNow === 'function' ? '✅' : '❌');
  console.log('  - serializeAll:', typeof window.serializeAll === 'function' ? '✅' : '❌');
  console.log('  - verifyTranscriptReady:', typeof window.verifyTranscriptReady === 'function' ? '✅' : '❌');
  
  // 5. Vérifier le cache du navigateur
  console.log('\n💾 Cache navigateur:');
  console.log('  → Pour vider le cache:');
  console.log('  → Chrome/Edge: Ctrl+Shift+Delete (Cmd+Shift+Delete sur Mac)');
  console.log('  → Ou: Ctrl+Shift+R (Cmd+Shift+R sur Mac) pour recharger sans cache');
  
  // 6. Vérifier le réseau (chargement du script)
  console.log('\n🌐 Vérification réseau:');
  const networkScripts = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('Code-save_transcript') || r.name.includes('save_transcript'));
  networkScripts.forEach(r => {
    console.log(`  - ${r.name.split('/').pop()}:`, {
      chargé: r.transferSize > 0 ? '✅ OUI' : '❌ NON',
      taille: r.transferSize + ' bytes',
      durée: Math.round(r.duration) + 'ms',
      depuisCache: r.transferSize === 0 ? '⚠️ DEPUIS CACHE' : '✅ NOUVEAU'
    });
  });
  
  // 7. Solution : Forcer rechargement
  console.log('\n🔧 SOLUTION - Forcer rechargement:');
  console.log('  1. Ouvrez les DevTools (F12)');
  console.log('  2. Onglet Network');
  console.log('  3. Cochez "Disable cache"');
  console.log('  4. Rechargez la page (Ctrl+Shift+R ou Cmd+Shift+R)');
  
  console.groupEnd();
  
  // Retourner un résumé
  return {
    scripts: saveScripts.map(s => s.src),
    identifiant: window.__agiloSave_FULL_12_JSON_CONTENT ? 'PRODUCTION' : 
                 window.__agiloSave_FULL_12_JSON_CONTENT_STAGING ? 'STAGING' : 'AUCUN',
    fonctions: {
      agiloSaveNow: typeof window.agiloSaveNow === 'function',
      serializeAll: typeof window.serializeAll === 'function'
    }
  };
})();

