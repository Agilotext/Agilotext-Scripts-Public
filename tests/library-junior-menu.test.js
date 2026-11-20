/**
 * Menu junior : copies positives de -12 -13 -14, option 7 retirée seulement pour un junior sans CSE.
 * Exécution : node --test tests/library-junior-menu.test.js
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

global.__AGILO_PROMPT_LIBRARY__ = { library2Live: true, cse89Live: true };

require("../scripts/pages/library/library-api.js");
require("../scripts/pages/library/library-picker.js");

const Api = global.AgiloLibraryApi;
const Picker = global.AgiloLibraryPicker;

const GENERICS = [
  [0, "Compte rendu classique"],
  [1, "Compte rendu de webinaire"],
  [2, "Compte rendu SWOT"],
  [3, "Modèle Pour Commerciaux (CAB)"],
  [4, "Résumé de cours"],
  [5, "PV de réunion générique"],
  [6, "Dictée vocale avec ponctuation"]
];

function fakeSelect(withCse) {
  const pairs = GENERICS.slice();
  if (withCse) pairs.push([7, "PV de réunion CSE"]);
  const options = pairs.map(function (p) {
    return { value: String(p[0]), textContent: p[1] };
  });
  return {
    options: options,
    classList: { add: function () {} },
    required: false,
    remove: function (i) { options.splice(i, 1); },
    appendChild: function (opt) { options.push(opt); },
    value: ""
  };
}

function juniorRow(id, title, copyId) {
  return {
    promptModelId: id,
    cardTitle: title,
    type: "STANDARD",
    packJunior: true,
    packCse: false,
    canUse: false,
    requiresUserCopy: true,
    promptModelStatus: "READY",
    acquiredPromptModelId: copyId || 0
  };
}

function cseRow() {
  return {
    promptModelId: -10,
    cardTitle: "Procès-verbal CSE détaillé",
    type: "STANDARD",
    packJunior: false,
    packCse: true,
    canUse: false,
    promptModelStatus: "READY"
  };
}

const JUNIORS = [
  juniorRow(-12, "Compte rendu d'appel", 901),
  juniorRow(-13, "Compte rendu de bureau", 902),
  juniorRow(-14, "Compte rendu de restitution", 903)
];

function values(select) {
  return Array.prototype.map.call(select.options, function (opt) {
    return { value: String(opt.value), text: opt.textContent };
  });
}

describe("menu junior", function () {
  beforeEach(function () {
    Api.setMemberAccess({ hasCse: false, hasJunior: false, noun: "compte rendu", sources: [], businessTypes: [] });
  });

  it("junior seul : trois copies positives, sans option 7, génériques conservés", function () {
    Api.setMemberAccess({ hasCse: false, hasJunior: true, businessTypes: ["junior"] });
    const select = fakeSelect(true);
    Picker._syncNative(select, JUNIORS.concat([cseRow()]), 0, { hasJunior: true, hasCse: false });
    const opts = values(select);
    const titles = opts.map(function (o) { return o.text; });
    assert.equal(titles.indexOf("PV de réunion CSE"), -1);
    assert.equal(opts.some(function (o) { return o.value === "7"; }), false);
    [-12, -13, -14].forEach(function (id) {
      assert.equal(opts.some(function (o) { return o.value === String(id); }), false);
    });
    assert.deepEqual(
      opts.filter(function (o) { return Number(o.value) >= 901; }).map(function (o) { return o.text; }),
      ["Compte rendu d'appel", "Compte rendu de bureau", "Compte rendu de restitution"]
    );
    GENERICS.forEach(function (pair) {
      assert.equal(opts.some(function (o) { return o.value === String(pair[0]) && o.text === pair[1]; }), true);
    });
    opts.filter(function (o) { return Number(o.value) >= 901; }).forEach(function (o) {
      assert.equal(Number(o.value) > 0, true);
    });
  });

  it("CSE seul : option 7 conservée, trames junior absentes", function () {
    Api.setMemberAccess({ hasCse: true, hasJunior: false, businessTypes: ["cse"] });
    const select = fakeSelect(true);
    Picker._syncNative(select, JUNIORS.concat([cseRow()]), 7, { hasJunior: false, hasCse: true });
    const opts = values(select);
    assert.equal(opts.some(function (o) { return o.value === "7" && o.text === "PV de réunion CSE"; }), true);
    ["Compte rendu d'appel", "Compte rendu de bureau", "Compte rendu de restitution"].forEach(function (title) {
      assert.equal(opts.some(function (o) { return o.text === title; }), false);
    });
    const visible = Picker._visibleModels(JUNIORS.concat([cseRow()]), true);
    assert.equal(visible.some(function (m) { return m.packJunior; }), false);
    assert.equal(visible.some(function (m) { return m.promptModelId === -10; }), true);
  });

  it("business sans junior : option 7 et génériques restent, trames junior absentes", function () {
    Api.setMemberAccess({ hasCse: false, hasJunior: false, businessTypes: ["generic"] });
    const select = fakeSelect(true);
    Picker._syncNative(select, JUNIORS, 0, { hasJunior: false, hasCse: false });
    const opts = values(select);
    assert.equal(opts.some(function (o) { return o.value === "7"; }), true);
    GENERICS.forEach(function (pair) {
      assert.equal(opts.some(function (o) { return o.value === String(pair[0]); }), true);
    });
    assert.equal(opts.some(function (o) { return Number(o.value) < 0 || Number(o.value) >= 901; }), false);
    const visible = Picker._visibleModels(JUNIORS.concat([cseRow()]), true);
    assert.equal(visible.some(function (m) { return m.packJunior; }), false);
  });

  it("ne recopie pas un standard déjà acquis", async function () {
    const calls = [];
    const origDup = Api.duplicate;
    const origLists = Api.fetchLists;
    Api.duplicate = function (creds, id) {
      calls.push(id);
      return Promise.resolve({ ok: true, promptModelId: 900 + Math.abs(id) });
    };
    Api.fetchLists = function () {
      return Promise.resolve({
        models: [
          juniorRow(-12, "Compte rendu d'appel", 912),
          juniorRow(-13, "Compte rendu de bureau", 913),
          juniorRow(-14, "Compte rendu de restitution", 914)
        ]
      });
    };
    try {
      const fresh = JUNIORS.map(function (m) {
        return Object.assign({}, m, { acquiredPromptModelId: 0 });
      });
      assert.deepEqual(Picker._copiesNeeded(fresh, { hasJunior: true, hasCse: false }), [-12, -13, -14]);
      assert.deepEqual(Picker._copiesNeeded(JUNIORS, { hasJunior: true, hasCse: false }), []);
      const pack = await Picker._ensureJuniorCopies({}, { models: fresh }, { hasJunior: true, hasCse: false });
      assert.deepEqual(calls, [-12, -13, -14]);
      calls.length = 0;
      await Picker._ensureJuniorCopies({}, pack, { hasJunior: true, hasCse: false });
      assert.deepEqual(calls, []);
      await Picker._ensureJuniorCopies({}, { models: fresh }, { hasJunior: true, hasCse: true });
      assert.deepEqual(calls, []);
    } finally {
      Api.duplicate = origDup;
      Api.fetchLists = origLists;
    }
  });
});
