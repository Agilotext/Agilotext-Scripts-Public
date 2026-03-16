# Déploiement 8.0.19 — Anonymisation CNOEC (Python + Java 1.9.225)

**Date** : 4 mars 2026 — 20:19  
**Commits concernés** :
- spacy-anon : `9e1a69e` — 8.0.19 CNOEC: parser __AGCTX__, role=header, overrides contextuels, guard anti-leak
- AgiloTextApi : `72eff8e5` — 1.9.225 CNOEC 8.0.19: role=header|data, SENSITIVE_KEYWORDS, LOOKS_LIKE_VALUE

---

## 1. Pousser le moteur Python

```bash
cd /chemin/vers/spacy-anon-8.0.19
git fetch origin
git checkout 8.0.19
git log -1 --oneline
# Attendu : 9e1a69e 8.0.19 CNOEC: parser __AGCTX__, role=header, overrides contextuels, guard anti-leak
```

La branche `8.0.19` sur GitHub pointe déjà sur cette version (remplacement effectué le 4 mars 2026).

---

## 2. API Java — branche 1.9.225

```bash
cd /chemin/vers/AgiloTextApi
git fetch origin
git checkout 1.9.225
git log -1 --oneline
# Attendu : 72eff8e5 1.9.225 CNOEC 8.0.19: role=header|data, SENSITIVE_KEYWORDS, LOOKS_LIKE_VALUE
```

La branche `1.9.225` est déjà poussée sur `origin`.

---

## 3. Modifications incluses

### Python 8.0.19
- P1 : `_parse_agctx()` — parse `__AGCTX__[key=val|...]`
- P2 : protection `role=header` — restauration du texte original pour les cellules header
- P3 : `_apply_context_overrides()` — forçage par header (41 mappings)
- P4 : suppression `_SANDBOX_FORCED_ENTITY_PATTERNS`
- P5 : guard anti-AGCTX — aucun `__AGCTX__` ne doit fuiter en sortie
- P6 : 26 tests unitaires (`test_hardening_8_0_19.py`)

### Java 1.9.225
- J1+J2 : ExcelPoiNodesReplacer — `role=header|data` + 14 nouveaux keywords
- J3 : CsvPoiNodesReplacer — `role=data` dans le préfixe
- J4+J5 : PdfNativeVisualRedactor — +13 SENSITIVE_KEYWORDS (nom, prénom, date de naissance, etc.) + regex LOOKS_LIKE_VALUE durci

---

## 4. Contrat inchangé

1. Java envoie toujours un `List<String>`.
2. Python lit et renvoie un `JSON array`.
3. `len(out) == len(nodes)` reste obligatoire.
4. Le préfixe `__AGCTX__` est retiré avant écriture finale.

---

## 5. Prochaines étapes

1. Déployer les deux versions sur le serveur de test
2. Rejouer le lot CNOEC
3. Viser 20/20 à l’audit
