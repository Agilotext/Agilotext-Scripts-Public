# Essai quotidien Free : reconnaissance d’intervenants

Branche : `feat/free-speakers-daily-trial` (parent `1.11`).

## Comportement v2

- Défaut : intervenants OFF, formatage ON.
- Un onglet n’envoie speakers que s’il est `armed` après le CTA « Activer mon essai ».
- Quota client : `available | pending | uncertain | used`.
- Fail-closed si le garde est absent.
- TTL pending : 3 h. TTL uncertain : 15 min.

## Pin dashboard Free seulement

Page : `/app/free/dashboard` (`6815bee5a9c0b57da183550c`).

Le footer doit charger, dans cet ordre :

1. `window.AGILO_SCRIPTS_BASE` = jsDelivr pinné sur le SHA du commit
2. `scripts/pages/dashboard/Free/free-speakers-daily-trial.js`
3. `scripts/pages/dashboard/free_v2.js`
4. `scripts/pages/dashboard/Ent/maestro-context-ent.js`
5. `scripts/pages/dashboard/Free/streaming-free-loader.js`

Ne pas modifier le symbole partagé `COMP-Options_wrapper` ni `/tarifs`.

## Rollback v2

Remettre le footer Free sur `@a07acae09077514aee64eceae496468899c4ef46`.
Republier subdomain de test, puis www et apex.
