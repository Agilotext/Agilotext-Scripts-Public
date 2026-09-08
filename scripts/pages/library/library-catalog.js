/**
 * Catalogue : trois sections + recherche + actions copie / défaut / pin.
 * @version 1.0.0
 */
(function (global) {
  "use strict";

  var state = { q: "", models: [], creds: null, access: null, busyId: null };

  function byId(id) {
    return state.models.filter(function (m) { return Number(m.promptModelId) === Number(id); })[0];
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    if (!q) return state.models.slice();
    return state.models.filter(function (m) {
      return [m.cardTitle, m.publicDescription, m.promptModelName].join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function paint(root) {
    var C = global.AgiloLibraryCore;
    var list = C.sortModels(filtered());
    var pinned = list.filter(function (m) { return m.pinned; });
    var mine = list.filter(function (m) { return m.type === "USER"; });
    var official = list.filter(function (m) { return m.type === "STANDARD"; });

    function section(title, models, emptyTitle, emptyText) {
      var inner = models.length
        ? '<div class="agilo-lib-grid">' + models.map(C.cardHtml).join("") + "</div>"
        : C.emptyHtml(emptyTitle, emptyText);
      return '<section class="agilo-lib-section-block"><h2>' + C.escapeHtml(title) + "</h2>" + inner + "</section>";
    }

    var cfg = global.AgiloLibraryApi.cfg();
    var noun = (state.access && state.access.noun) || "compte rendu";
    var banners = [];
    if (!cfg.library2Live) {
      banners.push(
        '<div class="agilo-lib-banner agilo-lib-banner--info" role="status">' +
        "<span>Catalogue actuel. Les modèles métier CSE arriveront quand la nouvelle API sera en ligne.</span></div>"
      );
    }
    var pending = /(?:^|[?&])(?:pack|checkout)=pending(?:&|$)/.test(location.search || "");
    if (pending) {
      banners.push(
        '<div class="agilo-lib-banner agilo-lib-banner--upgrade" role="status">' +
        "<span>Pack en cours d’activation (quelques secondes).</span>" +
        '<button type="button" class="agilo-lib-btn" data-act="reload">Recharger</button></div>'
      );
    }

    var head =
      '<div class="agilo-lib-head"><div>' +
      "<h1>Bibliothèque de modèles</h1>" +
      "<p>Choisis un modèle officiel, copie-le, puis génère ton " + C.escapeHtml(noun) + ".</p>" +
      "</div>" +
      '<div class="agilo-lib-search"><label class="visually-hidden" for="agilo-lib-q" style="position:absolute;left:-9999px">Rechercher</label>' +
      '<input id="agilo-lib-q" type="search" placeholder="Rechercher un modèle" value="' +
      C.escapeHtml(state.q) + '"></div></div>';

    root.innerHTML = banners.join("") + head +
      section("Épinglés", pinned, "Aucun épinglé", "Épingle jusqu’à cinq modèles personnels.") +
      section("Mes modèles", mine, "Aucun modèle personnel", "Ajoute un modèle officiel pour le retrouver ici.") +
      section("Modèles Agilotext", official, "Aucun modèle officiel visible", "Le catalogue officiel est vide ou encore masqué.");

    var input = root.querySelector("#agilo-lib-q");
    if (input) {
      input.addEventListener("input", function () {
        state.q = input.value;
        paint(root);
        var again = root.querySelector("#agilo-lib-q");
        if (again) {
          again.focus();
          try { again.setSelectionRange(again.value.length, again.value.length); } catch (_) { /* ignore */ }
        }
      });
    }
    bind(root);
  }

  function bind(root) {
    var reload = root.querySelector('[data-act="reload"]');
    if (reload) {
      reload.addEventListener("click", function () { location.reload(); });
    }
    root.querySelectorAll(".agilo-lib-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn || btn.disabled) return;
        e.preventDefault();
        var model = byId(card.getAttribute("data-id"));
        if (!model) return;
        var act = btn.getAttribute("data-act");
        if (act === "duplicate") askDuplicate(root, model, btn);
        if (act === "default") doDefault(root, model, btn);
        if (act === "pin") doPin(root, model, btn);
      });
    });
  }

  function askDuplicate(root, model, btn) {
    closeDialog();
    var dlg = document.createElement("div");
    dlg.className = "agilo-lib-dialog is-open";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.innerHTML =
      '<div class="agilo-lib-dialog__panel">' +
      "<h2>Ajouter à mes modèles</h2>" +
      "<p>Donne un nom personnel. La copie t’appartient.</p>" +
      '<label>Nom<input type="text" maxlength="120" value="' +
      global.AgiloLibraryCore.escapeHtml(model.cardTitle) + '"></label>' +
      '<div class="agilo-lib-dialog__actions">' +
      '<button type="button" class="agilo-lib-btn" data-close>Annuler</button>' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-ok>Copier</button>' +
      "</div></div>";
    document.body.appendChild(dlg);
    var input = dlg.querySelector("input");
    input.focus();
    input.select();
    function stop(ev) {
      if (ev.key === "Escape") closeDialog();
    }
    document.addEventListener("keydown", stop);
    dlg.querySelector("[data-close]").addEventListener("click", closeDialog);
    dlg.addEventListener("click", function (ev) {
      if (ev.target === dlg) closeDialog();
    });
    dlg.querySelector("[data-ok]").addEventListener("click", function () {
      var name = (input.value || "").trim();
      if (!name) return;
      closeDialog();
      doDuplicate(root, model, btn, name);
    });
    dlg._onKey = stop;
  }

  function closeDialog() {
    document.querySelectorAll(".agilo-lib-dialog").forEach(function (d) {
      if (d._onKey) document.removeEventListener("keydown", d._onKey);
      d.remove();
    });
  }

  function doDuplicate(root, model, btn, name) {
    btn.disabled = true;
    global.AgiloLibraryApi.duplicate(state.creds, model.promptModelId, name).then(function (res) {
      if (res.reload) {
        global.AgiloLibraryCore.toast(res.message || "Recharge la page.");
        return;
      }
      if (!res.ok) {
        btn.disabled = false;
        global.AgiloLibraryCore.toast(res.message || "Copie impossible.");
        return;
      }
      global.AgiloLibraryCore.toast("Modèle ajouté.");
      reload(root);
    });
  }

  function doDefault(root, model, btn) {
    try {
      global.AgiloLibraryApi.assertGenerationId(model.promptModelId);
    } catch (err) {
      global.AgiloLibraryCore.toast(err.message);
      return;
    }
    if (global.AgiloLibraryCore.locked(model)) return;
    btn.disabled = true;
    global.AgiloLibraryApi.setDefault(state.creds, model.promptModelId).then(function (res) {
      btn.disabled = false;
      if (!res.ok) {
        global.AgiloLibraryCore.toast(res.message || "Impossible de définir le défaut.");
        return;
      }
      global.AgiloLibraryCore.toast("Modèle par défaut enregistré.");
      reload(root);
    });
  }

  function doPin(root, model, btn) {
    if (global.AgiloLibraryCore.locked(model)) return;
    btn.disabled = true;
    global.AgiloLibraryApi.setPinned(state.creds, model.promptModelId, !model.pinned).then(function (res) {
      btn.disabled = false;
      if (!res.ok) {
        global.AgiloLibraryCore.toast(res.message || "Épinglage indisponible.");
        return;
      }
      reload(root);
    });
  }

  function reload(root) {
    return global.AgiloLibraryApi.fetchLists(state.creds).then(function (pack) {
      state.models = pack.models;
      paint(root);
    });
  }

  function mount(root, creds, access, pack) {
    state.creds = creds;
    state.access = access;
    state.models = pack.models || [];
    paint(root);
  }

  global.AgiloLibraryCatalog = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
