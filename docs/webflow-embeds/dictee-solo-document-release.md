# Dictée solo : branche web et contrat avant activation

Branche : `feat/dashboard-dictee-solo-document`, dérivée de `feat/dashboard-dictee-reunion-carnet` (`5746840b`). Le tableau de bord affiche « Dictée solo » ; la valeur de préférence et les brouillons existants restent `carnet`. Les modes Réunion et les onglets Fichier/YouTube ne changent pas de pipeline.

## Contrat demandé à Nicolas

Le code actuel de l'API `11.0.8` refuse des champs multipart supplémentaires et les deux routes de dictée sont encore limitées à Bauer. Avant d'activer le document pour Pro/ENT :

1. `POST /api/v1/dictationApiAssemblyAi` accepte les quatre champs existants (`username`, `token`, `edition`, `audio`) et `sessionId` + `segmentId`. Un segment identifié déjà traité rend le même résultat sans nouveau débit de minutes ni nouvel appel fournisseur. Les minutes du segment réussi entrent dans le quota mensuel classique.
2. `POST /api/v1/createTranscriptFromText` accepte `username`, `token`, `edition`, `transcriptContent`, le vrai WAV `audio`, `promptId` et `requestId`. Même `username` + `requestId` + contenu : même `jobId`, sans second document ni second débit. Même identifiant avec contenu différent : refus explicite. Le texte fourni reste la transcription canonique ; pas de nouvelle ASR. La génération vérifie l'accès Pro/ENT, la durée autorisée et le quota classique d'envois sur 24 heures, sans recompter les minutes déjà dictées.
3. Les deux routes refusent Free et les comptes rétrogradés côté serveur avec des codes stables (`subscription_required`, `quota_minutes_exceeded`, `quota_uploads_exceeded`, `audio_too_long`, `invalid_token`). Confirmer les noms réels des codes dans la recette commune avant activation.

Le frontend n'ajoute ces identifiants aux requêtes que si `window.AGILO_SOLO_DOCUMENT_CONTRACT_READY === true`. Tant que la recette backend Pro/ENT n'est pas passée, **ne pas définir ce drapeau dans Webflow**. Pour une recette Bauer isolée sur l'ancien contrat, `window.AGILO_SOLO_DOCUMENT_PREVIEW = true` ouvre seulement le bouton pour `bauerwebpro@gmail.com` et omet les nouveaux champs ; ne pas publier cette option.

## Comportement web

- Les sessions WAV terminées sont enregistrées dans la base IndexedDB `agilo-dictee-solo-v1`, séparée de la sauvegarde d'urgence de l'enregistreur Fichier. Le texte reste dans la clé locale existante `agilotext:dicteeCarnet:{email}`. Le brouillon possède un identifiant stable par compte. Le navigateur réunit les sessions audio en WAV mono PCM 16 kHz, et prend le texte visible au clic sur Générer.
- Un envoi réserve atomiquement son `requestId` dans IndexedDB avant l'appel API. Une réponse incertaine conserve la même copie du texte, du modèle et des sessions audio pour une reprise sûre. Le lien éditeur apparaît seulement après `status: OK` et `jobId`; l'audio associé est ensuite supprimé localement. Le brouillon textuel se vide à la main dans le textarea (plus de bouton « Nouvelle dictée solo »).
- Aucun événement `agilo-upload-confirmed` n'est émis par ce nouveau parcours : cet événement peut effacer la sauvegarde audio d'urgence de Fichier. L'événement propre au document est `agilo-solo-document-accepted`.

## Livraison

Les trois loaders Webflow (`Ent`, `Pro`, `Free`) chargent les deux nouveaux scripts avant `mount-streaming.js`. Après le commit fonctionnel, remplacer leur `PIN` par le SHA de ce commit, puis pousser le commit de pin sur la branche dédiée. Le script embarqué dans Webflow doit ensuite pointer vers ce dernier SHA. Ne pas utiliser `@main`. Ne pas publier www avant le contrat Nico.

## Pin staging 25 sept 2026 (polish UI Entrée / layout / Générer)

Branche : `feat/dashboard-dictee-solo-document`.

- Loader footer (Webflow) : `2dd0b5401d7c5cc8ed849ca268f5a28639a33adb` (`?v=2dd0b540`)
- PIN interne des loaders (payload jsDelivr) : `43fe793fed0c48168c2acfcd1147e9d37585b20c` (`BUILD=20260925solo4`)
- Pages : `/app/business/dashboard`, `/app/premium/dashboard`, `/app/free/dashboard`
- Publish : `agilotext-test.webflow.io` only. www inchangé (pas ce lot).
- Aucun `AGILO_SOLO_DOCUMENT_CONTRACT_READY` ni `AGILO_SOLO_DOCUMENT_PREVIEW` dans Webflow.

`soloTabAllowed()` : Pro / ENT / Business ouvrent Dictée solo et dictent. Free reste grisé (tarifs). **Générer** est débloqué pour les paliers payés via `available()` = `soloTabAllowed` (multipart comme l’extension ; `requestId` seulement si `contractReady()`). Entrée = nouvelle ligne (capture + `pre-wrap`) ; phrases API séparées par `\n\n` ; Modèles sous le textarea ; Copier en haut à droite ; plus de bandeau « attente API », Mes fichiers, ni Nouvelle dictée.

Rollback polish : footers `@12158b07fa512b8cc67f0eb09f98953c386d3659?v=12158b07`. Rollback staging précédent : `@9055ae2bb31064f25292ccb8a894de59f1a39075?v=9055ae2b`. Republish subdomain only.

Si phrases ou Générer répondent `account_not_allowed` : gate serveur (comparer extension même compte).

Recette Florian (Business/Pro staging) : hard refresh ; Entrée visible ; deux pauses = deux blocs ; Modèles sous texte au-dessus de Générer ; Copier coin haut droit ; Générer cliquable sans bandeau validation API ; Free verrouillé ; Réunion / Fichier / YouTube inchangés.
