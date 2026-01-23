// 🔍 TEST DE PROTECTION CONTRE SUPPRESSION
// Copier-coller dans la console pour tester

(function testProtection() {
  console.group('🔍 TEST PROTECTION SUPPRESSION');
  
  const root = document.querySelector('#transcriptEditor');
  if (!root) {
    console.error('❌ transcriptEditor non trouvé');
    console.groupEnd();
    return;
  }
  
  console.log('✅ transcriptEditor trouvé');
  console.log('   - __bound:', root.__bound);
  console.log('   - Mode:', root.dataset.mode || 'non défini');
  
  // Vérifier si le listener keydown existe
  const segText = root.querySelector('.ag-seg__text');
  if (!segText) {
    console.error('❌ Aucun segment trouvé');
    console.groupEnd();
    return;
  }
  
  console.log('✅ Segment trouvé:', segText.textContent.substring(0, 50));
  
  // Test 1 : Vérifier que la protection est active
  const currentText = (segText.innerText || segText.textContent || '').trim();
  console.log('📝 Contenu actuel:', {
    longueur: currentText.length,
    texte: currentText.substring(0, 30)
  });
  
  // Test 2 : Simuler une suppression dangereuse
  if (currentText.length > 10) {
    console.log('🧪 Test de protection...');
    
    // Sélectionner tout le texte
    const range = document.createRange();
    range.selectNodeContents(segText);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Simuler Backspace
    const event = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
      keyCode: 8
    });
    
    const textBefore = segText.textContent.trim();
    segText.dispatchEvent(event);
    const textAfter = segText.textContent.trim();
    
    console.log('📊 Résultat test:', {
      avant: textBefore.length,
      apres: textAfter.length,
      protection: event.defaultPrevented ? '✅ ACTIVE' : '❌ INACTIVE',
      texteConservé: textAfter.length > 0 ? '✅ OUI' : '❌ NON'
    });
    
    // Restaurer le texte si nécessaire
    if (textAfter.length < textBefore.length && textAfter.length < 5) {
      segText.textContent = textBefore;
      console.log('✅ Texte restauré');
    }
  } else {
    console.warn('⚠️ Segment trop court pour tester');
  }
  
  console.groupEnd();
})();

