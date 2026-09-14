/**
 * Unlock picker CSE : hasCse → Ajouter, pas Voir l’offre. STANDARD 7 masqué.
 * Exécution : node --test tests/library-cse-unlock.test.js
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

global.__AGILO_PROMPT_LIBRARY__ = {
  library2Live: true,
  cse89Live: true,
  ctaCseLandingUrl: "/offres/cse",
  ctaAnnualUrl: "/offres/cse?pay=prc_cse89y-vf20nyv",
  ctaMonthlyUrl: "/offres/cse?pay=prc_cse89-rr10n0l"
};

require("../scripts/pages/library/library-api.js");
require("../scripts/pages/library/library-picker.js");

const Api = global.AgiloLibraryApi;
const Picker = global.AgiloLibraryPicker;

function packModel(extra) {
  return Object.assign({
    promptModelId: -10,
    cardTitle: "Procès-verbal CSE détaillé",
    type: "STANDARD",
    packCse: true,
    canUse: false,
    requiresUserCopy: true,
    canCopyOfficial: false,
    lockReasonCode: "SUBSCRIPTION_ACCESS_REQUIRED",
    lockReasonMessage: "Pack CSE requis",
    promptModelStatus: "READY"
  }, extra || {});
}

describe("library CSE unlock", () => {
  beforeEach(() => {
    Api.setMemberAccess({ hasCse: false, noun: "compte rendu", sources: [], businessTypes: [] });
  });

  it("masque le STANDARD id 7", () => {
    assert.equal(Api.isHiddenOfficial(7), true);
    assert.equal(Api.isHiddenOfficial(5), false);
    const kept = Api.filterHiddenOfficial([
      { promptModelId: 7, cardTitle: "ancien" },
      { promptModelId: -10, cardTitle: "détail" }
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].promptModelId, -10);
  });

  it("parseMemberAccess lit businessTypes cse et le préfixe pln_cse-", () => {
    const byType = Api.parseMemberAccess({
      ok: true,
      data: { businessTypes: ["generic", "cse"], sources: [] }
    });
    assert.equal(byType.hasCse, true);
    const bySource = Api.parseMemberAccess({
      ok: true,
      data: { businessTypes: ["generic"], sources: ["plan:pln_cse-ic00nme"] }
    });
    assert.equal(bySource.hasCse, true);
    const closed = Api.parseMemberAccess({
      ok: true,
      data: { businessTypes: ["generic"], sources: [] }
    });
    assert.equal(closed.hasCse, false);
  });

  it("ctaForLocked disparait si hasCse", () => {
    const unpaid = Api.ctaForLocked(true, false);
    assert.ok(unpaid);
    assert.equal(unpaid.href.indexOf("/offres/cse") === 0, true);
    assert.equal(Api.ctaForLocked(true, true), null);
  });

  it("applyCseUnlock ouvre la copie USER", () => {
    const unlocked = Api.applyCseUnlock([packModel()], { hasCse: true });
    assert.equal(unlocked.length, 1);
    assert.equal(unlocked[0].canCopyOfficial, true);
    assert.equal(unlocked[0].requiresUserCopy, true);
    assert.equal(unlocked[0].lockReasonCode, "");
    const hiddenGone = Api.applyCseUnlock(
      [packModel(), { promptModelId: 7, packCse: false, cardTitle: "ancien" }],
      { hasCse: true }
    );
    assert.equal(hiddenGone.some(function (m) { return m.promptModelId === 7; }), false);
  });

  it("picker : sans CSE → offre, avec CSE → Ajouter", () => {
    const m = packModel();
    Api.setMemberAccess({ hasCse: false });
    assert.equal(Picker._addKind(m, true), "cse-pack");
    assert.equal(Picker._canSelect(m), false);
    assert.equal(Picker._showAdd(m, true), false);

    Api.setMemberAccess({ hasCse: true });
    assert.equal(Picker._addKind(m, true), "duplicate");
    assert.equal(Picker._showAdd(m, true), true);
    assert.equal(Picker._canSelect(m), false);

    const copied = packModel({ acquiredPromptModelId: 801 });
    assert.equal(Picker._addKind(copied, true), "select-copy");
    assert.equal(Picker._canSelect(copied), true);
  });

  it("picker v2.2.1 et api 1.5.6", () => {
    assert.equal(Picker.VERSION, "2.2.1");
    assert.equal(Api.VERSION, "1.5.6");
  });
});

function matchSimple(el, simple) {
  if (!el || !el.attrs) return false;
  const idm = simple.match(/^#([\w-]+)$/);
  if (idm) return el.attrs.id === idm[1];
  const attrm = simple.match(/^\[([^=\]]+)="([^"]*)"\]$/);
  if (attrm) return String(el.attrs[attrm[1]] || "") === attrm[2];
  if (simple.charAt(0) === ".") {
    const need = simple.split(".").filter(Boolean);
    const have = String(el.attrs.class || "").split(/\s+/);
    return need.every((c) => have.indexOf(c) !== -1);
  }
  return false;
}

function matchesPath(el, sel) {
  const parts = sel.trim().split(/\s+/);
  if (!matchSimple(el, parts[parts.length - 1])) return false;
  let node = el.parentNode;
  for (let i = parts.length - 2; i >= 0; i--) {
    while (node && !matchSimple(node, parts[i])) node = node.parentNode;
    if (!node) return false;
    node = node.parentNode;
  }
  return true;
}

function FakeEl(tag, attrs, kids) {
  this.tagName = String(tag).toUpperCase();
  this.attrs = Object.assign({}, attrs || {});
  this.childNodes = [];
  this.parentNode = null;
  this._text = "";
  this.checked = !!this.attrs.checked;
  if (typeof kids === "string") this._text = kids;
  else if (Array.isArray(kids)) kids.forEach((c) => this.appendChild(c));
}

FakeEl.prototype.appendChild = function (c) {
  c.parentNode = this;
  this.childNodes.push(c);
  return c;
};

Object.defineProperty(FakeEl.prototype, "textContent", {
  get() {
    if (this.childNodes.length) return this.childNodes.map((c) => c.textContent).join("");
    return this._text;
  },
  set(v) {
    this.childNodes = [];
    this._text = String(v);
  }
});

FakeEl.prototype.getAttribute = function (k) {
  return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
};

FakeEl.prototype.setAttribute = function (k, v) {
  this.attrs[k] = String(v);
};

FakeEl.prototype.closest = function (sel) {
  let n = this;
  while (n) {
    if (matchSimple(n, sel)) return n;
    n = n.parentNode;
  }
  return null;
};

FakeEl.prototype.querySelectorAll = function (sel) {
  const out = [];
  const walk = (node) => {
    (node.childNodes || []).forEach((child) => {
      if (matchesPath(child, sel)) out.push(child);
      walk(child);
    });
  };
  walk(this);
  return out;
};

FakeEl.prototype.querySelector = function (sel) {
  return this.querySelectorAll(sel)[0] || null;
};

function FakeDoc(root) {
  this.documentElement = root;
}

FakeDoc.prototype.getElementById = function (id) {
  return this.querySelector("#" + id);
};

FakeDoc.prototype.querySelector = function (sel) {
  if (matchesPath(this.documentElement, sel)) return this.documentElement;
  return this.documentElement.querySelector(sel);
};

FakeDoc.prototype.querySelectorAll = function (sel) {
  const out = [];
  if (matchesPath(this.documentElement, sel)) out.push(this.documentElement);
  return out.concat(this.documentElement.querySelectorAll(sel));
};

function dashboardFixture() {
  const toggleLabel = new FakeEl("div", { class: "text-size-small text-color-grey" }, "Générer le compte rendu");
  const speakers = new FakeEl("div", { class: "text-size-small" }, "Jusqu’à 5 intervenants");
  const selectTitle = new FakeEl("div", { class: "text-size-small text-weight-bold" }, "Sélectionnez un modèle de compte rendu :");
  const anchor = new FakeEl("div", { id: "agilo-prompt-picker-anchor" });
  const root = new FakeEl("div", {}, [
    new FakeEl("div", { class: "checkbox-component" }, [
      new FakeEl("label", { "data-visual-for": "toggle-summary" }, [
        new FakeEl("input", {
          id: "toggle-summary",
          name: "toggle-summary",
          "data-option-type": "summary"
        }),
        new FakeEl("span", { class: "checkbox-label w-form-label" }, "Off/ On")
      ]),
      toggleLabel
    ]),
    speakers,
    new FakeEl("div", { class: "select-container" }, [
      new FakeEl("div", { class: "wrapper-info" }, [selectTitle]),
      anchor
    ])
  ]);
  return { doc: new FakeDoc(root), toggleLabel, speakers, selectTitle };
}

describe("dashboard noun PV", () => {
  it("copyForNoun distingue PV et compte rendu", () => {
    const pv = Picker._copyForNoun("PV");
    assert.equal(pv.toggle, "Générer le PV");
    assert.equal(pv.selectTitle, "Sélectionnez un modèle de PV :");
    assert.match(pv.hint, /Le PV est désactivé/);
    const cr = Picker._copyForNoun("compte rendu");
    assert.equal(cr.toggle, "Générer le compte rendu");
    assert.match(cr.hint, /Le compte rendu est désactivé/);
  });

  it("hasCse true réécrit toggle, titre, pas l’intervenants", () => {
    const fx = dashboardFixture();
    Api.setMemberAccess({ hasCse: true, noun: "PV", sources: [], businessTypes: ["cse"] });
    Picker._applyDashboardNoun(fx.doc);
    assert.equal(fx.toggleLabel.textContent, "Générer le PV");
    assert.equal(fx.selectTitle.textContent, "Sélectionnez un modèle de PV :");
    assert.equal(fx.speakers.textContent, "Jusqu’à 5 intervenants");
    assert.equal(fx.toggleLabel.getAttribute("data-agilo-noun"), "pv");
  });

  it("hasCse false laisse le HTML Webflow", () => {
    const fx = dashboardFixture();
    Api.setMemberAccess({ hasCse: false, noun: "compte rendu", sources: [], businessTypes: [] });
    Picker._applyDashboardNoun(fx.doc);
    assert.equal(fx.toggleLabel.textContent, "Générer le compte rendu");
    assert.equal(fx.selectTitle.textContent, "Sélectionnez un modèle de compte rendu :");
    assert.equal(fx.toggleLabel.getAttribute("data-agilo-noun"), null);
  });

  it("applyDashboardNoun deux fois ne double pas le texte", () => {
    const fx = dashboardFixture();
    Api.setMemberAccess({ hasCse: true, noun: "PV" });
    Picker._applyDashboardNoun(fx.doc);
    Picker._applyDashboardNoun(fx.doc);
    assert.equal(fx.toggleLabel.textContent, "Générer le PV");
    assert.equal(fx.selectTitle.textContent, "Sélectionnez un modèle de PV :");
  });

  it("hintHtml suit le noun", () => {
    Api.setMemberAccess({ hasCse: true, noun: "PV" });
    assert.match(Picker._hintHtml(false), /Le PV est désactivé/);
    Api.setMemberAccess({ hasCse: false, noun: "compte rendu" });
    assert.match(Picker._hintHtml(false), /Le compte rendu est désactivé/);
    assert.equal(Picker._hintHtml(true), "");
  });
});
