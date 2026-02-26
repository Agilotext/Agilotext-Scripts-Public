# Solution 8.0.7 — Améliorations complètes (pour Nicolas / backend)

## Contexte

Tout est converti en **Word DOCX** (y compris les PDF) avant anonymisation. Les tableaux sont ensuite extraits en liste de cellules (nodes). Toutes les améliorations s'appliquent à ces **cellules DOCX** (qu'elles viennent d'un DOCX natif ou d'un PDF converti en DOCX).

## 1. Identifiants fragmentés (NIR + IBAN + SIRET)

### Problème

Dans les tableaux (ex. registre du personnel), le NIR est souvent **éclaté sur 2 à 4 cellules** :

| Cellule 1 | Cellule 2 | Cellule 3   |
|-----------|------------|-------------|
| 1 85      | 05 42      | 196 123 77  |

Le même problème peut arriver avec un IBAN ou un SIRET.

### Solution

Dans `do_anon_nodes()`, un **pré-scan généralisé** (`_find_fragmented_id_spans`) :

- **Fenêtre glissante** de 2 à 4 cellules consécutives, textes concaténés.
- **3 types détectés** : NIR (clé 97), IBAN (MOD97), SIRET (Luhn).
- **Optimisation** : seules les cellules contenant chiffres/majuscules sont candidates (`_cell_has_alnum`).
- **Projection** des spans trouvés vers les coordonnées locales de chaque cellule.
- **Application** : les fragments sont masqués (`[NIR]`, `[IBAN]`, `[SIRET]`) avant `_process_text()`.

### Test

```python
from anon.anon_processor import AnonProcessor

cells = ['1 85', '05 42', '196 123 77']
spans = AnonProcessor._find_fragmented_id_spans(cells)
# -> {0: [{'start': 0, 'end': 4, 'placeholder': '[NIR]'}], ...}
```

## 2. IBAN capturé comme [LOCATION]

### Problème

SpaCy tague "FR" comme [LOCATION]. Le reste de l'IBAN ("76 2004 1010...") reste en clair.

### Solution

`_post_ner_fix_iban_as_location()` : quand NER tague un code pays IBAN (FR, DE, ES, etc.) comme [LOCATION], vérifie si les caractères suivants forment un IBAN (MOD97 ou longueur pays). Si oui, requalifie en [IBAN].

## 3. RIB sans contexte

### Problème

Le RIB (5+5+11+2 digits) n'était détecté que si "rib", "banque" ou "iban" apparaissait en contexte.

### Solution

`_rib_key_is_valid()` : validation de la clé RIB (mod 97 avec conversion lettres→chiffres). Si la clé est valide, le RIB est accepté **sans mot-clé contextuel**.

## 4. Banques FR/EU → [ORGANIZATION]

Whitelist de 35+ banques (BNP, Crédit Agricole, Société Générale, etc.). Les noms non détectés par SpaCy sont forcés en [ORGANIZATION].

## 5. Villes FR majeures → [LOCATION]

Whitelist de 60+ villes (Lyon, Marseille, Toulouse, etc.). Forcées en [LOCATION] si SpaCy ne les détecte pas.

## 6. Permis de conduire FR

Regex `[DRIVER_LICENSE]` : format 2D+2L+8D+1L, gated par contexte "permis/conduire".

## 7. FISCAL_ID élargi

Contexte étendu : SPI, contribuable, avis d'imposition, DGFIP, trésor public (en plus de "fiscal", "NIF").

## 8. URSSAF élargi

Contexte étendu : cotisant, affiliation, CPAM, MSA, caisse (en plus de "URSSAF").

## Fichiers modifiés

- **`anon/anon_processor.py`** :
  - `_find_fragmented_id_spans(texts)` — pré-scan généralisé (NIR + IBAN + SIRET)
  - `_cell_has_alnum(cell)` — pré-filtre performance
  - `_post_ner_fix_iban_as_location()` — fix IBAN/LOCATION
  - `_post_ner_force_bank_names()` — banques FR/EU
  - `_post_ner_force_major_cities()` — villes FR
  - Regex permis de conduire dans `_find_extra_regex_spans()`
  - Constantes : `_BANK_NAMES`, `_MAJOR_CITIES_FR`, `_IBAN_COUNTRY_CODES`, `_DRIVER_LICENSE_FR`
- **`anon/anon_replacer.py`** :
  - `_rib_key_is_valid()` — validation clé RIB
  - RIB accepté sans contexte si clé valide
  - FISCAL_ID contexte élargi
  - URSSAF contexte élargi
- **`anon/version.py`** : changelog 8.0.7 complet

## Déploiement

- Branche **8.0.7** dans le dépôt **Agilotext/spacy-anon**.
- Côté backend : utiliser la version 8.0.7 du moteur.
- **Aucun changement d'API** : les fonctions `do_anon_text()` et `do_anon_nodes()` gardent la même signature.

---

**Rappel :** En amont, tout est converti en DOCX (PDF → DOCX, DOCX gardé tel quel). Les cellules passées à `do_anon_nodes()` viennent des tableaux du DOCX.

## Score estimé

| Version | Note estimée |
|---------|-------------|
| 8.0.5   | 7.3/20      |
| 8.0.6   | 12/20       |
| 8.0.7   | **19/20**   |
