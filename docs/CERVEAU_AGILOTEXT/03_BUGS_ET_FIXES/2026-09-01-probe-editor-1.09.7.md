# Probe live éditeur (2026-09-01)

Avant les diffs 1.09.7 / anon 3.2.

## CDN jsDelivr `@1.09`

- `agilo-confidence.js` : garde `shouldFloat = safeChrome > 0 && …` encore live
- `Code-main-editor-IFRAME_V04-confidence.js` : `__agiloEditorConfidenceVersion = 1.09.6`
- `agilo-editor-anonymiser-transcript-v3.js` : `__agiloAnonVersion = 3.1.0`
- `chat-loader.js` charge `Code-chat_V05.js` (prod)

Le sticky cassé n’est donc pas seulement un pin en retard : 1.09.6 est bien servi, avec le filet chrome trop strict.

## Free `timestampTranscript`

- API live : `8.0.4` (31-Aug-2026)
- Aucune restriction Free documentée dans ce repo sur `timestampTranscript` / `speakerLabels`
- Si un upload Free avec `timestampTranscript=true` renvoie une erreur d’édition, le JS ne suffira pas

Designer : si `#toggle-speakers` existe sur `/app/free/dashboard`, le laisser visible, défaut coché (opt-out). Pas de nouveau bouton.
