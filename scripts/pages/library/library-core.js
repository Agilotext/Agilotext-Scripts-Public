/**
 * Rendu cartes, icônes Nucleo curatées (inline), tableau, menus.
 * iconUrl serveur inchangé. Fallback = glyphes 18 px, currentColor.
 * @version 1.3.0
 */
(function (global) {
  "use strict";

  var PATHS = {
    document: '<line x1="5.75" y1="6.75" x2="7.75" y2="6.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="5.75" y1="9.75" x2="12.25" y2="9.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="5.75" y1="12.75" x2="12.25" y2="12.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M2.75,14.25V3.75c0-1.105,.895-2,2-2h5.586c.265,0,.52,.105,.707,.293l3.914,3.914c.188,.188,.293,.442,.293,.707v7.586c0,1.105-.895,2-2,2H4.75c-1.105,0-2-.895-2-2Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M15.16,6.25h-3.41c-.552,0-1-.448-1-1V1.852" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    custom: '<path d="m12.5717,2.9253L2.9189,12.583c-.3899.39-.3903,1.0221-.0011,1.4127l1.0852,1.0892c.391.39,1.024.39,1.415,0L15.0701,5.4269c.3898-.3901.3903-1.0221.0011-1.4127l-1.0838-1.0878c-.3904-.3918-1.0247-.3923-1.4157-.0011Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="m10.387,5.36l2.25,2.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="m7.243,3.49l-.946-.3099-.316-.9501c-.102-.3099-.609-.3099-.711,0l-.316.9501-.946.3099c-.153.05-.257.2-.257.36s.104.3.257.35l.946.3202.316.95c.051.15.194.25.355.25s.305-.1.355-.25l.316-.95.946-.3202c.153-.0499.257-.1899.257-.35s-.103-.3099-.256-.36Z" fill="currentColor"/><path d="m16.658,11.99l-1.263-.42-.421-1.2599c-.137-.41-.812-.41-.949,0l-.421,1.2599-1.263.42c-.204.0701-.342.26-.342.47,0,.2201.138.4099.342.4799l1.263.4201.421,1.26c.068.21.26.34.475.34s.406-.13.475-.34l.421-1.26,1.263-.4201c.204-.0699.342-.2598.342-.4799,0-.21-.139-.3999-.343-.47Z" fill="currentColor"/>',
    meeting: '<path d="M5.75 8.25049C6.8546 8.25049 7.75 7.35549 7.75 6.25049C7.75 5.14549 6.8546 4.25049 5.75 4.25049C4.6454 4.25049 3.75 5.14549 3.75 6.25049C3.75 7.35549 4.6454 8.25049 5.75 8.25049Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M9.60903 15.1225C10.132 14.9475 10.439 14.3785 10.245 13.8635C9.56003 12.0455 7.80903 10.7515 5.75103 10.7515C3.69303 10.7515 1.94203 12.0455 1.25703 13.8635C1.06303 14.3795 1.37003 14.9485 1.89303 15.1225C2.85503 15.4435 4.17403 15.7505 5.75203 15.7505C7.33003 15.7505 8.64803 15.4435 9.60903 15.1225Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 5.75049C13.1046 5.75049 14 4.85549 14 3.75049C14 2.64549 13.1046 1.75049 12 1.75049C10.8954 1.75049 10 2.64549 10 3.75049C10 4.85549 10.8954 5.75049 12 5.75049Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M13.154 13.1873C14.2224 13.0845 15.1437 12.8614 15.858 12.6226C16.381 12.4476 16.688 11.8785 16.494 11.3636C15.809 9.54549 14.058 8.2515 12 8.2515C11.1608 8.2515 10.379 8.4771 9.69287 8.8555" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    report: '<rect x="5.75" y="1.75" width="6.5" height="9.5" rx="3.25" ry="3.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M15.25,8c0,3.452-2.798,6.25-6.25,6.25h0c-3.452,0-6.25-2.798-6.25-6.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="9" y1="14.25" x2="9" y2="16.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    checklist: '<polyline points="2.25 13.391 3.609 14.75 7.006 10.333" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="10.25" y1="5.25" x2="16.25" y2="5.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="10.25" y1="12.75" x2="16.25" y2="12.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="2.25" y="2.75" width="4.5" height="4.5" rx="1" ry="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    briefcase: '<path d="M6.25,4.75V2.25c0-.552,.448-1,1-1h3.5c.552,0,1,.448,1,1v2.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="1.75" y="4.75" width="14.5" height="10.5" rx="2" ry="2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    idea: '<rect x="7.75" y="2.75" width="2.5" height="12.5" rx="1" ry="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="2.25" y="7.75" width="2.5" height="7.5" rx="1" ry="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="13.25" y="11.75" width="2.5" height="3.5" rx="1" ry="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    education: '<path d="M9.45801 2.361L15.79 5.621C16.403 5.937 16.403 6.813 15.79 7.129L9.45801 10.389C9.17001 10.537 8.829 10.537 8.542 10.389L2.20999 7.129C1.59699 6.813 1.59699 5.937 2.20999 5.621L8.542 2.361C8.83 2.213 9.17101 2.213 9.45801 2.361Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M16.25 6.375C16.079 7.115 15.932 8.097 15.969 9.25C15.996 10.084 16.113 10.812 16.25 11.406" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4.25 11.5535V14C4.25 15.104 6.377 16 9 16C11.623 16 13.75 15.104 13.75 14V11.5535" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    pin: '<line x1="9" y1="16.25" x2="9" y2="12.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M14.25,12.25c-.089-.699-.318-1.76-.969-2.875-.335-.574-.703-1.028-1.031-1.375V3.75c0-1.105-.895-2-2-2h-2.5c-1.105,0-2,.895-2,2v4.25c-.329,.347-.697,.801-1.031,1.375-.65,1.115-.88,2.176-.969,2.875H14.25Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    dots: '<circle cx="9" cy="9" r=".5" fill="currentColor" stroke="currentColor" stroke-width="1.5"/><circle cx="3.25" cy="9" r=".5" fill="currentColor" stroke="currentColor" stroke-width="1.5"/><circle cx="14.75" cy="9" r=".5" fill="currentColor" stroke="currentColor" stroke-width="1.5"/>',
    "check-circle": '<circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M5.5,9c.863,.867,1.537,1.868,2.1,2.962,1.307-2.491,2.94-4.466,4.9-5.923" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    trash: '<path d="M13.6977 7.75L13.35 14.35C13.294 15.4201 12.416 16.25 11.353 16.25H6.64804C5.58404 16.25 4.70703 15.42 4.65103 14.35L4.30334 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M2.75 4.75H15.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M6.75 4.75V2.75C6.75 2.2 7.198 1.75 7.75 1.75H10.25C10.802 1.75 11.25 2.2 11.25 2.75V4.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    pencil: '<path d="M13.953 7.57799L15.062 6.46898C15.648 5.88298 15.648 4.93298 15.062 4.34798L13.653 2.93898C13.067 2.35298 12.117 2.35298 11.532 2.93898L10.423 4.04799L13.953 7.57799Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M8.6544 5.81461L4.147 10.322C3.897 10.572 3.718 10.884 3.627 11.226L2.5 15.499L6.773 14.372C7.115 14.282 7.427 14.102 7.677 13.852L12.1844 9.3446" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M10.4044 7.56461L6.26501 11.704" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    copy: '<path d="M2.25 6.75V13.25C2.25 14.355 3.145 15.25 4.25 15.25H11.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M7.25 12.25H13.75C14.8546 12.25 15.75 11.355 15.75 10.25V4.75C15.75 3.645 14.8546 2.75 13.75 2.75H7.25C6.1454 2.75 5.25 3.645 5.25 4.75V10.25C5.25 11.355 6.1454 12.25 7.25 12.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    search: '<path d="M15.75 15.75L11.6386 11.6386" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 4.7125 10.7875 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    plus: '<line x1="9" y1="3.25" x2="9" y2="14.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="3.25" y1="9" x2="14.75" y2="9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    lock: '<path d="M5.75,8.25v-3.25c0-1.795,1.455-3.25,3.25-3.25h0c1.795,0,3.25,1.455,3.25,3.25v3.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="9" y1="11.75" x2="9" y2="12.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="3.25" y="8.25" width="11.5" height="8" rx="2" ry="2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    grid: '<rect x="2.25" y="2.75" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="10.25" y="2.75" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2.25" y="10.75" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="10.25" y="10.75" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    table: '<polyline points="2.25 13.391 3.609 14.75 7.006 10.333" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="10.25" y1="5.25" x2="16.25" y2="5.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="10.25" y1="12.75" x2="16.25" y2="12.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><rect x="2.25" y="2.75" width="4.5" height="4.5" rx="1" ry="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    xmark: '<line x1="14" y1="4" x2="4" y2="14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><line x1="4" y1="4" x2="14" y2="14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    eye: '<path d="M9 11.75C10.5188 11.75 11.75 10.5188 11.75 9C11.75 7.48122 10.5188 6.25 9 6.25C7.48122 6.25 6.25 7.48122 6.25 9C6.25 10.5188 7.48122 11.75 9 11.75Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M15.9557 7.88669C16.3481 8.57939 16.3481 9.42049 15.9557 10.1132C15.0087 11.7849 12.7944 14.4999 9 14.4999C5.2056 14.4999 2.9912 11.7849 2.0443 10.1132C1.6519 9.42049 1.6519 8.57939 2.0443 7.88669C2.9913 6.21499 5.2056 3.5 9 3.5C12.7944 3.5 15.0088 6.21499 15.9557 7.88669Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    sparkle: '<path d="M6.65802 4.02597L5.39502 3.60495L4.97402 2.34195C4.83702 1.93395 4.16202 1.93395 4.02502 2.34195L3.60402 3.60495L2.34102 4.02597C2.13702 4.09397 1.99902 4.28497 1.99902 4.49997C1.99902 4.71497 2.13702 4.90597 2.34102 4.97397L3.60402 5.39499L4.02502 6.65799C4.09302 6.86199 4.28502 6.99997 4.50002 6.99997C4.71502 6.99997 4.90602 6.86199 4.97502 6.65799L5.39602 5.39499L6.65902 4.97397C6.86302 4.90597 7.00102 4.71497 7.00102 4.49997C7.00102 4.28497 6.86202 4.09397 6.65802 4.02597Z" fill="currentColor"/><path d="M15.658 13.026L14.395 12.605L13.974 11.3419C13.837 10.9339 13.162 10.9339 13.025 11.3419L12.604 12.605L11.341 13.026C11.137 13.094 10.999 13.285 10.999 13.5C10.999 13.715 11.137 13.906 11.341 13.974L12.604 14.395L13.025 15.658C13.093 15.862 13.285 16 13.5 16C13.715 16 13.906 15.862 13.975 15.658L14.396 14.395L15.659 13.974C15.863 13.906 16.001 13.715 16.001 13.5C16.001 13.285 15.862 13.094 15.658 13.026Z" fill="currentColor"/><path d="M6 8.75L6.671 11.329L9.25 12L6.671 12.671L6 15.25L5.329 12.671L2.75 12L5.329 11.329L6 8.75Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2.75L12.671 5.32898L15.25 6L12.671 6.67102L12 9.25L11.329 6.67102L8.75 6L11.329 5.32898L12 2.75Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    "arrow-left": '<line x1="2.75" y1="9" x2="15.25" y2="9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><polyline points="7 13.25 2.75 9 7 4.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    "arrow-right": '<line x1="15.25" y1="9" x2="2.75" y2="9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><polyline points="11 4.75 15.25 9 11 13.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    check: '<polyline points="2.75 9.25 6.75 14.25 15.25 3.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>',
    clock: '<circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><polyline points="9 4.75 9 9 12.25 11.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>'
  };

  var ICON_ALIAS = {
    "file-text": "document",
    users: "meeting",
    mic: "report",
    presentation: "report",
    chart: "idea",
    "graduation-cap": "education",
    archive: "document",
    wand: "custom",
    mail: "document",
    history: "checklist",
    code: "custom"
  };

  var MENU_ICONS = {
    default: "check-circle",
    pin: "pin",
    duplicate: "copy",
    rename: "pencil",
    edit: "pencil",
    versions: "clock",
    delete: "trash",
    icon: "custom"
  };

  function resolveIconKey(key) {
    var k = String(key || "").trim();
    if (!k) return "document";
    if (ICON_ALIAS[k]) return ICON_ALIAS[k];
    if (PATHS[k]) return k;
    return "document";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function svgIcon(key, size) {
    size = size || 18;
    var inner = PATHS[resolveIconKey(key)] || PATHS.document;
    return '<svg class="agilo-lib-ico" width="' + size + '" height="' + size +
      '" viewBox="0 0 18 18" fill="none" aria-hidden="true">' + inner + "</svg>";
  }

  function iconHtml(m, size) {
    size = size || 18;
    var key = resolveIconKey((m && m.iconKey) || (m && m.type === "USER" ? "custom" : "document"));
    if (m && m.iconUrl) {
      return '<span class="agilo-lib-ico-wrap">' +
        '<img src="' + escapeHtml(m.iconUrl) + '" alt="" width="' + size + '" height="' + size +
        '" onerror="this.onerror=null;this.hidden=true;var n=this.nextElementSibling;if(n)n.hidden=false;">' +
        "<span hidden>" + svgIcon(key, size) + "</span></span>";
    }
    return svgIcon(key, size);
  }

  function previewHtml(m) {
    var lines = ["72%", "88%", "64%", "80%", "52%"];
    return '<div class="agilo-lib-card__preview" data-act="fiche" data-icon="' +
      escapeHtml(resolveIconKey(m && m.iconKey)) + '" aria-hidden="true">' +
      '<div class="agilo-lib-card__preview-sheet">' +
      lines.map(function (w) {
        return '<span style="width:' + w + '"></span>';
      }).join("") +
      "</div></div>";
  }

  function locked(m) {
    return !!(m.lockReasonCode || m.lockReasonMessage) && !m.canUse;
  }

  function badgeHtml(m) {
    var bits = [];
    if (m.isDefault) bits.push('<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>');
    if (m.pinned) bits.push('<span class="agilo-lib-badge agilo-lib-badge--pin">' + svgIcon("pin", 12) + " Épinglé</span>");
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
      items.push({ act: "default", label: "Définir par défaut", icon: "check-circle" });
    }
    if (m.canPin && !isLocked) {
      items.push({ act: "pin", label: m.pinned ? "Désépingler" : "Épingler", icon: "pin" });
    }
    if (m.type === "STANDARD" && m.canCopyOfficial) {
      items.push({ act: "duplicate", label: "Ajouter à mes modèles", icon: "copy" });
    }
    if (m.type === "USER" && m.canDuplicate) {
      items.push({ act: "duplicate", label: "Enregistrer sous", icon: "copy" });
    }
    if (m.type === "USER" && global.AgiloLibraryApi && global.AgiloLibraryApi.canSetUserIcon &&
      global.AgiloLibraryApi.canSetUserIcon(m.promptModelId, m.type) && !isLocked) {
      items.push({ act: "icon", label: "Changer l’icône", icon: "custom" });
    }
    if (m.canEdit) {
      items.push({ act: "rename", label: "Renommer", icon: "pencil" });
      items.push({ act: "edit", label: "Modifier", icon: "pencil" });
    }
    if (m.canManageVersions) {
      items.push({ act: "versions", label: "Versions", icon: "clock" });
    }
    if (m.canDelete) {
      items.push({ act: "delete", label: "Supprimer", danger: true, icon: "trash" });
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
        (m.isDefault ? " disabled" : "") + ">Utiliser par défaut</button>";
    }
    if (m.type === "STANDARD" && m.canCopyOfficial) {
      return '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary" data-act="duplicate">Ajouter à mes modèles</button>';
    }
    return "";
  }

  function voirBtn() {
    return '<button type="button" class="agilo-lib-btn" data-act="fiche">' + svgIcon("eye", 16) + " Voir</button>";
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
    var preview = size === "compact" ? "" : previewHtml(m);
    return (
      '<article class="' + cardClass(m, size) + '" data-id="' + m.promptModelId + '" tabindex="0"' +
      (isLocked ? ' aria-disabled="true"' : "") + delay + ">" +
      preview +
      '<div class="agilo-lib-card__top">' +
      '<div class="agilo-lib-card__icon" aria-hidden="true">' + iconHtml(m, size === "featured" ? 22 : 18) +
      (isLocked ? '<span class="agilo-lib-card__lockico">' + svgIcon("lock", 10) + "</span>" : "") +
      "</div>" + more +
      "</div>" +
      '<h3 class="agilo-lib-card__title">' + escapeHtml(m.cardTitle) + "</h3>" +
      descHtml + exampleHtml +
      '<div class="agilo-lib-card__meta">' + badgeHtml(m) + "</div>" +
      lockLine +
      '<div class="agilo-lib-card__actions">' + voirBtn() + primaryAction(m) + "</div></article>"
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
      "<span>" + escapeHtml(m.cardTitle) + "</span></div></td>" +
      '<td class="agilo-lib-td">' + (def ? '<span class="agilo-lib-badge agilo-lib-badge--default">Par défaut</span>' : "") + "</td>" +
      '<td class="agilo-lib-td">' + (pin ? '<span class="agilo-lib-badge agilo-lib-badge--pin">' + svgIcon("pin", 12) + " Épinglé</span>" : "") + "</td>" +
      '<td class="agilo-lib-td">' + (html ? '<span class="agilo-lib-badge agilo-lib-badge--html">Mise en page</span>' : "") + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--date">' + escapeHtml(formatDate(m.dtCreation)) + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--date">' + escapeHtml(formatDate(m.dtUpdate)) + "</td>" +
      '<td class="agilo-lib-td agilo-lib-td--actions">' +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--sm" data-act="fiche">' + svgIcon("eye", 14) + " Voir</button>" +
      '<button type="button" class="agilo-lib-btn agilo-lib-btn--primary agilo-lib-btn--sm" data-act="use"' +
      (m.isDefault ? " disabled" : "") + ">Utiliser par défaut</button>" +
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

  function emptyHtml(title, text, extra, iconKey) {
    var ico = iconKey
      ? '<div class="agilo-lib-empty__ico" aria-hidden="true">' + svgIcon(iconKey, 28) + "</div>"
      : "";
    return '<div class="agilo-lib-empty" role="status">' + ico +
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

  var menuAnchor = null;
  var onDocClick = null;
  var onDocScroll = null;
  var onWinResize = null;
  var onDocKey = null;

  function unbindMenuListeners() {
    if (onDocClick) document.removeEventListener("click", onDocClick);
    if (onDocScroll) document.removeEventListener("scroll", onDocScroll, true);
    if (onWinResize) window.removeEventListener("resize", onWinResize);
    if (onDocKey) document.removeEventListener("keydown", onDocKey, true);
    onDocClick = onDocScroll = onWinResize = onDocKey = null;
  }

  function closeMenus() {
    document.querySelectorAll(".agilo-lib-menu").forEach(function (n) { n.remove(); });
    if (menuAnchor && menuAnchor.setAttribute && menuAnchor.isConnected) {
      menuAnchor.setAttribute("aria-expanded", "false");
    }
    menuAnchor = null;
    unbindMenuListeners();
  }

  function openCardMenu(anchor, items, onPick) {
    if (menuAnchor === anchor && document.querySelector(".agilo-lib-menu")) {
      closeMenus();
      return;
    }
    closeMenus();
    if (!items || !items.length || !anchor) return;
    var menu = document.createElement("div");
    menu.className = "agilo-lib agilo-lib-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = items.map(function (it) {
      var ico = svgIcon(it.icon || MENU_ICONS[it.act] || "dots", 16);
      return '<button type="button" role="menuitem" data-menu="' + escapeHtml(it.act) + '"' +
        (it.danger ? ' class="is-danger"' : "") + ">" + ico + "<span>" + escapeHtml(it.label) + "</span></button>";
    }).join("");
    document.body.appendChild(menu);
    menuAnchor = anchor;
    if (anchor.setAttribute) anchor.setAttribute("aria-expanded", "true");
    var r = anchor.getBoundingClientRect();
    var mw = menu.offsetWidth || 208;
    var mh = menu.offsetHeight || 160;
    var left = r.right - mw;
    var top = r.bottom + 4;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (left < 8) left = 8;
    if (top + mh > window.innerHeight - 8) top = r.top - mh - 4;
    if (top < 8) top = 8;
    menu.style.position = "fixed";
    menu.style.top = Math.round(top) + "px";
    menu.style.left = Math.round(left) + "px";
    menu.addEventListener("click", function (e) {
      var b = e.target.closest("[data-menu]");
      if (!b) return;
      var act = b.getAttribute("data-menu");
      closeMenus();
      if (typeof onPick === "function") onPick(act);
    });
    var first = menu.querySelector("[role=\"menuitem\"]");
    if (first && first.focus) first.focus();
    onDocClick = function (e) {
      if (e.target.closest && e.target.closest(".agilo-lib-menu")) return;
      if (e.target.closest && e.target.closest("[data-act=\"more\"]")) return;
      closeMenus();
    };
    onDocScroll = function () { closeMenus(); };
    onWinResize = function () { closeMenus(); };
    onDocKey = function (e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeMenus();
    };
    setTimeout(function () {
      if (!menuAnchor) return;
      document.addEventListener("click", onDocClick);
      document.addEventListener("scroll", onDocScroll, true);
      window.addEventListener("resize", onWinResize);
      document.addEventListener("keydown", onDocKey, true);
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
    dlg.className = "agilo-lib agilo-lib-dialog is-open";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.innerHTML =
      '<div class="agilo-lib-dialog__panel">' +
      "<h2>" + escapeHtml(opts.title || "") + "</h2>" +
      (opts.text ? "<p>" + escapeHtml(opts.text) + "</p>" : "") +
      "<label>" + escapeHtml(opts.label || "Nom") +
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
    dlg.className = "agilo-lib agilo-lib-dialog is-open";
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
    formatDate: formatDate,
    resolveIconKey: resolveIconKey,
    previewHtml: previewHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
