# Essai quotidien Free : reconnaissance d’intervenants

Branche : `feat/free-speakers-daily-trial` (parent `1.11`).

## Pin dashboard Free seulement

Page : `/app/free/dashboard` (`6815bee5a9c0b57da183550c`).

Le footer doit charger, dans cet ordre :

1. `window.AGILO_SCRIPTS_BASE` = jsDelivr pinné sur le SHA du commit
2. `scripts/pages/dashboard/Free/free-speakers-daily-trial.js`
3. `scripts/pages/dashboard/free_v2.js`
4. `scripts/pages/dashboard/Ent/maestro-context-ent.js`
5. `scripts/pages/dashboard/Free/streaming-free-loader.js`

Ne pas modifier le symbole partagé `COMP-Options_wrapper` ni `/tarifs`.

## Rollback

Remettre `AGILO_SCRIPTS_BASE` et `free_v2.js` sur `@2c2a315314c0bad8be1b1374a793ca9ce5a518a8`.
Retirer `free-speakers-daily-trial.js` du footer Free.
Republier subdomain, www et apex.
