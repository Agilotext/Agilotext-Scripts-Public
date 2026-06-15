# Index — Shared scripts

Chargés en head ou sur plusieurs pages.

| Fichier | Rôle | Où |
|---------|------|-----|
| **`agilo-api-error-format.js`** | `window.agiloJobErrorParts` — format erreurs API | Head éditeur + dashboard |
| `agilo-speech-dictate.js` | Dictée | Dashboard / éditeur |
| `agilo-mobile-app-banner.js` | Bannière app mobile | Global |
| `agilo-live-transcribe.js` | WebSocket Speechmatics | Streaming |
| `speechmatics-streaming.js` | Client Speechmatics | Streaming |
| `pcm-audio-worklet.js` | Audio worklet | Streaming |

## `agilo-api-error-format.js`

- v1.08+ : intercepte `error_summary_transcript_file_not_exists` → « Fichier archivé »
- Charger **avant** scripts métier éditeur/dashboard

```
https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<HASH>/scripts/shared/agilo-api-error-format.js?v=<HASH>
```
