# AgiloShield V2 — Product UI Release Candidate

Date : 2026-10-02

## Release asset

```text
branch: codex/agiloshield-v2-product-ui-20261002
immutable asset commit: 41868f828aeb40e245a3e246ad5080a6b59dd16e
```

Les assets Webflow publiables sont épinglés sur ce commit immuable.

## Validation

GitHub Actions :

```text
run: 37007266703
conclusion: success
```

Contrôles exécutés :

- syntaxe JavaScript de l'embed, client, listes, localisation et auth ;
- tests de contrat du client V2 ;
- tests listes ;
- tests localisation PDF ;
- tests auth ;
- invariants Product UI ;
- intégrité CSS et présence des sélecteurs critiques.

## Changements produit

- hiérarchie READY / REVIEW_REQUIRED / FAILED ;
- dropzone et panneau de paramètres refondus ;
- summary card du dernier document ;
- historique simplifié ;
- design system 4 px ;
- 13 catégories avec descriptions ;
- review workspace deux colonnes ;
- décisions restantes prioritaires ;
- navigation occurrence → document directe ;
- suppression de « Voir le passage » ;
- suppression du doublon « Ajouter un masquage » dans la toolbar ;
- outil unique « Masquer une zone » ;
- masquage possible sur la version anonymisée ;
- fast path de focus PDF sans nouveau fetch ;
- couleurs d'entités sobres ;
- responsive et reduced motion renforcés.

## Contrats inchangés

```text
BACKEND_CONTRACT_UNCHANGED
PRIVACY_SEMANTICS_UNCHANGED
NO_AUTOMATIC_REVIEW_TO_MASK
```

Aucun moteur Python, bridge Java, route, digest, révision ou règle de téléchargement n'est modifié.

## Webflow

Utiliser le bloc :

```text
CNOEC_Agiloshield_Docs/anonymisation/v2-staging/WEBFLOW_STAGING_COPY_PASTE.html
```

Rollback immédiat :

```text
CNOEC_Agiloshield_Docs/anonymisation/v2-staging/WEBFLOW_STAGING_ROLLBACK_PRODUCT_UI_20261002.html
```

Publier d'abord sur l'origine Webflow staging, puis effectuer un smoke manuel authentifié avant tout passage live.
