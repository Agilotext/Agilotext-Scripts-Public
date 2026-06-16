# Index — Dashboard scripts

Pages : `/app/free/`, `/app/pro/`, `/app/business/` (mes-transcripts, upload, sidebar).

## Mes transcripts (prioritaire)

| Fichier | Embed Webflow | Rôle |
|---------|---------------|------|
| **`Code-mes-transcripts-logic.js`** | embed dashboard | Rendu liste jobs, icônes État, tooltips, téléchargements, rename |
| `Code-mes-transcripts-download-toggle.js` | — | Toggle panneaux download |
| `Code-mes-transcripts-folder-url-bridge.js` | — | Bridge URL dossiers |
| `Code-open-editor-bulk-select.js` | — | Sélection bulk |

### Pagination v2 (test agilotext-test — prod inchangée)

| Fichier v2 | Remplace v1 | Notes |
|------------|-------------|-------|
| `Code-mes-transcripts-logic-v2.js` | logic.js | PAGE_SIZE 25, version console `2.0` |
| `Code-mes-transcripts-folder-url-bridge-v2.js` | bridge.js | limit 200, version `2.2.0` |
| `Code-open-editor-bulk-select-v2.js` | bulk-select.js | hint page courante |
| `Code-sidebar-folders-v2.js` | sidebar-folders.js | reset `?page` dossier |
| `ready-count-v2.js` | ready-count.js | limit 200, badge `200+` |
| `Code-changement-audio-v2.js` | changement-audio.js | rail limit 50 + charger plus |

Doc embeds : [`docs/webflow-embeds/mes-transcripts-pagination-v2.md`](../../webflow-embeds/mes-transcripts-pagination-v2.md)

### `Code-mes-transcripts-logic.js` — fonctions clés

- `getStatusTooltipFrench()` — message clic colonne État
- `updateIconVisibility()` — icônes SVG (aligné éditeur)
- `getSummaryAvailability()` — colonne Compte rendu
- `isExpiredJob()` / `isNoSummaryRequested()` — discrimination purge vs CR non demandé (v1.10+)
- `buildJobRow()` — rendu ligne

**Dépendance head :** `agilo-api-error-format.js` (shared)

## Upload

| Fichier | Plans |
|---------|-------|
| `free.js` / `free_v2.js` | Free |
| `pro.js` / `pro_v2.js` | Pro |
| `ent.js` | Business |

## Sidebar dossiers

| Fichier | Rôle |
|---------|------|
| `Code-sidebar-folders.js` | Nav dossiers |
| `Code-sidebar-folders-css.js` | Styles |
| `Code-sidebar-toggle.js` | Toggle sidebar |

## CDN

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/dashboard/Code-mes-transcripts-logic.js?v=<HASH>
```

Pages Webflow à mettre à jour : **Mes transcripts** Free, Pro, Business.
