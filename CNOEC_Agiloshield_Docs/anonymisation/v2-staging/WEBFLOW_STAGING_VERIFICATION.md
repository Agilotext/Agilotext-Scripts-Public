# AgiloShield — interface guidée de recette

## État au 29 septembre 2026

**Assets figés :** `825eadc5b545db41ab7264f35af98ee17fc860e1` sur la branche `codex/agiloshield-v2-reliable-review-20260929`. Aucun changement du moteur Python, de Java, de la politique, des modèles ou des writers. Aucun merge ni déploiement live.

**Verdict :** interface et bloc CDN prêts pour mise à jour staging ; `WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED` **non prononcé**. Le 29/09/2026, la page publiée a affiché « Accès limité » dans le navigateur disponible. Il n’a donc pas été possible de vérifier la version réellement active ni d’appeler Java sous une session valide. Les essais ci-dessous utilisent une page locale avec transport synthétique. L’historique durable, le ZIP et les documents de l’ancienne version restent cachés tant que leurs capacités ne sont pas effectivement raccordées.

## Remplacement dans Webflow

Dans l’Embed principal Anonymiser, remplacer **tout** l’ancien bloc par [WEBFLOW_STAGING_COPY_PASTE.html](WEBFLOW_STAGING_COPY_PASTE.html). Si la page contient encore `<form id="agfForm">`, remplacer cet Embed entier. Vérifier qu’un second Embed ne charge pas Lottie et `agiloshield-embed-anonymisation-anon2-beta.js` à côté du nouveau parcours ; le vider si présent. Le retour immédiat au front précédent se fait avec [WEBFLOW_STAGING_ROLLBACK_PREVIOUS_V2.html](WEBFLOW_STAGING_ROLLBACK_PREVIOUS_V2.html) (épinglé à `f61988bb1fb14aa3abce26b7a0dcc64b0fd76047`). Le retour historique antérieur reste dans [WEBFLOW_STAGING_ROLLBACK.html](WEBFLOW_STAGING_ROLLBACK.html). Ne modifier aucun autre Embed du dashboard.

Le bloc utilise uniquement `https://apitest.agilotext.com/api/agiloshield-v2`, l’auth utilisateur Agilotext/Memberstack et des assets jsDelivr épinglés au commit ci-dessus. Le port explicite `:9443` de l’ancien bloc expire depuis un client externe ; le HTTPS standard répond `401` sans authentification et autorise l’origine Webflow staging lors du précontrôle CORS. Cela ne prouve pas encore le parcours authentifié. Il ne contient aucun HMAC Python, secret interservice ou token codé en dur. Le navigateur ne contacte jamais `127.0.0.1:8091`. Les formats affichés sont PDF, DOCX, XLSX, PPTX, TXT et CSV. Les 13 cases sont dans la fenêtre « Données à masquer » ; un texte saisi suit le traitement TXT. « Pseudonymiser » reste désactivé et la navigation « Restaurer » est cachée tant que ces capacités ne sont pas prouvées.

## Preuves locales

