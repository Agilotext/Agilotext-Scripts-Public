/**
 * Agilotext Prompt Studio — fork coach + diff (overlay injectable).
 * Fork de la maquette validée @7fcaf8a. Ne pas merger à l’aveugle dans agilo-atelier-maquette.js.
 * Staging only. token-resolver reste @820f11f.
 */
(function () {
  "use strict";

  var OVERLAY_HTML = "<div class=\"agilo-ps-overlay\" id=\"studio-overlay\">\n  <div class=\"agilo-ps-panel agilo-ps-panel--mobile-list agilo-ps-panel--tab-prompt agilo-ps-left-prompt agilo-ps-panel--result-collapsed\" id=\"studio-panel\" role=\"dialog\" aria-labelledby=\"ps-title\" aria-modal=\"true\">\n    <div class=\"agilo-ps-header\">\n      <div class=\"agilo-ps-header-text\">\n        <h1 class=\"agilo-ps-title\" id=\"ps-title\">Modèles de comptes rendus</h1>\n      </div>\n      <div class=\"agilo-ps-header-actions\">\n        <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-help\" aria-label=\"Aide\" title=\"Aide\" aria-expanded=\"false\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"9\" r=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><path d=\"M6.925,6.619c.388-1.057,1.294-1.492,2.18-1.492,.895,0,1.818,.638,1.818,1.808,0,1.784-1.816,1.468-2.096,3.065\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><path d=\"M8.791,13.567c-.552,0-1-.449-1-1s.448-1,1-1,1,.449,1,1-.448,1-1,1Z\" fill=\"currentColor\"/></svg></span></button>\n        <div class=\"agilo-ps-help-pop\" id=\"help-pop\">\n          <p><strong>1.</strong> Ouvrez un modèle, ajoutez une consigne si besoin.</p>\n          <p><strong>2.</strong> <strong>Enregistrer sous</strong> crée une copie. L’original reste intact.</p>\n          <p><strong>3.</strong> <strong>Essayer</strong> remplace le CR du dossier (1 crédit). Si ce n’est pas bon, supprimez la copie et rouvrez l’original.</p>\n        </div>\n        <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-close-studio\" aria-label=\"Fermer\" title=\"Fermer\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><line x1=\"14\" y1=\"4\" x2=\"4\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"4\" y1=\"4\" x2=\"14\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n      </div>\n    </div>\n     <div class=\"agilo-ps-body\">\n      <aside class=\"agilo-ps-listcol\">\n        <h2 class=\"agilo-ps-subtitle\">Vos modèles</h2>\n        <div class=\"agilo-ps-search-wrap\">\n          <span class=\"agilo-ps-ico\" aria-hidden=\"true\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"M15.75 15.75L11.6386 11.6386\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 4.7125 10.7875 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25Z\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/></svg></span>\n          <input class=\"agilo-ps-search\" id=\"search\" type=\"search\" placeholder=\"Rechercher…\" />\n        </div>\n        <div class=\"agilo-ps-list\" id=\"list\"></div>\n      </aside>\n      <section class=\"agilo-ps-main\" id=\"main\">\n        <div class=\"agilo-ps-skeleton\" aria-hidden=\"true\">\n          <div class=\"agilo-ps-skel-line\" style=\"width:40%\"></div>\n          <div class=\"agilo-ps-skel-line\" style=\"width:70%\"></div>\n          <div class=\"agilo-ps-skel-line agilo-ps-skel-line--lg\"></div>\n        </div>\n        <div class=\"agilo-ps-main-live\">\n          <div class=\"agilo-ps-main-scroll\">\n            <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--ghost agilo-ps-back-list\" id=\"btn-back-list\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><line x1=\"2.75\" y1=\"9\" x2=\"15.25\" y2=\"9\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><polyline points=\"7 13.25 2.75 9 7 4.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span> Modèles</button>\n            <div class=\"agilo-ps-toolbar\">\n              <h3 class=\"agilo-ps-detail-title\" id=\"detail-title\"></h3>\n              <span id=\"detail-badge\" class=\"agilo-ps-badge agilo-ps-badge--orig\">Original</span>\n              <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--ghost agilo-ps-pin-btn\" id=\"btn-pin\">Épingler</button>\n              <p class=\"agilo-ps-meta\" id=\"detail-meta\"></p>\n              <p class=\"agilo-ps-orig-hint\" id=\"orig-hint\" hidden>Pour ne pas écraser l’original, Enregistrer sous crée une copie.</p>\n            </div>\n            <div class=\"agilo-ps-dirty-banner\" id=\"dirty-banner\" hidden></div>\n            <span id=\"char-count\" hidden></span>\n            <div class=\"agilo-ps-tabs agilo-ps-work-tabs\" role=\"tablist\">\n              <button type=\"button\" class=\"agilo-ps-tab agilo-ps-tab--active\" data-work=\"prompt\">Prompt</button>\n              <button type=\"button\" class=\"agilo-ps-tab\" data-work=\"layout\">Mise en page <span class=\"agilo-ps-pill\" id=\"pill-m\" hidden></span></button>\n              <button type=\"button\" class=\"agilo-ps-tab\" data-work=\"result\">Résultat</button>\n            </div>\n            <div class=\"agilo-ps-main-split\">\n              <div class=\"agilo-ps-prompt-col\">\n                <div class=\"agilo-ps-tabs agilo-ps-left-tabs\">\n                  <button type=\"button\" class=\"agilo-ps-tab agilo-ps-tab--active\" data-left=\"prompt\">Prompt</button>\n                  <button type=\"button\" class=\"agilo-ps-tab\" data-left=\"layout\">Mise en page <span class=\"agilo-ps-pill\" id=\"pill-d\" hidden></span></button>\n                </div>\n                <div class=\"agilo-ps-prompt-panel\">\n                  <div class=\"agilo-ps-editor-mount\"><textarea class=\"agilo-ps-native-editor\" id=\"editor\"></textarea></div>\n                <div class=\"agilo-ps-coach\" id=\"coach-panel\" role=\"region\" aria-labelledby=\"coach-title\">\n                    <p class=\"agilo-ps-coach-title\" id=\"coach-title\">Ajouter une consigne</p>\n                    <p class=\"agilo-ps-coach-hint\" id=\"coach-hint\" aria-live=\"polite\"><span data-step=\"1\">1 Ajoutez</span><span class=\"agilo-ps-coach-step-sep\" aria-hidden=\"true\"> · </span><span data-step=\"2\">2 Enregistrez</span><span class=\"agilo-ps-coach-step-sep\" aria-hidden=\"true\"> · </span><span data-step=\"3\">3 Testez</span></p>\n                    <div class=\"agilo-ps-coach-list\" id=\"coach-list\" role=\"list\"></div>\n                    <div id=\"coach-extra\" hidden></div>\n                    <div class=\"agilo-ps-prompt-diff\" id=\"prompt-diff\" hidden role=\"region\" aria-label=\"Diff du prompt\"></div>\n                  </div>\n                </div>\n                <div class=\"agilo-ps-layout-panel\">\n                  <div class=\"agilo-ps-layout-toolbar\">\n                    <div class=\"agilo-ps-tabs\" style=\"margin:0\">\n                      <button type=\"button\" class=\"agilo-ps-tab agilo-ps-tab--active\" id=\"btn-view-preview\">Aperçu</button>\n                      <button type=\"button\" class=\"agilo-ps-tab\" id=\"btn-view-source\">Source</button>\n                    </div>\n                    <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-expand-layout\" aria-label=\"Agrandir la mise en page\" title=\"Agrandir\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><polyline points=\"11.25 2.75 15.25 2.75 15.25 6.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><polyline points=\"6.75 15.25 2.75 15.25 2.75 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"15\" y1=\"3\" x2=\"10.75\" y2=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/><line x1=\"3\" y1=\"15\" x2=\"7.25\" y2=\"10.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n                    <label class=\"agilo-ps-btn agilo-ps-btn--secondary\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"M6.75 10.5L9 8.25L11.25 10.5\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M9 8.25V14.25\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><path d=\"M12 14.25H12.5C14.571 14.25 16.25 12.571 16.25 10.5C16.25 8.7639 15.065 7.31791 13.464 6.89111C13.278 4.57711 11.362 2.75 9 2.75C6.515 2.75 4.5 4.7651 4.5 7.25C4.5 7.6001 4.54899 7.93598 4.62399 8.26288C3.02699 8.32998 1.75 9.6369 1.75 11.25C1.75 12.907 3.093 14.25 4.75 14.25H6\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/></svg></span> Importer .html\n                      <input class=\"agilo-ps-file-input\" id=\"html-import\" type=\"file\" accept=\".html,.htm,text/html\" />\n                    </label>\n                  </div>\n                  <div class=\"agilo-ps-layout-preview\" id=\"layout-preview\">\n                    <p class=\"agilo-ps-layout-label\">Mise en page vide (placeholders)</p>\n                    <iframe class=\"agilo-ps-preview-frame\" id=\"iframe-layout\" title=\"Aperçu du template HTML\" sandbox=\"allow-same-origin\"></iframe>\n                  </div>\n                  <div class=\"agilo-ps-layout-source\" id=\"layout-source\" hidden>\n                    <div class=\"agilo-ps-editor-mount\"><textarea class=\"agilo-ps-native-editor\" id=\"editor-html\"></textarea></div>\n                  </div>\n                  <details class=\"agilo-ps-meta-box\" id=\"layout-meta-wrap\">\n                    <summary>Champs et cohérence</summary>\n                    <div class=\"agilo-ps-meta-inner\" id=\"layout-meta\"></div>\n                  </details>\n                </div>\n              </div>\n              <div class=\"agilo-ps-result-col\">\n                <div class=\"agilo-ps-result-head\">\n                  <label for=\"job-search\">Dossier</label>\n                  <input class=\"agilo-ps-job-search\" id=\"job-search\" type=\"search\" placeholder=\"Rechercher un dossier…\" autocomplete=\"off\" />\n                  <select id=\"job\" aria-label=\"Dossier à tester\"></select>\n                  <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"btn-try\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"M5.245,2.878l9.492,5.256c.685,.379,.685,1.353,0,1.732L5.245,15.122c-.669,.371-1.495-.108-1.495-.866V3.744c0-.758,.825-1.237,1.495-.866Z\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span> Essayer</button>\n                  <a class=\"agilo-ps-editor-link\" id=\"link-editor\" href=\"#\">Ouvrir dans l’éditeur</a>\n                  <span class=\"agilo-ps-credits\" id=\"credits-label\" aria-live=\"polite\">1 crédit</span>\n                  <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-collapse-try\" aria-label=\"Masquer le test\" title=\"Masquer le test\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><polyline points=\"7.25 4.75 11.5 9 7.25 13.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n                </div>\n                <div class=\"agilo-ps-cr-diff\" id=\"cr-diff\" hidden role=\"region\" aria-labelledby=\"cr-diff-summary\">\n                  <p class=\"agilo-ps-cr-diff-summary\" id=\"cr-diff-summary\"></p>\n                  <p class=\"agilo-ps-cr-diff-counts\" id=\"cr-diff-counts\"></p>\n                  <ul class=\"agilo-ps-cr-diff-sections\" id=\"cr-diff-sections\"></ul>\n                  <div class=\"agilo-ps-cr-diff-detail\" id=\"cr-diff-detail\" hidden></div>\n                  <div class=\"agilo-ps-cr-diff-ko\" id=\"cr-diff-ko\" hidden>\n                    <p class=\"agilo-ps-cr-diff-ko-text\" id=\"cr-diff-ko-text\"></p>\n                    <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--secondary\" id=\"btn-delete-copy\" hidden>Supprimer cette copie</button>\n                  </div>\n                </div>\n                <div class=\"agilo-ps-trial-cols\">\n                  <div class=\"agilo-ps-trial-col\">\n                    <div class=\"agilo-ps-trial-col-head\">\n                      <h4>CR actuel du dossier</h4>\n                      <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-expand-before\" aria-label=\"Agrandir le CR actuel\" title=\"Agrandir\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><polyline points=\"11.25 2.75 15.25 2.75 15.25 6.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><polyline points=\"6.75 15.25 2.75 15.25 2.75 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"15\" y1=\"3\" x2=\"10.75\" y2=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/><line x1=\"3\" y1=\"15\" x2=\"7.25\" y2=\"10.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n                    </div>\n                    <div class=\"agilo-ps-trial-body\" id=\"cr-before\"></div>\n                  </div>\n                  <div class=\"agilo-ps-trial-col\">\n                    <div class=\"agilo-ps-trial-col-head\">\n                      <h4>Après relance (CR officiel)</h4>\n                      <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"btn-expand-after\" aria-label=\"Agrandir le CR après\" title=\"Agrandir\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><polyline points=\"11.25 2.75 15.25 2.75 15.25 6.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><polyline points=\"6.75 15.25 2.75 15.25 2.75 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"15\" y1=\"3\" x2=\"10.75\" y2=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/><line x1=\"3\" y1=\"15\" x2=\"7.25\" y2=\"10.75\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n                    </div>\n                    <div class=\"agilo-ps-trial-body\" id=\"cr-after\"><p class=\"agilo-ps-cr-empty\">Pas encore d’essai. Relancer remplace le CR officiel de ce dossier.</p></div>\n                  </div>\n                </div>\n              </div>\n            </div>\n          </div>\n          <div class=\"agilo-ps-main-footer\">\n            <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--secondary agilo-ps-toggle-try\" id=\"btn-toggle-try\" aria-expanded=\"false\">Tester sur un dossier</button>\n            <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"btn-save-primary\"><span class=\"agilo-ps-save-label\">Enregistrer sous</span><kbd class=\"agilo-ps-kbd\" id=\"save-kbd\"></kbd></button>\n            <button type=\"button\" class=\"agilo-ps-btn\" id=\"btn-history\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"9\" r=\"7.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><polyline points=\"9 4.75 9 9 12.25 11.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg></span> Historique</button>\n          </div>\n        </div>\n      </section>\n    </div>\n     <div class=\"agilo-ps-menu agilo-ps-row-menu\" id=\"row-menu\" role=\"menu\"></div>\n    <div class=\"agilo-ps-drawer-back\" id=\"drawer-back\"></div>\n    <aside class=\"agilo-ps-drawer\" id=\"versions-drawer\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"drawer-title\">\n      <div class=\"agilo-ps-drawer-head\">\n        <div style=\"flex:1;min-width:0\">\n          <h3 id=\"drawer-title\" tabindex=\"-1\">Historique</h3>\n          <p id=\"drawer-sub\">3 dernières sauvegardes de <strong>ce</strong> modèle. Les copies V2 sont dans la liste à gauche.</p>\n        </div>\n        <button type=\"button\" class=\"agilo-ps-icon-btn\" id=\"drawer-close\" aria-label=\"Fermer l’historique\" title=\"Fermer\"><span class=\"agilo-ps-ico\"><svg viewBox=\"0 0 18 18\" width=\"16\" height=\"16\" aria-hidden=\"true\"><line x1=\"14\" y1=\"4\" x2=\"4\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/><line x1=\"4\" y1=\"4\" x2=\"14\" y2=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"/></svg></span></button>\n      </div>\n      <div class=\"agilo-ps-drawer-body\" id=\"versions-list\"></div>\n    </aside>\n  </div>\n</div>\n <div class=\"agilo-ps-dialog-back\" id=\"dialog-saveas\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"saveas-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"saveas-title\">Enregistrer sous</h4>\n    <p>Une copie complète est créée (texte + HTML). L’original n’est pas modifié.</p>\n    <label for=\"saveas-name\">Nom de la copie</label>\n    <input id=\"saveas-name\" type=\"text\" maxlength=\"120\" />\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"saveas-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"saveas-ok\">Créer la copie</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-dialog-back\" id=\"dialog-rename\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"rename-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"rename-title\">Renommer</h4>\n    <p>Le nom apparaît dans la liste à gauche.</p>\n    <label for=\"rename-name\">Nouveau nom</label>\n    <input id=\"rename-name\" type=\"text\" maxlength=\"120\" />\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"rename-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"rename-ok\">Renommer</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-dialog-back\" id=\"dialog-leave\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"leave-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"leave-title\">Enregistrer les modifications ?</h4>\n    <p id=\"leave-body\">Des changements ne sont pas enregistrés.</p>\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"leave-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"leave-discard\">Ignorer</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"leave-save\">Enregistrer</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-dialog-back\" id=\"dialog-redo\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"redo-title\">\n  <div class=\"agilo-ps-dialog\">\n    <h4 id=\"redo-title\">Remplacer le compte rendu de ce dossier ?</h4>\n    <p id=\"redo-body\">Le compte rendu officiel de ce dossier sera remplacé. 1 crédit. La transcription ne change pas.</p>\n    <div class=\"agilo-ps-dialog-actions\">\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"redo-dl\">Télécharger le CR actuel</button>\n      <button type=\"button\" class=\"agilo-ps-btn\" id=\"redo-cancel\">Annuler</button>\n      <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--primary\" id=\"redo-ok\">Remplacer le CR</button>\n    </div>\n  </div>\n</div>\n<div class=\"agilo-ps-expand-back\" id=\"expand-back\">\n  <div class=\"agilo-ps-expand-bar\">\n    <button type=\"button\" class=\"agilo-ps-btn agilo-ps-btn--secondary\" id=\"expand-close\">Fermer</button>\n  </div>\n  <iframe class=\"agilo-ps-expand-frame\" id=\"expand-frame\" title=\"Compte rendu agrandi\" sandbox=\"allow-same-origin\"></iframe>\n</div>\n<div class=\"agilo-ps-toast\" id=\"toast\"><span id=\"toast-msg\"></span></div>\n\n";
  var PIN_MAX = 5;
  var LS_LAST = "agilo:ps:lastPromptId";
  var LS_RECENT = "agilo:ps:recentPromptIds";
  var LS_RESULT_COL = "agilo:ps:resultCol";
  var LS_LIST_GROUP_USER = "agilo:ps:listGroup:user";
  var LS_LIST_GROUP_CATALOGUE = "agilo:ps:listGroup:catalogue";
  var CLOCK_SVG = "<span class='agilo-ps-list-when-ico' aria-hidden='true'><svg viewBox='0 0 18 18' width='12' height='12'><circle cx='9' cy='9' r='7.25' fill='none' stroke='currentColor' stroke-width='1.5'/><polyline points='9 4.75 9 9 12.25 11.25' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/></svg></span>";

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
  function formatWhenShort(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return dd + "/" + mm + " " + hh + ":" + mi;
  }
  function readResultColOpen() {
    try {
      return localStorage.getItem(LS_RESULT_COL) === "open";
    } catch (_e) {
      return false;
    }
  }
  function writeResultColOpen(open) {
    try {
      localStorage.setItem(LS_RESULT_COL, open ? "open" : "closed");
    } catch (_e) { /* storage bloqué */ }
  }
  function readListGroupOpen(key, defaultOpen) {
    try {
      var v = localStorage.getItem(key);
      if (v === "open") return true;
      if (v === "closed") return false;
    } catch (_e) { /* storage bloqué */ }
    return defaultOpen;
  }
  function writeListGroupOpen(key, open) {
    try {
      localStorage.setItem(key, open ? "open" : "closed");
    } catch (_e) { /* storage bloqué */ }
  }
  function bindLineBreakFilet(ta, onInput) {
    if (!ta) return;
    var enterBreakHandledThisTick = false;
    function insertLineBreakAtCaret() {
      var start = ta.selectionStart || 0;
      var end = ta.selectionEnd || 0;
      ta.value = ta.value.slice(0, start) + "\n" + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 1;
      if (onInput) onInput();
    }
    ta.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      enterBreakHandledThisTick = true;
      insertLineBreakAtCaret();
      queueMicrotask(function () { enterBreakHandledThisTick = false; });
    }, true);
    ta.addEventListener("beforeinput", function (e) {
      if (e.inputType !== "insertLineBreak" && e.inputType !== "insertParagraph") return;
      if (e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      if (enterBreakHandledThisTick) return;
      insertLineBreakAtCaret();
    }, true);
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
  var SUMMARY_INITIAL_DELAY_MS = 4000;
  var SUMMARY_POLL_MS = 10000;
  var SUMMARY_MAX_WAIT_MS = 25 * 60 * 1000;
  var RECEIVE_SUMMARY_MIN_READY_LEN = 80;

  function jobStatusOf(j) {
    if (!j || typeof j !== "object") return "";
    return String(j.transcriptStatus || j.status || j.jobStatus || "").toUpperCase();
  }
  function isJobListableStatus(status) {
    var s = String(status || "").toUpperCase();
    if (!s || s.indexOf("ERROR") !== -1 || s.indexOf("KO") !== -1) return false;
    if (s.indexOf("PENDING") !== -1) return false;
    return s === "READY_SUMMARY_READY" || s === "READY" || s === "READY_TRANSCRIPT" || s === "READY_TEXT";
  }
  function isSummaryMissingText(text) {
    var lower = String(text || "").toLowerCase();
    return lower.indexOf("error_summary_transcript_file_not_exists") !== -1;
  }
  function parseJobDate(ds) {
    if (!ds) return new Date(0);
    var m = String(ds).match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    }
    var d = new Date(ds);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  function formatJobWhen(ds) {
    var d = parseJobDate(ds);
    if (!d.getTime()) return "";
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return dd + "/" + mm + " " + hh + ":" + mi;
  }
  function formatDurationParts(h, min, s) {
    h = Number(h) || 0;
    min = Number(min) || 0;
    s = Number(s) || 0;
    if (h > 0) return h + " h " + String(min).padStart(2, "0") + " min";
    if (min > 0) return min + " min";
    if (s > 0) return s + " s";
    return "";
  }
  function durationFromFilename(file) {
    var m = String(file || "").match(/(\d{2})h(\d{2})m(\d{2})s/);
    if (!m) return "";
    return formatDurationParts(m[1], m[2], m[3]);
  }
  function durationFromFileLength(n) {
    var v = Number(n);
    if (!Number.isFinite(v) || v <= 0 || v > 86400) return "";
    var total = Math.round(v);
    return formatDurationParts(Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60);
  }
  function stripFileExt(name) {
    return String(name || "").replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  }
  function jobDisplayTitle(j) {
    var t = stripFileExt(j.jobTitle || "");
    if (t) return t;
    return stripFileExt(j.filename || j.fileName || j.file || "") || ("Dossier " + (j.jobid || j.jobId || ""));
  }
  function jobShortId(id) {
    var s = String(id || "");
    return s.length > 5 ? s.slice(-5) : s;
  }
  function jobOptionLabel(j) {
    var left = j.whenLabel || "";
    if (j.durationLabel) left = left ? left + " · " + j.durationLabel : j.durationLabel;
    var title = j.title || j.file || ("Dossier " + j.jobId);
    if (title.length > 42) title = title.slice(0, 41) + "…";
    return (left ? left + "  " : "") + title + "  · " + jobShortId(j.jobId);
  }
  function jobMatchesQuery(j, q) {
    if (!q) return true;
    var blob = [j.title, j.file, j.jobId, j.whenLabel, j.durationLabel, j.dtCreation].join(" ").toLowerCase();
    return blob.indexOf(q) !== -1;
  }
  function getSummaryContentHash(text) {
    var s = String(text || "");
    if (s.length < 60) return "len:" + s.length;
    var head = s.slice(0, 180).replace(/\s+/g, "");
    var tail = s.slice(-180).replace(/\s+/g, "");
    return s.length + ":" + head.slice(0, 40) + ":" + tail.slice(-40);
  }
  function htmlFromSummaryPayload(text) {
    var data = parseJsonSafe(text);
    if (data && typeof data === "object") {
      var html = data.summary || data.html || data.content || data.body;
      if (typeof html === "string") return html;
    }
    return String(text || "");
  }
  function formatElapsed(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var mm = Math.floor(sec / 60);
    var ss = sec % 60;
    if (mm > 0) return mm + " min " + ss + " s";
    return ss + " s";
  }

  var LS_WITNESS = "agilo:ps:witness";
  var LS_REGENERATIONS = "agilo:regenerations";
  var WITNESS_JOB_IDS = ["1000038502"];
  var SECTION_DIFF_SENTENCE_CAP = 200;
  var UNIVERSAL_PATCHES = [
    {
      id: "no-invent",
      label: "Ne rien inventer",
      text: "Ne rien inventer. Si une information n’est pas dans l’oral, écrire « non mentionné ». Pas de fait, de décision ou de chiffre ajouté."
    },
    {
      id: "keep-order",
      label: "Garder l’ordre de la réunion",
      text: "Rester dans l’ordre chronologique de la réunion. Ne pas fusionner deux points distincts en un seul paragraphe."
    },
    {
      id: "one-idea",
      label: "Une idée par paragraphe",
      text: "Couper : une idée par paragraphe. Maximum 4 phrases par paragraphe."
    }
  ];
  var CSE_EXTRA_PATCHES = [
    {
      id: "no-invent-vote",
      label: "Ne pas inventer un vote",
      text: "Ne jamais inventer un vote, une décision, ou une résolution. Si le vote n’est pas dans l’oral, écrire « non mentionné »."
    },
    {
      id: "fill-placeholders",
      label: "Remplir tous les champs",
      text: "Remplir tous les placeholders ${…-filled} du HTML. Ne laisser aucun champ vide. Si l’information manque à l’oral, écrire « non mentionné »."
    }
  ];

  function isInternalLab() {
    var h = (location.hostname || "").toLowerCase();
    if (h.indexOf("agilotext-test") !== -1) return true;
    if (h === "localhost" || h === "127.0.0.1") return true;
    try { return localStorage.getItem("agilo:ps:coach") === "1"; } catch (_e) { return false; }
  }
  function isCoachHost() {
    return true;
  }
  function isWitnessJobId(jobId) {
    return WITNESS_JOB_IDS.indexOf(String(jobId || "")) !== -1;
  }
  function readPageProfile() {
    var edition = "";
    var edEl = document.querySelector("[name=\"edition\"]");
    if (edEl && edEl.value) edition = String(edEl.value).trim();
    var path = (location.pathname || "").toLowerCase();
    if (!edition) {
      if (path.indexOf("/app/free") !== -1) edition = "free";
      else if (path.indexOf("/premium") !== -1 || path.indexOf("/app/pro") !== -1) edition = "pro";
      else if (path.indexOf("/business") !== -1) edition = "ent";
    }
    var memberId = "";
    var mid = document.querySelector("input[name=\"memberId\"]");
    if (mid) memberId = String(mid.value || mid.getAttribute("src") || mid.getAttribute("data-src") || "").trim();
    var bits = [edition, path];
    var vert = document.querySelector("[name=\"metier\"], [name=\"vertical\"], [data-agilo-vertical]");
    if (vert) bits.push(vert.value || vert.getAttribute("data-agilo-vertical") || vert.textContent || "");
    document.querySelectorAll("[data-ms-member]").forEach(function (el) {
      var key = String(el.getAttribute("data-ms-member") || "").toLowerCase();
      if (key === "email" || key === "first-name" || key === "last-name") return;
      bits.push(key);
      bits.push(el.textContent || el.value || "");
    });
    var hay = bits.join(" ").toLowerCase();
    var cse = /\bcse\b|cse89|ssct|comité social|comite social/.test(hay);
    return { edition: edition, memberId: memberId, cse: cse };
  }
  function normalizeConsignes(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (p) {
      return p && p.id && p.label && p.text;
    });
  }
  function patchesForUi() {
    var cfg = window.__AGILO_PROMPT_STUDIO__ || {};
    var maestro = normalizeConsignes(cfg.consignes);
    if (maestro.length) return { main: maestro, extra: [] };
    var extra = readPageProfile().cse ? CSE_EXTRA_PATCHES.slice() : [];
    return { main: UNIVERSAL_PATCHES.slice(), extra: extra };
  }
  function allPatches() {
    var ui = patchesForUi();
    return ui.main.concat(ui.extra);
  }
  function regenerationLimit(edition) {
    var ed = String(edition || "").toLowerCase().trim();
    if (ed.startsWith("pro")) return 2;
    if (ed === "ent" || ed === "business" || ed === "enterprise" || ed === "entreprise" || ed === "team") return 4;
    return 0;
  }
  function regenerationCount(jobId) {
    if (!jobId) return 0;
    try {
      var data = JSON.parse(localStorage.getItem(LS_REGENERATIONS) || "{}");
      return (data[jobId] && data[jobId].count) || 0;
    } catch (_e) {
      return 0;
    }
  }
  function incrementRegenerationCount(jobId, edition) {
    if (!jobId) return;
    try {
      var data = JSON.parse(localStorage.getItem(LS_REGENERATIONS) || "{}");
      if (!data[jobId]) {
        data[jobId] = { count: 0, max: regenerationLimit(edition), edition: edition, lastReset: new Date().toISOString() };
      }
      data[jobId].count += 1;
      data[jobId].lastUsed = new Date().toISOString();
      localStorage.setItem(LS_REGENERATIONS, JSON.stringify(data));
    } catch (_e) { /* storage bloqué */ }
  }
  function canRegenerateJob(jobId, edition) {
    var ed = String(edition || "").toLowerCase().trim();
    if (ed.startsWith("free") || ed === "gratuit") {
      return { allowed: false, reason: "free", remaining: 0, limit: 0, count: 0 };
    }
    var limit = regenerationLimit(edition);
    var count = regenerationCount(jobId);
    if (limit <= 0) {
      return { allowed: false, reason: "plan", remaining: 0, limit: 0, count: count };
    }
    if (count >= limit) {
      return { allowed: false, reason: "limit", remaining: 0, limit: limit, count: count };
    }
    return { allowed: true, remaining: limit - count, limit: limit, count: count };
  }
  function stripHtmlToText(html) {
    try {
      var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      return ((doc.body && doc.body.innerText) || "").replace(/\s+/g, " ").trim();
    } catch (_e) {
      return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  function countWords(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return 0;
    return t.split(" ").length;
  }
  function normalizeSectionKey(title) {
    return String(title || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\$\{[^}]*\}/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
  function htmlToSections(html) {
    var doc;
    try {
      doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    } catch (_e) {
      return [];
    }
    var body = doc.body;
    if (!body) return [];
    var sections = [];
    var current = { key: "_intro", title: "Début", texts: [] };
    var keySeen = {};
    function uniqueKey(base) {
      var k = base || "section";
      if (!keySeen[k]) { keySeen[k] = 1; return k; }
      keySeen[k] += 1;
      return k + " " + keySeen[k];
    }
    function flush() {
      var text = current.texts.join(" ").replace(/\s+/g, " ").trim();
      if (current.title === "Début" && !text) return;
      sections.push({ key: uniqueKey(current.key), title: current.title, text: text });
    }
    function isHeadingLike(node) {
      if (!node || node.nodeType !== 1) return false;
      var tag = node.tagName;
      if (/^H[1-3]$/.test(tag)) return true;
      var own = (node.textContent || "").replace(/\s+/g, " ").trim();
      return /^\$\{[^}]+\-filled\}$/.test(own);
    }
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        var raw = String(node.textContent || "").replace(/\s+/g, " ").trim();
        if (raw) current.texts.push(raw);
        return;
      }
      if (node.nodeType !== 1) return;
      if (isHeadingLike(node)) {
        flush();
        var title = (node.textContent || "").replace(/\s+/g, " ").trim() || "Sans titre";
        current = { key: normalizeSectionKey(title) || "section", title: title, texts: [] };
        return;
      }
      var tag = node.tagName;
      var children = node.childNodes;
      if (children && children.length && !/^(P|LI|TD|TH|SPAN|A|STRONG|EM|B|I|LABEL)$/.test(tag)) {
        Array.prototype.forEach.call(children, walk);
        return;
      }
      var t = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
      if (t) current.texts.push(t);
    }
    Array.prototype.forEach.call(body.childNodes, walk);
    flush();
    if (!sections.length) {
      var all = stripHtmlToText(html);
      if (all) sections.push({ key: "_body", title: "Compte rendu", text: all });
    }
    return sections;
  }
  function alignSections(beforeSecs, afterSecs) {
    var afterMap = {};
    afterSecs.forEach(function (s) {
      if (!afterMap[s.key]) afterMap[s.key] = s;
    });
    var used = {};
    var rows = [];
    beforeSecs.forEach(function (b) {
      var a = afterMap[b.key];
      if (a) {
        used[b.key] = true;
        rows.push({
          key: b.key,
          title: b.title,
          status: b.text === a.text ? "identical" : "modified",
          beforeText: b.text,
          afterText: a.text
        });
      } else {
        rows.push({
          key: b.key,
          title: b.title,
          status: "missing",
          beforeText: b.text,
          afterText: ""
        });
      }
    });
    afterSecs.forEach(function (a) {
      if (used[a.key]) return;
      rows.push({
        key: a.key,
        title: a.title,
        status: "new",
        beforeText: "",
        afterText: a.text
      });
    });
    return rows;
  }
  function sentenceSplit(text) {
    var t = String(text || "").trim();
    if (!t) return [];
    var parts = t.split(/([.!?…]+)\s+/);
    var out = [];
    var i;
    for (i = 0; i < parts.length; i += 2) {
      var chunk = (parts[i] || "") + (parts[i + 1] || "");
      if (chunk.trim()) out.push(chunk.trim());
    }
    return out;
  }
  function tokenOverlap(a, b) {
    if (a === b) return 1;
    var aw = String(a || "").split(/\s+/).filter(Boolean);
    var bw = String(b || "").split(/\s+/).filter(Boolean);
    if (!aw.length || !bw.length) return 0;
    var bag = {};
    aw.forEach(function (w) { bag[w] = (bag[w] || 0) + 1; });
    var inter = 0;
    bw.forEach(function (w) {
      if (bag[w]) { inter += 1; bag[w] -= 1; }
    });
    return (2 * inter) / (aw.length + bw.length);
  }
  function alignSequences(a, b, thresh) {
    thresh = thresh == null ? 1 : thresh;
    var n = a.length;
    var m = b.length;
    var dp = [];
    var i;
    var j;
    function match(x, y) {
      if (x === y) return true;
      if (thresh >= 1) return false;
      return tokenOverlap(x, y) >= thresh;
    }
    for (i = 0; i <= n; i++) {
      dp[i] = [];
      for (j = 0; j <= m; j++) dp[i][j] = 0;
    }
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        if (match(a[i - 1], b[j - 1])) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    var ops = [];
    i = n;
    j = m;
    while (i > 0 && j > 0) {
      if (match(a[i - 1], b[j - 1])) {
        ops.push({ type: a[i - 1] === b[j - 1] ? "kept" : "changed", a: a[i - 1], b: b[j - 1] });
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        ops.push({ type: "del", a: a[i - 1], b: "" });
        i--;
      } else {
        ops.push({ type: "add", a: "", b: b[j - 1] });
        j--;
      }
    }
    while (i > 0) { ops.push({ type: "del", a: a[i - 1], b: "" }); i--; }
    while (j > 0) { ops.push({ type: "add", a: "", b: b[j - 1] }); j--; }
    ops.reverse();
    return ops;
  }
  function renderWordDiffHtml(before, after) {
    var ops = alignSequences(
      String(before || "").split(/\s+/).filter(Boolean),
      String(after || "").split(/\s+/).filter(Boolean),
      1
    );
    return ops.map(function (op) {
      if (op.type === "kept") {
        return "<span class='agilo-ps-diff-w agilo-ps-diff-w--kept'>" + escapeHtml(op.a) + "</span>";
      }
      if (op.type === "del") {
        return "<del class='agilo-ps-diff-w agilo-ps-diff-w--del'>" + escapeHtml(op.a) + "</del>";
      }
      return "<ins class='agilo-ps-diff-w agilo-ps-diff-w--add'>" + escapeHtml(op.b) + "</ins>";
    }).join(" ");
  }
  function renderPhraseDiffHtml(beforeText, afterText) {
    var a = sentenceSplit(beforeText);
    var b = sentenceSplit(afterText);
    if (a.length + b.length > SECTION_DIFF_SENTENCE_CAP) {
      return "<p class='agilo-ps-diff-note'>Section trop longue pour un diff phrase. " +
        countWords(beforeText) + " mots avant, " + countWords(afterText) + " mots après.</p>";
    }
    var ops = alignSequences(a, b, 0.62);
    if (!ops.length) {
      return "<p class='agilo-ps-diff-note'>Rien à comparer dans cette section.</p>";
    }
    return "<p class='agilo-ps-diff-legend'>Légende : <span class='agilo-ps-diff-tag agilo-ps-diff-tag--kept'>gardé</span> · <span class='agilo-ps-diff-tag agilo-ps-diff-tag--add'>ajouté</span> · <span class='agilo-ps-diff-tag agilo-ps-diff-tag--del'>retiré</span></p>" +
      ops.map(function (op) {
        if (op.type === "kept") {
          return "<p class='agilo-ps-diff-p agilo-ps-diff-p--kept'><span class='agilo-ps-diff-tag agilo-ps-diff-tag--kept'>gardé</span> " + escapeHtml(op.a) + "</p>";
        }
        if (op.type === "del") {
          return "<p class='agilo-ps-diff-p agilo-ps-diff-p--del'><span class='agilo-ps-diff-tag agilo-ps-diff-tag--del'>retiré</span> <del>" + escapeHtml(op.a) + "</del></p>";
        }
        if (op.type === "add") {
          return "<p class='agilo-ps-diff-p agilo-ps-diff-p--add'><span class='agilo-ps-diff-tag agilo-ps-diff-tag--add'>ajouté</span> <ins>" + escapeHtml(op.b) + "</ins></p>";
        }
        return "<p class='agilo-ps-diff-p agilo-ps-diff-p--mod'><span class='agilo-ps-diff-tag'>modifié</span> " + renderWordDiffHtml(op.a, op.b) + "</p>";
      }).join("");
  }
  function diffPromptLines(before, after) {
    var aLines = String(before || "").split("\n");
    var bLines = String(after || "").split("\n");
    var aSet = {};
    aLines.forEach(function (l) {
      var t = l.trim();
      if (t) aSet[t] = true;
    });
    return bLines.map(function (l) {
      var t = l.trim();
      if (!t) return { type: "blank", text: l };
      return { type: aSet[t] ? "kept" : "added", text: l };
    });
  }
  function sectionStatusLabel(status) {
    if (status === "identical") return "gardé";
    if (status === "modified") return "changée";
    if (status === "missing") return "retiré";
    if (status === "new") return "ajouté";
    return status || "";
  }
  function isNoiseDiffLine(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return true;
    if (t.length < 28) return true;
    if (/^\[\d{1,2}:\d{2}(:\d{2})?\]/.test(t)) return true;
    if (/^\[\d{1,2}:\d{2}(:\d{2})?\]\s+\S+(\s+\S+){0,3}\.?$/.test(t)) return true;
    return false;
  }
  function pickDiffExtracts(beforeText, afterText, maxEach) {
    maxEach = maxEach || 2;
    var a = sentenceSplit(beforeText);
    var b = sentenceSplit(afterText);
    var ops = alignSequences(a, b, 0.62);
    var added = [];
    var removed = [];
    ops.forEach(function (op) {
      if (op.type === "add" && !isNoiseDiffLine(op.b)) added.push(op.b);
      if (op.type === "del" && !isNoiseDiffLine(op.a)) removed.push(op.a);
      if (op.type === "mod") {
        if (!isNoiseDiffLine(op.b)) added.push(op.b);
        if (!isNoiseDiffLine(op.a)) removed.push(op.a);
      }
    });
    return { added: added.slice(0, maxEach), removed: removed.slice(0, maxEach) };
  }
  function sectionDisplayTitle(row, totalRows) {
    var t = String(row && row.title || "").trim();
    if (totalRows === 1 && (!t || /^début$/i.test(t) || /^debut$/i.test(t))) {
      return "Tout le compte rendu";
    }
    if (/^début$/i.test(t) || /^debut$/i.test(t)) return "Tout le compte rendu";
    return t || "Partie";
  }
  function truncateExtract(text, maxLen) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length <= maxLen) return t;
    return t.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + "…";
  }
  function readWitnessPhrase() {
    try { return localStorage.getItem(LS_WITNESS) || ""; } catch (_e) { return ""; }
  }
  function writeWitnessPhrase(v) {
    try { localStorage.setItem(LS_WITNESS, String(v || "")); } catch (_e) { /* storage bloqué */ }
  }

  function mapJobDto(j) {
    var id = j.jobid != null ? j.jobid : j.jobId;
    if (id == null) return null;
    var status = jobStatusOf(j);
    if (!isJobListableStatus(status)) return null;
    var file = String(j.filename || j.fileName || j.file || "Dossier " + id);
    var dtCreation = j.dtCreation || j.creationDate || "";
    return {
      jobId: String(id),
      file: file,
      title: jobDisplayTitle(j),
      status: status,
      dtCreation: dtCreation,
      whenLabel: formatJobWhen(dtCreation),
      durationLabel: durationFromFilename(file) || durationFromFileLength(j.fileLength),
      sortMs: parseJobDate(dtCreation).getTime()
    };
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
        var mapped = mapJobDto(j);
        if (mapped) out.push(mapped);
      });
      if (batch.length < 100) break;
      offset += 100;
    }
    out.sort(function (a, b) { return (b.sortMs || 0) - (a.sortMs || 0); });
    return out.slice(0, 100);
  };
  PromptsClient.prototype.fetchSummaryRawText = async function (jobId) {
    var q = this.authQuery({ jobId: jobId, format: "html" });
    var res = await fetch(this.apiBase + "/receiveSummary?" + q.toString(), { method: "GET", cache: "no-store" });
    var text = await res.text();
    return { okHttp: res.ok, status: res.status, text: text };
  };
  PromptsClient.prototype.receiveSummaryResult = async function (jobId) {
    var raw = await this.fetchSummaryRawText(jobId);
    if (isSummaryMissingText(raw.text)) return { ok: false, missing: true, html: "", message: "file_not_exists" };
    var data = parseJsonSafe(raw.text);
    if (!raw.okHttp) return { ok: false, missing: false, html: "", message: "receiveSummary: HTTP " + raw.status };
    if (data && data.status === "KO") {
      var msg = data.errorMessage || "receiveSummary KO";
      return { ok: false, missing: isSummaryMissingText(msg), html: "", message: msg };
    }
    var html = htmlFromSummaryPayload(raw.text);
    if (!html || html.length < 20) return { ok: false, missing: true, html: "", message: "empty" };
    return { ok: true, missing: false, html: html };
  };
  PromptsClient.prototype.receiveSummaryHtml = async function (jobId) {
    var result = await this.receiveSummaryResult(jobId);
    if (result.ok) return result.html;
    throw new Error(result.missing ? "error_summary_transcript_file_not_exists" : (result.message || "receiveSummary KO"));
  };
  PromptsClient.prototype.fetchPriorSummaryContentHash = async function (jobId) {
    try {
      var result = await this.receiveSummaryResult(jobId);
      if (!result.ok || !result.html || result.html.length < 40) return "";
      return getSummaryContentHash(result.html);
    } catch (_e) {
      return "";
    }
  };
  PromptsClient.prototype.receiveSummaryIndicatesCrReady = async function (jobId, priorContentHash) {
    try {
      var result = await this.receiveSummaryResult(jobId);
      if (!result.ok || result.html.length < RECEIVE_SUMMARY_MIN_READY_LEN) return { ready: false, html: "" };
      if (priorContentHash && getSummaryContentHash(result.html) === priorContentHash) {
        return { ready: false, html: "" };
      }
      return { ready: true, html: result.html };
    } catch (_e) {
      return { ready: false, html: "" };
    }
  };
  PromptsClient.prototype.getTranscriptStatusFull = async function (jobId) {
    var data = await this.getJson("/getTranscriptStatus", { jobId: jobId });
    var ts = data && data.transcriptStatus ? String(data.transcriptStatus).trim().toUpperCase() : "";
    return { transcriptStatus: ts, raw: data || null };
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
    var maxMs = (opts && opts.maxMs) || SUMMARY_MAX_WAIT_MS;
    var pollMs = (opts && opts.pollMs) || SUMMARY_POLL_MS;
    var priorHash = (opts && opts.priorContentHash) || "";
    var start = Date.now();
    await sleep(SUMMARY_INITIAL_DELAY_MS);
    while (Date.now() - start < maxMs) {
      var status = "";
      try {
        var full = await this.getTranscriptStatusFull(jobId);
        status = full.transcriptStatus;
      } catch (_e) {
        status = "";
      }
      if (opts && opts.onTick) opts.onTick({ elapsedMs: Date.now() - start, status: status });
      var check = await this.receiveSummaryIndicatesCrReady(jobId, priorHash);
      if (check.ready) return { ok: true, html: check.html };
      await sleep(pollMs);
    }
    return { ok: false, timeout: true, html: "" };
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
    var modifiedAt = row.dtUpdate || row.updatedAt || row.dtCreation || "";
    return {
      id: id,
      name: name,
      origin: origin,
      kind: origin === "standard" ? "original" : "draft",
      pinned: pinned,
      modifiedAt: modifiedAt,
      modifiedLabel: formatWhen(modifiedAt),
      modifiedLabelShort: formatWhenShort(modifiedAt),
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
    this.jobsFilter = "";
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
    this.frozenAfterHtml = "";
    this.beforeCrMissing = false;
    this.promptBaseline = "";
    this.diffRows = [];
    this.diffSelectedKey = "";
    this.selectGen = 0;
    this.coachHasConsigne = false;
    this.coachSaved = false;
    this.coachTried = false;
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
    this.setResultColOpen(readResultColOpen(), false);
    this.renderCoach();
  };
  MaquetteApp.prototype.setResultColOpen = function (open, persist) {
    var panel = this.$("#studio-panel");
    if (panel) panel.classList.toggle("agilo-ps-panel--result-collapsed", !open);
    var toggle = this.$("#btn-toggle-try");
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Masquer le test" : "Tester sur un dossier";
    }
    if (persist) writeResultColOpen(open);
  };
  MaquetteApp.prototype.toggleResultCol = function () {
    var panel = this.$("#studio-panel");
    var open = !(panel && panel.classList.contains("agilo-ps-panel--result-collapsed"));
    this.setResultColOpen(!open, true);
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
    this.frozenAfterHtml = "";
    this.$("#cr-after").innerHTML = "<p class='agilo-ps-cr-empty'>Pas encore d’essai. Relancer remplace le CR officiel de ce dossier.</p>";
    this.clearCrDiff();
  };
  MaquetteApp.prototype.creditsGate = function () {
    var j = this.selectedJob();
    var auth = this.getAuth() || {};
    if (!j) return { allowed: false, remaining: 0, limit: 0, count: 0, reason: "job" };
    return canRegenerateJob(j.jobId, auth.edition || "ent");
  };
  MaquetteApp.prototype.syncCreditsLabel = function () {
    var el = this.$("#credits-label");
    if (!el) return;
    var j = this.selectedJob();
    if (!j) {
      el.textContent = "1 crédit";
      return;
    }
    var gate = this.creditsGate();
    if (gate.reason === "free") {
      el.textContent = "Essais : plan gratuit";
      return;
    }
    if (!gate.limit) {
      el.textContent = "1 crédit";
      return;
    }
    if (gate.remaining <= 0) {
      el.textContent = "Plus d’essai";
      return;
    }
    if (gate.remaining === 1) {
      el.textContent = "Dernier essai · 1 crédit";
      return;
    }
    el.textContent = "1 crédit";
  };
  MaquetteApp.prototype.isFreePlan = function () {
    var auth = this.getAuth() || {};
    var ed = String(auth.edition || "").toLowerCase().trim();
    return ed === "free" || ed.indexOf("free") === 0;
  };
  MaquetteApp.prototype.resetCoachFlow = function () {
    this.coachHasConsigne = false;
    this.coachSaved = false;
    this.coachTried = false;
  };
  MaquetteApp.prototype.pulseSaveBtn = function () {
    var btn = this.$("#btn-save-primary");
    if (!btn) return;
    btn.classList.remove("agilo-ps-btn--pulse");
    void btn.offsetWidth;
    btn.classList.add("agilo-ps-btn--pulse");
    var self = this;
    clearTimeout(this._pulseSaveTimer);
    this._pulseSaveTimer = setTimeout(function () {
      var b = self.$("#btn-save-primary");
      if (b) b.classList.remove("agilo-ps-btn--pulse");
    }, 2000);
  };
  MaquetteApp.prototype.syncCoachSteps = function () {
    var hint = this.$("#coach-hint");
    if (!hint) return;
    var free = this.isFreePlan();
    var step = 1;
    if (this.coachTried) step = 4;
    else if (this.coachSaved) step = 3;
    else if (this.coachHasConsigne || this.dirty) step = 2;
    Array.prototype.forEach.call(hint.querySelectorAll("[data-step]"), function (el) {
      var n = Number(el.getAttribute("data-step"));
      el.classList.remove("is-done", "is-current", "is-muted");
      if (free && n === 3) {
        el.classList.add("is-muted");
        return;
      }
      if (step > n) el.classList.add("is-done");
      else if (step === n) el.classList.add("is-current");
    });
  };
  MaquetteApp.prototype.syncCoachChipsOn = function () {
    var ta = this.$("#editor");
    var text = ta ? ta.value : "";
    var root = this.$("#coach-panel");
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("[data-patch]"), function (btn) {
      var id = btn.getAttribute("data-patch");
      var patch = allPatches().filter(function (p) { return p.id === id; })[0];
      var on = !!(patch && text.indexOf(patch.text.trim()) !== -1);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  };
  MaquetteApp.prototype.syncTryCta = function () {
    var btn = this.$("#btn-try");
    if (!btn) return;
    var ico = btn.querySelector(".agilo-ps-ico");
    btn.textContent = "";
    if (ico) btn.appendChild(ico);
    btn.appendChild(document.createTextNode(" Essayer"));
    var jobVal = this.$("#job") && this.$("#job").value;
    var gate = this.creditsGate();
    btn.disabled = this.trying || this.saving || !jobVal || (jobVal && !gate.allowed);
    this.syncCreditsLabel();
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
    return this.jobs.filter(function (j) { return j.jobId === val; })[0] || { jobId: val, file: val, title: val };
  };
  MaquetteApp.prototype.clearCrDiff = function () {
    this.diffRows = [];
    this.diffSelectedKey = "";
    var box = this.$("#cr-diff");
    if (!box) return;
    box.hidden = true;
    var sum = this.$("#cr-diff-summary");
    var counts = this.$("#cr-diff-counts");
    var list = this.$("#cr-diff-sections");
    var detail = this.$("#cr-diff-detail");
    var ko = this.$("#cr-diff-ko");
    var status = this.$("#witness-status");
    if (sum) sum.textContent = "";
    if (counts) counts.textContent = "";
    if (list) list.innerHTML = "";
    if (detail) { detail.hidden = true; detail.innerHTML = ""; }
    if (ko) ko.hidden = true;
    if (status) status.textContent = "";
  };
  MaquetteApp.prototype.renderCoach = function () {
    var panel = this.$("#coach-panel");
    var list = this.$("#coach-list");
    if (!panel || !list) return;
    panel.hidden = false;
    var title = this.$("#coach-title");
    if (title) title.textContent = "Ajouter une consigne";
    list.innerHTML = "";
    var ui = patchesForUi();
    function addChip(patch, parent) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "agilo-ps-coach-chip";
      btn.setAttribute("data-patch", patch.id);
      btn.setAttribute("aria-label", "Ajouter la consigne : " + patch.label);
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = patch.label;
      parent.appendChild(btn);
    }
    ui.main.forEach(function (patch) { addChip(patch, list); });
    var extraWrap = this.$("#coach-extra");
    if (extraWrap) {
      extraWrap.innerHTML = "";
      if (ui.extra.length) {
        extraWrap.hidden = false;
        var more = document.createElement("details");
        more.className = "agilo-ps-coach-more";
        var sum = document.createElement("summary");
        sum.textContent = "Plus";
        more.appendChild(sum);
        var extraList = document.createElement("div");
        extraList.className = "agilo-ps-coach-list";
        extraList.setAttribute("role", "list");
        ui.extra.forEach(function (patch) { addChip(patch, extraList); });
        more.appendChild(extraList);
        extraWrap.appendChild(more);
      } else {
        extraWrap.hidden = true;
      }
    }
    this.syncCoachChipsOn();
    this.syncCoachSteps();
  };
  MaquetteApp.prototype.applyRustine = function (patchId) {
    var patch = allPatches().filter(function (p) { return p.id === patchId; })[0];
    var ta = this.$("#editor");
    if (!patch || !ta) return;
    if (this.promptBaseline == null || this.promptBaseline === "") {
      this.promptBaseline = ta.value;
    }
    var block = patch.text.trim();
    if (ta.value.indexOf(block) !== -1) {
      this.toast("Cette consigne est déjà dans le texte.");
      this.syncCoachChipsOn();
      this.renderPromptDiff();
      return;
    }
    var beforeLen = ta.value.replace(/\s*$/, "").length;
    ta.value = ta.value.replace(/\s*$/, "") + "\n\n" + block + "\n";
    try {
      ta.focus();
      ta.setSelectionRange(beforeLen, ta.value.length);
    } catch (_e) { /* ignore */ }
    this.coachHasConsigne = true;
    this.coachSaved = false;
    this.coachTried = false;
    this.markDirty();
    this.renderPromptDiff();
    this.syncCoachChipsOn();
    this.syncCoachSteps();
    this.pulseSaveBtn();
    this.toast("1 consigne ajoutée. Enregistrez, puis testez.");
  };
  MaquetteApp.prototype.renderPromptDiff = function () {
    var box = this.$("#prompt-diff");
    if (!box) return;
    var ta = this.$("#editor");
    var current = ta ? ta.value : "";
    var base = this.promptBaseline || "";
    if (!base || current === base) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    var rows = diffPromptLines(base, current);
    var added = rows.filter(function (r) { return r.type === "added"; }).length;
    if (!added) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    var line = added + " consigne" + (added > 1 ? "s" : "") + " ajoutée" + (added > 1 ? "s" : "") + ". Enregistrez, puis testez.";
    var details = rows.filter(function (r) { return r.type === "added"; }).map(function (r) {
      return "<p class='agilo-ps-prompt-diff-line agilo-ps-prompt-diff-line--add'>" + escapeHtml(r.text) + "</p>";
    }).join("");
    box.innerHTML = "<p class='agilo-ps-prompt-diff-title'>" + escapeHtml(line) + "</p>" +
      "<details class='agilo-ps-prompt-diff-more'><summary>Voir le texte ajouté</summary>" + details + "</details>";
  };
  MaquetteApp.prototype.checkWitness = function () {
    var status = this.$("#witness-status");
    var input = this.$("#witness-phrase");
    if (!status || !input) return;
    var phrase = String(input.value || "").replace(/\s+/g, " ").trim();
    writeWitnessPhrase(phrase);
    if (!phrase) {
      status.textContent = "";
      status.className = "agilo-ps-witness-status";
      return;
    }
    if (!this.frozenAfterHtml) {
      status.textContent = "Saisissez, puis lancez Essayer.";
      status.className = "agilo-ps-witness-status";
      return;
    }
    var hay = stripHtmlToText(this.frozenAfterHtml).toLowerCase();
    var needle = phrase.toLowerCase();
    if (hay.indexOf(needle) !== -1) {
      status.textContent = "encore là";
      status.className = "agilo-ps-witness-status is-kept";
    } else {
      status.textContent = "perdue";
      status.className = "agilo-ps-witness-status is-lost";
    }
  };
  MaquetteApp.prototype.selectDiffSection = function (key) {
    this.diffSelectedKey = key;
    var row = this.diffRows.filter(function (r) { return r.key === key; })[0];
    var detail = this.$("#cr-diff-detail");
    var list = this.$("#cr-diff-sections");
    if (list) {
      Array.prototype.forEach.call(list.querySelectorAll("button[data-section]"), function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-section") === key ? "true" : "false");
        btn.classList.toggle("is-active", btn.getAttribute("data-section") === key);
      });
    }
    if (!detail || !row) return;
    detail.hidden = false;
    detail.innerHTML = "";
    var title = document.createElement("p");
    title.className = "agilo-ps-cr-diff-detail-title";
    title.textContent = sectionDisplayTitle(row, this.diffRows.length) + " · " + sectionStatusLabel(row.status);
    detail.appendChild(title);
    var extracts = pickDiffExtracts(row.beforeText, row.afterText, 2);
    var short = document.createElement("div");
    short.className = "agilo-ps-cr-diff-extracts";
    if (!extracts.added.length && !extracts.removed.length) {
      short.innerHTML = "<p class='agilo-ps-diff-note'>Peu de texte utile à isoler. Comparez les deux colonnes ci-dessous.</p>";
    } else {
      extracts.added.forEach(function (t) {
        short.innerHTML += "<p class='agilo-ps-diff-p agilo-ps-diff-p--add'><span class='agilo-ps-diff-tag agilo-ps-diff-tag--add'>ajouté</span> " + escapeHtml(truncateExtract(t, 180)) + "</p>";
      });
      extracts.removed.forEach(function (t) {
        short.innerHTML += "<p class='agilo-ps-diff-p agilo-ps-diff-p--del'><span class='agilo-ps-diff-tag agilo-ps-diff-tag--del'>retiré</span> " + escapeHtml(truncateExtract(t, 180)) + "</p>";
      });
    }
    detail.appendChild(short);
    var linkBoth = document.createElement("button");
    linkBoth.type = "button";
    linkBoth.className = "agilo-ps-cr-diff-link";
    linkBoth.textContent = "Voir les deux textes";
    linkBoth.addEventListener("click", function () {
      var after = document.getElementById("cr-after");
      if (after && after.scrollIntoView) after.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    detail.appendChild(linkBoth);
    var more = document.createElement("details");
    more.className = "agilo-ps-cr-diff-wordy";
    var sum = document.createElement("summary");
    sum.textContent = "Voir le détail mot à mot";
    more.appendChild(sum);
    var body = document.createElement("div");
    body.className = "agilo-ps-cr-diff-detail-body";
    var full = renderPhraseDiffHtml(row.beforeText, row.afterText);
    var a = sentenceSplit(row.beforeText);
    var b = sentenceSplit(row.afterText);
    if (a.length + b.length > 12) {
      body.innerHTML = "<p class='agilo-ps-diff-note'>Trop long pour tout afficher. " +
        countWords(row.beforeText) + " → " + countWords(row.afterText) + " mots. Utilisez les deux colonnes.</p>";
    } else {
      body.innerHTML = full;
    }
    more.appendChild(body);
    detail.appendChild(more);
  };
  MaquetteApp.prototype.renderCrDiffKo = function () {
    var ko = this.$("#cr-diff-ko");
    var text = this.$("#cr-diff-ko-text");
    var btn = this.$("#btn-delete-copy");
    if (!ko || !text || !btn) return;
    if (!this.coachTried || !this.frozenAfterHtml) {
      ko.hidden = true;
      btn.hidden = true;
      return;
    }
    var m = this.current();
    ko.hidden = false;
    if (m && isDraftModel(m)) {
      text.textContent = "Pas convaincu ? Le modèle d’origine reste dans Catalogue Agilotext.";
      btn.hidden = false;
    } else {
      text.textContent = "Pour itérer sans risque, Enregistrer sous avant de tester.";
      btn.hidden = true;
    }
  };
  MaquetteApp.prototype.renderCrDiff = function () {
    var box = this.$("#cr-diff");
    if (!box) return;
    if (!this.frozenAfterHtml) { this.clearCrDiff(); return; }
    box.hidden = false;
    this.setResultColOpen(true, true);
    var sum = this.$("#cr-diff-summary");
    var counts = this.$("#cr-diff-counts");
    var list = this.$("#cr-diff-sections");
    var detail = this.$("#cr-diff-detail");
    var wordsAfter = countWords(stripHtmlToText(this.frozenAfterHtml));
    if (this.beforeCrMissing || !this.frozenBeforeHtml) {
      this.diffRows = [];
      if (sum) sum.textContent = "Ce qui a changé";
      if (counts) counts.textContent = "Premier compte rendu. Relancez pour comparer.";
      if (list) list.innerHTML = "";
      if (detail) { detail.hidden = true; detail.innerHTML = ""; }
      this.renderCrDiffKo();
      return;
    }
    var rows = alignSections(htmlToSections(this.frozenBeforeHtml), htmlToSections(this.frozenAfterHtml));
    this.diffRows = rows;
    var nTouched = 0;
    rows.forEach(function (r) {
      if (r.status !== "identical") nTouched += 1;
    });
    if (sum) sum.textContent = "Ce qui a changé";
    var wordsBefore = countWords(stripHtmlToText(this.frozenBeforeHtml));
    var wordsLine = wordsBefore + " → " + wordsAfter + " mots";
    if (counts) {
      if (nTouched === 0) {
        counts.textContent = "Le texte a bougé, les titres sont les mêmes. " + wordsLine;
      } else if (nTouched === 1) {
        counts.textContent = "Une partie a changé. " + wordsLine;
      } else {
        counts.textContent = nTouched + " parties ont changé. " + wordsLine;
      }
    }
    if (list) {
      list.innerHTML = "";
      rows.forEach(function (r) {
        if (r.status === "identical" && rows.length > 1) return;
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "agilo-ps-cr-diff-sec agilo-ps-cr-diff-sec--" + r.status;
        btn.setAttribute("data-section", r.key);
        btn.setAttribute("aria-pressed", "false");
        var label = sectionDisplayTitle(r, rows.length);
        btn.setAttribute("aria-label", label + ", " + sectionStatusLabel(r.status));
        var dot = document.createElement("span");
        dot.className = "agilo-ps-cr-diff-dot";
        dot.setAttribute("aria-hidden", "true");
        var lab = document.createElement("span");
        lab.className = "agilo-ps-cr-diff-sec-title";
        lab.textContent = label;
        var st = document.createElement("span");
        st.className = "agilo-ps-cr-diff-sec-state";
        st.textContent = sectionStatusLabel(r.status);
        btn.appendChild(dot);
        btn.appendChild(lab);
        btn.appendChild(st);
        li.appendChild(btn);
        list.appendChild(li);
      });
    }
    if (detail) { detail.hidden = true; detail.innerHTML = ""; }
    this.renderCrDiffKo();
  };
  MaquetteApp.prototype.populateJobs = function (filter, opts) {
    var sel = this.$("#job");
    if (!sel) return;
    opts = opts || {};
    var keepValue = opts.keepValue ? sel.value : "";
    if (filter !== undefined && filter !== null) this.jobsFilter = String(filter);
    var q = String(this.jobsFilter || "").trim().toLowerCase();
    var visible = this.jobs.filter(function (j) { return jobMatchesQuery(j, q); });
    if (keepValue && visible.every(function (j) { return j.jobId !== keepValue; })) {
      var kept = this.jobs.filter(function (j) { return j.jobId === keepValue; })[0];
      if (kept) visible = [kept].concat(visible);
    }
    sel.innerHTML = "";
    var first = document.createElement("option");
    first.value = "";
    if (!this.jobs.length) first.textContent = "Aucun dossier disponible";
    else if (!visible.length) first.textContent = "Aucun résultat";
    else first.textContent = "Choisir un dossier…";
    sel.appendChild(first);
    visible.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.jobId;
      opt.textContent = jobOptionLabel(t);
      opt.title = t.title + " · " + t.jobId;
      sel.appendChild(opt);
    });
    sel.value = keepValue && visible.some(function (j) { return j.jobId === keepValue; }) ? keepValue : "";
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
      var catalogue = isCatalogueModel(m);
      btn.innerHTML = "<span class='agilo-ps-list-item-name'></span><span class='agilo-ps-list-item-meta'><span class='agilo-ps-list-item-id'></span>" + (catalogue ? "<span class='agilo-ps-badge agilo-ps-badge--orig'>Modèle Agilotext</span>" : "") + "</span>";
      var nameEl = btn.querySelector(".agilo-ps-list-item-name");
      if (self.isPinned(m.id)) nameEl.innerHTML = pinSvg;
      nameEl.appendChild(document.createTextNode(m.name));
      btn.querySelector(".agilo-ps-list-item-id").textContent = "id " + m.id;
      if (m.modifiedLabelShort) {
        var when = document.createElement("span");
        when.className = "agilo-ps-list-item-when";
        when.innerHTML = CLOCK_SVG + "<span class='agilo-ps-list-item-when-text'></span>";
        when.querySelector(".agilo-ps-list-item-when-text").textContent = m.modifiedLabelShort;
        btn.appendChild(when);
      }
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
    function group(label, key, defaultOpen, items, variant) {
      var shown = self.sortPinnedFirst(items.filter(matches));
      if (!shown.length) return;
      var persisted = readListGroupOpen(key, defaultOpen);
      var force = shown.some(function (m) { return m.id === self.selectedId; }) || (!!q && shown.length > 0);
      var open = force || persisted;
      var wrap = document.createElement("div");
      wrap.className = "agilo-ps-list-group agilo-ps-list-group--" + variant;
      var lab = document.createElement("button");
      lab.type = "button";
      lab.className = "agilo-ps-list-group-btn agilo-ps-list-group-btn--" + variant;
      lab.setAttribute("aria-expanded", open ? "true" : "false");
      lab.innerHTML = "<span class='agilo-ps-list-group-chevron' aria-hidden='true'><svg viewBox='0 0 18 18' width='12' height='12'><polyline points='6 7 9 10.25 12 7' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'/></svg></span><span class='agilo-ps-list-group-title'></span><span class='agilo-ps-list-group-count'></span>";
      lab.querySelector(".agilo-ps-list-group-title").textContent = label;
      lab.querySelector(".agilo-ps-list-group-count").textContent = "(" + shown.length + ")";
      var body = document.createElement("div");
      body.className = "agilo-ps-list-group-body";
      body.hidden = !open;
      lab.addEventListener("click", function () {
        var next = body.hidden;
        body.hidden = !next;
        lab.setAttribute("aria-expanded", next ? "true" : "false");
        writeListGroupOpen(key, next);
      });
      wrap.appendChild(lab);
      wrap.appendChild(body);
      listEl.appendChild(wrap);
      var prevList = listEl;
      listEl = body;
      shown.forEach(appendItem);
      listEl = prevList;
    }
    group("Vos copies", LS_LIST_GROUP_USER, true, this.models.filter(function (m) { return !isCatalogueModel(m); }), "user");
    group("Catalogue Agilotext", LS_LIST_GROUP_CATALOGUE, false, this.models.filter(function (m) { return isCatalogueModel(m); }), "catalogue");
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
      this.$("#detail-badge").hidden = true;
      this.$("#editor").value = "";
      this.$("#editor-html").value = "";
      this.syncFooterCtas(null);
      this.promptBaseline = "";
      this.refreshLayoutPreview();
      this.clearAfter();
      this.renderPromptDiff();
      this.renderTrialHtml(this.$("#cr-before"), "", "Choisissez un modèle.");
      return;
    }
    this.$("#detail-title").textContent = m.name;
    var badge = this.$("#detail-badge");
    badge.hidden = false;
    if (isCatalogueModel(m)) {
      badge.textContent = "Modèle Agilotext";
      badge.className = "agilo-ps-badge agilo-ps-badge--orig";
    } else {
      badge.textContent = "Votre copie";
      badge.className = "agilo-ps-badge agilo-ps-badge--draft";
    }
    this.$("#detail-meta").textContent = "ID " + m.id + " · Modifié " + (m.modifiedLabel || "récemment");
    this.$("#editor").value = m.prompt || "";
    this.$("#editor-html").value = m.html || "";
    this.$("#dirty-banner").hidden = true;
    this.$("#char-count").textContent = (m.prompt || "").length + " car.";
    this.promptBaseline = m.prompt || "";
    this.resetCoachFlow();
    this.syncFooterCtas(m);
    this.refreshLayoutPreview();
    this.clearAfter();
    this.renderPromptDiff();
    this.renderCoach();
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
        m = { id: id, name: "Modèle " + id, origin: "user", kind: "draft", pinned: false, modifiedAt: "", modifiedLabel: "", modifiedLabelShort: "", prompt: "", html: "" };
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
      this.coachSaved = true;
      this.coachTried = false;
      this.syncCoachSteps();
      await this.loadList();
      var leave = this.pendingLeaveAfterSaveAs;
      this.pendingLeaveAfterSaveAs = null;
      if (leave) {
        this.saving = false;
        leave();
        return;
      }
      await this.select(copyId, { force: true });
      this.coachHasConsigne = true;
      this.coachSaved = true;
      this.coachTried = false;
      this.syncCoachSteps();
      this.syncCoachChipsOn();
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
      this.promptBaseline = text;
      this.coachSaved = true;
      this.coachTried = false;
      this.syncFooterCtas(m);
      this.renderPromptDiff();
      this.syncCoachSteps();
      this.toast("Copie enregistrée (texte + HTML).");
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
    this.renderPromptDiff();
    this.syncCoachSteps();
    this.syncCoachChipsOn();
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
    var label = j.title || j.file || j.jobId;
    var extra = "Le compte rendu officiel de « " + label + " » sera remplacé. 1 crédit. La transcription ne change pas.";
    if (isInternalLab() && !isWitnessJobId(j.jobId)) {
      extra += " En interne : préférez un dossier court, pas un meeting long.";
    }
    this.$("#redo-body").textContent = extra;
    this.$("#dialog-redo").classList.add("is-open");
  };
  MaquetteApp.prototype.closeRedoConfirm = function () {
    this.$("#dialog-redo").classList.remove("is-open");
  };
  MaquetteApp.prototype.runTry = async function () {
    if (this.trying || this.saving || !this.$("#job").value) return;
    var m = this.current();
    if (!m) return;
    var gate = this.creditsGate();
    if (!gate.allowed) {
      if (gate.reason === "free") this.toast("Plan gratuit : pas d’essai.");
      else this.toast("Plus d’essais restants pour ce dossier (" + gate.count + " / " + gate.limit + ").");
      return;
    }
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
    this.setResultColOpen(true, true);
    this.frozenAfterHtml = "";
    this.clearCrDiff();
    if (this.frozenBeforeHtml) {
      this.renderTrialHtml(this.$("#cr-before"), this.frozenBeforeHtml, "Pas de CR sur ce dossier.");
    }
    var after = this.$("#cr-after");
    after.innerHTML = "<p class='agilo-ps-cr-empty'>Génération du compte-rendu en cours…</p><div class='agilo-ps-skel-line'></div><div class='agilo-ps-skel-line' style='width:80%'></div>";
    try {
      var ready = await this.client.waitPromptReady(m.id, { maxMs: 120000, pollMs: 2000 });
      if (!ready) throw new Error("Le modèle n’est pas READY. Enregistrez, puis réessayez.");
      var priorHash = await this.client.fetchPriorSummaryContentHash(j.jobId);
      await this.client.redoSummary(j.jobId, m.id);
      this.toast("Régénération lancée…");
      var done = await this.client.waitJobSummaryReady(j.jobId, {
        priorContentHash: priorHash,
        onTick: function (t) {
          after.innerHTML = "<p class='agilo-ps-cr-empty'>Génération du compte-rendu en cours… " + formatElapsed(t.elapsedMs) + "</p><div class='agilo-ps-skel-line'></div><div class='agilo-ps-skel-line' style='width:80%'></div>";
        }
      });
      if (!done || !done.ok) {
        throw new Error("Toujours en cours, ouvrez le dossier dans l’éditeur.");
      }
      this.renderTrialHtml(after, done.html, "CR vide.");
      this.frozenAfterHtml = done.html || "";
      var auth = this.getAuth() || {};
      incrementRegenerationCount(j.jobId, auth.edition || "ent");
      this.syncCreditsLabel();
      this.coachTried = true;
      this.coachSaved = true;
      this.syncCoachSteps();
      this.renderCrDiff();
      this.beforeCrMissing = false;
      this.frozenBeforeHtml = done.html || this.frozenBeforeHtml;
      this.toast("Compte rendu officiel remplacé.");
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
    this.frozenAfterHtml = "";
    this.beforeCrMissing = false;
    this.clearAfter();
    this.syncTryCta();
    this.syncEditorLink();
    if (!j) {
      this.renderTrialHtml(this.$("#cr-before"), "", "Choisissez un dossier pour afficher le CR actuel.");
      return;
    }
    this.renderTrialHtml(this.$("#cr-before"), "", "Chargement du CR actuel…");
    try {
      var result = await this.client.receiveSummaryResult(j.jobId);
      if (result.missing) {
        this.beforeCrMissing = true;
        this.renderTrialHtml(this.$("#cr-before"), "", "Pas de CR actuel. Premier CR pour ce dossier. Essayer va en créer un (1 crédit).");
        return;
      }
      if (!result.ok) {
        this.beforeCrMissing = true;
        this.renderTrialHtml(this.$("#cr-before"), "", "CR actuel indisponible : " + (result.message || ""));
        return;
      }
      this.frozenBeforeHtml = result.html;
      this.beforeCrMissing = false;
      this.renderTrialHtml(this.$("#cr-before"), result.html, "Pas de CR sur ce dossier.");
    } catch (e) {
      var msg = e && e.message ? String(e.message) : String(e);
      if (isSummaryMissingText(msg)) {
        this.beforeCrMissing = true;
        this.renderTrialHtml(this.$("#cr-before"), "", "Pas de CR actuel. Premier CR pour ce dossier. Essayer va en créer un (1 crédit).");
      } else {
        this.renderTrialHtml(this.$("#cr-before"), "", "CR actuel indisponible : " + msg);
      }
    }
    this.syncTryCta();
    this.syncEditorLink();
  };
  MaquetteApp.prototype.openExpand = function (which) {
    var back = this.$("#expand-back");
    var frame = this.$("#expand-frame");
    if (!back || !frame) return;
    back.classList.add("is-open");
    if (which === "layout") {
      var layoutHtml = (this.$("#editor-html") && this.$("#editor-html").value || "").trim();
      this.setIframe(frame, layoutHtml || "<p style='font-family:system-ui;padding:1rem;color:#6b7280'>Aucun HTML à prévisualiser.</p>", "expand");
      return;
    }
    if (which === "before") {
      this.setIframe(frame, this.frozenBeforeHtml, "expand");
      return;
    }
    if (this.blobUrls.after) {
      if (this.blobUrls.expand) {
        URL.revokeObjectURL(this.blobUrls.expand);
        this.blobUrls.expand = null;
      }
      frame.removeAttribute("src");
      frame.src = this.blobUrls.after;
      return;
    }
    this.setIframe(frame, "", "expand");
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
    this.jobsFilter = "";
    if (this.$("#job-search")) this.$("#job-search").value = "";
    this.populateJobs("");
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
    this.$("#btn-toggle-try").addEventListener("click", function () { self.toggleResultCol(); });
    this.$("#btn-collapse-try").addEventListener("click", function () { self.setResultColOpen(false, true); });
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
    var editor = this.$("#editor");
    var editorHtml = this.$("#editor-html");
    if (editor) editor.spellcheck = false;
    if (editorHtml) editorHtml.spellcheck = false;
    function onPromptInput() {
      self.markDirty();
      self.$("#char-count").textContent = (self.$("#editor").value || "").length + " car.";
    }
    function onHtmlInput() {
      self.markDirty();
      if (self.layoutView === "preview") self.refreshLayoutPreview();
      else self.renderLayoutMeta();
    }
    editor.addEventListener("input", onPromptInput);
    editorHtml.addEventListener("input", onHtmlInput);
    bindLineBreakFilet(editor, onPromptInput);
    bindLineBreakFilet(editorHtml, onHtmlInput);
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
    this.$("#job").addEventListener("change", function () {
      self.syncTryCta();
      self.loadJobBefore();
    });
    if (this.$("#job-search")) {
      this.$("#job-search").addEventListener("input", function (e) {
        self.populateJobs(e.target.value, { keepValue: true });
      });
    }
    this.$("#btn-try").addEventListener("click", function () { self.runTry(); });
    this.$("#redo-cancel").addEventListener("click", function () { self.closeRedoConfirm(); });
    this.$("#redo-ok").addEventListener("click", function () { self.executeRedo(); });
    this.$("#redo-dl").addEventListener("click", function () { self.downloadCurrentCr(); });
    var coachList = this.$("#coach-list");
    var coachExtra = this.$("#coach-extra");
    function onPatchClick(e) {
      var t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
      var btn = t && t.closest ? t.closest("[data-patch]") : null;
      if (!btn) return;
      self.applyRustine(btn.getAttribute("data-patch"));
    }
    if (coachList) coachList.addEventListener("click", onPatchClick);
    if (coachExtra) coachExtra.addEventListener("click", onPatchClick);
    var btnDelCopy = this.$("#btn-delete-copy");
    if (btnDelCopy) {
      btnDelCopy.addEventListener("click", function () { self.doDelete(); });
    }
    var secList = this.$("#cr-diff-sections");
    if (secList) {
      secList.addEventListener("click", function (e) {
        var t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
        var btn = t && t.closest ? t.closest("button[data-section]") : null;
        if (!btn) return;
        self.selectDiffSection(btn.getAttribute("data-section"));
      });
    }
    var witness = this.$("#witness-phrase");
    if (witness) {
      witness.addEventListener("input", function () { self.checkWitness(); });
    }
    this.$("#btn-expand-before").addEventListener("click", function () { self.openExpand("before"); });
    this.$("#btn-expand-after").addEventListener("click", function () { self.openExpand("after"); });
    this.$("#btn-expand-layout").addEventListener("click", function () { self.openExpand("layout"); });
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
