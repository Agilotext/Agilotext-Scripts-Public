# 📋 Suivi des Features - Agilotext Editor

Ce document permet de suivre toutes les features de la page éditeur et leur statut dans Webflow.

## 🎯 Comment utiliser ce document

1. **Ajouter une nouvelle feature** : Créez une nouvelle entrée avec le nom de l'Embed Code Webflow
2. **Mettre à jour le statut** : Changez le statut (✅ Actif, 🚧 En cours, ❌ Désactivé)
3. **Lier au script GitHub** : Indiquez le chemin du script dans le repo GitHub

---

## 📁 Structure des Scripts

Tous les scripts sont hébergés sur GitHub et chargés via jsDelivr CDN :
- **Base URL** : `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/`
- **Loader principal** : `editor-main.js` (charge tous les autres scripts automatiquement)

---

## 🎨 Features CSS

| Nom Webflow | Fichier GitHub | Statut | Description |
|------------|----------------|--------|-------------|
| `code-css` | `Code-editor-css.js` | ✅ Actif | CSS principal de l'éditeur (thème, lecteur audio, transcript) |
| `code-rename-menu-css` | `Code-rename-menu-css.js` | ✅ Actif | CSS pour le menu de renommage des locuteurs |
| `code-css-chat` | `Code-chat-css.js` | ✅ Actif | CSS pour l'interface de chat IA |
| `code-rail-css` | `Code-rail-css.js` | ✅ Actif | CSS pour la liste des jobs (rail) |

---

## 🔧 Features JavaScript - Utilitaires

| Nom Webflow | Fichier GitHub | Statut | Description |
|------------|----------------|--------|-------------|
| `code-token-resolver` | `token-resolver.js` | ✅ Actif | Résolution et rafraîchissement automatique des tokens |
| `code-orchestrator` | `orchestrator.js` | ✅ Actif | Orchestration des jobs et synchronisation des credentials |
| `code-ready-count` | `ready-count.js` | ✅ Actif | Compteur de jobs prêts dans le menu |

---

## 🎵 Features JavaScript - Composants Principaux

| Nom Webflow | Fichier GitHub | Statut | Description |
|------------|----------------|--------|-------------|
| `code-lecteur-audio` | `Code-lecteur-audio.js` | ✅ Actif | Lecteur audio avec contrôles (play, pause, vitesse, volume, timeline) |
| `code-main-editor` | `Code-main-editor.js` | ✅ Actif | Éditeur de transcript principal (segments, recherche, navigation) |
| `code-changement-audio` | `Code-changement-audio.js` | ✅ Actif | Rail de changement de job (liste, tri, recherche) |
| `code-chat` | `Code-chat.js` | ✅ Actif | Chat IA avec markdown, export PDF, copie clipboard |
| `code-ed-header` | `Code-ed-header.js` | ✅ Actif | Actions header (renommer, exporter, webhook, supprimer) |
| `code-questions-ia` | `Code-questions-ia.js` | ✅ Actif | Chips de questions IA pré-définies |
| `code-copy-paste-text` | `Code-copy-paste-text.js` | ✅ Actif | Amélioration copy/paste avec undo/redo |
| `code-save_transcript` | `Code-save_transcript.js` | ✅ Actif | Auto-save et sauvegarde manuelle avec détection de conflits |

---

## ✨ Features JavaScript - Animations & Effets

| Nom Webflow | Fichier GitHub | Statut | Description |
|------------|----------------|--------|-------------|
| `code-gsap` | `Code-gsap.js` | ✅ Actif | Animations GSAP (boutons, toasts, panneaux, segments) |
| `code-lottie` | `Code-lottie.js` | ✅ Actif | Intégration animations Lottie |

---

## 🔄 Features JavaScript - Additionnelles

| Nom Webflow | Fichier GitHub | Statut | Description |
|------------|----------------|--------|-------------|
| `code-relance-compte-rendu` | `relance-compte-rendu.js` | ✅ Actif | Relance de génération de compte-rendu avec limites et UI |

---

## 📦 Loader Principal

| Nom Webflow | Fichier GitHub | Statut | Description |
|------------|----------------|--------|-------------|
| `code-editor-main` | `editor-main.js` | ✅ Actif | **Loader principal** - Charge tous les scripts ci-dessus dans le bon ordre |

---

## 🚀 Intégration dans Webflow

### Option 1 : Loader Unique (Recommandé)

Utilisez **un seul Embed Code** dans Webflow qui charge `editor-main.js` :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/pages/editor/editor-main.js"></script>
```

**Avantages** :
- ✅ Un seul point d'entrée
- ✅ Gestion automatique de l'ordre de chargement
- ✅ Facile à maintenir

### Option 2 : Chargement Individuel

Si vous préférez charger chaque script individuellement, créez un Embed Code par feature avec le nom correspondant dans le tableau ci-dessus.

---

## 📝 Notes de Maintenance

- **Modifier un script** : Éditez le fichier dans GitHub, commit, push → jsDelivr met à jour automatiquement
- **Ajouter une feature** : Créez le fichier dans `scripts/pages/editor/`, ajoutez-le à `editor-main.js`, mettez à jour ce document
- **Désactiver une feature** : Retirez le script de la liste dans `editor-main.js` ou commentez-le

---

## 🔍 Debug

Pour activer le mode debug, ajoutez `?debug=1` à l'URL de la page éditeur.

---

**Dernière mise à jour** : $(date +"%Y-%m-%d")

