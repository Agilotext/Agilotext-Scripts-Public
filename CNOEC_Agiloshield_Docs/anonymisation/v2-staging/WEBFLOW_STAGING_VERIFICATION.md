# AgiloShield V2 — éditeur documentaire Webflow staging

## État au 28 septembre 2026

**Assets figés :** `b73a5575010798764df15b386cb39238487959a9` sur la branche `codex/agiloshield-v2-pseudonym-front-20260928`. La candidate Python pseudonymisation `9dcd932` tourne en recette ; aucun merge ni déploiement live.

**Verdict :** composant et bloc CDN prêts pour mise à jour staging ; `WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED` **non prononcé**. Le navigateur de test a été redirigé vers `/auth/access-denied` en ouvrant la page publiée ; il n’a donc pas pu vérifier la version réellement active ni appeler Java sous une session valide. La session Webflow Designer n’était pas disponible pour remplacer et publier les Embeds. Les essais ci-dessous utilisent une page locale avec transport synthétique, y compris le bloc exact chargé depuis jsDelivr.

## Remplacement dans Webflow

Dans l’Embed principal Anonymiser, remplacer **tout** l’ancien bloc V2 épinglé à `bf501d4f` par [WEBFLOW_STAGING_COPY_PASTE.html](WEBFLOW_STAGING_COPY_PASTE.html). Si la page contient encore `<form id="agfForm">`, remplacer cet Embed entier. Vérifier qu’un second Embed ne charge pas Lottie et `agiloshield-embed-anonymisation-anon2-beta.js` à côté de V2 ; le vider si présent. L’ancien HTML exact et le retour arrière sont conservés dans [WEBFLOW_STAGING_REMOVE_THIS.html](WEBFLOW_STAGING_REMOVE_THIS.html) et [WEBFLOW_STAGING_ROLLBACK.html](WEBFLOW_STAGING_ROLLBACK.html). Ne modifier aucun autre Embed du dashboard.

Le bloc V2 utilise uniquement `https://apitest.agilotext.com/api/agiloshield-v2`, l’auth utilisateur Agilotext/Memberstack et des assets jsDelivr épinglés au commit ci-dessus. La même façade répond sur le port HTTPS standard avec `401 UNAUTHORIZED` sans session et un préflight CORS `204` pour `https://agilotext-test.webflow.io` ; le port `:9443` expirait depuis le Mac, d'où cette correction de configuration. Le bloc ne contient aucun HMAC Python, secret interservice ou token codé en dur. Le navigateur ne contacte jamais `127.0.0.1:8091`. Les formats affichés sont PDF, DOCX, XLSX, PPTX, TXT et CSV. L’interface reprend les onglets fichier/texte et la colonne de paramètres Agilotext ; les 13 cases sont dans la fenêtre « Types de données ». Un texte saisi devient un job TXT. Pseudonymiser et Restitution sont activés dans **le bloc staging proposé** ; la page Webflow publiée n'a pas encore reçu ce bloc.

## Preuves locales

| Contrôle | Résultat |
| --- | --- |
| 13 types, préférences bloquantes, sélection vide et confirmation | PASS sur mock |
| Fenêtre de types : enregistrement, annulation sans modification, compteur 0–13 | PASS sur mock |
| `fetch` natif rappelé avec le bon contexte ; ancien cas `Illegal invocation` | PASS Node et navigateur |
| Texte saisi converti en job TXT, aperçu original et même revue | PASS sur mock |
| 12 fichiers, un job/politique par fichier, soumission séquentielle, échec isolé | PASS sur mock |
| Reprise des 12 IDs après rechargement, sans conserver les octets | PASS sur mock |
| `READY`, `REVIEW_REQUIRED`, `FAILED`, téléchargement certifié seulement pour `READY` | PASS sur mock |
| PDF original/résultat, zoom, pagination, occurrence → fragments du ledger, région manuelle liée, révision | PASS sur mock |
| DOCX original/résultat dans iframe sandbox à origine opaque, CSP restrictive et `renderAltChunks:false` | PASS sur mock |
| TXT échappé, CSV par cellules ; XLSX/PPTX sans faux aperçu | PASS sur mock |
| 1440, 768 et 390 px ; panneau mobile plein écran, aucun débordement horizontal observé | PASS visuel local |
| Bloc épinglé/jsDelivr, `docx-preview` 0.4.1 et JSZip 3.10.2 | PASS local/CDN |
| Tests Node du client et de l’adaptateur auth, vérification syntaxique JS | PASS |
| Pseudonymiser, panneau READY et bouton de clé, onglet Restitution | PASS visuel sur mock local de la branche courante ; E2E authentifié non prouvé |

La réponse `/regions` réelle contient `pages[].occurrences[].rectangles`, et non un champ racine `revision`. Le surlignage utilise donc les `fragments` de l’occurrence fournis par **le ledger de revue courant**, puis vérifie la taille et la rotation de page données par `/regions`. Aucune recherche textuelle ne fabrique de rectangle. Un tracé manuel est désactivé si la géométrie de page n’est pas vérifiable. Le lecteur DOCX est une aide visuelle : seul le fichier final rouvert et la QA du serveur font foi. Les aperçus ne sont pas des téléchargements certifiés ; le téléchargement vérifie politique, révision, statut et assurance.

jsDelivr renvoie le template HTML du lecteur DOCX comme `text/plain`. Le client le récupère comme texte figé et le place en `srcdoc` dans l’iframe sandbox ; les scripts restent épinglés au même commit. Le chargement direct du `.html` dans un iframe n’est pas utilisé.

Un fichier `file://` tel que `WEBFLOW_STAGING_ROLLBACK.html` n’est pas une page de recette authentifiée. Il ne dispose pas de la session Memberstack ni de l’origine CORS autorisée ; le nouveau client affiche un message explicite au lieu de l’erreur brute. Tester le parcours réel sur la page HTTPS publiée.

## Gate encore ouverte sur la vraie page

Après collage et publication **staging seulement**, vérifier sous session Agilotext réelle : DNS/CORS/auth de l’origine exacte, `READY`, `REVIEW_REQUIRED`, `FAILED`, PDF et DOCX original/résultat, `KEEP`, `MASK`, région liée, nouvelle révision, reprise après reload, téléchargement, erreurs réseau et révision périmée. Contrôler deux comptes de recette distincts, la console et l’onglet Network : aucun appel Anon2, aucun HMAC/secret de service. Capturer les vues à 1440, 768 et 390 px. Ces vérifications sont nécessaires avant `WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED`.
