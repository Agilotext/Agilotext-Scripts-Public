# Mes transcripts — pagination v2.2.0-fullclient (test agilotext-test)

**Statut :** test uniquement — prod reste sur v1 `@0de4923`.

**Branche GitHub :** `1.09`  
**Hash commit :** `2b4de42` (fetch all + pagination client, branche `1.09`, 18/06/2026)

**Diagnostic confirmé :** l'API `getJobsInfo` ignore `sortDir` (3 réponses identiques en probe). Pagination serveur impossible → fetch progressif limit=100→2000 + tri/pagination client.

---

## Embed Webflow (copier-coller)

Fichier prêt : [`mes-transcripts-pagination-v2-embed.html`](mes-transcripts-pagination-v2-embed.html)

Pages : **Mes transcripts** Free, Pro, Business + symbole dashboard (sidebar dossiers).

Éditeur : [`editor-pagination-v2-embed.html`](editor-pagination-v2-embed.html)

**Important :** retirer l'inline Webflow `#sort-button` (`isSortedFromOldestToNewest`) — logic-v2 gère le tri.

---

## Matrice v1 / v2.2.0

| Composant | v1 prod | v2.2.0-fullclient |
|-----------|---------|---------------------|
| Logic | limit 2000, tri DOM inline | fetch progressif 100→2000, tri client desc/asc, PAGE_SIZE 25 |
| Bridge | limit 9999 | limit 200 map, tri délégué logic-v2 |
| Ready count | limit 1000 | limit 2000, vrai compteur |
| Rail | limit 200 | limit 2000, tri desc client |
| Pagination label | N/A | `Page X / Y` (jamais `+`) |

---

## Smoke test console

```javascript
({
  logic: window.__agiloMesTranscriptsLogicVersion,
  bridge: window.__agiloMesTranscriptsFolderBridge?.version,
  bulk: window.__agiloMesTranscriptsBulkVersion,
  pagination: window.__agiloMesTranscriptsPagination,
  readyCount: window.__agiloReadyCountVersion
})
// Attendu : logic '2.2.0-fullclient', bridge '2.2.2', clientPagination true, cacheTotalKnown true après bg fetch
```

Diagnostic complet :

```javascript
(async () => {
  const rows = document.querySelectorAll('#jobs-container .wrapper-content_item-row[data-creation-date]');
  const out = {
    logic: window.__agiloMesTranscriptsLogicVersion,
    bridge: window.__agiloMesTranscriptsFolderBridge?.version,
    pagination: window.__agiloMesTranscriptsPagination,
    dom: {
      nb_lignes: rows.length,
      premiere_date: rows[0]?.getAttribute('data-creation-date'),
      derniere_date: rows[rows.length - 1]?.getAttribute('data-creation-date')
    },
    sortButton: (() => {
      const el = document.getElementById('sort-button');
      return el ? { visible: el.offsetParent !== null, title: el.title, sortDir: el.getAttribute('data-sort-dir') } : null;
    })()
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
})();
```

**Attendu post-fix :**
- `premiere_date` > `derniere_date` (desc, ex. `18-06-2026` en haut)
- `sortButton.visible === true`
- `pagination.totalJobs` = nombre exact (pas null)
- Widget : `Page 1 / N — N fichiers` (pas `Page 2+`)

---

## Checklist fonctionnelle

| Test | Attendu |
|------|---------|
| Chargement | Network : `limit=100` puis batchs `limit=100` en background |
| Page 1 | Plus récent en haut (≈ 18/06/2026) |
| Page 2 | Dates < dernière de page 1 |
| Click colonne Date | Toggle asc, page 1, URL `?sortDir=asc` |
| Label pagination | `Page X / Y` sans `+` |
| Suppression job | Disparaît sans reload manuel |
| Dossier sidebar | Reset page 1, refetch |

Pages test :
- https://agilotext-test.webflow.io/app/free/mes-transcripts
- https://agilotext-test.webflow.io/app/pro/mes-transcripts
- https://agilotext-test.webflow.io/app/business/mes-transcripts

---

## Rollback

| Hash | Version | Quand |
|------|---------|-------|
| `@2b4de42` | v2.2.0-fullclient | hotfix actuel |
| `@510e365` | v2.1.0-sort | si fullclient casse |
| `@aadc13c` | v2.0 pagination serveur | filet v2 |
| `@0de4923` | v1 prod | ROLLBACK TOTAL |

Purge cache jsDelivr si besoin :
```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@2b4de42/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js
```

---

## Backend Nicolas (bloquant long terme)

- `getJobsInfo` doit supporter `sortDir=desc|asc` **avant** `offset`
- Réponse doit inclure `total` / `totalCount`
- Une fois fait → repasser en pagination serveur limit=25
