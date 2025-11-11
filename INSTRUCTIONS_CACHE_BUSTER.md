# 🔄 Instructions pour Forcer le Rechargement du Script Staging

## Problème
Le script staging n'est pas à jour car il est mis en cache par le navigateur ou le CDN.

## Solution 1 : Vider le Cache du Navigateur

### Chrome/Edge
1. Ouvrez les DevTools (F12)
2. Clic droit sur le bouton de rechargement
3. Sélectionnez "Vider le cache et effectuer une actualisation forcée" (ou Ctrl+Shift+R / Cmd+Shift+R)

### Firefox
1. Ouvrez les DevTools (F12)
2. Clic droit sur le bouton de rechargement
3. Sélectionnez "Vider le cache et actualiser" (ou Ctrl+Shift+R / Cmd+Shift+R)

## Solution 2 : Ajouter un Cache-Buster dans Webflow

Dans Webflow, modifiez l'URL du script staging pour ajouter un paramètre de cache-buster :

### URL Actuelle (probablement) :
```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu-staging.js"></script>
```

### URL avec Cache-Buster :
```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu-staging.js?v=ebb8915"></script>
```

Ou avec un timestamp :
```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu-staging.js?t=20250115"></script>
```

## Solution 3 : Vérifier que le Script est Chargé depuis GitHub

Dans la console du navigateur, vérifiez l'URL du script chargé :

```javascript
// Vérifier tous les scripts chargés
Array.from(document.scripts).forEach(script => {
  if (script.src.includes('relance-compte-rendu-staging')) {
    console.log('Script staging trouvé:', script.src);
  }
});
```

## Solution 4 : Vérifier la Version du Script

Dans la console, vérifiez si le script contient les nouvelles fonctionnalités :

```javascript
// Vérifier si la vérification ultra-agressive existe
fetch('https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu-staging.js')
  .then(r => r.text())
  .then(text => {
    if (text.includes('VÉRIFICATION ULTRA-AGRESSIVE')) {
      console.log('✅ Script à jour (contient VÉRIFICATION ULTRA-AGRESSIVE)');
    } else {
      console.log('❌ Script obsolète (ne contient pas VÉRIFICATION ULTRA-AGRESSIVE)');
    }
    if (text.includes('Script staging chargé')) {
      console.log('✅ Script à jour (contient "Script staging chargé")');
    } else {
      console.log('❌ Script obsolète (ne contient pas "Script staging chargé")');
    }
  });
```

## Solution 5 : Forcer le Rechargement via Console

Si le script est déjà chargé mais en cache, vous pouvez forcer son rechargement :

```javascript
// Supprimer l'ancien script
const oldScript = document.querySelector('script[src*="relance-compte-rendu-staging"]');
if (oldScript) {
  oldScript.remove();
  console.log('✅ Ancien script supprimé');
}

// Charger le nouveau script avec cache-buster
const newScript = document.createElement('script');
newScript.src = 'https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu-staging.js?v=' + Date.now();
document.head.appendChild(newScript);
console.log('✅ Nouveau script chargé:', newScript.src);
```

## Vérification Finale

Après avoir appliqué une solution, vérifiez dans la console :

```javascript
// Vérifier l'initialisation
console.log('Init:', window.__agiloEditorRelanceInit);

// Vérifier les fonctions
console.log('Fonctions:', {
  updateButtonVisibility: typeof window.updateButtonVisibility,
  hasErrorMessageInDOM: typeof window.hasErrorMessageInDOM
});

// Vérifier le bouton
const btn = document.querySelector('[data-action="relancer-compte-rendu"]');
const summaryEl = document.getElementById('summaryEditor');
if (summaryEl && summaryEl.textContent.includes('pas encore disponible')) {
  console.log('Message erreur présent, bouton devrait être caché');
  console.log('Bouton caché:', btn ? (window.getComputedStyle(btn).display === 'none' || btn.classList.contains('agilo-force-hide')) : 'bouton non trouvé');
}
```

## Note Importante

Le fichier HTML téléchargé (`Éditeur de transcripts _ Business.html`) charge le script depuis un fichier local, ce qui est normal pour une page sauvegardée. Pour tester les modifications, vous devez tester sur le site en ligne (agilotext-test.webflow.io), pas sur le fichier HTML local.

