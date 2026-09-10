/**
 * Page bibliothèque Webflow. Charger après token-resolver + agilo-editor-creds.
 * uiV2: true → AgiloLibraryCatalogV2 (library-catalog-v2.js), sinon catalogue v1.
 * @version 1.4.0
 */
(function (global) {
  "use strict";

  var hostEl = null;
  var mounted = false;
  var authFailed = false;
  var loading = false;

  function showError(root, msg) {
    if (!root) return;
    var safe = global.AgiloLibraryApi && global.AgiloLibraryApi.sanitizeUserMessage
      ? global.AgiloLibraryApi.sanitizeUserMessage(msg, false)
      : msg;
    root.innerHTML =
      '<div class="agilo-lib"><div class="agilo-lib-banner agilo-lib-banner--error" role="alert">' +
      "<span>" + (global.AgiloLibraryCore ? global.AgiloLibraryCore.escapeHtml(safe) : safe) +
      "</span></div></div>";
  }

  function catalog() {
    var cfg = global.AgiloLibraryApi.cfg();
    if (cfg.uiV2 && global.AgiloLibraryCatalogV2) return global.AgiloLibraryCatalogV2;
    return global.AgiloLibraryCatalog;
  }

  function skeletonHtml() {
    var C = global.AgiloLibraryCore;
    var cards = C.skeletonCard() + C.skeletonCard() + C.skeletonCard() +
      C.skeletonCard() + C.skeletonCard() + C.skeletonCard();
    if (global.AgiloLibraryApi.cfg().uiV2) {
      return '<div class="agilo-lib-head agilo-lib-head--v2"><h1>Modèles de documents</h1></div>' +
        '<div class="agilo-lib-tabs" aria-hidden="true">' +
        '<span class="agilo-lib-tab is-active">Modèles Agilotext</span>' +
        '<span class="agilo-lib-tab">Mes modèles</span>' +
        '<span class="agilo-lib-tab">Épinglés</span></div>' +
        '<div class="agilo-lib-grid">' + cards + "</div>";
    }
    return '<div class="agilo-lib-head"><div><h1>Modèles de documents</h1>' +
      "<p>Chargement de tes modèles…</p></div></div>" +
      '<div class="agilo-lib-tabs" aria-hidden="true">' +
      '<span class="agilo-lib-tab is-active">Modèles Agilotext</span>' +
      '<span class="agilo-lib-tab">Mes modèles</span>' +
      '<span class="agilo-lib-tab">Épinglés</span>' +
      '<span class="agilo-lib-tab">Créer un modèle</span></div>' +
      '<div class="agilo-lib-grid">' + cards + "</div>";
  }

  function load(host) {
    if (loading) return;
    loading = true;
    host.innerHTML = skeletonHtml();
    global.AgiloLibraryApi.waitForCreds().then(function (creds) {
      return Promise.all([
        global.AgiloLibraryApi.fetchLists(creds),
        global.AgiloLibraryApi.fetchMemberAccess(creds)
      ]).then(function (pair) {
        mounted = true;
        authFailed = false;
        loading = false;
        if (global.AgiloLibraryApi.setActiveCreds) global.AgiloLibraryApi.setActiveCreds(creds);
        catalog().mount(host, creds, pair[1], pair[0]);
      });
    }).catch(function (err) {
      loading = false;
      authFailed = !!(global.AgiloLibraryApi && global.AgiloLibraryApi.isAuthError &&
        global.AgiloLibraryApi.isAuthError(err));
      showError(host, (err && err.message) || "Reconnecte-toi pour voir tes modèles.");
    });
  }

  function boot() {
    var cfg = global.AgiloLibraryApi.cfg();
    var host = document.querySelector(cfg.mountSelector);
    if (!host) return;
    hostEl = host;
    host.classList.add("agilo-lib");
    if (cfg.uiV2) host.classList.add("agilo-lib--v2");

    var mockKey = "";
    try {
      mockKey = new URLSearchParams(global.location.search).get("mock") || "";
    } catch (_) { mockKey = ""; }
    if (mockKey && global.AgiloLibraryPreviewMock && typeof global.AgiloLibraryPreviewMock.mount === "function") {
      global.AgiloLibraryPreviewMock.mount(host, mockKey);
      return;
    }

    load(host);

    if (!global.__agiloLibTokenBound) {
      global.__agiloLibTokenBound = true;
      global.addEventListener("agilo:token", function (e) {
        if (!e || !e.detail || !e.detail.token) return;
        if (!hostEl || !hostEl.isConnected) return;
        if (authFailed || !mounted) load(hostEl);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
