# Déploiement Webflow — Rétention + UX honnête

**Branche cible :** `1.11` (`fix/retention-honest-ux`)  
**Hash UX honnête :** `3fad75c2` (`2.2.8-retention-honest`)  
**Rollback Mes transcripts prod :** `@5094a73` (`2.2.7-demo-row`)

Détail embeds : [`docs/webflow-embeds/mes-transcripts-retention-honest-2.2.8.md`](../../webflow-embeds/mes-transcripts-retention-honest-2.2.8.md)

---

## Historique (juin 2026, inchangé ci-dessous)

**Branche :** `1.09`  
**Hash commit :** `0de4923` (branche `1.09`, 15/06/2026)

Base CDN :

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/
```

## Head (toutes pages éditeur)

Remplacer `agilo-api-error-format.js` :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/shared/agilo-api-error-format.js?v=aadc13c"></script>
```

## Pages Éditeur (Free / Pro / Business)

| Embed Webflow | Fichier |
|---------------|---------|
| `code-ed-header` | `scripts/pages/editor/Code-ed-header.js` |
| `code-job-id` (nouveau — supprimer inline Job ID) | `scripts/pages/editor/Code-job-id.js` |

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/editor/Code-ed-header.js?v=aadc13c"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/editor/Code-job-id.js?v=aadc13c"></script>
```

## Pages Mes transcripts (Free / Pro / Business)

| Embed | Fichier |
|-------|---------|
| logic mes-transcripts | `scripts/pages/dashboard/Code-mes-transcripts-logic.js` |

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-mes-transcripts-logic.js?v=aadc13c"></script>
```

## Vérification jsDelivr

Ouvrir chaque URL dans le navigateur → code JavaScript (HTTP 200), pas page d'erreur.

Test prod : navigation privée + `?debug=1` sur un job expiré et un job sans CR (`promptid=-1`).

## Historique déploiements

| Date | Hash | Pages | Notes |
|------|------|-------|-------|
| 2026-06-15 | `0de4923` | Éditeur + Mes transcripts ×3 tiers | Rétention bandaid front v1.10 |
| 2026-06-16 | `aadc13c` | agilotext-test uniquement | Pagination v2 (`*-v2.js`), prod v1 inchangée |
| 2026-06-18 | `2b4de42` | agilotext-test uniquement | v2.2.0-fullclient — fetch all + pagination client (API ignore sortDir) |
| 2026-08-26 | `5094a73` | www + test Mes transcripts ×3 | logic-v2 `2.2.7-demo-row` (pin prod actuel avant UX honnête) |
| 2026-09-02 | `3fad75c2` | à pinner test puis www | `2.2.8-retention-honest` : audio sans promesse texte, fantôme + jobId |

## Pagination v2 — rollback chain (agilotext-test)

| Hash | Version | Usage |
|------|---------|-------|
| `2b4de42` | v2.2.0-fullclient | **Actuel test** — fetch 100→2000, tri client |
| `510e365` | v2.1.0-sort | Hotfix tri (pagination serveur, bug ordre) |
| `aadc13c` | v2.0 | Pagination serveur initiale |
| `0de4923` | v1 prod | Rollback total (limit 2000, tri inline Webflow) |

Voir [`docs/webflow-embeds/mes-transcripts-pagination-v2.md`](../../webflow-embeds/mes-transcripts-pagination-v2.md).

Prod **www.agilotext.com** : ne pas modifier (reste `@0de4923` + fichiers v1).
