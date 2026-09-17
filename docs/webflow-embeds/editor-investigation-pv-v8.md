# Éditeur — header v8 + PV d’enquête (Word)

**Fichiers :**
- `scripts/pages/shared/format-investigation-pv.js`
- `scripts/pages/editor/Code-ed-header.js` (`__agiloEditorHeader_v8`)
- `scripts/pages/editor/editor-main.js` (charge le helper avant le header)

v8 : clone du nœud Webflow DOCX **sans** `download_wrapper-link_summary_docx` (Relancer / ON_ERROR / premier `summary_docx` de `Code-main-editor` restent intacts). Flex recopié via `getComputedStyle`. Icône `.icon-1x1-medium` conservée. Busy : label `div` seulement, jamais `a.textContent`. Menu CR ouvert : `z-index: 100` au-dessus de `.ag-confidence-panel` (25).

Prod pinne souvent **chaque** script. Remplacer le `src` **exact** de `Code-ed-header.js`. Le header charge le helper en sibling `@SHA` si `editor-main` ne l’a pas déjà fait.

**Pin staging 17/09 :** `@5682eb68` (agilotext-test). www reste `@3fad75c2` jusqu’à `OK publish`.

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5682eb68/scripts/pages/editor/Code-ed-header.js?v=5682eb68"></script>
```

Allowlist : promptid **705–720** seulement. Pas 787 / 704 / pack CSE.

Libellé client : `PV d’enquête (Word)`. Pendant l’appel : `Préparation du Word`. Anti double-clic.

Staging `agilotext-test` avant www. Jamais `sites_publish` www sans `OK` Florian.
