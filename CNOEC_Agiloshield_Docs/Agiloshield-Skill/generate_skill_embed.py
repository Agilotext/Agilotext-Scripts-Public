#!/usr/bin/env python3
"""Génère skill-generator-embed.html avec SKILL.md et agiloshield.py inlinés."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SKILL_SRC = ROOT / "agiloshield-skill"
OUT = ROOT / "skill-generator-embed.html"

skill_md = (SKILL_SRC / "SKILL.md").read_text(encoding="utf-8")
agilo_py = (SKILL_SRC / "scripts" / "agiloshield.py").read_text(encoding="utf-8")
assets_json = json.dumps({"SKILL_MD": skill_md, "AGILOSHIELD_PY": agilo_py}, ensure_ascii=False)

CLAUDE_LOGO_URL = (
    "https://cdn.prod.website-files.com/6815bee5a9c0b57da18354fb/"
    "6a1f116a08744afd7c5e0ee9_claude-color.png"
)

HTML_TEMPLATE = r'''<!-- Agiloshield Skill Generator — embed Webflow v2 -->
<div id="ags-skill-generator" class="ags-root" data-ms-code-skill-generator="form">
  <div id="ags-screen-loading" class="ags-screen ags-screen--active" aria-live="polite">
    <div class="ags-brand" aria-hidden="true">
      <img class="ags-claude-logo" src="__CLAUDE_LOGO__" alt="" width="40" height="40" decoding="async">
    </div>
    <div class="ags-spinner" aria-hidden="true"></div>
    <p class="ags-lead">Vérification de votre accès…</p>
  </div>

  <div id="ags-screen-noauth" class="ags-screen" hidden>
    <div class="ags-brand">
      <img class="ags-claude-logo" src="__CLAUDE_LOGO__" alt="Claude" width="40" height="40" decoding="async">
      <p class="ags-brand-tag">Intégration Claude Cowork</p>
    </div>
    <h2 class="ags-title">Connexion requise</h2>
    <p class="ags-text">Connectez-vous à votre compte Agilotext pour générer votre skill Agiloshield.</p>
    <a class="ags-btn ags-btn--primary" href="/auth/login">Se connecter</a>
  </div>

  <div id="ags-screen-upsell" class="ags-screen" hidden>
    <div class="ags-brand">
      <img class="ags-claude-logo" src="__CLAUDE_LOGO__" alt="Claude" width="48" height="48" decoding="async">
      <p class="ags-brand-tag">Intégration Claude Cowork</p>
    </div>
    <h2 class="ags-title">Générez votre skill Agiloshield</h2>
    <p class="ags-text">Cette fonctionnalité est réservée aux abonnés <strong>Agiloshield Classic</strong>.</p>
    <p class="ags-text ags-text--muted">Pseudonymisez vos documents dans Claude Cowork avant toute analyse — sans exposer vos données sensibles.</p>
    <a id="ags-pricing-link" class="ags-btn ags-btn--primary" href="/tools/agiloshield/tarifs">Voir les tarifs →</a>
    <button type="button" class="ags-btn ags-btn--ghost" id="ags-reload-access">Déjà abonné ? Recharger la page</button>
  </div>

  <div id="ags-screen-pending" class="ags-screen" hidden>
    <div class="ags-brand">
      <img class="ags-claude-logo" src="__CLAUDE_LOGO__" alt="Claude" width="40" height="40" decoding="async">
    </div>
    <h2 class="ags-title">Votre abonnement est en cours d'activation</h2>
    <p class="ags-text">Cela peut prendre 1 à 2 minutes après le paiement. Rechargez la page dans un instant.</p>
    <button type="button" class="ags-btn ags-btn--primary" id="ags-reload-pending">Recharger</button>
  </div>

  <div id="ags-screen-installed" class="ags-screen" hidden>
    <div class="ags-installed-header">
      <div class="ags-brand ags-brand--row">
        <img class="ags-claude-logo" src="__CLAUDE_LOGO__" alt="Claude" width="32" height="32" decoding="async">
        <div>
          <p class="ags-brand-tag">Skill installé</p>
          <h2 class="ags-title ags-title--sm">Intégration Claude Cowork</h2>
        </div>
      </div>
    </div>
    <div class="ags-installed-config" id="ags-installed-config"></div>
    <div class="ags-actions ags-actions--installed">
      <button type="button" class="ags-btn ags-btn--ghost" id="ags-edit-config">Modifier mes paramètres</button>
      <button type="button" class="ags-btn ags-btn--primary" id="ags-redownload">Re-télécharger le skill</button>
    </div>
    <div class="ags-installed-sep"></div>
    <div class="ags-install-guide">
      <h3 class="ags-install-guide-title">Comment installer le skill</h3>
      <ol class="ags-install-steps-visual">
        <li class="ags-install-step">
          <div class="ags-install-step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div class="ags-install-step-body">
            <strong class="ags-install-step-label">Importer le fichier <code>.skill</code></strong>
            <p class="ags-install-step-desc">Dans Claude Cowork, allez dans <em>Settings → Customize</em>, onglet <em>Skills</em>. Cliquez sur <strong>+</strong>, puis <em>Téléverser une compétence</em> et sélectionnez le fichier téléchargé.</p>
          </div>
        </li>
        <li class="ags-install-step">
          <div class="ags-install-step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div class="ags-install-step-body">
            <strong class="ags-install-step-label">Autoriser la sortie réseau</strong>
            <p class="ags-install-step-desc">Allez dans <em>Settings → Capabilities</em>. Activez <strong>Autoriser la sortie réseau</strong>, puis ajoutez <code>api.agilotext.com</code> dans les domaines autorisés.</p>
          </div>
        </li>
        <li class="ags-install-step">
          <div class="ags-install-step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="ags-install-step-body">
            <strong class="ags-install-step-label">Démarrer une conversation</strong>
            <p class="ags-install-step-desc">Ouvrez une nouvelle conversation et mentionnez un fichier local. Claude Agiloshield le pseudonymisera automatiquement avant toute analyse.</p>
          </div>
        </li>
      </ol>
    </div>
  </div>

  <div id="ags-screen-success" class="ags-screen" hidden>
    <div class="ags-success-header">
      <div class="ags-success-check" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="currentColor" opacity=".12"/><path d="M14 25l7 7 14-14" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h2 class="ags-title">Votre skill est prêt !</h2>
      <p class="ags-text ags-text--muted">Le fichier <code id="ags-success-filename"></code> vient d'être téléchargé.</p>
    </div>

    <ol class="ags-install-steps-visual">
      <li class="ags-install-step">
        <div class="ags-install-step-icon ags-install-step-icon--done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div class="ags-install-step-body">
          <strong class="ags-install-step-label">Fichier téléchargé <span class="ags-badge ags-badge--success">Fait</span></strong>
          <p class="ags-install-step-desc">Le fichier <code>.skill</code> est dans votre dossier Téléchargements.</p>
        </div>
      </li>
      <li class="ags-install-step">
        <div class="ags-install-step-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
        <div class="ags-install-step-body">
          <strong class="ags-install-step-label">Importer dans Claude Cowork</strong>
          <p class="ags-install-step-desc"><em>Settings → Customize → Skills → <strong>+</strong> → Téléverser une compétence</em> → sélectionnez le fichier.</p>
        </div>
      </li>
      <li class="ags-install-step">
        <div class="ags-install-step-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
        </div>
        <div class="ags-install-step-body">
          <strong class="ags-install-step-label">Autoriser la sortie réseau</strong>
          <p class="ags-install-step-desc"><em>Settings → Capabilities → Autoriser la sortie réseau → Domaines →</em> ajouter <code>api.agilotext.com</code>.</p>
        </div>
      </li>
      <li class="ags-install-step">
        <div class="ags-install-step-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="ags-install-step-body">
          <strong class="ags-install-step-label">Lancer une conversation</strong>
          <p class="ags-install-step-desc">Nouvelle conversation → mentionnez un fichier. Agiloshield le pseudonymise avant toute lecture.</p>
        </div>
      </li>
    </ol>

    <div class="ags-actions ags-actions--success">
      <button type="button" class="ags-btn ags-btn--ghost" id="ags-success-edit">Modifier mes paramètres</button>
      <button type="button" class="ags-btn ags-btn--primary" id="ags-success-redownload">Re-télécharger</button>
    </div>
  </div>

  <div id="ags-screen-form" class="ags-screen" hidden>
    <header class="ags-head">
      <div class="ags-brand ags-brand--row">
        <img class="ags-claude-logo" src="__CLAUDE_LOGO__" alt="Claude" width="36" height="36" decoding="async">
        <div>
          <h2 class="ags-title">Générateur de skill Agiloshield</h2>
          <p class="ags-text ags-text--muted ags-head-sub">Configurez votre skill Claude Cowork en 2 étapes.</p>
        </div>
      </div>
    </header>

    <nav class="ags-stepper" aria-label="Étapes">
      <div class="ags-stepper-track" role="progressbar" aria-valuemin="1" aria-valuemax="2" aria-valuenow="1">
        <div class="ags-stepper-fill" id="ags-stepper-fill"></div>
      </div>
      <ol class="ags-stepper-labels">
        <li class="ags-stepper-label ags-stepper-label--active" data-step="1">Configurer</li>
        <li class="ags-stepper-label" data-step="2">Télécharger</li>
      </ol>
    </nav>

    <section class="ags-panel ags-panel--active" data-panel="1">
      <h3 class="ags-panel-title">Quel est votre profil métier ?</h3>
      <div class="ags-profile-grid" id="ags-profile-grid" role="radiogroup" aria-label="Profil métier"></div>

      <div id="ags-inline-types" class="ags-inline-types" hidden>
        <div class="ags-inline-types-head">
          <h3 class="ags-panel-title">Types de données à masquer</h3>
          <p class="ags-text ags-text--muted">Cochez au minimum 2 types. Ajustez librement — le profil passera en « Personnalisé ».</p>
        </div>
        <div class="ags-types-grid" id="ags-types-grid"></div>
        <fieldset class="ags-mode-field">
          <legend class="ags-panel-title">Mode</legend>
          <label class="ags-radio"><input type="radio" name="ags-mode" value="pseudonymize" checked> Pseudonymiser <span class="ags-badge">recommandé</span></label>
          <label class="ags-radio"><input type="radio" name="ags-mode" value="anonymize"> Anonymiser <span class="ags-text--muted">(irréversible)</span></label>
        </fieldset>
        <p class="ags-error" id="ags-types-error" hidden>Sélectionnez au moins 2 types.</p>
      </div>

      <div class="ags-actions ags-actions--configure">
        <button type="button" class="ags-btn ags-btn--primary" id="ags-next-1" disabled>Voir le récapitulatif</button>
      </div>
    </section>

    <section class="ags-panel" data-panel="2" hidden>
      <h3 class="ags-panel-title">Récapitulatif</h3>
      <dl class="ags-recap" id="ags-recap"></dl>
      <p class="ags-error" id="ags-gen-error" hidden></p>
      <div class="ags-actions ags-actions--recap">
        <button type="button" class="ags-btn ags-btn--ghost" id="ags-back-2">Retour</button>
        <button type="button" class="ags-btn ags-btn--primary" id="ags-download">Télécharger mon skill</button>
      </div>
      <div class="ags-install">
        <h4 class="ags-install-title">Installation dans Claude Cowork</h4>
        <ol class="ags-install-steps">
          <li><strong>Settings → Capabilities</strong> : activer l'exécution de code et autoriser <code>api.agilotext.com</code>.</li>
          <li><strong>Settings → Customize</strong> : importer le fichier <code>.skill</code> téléchargé.</li>
          <li><strong>Nouvelle conversation</strong> : envoyer votre message de règles (pseudonymiser avant toute lecture).</li>
        </ol>
      </div>
    </section>
  </div>
</div>

<script type="application/json" id="ags-inline-assets">__ASSETS_JSON__</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
(function () {
  "use strict";

  const ROOT_ID = "ags-skill-generator";
  const AGILOSHIELD_CLASSIC_PRICE_ID = "prc_classic-mensuel-3u5vr0uq5";
  const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING", "GRACE"]);
  const PRICING_BASE = "/tools/agiloshield/tarifs";
  const RETURN_PATH = "/tools/agiloshield/premium/dashboard";
  const SKILL_ZIP_PREFIX = "agiloshield-skill";
  const MIN_TYPES = 2;

  const PROFILE_TYPES = {
    ma: ["PER", "ORG", "ADR", "IDN"],
    legal: ["PER", "ORG", "ADR", "EML", "TEL", "IDN"],
    hr: ["PER", "ADR", "EML", "TEL", "IDN", "IBA", "JOB"],
    health: ["PER", "ADR", "EML", "TEL", "IDN", "PII", "DAT"],
    developer: ["PER", "ORG", "EML", "TEL", "URL", "IDN"],
    custom: []
  };

  const PROFILE_LABELS = {
    ma: "M&A / Finance",
    legal: "Juridique",
    hr: "RH",
    health: "Santé",
    developer: "Développeur",
    custom: "Personnalisé"
  };

  const TYPE_LABELS = {
    ADR: "Adresse", DAT: "Date", EML: "Email", IBA: "IBAN", IDN: "Identifiant",
    JOB: "Intitulé de poste", LOC: "Lieu", ORG: "Organisation", PER: "Personne",
    PII: "Donnée personnelle", PRO: "Profession", TEL: "Téléphone", URL: "URL"
  };

  const ALL_TYPES = Object.keys(TYPE_LABELS);

  let INLINE = { SKILL_MD: "", AGILOSHIELD_PY: "" };
  try {
    INLINE = JSON.parse(document.getElementById("ags-inline-assets").textContent);
  } catch (e) {
    console.error("[AGS_SKILL_GEN] inline assets parse failed", e);
  }

  const STORAGE_KEY = "ags_skill_config";

  const state = {
    step: 1,
    profile: "",
    types: [],
    mode: "pseudonymize",
    email: "",
    member: null,
    hasAccess: false,
    lastFilename: ""
  };

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: state.profile,
        types: state.types,
        mode: state.mode,
        email: state.email,
        filename: state.lastFilename,
        savedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function clearConfig() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function showScreen(id) {
    $$(".ags-screen", $("#" + ROOT_ID)).forEach((el) => {
      const on = el.id === id;
      el.hidden = !on;
      el.classList.toggle("ags-screen--active", on);
    });
  }

  function normalizeStatus(s) { return String(s || "").toUpperCase(); }

  function getConnections(m) { return Array.isArray(m?.planConnections) ? m.planConnections : []; }
  function getPlans(m) { return Array.isArray(m?.plans) ? m.plans : []; }

  function getPlanId(p) { return String(p?.planId || p?.plan?.id || p?.id || ""); }
  function getPriceId(p) {
    const pay = p?.payment || {};
    return String(pay.priceId || p?.priceId || "");
  }
  function getPlanLabel(p) {
    const pay = p?.payment || {};
    return [p?.planId, p?.planName, p?.name, p?.priceName, pay?.priceName, pay?.priceId]
      .filter(Boolean).join(" ").toLowerCase();
  }

  function isPlanObjectActive(p) {
    const st = normalizeStatus(p?.status);
    if (st) return ACTIVE_STATUSES.has(st);
    if (typeof p?.active === "boolean") return p.active;
    return false;
  }

  function hasAgiloshieldClassic(member) {
    function matches(plan) {
      const planId = getPlanId(plan);
      const priceId = getPriceId(plan);
      const label = getPlanLabel(plan);
      return planId.indexOf("pln_agiloshield") === 0 ||
        planId.indexOf("pln_agiloshield-classic") === 0 ||
        priceId === AGILOSHIELD_CLASSIC_PRICE_ID ||
        label.indexOf("agiloshield") !== -1 ||
        label.indexOf("classic mensuel") !== -1;
    }
    const connections = getConnections(member);
    if (connections.length > 0) {
      return connections.some((p) => ACTIVE_STATUSES.has(normalizeStatus(p?.status)) && matches(p));
    }
    return getPlans(member).some((p) => isPlanObjectActive(p) && matches(p));
  }

  async function waitForMemberstack(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.$memberstackDom) return window.$memberstackDom;
      await sleep(120);
    }
    return null;
  }

  async function fetchMember(ms, useCache) {
    try {
      const { data } = await ms.getCurrentMember({ useCache: useCache !== false });
      return data || null;
    } catch (e) {
      console.warn("[AGS_SKILL_GEN] getCurrentMember failed", e);
      return null;
    }
  }

  function isUpgradedReturn() {
    const p = new URLSearchParams(window.location.search);
    return p.get("upgraded") === "1" || p.get("upgraded") === "true";
  }

  function buildPricingUrl() {
    const ret = encodeURIComponent(RETURN_PATH + "?upgraded=1");
    return PRICING_BASE + "?return=" + ret;
  }

  function readMemberEmail(member) {
    return (member?.auth?.email || member?.email || "").trim();
  }

  async function resolveAccess() {
    const minLoad = sleep(300);
    const upgraded = isUpgradedReturn();
    const ms = await waitForMemberstack(12000);
    await minLoad;

    if (!ms) {
      showScreen("ags-screen-noauth");
      return;
    }

    let member = await fetchMember(ms, false);
    let hasAccess = member && hasAgiloshieldClassic(member);

    if (!hasAccess && upgraded) {
      for (let i = 0; i < 3; i++) {
        await sleep(2000);
        member = await fetchMember(ms, false);
        hasAccess = member && hasAgiloshieldClassic(member);
        if (hasAccess) break;
      }
    }

    state.member = member;
    state.hasAccess = !!hasAccess;
    state.email = readMemberEmail(member || {});

    const pricingLink = $("#ags-pricing-link");
    if (pricingLink) pricingLink.href = buildPricingUrl();

    if (hasAccess) {
      const saved = loadConfig();
      if (saved && saved.profile && saved.types && saved.types.length >= MIN_TYPES) {
        restoreFromSaved(saved);
        buildTypeCheckboxes();
        buildProfileCards();
        bindFormEvents();
        showInstalledScreen(saved);
      } else {
        initForm();
        showScreen("ags-screen-form");
      }
      return;
    }

    if (upgraded) {
      showScreen("ags-screen-pending");
      return;
    }

    if (!member) {
      showScreen("ags-screen-noauth");
      return;
    }

    showScreen("ags-screen-upsell");
  }

  function initForm() {
    buildProfileCards();
    buildTypeCheckboxes();
    bindFormEvents();
    goToStep(1);
  }

  function buildProfileCards() {
    const grid = $("#ags-profile-grid");
    if (!grid || grid.childElementCount) return;
    Object.keys(PROFILE_LABELS).forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ags-profile-card" + (key === "custom" ? " ags-profile-card--custom" : "");
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.dataset.profile = key;
      const meta = key === "custom"
        ? "Choix libre — cochez les types ci-dessous"
        : (PROFILE_TYPES[key].length ? PROFILE_TYPES[key].join(", ") : "");
      btn.innerHTML = "<span class=\"ags-profile-card-title\">" + PROFILE_LABELS[key] + "</span>" +
        "<span class=\"ags-profile-card-meta\">" + meta + "</span>";
      btn.addEventListener("click", () => selectProfile(key));
      grid.appendChild(btn);
    });
  }

  function highlightProfileCard(key) {
    $$(".ags-profile-card", $("#ags-profile-grid")).forEach((c) => {
      const on = c.dataset.profile === key;
      c.classList.toggle("ags-profile-card--selected", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function revealInlineTypes() {
    const zone = $("#ags-inline-types");
    if (!zone) return;
    zone.hidden = false;
    requestAnimationFrame(() => {
      zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function selectProfile(key) {
    state.profile = key;
    state.types = PROFILE_TYPES[key].slice();
    highlightProfileCard(key);
    revealInlineTypes();
    syncTypeCheckboxes();
    validateTypes();
  }

  function onTypeChange() {
    readTypesFromUI();
    const preset = PROFILE_TYPES[state.profile] || [];
    if (state.profile !== "custom" && !arraysEqual(state.types, preset)) {
      state.profile = "custom";
      highlightProfileCard("custom");
    }
    validateTypes();
  }

  function buildTypeCheckboxes() {
    const grid = $("#ags-types-grid");
    if (!grid || grid.childElementCount) return;
    ALL_TYPES.forEach((code) => {
      const label = document.createElement("label");
      label.className = "ags-type-chip";
      label.innerHTML = "<input type=\"checkbox\" value=\"" + code + "\">" +
        "<span><strong>" + code + "</strong> — " + TYPE_LABELS[code] + "</span>";
      grid.appendChild(label);
    });
  }

  function syncTypeCheckboxes() {
    $$("#ags-types-grid input[type=checkbox]").forEach((cb) => {
      cb.checked = state.types.includes(cb.value);
    });
    validateTypes();
  }

  function readTypesFromUI() {
    state.types = $$("#ags-types-grid input[type=checkbox]:checked").map((cb) => cb.value);
  }

  function validateTypes() {
    readTypesFromUI();
    const ok = state.profile && state.types.length >= MIN_TYPES;
    const err = $("#ags-types-error");
    if (err) err.hidden = ok;
    const nextBtn = $("#ags-next-1");
    if (nextBtn) nextBtn.disabled = !ok;
    return ok;
  }

  function goToStep(n) {
    state.step = n;
    $$(".ags-panel", $("#ags-screen-form")).forEach((p) => {
      const on = Number(p.dataset.panel) === n;
      p.hidden = !on;
      p.classList.toggle("ags-panel--active", on);
    });
    $$(".ags-stepper-label").forEach((l) => {
      const s = Number(l.dataset.step);
      l.classList.toggle("ags-stepper-label--active", s === n);
      l.classList.toggle("ags-stepper-label--done", s < n);
    });
    const fill = $("#ags-stepper-fill");
    if (fill) fill.style.width = ((n - 1) * 100) + "%";
    const track = $(".ags-stepper-track");
    if (track) track.setAttribute("aria-valuenow", String(n));
    if (n === 2) renderRecap();
  }

  function renderRecap() {
    const dl = $("#ags-recap");
    if (!dl) return;
    const modeLabel = state.mode === "anonymize" ? "Anonymiser (irréversible)" : "Pseudonymiser";
    dl.innerHTML =
      "<dt>Profil</dt><dd>" + (PROFILE_LABELS[state.profile] || state.profile) + "</dd>" +
      "<dt>Types (" + state.types.length + ")</dt><dd>" + state.types.join(", ") + "</dd>" +
      "<dt>Mode</dt><dd>" + modeLabel + "</dd>" +
      "<dt>Compte</dt><dd>" + (state.email || "—") + "</dd>";
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    const sa = a.slice().sort();
    const sb = b.slice().sort();
    return sa.every((v, i) => v === sb[i]);
  }

  function renderConfigPy() {
    const typesRepr = JSON.stringify(state.types);
    const preset = PROFILE_TYPES[state.profile] || [];
    const profile = state.profile === "custom" || !arraysEqual(state.types, preset)
      ? "custom" : state.profile;
    const email = (state.email || "votre.email@exemple.com").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return '"""Configuration Agiloshield — générée automatiquement."""\n\n' +
      'API_BASE = "https://api.agilotext.com/api/v1"\n\n' +
      'USERNAME = "' + email + '"\n' +
      "USE_GET_TOKEN = True\n" +
      'AUTOMATION_TOKEN = ""\n' +
      'TOKEN = ""\n' +
      'PASSWORD = ""\n' +
      'EDITION = "ent"\n\n' +
      'PROFILE = "' + profile + '"\n' +
      "ENTITY_TYPES = " + typesRepr + "\n" +
      'MODE = "' + state.mode + '"\n\n' +
      'OUTPUT_DIR = ""\n\n' +
      "POLL_TIMEOUT_SECONDS = 300\n";
  }

  function slugProfile() {
    const s = (PROFILE_LABELS[state.profile] || state.profile || "skill")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return s || "skill";
  }

  function fileDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return "" + y + m + day;
  }

  async function downloadSkill() {
    const errEl = $("#ags-gen-error");
    if (errEl) { errEl.hidden = true; errEl.textContent = ""; }

    if (typeof JSZip === "undefined") {
      if (errEl) {
        errEl.textContent = "Bibliothèque ZIP non chargée. Rechargez la page.";
        errEl.hidden = false;
      }
      return;
    }

    if (!state.hasAccess) {
      showScreen("ags-screen-upsell");
      return;
    }

    const btn = $("#ags-download");
    if (btn) { btn.disabled = true; btn.textContent = "Génération…"; }

    try {
      const zip = new JSZip();
      const root = zip.folder(SKILL_ZIP_PREFIX);
      const scripts = root.folder("scripts");
      root.file("SKILL.md", INLINE.SKILL_MD);
      scripts.file("agiloshield.py", INLINE.AGILOSHIELD_PY);
      scripts.file("config.py", renderConfigPy());
      scripts.file("__init__.py", "");

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const name = "agiloshield-" + slugProfile() + "-" + fileDate() + ".skill";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      state.lastFilename = name;
      saveConfig();
      showSuccessScreen(name);
    } catch (e) {
      console.error("[AGS_SKILL_GEN] zip failed", e);
      if (errEl) {
        errEl.textContent = "Génération échouée. Rechargez la page et réessayez.";
        errEl.hidden = false;
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Télécharger mon skill"; }
    }
  }

  function showSuccessScreen(filename) {
    const filenameEl = $("#ags-success-filename");
    if (filenameEl) filenameEl.textContent = filename;
    showScreen("ags-screen-success");
  }

  function showInstalledScreen(saved) {
    const container = $("#ags-installed-config");
    if (container) {
      const profileLabel = PROFILE_LABELS[saved.profile] || saved.profile || "—";
      const modeLabel = saved.mode === "anonymize" ? "Anonymiser" : "Pseudonymiser";
      const typesHtml = (saved.types || []).map((t) =>
        "<span class=\"ags-type-badge\">" + (TYPE_LABELS[t] ? "<strong>" + t + "</strong> " + TYPE_LABELS[t] : t) + "</span>"
      ).join("");
      const dateStr = saved.savedAt
        ? new Date(saved.savedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
        : "";
      container.innerHTML =
        "<div class=\"ags-installed-row\"><span class=\"ags-installed-label\">Profil</span><span>" + profileLabel + "</span></div>" +
        "<div class=\"ags-installed-row\"><span class=\"ags-installed-label\">Mode</span><span>" + modeLabel + "</span></div>" +
        (dateStr ? "<div class=\"ags-installed-row\"><span class=\"ags-installed-label\">Généré le</span><span>" + dateStr + "</span></div>" : "") +
        "<div class=\"ags-installed-types\">" + typesHtml + "</div>";
    }
    showScreen("ags-screen-installed");
  }

  function restoreFromSaved(saved) {
    state.profile = saved.profile || "";
    state.types = saved.types || [];
    state.mode = saved.mode || "pseudonymize";
  }

  function goToConfigForm() {
    initForm();
    showScreen("ags-screen-form");
    goToStep(1);
    const zone = $("#ags-inline-types");
    if (state.profile) {
      highlightProfileCard(state.profile);
      syncTypeCheckboxes();
      if (zone) zone.hidden = false;
    }
    const modeInput = $('input[name="ags-mode"][value="' + state.mode + '"]');
    if (modeInput) modeInput.checked = true;
    validateTypes();
  }

  function bindFormEvents() {
    $("#ags-next-1")?.addEventListener("click", () => {
      if (!validateTypes()) return;
      state.mode = $('input[name="ags-mode"]:checked')?.value || "pseudonymize";
      goToStep(2);
    });
    $("#ags-back-2")?.addEventListener("click", () => goToStep(1));
    $("#ags-download")?.addEventListener("click", downloadSkill);
    $$("#ags-types-grid input").forEach((cb) => cb.addEventListener("change", onTypeChange));
    $$('input[name="ags-mode"]').forEach((r) => r.addEventListener("change", () => {
      state.mode = r.value;
    }));
    $("#ags-reload-access")?.addEventListener("click", () => window.location.reload());
    $("#ags-reload-pending")?.addEventListener("click", () => window.location.reload());

    $("#ags-edit-config")?.addEventListener("click", () => goToConfigForm());
    $("#ags-redownload")?.addEventListener("click", () => downloadSkill());
    $("#ags-success-edit")?.addEventListener("click", () => goToConfigForm());
    $("#ags-success-redownload")?.addEventListener("click", () => downloadSkill());
  }

  function applyDrawerMode() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const inDrawer = !!root.closest("#ags-drawer-mount");
    const p = new URLSearchParams(window.location.search);
    if (inDrawer || p.get("drawer") === "1" || p.get("embed") === "drawer") {
      root.classList.add("ags--drawer");
      if (inDrawer) root.setAttribute("data-ags-in-drawer", "");
    }
  }

  function boot() {
    applyDrawerMode();
    resolveAccess();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
</script>
<style>
#ags-skill-generator.ags-root {
  --agilo-primary: var(--color--blue, #174a96);
  --agilo-primary-soft: color-mix(in srgb, var(--color--blue, #174a96) 12%, transparent);
  --agilo-text: var(--color--gris_foncé, #020202);
  --agilo-text-secondary: var(--color--gris, #525252);
  --agilo-surface: var(--color--white, #ffffff);
  --agilo-surface-2: var(--color--blanc_gris, #f8f9fa);
  --agilo-border: rgba(52, 58, 64, 0.12);
  --agilo-error: var(--color--rouge, #a82633);
  font-family: "Inter", "SF Pro Text", "Segoe UI", sans-serif;
  color: var(--agilo-text);
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 2rem;
  box-sizing: border-box;
}
#ags-skill-generator *, #ags-skill-generator *::before, #ags-skill-generator *::after { box-sizing: border-box; }
#ags-skill-generator .ags-screen { display: none; text-align: center; }
#ags-skill-generator .ags-screen--active { display: block; }
#ags-skill-generator #ags-screen-form.ags-screen--active { text-align: left; }
#ags-skill-generator .ags-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.75rem; text-align: center; }
#ags-skill-generator #ags-screen-form .ags-title { text-align: left; margin: 0; }
#ags-skill-generator .ags-head-sub { margin: 0.25rem 0 0; }
#ags-skill-generator .ags-brand {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  margin-bottom: 1rem;
}
#ags-skill-generator .ags-brand--row {
  flex-direction: row; align-items: flex-start; text-align: left;
  margin-bottom: 0;
}
#ags-skill-generator .ags-brand-tag {
  margin: 0; font-size: 0.8rem; font-weight: 600;
  color: var(--agilo-text-secondary); text-transform: uppercase;
  letter-spacing: 0.04em;
}
#ags-skill-generator .ags-claude-logo { display: block; flex-shrink: 0; }
#ags-skill-generator.ags--drawer {
  max-width: none; margin: 0; min-height: 100%;
  padding: 1.5rem 1.75rem 2rem;
}
#ags-skill-generator.ags--drawer .ags-screen--active {
  text-align: left;
}
#ags-skill-generator.ags--drawer .ags-head {
  display: none;
}
#ags-skill-generator.ags--drawer .ags-brand-tag {
  display: none;
}
#ags-skill-generator.ags--drawer .ags-stepper-labels {
  font-size: 0.85rem;
}
#ags-skill-generator.ags--drawer .ags-profile-grid {
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
}
#ags-skill-generator.ags--drawer .ags-types-grid {
  grid-template-columns: repeat(auto-fill, minmax(9.75rem, 1fr));
}
@media (max-width: 900px) {
  #ags-skill-generator .ags-profile-grid,
  #ags-skill-generator.ags--drawer .ags-profile-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  #ags-skill-generator.ags--drawer {
    padding: 1.25rem 1rem 1.75rem;
  }
  #ags-skill-generator .ags-profile-grid,
  #ags-skill-generator.ags--drawer .ags-profile-grid {
    grid-template-columns: 1fr;
  }
  #ags-skill-generator .ags-types-grid,
  #ags-skill-generator.ags--drawer .ags-types-grid {
    grid-template-columns: 1fr;
  }
  #ags-skill-generator .ags-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }
  #ags-skill-generator .ags-actions .ags-btn--ghost {
    margin-right: 0;
  }
  #ags-skill-generator .ags-actions .ags-btn {
    width: 100%;
  }
}
#ags-skill-generator .ags-text { margin: 0 0 1rem; line-height: 1.5; color: var(--agilo-text-secondary); }
#ags-skill-generator .ags-text--muted { font-size: 0.9rem; }
#ags-skill-generator .ags-lead { color: var(--agilo-text-secondary); }
#ags-skill-generator .ags-spinner {
  width: 2.5rem; height: 2.5rem; margin: 0 auto 1rem;
  border: 3px solid var(--agilo-border);
  border-top-color: var(--agilo-primary);
  border-radius: 50%;
  animation: ags-spin 0.8s linear infinite;
}
@keyframes ags-spin { to { transform: rotate(360deg); } }
#ags-skill-generator .ags-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.65rem 1.25rem; border-radius: 0.65rem; font-weight: 600;
  font-size: 0.95rem; cursor: pointer; border: 1px solid transparent;
  text-decoration: none; transition: background 0.15s, border-color 0.15s;
}
#ags-skill-generator .ags-btn--primary {
  background: var(--agilo-primary); color: #fff; border-color: var(--agilo-primary);
}
#ags-skill-generator .ags-btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
}
#ags-skill-generator .ags-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
#ags-skill-generator .ags-btn--ghost {
  background: transparent; color: var(--agilo-primary);
  border-color: color-mix(in srgb, var(--agilo-primary) 30%, transparent);
  margin-top: 0;
}
#ags-skill-generator .ags-head { margin-bottom: 1.5rem; }
#ags-skill-generator .ags-stepper { margin-bottom: 1.5rem; }
#ags-skill-generator .ags-stepper-track {
  height: 4px; background: var(--agilo-border); border-radius: 2px; overflow: hidden;
}
#ags-skill-generator .ags-stepper-fill {
  height: 100%; width: 0; background: var(--agilo-primary);
  transition: width 0.25s ease;
}
#ags-skill-generator .ags-stepper-labels {
  display: flex; justify-content: space-between; list-style: none;
  padding: 0.5rem 0 0; margin: 0; font-size: 0.8rem;
  color: var(--agilo-text-secondary);
}
#ags-skill-generator .ags-stepper-label--active { color: var(--agilo-primary); font-weight: 600; }
#ags-skill-generator .ags-stepper-label--done { color: var(--agilo-text); }
#ags-skill-generator .ags-panel { display: none; }
#ags-skill-generator .ags-panel--active { display: block; }
#ags-skill-generator .ags-panel-title { font-size: 1.1rem; margin: 0 0 1rem; }
#ags-skill-generator .ags-profile-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem; margin-bottom: 0;
  align-items: stretch;
}
#ags-skill-generator .ags-profile-card {
  display: flex; flex-direction: column; align-items: flex-start;
  text-align: left; padding: 0.75rem 0.8rem; border-radius: 0.75rem;
  border: 1px solid var(--agilo-border); background: var(--agilo-surface);
  cursor: pointer; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  min-height: 4.25rem; width: 100%;
}
#ags-skill-generator .ags-profile-card--custom {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--agilo-primary) 28%, var(--agilo-border));
  background: color-mix(in srgb, var(--agilo-primary) 4%, var(--agilo-surface));
}
#ags-skill-generator .ags-profile-card--selected {
  border-color: var(--agilo-primary);
  border-style: solid;
  background: var(--agilo-primary-soft);
  box-shadow: 0 2px 10px rgba(23, 74, 150, 0.1);
}
#ags-skill-generator .ags-profile-card-title { display: block; font-weight: 600; font-size: 0.875rem; line-height: 1.3; }
#ags-skill-generator .ags-profile-card-meta {
  display: block; font-size: 0.68rem; color: var(--agilo-text-secondary);
  margin-top: 0.3rem; word-break: break-word; line-height: 1.35;
}
#ags-skill-generator .ags-inline-types {
  margin-top: 1.35rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--agilo-border);
  animation: ags-fadein 0.22s ease;
}
#ags-skill-generator .ags-inline-types-head {
  margin-bottom: 0.85rem;
}
#ags-skill-generator .ags-inline-types-head .ags-panel-title {
  margin-bottom: 0.35rem;
}
#ags-skill-generator .ags-inline-types-head .ags-text--muted {
  margin-bottom: 0;
}
@keyframes ags-fadein {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
#ags-skill-generator .ags-types-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 0.5rem; margin-bottom: 1rem;
}
#ags-skill-generator .ags-type-chip {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.5rem 0.65rem; border: 1px solid var(--agilo-border);
  border-radius: 0.5rem; font-size: 0.85rem; cursor: pointer;
}
#ags-skill-generator .ags-type-chip:has(input:checked) {
  border-color: var(--agilo-primary);
  background: var(--agilo-primary-soft);
}
#ags-skill-generator .ags-mode-field { border: 0; padding: 0; margin: 0 0 1rem; }
#ags-skill-generator .ags-radio { display: block; margin-bottom: 0.5rem; cursor: pointer; }
#ags-skill-generator .ags-badge {
  font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 0.25rem;
  background: var(--agilo-primary-soft); color: var(--agilo-primary);
}
#ags-skill-generator .ags-actions {
  display: flex; flex-wrap: nowrap; gap: 0.75rem; align-items: center;
  justify-content: flex-end;
  margin-top: 1.35rem;
  width: 100%;
}
#ags-skill-generator .ags-actions .ags-btn--ghost {
  margin-right: auto;
}
#ags-skill-generator .ags-actions--configure {
  padding-top: 0.25rem;
}
#ags-skill-generator .ags-recap {
  display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 1rem;
  margin: 0 0 1rem; font-size: 0.9rem;
}
#ags-skill-generator .ags-recap dt { font-weight: 600; color: var(--agilo-text-secondary); }
#ags-skill-generator .ags-recap dd { margin: 0; }
#ags-skill-generator .ags-error { color: var(--agilo-error); font-size: 0.9rem; margin: 0 0 0.75rem; }
#ags-skill-generator .ags-install {
  margin-top: 1.5rem; padding: 1rem; border-radius: 0.75rem;
  background: var(--agilo-surface-2); border: 1px solid var(--agilo-border);
}
#ags-skill-generator .ags-install-title { margin: 0 0 0.75rem; font-size: 1rem; }
#ags-skill-generator .ags-install-steps { margin: 0; padding-left: 1.25rem; line-height: 1.6; font-size: 0.9rem; }
#ags-skill-generator code { font-size: 0.85em; background: rgba(0,0,0,0.05); padding: 0.1em 0.35em; border-radius: 0.25em; font-family: "SF Mono", "Fira Code", monospace; }
#ags-skill-generator .ags-install-steps-visual {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 1.25rem;
}
#ags-skill-generator .ags-install-step {
  display: flex; gap: 1rem; align-items: flex-start;
}
#ags-skill-generator .ags-install-step-icon {
  flex-shrink: 0;
  width: 2.25rem; height: 2.25rem;
  border-radius: 50%;
  background: var(--agilo-surface-2);
  border: 1px solid var(--agilo-border);
  display: flex; align-items: center; justify-content: center;
  color: var(--agilo-primary);
}
#ags-skill-generator .ags-install-step-icon svg { width: 1.1rem; height: 1.1rem; }
#ags-skill-generator .ags-install-step-icon--done {
  background: color-mix(in srgb, #22c55e 15%, #fff);
  border-color: color-mix(in srgb, #22c55e 35%, transparent);
  color: #16a34a;
}
#ags-skill-generator .ags-install-step-body { flex: 1; min-width: 0; padding-top: 0.15rem; }
#ags-skill-generator .ags-install-step-label { display: block; font-size: 0.9rem; margin-bottom: 0.3rem; }
#ags-skill-generator .ags-install-step-desc { margin: 0; font-size: 0.8125rem; line-height: 1.55; color: var(--agilo-text-secondary); }
#ags-skill-generator .ags-badge--success {
  background: color-mix(in srgb, #22c55e 18%, #fff);
  color: #16a34a; border: 1px solid color-mix(in srgb, #22c55e 30%, transparent);
  font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 1rem; font-weight: 600;
}
#ags-skill-generator .ags-success-header {
  text-align: center; margin-bottom: 1.75rem;
}
#ags-skill-generator .ags-success-check {
  color: #22c55e; margin: 0 auto 0.85rem;
  width: 3.25rem; height: 3.25rem; display: flex; align-items: center; justify-content: center;
}
#ags-skill-generator .ags-success-check svg { width: 100%; height: 100%; }
#ags-skill-generator .ags-title--sm { font-size: 1.15rem; margin: 0; }
#ags-skill-generator .ags-actions--success, #ags-skill-generator .ags-actions--installed {
  margin-top: 1.75rem;
}
#ags-skill-generator .ags-installed-header {
  margin-bottom: 1.25rem;
}
#ags-skill-generator .ags-installed-config {
  background: var(--agilo-surface-2); border: 1px solid var(--agilo-border);
  border-radius: 0.75rem; padding: 0.85rem 1rem;
  margin-bottom: 0.25rem;
}
#ags-skill-generator .ags-installed-row {
  display: flex; gap: 0.5rem; align-items: baseline;
  font-size: 0.875rem; margin-bottom: 0.35rem;
}
#ags-skill-generator .ags-installed-label {
  font-weight: 600; color: var(--agilo-text-secondary); min-width: 5rem; flex-shrink: 0;
}
#ags-skill-generator .ags-installed-types {
  display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.65rem;
}
#ags-skill-generator .ags-type-badge {
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 0.35rem;
  background: var(--agilo-primary-soft); color: var(--agilo-primary);
  border: 1px solid color-mix(in srgb, var(--agilo-primary) 22%, transparent);
}
#ags-skill-generator .ags-installed-sep {
  border: 0; border-top: 1px solid var(--agilo-border); margin: 1.5rem 0;
}
#ags-skill-generator .ags-install-guide-title {
  font-size: 0.95rem; font-weight: 700; margin: 0 0 1rem; color: var(--agilo-text);
}
</style>
'''

html_out = HTML_TEMPLATE.replace("__ASSETS_JSON__", assets_json).replace(
    "__CLAUDE_LOGO__", CLAUDE_LOGO_URL
)
OUT.write_text(html_out, encoding="utf-8")
print(f"Written: {OUT} ({OUT.stat().st_size} bytes)")
