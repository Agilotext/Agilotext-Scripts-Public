// Diagnostic complet du bouton Save
// Copiez-collez cette commande dans la console (F12)

(function() {
  console.log('=== DIAGNOSTIC COMPLET BOUTON SAVE ===\n');
  
  // 1. Vérifier si le script est chargé
  console.log('1. SCRIPT SAVE:');
  const scriptLoaded = typeof window.__agiloSave_MANUAL_SIMPLE !== 'undefined';
  console.log('   ✅ Script chargé:', scriptLoaded ? 'OUI' : '❌ NON');
  console.log('   ✅ agiloSaveNow:', typeof window.agiloSaveNow === 'function' ? 'OUI' : '❌ NON');
  console.log('   ✅ agiloGetState:', typeof window.agiloGetState === 'function' ? 'OUI' : '❌ NON');
  
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
    
    // Vérifier si un listener est attaché (approximatif)
    const hasListener = btn.onclick !== null || btn.__agiloSaveListener;
    console.log('   ✅ Event listener:', hasListener ? 'PEUT-ÊTRE' : 'INCONNU (ne peut pas vérifier directement)');
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
  }
  
  // 5. Vérifier l'onglet actif
  console.log('\n5. ONGLET ACTIF:');
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  console.log('   ✅ Onglet:', activeTab ? (activeTab.id || 'sans-id') : 'AUCUN');
  if (activeTab) {
    console.log('   ✅ ID:', activeTab.id);
    console.log('   ✅ Est transcript?', activeTab.id === 'tab-transcript' ? '✅ OUI' : '❌ NON');
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
  });
  
  // 7. Tester un clic manuel
  console.log('\n7. TEST CLIC MANUEL:');
  if (btn && typeof window.agiloSaveNow === 'function') {
    console.log('   ✅ Bouton et fonction disponibles');
    console.log('   💡 Pour tester, exécutez: window.agiloSaveNow()');
  } else if (btn) {
    console.log('   ⚠️ Bouton trouvé mais agiloSaveNow non disponible');
    console.log('   💡 Pour tester, exécutez: btn.click()');
  } else {
    console.log('   ❌ Impossible de tester (bouton ou fonction manquante)');
  }
  
  // 8. Vérifier les erreurs console
  console.log('\n8. ERREURS:');
  console.log('   💡 Vérifiez l\'onglet Console pour des erreurs en rouge');
  console.log('   💡 Vérifiez l\'onglet Network (F12 > Network) pour des requêtes échouées');
  
  // 9. Vérifier les conflits potentiels
  console.log('\n9. CONFLITS POTENTIELS:');
  const mainEditorLoaded = typeof window.renderSegments === 'function';
  console.log('   ✅ Main Editor chargé:', mainEditorLoaded ? 'OUI' : 'NON');
  console.log('   ✅ visibleTextFromBox:', typeof window.visibleTextFromBox === 'function' ? 'OUI' : 'NON');
  
  // 10. Test de sauvegarde directe
  console.log('\n10. TEST DIRECT:');
  if (typeof window.agiloSaveNow === 'function') {
    console.log('   💡 Exécutez cette commande pour tester:');
    console.log('   window.agiloSaveNow().then(r => console.log("Résultat:", r)).catch(e => console.error("Erreur:", e));');
  }
  
  console.log('\n=== FIN DIAGNOSTIC ===');
  console.log('\n💡 COMMANDES UTILES:');
  console.log('   - Tester sauvegarde: window.agiloSaveNow()');
  console.log('   - Voir l\'état: window.agiloGetState()');
  console.log('   - Voir le payload: window.agiloGetPayload()');
  console.log('   - Activer debug: window.agiloSaveDebug = true');
})();

