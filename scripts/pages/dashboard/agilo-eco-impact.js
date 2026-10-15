/* ================================================================
   AGILOTEXT - Eau du mois sous la jauge minutes
   Cible : .agilo-quotas-flat (tableaux de bord Free, Pro, Business)
   Charge : après agilo-quotas-widget
   API live : https://api.agilotext.com/api/v1 (www, apex, site de test).
   Sonde 2026-10-05 sans jeton : HTTP 400, status KO, username_and_token_required.
   readImpact n'accepte que status OK + litres > 0. La clé live est water_liters.
   numberOfLiters reste en secours s'il est absent. CO2 : co2_grams, puis co2Grams.
   Corps vide, KO ou 0 L : le bloc est retiré, partout.
   ================================================================ */
(function agiloEcoImpact() {
  "use strict";

  var GLASS_CAP_L = 9;
  var PACK_L = 9;
  var GOURDE_L = 0.5;
  var VERRE_L = 0.25;

  function apiBaseForHost() {
    return "https://api.agilotext.com/api/v1";
  }

  function finiteNumber(value) {
    if (value == null || value === "") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function readImpact(json) {
    if (!json || json.status !== "OK") return null;
    var liters = finiteNumber(json.water_liters);
    if (liters == null) liters = finiteNumber(json.numberOfLiters);
    if (liters == null || liters < 0) return null;
    var co2 = finiteNumber(json.co2_grams);
    if (co2 == null) co2 = finiteNumber(json.co2Grams);
    var url = "";
    if (typeof json.attestationUrl === "string" && /^https?:\/\//i.test(json.attestationUrl)) {
      url = json.attestationUrl;
    }
    return {
      liters: liters,
      co2Grams: co2,
      attestationUrl: url
    };
  }

  function resolveDisplayedImpact(json) {
    var impact = readImpact(json);
    if (!impact || !(impact.liters > 0)) return null;
    return {
      liters: impact.liters,
      co2Grams: impact.co2Grams,
      attestationUrl: impact.attestationUrl,
      preview: false
    };
  }

  function equivalenceLabel(liters) {
    var n = Number(liters);
    if (!isFinite(n) || n <= 0 || n > PACK_L) return "";
    if (n >= PACK_L) return "≈ 1 pack (9 L)";
    if (n >= GOURDE_L) {
      var gourdes = Math.max(1, Math.round(n / GOURDE_L));
      return "≈ " + gourdes + (gourdes > 1 ? " gourdes" : " gourde") + " (50 cl)";
    }
    if (n < VERRE_L / 2) return "moins d'un verre (25 cl)";
    var verres = Math.max(1, Math.round(n / VERRE_L));
    return "≈ " + verres + (verres > 1 ? " verres" : " verre") + " (25 cl)";
  }

  function analogySentence(liters) {
    var label = equivalenceLabel(liters);
    if (label.indexOf("≈ ") === 0) return "Ça correspond à environ " + label.slice(2) + ".";
    if (label === "moins d'un verre (25 cl)") return "Ça correspond à moins d'un verre (25 cl).";
    var n = Number(liters);
    if (!label && isFinite(n) && n > 0) {
      var gourdes = Math.max(1, Math.round(n / GOURDE_L));
      return "Ça correspond à environ " + gourdes + (gourdes > 1 ? " gourdes" : " gourde") + " (50 cl).";
    }
    return "";
  }

  function glassLevel(liters) {
    var n = Number(liters);
    if (!isFinite(n) || n <= 0) return 0;
    var pct = Math.min(100, (n / GLASS_CAP_L) * 100);
    return Math.max(8, pct);
  }

  function formatLiters(liters) {
    var n = Number(liters);
    var digits = Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1;
    try {
      return n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch (e) {
      return String(Math.round(n * 10) / 10);
    }
  }

  function currentMonthLabelFr(date) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date || new Date());
    } catch (e) {
      return "mois en cours";
    }
  }

  window.AgiloEcoImpact = {
    apiBaseForHost: apiBaseForHost,
    readImpact: readImpact,
    resolveDisplayedImpact: resolveDisplayedImpact,
    equivalenceLabel: equivalenceLabel,
    analogySentence: analogySentence,
    glassLevel: glassLevel,
    formatLiters: formatLiters,
    currentMonthLabelFr: currentMonthLabelFr
  };

  if (window.AGILO_ECO_SKIP_BOOT) return;
  if (typeof document === "undefined") return;
  if (window.__agiloEcoImpact) return;
  window.__agiloEcoImpact = true;

  function isBusinessPath() {
    return /\/app\/business(\/|$)/i.test(location.pathname || "");
  }

  function normalizeEdition(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "ent" || s === "enterprise" || s === "entreprise" || s === "business" || s === "team" || s === "biz") return "ent";
    if (s.indexOf("pro") === 0) return "pro";
    if (s.indexOf("free") === 0 || s === "gratuit") return "free";
    if (!s) return "pro";
    return s;
  }

  function getEdition() {
    if (isBusinessPath()) return "ent";
    var editorRoot = document.getElementById("editorRoot");
    if (editorRoot && editorRoot.dataset && editorRoot.dataset.edition) return normalizeEdition(editorRoot.dataset.edition);
    var editionBadge = document.getElementById("edition");
    if (editionBadge && editionBadge.textContent) return normalizeEdition(editionBadge.textContent);
    var p = new URLSearchParams(location.search);
    if (p.get("edition")) return normalizeEdition(p.get("edition"));
    try { return normalizeEdition(localStorage.getItem("agilo:edition") || "pro"); } catch (e) { return "pro"; }
  }

  function getEmail() {
    var byName = document.querySelector('[name="memberEmail"]');
    if (byName && byName.value) return byName.value.trim();
    var byId = document.getElementById("memberEmail");
    if (byId && byId.value) return byId.value.trim();
    var byText = document.querySelector('[data-ms-member="email"]');
    if (byText) {
      var txt = (byText.value || byText.getAttribute("src") || byText.textContent || "").trim();
      if (txt) return txt;
    }
    var fromWindow = (window.memberEmail || "").trim();
    if (fromWindow) return fromWindow;
    try { return (localStorage.getItem("agilo:username") || "").trim(); } catch (e) { return ""; }
  }

  function getToken() {
    var fromWindow = "";
    if (typeof window.globalToken === "string") fromWindow = window.globalToken.trim();
    else if (window.globalToken) fromWindow = String(window.globalToken).trim();
    if (fromWindow) return fromWindow;
    try {
      if (typeof globalToken !== "undefined" && globalToken) return String(globalToken).trim();
    } catch (e) {}
    return "";
  }

  var DROP_PATH = "M9 1.75C9 1.75 14.4 7.6 14.4 11.15C14.4 14.15 11.98 16.25 9 16.25C6.02 16.25 3.6 14.15 3.6 11.15C3.6 7.6 9 1.75 9 1.75Z";

  function dropSvg(clipId, levelAttr) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none" aria-hidden="true">'
      + '<defs><clipPath id="' + clipId + '"><path d="' + DROP_PATH + '"/></clipPath></defs>'
      + '<path d="' + DROP_PATH + '" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<g clip-path="url(#' + clipId + ')">'
      + '<rect class="agilo-eco-drop-fill" data-agilo-eco="' + levelAttr + '" x="0" y="18" width="18" height="0"></rect>'
      + '</g></svg>';
  }

  function motionOk() {
    try {
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return true;
    }
  }

  function applyLevel(rect, pct) {
    if (!rect) return;
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    var h = 18 * p / 100;
    rect.setAttribute("data-level", String(p));
    rect.setAttribute("height", String(h));
    rect.setAttribute("y", String(18 - h));
  }

  function revealLevel(rect) {
    if (!rect) return;
    var p = rect.getAttribute("data-level") || "0";
    if (!motionOk()) {
      applyLevel(rect, p);
      return;
    }
    rect.setAttribute("height", "0");
    rect.setAttribute("y", "18");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { applyLevel(rect, p); });
    });
  }

  function injectCss() {
    if (document.getElementById("agilo-eco-impact-css")) return;
    var s = document.createElement("style");
    s.id = "agilo-eco-impact-css";
    s.textContent = [
      ".agilo-eco-btn{display:inline-flex;align-items:center;align-self:flex-start;gap:6px;",
      "width:auto;max-width:100%;margin:8px 0 0;padding:2px 0;border:0;background:transparent;",
      "color:#174a96;cursor:pointer;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial}",
      ".agilo-eco-btn svg{display:block;width:16px;height:16px;flex:0 0 auto}",
      ".agilo-eco-drop-fill{fill:#7dd3fc;transition:fill 160ms ease,height 700ms ease-out,y 700ms ease-out}",
      ".agilo-eco-btn:hover .agilo-eco-drop-fill{fill:#0284c7}",
      ".agilo-eco-btn:focus-visible{outline:2px solid #174a96;outline-offset:2px}",
      ".agilo-eco-modal{position:fixed;inset:0;z-index:9999}",
      ".agilo-eco-modal[hidden]{display:none}",
      ".agilo-eco-modal .aq-modal__panel{width:min(36rem,100%)}",
      ".agilo-eco-hero-drop{width:2.75rem;height:2.75rem;flex:0 0 auto;color:#174a96}",
      ".agilo-eco-hero-drop svg{display:block;width:100%;height:100%}",
      ".agilo-eco-co2{margin:0.45rem 0 0;color:#525252;font-size:0.75rem}",
      ".agilo-eco-attest-wrap{margin-top:0.85rem;padding-top:0.85rem;border-top:1px solid #e4eaf3}",
      ".agilo-eco-attest{color:#174a96;font-weight:600;font-size:0.875rem}",
      ".agilo-eco-attest--soon{margin:0;color:#525252;font-weight:500;font-size:0.8rem;cursor:default}",
      "@media (prefers-reduced-motion:reduce){",
      ".agilo-eco-drop-fill,.agilo-eco-modal .aq-modal__panel{transition:none}",
      "}"
    ].join("");
    document.head.appendChild(s);
  }

  function removeBlock(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  var mounted = null;

  function build(flat) {
    injectCss();
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "agilo-eco-btn";
    btn.setAttribute("data-agilo-eco", "button");
    btn.innerHTML = dropSvg("agilo-eco-drop-chip", "chip-level")
      + '<span data-agilo-eco="liters">…</span>';
    var label = flat.querySelector('[data-aq="minutes-label"]');
    if (label && label.parentNode) label.insertAdjacentElement("afterend", btn);
    else flat.appendChild(btn);

    var modal = document.createElement("div");
    modal.className = "aq-modal agilo-eco-modal";
    modal.hidden = true;
    modal.setAttribute("data-agilo-eco", "modal");
    modal.innerHTML = '<div class="aq-modal__backdrop" data-agilo-eco="backdrop"></div>'
      + '<section class="aq-modal__panel" role="dialog" aria-modal="true" aria-labelledby="agilo-eco-title" aria-describedby="agilo-eco-desc">'
      + '<button type="button" class="aq-modal__close" data-agilo-eco="close" aria-label="Fermer">×</button>'
      + '<header class="aq-modal__header">'
      + '<h3 id="agilo-eco-title">Consommation d\'eau du mois</h3>'
      + '<p id="agilo-eco-desc">Ce compteur correspond au mois calendaire en cours, pas à votre historique total.</p>'
      + '</header>'
      + '<div class="aq-modal__hero">'
      + '<div class="aq-modal__hero-left"><strong data-agilo-eco="modal-liters"></strong>'
      + '<span>pour l\'audio traité ce mois-ci</span></div>'
      + '<div class="agilo-eco-hero-drop" aria-hidden="true">' + dropSvg("agilo-eco-drop-modal", "level") + '</div>'
      + '</div>'
      + '<div class="aq-modal__analogy-box" data-agilo-eco="analogy" hidden>'
      + '<p class="aq-modal__analogy-title" aria-hidden="true">Saviez-vous que ?</p>'
      + '<p class="aq-modal__fact-line" data-agilo-eco="modal-eq"></p>'
      + '</div>'
      + '<div class="aq-modal__month" data-agilo-eco="month"></div>'
      + '<p class="agilo-eco-co2" data-agilo-eco="co2" hidden></p>'
      + '<div class="agilo-eco-attest-wrap" data-agilo-eco="attest-wrap"></div>'
      + '</section>';
    document.body.appendChild(modal);

    function minutesModalOpen() {
      var other = document.querySelector("[data-aq" + '="modal"]');
      return !!(other && !other.hidden);
    }
    function close() {
      modal.hidden = true;
      if (!minutesModalOpen()) document.body.classList.remove("aq-modal-open");
      if (btn && typeof btn.focus === "function") btn.focus();
    }
    function openModal() {
      if (!mounted || !mounted.impact) return;
      var wasHidden = modal.hidden;
      modal.hidden = false;
      document.body.classList.add("aq-modal-open");
      if (wasHidden) revealLevel(modal.querySelector('[data-agilo-eco="level"]'));
      var closeBtn = modal.querySelector('[data-agilo-eco="close"]');
      if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal();
    });
    btn.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        openModal();
      }
    });
    modal.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target === modal || (e.target && e.target.getAttribute && e.target.getAttribute("data-agilo-eco") === "backdrop")) close();
    });
    modal.querySelector('[data-agilo-eco="close"]').addEventListener("click", function (e) {
      e.stopPropagation();
      close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) {
        e.stopPropagation();
        close();
      }
    });
    return { btn: btn, modal: modal, flat: flat, impact: null };
  }

  function paint(impact) {
    if (!mounted) return;
    var formatted = formatLiters(impact.liters);
    var sentence = analogySentence(impact.liters);
    var month = currentMonthLabelFr(new Date());
    var pct = glassLevel(impact.liters);
    mounted.btn.querySelector('[data-agilo-eco="liters"]').textContent = formatted + " L";
    mounted.btn.setAttribute("aria-label", "Empreinte eau du mois, " + formatted + " litres");
    applyLevel(mounted.btn.querySelector('[data-agilo-eco="chip-level"]'), pct);
    mounted.modal.querySelector('[data-agilo-eco="month"]').textContent = "Période : mois calendaire en cours (" + month + ").";
    mounted.modal.querySelector('[data-agilo-eco="modal-liters"]').textContent = formatted + " L";
    applyLevel(mounted.modal.querySelector('[data-agilo-eco="level"]'), pct);
    var box = mounted.modal.querySelector('[data-agilo-eco="analogy"]');
    var modalEq = mounted.modal.querySelector('[data-agilo-eco="modal-eq"]');
    box.hidden = !sentence;
    modalEq.textContent = sentence;
    var co2 = mounted.modal.querySelector('[data-agilo-eco="co2"]');
    if (impact.co2Grams != null && impact.co2Grams > 0) {
      co2.hidden = false;
      co2.textContent = formatLiters(impact.co2Grams) + " g CO₂";
    } else {
      co2.hidden = true;
      co2.textContent = "";
    }
    var wrap = mounted.modal.querySelector('[data-agilo-eco="attest-wrap"]');
    wrap.textContent = "";
    if (impact.attestationUrl) {
      var link = document.createElement("a");
      link.className = "agilo-eco-attest";
      link.href = impact.attestationUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Télécharger l'attestation";
      wrap.appendChild(link);
    } else {
      var soon = document.createElement("p");
      soon.className = "agilo-eco-attest agilo-eco-attest--soon";
      soon.textContent = "L'attestation arrive.";
      wrap.appendChild(soon);
    }
    mounted.impact = impact;
  }

  var credTries = 0;

  function load() {
    if (!mounted) return;
    var email = getEmail();
    var token = getToken();
    if (!email || !token) {
      credTries += 1;
      if (credTries > 40) {
        removeBlock(mounted.btn);
        removeBlock(mounted.modal);
        mounted = null;
        return;
      }
      window.setTimeout(load, 250);
      return;
    }
    var qs = "username=" + encodeURIComponent(email)
      + "&token=" + encodeURIComponent(token)
      + "&edition=" + encodeURIComponent(getEdition());
    var url = apiBaseForHost(location.hostname) + "/getEnvironmentalImpactForMonth?" + qs;
    function applyFetched(json) {
      if (!mounted) return;
      var impact = resolveDisplayedImpact(json, location.hostname);
      if (!impact) {
        removeBlock(mounted.btn);
        removeBlock(mounted.modal);
        mounted = null;
        return;
      }
      paint(impact);
    }
    fetch(url, { method: "GET", credentials: "omit" })
      .then(function (res) { return res.json().catch(function () { return null; }); })
      .then(applyFetched)
      .catch(function () { applyFetched(null); });
  }

  function tryMount() {
    var flat = document.querySelector(".agilo-quotas-flat");
    if (!flat) return false;
    if (mounted && mounted.btn && mounted.btn.isConnected) return true;
    mounted = build(flat);
    load();
    return true;
  }

  function boot() {
    if (tryMount()) return;
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (tryMount() || tries > 40) window.clearInterval(timer);
    }, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