| Contrôle | Résultat |
| --- | --- |
| Téléchargement omnicanal immédiat (bouton toolbar viewer, carte dernier doc, tableau sessions) avec icônes Nucleo download/key | PASS sur mock / synthétique |
| Téléchargement sans friction sur document à vérifier (`REVIEW_REQUIRED`) avec notification non-bloquante et header `X-Agiloshield-Confirm-Non-Verifie` | PASS sur mock / synthétique |
| Téléchargement immédiat de la clé de pseudonymisation (`PSEUDONYMIZE`) pour `READY` et `REVIEW_REQUIRED` | PASS sur mock / synthétique |
| Carte d'action dédiée avec boutons directs pour formats sans aperçu interactif (XLSX, PPTX) | PASS sur mock |
| Déverrouillage côté front du mode Pseudonymisation et des listes d'inclusion/exclusion (flags staging + URL `?pseudo=1` & `?lists=1`) avec résilience si le serveur n'échoe pas encore `listDigest` | PASS sur mock / syntaxe validée |
| Accueil épuré sans bandeau de test, compteur compact "X/13", carte "Dernier document" avec action contextuelle | PASS sur mock |
| Auto-ouverture du tiroir au premier document prêt/à vérifier sans perte du focus utilisateur | PASS sur mock |
| Restauration de l'état du tiroir via sessionStorage | PASS sur mock |
| Signalements réorganisés (actions prioritaires en tête, alertes globales prudentes dédupliquées, groupement rétractable par catégorie) | PASS sur mock |
| Filtre textuel direct et filtre par page sur les passages à vérifier | PASS sur mock |
| Outil de masquage manuel PDF par rectangle libre (`ADD_MANUAL_REGION`) disponible sur Original ET Résultat courant (`anon`), sur jobs READY et REVIEW_REQUIRED | PASS sur mock |
| Comparaison visuelle PDF côte à côte (original vs résultat masqué) avec zoom et navigation synchronisés | PASS sur mock |
| Suite d’icônes Nucleo intégrée (switcher Original / Résultat / Comparer, toolbar PDF, masquer zone, boutons d'action télécharger/clé) avec contraste automatique | PASS visuel local / SVG |
| Isolation visuelle (z-index 99999, suppression tour général parasite, contour bleu AgiloShield, bouton fermer centré, boutons switcher contrastés) | PASS visuel local |
| 13 types, préférences bloquantes, sélection vide et confirmation | PASS sur mock |
| Fenêtre de types : enregistrement, annulation sans modification, compteur 0–13 | PASS sur mock |
| `fetch` natif rappelé avec le bon contexte ; ancien cas `Illegal invocation` | PASS Node et navigateur |
| Texte saisi converti en job TXT, aperçu original et même revue | PASS sur mock |
| 12 fichiers, un job/politique par fichier, soumission séquentielle, échec isolé | PASS sur mock |
| Reprise de 16 résultats après rechargement, sans conserver les octets ; limite de 50 IDs récents par session | PASS sur mock |
| 13e fichier refusé avec motif précis ; premier résultat prêt ouvert une seule fois par dépôt | PASS sur mock |
| Session expirée : pause des uploads suivants, reprise même compte, refus compte différent | PASS sur mock |
| Réponse de création perdue : aucun doublon et job visible après actualisation mock | PASS sur mock |
| Tableau V2, statut par document, icônes Nucleo, ZIP synthétique soumis seulement après contrôle des révisions et digests | PASS sur mock |
| `READY`, `REVIEW_REQUIRED`, `FAILED`, téléchargement certifié seulement pour `READY` | PASS sur mock |
| PDF original/résultat, zoom, pagination, occurrence → fragments du ledger, région manuelle liée, révision | PASS sur mock |
| DOCX original/résultat dans iframe sandbox à origine opaque, CSP restrictive et `renderAltChunks:false` | PASS sur mock |
| TXT échappé, CSV par cellules ; XLSX/PPTX sans faux aperçu | PASS sur mock |
| 1440, 768 et 390 px ; panneau mobile plein écran, aucun débordement horizontal observé | PASS visuel local |
| File réservée aux traitements en cours ; résultats terminés dans « Documents de cette session » sans doublon | PASS sur mock |
| Vue mobile : résumé des réglages avant dépôt, cartes avec actions visibles ; tableau conservé sur ordinateur | PASS visuel local |
| Trois étapes du mini-guide, « Passer », relecture volontaire et absence de relancement automatique après rechargement | PASS sur mock |
| Libellés des trois statuts, actions de revue, erreur serveur sûre, sélection vide visible avant dépôt et dans le résultat | PASS sur mock |
| Console de la page synthétique | Aucune erreur observée |
| Bloc épinglé/jsDelivr, `docx-preview` 0.4.1 et JSZip 3.10.2 | PASS local/CDN |
| JS et CSS servis par jsDelivr au SHA `825eadc5b545db41ab7264f35af98ee17fc860e1` | SHA-256 identiques aux fichiers du commit : JS `ab86ec4cf1aa2968f23ef69eeb89e21c86f7569e24fb463b5f69c75f596a9396`, CSS `8760de840aa98279876907ec3a84049622823af82e9da242af89bab6b7e8a7bd` |
| Bloc épinglé chargé dans une page locale avec API synthétique | PASS ; aucune erreur console observée |
| Tests Node du client et de l’adaptateur auth, vérification syntaxique JS | PASS |

La réponse `/regions` réelle contient `pages[].occurrences[].rectangles`, et non un champ racine `revision`. Le surlignage utilise donc les `fragments` de l’occurrence fournis par **le ledger de revue courant**, puis vérifie la taille et la rotation de page données par `/regions`. Aucune recherche textuelle ne fabrique de rectangle. Un tracé manuel est désactivé si la géométrie de page n’est pas vérifiable. Le lecteur DOCX est une aide visuelle : seul le fichier final rouvert et la QA du serveur font foi. Les aperçus ne sont pas des téléchargements certifiés ; le téléchargement vérifie politique, révision, statut et assurance.

jsDelivr renvoie le template HTML du lecteur DOCX comme `text/plain`. Le client le récupère comme texte figé et le place en `srcdoc` dans l’iframe sandbox ; les scripts restent épinglés au même commit. Le chargement direct du `.html` dans un iframe n’est pas utilisé.

Un fichier `file://` tel que `WEBFLOW_STAGING_ROLLBACK.html` n’est pas une page de recette authentifiée. Il ne dispose pas de la session Memberstack ni de l’origine CORS autorisée ; le nouveau client affiche un message explicite au lieu de l’erreur brute. Tester le parcours réel sur la page HTTPS publiée.

## Gate encore ouverte sur la vraie page

Après collage et publication **staging seulement**, vérifier sous session Agilotext réelle : DNS/CORS/auth de l’origine exacte, les trois statuts, PDF et DOCX original/résultat, corrections de passage, région liée, nouvelle révision, reprise après reload, téléchargement, erreurs réseau et révision périmée. Contrôler deux comptes de recette distincts, la console et l’onglet Network : aucun appel à l’ancien traitement, aucun HMAC/secret de service. Capturer les vues à 1440, 768 et 390 px. Ces vérifications sont nécessaires avant `WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED`.
