/**
 * Picker modèles du Carnet (dashboard).
 * Perso + Standards, recherche, dernier id sinon 817, jamais CSE 1 auto.
 * Icônes Nucleo bouton + liste. Pas le wizard / cadenas.
 * V1 : l’id est persisté (Générer = Bientôt).
 */
(function (global) {
  "use strict";

  var CSE_ID = "1";
  var FALLBACK_ID = "817";
  var FALLBACK_PATHS = {
    document:
      '<line x1="5.75" y1="6.75" x2="7.75" y2="6.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="5.75" y1="9.75" x2="12.25" y2="9.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="5.75" y1="12.75" x2="12.25" y2="12.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M2.75,14.25V3.75c0-1.105,.895-2,2-2h5.586c.265,0,.52,.105,.707,.293l3.914,3.914c.188,.188,.293,.442,.293,.707v7.586c0,1.105-.895,2-2,2H4.75c-1.105,0-2-.895-2-2Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M15.16,6.25h-3.41c-.552,0-1-.448-1-1V1.852" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    custom:
      '<path d="m12.5717,2.9253L2.9189,12.583c-.3899.39-.3903,1.0221-.0011,1.4127l1.0852,1.0892c.391.39,1.024.39,1.415,0L15.0701,5.4269c.3898-.3901.3903-1.0221.0011-1.4127l-1.0838-1.0878c-.3904-.3918-1.0247-.3923-1.4157-.0011Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="m10.387,5.36l2.25,2.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    chevron:
      '<polyline points="4.5 6.75 9 11.25 13.5 6.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>'
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fallbackSvg(key) {
    var inner = FALLBACK_PATHS[key] || FALLBACK_PATHS.document;
    return (
      '<svg class="agilo-carnet-picker__svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

  function absIconUrl(url) {
    var Api = global.AgiloLibraryApi;
    if (Api && typeof Api.absIconUrl === "function") return Api.absIconUrl(url) || "";
    return String(url || "").trim();
  }

  function modelIconHtml(m) {
    var Core = global.AgiloLibraryCore;
    var kind = (m && (m.kind || m.type)) || "STANDARD";
    var payload = {
      iconKey: (m && m.iconKey) || (kind === "USER" ? "custom" : "document"),
      iconUrl: m && m.iconUrl,
      type: kind
    };
    if (Core && typeof Core.iconHtml === "function") return Core.iconHtml(payload, 18);
    if (Core && typeof Core.svgIcon === "function") return Core.svgIcon(payload.iconKey, 18);
    return fallbackSvg(payload.iconKey === "custom" ? "custom" : "document");
  }

  function extractPromptList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    var raw =
      data.promptModeInfoDTOList ||
      data.promptModelInfoDTOList ||
      data.promptModels ||
      data.list ||
      data.items;
    return Array.isArray(raw) ? raw : [];
  }

  function normalizeModel(m, kindHint) {
    if (!m || typeof m !== "object") return null;
    var id =
      m.promptModelId != null
        ? m.promptModelId
        : m.promptId != null
          ? m.promptId
          : m.id;
    var name = m.promptModelName || m.promptName || m.name || "";
    if (id == null || id === "") return null;
    var kind = kindHint || m.kind || m.type;
    if (kind !== "STANDARD" && kind !== "USER") {
      kind = Number(id) > 100 ? "USER" : "STANDARD";
    }
    var iconKey = m.iconKey || m.icon || (kind === "USER" ? "custom" : "document");
    return {
      id: String(id),
      name: String(name || "Modèle " + id),
      kind: kind,
      iconKey: String(iconKey),
      iconUrl: absIconUrl(m.iconUrl)
    };
  }

  function isCseDefault(m) {
    if (!m) return false;
    if (String(m.id) === CSE_ID) return true;
    var n = String(m.name || "").toLowerCase();
    return n === "cse" || n.indexOf("cse standard") !== -1;
  }

  function pickDefault(models, lastId) {
    var list = models || [];
    if (lastId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === String(lastId) && !isCseDefault(list[i])) return list[i];
        if (list[i].id === String(lastId) && String(lastId) !== CSE_ID) return list[i];
      }
    }
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === FALLBACK_ID) return list[j];
    }
    for (var k = 0; k < list.length; k++) {
      if (!isCseDefault(list[k])) return list[k];
    }
    return null;
  }

  function ensureCss() {
    if (document.getElementById("agilo-carnet-picker-css")) return;
    var style = document.createElement("style");
    style.id = "agilo-carnet-picker-css";
    style.textContent =
      ".agilo-carnet-picker{position:relative;margin:.15rem 0 .55rem;}" +
      ".agilo-carnet-picker__label{display:block;font-size:.78rem;font-weight:600;margin:0 0 .3rem;color:#404040;}" +
      ".agilo-carnet-picker__btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:.5rem;border:1.5px solid #d4d4d4;background:#fff;border-radius:10px;padding:.55rem .75rem;font-family:inherit;font-size:.88rem;cursor:pointer;text-align:left;}" +
      ".agilo-carnet-picker__btn:disabled{opacity:.55;cursor:not-allowed;}" +
      ".agilo-carnet-picker.is-open .agilo-carnet-picker__btn{border-color:var(--agilo-primary,#174a96);}" +
      ".agilo-carnet-picker__btn-left{display:flex;align-items:center;gap:.5rem;min-width:0;}" +
      ".agilo-carnet-picker__ico,.agilo-carnet-picker__item-ico{display:inline-flex;flex:0 0 18px;color:var(--agilo-primary,#174a96);}" +
      ".agilo-carnet-picker__current{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".agilo-carnet-picker__chevron{flex:0 0 18px;color:#737373;}" +
      ".agilo-carnet-picker__panel{position:absolute;z-index:40;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #e5e5e5;border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.12);padding:.45rem;max-height:280px;overflow:auto;}" +
      ".agilo-carnet-picker__search{width:100%;box-sizing:border-box;border:1px solid #e5e5e5;border-radius:8px;padding:.4rem .55rem;font-family:inherit;font-size:.82rem;margin-bottom:.35rem;}" +
      ".agilo-carnet-picker__group{font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#737373;padding:.35rem .4rem .15rem;}" +
      ".agilo-carnet-picker__item{display:flex;align-items:center;gap:.5rem;width:100%;text-align:left;border:none;background:transparent;border-radius:8px;padding:.4rem .5rem;font-family:inherit;font-size:.85rem;cursor:pointer;}" +
      ".agilo-carnet-picker__item:hover,.agilo-carnet-picker__item.is-hi{background:#f4f7fb;}" +
      ".agilo-carnet-picker__item.is-selected{font-weight:600;color:var(--agilo-primary,#174a96);}" +
      ".agilo-carnet-picker__empty{margin:.4rem .5rem;font-size:.8rem;color:#737373;}";
    document.head.appendChild(style);
  }

  var ctl = null;

  function mount(host, opts) {
    opts = opts || {};
    if (!host) return null;
    ensureCss();
    host.innerHTML =
      '<div class="agilo-carnet-picker" id="agilo-carnet-picker">' +
      '<span class="agilo-carnet-picker__label">Modèles</span>' +
      '<button type="button" class="agilo-carnet-picker__btn" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="agilo-carnet-picker__btn-left">' +
      '<span class="agilo-carnet-picker__ico">' +
      modelIconHtml({ iconKey: "document", kind: "STANDARD" }) +
      "</span>" +
      '<span class="agilo-carnet-picker__current">Choisir un modèle</span>' +
      "</span>" +
      '<span class="agilo-carnet-picker__chevron" aria-hidden="true">' +
      fallbackSvg("chevron") +
      "</span>" +
      "</button>" +
      '<div class="agilo-carnet-picker__panel" hidden role="listbox">' +
      '<input type="search" class="agilo-carnet-picker__search" placeholder="Rechercher un modèle" autocomplete="off" />' +
      '<div class="agilo-carnet-picker__list"></div>' +
      '<p class="agilo-carnet-picker__empty" hidden>Aucun modèle ne correspond.</p>' +
      "</div></div>";

    var root = host.querySelector(".agilo-carnet-picker");
    var btn = root.querySelector(".agilo-carnet-picker__btn");
    var current = root.querySelector(".agilo-carnet-picker__current");
    var icoEl = root.querySelector(".agilo-carnet-picker__ico");
    var panel = root.querySelector(".agilo-carnet-picker__panel");
    var searchEl = root.querySelector(".agilo-carnet-picker__search");
    var listEl = root.querySelector(".agilo-carnet-picker__list");
    var emptyEl = root.querySelector(".agilo-carnet-picker__empty");
    var models = [];
    var recents = [];
    var selected = null;
    var filter = "";
    var open = false;
    var hiIndex = 0;
    var disabled = false;

    function groupedShown() {
      var q = String(filter || "").trim().toLowerCase();
      var match = function (m) {
        if (!q) return true;
        return m.name.toLowerCase().indexOf(q) !== -1 || m.id === q;
      };
      var byId = {};
      models.forEach(function (m) {
        byId[m.id] = m;
      });
      var recentsOut = [];
      var seen = {};
      if (!q) {
        recents.forEach(function (id) {
          var m = byId[String(id)];
          if (m && !seen[m.id] && match(m)) {
            seen[m.id] = true;
            recentsOut.push(m);
          }
        });
      }
      var userOut = [];
      var stdOut = [];
      models.forEach(function (m) {
        if (seen[m.id] || !match(m)) return;
        if (m.kind === "STANDARD") stdOut.push(m);
        else userOut.push(m);
      });
      return { recents: recentsOut, user: userOut, standard: stdOut };
    }

    function flatten(g) {
      return (g.recents || []).concat(g.user || []).concat(g.standard || []);
    }

    function renderButton() {
      if (icoEl) {
        icoEl.innerHTML = modelIconHtml(
          selected || { iconKey: "document", kind: "STANDARD" }
        );
      }
      if (current) current.textContent = selected ? selected.name : "Choisir un modèle";
    }

    function renderList() {
      var g = groupedShown();
      var shown = flatten(g);
      if (hiIndex >= shown.length) hiIndex = Math.max(0, shown.length - 1);
      var html = "";
      var idx = 0;
      function itemsHtml(arr) {
        return arr
          .map(function (m) {
            var i = idx++;
            var on = selected && selected.id === m.id ? " is-selected" : "";
            var hi = i === hiIndex ? " is-hi" : "";
            return (
              '<button type="button" class="agilo-carnet-picker__item' +
              on +
              hi +
              '" role="option" data-id="' +
              escapeHtml(m.id) +
              '">' +
              '<span class="agilo-carnet-picker__item-ico">' +
              modelIconHtml(m) +
              "</span>" +
              "<span>" +
              escapeHtml(m.name) +
              "</span>" +
              "</button>"
            );
          })
          .join("");
      }
      if (g.recents.length) html += '<div class="agilo-carnet-picker__group">Récents</div>' + itemsHtml(g.recents);
      if (g.user.length) html += '<div class="agilo-carnet-picker__group">Perso</div>' + itemsHtml(g.user);
      if (g.standard.length) html += '<div class="agilo-carnet-picker__group">Standards</div>' + itemsHtml(g.standard);
      listEl.innerHTML = html;
      emptyEl.hidden = shown.length > 0;
    }

    function persistSelected() {
      if (!selected || !global.AgiloDicteeUsages) return;
      var email = AgiloDicteeUsages.getEmail();
      try {
        localStorage.setItem(AgiloDicteeUsages.promptKey(email), selected.id);
        var raw = [];
        try {
          raw = JSON.parse(localStorage.getItem(AgiloDicteeUsages.recentsKey(email)) || "[]");
        } catch (e) {}
        var next = [selected.id].concat(
          (Array.isArray(raw) ? raw : []).filter(function (id) {
            return String(id) !== selected.id;
          })
        ).slice(0, 8);
        localStorage.setItem(AgiloDicteeUsages.recentsKey(email), JSON.stringify(next));
      } catch (e) {}
    }

    function setSelected(m, persist) {
      selected = m || null;
      renderButton();
      if (open) renderList();
      if (persist) persistSelected();
    }

    function onDocDown(e) {
      if (!open) return;
      if (root.contains(e.target)) return;
      closePanel();
    }

    function openPanel() {
      if (open || disabled) return;
      open = true;
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      root.classList.add("is-open");
      filter = "";
      searchEl.value = "";
      hiIndex = 0;
      renderList();
      searchEl.focus();
      document.addEventListener("mousedown", onDocDown, true);
    }

    function closePanel() {
      if (!open) return;
      open = false;
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      root.classList.remove("is-open");
      document.removeEventListener("mousedown", onDocDown, true);
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (disabled) return;
      if (open) closePanel();
      else openPanel();
    });
    listEl.addEventListener("click", function (e) {
      var item = e.target.closest("[data-id]");
      if (!item || disabled) return;
      var id = item.getAttribute("data-id");
      var found = null;
      for (var i = 0; i < models.length; i++) {
        if (models[i].id === id) {
          found = models[i];
          break;
        }
      }
      setSelected(found, true);
      closePanel();
    });
    searchEl.addEventListener("input", function () {
      filter = searchEl.value;
      hiIndex = 0;
      renderList();
    });

    ctl = {
      setModels: function (list, lastId, recentIds) {
        models = (list || []).map(function (m) {
          return normalizeModel(m, m && m.kind);
        }).filter(Boolean);
        recents = Array.isArray(recentIds) ? recentIds.map(String) : [];
        setSelected(pickDefault(models, lastId), false);
        if (open) renderList();
      },
      getSelected: function () {
        return selected;
      },
      setVisible: function (visible) {
        host.hidden = !visible;
      },
      setDisabled: function (next) {
        disabled = !!next;
        btn.disabled = disabled;
        if (disabled) closePanel();
      },
      setStatus: function (msg) {
        if (current) current.textContent = msg || "";
      },
      close: closePanel
    };
    if (typeof opts.onReady === "function") opts.onReady(ctl);
    return ctl;
  }

  function postUrlEncoded(path, extra) {
    var email =
      (global.AgiloDicteeUsages && AgiloDicteeUsages.getEmail()) || "";
    var token = global.globalToken || "";
    var body = new URLSearchParams();
    body.set("username", email);
    body.set("token", token);
    body.set("edition", String(global.edition || "business"));
    extra = extra || {};
    Object.keys(extra).forEach(function (k) {
      body.set(k, extra[k]);
    });
    return fetch("https://api.agilotext.com/api/v1" + path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).then(function (res) {
      return res.json().catch(function () {
        return {};
      });
    });
  }

  function loadModels() {
    if (!ctl) return Promise.resolve();
    ctl.setStatus("Chargement des modèles…");
    return Promise.all([
      postUrlEncoded("/getPromptModelsUserInfo"),
      postUrlEncoded("/getPromptModelsStandardInfo")
    ])
      .then(function (pair) {
        var user = extractPromptList(pair[0]).map(function (m) {
          var n = normalizeModel(m, "USER");
          return n;
        }).filter(Boolean);
        var std = extractPromptList(pair[1]).map(function (m) {
          var n = normalizeModel(m, "STANDARD");
          return n;
        }).filter(Boolean);
        var email = global.AgiloDicteeUsages && AgiloDicteeUsages.getEmail();
        var lastId = "";
        var recents = [];
        try {
          lastId = localStorage.getItem(AgiloDicteeUsages.promptKey(email)) || "";
          recents = JSON.parse(localStorage.getItem(AgiloDicteeUsages.recentsKey(email)) || "[]");
        } catch (e) {}
        ctl.setModels(user.concat(std), lastId, recents);
      })
      .catch(function () {
        if (global.AgiloDicteeUsages) {
          AgiloDicteeUsages.setCarnetError("Impossible de charger les modèles.");
        }
        ctl.setStatus("Modèles indisponibles");
      });
  }

  global.AgiloDicteeCarnetPicker = {
    FALLBACK_ID: FALLBACK_ID,
    CSE_ID: CSE_ID,
    extractPromptList: extractPromptList,
    normalizeModel: normalizeModel,
    isCseDefault: isCseDefault,
    pickDefault: pickDefault,
    mount: mount,
    loadModels: loadModels,
    setVisible: function (visible) {
      if (ctl) ctl.setVisible(visible);
    },
    setDisabled: function (disabled) {
      if (ctl) ctl.setDisabled(disabled);
    },
    getSelected: function () {
      return ctl ? ctl.getSelected() : null;
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
