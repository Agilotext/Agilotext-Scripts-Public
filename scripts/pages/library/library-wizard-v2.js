/**
 * Wizard v2 « Configurer votre modèle personnalisé ».
 * Les 4 questions (ordre Mon compte), placeholders courts, dictée,
 * récapitulatif, brouillon localStorage, attente spinner, écran de succès.
 * Rendu + liaison ; les appels API restent dans library-catalog-v2.js.
 * @version 2.2.0
 */
(function (global) {
  "use strict";

  var DRAFT_KEY = "agilo:lib:wizardDraft:v2";
  var TITLE = "Nouveau modèle";
  var STEP_SHORT = ["", "Nom", "Contexte", "Infos", "Structure"];

  var QUESTIONS = [
    {
      id: "name",
      field: "wiz-name",
      label: "Nom du modèle",
      placeholder: "Exemple : Modèle de réunion",
      input: true,
      maxlength: 120
    },
    {
      id: "objective",
      field: "wiz-obj",
      label: "Quels échanges, quel objectif ?",
      placeholder: "Ex. comités, entretiens clients, suivi commercial"
    },
    {
      id: "specificInfo",
      field: "wiz-info",
      label: "Quelles informations clés ?",
      placeholder: "Ex. décisions, responsables, échéances, chiffres"
    },
    {
      id: "structure",
      field: "wiz-struct",
      label: "Quelle structure pour vos comptes rendus ?",
      placeholder: "Ex. résumé puis détail, ou compte rendu intégral"
    }
  ];

  var EXAMPLES = [
    "Comité de direction hebdomadaire : décisions, responsables, échéances",
    "Entretien client : besoins exprimés, objections, prochaines étapes",
    "Réunion projet : avancement, risques, actions à mener"
  ];

  function blank() {
    return {
      step: 1,
      name: "",
      objective: "",
      specificInfo: "",
      structure: "",
      iconKey: "",
      iconTouched: false,
      iconQuery: "",
      iconOpen: false,
      suggestions: [],
      suggestSig: "",
      suggesting: false,
      error: "",
      draftRestored: false
    };
  }

  var W = blank();

  function C() { return global.AgiloLibraryCoreV2 || global.AgiloLibraryCore; }
  function esc(s) { return C().escapeHtml(s); }

  /* ---------- brouillon ---------- */
  function saveDraft() {
    try {
      var hasContent = W.name || W.objective || W.specificInfo || W.structure || W.iconKey;
      if (!hasContent) { localStorage.removeItem(DRAFT_KEY); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        step: W.step,
        name: W.name,
        objective: W.objective,
        specificInfo: W.specificInfo,
        structure: W.structure,
        iconKey: W.iconKey,
        iconTouched: W.iconTouched,
        savedAt: Date.now()
      }));
    } catch (_) { /* ignore */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object") return null;
      return d;
    } catch (_) { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
  }

  function reset(opts) {
    opts = opts || {};
    W = blank();
    if (opts.restore !== false) {
      var d = loadDraft();
      if (d && (d.name || d.objective || d.specificInfo || d.structure)) {
        W.name = d.name || "";
        W.objective = d.objective || "";
        W.specificInfo = d.specificInfo || "";
        W.structure = d.structure || "";
        W.iconKey = d.iconKey || "";
        W.iconTouched = !!d.iconTouched;
        W.step = Math.min(5, Math.max(1, Number(d.step) || 1));
        W.draftRestored = true;
      }
    }
    return W;
  }

  function state() { return W; }

  function draft() {
    return {
      name: W.name.trim(),
      objective: W.objective.trim(),
      specificInfo: W.specificInfo.trim(),
      structure: W.structure.trim(),
      iconKey: (W.iconKey || "").trim(),
      publicDescription: W.objective.trim(),
      publicExample: W.structure.trim()
    };
  }

  function validateStep(step) {
    if (step === 1 && !W.name.trim()) return "Donnez un nom à votre modèle.";
    if (step === 2 && !W.objective.trim()) return "Décrivez vos échanges et leur objectif.";
    if (step === 3 && !W.specificInfo.trim()) return "Indiquez les informations clés attendues.";
    if (step === 4 && !W.structure.trim()) return "Précisez la structure souhaitée.";
    return "";
  }

  function validateAll() {
    for (var s = 1; s <= 4; s++) {
      var err = validateStep(s);
      if (err) return { step: s, error: err };
    }
    return null;
  }

  /* ---------- rendu ---------- */
  function stepMeta() {
    if (W.step === 5) return { text: "Récap", aria: "Récapitulatif" };
    return { text: W.step + " / 4", aria: "Étape " + W.step + " sur 4" };
  }

  function iconBlockHtml(ctx) {
    var Core = C();
    var P = global.AgiloLibraryIconPicker;
    if (!P || !ctx.library2Live) return "";
    var icons = ctx.iconCatalog || [];
    var byKey = {};
    icons.forEach(function (ic) { byKey[ic.iconKey] = ic; });
    var sel = byKey[W.iconKey];
    var selHtml = sel && sel.url
      ? '<img src="' + esc(sel.url) + '" alt="" width="26" height="26" onerror="this.onerror=null;this.hidden=true;">'
      : Core.svgIcon("custom", 26);
    var selFr = sel && P.displayLabel ? P.displayLabel(sel) : "";
    var selLabel = selFr || (W.iconKey ? "" : "Icône proposée automatiquement");
    var sugg = "";
    var keys = (W.suggestions || []).slice(0, 3);
    if (keys.length) {
      sugg = '<div class="agilo-lib-iconpick__grid agilo-lib-iconpick__grid--sugg">' +
        keys.map(function (k, i) {
          var ic = byKey[k] || { iconKey: k, labelFr: "", url: "" };
          return P.cellHtml(ic, W.iconKey, {
            className: "agilo-lib-iconpick__cell--sugg",
            tag: i === 0 ? '<em class="agilo-lib-iconpick__tag">Suggérée</em>' : ""
          });
        }).join("") +
        "</div>";
    }
    var spin = W.suggesting && Core.spinHtml ? Core.spinHtml("Suggestion d’icône") : "";
    return '<div class="agilo-lib-wiz-icon">' +
      '<div class="agilo-lib-wiz-icon__row">' +
      '<span class="agilo-lib-card__icon agilo-lib-card__icon--xl" aria-hidden="true">' + selHtml + "</span>" +
      '<div class="agilo-lib-wiz-icon__txt"><span class="agilo-lib-fiche__label">Icône' + spin + "</span>" +
      (selLabel ? '<span class="agilo-lib-wiz-icon__name">' + esc(selLabel) + "</span>" : "") + "</div>" +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-wiz="icon-toggle" aria-expanded="' + !!W.iconOpen + '">' +
      Core.svgIcon("grid", 14) + (W.iconOpen ? " Masquer" : " Plus d’icônes") + "</button>" +
      "</div>" +
      sugg +
      (W.iconOpen
        ? P.html({
          selectedKey: W.iconKey,
          query: W.iconQuery,
          icons: icons,
          loading: ctx.iconCatalogLoading,
          error: ctx.iconCatalogError
        })
        : "") +
      "</div>";
  }

  function fieldHtml(q, value, withDictate) {
    var Core = C();
    var req = ' <span class="agilo-lib-req" aria-hidden="true">*</span>';
    var dictate = withDictate
      ? '<button type="button" class="agilo-lib-dictate" id="' + q.field + '-dictate" aria-label="Dicter la réponse" title="Dicter (navigateur)" aria-pressed="false" hidden>' +
        Core.svgIcon("report", 16) + "</button>"
      : "";
    var hint = q.hint ? '<p class="agilo-lib-note">' + esc(q.hint) + "</p>" : "";
    var reqAttr = q.optional ? "" : " required";
    if (q.optional) req = "";
    if (q.input) {
      return '<label for="' + q.field + '"><span>' + esc(q.label) + req + "</span></label>" +
        '<input id="' + q.field + '" type="text" maxlength="' + (q.maxlength || 120) + '"' + reqAttr + ' value="' + esc(value) +
        '" placeholder="' + esc(q.placeholder) + '" autocomplete="off">' + hint;
    }
    return '<label for="' + q.field + '"><span>' + esc(q.label) + req + "</span></label>" +
      '<div class="agilo-lib-field">' +
      '<textarea id="' + q.field + '" rows="6" required placeholder="' + esc(q.placeholder) + '">' + esc(value) + "</textarea>" +
      dictate + "</div>" + hint;
  }

  function recapRow(label, value, step) {
    var Core = C();
    return '<div class="agilo-lib-recap__row"><div class="agilo-lib-recap__k">' + esc(label) +
      '<button type="button" class="agilo-lib-linkbtn" data-wiz="goto" data-step="' + step + '">' + Core.svgIcon("pencil", 12) + " Modifier</button></div>" +
      '<div class="agilo-lib-recap__v">' + (value ? esc(value) : '<span class="agilo-lib-muted">Non renseigné</span>') + "</div></div>";
  }

  function recapHtml(ctx) {
    var Core = C();
    var P = global.AgiloLibraryIconPicker;
    var icons = ctx.iconCatalog || [];
    var ic = icons.filter(function (x) { return x.iconKey === W.iconKey; })[0];
    var iconHtml = ic && ic.url
      ? '<img src="' + esc(ic.url) + '" alt="" width="26" height="26">'
      : Core.svgIcon("custom", 26);
    return '<div class="agilo-lib-recap">' +
      '<div class="agilo-lib-recap__head">' +
      '<span class="agilo-lib-card__icon agilo-lib-card__icon--xl" aria-hidden="true">' + iconHtml + "</span>" +
      '<div><p class="agilo-lib-fiche__kicker">Votre modèle</p>' +
      '<h3 class="agilo-lib-recap__title">' + esc(W.name || "Sans nom") + "</h3></div>" +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-wiz="goto" data-step="1">' + Core.svgIcon("pencil", 14) + " Nom et icône</button>" +
      "</div>" +
      recapRow("Échanges et objectif", W.objective, 2) +
      recapRow("Informations clés", W.specificInfo, 3) +
      recapRow("Structure", W.structure, 4) +
      '<p class="agilo-lib-note">Agilotext rédige le prompt à partir de ces réponses. Vous pourrez ensuite l’ouvrir et l’ajuster dans l’éditeur.</p>' +
      "</div>";
  }

  function reducedMotion() {
    try { return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  }

  function creatingHtml() {
    var Core = C();
    var spin = (!reducedMotion() && Core.spinHtml) ? Core.spinHtml("Création du modèle", "lg") : "";
    return '<div class="agilo-lib-wiz-creating" aria-live="polite">' +
      spin +
      "<h3>Création du modèle…</h3>" +
      "<p>Restez ici. Ça prend quelques secondes.</p>" +
      "</div>";
  }

  function createdHtml(ctx) {
    var Core = C();
    var m = ctx.created;
    return '<div class="agilo-lib-wiz-done">' +
      '<div class="agilo-lib-banner agilo-lib-banner--success" role="status" aria-live="polite">' +
      Core.svgIcon("check-circle", 16) +
      "<span>Modèle créé. Vous pouvez l’utiliser tout de suite.</span></div>" +
      Core.cardHtml(m, { size: "featured" }) +
      '<div class="agilo-lib-actions-row">' +
      (m.isDefault
        ? Core.defaultState()
        : '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="default" data-id="' + m.promptModelId + '">Définir par défaut</button>') +
      '<button type="button" class="agilo-lib-btn" data-act="edit" data-id="' + m.promptModelId + '">' +
      Core.svgIcon("pencil", 16) + " Ouvrir dans l’éditeur</button>" +
      '<button type="button" class="agilo-lib-btn" data-tab="mes-modeles">Voir mes modèles</button>' +
      "</div></div>";
  }

  function freeHtml(ctx) {
    var Core = C();
    return Core.emptyHtml(
      "Création réservée aux plans Pro et Business",
      "Le plan Gratuit permet de parcourir les modèles Agilotext, pas d’en créer un personnel.",
      '<a class="agilo-lib-btn agilo-lib-btn--primary" href="' + esc(ctx.pricingUrl || "/tarifs") + '" data-track="lib_upgrade_cta_click">Voir les offres</a>',
      "lock"
    );
  }

  /**
   * ctx : { canCreate, pricingUrl, library2Live, iconCatalog, iconCatalogLoading, iconCatalogError,
   *         creating, created, createdPending, dictateAvailable }
   */
  function html(ctx) {
    ctx = ctx || {};
    if (!ctx.canCreate) return freeHtml(ctx);
    if (ctx.created && !ctx.createdPending) return createdHtml(ctx);
    if (ctx.creating || ctx.createdPending) return creatingHtml();
    var Core = C();
    var body = "";
    if (W.step === 1) {
      body = fieldHtml(QUESTIONS[0], W.name) + iconBlockHtml(ctx);
    } else if (W.step === 2) {
      body = fieldHtml(QUESTIONS[1], W.objective, true) +
        '<div class="agilo-lib-chips agilo-lib-chips--ex" aria-label="Exemples">' +
        EXAMPLES.map(function (e) {
          return '<button type="button" data-ex="' + esc(e) + '">' + esc(e) + "</button>";
        }).join("") + "</div>";
    } else if (W.step === 3) {
      body = fieldHtml(QUESTIONS[2], W.specificInfo, true);
    } else if (W.step === 4) {
      body = fieldHtml(QUESTIONS[3], W.structure, true);
    } else {
      body = recapHtml(ctx);
    }
    var err = W.error ? '<p class="agilo-lib-wiz-error" role="alert">' + esc(W.error) + "</p>" : "";
    var restored = W.draftRestored && W.step < 5
      ? '<p class="agilo-lib-note agilo-lib-wiz-draft">Brouillon restauré. <button type="button" class="agilo-lib-linkbtn" data-wiz="draft-clear">Repartir de zéro</button></p>'
      : "";
    var nav = '<div class="agilo-lib-actions-row agilo-lib-wiz-nav">';
    if (W.step > 1) nav += '<button type="button" class="agilo-lib-btn" data-wiz="back">' + Core.svgIcon("arrow-left", 16) + " Retour</button>";
    if (W.step < 5) nav += '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="next">Continuer ' + Core.svgIcon("arrow-right", 16) + "</button>";
    else nav += '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-wiz="create">' + Core.svgIcon("sparkle", 16) + " Créer le modèle</button>";
    nav += "</div>";
    return '<div class="agilo-lib-wiz">' +
      '<div class="agilo-lib-wiz-main">' +
      restored +
      '<div class="agilo-lib-form">' + body + "</div>" + err +
      "</div>" + nav +
      "</div>";
  }

  /* ---------- liaison ---------- */
  function readFields(scope) {
    var map = { "#wiz-name": "name", "#wiz-obj": "objective", "#wiz-info": "specificInfo", "#wiz-struct": "structure" };
    Object.keys(map).forEach(function (sel) {
      var el = scope.querySelector(sel);
      if (el) W[map[sel]] = el.value;
    });
  }

  function mountDictate(scope, handlers) {
    var D = global.AgiloSpeechDictate;
    var btn = scope.querySelector(".agilo-lib-dictate");
    if (!btn) return;
    if (!D || !D.isSupported || !D.isSupported()) { btn.hidden = true; return; }
    var ta = scope.querySelector("textarea");
    if (!ta) { btn.hidden = true; return; }
    btn.hidden = false;
    D.bindButton(ta, btn, {
      lang: "fr-FR",
      onValueRendered: function () {
        readFields(scope);
        saveDraft();
        if (handlers.onFieldInput) handlers.onFieldInput();
      },
      onStateChange: function (st) {
        btn.classList.toggle("is-recording", st === "recording" || st === "listening");
      },
      onError: function (_e, human) { C().toast(human || "Dictée indisponible."); }
    });
  }

  /**
   * handlers : onChange() (re-render), onCreate(), onIconSelect(key), onIconFilter(q),
   *            onFieldInput(), onAct(act, id), onTab(tab)
   */
  function bind(scope, handlers) {
    handlers = handlers || {};
    var Core = C();

    scope.querySelectorAll("[data-wiz]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        readFields(scope);
        var act = b.getAttribute("data-wiz");
        W.error = "";
        if (act === "back") {
          W.step = Math.max(1, W.step - 1);
        } else if (act === "next") {
          var err = validateStep(W.step);
          if (err) {
            W.error = err;
            handlers.onChange && handlers.onChange();
            var f = scope.querySelector("#" + QUESTIONS[W.step - 1].field);
            if (f) f.focus();
            return;
          }
          W.step = Math.min(5, W.step + 1);
        } else if (act === "goto") {
          W.step = Math.min(5, Math.max(1, Number(b.getAttribute("data-step")) || 1));
        } else if (act === "create") {
          var bad = validateAll();
          if (bad) {
            W.step = bad.step;
            W.error = bad.error;
            handlers.onChange && handlers.onChange();
            return;
          }
          saveDraft();
          handlers.onCreate && handlers.onCreate();
          return;
        } else if (act === "icon-toggle") {
          W.iconOpen = !W.iconOpen;
        } else if (act === "draft-clear") {
          clearDraft();
          reset({ restore: false });
        }
        saveDraft();
        handlers.onChange && handlers.onChange();
      });
    });

    scope.querySelectorAll("[data-ex]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = scope.querySelector("#wiz-obj");
        var txt = b.getAttribute("data-ex");
        if (ta) {
          ta.value = ta.value.trim() ? ta.value.trim() + "\n" + txt : txt;
          ta.focus();
        }
        readFields(scope);
        saveDraft();
        handlers.onFieldInput && handlers.onFieldInput();
      });
    });

    ["#wiz-name", "#wiz-obj", "#wiz-info", "#wiz-struct"].forEach(function (sel) {
      var el = scope.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", function () {
        readFields(scope);
        W.error = "";
        var errEl = scope.querySelector(".agilo-lib-wiz-error");
        if (errEl) errEl.remove();
        saveDraft();
        handlers.onFieldInput && handlers.onFieldInput(sel);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && el.tagName === "INPUT") {
          e.preventDefault();
          var next = scope.querySelector('[data-wiz="next"]');
          if (next) next.click();
        }
      });
    });

    var P = global.AgiloLibraryIconPicker;
    var iconBox = scope.querySelector(".agilo-lib-wiz-icon");
    if (P && iconBox) {
      var pick = iconBox.querySelector(".agilo-lib-iconpick");
      P.bind(iconBox, {
        onFilter: function (q) {
          W.iconQuery = q;
          if (pick) {
            P.applyFilter(pick, handlers.iconCatalog ? handlers.iconCatalog() : [], W.iconKey, q);
            P.bindCells(pick, { onSelect: handlers.onIconSelect });
          }
        },
        onSelect: handlers.onIconSelect
      });
    }

    scope.querySelectorAll("[data-act][data-id]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        if (b.disabled) return;
        handlers.onAct && handlers.onAct(b.getAttribute("data-act"), b.getAttribute("data-id"), b);
      });
    });
    scope.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { handlers.onTab && handlers.onTab(b.getAttribute("data-tab")); });
    });
    var track = scope.querySelector("[data-track]");
    if (track && global.AgiloLibraryApi && global.AgiloLibraryApi.track) {
      track.addEventListener("click", function () { global.AgiloLibraryApi.track(track.getAttribute("data-track"), { from: "wizard" }); });
    }

    mountDictate(scope, handlers);

    var first = scope.querySelector("#" + (QUESTIONS[W.step - 1] || {}).field);
    if (first && W.step <= 4) {
      first.focus();
      try {
        var len = first.value.length;
        first.setSelectionRange(len, len);
      } catch (_) { /* ignore */ }
    }
    Core.closeMenus && Core.closeMenus();
  }

  /** Signature nom + objectif pour la suggestion d’icône (debounce côté catalogue). */
  function suggestSignature() {
    var name = W.name.trim();
    var obj = W.objective.trim();
    if (!name) return "";
    return name + "\n" + obj;
  }

  global.AgiloLibraryWizardV2 = {
    VERSION: "2.2.0",
    TITLE: TITLE,
    STEP_SHORT: STEP_SHORT,
    QUESTIONS: QUESTIONS,
    EXAMPLES: EXAMPLES,
    DRAFT_KEY: DRAFT_KEY,
    state: state,
    reset: reset,
    draft: draft,
    html: html,
    bind: bind,
    readFields: readFields,
    validateStep: validateStep,
    validateAll: validateAll,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    clearDraft: clearDraft,
    suggestSignature: suggestSignature,
    stepMeta: stepMeta
  };
})(typeof window !== "undefined" ? window : globalThis);
