/**
 * Picker dashboard mots à surveiller : catalogue, READY, URL Gérer.
 * Exécution : node --test tests/agilo-wb-picker.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("../scripts/pages/dashboard/agilo-wb-picker.js");

const Picker = global.AgiloWbPicker;

describe("agilo-wb-picker", () => {
  it("expose la version 1.0.0", () => {
    assert.equal(Picker.VERSION, "1.0.0");
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

  it("pointe Gérer vers l’onglet mots-clés du palier", () => {
    assert.equal(
      Picker.profileManageUrl("/app/business/"),
      "/app/business/profile?tab=mots-cles"
    );
    assert.equal(
      Picker.profileManageUrl("/app/premium/dashboard"),
      "/app/premium/profile?tab=mots-cles"
    );
    assert.equal(
      Picker.profileManageUrl("/app/free/"),
      "/app/free/profile?tab=mots-cles"
    );
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

  it("filtre les thèmes non READY si un statut est fourni", () => {
    const cat = Picker.parseCatalog({
      defaultBoostId: 1,
      boostNamesDTOList: [
        { boostId: 1, boostName: "Prêt", wordboostStatus: "READY" },
        { boostId: 2, boostName: "En cours", wordboostStatus: "PENDING" },
        { boostId: 3, boostName: "Erreur", status: "ERROR" }
      ]
    });
    assert.equal(cat.list.length, 1);
    assert.equal(cat.list[0].id, 1);
    assert.equal(Picker.isSelectableTheme({ wordboostStatus: "" }), true);
    assert.equal(Picker.isSelectableTheme({ wordboostStatus: "READY" }), true);
    assert.equal(Picker.isSelectableTheme({ wordboostStatus: "PENDING" }), false);
  });
});
