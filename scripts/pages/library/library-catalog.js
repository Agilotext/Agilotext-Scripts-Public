/**
 * Catalogue : onglets, recherche, chips, grille / tableau, overlays fiche / wizard / versions.
 * @version 1.4.2
 */
(function (global) {
  "use strict";

  var PAGE_SIZE = 24;
  var LOTTIE_JSON = "https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355a2_8zwgooV43N.json";
  var LOTTIE_PLAYER = "https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js";
  var WIZ_EXAMPLES = [
    "Compte rendu de comité de direction",
    "Synthèse d’un entretien client",
    "Note de réunion projet"
  ];

  var TABS = [
    { id: "agilotext", label: "Modèles Agilotext" },
    { id: "mes-modeles", label: "Mes modèles" },
    { id: "epingles", label: "Épinglés" },
    { id: "creer", label: "Créer un modèle" }
  ];

  var state = {
    q: "",
    tab: "agilotext",
    prevTab: "agilotext",
    category: "all",
    view: "grid",
    viewTouched: false,
    page: 1,
    sort: { col: "updated", dir: "desc" },
    models: [],
    creds: null,
    access: null,
    pinMax: 5,
    ficheModel: null,
    wizardOpen: false,
    wizard: {
      step: 1,
      name: "",
      objective: "",
      specificInfo: "",
      structure: "Décisions, actions, prochaine étape",
      iconKey: "",
      iconQuery: "",
      iconTouched: false,
      suggestedKey: "",
      suggestSig: "",
      suggesting: false
    },
    dismissedWizard: false,
    versionsModel: null,
    versions: [],
    versionsLoading: false,
    iconCatalog: null,
    iconCatalogLoading: false,
    iconCatalogError: "",
    ficheIconOpen: false,
    ficheIconQuery: "",
    ficheIconSaving: false
  };

  var searchTimer = null;
  var lottieAnim = null;
  var suggestTimer = null;
  var PIN_BANNER_KEY = "agilo:lib:pinsBanner:v1";

  function library2Live() {
    return !!(global.AgiloLibraryApi && global.AgiloLibraryApi.cfg && global.AgiloLibraryApi.cfg().library2Live);
  }

  function byId(id) {
    return state.models.filter(function (m) { return Number(m.promptModelId) === Number(id); })[0];
  }

  function iconPickerHtml(selectedKey, query) {
    if (!library2Live()) return "";
    var P = global.AgiloLibraryIconPicker;
    if (!P) return "";
    return P.html({
      selectedKey: selectedKey || "",
      query: query || "",
      icons: state.iconCatalog || [],
      loading: state.iconCatalogLoading,
      error: state.iconCatalogError,
      suggesting: state.wizard.suggesting
    });
  }

  function ensureIconCatalog(root) {
    if (!library2Live()) return;
    if (state.iconCatalog || state.iconCatalogLoading) return;
    var P = global.AgiloLibraryIconPicker;
    if (!P) return;
    state.iconCatalogLoading = true;
    P.load(state.creds).then(function (res) {
      state.iconCatalogLoading = false;
      if (res.ok) {
        state.iconCatalog = res.icons || [];
        state.iconCatalogError = "";
      } else {
        state.iconCatalog = [];
        state.iconCatalogError = res.message || "Catalogue d’icônes indisponible.";
      }
      var mode = overlayMode();
      if (mode === "wizard" || (mode === "fiche" && state.ficheIconOpen)) {
        syncOverlay(root);
      }
    });
  }

  function maybeSuggestIcon(root) {
    if (!library2Live()) return;
    if (state.wizard.iconTouched) return;
    var name = String(state.wizard.name || "").trim();
    var obj = String(state.wizard.objective || "").trim();
    if (!name || !obj) return;
    var sig = name + "\n" + obj;
    if (state.wizard.suggestSig === sig) return;
    state.wizard.suggestSig = sig;
    state.wizard.suggesting = true;
    global.AgiloLibraryApi.suggestPromptModelIcon(state.creds, name, obj).then(function (res) {
      state.wizard.suggesting = false;
      if (res.ok && res.iconKey && !state.wizard.iconTouched) {
        state.wizard.iconKey = res.iconKey;
        state.wizard.suggestedKey = res.iconKey;
      }
      markSelectedIcon(state.wizard.iconKey);
    }).catch(function () {
      state.wizard.suggesting = false;
    });
  }

  function markSelectedIcon(key) {
    var Overlay = global.AgiloLibraryOverlay;
    var host = Overlay && Overlay.isOpen() ? Overlay.host() : null;
    if (!host) return;
    host.querySelectorAll("[data-icon-key]").forEach(function (btn) {
      var on = btn.getAttribute("data-icon-key") === String(key || "");
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function scheduleSuggest(root) {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(function () { maybeSuggestIcon(root); }, 400);
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
      if (global.AgiloLibraryApi && global.AgiloLibraryApi.isHiddenOfficial &&
          global.AgiloLibraryApi.isHiddenOfficial(m.promptModelId)) return false;
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
    if (raw === "creer") state.wizardOpen = true;
    try {
      var view = sessionStorage.getItem("agilo:lib:view");
      if (view === "table" || view === "grid") state.view = view;
    } catch (_) { /* ignore */ }
  }

  function writeHash() {
    if (!global.history || !global.location) return;
    var id = state.wizardOpen ? "creer" : state.tab;
    var next = "#" + id;
    if (global.location.hash !== next) {
      global.history.replaceState(null, "", next);
    }
  }

  function noun() {
    return (state.access && state.access.noun) || "compte rendu";
  }

  function overlayMode() {
    if (state.wizardOpen) return "wizard";
    if (state.versionsModel) return "versions";
    if (state.ficheModel) return "fiche";
    return "";
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
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-open-wizard>' +
      C.svgIcon("sparkle", 16) + " Créer un modèle</button>" +
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
        q ? "Aucun modèle ne correspond à « " + q + " »." : "Aucun modèle officiel ne correspond à ce filtre.",
        "",
        "search"
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
      (rest.length ? gridHtml(rest, "normal") : C.emptyHtml("Rien d’autre dans ce filtre", "Change de catégorie ou vide la recherche.", "", "search")) +
      "</section>";
    return html;
  }

  function pagerHtml(total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (pages <= 1) return "";
    return '<div class="agilo-lib-pager">' +
      '<button type="button" class="agilo-lib-btn" data-page="-1"' + (state.page <= 1 ? " disabled" : "") + ">Précédent</button>" +
      "<span>Page " + state.page + " / " + pages + " · " + total + " modèles</span>" +
      '<button type="button" class="agilo-lib-btn" data-page="1"' + (state.page >= pages ? " disabled" : "") + ">Suivant</button>" +
      "</div>";
  }

  function paginate(list) {
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
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
          ? '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-open-wizard>Créer un modèle</button>'
          : "",
        q ? "search" : "sparkle"
      );
      return tools + empty;
    }
    if (!state.viewTouched && list.length > 12) state.view = "table";
    var slice = paginate(list);
    var body = state.view === "table" ? tableHtml(slice) : gridHtml(slice, "normal");
    return tools + body + pagerHtml(list.length);
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
        '<button type="button" class="agilo-lib-btn" data-tab="mes-modeles">Voir mes modèles</button>',
        "pin"
      );
    }
    return intro + gridHtml(list, "normal");
  }

  function panelCreateLanding() {
    var C = global.AgiloLibraryCore;
    var Api = global.AgiloLibraryApi;
    if (!Api.canCreate(state.creds)) {
      return C.emptyHtml(
        "Création réservée aux plans Pro et Business",
        "Le plan Gratuit permet d’utiliser les modèles Agilotext, pas d’en créer un personnel.",
        '<a class="agilo-lib-btn agilo-lib-btn--primary" href="' + C.escapeHtml(Api.cfg().pricingUrl) + '">Voir les offres</a>',
        "lock"
      );
    }
    return C.emptyHtml(
      "Créer un modèle",
      "Quatre questions courtes. Tu décris le document souhaité. Tu n’écris pas un prompt.",
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-open-wizard>' +
        C.svgIcon("sparkle", 16) + " Commencer</button>",
      "sparkle"
    );
  }

  function reducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  function playLottie(box) {
    if (!box || reducedMotion()) return;
    function boot() {
      if (!global.lottie || typeof global.lottie.loadAnimation !== "function") return;
      if (lottieAnim && typeof lottieAnim.destroy === "function") {
        try { lottieAnim.destroy(); } catch (_) { /* ignore */ }
      }
      lottieAnim = global.lottie.loadAnimation({
        container: box,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: LOTTIE_JSON
      });
    }
    if (global.lottie) {
      boot();
      return;
    }
    if (document.querySelector("script[data-agilo-lottie]")) {
      var wait = setInterval(function () {
        if (global.lottie) {
          clearInterval(wait);
          boot();
        }
      }, 80);
      setTimeout(function () { clearInterval(wait); }, 4000);
      return;
    }
    var s = document.createElement("script");
    s.src = LOTTIE_PLAYER;
    s.async = true;
    s.setAttribute("data-agilo-lottie", "1");
    s.onload = boot;
    document.head.appendChild(s);
  }

  function wizardFreeHtml() {
    var C = global.AgiloLibraryCore;
    var Api = global.AgiloLibraryApi;
    return C.emptyHtml(
      "Création réservée aux plans Pro et Business",
      "Le plan Gratuit permet d’utiliser les modèles Agilotext, pas d’en créer un personnel.",
      '<a class="agilo-lib-btn agilo-lib-btn--primary" href="' + C.escapeHtml(Api.cfg().pricingUrl) + '">Voir les offres</a>',
      "lock"
    );
  }

  function wizardHtml() {
    var C = global.AgiloLibraryCore;
    var Api = global.AgiloLibraryApi;
    if (!Api.canCreate(state.creds)) return wizardFreeHtml();
    if (state.creating) {
      return '<div class="agilo-lib-lottie" id="agilo-lib-lottie" aria-hidden="true"></div>' +
        '<div class="agilo-lib-banner agilo-lib-banner--info" role="status">' +
        "<span>Création en cours. Tu peux fermer, le modèle arrive dans Mes modèles.</span></div>";
    }
    if (state.created) {
      var m = state.created;
      return '<div class="agilo-lib-banner agilo-lib-banner--success">Modèle créé. Tu peux l’utiliser tout de suite.</div>' +
        C.cardHtml(m, { size: "featured" }) +
        '<div class="agilo-lib-actions-row">' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="use" data-id="' + m.promptModelId + '">Utiliser par défaut</button>' +
        '<button type="button" class="agilo-lib-btn" data-tab="mes-modeles">Voir mes modèles</button>' +
        "</div>";
    }
    var w = state.wizard;
    var Cico = C.svgIcon;
    var steps = [1, 2, 3, 4].map(function (n) {
      var on = n === w.step ? " is-on" : "";
      var inner = n < w.step ? Cico("check", 14) : String(n);
      return "<span class=\"" + (n < w.step ? "is-on" : "") + on + "\">" + inner + "</span>";
    }).join("");
    var body = "";
    if (w.step === 1) {
      body = '<label><span>Nom du modèle <span class="agilo-lib-req">*</span></span>' +
        '<input id="wiz-name" maxlength="80" value="' + C.escapeHtml(w.name) + '" placeholder="Exemple : Modèle de réunion"></label>';
    } else if (w.step === 2) {
      body = '<label><span>Objectif principal (court) <span class="agilo-lib-req">*</span></span>' +
        '<textarea id="wiz-obj" rows="4" placeholder="Ex. synthèse actionnable, focus décisions et next steps">' +
        C.escapeHtml(w.objective) + "</textarea></label>" +
        '<div class="agilo-lib-chips">' +
        WIZ_EXAMPLES.map(function (e) {
          return '<button type="button" data-ex="' + C.escapeHtml(e) + '">' + C.escapeHtml(e) + "</button>";
        }).join("") + "</div>";
    } else if (w.step === 3) {
      body = '<label>Infos clés à ressortir' +
        '<textarea id="wiz-info" rows="4" placeholder="Décisions, actions, dates, responsables, chiffres…">' +
        C.escapeHtml(w.specificInfo) + "</textarea></label>";
    } else {
      body = '<label>Structure souhaitée' +
        '<textarea id="wiz-struct" rows="4">' + C.escapeHtml(w.structure) + "</textarea></label>" +
        '<p class="agilo-lib-note">Décris l’ordre des sections. Le serveur s’en sert pour construire le modèle.</p>';
    }
    var nav = '<div class="agilo-lib-actions-row">';
    if (w.step > 1) {
      nav += '<button type="button" class="agilo-lib-btn" data-wiz="back">' + Cico("arrow-left", 16) + " Retour</button>";
    }
    if (w.step < 4) {
      nav += '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="next">Continuer ' +
        Cico("arrow-right", 16) + "</button>";
    } else {
      nav += '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="create">Créer le modèle</button>';
    }
    nav += "</div>";
    var picker = state.wizard.step >= 2 ? iconPickerHtml(state.wizard.iconKey, state.wizard.iconQuery) : "";
    return '<p class="agilo-lib-wizard-kicker">Question ' + w.step + " / 4</p>" +
      '<div class="agilo-lib-wizard-steps" aria-hidden="true">' + steps + "</div>" +
      '<div class="agilo-lib-form">' + body + "</div>" + picker + nav;
  }

  function versionsHtml() {
    var C = global.AgiloLibraryCore;
    var m = state.versionsModel;
    if (!m) return "";
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
    return '<p class="agilo-lib-note">Jusqu’à 3 snapshots du modèle. Ce n’est pas l’historique du compte rendu. Restaurer remplace l’état courant, l’état remplacé reste dans l’historique.</p>' +
      '<ul class="agilo-lib-versions">' + rows + "</ul>";
  }

  function ficheHtml() {
    var C = global.AgiloLibraryCore;
    var m = state.ficheModel;
    if (!m) return "";
    var layout = m.hasHtml ? "Oui, mise en page HTML" : "Texte structuré";
    var desc = m.publicDescription || "Pas de description publique pour l’instant.";
    var example = m.publicExample
      ? '<p class="agilo-lib-note"><strong>Exemple</strong> : ' + C.escapeHtml(m.publicExample) + "</p>"
      : "";
    var acts = C.menuItems(m).map(function (it) {
      return '<button type="button" class="agilo-lib-btn' + (it.danger ? " agilo-lib-btn--danger" : "") +
        '" data-act="' + C.escapeHtml(it.act) + '">' + C.svgIcon(it.icon || "dots", 16) + " " +
        C.escapeHtml(it.label) + "</button>";
    }).join("");
    var useBtn = (m.canUse && global.AgiloLibraryApi.isGenerationSafeId(m.promptModelId))
      ? '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="use"' +
        (m.isDefault ? " disabled" : "") + ">Utiliser par défaut</button>"
      : "";
    var canIcon = global.AgiloLibraryApi.canSetUserIcon &&
      global.AgiloLibraryApi.canSetUserIcon(m.promptModelId, m.type) && !C.locked(m);
    var iconBtn = canIcon
      ? '<button type="button" class="agilo-lib-btn" data-act="icon">' + C.svgIcon("custom", 16) +
        " Changer l’icône</button>"
      : "";
    var picker = (canIcon && state.ficheIconOpen) ? iconPickerHtml(m.iconKey, state.ficheIconQuery) : "";
    return C.previewHtml(m) +
      '<p class="agilo-lib-prompt-note">Le prompt Agilotext n’est jamais affiché. Description publique et exemple de sortie seulement.</p>' +
      '<p class="agilo-lib-lead">' + C.escapeHtml(desc) + "</p>" +
      example +
      "<p class=\"agilo-lib-note\">Mise en page : " + layout + "</p>" +
      '<div class="agilo-lib-card__meta">' + C.badgeHtml(m) + "</div>" +
      '<div class="agilo-lib-actions-row" data-id="' + m.promptModelId + '">' + useBtn + iconBtn + acts + "</div>" +
      picker;
  }

  function overlayTitle(mode) {
    if (mode === "wizard") return "Créer un modèle";
    if (mode === "versions" && state.versionsModel) return "Versions · " + state.versionsModel.cardTitle;
    if (mode === "fiche" && state.ficheModel) return state.ficheModel.cardTitle;
    return "";
  }

  function overlayHtml(mode) {
    if (mode === "wizard") return wizardHtml();
    if (mode === "versions") return versionsHtml();
    if (mode === "fiche") return ficheHtml();
    return "";
  }

  function onOverlayClosed(root) {
    var wasWizard = state.wizardOpen;
    if (state.creating) state.dismissedWizard = true;
    state.ficheModel = null;
    state.versionsModel = null;
    state.versions = [];
    state.wizardOpen = false;
    state.ficheIconOpen = false;
    if (wasWizard) {
      state.tab = state.prevTab && state.prevTab !== "creer" ? state.prevTab : "agilotext";
      paint(root);
    }
  }

  function syncOverlay(root) {
    var Overlay = global.AgiloLibraryOverlay;
    if (!Overlay) return;
    var mode = overlayMode();
    if (!mode) {
      Overlay.close({ silent: true });
      return;
    }
    var payload = {
      mode: mode,
      title: overlayTitle(mode),
      html: overlayHtml(mode),
      onClose: function () { onOverlayClosed(root); },
      bind: function (host) { bindOverlay(root, host); }
    };
    var same = Overlay.isOpen() && Overlay.host().getAttribute("data-mode") === mode;
    if (same) Overlay.update(payload);
    else Overlay.open(payload);
  }

  function pinsBannerSeen() {
    try { return !!localStorage.getItem(PIN_BANNER_KEY); } catch (_) { return true; }
  }

  function bannersHtml() {
    var bits = [];
    var pending = /(?:^|[?&])(?:pack|checkout)=pending(?:&|$)/.test((global.location && global.location.search) || "");
    if (pending) {
      bits.push('<div class="agilo-lib-banner agilo-lib-banner--upgrade" role="status">' +
        "<span>Pack en cours d’activation (quelques secondes).</span>" +
        '<button type="button" class="agilo-lib-btn" data-act="reload">Recharger</button></div>');
    }
    if (library2Live() && counts().pinned === 0 && !pinsBannerSeen()) {
      bits.push('<div class="agilo-lib-banner agilo-lib-banner--info" role="status" data-pins-banner>' +
        "<span>Tes épingles se recochent ici. Le modèle par défaut partagé n’a pas bougé.</span>" +
        '<button type="button" class="agilo-lib-btn" data-dismiss-pins-banner>OK</button></div>');
    }
    return bits.join("");
  }

  function bodyHtml() {
    if (state.tab === "mes-modeles") return panelMine();
    if (state.tab === "epingles") return panelPinned();
    if (state.tab === "creer") return panelCreateLanding();
    return panelOfficial();
  }

  function paint(root, opts) {
    opts = opts || {};
    writeHash();
    if (opts.panelOnly && root.querySelector(".agilo-lib-panel") && root.querySelector("#agilo-lib-q")) {
      var panel = root.querySelector(".agilo-lib-panel");
      panel.id = "panel-" + state.tab;
      panel.setAttribute("aria-labelledby", "tab-" + state.tab);
      panel.innerHTML = bodyHtml();
      bindPanel(root);
      if (!opts.skipOverlay) syncOverlay(root);
      return;
    }
    root.innerHTML = bannersHtml() + headHtml() + tabsHtml() +
      '<div class="agilo-lib-panel" id="panel-' + state.tab + '" role="tabpanel" aria-labelledby="tab-' + state.tab + '">' +
      bodyHtml() + "</div>";
    var input = root.querySelector("#agilo-lib-q");
    if (input && document.activeElement && document.activeElement.id === "agilo-lib-q") {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) { /* ignore */ }
    }
    bind(root);
    if (!opts.skipOverlay) syncOverlay(root);
  }

  function openWizard(root) {
    if (state.tab !== "creer") state.prevTab = state.tab;
    state.wizardOpen = true;
    state.ficheModel = null;
    state.versionsModel = null;
    state.created = state.creating ? state.created : null;
    state.tab = "creer";
    paint(root);
  }

  function setTab(root, tab) {
    state.tab = tab;
    state.page = 1;
    if (tab === "creer") {
      openWizard(root);
      return;
    }
    paint(root);
  }

  function bind(root) {
    var reload = root.querySelector('[data-act="reload"]');
    if (reload) reload.addEventListener("click", function () { location.reload(); });

    var dismissPins = root.querySelector("[data-dismiss-pins-banner]");
    if (dismissPins) {
      dismissPins.addEventListener("click", function () {
        try { localStorage.setItem(PIN_BANNER_KEY, "1"); } catch (_) { /* ignore */ }
        var bar = root.querySelector("[data-pins-banner]");
        if (bar) bar.remove();
      });
    }

    root.querySelectorAll(".agilo-lib-tabs [data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { setTab(root, btn.getAttribute("data-tab")); });
    });

    root.querySelectorAll("[data-open-wizard]").forEach(function (btn) {
      btn.addEventListener("click", function () { openWizard(root); });
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
    if (input && !input.getAttribute("data-bound")) {
      input.setAttribute("data-bound", "1");
      input.addEventListener("input", function () {
        var v = input.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          state.q = v;
          state.page = 1;
          paint(root, { panelOnly: true });
        }, 160);
      });
    }

    bindPanel(root);
  }

  function bindPanel(root) {
    var panel = root.querySelector(".agilo-lib-panel") || root;
    panel.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { setTab(root, btn.getAttribute("data-tab")); });
    });
    panel.querySelectorAll("[data-open-wizard]").forEach(function (btn) {
      btn.addEventListener("click", function () { openWizard(root); });
    });

    root.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.category = b.getAttribute("data-cat");
        state.page = 1;
        paint(root, { panelOnly: true });
      });
    });

    root.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.view = b.getAttribute("data-view");
        state.viewTouched = true;
        try { sessionStorage.setItem("agilo:lib:view", state.view); } catch (_) { /* ignore */ }
        paint(root, { panelOnly: true });
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
        paint(root, { panelOnly: true });
      });
    });

    root.querySelectorAll("[data-page]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.page += Number(b.getAttribute("data-page") || 0);
        paint(root, { panelOnly: true });
      });
    });

    bindCards(root);
  }

  function bindOverlay(root, host) {
    bindWizard(root, host);
    bindCards(root, host);
    bindVersions(root, host);
    bindIconPicker(root, host);
    host.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        global.AgiloLibraryOverlay.close({ silent: true });
        state.wizardOpen = false;
        state.created = null;
        setTab(root, btn.getAttribute("data-tab"));
      });
    });
    var box = host.querySelector("#agilo-lib-lottie");
    if (box) playLottie(box);
  }

  function bindIconPicker(root, host) {
    var P = global.AgiloLibraryIconPicker;
    if (!P || !host.querySelector(".agilo-lib-iconpick")) return;
    var inWizard = overlayMode() === "wizard";
    function onSelect(key) {
      if (inWizard) {
        state.wizard.iconKey = key;
        state.wizard.iconTouched = true;
        syncOverlay(root);
        return;
      }
      var model = state.ficheModel;
      if (!model || !global.AgiloLibraryApi.canSetUserIcon(model.promptModelId, model.type)) {
        global.AgiloLibraryCore.toast("Seuls tes modèles personnels ont une icône modifiable.");
        return;
      }
      if (state.ficheIconSaving) return;
      state.ficheIconSaving = true;
      global.AgiloLibraryApi.setPromptModelUserIcon(state.creds, model.promptModelId, key).then(function (res) {
        state.ficheIconSaving = false;
        if (!res.ok) {
          global.AgiloLibraryCore.toast(res.message || "Icône non enregistrée.");
          return;
        }
        global.AgiloLibraryCore.toast("Icône enregistrée.");
        reload(root);
      }).catch(function () {
        state.ficheIconSaving = false;
        global.AgiloLibraryCore.toast("Réseau interrompu. Réessaie.");
      });
    }
    P.bind(host, {
      onFilter: function (q) {
        if (inWizard) state.wizard.iconQuery = q;
        else state.ficheIconQuery = q;
        P.applyFilter(
          host,
          state.iconCatalog || [],
          inWizard ? state.wizard.iconKey : (state.ficheModel && state.ficheModel.iconKey),
          q
        );
        P.bindCells(host, { onSelect: onSelect });
      },
      onSelect: onSelect
    });
  }

  function readWizardFields(scope) {
    var name = scope.querySelector("#wiz-name");
    var obj = scope.querySelector("#wiz-obj");
    var info = scope.querySelector("#wiz-info");
    var struct = scope.querySelector("#wiz-struct");
    if (name) state.wizard.name = name.value;
    if (obj) state.wizard.objective = obj.value;
    if (info) state.wizard.specificInfo = info.value;
    if (struct) state.wizard.structure = struct.value;
  }

  function bindWizard(root, scope) {
    scope = scope || root;
    scope.querySelectorAll("[data-wiz]").forEach(function (b) {
      b.addEventListener("click", function () {
        readWizardFields(scope);
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
        syncOverlay(root);
        if (state.wizard.step >= 2) {
          ensureIconCatalog(root);
          maybeSuggestIcon(root);
        }
      });
    });
    scope.querySelectorAll("[data-ex]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = scope.querySelector("#wiz-obj");
        if (ta) ta.value = b.getAttribute("data-ex");
        state.wizard.objective = b.getAttribute("data-ex");
        if (state.wizard.step >= 2) {
          ensureIconCatalog(root);
          scheduleSuggest(root);
        }
      });
    });
    ["#wiz-name", "#wiz-obj", "#wiz-info", "#wiz-struct"].forEach(function (sel) {
      var el = scope.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", function () {
        readWizardFields(scope);
        if (sel === "#wiz-name" || sel === "#wiz-obj") scheduleSuggest(root);
      });
    });
  }

  function bindCards(root, scope) {
    scope = scope || root;
    function handle(model, act, btn) {
      if (!model) return;
      if (act === "more") {
        global.AgiloLibraryCore.openCardMenu(btn, global.AgiloLibraryCore.menuItems(model), function (picked) {
          handle(model, picked, btn);
        });
        return;
      }
      if (act === "fiche") {
        state.versionsModel = null;
        state.wizardOpen = false;
        state.ficheModel = model;
        state.ficheIconOpen = false;
        syncOverlay(root);
        return;
      }
      if (act === "use" || act === "default") doDefault(root, model, btn, act === "use");
      if (act === "pin") doPin(root, model, btn);
      if (act === "duplicate") askDuplicate(root, model);
      if (act === "rename") askRename(root, model);
      if (act === "edit") openEdit(model);
      if (act === "versions") openVersions(root, model);
      if (act === "delete") askDelete(root, model);
      if (act === "icon") openIconPicker(root, model);
    }
    scope.querySelectorAll("[data-id]").forEach(function (el) {
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

  function openIconPicker(root, model) {
    if (!global.AgiloLibraryApi.canSetUserIcon ||
      !global.AgiloLibraryApi.canSetUserIcon(model.promptModelId, model.type) ||
      global.AgiloLibraryCore.locked(model)) {
      global.AgiloLibraryCore.toast("Seuls tes modèles personnels ont une icône modifiable.");
      return;
    }
    state.wizardOpen = false;
    state.versionsModel = null;
    state.ficheModel = model;
    state.ficheIconOpen = true;
    ensureIconCatalog(root);
    syncOverlay(root);
  }

  function bindVersions(root, host) {
    host.querySelectorAll("[data-restore]").forEach(function (b) {
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
              global.AgiloLibraryOverlay.close({ silent: true });
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
    if (global.AgiloLibraryApi.canCreate && !global.AgiloLibraryApi.canCreate(state.creds)) {
      global.AgiloLibraryCore.toast("Le plan Gratuit ne permet pas de définir un modèle par défaut.");
      return;
    }
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
    if (global.AgiloLibraryApi.canCreate && !global.AgiloLibraryApi.canCreate(state.creds) && model.type === "STANDARD") {
      global.AgiloLibraryCore.toast("Le plan Gratuit ne permet pas d’épingler un modèle officiel.");
      return;
    }
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
    if (global.AgiloLibraryApi.canCreate && !global.AgiloLibraryApi.canCreate(state.creds)) {
      global.AgiloLibraryCore.toast("Le plan Gratuit ne permet pas d’ajouter un modèle à votre bibliothèque.");
      return;
    }
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
          if (res.alreadyAcquired) {
            global.AgiloLibraryCore.toast("Ce modèle est déjà dans Mes modèles.");
            state.tab = "mes-modeles";
            var copyId = res.promptModelId;
            return reload(root).then(function () {
              if (copyId) {
                state.ficheModel = byId(copyId) || null;
                state.ficheIconOpen = false;
                syncOverlay(root);
              }
            });
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
          if (state.ficheModel && state.ficheModel.promptModelId === model.promptModelId) {
            state.ficheModel = null;
            global.AgiloLibraryOverlay.close({ silent: true });
          }
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
    state.ficheModel = null;
    state.wizardOpen = false;
    state.versionsModel = model;
    state.versionsLoading = true;
    state.versions = [];
    syncOverlay(root);
    global.AgiloLibraryApi.listVersions(state.creds, model.promptModelId).then(function (res) {
      state.versionsLoading = false;
      if (!res.ok) {
        global.AgiloLibraryCore.toast(res.message || "Versions indisponibles.");
        state.versionsModel = null;
        syncOverlay(root);
        return;
      }
      state.versions = res.versions || [];
      syncOverlay(root);
    });
  }

  function doCreate(root) {
    var w = state.wizard;
    if (!w.name.trim()) w.name = "Mon modèle";
    state.creating = true;
    state.created = null;
    state.dismissedWizard = false;
    syncOverlay(root);
    global.AgiloLibraryApi.createFromWizard(state.creds, {
      name: w.name.trim(),
      objective: w.objective.trim(),
      specificInfo: w.specificInfo.trim(),
      structure: w.structure.trim(),
      iconKey: (w.iconKey || "").trim()
    }).then(function (res) {
      if (!res.ok) {
        state.creating = false;
        syncOverlay(root);
        global.AgiloLibraryCore.toast(res.message || "Impossible de créer le modèle.");
        return;
      }
      var d = res.data || {};
      var newId = d.promptModelId || d.promptId;
      if (!newId) {
        state.creating = false;
        global.AgiloLibraryCore.toast("Modèle créé, recharge pour le voir.");
        reload(root);
        return;
      }
      return global.AgiloLibraryApi.waitPromptReady(state.creds, newId).then(function (ready) {
        state.creating = false;
        if (!ready.ok) {
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
            iconKey: d.iconKey || w.iconKey || "",
            iconUrl: global.AgiloLibraryApi.absIconUrl(d.iconUrl),
            canUse: true,
            canEdit: true,
            canSetDefault: true
          };
          if (state.dismissedWizard) {
            state.dismissedWizard = false;
            state.created = null;
            state.wizardOpen = false;
            state.tab = "mes-modeles";
            global.AgiloLibraryCore.toast("Modèle créé. Il est dans Mes modèles.");
            paint(root);
            return;
          }
          state.created = created;
          state.wizardOpen = true;
          state.tab = "creer";
          paint(root);
        });
      });
    }).catch(function () {
      state.creating = false;
      syncOverlay(root);
      global.AgiloLibraryCore.toast("Réseau interrompu. Réessaie.");
    });
  }

  function reload(root) {
    return global.AgiloLibraryApi.fetchLists(state.creds).then(function (pack) {
      state.models = pack.models;
      state.pinMax = pack.pinMax || 5;
      if (state.ficheModel) {
        state.ficheModel = byId(state.ficheModel.promptModelId) || state.ficheModel;
      }
      paint(root);
    });
  }

  function mount(root, creds, access, pack) {
    state.creds = creds;
    state.access = access;
    state.models = pack.models || [];
    state.pinMax = pack.pinMax || 5;
    readHash();
    if (state.wizardOpen) state.prevTab = "agilotext";
    paint(root);
    if (!global.__agiloLibHashBound) {
      global.__agiloLibHashBound = true;
      global.addEventListener("hashchange", function () {
        var prev = state.tab;
        var wasOpen = state.wizardOpen;
        readHash();
        if ((state.tab !== prev || state.wizardOpen !== wasOpen) && root.isConnected) paint(root);
      });
    }
  }

  global.AgiloLibraryCatalog = { VERSION: "1.4.2", mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
