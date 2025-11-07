# 📁 Structure des Scripts Agilotext

## 🎯 Organisation par Pages

Ce repository contient tous les scripts JavaScript utilisés sur le site Webflow Agilotext, organisés par **page/fonctionnalité**.

---

## 📂 Structure

```
scripts/
├── pages/
│   ├── dashboard/          # Scripts de la page Dashboard (upload fichiers)
│   │   ├── ent.js         # Version ENT (Business/Enterprise)
│   │   ├── pro.js         # Version PRO
│   │   └── free.js        # Version FREE
│   │
│   └── editor/             # Scripts de la page Éditeur
│       └── relance-compte-rendu.js  # Relance/régénération compte-rendu
│
└── shared/                 # Fonctions partagées (futur)
    └── (à venir)
```

---

## 📋 Utilisation dans Webflow

### Page Dashboard ENT
```html
<script src="https://raw.githubusercontent.com/Agilotext/Client/main/scripts/pages/dashboard/ent.js"></script>
```

### Page Dashboard PRO
```html
<script src="https://raw.githubusercontent.com/Agilotext/Client/main/scripts/pages/dashboard/pro.js"></script>
```

### Page Dashboard FREE
```html
<script src="https://raw.githubusercontent.com/Agilotext/Client/main/scripts/pages/dashboard/free.js"></script>
```

### Page Éditeur (Relance Compte-Rendu)
```html
<script src="https://raw.githubusercontent.com/Agilotext/Client/main/scripts/pages/editor/relance-compte-rendu.js"></script>
```

---

## 🔄 Maintenance

- **Modifier un script** : Éditez directement dans GitHub ou localement puis `git push`
- **Ajouter un nouveau script** : Créez-le dans le dossier approprié selon la page
- **Les changements sont immédiatement disponibles** (pas de cache)

---

## 📝 Convention de Nommage

- **Fichiers** : `kebab-case.js` (ex: `relance-compte-rendu.js`)
- **Dossiers** : `kebab-case` (ex: `pages/editor/`)
- **Descriptions** : En français dans les commentaires

---

## 🚀 Prochaines Fonctionnalités

- `pages/dashboard/youtube-transcription.js` (à venir)
- `shared/utils.js` (fonctions partagées)
- `shared/api-helpers.js` (helpers API)

