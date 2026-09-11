/**
 * Catalogue v2 : header une ligne, onglets, recherche, grille / tableau,
 * fiche v2 (aperçu prompt), wizard v2, Prompt Studio en overlay, deep link #modele=<id>.
 * Activé par window.__AGILO_PROMPT_LIBRARY__.uiV2 === true (library-main.js).
 * library-catalog.js (v1) reste intact.
 * @version 2.2.0
 */
(function (global) {
  "use strict";

  var PAGE_SIZE = 24;
  var LOTTIE_JSON = "https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/6815bee5a9c0b57da18355a2_8zwgooV43N.json";
  var LOTTIE_PLAYER = "https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js";
  var PIN_BANNER_KEY = "agilo:lib:pinsBanner:v2";
  var SUGGEST_DELAY = 600;

  var TABS = [
    { id: "agilotext", label: "Modèles Agilotext" },
    { id: "mes-modeles", label: "Mes modèles" },
    { id: "epingles", label: "Épinglés" }
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
    wizardOpen: false,
    creating: false,
    created: null,
    createdPending: false,
    dismissedWizard: false,
    versionsModel: null,
    versions: [],
    versionsLoading: false,
    iconCatalog: null,
    iconCatalogLoading: false,
    iconCatalogError: "",
    studioReturnId: null,
    pendingDeepLink: null
  };

  /** État de la fiche ouverte (réinitialisé à chaque ouverture). */
  var F = null;

  var searchTimer = null;
  var suggestTimer = null;
  var lottieAnim = null;
  var bodyObserver = null;

  function Api() { return global.AgiloLibraryApi; }
  function C() { return global.AgiloLibraryCoreV2 || global.AgiloLibraryCore; }
  function Fiche() { return global.AgiloLibraryFicheV2; }
  function Wiz() { return global.AgiloLibraryWizardV2; }
  function Overlay() { return global.AgiloLibraryOverlay; }
  function esc(s) { return C().escapeHtml(s); }
  function track(name, params) { if (Api().track) Api().track(name, params || {}); }

  function library2Live() {
    return !!(Api() && Api().cfg && Api().cfg().library2Live);
  }

  function byId(id) {
    return state.models.filter(function (m) { return Number(m.promptModelId) === Number(id); })[0];
  }

  function isFree() {
    return !(Api().canCreate && Api().canCreate(state.creds));
  }

  /* ------------------------------------------------------------------ */
  /* Icônes : catalogue + suggestions                                    */
  /* ------------------------------------------------------------------ */
  function ensureIconCatalog(root, cb) {
    if (!library2Live()) return;
    if (state.iconCatalog) { cb && cb(); return; }
    if (state.iconCatalogLoading) return;
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
      cb && cb();
      var mode = overlayMode();
      if (mode === "wizard" || (mode === "fiche" && F && F.iconOpen)) syncOverlay(root);
    });
  }

  /** Voisins de même catégorie que `key` (2 max), pour compléter la suggestion serveur. */
  function neighbors(key, fallbackCategory, max) {
    var icons = state.iconCatalog || [];
    var main = icons.filter(function (ic) { return ic.iconKey === key; })[0];
    var cat = (main && main.category) || fallbackCategory || "";
    var out = [];
    icons.forEach(function (ic) {
      if (out.length >= (max || 2)) return;
      if (ic.iconKey === key) return;
      if (cat && ic.category !== cat) return;
      out.push(ic.iconKey);
    });
    return out;
  }

  function suggestKeys(name, objective, fallbackCategory, done) {
    if (!library2Live() || !Api().suggestPromptModelIcon) { done([]); return; }
    var n = String(name || "").trim();
    if (!n) { done([]); return; }
    var o = String(objective || "").trim() || n;
    Api().suggestPromptModelIcon(state.creds, n, o).then(function (res) {
      var key = res && res.ok ? String(res.iconKey || "") : "";
      var keys = key ? [key].concat(neighbors(key, fallbackCategory, 2)) : neighbors("", fallbackCategory, 3);
      done(keys, key);
    }).catch(function () { done([]); });
  }

  /* ------------------------------------------------------------------ */
  /* Filtres, tri                                                        */
  /* ------------------------------------------------------------------ */
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
    return state.models.filter(function (m) { return m.type === "USER" && matchesQuery(m, q); });
  }

  function filteredPinned() {
    var q = state.q.trim().toLowerCase();
    return state.models.filter(function (m) { return m.pinned && matchesQuery(m, q); });
  }

  function sortMine(list) {
    var col = state.sort.col;
    var dir = state.sort.dir === "asc" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      if (col === "name") return dir * String(a.cardTitle).localeCompare(String(b.cardTitle), "fr");
      if (col === "created") return dir * ((a.dtCreation || 0) - (b.dtCreation || 0));
      return dir * ((a.dtUpdate || 0) - (b.dtUpdate || 0));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hash / deep link                                                    */
  /* ------------------------------------------------------------------ */
  function readHash() {
    var params = new URLSearchParams((global.location && global.location.search) || "");
    var fromQuery = params.get("tab");
    var hash = String((global.location && global.location.hash) || "").replace(/^#/, "");
    var modele = /^modele=(-?\d+)$/.exec(hash);
    if (modele) {
      state.pendingDeepLink = Number(modele[1]);
      return;
    }
    var raw = fromQuery || hash;
    var known = TABS.some(function (t) { return t.id === raw; });
    if (known) state.tab = raw;
    if (raw === "creer") state.wizardOpen = true;
    var open = params.get("open");
    if (open && /^-?\d+$/.test(open)) state.pendingDeepLink = Number(open);
    try {
      var view = sessionStorage.getItem("agilo:lib:view");
      if (view === "table" || view === "grid") state.view = view;
    } catch (_) { /* ignore */ }
  }

  function writeHash() {
    if (!global.history || !global.location) return;
    var next;
    if (F && F.model) next = "#modele=" + F.model.promptModelId;
    else if (state.wizardOpen) next = "#creer";
    else next = "#" + state.tab;
    if (global.location.hash !== next) global.history.replaceState(null, "", next);
  }

  /* ------------------------------------------------------------------ */
  /* Rendu page                                                          */
  /* ------------------------------------------------------------------ */
  function overlayMode() {
    if (state.wizardOpen) return "wizard";
    if (state.versionsModel) return "versions";
    if (F && F.model) return "fiche";
    return "";
  }

  function headHtml() {
    var Core = C();
    return '<div class="agilo-lib-head agilo-lib-head--v2">' +
      "<h1>Modèles de documents</h1>" +
      '<div class="agilo-lib-head__tools">' +
      '<div class="agilo-lib-search">' + Core.svgIcon("search", 16) +
      '<label class="visually-hidden" for="agilo-lib-q">Rechercher un modèle</label>' +
      '<input id="agilo-lib-q" type="search" placeholder="Rechercher un modèle" value="' + esc(state.q) + '" autocomplete="off">' +
      '<kbd class="agilo-lib-search__kbd" aria-hidden="true">/</kbd></div>' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-open-wizard>' +
      Core.svgIcon("plus", 16) + " Créer un modèle</button>" +
      "</div></div>";
  }

  function tabsHtml() {
    var n = counts();
    return '<div class="agilo-lib-tabs" role="tablist" aria-label="Sections de la bibliothèque">' +
      TABS.map(function (t) {
        var selected = state.tab === t.id;
        var count = "";
        if (t.id === "agilotext" && n.official) count = '<span class="agilo-lib-tab__n">' + n.official + "</span>";
        if (t.id === "mes-modeles") count = '<span class="agilo-lib-tab__n">' + n.mine + "</span>";
        if (t.id === "epingles") count = '<span class="agilo-lib-tab__n">' + n.pinned + "/" + state.pinMax + "</span>";
        return '<button type="button" class="agilo-lib-tab' + (selected ? " is-active" : "") +
          '" role="tab" id="tab-' + t.id + '" data-tab="' + t.id + '" aria-selected="' + selected + '"' +
          ' aria-controls="panel-' + t.id + '">' + t.label + count + "</button>";
      }).join("") +
      "</div>";
  }

  function categoryLabel() {
    var cats = (global.AgiloLibraryStandards && global.AgiloLibraryStandards.CATEGORIES) || [];
    var hit = cats.filter(function (c) { return c.key === state.category; })[0];
    return hit && hit.key !== "all" ? hit.label : "";
  }

  function countLine(total, shown) {
    var q = state.q.trim();
    var cat = categoryLabel();
    var txt;
    if (q) {
      txt = (shown === 0 ? "Aucun résultat" : shown + (shown > 1 ? " résultats" : " résultat")) + " pour « " + esc(q) + " »";
    } else if (cat) {
      txt = shown === 0
        ? "Aucun modèle dans " + esc(cat)
        : shown + (shown > 1 ? " modèles" : " modèle") + " dans " + esc(cat);
    } else {
      txt = total + (total > 1 ? " modèles" : " modèle");
    }
    return '<p class="agilo-lib-count" role="status">' + txt + "</p>";
  }

  function officialCategoryCounts() {
    var countsByKey = {};
    state.models.forEach(function (m) {
      if (m.type !== "STANDARD") return;
      var key = m.categoryKey || "general";
      countsByKey[key] = (countsByKey[key] || 0) + 1;
    });
    return countsByKey;
  }

  function chipsHtml() {
    var cats = (global.AgiloLibraryStandards && global.AgiloLibraryStandards.CATEGORIES) || [];
    if (!cats.length) return "";
    var nByCat = officialCategoryCounts();
    var visible = cats.filter(function (c) {
      if (c.key === "all") return true;
      return (nByCat[c.key] || 0) > 0;
    });
    if (!visible.length) return "";
    var current = state.category;
    if (current !== "all" && !(nByCat[current] > 0)) current = "all";
    return '<div class="agilo-lib-chips" role="group" aria-label="Filtres métier">' +
      visible.map(function (c) {
        return '<button type="button" data-cat="' + c.key + '"' +
          (c.key === current ? ' class="is-active"' : "") + ">" + esc(c.label) + "</button>";
      }).join("") + "</div>";
  }

  function gridHtml(models, size) {
    var Core = C();
    return '<div class="agilo-lib-grid' + (size === "featured" ? " agilo-lib-featured" : "") + '">' +
      models.map(function (m, i) { return Core.cardHtml(m, { size: size || "normal", index: i }); }).join("") +
      "</div>";
  }

  function viewToggleHtml() {
    var Core = C();
    return '<div class="agilo-lib-view-toggle" role="group" aria-label="Affichage">' +
      '<button type="button" data-view="grid"' + (state.view === "grid" ? ' class="is-active"' : "") +
      ' aria-pressed="' + (state.view === "grid") + '">' + Core.svgIcon("grid", 14) + " Grille</button>" +
      '<button type="button" data-view="table"' + (state.view === "table" ? ' class="is-active"' : "") +
      ' aria-pressed="' + (state.view === "table") + '">' + Core.svgIcon("table", 14) + " Tableau</button>" +
      "</div>";
  }

  function sortMark(col) {
    if (state.sort.col !== col) return "";
    return state.sort.dir === "asc" ? " ↑" : " ↓";
  }

  function tableHtml(models) {
    var Core = C();
    if (!models.length) return "";
    return '<div class="agilo-lib-table-wrap"><table class="agilo-lib-table agilo-lib-table--v2">' +
      "<thead><tr>" +
      '<th data-sort="name">Nom' + sortMark("name") + "</th>" +
      "<th>Statut</th>" +
      '<th data-sort="created">Créé' + sortMark("created") + "</th>" +
      '<th data-sort="updated">Modifié' + sortMark("updated") + "</th>" +
      '<th class="agilo-lib-th--actions">Actions</th>' +
      "</tr></thead><tbody>" +
      models.map(Core.tableRowHtml).join("") +
      "</tbody></table></div>" +
      '<div class="agilo-lib-table-cards">' + gridHtml(models, "compact") + "</div>";
  }

  function panelOfficial() {
    var Core = C();
    var nByCat = officialCategoryCounts();
    if (state.category !== "all" && !(nByCat[state.category] > 0)) state.category = "all";
    var list = Core.sortOfficial(filteredOfficial());
    var q = state.q.trim();
    var head = countLine(counts().official, list.length);
    if (!list.length) {
      var cat = categoryLabel();
      var extra = q
        ? '<button type="button" class="agilo-lib-btn" data-clear-q>Effacer la recherche</button>'
        : (cat ? '<button type="button" class="agilo-lib-btn" data-cat="all">Voir tous les modèles</button>' : "");
      var text = q
        ? "Aucun modèle ne correspond à « " + q + " »."
        : (cat ? "Aucun modèle dans " + cat + "." : "Aucun modèle officiel n’est disponible pour l’instant.");
      return chipsHtml() + head + Core.emptyHtml("Aucun modèle Agilotext", text, extra, "search");
    }
    var featured = [];
    var rest = list;
    if (!q && state.category === "all") {
      featured = list.filter(function (m) { return m.featured; }).slice(0, 3);
      var featIds = {};
      featured.forEach(function (m) { featIds[m.promptModelId] = true; });
      rest = list.filter(function (m) { return !featIds[m.promptModelId]; });
    }
    var html = chipsHtml() + head;
    if (featured.length) {
      html += '<section class="agilo-lib-section-block"><h2>À la une</h2>' + gridHtml(featured, "featured") + "</section>";
    }
    html += '<section class="agilo-lib-section-block">' + (featured.length ? "<h2>Tous les modèles Agilotext</h2>" : "") +
      gridHtml(rest, "normal") + "</section>";
    return html;
  }

  function pagerHtml(total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (pages <= 1) return "";
    return '<div class="agilo-lib-pager">' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-page="-1"' + (state.page <= 1 ? " disabled" : "") + ">Précédent</button>" +
      "<span>Page " + state.page + " / " + pages + "</span>" +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-page="1"' + (state.page >= pages ? " disabled" : "") + ">Suivant</button>" +
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
    var Core = C();
    var list = sortMine(filteredMine());
    var q = state.q.trim();
    if (!list.length) {
      var canCreate = !isFree();
      var tools = q ? '<div class="agilo-lib-panel-tools">' + countLine(counts().mine, list.length) + "</div>" : "";
      return tools + Core.emptyHtml(
        q ? "Aucun résultat" : "Pas encore de modèle personnel",
        q ? "Aucun modèle ne correspond à « " + q + " »."
          : (canCreate ? "Répondez à quatre questions, Agilotext rédige le prompt pour vous." : "Le plan Gratuit n’autorise pas la création d’un modèle personnel."),
        q ? '<button type="button" class="agilo-lib-btn" data-clear-q>Effacer la recherche</button>'
          : (canCreate ? '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-open-wizard>' + Core.svgIcon("plus", 16) + " Créer un modèle</button>"
            : '<a class="agilo-lib-btn agilo-lib-btn--primary" href="' + esc(Api().cfg().pricingUrl) + '">Voir les offres</a>'),
        q ? "search" : "sparkle"
      );
    }
    if (!state.viewTouched && list.length > 12) state.view = "table";
    var tools = '<div class="agilo-lib-panel-tools">' + countLine(counts().mine, list.length) + viewToggleHtml() + "</div>";
    var slice = paginate(list);
    var body = state.view === "table" ? tableHtml(slice) : gridHtml(slice, "normal");
    return tools + body + pagerHtml(list.length);
  }

  function panelPinned() {
    var Core = C();
    var list = Core.sortModels(filteredPinned());
    var intro = '<p class="agilo-lib-count">' + counts().pinned + " / " + state.pinMax + " épingles. Elles restent en haut de vos usages quotidiens.</p>";
    if (!list.length) {
      return intro + Core.emptyHtml(
        "Aucun modèle épinglé",
        "Épinglez jusqu’à " + state.pinMax + " modèles depuis le menu Autres actions.",
        '<button type="button" class="agilo-lib-btn" data-tab="agilotext">Parcourir les modèles</button>',
        "pin"
      );
    }
    return intro + gridHtml(list, "normal");
  }

  function pinsBannerSeen() {
    try { return !!localStorage.getItem(PIN_BANNER_KEY); } catch (_) { return true; }
  }

  function bannersHtml() {
    var Core = C();
    var bits = [];
    var pending = /(?:^|[?&])(?:pack|checkout)=pending(?:&|$)/.test((global.location && global.location.search) || "");
    if (pending) {
      bits.push('<div class="agilo-lib-banner agilo-lib-banner--upgrade" role="status">' + Core.svgIcon("clock", 16) +
        "<span>Pack en cours d’activation (quelques secondes).</span>" +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-act="reload">Recharger</button></div>');
    }
    if (library2Live() && counts().pinned === 0 && !pinsBannerSeen()) {
      bits.push('<div class="agilo-lib-banner agilo-lib-banner--info" role="status" data-pins-banner>' + Core.svgIcon("pin", 16) +
        "<span>Épinglez jusqu’à 5 modèles depuis le menu ⋯. Ça ne change pas le modèle par défaut.</span>" +
        '<button type="button" class="agilo-lib-icon-btn agilo-lib-icon-btn--sm" data-dismiss-pins-banner aria-label="Fermer">' + Core.svgIcon("xmark", 14) + "</button></div>");
    }
    return bits.join("");
  }

  function bodyHtml() {
    if (state.tab === "mes-modeles") return panelMine();
    if (state.tab === "epingles") return panelPinned();
    return panelOfficial();
  }

  function paint(root, opts) {
    opts = opts || {};
    if (C().closeMenus) C().closeMenus();
    writeHash();
    if (opts.panelOnly && root.querySelector(".agilo-lib-panel") && root.querySelector("#agilo-lib-q")) {
      var panel = root.querySelector(".agilo-lib-panel");
      panel.id = "panel-" + state.tab;
      panel.setAttribute("aria-labelledby", "tab-" + state.tab);
      panel.innerHTML = bodyHtml();
      root.querySelectorAll(".agilo-lib-tabs [data-tab]").forEach(function (b) {
        var on = b.getAttribute("data-tab") === state.tab;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
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

  /* ------------------------------------------------------------------ */
  /* Overlay : fiche / wizard / versions                                 */
  /* ------------------------------------------------------------------ */
  function versionsHtml() {
    var Core = C();
    var m = state.versionsModel;
    if (!m) return "";
    var rows;
    if (state.versionsLoading) rows = "<li>Chargement des versions…</li>";
    else if (!state.versions.length) rows = "<li>Aucune version enregistrée pour ce modèle.</li>";
    else {
      rows = state.versions.slice(0, 3).map(function (v) {
        var current = v.isCurrent || v.current;
        var label = v.label || ("Version " + (v.versionNumber || ""));
        var date = v.createdAt ? Core.formatDate(Date.parse(v.createdAt) || v.createdAt) : "";
        return "<li><span><strong>" + esc(label) + "</strong><br>" + esc(date) + (current ? " · actuelle" : "") + "</span>" +
          (current ? "<span>En cours</span>"
            : '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-restore="' + esc(v.versionId) + '">Restaurer</button>') +
          "</li>";
      }).join("");
    }
    return '<p class="agilo-lib-note">Jusqu’à 3 snapshots du modèle. Restaurer remplace l’état courant, l’état remplacé reste dans l’historique.</p>' +
      '<ul class="agilo-lib-versions">' + rows + "</ul>";
  }

  function wizardCtx() {
    return {
      canCreate: !isFree(),
      pricingUrl: Api().cfg().pricingUrl,
      library2Live: library2Live(),
      iconCatalog: state.iconCatalog || [],
      iconCatalogLoading: state.iconCatalogLoading,
      iconCatalogError: state.iconCatalogError,
      creating: state.creating,
      created: state.created,
      createdPending: state.createdPending
    };
  }

  function overlayTitle(mode) {
    if (mode === "wizard") {
      if (state.creating || (state.created && state.createdPending)) return "Création en cours";
      if (state.created) return "Modèle créé";
      return Wiz().TITLE;
    }
    if (mode === "versions" && state.versionsModel) return "Versions · " + state.versionsModel.cardTitle;
    if (mode === "fiche" && F && F.model) return F.model.cardTitle;
    return "";
  }

  function overlayMeta(mode) {
    if (mode !== "wizard") return { text: "", aria: "" };
    if (state.creating || state.created) return { text: "", aria: "" };
    var W = Wiz();
    return W.stepMeta ? W.stepMeta() : { text: "", aria: "" };
  }

  function overlayHtml(mode) {
    if (mode === "wizard") return Wiz().html(wizardCtx());
    if (mode === "versions") return versionsHtml();
    if (mode === "fiche") return Fiche().html(F.model, F, state.creds);
    return "";
  }

  function onOverlayClosed(root) {
    var wasWizard = state.wizardOpen;
    if (state.creating) state.dismissedWizard = true;
    if (global.AgiloSpeechDictate && global.AgiloSpeechDictate.stop) {
      try { global.AgiloSpeechDictate.stop(); } catch (_) { /* ignore */ }
    }
    F = null;
    state.versionsModel = null;
    state.versions = [];
    state.wizardOpen = false;
    if (wasWizard) {
      state.tab = state.prevTab || "agilotext";
      paint(root);
      return;
    }
    writeHash();
  }

  function syncOverlay(root) {
    var O = Overlay();
    if (!O) return;
    var mode = overlayMode();
    if (!mode) {
      O.close({ silent: true });
      writeHash();
      return;
    }
    var meta = overlayMeta(mode);
    var payload = {
      mode: mode,
      title: overlayTitle(mode),
      html: overlayHtml(mode),
      meta: meta.text,
      metaAria: meta.aria,
      onClose: function () { onOverlayClosed(root); },
      bind: function (host) { bindOverlay(root, host); }
    };
    var same = O.isOpen() && O.host().getAttribute("data-mode") === mode;
    if (same) O.update(payload);
    else O.open(payload);
    writeHash();
  }

  function bindOverlay(root, host) {
    var mode = overlayMode();
    if (mode === "wizard") bindWizard(root, host);
    if (mode === "fiche") bindFiche(root, host);
    if (mode === "versions") bindVersions(root, host);
    host.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        Overlay().close({ silent: true });
        state.wizardOpen = false;
        state.created = null;
        F = null;
        setTab(root, btn.getAttribute("data-tab"));
      });
    });
    var box = host.querySelector("#agilo-lib-lottie");
    if (box) playLottie(box);
  }

  /* ---------------- fiche ---------------- */
  function openFiche(root, model, opts) {
    opts = opts || {};
    if (!model) return;
    if (C().closeMenus) C().closeMenus();
    state.versionsModel = null;
    state.wizardOpen = false;
    F = {
      model: model,
      previewText: "",
      previewLoading: false,
      previewError: "",
      previewExpanded: false,
      previewToken: "",
      iconOpen: !!opts.iconOpen,
      iconQuery: "",
      iconSuggestions: [],
      iconSuggesting: false,
      iconCatalog: state.iconCatalog || [],
      iconCatalogLoading: state.iconCatalogLoading,
      iconCatalogError: state.iconCatalogError,
      renaming: false,
      renameValue: null
    };
    syncOverlay(root);
    track("lib_fiche_open", { promptModelId: model.promptModelId, type: model.type });
    var local = F;
    if (Fiche().loadPreview(state.creds, model, local, function (res) {
      if (F !== local) return;
      if (res.ok) track("lib_prompt_preview", { promptModelId: model.promptModelId });
      syncOverlay(root);
    })) {
      syncOverlay(root);
    }
    if (F.iconOpen) openFicheIcons(root);
  }

  function openFicheIcons(root) {
    if (!F) return;
    var model = F.model;
    F.iconOpen = true;
    ensureIconCatalog(root, function () {
      if (!F || F.model !== model) return;
      F.iconCatalog = state.iconCatalog || [];
      F.iconCatalogLoading = false;
      F.iconCatalogError = state.iconCatalogError;
      syncOverlay(root);
    });
    F.iconCatalog = state.iconCatalog || [];
    F.iconCatalogLoading = state.iconCatalogLoading;
    if (!F.iconSuggestions.length && !F.iconSuggesting) {
      F.iconSuggesting = true;
      var local = F;
      suggestKeys(model.cardTitle, model.publicDescription, model.categoryKey, function (keys) {
        if (F !== local) return;
        F.iconSuggesting = false;
        F.iconSuggestions = keys || [];
        syncOverlay(root);
      });
    }
    syncOverlay(root);
  }

  function bindFiche(root, host) {
    if (!F) return;
    var model = F.model;
    Fiche().bind(host, model, F, {
      onAct: function (act, btn) { handleAct(root, model, act, btn); },
      onTogglePreview: function () { F.previewExpanded = !F.previewExpanded; syncOverlay(root); },
      onRetryPreview: function () {
        Api().forgetPromptContent && Api().forgetPromptContent(model.promptModelId);
        var local = F;
        F.previewError = "";
        Fiche().loadPreview(state.creds, model, local, function () { if (F === local) syncOverlay(root); });
        syncOverlay(root);
      },
      onRenameStart: function () { F.renaming = true; F.renameValue = model.cardTitle; syncOverlay(root); },
      onRenameCancel: function () { F.renaming = false; F.renameValue = null; syncOverlay(root); },
      onRename: function (name) {
        if (name === model.cardTitle) { F.renaming = false; syncOverlay(root); return; }
        Api().rename(state.creds, model.promptModelId, name).then(function (res) {
          if (!res.ok) { C().toast(res.message || "Renommage impossible."); return; }
          C().toast("Modèle renommé.");
          if (F) { F.renaming = false; F.renameValue = null; }
          reload(root);
        });
      },
      onIconClose: function () { F.iconOpen = false; syncOverlay(root); },
      onIconSelect: function (key) { setIcon(root, model, key); }
    });
  }

  function setIcon(root, model, key) {
    if (!Api().canSetUserIcon || !Api().canSetUserIcon(model.promptModelId, model.type)) {
      C().toast("Seuls vos modèles personnels ont une icône modifiable.");
      return;
    }
    if (F && F.iconSaving) return;
    if (F) F.iconSaving = true;
    Api().setPromptModelUserIcon(state.creds, model.promptModelId, key).then(function (res) {
      if (F) F.iconSaving = false;
      if (!res.ok) { C().toast(res.message || "Icône non enregistrée."); return; }
      C().toast("Icône enregistrée.");
      if (F) F.iconOpen = false;
      reload(root);
    }).catch(function () {
      if (F) F.iconSaving = false;
      C().toast("Réseau interrompu. Réessayez.");
    });
  }

  /* ---------------- wizard ---------------- */
  function openWizard(root) {
    if (C().closeMenus) C().closeMenus();
    if (state.tab !== "creer") state.prevTab = state.tab;
    state.wizardOpen = true;
    F = null;
    state.versionsModel = null;
    state.created = state.creating ? state.created : null;
    Wiz().reset();
    if (!isFree()) {
      ensureIconCatalog(root);
      scheduleSuggest(root);
    }
    track("lib_wizard_step", { step: Wiz().state().step });
    paint(root);
  }

  function scheduleSuggest(root) {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(function () { wizardSuggest(root); }, SUGGEST_DELAY);
  }

  function wizardSuggest(root) {
    if (!state.wizardOpen || !library2Live()) return;
    var W = Wiz().state();
    var sig = Wiz().suggestSignature();
    if (!sig || sig === W.suggestSig) return;
    W.suggestSig = sig;
    W.suggesting = true;
    if (W.step === 1) syncOverlay(root);
    suggestKeys(W.name, W.objective, "custom", function (keys, main) {
      if (!state.wizardOpen || Wiz().state() !== W) return;
      W.suggesting = false;
      W.suggestions = keys || [];
      if (main && !W.iconTouched) W.iconKey = main;
      if (W.step === 1 || W.step === 5) syncOverlay(root);
    });
  }

  function bindWizard(root, host) {
    var Wz = Wiz();
    Wz.bind(host, {
      onChange: function () {
        track("lib_wizard_step", { step: Wz.state().step });
        syncOverlay(root);
        if (Wz.state().step === 1) { ensureIconCatalog(root); }
        scheduleSuggest(root);
      },
      onFieldInput: function () { scheduleSuggest(root); },
      onCreate: function () { doCreate(root); },
      iconCatalog: function () { return state.iconCatalog || []; },
      onIconSelect: function (key) {
        var W = Wz.state();
        W.iconKey = key;
        W.iconTouched = true;
        Wz.saveDraft();
        syncOverlay(root);
      },
      onAct: function (act, id, btn) {
        var m = byId(id) || (state.created && Number(state.created.promptModelId) === Number(id) ? state.created : null);
        if (!m) return;
        handleAct(root, m, act, btn);
      },
      onTab: function (tab) {
        Overlay().close({ silent: true });
        state.wizardOpen = false;
        state.created = null;
        setTab(root, tab);
      }
    });
  }

  function doCreate(root) {
    var Wz = Wiz();
    var W = Wz.state();
    var d = Wz.draft();
    if (!d.iconKey && W.suggestions && W.suggestions[0]) d.iconKey = W.suggestions[0];
    state.creating = true;
    state.created = null;
    state.createdPending = false;
    state.dismissedWizard = false;
    syncOverlay(root);
    Api().createFromWizard(state.creds, d).then(function (res) {
      if (!res.ok) {
        state.creating = false;
        syncOverlay(root);
        C().toast(res.message || "Impossible de créer le modèle.");
        return;
      }
      var data = res.data || {};
      var newId = data.promptModelId || data.promptId;
      Wz.clearDraft();
      track("lib_wizard_created", { promptModelId: newId || 0 });
      if (!newId) {
        state.creating = false;
        C().toast("Modèle créé, rechargez pour le voir.");
        reload(root);
        return;
      }
      state.creating = false;
      state.createdPending = true;
      state.created = {
        promptModelId: Number(newId),
        cardTitle: d.name,
        type: "USER",
        publicDescription: d.objective,
        publicExample: d.structure,
        hasHtml: false,
        iconKey: data.iconKey || d.iconKey || "",
        iconUrl: Api().absIconUrl(data.iconUrl),
        promptModelStatus: "PENDING",
        canUse: true,
        canEdit: true,
        canSetDefault: true,
        canPin: true
      };
      if (state.dismissedWizard) {
        state.dismissedWizard = false;
        state.created = null;
        state.wizardOpen = false;
        state.tab = "mes-modeles";
      }
      paint(root);
      return Api().waitPromptReady(state.creds, newId).then(function (ready) {
        state.createdPending = false;
        if (!ready.ok) {
          C().toast(ready.message || "Création encore en cours.");
        }
        var applyIcon = Promise.resolve();
        if (d.iconKey && Api().canSetUserIcon && Api().canSetUserIcon(newId, "USER")) {
          applyIcon = Api().setPromptModelUserIcon(state.creds, newId, d.iconKey).catch(function () { return null; });
        }
        return applyIcon.then(function () {
        return reload(root).then(function () {
          var fresh = byId(newId);
          if (fresh) {
            if (!fresh.promptModelStatus) fresh.promptModelStatus = ready.ok ? "READY" : "PENDING";
            if (state.created) state.created = fresh;
          }
          if (state.wizardOpen) syncOverlay(root);
          else if (ready.ok) C().toast("Modèle « " + d.name + " » prêt dans Mes modèles.");
        });
        });
      });
    }).catch(function () {
      state.creating = false;
      syncOverlay(root);
      C().toast("Réseau interrompu. Réessayez.");
    });
  }

  /* ---------------- versions ---------------- */
  function openVersions(root, model) {
    if (C().closeMenus) C().closeMenus();
    F = null;
    state.wizardOpen = false;
    state.versionsModel = model;
    state.versionsLoading = true;
    state.versions = [];
    syncOverlay(root);
    Api().listVersions(state.creds, model.promptModelId).then(function (res) {
      state.versionsLoading = false;
      if (!res.ok) {
        C().toast(res.message || "Versions indisponibles.");
        state.versionsModel = null;
        syncOverlay(root);
        return;
      }
      state.versions = res.versions || [];
      syncOverlay(root);
    });
  }

  function bindVersions(root, host) {
    host.querySelectorAll("[data-restore]").forEach(function (b) {
      b.addEventListener("click", function () {
        var model = state.versionsModel;
        if (!model) return;
        C().confirmDialog({
          title: "Restaurer cette version ?",
          text: "L’état actuel reste dans l’historique (3 max).",
          ok: "Restaurer",
          onOk: function () {
            Api().restoreVersion(state.creds, model.promptModelId, b.getAttribute("data-restore")).then(function (res) {
              if (!res.ok) { C().toast(res.message || "Restauration impossible."); return; }
              C().toast("Version restaurée.");
              Api().forgetPromptContent && Api().forgetPromptContent(model.promptModelId);
              state.versionsModel = null;
              Overlay().close({ silent: true });
              reload(root);
            });
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Prompt Studio                                                       */
  /* ------------------------------------------------------------------ */
  function studio() {
    var S = global.AgiloPromptStudio;
    return S && typeof S.openModalAndSelect === "function" ? S : null;
  }

  function openEdit(root, model) {
    if (isFree()) {
      C().toast("Voir et modifier le prompt est réservé aux plans Pro et Business.");
      track("lib_upgrade_cta_click", { from: "edit_free" });
      return;
    }
    if (C().locked(model)) return;
    if (C().isReady && !C().isReady(model)) {
      C().toast("Le prompt est en cours de rédaction. Réessayez dans quelques secondes.");
      return;
    }
    var S = studio();
    if (!S) {
      C().toast("Éditeur indisponible pour l’instant. Rechargez la page, puis réessayez.");
      return;
    }
    state.studioReturnId = model.promptModelId;
    if (Overlay().isOpen()) Overlay().close({ silent: true });
    F = null;
    state.wizardOpen = false;
    state.created = null;
    writeHash();
    track("lib_studio_open", { promptModelId: model.promptModelId, type: model.type });
    watchStudioClose(root);
    try {
      S.openModalAndSelect(String(model.promptModelId), { getAuth: Api().credsForStudio });
    } catch (_) {
      C().toast("Éditeur indisponible pour l’instant.");
      state.studioReturnId = null;
    }
  }

  /** Le Studio pose body.agilo-ps-lock tant qu’il est ouvert : on le surveille pour rouvrir la fiche. */
  function watchStudioClose(root) {
    if (bodyObserver || !global.MutationObserver) return;
    var wasOpen = false;
    bodyObserver = new MutationObserver(function () {
      var open = document.body.classList.contains("agilo-ps-lock");
      if (open) { wasOpen = true; return; }
      if (!wasOpen) return;
      wasOpen = false;
      bodyObserver.disconnect();
      bodyObserver = null;
      var id = state.studioReturnId;
      state.studioReturnId = null;
      if (id == null) return;
      Api().forgetPromptContent && Api().forgetPromptContent(id);
      reload(root).then(function () {
        var m = byId(id);
        if (m && root.isConnected) openFiche(root, m);
      });
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  function bindStudioEvents(root) {
    if (global.__agiloLibStudioBound) return;
    global.__agiloLibStudioBound = true;
    global.addEventListener("agilo-ps-models-changed", function (e) {
      var d = (e && e.detail) || {};
      if (d.promptId != null && Api().forgetPromptContent) Api().forgetPromptContent(d.promptId);
      if (d.deleted && state.studioReturnId != null && Number(state.studioReturnId) === Number(d.promptId)) {
        state.studioReturnId = null;
      }
      if (!root.isConnected) return;
      reload(root).then(function () {
        if (d.deleted) C().toast("Modèle supprimé.");
        else if (d.promptName) C().toast("Copie « " + d.promptName + " » ajoutée à Mes modèles.");
        else C().toast("Modèle enregistré.");
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */
  function openAcquiredCopy(root, model) {
    var copyId = Number(model && model.acquiredPromptModelId);
    var copy = byId(copyId);
    if (!copy) {
      C().toast("Ce modèle est déjà dans Mes modèles. Recharge la page si tu ne le vois pas.");
      return;
    }
    state.tab = "mes-modeles";
    paint(root, { skipOverlay: true });
    openFiche(root, copy);
  }

  function handleAct(root, model, act, btn) {
    if (!model) return;
    if (act === "more") {
      var inFiche = !!(btn && btn.closest && btn.closest(".agilo-lib-fiche"));
      C().openCardMenu(btn, C().menuItems(model, { surface: inFiche ? "fiche" : "card" }), function (picked) {
        handleAct(root, model, picked, btn);
      });
      return;
    }
    if (C().closeMenus) C().closeMenus();
    if (act === "fiche") { openFiche(root, model); return; }
    if (act === "use" || act === "default") { doDefault(root, model, btn); return; }
    if (act === "pin") { doPin(root, model, btn); return; }
    if (act === "duplicate") { askDuplicate(root, model); return; }
    if (act === "open-copy") { openAcquiredCopy(root, model); return; }
    if (act === "rename") { askRename(root, model); return; }
    if (act === "edit") { openEdit(root, model); return; }
    if (act === "versions") { openVersions(root, model); return; }
    if (act === "delete") { askDelete(root, model); return; }
    if (act === "icon") {
      if (F && F.model === model) { if (F.iconOpen) { F.iconOpen = false; syncOverlay(root); } else openFicheIcons(root); }
      else openFiche(root, model, { iconOpen: true });
    }
  }

  function dashboardLink() {
    return ' <a href="' + Api().appPath("dashboard") + '">Aller au tableau de bord</a>';
  }

  function doDefault(root, model, btn) {
    try { Api().assertGenerationId(model.promptModelId); } catch (err) { C().toast(err.message); return; }
    if (C().locked(model)) return;
    if (btn) btn.disabled = true;
    Api().setDefault(state.creds, model.promptModelId).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { C().toast(res.message || "Impossible de définir le défaut."); return; }
      track("lib_default_set", { promptModelId: model.promptModelId, type: model.type });
      C().toast("", { html: "Modèle par défaut : " + esc(model.cardTitle) + "." + dashboardLink() });
      if (state.created && Number(state.created.promptModelId) === Number(model.promptModelId)) state.created.isDefault = true;
      reload(root);
    });
  }

  function doPin(root, model, btn) {
    if (C().locked(model)) return;
    if (!model.pinned && counts().pinned >= state.pinMax) {
      C().toast(state.pinMax + " épingles maximum. Désépinglez un modèle d’abord.");
      return;
    }
    if (btn) btn.disabled = true;
    Api().setPinned(state.creds, model.promptModelId, !model.pinned).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { C().toast(res.message || "Épinglage indisponible."); return; }
      C().toast(model.pinned ? "Modèle désépinglé." : "Modèle épinglé.");
      reload(root);
    });
  }

  function askDuplicate(root, model) {
    C().promptDialog({
      title: model.type === "STANDARD" ? "Ajouter à mes modèles" : "Enregistrer sous",
      text: "Donnez un nom personnel. La copie vous appartient et reste modifiable.",
      label: "Nom",
      value: model.cardTitle,
      ok: "Copier",
      onOk: function (name) {
        Api().duplicate(state.creds, model.promptModelId, name).then(function (res) {
          if (res.reload) { C().toast(res.message || "Rechargez la page."); return; }
          if (!res.ok) { C().toast(res.message || "Copie impossible."); return; }
          var copyId = res.promptModelId;
          state.tab = "mes-modeles";
          if (res.alreadyAcquired) C().toast("Ce modèle est déjà dans Mes modèles.");
          else C().toast("Modèle ajouté à Mes modèles.");
          return reload(root).then(function () {
            var copy = copyId ? byId(copyId) : null;
            if (copy) openFiche(root, copy);
          });
        });
      }
    });
  }

  function askRename(root, model) {
    C().promptDialog({
      title: "Renommer",
      label: "Nouveau nom",
      value: model.cardTitle,
      ok: "Enregistrer",
      onOk: function (name) {
        Api().rename(state.creds, model.promptModelId, name).then(function (res) {
          if (!res.ok) { C().toast(res.message || "Renommage impossible."); return; }
          C().toast("Modèle renommé.");
          reload(root);
        });
      }
    });
  }

  function askDelete(root, model) {
    C().confirmDialog({
      title: "Supprimer ce modèle ?",
      text: "« " + model.cardTitle + " » sera définitivement retiré." + (model.isDefault ? " Le défaut reviendra au modèle Agilotext." : ""),
      ok: "Supprimer",
      danger: true,
      onOk: function () {
        Api().deleteModel(state.creds, model.promptModelId).then(function (res) {
          if (!res.ok) { C().toast(res.message || "Suppression impossible."); return; }
          C().toast(model.isDefault ? "Modèle supprimé. Le défaut revient au modèle Agilotext." : "Modèle personnel supprimé.");
          if (F && F.model && F.model.promptModelId === model.promptModelId) {
            F = null;
            Overlay().close({ silent: true });
          }
          reload(root);
        });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Liaison page                                                        */
  /* ------------------------------------------------------------------ */
  function setTab(root, tab) {
    if (tab === "creer") { openWizard(root); return; }
    state.tab = tab;
    state.page = 1;
    state.category = "all";
    paint(root, { panelOnly: true });
  }

  function bind(root) {
    var reloadBtn = root.querySelector('[data-act="reload"]');
    if (reloadBtn) reloadBtn.addEventListener("click", function () { location.reload(); });

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
    root.querySelectorAll(".agilo-lib-head [data-open-wizard]").forEach(function (btn) {
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
          paint(root, { panelOnly: true, skipOverlay: true });
        }, 160);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && input.value) {
          e.preventDefault();
          input.value = "";
          state.q = "";
          state.page = 1;
          paint(root, { panelOnly: true, skipOverlay: true });
        }
      });
    }

    if (!global.__agiloLibSlashBound) {
      global.__agiloLibSlashBound = true;
      document.addEventListener("keydown", function (e) {
        if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
        var t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        if (Overlay() && Overlay().isOpen()) return;
        var q = document.getElementById("agilo-lib-q");
        if (!q) return;
        e.preventDefault();
        q.focus();
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
    panel.querySelectorAll("[data-clear-q]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.q = "";
        var q = root.querySelector("#agilo-lib-q");
        if (q) q.value = "";
        paint(root, { panelOnly: true, skipOverlay: true });
      });
    });
    panel.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.category = b.getAttribute("data-cat");
        state.page = 1;
        paint(root, { panelOnly: true, skipOverlay: true });
      });
    });
    panel.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.view = b.getAttribute("data-view");
        state.viewTouched = true;
        try { sessionStorage.setItem("agilo:lib:view", state.view); } catch (_) { /* ignore */ }
        paint(root, { panelOnly: true, skipOverlay: true });
      });
    });
    panel.querySelectorAll("[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var col = th.getAttribute("data-sort");
        if (state.sort.col === col) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else { state.sort.col = col; state.sort.dir = col === "name" ? "asc" : "desc"; }
        paint(root, { panelOnly: true, skipOverlay: true });
      });
    });
    panel.querySelectorAll("[data-page]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.page += Number(b.getAttribute("data-page") || 0);
        paint(root, { panelOnly: true, skipOverlay: true });
      });
    });
    bindCards(root, panel);
  }

  function bindCards(root, scope) {
    scope.querySelectorAll("[data-id]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (btn) {
          if (btn.disabled) return;
          e.preventDefault();
          e.stopPropagation();
          handleAct(root, byId(el.getAttribute("data-id")), btn.getAttribute("data-act"), btn);
          return;
        }
        if (!el.classList.contains("agilo-lib-card--v2")) return;
        if (e.target.closest("button, a, input, textarea, select, [role=\"button\"]")) return;
        e.preventDefault();
        handleAct(root, byId(el.getAttribute("data-id")), "fiche", el);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lottie                                                              */
  /* ------------------------------------------------------------------ */
  function reducedMotion() {
    try { return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  }

  function playLottie(box) {
    if (!box || reducedMotion()) return;
    function boot() {
      if (!global.lottie || typeof global.lottie.loadAnimation !== "function") return;
      if (lottieAnim && typeof lottieAnim.destroy === "function") { try { lottieAnim.destroy(); } catch (_) { /* ignore */ } }
      lottieAnim = global.lottie.loadAnimation({ container: box, renderer: "svg", loop: true, autoplay: true, path: LOTTIE_JSON });
    }
    if (global.lottie) { boot(); return; }
    if (document.querySelector("script[data-agilo-lottie]")) {
      var wait = setInterval(function () { if (global.lottie) { clearInterval(wait); boot(); } }, 80);
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

  /* ------------------------------------------------------------------ */
  /* Données                                                             */
  /* ------------------------------------------------------------------ */
  function reload(root) {
    return Api().fetchLists(state.creds).then(function (pack) {
      state.models = pack.models;
      state.pinMax = pack.pinMax || 5;
      if (F && F.model) {
        var fresh = byId(F.model.promptModelId);
        if (fresh) {
          if (F.model.promptModelStatus && !fresh.promptModelStatus) fresh.promptModelStatus = F.model.promptModelStatus;
          F.model = fresh;
        }
      }
      paint(root);
    }).catch(function (err) {
      C().toast(Api().sanitizeUserMessage ? Api().sanitizeUserMessage(err && err.message, false) : "Rechargement impossible.");
    });
  }

  function mount(root, creds, access, pack) {
    state.creds = creds;
    state.access = access;
    state.models = pack.models || [];
    state.pinMax = pack.pinMax || 5;
    if (Api().setActiveCreds) Api().setActiveCreds(creds);
    readHash();
    if (state.wizardOpen) state.prevTab = "agilotext";
    paint(root);
    bindStudioEvents(root);
    if (state.pendingDeepLink != null) {
      var target = byId(state.pendingDeepLink);
      state.pendingDeepLink = null;
      if (target) {
        if (target.type === "USER") state.tab = "mes-modeles";
        paint(root, { skipOverlay: true });
        openFiche(root, target);
      } else {
        C().toast("Ce modèle n’est plus disponible.");
        writeHash();
      }
    }
    if (!global.__agiloLibHashBoundV2) {
      global.__agiloLibHashBoundV2 = true;
      global.addEventListener("hashchange", function () {
        var hash = String(global.location.hash || "").replace(/^#/, "");
        var expected = F && F.model ? "modele=" + F.model.promptModelId : (state.wizardOpen ? "creer" : state.tab);
        if (hash === expected) return;
        var prevTab = state.tab;
        var wasOpen = state.wizardOpen;
        readHash();
        if (state.pendingDeepLink != null) {
          var t = byId(state.pendingDeepLink);
          state.pendingDeepLink = null;
          if (t && root.isConnected) openFiche(root, t);
          return;
        }
        if ((state.tab !== prevTab || state.wizardOpen !== wasOpen) && root.isConnected) paint(root);
      });
    }
  }

  global.AgiloLibraryCatalogV2 = {
    VERSION: "2.2.0",
    TABS: TABS,
    mount: mount,
    /* exposé pour les tests */
    _state: function () { return state; },
    _fiche: function () { return F; },
    _headHtml: headHtml,
    _bannersHtml: bannersHtml,
    _countLine: countLine,
    _chipsHtml: chipsHtml,
    _officialCategoryCounts: officialCategoryCounts,
    _readHash: readHash,
    _paint: paint,
    _overlayTitle: overlayTitle,
    _overlayMeta: overlayMeta
  };
})(typeof window !== "undefined" ? window : globalThis);
