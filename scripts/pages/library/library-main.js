/**
 * Page bibliothèque Webflow. Charger après token-resolver + agilo-editor-creds.
 * @version 1.1.0
 */
(function (global) {
  "use strict";

  function showError(root, msg) {
    if (!root) return;
    root.innerHTML =
      '<div class="agilo-lib"><div class="agilo-lib-banner agilo-lib-banner--error" role="alert">' +
      "<span>" + (global.AgiloLibraryCore ? global.AgiloLibraryCore.escapeHtml(msg) : msg) +
      "</span></div></div>";
  }

  function skeletonHtml() {
    var C = global.AgiloLibraryCore;
    var cards = C.skeletonCard() + C.skeletonCard() + C.skeletonCard() +
      C.skeletonCard() + C.skeletonCard() + C.skeletonCard();
    return '<div class="agilo-lib-head"><div><h1>Modèles de documents</h1>' +
      "<p>Chargement de tes modèles…</p></div></div>" +
      '<div class="agilo-lib-tabs" aria-hidden="true">' +
      '<span class="agilo-lib-tab is-active">Modèles Agilotext</span>' +
      '<span class="agilo-lib-tab">Mes modèles</span>' +
      '<span class="agilo-lib-tab">Épinglés</span>' +
      '<span class="agilo-lib-tab">Créer un modèle</span></div>' +
      '<div class="agilo-lib-grid">' + cards + "</div>";
  }

  function boot() {
    var cfg = global.AgiloLibraryApi.cfg();
    var host = document.querySelector(cfg.mountSelector);
    if (!host) return;
    host.classList.add("agilo-lib");
    host.innerHTML = skeletonHtml();

    var mockKey = "";
    try {
      mockKey = new URLSearchParams(global.location.search).get("mock") || "";
    } catch (_) { mockKey = ""; }
    if (mockKey && global.AgiloLibraryPreviewMock && typeof global.AgiloLibraryPreviewMock.mount === "function") {
      global.AgiloLibraryPreviewMock.mount(host, mockKey);
      return;
    }

    global.AgiloLibraryApi.waitForCreds().then(function (creds) {
      return Promise.all([
        global.AgiloLibraryApi.fetchLists(creds),
        global.AgiloLibraryApi.fetchMemberAccess(creds)
      ]).then(function (pair) {
        global.AgiloLibraryCatalog.mount(host, creds, pair[1], pair[0]);
      });
    }).catch(function (err) {
      showError(host, err.message || "Reconnecte-toi pour voir tes modèles.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
