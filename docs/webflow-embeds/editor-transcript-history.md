# Éditeur — historique « Revenir » des transcriptions

## État de livraison

Code préparé sur `codex/transcript-history-staging` depuis `origin/1.11`. **Aucun embed ni domaine Webflow ne doit être considéré comme modifié tant que la section « Constat Webflow » ci-dessous n'a pas été remplie depuis les settings réels.** Ne pas publier `www` dans ce lot.

Contrôles du 25/09/2026 : le MCP Webflow local expose `pages_get_content` et `sites_publish`, mais ses lectures des trois pages ne contiennent aucune référence aux scripts des HtmlEmbeds. Le MCP Webflow hébergé et son `data_element_settings_tool` ne sont pas exposés dans la tâche Codex actuelle. Avec le compte Maestro configuré, `getAuthToken` répond `OK` ; en formulaire URL encodé, `listSavedTranscripts` répond `OK` avec un slot pour le job `1000040008`, `displaySavedTranscript` renvoie un JSON parseable de 108 segments valides, et `receiveTextJson` renvoie le transcript courant de 630 segments. Le tool Maestro `list_saved_transcripts` échoue parce qu'il émet du multipart, refusé par cette route ; ce diagnostic ne remet pas en cause le chemin URL encodé utilisé par le code. Le gate de lecture API est franchi, mais ce job n'a pas été restauré en écriture. L'accès à l'embed réel et une recette de restauration sur un job test autorisé restent nécessaires ; aucune écriture Webflow ni publication n'a été effectuée.

## Contrat et comportement

- Liste : `POST /listSavedTranscripts`, slots physiques `0–9`, tri par date `dd-MM-yyyy HH:mm:ss`. Le champ `url`, qui contient un token, n'est jamais conservé, affiché ni journalisé.
- Lecture : `POST /displaySavedTranscript` avec `format=txt`. La réponse est un flux texte contenant un `TranscriptSaveDTO` JSON, ou un JSON d'erreur.
- Retour : validation du slot encore présent, lecture du backup en mémoire, comparaison avec le transcript courant du serveur, sauvegarde préalable du brouillon seulement s'il a changé, puis `POST /updateTranscriptFile` avec le DTO chargé. Une sauvegarde recycle un slot : ne jamais relire l'index après la présauvegarde pour retrouver le backup choisi.
- Le backend reconstruit les archives depuis du texte plat : millisecondes et IDs de segments ne sont pas garantis, des espaces ou retours à la ligne peuvent être normalisés. Vérifier qu'aucune phrase, aucun locuteur et aucun segment entier ne disparaît sur le job test avant publication.
- Après retour réussi : rechargement forcé du même job, suppression du brouillon local après affichage confirmé, mise à jour de la référence de l'autosave et relecture complète des slots. Le compte-rendu peut être ancien et doit alors être régénéré.
- Conflits : la comparaison avec le serveur réduit les écrasements entre onglets. Le backend ne fournit pas de condition atomique sur l'écriture ; un ancien client peut encore écrire au même instant.

## Constat Webflow à renseigner avant toute écriture

Commit des scripts candidats : `6526e346091e42a35b0969f8c4fbacc6ff879a91`. Les quatre URLs jsDelivr suivantes ont répondu HTTP 200 le 25/09/2026 ; elles ne prouvent pas encore quels embeds sont chargés par chaque page :

- `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/agilo-transcript-history.js`
- `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/Code-save_transcript-V2.js`
- `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/Code-main-editor-IFRAME_V04.js`
- `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@6526e346091e42a35b0969f8c4fbacc6ff879a91/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js`

La variante `confidence-v1` part du fork déjà épinglé dans un déploiement antérieur (`2302ac75cbc7f8bc13f709fb16ec1417c616047b`) et y ajoute uniquement le rechargement forcé et l'événement de chargement. Ce fork a été réintroduit sur la branche issue de `origin/1.11` pour éviter un recul de ses fonctions actuelles si cette variante est réellement utilisée.

Site Agilotext `6815bee5a9c0b57da18354fb` ; pages Business `68e0f3b838626e418962aeff`, Pro `68ed41f20988e833cb4e3148`, Free `68ed64995fcf3e0b0b452916`.

| Page | Embed save réel | Script save et pin | Script éditeur et pin | Credentials et ordre | Snapshot rollback |
|------|-----------------|--------------------|-----------------------|---------------------|-------------------|
| Business | À relever via MCP hébergé | À relever | À relever | À relever | À capturer |
| Pro | À relever via MCP hébergé | À relever | À relever | À relever | À capturer |
| Free | À relever via MCP hébergé | À relever | À relever | À relever | À capturer |

Identifier l'HtmlEmbed par le code lu, pas par un `element_id` supposé. Si les trois pages utilisent un composant partagé, une écriture peut modifier les trois instances. Garder les scripts voisins et leurs pins. Ajouter `agilo-transcript-history.js` après `Code-save_transcript-V2.js` et charger `agilo-editor-creds.js` avant les deux s'il n'est pas déjà présent. Modifier le pin de la variante d'éditeur uniquement sur les pages qui chargent cette variante. Utiliser le SHA Git complet de 40 caractères dans chaque URL jsDelivr et vérifier HTTP 200 avant Webflow. Ne jamais coller le source JS dans l'embed.

## Publication et recette

1. Vérifier `listSavedTranscripts` et `displaySavedTranscript` sur un job test Business autorisé, puis contrôler texte, ordre des segments et locuteurs. Le tool MCP `display_saved_transcript` tronque son résultat : ne pas l'utiliser pour réenregistrer le backup.
2. Lire puis sauvegarder le code complet de chaque embed concerné. Ne commiter un snapshot HTML que s'il ne contient aucun secret ; sinon le garder hors dépôt et noter son chemin dans cette section.
3. Modifier les HtmlEmbeds via le MCP Webflow **hébergé** ; relire chaque setting `code`. Publier avec le MCP **local** uniquement sur `agilotext-test.webflow.io`, `customDomains=[]`.
4. Tester Business : présence uniquement sur Transcription, retour propre, brouillon modifié, état PENDING, autre onglet, sauvegarde automatique et mise à jour de la liste. Vérifier Pro et Free. Aucun publish `www`.

## Rollback staging

Restaurer les settings `code` depuis les snapshots exacts capturés avant écriture ; relire les settings puis republier seulement le sous-domaine staging. Les pins précédents doivent être notés dans le tableau ci-dessus avant publication. Si les deux MCP Webflow ne sont pas disponibles dans la tâche d'exécution, s'arrêter avant toute écriture Webflow.
