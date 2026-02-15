(function agiloQuotaWidget() {
  "use strict";

  if (window.__agiloQuotaWidgetMountedV16) return;
  window.__agiloQuotaWidgetMountedV16 = true;

  var API_BASE = "https://api.agilotext.com/api/v1";
  var REFRESH_MS = 120000;
  var FETCH_TIMEOUT_MS = 12000;
  var CREDENTIALS_TIMEOUT_MS = 30000;
  var POLL_CREDENTIALS_MS = 120;
  var ARC_LENGTH = 126;
  var PCT_WARNING = 70;
  var PCT_DANGER = 90;
  var BUSINESS_FALLBACK_LIMIT = 4080;
  var ANALOGY_MIN_H = 0.5;
  var ANALOGY_MAX_H = 64;
  var SUPPORT_EMAIL = "support@agilotext.com";

  var ANALOGIES_DB = [
    { h: 0.5, analogies: ["En 30 min, le sang humain effectue environ 30 circuits complets du corps (circulation systémique ~ 1 min).", "Durée typique d'une séance de radiothérapie fractionnée (environ 15 à 30 min par fraction)."] },
    { h: 1, analogies: ["En 1 h, la lumière parcourt environ 1,08 milliard de km (c x 3600 s).", "En 1 h, un cœur à 70 battements/min bat environ 4 200 fois."] },
    { h: 1.5, analogies: ["Durée d'une orbite complète de l'ISS autour de la Terre (environ 90 min).", "Temps moyen d'un cycle complet de sommeil (NREM + REM) chez l'adulte (90 à 120 min)."] },
    { h: 2, analogies: ["Temps moyen pour que la caféine atteigne son pic de concentration dans le sang (1 à 2 h).", "Durée typique d'un cycle complet sommeil lent + paradoxal (REM), environ 90 à 120 min."] },
    { h: 2.5, analogies: ["En 2,5 h, un signal radio fait environ 12 fois le trajet Terre-Mars (distance moyenne).", "Durée typique d'une opération à cœur ouvert (souvent 2 à 4 h)."] },
    { h: 3, analogies: ["En 3 h, la Terre parcourt environ 324 000 km sur son orbite autour du Soleil.", "Temps typique d'un trajet Paris-Marseille en TGV (environ 3 h 05)."] },
    { h: 4, analogies: ["Durée typique d'une séance d'hémodialyse (souvent 3 à 5 h).", "Temps de transit moyen des aliments jusqu'au début du gros intestin (ordre de 2 à 6 h)."] },
    { h: 5, analogies: ["Temps de demi-vie moyen de la caféine dans le sang (environ 5 à 6 h).", "Temps que met la lumière pour aller du Soleil à Pluton à distance moyenne (environ 5,5 h)."] },
    { h: 6, analogies: ["Temps entre deux marées hautes (ou basses) sur une côte atlantique française (~6 h 12).", "Durée typique d'une transplantation hépatique (souvent 4 à 8 h)."] },
    { h: 7, analogies: ["En 7 h, un TGV à 320 km/h parcourt 2 240 km.", "Durée de sommeil moyenne recommandée pour un adulte (7 à 9 h)."] },
    { h: 8, analogies: ["En 8 h, un point à l'équateur parcourt environ 13 350 km (un tiers de tour de la Terre).", "Fenêtre de sommeil recommandée pour un adulte (7 à 9 h, centre à 8 h)."] },
    { h: 10, analogies: ["Durée d'une journée sur Jupiter (environ 9 h 56).", "En 10 h, la Lune parcourt environ 1/65e de son orbite autour de la Terre."] },
    { h: 12, analogies: ["Temps pour que la Terre pivote de 180 degrés (demi-rotation solaire).", "Demi-période du cycle des marées (environ 12 h 25 entre deux marées hautes)."] },
    { h: 15, analogies: ["Temps de première levée typique d'un pain au levain (souvent 12 à 24 h).", "En 15 h, un cargo à 20 nœuds parcourt environ 556 km."] },
    { h: 18, analogies: ["Temps d'un aller-retour radio Terre-Neptune à distance moyenne (ordre de grandeur).", "Temps de doublement de certaines lignées cellulaires en culture (18 à 24 h)."] },
    { h: 20, analogies: ["Temps actuel (ordre de grandeur) pour qu'un signal atteigne Voyager 1.", "En 20 h, la Terre parcourt environ 2,16 millions de km sur son orbite."] },
    { h: 24, analogies: ["Rotation complète de la Terre (jour solaire moyen = 24 h).", "Durée de vie moyenne d'un neutrophile dans le sang (ordre de 1 à 2 jours)."] },
    { h: 36, analogies: ["Durée d'une garde longue type en médecine hospitalière (24 à 36 h dans certains pays).", "En 36 h, un coureur ultra à 10 km/h parcourt 360 km."] },
    { h: 48, analogies: ["Temps de transit intestinal complet typique (souvent 24 à 72 h).", "Environ deux cycles complets de marée (2 x 24 h 50)."] },
    { h: 60, analogies: ["En 60 h, la Lune se déplace d'environ 9 % sur son orbite autour de la Terre.", "Temps de fermentation complète d'un levain au réfrigérateur (souvent 48 à 72 h)."] },
    { h: 64, analogies: ["En 64 h, la Terre parcourt environ 6,9 millions de km sur son orbite (vitesse orbitale ~30 km/s).", "64 h correspond à environ 85-88 % du temps de vol Apollo 11 avant l'insertion en orbite lunaire (~73-76 h)."] }
  ];

  var WOW_LOW_USAGE = [
    "Vous démarrez fort : de la marge pour tout donner.",
    "Chaque minute compte : vous êtes dans les starting-blocks.",
    "Belle réserve : l'équivalent de plusieurs heures d'audio devant vous."
  ];

  var tokenRequestInFlight = null;
  var refreshTimer = null;
  var refreshInFlight = false;
  var refreshQueued = false;

  var root = document.querySelector("[data-agilo-quotas]");
  if (!root) return;

  var els = {
    gauge: root.querySelector('[data-aq="gauge-fill"]'),
    pct: root.querySelector('[data-aq="pct"]'),
    minutesUsed: root.querySelector('[data-aq="minutes-used"]'),
    minutesLabel: root.querySelector('[data-aq="minutes-label"]'),
    uploads: root.querySelector('[data-aq="uploads"]'),
    modal: document.querySelector('[data-aq="modal"]'),
    modalBackdrop: document.querySelector('[data-aq="modal-backdrop"]'),
    modalClose: document.querySelector('[data-aq="modal-close"]'),
    modalPanel: document.querySelector('[data-aq="modal-panel"]'),
    modalHeroMain: document.querySelector('[data-aq="modal-hero-main"]'),
    modalHeroSub: document.querySelector('[data-aq="modal-hero-sub"]'),
    modalPercent: document.querySelector('[data-aq="modal-percent"]'),
    modalMonth: document.querySelector('[data-aq="modal-month"]'),
    modalGaugeMinutes: document.querySelector('[data-aq="modal-gauge-minutes"]'),
    modalGaugeHours: document.querySelector('[data-aq="modal-gauge-hours"]'),
    modalGaugeSeconds: document.querySelector('[data-aq="modal-gauge-seconds"]'),
    modalValueMinutes: document.querySelector('[data-aq="modal-value-minutes"]'),
    modalValueHours: document.querySelector('[data-aq="modal-value-hours"]'),
    modalValueSeconds: document.querySelector('[data-aq="modal-value-seconds"]'),
    modalFact: document.querySelector('[data-aq="modal-fact"]'),
    modalActionsFree: document.querySelector('[data-aq="modal-actions-free"]'),
    modalActionsPro: document.querySelector('[data-aq="modal-actions-pro"]'),
    modalActionsEnt: document.querySelector('[data-aq="modal-actions-ent"]'),
    modalActionsEntLink: document.querySelector('[data-aq="modal-actions-ent-link"]')
  };

  var state = {
    usedMinutes: 0,
    monthlyLimit: 0,
    percent: 0,
    zone: "ok",
    isBusiness: false,
    edition: "pro",
    loadError: false,
    loading: true
  };

  var ERROR_MSG = "Impossible de charger les quotas. Vérifiez votre connexion ou réessayez plus tard.";
  var LOADING_LABEL = "Chargement…";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function formatFr(value, maxDecimals) {
    return Number(value).toLocaleString("fr-FR", {
      maximumFractionDigits: typeof maxDecimals === "number" ? maxDecimals : 0
    });
  }

  function formatPercentWithOverflow(percent) {
    var rounded = Math.round(percent);
    if (percent <= 100) return rounded + "%";
    return rounded + "% (+" + Math.round(percent - 100) + "%)";
  }

  function currentMonthLabelFr() {
    try {
      return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());
    } catch (e) {
      return "mois en cours";
    }
  }

  function pickStable(list, seed) {
    return list[Math.abs(seed) % list.length];
  }

  function normalizeEdition(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "ent" || s === "enterprise" || s === "entreprise" || s === "business" || s === "team" || s === "biz") return "ent";
    if (s.indexOf("pro") === 0) return "pro";
    if (s.indexOf("free") === 0 || s === "gratuit") return "free";
    if (!s) return "pro";
    return s;
  }

  function isBusinessPath() {
    return /\/app\/business(\/|$)/i.test(location.pathname || "");
  }

  function getEdition() {
    if (isBusinessPath()) return "ent";
    var editorRoot = document.getElementById("editorRoot");
    if (editorRoot && editorRoot.dataset && editorRoot.dataset.edition) return normalizeEdition(editorRoot.dataset.edition);
    var editionBadge = document.getElementById("edition");
    if (editionBadge && editionBadge.textContent) return normalizeEdition(editionBadge.textContent);
    var p = new URLSearchParams(location.search);
    if (p.get("edition")) return normalizeEdition(p.get("edition"));
    return normalizeEdition(localStorage.getItem("agilo:edition") || "pro");
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
    return (localStorage.getItem("agilo:username") || "").trim();
  }

  function getLegacyToken() {
    try {
      if (typeof globalToken !== "undefined" && globalToken) return String(globalToken).trim();
    } catch (e) {}
    return "";
  }

  function getToken() {
    var fromWindow = "";
    if (typeof window.globalToken === "string") fromWindow = window.globalToken.trim();
    else if (window.globalToken) fromWindow = String(window.globalToken).trim();
    return fromWindow || getLegacyToken() || "";
  }

  function setTokenEverywhere(token) {
    if (!token) return;
    window.globalToken = token;
    try { globalToken = token; } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("agilo:token", { detail: { token: token } })); } catch (e) {}
  }

  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function setArc(pathEl, percent) {
    if (!pathEl) return;
    var pct = clamp(percent, 0, 100);
    pathEl.style.strokeDasharray = String(ARC_LENGTH);
    pathEl.style.strokeDashoffset = String(ARC_LENGTH - (ARC_LENGTH * pct / 100));
  }

  function zoneFromPercent(percent) {
    var p = Math.max(0, percent);
    if (p >= PCT_DANGER) return "danger";
    if (p >= PCT_WARNING) return "warning";
    return "ok";
  }

  function applyZone(zone) {
    root.setAttribute("data-aq-zone", zone);
    if (els.modal) els.modal.setAttribute("data-aq-zone", zone);
  }

  function applyErrorState(isError) {
    if (isError) root.setAttribute("data-aq-error", "true");
    else root.removeAttribute("data-aq-error");
  }

  function setGaugePercent(percent) {
    var visualPct = clamp(percent, 0, 100);
    setArc(els.gauge, visualPct);
    if (els.pct) els.pct.textContent = Math.round(percent) + "%";
    var zone = zoneFromPercent(percent);
    applyZone(zone);
    return zone;
  }

  function findBestAnalogyEntry(usedHours) {
    var h = clamp(usedHours || 0, ANALOGY_MIN_H, ANALOGY_MAX_H);
    var best = null;
    var bestWithin20 = null;
    for (var i = 0; i < ANALOGIES_DB.length; i++) {
      var e = ANALOGIES_DB[i];
      var rel = Math.abs(h - e.h) / Math.max(h, e.h);
      if (!best || rel < best.rel) best = { entry: e, rel: rel, hours: h };
      if (rel <= 0.2 && (!bestWithin20 || rel < bestWithin20.rel)) bestWithin20 = { entry: e, rel: rel, hours: h };
    }
    return bestWithin20 || best;
  }

  function buildAnalogiesLine(usedHours, seed) {
    var chosen = findBestAnalogyEntry(usedHours);
    if (!chosen || !chosen.entry || !chosen.entry.analogies || !chosen.entry.analogies.length) {
      return "";
    }
    var arr = chosen.entry.analogies;
    var i1 = Math.abs(seed) % arr.length;
    var i2 = arr.length > 1 ? (i1 + 1) % arr.length : i1;
    var capNote = (usedHours > ANALOGY_MAX_H) ? " (max 64 h)" : "";
    return arr[i1] + " " + arr[i2] + capNote;
  }

  function statusLine(percent, seed) {
    if (percent >= 100) return pickStable(["Limite atteinte.", "Quota dépassé."], seed + 1);
    if (percent >= PCT_DANGER) return pickStable(["Fin de quota proche.", "Dernière ligne droite."], seed + 2);
    if (percent >= PCT_WARNING) return pickStable(["Rythme soutenu.", "La limite se rapproche."], seed + 3);
    if (percent < 15 && percent >= 0) return pickStable(WOW_LOW_USAGE, seed + 5);
    return pickStable(["Marge confortable.", "Réserve correcte."], seed + 4);
  }

  function outroLine(percent, remainingHours, isBusiness) {
    if (percent >= 100) return isBusiness ? "Volume assume." : "Passer en Pro ou Business.";
    if (percent >= PCT_DANGER) return "Environ " + formatFr(remainingHours, 1) + " h restantes.";
    return "Environ " + formatFr(remainingHours, 1) + " h restantes.";
  }

  function buildPlayfulFact(usedMinutes, monthlyLimit, percent, isBusiness) {
    if (!monthlyLimit || monthlyLimit <= 0) return "Compteur mensuel actif. La limite n'est pas encore disponible pour ce compte.";
    var usedHours = usedMinutes / 60;
    var remainingHours = Math.max(0, monthlyLimit - usedMinutes) / 60;
    var seed = Math.floor(usedMinutes) + (new Date().getDate() * 29);
    var s = statusLine(percent, seed);
    var a = buildAnalogiesLine(usedHours, seed);
    var o = outroLine(percent, remainingHours, isBusiness);
    return s + " " + a + " " + o;
  }

  function updateModalFactElements(usedMinutes, monthlyLimit, percent, isBusiness) {
    var wrapper = document.querySelector('[data-aq="modal-fact-wrapper"]');
    if (!wrapper) {
      if (els.modalFact) els.modalFact.textContent = state.loadError ? ERROR_MSG : buildPlayfulFact(usedMinutes, monthlyLimit, percent, state.isBusiness);
      return;
    }
    var statusEl = wrapper.querySelector('[data-aq="modal-fact-status"]');
    var analogyEl = wrapper.querySelector('[data-aq="modal-fact-analogy"]');
    var outroEl = wrapper.querySelector('[data-aq="modal-fact-outro"]');
    if (state.loadError) {
      if (statusEl) statusEl.textContent = ERROR_MSG;
      if (analogyEl) analogyEl.textContent = "";
      if (outroEl) outroEl.textContent = "";
      return;
    }
    var usedHours = usedMinutes / 60;
    var remainingHours = Math.max(0, monthlyLimit - usedMinutes) / 60;
    var seed = Math.floor(usedMinutes) + (new Date().getDate() * 29);
    if (statusEl) statusEl.textContent = statusLine(percent, seed);
    if (analogyEl) analogyEl.textContent = buildAnalogiesLine(usedHours, seed);
    if (outroEl) outroEl.textContent = outroLine(percent, remainingHours, isBusiness);
  }

  function updateModalActionsVisibility() {
    var edition = state.edition;
    var percent = state.percent;
    var showFree = edition === "free";
    var showPro = edition === "pro";
    var showEnt = edition === "ent" && percent >= 100;

    if (els.modalActionsFree) els.modalActionsFree.style.display = showFree ? "" : "none";
    if (els.modalActionsPro) els.modalActionsPro.style.display = showPro ? "" : "none";
    if (els.modalActionsEnt) els.modalActionsEnt.style.display = showEnt ? "" : "none";
    if (els.modalActionsEntLink) els.modalActionsEntLink.href = "mailto:" + SUPPORT_EMAIL;
  }

  function updateModalMetrics(usedMinutes, monthlyLimit, percent, zone, isBusiness, edition) {
    if (!els.modal) return;
    var hasLimit = monthlyLimit > 0;
    var safeLimit = hasLimit ? monthlyLimit : 1;
    var pct = typeof percent === "number" ? percent : (usedMinutes / safeLimit) * 100;
    var visualPct = clamp(pct, 0, 100);
    var z = zone || zoneFromPercent(pct);
    state.usedMinutes = usedMinutes;
    state.monthlyLimit = monthlyLimit;
    state.percent = pct;
    state.zone = z;
    if (typeof isBusiness === "boolean") state.isBusiness = isBusiness;
    if (typeof edition === "string" && edition) state.edition = edition;
    applyZone(z);
    if (state.loading) { root.setAttribute("data-aq-loading", "true"); if (els.modal) els.modal.setAttribute("data-aq-loading", "true"); }
    else { root.removeAttribute("data-aq-loading"); if (els.modal) els.modal.removeAttribute("data-aq-loading"); }
    updateModalActionsVisibility();

    if (els.modalHeroMain) els.modalHeroMain.textContent = state.loading ? LOADING_LABEL : (formatFr(usedMinutes, 0) + " min");
    if (els.modalHeroSub) els.modalHeroSub.textContent = hasLimit ? "sur " + formatFr(monthlyLimit, 0) + " min/mois" : "sur - min/mois";
    if (els.modalPercent) els.modalPercent.textContent = state.loadError ? "—" : formatPercentWithOverflow(pct);
    if (els.modalMonth) els.modalMonth.textContent = "Periode: mois calendaire en cours (" + currentMonthLabelFr() + ").";

    if (hasLimit && !state.loadError) {
      var usedHours = usedMinutes / 60;
      var limitHours = monthlyLimit / 60;
      var usedSeconds = usedMinutes * 60;
      var limitSeconds = monthlyLimit * 60;
      if (els.modalValueMinutes) els.modalValueMinutes.textContent = formatFr(usedMinutes, 0) + " / " + formatFr(monthlyLimit, 0) + " min";
      if (els.modalValueHours) els.modalValueHours.textContent = formatFr(usedHours, 1) + " / " + formatFr(limitHours, 1) + " h";
      if (els.modalValueSeconds) els.modalValueSeconds.textContent = formatFr(usedSeconds, 0) + " / " + formatFr(limitSeconds, 0) + " s";
      setArc(els.modalGaugeMinutes, visualPct);
      setArc(els.modalGaugeHours, visualPct);
      setArc(els.modalGaugeSeconds, visualPct);
    } else {
      if (els.modalValueMinutes) els.modalValueMinutes.textContent = "—";
      if (els.modalValueHours) els.modalValueHours.textContent = "—";
      if (els.modalValueSeconds) els.modalValueSeconds.textContent = "—";
      setArc(els.modalGaugeMinutes, 0);
      setArc(els.modalGaugeHours, 0);
      setArc(els.modalGaugeSeconds, 0);
    }
    updateModalFactElements(usedMinutes, monthlyLimit, pct, state.isBusiness);
  }

  function hoistModalToBody() {
    if (!els.modal || !document.body) return;
    if (els.modal.parentElement !== document.body) document.body.appendChild(els.modal);
  }

  function openModal() {
    if (!els.modal) return;
    hoistModalToBody();
    updateModalMetrics(state.usedMinutes, state.monthlyLimit, state.percent, state.zone, state.isBusiness, state.edition);
    if (!els.modal.hidden) return;
    els.modal.hidden = false;
    document.body.classList.add("aq-modal-open");
    if (els.modalClose) els.modalClose.focus();
  }

  function closeModal() {
    if (!els.modal || els.modal.hidden) return;
    els.modal.hidden = true;
    document.body.classList.remove("aq-modal-open");
    root.focus();
  }

  function bindModalEvents() {
    root.addEventListener("click", openModal);
    root.addEventListener("keydown", function(evt) {
      if (evt.key === "Enter" || evt.key === " " || evt.code === "Space") { evt.preventDefault(); openModal(); }
    });
    if (els.modalBackdrop) els.modalBackdrop.addEventListener("click", closeModal);
    if (els.modalClose) els.modalClose.addEventListener("click", closeModal);
    if (els.modalPanel) els.modalPanel.addEventListener("click", function(evt) { evt.stopPropagation(); });
    window.addEventListener("keydown", function(evt) { if (evt.key === "Escape") closeModal(); });
  }

  async function fetchJson(url) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = null;
    if (controller) timeoutId = setTimeout(function() { try { controller.abort(); } catch (e) {} }, FETCH_TIMEOUT_MS);
    try {
      var response = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: controller ? controller.signal : undefined });
      var text = await response.text();
      var data = null;
      if (text) { try { data = JSON.parse(text); } catch (e) { throw new Error("JSON invalide"); } }
      if (!response.ok) throw new Error("HTTP " + response.status);
      return data;
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("Timeout");
      throw e;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function requestToken(email, edition) {
    if (!email) return "";
    if (tokenRequestInFlight) return tokenRequestInFlight;
    tokenRequestInFlight = (async function() {
      try {
        var url = API_BASE + "/getToken?username=" + encodeURIComponent(email) + "&edition=" + encodeURIComponent(edition);
        var data = await fetchJson(url);
        if (data && data.status === "OK" && data.token) {
          setTokenEverywhere(String(data.token).trim());
          return String(data.token).trim();
        }
      } catch (e) {}
      return "";
    })();
    try { return await tokenRequestInFlight; }
    finally { tokenRequestInFlight = null; }
  }

  async function waitForCredentials(timeoutMs) {
    var started = Date.now();
    while (Date.now() - started < timeoutMs) {
      var email = getEmail();
      var edition = getEdition();
      var token = getToken();
      if (!token && email) token = await requestToken(email, edition);
      if (token && email) return { email: email, token: token, edition: edition };
      await sleep(POLL_CREDENTIALS_MS);
    }
    return null;
  }

  async function refreshQuotasInternal() {
    var creds = await waitForCredentials(CREDENTIALS_TIMEOUT_MS);
    if (!creds) {
      state.loadError = true;
      state.loading = false;
      state.edition = getEdition();
      applyErrorState(true);
      if (els.minutesUsed) els.minutesUsed.textContent = "—";
      if (els.minutesLabel) els.minutesLabel.textContent = "sur - min/mois";
      updateModalMetrics(0, 0, 0, "ok", false, state.edition);
      return;
    }
    var edition = normalizeEdition(creds.edition);
    state.edition = edition;

    var qs = "username=" + encodeURIComponent(creds.email) + "&token=" + encodeURIComponent(creds.token) + "&edition=" + encodeURIComponent(creds.edition);
    var uploadsUrl = API_BASE + "/getNumberOfUploadsForPeriod?" + qs;
    var minutesUrl = API_BASE + "/getNumberOfMinutesForPeriod?" + qs;
    var uploadsResult, minutesResult;
    try {
      var results = await Promise.allSettled([fetchJson(uploadsUrl), fetchJson(minutesUrl)]);
      uploadsResult = results[0];
      minutesResult = results[1];
    } catch (e) {
      state.loadError = true;
      state.loading = false;
      applyErrorState(true);
      if (els.minutesUsed) els.minutesUsed.textContent = "—";
      if (els.minutesLabel) els.minutesLabel.textContent = "sur - min/mois";
      updateModalMetrics(0, 0, 0, "ok", false, edition);
      return;
    }
    var isBusiness = edition === "ent" || isBusinessPath();
    state.isBusiness = !!isBusiness;
    updateModalActionsVisibility();

    if (minutesResult.status === "fulfilled" && minutesResult.value && minutesResult.value.status === "OK") {
      var usedMinutes = safeNumber(minutesResult.value.numberOfMinutes, 0);
      var monthlyLimit = safeNumber(minutesResult.value.monthlyLimit, 0);
      if (monthlyLimit >= BUSINESS_FALLBACK_LIMIT) isBusiness = true;
      if (isBusiness && (!monthlyLimit || monthlyLimit <= 0)) monthlyLimit = BUSINESS_FALLBACK_LIMIT;
      state.isBusiness = !!isBusiness;
      state.loadError = false;
      state.loading = false;
      applyErrorState(false);
      state.edition = edition;
      updateModalActionsVisibility();
      var safeLimitMinutes = monthlyLimit > 0 ? monthlyLimit : 1;
      var percent = (usedMinutes / safeLimitMinutes) * 100;
      var zone = setGaugePercent(percent);
      if (els.minutesUsed) els.minutesUsed.textContent = String(usedMinutes);
      if (els.minutesLabel) els.minutesLabel.textContent = monthlyLimit > 0 ? "sur " + monthlyLimit + " min/mois" : "sur - min/mois";
      updateModalMetrics(usedMinutes, monthlyLimit, percent, zone, isBusiness, edition);
    } else {
      state.loadError = true;
      state.loading = false;
      applyErrorState(true);
      if (els.minutesUsed) els.minutesUsed.textContent = "—";
      if (els.minutesLabel) els.minutesLabel.textContent = "sur - min/mois";
      updateModalMetrics(0, 0, 0, "ok", false, edition);
    }

    if (els.uploads) {
      if (els.uploads.parentElement) els.uploads.parentElement.style.display = "inline-flex";
      if (isBusiness) els.uploads.textContent = "Transcriptions illimitees (24h)";
      else if (uploadsResult.status === "fulfilled" && uploadsResult.value && uploadsResult.value.status === "OK") {
        var usedUploads = safeNumber(uploadsResult.value.numberOfUploads, 0);
        var dailyLimit = safeNumber(uploadsResult.value.dailyLimit, 0);
        els.uploads.textContent = usedUploads + " / " + dailyLimit + " transcriptions (24h)";
      } else els.uploads.textContent = "— / — transcriptions (24h)";
    }
  }

  async function refreshQuotas() {
    if (refreshInFlight) { refreshQueued = true; return; }
    refreshInFlight = true;
    try { await refreshQuotasInternal(); } catch (e) { console.error("[Quotas] refreshQuotas error:", e); state.loadError = true; state.loading = false; state.edition = getEdition(); updateModalMetrics(0, 0, 0, "ok", false, state.edition); }
    finally {
      refreshInFlight = false;
      if (refreshQueued) { refreshQueued = false; refreshQuotas(); }
    }
  }

  function boot() {
    state.edition = getEdition();
    if (els.minutesUsed) els.minutesUsed.textContent = LOADING_LABEL;
    hoistModalToBody();
    bindModalEvents();
    updateModalMetrics(0, 0, 0, "ok", false, state.edition);
    refreshQuotas();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshQuotas, REFRESH_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.addEventListener("load", refreshQuotas);
  window.addEventListener("agilo:token", refreshQuotas);
  window.addEventListener("focus", refreshQuotas);
  document.addEventListener("visibilitychange", function() { if (!document.hidden) refreshQuotas(); });
})();
