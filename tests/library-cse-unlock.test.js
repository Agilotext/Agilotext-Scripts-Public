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

  it("picker v2.3.0 et api 1.6.0", () => {
    assert.equal(Picker.VERSION, "2.3.0");
    assert.equal(Api.VERSION, "1.6.0");
  });

  it("dashboardCopy : PV seulement si hasCse et modèle CSE", () => {
    const pack = packModel();
    const cab = { promptModelId: 3, type: "STANDARD", cardTitle: "CAB", packCse: false };
    Api.setMemberAccess({ hasCse: false });
    assert.equal(Api.dashboardCopy(pack).summary, "Générer le compte rendu");
    Api.setMemberAccess({ hasCse: true });
    assert.equal(Api.dashboardCopy(pack).summary, "Générer le PV");
    assert.equal(Api.dashboardCopy(pack).pickerTitle.indexOf("procès-verbal") !== -1, true);
    assert.equal(Api.dashboardCopy(cab).summary, "Générer le compte rendu");
    assert.equal(Api.dashboardCopy(cab).maestroStem.indexOf("CR plus fiable") !== -1, true);
  });

  it("section CSE en tête, copie absente de Mes modèles", () => {
    const official = packModel();
    const copy = {
      promptModelId: 801,
      type: "USER",
      cardTitle: "Procès-verbal CSE détaillé",
      packCse: false
    };
    const armine = { promptModelId: 117, type: "USER", cardTitle: "Armine", packCse: false };
    const cours = { promptModelId: 4, type: "STANDARD", cardTitle: "Résumé de cours", packCse: false };
    Api.setMemberAccess({ hasCse: false });
    let g = Picker._groups([official, armine, cours], "");
    assert.equal((g.cse || []).length, 0);
    assert.equal(g.off.some(function (m) { return m.promptModelId === -10; }), true);

    Api.setMemberAccess({ hasCse: true });
    g = Picker._groups([official, armine, cours], "");
    assert.equal(g.cse.length, 1);
    assert.equal(g.cse[0].promptModelId, -10);
    assert.equal(g.mine.some(function (m) { return m.promptModelId === 117; }), true);

    const copiedOfficial = packModel({ acquiredPromptModelId: 801 });
    g = Picker._groups([copiedOfficial, copy, armine, cours], "");
    assert.equal(g.cse.length, 1);
    assert.equal(g.cse[0].promptModelId, 801);
    assert.equal(g.mine.some(function (m) { return m.promptModelId === 801; }), false);
    assert.equal(g.off.some(function (m) { return m.promptModelId === -10; }), false);
  });

  it("shouldPromoteCseDefault n’écrase pas un USER perso", () => {
    const src = packModel();
    const armine = { promptModelId: 117, type: "USER", cardTitle: "Armine" };
    const cours = { promptModelId: 4, type: "STANDARD", cardTitle: "Résumé de cours" };
    const cseUser = { promptModelId: 801, type: "USER", packCseCopy: true, sourcePromptId: -10 };
    assert.equal(Api.shouldPromoteCseDefault(src, armine), false);
    assert.equal(Api.shouldPromoteCseDefault(src, cours), true);
    assert.equal(Api.shouldPromoteCseDefault(src, cseUser), false);
    assert.equal(Api.shouldPromoteCseDefault(src, null), true);
  });

  it("hintHtml suit le modèle CSE", () => {
    Api.setMemberAccess({ hasCse: true });
    const off = Picker._hintHtml(true, packModel());
    assert.equal(off, "");
    const on = Picker._hintHtml(false, packModel());
    assert.equal(on.indexOf("Le PV est désactivé") !== -1, true);
    const cr = Picker._hintHtml(false, { promptModelId: 3, packCse: false });
    assert.equal(cr.indexOf("Le compte rendu est désactivé") !== -1, true);
  });
});
