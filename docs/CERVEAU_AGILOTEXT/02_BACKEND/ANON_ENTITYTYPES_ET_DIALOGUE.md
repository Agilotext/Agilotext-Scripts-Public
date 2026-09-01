# Anon2 éditeur + labels dialogue

Date : 2026-09-01. Pour Nico / backend.

## Front (fait)

L’éditeur staging `3.3.0` n’appelle plus `/anonText`. Il passe par Anon2 document (`anon2AsyncOfficeText` + poll + `receiveAnon2Text`), comme le MCP / Classic. Les types PER/ORG/TEL/EML sont appliqués via `setAnon2UserDefaults` (save/restore).

## Reste backend

Les labels `Speaker:` (`Florian de Bauerwebpro:`, `Stéphane:`) restent souvent en clair même sur Anon2. Probe job `1000039453` (bauerwebpro, `ent`).

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
