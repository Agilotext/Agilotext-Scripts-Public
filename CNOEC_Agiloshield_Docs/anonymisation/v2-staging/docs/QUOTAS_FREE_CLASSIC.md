# Quotas et offres : V1 et V2

À décider. Rien n’est codé dans le V2 à partir de ce tableau.

| Sujet | V1 (écran actuel en production) | V2 (cet écran) | À décider |
|---|---|---|---|
| Gratuit | Pseudonymiser et Restaurer sont fermés. Le front affiche « Passez à Agiloshield Classic » (19 € HT par mois). | Le serveur décide. Si le compte a le mode, le bouton est actif. Sinon il est grisé. | Faut-il refermer Pseudonymiser et Restaurer pour le gratuit, comme en V1 ? |
| Classic | Pseudonymiser et Restaurer sont ouverts. | Pareil, dès que le serveur annonce le mode. | Rien à changer si le serveur distingue déjà les offres. |
| Quotas | Le serveur refuse avec `error_too_many_pages_for_last_30_days`. Le front traduit : limite sur 30 jours, et propose Classic au gratuit. Les plafonds affichés en secours sont 10 par jour et 100 par mois en gratuit, 250 par jour et 5 000 par mois en Classic. 3 fichiers à la fois en gratuit, 12 en Classic. | Le front n’a aucun compteur dans le navigateur. Il affiche seulement « Vous avez atteint la limite de documents de votre offre. » si le serveur renvoie `QUOTA_EXCEEDED` ou `QUOTA_REACHED`. 12 fichiers en cours, quelle que soit l’offre. | Le serveur V2 doit-il renvoyer le même refus de pages que le V1, et le front doit-il reproposer Classic ? |
| Restauration | Réservée à Classic. PDF, Word, Excel et PowerPoint, via `/api/v1/reconcileAnon2Text`. | Ouverte à tout compte qui voit l’écran, PDF compris, sur le même endpoint. | La restauration doit-elle rester réservée à Classic ? Tant que ce n’est pas tranché, elle est ouverte. |
