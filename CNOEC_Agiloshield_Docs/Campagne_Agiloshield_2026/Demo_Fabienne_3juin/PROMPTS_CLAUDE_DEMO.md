# Prompts Claude — démo M&A Fabienne

Copier-coller après upload du **fichier pseudonymisé uniquement**.

---

## Prompt 1 — Analyse due diligence (recommandé live)

```
Tu analyses un bilan pseudonymisé (identités masquées, chiffres et dates réels).

1. Résume la structure financière (CA, résultat, fonds propres, dette si visible).
2. Liste 5 points d'attention pour une due diligence M&A.
3. Signale toute incohérence ou ratio atypique.
4. Propose 3 questions à poser au vendeur.

Ne tente pas de ré-identifer les entités masquées. Base-toi sur les montants et dates.
```

---

## Prompt 2 — Synthèse executive (associés pressés)

```
Synthèse executive en 10 lignes : santé financière, forces, faiblesses, risques.
Document pseudonymisé M&A — ignore les placeholders de noms/SIREN.
```

---

## Prompt 3 — Comparaison multi-exercices (si plusieurs années dans le doc)

```
Compare les exercices présents dans ce bilan pseudonymisé :
- évolution du CA et de la marge
- postes de charges qui bougent le plus
- alertes pour un acquéreur

Reste factuel. Pas de ré-identification.
```

---

## Prompt 4 — Après la démo (usage Fabienne seule)

```
Je suis conseil M&A. Ce document est pseudonymisé via Agiloshield (France, RGPD).
Aide-moi à préparer une note d'1 page pour un comité d'investissement :
thèse, risques, valorisation indicative (fourchette qualitative), next steps.
```

---

## Rappel sécurité

- **Ne jamais** uploader le `.properties` dans Claude.
- **Ne jamais** uploader le document **original** non pseudonymisé.
- En cas de doute : repseudonymiser sur https://www.agilotext.com/tools/anonymisation
