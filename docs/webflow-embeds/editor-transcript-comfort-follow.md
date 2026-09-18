# Éditeur — confort Magali (suivi lecture, 10 s, split, picker locuteurs)

**Pin Git :** fork `b1d31baf` (`1.09.10-roster`) ; sticky + CSS hint `aa75276d`  
Branche : `fix/mes-transcripts-summary-guard-1.09`. **Ne pas pousser `origin/1.09`.**

Console : `window.__agiloEditorConfidenceVersion === '1.09.10-roster'`  
Sauts : `#agilo-skip-back` / `#agilo-skip-fwd` libellés **10s**.  
Suivre : un seul `#agilo-transcript-follow`, déplacé (sticky si bande ouverte, sinon après `#agilo-speed`, sinon dock). Pas de barre pleine largeur dans le pane. **Réarmement Suivre** et **clic horodatage** recentrent le segment actif même sans changement d’horodatage. Hint hover **sous** le bouton, entier (dock `overflow:visible`).

Picker locuteurs : clic crayon ou nom (plus de double-clic). Popover Nucleo puis menu de portée inchangé. Flag `?agilo_speaker_picker=0` ou `window.AGILOTEXT_SPEAKER_PICKER === false` : `prompt()` actuel.

## Inventaire live 17/09 (www = staging)

Pas de loader `editor-main-confidence.js`. Embeds SHA directs :

- `Code-main-editor-IFRAME_V04-confidence.js` → `@b1d31baf`
- `Code-lecteur-audio-V3.4.js` : **ne pas recoller** (10s déjà)
- `agilo-audio-sticky.js` → `@aa75276d`
- `agilo-confidence.css.js` (embed panneau) → `@aa75276d`
- header PV v10 reste `@7b09ce51` (ne pas recoller)

`?agilo_cdn_branch=` ne change **rien** sur cette page (pas de loader). Staging recollé **18/09** (fork `@b1d31baf`, sticky + CSS `@aa75276d`, V3.4 reste `@f95d42ee`). **WAIT `OK publish www`.**

## Src à recoller (Designer, page `/app/business/editor`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b1d31baf/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=b1d31baf"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=aa75276d"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/agilo-audio-sticky.js?v=panel-ui-2"></script>
```

V3.4 et header : inchangés.

Purge :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@b1d31baf/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js
```

## Recette Bauer (job 705), pas Magali live

1. Crayon / clic nom : popover, pas de dialog navigateur.
2. Recherche `meni` → MÉNISSIER, pastille = hash actuel.
3. Nouveau nom une fois, 2e bloc : même chaîne, même couleur.
4. Shift = toutes les occurrences (comme avant). Alt = groupe. Échap = rien.
5. `+` : trim puis picker sur le **nouveau** bloc.
6. `?agilo_speaker_picker=0` : `prompt()` revenu.
7. Suivre hint entier, Surligner OFF coins, 10s, PV Word.

**WAIT `OK publish www`.** Rollback fork : `0dff73b0`. Rollback sticky/CSS : `0dff73b0` (hint) / `628ba702` (`1.09.8-follow`).
