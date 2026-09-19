# Éditeur — confort Magali (suivi lecture, 10 s, split, picker locuteurs)

**Pin Git :** fork `PIN_PENDING` (`1.09.13-plus-picker`) ; sticky + CSS hint `aa75276d`  
Branche : `fix/mes-transcripts-summary-guard-1.09`. **Ne pas pousser `origin/1.09`.**

Console : `window.__agiloEditorConfidenceVersion === '1.09.13-plus-picker'`  
Sauts : `#agilo-skip-back` / `#agilo-skip-fwd` libellés **10s**.  
Suivre : un seul `#agilo-transcript-follow`, déplacé (sticky si bande ouverte, sinon après `#agilo-speed`, sinon dock). Pas de barre pleine largeur dans le pane. **Réarmement Suivre** et **clic horodatage** recentrent le segment actif même sans changement d’horodatage. Hint hover **sous** le bouton, entier (dock `overflow:visible`).

Picker locuteurs : clic crayon ou nom (plus de double-clic). Un champ, Entrée crée le nom s’il n’y a pas de hit. Popover collé au crayon, sans voile, suit le scroll du pane. Menu de portée identique. Flag `?agilo_speaker_picker=0` ou `window.AGILOTEXT_SPEAKER_PICKER === false` : `prompt()` actuel.

Bouton **+** / Ctrl+Maj+= : même liste (ghost fixe, pas le bouton + vivant). Échap = pas de split. Nom choisi = nouveau paragraphe seulement (`scope: one`), sans 2e menu.

## Inventaire live 19/09 (staging)

Pas de loader `editor-main-confidence.js`. Embeds SHA directs :

- `Code-main-editor-IFRAME_V04-confidence.js` → `@PIN_PENDING`
- `Code-lecteur-audio-V3.4.js` : **ne pas recoller** (10s déjà)
- `agilo-audio-sticky.js` → `@aa75276d`
- `agilo-confidence.css.js` (embed panneau) → `@aa75276d`
- header PV v10 reste `@7b09ce51` (ne pas recoller)

`?agilo_cdn_branch=` ne change **rien** sur cette page (pas de loader). **WAIT `OK publish www`.**

## Src à recoller (Designer, page `/app/business/editor`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_PENDING/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=PIN_PENDING"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=aa75276d"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/agilo-audio-sticky.js?v=panel-ui-2"></script>
```

V3.4 et header : inchangés.

Purge :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@PIN_PENDING/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js
```

## Recette Bauer (job 705 / 1000040008), pas Magali live

1. Crayon / clic nom : popover, **pas de voile**, molette du PV OK. Menu portée inchangé.
2. Caret milieu, clic **+** : **pas** de prompt Intervenant. Liste visible, pas fermée toute seule.
3. Échap / clic dehors : un seul paragraphe, texte intact.
4. Choisir un nom : split. Gauche = ancien nom. Droite = nom choisi. **Pas** de 2e menu.
5. Nom absent, Entrée : créé, même split `one`.
6. Molette dans le pane pendant la liste + : fermeture, pas de split.
7. Ctrl+Maj+= : même flux.
8. `?agilo_speaker_picker=0` : prompt « Intervenant » UX++.
9. Suivre, 10 s, PV Word, corbeille, seek time du nouveau segment.

**WAIT `OK publish www`.** Rollback fork : `7deec066`. Rollback sticky/CSS : `0dff73b0` (hint) / `628ba702` (`1.09.8-follow`).
