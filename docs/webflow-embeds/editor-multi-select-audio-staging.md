# Éditeur Business — sélection multiple et lecture pendant la saisie

Branche de travail : `codex/editor-multi-select-audio`, créée depuis `origin/1.11`.

## Fichiers à épingler sur staging

Après le push, relever le **SHA complet** du commit (`git rev-parse HEAD`). Dans Webflow, sur le site de test seulement, conserver l'ordre actuel des embeds et remplacer une seule occurrence de chaque fichier ci-dessous :

```html
<!-- code-css, avant les commandes et l'éditeur -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA_COMPLET>/scripts/pages/editor/Code-editor-css.js"></script>

<!-- code-lecteur-audio, à sa place actuelle -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA_COMPLET>/scripts/pages/editor/Code-lecteur-audio-V3.4.js"></script>

<!-- code-main-editor, après agilo-confidence.js -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@<SHA_COMPLET>/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js"></script>
```

Avant remplacement, copier les trois URL en place dans un journal **privé**. La page enregistrée comportait aussi d'autres scripts dans ces embeds ; les conserver, ainsi que `window.AGILOTEXT_ENABLE_CONFIDENCE = true`. La copie locale de la page sert seulement à confirmer les noms et l'ordre : relever les URL actuelles dans Webflow avant toute édition.

Vérifier que chacune des nouvelles URL répond avec du JavaScript, qu'une seule version de chaque fichier se charge, puis publier **agilotext-test.webflow.io uniquement**. Ne pas déplacer les branches existantes.

## Recette de staging

1. Sur un travail de test fictif, sélectionner deux passages non contigus d'un même libellé par Shift + clic. Vérifier le compte, le nom, le renommage limité à ces deux passages, puis Sauvegarder et recharger.
2. Comparer le texte, les horodatages et les locuteurs non choisis avant/après. Tester des libellés différant par la casse ou un espace, puis un libellé vide : le bouton reste visible et son explication est lisible.
3. Ouvrir le choix puis modifier la sélection : aucune mutation ne doit être appliquée. Tester le clic extérieur, le clic dans la barre, Échap, la fermeture du choix, le crayon d'un passage, la suppression confirmée et annulée, et une division. Tester une sauvegarde échouée puis réessayée.
4. Tester Ctrl + Entrée sous Windows et Cmd + Entrée sous Mac avec le curseur au début, au milieu et à la fin du texte. Une pression bascule une fois lecture/pause, sans caractère ajouté ni déplacement du curseur. Vérifier la recherche, le choix de locuteur et Espace hors édition.
5. Vérifier la barre à 1024 et 1440 px, menu gauche ouvert et fermé, puis au zoom 125 %. Tous les boutons et l'explication doivent rester visibles et accessibles.

Si un contrôle échoue, remettre les trois URL précédentes et republier le site de test seulement. La mise en ligne principale est une étape séparée.
