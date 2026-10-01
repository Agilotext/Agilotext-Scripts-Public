# Fiche de préparation par entretien V2

Le script `scripts/pages/dashboard/transcript-preparation-v2.js` ajoute une action par travail sur le tableau de bord et, si les identifiants de l'éditeur sont chargés, dans l'éditeur. Il ne contient aucune donnée client. La fiche est produite par l'API privée `/api/v1/transcriptPreparation` à partir de la transcription sauvegardée. Il ne faut pas appeler `redoSummary` pour ce modèle.

## Déploiement test

1. Déployer l'API privée avec la route activée uniquement pour les comptes de recette par `AGILOTEXT_TRANSCRIPT_PREP_USERS`. Vérifier que la dépendance ChatMotor et les autres bibliothèques privées sont disponibles et que la route renvoie `creditCost: 0`.
2. Dans Webflow **staging**, charger le script après `agilo-editor-creds.js` sur l'éditeur, ou après l'authentification existante sur le tableau de bord. Épingler jsDelivr au SHA complet du commit audité de la branche de test ; ne charger qu'une version du script.
3. Avant le script, définir :

```html
<script>
window.AGILO_TRANSCRIPT_PREP = {
  enabled: true,
  apiBase: 'https://API-DE-TEST/api/v1'
};
</script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA_COMPLET/scripts/pages/dashboard/transcript-preparation-v2.js"></script>
```

4. Sur un travail de test, créer une copie de modèle depuis les champs de questions, examiner l'empreinte de la transcription, choisir l'agent, générer, annuler et télécharger. Confirmer que le compte rendu et la transcription ne changent pas. Tester l'échec du contrôle, le rafraîchissement et l'historique.
5. Après recette et déploiement contrôlé du backend, utiliser la même version auditée sur le site utilisé par le pilote et activer seulement les comptes autorisés. En cas d'échec, retirer l'appel du script sur staging ou revenir à l'URL précédente ; l'API conserve le compte rendu existant.

Le bouton « Enregistrer sous » crée un nouveau modèle dédié. Les neuf titres du profil lycée sont fixes ; les questions propres à l'enquête sont configurées dans des champs simples. Le serveur bloque l'utilisation de ce modèle par la régénération du compte rendu.
