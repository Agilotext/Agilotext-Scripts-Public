/**
 * Rendu cartes bibliothèque. Capacités lues sur le modèle, jamais recalculées.
 * @version 1.0.0
 */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initial(m) {
    var t = String(m.cardTitle || m.promptModelName || "?").trim();
    return (t.charAt(0) || "?").toUpperCase();
  }

  function iconHtml(m) {
    if (m.iconUrl) {
      return '<img src="' + escapeHtml(m.iconUrl) + '" alt="" width="22" height="22">';
    }
    return escapeHtml(initial(m));
  }

  function badgeHtml(m) {
    var bits = [];
    if (m.isDefault) bits.push('<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>');
    if (m.hasHtml) bits.push('<span class="agilo-lib-badge agilo-lib-badge--html">Mise en page</span>');
    if (m.packCse) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pack">CSE</span>');
    if (m.lockReasonCode || m.lockReasonMessage) {
      bits.push('<span class="agilo-lib-badge agilo-lib-badge--lock">Verrouillé</span>');
    }
    return bits.join("");
  }

  function cardClass(m) {
    var c = ["agilo-lib-card"];
    if (m.lockReasonCode || m.lockReasonMessage) c.push("agilo-lib-card--locked");
    if (m.isDefault) c.push("agilo-lib-card--default");
    if (m.packCse) c.push("agilo-lib-card--pack");
    return c.join(" ");
  }

  function locked(m) {
    return !!(m.lockReasonCode || m.lockReasonMessage) && !m.canUse;
  }

  function cardHtml(m) {
    var isLocked = locked(m);
    var lockLine = isLocked
      ? '<p class="agilo-lib-card__lock">' + escapeHtml(m.lockReasonMessage || "Réservé.") + "</p>"
      : "";
    var actions = [];
    var cta = global.AgiloLibraryApi.ctaForLocked(m.packCse);
    if (isLocked && m.packCse && cta) {
      var extra = "";
      if (cta.kind === "buy" && cta.secondaryHref) {
        extra = '<a class="agilo-lib-btn" href="' + escapeHtml(cta.secondaryHref) + '">' +
          escapeHtml(cta.secondaryLabel) + "</a>";
      }
      actions.push(
        '<a class="agilo-lib-btn agilo-lib-btn--cta" href="' + escapeHtml(cta.href) + '">' +
        escapeHtml(cta.label) + "</a>" + extra
      );
    } else if (m.type === "STANDARD" && m.requiresUserCopy && m.canDuplicate) {
      actions.push('<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="duplicate">Ajouter à mes modèles</button>');
    } else if (m.type === "STANDARD" && m.requiresUserCopy && !m.canDuplicate && !isLocked) {
      actions.push('<button type="button" class="agilo-lib-btn" disabled>Déjà dans mes modèles</button>');
    }
    if (m.canUse && global.AgiloLibraryApi.isGenerationSafeId(m.promptModelId)) {
      actions.push(
        '<button type="button" class="agilo-lib-btn" data-act="default"' +
        (m.isDefault ? " disabled" : "") + ">Définir par défaut</button>"
      );
    }
    if (m.canPin && !isLocked && m.type === "USER") {
      actions.push(
        '<button type="button" class="agilo-lib-btn" data-act="pin">' +
        (m.pinned ? "Désépingler" : "Épingler") + "</button>"
      );
    }
    return (
      '<article class="' + cardClass(m) + '" data-id="' + m.promptModelId + '" tabindex="0"' +
      (isLocked ? ' aria-disabled="true"' : "") + ">" +
      '<div class="agilo-lib-card__icon" aria-hidden="true">' + iconHtml(m) +
      (isLocked ? '<span class="agilo-lib-card__lockico" aria-hidden="true">🔒</span>' : "") +
      "</div>" +
      '<h3 class="agilo-lib-card__title">' + escapeHtml(m.cardTitle) + "</h3>" +
      (m.publicDescription
        ? '<p class="agilo-lib-card__desc">' + escapeHtml(m.publicDescription) + "</p>"
        : "") +
      '<div class="agilo-lib-card__meta">' + badgeHtml(m) + "</div>" +
      lockLine +
      '<div class="agilo-lib-card__actions">' + actions.join("") + "</div></article>"
    );
  }

  function skeletonCard() {
    return '<article class="agilo-lib-card" aria-hidden="true">' +
      '<div class="agilo-lib-skel agilo-lib-skel--icon"></div>' +
      '<div class="agilo-lib-skel agilo-lib-skel--title"></div>' +
      '<div class="agilo-lib-skel agilo-lib-skel--line"></div></article>';
  }

  function emptyHtml(title, text) {
    return '<div class="agilo-lib-empty" role="status">' +
      '<p class="agilo-lib-empty__title">' + escapeHtml(title) + "</p>" +
      '<p class="agilo-lib-empty__text">' + escapeHtml(text) + "</p></div>";
  }

  function toast(msg) {
    var host = document.querySelector(".agilo-lib-toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "agilo-lib-toasts";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "agilo-lib-toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  function sortModels(list) {
    return list.slice().sort(function (a, b) {
      if (!!b.featured !== !!a.featured) return a.featured ? -1 : 1;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return String(a.cardTitle).localeCompare(String(b.cardTitle), "fr");
    });
  }

  global.AgiloLibraryCore = {
    escapeHtml: escapeHtml,
    iconHtml: iconHtml,
    cardHtml: cardHtml,
    skeletonCard: skeletonCard,
    emptyHtml: emptyHtml,
    toast: toast,
    sortModels: sortModels,
    locked: locked
  };
})(typeof window !== "undefined" ? window : globalThis);
