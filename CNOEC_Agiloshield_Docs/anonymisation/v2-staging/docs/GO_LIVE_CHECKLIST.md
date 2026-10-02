# AgiloShield V2 : checklist avant www

Statut : brouillon, à compléter à l'étape Live 0.

## Tests de fin (staging, compte de test)

- [ ] **PDF en Pseudonymiser** : le sélecteur accepte les PDF comme en Anonymiser, la ligne de formats les cite, et un PDF glissé part au serveur (le front ne le refuse plus).
- [ ] PDF anonymisé prêt, téléchargé.
- [ ] PDF à vérifier : décisions passage par passage, zone masquée à la main, validation.
- [ ] Texte collé.
- [ ] Pseudonymisation Word ou TXT, clé téléchargée (dépend du correctif `PSEUDO_KEY_INVALID`).
- [ ] ZIP de plusieurs documents prêts.
- [ ] Page Free : quota et message de limite.

## Prérequis backend (Nico)

- [ ] Java V2 et worker Python en production, `BASE_URL` prod testée (pas `apitest`).
- [ ] `PSEUDO_KEY_INVALID` corrigé, sinon Pseudonymiser masqué en live.
- [ ] `/history/v2` disponible, sinon message « session en cours » conservé.
- [ ] Faits de confiance confirmés par écrit (lieu de traitement, durée de conservation) avant d'activer `TRUST_LINE`.
