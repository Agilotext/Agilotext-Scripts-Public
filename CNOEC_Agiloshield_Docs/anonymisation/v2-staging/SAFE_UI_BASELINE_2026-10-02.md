# AgiloShield V2 — Safe UI Baseline

Date : 2026-10-02

## Objectif

Revenir au comportement front stable de la branche `codex/agiloshield-v2-java-1206-staging-20261001` et ne conserver qu'une passe CSS conservatrice sur les points de design évidents.

## Preuve de restauration fonctionnelle

Le fichier runtime principal :

```text
agiloshield-v2-embed.js
```

est strictement identique au blob stable :

```text
af8ef752b628dd0c1188f4bf9d613d48b5083210
```

Aucune logique de review, preview, KEEP/MASK, masque manuel, téléchargement, historique, auth ou API n'a été modifiée.

## Changements autorisés

CSS uniquement :

- hauteurs et alignements des boutons ;
- espacement général ;
- dropzone plus nette ;
- panneau paramètres plus cohérent ;
- alignement de « Dernier document » ;
- tableau historique légèrement nettoyé ;
- header/drawer review mieux alignés ;
- toolbar viewer harmonisée ;
- état actif de « Masquer une zone » non rouge ;
- petits correctifs responsive.

## Validation automatique

GitHub Actions run :

```text
37008379439
success
```

Contrôles :

- runtime JS restauré byte-for-byte ;
- syntaxe JavaScript ;
- tests client V2 ;
- tests listes ;
- tests localisation PDF ;
- tests auth ;
- intégrité CSS.

## Asset pin

```text
71e134cac2c3d57fe064db91176da25fa12ae404
```

Le bloc Webflow à utiliser est `WEBFLOW_STAGING_COPY_PASTE.html`.

## Suite

Cette baseline devient le point de départ des prochaines corrections. Les futurs changements seront faits écran par écran et comportement par comportement après retour visuel/utilisateur.
