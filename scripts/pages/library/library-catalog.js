/**
 * Catalogue : onglets, recherche, chips, grille / tableau, wizard de création.
 * @version 1.1.0
 */
(function (global) {
  "use strict";

  var TABS = [
    { id: "agilotext", label: "Modèles Agilotext" },
    { id: "mes-modeles", label: "Mes modèles" },
    { id: "epingles", label: "Épinglés" },
    { id: "creer", label: "Créer un modèle" }
  ];

  var state = {
    q: "",
    tab: "agilotext",
    category: "all",
    view: "grid",
    sort: { col: "updated", dir: "desc" },
    models: [],
    creds: null,
    access: null,
    pinMax: 5,
    wizard: {
      step: 1,
      name: "",
      objective: "",
      specificInfo: "",
      structure: "Décisions, actions, prochaine étape"
    },
    created: null,
    creating: false,
    versionsModel: null,
    versions: [],
    versionsLoading: false
  };

  var searchTimer = null;

  function byId(id) {
    return state.models.filter(function (m) { return Number(m.promptModelId) === Number(id); })[0];
  }

  function counts() {
    return {
      official: state.models.filter(function (m) { return m.type === "STANDARD"; }).length,
      mine: state.models.filter(function (m) { return m.type === "USER"; }).length,
      pinned: state.models.filter(function (m) { return m.pinned; }).length
    };
  }

  function matchesQuery(m, q) {
    if (!q) return true;
    return [m.cardTitle, m.publicDescription, m.publicExample, m.promptModelName, m.categoryKey]
      .join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function filteredOfficial() {
    var q = state.q.trim().toLowerCase();
    return state.models.filter(function (m) {
      if (m.type !== "STANDARD") return false;
      if (state.category !== "all" && m.categoryKey !== state.category) return false;
      return matchesQuery(m, q);
    });
  }

  function filteredMine() {
    var q = state.q.trim().toLowerCase();
    return state.models.filter(function (m) {
      if (m.type !== "USER") return false;
      return matchesQuery(m, q);
    });
  }

  function filteredPinned() {
    var q = state.q.trim().toLowerCase();
    return state.models.filter(function (m) {
      if (!m.pinned) return false;
      return matchesQuery(m, q);
    });
  }

  function sortMine(list) {
    var col = state.sort.col;
    var dir = state.sort.dir === "asc" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      var va;
      var vb;
      if (col === "name") {
        return dir * String(a.cardTitle).localeCompare(String(b.cardTitle), "fr");
      }
      if (col === "created") {
        va = a.dtCreation || 0;
        vb = b.dtCreation || 0;
        return dir * (va - vb);
      }
      va = a.dtUpdate || 0;
      vb = b.dtUpdate || 0;
      return dir * (va - vb);
    });
  }

  function readHash() {
    var params = new URLSearchParams((global.location && global.location.search) || "");
    var fromQuery = params.get("tab");
    var hash = String((global.location && global.location.hash) || "").replace(/^#/, "");
    var raw = fromQuery || hash;
    var known = TABS.some(function (t) { return t.id === raw; });
    if (known) state.tab = raw;
    try {
      var view = sessionStorage.getItem("agilo:lib:view");
      if (view === "table" || view === "grid") state.view = view;
    } catch (_) { /* ignore */ }
  }

  function writeHash() {
    if (!global.history || !global.location) return;
    var next = "#" + state.tab;
    if (global.location.hash !== next) {
      global.history.replaceState(null, "", next);
    }
  }

  function noun() {
    return (state.access && state.access.noun) || "compte rendu";
  }

  function headHtml() {
    var C = global.AgiloLibraryCore;
    return '<div class="agilo-lib-head"><div>' +
      "<h1>Modèles de documents</h1>" +
      "<p>Choisis un modèle Agilotext, copie-le, ou crée le tien en quatre questions.</p>" +
      "</div>" +
      '<div class="agilo-lib-head__tools">' +
      '<div class="agilo-lib-search">' + C.svgIcon("search", 16) +
      '<label class="visually-hidden" for="agilo-lib-q">Rechercher</label>' +
      '<input id="agilo-lib-q" type="search" placeholder="Rechercher un modèle" value="' +
      C.escapeHtml(state.q) + '"></div>' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-tab="creer">' +
      C.svgIcon("plus", 16) + " Créer un modèle</button>" +
      "</div></div>";
  }

  function tabsHtml() {
    var n = counts();
    return '<div class="agilo-lib-tabs" role="tablist" aria-label="Sections de la bibliothèque">' +
      TABS.map(function (t) {
        var selected = state.tab === t.id;
        var count = "";
        if (t.id === "agilotext" && n.official) count = " (" + n.official + ")";
        if (t.id === "mes-modeles") count = " (" + n.mine + ")";
        if (t.id === "epingles") count = " (" + n.pinned + "/" + state.pinMax + ")";
        return '<button type="button" class="agilo-lib-tab' + (selected ? " is-active" : "") +
          '" role="tab" id="tab-' + t.id + '" data-tab="' + t.id + '" aria-selected="' + selected + '"' +
          ' aria-controls="panel-' + t.id + '">' + t.label + count + "</button>";
      }).join("") +
      "</div>";
  }

  function chipsHtml() {
    var cats = (global.AgiloLibraryStandards && global.AgiloLibraryStandards.CATEGORIES) || [];
    return '<div class="agilo-lib-chips" role="group" aria-label="Filtres métier">' +
      cats.map(function (c) {
        return '<button type="button" data-cat="' + c.key + '"' +
          (c.key === state.category ? ' class="is-active"' : "") + ">" +
          global.AgiloLibraryCore.escapeHtml(c.label) + "</button>";
      }).join("") +
      "</div>";
  }

  function gridHtml(models, size) {
    var C = global.AgiloLibraryCore;
    return '<div class="agilo-lib-grid' + (size === "featured" ? " agilo-lib-featured" : "") + '">' +
      models.map(function (m, i) { return C.cardHtml(m, { size: size || "normal", index: i }); }).join("") +
      "</div>";
  }

  function viewToggleHtml() {
    var C = global.AgiloLibraryCore;
    return '<div class="agilo-lib-view-toggle" role="group" aria-label="Affichage">' +
      '<button type="button" data-view="grid"' + (state.view === "grid" ? ' class="is-active"' : "") +
      ' aria-pressed="' + (state.view === "grid") + '">' + C.svgIcon("grid", 14) + " Grille</button>" +
      '<button type="button" data-view="table"' + (state.view === "table" ? ' class="is-active"' : "") +
      ' aria-pressed="' + (state.view === "table") + '">' + C.svgIcon("table", 14) + " Tableau</button>" +
      "</div>";
  }

  function sortMark(col) {
    if (state.sort.col !== col) return "";
    return state.sort.dir === "asc" ? " ↑" : " ↓";
  }

  function tableHtml(models) {
    var C = global.AgiloLibraryCore;
    if (!models.length) return "";
    return '<div class="agilo-lib-table-wrap"><table class="agilo-lib-table">' +
      "<thead><tr>" +
      '<th data-sort="name">Nom' + sortMark("name") + "</th>" +
      "<th>Défaut</th><th>Épinglé</th><th>Mise en page</th>" +
      '<th data-sort="created">Créé' + sortMark("created") + "</th>" +
      '<th data-sort="updated">Modifié' + sortMark("updated") + "</th>" +
      "<th>Actions</th>" +
      "</tr></thead><tbody>" +
      models.map(C.tableRowHtml).join("") +
      "</tbody></table></div>" +
      '<div class="agilo-lib-table-cards">' + gridHtml(models, "compact") + "</div>";
  }

  function panelOfficial() {
    var C = global.AgiloLibraryCore;
    var list = C.sortOfficial(filteredOfficial());
    var q = state.q.trim();
    if (!list.length) {
      return C.emptyHtml(
        "Aucun modèle Agilotext",
        q ? "Aucun modèle ne correspond à « " + q + " »." : "Aucun modèle officiel ne correspond à ce filtre."
      );
    }
    var featured = [];
    var rest = list;
    if (!q) {
      featured = list.filter(function (m) { return m.featured; }).slice(0, 3);
      var featIds = {};
      featured.forEach(function (m) { featIds[m.promptModelId] = true; });
      rest = list.filter(function (m) { return !featIds[m.promptModelId]; });
    }
    var html = chipsHtml();
    if (featured.length) {
      html += '<section class="agilo-lib-section-block"><h2>À la une</h2>' +
        gridHtml(featured, "featured") + "</section>";
    }
    html += '<section class="agilo-lib-section-block"><h2>Tous les modèles Agilotext</h2>' +
      (rest.length ? gridHtml(rest, "normal") : C.emptyHtml("Rien d’autre dans ce filtre", "Change de catégorie ou vide la recherche.")) +
      "</section>";
    return html;
  }

  function panelMine() {
    var C = global.AgiloLibraryCore;
    var list = sortMine(filteredMine());
    var q = state.q.trim();
    var tools = '<div class="agilo-lib-panel-tools">' + viewToggleHtml() + "</div>";
    if (!list.length) {
      var empty = C.emptyHtml(
        "Pas encore de modèle personnel",
        q ? "Aucun modèle ne correspond à « " + q + " »." :
          (global.AgiloLibraryApi.canCreate(state.creds)
            ? "Crée un modèle en quatre questions, sans écrire de prompt."
            : "Le plan Gratuit n’autorise pas la création d’un modèle personnel."),
        global.AgiloLibraryApi.canCreate(state.creds)
          ? '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-tab="creer">Créer un modèle</button>'
          : ""
      );
      return tools + empty;
    }
    var body = state.view === "table" ? tableHtml(list) : gridHtml(list, "normal");
    return tools + body;
  }

  function panelPinned() {
    var C = global.AgiloLibraryCore;
    var list = C.sortModels(filteredPinned());
    var intro = '<p class="agilo-lib-note">Épingles : ' + counts().pinned + " / " + state.pinMax +
      ". Les épingles restent en haut de tes usages quotidiens.</p>";
    if (!list.length) {
      return intro + C.emptyHtml(
        "Aucun épinglé",
        "Épingle jusqu’à 5 modèles depuis le menu Actions.",
        '<button type="button" class="agilo-lib-btn" data-tab="mes-modeles">Voir mes modèles</button>'
      );
    }
    return intro + gridHtml(list, "normal");
  }

  function wizardHtml() {
    var C = global.AgiloLibraryCore;
    var Api = global.AgiloLibraryApi;
    if (!Api.canCreate(state.creds)) {
      return C.emptyHtml(
        "Création réservée aux plans Pro et Business",
        "Le plan Gratuit permet d’utiliser les modèles Agilotext, pas d’en créer un personnel.",
        '<a class="agilo-lib-btn agilo-lib-btn--primary" href="' + C.escapeHtml(Api.cfg().pricingUrl) + '">Voir les offres</a>'
      );
    }
    if (state.creating) {
      return '<div class="agilo-lib-banner agilo-lib-banner--info agilo-lib-pulse" role="status">' +
        "Création en cours… Le serveur construit le modèle à partir de tes 4 réponses. Aucun prompt à relire.</div>";
    }
    if (state.created) {
      var m = state.created;
      return '<div class="agilo-lib-banner agilo-lib-banner--success">Modèle créé. Tu peux l’utiliser tout de suite.</div>' +
        C.cardHtml(m, { size: "featured" }) +
        '<div class="agilo-lib-actions-row">' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="use" data-id="' + m.promptModelId + '">Utiliser</button>' +
        '<button type="button" class="agilo-lib-btn" data-act="edit" data-id="' + m.promptModelId + '">Ouvrir dans l’atelier</button>' +
        '<button type="button" class="agilo-lib-btn" data-tab="mes-modeles">Voir mes modèles</button>' +
        "</div>";
    }
    var w = state.wizard;
    var steps = [1, 2, 3, 4].map(function (n) {
      return "<span" + (n <= w.step ? ' class="is-on"' : "") + ">" + n + "</span>";
    }).join("");
    var body = "";
    if (w.step === 1) {
      body = '<label>Nom du modèle <span class="agilo-lib-req">*</span>' +
        '<input id="wiz-name" maxlength="80" value="' + C.escapeHtml(w.name) + '" placeholder="Exemple : Modèle de réunion"></label>' +
        '<p><button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="next">Continuer</button></p>';
    } else if (w.step === 2) {
      body = '<label>Objectif du document <span class="agilo-lib-req">*</span>' +
        '<textarea id="wiz-obj" rows="5" placeholder="Quel est le résultat attendu (rapport, synthèse, décisions) ? Qui sont tes interlocuteurs ?">' +
        C.escapeHtml(w.objective) + "</textarea></label>" +
        '<p class="agilo-lib-note">Exemples cliquables :</p>' +
        '<div class="agilo-lib-chips">' +
        ["Compte rendu de comité de direction", "Synthèse d’un entretien client", "Note de réunion projet"]
          .map(function (e) { return '<button type="button" class="agilo-lib-btn" data-ex="' + C.escapeHtml(e) + '">' + C.escapeHtml(e) + "</button>"; })
          .join("") + "</div>" +
        '<p><button type="button" class="agilo-lib-btn" data-wiz="back">Retour</button> ' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="next">Continuer</button></p>';
    } else if (w.step === 3) {
      body = '<label>Informations à toujours faire figurer' +
        '<textarea id="wiz-info" rows="4" placeholder="Ex. responsables, échéances, votes, risques.">' +
        C.escapeHtml(w.specificInfo) + "</textarea></label>" +
        '<p><button type="button" class="agilo-lib-btn" data-wiz="back">Retour</button> ' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="next">Continuer</button></p>';
    } else {
      body = '<label>Structure souhaitée' +
        '<textarea id="wiz-struct" rows="4">' + C.escapeHtml(w.structure) + "</textarea></label>" +
        '<p class="agilo-lib-note">Décris l’ordre des sections. Le serveur s’en sert pour construire le modèle.</p>' +
        '<p><button type="button" class="agilo-lib-btn" data-wiz="back">Retour</button> ' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="create">Créer le modèle</button></p>';
    }
    var official = state.models.filter(function (m) { return m.type === "STANDARD" && m.canCopyOfficial; });
    official = global.AgiloLibraryCore.sortOfficial(official);
    var fromStd = official.length
      ? '<section class="agilo-lib-section-block"><h2>Ou partir d’un modèle Agilotext</h2>' +
        '<p class="agilo-lib-note">Une copie personnelle est créée. Tu pourras ensuite la modifier.</p>' +
        '<div class="agilo-lib-chips">' +
        official.map(function (m) {
          return '<button type="button" data-dup-std="' + m.promptModelId + '">' +
            C.iconHtml(m, 14) + " " + C.escapeHtml(m.cardTitle) + "</button>";
        }).join("") + "</div></section>"
      : "";
    return '<div class="agilo-lib-wizard">' +
      "<h2>Créer un modèle</h2>" +
      '<p class="agilo-lib-lead">Quatre questions. Tu décris le document souhaité. Tu n’écris pas un prompt.</p>' +
      '<div class="agilo-lib-wizard-steps" aria-hidden="true">' + steps + "</div>" +
      '<div class="agilo-lib-form">' + body + "</div>" +
      '<p class="agilo-lib-note">Le tutoriel vidéo reste disponible dans Mon compte, onglet modèles.</p>' +
      "</div>" + fromStd;
  }

  function versionsDrawerHtml() {
    if (!state.versionsModel) return "";
    var C = global.AgiloLibraryCore;
    var m = state.versionsModel;
    var rows;
    if (state.versionsLoading) {
      rows = "<li>Chargement des versions…</li>";
    } else if (!state.versions.length) {
      rows = "<li>Aucune version enregistrée pour ce modèle.</li>";
    } else {
      rows = state.versions.slice(0, 3).map(function (v) {
        var current = v.isCurrent || v.current;
        var label = v.label || ("Version " + (v.versionNumber || ""));
        var date = v.createdAt ? C.formatDate(Date.parse(v.createdAt) || v.createdAt) : "";
        return "<li><span><strong>" + C.escapeHtml(label) + "</strong><br>" +
          C.escapeHtml(date) + (current ? " · actuelle" : "") + "</span>" +
          (current
            ? "<span>En cours</span>"
            : '<button type="button" class="agilo-lib-btn" data-restore="' + C.escapeHtml(v.versionId) + '">Restaurer</button>') +
          "</li>";
      }).join("");
    }
    return '<div class="agilo-lib-drawer is-open" role="dialog" aria-modal="true">' +
      '<div class="agilo-lib-drawer__panel">' +
      '<div class="agilo-lib-drawer__head"><h2>Versions · ' + C.escapeHtml(m.cardTitle) + "</h2>" +
      '<button type="button" class="agilo-lib-icon-btn" data-close-drawer aria-label="Fermer">' + C.svgIcon("plus", 16) + "</button></div>" +
      '<p class="agilo-lib-note">Jusqu’à 3 snapshots du modèle. Ce n’est pas l’historique du compte rendu. Restaurer remplace l’état courant, l’état remplacé reste dans l’historique.</p>' +
      '<ul class="agilo-lib-versions">' + rows + "</ul></div></div>";
  }

  function bannersHtml() {
    var pending = /(?:^|[?&])(?:pack|checkout)=pending(?:&|$)/.test((global.location && global.location.search) || "");
    if (!pending) return "";
    return '<div class="agilo-lib-banner agilo-lib-banner--upgrade" role="status">' +
      "<span>Pack en cours d’activation (quelques secondes).</span>" +
      '<button type="button" class="agilo-lib-btn" data-act="reload">Recharger</button></div>';
  }

  function bodyHtml() {
    if (state.tab === "mes-modeles") return panelMine();
    if (state.tab === "epingles") return panelPinned();
    if (state.tab === "creer") return wizardHtml();
    return panelOfficial();
  }

  function paint(root) {
    writeHash();
    root.innerHTML = bannersHtml() + headHtml() + tabsHtml() +
      '<div class="agilo-lib-panel" id="panel-' + state.tab + '" role="tabpanel" aria-labelledby="tab-' + state.tab + '">' +
      bodyHtml() + "</div>" + versionsDrawerHtml();
    var input = root.querySelector("#agilo-lib-q");
    if (input && document.activeElement && document.activeElement.id === "agilo-lib-q") {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) { /* ignore */ }
    }
    bind(root);
  }

  function setTab(root, tab) {
    state.tab = tab;
    if (tab === "creer") state.created = null;
    paint(root);
  }

  function bind(root) {
    var reload = root.querySelector('[data-act="reload"]');
    if (reload) reload.addEventListener("click", function () { location.reload(); });

    root.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { setTab(root, btn.getAttribute("data-tab")); });
    });

    var tablist = root.querySelector(".agilo-lib-tabs");
    if (tablist) {
      tablist.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var buttons = Array.prototype.slice.call(tablist.querySelectorAll("[data-tab]"));
        var i = buttons.indexOf(document.activeElement);
        if (i < 0) return;
        var next = e.key === "ArrowRight" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
        buttons[next].focus();
        buttons[next].click();
      });
    }

    var input = root.querySelector("#agilo-lib-q");
    if (input) {
      input.addEventListener("input", function () {
        var v = input.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          state.q = v;
          paint(root);
        }, 160);
      });
    }

    root.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.category = b.getAttribute("data-cat");
        paint(root);
      });
    });

    root.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.view = b.getAttribute("data-view");
        try { sessionStorage.setItem("agilo:lib:view", state.view); } catch (_) { /* ignore */ }
        paint(root);
      });
    });

    root.querySelectorAll("[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var col = th.getAttribute("data-sort");
        if (state.sort.col === col) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else {
          state.sort.col = col;
          state.sort.dir = col === "name" ? "asc" : "desc";
        }
        paint(root);
      });
    });

    bindWizard(root);
    bindCards(root);
    bindDrawer(root);
  }

  function readWizardFields(root) {
    var name = root.querySelector("#wiz-name");
    var obj = root.querySelector("#wiz-obj");
    var info = root.querySelector("#wiz-info");
    var struct = root.querySelector("#wiz-struct");
    if (name) state.wizard.name = name.value;
    if (obj) state.wizard.objective = obj.value;
    if (info) state.wizard.specificInfo = info.value;
    if (struct) state.wizard.structure = struct.value;
  }

  function bindWizard(root) {
    root.querySelectorAll("[data-wiz]").forEach(function (b) {
      b.addEventListener("click", function () {
        readWizardFields(root);
        var act = b.getAttribute("data-wiz");
        if (act === "back") state.wizard.step = Math.max(1, state.wizard.step - 1);
        if (act === "next") {
          if (state.wizard.step === 1 && !state.wizard.name.trim()) {
            state.wizard.name = "Mon modèle";
          }
          state.wizard.step = Math.min(4, state.wizard.step + 1);
        }
        if (act === "create") {
          doCreate(root);
          return;
        }
        paint(root);
      });
    });
    root.querySelectorAll("[data-ex]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = root.querySelector("#wiz-obj");
        if (ta) ta.value = b.getAttribute("data-ex");
        state.wizard.objective = b.getAttribute("data-ex");
      });
    });
    ["#wiz-name", "#wiz-obj", "#wiz-info", "#wiz-struct"].forEach(function (sel) {
      var el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", function () { readWizardFields(root); });
    });
    root.querySelectorAll("[data-dup-std]").forEach(function (b) {
      b.addEventListener("click", function () {
        var model = byId(b.getAttribute("data-dup-std"));
        if (model) askDuplicate(root, model);
      });
    });
  }

  function bindCards(root) {
    function handle(model, act, btn) {
      if (!model) return;
      if (act === "more") {
        global.AgiloLibraryCore.openCardMenu(btn, global.AgiloLibraryCore.menuItems(model), function (picked) {
          handle(model, picked, btn);
        });
        return;
      }
      if (act === "use" || act === "default") doDefault(root, model, btn, act === "use");
      if (act === "pin") doPin(root, model, btn);
      if (act === "duplicate") askDuplicate(root, model);
      if (act === "rename") askRename(root, model);
      if (act === "edit") openEdit(model);
      if (act === "versions") openVersions(root, model);
      if (act === "delete") askDelete(root, model);
    }
    root.querySelectorAll("[data-id]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn || btn.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        handle(byId(el.getAttribute("data-id")), btn.getAttribute("data-act"), btn);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target === el) {
          var useBtn = el.querySelector('[data-act="use"]');
          if (useBtn && !useBtn.disabled) useBtn.click();
        }
      });
    });
  }

  function bindDrawer(root) {
    function closeDrawer() {
      state.versionsModel = null;
      state.versions = [];
      paint(root);
    }
    var close = root.querySelector("[data-close-drawer]");
    if (close) close.addEventListener("click", closeDrawer);
    var drawer = root.querySelector(".agilo-lib-drawer");
    if (drawer) {
      drawer.addEventListener("click", function (e) {
        if (e.target === drawer) closeDrawer();
      });
    }
    root.querySelectorAll("[data-restore]").forEach(function (b) {
      b.addEventListener("click", function () {
        var model = state.versionsModel;
        if (!model) return;
        global.AgiloLibraryCore.confirmDialog({
          title: "Restaurer cette version ?",
          text: "L’état actuel reste dans l’historique (3 max).",
          ok: "Restaurer",
          onOk: function () {
            global.AgiloLibraryApi.restoreVersion(state.creds, model.promptModelId, b.getAttribute("data-restore")).then(function (res) {
              if (!res.ok) {
                global.AgiloLibraryCore.toast(res.message || "Restauration impossible.");
                return;
              }
              global.AgiloLibraryCore.toast("Version restaurée.");
              state.versionsModel = null;
              reload(root);
            });
          }
        });
      });
    });
  }

  function dashboardLink() {
    var href = global.AgiloLibraryApi.appPath("dashboard");
    return ' <a href="' + href + '">Aller au tableau de bord</a>';
  }

  function doDefault(root, model, btn, asUse) {
    try {
      global.AgiloLibraryApi.assertGenerationId(model.promptModelId);
    } catch (err) {
      global.AgiloLibraryCore.toast(err.message);
      return;
    }
    if (global.AgiloLibraryCore.locked(model)) return;
    if (btn) btn.disabled = true;
    global.AgiloLibraryApi.setDefault(state.creds, model.promptModelId).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) {
        global.AgiloLibraryCore.toast(res.message || "Impossible de définir le défaut.");
        return;
      }
      global.AgiloLibraryCore.toast("", {
        html: "Modèle par défaut : " + global.AgiloLibraryCore.escapeHtml(model.cardTitle) + "." + dashboardLink()
      });
      reload(root);
    });
  }

  function doPin(root, model, btn) {
    if (global.AgiloLibraryCore.locked(model)) return;
    var n = counts().pinned;
    if (!model.pinned && n >= state.pinMax) {
      global.AgiloLibraryCore.toast("5 épingles maximum. Désépingle un modèle d’abord.");
      return;
    }
    if (btn) btn.disabled = true;
    global.AgiloLibraryApi.setPinned(state.creds, model.promptModelId, !model.pinned).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) {
        global.AgiloLibraryCore.toast(res.message || "Épinglage indisponible.");
        return;
      }
      reload(root);
    });
  }

  function askDuplicate(root, model) {
    global.AgiloLibraryCore.promptDialog({
      title: model.type === "STANDARD" ? "Ajouter à mes modèles" : "Enregistrer sous",
      text: "Donne un nom personnel. La copie t’appartient.",
      label: "Nom",
      value: model.cardTitle,
      ok: "Copier",
      onOk: function (name) {
        global.AgiloLibraryApi.duplicate(state.creds, model.promptModelId, name).then(function (res) {
          if (res.reload) {
            global.AgiloLibraryCore.toast(res.message || "Recharge la page.");
            return;
          }
          if (!res.ok) {
            global.AgiloLibraryCore.toast(res.message || "Copie impossible.");
            return;
          }
          global.AgiloLibraryCore.toast("Modèle ajouté.");
          state.tab = "mes-modeles";
          reload(root);
        });
      }
    });
  }

  function askRename(root, model) {
    global.AgiloLibraryCore.promptDialog({
      title: "Renommer",
      label: "Nouveau nom",
      value: model.cardTitle,
      ok: "Enregistrer",
      onOk: function (name) {
        global.AgiloLibraryApi.rename(state.creds, model.promptModelId, name).then(function (res) {
          if (!res.ok) {
            global.AgiloLibraryCore.toast(res.message || "Renommage impossible.");
            return;
          }
          global.AgiloLibraryCore.toast("Modèle renommé.");
          reload(root);
        });
      }
    });
  }

  function askDelete(root, model) {
    global.AgiloLibraryCore.confirmDialog({
      title: "Supprimer ce modèle ?",
      text: "« " + model.cardTitle + " » sera définitivement retiré." +
        (model.isDefault ? " Le défaut reviendra au modèle Agilotext." : ""),
      ok: "Supprimer",
      danger: true,
      onOk: function () {
        global.AgiloLibraryApi.deleteModel(state.creds, model.promptModelId).then(function (res) {
          if (!res.ok) {
            global.AgiloLibraryCore.toast(res.message || "Suppression impossible.");
            return;
          }
          global.AgiloLibraryCore.toast(model.isDefault
            ? "Modèle supprimé. Le défaut revient au modèle Agilotext."
            : "Modèle personnel supprimé.");
          reload(root);
        });
      }
    });
  }

  function openEdit(model) {
    var cfg = global.AgiloLibraryApi.cfg();
    if ((cfg.atelierEnabled || global.AgiloPromptStudio) &&
      global.AgiloPromptStudio && typeof global.AgiloPromptStudio.openModalAndSelect === "function") {
      global.AgiloPromptStudio.openModalAndSelect(String(model.promptModelId));
      return;
    }
    global.location.href = global.AgiloLibraryApi.appPath("profile");
  }

  function openVersions(root, model) {
    state.versionsModel = model;
    state.versionsLoading = true;
    state.versions = [];
    paint(root);
    global.AgiloLibraryApi.listVersions(state.creds, model.promptModelId).then(function (res) {
      state.versionsLoading = false;
      if (!res.ok) {
        global.AgiloLibraryCore.toast(res.message || "Versions indisponibles.");
        state.versionsModel = null;
        paint(root);
        return;
      }
      state.versions = res.versions || [];
      paint(root);
    });
  }

  function doCreate(root) {
    var w = state.wizard;
    if (!w.name.trim()) w.name = "Mon modèle";
    state.creating = true;
    paint(root);
    global.AgiloLibraryApi.createFromWizard(state.creds, {
      name: w.name.trim(),
      objective: w.objective.trim(),
      specificInfo: w.specificInfo.trim(),
      structure: w.structure.trim()
    }).then(function (res) {
      if (!res.ok) {
        state.creating = false;
        paint(root);
        global.AgiloLibraryCore.toast(res.message || "Impossible de créer le modèle.");
        return;
      }
      var d = res.data || {};
      var newId = d.promptModelId || d.promptId;
      if (!newId) {
        state.creating = false;
        paint(root);
        global.AgiloLibraryCore.toast("Modèle créé, recharge pour le voir.");
        reload(root);
        return;
      }
      return global.AgiloLibraryApi.waitPromptReady(state.creds, newId).then(function (ready) {
        state.creating = false;
        if (!ready.ok) {
          paint(root);
          global.AgiloLibraryCore.toast(ready.message || "Création encore en cours.");
          reload(root);
          return;
        }
        return reload(root).then(function () {
          var created = byId(newId) || {
            promptModelId: Number(newId),
            cardTitle: w.name,
            type: "USER",
            publicDescription: w.objective || "Modèle créé depuis le wizard.",
            publicExample: w.structure,
            hasHtml: true,
            iconKey: "wand",
            canUse: true,
            canEdit: true,
            canSetDefault: true
          };
          state.created = created;
          state.tab = "creer";
          paint(root);
        });
      });
    }).catch(function () {
      state.creating = false;
      paint(root);
      global.AgiloLibraryCore.toast("Réseau interrompu. Réessaie.");
    });
  }

  function reload(root) {
    return global.AgiloLibraryApi.fetchLists(state.creds).then(function (pack) {
      state.models = pack.models;
      state.pinMax = pack.pinMax || 5;
      paint(root);
    });
  }

  function mount(root, creds, access, pack) {
    state.creds = creds;
    state.access = access;
    state.models = pack.models || [];
    state.pinMax = pack.pinMax || 5;
    readHash();
    paint(root);
    if (!global.__agiloLibHashBound) {
      global.__agiloLibHashBound = true;
      global.addEventListener("hashchange", function () {
        var prev = state.tab;
        readHash();
        if (state.tab !== prev && root.isConnected) paint(root);
      });
    }
  }

  global.AgiloLibraryCatalog = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
