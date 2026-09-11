/**
 * Rendu v2 (cartes, tableau, menus) : hérite d’AgiloLibraryCore et
 * remplace uniquement ce qui change. v1 (library-core.js) reste intact.
 *
 * Règles v2 :
 * - toolbar carte : check (défaut) + ⋯, sans boutons pleins ni « Voir » ;
 * - fiche : CTA écrits via primaryAction() ;
 * - menu ⋯ hors fiche : « Définir par défaut » si éligible.
 * @version 2.1.1
 */
(function (global) {
  "use strict";

  var Core = global.AgiloLibraryCore;
  if (!Core) return;

  var escapeHtml = Core.escapeHtml;
  var svgIcon = Core.svgIcon;
  var iconHtml = Core.iconHtml;
  var locked = Core.locked;

  function Api() { return global.AgiloLibraryApi || {}; }

  function canEditIcon(m) {
    var A = Api();
    return !!(m && m.type === "USER" && A.canSetUserIcon && A.canSetUserIcon(m.promptModelId, m.type) && !locked(m));
  }

  /** Statut de création (READY par défaut quand le serveur ne dit rien). */
  function isReady(m) {
    var s = String((m && (m.promptModelStatus || m.status)) || "").toUpperCase();
    if (!s) return true;
    return s === "READY" || s === "ACTIVE";
  }

  function canSetDefault(m) {
    var A = Api();
    if (!m || locked(m) || !m.canUse) return false;
    return !!(A.isGenerationSafeId && A.isGenerationSafeId(m.promptModelId));
  }

  function menuSurface(opts) {
    opts = opts || {};
    if (opts.surface) return opts.surface;
    return opts.inFiche ? "fiche" : "card";
  }

  function menuItems(m, opts) {
    opts = opts || {};
    var surface = menuSurface(opts);
    var isLocked = locked(m);
    var items = [];
    if (surface !== "fiche" && canSetDefault(m) && !m.isDefault) {
      items.push({ act: "default", label: "Définir par défaut", icon: "check-circle" });
    }
    if (m.canPin && !isLocked) {
      items.push({ act: "pin", label: m.pinned ? "Désépingler" : "Épingler", icon: "pin" });
    }
    if (m.type === "STANDARD" && m.alreadyCopied) {
      items.push({ act: "open-copy", label: "Voir dans Mes modèles", icon: "copy" });
    } else if (m.type === "STANDARD" && m.canCopyOfficial) {
      items.push({ act: "duplicate", label: "Ajouter à mes modèles", icon: "copy" });
    }
    if (m.type === "USER" && m.canDuplicate) {
      items.push({ act: "duplicate", label: "Enregistrer sous", icon: "copy" });
    }
    if (m.canEdit) {
      items.push({ act: "rename", label: "Renommer", icon: "pencil" });
    }
    if (m.canManageVersions) {
      items.push({ act: "versions", label: "Versions", icon: "clock" });
    }
    if (m.canDelete) {
      items.push({ act: "delete", label: "Supprimer", danger: true, icon: "trash" });
    }
    return items;
  }

  function defaultState(size) {
    return '<span class="agilo-lib-state agilo-lib-state--default agilo-lib-act-primary' +
      (size === "sm" ? " agilo-lib-state--sm" : "") +
      '" aria-label="Modèle par défaut">' + svgIcon("check-circle", 16) + " Par défaut</span>";
  }

  function primaryAction(m, size) {
    var A = Api();
    var isLocked = locked(m);
    var cta = A.ctaForLocked ? A.ctaForLocked(m.packCse) : null;
    var sm = size === "sm" ? " agilo-lib-btn--sm" : "";
    if (isLocked && m.packCse && cta) {
      return '<a class="agilo-lib-btn agilo-lib-btn--cta agilo-lib-act-primary' + sm + '" href="' + escapeHtml(cta.href) + '">' +
        escapeHtml(cta.label) + "</a>";
    }
    if (m.isDefault) return defaultState(size);
    if (canSetDefault(m)) {
      return '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary agilo-lib-act-primary' + sm + '" data-act="default">' +
        "Définir par défaut</button>";
    }
    if (m.type === "STANDARD" && m.alreadyCopied) {
      return '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary agilo-lib-act-primary' + sm + '" data-act="open-copy">' +
        "Voir dans Mes modèles</button>";
    }
    if (m.type === "STANDARD" && m.canCopyOfficial) {
      return '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary agilo-lib-act-primary' + sm + '" data-act="duplicate">Ajouter à mes modèles</button>';
    }
    return '<span class="agilo-lib-state agilo-lib-state--empty agilo-lib-act-primary" aria-hidden="true"></span>';
  }

  function defaultBadgeHtml(m) {
    if (!m || !m.isDefault) return "";
    return '<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>';
  }

  function defaultQuickAction(m, size) {
    var sm = size === "sm" ? " agilo-lib-icon-btn--sm" : "";
    if (m.isDefault) {
      return '<span class="agilo-lib-icon-btn agilo-lib-quick' + sm + ' is-on" role="img" aria-label="Modèle par défaut" data-tip="Par défaut">' +
        svgIcon("check-circle", 16) + "</span>";
    }
    if (!canSetDefault(m)) return "";
    return '<button type="button" class="agilo-lib-icon-btn agilo-lib-quick' + sm +
      '" data-act="default" aria-label="Définir par défaut" data-tip="Définir par défaut">' +
      svgIcon("check-circle", 16) + "</button>";
  }

  function moreBtn(m, size, opts) {
    if (!menuItems(m, opts || { surface: "card" }).length) return "";
    return '<button type="button" class="agilo-lib-icon-btn agilo-lib-quick' + (size === "sm" ? " agilo-lib-icon-btn--sm" : "") +
      '" data-act="more" aria-label="Autres actions" data-tip="Autres actions">' + svgIcon("dots", 16) + "</button>";
  }

  function cardToolbarHtml(m, size) {
    var bits = defaultQuickAction(m, size) + moreBtn(m, size, { surface: "card" });
    if (!bits) return "";
    return '<div class="agilo-lib-card__actions agilo-lib-card__actions--v2">' + bits + "</div>";
  }

  function lockLineHtml(m) {
    if (!locked(m)) return "";
    var A = Api();
    var cta = m.packCse && A.ctaForLocked ? A.ctaForLocked(m.packCse) : null;
    var link = cta
      ? ' <a class="agilo-lib-card__cta-link" href="' + escapeHtml(cta.href) + '">' + escapeHtml(cta.label) + "</a>"
      : "";
    return '<p class="agilo-lib-card__lock">' + escapeHtml(m.lockReasonMessage || "Réservé.") + link + "</p>";
  }

  function titleButton(m, cls) {
    var title = escapeHtml(m.cardTitle);
    return '<button type="button" class="' + cls + '" data-act="fiche" title="' + title + '" aria-label="' + title + '">' +
      title + "</button>";
  }

  /** Pastille icône. Cliquable (pencil) sur les modèles personnels. */
  function iconTile(m, px, opts) {
    opts = opts || {};
    var editable = canEditIcon(m) && opts.editable !== false;
    var cls = "agilo-lib-card__icon" + (opts.size ? " agilo-lib-card__icon--" + opts.size : "") +
      (editable ? " agilo-lib-card__icon--editable" : "");
    var inner = iconHtml(m, px) +
      (locked(m) ? '<span class="agilo-lib-card__lockico">' + svgIcon("lock", 10) + "</span>" : "") +
      (editable ? '<span class="agilo-lib-card__icon-edit" aria-hidden="true">' + svgIcon("pencil", 11) + "</span>" : "");
    var cat = ' data-cat="' + escapeHtml(m.categoryKey || (m.type === "USER" ? "custom" : "general")) + '"';
    if (editable) {
      return '<button type="button" class="' + cls + '"' + cat + ' data-act="icon" aria-label="Changer l’icône" title="Changer l’icône">' +
        inner + "</button>";
    }
    return '<span class="' + cls + '"' + cat + ' aria-hidden="true">' + inner + "</span>";
  }

  function badgeHtml(m) {
    var bits = [];
    if (m.pinned) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pin">' + svgIcon("pin", 12) + " Épinglé</span>");
    if (m.alreadyCopied && m.type === "STANDARD") {
      bits.push('<span class="agilo-lib-badge agilo-lib-badge--acquired">Dans Mes modèles</span>');
    }
    if (m.hasHtml) bits.push('<span class="agilo-lib-badge agilo-lib-badge--html">Mise en page</span>');
    if (m.featured && m.type === "STANDARD") bits.push('<span class="agilo-lib-badge agilo-lib-badge--featured">À la une</span>');
    if (m.packCse) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pack">CSE</span>');
    if (!isReady(m)) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pending">' + svgIcon("clock", 12) + " En création</span>");
    if (m.lockReasonCode || m.lockReasonMessage) {
      bits.push('<span class="agilo-lib-badge agilo-lib-badge--lock">Verrouillé</span>');
    }
    return bits.join("");
  }

  function cardClass(m, size) {
    var c = ["agilo-lib-card", "agilo-lib-card--v2"];
    if (size) c.push("agilo-lib-card--" + size);
    if (locked(m)) c.push("agilo-lib-card--locked");
    if (m.isDefault) c.push("agilo-lib-card--default");
    if (m.featured && size === "featured") c.push("agilo-lib-card--featured");
    return c.join(" ");
  }

  function cardHtml(m, opts) {
    opts = opts || {};
    var size = opts.size || "normal";
    var desc = m.publicDescription || "";
    var example = m.publicExample || "";
    var descHtml = size !== "compact" && desc ? '<p class="agilo-lib-card__desc">' + escapeHtml(desc) + "</p>" : "";
    var exampleHtml = size !== "compact" && example
      ? '<p class="agilo-lib-card__example">Exemple : ' + escapeHtml(example) + "</p>"
      : "";
    var delay = opts.index != null ? ' style="--i:' + Math.min(opts.index, 12) + '"' : "";
    var preview = size === "compact" ? "" : Core.previewHtml(m);
    var meta = defaultBadgeHtml(m) + badgeHtml(m);
    return (
      '<article class="' + cardClass(m, size) + '" data-id="' + m.promptModelId + '"' +
      (locked(m) ? ' aria-disabled="true"' : "") + delay + ">" +
      preview +
      '<div class="agilo-lib-card__top">' +
      iconTile(m, size === "featured" ? 24 : 22, { size: size === "featured" ? "lg" : "" }) +
      '<div class="agilo-lib-card__head">' +
      '<h3 class="agilo-lib-card__title">' + titleButton(m, "agilo-lib-card__titlebtn") + "</h3>" +
      (meta ? '<div class="agilo-lib-card__meta">' + meta + "</div>" : "") +
      "</div></div>" +
      descHtml + exampleHtml + lockLineHtml(m) +
      cardToolbarHtml(m) +
      "</article>"
    );
  }

  function tableRowHtml(m) {
    return '<tr class="agilo-lib-tr" data-id="' + m.promptModelId + '">' +
      '<td class="agilo-lib-td"><div class="agilo-lib-td--name">' +
      iconTile(m, 16, { size: "sm", editable: false }) +
      titleButton(m, "agilo-lib-td--title") +
      "</div></td>" +
      '<td class="agilo-lib-td"><div class="agilo-lib-card__meta">' +
      defaultBadgeHtml(m) + badgeHtml(m) + "</div></td>" +
      '<td class="agilo-lib-td agilo-lib-td--date">' + escapeHtml(Core.formatDate(m.dtCreation)) + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--date">' + escapeHtml(Core.formatDate(m.dtUpdate)) + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--actions"><div class="agilo-lib-td__actions">' +
      defaultQuickAction(m, "sm") + moreBtn(m, "sm", { surface: "card" }) +
      "</div></td></tr>";
  }

  global.AgiloLibraryCoreV2 = Object.assign({}, Core, {
    VERSION: "2.1.1",
    menuItems: menuItems,
    primaryAction: primaryAction,
    defaultState: defaultState,
    defaultQuickAction: defaultQuickAction,
    defaultBadgeHtml: defaultBadgeHtml,
    cardToolbarHtml: cardToolbarHtml,
    canSetDefault: canSetDefault,
    iconTile: iconTile,
    badgeHtml: badgeHtml,
    cardHtml: cardHtml,
    tableRowHtml: tableRowHtml,
    canEditIcon: canEditIcon,
    isReady: isReady
  });
})(typeof window !== "undefined" ? window : globalThis);
