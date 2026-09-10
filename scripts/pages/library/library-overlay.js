/**
 * Overlay unique (fiche, wizard, versions) sur document.body.
 * Hors du paint() catalogue. Escape, focus, scroll lock.
 * @version 1.3.0
 */
(function (global) {
  "use strict";

  var HOST_ID = "agilo-lib-overlay";
  var lastFocus = null;
  var onCloseCb = null;
  var keyHandler = null;
  var mode = "";

  function host() {
    var el = document.getElementById(HOST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = HOST_ID;
      el.className = "agilo-lib agilo-lib-overlay";
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    if (global.AgiloLibraryApi && global.AgiloLibraryApi.cfg && global.AgiloLibraryApi.cfg().uiV2) {
      el.classList.add("agilo-lib--v2");
    }
    return el;
  }

  function focusables(panel) {
    return Array.prototype.slice.call(panel.querySelectorAll(
      "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    ));
  }

  function unbindKeys() {
    if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
    keyHandler = null;
  }

  function closeLibMenus() {
    var C = global.AgiloLibraryCore;
    if (C && typeof C.closeMenus === "function") C.closeMenus();
  }

  function bindKeys(panel) {
    unbindKeys();
    keyHandler = function (e) {
      if (e.key === "Escape") {
        if (document.querySelector(".agilo-lib-menu")) {
          e.preventDefault();
          closeLibMenus();
          return;
        }
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      var list = focusables(panel);
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyHandler, true);
  }

  function panelMarkup(opts) {
    var C = global.AgiloLibraryCore;
    var title = (C && C.escapeHtml) ? C.escapeHtml(opts.title || "") : String(opts.title || "");
    var closeIco = C && C.svgIcon ? C.svgIcon("xmark", 16) : "×";
    return '<div class="agilo-lib-overlay__backdrop" data-overlay-dismiss="1"></div>' +
      '<div class="agilo-lib-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="agilo-lib-overlay-title">' +
      '<div class="agilo-lib-overlay__head">' +
      '<h2 id="agilo-lib-overlay-title">' + title + "</h2>" +
      '<button type="button" class="agilo-lib-icon-btn" data-overlay-close aria-label="Fermer">' + closeIco + "</button>" +
      "</div>" +
      '<div class="agilo-lib-overlay__body">' + (opts.html || "") + "</div></div>";
  }

  function wireChrome(el, opts) {
    var panel = el.querySelector(".agilo-lib-overlay__panel");
    el.querySelector("[data-overlay-close]").addEventListener("click", function () { close(); });
    el.querySelector("[data-overlay-dismiss]").addEventListener("click", function () { close(); });
    bindKeys(panel);
    if (typeof opts.bind === "function") opts.bind(el);
    var prefer = panel.querySelector("input, textarea");
    var fallback = panel.querySelector("[data-overlay-close]");
    (prefer || fallback).focus();
  }

  function open(opts) {
    opts = opts || {};
    closeLibMenus();
    var el = host();
    if (!isOpen()) lastFocus = document.activeElement;
    onCloseCb = opts.onClose || null;
    mode = opts.mode || "";
    el.hidden = false;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    el.setAttribute("data-mode", mode);
    el.innerHTML = panelMarkup(opts);
    document.body.classList.add("agilo-lib-overlay-lock");
    wireChrome(el, opts);
  }

  function update(opts) {
    opts = opts || {};
    var el = host();
    if (!isOpen() || (opts.mode && mode !== opts.mode)) {
      open(opts);
      return;
    }
    if (opts.onClose) onCloseCb = opts.onClose;
    var h = el.querySelector("#agilo-lib-overlay-title");
    var body = el.querySelector(".agilo-lib-overlay__body");
    if (h && opts.title != null) {
      h.textContent = opts.title;
    }
    if (body && opts.html != null) body.innerHTML = opts.html;
    var panel = el.querySelector(".agilo-lib-overlay__panel");
    bindKeys(panel);
    if (typeof opts.bind === "function") opts.bind(el);
  }

  function close(opts) {
    opts = opts || {};
    closeLibMenus();
    var el = document.getElementById(HOST_ID);
    unbindKeys();
    var cb = onCloseCb;
    onCloseCb = null;
    mode = "";
    if (el) {
      el.classList.remove("is-open");
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      el.removeAttribute("data-mode");
      el.innerHTML = "";
    }
    document.body.classList.remove("agilo-lib-overlay-lock");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (_) { /* ignore */ }
    }
    lastFocus = null;
    if (!opts.silent && typeof cb === "function") cb();
  }

  function isOpen() {
    var el = document.getElementById(HOST_ID);
    return !!(el && el.classList.contains("is-open"));
  }

  global.AgiloLibraryOverlay = {
    host: host,
    open: open,
    update: update,
    close: close,
    isOpen: isOpen
  };
})(typeof window !== "undefined" ? window : globalThis);
