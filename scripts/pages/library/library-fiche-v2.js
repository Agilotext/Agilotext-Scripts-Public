/**
 * Fiche modèle v2 : en-tête (icône, titre éditable, badges), aperçu du prompt,
 * description, pied 2 boutons + menu. Rendu pur + liaison par callbacks ;
 * l’état vit dans library-catalog-v2.js.
 *
 * Aperçu du prompt :
 * - Pro / Business, modèle non verrouillé et prêt : getPromptModelContent (cache api) ;
 * - Gratuit : aucun appel, fausses lignes floutées + CTA ;
 * - CSE verrouillé : CTA pack, aucun appel ;
 * - en création : message, bouton Modifier grisé.
 * @version 2.0.0
 */
(function (global) {
  "use strict";

  var PREVIEW_LINES = 8;

  function C() { return global.AgiloLibraryCoreV2 || global.AgiloLibraryCore; }
  function Api() { return global.AgiloLibraryApi; }
  function esc(s) { return C().escapeHtml(s); }

  function isFree(creds) {
    var A = Api();
    return !(A && A.canCreate && A.canCreate(creds));
  }

  /** Mode d’aperçu : "text" | "free" | "locked" | "pending" */
  function previewMode(model, creds) {
    var Core = C();
    if (Core.locked(model)) return "locked";
    if (isFree(creds)) return "free";
    if (Core.isReady && !Core.isReady(model)) return "pending";
    return "text";
  }

  function canShowPrompt(model, creds) {
    return previewMode(model, creds) === "text";
  }

  function typeLabel(model) {
    if (model.type === "USER") return "Modèle personnel";
    if (model.packCse) return "Modèle Pack CSE";
    return "Modèle Agilotext";
  }

  function fakeLines() {
    var widths = [92, 78, 88, 64, 84, 71, 58, 80];
    return widths.map(function (w) {
      return '<span style="width:' + w + '%"></span>';
    }).join("");
  }

  function pricingHref() {
    var A = Api();
    return (A && A.cfg && A.cfg().pricingUrl) || "/tarifs";
  }

  function previewBody(model, st, creds) {
    var Core = C();
    var mode = previewMode(model, creds);
    if (mode === "locked") {
      var cta = Api().ctaForLocked ? Api().ctaForLocked(model.packCse) : null;
      return '<div class="agilo-lib-fiche__gate" role="note">' +
        '<span class="agilo-lib-fiche__gate-ico">' + Core.svgIcon("lock", 18) + "</span>" +
        "<p>" + esc(model.lockReasonMessage || "Ce modèle est réservé au Pack CSE.") + "</p>" +
        (cta ? '<a class="agilo-lib-btn agilo-lib-btn--cta" href="' + esc(cta.href) + '">' + esc(cta.label) + "</a>" : "") +
        "</div>";
    }
    if (mode === "free") {
      return '<div class="agilo-lib-blur">' +
        '<div class="agilo-lib-blur__lines" aria-hidden="true">' + fakeLines() + "</div>" +
        '<div class="agilo-lib-blur__cta">' +
        '<span class="agilo-lib-fiche__gate-ico">' + Core.svgIcon("lock", 18) + "</span>" +
        "<p><strong>Voir et modifier le prompt</strong> est réservé aux plans Pro et Business.</p>" +
        '<a class="agilo-lib-btn agilo-lib-btn--primary" href="' + esc(pricingHref()) + '" data-track="lib_upgrade_cta_click">Passer en Pro</a>' +
        "</div>" +
        '<span class="visually-hidden">Prompt réservé aux plans Pro et Business.</span>' +
        "</div>";
    }
    if (mode === "pending") {
      return '<div class="agilo-lib-fiche__pending agilo-lib-pulse" role="status">' +
        Core.svgIcon("clock", 16) + " Création en cours. Le prompt apparaît ici dans quelques secondes.</div>";
    }
    if (st.previewLoading) {
      return '<div class="agilo-lib-fiche__skel" aria-hidden="true">' +
        '<span style="width:90%"></span><span style="width:76%"></span><span style="width:84%"></span><span style="width:60%"></span></div>';
    }
    if (st.previewError) {
      return '<p class="agilo-lib-note agilo-lib-fiche__err" role="status">Aperçu indisponible pour l’instant. ' +
        '<button type="button" class="agilo-lib-linkbtn" data-act="preview-retry">Réessayer</button></p>';
    }
    var text = String(st.previewText || "");
    if (!text) {
      return '<p class="agilo-lib-note">Ce modèle n’a pas encore de prompt lisible.</p>';
    }
    var lines = text.split(/\r?\n/);
    var long = lines.length > PREVIEW_LINES || text.length > 900;
    var clamped = long && !st.previewExpanded;
    return '<pre class="agilo-lib-fiche__pre' + (clamped ? " is-clamped" : "") + '" tabindex="0">' + esc(text) + "</pre>" +
      (long
        ? '<button type="button" class="agilo-lib-linkbtn" data-act="preview-toggle" aria-expanded="' + (!clamped) + '">' +
          (clamped ? "Afficher tout" : "Réduire") + "</button>"
        : "");
  }

  function previewSection(model, st, creds) {
    var Core = C();
    var mode = previewMode(model, creds);
    var tools = "";
    if (mode === "text" && st.previewText && !st.previewLoading) {
      tools = '<button type="button" class="agilo-lib-linkbtn" data-act="preview-copy">' + Core.svgIcon("copy", 14) + " Copier</button>";
    }
    return '<section class="agilo-lib-fiche__prompt" data-mode="' + mode + '">' +
      '<div class="agilo-lib-fiche__prompt-head"><span class="agilo-lib-fiche__label">Prompt</span>' + tools + "</div>" +
      previewBody(model, st, creds) +
      "</section>";
  }

  function titleBlock(model, st) {
    var Core = C();
    if (st.renaming && model.canEdit) {
      return '<div class="agilo-lib-fiche__rename">' +
        '<label class="visually-hidden" for="agilo-lib-rename">Nouveau nom</label>' +
        '<input id="agilo-lib-rename" type="text" maxlength="120" value="' + esc(st.renameValue != null ? st.renameValue : model.cardTitle) + '">' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary agilo-lib-btn--sm" data-act="rename-ok">Enregistrer</button>' +
        '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-act="rename-cancel">Annuler</button>' +
        "</div>";
    }
    return '<div class="agilo-lib-fiche__titlerow">' +
      '<h2 class="agilo-lib-fiche__title" id="agilo-lib-fiche-title">' + esc(model.cardTitle) + "</h2>" +
      (model.canEdit
        ? '<button type="button" class="agilo-lib-icon-btn agilo-lib-icon-btn--sm" data-act="rename-inline" aria-label="Renommer" title="Renommer">' +
          Core.svgIcon("pencil", 14) + "</button>"
        : "") +
      "</div>";
  }

  function secondaryBtn(model, creds) {
    var Core = C();
    if (Core.locked(model)) return "";
    var free = isFree(creds);
    var pending = Core.isReady && !Core.isReady(model);
    var label = model.type === "USER" && model.canEdit ? "Modifier le prompt" : "Voir le prompt";
    var ico = model.type === "USER" && model.canEdit ? "pencil" : "eye";
    var attrs = "";
    if (free) attrs = ' disabled aria-disabled="true" title="Réservé aux plans Pro et Business"';
    else if (pending) attrs = ' disabled aria-disabled="true" title="Disponible dès que la création est terminée"';
    return '<button type="button" class="agilo-lib-btn" data-act="edit"' + attrs + ">" +
      Core.svgIcon(ico, 16) + " " + label + "</button>";
  }

  function footHtml(model, creds) {
    var Core = C();
    var more = Core.menuItems(model, { inFiche: true }).length
      ? '<button type="button" class="agilo-lib-icon-btn" data-act="more" aria-label="Autres actions" title="Autres actions">' +
        Core.svgIcon("dots", 16) + "</button>"
      : "";
    return '<footer class="agilo-lib-fiche__foot" data-id="' + model.promptModelId + '">' +
      Core.primaryAction(model) + secondaryBtn(model, creds) + more +
      "</footer>";
  }

  function suggestionsHtml(st, model) {
    var Core = C();
    var keys = st.iconSuggestions || [];
    var icons = st.iconCatalog || [];
    if (!keys.length && !st.iconSuggesting) return "";
    var byKey = {};
    icons.forEach(function (ic) { byKey[ic.iconKey] = ic; });
    var cells = keys.map(function (k, i) {
      var ic = byKey[k] || { iconKey: k, labelFr: k, url: "" };
      var on = k === model.iconKey;
      var lab = global.AgiloLibraryIconPicker ? global.AgiloLibraryIconPicker.labelOf(ic) : k;
      return '<button type="button" class="agilo-lib-iconpick__cell agilo-lib-iconpick__cell--sugg' + (on ? " is-on" : "") +
        '" data-icon-key="' + esc(k) + '" aria-pressed="' + on + '" title="' + esc(lab) + '">' +
        (ic.url ? '<img src="' + esc(ic.url) + '" alt="" width="22" height="22" onerror="this.onerror=null;this.hidden=true;">' : "") +
        "<span>" + esc(lab) + "</span>" +
        (i === 0 ? '<em class="agilo-lib-iconpick__tag">Suggérée</em>' : "") +
        "</button>";
    }).join("");
    return '<div class="agilo-lib-iconpick__sugg">' +
      '<p class="agilo-lib-iconpick__title">' + Core.svgIcon("sparkle", 14) + " Suggestions" +
      (st.iconSuggesting ? ' <span class="agilo-lib-note" role="status">(recherche…)</span>' : "") + "</p>" +
      '<div class="agilo-lib-iconpick__grid agilo-lib-iconpick__grid--sugg">' + cells + "</div></div>";
  }

  function iconPopoverHtml(model, st) {
    var P = global.AgiloLibraryIconPicker;
    if (!st.iconOpen || !P) return "";
    return '<div class="agilo-lib-iconpop" role="group" aria-label="Choisir une icône">' +
      '<div class="agilo-lib-iconpop__head"><strong>Icône du modèle</strong>' +
      '<button type="button" class="agilo-lib-icon-btn agilo-lib-icon-btn--sm" data-act="icon-close" aria-label="Fermer le choix d’icône">' +
      C().svgIcon("xmark", 14) + "</button></div>" +
      suggestionsHtml(st, model) +
      P.html({
        selectedKey: model.iconKey || "",
        query: st.iconQuery || "",
        icons: st.iconCatalog || [],
        loading: st.iconCatalogLoading,
        error: st.iconCatalogError
      }) +
      "</div>";
  }

  function html(model, st, creds) {
    var Core = C();
    if (!model) return "";
    st = st || {};
    var desc = model.publicDescription ? esc(model.publicDescription) : '<span class="agilo-lib-muted">Pas de description publique pour l’instant.</span>';
    var example = model.publicExample
      ? '<p class="agilo-lib-fiche__example"><span class="agilo-lib-fiche__label">Exemple</span> ' + esc(model.publicExample) + "</p>"
      : "";
    var layout = model.hasHtml ? "Mise en page HTML" : "Texte structuré";
    var badges = (model.isDefault ? '<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>' : "") + Core.badgeHtml(model);
    return '<div class="agilo-lib-fiche" data-id="' + model.promptModelId + '">' +
      '<header class="agilo-lib-fiche__head">' +
      '<div class="agilo-lib-fiche__iconwrap">' +
      Core.iconTile(model, 28, { size: "xl" }) +
      iconPopoverHtml(model, st) +
      "</div>" +
      '<div class="agilo-lib-fiche__titlewrap">' +
      '<p class="agilo-lib-fiche__kicker">' + esc(typeLabel(model)) + " · " + esc(layout) + "</p>" +
      titleBlock(model, st) +
      (badges ? '<div class="agilo-lib-card__meta">' + badges + "</div>" : "") +
      "</div></header>" +
      '<div class="agilo-lib-fiche__scroll">' +
      previewSection(model, st, creds) +
      '<section class="agilo-lib-fiche__about">' +
      '<p class="agilo-lib-fiche__desc">' + desc + "</p>" + example +
      "</section></div>" +
      footHtml(model, creds) +
      "</div>";
  }

  /**
   * Charge l’aperçu si le mode est "text". cb(res) avec res.ok / res.text / res.message.
   * Le token d’annulation (st.previewToken) protège contre les réponses d’une fiche fermée.
   */
  function loadPreview(creds, model, st, cb) {
    if (previewMode(model, creds) !== "text") return false;
    var A = Api();
    if (!A || !A.getPromptContent) return false;
    var token = String(model.promptModelId) + ":" + Date.now();
    st.previewToken = token;
    st.previewLoading = true;
    st.previewError = "";
    A.getPromptContent(creds, model.promptModelId).then(function (res) {
      if (st.previewToken !== token) return;
      st.previewLoading = false;
      if (res.ok) {
        st.previewText = res.text || "";
        st.previewError = "";
      } else {
        st.previewText = "";
        st.previewError = res.message || "Aperçu indisponible.";
      }
      cb(res);
    }).catch(function () {
      if (st.previewToken !== token) return;
      st.previewLoading = false;
      st.previewError = "Réseau interrompu.";
      cb({ ok: false, message: st.previewError });
    });
    return true;
  }

  function copyText(text) {
    try {
      if (global.navigator && global.navigator.clipboard) return global.navigator.clipboard.writeText(text);
    } catch (_) { /* ignore */ }
    return Promise.reject(new Error("clipboard"));
  }

  /**
   * handlers : onAct(act, btn), onRename(name), onIconSelect(key), onIconFilter(q), onTogglePreview(), onRetryPreview()
   */
  function bind(host, model, st, handlers) {
    handlers = handlers || {};
    var root = host.querySelector(".agilo-lib-fiche");
    if (!root) return;
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn || btn.disabled) return;
      var act = btn.getAttribute("data-act");
      e.preventDefault();
      e.stopPropagation();
      if (act === "preview-toggle") { if (handlers.onTogglePreview) handlers.onTogglePreview(); return; }
      if (act === "preview-retry") { if (handlers.onRetryPreview) handlers.onRetryPreview(); return; }
      if (act === "preview-copy") {
        copyText(st.previewText || "").then(function () {
          C().toast("Prompt copié.");
        }, function () {
          C().toast("Copie impossible dans ce navigateur.");
        });
        return;
      }
      if (act === "rename-inline") { if (handlers.onRenameStart) handlers.onRenameStart(); return; }
      if (act === "rename-cancel") { if (handlers.onRenameCancel) handlers.onRenameCancel(); return; }
      if (act === "rename-ok") {
        var input = root.querySelector("#agilo-lib-rename");
        var name = input ? input.value.trim() : "";
        if (!name) { input && input.focus(); return; }
        if (handlers.onRename) handlers.onRename(name);
        return;
      }
      if (act === "icon-close") { if (handlers.onIconClose) handlers.onIconClose(); return; }
      if (handlers.onAct) handlers.onAct(act, btn);
    });
    var input = root.querySelector("#agilo-lib-rename");
    if (input) {
      input.focus();
      input.select();
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); var ok = root.querySelector('[data-act="rename-ok"]'); if (ok) ok.click(); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (handlers.onRenameCancel) handlers.onRenameCancel(); }
      }, true);
      input.addEventListener("input", function () { st.renameValue = input.value; });
    }
    var P = global.AgiloLibraryIconPicker;
    var pop = root.querySelector(".agilo-lib-iconpop");
    if (P && pop) {
      var pick = pop.querySelector(".agilo-lib-iconpick") || pop;
      P.bind(pop, {
        onFilter: function (q) {
          st.iconQuery = q;
          P.applyFilter(pick, st.iconCatalog || [], model.iconKey, q);
          P.bindCells(pick, { onSelect: handlers.onIconSelect });
        },
        onSelect: handlers.onIconSelect
      });
    }
    var track = root.querySelector("[data-track]");
    if (track) {
      track.addEventListener("click", function () {
        if (Api() && Api().track) Api().track(track.getAttribute("data-track"), { promptModelId: model.promptModelId });
      });
    }
  }

  global.AgiloLibraryFicheV2 = {
    VERSION: "2.0.0",
    PREVIEW_LINES: PREVIEW_LINES,
    html: html,
    bind: bind,
    loadPreview: loadPreview,
    previewMode: previewMode,
    canShowPrompt: canShowPrompt,
    typeLabel: typeLabel,
    suggestionsHtml: suggestionsHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
