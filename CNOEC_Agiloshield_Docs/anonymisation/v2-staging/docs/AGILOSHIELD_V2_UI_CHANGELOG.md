# AgiloShield V2 — UI Changelog

## 2026-10-02 — Product UI candidate

### Structure
- Nouveau design system local basé sur une grille 4 px.
- Landing plus calme et hiérarchisée.
- Navigation des trois surfaces convertie en contrôle segmenté B2B.
- Paramètres latéraux traités comme panneau stable plutôt que comme accumulation de cartes.

### Dépôt
- Dropzone agrandie et simplifiée.
- Hiérarchie texte / formats / limite rendue plus lisible.
- Feedback hover/drag-over harmonisé.

### Dernier document
- Refonte en summary card.
- Statut affiché en badge.
- READY : téléchargement primaire.
- REVIEW_REQUIRED : vérification primaire, téléchargement non vérifié secondaire.
- FAILED : action orientée diagnostic.

### Catégories
- Ajout d'une description humaine pour les 13 catégories.
- Codes techniques relégués au second plan.

### Review
- Header document simplifié et statut visible.
- Résumé « N décisions à prendre » en tête du panneau.
- Suppression de « Voir le passage » : ouverture d'une occurrence = navigation directe.
- Suppression de « Ajouter un masquage » dans la toolbar.
- Un seul outil principal « Masquer une zone ».
- Masquage manuel possible sur la version anonymisée.
- La vue Comparer revient vers Anonymisé au déclenchement d'un masque manuel.
- Surbrillance d'occurrence disponible sur Original ou Anonymisé lorsque la géométrie est compatible.
- Fast path PDF : changement d'occurrence sur la page sans nouveau fetch du document.
- KEEP/MASK conservent leur sémantique par occurrence.
- Aucune conversion automatique REVIEW → MASK.

### Historique
- Tableau desktop simplifié.
- Taille et mode regroupés sous le nom du fichier.
- Cartes mobile conservées et enrichies.

### Responsive / accessibilité
- Refonte des breakpoints tablet/mobile.
- Focus, aria-labels et reduced motion préservés.
- Contrôles tactiles plus cohérents.

## Contrat backend

```text
BACKEND_CONTRACT_UNCHANGED
```

Aucune route ni sémantique Java/Python n'est modifiée par cette candidate.
