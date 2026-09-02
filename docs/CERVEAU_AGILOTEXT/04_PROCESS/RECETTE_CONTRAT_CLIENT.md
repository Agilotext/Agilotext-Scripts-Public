# Recette obligatoire — features « contrat client »

S’applique à : rétention fichiers, quotas, éditions Memberstack, promesses page tarifs.

## UX (filet 2026-09-02)

L’UI ne doit **pas** promettre que le texte reste accessible si `receiveText` renvoie `error_transcript_file_not_exists`.

- Audio expiré : durée d’offre seulement, zéro phrase « transcription reste accessible ».
- Transcript fantôme Business : anomalie + support + jobId.
- Version liste : `__agiloMesTranscriptsLogicVersion === '2.2.8-retention-honest'`.
- Pin live (2 sept. 2026) : `@3fad75c2` sur www + test. Recette HTML/CDN/tests Node OK. Recette connectée (job fantôme `1000032508`, Pro vs Business) à faire en navigation privée loggée.
