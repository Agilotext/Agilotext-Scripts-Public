# Mes transcripts — logic-v2 2.2.8-retention-honest

**Branche :** `fix/retention-honest-ux` (PR vers `1.11`)  
**SHA :** `3fad75c2`  
**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.8-retention-honest'`

Messages honnêtes : audio expiré **sans** promettre que le texte reste accessible. Transcript fantôme (`error_transcript_file_not_exists`) = anomalie + support + jobId.

## Inventaire live (2 sept. 2026)

Les 3 pages Mes transcripts (Free / Pro / Business) ont **les mêmes** pins, donc symbole ou copie identique.

| Site | logic-v2 | agilo-api-error-format | orchestrator |
|------|----------|------------------------|--------------|
| www Mes transcripts | `@5094a73` | **absent** | `@1.09` (mensonge audio) |
| agilotext-test Mes transcripts | `@5094a73` | **absent** | `@1.09` |
| www éditeur Business | n/a | `@33ee8ba` | `@33ee8ba` + lecteur / ed-header `@33ee8ba` ; iframe confidence `@56c20f30` |

## Embeds à coller (même SHA partout)

### P0 Mes transcripts (Free / Pro / Business)

Remplacer **seulement** le `src` de `Code-mes-transcripts-logic-v2.js`. Ajouter le module messages **avant** logic-v2 si possible.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/shared/retention-messages.js?v=3fad75c2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-3fad75c2"></script>
```

Ne pas changer sidebar / bridge / bulk (`@2b4de42`) sur cette passe.

### P0 + P1 Éditeur (Free / Pro / Business)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/shared/retention-messages.js?v=3fad75c2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/shared/agilo-api-error-format.js?v=3fad75c2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/pages/editor/Code-ed-header.js?v=3fad75c2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/pages/editor/Code-lecteur-audio-V3.4.js?v=3fad75c2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/pages/editor/orchestrator.js?v=3fad75c2"></script>
```

Iframe : si la page charge `Code-main-editor-IFRAME_V04.js` ou le fork confidence, même `3fad75c2`.

## ROLLBACK prod Mes transcripts

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5094a73/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-5094a73"></script>
```

Purge si cache : `https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`

## Recette console (après publish)

```javascript
({
  logic: window.__agiloMesTranscriptsLogicVersion,
  retention: typeof window.agiloRetentionMessages,
  fmt: typeof window.agiloJobErrorParts,
  scripts: [...document.querySelectorAll('script[src*="Agilotext-Scripts-Public"]')]
    .map((s) => s.src)
    .filter((u) => /logic-v2|retention-messages|agilo-api-error-format|lecteur-audio|Code-ed-header|orchestrator/.test(u))
})
```

Attendu Mes transcripts : `logic === '2.2.8-retention-honest'`.

| # | Scénario | Attendu |
|---|----------|---------|
| 1 | Version console | `2.2.8-retention-honest` |
| 2 | Job récent OK | Inchangé |
| 3 | Audio > 30 j Business, éditeur | Audio seul, **pas** « transcription reste accessible » |
| 4 | Job fantôme `1000032508` | Support + jobId |
| 5 | Page Pro | Aucune mention « Business » dans le message Pro |

## Ce qu’on ne change pas

- `/tarifs` (contrat inchangé)
- Pins sidebar `@2b4de42`
