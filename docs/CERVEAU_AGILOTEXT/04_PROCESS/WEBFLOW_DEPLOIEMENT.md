# Déploiement Webflow — Rétention juin 2026

**Branche :** `1.09`  
**Hash commit :** `0de4923` (branche `1.09`, 15/06/2026)

Base CDN :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/
```

## Head (toutes pages éditeur)

Remplacer `agilo-api-error-format.js` :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/shared/agilo-api-error-format.js?v=<HASH>"></script>
```

## Pages Éditeur (Free / Pro / Business)

| Embed Webflow | Fichier |
|---------------|---------|
| `code-ed-header` | `scripts/pages/editor/Code-ed-header.js` |
| `code-job-id` (nouveau — supprimer inline Job ID) | `scripts/pages/editor/Code-job-id.js` |

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/editor/Code-ed-header.js?v=<HASH>"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/editor/Code-job-id.js?v=<HASH>"></script>
```

## Pages Mes transcripts (Free / Pro / Business)

| Embed | Fichier |
|-------|---------|
| logic mes-transcripts | `scripts/pages/dashboard/Code-mes-transcripts-logic.js` |

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/pages/dashboard/Code-mes-transcripts-logic.js?v=<HASH>"></script>
```

## Vérification jsDelivr

Ouvrir chaque URL dans le navigateur → code JavaScript (HTTP 200), pas page d'erreur.

Test prod : navigation privée + `?debug=1` sur un job expiré et un job sans CR (`promptid=-1`).

## Historique déploiements

| Date | Hash | Pages | Notes |
|------|------|-------|-------|
| 2026-06-15 | `0de4923` | Éditeur + Mes transcripts ×3 tiers | Rétention bandaid front v1.10 |
| 2026-06-16 | `<HASH>` | agilotext-test uniquement | Pagination v2 (`*-v2.js`), prod v1 inchangée |

## Pagination v2 (test only)

Voir [`docs/webflow-embeds/mes-transcripts-pagination-v2.md`](../../webflow-embeds/mes-transcripts-pagination-v2.md).

Prod **www.agilotext.com** : ne pas modifier (reste `@0de4923` + fichiers v1).
