# Mes transcripts — filet CR 2.2.3-summary-guard

**Branche :** `1.09` (pas `1.10`).  
**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.3-summary-guard'`

Live avant ce fix : `@6477b6f` / `2.2.2-fullclient`.

## Embed à changer uniquement

Designer → pages **Mes transcripts** :

| Page | Embed |
|------|--------|
| Business | `script-mes_transcripts_ent` |
| Pro | `script-mes_transcripts_pro` (si le src pointe déjà vers `logic-v2.js`) |
| Free | `script-mes_transcripts_free` (idem) |

Remplacer **seulement** le `src` de `Code-mes-transcripts-logic-v2.js`. Ne pas toucher `script-toglledown-link`, folders, bulk.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@30e5e96/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-30e5e96"></script>
```

Le JS filet est dans `30e5e96`. Après `git push -u origin fix/mes-transcripts-summary-guard-1.09`, jsDelivr sert ce SHA.

## Comportement

Clic format CR → `fetch` `receiveSummary`. Si KO `error_summary_transcript_file_not_exists` (READY menteur / STALE) : chip **Indisponible**, plus de JSON. Si OK : téléchargement blob.

## Vérif console

```js
window.__agiloMesTranscriptsLogicVersion
// attendu : '2.2.3-summary-guard'
```

Job `1000038900` : Télécharger CR → Indisponible, pas le JSON API.
