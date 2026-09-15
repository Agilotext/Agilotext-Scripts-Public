/**
 * Picker dashboard mots à surveiller : catalogue Mon compte, visibilité.
 * Exécution : node --test tests/agilo-wb-picker.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("../scripts/pages/dashboard/agilo-wb-picker.js");

const Picker = global.AgiloWbPicker;

describe("agilo-wb-picker", () => {
  it("expose la version 1.2.0", () => {
    assert.equal(Picker.VERSION, "1.2.0");
    assert.equal(Picker.STYLE_ID, "agilo-wb-picker-style-120");
  });

  it("déduit l’édition et le slug profil depuis le chemin", () => {
    assert.equal(Picker.editionFromPath("/app/business/"), "ent");
    assert.equal(Picker.editionFromPath("/app/premium/"), "pro");
    assert.equal(Picker.editionFromPath("/app/pro/"), "pro");
    assert.equal(Picker.editionFromPath("/app/free/"), "free");
    assert.equal(Picker.profileSlugFromPath("/app/business/"), "business");
    assert.equal(Picker.profileSlugFromPath("/app/premium/"), "premium");
    assert.equal(Picker.profileSlugFromPath("/app/free/"), "free");
  });

  it("parse le catalogue et garde le thème par défaut", () => {
    const cat = Picker.parseCatalog({
      status: "OK",
      defaultBoostId: 12,
      boostNamesDTOList: [
        { boostId: 12, boostName: "CSE" },
        { boostId: 8, boostName: "Générique" }
      ]
    });
    assert.equal(cat.defaultId, 12);
    assert.equal(cat.list.length, 2);
    assert.equal(cat.list[0].name, "CSE");
    assert.equal(Picker.optionLabel(cat.list[0], 12), "CSE (défaut)");
    assert.equal(Picker.optionLabel(cat.list[1], 12), "Générique");
  });

  it("garde tous les thèmes, même non READY", () => {
    const cat = Picker.parseCatalog({
      defaultBoostId: 2,
      boostNamesDTOList: [
        { boostId: 1, boostName: "Prêt", wordboostStatus: "READY" },
        { boostId: 2, boostName: "En cours", wordboostStatus: "PENDING" },
        { boostId: 3, boostName: "Erreur", status: "ERROR" }
      ]
    });
    assert.equal(cat.list.length, 3);
    assert.equal(cat.defaultId, 2);
  });

  it("pick : défaut, puis lastKey, puis premier", () => {
    const cat = Picker.parseCatalog({
      defaultBoostId: 12,
      boostNamesDTOList: [
        { boostId: 8, boostName: "Générique" },
        { boostId: 12, boostName: "CSE" },
        { boostId: 3, boostName: "Autre" }
      ]
    });
    assert.equal(Picker.pickCurrentId(cat, 3), 12);
    const noDef = Picker.parseCatalog({
      defaultBoostId: 99,
      boostNamesDTOList: [
        { boostId: 8, boostName: "Générique" },
        { boostId: 3, boostName: "Autre" }
      ]
    });
    assert.equal(Picker.pickCurrentId(noDef, 3), 3);
    assert.equal(Picker.pickCurrentId(noDef, 0), 8);
  });

  it("normalise une edition bizarre vers le chemin", () => {
    const creds = Picker.normalizeCreds({
      email: "a@b.c",
      token: "t",
      edition: "team"
    });
    assert.equal(creds.edition, "ent");
    assert.equal(creds.username, "a@b.c");
    const pro = Picker.normalizeCreds({
      email: "a@b.c",
      token: "t",
      edition: "premium"
    });
    assert.equal(pro.edition, "pro");
  });

  it("révèle seulement un OK avec au moins un thème", () => {
    const filled = Picker.parseCatalog({
      status: "OK",
      defaultBoostId: 12,
      boostNamesDTOList: [{ boostId: 12, boostName: "test" }]
    });
    const empty = Picker.parseCatalog({
      status: "OK",
      defaultBoostId: 0,
      boostNamesDTOList: []
    });
    assert.equal(Picker.shouldReveal(true, filled), true);
    assert.equal(Picker.shouldReveal(true, empty), false);
    assert.equal(Picker.shouldReveal(false, filled), false);
    assert.equal(Picker.shouldReveal(false, empty), false);
  });

  it("verrouille Free et laisse Pro/Business ouverts", () => {
    assert.equal(Picker.shouldLock("free"), true);
    assert.equal(Picker.shouldLock("pro"), false);
    assert.equal(Picker.shouldLock("ent"), false);
    const html = Picker.innerHtmlLocked();
    assert.equal(html.indexOf("agilo-wb-select") === -1, true);
    assert.equal(html.indexOf('id="agilo-wb-lock"') !== -1, true);
    assert.equal(html.indexOf("réservé Pro et Business") !== -1, true);
  });
});
