# 📁 Scripts Page Éditeur

## 🎯 Structure

Tous les scripts de la page éditeur sont organisés ici et chargés depuis GitHub via jsDelivr.

## 📋 Scripts Disponibles

### 1. `token-resolver.js`
**Rôle** : Résolution et rafraîchissement automatique des tokens d'authentification.

**Fonctionnalités** :
- Résolution de l'email utilisateur (Memberstack, localStorage, DOM)
- Récupération du token depuis l'API ou le cache
- Broadcast du token via événement `agilo:token`
- Gestion des erreurs avec timeout (30s)

**Dépendances** : Aucune

---

### 2. `orchestrator.js`
**Rôle** : Orchestration des jobs et synchronisation des credentials.

**Fonctionnalités** :
- Gestion des changements de job (évite les conflits)
- Application des credentials aux liens de téléchargement
- Système de subscribers pour annuler les opérations en cours
- Force l'édition depuis l'URL ou le DOM

**Dépendances** : `token-resolver.js` (écoute `agilo:token`)

---

### 3. `ready-count.js`
**Rôle** : Met à jour le compteur de jobs prêts dans le menu de navigation.

**Fonctionnalités** :
- Attend le token global
- Appelle l'API `getJobsInfo` pour compter les jobs prêts
- Met à jour l'élément `#readyCount`
- Timeout de sécurité (10s max)

**Dépendances** : `token-resolver.js` (nécessite `globalToken`)

---

### 4. `relance-compte-rendu.js`
**Rôle** : Relance/régénération du compte-rendu.

**Fonctionnalités** :
- Bouton "Relancer Compte-Rendu"
- Gestion des limites de régénération
- Compteur de régénérations restantes
- Messages d'information contextuels

**Dépendances** : `token-resolver.js`, `orchestrator.js`

---

### 5. `editor-main.js` (Loader)
**Rôle** : Charge tous les scripts dans le bon ordre.

**Fonctionnalités** :
- Chargement séquentiel des scripts
- Gestion des erreurs de chargement
- Logs de débogage (si `AGILO_DEBUG = true`)

**Dépendances** : Aucune (script principal à charger)

---

## 🚀 Utilisation dans Webflow

### Option 1 : Charger le loader principal (RECOMMANDÉ)

Dans **Webflow Footer Code** :

```html
<!-- Script principal qui charge tous les autres -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/editor-main.js"></script>
```

**Avantages** :
- ✅ Un seul script à maintenir dans Webflow
- ✅ Chargement automatique dans le bon ordre
- ✅ Facile à mettre à jour

---

### Option 2 : Charger les scripts individuellement

Si vous préférez charger les scripts un par un :

```html
<!-- Dans l'ordre de dépendance -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/token-resolver.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/orchestrator.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/ready-count.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/relance-compte-rendu.js"></script>
```

**Avantages** :
- ✅ Contrôle total sur l'ordre de chargement
- ✅ Possibilité de charger seulement certains scripts

---

## 🔧 Configuration

### Mode Debug

Pour activer les logs de débogage, ajoutez **AVANT** les scripts :

```html
<script>
  window.AGILO_DEBUG = true; // Mettre à false en production
</script>
```

---

## ✅ Améliorations Appliquées

Tous les scripts ont été corrigés avec :

- ✅ **Cleanup automatique** : Tous les `setInterval` et `addEventListener` sont nettoyés dans `beforeunload`
- ✅ **Timeouts sur fetch** : Tous les `fetch` ont un timeout (30s par défaut)
- ✅ **Gestion d'erreurs** : Tous les `catch` loggent les erreurs (si DEBUG activé)
- ✅ **Console.log conditionnels** : Tous les logs sont conditionnés par `AGILO_DEBUG`
- ✅ **Pas de fuites mémoire** : MutationObserver et event listeners sont nettoyés

---

## 📝 Notes

- Les scripts sont chargés **séquentiellement** pour respecter les dépendances
- Le script `editor-main.js` est optionnel : vous pouvez charger les scripts individuellement si vous préférez
- Tous les scripts utilisent `jsDelivr` CDN pour un chargement rapide et fiable

---

## 🔄 Mise à Jour

Pour mettre à jour un script :
1. Modifiez le fichier dans GitHub
2. Commitez et poussez
3. Les changements sont immédiatement disponibles (jsDelivr met à jour automatiquement)

