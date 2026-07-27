# Staging dictée : diarization live (`0ccf50a`)

**GATE :** coller cet embed **uniquement** sur une page Webflow staging (pas le dashboard Business prod clients).

Branche : `feat/streaming-live-diarization-2026-07-27`  
SHA : `0ccf50a3812d2392d9493186614cf44ffb2f666c`  
Base pin : `49215d8` (rollback)

## Embed staging (à coller)

```html
<!-- 1) FilePond & plugins (inchangés) -->
<script src="https://unpkg.com/filepond@4.30.1/dist/filepond.js"></script>
<script src="https://unpkg.com/filepond-plugin-file-validate-type/dist/filepond-plugin-file-validate-type.js"></script>
<script src="https://unpkg.com/filepond-plugin-file-validate-size/dist/filepond-plugin-file-validate-size.js"></script>

<!-- 2) Dashboard Business — Maestro V1 B+ + diarization live STAGING (0ccf50a)
     Ne PAS utiliser sur le Business prod. Rollback = @49215d8 -->
<script>
window.AGILO_SCRIPTS_BASE = "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@0ccf50a";
window.AGILO_MAESTRO_CONTEXT = {
  enabled: true,
  edition: "ent",
  maxDocs: 5,
  maxBytes: 10485760,
  maxTotalBytes: 52428800
};
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@0ccf50a/scripts/pages/dashboard/Ent/upload_ent_v2.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@0ccf50a/scripts/pages/dashboard/Ent/maestro-context-ent.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@0ccf50a/scripts/pages/dashboard/Ent/streaming-ent-loader.js"></script>
```

## Rollback prod-safe

Remettre les 4 `@0ccf50a` → `@49215d8` (snippet d’origine).

## QA manuelle (compte Flo)

1. **Speakers OFF** : dictée OK, pas de labels, pas de log `[AgiloLive] StartRecognition diarization=`.
2. **Speakers ON** + 2 voix : console `diarization= speaker` ; labels `Speaker …:` sur phrases finales dans le textarea ; stop → job batch diarisé.
3. **Pause / reprise** ON : labels d’après reprise.
4. Si `Speechmatics Error` dans la console → noter le `reason` (JWT/feature = escalade Nico ; config = itérer payload).

Compte-rendu attendu : OFF / ON / Error éventuelle (3 lignes).
