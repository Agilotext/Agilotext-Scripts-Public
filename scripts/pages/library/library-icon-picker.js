/**
 * Grille d’icônes library2 (wizard + fiche USER).
 * Distinct de library-picker.js (choix de modèle dashboard).
 * @version 1.2.0
 */
(function (global) {
  "use strict";

  var catalogCache = null;
  var catalogError = "";
  var catalogInflight = null;

  function live() {
    return !!(global.AgiloLibraryApi && global.AgiloLibraryApi.cfg && global.AgiloLibraryApi.cfg().library2Live);
  }

  function esc(s) {
    var C = global.AgiloLibraryCore;
    return C && C.escapeHtml ? C.escapeHtml(s) : String(s || "");
  }

  function labelOf(icon) {
    if (!icon) return "";
    return String(icon.labelFr || icon.label || icon.iconKey || "");
  }

  function displayLabel(icon) {
    return String((icon && icon.labelFr) || "").trim();
  }

  function titleOf(icon) {
    var fr = displayLabel(icon);
    if (fr) return fr;
    return String((icon && icon.iconKey) || "");
  }

  function spinHtml(aria, size) {
    var C = global.AgiloLibraryCore;
    if (C && C.spinHtml) return C.spinHtml(aria, size);
    var lab = esc(aria || "Chargement");
    var cls = "agilo-lib-spin" + (size === "lg" ? " agilo-lib-spin--lg" : "");
    return '<span class="' + cls + '" role="status" aria-label="' + lab + '">' +
      '<span class="visually-hidden">' + lab + "</span></span>";
  }

  function cellHtml(icon, selectedKey, extra) {
    extra = extra || {};
    var on = icon.iconKey === selectedKey;
    var src = icon.url || "";
    var fr = displayLabel(icon);
    var title = titleOf(icon);
    var img = src
      ? '<img src="' + esc(src) + '" alt="" width="22" height="22" onerror="this.onerror=null;this.hidden=true;">'
      : "";
    var cap = fr ? "<span>" + esc(fr) + "</span>" : "";
    var cls = "agilo-lib-iconpick__cell" +
      (extra.className ? " " + extra.className : "") +
      (on ? " is-on" : "") +
      (fr ? "" : " agilo-lib-iconpick__cell--solo");
    return '<button type="button" class="' + cls +
      '" data-icon-key="' + esc(icon.iconKey) + '" aria-pressed="' + on + '" title="' + esc(title) +
      '" aria-label="' + esc(title) + '">' +
      img + cap + (extra.tag || "") + "</button>";
  }

  function matchesQuery(icon, q) {
    if (!q) return true;
    var hay = (labelOf(icon) + " " + (icon.iconKey || "") + " " + (icon.category || "")).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function resetCache() {
    catalogCache = null;
    catalogError = "";
    catalogInflight = null;
  }

  function load(creds) {
    if (!live()) {
      return Promise.resolve({ ok: true, icons: [] });
    }
    if (catalogCache) {
      return Promise.resolve({ ok: true, icons: catalogCache });
    }
    if (catalogInflight) return catalogInflight;
    catalogInflight = global.AgiloLibraryApi.getPromptIconCatalog(creds).then(function (res) {
      catalogInflight = null;
      if (res.ok) {
        catalogCache = res.icons || [];
        catalogError = "";
        return { ok: true, icons: catalogCache };
      }
      catalogError = res.message || "Catalogue d’icônes indisponible.";
      return { ok: false, icons: [], message: catalogError };
    }).catch(function () {
      catalogInflight = null;
      catalogError = "Catalogue d’icônes indisponible.";
      return { ok: false, icons: [], message: catalogError };
    });
    return catalogInflight;
  }

  function chromeHtml(q) {
    return '<div class="agilo-lib-iconpick__chrome">' +
      '<p class="agilo-lib-iconpick__title">Icône du modèle</p>' +
      '<label class="visually-hidden" for="agilo-lib-icon-q">Filtrer les icônes</label>' +
      '<input id="agilo-lib-icon-q" class="agilo-lib-iconpick__q" type="search" placeholder="Rechercher une icône" value="' +
      esc(q) + '">' +
      "</div>";
  }

  function html(opts) {
    opts = opts || {};
    var selected = String(opts.selectedKey || "");
    var q = String(opts.query || "");
    var icons = opts.icons || catalogCache || [];
    var loading = !!opts.loading;
    var error = opts.error || (!loading && !icons.length && catalogError ? catalogError : "");

    var head = '<div class="agilo-lib-iconpick">' + chromeHtml(q);

    if (loading && !icons.length) {
      return head + '<div class="agilo-lib-iconpick__wait">' + spinHtml("Chargement") + "</div></div>";
    }
    if (error && !icons.length) {
      return head + '<p class="agilo-lib-note">' + esc(error) +
        " Tu peux continuer sans choisir : le serveur proposera une icône.</p></div>";
    }

    var filtered = icons.filter(function (icon) { return matchesQuery(icon, q.trim().toLowerCase()); });
    var cells = filtered.map(function (icon) {
      return cellHtml(icon, selected);
    }).join("");
    if (!filtered.length) {
      cells = '<p class="agilo-lib-note">Aucune icône pour ce filtre.</p>';
    }
    return head + '<div class="agilo-lib-iconpick__grid" role="listbox" aria-label="Icônes">' + cells + "</div></div>";
  }

  function bind(host, opts) {
    opts = opts || {};
    var input = host.querySelector("#agilo-lib-icon-q");
    if (input && !input.getAttribute("data-icon-bound")) {
      input.setAttribute("data-icon-bound", "1");
      input.addEventListener("input", function () {
        if (typeof opts.onFilter === "function") opts.onFilter(input.value);
      });
    }
    bindCells(host, opts);
  }

  function bindCells(host, opts) {
    host.querySelectorAll("[data-icon-key]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.getAttribute("data-icon-key");
        if (typeof opts.onSelect === "function") opts.onSelect(key);
      });
    });
  }

  function applyFilter(host, icons, selectedKey, q) {
    var grid = host.querySelector(".agilo-lib-iconpick__grid");
    if (!grid) return;
    var filtered = (icons || []).filter(function (icon) {
      return matchesQuery(icon, String(q || "").trim().toLowerCase());
    });
    if (!filtered.length) {
      grid.innerHTML = '<p class="agilo-lib-note">Aucune icône pour ce filtre.</p>';
      return;
    }
    grid.innerHTML = filtered.map(function (icon) {
      return cellHtml(icon, selectedKey);
    }).join("");
  }

  global.AgiloLibraryIconPicker = {
    VERSION: "1.1.0",
    html: html,
    bind: bind,
    bindCells: bindCells,
    applyFilter: applyFilter,
    load: load,
    labelOf: labelOf,
    displayLabel: displayLabel,
    titleOf: titleOf,
    cellHtml: cellHtml,
    spinHtml: spinHtml,
    resetCache: resetCache,
    matchesQuery: matchesQuery
  };
})(typeof window !== "undefined" ? window : globalThis);
