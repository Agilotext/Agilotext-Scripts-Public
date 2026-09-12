# Bibliothèque de modèles — embeds Webflow

**Branche :** `feat/prompt-library-webflow`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas coller tant que library2 n’est pas confirmé live.

Recette Bauer 10 sept 16h22 : API **8.0.26** catalog **125**, persist / duplicate / delete library2 OK. Picker dans ce SHA. `library2Live: true` seulement sur **staging** après collage. Détail : `Clients/_interne_flo/RECETTE_8_0_26_LIBRARY2_2026-09-10.md`.

Deux flags, jamais un seul :

| Flag | Rôle | Valeur initiale |
|------|------|-----------------|
| `library2Live` | Appeler `/api/v1/library2/` | `false` |
| `cse89Live` | CTA achat 890 € / 89 € | `false` (`/cse` pas live) |

En `library2Live: false` : listes v1, pin / duplicate / versions / create / rename / delete sur `/api/v1`. **Pas** de fausses cartes pack CSE. Picker icônes inerte.
En `library2Live: true` : listes library2, SVG 0–7, picker USER (wizard dès l’étape 2 + fiche), suggest nom+objectif seulement.  
En `cse89Live: false` : cadenas (quand library2 les enverra) → mailto `contact@agilotext.com`, pas `CSERENTREE26`.

Page : onglets Modèles Agilotext (défaut, à la une + chips) / Mes modèles (grille ou tableau) / Épinglés (n/5) / Créer un modèle (landing + popup 4 questions). Fiche = overlay, pas une page Designer.

## Fichiers

```
scripts/pages/library/library.css
scripts/pages/library/library-standards-meta.js
scripts/pages/library/library-api.js
scripts/pages/library/library-core.js
scripts/pages/library/library-overlay.js
scripts/pages/library/library-icon-picker.js
scripts/pages/library/library-catalog.js
scripts/pages/library/library-main.js
scripts/pages/library/library-picker.js
scripts/pages/auth/post-login-router.js   (v8.2, CSE → business)
```

Interdit dans ce dossier public : pack / dossier SVG Nucleo, prompts clients, doc KawanSoft library2. Chrome = glyphes Nucleo **inlinés** (comme l’atelier). `iconUrl` serveur inchangé.

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

Pin jsDelivr : commit `18c8563a` (library + creds + icon-picker). Staging : `library2Live: true`. `cse89Live` reste false. Pas www.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library.css?v=18c8563a">

<div class="agilo-lib" id="agilo-prompt-library-anchor"></div>

