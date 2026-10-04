/* ================================================================
   AGILOTEXT - Eau du mois sous la jauge minutes
   Cible : .agilo-quotas-flat (tableaux de bord Free, Pro, Business)
   Charge : après agilo-quotas-widget
   Sonde 2026-10-04 (apitest, Origin agilotext-test.webflow.io) :
   - CORS Access-Control-Allow-Origin: *
   - GET sans auth : { status, errorMessage } "username_and_token_required"
   - GET jeton invalide : { status:"KO", errorMessage:"invalid_token" }
   Succès non observé (getToken interdit hors navigateur, jeton prod refusé).
   readImpact n'accepte que status OK + numberOfLiters (même forme que
   numberOfMinutes). Autre forme : le bloc est retiré, aucun chiffre d'exemple.
   ================================================================ */
(function agiloEcoImpact() {
  "use strict";

  var GLASS_CAP_L = 9;
  var PACK_L = 9;
  var GOURDE_L = 0.5;
  var VERRE_L = 0.25;

  function apiBaseForHost(hostname) {
    if (hostname === "agilotext-test.webflow.io") return "https://apitest.agilotext.com/api/v1";
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

  function injectCss() {
    if (document.getElementById("agilo-eco-impact-css")) return;
    var s = document.createElement("style");
    s.id = "agilo-eco-impact-css";
    s.textContent = [
      ".agilo-eco-btn{display:block;width:100%;margin:10px 0 0;padding:8px 10px;text-align:left;",
      "border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;color:#1e3a8a;cursor:pointer;",
      "font:600 12px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial}",
      ".agilo-eco-btn:hover{background:#dbeafe}",
      ".agilo-eco-btn__row{display:flex;align-items:center;justify-content:space-between;gap:8px}",
      ".agilo-eco-btn__eq{display:block;margin-top:4px;font-weight:500;color:#1d4ed8}",
      ".agilo-eco-chip{font:700 9px/1 system-ui,sans-serif;letter-spacing:.04em;color:#1d4ed8;",
      "background:#dbeafe;border-radius:999px;padding:3px 6px}",
      ".agilo-eco-modal{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;",
      "padding:16px;background:rgba(15,23,42,.55)}",
      ".agilo-eco-modal[hidden]{display:none}",
      ".agilo-eco-card{position:relative;width:min(28rem,100%);background:#fff;border-radius:24px;",
      "padding:24px 20px 20px;box-shadow:0 18px 50px rgba(15,23,42,.2);text-align:center}",
      ".agilo-eco-close{position:absolute;top:12px;right:12px;width:2rem;height:2rem;border:0;border-radius:999px;",
      "background:#f1f5f9;color:#334155;cursor:pointer;font:700 14px/1 system-ui,sans-serif}",
      ".agilo-eco-kicker{display:inline-block;margin:0 0 8px;padding:4px 10px;border-radius:999px;",
      "background:#dbeafe;color:#1d4ed8;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}",
      ".agilo-eco-card h2{margin:0;font:800 20px/1.25 system-ui,sans-serif;color:#0f172a}",
      ".agilo-eco-month{margin:6px 0 0;color:#64748b;font:500 12px/1.3 system-ui,sans-serif}",
      ".agilo-eco-glass{position:relative;width:9rem;height:12rem;margin:18px auto 0;overflow:hidden;",
      "border:4px solid #cbd5e1;border-radius:0 0 1.6rem 1.6rem;background:linear-gradient(#fff,#f0f9ff)}",
      ".agilo-eco-liquid{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#38bdf8,#0284c7)}",
      ".agilo-eco-liters{margin:14px 0 0;font:800 28px/1.1 system-ui,sans-serif;color:#0f172a}",
      ".agilo-eco-liters span{font:700 14px/1.2 system-ui,sans-serif;color:#64748b}",
      ".agilo-eco-eq{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;",
      "background:#eff6ff;border:1px solid #dbeafe;color:#1d4ed8;font:600 12px/1.3 system-ui,sans-serif}",
      ".agilo-eco-co2{margin:10px 0 0;color:#475569;font:500 12px/1.3 system-ui,sans-serif}",
      ".agilo-eco-attest{display:inline-block;margin-top:14px;color:#1d4ed8;font:600 12px/1.3 system-ui,sans-serif}",
      "@media (prefers-reduced-motion:reduce){.agilo-eco-liquid{transition:none}}"
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
    btn.innerHTML = '<span class="agilo-eco-btn__row"><span data-agilo-eco="liters">…</span><span class="agilo-eco-chip">RSE</span></span>'
      + '<span class="agilo-eco-btn__eq" data-agilo-eco="eq"></span>';
    var label = flat.querySelector('[data-aq="minutes-label"]');
    if (label && label.parentNode) label.insertAdjacentElement("afterend", btn);
    else flat.appendChild(btn);

    var modal = document.createElement("div");
    modal.className = "agilo-eco-modal";
    modal.hidden = true;
    modal.setAttribute("data-agilo-eco", "modal");
    modal.innerHTML = '<div class="agilo-eco-card" role="dialog" aria-modal="true" aria-labelledby="agilo-eco-title">'
      + '<button type="button" class="agilo-eco-close" data-agilo-eco="close" aria-label="Fermer">×</button>'
      + '<p class="agilo-eco-kicker">Eau du mois</p>'
      + '<h2 id="agilo-eco-title">Votre verre d\'eau Agilotext</h2>'
      + '<p class="agilo-eco-month" data-agilo-eco="month"></p>'
      + '<div class="agilo-eco-glass" aria-hidden="true"><div class="agilo-eco-liquid" data-agilo-eco="level"></div></div>'
      + '<p class="agilo-eco-liters"><span data-agilo-eco="modal-liters"></span> <span>L d\'eau</span></p>'
      + '<p class="agilo-eco-eq" data-agilo-eco="modal-eq" hidden></p>'
      + '<p class="agilo-eco-co2" data-agilo-eco="co2" hidden></p>'
      + '<a class="agilo-eco-attest" data-agilo-eco="attest" hidden target="_blank" rel="noopener">Télécharger l\'attestation</a>'
      + '</div>';
    document.body.appendChild(modal);

    function close() { modal.hidden = true; }
    btn.addEventListener("click", function () {
      if (!mounted || !mounted.impact) return;
      modal.hidden = false;
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    modal.querySelector('[data-agilo-eco="close"]').addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });
    return { btn: btn, modal: modal, flat: flat, impact: null };
  }

  function paint(impact) {
    if (!mounted) return;
    var litersText = formatLiters(impact.liters) + " L d'eau";
    var eq = equivalenceLabel(impact.liters);
    var month = currentMonthLabelFr(new Date());
    mounted.btn.querySelector('[data-agilo-eco="liters"]').textContent = litersText;
    var eqEl = mounted.btn.querySelector('[data-agilo-eco="eq"]');
    eqEl.textContent = eq;
    mounted.modal.querySelector('[data-agilo-eco="month"]').textContent = month;
    mounted.modal.querySelector('[data-agilo-eco="modal-liters"]').textContent = formatLiters(impact.liters);
    var level = mounted.modal.querySelector('[data-agilo-eco="level"]');
    level.style.height = glassLevel(impact.liters) + "%";
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
    fetch(url, { method: "GET", credentials: "omit" })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        var impact = readImpact(json);
        if (!impact || !mounted) {
          removeBlock(mounted && mounted.btn);
          removeBlock(mounted && mounted.modal);
          mounted = null;
          return;
        }
        paint(impact);
      })
      .catch(function () {
        removeBlock(mounted && mounted.btn);
        removeBlock(mounted && mounted.modal);
        mounted = null;
      });
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
