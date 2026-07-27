# Staging dictée : diarization live + parité éditeur (`5b661b9`)

**GATE :** coller cet embed **uniquement** sur une page Webflow staging (pas le dashboard Business prod clients).

Branche : `feat/streaming-live-diarization-2026-07-27` (rebasée sur `origin/1.10`)  
SHA : `5b661b9a72438504db769a5afdb4a27db2c39464`  
`BUILD` loader : `20260727b`

## Livré

- Diarization Speechmatics live si intervenants cochés
- Aperçu coloré type éditeur Business (`Speaker_A` / `Speaker_B`, palette `SPK_COLORS`)
- Pause = textarea plat éditable ; reprise = reparse
- Speakers OFF = inchangé

## Pas livré (Granola plus tard)

Notes IA structurées, rename live, timestamps seek.

## Embed staging

```html
<!-- 1) FilePond & plugins (inchangés) -->
<script src="https://unpkg.com/filepond@4.30.1/dist/filepond.js"></script>
<script src="https://unpkg.com/filepond-plugin-file-validate-type/dist/filepond-plugin-file-validate-type.js"></script>
<script src="https://unpkg.com/filepond-plugin-file-validate-size/dist/filepond-plugin-file-validate-size.js"></script>

<!-- 2) STAGING diarization + aperçu éditeur — pin 5b661b9 (rollback @49215d8) -->
<script>
window.AGILO_SCRIPTS_BASE = "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5b661b9";
window.AGILO_MAESTRO_CONTEXT = {
  enabled: true,
  edition: "ent",
  maxDocs: 5,
  maxBytes: 10485760,
  maxTotalBytes: 52428800
};
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5b661b9/scripts/pages/dashboard/Ent/upload_ent_v2.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5b661b9/scripts/pages/dashboard/Ent/maestro-context-ent.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5b661b9/scripts/pages/dashboard/Ent/streaming-ent-loader.js"></script>
```

## Rollback

Remettre `@49215d8` (ou l’ancien pin staging).

## QA

| Cas | Attendu |
|-----|---------|
| OFF | Pas de panneau coloré |
| ON | `Speaker_A` / `Speaker_B` couleurs distinctes ; log `diarization=` |
| Toggle | `document.getElementById('toggle-speakers').checked === true` |
| Pause / reprise | Textarea plat puis tours OK |
| Copier | `Speaker_A: …` |
| Stop | Upload inchangé |

Compte-rendu : OFF / ON / Error éventuelle.
