# Mes transcripts — pagination v2 (test agilotext-test)

**Statut :** test uniquement — prod reste sur v1 `@0de4923`.

**Branche GitHub :** `1.09`  
**Hash commit :** `510e365` (hotfix tri desc + toggle date, branche `1.09`, 18/06/2026)

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
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/dashboard/Code-sidebar-folders-css.js?v=sort-510e365"></script>
<!-- 2. Sidebar dossiers v2 -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/dashboard/Code-sidebar-folders-v2.js?v=sort-510e365"></script>
<!-- 3. Bulk v2 (AVANT logic) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/dashboard/Code-open-editor-bulk-select-v2.js?v=sort-510e365"></script>
<!-- 4. Logic v2 (pagination + tri) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=sort-510e365"></script>
<!-- 5. Bridge v2 (APRÈS logic) -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/dashboard/Code-mes-transcripts-folder-url-bridge-v2.js?v=sort-510e365"></script>
```

Pages Webflow : **Mes transcripts** Free, Pro, Business + symbole dashboard (sidebar dossiers).

---

## Lot Éditeur v2 (indépendant)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/editor/ready-count-v2.js?v=sort-510e365"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/editor/Code-changement-audio-v2.js?v=sort-510e365"></script>
```

Pages : Éditeur Free, Pro, Business.

---

## Matrice v1 / v2

| Composant | v1 prod | v2 test |
|-----------|---------|---------|
| Logic | `Code-mes-transcripts-logic.js` v1.10, limit 2000 | `Code-mes-transcripts-logic-v2.js` v2.1.0-sort, PAGE_SIZE 25, tri desc + toggle |
| Bridge | limit 9999, tri client | limit 200, tri délégué à logic-v2 |
| Bulk | sans hint page | hint « page courante » |
| Sidebar folders | sans reset `?page` | supprime `?page` au changement dossier |
| Ready count | limit 1000 | limit 200, affiche `200+` |
| Rail audio | limit 200 | limit 50 + « Charger 50 de plus », tri desc |

---

## Vérification CDN

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@510e365/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=sort-510e365
```

Doit contenir : `window.__agiloMesTranscriptsLogicVersion = '2.1.0-sort'`

Remplacer `@HASH` par le hash du commit hotfix tri (voir `git log -1 --oneline` sur `1.09`).

Cache bust recommandé : `?v=sort-HASH`

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
// Attendu : logic '2.1.0-sort', bridge '2.2.1', bulk '2.0', pagination true + sortDir, rail '4.8.1-v2'
```

---

## Checklist fonctionnelle

| Test | URL | Attendu |
|------|-----|---------|
| Chargement | `/app/business/mes-transcripts` | 1 appel getJobsInfo `limit=25&sortDir=desc` (Network) |
| Pagination | `?page=2` | Widget `#agilo-pagination` |
| Dossier sidebar | clic dossier | URL sans `?page`, page 1 |
| Tri desc (défaut) | chargement | Plus récent en haut, bouton Date visible |
| Tri asc | clic colonne Date | `?sortDir=asc`, page 1, plus ancien en haut |
| Tri toggle | 2e clic Date | Retour desc, URL sans sortDir |
| Bulk | sélection | Hint page courante, ≤25 lignes |
| Bridge move | bulk → dossier | OK sur page courante |
| Badge menu | éditeur | readyCount `200+` si saturé |
| Rail | éditeur | « Charger 50 de plus » |

Pages test :
- https://agilotext-test.webflow.io/app/free/mes-transcripts
- https://agilotext-test.webflow.io/app/pro/mes-transcripts
- https://agilotext-test.webflow.io/app/business/mes-transcripts

---

## Actions Webflow Designer (agilotext-test — manuel)

1. Ouvrir le site **agilotext-test** dans Webflow Designer.
2. Pour chaque page **Mes transcripts** (Free, Pro, Business) :
   - Vider l’embed inline `script-mes_transcripts_*` (si présent).
   - Vider l’embed inline `code-open-editor-bulk-select` (si présent).
   - Coller le contenu de [`mes-transcripts-pagination-v2-embed.html`](mes-transcripts-pagination-v2-embed.html) dans l’embed jsDelivr (remplace les scripts v1).
3. Symbole **dashboard** (layout partagé) : remplacer `Code-sidebar-folders.js` par `-v2.js` (garder `Code-sidebar-folders-css.js` v1).
4. Pour chaque page **Éditeur** (×3) : coller [`editor-pagination-v2-embed.html`](editor-pagination-v2-embed.html) à la place de `ready-count.js` + `Code-changement-audio.js` v1.
5. **Publier** agilotext-test (pas www.agilotext.com).
6. Smoke test console + checklist ci-dessus.


Revenir aux embeds v1 avec hash prod connu :

```
@0de4923 .../Code-mes-transcripts-logic.js
```

Réactiver inline legacy **uniquement** si vous retirez jsDelivr logic-v2.

---

## API Nicolas (non bloquant)

**Message à envoyer à Nicolas :**

> Hello Nicolas — urgence pagination Mes transcripts v2 : la liste s'affiche à l'envers (plus anciens en page 1) et on a perdu le clic sur la colonne Date pour trier. Je hotfix : tri client desc + clic toggle desc/asc qui recharge page 1 + envoi `sortDir` à `getJobsInfo`. Trois confirmations rapides : (a) `getJobsInfo` supporte-t-il `sortDir=desc|asc` ? (b) Le tri serveur est-il appliqué AVANT le `offset` ? (c) Sinon quel param ? Merci !

**Probe curl (18/06/2026) :** sans token valide, l'API renvoie `error_invalid_token`. Le hotfix envoie quand même `sortDir` + tri client dtCreation comme filet de sécurité.

**Implémenté v2.1.0-sort :**
- `sortDir=desc|asc` toujours envoyé à `getJobsInfo`
- Tri client dtCreation après fetch (page courante)
- Clic colonne Date : toggle desc ↔ asc, reset page 1, `?sortDir=asc` dans l'URL
- Bridge v2.2.1 délègue le tri à logic-v2 en pagination
