# Matrice des pins éditeur (source de vérité Webflow)

Date : 25/09/2026. Site Agilotext `6815bee5a9c0b57da18354fb`.  
Complète [`PARENT_BRANCH.md`](PARENT_BRANCH.md) pour les pins collés. Scrape : `scripts/dev/compare-editor-pins.sh`.

**Interdits**

- Ne jamais remplacer `Code-save_transcript-CORRIGE-V2.js` par `Code-save_transcript-V2.js` dans Webflow.
- Ne pas piner un SHA d’un fichier sur un **autre** nom de fichier.
- `sites_publish` www seulement après `OK publish www`.

## Pages

| Édition | pageId | Path |
|---------|--------|------|
| Business | `68e0f3b838626e418962aeff` | `/app/business/editor` |
| Pro | `68ed41f20988e833cb4e3148` | `/app/premium/editor` |
| Free | `68ed64995fcf3e0b0b452916` | `/app/free/editor` |

## Composant save (partagé)

| Champ | Valeur |
|-------|--------|
| Designer | `Code-save_transcript` |
| component_id | `5ed25ce2-6141-f7db-8265-faf90d325f5d` |

### Snapshot rollback 25/09 (erreur V2, à ne plus recoller)

```html
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/Code-save_transcript-V2.js?v=6526e346"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/agilo-transcript-history.js?v=6526e346"></script>
```

### Lot A (aligné www, 25/09 après rollback)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.02/scripts/pages/editor/Code-save_transcript-CORRIGE-V2.js"></script>
```

### Lot B+ (CORRIGE + history, SHA après push de cette branche)

Remplacer `SHA40` / `SHA8` par le commit poussé :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA40/scripts/pages/editor/Code-save_transcript-CORRIGE-V2.js?v=SHA8"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA40/scripts/pages/editor/agilo-transcript-history.js?v=SHA8"></script>
```

## Pins relevés 25/09 (Business)

| Script | www | staging après Lot A |
|--------|-----|---------------------|
| Save | `CORRIGE-V2` @ `1.02` | `CORRIGE-V2` @ `1.02` |
| Iframe confidence | `3274e9f` | `f787d5bf` (hold www) |
| creds / cr-history | `637a1ae4` | `637a1ae4` |
| Relance | `9ed90622` | `9ed90622` |
| Modeles CR | `33aee578` | `33aee578` |
| Lecteur | `f95d42ee` | `f95d42ee` |
| ed-header | `7b09ce51` | `7b09ce51` |
| confidence css/js | `aa75276d` / `9ea21053` | idem |
| sticky | `aa75276d` | idem |

Écart volontaire : iframe staging plus récente (`f787d5bf`, toast locuteurs). Ne pas rattraper www dans le même publish que le save.
