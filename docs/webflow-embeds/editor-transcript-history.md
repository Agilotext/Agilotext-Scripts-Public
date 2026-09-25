# Éditeur — historique « Revenir » des transcriptions

Branche : `fix/transcript-history-corrige` depuis `origin/1.11`.  
Save Webflow : **`Code-save_transcript-CORRIGE-V2.js` uniquement**. Jamais le gros `Code-save_transcript-V2.js`.

## Contrat

- Liste : `POST /listSavedTranscripts`. Strip `url`.
- Lecture : `POST /displaySavedTranscript` `format=txt` (corps JSON `TranscriptSaveDTO`).
- Restore : `display` + `updateTranscriptFile` via `agiloPostTranscriptFromBackupJson` (chemin B).
- Payload save : `agiloGetPayload().pick.segmentsMs`.
- Après restore : `agilo:load` puis `agilo:transcript-loaded` (émis par l’iframe confidence).

## Embed

Voir [EDITOR_PIN_MATRIX.md](EDITOR_PIN_MATRIX.md). Creds restent dans `Code-Redo_summary`.

## Recette

Job **jetable**. 2 sauvegardes manuelles. Revenir · HH:mm. Locuteurs + phrases présentes. CR éventuellement stale.

## Rollback staging

Recoller le snapshot Lot A (CORRIGE @ `1.02` seul) puis publish `agilotext-test` only.
