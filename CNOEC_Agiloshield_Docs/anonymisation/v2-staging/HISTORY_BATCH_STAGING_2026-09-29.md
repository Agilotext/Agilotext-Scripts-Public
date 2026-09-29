# AgiloShield V2 staging — file de dépôt et historique

Cette branche livre le front, son client et un mock synthétique. Elle ne change ni
Python, ni Java, ni Webflow publié. Dans le servlet Java local examiné le
29/09/2026, `GET /preferences` ne fournit pas de capacités d'historique ; la
façade n'expose ni liste V2, ni ZIP V2, ni historique Anon2. En conséquence, le
tableau réel affiche seulement les jobs connus de cette session, et les actions
non raccordées restent désactivées.

## Comportement multi-fichiers déjà implémenté

- Un dépôt accepte au plus 12 fichiers actifs, un upload à la fois. Les jobs
  acceptés sont suivis avec au plus deux appels de statut simultanés. Une fin
  de job libère une place pour un nouveau dépôt ; les autres fichiers ne sont
  pas effacés par un échec.
- Mode, `protectionPolicy` et listes sont copiés pour chaque fichier au moment
  du dépôt. Une modification des préférences ultérieure n'affecte pas ce job.
- `PENDING` et `PROCESSING` n'ont ni pourcentage ni phase inventée. Le temps de
  suivi n'est plus borné arbitrairement à trois minutes ; fermer/recharger la
  page reprend les jobs dont l'ID a été reçu. Les octets d'un upload encore
  local ne sont jamais stockés dans le navigateur.
- Un `401` interrompt les envois suivants. La reprise des fichiers locaux
  exige que `GET /preferences` fournisse le même `accountRef` opaque avant et
  après reconnexion. Sans cette preuve, l'utilisateur recharge et redépose
  les fichiers non envoyés : aucune donnée ne passe silencieusement à un
  autre compte. Une réponse de création perdue
  produit « Envoi à vérifier » sans renvoi automatique. Le premier `READY`
  d'un lot peut ouvrir le résultat une seule fois, sans remplacer un document
  déjà ouvert ni interrompre un réglage en cours.
- La limite d'upload locale est fournie par `capabilities.maxUploadBytes` ;
  l'Embed de recette applique à défaut 40 Mio. Le servlet Java local borne la
  requête multipart complète à 41 Mio. Java reste autoritaire en cas de `413`.

## Contrat Java proposé pour l'historique

Nico reste propriétaire des routes. Les chemins ci-dessous sont configurables
dans l'Embed (`HISTORY_V2_PATH`, `HISTORY_ANON2_PATH`, `BULK_ZIP_V2_PATH`) et
ne deviennent utilisables que si Java annonce les capacités correspondantes.
Toutes les routes restent sous la même `BASE_URL` HTTPS authentifiée ; le
navigateur n'appelle ni Python ni l'ancienne API Anon2 directement.

La réponse `GET /preferences` peut annoncer, **après implémentation et tests** :

```json
{
  "accountRef": "opaque-stable-per-account",
  "protectionPolicy": {"schemaVersion": 1, "selectedTypes": ["PER"], "digest": "..."},
  "capabilities": {
    "historyV2": true,
    "historyAnon2": false,
    "bulkZipV2": true,
    "maxUploadBytes": 41943040,
    "uploadIdempotency": false
  }
}
```

`GET <HISTORY_V2_PATH>?limit=50&cursor=...` répond avec une liste filtrée côté
Java par l'utilisateur authentifié, sans identifiant de tenant fourni par le
navigateur :

```json
{
  "items": [{
    "jobId": "123", "fileName": "exemple.pdf", "createdAt": "2026-09-29T12:00:00Z",
    "sizeBytes": 104857, "status": "READY", "processingMode": "ANONYMIZE",
    "reviewRevision": "r2", "protectionPolicy": {"digest": "...", "selectedTypes": ["PER"]},
    "listDigest": null
  }],
  "nextCursor": null
}
```

La liste ne remplace jamais un contrôle du job courant. Lorsqu'on ouvre ou
télécharge une ligne V2, le front relit statut, revue, révision et digests.
La pagination est par curseur ; la réponse d'une autre propriété est refusée
par Java. L'onglet Anon2 a son propre adaptateur et ses propres libellés :
aucun statut ni artefact ancien ne devient « certifié V2 ».

`POST <BULK_ZIP_V2_PATH>` reçoit uniquement 2 à 12 références explicites :

```json
{
  "jobs": [
    {"jobId": "123", "revision": "r2", "policyDigest": "...", "listDigest": null},
    {"jobId": "124", "revision": "r1", "policyDigest": "...", "listDigest": null}
  ]
}
```

Java doit vérifier pour **chaque** ligne propriété, `READY`, assurance,
révision, politique et listes au moment de construire l'archive. Un seul job
périmé fait échouer tout le ZIP ; aucune sortie `REVIEW_REQUIRED` ou `FAILED`
et aucune clé de pseudonymisation n'y entrent. Les noms de fichiers doivent
être sûrs et uniques. Réponse attendue : `Content-Type: application/zip` et
`X-Agiloshield-Zip-Certified: true`. Sans ces deux en-têtes, le front refuse le
ZIP. Les clés `.properties` restent des téléchargements individuels.

Pour récupérer proprement une création dont la réponse réseau s'est perdue,
Java peut garantir qu'un `X-Agiloshield-Upload-Id` répété pour le même compte,
fichier et options renvoie le **même** job. Une empreinte ou un propriétaire
différent doit donner un conflit. N'annoncer `uploadIdempotency: true` qu'après
ce test ; jusque-là, aucune relance automatique n'est permise.

La suppression V2 reste cachée tant que Nico n'a pas fixé ses effets sur
artefacts, clés et rétention. Le tableau n'invente pas une route `DELETE`.

## Gates avant activation Webflow staging

1. Mock : 1, 2, 12 et 13 fichiers ; file mixte ; `401` ; réponse perdue ;
   reload ; premier `READY` ; `REVIEW_REQUIRED` ; `FAILED` ; ZIP synthétique.
2. Java : liste paginée et ZIP avec deux comptes de tenants distincts ; refus
   des jobs d'autrui et des sélections périmées ; limite de taille ; idempotence
   si annoncée. Tester le retour de l'ancien historique séparément.
3. Navigateur Webflow connecté : 1440, 768 et 390 px, clavier, preview PDF et
   DOCX, aucune requête directe `:8091` ou Anon2, aucun secret dans JS/Network.
4. Publier des assets épinglés à un commit SHA, garder le bloc rollback. Le
   mock local ne vaut ni gate Java/Python ni qualification privacy produit.
