/**
 * Agilotext Prompt Studio — maquette live (overlay injectable).
 * Liste + load + Enregistrer / Enregistrer sous + pin + versions (probe) + Essayer (redo).
 * Ne pas toucher agilo-prompt-studio.js. token-resolver reste @820f11f.
 */
(function () {
  "use strict";

  var OVERLAY_HTML = "<div class=\"agilo-ps-overlay\" id=\"studio-overlay\">\n  <div class=\"agilo-ps-panel agilo-ps-panel--mobile-list agilo-ps-panel--tab-prompt agilo-ps-left-prompt\" id=\"studio-panel\" role=\"dialog\" aria-labelledby=\"ps-title\" aria-modal=\"true\">\n    <div class=\"agilo-ps-header\">\n      <div class=\"agilo-ps-header-text\">\n        <h1 class=\"agilo-ps-title\" id=\"ps-title\">Modèles de comptes rendus</h1>\n      </div>\n      <div class=\"agilo-ps-header-actions\">\n        <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-help\" aria-label=\"Aide\" title=\"Aide\" aria-expanded=\"false\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"9\" r=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><path d=\"M6.925,6.619c.388-1.057,1.294-1.492,2.18-1.492,.895,0,1.818,.638,1.818,1.808,0,1.784-1.816,1.468-2.096,3.065\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><path d=\"M8.791,13.567c-.552,0-1-.449-1-1s.448-1,1-1,1,.449,1,1-.448,1-1,1Z\" fill=\"currentColor\"/></svg></span></button>\n        <div class=\"agilo-ps-help-pop\" id=\"help-pop\">\n          <p><strong>Enregistrer sous</strong> crée une copie (texte + HTML). L’original reste intact.</p>\n          <p><strong>⌘S</strong> ou <strong>Ctrl+S</strong> fait la même chose que le bouton en bas. Pas de sauvegarde toute seule.</p>\n          <p><strong>Historique</strong> : 3 sauvegardes de ce modèle. Ce n’est pas Cmd+Z, et les copies V2 sont dans la liste.</p>\n          <p><strong>Essayer</strong> remplace le compte rendu officiel du dossier choisi.</p>\n        </div>\n        <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-close-studio\" aria-label=\"Fermer\" title=\"Fermer\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><line x1=\"14\" y1=\"4\" x2=\"4\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"4\" y1=\"4\" x2=\"14\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n      </div>\n    </div>\n     <div class=\"agilo-ps-body\">\n      <aside class=\"agilo-ps-listcol\">\n        <h2 class=\"agilo-ps-subtitle\">Vos modèles</h2>\n        <div class=\"agilo-ps-search-wrap\">\n          <span class=\"agilo-ps-ico\" aria-hidden=\"true\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"M15.75 15.75L11.6386 11.6386\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 4.7125 10.7875 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25Z\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/></svg></span>\n          <input class=\"agilo-ps-search\" id=\"search\" type=\"search\" placeholder=\"Rechercher…\" />\n        </div>\n        <div class=\"agilo-ps-list\" id=\"list\"></div>\n      </aside>\n      <section class=\"agilo-ps-main\" id=\"main\">\n        <div class=\"agilo-ps-skeleton\" aria-hidden=\"true\">\n          <div class=\"agilo-ps-skel-line\" style=\"width:40%\"></div>\n          <div class=\"agilo-ps-skel-line\" style=\"width:70%\"></div>\n          <div class=\"agilo-ps-skel-line agilo-ps-skel-line--lg\"></div>\n        </div>\n        <div class=\"agilo-ps-main-live\">\n          <div class=\"agilo-ps-main-scroll\">\n            <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--ghost agilo-ps-back-list\" id=\"btn-back-list\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><line x1=\"2.75\" y1=\"9\" x2=\"15.25\" y2=\"9\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><polyline points=\"7 13.25 2.75 9 7 4.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span> Modèles</button>\n            <div class=\"agilo-ps-toolbar\">\n              <h3 class=\"agilo-ps-detail-title\" id=\"detail-title\"></h3>\n              <span id=\"detail-badge\" class=\"agilo-ps-badge agilo-ps-badge--orig\">Original</span>\n              <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--ghost agilo-ps-pin-btn\" id=\"btn-pin\">Épingler</button>\n              <p class=\"agilo-ps-meta\" id=\"detail-meta\"></p>\n              <p class=\"agilo-ps-orig-hint\" id=\"orig-hint\" hidden>Pour ne pas écraser l’original, Enregistrer sous crée une copie.</p>\n            </div>\n            <div class=\"agilo-ps-dirty-banner\" id=\"dirty-banner\" hidden></div>\n            <span id=\"char-count\" hidden></span>\n            <div class=\"agilo-ps-tabs agilo-ps-work-tabs\" role=\"tablist\">\n              <button type=\"button\" class=\"agilo-ps-tab agilo-ps-tab--active\" data-work=\"prompt\">Prompt</button>\n              <button type=\"button\" class=\"agilo-ps-tab\" data-work=\"layout\">Mise en page <span class=\"agilo-ps-pill\" id=\"pill-m\" hidden></span></button>\n              <button type=\"button\" class=\"agilo-ps-tab\" data-work=\"result\">Résultat</button>\n            </div>\n            <div class=\"agilo-ps-main-split\">\n              <div class=\"agilo-ps-prompt-col\">\n                <div class=\"agilo-ps-tabs agilo-ps-left-tabs\">\n                  <button type=\"button\" class=\"agilo-ps-tab agilo-ps-tab--active\" data-left=\"prompt\">Prompt</button>\n                  <button type=\"button\" class=\"agilo-ps-tab\" data-left=\"layout\">Mise en page <span class=\"agilo-ps-pill\" id=\"pill-d\" hidden></span></button>\n                </div>\n                <div class=\"agilo-ps-prompt-panel\">\n                  <div class=\"agilo-ps-editor-mount\"><textarea class=\"agilo-ps-native-editor\" id=\"editor\"></textarea></div>\n                </div>\n                <div class=\"agilo-ps-layout-panel\">\n                  <div class=\"agilo-ps-layout-toolbar\">\n                    <div class=\"agilo-ps-tabs\" style=\"margin:0\">\n                      <button type=\"button\" class=\"agilo-ps-tab agilo-ps-tab--active\" id=\"btn-view-preview\">Aperçu</button>\n                      <button type=\"button\" class=\"agilo-ps-tab\" id=\"btn-view-source\">Source</button>\n                    </div>\n                    <label class=\"agilo-ps-btn agilo-ps-btn--secondary\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"M6.75 10.5L9 8.25L11.25 10.5\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M9 8.25V14.25\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><path d=\"M12 14.25H12.5C14.571 14.25 16.25 12.571 16.25 10.5C16.25 8.7639 15.065 7.31791 13.464 6.89111C13.278 4.57711 11.362 2.75 9 2.75C6.515 2.75 4.5 4.7651 4.5 7.25C4.5 7.6001 4.54899 7.93598 4.62399 8.26288C3.02699 8.32998 1.75 9.6369 1.75 11.25C1.75 12.907 3.093 14.25 4.75 14.25H6\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/></svg></span> Importer .html\n                      <input class=\"agilo-ps-file-input\" id=\"html-import\" type=\"file\" accept=\".html,.htm,text/html\" />\n                    </label>\n                  </div>\n                  <div class=\"agilo-ps-layout-preview\" id=\"layout-preview\">\n                    <p class=\"agilo-ps-layout-label\">Mise en page vide (placeholders)</p>\n                    <iframe class=\"agilo-ps-preview-frame\" id=\"iframe-layout\" title=\"Aperçu du template HTML\" sandbox=\"allow-same-origin\"></iframe>\n                  </div>\n                  <div class=\"agilo-ps-layout-source\" id=\"layout-source\" hidden>\n                    <div class=\"agilo-ps-editor-mount\"><textarea class=\"agilo-ps-native-editor\" id=\"editor-html\"></textarea></div>\n                  </div>\n                  <details class=\"agilo-ps-meta-box\" id=\"layout-meta-wrap\">\n                    <summary>Champs et cohérence</summary>\n                    <div class=\"agilo-ps-meta-inner\" id=\"layout-meta\"></div>\n                  </details>\n                </div>\n              </div>\n              <div class=\"agilo-ps-result-col\">\n                <div class=\"agilo-ps-result-head\">\n                  <label for=\"job\">Dossier</label>\n                  <select id=\"job\"></select>\n                  <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"btn-try\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"M5.245,2.878l9.492,5.256c.685,.379,.685,1.353,0,1.732L5.245,15.122c-.669,.371-1.495-.108-1.495-.866V3.744c0-.758,.825-1.237,1.495-.866Z\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span> Essayer</button>\n                  <a class=\"agilo-ps-editor-link\" id=\"link-editor\" href=\"#\">Ouvrir dans l’éditeur</a>\n                  <span class=\"agilo-ps-credits\" id=\"credits-label\">Essais restants : 4</span>\n                </div>\n                <div class=\"agilo-ps-trial-cols\">\n                  <div class=\"agilo-ps-trial-col\">\n                    <div class=\"agilo-ps-trial-col-head\">\n                      <h4>CR actuel du dossier</h4>\n                      <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-expand-before\" aria-label=\"Agrandir le CR actuel\" title=\"Agrandir\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><polyline points=\"11.25 2.75 15.25 2.75 15.25 6.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><polyline points=\"6.75 15.25 2.75 15.25 2.75 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"15\" y1=\"3\" x2=\"10.75\" y2=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/><line x1=\"3\" y1=\"15\" x2=\"7.25\" y2=\"10.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n                    </div>\n                    <div class=\"agilo-ps-trial-body\" id=\"cr-before\"></div>\n                  </div>\n                  <div class=\"agilo-ps-trial-col\">\n                    <div class=\"agilo-ps-trial-col-head\">\n                      <h4>Après relance (CR officiel)</h4>\n                      <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-expand-after\" aria-label=\"Agrandir le CR après\" title=\"Agrandir\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><polyline points=\"11.25 2.75 15.25 2.75 15.25 6.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><polyline points=\"6.75 15.25 2.75 15.25 2.75 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"15\" y1=\"3\" x2=\"10.75\" y2=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/><line x1=\"3\" y1=\"15\" x2=\"7.25\" y2=\"10.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n                    </div>\n                    <div class=\"agilo-ps-trial-body\" id=\"cr-after\"><p class=\"agilo-ps-cr-empty\">Pas encore d’essai. Relancer remplace le CR officiel de ce dossier.</p></div>\n                  </div>\n                </div>\n              </div>\n            </div>\n          </div>\n          <div class=\"agilo-ps-main-footer\">\n            <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"btn-save-primary\"><span class=\"agilo-ps-save-label\">Enregistrer sous</span><kbd class=\"agilo-ps-kbd\" id=\"save-kbd\"></kbd></button>\n            <button type=\"button\" class=\"agilo-ps-btn\" id=\"btn-history\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"9\" r=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><polyline points=\"9 4.75 9 9 12.25 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg></span> Historique</button>\n          </div>\n        </div>\n      </section>\n    </div>\n     <div class=\"agilo-ps-menu agilo-ps-row-menu\" id=\"row-menu\" role=\"menu\"></div>\n    <div class=\"agilo-ps-drawer-back\" id=\"drawer-back\"></div>\n    <aside class=\"agilo-ps-drawer\" id=\"versions-drawer\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"drawer-title\">\n      <div class=\"agilo-ps-drawer-head\">\n        <div style=\"flex:1;min-width:0\">\n          <h3 id=\"drawer-title\" tabindex=\"-1\">Historique</h3>\n          <p id=\"drawer-sub\">3 dernières sauvegardes de <strong>ce</strong> modèle. Les copies V2 sont dans la liste à gauche.</p>\n        </div>\n        <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"drawer-close\" aria-label=\"Fermer l’historique\" title=\"Fermer\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><line x1=\"14\" y1=\"4\" x2=\"4\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"4\" y1=\"4\" x2=\"14\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n      </div>\n      <div class=\"agilo-ps-drawer-body\" id=\"versions-list\"></div>\n    </aside>\n  </div>\n</div>\n <div class=\"agilo-ps-dialog-back\" id=\"dialog-saveas\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"saveas-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"saveas-title\">Enregistrer sous</h4>\n    <p>Une copie complète est créée (texte + HTML). L’original n’est pas modifié.</p>\n    <label for=\"saveas-name\">Nom de la copie</label>\n    <input id=\"saveas-name\" type=\"text\" maxlength=\"120\" />\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"saveas-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"saveas-ok\">Créer la copie</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-dialog-back\" id=\"dialog-rename\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"rename-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"rename-title\">Renommer</h4>\n    <p>Le nom apparaît dans la liste à gauche.</p>\n    <label for=\"rename-name\">Nouveau nom</label>\n    <input id=\"rename-name\" type=\"text\" maxlength=\"120\" />\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"rename-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"rename-ok\">Renommer</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-dialog-back\" id=\"dialog-leave\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"leave-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"leave-title\">Enregistrer les modifications ?</h4>\n    <p id=\"leave-body\">Des changements ne sont pas enregistrés.</p>\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"leave-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"leave-discard\">Ignorer</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"leave-save\">Enregistrer</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-dialog-back\" id=\"dialog-redo\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"redo-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"redo-title\">Remplacer le compte rendu de ce dossier ?</h4>\n    <p id=\"redo-body\">Le CR officiel sera régénéré avec le modèle sauvé. La transcription ne change pas. 1 crédit.</p>\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"redo-dl\">Télécharger le CR actuel</button>\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"redo-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"redo-ok\">Remplacer le CR</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-expand-back\" id=\"expand-back\">\n  <div class=\"agilo-ps-expand-bar\">\n    <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--secondary\" id=\"expand-close\">Fermer</button>\n  </div>\n  <iframe class=\"agilo-ps-expand-frame\" id=\"expand-frame\" title=\"Compte rendu agrandi\" sandbox=\"allow-same-origin\"></iframe>\n</div>\n<div class=\"agilo-ps-toast\" id=\"toast\"><span id=\"toast-msg\"></span></div>\n\n";
  var PIN_MAX = 5;
  var LS_LAST = "agilo:ps:lastPromptId";
  var LS_RECENT = "agilo:ps:recentPromptIds";

  var ICO = {
    floppy: "<span class='agilo-ps-ico'><svg viewBox='0 0 18 18' width='16' height='16' aria-hidden='true'><path d='M10.75 2.25v3c0 .552-.448 1-1 1h-3.5c-.552 0-1-.448-1-1V2.25' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/><path d='M5.25 15.75v-5c0-.552.448-1 1-1h5.5c.552 0 1 .448 1 1v5' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/><path d='M13.59 15.75H4.41c-1.193 0-2.16-.967-2.16-2.16V4.41c0-1.193.967-2.16 2.16-2.16h7.426c.265 0 .52.105.707.293l2.914 2.914c.188.188.293.442.293.707v7.426c0 1.193-.967 2.16-2.16 2.16Z' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/></svg></span>",
    pencil: "<span class='agilo-ps-ico'><svg viewBox='0 0 18 18' width='16' height='16' aria-hidden='true'><path d='M13.953 7.578L15.062 6.469c.586-.586.586-1.536 0-2.121L13.653 2.939c-.586-.586-1.536-.586-2.121 0L10.423 4.048l3.53 3.53Z' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/><path d='M8.654 5.815L4.147 10.322c-.25.25-.429.562-.52.904L2.5 15.499l4.273-1.127c.342-.09.654-.27.904-.52l4.507-4.508' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/><path d='M10.404 7.565L6.265 11.704' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg></span>",
    pin: "<span class='agilo-ps-ico'><svg viewBox='0 0 18 18' width='16' height='16' aria-hidden='true'><line x1='9' y1='16.25' x2='9' y2='12.25' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/><path d='M14.25,12.25c-.089-.699-.318-1.76-.969-2.875-.335-.574-.703-1.028-1.031-1.375V3.75c0-1.105-.895-2-2-2h-2.5c-1.105,0-2,.895-2,2v4.25c-.329,.347-.697,.801-1.031,1.375-.65,1.115-.88,2.176-.969,2.875H14.25Z' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/></svg></span>",
    trash: "<span class='agilo-ps-ico'><svg viewBox='0 0 18 18' width='16' height='16' aria-hidden='true'><path d='M13.698 7.75L13.35 14.35C13.294 15.42 12.416 16.25 11.353 16.25H6.648C5.584 16.25 4.707 15.42 4.651 14.35L4.303 7.75' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M2.75 4.75H15.25' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M6.75 4.75V2.75C6.75 2.2 7.198 1.75 7.75 1.75H10.25C10.802 1.75 11.25 2.2 11.25 2.75V4.75' fill='none' stroke='currentColor' stroke-width='1.5'/></svg></span>",
    download: "<span class='agilo-ps-ico'><svg viewBox='0 0 18 18' width='16' height='16' aria-hidden='true'><path d='M12 6.25H12.335C13.3 6.25 14.127 6.939 14.302 7.888L15.315 13.388C15.541 14.617 14.598 15.75 13.348 15.75H4.652C3.402 15.75 2.459 14.617 2.685 13.388L3.698 7.888C3.873 6.939 4.7 6.25 5.665 6.25H6' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M12 9.5L9 12.5L6 9.5' fill='none' stroke='currentColor' stroke-width='1.5'/><path d='M9 12.5V1.25' fill='none' stroke='currentColor' stroke-width='1.5'/></svg></span>"
  };

  var PLACEHOLDER_RE = /\$\{[^}]+\}/g;
  var TAG_TO_FILL_RE = /"tag-to-fill"\s*:\s*"\$\{([^}]+)\}"/g;
  var TAG_TO_FILL_SINGLE_RE = /"tag-to-fill"\s*:\s*'\$\{([^}]+)\}'/g;
  var LEGACY_PLACEHOLDER = "${CONTENT}";

  function extractPlaceholdersFromHtml(html) {
    var set = new Set();
    var re = new RegExp(PLACEHOLDER_RE.source, "g");
    var m;
    while ((m = re.exec(html || "")) !== null) set.add(m[0]);
    return Array.from(set).sort();
  }
  function extractTagToFillsFromPrompt(prompt) {
    var set = new Set();
    var m;
    var r1 = new RegExp(TAG_TO_FILL_RE.source, "g");
    while ((m = r1.exec(prompt || "")) !== null) set.add("${" + m[1] + "}");
    var r2 = new RegExp(TAG_TO_FILL_SINGLE_RE.source, "g");
    while ((m = r2.exec(prompt || "")) !== null) set.add("${" + m[1] + "}");
    return Array.from(set).sort();
  }
  function placeholdersOnlyInHtml(html, prompt) {
    var inPrompt = new Set(extractTagToFillsFromPrompt(prompt));
    return extractPlaceholdersFromHtml(html).filter(function (p) { return !inPrompt.has(p); });
  }
  function tagToFillsMissingInHtml(html, prompt) {
    var inHtml = new Set(extractPlaceholdersFromHtml(html));
    return extractTagToFillsFromPrompt(prompt).filter(function (p) { return !inHtml.has(p); });
  }
  function classifyPlaceholders(html) {
    var all = extractPlaceholdersFromHtml(html);
    var filled = all.filter(function (p) { return p.endsWith("-filled}"); });
    var legacy = all.filter(function (p) { return p === LEGACY_PLACEHOLDER; });
    var invalid = all.filter(function (p) { return !p.endsWith("-filled}") && p !== LEGACY_PLACEHOLDER; });
    return { filled: filled, legacy: legacy, invalid: invalid };
  }
  function downloadTextFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function buildCombinedExport(modelName, promptText, html) {
    var sep = "\n\n" + "=".repeat(72) + "\n\n";
    return "Modèle : " + modelName + "\nExport Agilotext - studio prompts (sans audio)\nDate : " +
      new Date().toISOString() + "\n" + sep + "PROMPT (texte)\n" + sep + promptText + "\n" + sep + "TEMPLATE HTML\n" + sep + html + "\n";
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fileSlug(name) {
    return (name || "modele").replace(/[^\w\-]+/g, "_").slice(0, 60);
  }
  function shortcutLabel() {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    return /Mac|iPhone|iPad/i.test(plat) ? "⌘S" : "Ctrl+S";
  }
  function formatWhen(iso) {
    if (!iso) return "récemment";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  }
  function suggestName(base) {
    var root = (base || "Copie").trim();
    var n = 2;
    var candidate = root + " V" + n;
    var names = (window.__AGILO_ATELIER_NAMES__ || []);
    while (names.indexOf(candidate) !== -1) {
      n += 1;
      candidate = root + " V" + n;
    }
    return candidate;
  }
  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
  function parseJsonSafe(text) {
    try { return JSON.parse(text); } catch (_e) { return null; }
  }
  function extractPromptTextFromContentResponse(res) {
    if (typeof res === "string") return res;
    if (res && typeof res === "object") {
      var keys = ["promptModelContent", "promptContent", "content", "text", "result", "promptText", "prompt"];
      for (var i = 0; i < keys.length; i++) {
        var c = res[keys[i]];
        if (typeof c === "string") return c;
      }
    }
    return typeof res === "object" ? JSON.stringify(res) : String(res || "");
  }
  function extractPromptList(payload) {
    var candidates = [
      payload.promptModeInfoDTOList,
      payload.promptModelList,
      payload.promptModelsUserInfoDtos,
      payload.promptModelsUserInfo,
      payload.promptModelsStandardInfoDtos
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (Array.isArray(candidates[i])) return candidates[i];
    }
    return [];
  }
  function normalizeTemplateResponse(data) {
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      var t = data.template || data.html || data.content || data.body;
      if (typeof t === "string") return t;
    }
    return typeof data === "object" ? JSON.stringify(data) : String(data || "");
  }
  function humanizeTemplateKoMessage(errorMessage) {
    var raw = String(errorMessage || "").trim();
    if (!raw) {
      return "Le serveur n’a pas pu charger la mise en page HTML. Réessayez dans un instant ou contactez le support si cela continue.";
    }
    var norm = raw.toLowerCase().replace(/\s+/g, "_");
    if (norm.indexOf("error_no_template") !== -1 || norm === "error_no_template_for_prompt_id") {
      return "Aucune mise en page HTML n’est associée à ce modèle pour l’instant. Vous pouvez continuer à modifier le prompt.";
    }
    if (norm.indexOf("not_found") !== -1 || norm.indexOf("introuvable") !== -1) {
      return "Le template HTML demandé est introuvable côté serveur.";
    }
    if (norm.indexOf("forbidden") !== -1 || norm.indexOf("unauthorized") !== -1) {
      return "Vous n’avez pas les droits nécessaires pour récupérer ce template HTML.";
    }
    if (/^error_[a-z0-9_]+$/i.test(raw.split(/\s/)[0] || "")) {
      return "Le serveur n’a pas pu fournir le template HTML. Réessayez plus tard.";
    }
    return raw;
  }
  function extractPromptId(res) {
    if (!res || typeof res !== "object") return "";
    var id = res.promptId != null ? res.promptId : res.promptModelId;
    return id == null ? "" : String(id).trim();
  }
  function isCatalogueModel(m) {
    if (!m) return false;
    if (m.origin === "standard") return true;
    var n = Number(m.id);
    return Number.isFinite(n) && n < 100;
  }
  function isDraftModel(m) {
    return !isCatalogueModel(m);
  }
  function isJobReadyStatus(status) {
    var s = String(status || "").toUpperCase();
    return s === "READY" || s === "READY_SUMMARY_READY" || s.indexOf("READY") === 0;
  }
  function isJobSummaryReady(status) {
    var s = String(status || "").toUpperCase();
    return s === "READY_SUMMARY_READY" || s === "READY";
  }

  function PromptsClient(apiBase, getAuth) {
    this.apiBase = String(apiBase || "https://api.agilotext.com/api/v1").replace(/\/+$/, "");
    this.getAuth = getAuth;
  }
  PromptsClient.prototype.authBody = function () {
    var a = this.getAuth();
    if (!a || !a.username || !a.token) throw new Error("Authentification Agilotext manquante (token ou email).");
    var body = new URLSearchParams();
    body.set("username", a.username);
    body.set("token", a.token);
    body.set("edition", a.edition || "ent");
    return body;
  };
  PromptsClient.prototype.authQuery = function (extra) {
    var a = this.getAuth();
    if (!a || !a.username || !a.token) throw new Error("Authentification Agilotext manquante (token ou email).");
    var q = new URLSearchParams();
    q.set("username", a.username);
    q.set("token", a.token);
    q.set("edition", a.edition || "ent");
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (extra[k] !== undefined && extra[k] !== null) q.set(k, String(extra[k]));
      });
    }
    return q;
  };
  PromptsClient.prototype.postUrlEncoded = async function (endpoint, params) {
    var body = this.authBody();
    params = params || {};
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) body.append(k, String(params[k]));
    });
    var res = await fetch(this.apiBase + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    var text = await res.text();
    var data = parseJsonSafe(text);
    if (!res.ok) throw new Error(endpoint + ": HTTP " + res.status + " " + text.slice(0, 400));
    if (data && data.status === "KO") {
      throw new Error(endpoint + ": " + (data.errorMessage || JSON.stringify(data)));
    }
    return data != null ? data : text;
  };
  PromptsClient.prototype.getJson = async function (endpoint, params) {
    var q = this.authQuery(params);
    var res = await fetch(this.apiBase + endpoint + "?" + q.toString(), { method: "GET", cache: "no-store" });
    var text = await res.text();
    var data = parseJsonSafe(text);
    if (!res.ok) throw new Error(endpoint + ": HTTP " + res.status + " " + text.slice(0, 400));
    if (data && data.status === "KO") {
      throw new Error(endpoint + ": " + (data.errorMessage || JSON.stringify(data)));
    }
    return data != null ? data : text;
  };
  PromptsClient.prototype.postMultipart = async function (endpoint, params, fileFieldName, blob, filename) {
    var a = this.getAuth();
    if (!a || !a.username || !a.token) throw new Error("Authentification Agilotext manquante.");
    var form = new FormData();
    form.append("username", a.username);
    form.append("token", a.token);
    form.append("edition", a.edition || "ent");
    params = params || {};
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) form.append(k, String(params[k]));
    });
    form.append(fileFieldName, blob, filename);
    var res = await fetch(this.apiBase + endpoint, { method: "POST", body: form });
    var text = await res.text();
    var data = parseJsonSafe(text);
    if (!res.ok) throw new Error(endpoint + ": HTTP " + res.status + " " + text.slice(0, 400));
    if (data && data.status === "KO") {
      throw new Error(endpoint + ": " + (data.errorMessage || JSON.stringify(data)));
    }
    return data != null ? data : text;
  };
  PromptsClient.prototype.listUserPrompts = async function () {
    try {
      return extractPromptList((await this.getJson("/getPromptModelsUserInfo")) || {});
    } catch (_e) {
      return extractPromptList((await this.postUrlEncoded("/getPromptModelsUserInfo")) || {});
    }
  };
  PromptsClient.prototype.listStandardPrompts = async function () {
    try {
      return extractPromptList((await this.getJson("/getPromptModelsStandardInfo")) || {});
    } catch (_e) {
      try {
        return extractPromptList((await this.postUrlEncoded("/getPromptModelsStandardInfo")) || {});
      } catch (_e2) {
        return [];
      }
    }
  };
  PromptsClient.prototype.getPromptContent = async function (promptId) {
    var res = await this.postUrlEncoded("/getPromptModelContent", { promptId: promptId });
    return extractPromptTextFromContentResponse(res);
  };
  PromptsClient.prototype.loadTemplateHtml = async function (promptId) {
    var body;
    try { body = this.authBody(); } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
    body.set("promptId", String(promptId));
    var res;
    try {
      res = await fetch(this.apiBase + "/receivePromptModelTemplate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
    } catch (e) {
      return { ok: false, message: "Connexion au serveur Agilotext impossible. Vérifiez le réseau, puis réessayez." };
    }
    var text = await res.text();
    if (!res.ok) {
      return { ok: false, message: "La requête du template n’a pas abouti (code " + res.status + ")." };
    }
    var data = parseJsonSafe(text);
    if (data && data.status === "KO") {
      return { ok: false, message: humanizeTemplateKoMessage(String(data.errorMessage || "")) };
    }
    if (data && typeof data === "object") return { ok: true, html: normalizeTemplateResponse(data) };
    return { ok: true, html: text };
  };
  PromptsClient.prototype.updatePromptText = function (promptId, promptContent, promptName) {
    return this.postUrlEncoded("/updatePromptModelUser", {
      promptId: promptId,
      promptContent: promptContent,
      promptName: promptName,
      promptModelName: promptName
    });
  };
  PromptsClient.prototype.updateTemplateFile = function (promptId, promptContent, promptName, html) {
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    return this.postMultipart("/updatePromptModelFileUser", {
      promptId: promptId,
      promptContent: promptContent,
      promptName: promptName
    }, "fileUpload", blob, "template.html");
  };
  PromptsClient.prototype.duplicatePromptModel = function (sourcePromptId, promptName) {
    return this.postUrlEncoded("/duplicatePromptModel", {
      sourcePromptId: sourcePromptId,
      promptName: promptName
    });
  };
  PromptsClient.prototype.getPromptStatus = async function (promptId) {
    var res = await this.postUrlEncoded("/getPromptModelUserStatus", { promptId: promptId });
    var o = res || {};
    return { status: String(o.promptModelStatus || o.status || "").toUpperCase(), raw: res };
  };
  PromptsClient.prototype.waitPromptReady = async function (promptId, opts) {
    var maxMs = (opts && opts.maxMs) || 240000;
    var pollMs = (opts && opts.pollMs) || 2000;
    var start = Date.now();
    while (Date.now() - start < maxMs) {
      var st = await this.getPromptStatus(promptId);
      if (opts && opts.onTick) opts.onTick({ elapsedMs: Date.now() - start, status: st.status, maxMs: maxMs });
      if (st.status === "READY" || st.status === "ACTIVE") return true;
      if (st.status.indexOf("ERROR") !== -1 || st.status.indexOf("KO") !== -1) return false;
      await sleep(pollMs);
    }
    return false;
  };
  PromptsClient.prototype.setPinned = function (promptId, pinned) {
    return this.postUrlEncoded("/setPromptModelPinned", {
      promptId: promptId,
      pinned: pinned ? "true" : "false"
    });
  };
  PromptsClient.prototype.listVersions = function (promptId) {
    return this.postUrlEncoded("/listPromptModelVersions", { promptId: promptId });
  };
  PromptsClient.prototype.getVersion = function (promptId, versionId) {
    return this.postUrlEncoded("/getPromptModelVersion", { promptId: promptId, versionId: versionId });
  };
  PromptsClient.prototype.restoreVersion = function (promptId, versionId) {
    return this.postUrlEncoded("/restorePromptModelVersion", { promptId: promptId, versionId: versionId });
  };
  PromptsClient.prototype.renamePrompt = function (promptId, promptName) {
    return this.postUrlEncoded("/renamePromptModel", { promptId: promptId, promptName: promptName });
  };
  PromptsClient.prototype.deletePrompt = function (promptId) {
    return this.postUrlEncoded("/deletePromptModel", { promptId: promptId });
  };
  PromptsClient.prototype.listReadyJobs = async function () {
    var out = [];
    var offset = 0;
    for (var page = 0; page < 3; page++) {
      var data = await this.getJson("/getJobsInfo", { limit: 100, offset: offset });
      var batch = (data && data.jobsInfoDtos) || [];
      batch.forEach(function (j) {
        var id = j.jobid != null ? j.jobid : j.jobId;
        if (id == null) return;
        var status = String(j.status || j.jobStatus || "").toUpperCase();
        if (!isJobReadyStatus(status)) return;
        out.push({
          jobId: String(id),
          file: String(j.filename || j.fileName || j.file || "Dossier " + id),
          status: status
        });
      });
      if (batch.length < 100) break;
      offset += 100;
    }
    return out;
  };
  PromptsClient.prototype.receiveSummaryHtml = async function (jobId) {
    var q = this.authQuery({ jobId: jobId, format: "html" });
    var res = await fetch(this.apiBase + "/receiveSummary?" + q.toString(), { method: "GET", cache: "no-store" });
    var text = await res.text();
    if (!res.ok) throw new Error("receiveSummary: HTTP " + res.status);
    var data = parseJsonSafe(text);
    if (data && data.status === "KO") throw new Error(data.errorMessage || "receiveSummary KO");
    if (data && typeof data === "object") {
      var html = data.summary || data.html || data.content || data.body;
      if (typeof html === "string") return html;
    }
    return text;
  };
  PromptsClient.prototype.redoSummary = async function (jobId, promptId) {
    var q = this.authQuery({ jobId: jobId, promptId: promptId });
    var res = await fetch(this.apiBase + "/redoSummary?" + q.toString(), { method: "GET", cache: "no-store" });
    var text = await res.text();
    var data = parseJsonSafe(text);
    if (!res.ok) throw new Error("redoSummary: HTTP " + res.status + " " + text.slice(0, 300));
    if (data && data.status === "KO") throw new Error(data.errorMessage || "redoSummary KO");
    return data || text;
  };
  PromptsClient.prototype.waitJobSummaryReady = async function (jobId, opts) {
    var maxMs = (opts && opts.maxMs) || 240000;
    var pollMs = (opts && opts.pollMs) || 3000;
    var start = Date.now();
    while (Date.now() - start < maxMs) {
      var data = await this.getJson("/getJobsInfo", { jobId: jobId, limit: 1, offset: 0 });
      var jobs = (data && data.jobsInfoDtos) || [];
      var job = jobs[0] || {};
      var status = String(job.status || job.jobStatus || "").toUpperCase();
      if (opts && opts.onTick) opts.onTick({ elapsedMs: Date.now() - start, status: status });
      if (isJobSummaryReady(status)) return true;
      if (status.indexOf("ERROR") !== -1 || status.indexOf("KO") !== -1) return false;
      await sleep(pollMs);
    }
    return false;
  };

  function inferEditionFromLocation() {
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf("/premium") !== -1) return "pro";
    if (path.indexOf("/business") !== -1) return "ent";
    return "ent";
  }
  function editionFromHeadGlobals() {
    var a = typeof window.agilotextEdition === "string" ? window.agilotextEdition.trim() : "";
    var b = typeof window.__AGILOTEXT_EDITION__ === "string" ? window.__AGILOTEXT_EDITION__.trim() : "";
    return a || b;
  }
  function defaultGetAuth() {
    var token = typeof window.globalToken === "string" ? window.globalToken.trim() : "";
    var emailInput = document.querySelector('[name="memberEmail"]');
    var email = (emailInput && emailInput.value && emailInput.value.trim()) || "";
    if (!token || !email) return null;
    var cfg = window.__AGILO_PROMPT_STUDIO__ || {};
    var fromInput = document.querySelector('[name="edition"]');
    var fromConfig = typeof cfg.defaultEdition === "string" ? cfg.defaultEdition.trim() : "";
    var edition = (fromInput && fromInput.value && fromInput.value.trim()) || fromConfig || editionFromHeadGlobals() || inferEditionFromLocation();
    return { username: email, token: token, edition: edition };
  }
  function mergeConfig(overrides) {
    var w = window.__AGILO_PROMPT_STUDIO__ || {};
    var out = {};
    Object.keys(w).forEach(function (k) { out[k] = w[k]; });
    if (overrides) Object.keys(overrides).forEach(function (k) { out[k] = overrides[k]; });
    return out;
  }
  function buildGetAuth(cfg) {
    return function () {
      if (cfg && cfg.getAuth) {
        var r = cfg.getAuth();
        if (r && typeof r.then === "function") return null;
        return r;
      }
      return defaultGetAuth();
    };
  }
  async function waitForAuth(getAuth, maxMs) {
    var start = Date.now();
    var limit = maxMs || 15000;
    while (Date.now() - start < limit) {
      var a = getAuth();
      if (a && a.username && a.token) return a;
      await sleep(200);
    }
    return getAuth();
  }
  function editorHref(jobId, edition) {
    var path = "/app/business/editor";
    if (edition === "pro") path = "/app/premium/editor";
    if (edition === "free") path = "/app/free/editor";
    return path + "?jobId=" + encodeURIComponent(jobId);
  }
  function normalizeRow(row, originFallback) {
    var id = String(row.promptModelId != null ? row.promptModelId : (row.promptId != null ? row.promptId : row.id || "")).trim();
    if (!id) return null;
    var name = String(row.promptModelName || row.promptName || row.name || "").trim() || ("Modèle " + id);
    var n = Number(id);
    var origin = row.origin === "standard" || row.origin === "user"
      ? row.origin
      : (originFallback || (Number.isFinite(n) && n < 100 ? "standard" : "user"));
    var pinned = row.pinned === true || row.pinned === "true" || row.isPinned === true;
    return {
      id: id,
      name: name,
      origin: origin,
      kind: origin === "standard" ? "original" : "draft",
      pinned: pinned,
      modifiedLabel: formatWhen(row.dtUpdate || row.updatedAt || row.dtCreation),
      prompt: "",
      html: "",
      loaded: false
    };
  }

  function MaquetteApp(cfg) {
    this.cfg = cfg || {};
    this.getAuth = buildGetAuth(this.cfg);
    this.client = new PromptsClient(this.cfg.apiBase || "https://api.agilotext.com/api/v1", this.getAuth);
    this.mounted = false;
    this.bound = false;
    this.models = [];
    this.jobs = [];
    this.selectedId = null;
    this.dirty = false;
    this.saving = false;
    this.trying = false;
    this.leftMode = "prompt";
    this.workTab = "prompt";
    this.layoutView = "preview";
    this.versionsOk = false;
    this.versions = [];
    this.renameTarget = null;
    this.pendingLeaveAfterSaveAs = null;
    this.pendingTryAfterSave = false;
    this.blobUrls = { layout: null, before: null, after: null, expand: null };
    this.frozenBeforeHtml = "";
    this.selectGen = 0;
  }
  MaquetteApp.prototype.$ = function (sel) {
    return document.querySelector(sel);
  };
  MaquetteApp.prototype.ensureMounted = function () {
    if (this.mounted && this.$("#studio-overlay")) return;
    var wrap = document.createElement("div");
    wrap.id = "agilo-atelier-maquette-root";
    wrap.innerHTML = OVERLAY_HTML;
    document.body.appendChild(wrap);
    this.mounted = true;
    this.bindOnce();
  };
  MaquetteApp.prototype.toast = function (msg) {
    var el = this.$("#toast");
    var msgEl = this.$("#toast-msg");
    if (!el || !msgEl) return;
    msgEl.textContent = msg;
    el.classList.add("is-open");
    clearTimeout(this._toastT);
    var self = this;
    this._toastT = setTimeout(function () { el.classList.remove("is-open"); }, 3600);
  };
  MaquetteApp.prototype.current = function () {
    var id = this.selectedId;
    return this.models.filter(function (m) { return m.id === id; })[0] || null;
  };
  MaquetteApp.prototype.isPinned = function (id) {
    var m = this.models.filter(function (x) { return x.id === String(id); })[0];
    return !!(m && m.pinned);
  };
  MaquetteApp.prototype.sortPinnedFirst = function (items) {
    var self = this;
    return items.slice().sort(function (a, b) {
      return (self.isPinned(a.id) ? 0 : 1) - (self.isPinned(b.id) ? 0 : 1);
    });
  };
  MaquetteApp.prototype.pushRecent = function (id) {
    try {
      localStorage.setItem(LS_LAST, String(id));
      var arr = [];
      try { arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]"); } catch (_e) { arr = []; }
      arr = [String(id)].concat(arr.filter(function (x) { return x !== String(id); })).slice(0, 12);
      localStorage.setItem(LS_RECENT, JSON.stringify(arr));
    } catch (_e2) { /* ignore */ }
  };
  MaquetteApp.prototype.setIframe = function (iframe, html, slot) {
    if (this.blobUrls[slot]) {
      URL.revokeObjectURL(this.blobUrls[slot]);
      this.blobUrls[slot] = null;
    }
    if (!iframe) return;
    if (!html) {
      iframe.removeAttribute("src");
      iframe.src = "about:blank";
      return;
    }
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    this.blobUrls[slot] = URL.createObjectURL(blob);
    iframe.src = this.blobUrls[slot];
  };
  MaquetteApp.prototype.coherenceKo = function () {
    var html = this.$("#editor-html").value;
    var prompt = this.$("#editor").value;
    return placeholdersOnlyInHtml(html, prompt).length + tagToFillsMissingInHtml(html, prompt).length > 0;
  };
  MaquetteApp.prototype.renderLayoutMeta = function () {
    var html = this.$("#editor-html").value;
    var prompt = this.$("#editor").value;
    var fields = extractPlaceholdersFromHtml(html);
    var onlyHtml = placeholdersOnlyInHtml(html, prompt);
    var onlyPrompt = tagToFillsMissingInHtml(html, prompt);
    var cls = classifyPlaceholders(html);
    var box = this.$("#layout-meta");
    var h = "<h5>Champs</h5>";
    h += fields.length ? "<ul>" + fields.map(function () { return "<li></li>"; }).join("") + "</ul>" : "<p class='agilo-ps-muted'>Aucun ${} dans le HTML.</p>";
    h += "<h5>Cohérence</h5>";
    if (!onlyHtml.length && !onlyPrompt.length) h += "<p>Aligné prompt / HTML.</p>";
    else {
      if (onlyHtml.length) h += "<p class='is-ko'>Dans le HTML seulement</p><ul class='is-ko'>" + onlyHtml.map(function () { return "<li></li>"; }).join("") + "</ul>";
      if (onlyPrompt.length) h += "<p class='is-ko'>Dans le prompt seulement</p><ul class='is-ko'>" + onlyPrompt.map(function () { return "<li></li>"; }).join("") + "</ul>";
    }
    if (cls.invalid.length) h += "<p class='is-ko'>Placeholders invalides (ni -filled ni CONTENT)</p><ul class='is-ko'>" + cls.invalid.map(function () { return "<li></li>"; }).join("") + "</ul>";
    box.innerHTML = h;
    var lis = box.querySelectorAll("li");
    var vals = fields.concat(onlyHtml, onlyPrompt, cls.invalid);
    lis.forEach(function (li, i) { li.textContent = vals[i] || ""; });
    var ko = this.coherenceKo() || cls.invalid.length > 0;
    var pillD = this.$("#pill-d");
    var pillM = this.$("#pill-m");
    if (pillD) pillD.hidden = !ko;
    if (pillM) pillM.hidden = !ko;
  };
  MaquetteApp.prototype.refreshLayoutPreview = function () {
    var html = this.$("#editor-html").value.trim();
    this.setIframe(this.$("#iframe-layout"), html || "<p style='font-family:system-ui;padding:1rem;color:#6b7280'>Aucun HTML à prévisualiser.</p>", "layout");
    this.renderLayoutMeta();
  };
  MaquetteApp.prototype.setLayoutView = function (view) {
    this.layoutView = view;
    this.$("#layout-preview").hidden = view !== "preview";
    this.$("#layout-source").hidden = view !== "source";
    this.$("#btn-view-preview").classList.toggle("agilo-ps-tab--active", view === "preview");
    this.$("#btn-view-source").classList.toggle("agilo-ps-tab--active", view === "source");
    if (view === "preview") this.refreshLayoutPreview();
  };
  MaquetteApp.prototype.renderTrialHtml = function (el, html, emptyMsg) {
    el.innerHTML = "";
    if (!html) {
      var p = document.createElement("p");
      p.className = "agilo-ps-cr-empty";
      p.textContent = emptyMsg || "Choisissez un dossier pour afficher le CR actuel.";
      el.appendChild(p);
      return;
    }
    var iframe = document.createElement("iframe");
    iframe.title = "Compte rendu";
    iframe.setAttribute("sandbox", "allow-same-origin");
    el.appendChild(iframe);
    var slot = el.id === "cr-before" ? "before" : "after";
    this.setIframe(iframe, html, slot);
  };
  MaquetteApp.prototype.clearAfter = function () {
    if (this.blobUrls.after) {
      URL.revokeObjectURL(this.blobUrls.after);
      this.blobUrls.after = null;
    }
    this.$("#cr-after").innerHTML = "<p class='agilo-ps-cr-empty'>Pas encore d’essai. Relancer remplace le CR officiel de ce dossier.</p>";
  };
  MaquetteApp.prototype.syncTryCta = function () {
    var btn = this.$("#btn-try");
    if (!btn) return;
    var ico = btn.querySelector(".agilo-ps-ico");
    btn.textContent = "";
    if (ico) btn.appendChild(ico);
    btn.appendChild(document.createTextNode(" Essayer"));
    var jobVal = this.$("#job") && this.$("#job").value;
    btn.disabled = this.trying || this.saving || !jobVal;
  };
  MaquetteApp.prototype.syncOrigHint = function () {
    var el = this.$("#orig-hint");
    if (!el) return;
    var m = this.current();
    el.hidden = !(m && !isDraftModel(m) && this.dirty);
  };
  MaquetteApp.prototype.syncEditorLink = function () {
    var a = this.$("#link-editor");
    if (!a) return;
    var job = this.selectedJob();
    var auth = this.getAuth() || {};
    if (job) {
      a.href = editorHref(job.jobId, auth.edition || "ent");
      a.textContent = "Ouvrir dans l’éditeur";
    } else {
      a.href = "#";
      a.textContent = "Ouvrir dans l’éditeur";
    }
  };
  MaquetteApp.prototype.selectedJob = function () {
    var val = this.$("#job") && this.$("#job").value;
    if (!val) return null;
    return this.jobs.filter(function (j) { return j.jobId === val; })[0] || { jobId: val, file: val };
  };
  MaquetteApp.prototype.populateJobs = function () {
    var sel = this.$("#job");
    if (!sel) return;
    sel.innerHTML = "";
    var first = document.createElement("option");
    first.value = "";
    first.textContent = this.jobs.length ? "Choisir un dossier…" : "Aucun dossier READY";
    sel.appendChild(first);
    this.jobs.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.jobId;
      opt.textContent = t.file + " · " + t.jobId;
      sel.appendChild(opt);
    });
    sel.value = "";
    this.syncTryCta();
    this.syncEditorLink();
  };
  MaquetteApp.prototype.renderList = function (filter) {
    var q = (filter || "").trim().toLowerCase();
    var last = "";
    try { last = localStorage.getItem(LS_LAST) || ""; } catch (_e) { last = ""; }
    var listEl = this.$("#list");
    listEl.innerHTML = "";
    if (!this.models.length) {
      listEl.innerHTML = "<div class='agilo-ps-empty'>Aucun modèle pour l’instant. Les modèles de votre compte apparaîtront ici.</div>";
      return;
    }
    var self = this;
    function matches(m) {
      return !q || m.name.toLowerCase().indexOf(q) !== -1 || m.id.indexOf(q) !== -1;
    }
    var pinSvg = "<span class='agilo-ps-list-pin' aria-hidden='true'><svg viewBox='0 0 18 18' width='14' height='14'><line x1='9' y1='16.25' x2='9' y2='12.25' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/><path d='M14.25,12.25c-.089-.699-.318-1.76-.969-2.875-.335-.574-.703-1.028-1.031-1.375V3.75c0-1.105-.895-2-2-2h-2.5c-1.105,0-2,.895-2,2v4.25c-.329,.347-.697,.801-1.031,1.375-.65,1.115-.88,2.176-.969,2.875H14.25Z' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/></svg></span>";
    var dotsSvg = "<span class='agilo-ps-ico'><svg viewBox='0 0 18 18' width='16' height='16' aria-hidden='true'><circle cx='9' cy='9' r='.5' fill='currentColor' stroke='currentColor' stroke-width='1.5'/><circle cx='3.25' cy='9' r='.5' fill='currentColor' stroke='currentColor' stroke-width='1.5'/><circle cx='14.75' cy='9' r='.5' fill='currentColor' stroke='currentColor' stroke-width='1.5'/></svg></span>";
    function appendItem(m) {
      var row = document.createElement("div");
      row.className = "agilo-ps-list-row";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "agilo-ps-list-item" + (m.id === self.selectedId ? " agilo-ps-list-item--active" : "") + (m.id === last ? " agilo-ps-list-item--last" : "");
      var draft = isDraftModel(m);
      btn.innerHTML = "<span class='agilo-ps-list-item-name'></span><span class='agilo-ps-list-item-meta'><span class='agilo-ps-list-item-id'></span><span class='agilo-ps-badge " + (draft ? "agilo-ps-badge--draft" : "agilo-ps-badge--orig") + "'>" + (draft ? "Brouillon" : "Original") + "</span></span>";
      var nameEl = btn.querySelector(".agilo-ps-list-item-name");
      if (self.isPinned(m.id)) nameEl.innerHTML = pinSvg;
      nameEl.appendChild(document.createTextNode(m.name));
      btn.querySelector(".agilo-ps-list-item-id").textContent = "id " + m.id;
      btn.addEventListener("click", function () { self.select(m.id); });
      var more = document.createElement("button");
      more.type = "button";
      more.className = "agilo-ps-icon-btn agilo-ps-list-more";
      more.setAttribute("aria-label", "Actions");
      more.title = "Actions";
      more.innerHTML = dotsSvg;
      more.addEventListener("click", function (e) { e.stopPropagation(); self.openRowMenu(e, m); });
      row.appendChild(btn);
      row.appendChild(more);
      listEl.appendChild(row);
    }
    function group(label, items) {
      var shown = self.sortPinnedFirst(items.filter(matches));
      if (!shown.length) return;
      var lab = document.createElement("div");
      lab.className = "agilo-ps-list-group-label";
      lab.textContent = label;
      listEl.appendChild(lab);
      shown.forEach(appendItem);
    }
    group("Catalogue Agilotext", this.models.filter(function (m) { return isCatalogueModel(m); }));
    group("Vos copies", this.models.filter(function (m) { return !isCatalogueModel(m); }));
  };
  MaquetteApp.prototype.syncPinBtn = function () {
    var btn = this.$("#btn-pin");
    if (!btn) return;
    var m = this.current();
    if (!m) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.innerHTML = ICO.pin + (m.pinned ? " Désépingler" : " Épingler");
  };
  MaquetteApp.prototype.syncFooterCtas = function (m) {
    var draft = !!(m && isDraftModel(m));
    var base = draft ? "Enregistrer" : "Enregistrer sous";
    var label = this.dirty ? base + " (modifié)" : base;
    var btn = this.$("#btn-save-primary");
    btn.innerHTML = (draft ? ICO.floppy : "") + "<span class='agilo-ps-save-label'></span><kbd class='agilo-ps-kbd' id='save-kbd'></kbd>";
    btn.querySelector(".agilo-ps-save-label").textContent = label;
    var kbd = this.$("#save-kbd");
    if (kbd) kbd.textContent = shortcutLabel();
    this.syncOrigHint();
    this.syncPinBtn();
  };
  MaquetteApp.prototype.setLeftMode = function (mode) {
    this.leftMode = mode;
    var panel = this.$("#studio-panel");
    panel.classList.toggle("agilo-ps-left-prompt", mode === "prompt");
    panel.classList.toggle("agilo-ps-left-layout", mode === "layout");
    document.querySelectorAll("[data-left]").forEach(function (t) {
      t.classList.toggle("agilo-ps-tab--active", t.getAttribute("data-left") === mode);
    });
    if (mode === "layout") this.refreshLayoutPreview();
  };
  MaquetteApp.prototype.setWorkTab = function (name) {
    this.workTab = name;
    var panel = this.$("#studio-panel");
    panel.classList.toggle("agilo-ps-panel--tab-prompt", name === "prompt");
    panel.classList.toggle("agilo-ps-panel--tab-layout", name === "layout");
    panel.classList.toggle("agilo-ps-panel--tab-result", name === "result");
    var self = this;
    document.querySelectorAll("[data-work]").forEach(function (t) {
      t.classList.toggle("agilo-ps-tab--active", t.getAttribute("data-work") === name);
    });
    if (name === "prompt" || name === "layout") this.setLeftMode(name);
  };
  MaquetteApp.prototype.fillDetail = function (m) {
    if (!m) {
      this.$("#detail-title").textContent = "Aucun modèle";
      this.$("#detail-meta").textContent = "";
      this.$("#editor").value = "";
      this.$("#editor-html").value = "";
      this.syncFooterCtas(null);
      this.refreshLayoutPreview();
      this.clearAfter();
      this.renderTrialHtml(this.$("#cr-before"), "", "Choisissez un modèle.");
      return;
    }
    this.$("#detail-title").textContent = m.name;
    var draft = isDraftModel(m);
    this.$("#detail-badge").textContent = draft ? "Brouillon" : "Original";
    this.$("#detail-badge").className = "agilo-ps-badge " + (draft ? "agilo-ps-badge--draft" : "agilo-ps-badge--orig");
    this.$("#detail-meta").textContent = "ID " + m.id + " · " + (draft ? "Brouillon" : "Original") + " · Modifié " + (m.modifiedLabel || "récemment");
    this.$("#editor").value = m.prompt || "";
    this.$("#editor-html").value = m.html || "";
    this.$("#dirty-banner").hidden = true;
    this.$("#char-count").textContent = (m.prompt || "").length + " car.";
    this.syncFooterCtas(m);
    this.refreshLayoutPreview();
    this.clearAfter();
  };
  MaquetteApp.prototype.setMobileView = function (detail) {
    this.$("#studio-panel").classList.toggle("agilo-ps-panel--mobile-detail", detail);
    this.$("#studio-panel").classList.toggle("agilo-ps-panel--mobile-list", !detail);
  };
  MaquetteApp.prototype.loadList = async function () {
    var userRows = [];
    var stdRows = [];
    try { userRows = await this.client.listUserPrompts(); } catch (e) {
      this.toast("Impossible de charger vos modèles : " + (e.message || e));
    }
    try { stdRows = await this.client.listStandardPrompts(); } catch (_e) { stdRows = []; }
    var seen = {};
    var models = [];
    stdRows.forEach(function (row) {
      var m = normalizeRow(row, "standard");
      if (!m || seen[m.id]) return;
      seen[m.id] = true;
      models.push(m);
    });
    userRows.forEach(function (row) {
      var m = normalizeRow(row, "user");
      if (!m || seen[m.id]) return;
      seen[m.id] = true;
      models.push(m);
    });
    this.models = models;
    window.__AGILO_ATELIER_NAMES__ = models.map(function (m) { return m.name; });
    this.renderList(this.$("#search") && this.$("#search").value);
  };
  MaquetteApp.prototype.select = async function (id, opts) {
    opts = opts || {};
    var self = this;
    if (!opts.force && this.dirty && id !== this.selectedId) {
      this.confirmLeaveDirty(function () { self.select(id, { force: true }); });
      return;
    }
    if (id) this.pushRecent(id);
    this.dirty = false;
    this.selectedId = id || null;
    this.setMobileView(!!id);
    this.setWorkTab("prompt");
    this.renderList(this.$("#search") && this.$("#search").value);
    var gen = ++this.selectGen;
    this.$("#main").classList.add("is-loading");
    if (!id) {
      this.$("#main").classList.remove("is-loading");
      this.fillDetail(null);
      return;
    }
    try {
      var prompt = await this.client.getPromptContent(id);
      var tpl = await this.client.loadTemplateHtml(id);
      if (gen !== this.selectGen) return;
      var m = this.current();
      if (!m) {
        m = { id: id, name: "Modèle " + id, origin: "user", kind: "draft", pinned: false, modifiedLabel: "", prompt: "", html: "" };
        this.models.push(m);
      }
      m.prompt = prompt;
      m.html = tpl.ok ? (tpl.html || "") : "";
      m.loaded = true;
      if (!tpl.ok && tpl.message && tpl.message.indexOf("Aucune mise en page") === -1) {
        this.toast(tpl.message);
      }
      this.fillDetail(m);
      this.probeVersions(id);
    } catch (e) {
      if (gen !== this.selectGen) return;
      this.toast("Chargement impossible : " + (e.message || e));
      this.fillDetail(this.current());
    } finally {
      if (gen === this.selectGen) this.$("#main").classList.remove("is-loading");
    }
  };
  MaquetteApp.prototype.probeVersions = async function (promptId) {
    var btn = this.$("#btn-history");
    this.versionsOk = false;
    this.versions = [];
    if (btn) btn.hidden = true;
    try {
      var res = await this.client.listVersions(promptId);
      var list = (res && (res.versions || res.promptModelVersions)) || [];
      if (!Array.isArray(list) || !list.length) {
        if (btn) btn.hidden = true;
        return;
      }
      this.versions = list;
      this.versionsOk = true;
      if (btn) btn.hidden = false;
    } catch (_e) {
      this.versionsOk = false;
      if (btn) btn.hidden = true;
    }
  };
  MaquetteApp.prototype.renderVersions = function () {
    var box = this.$("#versions-list");
    var m = this.current();
    if (!box) return;
    if (!m || !this.versionsOk) {
      box.innerHTML = "";
      return;
    }
    this.$("#drawer-sub").innerHTML = "Sauvegardes de <strong>ce</strong> modèle (« " + escapeHtml(m.name) + " »). Les copies V2 sont dans la liste à gauche.";
    box.innerHTML = "";
    var self = this;
    this.versions.forEach(function (v) {
      var el = document.createElement("div");
      var isCurrent = v.isCurrent === true;
      el.className = "agilo-ps-ver-item" + (isCurrent ? " is-current" : "");
      el.innerHTML = "<div class='agilo-ps-ver-label'></div><div class='agilo-ps-ver-meta'></div>" +
        (isCurrent ? "" : "<div class='agilo-ps-ver-actions'><button type='button' class='agilo-ps-btn agilo-ps-btn--primary btn-restore'>Restaurer</button></div>");
      var num = v.versionNumber != null ? v.versionNumber : "";
      el.querySelector(".agilo-ps-ver-label").textContent = isCurrent ? "Actuelle" : ("v" + num + " · " + (v.label || ""));
      el.querySelector(".agilo-ps-ver-meta").textContent = formatWhen(v.createdAt) + (v.source ? " · " + v.source : "");
      var rb = el.querySelector(".btn-restore");
      if (rb) rb.addEventListener("click", function () { self.restoreVersion(v.versionId || v.id); });
      box.appendChild(el);
    });
  };
  MaquetteApp.prototype.openDrawer = function () {
    if (!this.versionsOk) return;
    this.renderVersions();
    this.$("#drawer-back").classList.add("is-open");
    this.$("#versions-drawer").classList.add("is-open");
    this.$("#drawer-title").focus();
  };
  MaquetteApp.prototype.closeDrawer = function () {
    this.$("#drawer-back").classList.remove("is-open");
    this.$("#versions-drawer").classList.remove("is-open");
  };
  MaquetteApp.prototype.restoreVersion = async function (versionId) {
    var m = this.current();
    if (!m || !versionId) return;
    if (!confirm("Restaurer cette version ? L’état actuel sera conservé dans l’historique.")) return;
    try {
      await this.client.restoreVersion(m.id, versionId);
      var ok = await this.client.waitPromptReady(m.id);
      if (!ok) throw new Error("Le modèle n’est pas repassé à READY.");
      this.toast("Version restaurée.");
      await this.select(m.id, { force: true });
    } catch (e) {
      this.toast("Restauration impossible : " + (e.message || e));
    }
  };
  MaquetteApp.prototype.openSaveAs = function () {
    var m = this.current();
    if (!m) return;
    window.__AGILO_ATELIER_NAMES__ = this.models.map(function (x) { return x.name; });
    this.$("#saveas-name").value = suggestName(m.name.replace(/\s+V\d+$/i, ""));
    this.$("#dialog-saveas").classList.add("is-open");
    this.$("#saveas-name").focus();
  };
  MaquetteApp.prototype.closeSaveAs = function () {
    this.$("#dialog-saveas").classList.remove("is-open");
  };
  MaquetteApp.prototype.doSaveAs = async function () {
    var m = this.current();
    var name = this.$("#saveas-name").value.trim();
    if (!m) return;
    if (!name) { alert("Indiquez un nom."); return; }
    if (this.models.some(function (x) { return x.name === name; })) {
      alert("Ce nom existe déjà. Essayez « " + suggestName(name) + " ».");
      return;
    }
    if (this.saving) return;
    this.saving = true;
    this.closeSaveAs();
    this.toast("Copie en cours…");
    try {
      var res = await this.client.duplicatePromptModel(m.id, name);
      var copyId = extractPromptId(res);
      if (!copyId) throw new Error("La copie n’a pas renvoyé d’identifiant.");
      var ok = await this.client.waitPromptReady(copyId, {
        onTick: function (t) {
          /* poll silencieux ; toast unique */
        }
      });
      if (!ok) throw new Error("La copie n’est pas repassée à READY.");
      var text = this.$("#editor").value;
      var html = this.$("#editor-html").value;
      if (this.dirty) {
        await this.client.updatePromptText(copyId, text, name);
        if (html && html.trim()) {
          await this.client.updateTemplateFile(copyId, text, name, html);
        }
        ok = await this.client.waitPromptReady(copyId);
        if (!ok) throw new Error("La copie n’est pas READY après mise à jour.");
      }
      try {
        window.dispatchEvent(new CustomEvent("agilo-ps-models-changed", { detail: { promptId: copyId, promptName: name } }));
      } catch (_e) { /* ignore */ }
      this.dirty = false;
      this.toast("Copie prête (texte + HTML). Rafraîchissez la page pour voir la table.");
      await this.loadList();
      var leave = this.pendingLeaveAfterSaveAs;
      this.pendingLeaveAfterSaveAs = null;
      if (leave) {
        this.saving = false;
        leave();
        return;
      }
      await this.select(copyId, { force: true });
      if (this.pendingTryAfterSave) {
        this.pendingTryAfterSave = false;
        this.openRedoConfirm();
      }
    } catch (e) {
      this.toast("Enregistrer sous impossible : " + (e.message || e));
    } finally {
      this.saving = false;
    }
  };
  MaquetteApp.prototype.doSave = async function () {
    var m = this.current();
    if (!m || this.saving) return;
    if (!isDraftModel(m)) {
      this.toast("Un original catalogue ne peut pas être écrasé. Utilisez Enregistrer sous.");
      this.openSaveAs();
      return;
    }
    this.saving = true;
    this.toast("Enregistrement en cours…");
    try {
      var text = this.$("#editor").value;
      var html = this.$("#editor-html").value;
      await this.client.updatePromptText(m.id, text, m.name);
      if (html && html.trim()) {
        await this.client.updateTemplateFile(m.id, text, m.name, html);
      }
      var ok = await this.client.waitPromptReady(m.id);
      if (!ok) throw new Error("Le modèle n’est pas repassé à READY.");
      m.prompt = text;
      m.html = html;
      this.dirty = false;
      this.$("#dirty-banner").hidden = true;
      this.syncFooterCtas(m);
      this.toast("Brouillon enregistré (texte + HTML).");
      try {
        window.dispatchEvent(new CustomEvent("agilo-ps-models-changed", { detail: { promptId: m.id } }));
      } catch (_e) { /* ignore */ }
    } catch (e) {
      this.toast("Enregistrement impossible : " + (e.message || e));
    } finally {
      this.saving = false;
    }
  };
  MaquetteApp.prototype.onPrimarySave = function () {
    var m = this.current();
    if (!m) return;
    if (isDraftModel(m)) this.doSave();
    else this.openSaveAs();
  };
  MaquetteApp.prototype.onShortcutSave = function () {
    var m = this.current();
    if (!m) return;
    if (isDraftModel(m)) {
      if (!this.dirty) { this.toast("Déjà enregistré."); return; }
      this.doSave();
      return;
    }
    this.openSaveAs();
  };
  MaquetteApp.prototype.togglePin = async function (id) {
    var m = this.models.filter(function (x) { return x.id === String(id); })[0];
    if (!m) return;
    var next = !m.pinned;
    if (next) {
      var count = this.models.filter(function (x) { return x.pinned; }).length;
      if (count >= PIN_MAX) {
        this.toast("Maximum " + PIN_MAX + " modèles épinglés.");
        return;
      }
    }
    try {
      await this.client.setPinned(m.id, next);
      m.pinned = next;
      this.renderList(this.$("#search") && this.$("#search").value);
      this.syncPinBtn();
      this.toast(next ? "Épinglé." : "Désépinglé.");
    } catch (e) {
      var msg = String(e.message || e);
      if (msg.indexOf("pin") !== -1 || msg.indexOf("limit") !== -1) {
        this.toast("Maximum " + PIN_MAX + " modèles épinglés.");
      } else {
        this.toast("Épinglage impossible : " + msg);
      }
    }
  };
  MaquetteApp.prototype.doDelete = async function (target) {
    var m = target || this.current();
    if (!m) return;
    if (isCatalogueModel(m)) {
      this.toast("Un original catalogue ne peut pas être supprimé.");
      return;
    }
    var msg = "Supprimer la copie « " + m.name + " » ? Cette action est irréversible.";
    if (!confirm(msg)) return;
    try {
      await this.client.deletePrompt(m.id);
      var wasSelected = m.id === this.selectedId;
      this.models = this.models.filter(function (x) { return x.id !== m.id; });
      this.closeDrawer();
      if (wasSelected) {
        this.dirty = false;
        var next = this.models[0];
        if (next) await this.select(next.id, { force: true });
        else { this.selectedId = null; this.fillDetail(null); this.renderList(); this.setMobileView(false); }
      } else {
        this.renderList(this.$("#search") && this.$("#search").value);
      }
      try {
        window.dispatchEvent(new CustomEvent("agilo-ps-models-changed", { detail: { promptId: m.id, deleted: true } }));
      } catch (_e) { /* ignore */ }
      this.toast("Modèle supprimé. Rafraîchissez la page pour la table.");
    } catch (e) {
      this.toast("Suppression impossible : " + (e.message || e));
    }
  };
  MaquetteApp.prototype.closeRowMenu = function () {
    var menu = this.$("#row-menu");
    if (menu) menu.classList.remove("is-open");
  };
  MaquetteApp.prototype.addRowMenuItem = function (menu, iconHtml, label, onClick, extraClass) {
    var b = document.createElement("button");
    b.type = "button";
    if (extraClass) b.className = extraClass;
    b.innerHTML = (iconHtml || "") + "<span class='agilo-ps-menu-label'></span>";
    b.querySelector(".agilo-ps-menu-label").textContent = label;
    var self = this;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      self.closeRowMenu();
      onClick();
    });
    menu.appendChild(b);
  };
  MaquetteApp.prototype.openRename = function (m) {
    this.renameTarget = m;
    this.$("#rename-name").value = m.name;
    this.$("#dialog-rename").classList.add("is-open");
    this.$("#rename-name").focus();
  };
  MaquetteApp.prototype.closeRename = function () {
    this.$("#dialog-rename").classList.remove("is-open");
    this.renameTarget = null;
  };
  MaquetteApp.prototype.doRename = async function () {
    var m = this.renameTarget;
    if (!m) return;
    var trimmed = this.$("#rename-name").value.trim();
    if (!trimmed) { this.toast("Nom vide."); return; }
    if (this.models.some(function (x) { return x.name === trimmed && x.id !== m.id; })) {
      this.toast("Ce nom existe déjà.");
      return;
    }
    try {
      await this.client.renamePrompt(m.id, trimmed);
      m.name = trimmed;
      this.closeRename();
      if (m.id === this.selectedId) this.fillDetail(m);
      this.renderList(this.$("#search") && this.$("#search").value);
      this.toast("Renommé. Rafraîchissez la page pour la table.");
    } catch (e) {
      this.toast("Renommage impossible : " + (e.message || e));
    }
  };
  MaquetteApp.prototype.openRowMenu = function (e, m) {
    var menu = this.$("#row-menu");
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    var catalogue = isCatalogueModel(m);
    var pinned = this.isPinned(m.id);
    menu.innerHTML = "";
    var self = this;
    this.addRowMenuItem(menu, "", "Enregistrer sous", function () { self.select(m.id); self.openSaveAs(); });
    if (!catalogue) this.addRowMenuItem(menu, ICO.pencil, "Renommer", function () { self.openRename(m); });
    this.addRowMenuItem(menu, ICO.pin, pinned ? "Désépingler" : "Épingler", function () { self.togglePin(m.id); });
    if (!catalogue) this.addRowMenuItem(menu, ICO.trash, "Supprimer", function () { self.doDelete(m); }, "agilo-ps-menu-danger");
    var sep = document.createElement("div");
    sep.className = "agilo-ps-menu-sep";
    menu.appendChild(sep);
    this.addRowMenuItem(menu, ICO.download, "Télécharger le prompt", function () { self.exportPrompt(m); });
    this.addRowMenuItem(menu, ICO.download, "Télécharger le HTML", function () { self.exportHtml(m); });
    this.addRowMenuItem(menu, ICO.download, "Télécharger les deux", function () { self.exportBoth(m); });
    var r = e.currentTarget.getBoundingClientRect();
    menu.style.visibility = "hidden";
    menu.classList.add("is-open");
    var mh = menu.offsetHeight || 280;
    var mw = menu.offsetWidth || 232;
    var top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    var left = r.right - mw;
    if (left < 8) left = 8;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    menu.style.visibility = "";
  };
  MaquetteApp.prototype.modelExportContent = function (m) {
    var row = m || this.current();
    if (!row) return null;
    if (row.id === this.selectedId) {
      return { name: row.name, prompt: this.$("#editor").value, html: this.$("#editor-html").value };
    }
    return { name: row.name, prompt: row.prompt, html: row.html };
  };
  MaquetteApp.prototype.exportPrompt = function (m) {
    var c = this.modelExportContent(m);
    if (!c) return;
    downloadTextFile(fileSlug(c.name) + ".txt", c.prompt);
  };
  MaquetteApp.prototype.exportHtml = function (m) {
    var c = this.modelExportContent(m);
    if (!c) return;
    downloadTextFile(fileSlug(c.name) + ".html", c.html, "text/html;charset=utf-8");
  };
  MaquetteApp.prototype.exportBoth = function (m) {
    var c = this.modelExportContent(m);
    if (!c) return;
    downloadTextFile(fileSlug(c.name) + "-export.txt", buildCombinedExport(c.name, c.prompt, c.html));
  };
  MaquetteApp.prototype.markDirty = function () {
    this.dirty = true;
    this.$("#dirty-banner").hidden = true;
    this.syncFooterCtas(this.current());
    this.syncTryCta();
    this.syncOrigHint();
    this.renderLayoutMeta();
  };
  MaquetteApp.prototype.confirmLeaveDirty = function (onDiscard) {
    this._leaveFn = onDiscard;
    this.$("#dialog-leave").classList.add("is-open");
  };
  MaquetteApp.prototype.closeLeave = function () {
    this.$("#dialog-leave").classList.remove("is-open");
    this._leaveFn = null;
  };
  MaquetteApp.prototype.onLeaveDiscard = function () {
    var fn = this._leaveFn;
    this.closeLeave();
    this.dirty = false;
    if (fn) fn();
  };
  MaquetteApp.prototype.onLeaveSave = function () {
    var m = this.current();
    var fn = this._leaveFn;
    this.closeLeave();
    if (!m) return;
    if (isDraftModel(m)) {
      var self = this;
      this.doSave().then(function () { if (fn) fn(); });
    } else {
      this.pendingLeaveAfterSaveAs = fn;
      this.openSaveAs();
    }
  };
  MaquetteApp.prototype.needsSaveAsBeforeTry = function (m) {
    if (!m) return false;
    return !isDraftModel(m);
  };
  MaquetteApp.prototype.downloadCurrentCr = async function () {
    var j = this.selectedJob();
    if (!j) { this.toast("Choisissez un dossier."); return; }
    try {
      var html = this.frozenBeforeHtml || await this.client.receiveSummaryHtml(j.jobId);
      downloadTextFile("cr-avant-" + j.jobId + ".html", html || "<p>Pas de CR</p>", "text/html;charset=utf-8");
    } catch (e) {
      this.toast("Téléchargement impossible : " + (e.message || e));
    }
  };
  MaquetteApp.prototype.openRedoConfirm = function () {
    var j = this.selectedJob();
    if (!j) return;
    this.$("#redo-body").textContent = "Le CR officiel de « " + j.file + " » (job " + j.jobId + ") sera régénéré avec le modèle sauvé. La transcription ne change pas. 1 crédit.";
    this.$("#dialog-redo").classList.add("is-open");
  };
  MaquetteApp.prototype.closeRedoConfirm = function () {
    this.$("#dialog-redo").classList.remove("is-open");
  };
  MaquetteApp.prototype.runTry = async function () {
    if (this.trying || this.saving || !this.$("#job").value) return;
    var m = this.current();
    if (!m) return;
    if (this.dirty) {
      if (this.needsSaveAsBeforeTry(m)) {
        this.pendingTryAfterSave = true;
        this.openSaveAs();
        return;
      }
      await this.doSave();
      if (this.dirty) return;
    }
    this.openRedoConfirm();
  };
  MaquetteApp.prototype.executeRedo = async function () {
    if (this.trying || this.saving) return;
    var j = this.selectedJob();
    var m = this.current();
    if (!j || !m) return;
    this.closeRedoConfirm();
    this.trying = true;
    this.syncTryCta();
    this.$("#cr-after").innerHTML = "<p class='agilo-ps-cr-empty'>Génération en cours…</p><div class='agilo-ps-skel-line'></div><div class='agilo-ps-skel-line' style='width:80%'></div>";
    try {
      var ready = await this.client.waitPromptReady(m.id, { maxMs: 120000, pollMs: 2000 });
      if (!ready) throw new Error("Le modèle n’est pas READY. Enregistrez, puis réessayez.");
      await this.client.redoSummary(j.jobId, m.id);
      this.toast("Régénération lancée…");
      var done = await this.client.waitJobSummaryReady(j.jobId, {
        onTick: function () { /* poll */ }
      });
      if (!done) throw new Error("Le CR n’est pas revenu à READY. Vérifiez le dossier dans l’éditeur.");
      var html = await this.client.receiveSummaryHtml(j.jobId);
      this.renderTrialHtml(this.$("#cr-after"), html, "CR vide.");
      this.toast("CR officiel remplacé pour le dossier " + j.jobId + ".");
    } catch (e) {
      this.$("#cr-after").innerHTML = "<p class='agilo-ps-cr-empty'>Échec : " + escapeHtml(e.message || String(e)) + "</p>";
      this.toast("Essayer impossible : " + (e.message || e));
    } finally {
      this.trying = false;
      this.syncTryCta();
    }
  };
  MaquetteApp.prototype.loadJobBefore = async function () {
    var j = this.selectedJob();
    this.frozenBeforeHtml = "";
    this.clearAfter();
    if (!j) {
      this.renderTrialHtml(this.$("#cr-before"), "", "Choisissez un dossier READY (pas le premier de la liste par défaut).");
      this.syncTryCta();
      this.syncEditorLink();
      return;
    }
    this.renderTrialHtml(this.$("#cr-before"), "", "Chargement du CR actuel…");
    try {
      var html = await this.client.receiveSummaryHtml(j.jobId);
      this.frozenBeforeHtml = html;
      this.renderTrialHtml(this.$("#cr-before"), html, "Pas de CR sur ce dossier.");
    } catch (e) {
      this.renderTrialHtml(this.$("#cr-before"), "", "CR actuel indisponible : " + (e.message || e));
    }
    this.syncTryCta();
    this.syncEditorLink();
  };
  MaquetteApp.prototype.openExpand = function (which) {
    var html = which === "after" ? (this.$("#cr-after iframe") && "") : this.frozenBeforeHtml;
    if (which === "after") {
      var afterFrame = this.$("#cr-after iframe");
      html = this.blobUrls.after ? this.frozenBeforeHtml : this.frozenBeforeHtml;
    }
    var srcHtml = which === "before" ? this.frozenBeforeHtml : "";
    if (which === "after") {
      try {
        var iframe = this.$("#cr-after iframe");
        srcHtml = iframe && iframe.src ? "" : this.$("#cr-after").innerText;
      } catch (_e) { srcHtml = ""; }
    }
    var back = this.$("#expand-back");
    back.classList.add("is-open");
    if (which === "before") this.setIframe(this.$("#expand-frame"), this.frozenBeforeHtml, "expand");
    else {
      var afterIframe = this.$("#cr-after iframe");
      if (afterIframe && this.blobUrls.after) this.setIframe(this.$("#expand-frame"), null, "expand");
      this.$("#expand-frame").src = this.blobUrls.after || "about:blank";
    }
  };
  MaquetteApp.prototype.closeExpand = function () {
    this.$("#expand-back").classList.remove("is-open");
  };
  MaquetteApp.prototype.setBodyLock = function (on) {
    if (on) {
      if (this._lockScrollY == null) this._lockScrollY = window.scrollY || 0;
      document.body.classList.add("agilo-ps-lock");
      return;
    }
    document.body.classList.remove("agilo-ps-lock");
    var y = this._lockScrollY;
    this._lockScrollY = null;
    if (y != null) window.scrollTo(0, y);
  };
  MaquetteApp.prototype.ensureOverlayFixed = function () {
    var overlay = this.$("#studio-overlay");
    if (!overlay) return;
    if (getComputedStyle(overlay).position === "fixed") return;
    var css = "position:fixed;inset:0;z-index:2147483000;width:100%;height:100%;max-height:100dvh;overflow:hidden";
    overlay.style.cssText = (overlay.style.cssText ? overlay.style.cssText + ";" : "") + css;
    ["#dialog-saveas", "#dialog-rename", "#dialog-leave", "#dialog-redo", "#expand-back", "#toast"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (getComputedStyle(el).position === "fixed") return;
      el.style.position = "fixed";
      el.style.zIndex = "2147483100";
    });
  };
  MaquetteApp.prototype.hideOverlay = function () {
    var o = this.$("#studio-overlay");
    if (o) o.classList.remove("is-open");
    this.setBodyLock(false);
  };
  MaquetteApp.prototype.closeStudio = function () {
    var self = this;
    if (this.dirty) {
      this.confirmLeaveDirty(function () {
        self.dirty = false;
        self.hideOverlay();
      });
      return;
    }
    this.hideOverlay();
  };
  MaquetteApp.prototype.open = async function (promptId) {
    this.ensureMounted();
    var auth = await waitForAuth(this.getAuth, 15000);
    if (!auth || !auth.token) {
      this.toast("Session Agilotext indisponible : reconnectez-vous ou attendez le chargement du compte.");
      return;
    }
    this.$("#studio-overlay").classList.add("is-open");
    this.setBodyLock(true);
    this.ensureOverlayFixed();
    this.$("#studio-panel").classList.add("agilo-ps-panel--enter");
    this.$("#btn-history").hidden = true;
    await this.loadList();
    try {
      this.jobs = await this.client.listReadyJobs();
    } catch (_e) {
      this.jobs = [];
    }
    this.populateJobs();
    if (promptId) {
      await this.select(String(promptId), { force: true });
    } else {
      this.renderList(this.$("#search") && this.$("#search").value);
      this.fillDetail(null);
      this.setMobileView(false);
    }
  };
  MaquetteApp.prototype.bindOnce = function () {
    if (this.bound) return;
    this.bound = true;
    var self = this;
    this.$("#search").addEventListener("input", function (e) { self.renderList(e.target.value); });
    this.$("#btn-save-primary").addEventListener("click", function () { self.onPrimarySave(); });
    this.$("#btn-history").addEventListener("click", function () { self.openDrawer(); });
    this.$("#btn-pin").addEventListener("click", function () {
      var m = self.current();
      if (m) self.togglePin(m.id);
    });
    this.$("#saveas-cancel").addEventListener("click", function () {
      self.pendingTryAfterSave = false;
      self.pendingLeaveAfterSaveAs = null;
      self.closeSaveAs();
    });
    this.$("#saveas-ok").addEventListener("click", function () { self.doSaveAs(); });
    this.$("#rename-cancel").addEventListener("click", function () { self.closeRename(); });
    this.$("#rename-ok").addEventListener("click", function () { self.doRename(); });
    this.$("#leave-cancel").addEventListener("click", function () { self.closeLeave(); });
    this.$("#leave-discard").addEventListener("click", function () { self.onLeaveDiscard(); });
    this.$("#leave-save").addEventListener("click", function () { self.onLeaveSave(); });
    this.$("#row-menu").addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("click", function () { self.closeRowMenu(); });
    this.$("#drawer-close").addEventListener("click", function () { self.closeDrawer(); });
    this.$("#drawer-back").addEventListener("click", function () { self.closeDrawer(); });
    this.$("#editor").addEventListener("input", function () {
      self.markDirty();
      self.$("#char-count").textContent = (self.$("#editor").value || "").length + " car.";
    });
    this.$("#editor-html").addEventListener("input", function () {
      self.markDirty();
      if (self.layoutView === "preview") self.refreshLayoutPreview();
      else self.renderLayoutMeta();
    });
    this.$("#html-import").addEventListener("change", function () {
      var f = self.$("#html-import").files && self.$("#html-import").files[0];
      self.$("#html-import").value = "";
      if (!f) return;
      var ok = /\.html?$/i.test(f.name) || f.type === "text/html";
      if (!ok) { self.toast("Fichier .html uniquement."); return; }
      f.text().then(function (t) {
        self.$("#editor-html").value = t;
        self.markDirty();
        self.setLayoutView("preview");
        self.refreshLayoutPreview();
        self.toast("HTML importé.");
      });
    });
    this.$("#job").addEventListener("change", function () { self.loadJobBefore(); });
    this.$("#btn-try").addEventListener("click", function () { self.runTry(); });
    this.$("#redo-cancel").addEventListener("click", function () { self.closeRedoConfirm(); });
    this.$("#redo-ok").addEventListener("click", function () { self.executeRedo(); });
    this.$("#redo-dl").addEventListener("click", function () { self.downloadCurrentCr(); });
    this.$("#btn-expand-before").addEventListener("click", function () { self.openExpand("before"); });
    this.$("#btn-expand-after").addEventListener("click", function () { self.openExpand("after"); });
    this.$("#expand-close").addEventListener("click", function () { self.closeExpand(); });
    this.$("#btn-view-preview").addEventListener("click", function () { self.setLayoutView("preview"); });
    this.$("#btn-view-source").addEventListener("click", function () { self.setLayoutView("source"); });
    document.querySelectorAll("[data-left]").forEach(function (tab) {
      tab.addEventListener("click", function () { self.setLeftMode(tab.getAttribute("data-left")); });
    });
    document.querySelectorAll("[data-work]").forEach(function (tab) {
      tab.addEventListener("click", function () { self.setWorkTab(tab.getAttribute("data-work")); });
    });
    this.$("#btn-help").addEventListener("click", function (e) {
      e.stopPropagation();
      var pop = self.$("#help-pop");
      var open = !pop.classList.contains("is-open");
      pop.classList.toggle("is-open", open);
      self.$("#btn-help").setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function () {
      self.$("#help-pop").classList.remove("is-open");
      self.$("#btn-help").setAttribute("aria-expanded", "false");
    });
    this.$("#help-pop").addEventListener("click", function (e) { e.stopPropagation(); });
    this.$("#btn-close-studio").addEventListener("click", function () { self.closeStudio(); });
    this.$("#btn-back-list").addEventListener("click", function () { self.setMobileView(false); });
    document.addEventListener("keydown", function (e) {
      var overlay = self.$("#studio-overlay");
      var overlayOpen = overlay && overlay.classList.contains("is-open");
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        if (!overlayOpen) return;
        e.preventDefault();
        if (self.$("#dialog-saveas").classList.contains("is-open")) { self.doSaveAs(); return; }
        if (self.$("#dialog-rename").classList.contains("is-open")) { self.doRename(); return; }
        if (self.$("#dialog-leave").classList.contains("is-open")) { self.onLeaveSave(); return; }
        self.onShortcutSave();
        return;
      }
      if (e.key !== "Escape") return;
      if (self.$("#expand-back").classList.contains("is-open")) { self.closeExpand(); return; }
      if (self.$("#dialog-redo").classList.contains("is-open")) { self.closeRedoConfirm(); return; }
      if (self.$("#dialog-leave").classList.contains("is-open")) { self.closeLeave(); return; }
      if (self.$("#dialog-rename").classList.contains("is-open")) { self.closeRename(); return; }
      if (self.$("#dialog-saveas").classList.contains("is-open")) {
        self.pendingTryAfterSave = false;
        self.pendingLeaveAfterSaveAs = null;
        self.closeSaveAs();
        return;
      }
      if (self.$("#versions-drawer").classList.contains("is-open")) { self.closeDrawer(); return; }
      if (self.$("#row-menu").classList.contains("is-open")) { self.closeRowMenu(); return; }
      if (self.$("#help-pop").classList.contains("is-open")) { self.$("#help-pop").classList.remove("is-open"); return; }
      if (overlayOpen) self.closeStudio();
    });
    window.addEventListener("beforeunload", function (e) {
      var overlay = self.$("#studio-overlay");
      if (overlay && overlay.classList.contains("is-open") && self.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  };

  var app = null;
  function getApp(cfg) {
    if (!app) app = new MaquetteApp(cfg || mergeConfig());
    return app;
  }
  function init(overrides) {
    var cfg = mergeConfig(overrides);
    if (cfg.enabled === false) return;
    var inst = getApp(cfg);
    inst.ensureMounted();
  }
  function openModalAndSelect(promptId, overrides) {
    var cfg = mergeConfig(overrides);
    if (cfg.enabled === false) return;
    var inst = getApp(cfg);
    void inst.open(promptId ? String(promptId) : "");
  }

  var api = {
    init: init,
    mergeConfig: mergeConfig,
    defaultGetAuth: defaultGetAuth,
    openModalAndSelect: openModalAndSelect
  };
  if (typeof globalThis !== "undefined") globalThis.AgiloPromptStudio = api;
  if (typeof window !== "undefined") window.AgiloPromptStudio = api;
})();
