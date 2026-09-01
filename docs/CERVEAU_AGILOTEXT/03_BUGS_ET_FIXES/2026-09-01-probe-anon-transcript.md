# Probe anonymisation transcript (2026-09-01)

Job témoin : `1000039417` (bauerwebpro, staging).

## Résultats MCP Agiloshield `anonymize_text`

Texte :

```
Florian de Bauerwebpro: Bonjour Stéphane. Contact: 06 12 34 56 78
```

| `types` demandés | Résultat |
|------------------|----------|
| `["TEL"]` seul | TEL masqué (`<TEL_AB>`) **et** inline `Stéphane` → `<PER_AA>` |
| `["PER"]` seul | Même sortie (TEL + PER inline masqués) |

Les libellés locuteur (`Florian de Bauerwebpro:`, `Stéphane:`) restent en clair dans les deux cas.

## Dialogue type transcript (anonText live, session précédente)

```
Florian de Bauerwebpro: Bonjour Stéphane…
Stéphane: Oui Florian…
```

Avec `PER` seul : un remplacement inline, labels locuteur inchangés.

Phrase simple `Florian a appelé Stéphane chez Bauerwebpro` avec `PER+ORG` : souvent texte identique (0 masquage).

## Cause probable

1. **NER / format dialogue** : les noms avant `:` ne sont pas traités comme entités.
2. **`entityTypes` sur `ApiAnonText` legacy** : le servlet Java ne parse pas le champ `entityTypes` (seulement username, token, edition, forceTextFormat). Le front envoie le paramètre mais le worker Python ne le reçoit pas via ce chemin.

## Actions front v3.2.2

- Warnings honnêtes (locuteur, texte inchangé).
- Mutex `anonInFlight`, `setModalBusy(false)` dans `finally`.
- `invalidatePreview()` au changement de types.
- Aperçu CR optionnel (2000 car.).

## Brief backend

Voir [`../02_BACKEND/ANON_ENTITYTYPES_ET_DIALOGUE.md`](../02_BACKEND/ANON_ENTITYTYPES_ET_DIALOGUE.md).
