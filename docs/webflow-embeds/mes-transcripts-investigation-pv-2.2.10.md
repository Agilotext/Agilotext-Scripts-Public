# Mes transcripts — logic-v2 2.2.10-investigation-pv

**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.10-investigation-pv'`  
**Helper :** `scripts/pages/shared/format-investigation-pv.js` (chargé depuis le même `@SHA`)

Lien **PV d’enquête (Word)** si `promptid` 705–720 **et** statut `READY_SUMMARY_*` (y compris `READY_SUMMARY_ON_ERROR`).  
POST sidecar `formatInvestigationPv`. Le CR officiel (Relancer / Télécharger le compte rendu) reste Mistral.

v2.2.10 : même clone que l’éditeur (retirer `summary_*`, garder icône, CSS flex). Les sélecteurs `[class*="download_wrapper-link_summary_"]` **excluent** le lien investigation (sinon ON_ERROR cache le wrap). Menu ouvert : `z-index: 100`.

## Embed

**Pin staging 17/09 :** `@5682eb68` (agilotext-test). www reste `@3fad75c2` jusqu’à `OK publish`.

```html
<!-- Agilotext Mes transcripts logic-v2 2.2.10-investigation-pv @5682eb68 -->
<!-- ROLLBACK: remettre @3fad75c2 / ?v=fc-3fad75c2 -->
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@3fad75c2/scripts/shared/retention-messages.js?v=3fad75c2"></script>
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@5682eb68/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=fc-5682eb68"></script>
```

Le v2 injecte `format-investigation-pv.js` depuis le même commit.  
**Pas** `sites_publish` www sans `OK` Florian. Staging `agilotext-test` d’abord.

```js
window.__agiloMesTranscriptsLogicVersion
// attendu : '2.2.10-investigation-pv'
window.__agiloEditorHeader_v8
// éditeur : true
```

## Recette

1. Bauer, job 705 READY : ligne PV = même rangée que Format .docx (texte gauche, icône DOCX droite). Menu au-dessus de « passages à relire ». Clic : Word sidecar, onglet CR inchangé.
2. Même compte, modèle 787 : lien **absent**.
3. Magali, un job 713 READY : Word chrome, 0 `${CONTENT}`. Pas de Relancer. WAIT `OK` Florian.
4. `READY_SUMMARY_ON_ERROR` + 713/705 : lien wrap **visible** (pile téléchargements déverrouillée).
