# Spec V1 — Synthèse de dossier

Statut : spec seulement, pas de code dans ce lot.
Besoin : enquête RH, un dossier = N entretiens.

## Problème

Une enquête = un dossier = N entretiens (souvent longs). Le livrable attendu est **une synthèse DRH transversale**, pas un concaténation de N comptes-rendus d’1 h.

Aujourd’hui Agilotext sait transcrire et résumer **un fichier**. Il n’existe pas de passe « dossier » qui relie les sources, croise les propos, et produit un document unique avec preuves cliquables.

## Périmètre V1

- Un bouton dossier « Synthétiser » (pas un bouton fichier).
- Sources : transcripts et / ou comptes-rendus déjà produits dans **ce** dossier.
- Types de synthèse (un choix à la demande) :
  - générale (ce qui s’est dit, décisions, zones d’attention)
  - convergences / divergences entre entretiens
  - chronologie (faits dans le temps)
- Sortie : **un nouveau document du dossier**, distinct des CR individuels.
- Pipeline : une passe par fichier (signal utile), puis une passe transversale.
- Sources cliquables si l’API le permet : fichier, intervenant, timecode.
- Pas de RAG multi-dossiers. Un dossier = un corpus.

## Hors V1

- Historique CR (dépendance backend, hors V1).
- Concat 50 × 1 h dans un seul prompt.
- App mobile.
- Publication automatique vers un SI client.

## Modes longs termes (une ligne, pas de code)

Deux directions possibles plus tard : Agilotext analyse le corpus (comme aujourd’hui), ou le corpus est exposé à une IA cliente. V1 reste 100 % Agilotext.

## Critères d’acceptation plus tard

- 3 entretiens dans un dossier → un document « Synthèse » distinct.
- Chaque affirmation majeure pointe au moins une source (fichier + passage).
- Relancer la synthèse ne détruit pas les CR individuels.
