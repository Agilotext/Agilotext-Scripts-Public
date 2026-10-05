/* ================================================================
   AGILOTEXT - Eau du mois sous la jauge minutes
   Cible : .agilo-quotas-flat (tableaux de bord Free, Pro, Business)
   Charge : après agilo-quotas-widget
   API live : https://api.agilotext.com/api/v1 (www, apex, site de test).
   Sonde 2026-10-05 sans jeton : HTTP 400, status KO, username_and_token_required.
   readImpact n'accepte que status OK + numberOfLiters > 0 (même forme que
   numberOfMinutes). Corps vide, KO ou 0 L : le bloc est retiré, partout.
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
    var liters = finiteNumber(json.numberOfLiters);
    if (liters == null || liters < 0) return null;
    var co2 = finiteNumber(json.co2Grams);
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
      ".agilo-eco-modal{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;",
      "padding:16px;background:rgba(15,23,42,.45)}",
      ".agilo-eco-modal[hidden]{display:none}",
      ".agilo-eco-card{position:relative;width:min(22rem,100%);background:#fff;border-radius:16px;",
      "padding:20px;text-align:left;box-shadow:0 18px 50px rgba(15,23,42,.16);color:#0f172a;",
      "animation:agilo-eco-in 180ms ease}",
      "@keyframes agilo-eco-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
      ".agilo-eco-close{position:absolute;top:12px;right:12px;width:2rem;height:2rem;border:0;border-radius:999px;",
      "background:#f1f5f9;color:#334155;cursor:pointer;font:700 14px/1 system-ui,sans-serif}",
      ".agilo-eco-close:focus-visible{outline:2px solid #174a96;outline-offset:2px}",
      ".agilo-eco-month{margin:0;padding-right:2rem;color:#64748b;font:500 12px/1.3 system-ui,sans-serif}",
      ".agilo-eco-hero{display:flex;align-items:center;gap:16px;margin-top:14px}",
      ".agilo-eco-hero svg{display:block;width:72px;height:72px;flex:0 0 auto;color:#174a96}",
      ".agilo-eco-figure{margin:0;font:800 32px/1 system-ui,sans-serif;color:#174a96}",
      ".agilo-eco-figure span[data-agilo-eco='unit']{font:700 14px/1.2 system-ui,sans-serif;color:#64748b}",
      ".agilo-eco-for{margin:4px 0 0;color:#334155;font:500 13px/1.3 system-ui,sans-serif}",
      ".agilo-eco-eq{margin:12px 0 0;color:#334155;font:600 13px/1.35 system-ui,sans-serif}",
      ".agilo-eco-scope,.agilo-eco-co2{margin:8px 0 0;color:#64748b;font:500 12px/1.35 system-ui,sans-serif}",
      ".agilo-eco-attest{display:inline-block;margin-top:14px;color:#174a96;font:600 12px/1.3 system-ui,sans-serif}",
      "@media (prefers-reduced-motion:reduce){",
      ".agilo-eco-drop-fill,.agilo-eco-modal{transition:none}",
      ".agilo-eco-card{animation:none}",
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
    modal.className = "agilo-eco-modal";
    modal.hidden = true;
    modal.setAttribute("data-agilo-eco", "modal");
    modal.innerHTML = '<div class="agilo-eco-card" role="dialog" aria-modal="true" aria-labelledby="agilo-eco-title">'
      + '<button type="button" class="agilo-eco-close" data-agilo-eco="close" aria-label="Fermer">×</button>'
      + '<p class="agilo-eco-month" data-agilo-eco="month"></p>'
      + '<div class="agilo-eco-hero">'
      + dropSvg("agilo-eco-drop-modal", "level")
      + '<div><p class="agilo-eco-figure" id="agilo-eco-title"><span data-agilo-eco="modal-liters"></span> <span data-agilo-eco="unit">L</span></p>'
      + '<p class="agilo-eco-for">pour vos transcriptions</p></div>'
      + '</div>'
      + '<p class="agilo-eco-eq" data-agilo-eco="modal-eq" hidden></p>'
      + '<p class="agilo-eco-scope">Mois calendaire en cours, comme vos minutes.</p>'
      + '<p class="agilo-eco-co2" data-agilo-eco="co2" hidden></p>'
      + '<a class="agilo-eco-attest" data-agilo-eco="attest" hidden target="_blank" rel="noopener">Télécharger l\'attestation</a>'
      + '</div>';
    document.body.appendChild(modal);

    function close() {
      modal.hidden = true;
      if (btn && typeof btn.focus === "function") btn.focus();
    }
    function openModal() {
      if (!mounted || !mounted.impact) return;
      var wasHidden = modal.hidden;
      modal.hidden = false;
      if (wasHidden) revealLevel(modal.querySelector('[data-agilo-eco="level"]'));
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
      if (e.target === modal) close();
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
    var eq = equivalenceLabel(impact.liters);
    var month = currentMonthLabelFr(new Date());
    var pct = glassLevel(impact.liters);
    mounted.btn.querySelector('[data-agilo-eco="liters"]').textContent = formatted + " L";
    mounted.btn.setAttribute("aria-label", "Empreinte eau du mois, " + formatted + " litres");
    applyLevel(mounted.btn.querySelector('[data-agilo-eco="chip-level"]'), pct);
    mounted.modal.querySelector('[data-agilo-eco="month"]').textContent = month;
    mounted.modal.querySelector('[data-agilo-eco="modal-liters"]').textContent = formatted;
    applyLevel(mounted.modal.querySelector('[data-agilo-eco="level"]'), pct);
    var modalEq = mounted.modal.querySelector('[data-agilo-eco="modal-eq"]');
    modalEq.hidden = !eq;
    modalEq.textContent = eq;
    var co2 = mounted.modal.querySelector('[data-agilo-eco="co2"]');
    if (impact.co2Grams != null) {
      co2.hidden = false;
      co2.textContent = formatLiters(impact.co2Grams) + " g CO₂";
    } else {
      co2.hidden = true;
    }
    var attest = mounted.modal.querySelector('[data-agilo-eco="attest"]');
    if (impact.attestationUrl) {
      attest.hidden = false;
      attest.href = impact.attestationUrl;
    } else {
      attest.hidden = true;
      attest.removeAttribute("href");
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
