# Mes transcripts — probe CR 2.2.5-summary-probe

**Branche :** `1.09` (pas `1.10`).  
**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.5-summary-probe'`

Live avant ce fix : `@6477b6f` / `2.2.2-fullclient`, puis filet clic `@30e5e96` / `@9659d2e`.

## Embed à changer uniquement

Designer → pages **Mes transcripts** (classe live souvent `script-mes_transcripts_ent`) :

| Page | URL |
|------|-----|
| Business | `/app/business/mes-transcripts` |
| Pro | `/app/premium/mes-transcripts` |
| Free | `/app/free/mes-transcripts` |

Remplacer **seulement** le `src` de `Code-mes-transcripts-logic-v2.js`. Un seul tag (sinon l’ancien gagne). Ne pas toucher `script-toglledown-link`, folders, bulk.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f80f408/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-f80f408"></script>
```

Ordre : staging `agilotext-test`, puis Production www.

## Comportement

Au rendu de la page visible : GET `receiveSummary` html (pas de Range) sur les READY encore downloadable. Map session `jobId → ok|missing`. Si fichier absent : chip **Indisponible**, menu formats jamais ouvert. Tant que le probe n’a pas fini, Télécharger n’ouvre pas html/rtf/pdf. Clic format : filet capture, pas de JSON. Réseau / 5xx : on ne lock pas.

## Vérif console

```js
window.__agiloMesTranscriptsLogicVersion
// attendu : '2.2.5-summary-probe'
```

Job `1000038900` : chip Indisponible **sans** ouvrir le menu.
