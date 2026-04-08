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
│   │   ├── teams-oauth-embed.html  # Embed Webflow : liaison Microsoft Teams / OAuth (Mon compte Business)
│   │   ├── pro.js         # Version PRO
│   │   └── free.js        # Version FREE
│   │
│   └── editor/             # Scripts de la page Éditeur
│       └── relance-compte-rendu.js  # Relance/régénération compte-rendu
│   │
│   └── profile/            # Mon compte — studio prompts (bundles IIFE)
│       ├── agilo-prompt-studio.js
│       └── agilo-prompt-studio.css
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

### Page Business — Mon compte (Microsoft Teams / OAuth)

Snippet **copier-coller** dans un composant **Embed** Webflow (HTML + styles + script dans le même bloc) :

- Fichier source : [`scripts/pages/dashboard/teams-oauth-embed.html`](pages/dashboard/teams-oauth-embed.html)
- Prérequis : `getToken` → `window.globalToken`, champ `[name="memberEmail"]`. Utilisable sur **Mon compte** Free / Pro / Business : OAuth réel **uniquement** en Business ; Free/Pro → modale upgrade (Pro + Business ou Business seul), alignée sur `AgiloGate` / repli type dashboard Free.
- Forcer le plan : `window.AGILO_EDITION = 'free'|'pro'|'ent'` dans le head si l’URL ne suffit pas.
- Préfixe API : **défaut `/api/v1`** dans l’embed. Pour servlets à la racine du host : `window.AGILO_MS_OAUTH_PREFIX = '';` dans le head avant l’embed.
- Procédure de test : [`teams-oauth-WEBFLOW-QA.md`](pages/dashboard/teams-oauth-WEBFLOW-QA.md)
- Notes API / sécurité (sans secrets) : [`teams-oauth-SANITIZED-HOWTO.md`](pages/dashboard/teams-oauth-SANITIZED-HOWTO.md)

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

### Page Mon compte — Studio prompts (`agilo-prompt-studio`)

Bundle **IIFE** : `window.AgiloPromptStudio.init()`. Prérequis : `window.globalToken`, champ `input[name="memberEmail"]` (comme le reste du site business). Dernière livraison studio : **v1.04** (fermeture en croix, Conseils/CTA masqués en édition self-service, aperçu HTML live). **Pinner une révision** : utiliser le hash court du commit (ex. `@34beffe`) pour un CDN figé.

1. **Dans le Designer**, sur la page **Mon compte** (ou celle qui affiche les prompts), placer un **Embed** ou bloc HTML avec l’ancre :

```html
<div id="agilo-prompt-studio-anchor"></div>
```

2. **Head** (paramètres de la page → *Custom Code* → *Head code*) : feuille de styles.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@34beffe/scripts/pages/profile/agilo-prompt-studio.css">
```

3. **Footer** (*Before `</body>` tag*, **après** le script qui charge `globalToken` / Memberstack) : script + config + init.

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@34beffe/scripts/pages/profile/agilo-prompt-studio.js"></script>
<script>
  window.__AGILO_PROMPT_STUDIO__ = {
    enabled: true,
    readOnly: true,
    editHtml: false,
    studioMode: "simple",
    designHelpUrl: "https://www.agilotext.com/contact",
    showPreviewTab: true,
    showFieldList: true,
    showConsistencyTab: true,
    apiBase: "https://api.agilotext.com/api/v1",
    mountSelector: "#agilo-prompt-studio-anchor",
  };
  document.addEventListener("DOMContentLoaded", function () {
    if (window.AgiloPromptStudio) window.AgiloPromptStudio.init();
  });
</script>
```

- **Édition complète** : `readOnly: false`, `studioMode: "expert"`, `editHtml: true` (réservé aux comptes de confiance). En **simple** avec `readOnly: false` et `editHtml: true`, l’onglet HTML s’affiche aussi.
- **Mode expert** : omettre `studioMode` ou `studioMode: "expert"` ; combiner avec `editHtml: true` pour l’édition HTML.
- **Ouvrir un modèle depuis le tableau** (même `promptModelId` qu’en API) : `AgiloPromptStudio.openModalAndSelect("374");`

Source TypeScript et build : dépôt client **`Pharmacie_Morel`** → `packages/agilo-prompt-studio` (`npm run build`), puis recopier `dist/*.js` et `dist/*.css` vers ce dossier `profile/` avant commit.

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

