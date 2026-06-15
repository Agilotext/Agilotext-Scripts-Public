# Index — Editor scripts

Loader recommandé : `editor-main.js`  
Doc embeds : [`WEBFLOW_EDITEUR_SCRIPTS_1.05.md`](../../integration-titres-dossiers-1.05/WEBFLOW_EDITEUR_SCRIPTS_1.05.md)  
Tracking : [`FEATURES_TRACKING.md`](../../FEATURES_TRACKING.md)

## Scripts critiques (rétention juin 2026)

| Fichier | Embed | Rôle |
|---------|-------|------|
| **`Code-ed-header.js`** | `code-ed-header` | Header : statuts, téléchargements, exports |
| **`Code-job-id.js`** | `code-job-id` (remplace inline) | Affichage Job # + copie |
| `Code-changement-audio.js` | `code-changement-audio` | Rail jobs |
| `Code-main-editor-IFRAME_V04.js` | `code-main-editor` | Éditeur iframe (prod Webflow) |
| `relance-compte-rendu.js` | `code-redo_summary` | Régénération CR |

## Ordre loader (`editor-main.js`)

CSS → token-resolver → orchestrator → lecteur → main-editor → changement-audio → auth-sync → chat → **ed-header** → **job-id** → save → …

## CDN (exemple)

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/editor/Code-ed-header.js?v=<HASH>
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/editor/Code-job-id.js?v=<HASH>
```

Head global : `scripts/shared/agilo-api-error-format.js`
