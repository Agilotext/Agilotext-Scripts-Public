# AgiloShield V2 — remplacement Webflow staging

La page publiée `https://agilotext-test.webflow.io/app/business/dashboard/anonymiser` contient deux Embeds concernés : le principal avec `<form id="agfForm">` et un Embed scripts distinct chargeant Lottie et `agiloshield-embed-anonymisation-anon2-beta.js`. Remplacer tout le contenu du premier par `WEBFLOW_STAGING_COPY_PASTE.html` et vider/supprimer le second. Laisser les autres Embeds du dashboard inchangés, notamment celui de Claude Cowork.

Les quatre assets V2 et PDF.js sont épinglés à `c43b41357d26516785d46dae7cfebf1a6e623afe`. Le chargement jsDelivr de chacun a répondu `200`. Le contrat frontal cible `https://apitest.agilotext.com:9443/api/agiloshield-v2`; le préflight CORS avec l'origine Webflow exacte répond `204`. Sans session, `/preferences` répond `401`.

Le bloc exact a été chargé dans une page HTML locale équivalente avec transport synthétique. Vérifié visuellement et par interaction : 13 cases, préférences bloquantes, `[]` explicite et confirmé, `READY`, `REVIEW_REQUIRED`, `FAILED`, `KEEP`, aperçu PDF, région liée, nouvelle révision et téléchargement certifié contrôlant digest/révision/statut/assurance. Le contrat client Node passe. Aucun script Anon2 ni champ de token manuel n'est chargé par le nouveau bloc. PDF.js 3.11.174 est accompagné de sa notice Apache 2.0.

Ce test local ne prouve pas encore le parcours navigateur authentifié vers Java : le nom `apitest.agilotext.com` ne se résout pas sur le Mac de recette au moment du test. Le VPN atteint `172.18.47.146`, et la façade HTTPS répond avec `curl --resolve`. Après correction DNS, Florian doit coller le bloc dans Webflow staging, publier cette page seulement, puis refaire READY, REVIEW_REQUIRED, FAILED et région liée avec les fixtures synthétiques du kit privé sous sa propre session. Aucun document client n'est requis.

La façade Java exige des en-têtes portant le token **utilisateur** Agilotext. Le navigateur les transmet donc naturellement et son propriétaire peut les voir dans ses DevTools. Aucun HMAC Python, secret interservice, token admin ou token préinscrit n'est présent dans le bloc. Le mode anonyme échoue sans créer de job.
