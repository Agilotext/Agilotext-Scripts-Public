# Tarifs Agilotext — rétention audio / texte

Date de cadrage : `2026-06-19`

Ce document sert de support de mise à jour Webflow pour la page `/tarifs`.
Il reprend la base publique provisoire validée pour publication tant que Nicolas ne re-confirme pas une autre durée audio Business en production.

## Tableau principal

Remplacer la ligne unique `Durée de Conservation des données` par deux lignes distinctes :

- `Conservation audio`
- `Conservation transcription & compte rendu`

Valeurs à afficher :

| Offre | Conservation audio | Conservation transcription & compte rendu |
| --- | --- | --- |
| Gratuit | 24 heures | 7 jours |
| Pro | 30 jours | 1 an |
| Business | 30 jours | Illimité |
| Enterprise | Sur mesure | Sur mesure |

## Note courte sous le tableau

`Les fichiers audio sont automatiquement supprimés après la durée indiquée. Vos transcriptions et comptes rendus restent accessibles selon la durée de votre offre. Téléchargez l’audio avant expiration si vous souhaitez conserver l’enregistrement original.`

## FAQ à ajouter

Question :

`Combien de temps mes fichiers audio, transcriptions et comptes rendus sont-ils conservés ?`

Réponse :

`La durée de conservation dépend de votre offre et distingue l’audio des documents texte. Les fichiers audio sont conservés moins longtemps que les transcriptions et comptes rendus. Gratuit : audio 24 heures, transcription et compte rendu 7 jours. Pro : audio 30 jours, transcription et compte rendu 1 an. Business : audio 30 jours, transcription et compte rendu illimités. Enterprise : conservation sur mesure selon vos exigences.`

## Contrôles Webflow à faire

- Mettre à jour les tableaux secondaires ou blocs comparatifs qui répètent encore une conservation unique.
- Vérifier la colonne `Enterprise` : l’export HTML actuel montre encore `Illimité` dans la ligne de conservation principale.
- Ajouter l’entrée FAQ correspondante dans le bloc visible et dans le `FAQPage` JSON-LD si ce dernier est maintenu manuellement.
- Vérifier l’affichage desktop et mobile après publish.

## Note interne

- `Business audio = 90 jours` reste une cible interne documentée, pas une promesse publique tant qu’elle n’est pas reconfirmée.
