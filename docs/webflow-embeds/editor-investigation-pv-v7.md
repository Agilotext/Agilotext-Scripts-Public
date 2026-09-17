# Éditeur — header v7 + PV d’enquête (Word)

**Fichiers :**
- `scripts/pages/shared/format-investigation-pv.js`
- `scripts/pages/editor/Code-ed-header.js` (`__agiloEditorHeader_v7`)
- `scripts/pages/editor/editor-main.js` (charge le helper avant le header)

Prod pinne souvent **chaque** script. Remplacer le `src` **exact** de `Code-ed-header.js`. Le header charge le helper en sibling `@SHA` si `editor-main` ne l’a pas déjà fait.

Avant l’appel : `agiloSaveNow()` si présent (l’API lit le `.txt` disque).

Allowlist : promptid **705–720** seulement. Pas 787 / 704 / pack CSE.

Libellé client : `PV d’enquête (Word)`. Pendant l’appel : `Préparation du Word`. Anti double-clic.

Staging `agilotext-test` avant www. Jamais `sites_publish` www sans `OK` Florian.
