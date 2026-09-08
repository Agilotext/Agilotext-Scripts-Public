# Scripts auth Webflow

## post-login-router.js (v8.2)

- **Page** : `/auth/post-login`
- **Emplacement** : Before `</body>` ou embed dédié sur cette page uniquement
- **v8** : sièges business via `teams.joinedTeams` (sans garde `ownedTeams === 0`)
- **v8.1** : `pln_anonymisation` → `/tools/agiloshield/premium/dashboard`
- **v8.2** : `pln_cse-*` (ex. `pln_cse-5920aby`) → `/app/business/dashboard`. Le cadeau `pln_pack-cse` ne compte pas.

Tests : `node --test tests/post-login-router.test.js`

Le Java `DeriveEditionFromMemberstackMember` doit classer le même préfixe en édition business (ticket interne, hors ce repo). Le front ne corrige pas les heures.
