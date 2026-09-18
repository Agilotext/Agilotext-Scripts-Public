# Éditeur — confort Magali (suivi lecture, 10 s, split, picker locuteurs)

**Pin Git :** fork `7deec066` (`1.09.12-combobox`) ; sticky + CSS hint `aa75276d`  
Branche : `fix/mes-transcripts-summary-guard-1.09`. **Ne pas pousser `origin/1.09`.**

Console : `window.__agiloEditorConfidenceVersion === '1.09.12-combobox'`  
Sauts : `#agilo-skip-back` / `#agilo-skip-fwd` libellés **10s**.  
Suivre : un seul `#agilo-transcript-follow`, déplacé (sticky si bande ouverte, sinon après `#agilo-speed`, sinon dock). Pas de barre pleine largeur dans le pane. **Réarmement Suivre** et **clic horodatage** recentrent le segment actif même sans changement d’horodatage. Hint hover **sous** le bouton, entier (dock `overflow:visible`).

Picker locuteurs : clic crayon ou nom (plus de double-clic). Un champ, Entrée crée le nom s’il n’y a pas de hit. Popover collé au crayon, sans voile, suit le scroll du pane. Menu de portée identique. Flag `?agilo_speaker_picker=0` ou `window.AGILOTEXT_SPEAKER_PICKER === false` : `prompt()` actuel.

## Inventaire live 17/09 (www = staging)

Pas de loader `editor-main-confidence.js`. Embeds SHA directs :

- `Code-main-editor-IFRAME_V04-confidence.js` → `@7deec066`
- `Code-lecteur-audio-V3.4.js` : **ne pas recoller** (10s déjà)
- `agilo-audio-sticky.js` → `@aa75276d`
- `agilo-confidence.css.js` (embed panneau) → `@aa75276d`
- header PV v10 reste `@7b09ce51` (ne pas recoller)

`?agilo_cdn_branch=` ne change **rien** sur cette page (pas de loader). Staging recollé **18/09** (fork `@7deec066`, sticky + CSS `@aa75276d`, V3.4 reste `@f95d42ee`). **WAIT `OK publish www`.**

## Src à recoller (Designer, page `/app/business/editor`)

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@7deec066/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js?v=7deec066"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/confidence-v1/agilo-confidence.css.js?v=aa75276d"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@aa75276d/scripts/pages/editor/agilo-audio-sticky.js?v=panel-ui-2"></script>
```

V3.4 et header : inchangés.

Purge :

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@7deec066/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js
```

## Recette Bauer (job 705), pas Magali live

1. Crayon / clic nom : popover, **pas de voile**, molette du PV OK.
2. Scroller le pane : panel **sous le crayon**.
3. Molette **dans** la liste : la liste bouge, le PV non.
4. Suivre ON, ouvrir le picker : Suivre passe contour, le pane **ne** court plus.
5. Scroller jusqu’à faire **disparaître** le crayon du pane : fermeture. Un petit scroll où le crayon reste visible : ça suit.
6. Clic un autre nom : picker de ce bloc. Échap / clic texte : ferme.
7. Choisir un nom : menu portée collé au crayon, même règles.
8. Lecteur sticky visible : popover **sous** la bande, pas dessous.
9. Recherche `meni` → MÉNISSIER, pastille hash, nom ink. Shift / Alt / `?agilo_speaker_picker=0` / 10s / PV Word.
10. Tape Florian, liste vide, Entrée → menu portée (pas de 2e champ). Focus champ : pas d’anneau bleu Safari. Hover ligne : gris, pas de tache bleue.

**WAIT `OK publish www`.** Rollback fork : `25c40924`. Rollback sticky/CSS : `0dff73b0` (hint) / `628ba702` (`1.09.8-follow`).
