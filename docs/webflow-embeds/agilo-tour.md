# Tour onboarding Driver.js (`agilo-tour.js`)

**Branche :** `feat/agilo-tour-anonymiser`  
**Staging seulement :** `https://agilotext-test.webflow.io`  
**Prod www :** ne pas pin sans OK Florian.

Le guide vit dans le composant Webflow **`ONBOARDING_SCRIPT`** (19 instances, classe `code-agilo-tour`). Le CSS Driver.js est **`ONBOARDING_CSS`** (`css-guide`) : ne pas le modifier.

## Ce que fait v1.0.0

- Source unique : [`scripts/pages/tour/agilo-tour.js`](../../scripts/pages/tour/agilo-tour.js)
- Alias Agiloshield, parce que `/dashboard/anonymiser` n’a pas `data-tour="anonymize"` / `anon-historique` :
  - `anonymize` → `[data-tour="anonymize"], #agfDropzone, .agf-dropzone`
  - `anon-historique` → `[data-tour="anon-historique"], #agfAnonJobsWrap, .agf-anon-jobs-list`
- Attente 8 s **uniquement** sur ces deux clés. Le reste du blueprint reste à 1,5 s. Retry global 20 s inchangé.
- Pas de `fallbackCenter` ajouté sur le drop (évite le popover 1 px au centre).
- Recette console : `window.__AGILO_TOUR_VERSION__ === '1.0.0'`

## Embed (après push)

Pin **HtmlEmbed du composant `ONBOARDING_SCRIPT`**, pas un 2e script. Remplacer l’IIFE inline par :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/tour/agilo-tour.js?v=SHA"></script>
```

`ONBOARDING_CSS` inchangé. Publish subdomain `agilotext-test` only.

## Recette

1. Login Business staging, vider `agilo_tour_state_v23` et `agilo_tour_completed_v23`.
2. Démarrer le guide, avancer jusqu’à Agiloshield.
3. Highlight réel de la dropzone, puis historique des jobs, puis retour dashboard.
