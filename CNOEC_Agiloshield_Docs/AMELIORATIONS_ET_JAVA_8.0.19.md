# Améliorations intelligentes + Analyse Java 1.9.224 pour 8.0.19

**Date** : 14 février 2026  
**Objectif** : Compléter le plan 8.0.19 avec des améliorations ciblées et les modifications Java nécessaires.

---

## 1. Point d'architecture critique : 2 chemins distincts

### PDF vs Office/Excel/CSV : pipelines différents

| Format | Chemin | Moteur de détection |
|--------|--------|---------------------|
| **PDF** | `PdfNativeVisualRedactor` → `AgiloStyleAnonymizer` (Java) | **Java** (regex pure) |
| **Excel, CSV, Word, PPT, Texte** | `extractOrderedTexts` → `ListNodesTextReplacer` → Python spaCy | **Python** |

**Conséquence** : Les fuites observées sur les PDF (statuts, proposition fiscale, acte de cession) viennent du **moteur Java** `AgiloStyleAnonymizer`, pas de Python. Pour corriger les fuites PDF, il faut modifier le code Java dans `AgiloStyleAnonymizer`.

---

## 2. Améliorations Java (1.9.224 / kawansoft/AgiloTextApi)

### 2.1 ExcelPoiNodesReplacer — alignement du plan 8.0.19

**Actuel** : 
- Contrôle `contexts.size() == nodes.size()` uniquement
- Pas de validation du contenu (alignement POI vs extractOrderedTexts)
- Pas de `role=header`

**À ajouter** (conformément au plan révisé) :

1. **`role=header|data`** dans `buildContextualCell` :
   - Détecter si la cellule est un header (utilisée par une cellule en dessous, ou `looksLikeHeaderLabel`)
   - Ajouter `|role=header` ou `|role=data` dans `__AGCTX__`

2. **Validation alignement contenu** :
   - Créer `normalizeForAlignment(String s)` (trim, supprimer __AGCTX__, normaliser espaces)
   - Pour chaque index `i` : comparer `normalize(poiValue)` avec `normalize(nodeValue)` 
   - Si mismatch : `excelContextApplied=false`, fallback sur nodes bruts, log explicite

3. **Logs traçables** :
   - `excelContextApplied=true|false`
   - `excelContextReason=aligned|count_mismatch|content_mismatch|exception`
   - `contextualizedCount`, `nodeCount`

4. **Extension `looksLikeHeaderLabel`** pour couvrir les libellés du plan :
   - Ajouter : `"n° compte"`, `"cond. paie"`, `"observations"`, `"litiges"`, `"sage"`, `"logiciel"`, `"débit"`, `"crédit"`, `"solde"`, `"fournisseurs"`, `"clients"`, `"matières premières"`, `"quincaillerie"`, `"ape"`, `"naf"`

### 2.2 CsvPoiNodesReplacer

**Actuel** : 
- `hasHeader=true` → la ligne 0 n'est pas envoyée (startRow=1 dans flattenContextualCells)
- Les headers ne sont donc jamais anonymisés (correct)

**À ajouter** :
- `role=header` pour les cellules de la première ligne quand `hasHeader=true` (si elles sont un jour incluses)
- Pour l'instant, pas de changement urgent car les headers ne sont pas dans les nodes

### 2.3 PdfNativeVisualRedactor / AgiloStyleAnonymizer (Java)

**Problème** : C'est le moteur qui traite les PDF. Les fuites NIR, SIRET, noms, etc. sur les PDF viennent d'ici.

**Améliorations** :

1. **SIRET format groupé** (équivalent Python `_looks_like_grouped_siret`) :
   - Le pattern actuel `\b\d{3}[ ]?\d{3}[ ]?\d{3}[ ]?\d{5}\b` matche déjà le format
   - Vérifier si la validation Luhn rejette des SIRET valides ; ajouter un fallback "format groupé 3-3-3-5" même si Luhn échoue

2. **NIR espacé** :
   - Pattern actuel : `\b[12]\d{2}(?:0[1-9]|1[0-2])\d{8}\d{2}\b` (sans séparateurs)
   - Ajouter un pattern tolérant espaces/tirets : `[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}`

3. **Noms** : 
   - Étendre `PERSON_FORM_CONTEXT`, `PERSON_UPPER_SURNAME`
   - Ajouter une liste de noms courants CNOEC (DURAND, FONTAINE, LEGRAND, etc.) comme patterns explicites

4. **Villes** :
   - Pattern ou liste pour LYON, MARSEILLE, MONTPELLIER (token isolé uniquement)
   - Guard : ne pas matcher à l'intérieur d'un mot ("Lyonnaise")

### 2.4 ListNodesTextReplacer

**Améliorations possibles** :

1. **Chunking par frontière de ligne** : 
   - Actuellement : chunk par nombre de caractères (300k)
   - Risque : un NIR/SIRET à cheval sur 2 chunks n'est pas reconstitué
   - Option : préférer couper entre nodes entiers, ou augmenter la marge

