// ============================================
// 🔍 COMMANDES CONSOLE POUR DIAGNOSTIQUER LES BOUTONS
// ============================================
// Copiez-collez ces commandes dans la console du navigateur

console.log('🔍 ========================================');
console.log('🔍 DIAGNOSTIC COMPLET DES BOUTONS');
console.log('🔍 ========================================');

// 1. VÉRIFIER LES BOUTONS
console.log('\n1️⃣ BOUTONS TROUVÉS:');
const saveBtn = document.querySelector('[data-action="save-transcript"]') || 
                document.querySelector('button.button.save[data-opentech-ux-zone-id]') || 
                document.querySelector('button.button.save');
const regenBtn = document.querySelector('[data-action="relancer-compte-rendu"]');

console.log('Bouton Sauvegarder:', {
  existe: !!saveBtn,
  id: saveBtn?.id,
  classes: saveBtn?.className,
  display: saveBtn ? window.getComputedStyle(saveBtn).display : 'N/A',
  visibility: saveBtn ? window.getComputedStyle(saveBtn).visibility : 'N/A',
  opacity: saveBtn ? window.getComputedStyle(saveBtn).opacity : 'N/A',
  hasClassHide: saveBtn?.classList.contains('agilo-hide-save'),
  styleDisplay: saveBtn?.style.display,
  styleVisibility: saveBtn?.style.visibility,
  styleOpacity: saveBtn?.style.opacity
});

console.log('Bouton Régénérer:', {
  existe: !!regenBtn,
  id: regenBtn?.id,
  classes: regenBtn?.className,
  display: regenBtn ? window.getComputedStyle(regenBtn).display : 'N/A',
  visibility: regenBtn ? window.getComputedStyle(regenBtn).visibility : 'N/A',
  opacity: regenBtn ? window.getComputedStyle(regenBtn).opacity : 'N/A',
  disabled: regenBtn?.disabled,
  styleDisplay: regenBtn?.style.display
});

// 2. VÉRIFIER LES ONGLETS
console.log('\n2️⃣ ONGLETS:');
const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
const tabChat = document.querySelector('#tab-chat');
const tabSummary = document.querySelector('#tab-summary');
const tabTranscript = document.querySelector('#tab-transcript');

console.log('Onglet actif:', {
  id: activeTab?.id,
  ariaSelected: activeTab?.getAttribute('aria-selected'),
  classes: activeTab?.className
});

console.log('Tous les onglets:', {
  chat: {
    existe: !!tabChat,
    ariaSelected: tabChat?.getAttribute('aria-selected'),
    classes: tabChat?.className
  },
  summary: {
    existe: !!tabSummary,
    ariaSelected: tabSummary?.getAttribute('aria-selected'),
    classes: tabSummary?.className
  },
  transcript: {
    existe: !!tabTranscript,
    ariaSelected: tabTranscript?.getAttribute('aria-selected'),
    classes: tabTranscript?.className
  }
});

// 3. VÉRIFIER LES PANNEAUX
console.log('\n3️⃣ PANNEAUX:');
const paneChat = document.querySelector('#pane-chat');
const paneSummary = document.querySelector('#pane-summary');
const paneTranscript = document.querySelector('#pane-transcript');

console.log('Panneaux:', {
  chat: {
    existe: !!paneChat,
    hidden: paneChat?.hasAttribute('hidden'),
    hasClassActive: paneChat?.classList.contains('is-active'),
    display: paneChat ? window.getComputedStyle(paneChat).display : 'N/A'
  },
  summary: {
    existe: !!paneSummary,
    hidden: paneSummary?.hasAttribute('hidden'),
    hasClassActive: paneSummary?.classList.contains('is-active'),
    display: paneSummary ? window.getComputedStyle(paneSummary).display : 'N/A'
  },
  transcript: {
    existe: !!paneTranscript,
    hidden: paneTranscript?.hasAttribute('hidden'),
    hasClassActive: paneTranscript?.classList.contains('is-active'),
    display: paneTranscript ? window.getComputedStyle(paneTranscript).display : 'N/A'
  }
});

// 4. VÉRIFIER LE COMPTE-RENDU
console.log('\n4️⃣ COMPTE-RENDU:');
const editorRoot = document.querySelector('#editorRoot');
const summaryEditor = document.querySelector('#summaryEditor');
const summaryEmpty = editorRoot?.dataset.summaryEmpty;

console.log('État compte-rendu:', {
  summaryEmpty: summaryEmpty,
  summaryEditorExists: !!summaryEditor,
  summaryEditorContent: summaryEditor ? (summaryEditor.innerHTML?.substring(0, 200) || 'vide') : 'N/A',
  hasLoader: summaryEditor?.querySelector('.summary-loading-indicator') ? true : false
});

// 5. VÉRIFIER LES SCRIPTS CHARGÉS
console.log('\n5️⃣ SCRIPTS CHARGÉS:');
console.log('Scripts Agilo chargés:', {
  saveScript: typeof window.__agiloSave_FULL_12_JSON_CONTENT !== 'undefined',
  relanceScript: typeof window.__agiloRelanceInitialized !== 'undefined',
  cacheScript: typeof window.agiloCacheBoutons === 'function',
  updateSaveVisibility: typeof window.updateSaveButtonVisibility === 'function'
});

// 6. VÉRIFIER LES STYLES CSS
console.log('\n6️⃣ STYLES CSS:');
const styleHide = document.querySelector('#agilo-save-button-hide-style');
console.log('Style CSS de cache:', {
  existe: !!styleHide,
  content: styleHide?.textContent?.substring(0, 200) || 'N/A'
});

// 7. FORCER LA MISE À JOUR
console.log('\n7️⃣ FORCER LA MISE À JOUR:');
if (typeof window.agiloCacheBoutons === 'function') {
  window.agiloCacheBoutons();
  console.log('✅ agiloCacheBoutons() appelée');
} else {
  console.warn('⚠️ agiloCacheBoutons() n\'existe pas');
}

if (typeof window.updateSaveButtonVisibility === 'function') {
  window.updateSaveButtonVisibility();
  console.log('✅ updateSaveButtonVisibility() appelée');
} else {
  console.warn('⚠️ updateSaveButtonVisibility() n\'existe pas');
}

// 8. SURVEILLER LES CHANGEMENTS
console.log('\n8️⃣ SURVEILLANCE EN TEMPS RÉEL:');
console.log('Pour surveiller les changements, exécutez:');
console.log(`
// Surveiller les changements d'onglets
const observer = new MutationObserver(() => {
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  const saveBtn = document.querySelector('[data-action="save-transcript"]');
  console.log('🔄 Changement détecté:', {
    onglet: activeTab?.id,
    boutonDisplay: saveBtn ? window.getComputedStyle(saveBtn).display : 'N/A'
  });
});

document.querySelectorAll('[role="tab"]').forEach(tab => {
  observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected'] });
});
`);

console.log('\n🔍 ========================================');
console.log('🔍 DIAGNOSTIC TERMINÉ');
console.log('🔍 ========================================');

