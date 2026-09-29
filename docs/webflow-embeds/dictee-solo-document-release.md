# Dictée solo — contrat 11.0.9 et choix du texte

État au 29 septembre 2026. La branche de travail part du correctif `4fb3ce86bbabbf300316e073e47f939ccd6e864a`. Les anciens drapeaux Webflow `AGILO_SOLO_DOCUMENT_CONTRACT_READY` et `AGILO_SOLO_DOCUMENT_PREVIEW` ne sont pas nécessaires à l'envoi du `requestId` : le document l'envoie toujours. Ne pas ajouter ces drapeaux à Webflow.

## Comportement

- Réunion reste un parcours distinct. Dictée solo est disponible en Pro et Business/ENT ; Free reste grisé.
- En solo, **Lissée** (par défaut) envoie chaque segment à `dictationApiAssemblyAi` après une pause. **Fidèle** affiche le texte de Speechmatics en direct via `getSpeechmaticsRtJwt` et son WebSocket ; les résultats provisoires ne deviennent pas le brouillon final.
- Le moteur est choisi avant chaque prise et reste figé jusqu'à sa finalisation. On peut changer de moteur entre deux prises sans réécrire les corrections précédentes.
- Les WAV terminés restent dans IndexedDB et sont assemblés en un seul WAV à l'envoi. Le texte corrigé du champ est canonique pour `createTranscriptFromText`, avec le `promptId` sélectionné et un `requestId` stable. Après une réponse incertaine, la reprise réutilise le même contenu et le même identifiant.
- Une prise Fidèle incomplète conserve l'audio et les résultats définitifs reçus, signale l'incertitude et exige la confirmation de relecture avant génération. L'arrêt attend au plus dix secondes les derniers résultats Speechmatics.

## Publication staging

1. Garder l'URL actuelle de chaque loader Webflow pour le retour arrière. Remplacer la balise existante, sans charger une deuxième version.
2. Les loaders `Ent/streaming-ent-loader.js`, `Pro/streaming-pro-loader.js` et `Free/streaming-free-loader.js` doivent pointer, via leur `PIN` interne, vers le SHA complet du commit fonctionnel. La balise Webflow doit elle-même pointer vers le SHA complet du commit des loaders. Ne pas utiliser `@main`.
3. Publier uniquement `agilotext-test.webflow.io` et vérifier dans Network un loader et une seule version de chaque module.
4. Sur BauerWebPro, tester Lissée et Fidèle séparément puis leur alternance, le rechargement du brouillon, le modèle choisi, la génération, la reprise d'un envoi incertain et l'absence de doublon dans « Mes fichiers ». Contrôler aussi Réunion, Fichier et le verrou Free.
5. Si un critère échoue, remettre les URL précédentes et republier staging. La mise en ligne sur le site principal dépend de cette recette.

## Retour arrière connu avant ce lot

Loader `4fb3ce86bbabbf300316e073e47f939ccd6e864a`, dont le `PIN` interne vaut `4e2c536ed502c606009f9e204708b9059ac0f245`. Ce retour arrière conserve le correctif `requestId` sans le choix Fidèle/Lissée.
