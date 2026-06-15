# Pipeline job — upload → purge

```
Upload (sendMultipleAudio / sendYoutubeUrl)
  │  doSummary=true|false → persisté en base
  ▼
Transcription (PENDING → READY_*)
  │
  ├─ doSummary=false → ne doit PAS appeler sendForSummary
  │                     statut « transcript OK » sans CR
  │
  └─ doSummary=true  → READY_SUMMARY_PENDING → READY_SUMMARY_READY
                      ou READY_SUMMARY_ON_ERROR + javaException
  ▼
Consultation (getJobsInfo, receiveText, receiveSummary, receiveAudio)
  ▼
Rétention (JobFilesDeletor + cleanupOldJobs)
  │  purge fichiers selon dt_update / lastModified
  ▼
[Bug actuel] SQL parfois conservé → job fantôme en liste
[Fix attendu] delete SQL → job invisible
```

## APIs clés

| API | Rôle |
|-----|------|
| `getJobsInfo` | Liste dashboard + rail éditeur |
| `getTranscriptStatus` | Statut unitaire |
| `receiveText` / `receiveSummary` / `receiveAudio` | Téléchargements |
| `cleanupOldJobs` | Purge async post-login |
| `deleteJob` | Suppression utilisateur |
