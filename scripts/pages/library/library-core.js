/**
 * Rendu cartes, icônes, tableau, menus. Capacités lues sur le modèle.
 * @version 1.1.0
 */
(function (global) {
  "use strict";

  var PATHS = {
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4"/>',
    presentation: '<path d="M3 4h18"/><path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4"/><path d="M12 16v4"/><path d="M8 20h8"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/>',
    chart: '<path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/>',
    "graduation-cap": '<path d="M22 10L12 4 2 10l10 6 10-6z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    archive: '<rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><path d="M10 12h4"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    custom: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    wand: '<path d="M15 4l-1 3-3 1 3 1 1 3 1-3 3-1-3-1z"/><path d="M4 20L14 10"/>',
    pin: '<path d="M12 17v5"/><path d="M9 11s-3-1-3-5a6 6 0 0 1 12 0c0 4-3 5-3 5"/><path d="M8 11h8"/>',
    dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    code: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v6l4 2"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    table: '<path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M10 9v11"/>'
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function svgIcon(key, size) {
    size = size || 22;
    var inner = PATHS[key] || PATHS.document;
    return '<svg class="agilo-lib-ico" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner + "</svg>";
  }

  function iconHtml(m, size) {
    size = size || 22;
    if (m && m.iconUrl) {
      return '<img src="' + escapeHtml(m.iconUrl) + '" alt="" width="' + size + '" height="' + size + '">';
    }
    var key = (m && m.iconKey) || (m && m.type === "USER" ? "custom" : "document");
    return svgIcon(key, size);
  }

  function locked(m) {
    return !!(m.lockReasonCode || m.lockReasonMessage) && !m.canUse;
  }

  function badgeHtml(m) {
    var bits = [];
    if (m.isDefault) bits.push('<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>');
    if (m.pinned) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pin">Épinglé</span>');
    if (m.hasHtml) bits.push('<span class="agilo-lib-badge agilo-lib-badge--html">Mise en page</span>');
    if (m.featured && m.type === "STANDARD") bits.push('<span class="agilo-lib-badge agilo-lib-badge--featured">À la une</span>');
    if (m.packCse) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pack">CSE</span>');
    if (m.lockReasonCode || m.lockReasonMessage) {
      bits.push('<span class="agilo-lib-badge agilo-lib-badge--lock">Verrouillé</span>');
    }
    return bits.join("");
  }

  function cardClass(m, size) {
    var c = ["agilo-lib-card"];
    if (size) c.push("agilo-lib-card--" + size);
    if (locked(m)) c.push("agilo-lib-card--locked");
    if (m.isDefault) c.push("agilo-lib-card--default");
    if (m.packCse) c.push("agilo-lib-card--pack");
    if (m.featured && size === "featured") c.push("agilo-lib-card--featured");
    return c.join(" ");
  }

  function menuItems(m) {
    var isLocked = locked(m);
    var items = [];
    if (m.canSetDefault && m.canUse && !m.isDefault && global.AgiloLibraryApi.isGenerationSafeId(m.promptModelId)) {
      items.push({ act: "default", label: "Définir par défaut" });
    }
    if (m.canPin && !isLocked) {
      items.push({ act: "pin", label: m.pinned ? "Désépingler" : "Épingler" });
    }
    if (m.type === "STANDARD" && m.canCopyOfficial) {
      items.push({ act: "duplicate", label: "Ajouter à mes modèles" });
    }
    if (m.type === "USER" && m.canDuplicate) {
      items.push({ act: "duplicate", label: "Enregistrer sous" });
    }
    if (m.canEdit) {
      items.push({ act: "rename", label: "Renommer" });
      items.push({ act: "edit", label: "Modifier" });
    }
    if (m.canManageVersions) {
      items.push({ act: "versions", label: "Versions" });
    }
    if (m.canDelete) {
      items.push({ act: "delete", label: "Supprimer", danger: true });
    }
    return items;
  }

  function primaryAction(m) {
    var isLocked = locked(m);
    var cta = global.AgiloLibraryApi.ctaForLocked(m.packCse);
    if (isLocked && m.packCse && cta) {
      return '<a class="agilo-lib-btn agilo-lib-btn--cta" href="' + escapeHtml(cta.href) + '">' +
        escapeHtml(cta.label) + "</a>";
    }
    if (m.canUse && global.AgiloLibraryApi.isGenerationSafeId(m.promptModelId)) {
      return '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="use"' +
        (m.isDefault ? " disabled" : "") + ">Utiliser ce modèle</button>";
    }
    if (m.type === "STANDARD" && m.canCopyOfficial) {
      return '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="duplicate">Ajouter à mes modèles</button>';
    }
    return "";
  }

  function cardHtml(m, opts) {
    opts = opts || {};
    var size = opts.size || "normal";
    var isLocked = locked(m);
    var desc = m.publicDescription || "";
    var example = m.publicExample || "";
    var lockLine = isLocked
      ? '<p class="agilo-lib-card__lock">' + escapeHtml(m.lockReasonMessage || "Réservé.") + "</p>"
      : "";
    var descHtml = "";
    if (size !== "compact" && desc) {
      descHtml = '<p class="agilo-lib-card__desc">' + escapeHtml(desc) + "</p>";
    }
    var exampleHtml = "";
    if (size !== "compact" && example) {
      exampleHtml = '<p class="agilo-lib-card__example">Exemple : ' + escapeHtml(example) + "</p>";
    }
    var more = menuItems(m).length
      ? '<button type="button" class="agilo-lib-icon-btn agilo-lib-card__more" data-act="more" aria-label="Actions" title="Actions">' +
        svgIcon("dots", 16) + "</button>"
      : "";
    var delay = opts.index != null ? ' style="--i:' + opts.index + '"' : "";
    return (
      '<article class="' + cardClass(m, size) + '" data-id="' + m.promptModelId + '" tabindex="0"' +
      (isLocked ? ' aria-disabled="true"' : "") + delay + ">" +
      '<div class="agilo-lib-card__top">' +
      '<div class="agilo-lib-card__icon" aria-hidden="true">' + iconHtml(m, size === "featured" ? 26 : 22) +
      (isLocked ? '<span class="agilo-lib-card__lockico">' + svgIcon("lock", 10) + "</span>" : "") +
      "</div>" + more +
      "</div>" +
      '<h3 class="agilo-lib-card__title">' + escapeHtml(m.cardTitle) + "</h3>" +
      descHtml + exampleHtml +
      '<div class="agilo-lib-card__meta">' + badgeHtml(m) + "</div>" +
      lockLine +
      '<div class="agilo-lib-card__actions">' + primaryAction(m) + "</div></article>"
    );
  }

  function formatDate(ts) {
    if (!ts) return "-";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  function tableRowHtml(m) {
    var pin = m.pinned ? "Oui" : "";
    var def = m.isDefault ? "Oui" : "";
    var html = m.hasHtml ? "Oui" : "";
    return '<tr class="agilo-lib-tr" data-id="' + m.promptModelId + '">' +
      '<td class="agilo-lib-td"><div class="agilo-lib-td--name">' +
      '<span class="agilo-lib-card__icon agilo-lib-card__icon--sm" aria-hidden="true">' + iconHtml(m, 16) + "</span>" +
      '<span class="agilo-lib-td__title">' + escapeHtml(m.cardTitle) + "</span></div></td>" +
      '<td class="agilo-lib-td">' + (def ? '<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>' : "") + "</td>" +
      '<td class="agilo-lib-td">' + (pin ? '<span class="agilo-lib-badge agilo-lib-badge--pin">Épinglé</span>' : "") + "</td>" +
      '<td class="agilo-lib-td">' + (html ? '<span class="agilo-lib-badge agilo-lib-badge--html">Mise en page</span>' : "") + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--date">' + escapeHtml(formatDate(m.dtCreation)) + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--date">' + escapeHtml(formatDate(m.dtUpdate)) + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--actions">' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary agilo-lib-btn--sm" data-act="use"' +
      (m.isDefault ? " disabled" : "") + ">Utiliser</button>" +
      '<button type="button" class="agilo-lib-icon-btn" data-act="more" aria-label="Actions">' + svgIcon("dots", 16) + "</button>" +
      "</td></tr>";
  }

  function skeletonCard() {
    return '<article class="agilo-lib-card agilo-lib-card--skeleton" aria-hidden="true">' +
      '<div class="agilo-lib-skel agilo-lib-skel--icon"></div>' +
      '<div class="agilo-lib-skel agilo-lib-skel--title"></div>' +
      '<div class="agilo-lib-skel agilo-lib-skel--line"></div>' +
      '<div class="agilo-lib-skel agilo-lib-skel--line"></div></article>';
  }

  function emptyHtml(title, text, extra) {
    return '<div class="agilo-lib-empty" role="status">' +
      '<p class="agilo-lib-empty__title">' + escapeHtml(title) + "</p>" +
      '<p class="agilo-lib-empty__text">' + escapeHtml(text) + "</p>" +
      (extra || "") + "</div>";
  }

  function toast(msg, opts) {
    opts = opts || {};
    var host = document.querySelector(".agilo-lib-toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "agilo-lib-toasts";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "agilo-lib-toast";
    if (opts.html) el.innerHTML = opts.html;
    else el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.classList.add("is-out"); }, 4200);
    setTimeout(function () { el.remove(); }, 4800);
  }

  function closeMenus() {
    document.querySelectorAll(".agilo-lib-menu").forEach(function (n) { n.remove(); });
  }

  function openCardMenu(anchor, items, onPick) {
    closeMenus();
    if (!items || !items.length) return;
    var menu = document.createElement("div");
    menu.className = "agilo-lib-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = items.map(function (it) {
      return '<button type="button" role="menuitem" data-menu="' + escapeHtml(it.act) + '"' +
        (it.danger ? ' class="is-danger"' : "") + ">" + escapeHtml(it.label) + "</button>";
    }).join("");
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 4;
    var left = Math.max(8, r.right + window.scrollX - 200);
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    menu.addEventListener("click", function (e) {
      var b = e.target.closest("[data-menu]");
      if (!b) return;
      var act = b.getAttribute("data-menu");
      closeMenus();
      if (typeof onPick === "function") onPick(act);
    });
    setTimeout(function () {
      document.addEventListener("click", closeMenus, { once: true });
    }, 0);
  }

  function closeDialogs() {
    document.querySelectorAll(".agilo-lib-dialog").forEach(function (d) {
      if (d._onKey) document.removeEventListener("keydown", d._onKey);
      d.remove();
    });
  }

  function promptDialog(opts) {
    closeDialogs();
    var dlg = document.createElement("div");
    dlg.className = "agilo-lib-dialog is-open";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.innerHTML =
      '<div class="agilo-lib-dialog__panel">' +
      "<h2>" + escapeHtml(opts.title || "") + "</h2>" +
      (opts.text ? "<p>" + escapeHtml(opts.text) + "</p>" : "") +
      '<label>' + escapeHtml(opts.label || "Nom") +
      '<input type="text" maxlength="' + (opts.maxlength || 120) + '" value="' + escapeHtml(opts.value || "") + '"></label>' +
      '<div class="agilo-lib-dialog__actions">' +
      '<button type="button" class="agilo-lib-btn" data-close>Annuler</button>' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-ok>' +
      escapeHtml(opts.ok || "Valider") + "</button>" +
      "</div></div>";
    document.body.appendChild(dlg);
    var input = dlg.querySelector("input");
    input.focus();
    input.select();
    function stop(ev) { if (ev.key === "Escape") closeDialogs(); }
    document.addEventListener("keydown", stop);
    dlg._onKey = stop;
    dlg.querySelector("[data-close]").addEventListener("click", closeDialogs);
    dlg.addEventListener("click", function (ev) { if (ev.target === dlg) closeDialogs(); });
    dlg.querySelector("[data-ok]").addEventListener("click", function () {
      var name = (input.value || "").trim();
      if (!name) return;
      closeDialogs();
      if (typeof opts.onOk === "function") opts.onOk(name);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") dlg.querySelector("[data-ok]").click();
    });
  }

  function confirmDialog(opts) {
    closeDialogs();
    var dlg = document.createElement("div");
    dlg.className = "agilo-lib-dialog is-open";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.innerHTML =
      '<div class="agilo-lib-dialog__panel">' +
      "<h2>" + escapeHtml(opts.title || "Confirmer") + "</h2>" +
      "<p>" + escapeHtml(opts.text || "") + "</p>" +
      '<div class="agilo-lib-dialog__actions">' +
      '<button type="button" class="agilo-lib-btn" data-close>Annuler</button>' +
      '<button type="button" class="agilo-lib-btn ' + (opts.danger ? "agilo-lib-btn--danger" : "agilo-lib-btn--primary") + '" data-ok>' +
      escapeHtml(opts.ok || "Confirmer") + "</button>" +
      "</div></div>";
    document.body.appendChild(dlg);
    function stop(ev) { if (ev.key === "Escape") closeDialogs(); }
    document.addEventListener("keydown", stop);
    dlg._onKey = stop;
    dlg.querySelector("[data-close]").addEventListener("click", closeDialogs);
    dlg.addEventListener("click", function (ev) { if (ev.target === dlg) closeDialogs(); });
    dlg.querySelector("[data-ok]").addEventListener("click", function () {
      closeDialogs();
      if (typeof opts.onOk === "function") opts.onOk();
    });
  }

  function sortOfficial(list) {
    return list.slice().sort(function (a, b) {
      if (!!b.featured !== !!a.featured) return a.featured ? -1 : 1;
      var ao = Number(a.displayOrder || a.sortOrder || 1000);
      var bo = Number(b.displayOrder || b.sortOrder || 1000);
      if (ao !== bo) return ao - bo;
      return String(a.cardTitle).localeCompare(String(b.cardTitle), "fr");
    });
  }

  function sortModels(list) {
    return sortOfficial(list);
  }

  global.AgiloLibraryCore = {
    escapeHtml: escapeHtml,
    svgIcon: svgIcon,
    iconHtml: iconHtml,
    badgeHtml: badgeHtml,
    cardHtml: cardHtml,
    tableRowHtml: tableRowHtml,
    skeletonCard: skeletonCard,
    emptyHtml: emptyHtml,
    toast: toast,
    sortModels: sortModels,
    sortOfficial: sortOfficial,
    locked: locked,
    menuItems: menuItems,
    openCardMenu: openCardMenu,
    closeMenus: closeMenus,
    promptDialog: promptDialog,
    confirmDialog: confirmDialog,
    closeDialogs: closeDialogs,
    formatDate: formatDate
  };
})(typeof window !== "undefined" ? window : globalThis);
