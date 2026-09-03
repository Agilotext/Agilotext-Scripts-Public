# Essai quotidien Free : reconnaissance d’intervenants

Branche : `feat/free-speakers-daily-trial` (parent `1.11`).

## Comportement v2.0.2

- Défaut : intervenants OFF, formatage ON.
- Un onglet n’envoie speakers que s’il est `armed` après le CTA « Activer mon essai ».
- Quota client : `available | pending | uncertain | used`.
- Fail-closed si le garde est absent.
- TTL pending : 3 h. TTL uncertain : 15 min.
- `window.edition` n’est lu que s’il s’agit d’une string (le badge `#edition` ne doit plus inhiber le garde).

## Pin dashboard Free seulement

Page : `/app/free/dashboard` (`6815bee5a9c0b57da183550c`).

Le footer doit charger, dans cet ordre :

1. `window.AGILO_SCRIPTS_BASE` = jsDelivr pinné sur `88efb6097a87e009e45881675b7da859314fbc0e`
2. `scripts/pages/dashboard/Free/free-speakers-daily-trial.js`
3. `scripts/pages/dashboard/free_v2.js`
4. `scripts/pages/dashboard/Ent/maestro-context-ent.js`
5. `scripts/pages/dashboard/Free/streaming-free-loader.js`

Ne pas modifier le symbole partagé `COMP-Options_wrapper` ni `/tarifs`.

## Rollback staging

Remettre le footer Free sur `@faae68ad4754e1358dc8d954eb4fb6773d137524`.
Republier le sous-domaine de test seulement (`agilotext-test.webflow.io`), pas www ni apex.
