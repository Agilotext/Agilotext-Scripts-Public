# 🔍 Commandes Console pour Tester et Déboguer le Script Staging

## 📋 Commandes de Diagnostic Rapide

### 1. Vérifier l'initialisation du script
```javascript
// Vérifier si le script est initialisé
console.log('Initialisé:', window.__agiloEditorRelanceInit);
console.log('Fonctions disponibles:', {
  updateButtonVisibility: typeof window.updateButtonVisibility,
  hasErrorMessageInDOM: typeof window.hasErrorMessageInDOM,
  hideButton: typeof window.hideButton,
  showButton: typeof window.showButton,
  relancerCompteRendu: typeof window.relancerCompteRendu
});
```

### 2. Vérifier l'état du bouton
```javascript
// État actuel du bouton
const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
if (btn) {
  console.log('Bouton trouvé:', {
    visible: window.getComputedStyle(btn).display !== 'none',
    disabled: btn.disabled,
    opacity: window.getComputedStyle(btn).opacity,
    hasForceHide: btn.classList.contains('agilo-force-hide'),
    hidden: btn.hasAttribute('hidden'),
    ariaHidden: btn.getAttribute('aria-hidden')
  });
} else {
  console.log('❌ Bouton non trouvé');
}
```

### 3. Vérifier l'état du DOM
```javascript
// État du DOM
const root = document.getElementById('editorRoot');
const summaryEl = document.getElementById('summaryEditor') || document.querySelector('[data-editor="summary"]');
console.log('État DOM:', {
  editorRoot: {
    exists: !!root,
    jobId: root?.dataset.jobId,
    summaryEmpty: root?.dataset.summaryEmpty,
    edition: root?.dataset.edition
  },
  summaryEditor: {
    exists: !!summaryEl,
    hasContent: summaryEl ? summaryEl.textContent.trim().length > 0 : false,
    contentLength: summaryEl ? summaryEl.textContent.length : 0,
    hasErrorMsg: summaryEl ? summaryEl.textContent.includes('pas encore disponible') : false
  }
});
```

### 4. Vérifier les messages d'erreur dans le DOM
```javascript
// Tester la détection d'erreur
if (typeof window.hasErrorMessageInDOM === 'function') {
  const hasError = window.hasErrorMessageInDOM();
  console.log('Message d\'erreur détecté:', hasError);
} else {
  console.log('❌ hasErrorMessageInDOM() non disponible');
}
```

### 5. Vérifier si un compte-rendu a été demandé (via API)
```javascript
// Cette fonction nécessite d'être dans le contexte du script
// Mais vous pouvez vérifier manuellement :
const jobId = document.getElementById('editorRoot')?.dataset.jobId || new URLSearchParams(location.search).get('jobId');
console.log('JobId actuel:', jobId);
```

## 🧪 Commandes de Test

### 1. Forcer la mise à jour de la visibilité du bouton
```javascript
// Forcer updateButtonVisibility
if (typeof window.updateButtonVisibility === 'function') {
  window.updateButtonVisibility().then(() => {
    console.log('✅ updateButtonVisibility() exécuté');
  }).catch(e => {
    console.error('❌ Erreur:', e);
  });
} else {
  console.log('❌ updateButtonVisibility() non disponible');
}
```

### 2. Forcer le masquage du bouton
```javascript
// Forcer hideButton
if (typeof window.hideButton === 'function') {
  const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
  if (btn) {
    window.hideButton(btn, 'test-manuel');
    console.log('✅ Bouton caché manuellement');
  } else {
    console.log('❌ Bouton non trouvé');
  }
} else {
  console.log('❌ hideButton() non disponible');
}
```

### 3. Forcer l'affichage du bouton
```javascript
// Forcer showButton
if (typeof window.showButton === 'function') {
  const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
  if (btn) {
    window.showButton(btn);
    console.log('✅ Bouton affiché manuellement');
  } else {
    console.log('❌ Bouton non trouvé');
  }
} else {
  console.log('❌ showButton() non disponible');
}
```

### 4. Simuler un changement de jobId
```javascript
// Simuler agilo:load
const jobId = '1000011991'; // Remplacez par un jobId valide
window.dispatchEvent(new CustomEvent('agilo:load', { detail: { jobId } }));
console.log('✅ Événement agilo:load déclenché pour jobId:', jobId);
```

### 5. Tester la régénération (ATTENTION : va vraiment régénérer !)
```javascript
// ⚠️ ATTENTION : Ceci va vraiment lancer une régénération !
if (typeof window.relancerCompteRendu === 'function') {
  const confirm = window.confirm('Voulez-vous vraiment lancer une régénération ?');
  if (confirm) {
    window.relancerCompteRendu().then(() => {
      console.log('✅ Régénération lancée');
    }).catch(e => {
      console.error('❌ Erreur:', e);
    });
  }
} else {
  console.log('❌ relancerCompteRendu() non disponible');
}
```

## 🔧 Commandes de Debug Avancé

