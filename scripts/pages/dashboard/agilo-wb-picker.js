/**
 * Picker dashboard « Mots à surveiller ».
 * Jumeau visuel du picker PV : injecté sous #agilo-prompt-picker-anchor.
 * v1 : getWordBoostInfo2 + setWordBoostDefault2 au change (défaut compte).
 * Pas de boostId dans l’upload tant que Nico n’a pas le champ.
 * @version 1.0.0
 */
(function (global) {
  "use strict";

  var VERSION = "1.0.0";
  var API = "https://api.agilotext.com/api/v1";
  var booted = false;
  var loading = false;

  function editionFromPath(pathname) {
    var path = String(pathname || "").toLowerCase();
    if (path.indexOf("/app/free") !== -1 || path.indexOf("/free/") !== -1) return "free";
    if (path.indexOf("/app/premium") !== -1 || path.indexOf("/app/pro/") !== -1 || path.indexOf("/premium/") !== -1) {
      return "pro";
    }
    return "ent";
  }

  function profileSlugFromPath(pathname) {
    var path = String(pathname || "").toLowerCase();
    if (path.indexOf("/app/free") !== -1 || path.indexOf("/free/") !== -1) return "free";
    if (path.indexOf("/app/premium") !== -1 || path.indexOf("/app/pro/") !== -1 || path.indexOf("/premium/") !== -1) {
      return "premium";
    }
    return "business";
  }

  function profileManageUrl(pathname) {
    return "/app/" + profileSlugFromPath(pathname) + "/profile?tab=mots-cles";
  }

  function themeStatus(item) {
    if (!item) return "";
    return String(item.wordboostStatus || item.status || item.boostStatus || "").toUpperCase();
  }

  function isSelectableTheme(item) {
    var st = themeStatus(item);
    if (!st) return true;
    return st === "READY";
  }

  function parseCatalog(payload) {
    var r = payload || {};
    var list = (r.boostNamesDTOList || []).map(function (x) {
      return {
        id: +x.boostId || 0,
        name: String(x.boostName || "Sans nom"),
        wordboostStatus: x.wordboostStatus || x.status || x.boostStatus || ""
      };
    }).filter(function (x) {
      return x.id > 0 && isSelectableTheme(x);
    });
    return {
      defaultId: +r.defaultBoostId || 0,
      list: list
    };
  }

  function optionLabel(item, defaultId) {
    var name = String((item && item.name) || "Sans nom");
    if (item && item.id === defaultId) return name + " (défaut)";
    return name;
  }

  function ensureStyle(doc) {
    if (!doc || !doc.head || doc.getElementById("agilo-wb-picker-style")) return;
    var style = doc.createElement("style");
    style.id = "agilo-wb-picker-style";
    style.textContent =
      ".agilo-wb-picker .agilo-wb-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}" +
      ".agilo-wb-picker .agilo-wb-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;" +
      "background:#e8eef6;color:#174a96;font-size:12px;line-height:1.4;white-space:nowrap;}" +
      ".agilo-wb-picker .agilo-wb-pill[hidden]{display:none!important;}" +
      ".agilo-wb-picker .agilo-wb-manage{white-space:nowrap;text-decoration:underline;color:inherit;}";
    doc.head.appendChild(style);
  }

  function findPvContainer(doc) {
    var anchor = doc.getElementById("agilo-prompt-picker-anchor");
    var select = doc.getElementById("default-template-select");
    var node = anchor || select;
    if (!node) return null;
    if (node.closest) {
      var box = node.closest(".select-container");
      if (box) return box;
    }
    return node.parentNode || null;
  }

  function injectBlock(doc) {
    if (!doc || !doc.createElement) return null;
    var existing = doc.getElementById("agilo-wb-picker-anchor");
    if (existing) return existing;
    var after = findPvContainer(doc);
    if (!after || !after.parentNode) return null;
    ensureStyle(doc);
    var wrap = doc.createElement("div");
    wrap.className = "select-container agilo-wb-picker";
    wrap.setAttribute("data-agilo-wb-picker", "1");
    wrap.innerHTML =
      '<div id="agilo-wb-picker-anchor"></div>' +
      '<div class="custom-select-wrapper flex">' +
      '<div class="wrapper-info">' +
      '<div class="text-size-small text-weight-bold">Mots à surveiller</div>' +
      "</div>" +
      '<div class="wrapper-select agilo-wb-row">' +
      '<select class="custom-select grey" id="agilo-wb-select" aria-label="Mots à surveiller">' +
      '<option value="">Chargement…</option>' +
      "</select>" +
      '<span class="agilo-wb-pill" id="agilo-wb-pill" hidden>Par défaut</span>' +
      '<a class="text-size-small agilo-wb-manage" id="agilo-wb-manage" href="#">Gérer</a>' +
      "</div></div>";
    after.parentNode.insertBefore(wrap, after.nextSibling);
    return doc.getElementById("agilo-wb-picker-anchor");
  }

  function toast(msg) {
    if (global.AgiloLibraryCore && typeof global.AgiloLibraryCore.toast === "function") {
      global.AgiloLibraryCore.toast(msg);
      return;
    }
    if (typeof document === "undefined") return;
    var el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;bottom:20px;left:20px;background:#111;color:#fff;" +
      "padding:10px 16px;border-radius:6px;font-size:15px;z-index:999999;";
    document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2600);
  }

  function post(route, params) {
    return fetch(API + "/" + route, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      credentials: "omit"
    }).then(function (res) {
      return res.text().then(function (txt) {
        try {
          return JSON.parse(txt);
        } catch (err) {
          throw new Error("Réponse invalide");
        }
      });
    });
  }

  function pickEmail() {
    if (typeof document === "undefined") return "";
    var byName = document.querySelector('[name="memberEmail"]');
    return String(
      (byName && byName.value) ||
      global.globalEmail ||
      global.memberEmail ||
      ""
    ).trim();
  }

  function pickEdition() {
    if (typeof document !== "undefined") {
      var named = document.querySelector('[name="edition"]');
      var raw = named && named.value ? String(named.value).toLowerCase() : "";
      if (raw === "free" || raw === "pro" || raw === "ent") return raw;
      if (raw === "premium") return "pro";
      if (raw === "business" || raw === "enterprise") return "ent";
    }
    if (global.window && global.window.edition) {
      var w = String(global.window.edition).toLowerCase();
      if (w === "free" || w === "pro" || w === "ent") return w;
    }
    var path = (global.location && global.location.pathname) || "";
    return editionFromPath(path);
  }

  function waitForCreds() {
    if (global.AgiloLibraryApi && typeof global.AgiloLibraryApi.waitForCreds === "function") {
      return global.AgiloLibraryApi.waitForCreds();
    }
    return new Promise(function (resolve, reject) {
      var tries = 0;
      function tick() {
        var email = pickEmail();
        var token = String(global.globalToken || "").trim();
        if (email && token) {
          resolve({ email: email, username: email, token: token, edition: pickEdition() });
          return;
        }
        tries += 1;
        if (tries > 40) {
          reject(new Error("Reconnecte-toi."));
          return;
        }
        setTimeout(tick, 250);
      }
      tick();
    });
  }

  function fillSelect(select, catalog) {
    if (!select) return;
    select.innerHTML = "";
    if (!catalog.list.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Aucun thème";
      empty.disabled = true;
      empty.selected = true;
      select.appendChild(empty);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    var pick = catalog.list.some(function (x) { return x.id === catalog.defaultId; })
      ? catalog.defaultId
      : catalog.list[0].id;
    catalog.list.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = String(item.id);
      opt.textContent = optionLabel(item, catalog.defaultId);
      if (item.id === pick) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function updatePill(doc, catalog, selectedId) {
    var pill = doc.getElementById("agilo-wb-pill");
    if (!pill) return;
    if (selectedId && selectedId === catalog.defaultId) pill.removeAttribute("hidden");
    else pill.setAttribute("hidden", "");
  }

  function bind(doc, creds) {
    var select = doc.getElementById("agilo-wb-select");
    var manage = doc.getElementById("agilo-wb-manage");
    var path = (global.location && global.location.pathname) || "";
    if (manage) manage.setAttribute("href", profileManageUrl(path));
    if (!select) return;

    var catalog = { defaultId: 0, list: [] };
    var busy = false;

    function load() {
      return post("getWordBoostInfo2", {
        username: creds.email || creds.username,
        token: creds.token,
        edition: creds.edition || pickEdition()
      }).then(function (r) {
        if (!r || r.status !== "OK") throw new Error((r && r.errorMessage) || "Catalogue indisponible.");
        catalog = parseCatalog(r);
        fillSelect(select, catalog);
        updatePill(doc, catalog, +select.value || 0);
      }).catch(function (err) {
        fillSelect(select, { defaultId: 0, list: [] });
        toast((err && err.message) || "Impossible de charger les thèmes.");
      });
    }

    select.addEventListener("change", function () {
      var boostId = +select.value || 0;
      if (!boostId || busy) return;
      if (boostId === catalog.defaultId) {
        updatePill(doc, catalog, boostId);
        return;
      }
      busy = true;
      select.disabled = true;
      post("setWordBoostDefault2", {
        username: creds.email || creds.username,
        token: creds.token,
        edition: creds.edition || pickEdition(),
        boostId: boostId
      }).then(function (r) {
        if (!r || r.status !== "OK") throw new Error((r && r.errorMessage) || "Défaut non enregistré.");
        catalog.defaultId = boostId;
        fillSelect(select, catalog);
        updatePill(doc, catalog, boostId);
        toast("Thème par défaut mis à jour.");
      }).catch(function (err) {
        toast((err && err.message) || "Impossible d’enregistrer le thème.");
        fillSelect(select, catalog);
        updatePill(doc, catalog, catalog.defaultId);
      }).then(function () {
        busy = false;
        select.disabled = !catalog.list.length;
      });
    });

    return load();
  }

  function boot() {
    if (typeof document === "undefined") return;
    if (booted || loading) return;
    if (!findPvContainer(document)) return;
    loading = true;
    var anchor = injectBlock(document);
    if (!anchor) {
      loading = false;
      return;
    }
    waitForCreds().then(function (creds) {
      booted = true;
      loading = false;
      return bind(document, creds);
    }).catch(function (err) {
      loading = false;
      toast((err && err.message) || "Reconnecte-toi.");
    });
  }

  function scheduleBoot() {
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
    if (!global.__agiloWbPickerTokenBound && typeof global.addEventListener === "function") {
      global.__agiloWbPickerTokenBound = true;
      global.addEventListener("agilo:token", function (e) {
        if (!e || !e.detail || !e.detail.token) return;
        if (!booted) boot();
      });
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (booted || tries > 40) {
        clearInterval(timer);
        return;
      }
      if (findPvContainer(document)) boot();
    }, 250);
  }

  scheduleBoot();

  global.AgiloWbPicker = {
    VERSION: VERSION,
    editionFromPath: editionFromPath,
    profileSlugFromPath: profileSlugFromPath,
    profileManageUrl: profileManageUrl,
    parseCatalog: parseCatalog,
    isSelectableTheme: isSelectableTheme,
    optionLabel: optionLabel,
    injectBlock: injectBlock,
    boot: boot
  };
})(typeof window !== "undefined" ? window : global);
