# AgiloShield V2 — Audit Product Design / UX/UI

Date : 2026-10-02  
Périmètre : front Webflow staging uniquement.

## Diagnostic

AgiloShield V2 possède déjà les briques d'un vrai produit documentaire : dépôt multi-format, 13 catégories de protection, modes fichier/texte/restauration, pseudonymisation conditionnelle, historique, aperçu original/résultat, comparaison, revue par occurrence, masque manuel et attestation humaine.

Le problème principal était devenu l'orientation : trop d'actions, d'informations techniques et de détections avaient un poids visuel comparable. La refonte vise donc moins à « ajouter du design » qu'à rendre la complexité invisible.

## Problèmes prioritaires corrigés

### P0 — Workflow de revue
- Suppression du doublon d'actions entre « Ajouter un masquage » et « Masquer une zone » dans la toolbar.
- « Masquer une zone » devient l'unique outil visuel principal.
- Le masque manuel peut être tracé sur la version anonymisée ; l'original n'est plus forcé inutilement.
- En mode comparaison, l'activation du masque revient vers la version anonymisée plutôt que vers l'original.
- Une occurrence ouverte centre directement le document correspondant ; le bouton intermédiaire « Voir le passage » est supprimé.
- La revue affiche d'abord le nombre de décisions restantes.
- Les détections informatives restent accessibles sans concurrencer les décisions.

### P0 — Hiérarchie des CTA
- READY : « Télécharger » est primaire.
- REVIEW_REQUIRED : « Vérifier le document » est primaire ; le téléchargement non vérifié devient secondaire.
- FAILED : aucune présentation visuelle de succès.

### P1 — Densité et orientation
- La carte « Dernier document » devient une summary card structurée : fichier, métadonnées, statut, actions.
- Le header de review montre nom, statut, format/mode ; les identifiants techniques restent dans les détails.
- L'historique desktop est réduit à Fichier / Date / Statut / Actions ; taille et mode sont regroupés sous le nom.
- Les 13 catégories sont décrites en langage humain, avec le code technique en second niveau.

### P1 — Cohérence visuelle
- Grille d'espacement 4 px.
- Contrôles 34 / 40 / 48 px.
- Palette sémantique resserrée.
- Segmented control cohérent pour Original / Anonymisé / Comparer.
- Badges d'entités sobres et différenciés.
- PDF viewer traité comme un véritable workspace documentaire.

## Décisions de sécurité conservées

Cette refonte ne transforme jamais silencieusement REVIEW en MASK. Le bouton de confirmation humaine reste soumis au contrat backend : tant que le serveur n'autorise pas l'attestation, l'utilisateur est guidé vers les décisions restantes.

La géométrie d'une occurrence n'est surlignée sur le résultat que si les dimensions de page correspondent au contrat connu. Aucune approximation de position n'est introduite.

## Non-objectifs

- Aucun changement Python.
- Aucun changement Java.
- Aucun changement de routes.
- Aucun changement de policyDigest, listDigest, révision ou statut métier.
- Aucun faux pourcentage de progression.
- Aucun framework UI ajouté.

## Critère de sortie

Un nouvel utilisateur doit pouvoir comprendre en quelques secondes :
1. où déposer son document ;
2. ce qui sera protégé ;
3. si le résultat est prêt ou demande une action ;
4. quelle est l'unique prochaine action utile.
