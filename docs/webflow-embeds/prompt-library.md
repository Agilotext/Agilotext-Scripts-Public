# Bibliothèque de modèles — embeds Webflow

**Branche :** `feat/prompt-library-webflow`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas coller tant que library2 n’est pas confirmé live.

Deux flags, jamais un seul :

| Flag | Rôle | Valeur initiale |
|------|------|-----------------|
| `library2Live` | Appeler `/api/v1/library2/` | `false` |
| `cse89Live` | CTA achat 890 € / 89 € | `false` (`/cse` pas live) |

En `library2Live: false` : listes v1, pin / duplicate / versions / create / rename / delete sur `/api/v1`. **Pas** de fausses cartes pack CSE.  
En `cse89Live: false` : cadenas (quand library2 les enverra) → mailto `contact@agilotext.com`, pas `CSERENTREE26`.

Page : onglets Modèles Agilotext (défaut, à la une + chips) / Mes modèles (grille ou tableau) / Épinglés (n/5) / Créer un modèle (wizard 4 questions).

## Fichiers

```
scripts/pages/library/library.css
scripts/pages/library/library-standards-meta.js
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

1. `scripts/pages/editor/token-resolver.js`
2. `scripts/pages/editor/agilo-editor-creds.js`
3. CSS + scripts library

TTL Web ~4 h. `library-api.js` 1.2 :

- ignore un cache `localStorage` sans `agilo:tokenIssuedAt` ou plus vieux que 3 h
- sur `error_invalid_token` / 401 / 403 : `getToken(email, edition, true)`, event `agilo:token`, **une** retry
- jamais afficher le hash `v2.l…` : « Session expirée, reconnexion… » puis « Session expirée. Recharge la page. »
- `library-main` remonte le catalogue si `agilo:token` arrive après une erreur auth

Sans token : message « Reconnecte-toi ». Jamais `targetUsername`.

## Embed page bibliothèque (×3)

Coller dans le body, après la nav. Ancre vide, le JS injecte les cartes.

Pin jsDelivr : commit `ad069ec8` (library + creds). Library + creds + standards-meta.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library.css?v=ad069ec8">

<div class="agilo-lib" id="agilo-prompt-library-anchor"></div>

<script>
  window.__AGILO_PROMPT_LIBRARY__ = {
    library2Live: false,
    cse89Live: false,
    atelierEnabled: false,
    apiBase: "https://api.agilotext.com/api/v1",
    library2Base: "https://api.agilotext.com/api/v1/library2",
    mountSelector: "#agilo-prompt-library-anchor",
    ctaMailto: "mailto:contact@agilotext.com?subject=Pack%20CSE",
    ctaAnnualUrl: "/cse",
    ctaMonthlyUrl: "/cse"
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/editor/token-resolver.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/editor/agilo-editor-creds.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-standards-meta.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-api.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-core.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-catalog.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-main.js?v=ad069ec8"></script>
```

`atelierEnabled: true` seulement si `agilo-prompt-atelier.css/js` 1.10 est aussi chargé (bouton Modifier ouvre l’atelier). Sinon Modifier envoie vers `/app/{palier}/profile?tab=prompts`.

L’édition (`free` / `pro` / `ent`) est déduite du chemin `/app/free|premium|business/`. Pas trois JS.

`agilo-editor-creds.js` est sur cette branche (absent de `origin/main`). Ne pas pointer `@1.07` pour la biblio : un seul SHA pour CSS + library + creds.

## Pages Designer (staging, à la main)

Le MCP Webflow de cette session n’expose que l’auth. Les 3 coquilles se font dans **agilotext-test** Designer.

### Inventaire nav (avant de coder les liens)

Dans le panneau Symboles, chercher `App_dashboard-menu`, `nav-app`, `menu-app`, hamburger mobile.

| Surface | Free | Premium | Business |
|---------|------|---------|----------|
| Dashboard | `/app/free/dashboard` | `/app/premium/dashboard` | `/app/business/dashboard` |
| Mes transcripts | `/app/free/mes-transcripts` | `/app/premium/mes-transcripts` | `/app/business/mes-transcripts` |
| Éditeur | page éditeur du palier | idem | idem |
| Menu mobile | hamburger du même symbole | idem | idem |

- **Symbole unique** : un lien « Bibliothèque » (slug du palier) propage dashboard + transcripts + éditeur + mobile.
- **Pas un symbole** : 9+ pages à la main. Ne pas oublier le menu mobile.

### Créer les 3 pages

1. Dupliquer une page déjà gated (ex. Mes transcripts du palier).
2. Slugs :
   - `/app/free/bibliotheque`
   - `/app/premium/bibliotheque`
   - `/app/business/bibliotheque`
3. Memberstack : **mêmes groupes** que le dashboard du palier.
4. Page settings : `noindex`, hors sitemap marketing, titre « Bibliothèque de modèles ».
5. Body : nav existante + ancre vide `#agilo-prompt-library-anchor` + embed pin SHA. Flags `library2Live: false` et `cse89Live: false` au début.
6. Publier **staging only** (`agilotext-test.webflow.io`). Prod www inchangée.

CSE n’a **pas** de 4e page. Payeur `pln_cse-*` → `/app/business/bibliotheque` après le routeur v8.2.

## Picker dashboard (après la page biblio)

Garder `#default-template-select` dans le formulaire (upload / `doSummary`). Le picker le masque visuellement et écrit `select.value`.

1. Ajouter juste **avant** le select : `<div id="agilo-prompt-picker-anchor"></div>`
2. Embed (même SHA), **sans** `library-main.js` :

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library.css?v=ad069ec8">
<script>
  window.__AGILO_PROMPT_LIBRARY__ = window.__AGILO_PROMPT_LIBRARY__ || {
    library2Live: false,
    cse89Live: false,
    pickerSelector: "#agilo-prompt-picker-anchor"
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/editor/token-resolver.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/editor/agilo-editor-creds.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-standards-meta.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-api.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-core.js?v=ad069ec8"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-picker.js?v=ad069ec8"></script>
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

Aperçu local sans API : `docs/webflow-embeds/prompt-library-preview.html?mock=business`.

| Compte | Attendu |
|--------|---------|
| Free | Onglet Agilotext en premier, 3 cartes à la une, Créer bloqué (message plan), pas d’erreur console |
| Pro | Wizard + duplicate + tableau, Modifier → `/app/premium/profile?tab=prompts` si atelier absent |
| Business (Bauer) | Agilotext d’abord, chips, recherche, tableau triable, 6e épingle → plafond, duplicate d’un standard → Mes modèles, wizard READY, suppression du défaut → modèle Agilotext |
| Mobile 375 px | Onglets scrollables, cartes 1 colonne, tableau replié en cartes |

Query `?pack=pending` : bandeau « pack en cours d’activation » + recharger. Hash `#creer` ouvre le wizard.

Après library2 + clone cse : cadenas cse, CTA mailto si `cse89Live` false. CSE 89 (après Java) atterrit Business.

## Rollback

1. `library2Live` / `cse89Live` → false
2. Retirer le lien nav (symbole)
3. Dépublier les 3 pages si besoin
4. Picker : remettre l’inline `code-model-default-*`

Purge jsDelivr : `https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@ad069ec8/scripts/pages/library/library-main.js`

## Vérif CDN

Ouvrir l’URL jsDelivr du SHA → JavaScript 200, pas une 404 HTML. Puis hard refresh `agilotext-test.webflow.io` (Cmd+Shift+R).
