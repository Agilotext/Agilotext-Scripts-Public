# Webflow — embeds inline critiques (page éditeur)

> Dernière extraction : juillet 2026 — page `app/business/editor` (jobId test `1000035111`)

Ces scripts vivent **uniquement dans Webflow** (balises `<script>` inline ou embeds). Ils ne sont pas versionnés dans Git et sont une source récurrente de bugs difficiles à tracer.

## Chaîne de déploiement (étape 0)

| Script | Chargement | URL CDN attendue |
|--------|------------|------------------|
| Fork confidence | Loader `editor-main-confidence.js` ou embed direct | `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/editor-main-confidence.js` |
| Fork confidence (fichier principal) | Via loader ou embed direct | `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` |
| Anonymiser v3 | Embed Webflow séparé (hors loader) | `https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js` |

**Vérification console en prod :**

```js
window.__agiloEditorConfidenceVersion  // attendu : '1.09.1'
window.__agiloAnonVersion              // attendu : '3.1.0'
```

**Important :** la page sauvegardée localement réécrit les URLs en chemins relatifs (`./Éditeur de transcripts _ Business_files/...`). Toujours confirmer le `src` exact dans Webflow Designer avant de pousser un fix sur `1.09`.

## Embeds inline recensés

| Nom / marqueur | Rôle | Taille approx. | Dans le repo ? |
|----------------|------|----------------|----------------|
| `ag-ux-plus-css` / « UX Transcript ++ » | Bouton « + », split intervenant, smart-paste timé, `buildSegDOM()` | ~30 Ko | Non |
| `__agiloTabsV` | Gestion onglets Transcription / Compte rendu / Assistant | ~9 Ko | Non |
| Barre d'édition inline | Toolbar transcript | ~28 Ko | Non |

**Recommandation :** rapatrier progressivement ces embeds dans le repo (`scripts/pages/editor/embeds/`) et les charger via jsDelivr `@1.09` pour bénéficier du diff, des tests et du rollback.

---

## Patch UX Transcript ++ — bouton corbeille (optionnel)

Le filet de sécurité dans `Code-main-editor-IFRAME_V04-confidence.js` (`ensureSegButtons`) corrige déjà le bug en prod sans toucher Webflow. Ce patch corrige la **source** du problème.

Dans la fonction `buildSegDOM()` de l'embed inline, **après** la création du bouton rename (`rn`) et **avant** `header.appendChild(btn)` :

```javascript
// AJOUT : dataset.id pour cohérence avec renderSegments()
art.dataset.id = art.dataset.id || `s${Date.now()}`;

// ... code existant (btn time, sp speaker, rn rename) ...

// AJOUT : bouton supprimer (même markup que buildDeleteBtn du fork confidence)
const delBtn = document.createElement('button');
delBtn.type = 'button';
delBtn.setAttribute('aria-label', 'Supprimer ce segment (annulable 4 s)');
delBtn.setAttribute('aria-keyshortcuts', 'Control+Shift+Backspace');
delBtn.className = 'delete-seg-btn absolute';
delBtn.dataset.action = 'delete-seg';
delBtn.title = 'Supprimer ce segment — annulable pendant 4 s\nRaccourci : Ctrl+Maj+Retour Arrière';
delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>';

header.appendChild(btn);
header.appendChild(sp);
header.appendChild(rn);
header.appendChild(delBtn);  // AJOUT
```

État actuel de `buildSegDOM()` (extrait prod, juin 2026) — **sans** le bouton delete :

```javascript
function buildSegDOM({start = null, end = null, speaker = '', text = ''}) {
  const art = document.createElement('article');
  art.className = 'ag-seg';
  // ... time, speaker, rename ...
  header.appendChild(btn);
  header.appendChild(sp);
  header.appendChild(rn);
  // MANQUE : delete-seg-btn
  art.appendChild(header);
  // ... body ...
  return art;
}
```

---

## Diagnostic — barre d'onglets qui disparaît (bug intermittent)

Lancer dans la console **avant** de reproduire le bug. Le script observe les onglets et logge toute modification suspecte.