2. **Timeout** : 20 minutes par chunk — adapter si besoin pour très gros documents

3. **Chemin anon** : hardcodé `/home/kawan_anon_dir` ou `c:\tmp\kawan_anon_dir` — vérifier la config pour le client

---

## 3. Améliorations Python complémentaires

### 3.1 Déjà dans le plan

- Pré-NLP non destructif
- HEADER_STOPLIST / role=header
- `_looks_like_grouped_siret` (fait)
- Garde finale non destructive

### 3.2 Améliorations additionnelles

1. **Détection SIRET sans espace en cellule** :
   - Pattern `\b\d{14}\b` en `cell_mode` quand la cellule est purement numérique (pas de virgule, pas de €)
   - Guard anti-montant (exclure si valeur > 10^10 ou contexte "solde", "débit")

2. **TVA intracommunautaire** :
   - Ajouter patterns DE, IT, ES, AT (format `DE 123456789`, etc.) si le corpus CNOEC contient des fournisseurs UE

3. **Références dossier** :
   - Pattern `Dossier n°\s*[A-Z0-9\-]+`, `Lettre mission\s+LM-[A-Z0-9]+` → `[REFERENCE]`

4. **Ordre de traitement des spans** :
   - S'assurer que les spans contextuels (header) sont fusionnés avec les spans NER/regex sans conflit
   - Priorité : [NIR] > [SIRET] > [SIREN] > [PERSON] > [LOCATION] sur les chevauchements

---

## 4. Synthèse des modifications Java à faire

| Fichier | Modification | Priorité |
|---------|--------------|----------|
| ExcelPoiNodesReplacer.java | role=header, alignment content, logs | P0 |
| ExcelPoiNodesReplacer.java | Extension looksLikeHeaderLabel | P1 |
| AgiloStyleAnonymizer.java (pdf) | SIRET groupé sans Luhn, NIR espacé | P0 |
| AgiloStyleAnonymizer.java (pdf) | Noms, villes (liste CNOEC) | P1 |
| CsvPoiNodesReplacer.java | role=header si évolution | P2 |
| ListNodesTextReplacer.java | Chunking / timeout | P2 |

---

## 5. Risques d'alignement Excel

### Problème

`buildContextualizedNodes` itère :
```java
for (sheet) for (row) for (col)
  if (!value.isEmpty()) contexts.add(...)
```

`extractOrderedTexts(excelDocumentDTO)` vient de **Chatmotor** (`ExcelDocumentDTOExtractor`). L'ordre peut différer si :
- Chatmotor extrait par zone/named range
- Gestion des cellules fusionnées différente
- Ordre des feuilles différent

### Mitigation

1. Implémenter la validation alignement (plan 8.0.19)
2. Documenter ou auditer `ExcelDocumentDTOExtractor.extractOrderedTexts` dans Chatmotor pour confirmer l'ordre (row-major, sheet-major)
3. En cas de mismatch persistant : envisager une extraction POI maison pour le contexte, alignée par construction avec l'ordre d'extraction

---

## 6. Ordre de mise en œuvre recommandé

1. **Python** : P0-A (pré-NLP non destructif), P0-D (garde finale)
2. **Java Excel** : role=header, alignment, logs
3. **Java PDF** : AgiloStyleAnonymizer (SIRET groupé, NIR espacé, noms)
4. **Python** : P0-C (noms, villes, ORG)
5. **Tests** : sous-lot P0, puis lot complet

---

## 7. Modifications déjà appliquées (14 fév 2026)

| Fichier | Modification |
|---------|--------------|
| `AgiloStyleAnonymizer.java` (pdf + convert) | SIRET : `[ ]?` → `\s*` (tolère plusieurs espaces) |
| `AgiloStyleAnonymizer.java` (pdf + convert) | NIR espacé : ajout pattern `NIR_SPACED` + détection FRNIR |
| `ExcelPoiNodesReplacer.java` | Extension `looksLikeHeaderLabel` : n° compte, cond. paie, observations, litiges, solde, débit, crédit, fournisseurs, clients, matières premières, quincaillerie, ape, naf, sage, logiciel |

À faire manuellement (non appliqué) :
- `role=header|data` dans buildContextualCell
- Validation alignement POI vs extractOrderedTexts
- Logs `excelContextApplied`, `excelContextReason`

---

## 8. Conclusion

Le plan 8.0.19 couvre surtout le côté **Python** (Excel/Word/CSV via nodes). Pour atteindre 20/20, il faut **aussi** renforcer le côté **Java** :

- **Excel** : role=header, alignement, logs
- **PDF** : AgiloStyleAnonymizer (SIRET, NIR, noms, villes)

Sans ces modifications Java, les fuites sur les PDF resteront, car ils ne passent pas par Python.
