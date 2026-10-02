# AgiloShield V2 : checklist avant www

Statut : brouillon, à compléter à l'étape Live 0.

## Tests de fin (staging, compte de test)

- [ ] **Pseudonymisation sans PDF (demande Nico, 02/10)** : en mode Pseudonymiser, la ligne de formats indique « PDF non pris en charge », le sélecteur de fichiers n'affiche pas les PDF, et un PDF glissé est refusé avec « les PDF ne peuvent pas être pseudonymisés. Choisissez Anonymiser pour ce fichier. ». Aucun appel serveur pour ce fichier. Repasser en Anonymiser réaccepte le PDF.
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
