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
└── shared/                 # Scripts et styles partagés (dictée, bannière app, etc.)
    ├── agilo-live-transcribe.js      # WebSocket Speechmatics temps réel
    ├── speechmatics-streaming.js
    ├── pcm-audio-worklet.js
    ├── agilo-mobile-app-banner.js    # Bannière « Télécharger l’app » (site mobile, sauf denylist)
    └── agilo-footer-app-download.css # QR stores au survol (footer Webflow)
```

---

## 📋 Utilisation dans Webflow

Repo CDN : **`Agilotext/Agilotext-Scripts-Public`** (branche `main`). Préférer **jsDelivr** pour servir les fichiers :

`https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/chemin/vers/fichier`

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

### Bannière app mobile (toutes les pages utiles sauf denylist)

Le script s’affiche sur **accueil, blog, légal, `/auth/*` (login, sign-up, …), `/app/*`, outils**, etc. Il **ne** s’affiche **pas** sur quelques chemins techniques (`/auth/post-login`, `/auth/mobile-auth`, `/auth/auth-mobile-apple`, `/style-guide`).

Ajouter en **Footer code** site (ou après `ent.js` / `pro.js` / `free.js` sur le dashboard) :

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/shared/agilo-mobile-app-banner.js"></script>
```

QA bureau : ajouter `?agilo_banner_test=1` sur n’importe quelle page autorisée (ex. `/` ou `/auth/login`).

### Footer — QR App Store / Play (CSS global)

Head Webflow :

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@main/scripts/shared/agilo-footer-app-download.css">
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

Documentation détaillée bannière + footer QR : voir le dépôt **AgilotextMobile** (`docs/WEBFLOW_MOBILE_BANNER_AND_FOOTER_QR.md`).

