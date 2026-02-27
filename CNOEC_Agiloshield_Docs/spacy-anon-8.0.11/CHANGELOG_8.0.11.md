# Changelog 8.0.11

Date: 27/02/2026

## Objectif
Conserver le comportement stable observé en 8.0.7, avec deux correctifs ciblés demandés par audit CNOEC.

## Modifications
- `anon/anon_replacer.py`
  - Ajout de `RIB_23` pour détecter les comptes au format 23 chiffres.
  - Validation clé RIB (`_rib_key_is_valid`) pour accepter les RIB même sans mot-clé explicite.
  - Extension des mots-clés de contexte bancaire (`compte`, `cpt`, `bpm`, etc.).
  - Rejet SIREN à la source en contexte comptable (`résultat`, `exercice`, `bilan`, etc.).
- `anon/anon_processor.py`
  - Alignement du filtre montant/SIREN post-regex avec les nouveaux mots-clés comptables.
- `anon/version.py`
  - Ajout des métadonnées de version explicites.
- `retest_touati.py`
  - Suppression des versions hardcodées au profit de `anon.version`.

## Impact attendu
- Meilleure couverture des fuites de comptes bancaires au format 23 chiffres.
- Réduction des faux positifs SIREN sur montants comptables.
