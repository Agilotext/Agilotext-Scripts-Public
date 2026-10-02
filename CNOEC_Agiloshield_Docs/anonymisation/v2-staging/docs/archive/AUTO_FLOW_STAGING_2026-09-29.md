# AgiloShield V2 — dépôt automatique, contrat de recette

La branche front ajoute le dépôt automatique et ouvre une seule fois le premier
résultat `READY` d'un lot, si l'utilisateur n'est pas déjà occupé dans un panneau
ou un réglage. Les autres résultats restent accessibles par **Afficher/Vérifier**.
Elle ne modifie ni Python, ni Java, ni la page Webflow
publiée. La façade Java actuelle relaie encore le service Python HTTP ; le
worker par fichiers `codeSha=6498642a2702cbe5` est une autre empreinte.
Contrôle lecture seule du 29 septembre : aucun `agiloshield_main.py` en cours
sur la recette ; `/health` du service `:8091` annonce `ea56a527ed2d0253`.
Les listes et la pseudonymisation par fichiers ne sont donc **pas** annoncées
comme passées de bout en bout.

## Ce que fait le front

La réponse `GET /preferences` doit contenir `protectionPolicy` avec son
`digest`. Elle reste autoritaire, y compris pour `selectedTypes: []`. Un dépôt
copie cette politique, le mode et les listes pour chaque fichier. Les uploads
partent un par un ; les appels de suivi des jobs acceptés sont bornés à deux
requêtes simultanées. Douze fichiers peuvent être actifs ; une fois terminés,
un nouveau lot peut être déposé. Les refus sont expliqués par fichier. Un `401`
suspend les envois restants jusqu'à une reprise explicite. Une réponse de
création perdue n'est jamais renvoyée automatiquement.
Pendant l'upload, un pourcentage n'apparaît que si le navigateur reçoit les
octets réellement transférés. `PENDING` et `PROCESSING` restent indéterminés.
Le premier `READY` peut ouvrir le panneau ; les autres documents ne prennent
jamais sa place. La table sous le dépôt liste les jobs de cette session. Sans
capacité de liste Java, elle n'est **pas** un historique durable. Le ZIP et
l'ancien historique restent désactivés jusqu'aux routes Java décrites dans
`HISTORY_BATCH_STAGING_2026-09-29.md`.

Pour ouvrir les listes, Java doit annoncer dans la même réponse :

```json
"capabilities": {
  "workerCodeSha": "6498642a2702cbe5",
  "listDirectives": true,
  "processingModes": ["ANONYMIZE"],
  "pseudonymKeyDownload": false,
  "uploadIdempotency": false
}
```

Cette annonce ne devient vraie qu'après un dépôt Java → worker et la
vérification du `listDigest` issu du `current.json`. Java relaie les tableaux
`anon2InclusionList` et `anon2ExclusionList` dans le `.options` privé ; il
expose `listDigest` dans création, statut et revue ainsi que
`X-Agiloshield-List-Digest` dans aperçu et téléchargement. Le digest des listes
est distinct du `policyDigest`. Les réponses d'artefact portent aussi statut,
assurance et révision ; une réponse périmée est refusée.

`FILE_LISTS_READY: true` dans l'Embed est le second verrou, activable après
cette preuve. Un fichier avec listes non vides n'est jamais envoyé sans ces
champs. Le navigateur ne stocke pas les termes dans `sessionStorage` ou les
logs. Il n'enregistre que les IDs et digests nécessaires à la reprise.

La pseudonymisation exige en plus un vrai job `PSEUDONYMIZE`, la QA, le résultat
et la clé `.properties` certifiée pour sa révision. Java annonce alors
`processingModes: ["ANONYMIZE", "PSEUDONYMIZE"]` et
`pseudonymKeyDownload: true` ; le front nécessite aussi
`PSEUDONYMIZE_READY: true`. Le bouton Restaurer demeure désactivé, car la
restitution par fichiers n'est pas livrée dans ce worker.

Si Java garantit qu'un `X-Agiloshield-Upload-Id` désigne toujours le même job,
il annonce `uploadIdempotency: true` et ajoute ce header au CORS staging. Sinon
le front ne renvoie jamais automatiquement un upload dont la réponse s'est
perdue : il indique « Envoi à vérifier ».

## Vérifications avant de modifier Webflow

1. Tester la page locale `tests/staging-equivalent.html` avec des fixtures
   synthétiques. `?progress=1` montre la progression d'octets simulée ;
   `?lostCreate=1` reproduit une réponse perdue ; `?lists=1&pseudo=1` simule
   les capacités futures. Ce mock ne prouve aucune intégration Java/Python.
2. Après raccordement Nico, traiter via Java listes vides, inclusion, exclusion
   conflictuelle et deux occurrences identiques. Vérifier les deux digests,
   le fichier final rouvert, les issues et une nouvelle révision. Pour Office,
   vérifier le blocage de revue et le nouveau job avec listes rectifiées.
3. Vérifier sous deux comptes de tenants distincts le parcours Webflow publié,
   READY/REVIEW_REQUIRED/FAILED, PDF et DOCX, la console et Network. Aucun
   appel navigateur vers `:8091`, aucune requête Anon2, aucun secret.
4. Ne remplacer l'Embed staging existant qu'après ces gates ; garder son bloc
   précédent comme rollback. La page publiée actuelle peut servir d'ancienne
   recette HTTP pendant le raccordement par fichiers.

Le code et les tests mock sont une **candidate front**, pas
`WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED` ni
`JAVA_FILE_WORKER_LISTS_E2E_PASSED`.
