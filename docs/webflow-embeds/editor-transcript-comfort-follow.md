# Éditeur — confort Magali (suivi lecture, 10 s, split)

**Pin Git :** `f95d42ee` (`1.09.7-follow`)  
Branche : `fix/mes-transcripts-summary-guard-1.09`. **Ne pas pousser `origin/1.09`.**

Console : `window.__agiloEditorConfidenceVersion === '1.09.7-follow'`  
Sauts : `#agilo-skip-back` / `#agilo-skip-fwd` libellés **10s**.

## Inventaire live 17/09 (www = staging)

Pas de loader `editor-main-confidence.js`. Embeds SHA directs :

- `Code-main-editor-IFRAME_V04-confidence.js` était `@3fad75c2`
- `Code-lecteur-audio-V3.4.js` était `@3fad75c2`
- `agilo-audio-sticky.js` était `@9ea21053`
- header PV v10 reste `@7b09ce51` (ne pas recoller)

`?agilo_cdn_branch=` ne change **rien** sur cette page (pas de loader). Recette = recoller les 3 src ci-dessous, **publish staging only**.

## Src à recoller (Designer, page `/app/business/editor`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f95d42ee/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=f95d42ee"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f95d42ee/scripts/pages/editor/Code-lecteur-audio-V3.4.js?v=f95d42ee"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f95d42ee/scripts/pages/editor/agilo-audio-sticky.js?v=panel-ui-2"></script>
```

Purge :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f95d42ee/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f95d42ee/scripts/pages/editor/Code-lecteur-audio-V3.4.js
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@f95d42ee/scripts/pages/editor/agilo-audio-sticky.js
```

## Recette Bauer (job 705), pas Magali live

1. Écoute sans toucher : le bloc actif reste visible.
2. Molette : l’écran reste, bouton **Suivre** apparaît, surlignage continue.
3. Clic horodatage : réarme.
4. Édition + `+` : l’écran ne remonte pas. Texte collé sous le prénom.
5. 10s / 10s. Shift+flèche = 10. Flèche = 5.
6. Ctrl+S puis **PV d’enquête (Word)**.

**WAIT `OK publish www`.** Rollback : remettre `@3fad75c2` (fork + lecteur) et sticky `@9ea21053`.
