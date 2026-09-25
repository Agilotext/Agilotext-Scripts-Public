# Éditeur — historique « Revenir » des transcriptions

Branche pin : `fix/editor-multi-select-lotb`.  
Save Webflow : **`Code-save_transcript-CORRIGE-V2.js` uniquement**. Jamais le gros `Code-save_transcript-V2.js`.

## Contrat

- Liste : `POST /listSavedTranscripts`. Strip `url`.
- Lecture : `POST /displaySavedTranscript` `format=txt`.
- Restore : `display` + `updateTranscriptFile` via `agiloPostTranscriptFromBackupJson`.
- Après restore : `agilo:load` puis `agilo:transcript-loaded`.

## Visibilité

- Transcription : Revenir TX visible, Revenir CR caché.
- Compte-rendu : inverse.
- Assistant : les deux cachés.

## Recette

Job jetable, pas `1000040008`. Hover TX = transcription. Hover CR = compte-rendu.
