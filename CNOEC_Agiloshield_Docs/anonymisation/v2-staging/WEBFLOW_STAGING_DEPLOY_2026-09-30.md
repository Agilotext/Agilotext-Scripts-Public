# Embed V2 staging — listes sobres et onglet Restauration

Le bloc intégral à coller dans **l'Embed principal Anonymiser** est `WEBFLOW_STAGING_COPY_PASTE.html`. Il épingle les assets au commit `de34063f85e029e3aea486ef4d29b9618a6a25a6` et garde `FILE_LISTS_READY: false`. Le bloc précédent proposé est conservé intégralement dans `WEBFLOW_STAGING_ROLLBACK_108cbb4e.html` ; il n'a pas été confirmé comme le bloc actuellement publié.

Le MCP Webflow situe cette page sous l'ID `6815bee5a9c0b57da1835580`. Son Embed principal est dans le composant `Anon_NEW_2026_GATED` (`cd349748-8e32-1395-ad94-d72dc9849d49`), élément `cd349748-8e32-1395-ad94-d72dc9849d56`. Modifier cette définition de composant peut affecter ses autres instances ; vérifier leurs pages avant publication.

La page Webflow staging publiée redirige cette session vers `/auth/access-denied`. La vérification authentifiée du rendu, des éventuels autres Embeds de cette page et une publication limitée au sous-domaine staging restent donc à faire avant d'annoncer la gate Webflow. Ne pas publier sur `www.agilotext.com` ni réutiliser un ancien Embed Anon2 dans le parcours V2.

Les deux fichiers HTML sont autonomes : remplacer le contenu entier de l'Embed principal par le nouveau bloc, publier uniquement `agilotext-test.webflow.io`, puis contrôler les trois onglets, les listes et un job synthétique authentifié. Si un second Embed charge encore `agiloshield-embed-anonymisation-anon2-beta.js` sur cette page, le retirer séparément après identification exacte. Le retour arrière consiste à remettre le bloc `WEBFLOW_STAGING_ROLLBACK_108cbb4e.html` dans ce même Embed et à republier uniquement staging.

La restauration reste une interface de préparation. Ses sélections ne déclenchent aucun appel Java ; l'action est désactivée. Le test local mock ne prouve pas une capacité de restitution backend.
