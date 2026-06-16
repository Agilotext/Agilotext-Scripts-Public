# Mes transcripts — pagination v2 (test agilotext-test)

**Statut :** test uniquement — prod reste sur v1 `@0de4923`.

**Branche GitHub :** `1.09`  
**Hash commit :** `aadc13c` (remplacer après push — voir `git log -1 --oneline`)

---

## État avant déploiement (audit Webflow)

Inventaire basé sur les exports Webflow du repo (`docs/integration-titres-dossiers-1.05/webflow-exports/`) et la doc déploiement rétention (`0de4923`).

| Embed / script | Probable sur test/prod | Action pour activer v2 |
|----------------|------------------------|-------------------------|
| Inline `script-mes_transcripts_ent` / `script-mes_transcripts_*` | Oui (export Business) | **Vider ou commenter** — remplacé par `logic-v2.js` |
| Inline `code-open-editor-bulk-select` (`AgilotextBulk`) | Oui (export Business) | **Supprimer** — remplacé par `bulk-select-v2.js` |
| jsDelivr `Code-mes-transcripts-logic.js` (v1) | Oui si migré post-15/06 | **Remplacer** par `-v2.js` |
| jsDelivr bridge / bulk / sidebar-folders (v1) | Variable | **Remplacer** tout le lot v2 |
| Symbole dashboard `Code-sidebar-folders.js` | Oui (layout partagé) | **Remplacer** par `-v2.js` |
| `Code-sidebar-folders-css.js` | Oui | **Garder v1** (inchangé) |

**Règle :** ne jamais charger v1 et v2 sur la même page. Ne pas laisser inline legacy actif avec jsDelivr v2.

---

## Lot Mes transcripts v2 (indissociable)

Ordre de chargement strict :

```html
<!-- 1. CSS sidebar dossiers (v1 inchangé) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-sidebar-folders-css.js?v=aadc13c"></script>
<!-- 2. Sidebar dossiers v2 -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-sidebar-folders-v2.js?v=aadc13c"></script>
<!-- 3. Bulk v2 (AVANT logic) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-open-editor-bulk-select-v2.js?v=aadc13c"></script>
<!-- 4. Logic v2 (pagination) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=aadc13c"></script>
<!-- 5. Bridge v2 (APRÈS logic) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-mes-transcripts-folder-url-bridge-v2.js?v=aadc13c"></script>
```

Pages Webflow : **Mes transcripts** Free, Pro, Business + symbole dashboard (sidebar dossiers).

---

## Lot Éditeur v2 (indépendant)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/editor/ready-count-v2.js?v=aadc13c"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/editor/Code-changement-audio-v2.js?v=aadc13c"></script>
```

Pages : Éditeur Free, Pro, Business.

---

## Matrice v1 / v2

| Composant | v1 prod | v2 test |
|-----------|---------|---------|
| Logic | `Code-mes-transcripts-logic.js` v1.10, limit 2000 | `Code-mes-transcripts-logic-v2.js` v2.0, PAGE_SIZE 25 |
| Bridge | limit 9999, tri client | limit 200, tri masqué si pagination |
| Bulk | sans hint page | hint « page courante » |
| Sidebar folders | sans reset `?page` | supprime `?page` au changement dossier |
| Ready count | limit 1000 | limit 200, affiche `200+` |
| Rail audio | limit 200 | limit 50 + « Charger 50 de plus » |

---

## Vérification CDN

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aadc13c/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=aadc13c
```

Doit contenir : `window.__agiloMesTranscriptsLogicVersion = '2.0'`

---

## Smoke test console (agilotext-test)

```javascript
({
  logic: window.__agiloMesTranscriptsLogicVersion,
  bridge: window.__agiloMesTranscriptsFolderBridge?.version,
  bulk: window.__agiloMesTranscriptsBulkVersion,
  pagination: window.__agiloMesTranscriptsPagination?.enabled,
  rail: window.__agiloRail?.version
})
// Attendu : logic '2.0', bridge '2.2.0', bulk '2.0', pagination true, rail '4.8.0-v2'
```

---

## Checklist fonctionnelle

| Test | URL | Attendu |
|------|-----|---------|
| Chargement | `/app/business/mes-transcripts` | 1 appel getJobsInfo `limit=25` (Network) |
| Pagination | `?page=2` | Widget `#agilo-pagination` |
| Dossier sidebar | clic dossier | URL sans `?page`, page 1 |
| Tri | bouton tri | Masqué ou tooltip pagination |
| Bulk | sélection | Hint page courante, ≤25 lignes |
| Bridge move | bulk → dossier | OK sur page courante |
| Badge menu | éditeur | readyCount `200+` si saturé |
| Rail | éditeur | « Charger 50 de plus » |

Pages test :
- https://agilotext-test.webflow.io/app/free/mes-transcripts
- https://agilotext-test.webflow.io/app/pro/mes-transcripts
- https://agilotext-test.webflow.io/app/business/mes-transcripts

---

## Rollback

Revenir aux embeds v1 avec hash prod connu :

```
@0de4923 .../Code-mes-transcripts-logic.js
```

Réactiver inline legacy **uniquement** si vous retirez jsDelivr logic-v2.

---

## API Nicolas (non bloquant)

Confirmer si `getJobsInfo` renvoie `total` / `totalCount` et supporte `sortDir`.  
Si oui : passer `API_SORT_SUPPORTED = true` dans `Code-mes-transcripts-logic-v2.js`.
