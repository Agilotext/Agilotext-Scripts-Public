# Essai quotidien Free : reconnaissance d’intervenants

Branche : `feat/free-speakers-daily-trial` (parent `1.11`).

## Comportement v2.0.3

- Défaut : intervenants OFF, formatage ON.
- Un onglet n’envoie speakers que s’il est `armed` après le CTA « Activer mon essai ».
- Quota client : `available | pending | uncertain | used`.
- Fail-closed si le garde est absent.
- TTL pending : 3 h. TTL uncertain : 15 min.
- `window.edition` n’est lu que s’il s’agit d’une string (le badge `#edition` ne doit plus inhiber le garde).
- Statut d’essai : infobulle `?` à droite du libellé (plus de texte violet dans le flex du toggle).

## Transcript joli (dashboard Free)

`agilo-pretty-transcript.js` porte l’embed Pro/Business `__AgiloUIv2` (timestamp, nom gras, crayon). À charger **après** `free_v2.js`. Ne pas poser ce script sur Pro/Business.

## Pin dashboard Free seulement

Page : `/app/free/dashboard` (`6815bee5a9c0b57da183550c`).

Le footer doit charger, dans cet ordre :

1. `window.AGILO_SCRIPTS_BASE` = jsDelivr pinné sur `50cc2c16e97efcf12db5e9f9a88ab4582737df50`
2. `scripts/pages/dashboard/Free/free-speakers-daily-trial.js`
3. `scripts/pages/dashboard/free_v2.js`
4. `scripts/pages/dashboard/Free/agilo-pretty-transcript.js`
5. `scripts/pages/dashboard/Ent/maestro-context-ent.js`
6. `scripts/pages/dashboard/Free/streaming-free-loader.js`

Ne pas modifier le symbole partagé `COMP-Options_wrapper` ni `/tarifs`.

## Rollback staging

Retirer `agilo-pretty-transcript.js` du footer Free.
Remettre `AGILO_SCRIPTS_BASE` et les autres scripts sur `@7887dd94af9684b1a62f0ce8f4800e1ece928d2c`.
Republier le sous-domaine de test seulement (`agilotext-test.webflow.io`), pas www ni apex.
