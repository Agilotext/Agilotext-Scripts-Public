# Matrice des pins éditeur (source de vérité Webflow)

Date : 25/09/2026. Site Agilotext `6815bee5a9c0b57da18354fb`.  
Scrape : `scripts/dev/compare-editor-pins.sh` (branche `fix/transcript-history-corrige`).

**Interdits**

- Ne jamais remplacer `Code-save_transcript-CORRIGE-V2.js` par `Code-save_transcript-V2.js`.
- Ne pas piner un SHA d’un fichier sur un **autre** nom de fichier.
- `sites_publish` www seulement après `OK publish www`.

## Pages

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

## Composants

| Designer | component_id | Notes |
|----------|--------------|-------|
| `Code-save_transcript` | `5ed25ce2-6141-f7db-8265-faf90d325f5d` | Business + Pro. Free sans instance. |
| `Code-main-editor` | `131e8c6f-a905-9aca-58f0-d1c51800340d` | Free / Pro / Business |
| `Code-CSS-Editor(transcript,summary,conv.)` | `ca84cc45-3f30-001c-6851-48121d79d84d` | + rail `@1.07` |
| `Code-lecteur-audio` | `fd8fa218-602d-6f59-dada-0de912ff1269` | + retention `@3fad75c2` + sticky `@aa75276d` |
| `Code-Redo_summary` | `086fb264-cc10-e6df-a42f-e8c803b7855e` | creds `@637a1ae4`, relance `@9ed90622` |

### Rollback save V2 (ne plus recoller)

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/Code-save_transcript-V2.js?v=6526e346"></script>
```

### Lot B (hold si combo KO)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3c301705babd0dccfd905e3bbc741aa10012baae/scripts/pages/editor/Code-save_transcript-CORRIGE-V2.js?v=3c301705"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3c301705babd0dccfd905e3bbc741aa10012baae/scripts/pages/editor/agilo-transcript-history.js?v=3c301705"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3c301705babd0dccfd905e3bbc741aa10012baae/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=3c301705"></script>
```

### Lot C (multi-select + Revenir par onglet)

Branche `fix/editor-multi-select-lotb`. SHA à coller après push (voir fin de fichier).
