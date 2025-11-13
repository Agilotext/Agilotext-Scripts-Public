// 🔍 DIAGNOSTIC COMPLET - Bouton Sauvegarder
// Copiez-collez ce code dans la console

console.log('🔍 ========================================');
console.log('🔍 DIAGNOSTIC BOUTON SAUVEGARDER');
console.log('🔍 ========================================');

// 1. Vérifier l'onglet actif avec TOUTES les méthodes
const activeTab1 = document.querySelector('[role="tab"][aria-selected="true"]');
const activeTab2 = document.querySelector('[role="tab"].is-active');
const activeTab3 = document.querySelector('#tab-transcript.is-active') || 
                   document.querySelector('#tab-summary.is-active') || 
                   document.querySelector('#tab-chat.is-active');

// Vérifier les panes
const panes = document.querySelectorAll('[role="tabpanel"]');
let activePane = null;
panes.forEach(pane => {
  const isHidden = pane.hasAttribute('hidden');
  const hasIsActive = pane.classList.contains('is-active');
  const computedDisplay = window.getComputedStyle(pane).display;
  
  if (!isHidden && hasIsActive && computedDisplay !== 'none') {
    activePane = pane;
  }
});

console.log('\n📊 1. DÉTECTION ONGLET ACTIF:');
console.log('  - Méthode 1 (aria-selected):', activeTab1?.id || 'NON TROUVÉ');
console.log('  - Méthode 2 (is-active):', activeTab2?.id || 'NON TROUVÉ');
console.log('  - Méthode 3 (id.is-active):', activeTab3?.id || 'NON TROUVÉ');
console.log('  - Pane actif:', activePane?.id || 'NON TROUVÉ');

if (activePane) {
  const paneId = activePane.id;
  let correspondingTab = null;
  if (paneId === 'pane-transcript') correspondingTab = document.querySelector('#tab-transcript');
  else if (paneId === 'pane-summary') correspondingTab = document.querySelector('#tab-summary');
  else if (paneId === 'pane-chat') correspondingTab = document.querySelector('#tab-chat');
  console.log('  - Onglet correspondant au pane:', correspondingTab?.id || 'NON TROUVÉ');
}

// 2. Vérifier le bouton
const saveBtn = document.querySelector('[data-action="save-transcript"]');
console.log('\n📊 2. BOUTON SAUVEGARDER:');
if (!saveBtn) {
  console.error('  ❌ Bouton non trouvé');
} else {
  console.log('  ✅ Bouton trouvé:', {
    id: saveBtn.id,
    classes: saveBtn.className,
    hasHideClass: saveBtn.classList.contains('agilo-hide-save'),
    styleInline: saveBtn.getAttribute('style')?.substring(0, 200)
  });
  
  const computed = window.getComputedStyle(saveBtn);
  console.log('  📊 Styles calculés:', {
    display: computed.display,
    visibility: computed.visibility,
    opacity: computed.opacity,
    pointerEvents: computed.pointerEvents
  });
}

// 3. Vérifier la classe CSS
const hideStyle = document.querySelector('#agilo-save-button-hide-style');
console.log('\n📊 3. CLASSE CSS:');
console.log('  - Style agilo-hide-save existe:', !!hideStyle);
if (hideStyle) {
  console.log('  - Contenu:', hideStyle.textContent.substring(0, 200));
}

// 4. Tester la fonction
console.log('\n📊 4. FONCTION updateSaveButtonVisibility:');
if (typeof window.updateSaveButtonVisibility === 'function') {
  console.log('  ✅ Fonction trouvée');
  console.log('  🔄 Appel de la fonction...');
  window.updateSaveButtonVisibility();
  
  setTimeout(() => {
    if (saveBtn) {
      const computed = window.getComputedStyle(saveBtn);
      console.log('  📊 Après appel:', {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        hasHideClass: saveBtn.classList.contains('agilo-hide-save'),
        styleInline: saveBtn.getAttribute('style')?.substring(0, 200)
      });
    }
  }, 200);
} else {
  console.error('  ❌ Fonction non trouvée');
}

// 5. Comparer avec Compte-rendu
console.log('\n📊 5. COMPARAISON AVEC COMPTE-RENDU:');
const summaryTab = document.querySelector('#tab-summary');
const chatTab = document.querySelector('#tab-chat');
const transcriptTab = document.querySelector('#tab-transcript');

console.log('  - tab-summary:', {
  exists: !!summaryTab,
  ariaSelected: summaryTab?.getAttribute('aria-selected'),
  hasIsActive: summaryTab?.classList.contains('is-active')
});

console.log('  - tab-chat:', {
  exists: !!chatTab,
  ariaSelected: chatTab?.getAttribute('aria-selected'),
  hasIsActive: chatTab?.classList.contains('is-active')
});

console.log('  - tab-transcript:', {
  exists: !!transcriptTab,
  ariaSelected: transcriptTab?.getAttribute('aria-selected'),
  hasIsActive: transcriptTab?.classList.contains('is-active')
});

// 6. Vérifier les panes
console.log('\n📊 6. ÉTAT DES PANES:');
panes.forEach(pane => {
  const isHidden = pane.hasAttribute('hidden');
  const hasIsActive = pane.classList.contains('is-active');
  const computedDisplay = window.getComputedStyle(pane).display;
  
  console.log(`  - ${pane.id}:`, {
    hidden: isHidden,
    isActive: hasIsActive,
    display: computedDisplay
  });
});

console.log('\n🔍 ========================================');
console.log('🔍 DIAGNOSTIC TERMINÉ');
console.log('🔍 ========================================');

