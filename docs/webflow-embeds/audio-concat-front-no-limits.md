# Fusion audio : suppression des limites artificielles du front

La page Webflow `tools/concatener-audio` ne possède pas de source correspondante dans ce dépôt. La correction a donc été appliquée au HTML exporté fourni par Florian :

`/Users/florianbauer/Downloads/Assembler vos fichiers audio _ Agilotext - Outil gratuit.html`

## Modification à copier dans l’embed Webflow

Supprimer les deux constantes :

```js
const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
```

Dans `addFiles(fileList)`, supprimer le bloc qui refuse plus de 50 fichiers :

```js
if (uploadedFiles.length + files.length > MAX_FILES) {
  showError(`Nombre maximum de fichiers atteint (${MAX_FILES}).`);
  return;
}
```

Supprimer aussi le contrôle de taille cumulée :

```js
let currentTotal = totalSize();
```

et, dans la boucle :

```js
if (currentTotal + file.size > MAX_TOTAL_BYTES) {
  showError("Vous dépassez la limite totale de 2 Go.");
  break;
}
```

ainsi que :

```js
currentTotal += file.size;
```

Le contrôle des extensions, des doublons et des fichiers réellement sélectionnés reste actif. La durée totale n’est pas contrôlée par le front : elle est appliquée par le backend selon l’abonnement (Free 30 min, Pro 2 h, Enterprise 6 h).

Le texte d’aide doit également remplacer « max 2 Go » par une indication indiquant que la durée est contrôlée selon l’abonnement.
