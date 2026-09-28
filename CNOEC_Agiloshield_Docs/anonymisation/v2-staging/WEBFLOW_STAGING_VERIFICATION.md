# AgiloShield V2 — éditeur documentaire Webflow staging

## État au 28 septembre 2026

**Assets figés :** `bf501d4fe411b8c84dd5ade2b9742b1edd21d7c1` sur la branche `codex/agiloshield-v2-document-editor-20260928`. Aucun changement du moteur Python, de l’Entity Engine, de GLiNER, de la policy ou des writers. Aucun merge ni déploiement live.

**Verdict :** composant et bloc CDN prêts pour intégration staging ; `WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED` **non prononcé**. La page publiée `https://agilotext-test.webflow.io/app/business/dashboard/anonymiser` affiche encore Anon2. La session Webflow Designer n’était pas disponible pour remplacer et publier ses Embeds. Les essais ci-dessous ont donc été faits sur une page locale de recette avec transport synthétique, y compris avec le bloc exact et les assets chargés depuis jsDelivr.

## Remplacement dans Webflow

La page comporte deux Embeds Anon2 concernés. Remplacer **tout** le premier Embed contenant `<form id="agfForm">` par le contenu de [WEBFLOW_STAGING_COPY_PASTE.html](WEBFLOW_STAGING_COPY_PASTE.html). Supprimer **tout** le second Embed qui charge Lottie et `agiloshield-embed-anonymisation-anon2-beta.js` ; ne pas laisser ce script à côté de V2. Le contenu exact à retirer est conservé dans [WEBFLOW_STAGING_REMOVE_THIS.html](WEBFLOW_STAGING_REMOVE_THIS.html) et le retour arrière dans [WEBFLOW_STAGING_ROLLBACK.html](WEBFLOW_STAGING_ROLLBACK.html). Ne modifier aucun autre Embed du dashboard.

Le bloc V2 utilise uniquement `https://apitest.agilotext.com:9443/api/agiloshield-v2`, l’auth utilisateur Agilotext/Memberstack et des assets jsDelivr épinglés au commit ci-dessus. Il ne contient aucun HMAC Python, secret interservice ou token codé en dur. Le navigateur ne contacte jamais `127.0.0.1:8091`. Les formats affichés sont PDF, DOCX, XLSX, PPTX, TXT et CSV ; les fonctions Anon2 restauration, pseudonymisation, JSON/FEC et inclusion/exclusion ne sont pas présentées comme V2.

## Preuves locales

| Contrôle | Résultat |
| --- | --- |
| 13 types, préférences bloquantes, sélection vide et confirmation | PASS sur mock |
| 12 fichiers, un job/politique par fichier, soumission séquentielle, échec isolé | PASS sur mock |
| Reprise des 12 IDs après rechargement, sans conserver les octets | PASS sur mock |
| `READY`, `REVIEW_REQUIRED`, `FAILED`, téléchargement certifié seulement pour `READY` | PASS sur mock |
| PDF original/résultat, zoom, pagination, occurrence → fragments du ledger, région manuelle liée, révision | PASS sur mock |
| DOCX original/résultat dans iframe sandbox à origine opaque, CSP restrictive et `renderAltChunks:false` | PASS sur mock |
| TXT échappé, CSV par cellules ; XLSX/PPTX sans faux aperçu | PASS sur mock |
| 1440, 768 et 390 px ; panneau mobile plein écran, aucun débordement horizontal observé | PASS visuel local |
| Bloc épinglé/jsDelivr, `docx-preview` 0.4.1 et JSZip 3.10.2 | PASS local/CDN |
| Tests Node du client et de l’adaptateur auth, vérification syntaxique JS | PASS |

La réponse `/regions` réelle contient `pages[].occurrences[].rectangles`, et non un champ racine `revision`. Le surlignage utilise donc les `fragments` de l’occurrence fournis par **le ledger de revue courant**, puis vérifie la taille et la rotation de page données par `/regions`. Aucune recherche textuelle ne fabrique de rectangle. Un tracé manuel est désactivé si la géométrie de page n’est pas vérifiable. Le lecteur DOCX est une aide visuelle : seul le fichier final rouvert et la QA du serveur font foi. Les aperçus ne sont pas des téléchargements certifiés ; le téléchargement vérifie politique, révision, statut et assurance.

jsDelivr renvoie le template HTML du lecteur DOCX comme `text/plain`. Le client le récupère comme texte figé et le place en `srcdoc` dans l’iframe sandbox ; les scripts restent épinglés au même commit. Le chargement direct du `.html` dans un iframe n’est pas utilisé.

## Gate encore ouverte sur la vraie page

Après collage et publication **staging seulement**, vérifier sous session Agilotext réelle : DNS/CORS/auth de l’origine exacte, `READY`, `REVIEW_REQUIRED`, `FAILED`, PDF et DOCX original/résultat, `KEEP`, `MASK`, région liée, nouvelle révision, reprise après reload, téléchargement, erreurs réseau et révision périmée. Contrôler deux comptes de recette distincts, la console et l’onglet Network : aucun appel Anon2, aucun HMAC/secret de service. Capturer les vues à 1440, 768 et 390 px. Ces vérifications sont nécessaires avant `WEBFLOW_V2_STAGING_VISUAL_AND_E2E_PASSED`.