### 1. Activer le mode DEBUG
```javascript
// Activer les logs détaillés (nécessite de modifier le script)
// Dans le script staging, changer : const DEBUG = false; → const DEBUG = true;
// Puis recharger la page
```

### 2. Surveiller les changements du DOM
```javascript
// Observer les changements de summaryEmpty
const root = document.getElementById('editorRoot');
if (root) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-summary-empty') {
        console.log('📊 summaryEmpty changé:', root.dataset.summaryEmpty);
      }
    });
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-summary-empty'] });
  console.log('✅ Observer activé sur editorRoot');
}
```

### 3. Surveiller les événements agilo
```javascript
// Écouter tous les événements agilo
['agilo:load', 'agilo:beforeload', 'agilo:token'].forEach(eventName => {
  window.addEventListener(eventName, (e) => {
    console.log(`📡 Événement ${eventName}:`, e.detail);
  });
});
console.log('✅ Écouteurs d\'événements agilo activés');
```

### 4. Vérifier les états stockés dans localStorage
```javascript
// Vérifier les états d'erreur stockés
const jobId = document.getElementById('editorRoot')?.dataset.jobId;
if (jobId) {
  const key = `agilo:summary-error:${jobId}`;
  const stored = localStorage.getItem(key);
  console.log('État d\'erreur stocké:', stored ? JSON.parse(stored) : null);
  
  // Vérifier aussi le hash
  const hashKey = `agilo:summary-hash:${jobId}`;
  const hash = localStorage.getItem(hashKey);
  console.log('Hash stocké:', hash);
}
```

## 📊 Diagnostic Complet en Une Commande

```javascript
// Diagnostic complet
(function() {
  console.log('%c🔬 DIAGNOSTIC COMPLET SCRIPT STAGING', 'font-size: 16px; font-weight: bold; color: #174a96;');
  console.log('===========================================');
  
  // 1. Initialisation
  console.log('1️⃣ INITIALISATION');
  console.log('   Initialisé:', window.__agiloEditorRelanceInit);
  console.log('   Fonctions:', {
    updateButtonVisibility: typeof window.updateButtonVisibility,
    hasErrorMessageInDOM: typeof window.hasErrorMessageInDOM,
    hideButton: typeof window.hideButton,
    showButton: typeof window.showButton
  });
  
  // 2. Bouton
  const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
  console.log('2️⃣ BOUTON');
  if (btn) {
    const styles = window.getComputedStyle(btn);
    console.log('   Trouvé: Oui');
    console.log('   Visible:', styles.display !== 'none' && styles.visibility !== 'hidden');
    console.log('   Disabled:', btn.disabled);
    console.log('   Opacity:', styles.opacity);
    console.log('   Force Hide:', btn.classList.contains('agilo-force-hide'));
  } else {
    console.log('   Trouvé: Non');
  }
  
  // 3. DOM
  const root = document.getElementById('editorRoot');
  const summaryEl = document.getElementById('summaryEditor') || document.querySelector('[data-editor="summary"]');
  console.log('3️⃣ DOM');
  console.log('   editorRoot:', {
    exists: !!root,
    jobId: root?.dataset.jobId,
    summaryEmpty: root?.dataset.summaryEmpty
  });
  console.log('   summaryEditor:', {
    exists: !!summaryEl,
    hasContent: summaryEl ? summaryEl.textContent.trim().length > 50 : false,
    hasError: summaryEl ? summaryEl.textContent.includes('pas encore disponible') : false
  });
  
  // 4. Détection erreur
  if (typeof window.hasErrorMessageInDOM === 'function') {
    const hasError = window.hasErrorMessageInDOM();
    console.log('4️⃣ DÉTECTION ERREUR');
    console.log('   Message erreur détecté:', hasError);
  }
  
  // 5. État stocké
  const jobId = root?.dataset.jobId;
  if (jobId) {
    const errorKey = `agilo:summary-error:${jobId}`;
    const errorState = localStorage.getItem(errorKey);
    console.log('5️⃣ ÉTAT STOCKÉ');
    console.log('   Erreur stockée:', errorState ? JSON.parse(errorState) : null);
  }
  
  console.log('===========================================');
})();
```

## 🚀 Commandes de Test Rapide

### Test rapide en une ligne
```javascript
// Test ultra-rapide
console.log('Init:', window.__agiloEditorRelanceInit, '| Bouton:', !!document.querySelector('[data-action="relancer-compte-rendu"]'), '| summaryEmpty:', document.getElementById('editorRoot')?.dataset.summaryEmpty);
```

### Forcer une vérification immédiate
```javascript
// Forcer updateButtonVisibility immédiatement
window.updateButtonVisibility && window.updateButtonVisibility().then(() => console.log('✅ Vérification terminée')).catch(e => console.error('❌ Erreur:', e));
```

## 📝 Notes

- **Mode DEBUG** : Pour activer les logs détaillés, modifiez `const DEBUG = false;` en `const DEBUG = true;` dans le script staging
- **Rechargement** : Après modification du script, recharger la page (Ctrl+R ou Cmd+R)
- **Console** : Ouvrir avec F12 ou Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows)

