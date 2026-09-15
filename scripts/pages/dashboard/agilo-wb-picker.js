/**
 * Picker dashboard « Mots à surveiller ».
 * Pro/Business : ligne details muted. Free : ligne verrouillée + AgiloGate.
 * @version 1.2.0
 */
(function (global) {
  "use strict";

  var VERSION = "1.2.0";
  var API = "https://api.agilotext.com/api/v1";
  var LAST_KEY = "wb2:lastThemeId";
  var STYLE_ID = "agilo-wb-picker-style-120";
  var LOCK_ALERT = "Les mots à surveiller sont réservés aux offres Pro et Business.";
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

  function parseCatalog(payload) {
    var r = payload || {};
    var list = (r.boostNamesDTOList || []).map(function (x) {
      return {
        id: +x.boostId || 0,
        name: String(x.boostName || "Sans nom")
      };
    }).filter(function (x) {
      return x.id > 0;
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

  function pickCurrentId(catalog, lastId) {
    var list = (catalog && catalog.list) || [];
    var def = catalog && catalog.defaultId;
    if (list.some(function (x) { return x.id === def; })) return def;
    var last = +lastId || 0;
    if (list.some(function (x) { return x.id === last; })) return last;
    return list[0] ? list[0].id : 0;
  }

  function readLastId() {
    try {
      return +(global.localStorage && global.localStorage.getItem(LAST_KEY) || 0);
    } catch (_e) {
      return 0;
    }
  }

  function writeLastId(id) {
    try {
      if (global.localStorage) global.localStorage.setItem(LAST_KEY, String(id));
    } catch (_e) { /* ignore */ }
  }

  function shouldLock(edition) {
    return String(edition || "").toLowerCase() === "free";
  }

  function showUpgrade() {
    if (global.AgiloGate && typeof global.AgiloGate.showUpgrade === "function") {
      global.AgiloGate.showUpgrade("pro", "Mots à surveiller");
      return;
    }
    if (typeof global.alert === "function") {
      global.alert(LOCK_ALERT);
    }
  }

  function shouldReveal(ok, catalog) {
    return !!(ok && catalog && catalog.list && catalog.list.length);
  }

  function applyReveal(wrap, ok, catalog) {
    if (!wrap) return;
    wrap.hidden = !shouldReveal(ok, catalog);
  }

  function findWrap(doc) {
    var anchor = doc && doc.getElementById("agilo-wb-picker-anchor");
    return anchor && anchor.closest ? anchor.closest(".agilo-wb-picker") : null;
  }

  function ensureStyle(doc) {
    if (!doc || !doc.head) return;
    var staleIds = ["agilo-wb-picker-style", "agilo-wb-picker-style-111"];
    var i;
    for (i = 0; i < staleIds.length; i += 1) {
      var stale = doc.getElementById(staleIds[i]);
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    }
    var style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement("style");
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    style.textContent =
      ".agilo-wb-picker{margin-top:6px;text-align:center;}" +
      ".agilo-wb-picker .agilo-wb-head{display:flex;justify-content:center;}" +
      ".agilo-wb-picker .agilo-wb-details{border:none;padding:0;max-width:100%;}" +
      ".agilo-wb-picker .agilo-wb-summary{display:inline-flex;align-items:center;justify-content:center;" +
      "gap:6px;cursor:pointer;list-style:none;font:inherit;font-size:0.82rem;font-weight:400;" +
      "color:#6b7280;line-height:1.3;}" +
      ".agilo-wb-picker .agilo-wb-summary::-webkit-details-marker{display:none;}" +
      ".agilo-wb-picker .agilo-wb-summary::marker{content:'';font-size:0;}" +
      ".agilo-wb-picker .agilo-wb-summary:hover{color:#4b5563;}" +
      ".agilo-wb-picker .agilo-wb-label,.agilo-wb-picker .agilo-wb-sep,.agilo-wb-picker .agilo-wb-current," +
      ".agilo-wb-picker .agilo-wb-chev{font-size:0.82rem;font-weight:400;color:inherit;}" +
      ".agilo-wb-picker .agilo-wb-current{min-width:0;max-width:16em;overflow:hidden;" +
      "text-overflow:ellipsis;white-space:nowrap;}" +
      ".agilo-wb-picker .agilo-wb-chev{font-size:0.7rem;opacity:0.7;}" +
      ".agilo-wb-picker .agilo-wb-row{display:flex;justify-content:center;margin-top:8px;}" +
      ".agilo-wb-picker .agilo-wb-row .custom-select{max-width:280px;width:100%;flex:none;}" +
      ".agilo-wb-picker .agilo-wb-lock{display:inline-flex;align-items:center;justify-content:center;" +
      "gap:6px;margin:0;padding:0;border:0;background:none;cursor:pointer;font:inherit;" +
      "font-size:0.82rem;font-weight:400;color:#6b7280;line-height:1.3;}" +
      ".agilo-wb-picker .agilo-wb-lock:hover{color:#4b5563;}";
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

  function innerHtmlLocked() {
    return (
      '<div id="agilo-wb-picker-anchor"></div>' +
      '<div class="agilo-wb-head">' +
      '<button type="button" class="agilo-wb-lock" id="agilo-wb-lock">' +
      '<span class="agilo-wb-label">Mots à surveiller</span>' +
      '<span class="agilo-wb-sep" aria-hidden="true"> · </span>' +
      '<span class="agilo-wb-current">réservé Pro et Business</span>' +
      "</button></div>"
    );
  }

  function innerHtml() {
    return (
      '<div id="agilo-wb-picker-anchor"></div>' +
      '<div class="agilo-wb-head">' +
      '<details class="agilo-wb-details">' +
      '<summary class="agilo-wb-summary">' +
      '<span class="agilo-wb-label">Mots à surveiller</span>' +
      '<span class="agilo-wb-sep" aria-hidden="true"> · </span>' +
      '<span class="agilo-wb-current" id="agilo-wb-current"></span>' +
      '<span class="agilo-wb-chev" aria-hidden="true">▾</span>' +
      "</summary>" +
      '<div class="agilo-wb-row">' +
      '<select class="custom-select grey" id="agilo-wb-select" aria-label="Mots à surveiller"></select>' +
      "</div></details>" +
      "</div>"
    );
  }

  function injectBlock(doc, locked) {
    if (!doc || !doc.createElement) return null;
    ensureStyle(doc);
    var html = locked ? innerHtmlLocked() : innerHtml();
    var existing = doc.getElementById("agilo-wb-picker-anchor");
    var wrap = existing && existing.closest ? existing.closest(".agilo-wb-picker") : null;
    if (wrap) {
      wrap.innerHTML = html;
      wrap.hidden = !locked;
      return doc.getElementById("agilo-wb-picker-anchor");
    }
    var after = findPvContainer(doc);
    if (!after || !after.parentNode) return null;
    wrap = doc.createElement("div");
    wrap.className = "agilo-wb-picker";
    wrap.setAttribute("data-agilo-wb-picker", "1");
    wrap.hidden = !locked;
    wrap.innerHTML = html;
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
    var path = (global.location && global.location.pathname) || "";
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
    return editionFromPath(path);
  }

  function normalizeCreds(creds) {
    var email = String((creds && (creds.email || creds.username)) || pickEmail()).trim();
    var token = String((creds && creds.token) || global.globalToken || "").trim();
    var ed = String((creds && creds.edition) || "").toLowerCase();
    if (ed === "premium") ed = "pro";
    if (ed === "business" || ed === "enterprise") ed = "ent";
    if (ed !== "free" && ed !== "pro" && ed !== "ent") ed = pickEdition();
    return { email: email, username: email, token: token, edition: ed };
  }

  function waitForCreds() {
    var done = function (creds) {
      return normalizeCreds(creds);
    };
    if (global.AgiloLibraryApi && typeof global.AgiloLibraryApi.waitForCreds === "function") {
      return global.AgiloLibraryApi.waitForCreds().then(done);
    }
    return new Promise(function (resolve, reject) {
      var tries = 0;
      function tick() {
        var email = pickEmail();
        var token = String(global.globalToken || "").trim();
        if (email && token) {
          resolve(done({ email: email, token: token, edition: pickEdition() }));
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

  function fillSelect(select, catalog, currentId) {
    if (!select) return;
    select.innerHTML = "";
    if (!catalog.list.length) {
      select.hidden = true;
      select.disabled = true;
      return;
    }
    select.hidden = false;
    select.disabled = false;
    var pick = currentId || pickCurrentId(catalog, 0);
    catalog.list.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = String(item.id);
      opt.textContent = optionLabel(item, catalog.defaultId);
      if (item.id === pick) opt.selected = true;
      select.appendChild(opt);
    });
    if (!select.value && catalog.list[0]) select.value = String(catalog.list[0].id);
  }

  function setSummary(doc, catalog, selectedId) {
    var current = doc.getElementById("agilo-wb-current");
    if (!current) return;
    if (!catalog.list.length) {
      current.textContent = "Aucun thème";
      return;
    }
    var item = catalog.list.filter(function (x) { return x.id === selectedId; })[0] || catalog.list[0];
    current.textContent = optionLabel(item, catalog.defaultId);
  }

  function bindLock(doc) {
    var btn = doc.getElementById("agilo-wb-lock");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      if (e) e.preventDefault();
      showUpgrade();
    });
  }

  function bind(doc, creds) {
    var select = doc.getElementById("agilo-wb-select");
    var wrap = findWrap(doc);
    if (!select) return;

    var catalog = { defaultId: 0, list: [] };
    var busy = false;

    function paint(selectedId, ok) {
      fillSelect(select, catalog, selectedId);
      setSummary(doc, catalog, selectedId || pickCurrentId(catalog, readLastId()));
      applyReveal(wrap, ok, catalog);
    }

    function load() {
      return post("getWordBoostInfo2", {
        username: creds.email || creds.username,
        token: creds.token,
        edition: creds.edition || pickEdition()
      }).then(function (r) {
        if (!r || r.status !== "OK") throw new Error((r && r.errorMessage) || "Catalogue indisponible.");
        catalog = parseCatalog(r);
        paint(pickCurrentId(catalog, readLastId()), true);
      }).catch(function (err) {
        catalog = { defaultId: 0, list: [] };
        paint(0, false);
        toast((err && err.message) || "Impossible de charger les thèmes.");
      });
    }

    select.addEventListener("change", function () {
      var boostId = +select.value || 0;
      if (!boostId || busy) return;
      if (boostId === catalog.defaultId) {
        writeLastId(boostId);
        setSummary(doc, catalog, boostId);
        applyReveal(wrap, true, catalog);
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
        writeLastId(boostId);
        paint(boostId, true);
        toast("Thème par défaut mis à jour.");
      }).catch(function (err) {
        toast((err && err.message) || "Impossible d’enregistrer le thème.");
        paint(pickCurrentId(catalog, readLastId()), true);
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
    var locked = shouldLock(pickEdition());
    var anchor = injectBlock(document, locked);
    if (!anchor) {
      loading = false;
      return;
    }
    if (locked) {
      booted = true;
      loading = false;
      bindLock(document);
      return;
    }
    waitForCreds().then(function (creds) {
      booted = true;
      loading = false;
      return bind(document, creds);
    }).catch(function (err) {
      loading = false;
      applyReveal(findWrap(document), false, { list: [] });
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
    LAST_KEY: LAST_KEY,
    STYLE_ID: STYLE_ID,
    editionFromPath: editionFromPath,
    profileSlugFromPath: profileSlugFromPath,
    profileManageUrl: profileManageUrl,
    parseCatalog: parseCatalog,
    pickCurrentId: pickCurrentId,
    optionLabel: optionLabel,
    shouldReveal: shouldReveal,
    shouldLock: shouldLock,
    innerHtmlLocked: innerHtmlLocked,
    showUpgrade: showUpgrade,
    LOCK_ALERT: LOCK_ALERT,
    normalizeCreds: normalizeCreds,
    injectBlock: injectBlock,
    boot: boot
  };
})(typeof window !== "undefined" ? window : global);