```javascript
(function agiloDiagTabs() {
  if (window.__agiloDiagTabsStop) {
    window.__agiloDiagTabsStop();
    console.info('[AGILO:DIAG:TABS] Observateur arrêté.');
    return;
  }

  const tabBar =
    document.querySelector('[role="tablist"]')
    || document.querySelector('.ed-tabs')
    || document.querySelector('.editor-tabs');

  const tabs = tabBar
    ? Array.from(tabBar.querySelectorAll('[role="tab"], .ed-tab'))
    : Array.from(document.querySelectorAll('[role="tab"]'));

  if (!tabs.length) {
    console.warn('[AGILO:DIAG:TABS] Aucun onglet trouvé. Sélecteurs à ajuster.');
    return;
  }

  const log = (kind, target, detail) => {
    console.group(`[AGILO:DIAG:TABS] ${kind}`);
    console.log('target:', target);
    console.log('detail:', detail);
    console.trace('stack');
    console.groupEnd();
  };

  const observers = [];

  const observeNode = (node, label) => {
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes') {
          const hidden =
            node.hasAttribute('hidden')
            || node.style.display === 'none'
            || node.style.visibility === 'hidden'
            || node.getAttribute('aria-hidden') === 'true';
          if (hidden || m.attributeName === 'class' || m.attributeName === 'style') {
            log('attribute', node, {
              label,
              attr: m.attributeName,
              hidden,
              className: node.className,
              style: node.getAttribute('style')
            });
          }
        }
        if (m.type === 'childList' && (m.removedNodes.length || m.addedNodes.length)) {
          log('childList', node, {
            label,
            removed: m.removedNodes.length,
            added: m.addedNodes.length
          });
        }
      }
    });
    obs.observe(node, {
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-selected'],
      childList: true,
      subtree: false
    });
    observers.push(obs);
  };

  if (tabBar) observeNode(tabBar, 'tabBar');
  tabs.forEach((tab, i) => observeNode(tab, `tab#${i}`));

  window.__agiloDiagTabsStop = () => observers.forEach((o) => o.disconnect());

  console.info('[AGILO:DIAG:TABS] Observateur actif sur', tabs.length, 'onglet(s). Relancez agiloDiagTabs() pour arrêter.');
})();
```

**Interprétation :**

- `childList` + `removed` sur `tabBar` → un script retire la barre du DOM (paste HTML riche, bug JS).
- `attribute` + `hidden` / `display:none` sur un onglet seul → comportement normal du script `__agiloTabsV`.
- Aucun log mais barre hors écran → scroll (barre non sticky) ; pas un bug de disparition.

---

## Diagnostic — « Passages à relire » masque Transcription / Compte rendu / Assistant

### Cause confirmée (août 2026, fix `1.09.3`)

Ce n'est **pas** l'iframe du compte rendu qui est en cause. Le toggle « Passages à relire » n'est pas le déclencheur principal.

Le bouton **« Passage suivant »** (et `Alt+Flèche droite`) appelait `art.scrollIntoView({ block: 'center' })`. Le navigateur scrollait tous les ancêtres, y compris `.ed-body` en `overflow:hidden`. Les onglets `nav.ed-tabs` sortaient du cadre découpé sans barre de défilement pour revenir en arrière : reload obligatoire.

Preuve par contraste : la recherche dans l'éditeur utilise `agiloScrollIntoView(el, { allowWindow: false })`, qui ne scrolle que le conteneur réellement scrollable.

Le correctif 1.09.2 (recouvrement panneau flottant `top:10px`) était une piste secondaire valide mais ne couvrait pas ce scénario.

### Correctif versionné

| Fichier | Changement |
|---------|------------|
| `confidence-v1/agilo-confidence.js` | `scrollSegmentIntoView()` borné ; `startEditorShellScrollGuard()` ; restauration ancêtres ; `ensureTranscriptPaneActive()` |
| `confidence-v1/agilo-confidence.css.js` | z-index chrome 40 sans sticky (1.09.4) ; `scroll-margin-block` sur `.ag-seg` |
| `confidence-v1/Code-main-editor-IFRAME_V04-confidence.js` | `scrollIntoView` exposé sur `window.AgiloEditors` ; version `1.09.3` |

Version attendue : `window.__agiloEditorConfidenceVersion === '1.09.4'`

### Script console dédié

Coller le contenu de :

`scripts/pages/editor/confidence-v1/DIAGNOSTIC_PASSAGES_A_RELIRE.js`

Puis cliquer « Passage suivant ». Interprétation :

- `edBodyScrollTop > 0` → scrollIntoView non borné (régression si version < 1.09.3 (scroll) ou menus téléchargement masqués si sticky 1.09.3)
- `overlapTabs=true` + `floating=true` → recouvrement flottant (piste secondaire)
- `activePanes=0` → perte de `.is-active` (filet CSS `chat-embed-styles.css`)
- `beforeLoadCount` augmente → rechargement job involontaire
- `iframeFailed=true` → échec d'isolation CR (hors toggle)

Snippet rapide :

```js
window.__agiloProbe = () => [
  ...document.querySelectorAll('.ed-body, .ed-main, .edtr-pane'),
  document.scrollingElement
].map(e => ({
  el: e === document.scrollingElement ? 'document' : (e.id || e.className),
  scrollTop: e.scrollTop,
  overflowY: getComputedStyle(e).overflowY
}));
```



### Correctif 1.09.4 — menus téléchargement

Le sticky + fond blanc sur `nav.ed-tabs` masquait les dropdowns `.wrapper-message-pro.download`. Retiré. Filet : garde JS `startEditorShellScrollGuard()` sur scroll capture, remet à 0 uniquement `.ed-body` / `.ed-main` en `overflow:hidden`.

Checklist : ouvrir « Télécharger transcription » et « Télécharger compte rendu », menus entiers visibles.

### Piste iframe (historique, hors toggle)

L’iframe summary a bien corrigé l’ancienne fuite CSS des templates CR riches (bug Chromium de barre d’onglets). Elle n’est pas appelée par « Passages à relire ». Le fallback `el.innerHTML = html` a été retiré en `1.09.2` pour éviter toute régression CR.

---

## Purge jsDelivr après déploiement

```
https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.js

https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/agilo-confidence.js

https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/scripts/pages/editor/confidence-v1/agilo-confidence.css.js

https://purge.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@1.09/CNOEC_Agiloshield_Docs/Front_END/agilo-editor-anonymiser-transcript-v3.js
```

Vérifier ensuite en console : `window.__agiloEditorConfidenceVersion` (`1.09.4`) et `window.__agiloAnonVersion`.
