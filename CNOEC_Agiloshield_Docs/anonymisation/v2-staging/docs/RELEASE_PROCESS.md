# Release AgiloShield V2

1. Branche courte `asv2/<tranche>` depuis `release/agiloshield-v2`. Un commit par famille de changement.
2. PR vers `release/agiloshield-v2`. CI `agiloshield-v2-targeted-fixes.yml` verte.
3. Captures : `node tests/screens.mjs` (galerie 1312 et 390 px, axe). Diff joint à la PR.
4. Merge, puis `tests/verify-cdn-pin.sh <SHA>` : Git = raw GitHub = jsDelivr, `node --check` du fichier téléchargé.
5. Pin `<SHA>` dans `WEBFLOW_STAGING_COPY_PASTE.html`, commit `release(v2): pin …`.
6. Webflow : `user-webflow-hosted` `data_element_settings_tool` `set_settings` clé `code`, puis `sites_publish` avec `publishToWebflowSubdomain: true`, `customDomains: []`.
7. Smoke connecté bureau + mobile, console sans erreur AgiloShield, un seul moteur chargé.
8. `WEBFLOW_ROLLBACK.html` pointe sur le pin précédent.

Live (www) : uniquement après « OK publish www AgiloShield V2 » de Florian, page par page. Voir `GO_LIVE_CHECKLIST.md`.

Interdits : publier www sans OK, coller du JS via MCP, merger `archive/asv2/product-ui-20261002` en bloc, toucher `Code-Anon-Skill`.
