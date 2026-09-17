# Mes transcripts — logic-v2 2.2.9-investigation-pv

**Fichier :** `scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js`  
**Version JS :** `__agiloMesTranscriptsLogicVersion === '2.2.9-investigation-pv'`  
**Helper :** `scripts/pages/shared/format-investigation-pv.js` (chargé depuis le même `@SHA`)

Lien **PV d’enquête (Word)** si `promptid` 705–720 **et** statut `READY_SUMMARY_*` (y compris `READY_SUMMARY_ON_ERROR`).  
POST sidecar `formatInvestigationPv`. Le CR officiel (Relancer / Télécharger le compte rendu) reste Mistral.

## Embed

Après push, pin **les deux** `src` sur le même SHA (helper chargé en sibling par le v2) :

```html
<script src="https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@SHA/scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js?v=SHA"></script>
```

Le v2 injecte `format-investigation-pv.js` depuis le même commit.  
**Pas** `sites_publish` www sans `OK` Florian. Staging `agilotext-test` d’abord.

```js
window.__agiloMesTranscriptsLogicVersion
// attendu : '2.2.9-investigation-pv'
window.__agiloEditorHeader_v7
// éditeur : true
```

## Recette

1. Bauer, job 705 READY : lien présent, Word gold, onglet CR inchangé.
2. Même compte, modèle 787 : lien **absent**.
3. Magali, un job 713 READY : Word chrome, 0 `${CONTENT}`. Pas de Relancer.
4. `READY_SUMMARY_ON_ERROR` + 713/705 : lien wrap **visible** (pile téléchargements déverrouillée).
