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

HTML_TEMPLATE = r'''<!-- Agiloshield Skill Generator — embed Webflow v1 -->
<div id="ags-skill-generator" class="ags-root" data-ms-code-skill-generator="form">
  <div id="ags-screen-loading" class="ags-screen ags-screen--active" aria-live="polite">
    <div class="ags-spinner" aria-hidden="true"></div>
    <p class="ags-lead">Vérification de votre accès…</p>
  </div>

  <div id="ags-screen-noauth" class="ags-screen" hidden>
    <h2 class="ags-title">Connexion requise</h2>
    <p class="ags-text">Connectez-vous à votre compte Agilotext pour générer votre skill Agiloshield.</p>
    <a class="ags-btn ags-btn--primary" href="/auth/login">Se connecter</a>
  </div>

  <div id="ags-screen-upsell" class="ags-screen" hidden>
    <h2 class="ags-title">Générez votre skill Agiloshield</h2>
    <p class="ags-text">Cette fonctionnalité est réservée aux abonnés <strong>Agiloshield Classic</strong>.</p>
    <p class="ags-text ags-text--muted">Pseudonymisez vos documents dans Claude Cowork avant toute analyse — sans exposer vos données sensibles.</p>
    <a id="ags-pricing-link" class="ags-btn ags-btn--primary" href="/tools/agiloshield/tarifs">Voir les tarifs →</a>
    <button type="button" class="ags-btn ags-btn--ghost" id="ags-reload-access">Déjà abonné ? Recharger la page</button>
  </div>

  <div id="ags-screen-pending" class="ags-screen" hidden>
    <h2 class="ags-title">Votre abonnement est en cours d'activation</h2>
    <p class="ags-text">Cela peut prendre 1 à 2 minutes après le paiement. Rechargez la page dans un instant.</p>
    <button type="button" class="ags-btn ags-btn--primary" id="ags-reload-pending">Recharger</button>
  </div>

  <div id="ags-screen-form" class="ags-screen" hidden>
    <header class="ags-head">
      <h2 class="ags-title">Générateur de skill Agiloshield</h2>
      <p class="ags-text ags-text--muted">Configurez votre skill Claude Cowork en 3 étapes.</p>
    </header>

    <nav class="ags-stepper" aria-label="Étapes">
      <div class="ags-stepper-track" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1">
        <div class="ags-stepper-fill" id="ags-stepper-fill"></div>
      </div>
      <ol class="ags-stepper-labels">
        <li class="ags-stepper-label ags-stepper-label--active" data-step="1">Profil</li>
        <li class="ags-stepper-label" data-step="2">Types</li>
        <li class="ags-stepper-label" data-step="3">Télécharger</li>
      </ol>
    </nav>

    <section class="ags-panel ags-panel--active" data-panel="1">
      <h3 class="ags-panel-title">Quel est votre profil métier ?</h3>
      <div class="ags-profile-grid" id="ags-profile-grid" role="radiogroup" aria-label="Profil métier"></div>
      <div class="ags-actions">
        <button type="button" class="ags-btn ags-btn--primary" id="ags-next-1" disabled>Continuer</button>
      </div>
    </section>

    <section class="ags-panel" data-panel="2" hidden>
      <h3 class="ags-panel-title">Types de données à masquer</h3>
      <p class="ags-text ags-text--muted">Cochez au minimum 2 types. Vous pouvez ajuster le profil choisi.</p>
      <div class="ags-types-grid" id="ags-types-grid"></div>
      <fieldset class="ags-mode-field">
        <legend class="ags-panel-title">Mode</legend>
        <label class="ags-radio"><input type="radio" name="ags-mode" value="pseudonymize" checked> Pseudonymiser <span class="ags-badge">recommandé</span></label>
        <label class="ags-radio"><input type="radio" name="ags-mode" value="anonymize"> Anonymiser <span class="ags-text--muted">(irréversible)</span></label>
      </fieldset>
      <p class="ags-error" id="ags-types-error" hidden>Sélectionnez au moins 2 types.</p>
      <div class="ags-actions">
        <button type="button" class="ags-btn ags-btn--ghost" id="ags-back-2">Retour</button>
        <button type="button" class="ags-btn ags-btn--primary" id="ags-next-2">Continuer</button>
      </div>
    </section>

    <section class="ags-panel" data-panel="3" hidden>
      <h3 class="ags-panel-title">Récapitulatif</h3>
      <dl class="ags-recap" id="ags-recap"></dl>
      <p class="ags-error" id="ags-gen-error" hidden></p>
      <div class="ags-actions">
        <button type="button" class="ags-btn ags-btn--ghost" id="ags-back-3">Retour</button>
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" defer></script>
<script>
(function () {
  "use strict";

  const ROOT_ID = "ags-skill-generator";
  const AGILOSHIELD_CLASSIC_PRICE_ID = "prc_classic-mensuel-3u5vr0uq5";
  const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING", "GRACE"]);
  const PRICING_BASE = "/tools/agiloshield/tarifs";
  const RETURN_PATH = "/tools/agiloshield/generate-skill";
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

  const state = {
    step: 1,
    profile: "",
    types: [],
    mode: "pseudonymize",
    email: "",
    member: null,
    hasAccess: false
  };

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
      initForm();
      showScreen("ags-screen-form");
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
      btn.className = "ags-profile-card";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.dataset.profile = key;
      btn.innerHTML = "<span class=\"ags-profile-card-title\">" + PROFILE_LABELS[key] + "</span>" +
        "<span class=\"ags-profile-card-meta\">" + (PROFILE_TYPES[key].length ? PROFILE_TYPES[key].join(", ") : "Choix libre") + "</span>";
      btn.addEventListener("click", () => selectProfile(key));
      grid.appendChild(btn);
    });
  }

  function selectProfile(key) {
    state.profile = key;
    state.types = PROFILE_TYPES[key].slice();
    $$(".ags-profile-card", $("#ags-profile-grid")).forEach((c) => {
      const on = c.dataset.profile === key;
      c.classList.toggle("ags-profile-card--selected", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
    $("#ags-next-1").disabled = !key;
    syncTypeCheckboxes();
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
    const ok = state.types.length >= MIN_TYPES;
    const err = $("#ags-types-error");
    if (err) err.hidden = ok;
    $("#ags-next-2").disabled = !ok;
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
    if (fill) fill.style.width = ((n - 1) / 2 * 100) + "%";
    const track = $(".ags-stepper-track");
    if (track) track.setAttribute("aria-valuenow", String(n));
    if (n === 3) renderRecap();
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

  function bindFormEvents() {
    $("#ags-next-1")?.addEventListener("click", () => {
      if (!state.profile) return;
      syncTypeCheckboxes();
      goToStep(2);
    });
    $("#ags-back-2")?.addEventListener("click", () => goToStep(1));
    $("#ags-next-2")?.addEventListener("click", () => {
      if (!validateTypes()) return;
      state.mode = $('input[name="ags-mode"]:checked')?.value || "pseudonymize";
      goToStep(3);
    });
    $("#ags-back-3")?.addEventListener("click", () => goToStep(2));
    $("#ags-download")?.addEventListener("click", downloadSkill);
    $$("#ags-types-grid input").forEach((cb) => cb.addEventListener("change", validateTypes));
    $$('input[name="ags-mode"]').forEach((r) => r.addEventListener("change", () => {
      state.mode = r.value;
    }));
    $("#ags-reload-access")?.addEventListener("click", () => window.location.reload());
    $("#ags-reload-pending")?.addEventListener("click", () => window.location.reload());
  }

  document.addEventListener("DOMContentLoaded", resolveAccess);
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
#ags-skill-generator #ags-screen-form .ags-title { text-align: left; }
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
  margin-top: 0.75rem;
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
  display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.75rem; margin-bottom: 1.25rem;
}
#ags-skill-generator .ags-profile-card {
  text-align: left; padding: 0.85rem; border-radius: 0.75rem;
  border: 1px solid var(--agilo-border); background: var(--agilo-surface);
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
#ags-skill-generator .ags-profile-card--selected {
  border-color: var(--agilo-primary);
  background: var(--agilo-primary-soft);
}
#ags-skill-generator .ags-profile-card-title { display: block; font-weight: 600; font-size: 0.9rem; }
#ags-skill-generator .ags-profile-card-meta {
  display: block; font-size: 0.7rem; color: var(--agilo-text-secondary);
  margin-top: 0.35rem; word-break: break-word;
}
#ags-skill-generator .ags-types-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
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
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
  margin-top: 1rem;
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
#ags-skill-generator code { font-size: 0.85em; background: rgba(0,0,0,0.05); padding: 0.1em 0.35em; border-radius: 0.25em; }
@media (max-width: 480px) {
  #ags-skill-generator .ags-profile-grid { grid-template-columns: 1fr 1fr; }
}
</style>
'''

OUT.write_text(
    HTML_TEMPLATE.replace("__ASSETS_JSON__", assets_json),
    encoding="utf-8",
)
print(f"Written: {OUT} ({OUT.stat().st_size} bytes)")