<script>
  window.__AGILO_PROMPT_LIBRARY__ = {
    library2Live: true,
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
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/editor/token-resolver.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/editor/agilo-editor-creds.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-standards-meta.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-api.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-core.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-overlay.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-icon-picker.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-catalog.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-main.js?v=18c8563a"></script>
```

`atelierEnabled: true` seulement si `agilo-prompt-atelier.css/js` 1.10 est aussi chargé (bouton Modifier ouvre l’atelier). Sinon Modifier envoie vers `/app/{palier}/profile?tab=prompts`.

`library-api.js` mappe `acquiredPromptModelId` (badge « Dans Mes modèles », pas de 2e Ajouter). Il lit `usageCountGlobal`, `ratingAvg`, `ratingCount` s’ils arrivent du serveur. Le catalogue **ne les affiche pas**. Chips métier à 0 modèles : masqués.

Outil admin STANDARD (hidden → HTML → publish) : `docs/webflow-embeds/library2-standard-admin.md`. Pas `create_prompt` MCP.

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
   - `/app/free/library`
   - `/app/premium/library`
   - `/app/business/library`
3. Memberstack : **mêmes groupes** que le dashboard du palier.
4. Page settings : `noindex`, hors sitemap marketing, titre « Bibliothèque de modèles ».
5. Body : nav existante + ancre vide `#agilo-prompt-library-anchor` + embed pin SHA. Flags `library2Live: false` et `cse89Live: false` au début.
6. Publier **staging only** (`agilotext-test.webflow.io`). Prod www inchangée.

CSE n’a **pas** de 4e page. Payeur `pln_cse-*` → `/app/business/library` après le routeur v8.2.

## Picker dashboard (après la page biblio)

Garder `#default-template-select` dans le formulaire (upload / `doSummary`). Le picker le masque visuellement et écrit `select.value`.

1. Ajouter juste **avant** le select : `<div id="agilo-prompt-picker-anchor"></div>`
2. Embed (même SHA), **sans** `library-main.js` :

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library.css?v=18c8563a">
<script>
  window.__AGILO_PROMPT_LIBRARY__ = window.__AGILO_PROMPT_LIBRARY__ || {
    library2Live: false,
    cse89Live: false,
    pickerSelector: "#agilo-prompt-picker-anchor"
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/editor/token-resolver.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/editor/agilo-editor-creds.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-standards-meta.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-api.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-core.js?v=18c8563a"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-picker.js?v=18c8563a"></script>
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

Aperçu local sans API : `docs/webflow-embeds/prompt-library-preview.html?mock=business` (v1) ou `docs/webflow-embeds/preview-v2.html?mock=business` (v2).

| Compte | Attendu |
|--------|---------|
| Free | Onglet Agilotext en premier, 3 cartes à la une, Créer = popup offres, 0 appel `getPromptModelContent`, pas de Définir par défaut / Ajouter à mes modèles, pas d’erreur console |
| Pro | Popup 4 questions + duplicate + tableau, Modifier → `/app/premium/profile?tab=prompts` si atelier absent |
| Business (Bauer) | Bouton primaire bleu lisible, menu … hors du titre, Voir ouvre la fiche overlay, `#creer` ouvre la popup, chips, recherche, tableau triable, 6e épingle → plafond, duplicate d’un standard → Mes modèles, wizard READY, jeton périmé rafraîchi (régression 1.2) |
| Mobile 375 px | Overlay pleine largeur, onglets scrollables, cartes 1 colonne, tableau replié en cartes |

Query `?pack=pending` : bandeau « pack en cours d’activation » + recharger. Hash `#creer` ouvre la popup de création.

## UI v2 (staging, `uiV2: true`)

Nouvelle couche. v1 reste chargeable : `uiV2: false` (rollback). www et Astrid inchangés.

Fichiers en plus : `library-v2.css`, `library-core-v2.js`, `library-fiche-v2.js`, `library-wizard-v2.js`, `library-catalog-v2.js`, Studio `scripts/pages/profile/agilo-atelier-maquette-coach.{js,css}` (commit `f1a365a`), dictée `scripts/shared/agilo-speech-dictate.js`.

Aperçu local : `docs/webflow-embeds/preview-v2.html?mock=free|pro|business`. Studio factice, pas de token.

### Embed page bibliothèque v2 (×3, staging only)

Coller **à la place** de l’embed v1 sur les 3 pages `/app/{free,premium,business}/library`. Pin jsDelivr `b53928a6`.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library.css?v=b53928a6">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-v2.css?v=b53928a6">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/profile/agilo-atelier-maquette-coach.css?v=b53928a6">

<div class="agilo-lib" id="agilo-prompt-library-anchor"></div>
<div id="agilo-prompt-studio-anchor" hidden></div>

<script>
  window.__AGILO_PROMPT_LIBRARY__ = {
    library2Live: true,
    cse89Live: false,
    atelierEnabled: true,
    uiV2: true,
    apiBase: "https://api.agilotext.com/api/v1",
    library2Base: "https://api.agilotext.com/api/v1/library2",
    mountSelector: "#agilo-prompt-library-anchor",
    pricingUrl: "/tarifs",
    ctaMailto: "mailto:contact@agilotext.com?subject=Pack%20CSE",
    ctaAnnualUrl: "/cse",
    ctaMonthlyUrl: "/cse"
  };
  window.__AGILO_PROMPT_STUDIO__ = {
    enabled: true,
    mountSelector: "#agilo-prompt-studio-anchor",
    getAuth: function () {
      return window.AgiloLibraryApi && window.AgiloLibraryApi.credsForStudio
        ? window.AgiloLibraryApi.credsForStudio()
        : null;
    }
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/editor/token-resolver.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/editor/agilo-editor-creds.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/shared/agilo-speech-dictate.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-standards-meta.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-api.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-core.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-core-v2.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-overlay.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-icon-picker.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-fiche-v2.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-wizard-v2.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-catalog.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-catalog-v2.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/profile/agilo-atelier-maquette-coach.js?v=b53928a6"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b53928a6/scripts/pages/library/library-main.js?v=b53928a6"></script>
```

Rollback v2 : `uiV2: false` (recharge catalog v1, plus de CSS v2 ni Studio si tu les retires). Pas www.

### Redirect Mon compte → biblio (staging)

Snippet : `docs/webflow-embeds/profile-prompts-redirect.html`. Coller dans l’onglet Modèles des 3 pages Mon compte. `?tab=prompts` redirige vers `/app/{palier}/library#modele={open}`. Garde `?noredirect=1`. Le `<select id="default-template-select">` du dashboard n’est pas touché.

Audit liens `profile?tab=prompts` dans ce repo : plus d’`openEdit` v2 vers Mon compte. Tutoriel driver.js : hors de ce repo, à vérifier à la main si un tooltip pointe encore vers Mes modèles.

### Recette Bauer v2 (compte Bauer, pas Astrid)

1. Business : header une ligne (h1 + recherche + Créer), bandeaux sans trait latéral arrondi.
2. Carte : toolbar check + ⋯ (tooltip « Définir par défaut »), badge si déjà défaut, clic carte = fiche. Pas de gros bouton Voir.
3. Fiche Pro/Business : header et pied collés, picker icône en popover, aperçu prompt réel, 2 boutons + menu. « Modifier le prompt » ouvre le Studio. Fermer le Studio → fiche rafraîchie.
4. Fiche Free (compte test) : flou, CTA Pro, **aucun** appel `getPromptModelContent` dans l’onglet Réseau. Modifier grisé.
5. CSE verrouillé : CTA pack, pas d’aperçu.
6. Wizard : 4 questions (une seule par écran), tag Suggérée lisible, attente spinner 32 px (pas Lottie), succès check + carte. `createPromptModelUser` n’enregistre pas `publicDescription` : l’overlay reprend l’objectif, un F5 vide la carte. Ticket Nico : `updatePromptModelUserMetadata` (ou renvoyer ces champs dans `getPromptModelsUserInfo`).
7. `#modele=253` ouvre la fiche. Mon compte `?tab=prompts` redirige (sauf `noredirect=1`).
8. Rollback : `uiV2: false`, hard refresh, v1 revient.

Retrait v1 (catalog.js page, pas picker) : **2 semaines après cette recette**, noté dans `FEATURES_TRACKING.md`.

Query `?pack=pending` : bandeau « pack en cours d’activation » + recharger. Hash `#creer` ouvre la popup de création.

Library2 staging (Bauer, après collage SHA + `library2Live: true`) :

- Cartes 0 / 6 / 7 en SVG (`file-text` / `mic` / `users`), titres FR
- Prompt 7 : pas « Changer l’icône »
- USER existant : changer icône, refresh, icône encore là
- Wizard étape 2 : suggestion + grille + filtre. **Ne pas** cliquer Créer
- Onglet Épinglés : bandeau une fois si liste vide
- Rollback : `library2Live: false`, republier staging only. Pas www.

Après library2 + clone cse : cadenas cse, CTA mailto si `cse89Live` false. CSE 89 (après Java) atterrit Business.

### Ticket Nico — descriptions USER

`createPromptModelUser` accepte `promptName` / `promptObjective` / `promptSpecificInfo` / `promptStructure` / `iconKey`. Un POST avec `publicDescription` + `publicExample` (probe USER 750, puis supprimé) : HTTP 200, champs **absents** de `getPromptModelsUserInfo`. `updatePromptModelUserMetadata` : 404.

Les STANDARD ont déjà ces champs via `updatePromptModelStandardMetadata`. Pour les cartes « Mes modèles », il faut le même couple en USER (create + update + list).


## Rollback

1. `library2Live` / `cse89Live` → false
2. Retirer le lien nav (symbole)
3. Dépublier les 3 pages si besoin
4. Picker : remettre l’inline `code-model-default-*`

Purge jsDelivr : `https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@18c8563a/scripts/pages/library/library-main.js`

## Vérif CDN

Ouvrir l’URL jsDelivr du SHA → JavaScript 200, pas une 404 HTML. Puis hard refresh `agilotext-test.webflow.io` (Cmd+Shift+R).
