/**
 * Page bibliothèque Webflow. Charger après token-resolver + agilo-editor-creds.
 * @version 1.0.0
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

  function boot() {
    var cfg = global.AgiloLibraryApi.cfg();
    var host = document.querySelector(cfg.mountSelector);
    if (!host) return;
    host.classList.add("agilo-lib");
    host.innerHTML =
      '<div class="agilo-lib-grid">' +
      global.AgiloLibraryCore.skeletonCard() +
      global.AgiloLibraryCore.skeletonCard() +
      global.AgiloLibraryCore.skeletonCard() +
      "</div>";

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
