# anonText : entityTypes et format dialogue

Date : 2026-09-01. Pour Nico / backend.

## Constat

Le front éditeur (`agilo-editor-anonymiser-transcript-v3.js`) envoie `entityTypes` en JSON dans le FormData `POST /api/v1/anonText`.

`ApiAnonText.java` ne lit **pas** ce champ. `AnonTextProcessor` dépose le fichier et attend le worker Python sans filtrage par type.

## Impact produit

L’utilisateur coche PER / ORG / TEL dans la modale mais le moteur legacy applique un masquage fixe (ou partiel). D’où le ressenti « ça n’anonymise pas » sur les noms de locuteur.

## Format dialogue

Transcripts Agilotext : `Speaker: texte`. Le NER masque parfois le prénom **dans** la phrase mais pas le label avant les deux-points.

Exemple :

```
Florian de Bauerwebpro: Bonjour Stéphane
```

→ `Florian de Bauerwebpro:` et `Stéphane:` souvent en clair.

## Pistes

1. Parser `entityTypes` dans `ApiAnonText` et le passer au worker (mapping PER → `person_name` comme `AgiloStyleAnonymizer`).
2. Post-traitement dialogue : masquer le segment avant `:` sur les lignes locuteur (spec + tests).
3. Exposer le endpoint Agiloshield récent si plus fiable que le pipeline fichier legacy.
4. Délai CR HTML : 10-30 s côté UX ; timeout front 60 s.

## Hors scope front staging

Pas de preprocessing speaker→plain côté éditeur sans spec validée.
