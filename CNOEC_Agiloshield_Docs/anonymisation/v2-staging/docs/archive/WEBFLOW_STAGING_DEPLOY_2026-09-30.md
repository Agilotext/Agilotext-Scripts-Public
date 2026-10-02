# Embed V2 staging — listes sobres et onglet Restauration

Le bloc intégral à coller dans **l'Embed principal Anonymiser** est `WEBFLOW_STAGING_COPY_PASTE.html`. Il épingle les assets au commit `de34063f85e029e3aea486ef4d29b9618a6a25a6` et garde `FILE_LISTS_READY: false`. Le bloc précédent est conservé intégralement dans `WEBFLOW_STAGING_ROLLBACK_108cbb4e.html`. La page authentifiée publiée charge effectivement les assets `108cbb4e13a00d146222e80026a4577db5bd6847` ; ce rollback correspond donc au pin actuel observé.

Le MCP Webflow situe cette page sous l'ID `6815bee5a9c0b57da1835580`. Son Embed principal est dans le composant `Anon_NEW_2026_GATED` (`cd349748-8e32-1395-ad94-d72dc9849d49`), élément `cd349748-8e32-1395-ad94-d72dc9849d56`. Modifier cette définition de composant peut affecter ses autres instances ; vérifier leurs pages avant publication.

Après connexion de Florian, la page Webflow staging publiée est accessible. Son rendu montre encore deux onglets et l'ancien bouton « Règles particulières » ; les trois onglets de la nouvelle candidate ne sont pas publiés. Le DOM publié ne charge aucun script Anon2 direct. Le connecteur Webflow identifie l'Embed, mais ne donne pas accès à son code interne pour le remplacer ; le Designer Webflow n'est pas connecté dans le navigateur intégré. La nouvelle version a été vérifiée localement, pas publiée dans Webflow. Ne pas publier sur `www.agilotext.com`.

Les deux fichiers HTML sont autonomes : remplacer le contenu entier de l'Embed principal par le nouveau bloc, publier uniquement `agilotext-test.webflow.io`, puis contrôler les trois onglets, les listes et un job synthétique authentifié. Si un second Embed charge encore `agiloshield-embed-anonymisation-anon2-beta.js` sur cette page, le retirer séparément après identification exacte. Le retour arrière consiste à remettre le bloc `WEBFLOW_STAGING_ROLLBACK_108cbb4e.html` dans ce même Embed et à republier uniquement staging.

La restauration reste une interface de préparation. Ses sélections ne déclenchent aucun appel Java ; l'action est désactivée. Le test local mock ne prouve pas une capacité de restitution backend.
