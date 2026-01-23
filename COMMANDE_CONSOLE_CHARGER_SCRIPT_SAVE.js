// Charger le script Save manuellement
// Copiez-collez cette commande dans la console (F12)

(function() {
  console.log('=== CHARGEMENT MANUEL DU SCRIPT SAVE ===\n');
  
  // Vérifier d'abord s'il y a des erreurs
  console.log('1. Vérification des erreurs...');
  const errorCount = console.error.toString().includes('native code') ? 'Vérifiez manuellement' : 'OK';
  console.log('   💡 Regardez s\'il y a des erreurs en rouge dans la console\n');
  
  // Charger le script depuis GitHub
  console.log('2. Chargement du script depuis GitHub...');
  const scriptUrl = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/Code-save_transcript-CORRIGE.js?v=' + Date.now();
  
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.async = false; // Important : charger de manière synchrone
  
  script.onload = function() {
    console.log('   ✅ Script chargé avec succès !');
    console.log('   ✅ Vérification...');
    
    setTimeout(() => {
      const loaded = typeof window.__agiloSave_MANUAL_SIMPLE !== 'undefined';
      const hasFunction = typeof window.agiloSaveNow === 'function';
      
      console.log('   ✅ __agiloSave_MANUAL_SIMPLE:', loaded ? 'OUI' : '❌ NON');
      console.log('   ✅ agiloSaveNow:', hasFunction ? 'OUI' : '❌ NON');
      
      if (loaded && hasFunction) {
        console.log('\n   🎉 SUCCÈS ! Le script est maintenant chargé.');
        console.log('   💡 Testez avec: window.agiloSaveNow()');
        
        // Tester automatiquement le bouton
        const btn = document.querySelector('[data-action="save-transcript"]');
        if (btn) {
          console.log('   💡 Le bouton devrait maintenant fonctionner. Cliquez dessus ou exécutez:');
          console.log('      window.agiloSaveNow()');
        }
      } else {
        console.log('\n   ⚠️ Le script s\'est chargé mais les fonctions ne sont pas disponibles.');
        console.log('   💡 Il y a peut-être une erreur dans le script. Vérifiez la console.');
      }
    }, 500);
  };
  
  script.onerror = function(e) {
    console.error('   ❌ ERREUR lors du chargement du script:', e);
    console.error('   💡 Vérifiez que l\'URL est correcte:', scriptUrl);
    console.error('   💡 Vérifiez l\'onglet Network (F12 > Network) pour voir l\'erreur HTTP');
  };
  
  // Ajouter le script au head
  document.head.appendChild(script);
  console.log('   📥 Chargement en cours depuis:', scriptUrl);
  console.log('   ⏳ Attendez quelques secondes...\n');
})();

