# Bibliothèque de modèles — embeds Webflow

**Branche :** `feat/prompt-library-webflow`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas coller tant que library2 n’est pas confirmé live.

Deux flags, jamais un seul :

| Flag | Rôle | Valeur initiale |
|------|------|-----------------|
| `library2Live` | Appeler `/api/v1/library2/` | `false` |
| `cse89Live` | CTA achat 890 € / 89 € | `false` (`/cse` pas live) |

En `library2Live: false` : listes historiques v1, layout cartes, **pas** de fausses cartes pack CSE.  
En `cse89Live: false` : cadenas (quand library2 les enverra) → mailto `contact@agilotext.com`, pas `CSERENTREE26`.

## Fichiers

```
scripts/pages/library/library.css
scripts/pages/library/library-api.js
scripts/pages/library/library-core.js
scripts/pages/library/library-catalog.js
scripts/pages/library/library-main.js
scripts/pages/library/library-picker.js
scripts/pages/auth/post-login-router.js   (v8.2, CSE → business)
```

Interdit dans ce dossier public : SVG Nucleo, prompts clients, doc KawanSoft library2.

## Auth

Même bootstrap que l’éditeur, dans cet ordre :

1. `scripts/pages/editor/token-resolver.js` (pin SHA déjà en prod éditeur)
2. `scripts/pages/editor/agilo-editor-creds.js`
3. CSS + scripts library

Sans token : message « Reconnecte-toi ». Jamais `targetUsername`.

## Embed page bibliothèque (×3)

Coller dans le body, après la nav. Ancre vide, le JS injecte les cartes.

Remplacer `SHA` par le commit après push.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library.css?v=SHA">

<div class="agilo-lib" id="agilo-prompt-library-anchor"></div>

<script>
  window.__AGILO_PROMPT_LIBRARY__ = {
    library2Live: false,
    cse89Live: false,
    apiBase: "https://api.agilotext.com/api/v1",
    library2Base: "https://api.agilotext.com/api/v1/library2",
    mountSelector: "#agilo-prompt-library-anchor",
    ctaMailto: "mailto:contact@agilotext.com?subject=Pack%20CSE",
    ctaAnnualUrl: "/cse",
    ctaMonthlyUrl: "/cse"
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/editor/token-resolver.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/editor/agilo-editor-creds.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-api.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-core.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-catalog.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-main.js?v=SHA"></script>
```

L’édition (`free` / `pro` / `ent`) est déduite du chemin `/app/free|premium|business/`. Pas trois JS.

## Pages Designer (staging, à la main)

Webflow MCP ne crée pas ces pages ici. À faire dans **agilotext-test** Designer :

1. Inventaire nav : symbole `App_dashboard-menu` (ou équivalent). Si c’est un **symbole**, un lien « Bibliothèque » suffit pour dashboard + mes-transcripts + éditeur + mobile. Si chaque page a un clone, toucher les 9+ pages (3 paliers × dashboard / mes-transcripts / éditeur, plus hamburger).
2. Dupliquer une page déjà gated (ex. Mes transcripts).
3. Slugs :
   - `/app/free/bibliotheque`
   - `/app/premium/bibliotheque`
   - `/app/business/bibliotheque`
4. Memberstack : mêmes groupes que le dashboard du palier.
5. Page settings : `noindex`, hors sitemap marketing.
6. Body : titre optionnel + ancre `#agilo-prompt-library-anchor` + embed ci-dessus.
7. Publier **staging only**.

CSE n’a **pas** de 4e page. Payeur `pln_cse-*` → `/app/business/bibliotheque` après le routeur v8.2.

## Picker dashboard (après la page biblio)

Garder `#default-template-select` dans le formulaire (upload / `doSummary`). Le picker le masque visuellement et écrit `select.value`.

1. Ajouter juste **avant** le select : `<div id="agilo-prompt-picker-anchor"></div>`
2. Embed (même SHA), **sans** `library-main.js` :

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library.css?v=SHA">
<script>
  window.__AGILO_PROMPT_LIBRARY__ = window.__AGILO_PROMPT_LIBRARY__ || {
    library2Live: false,
    cse89Live: false,
    pickerSelector: "#agilo-prompt-picker-anchor"
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/editor/token-resolver.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/editor/agilo-editor-creds.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-api.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-core.js?v=SHA"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-picker.js?v=SHA"></script>
```

3. **Désactiver** l’embed inline `code-model-default-*` (populateDefaultTemplateSelect) pour éviter un double chargement. Le picker fait le POST `setPromptModelUserDefault`.
4. Répéter sur les 3 dashboards.

Le select d’upload n’affiche que les modèles `canUse` (ID positif ou 0–100). Les cadenas restent sur la page bibliothèque.

## Post-login v8.2

Embed existant `/auth/post-login` : pointer le SHA de cette branche.

- `pln_cse-5920aby` (préfixe `pln_cse-`) → `/app/business/dashboard`
- `pln_pack-cse` (cadeau) **ne** route **pas** vers business

Ticket Java parallèle (hors ce repo) : `DeriveEditionFromMemberstackMember` doit classer `pln_cse-5920aby` en édition business, jamais Free. Le front ne corrige pas les heures.

## Recette (Bauer + un Free test, pas Astrid)

| Compte | `library2Live` false | Après library2 + clone cse |
|--------|----------------------|----------------------------|
| Free | Cartes historiques | Cadenas cse, CTA mailto si `cse89Live` false |
| Pro | Idem | Idem |
| Business vanilla | Idem | Cadenas cse |
| CSE 89 (après Java) | Atterrit Business | Copie → ID positif → upload |
| Siège | Ce que le serveur dit | Pas de grant Memberstack DOM |

Query `?pack=pending` : bandeau « pack en cours d’activation » + recharger.

## Rollback

1. `library2Live` / `cse89Live` → false
2. Retirer le lien nav (symbole)
3. Dépublier les 3 pages si besoin
4. Picker : remettre l’inline `code-model-default-*`

Purge jsDelivr : `https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/library/library-main.js`

## Vérif CDN

Ouvrir l’URL jsDelivr du SHA → JavaScript 200, pas une 404 HTML. Puis hard refresh `agilotext-test.webflow.io` (Cmd+Shift+R).
