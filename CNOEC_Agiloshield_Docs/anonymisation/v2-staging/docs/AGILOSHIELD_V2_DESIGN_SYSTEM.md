# AgiloShield V2 — Mini Design System

Date : 2026-10-02

## Principes

AgiloShield doit évoquer la précision documentaire, la sécurité et la maîtrise, sans esthétique « AI flashy ». Le système privilégie le blanc, les gris bleutés, un bleu Agilotext unique, peu d'ombres et une densité contrôlée.

## Échelle d'espacement

Base 4 px :

```text
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40
```

Tokens CSS : `--as-space-1` à `--as-space-10`.

## Hauteurs de contrôle

```text
small   34 px
medium  40 px
large   48 px
```

Deux contrôles sur une même rangée doivent partager la même hauteur.

## Rayons

```text
small    7 px
medium  10 px
large   14 px
xlarge  18 px
```

Les composants documentaires utilisent peu d'ombres ; les modales et le papier peuvent utiliser une ombre légère.

## Palette sémantique

- Primary : bleu Agilotext.
- Success : vert, réservé à READY / résultat certifié.
- Warning : ambre, réservé à REVIEW_REQUIRED ou à une action humaine requise.
- Danger : rouge, réservé à FAILED / erreurs.
- Neutres : bleu-gris pour surfaces et texte secondaire.

## Entités

Les couleurs d'entités servent uniquement à l'orientation visuelle et restent désaturées :

- Personne : indigo.
- Email : rose sourd.
- Organisation / profession / poste : teal.
- Adresse / lieu : vert.
- Date : ambre.
- Téléphone / URL : bleu.
- Identifiant / IBAN : violet.

Une même catégorie utilise le même ton dans la liste et dans la surbrillance PDF.

## Boutons

### Primary
Une seule action primaire par contexte.

### Secondary
Actions disponibles mais non recommandées.

### Tertiary / link
Actions secondaires, aide, détails.

### Icon button
Hit area cohérente, tooltip + aria-label obligatoires.

## États document

- READY : « Télécharger » primaire.
- REVIEW_REQUIRED : « Vérifier le document » primaire.
- FAILED : diagnostic / réessai, jamais un téléchargement présenté comme certifié.

## Workspace de revue

Desktop :
- panneau gauche : 350–390 px ;
- viewer : tout l'espace restant ;
- toolbar compacte ;
- décisions requises avant détections informatives.

Mobile :
- tabs « Document » / « Vérification » ;
- contrôles tactiles ;
- aucune largeur horizontale forcée.

## Motion

Transitions utiles uniquement : 120–200 ms.  
`prefers-reduced-motion` supprime les transitions non indispensables.
