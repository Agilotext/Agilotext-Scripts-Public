/**
 * Page Modèles v2 : pastille Junior, sans cadenas pour un junior payant.
 * Exécution : node --test tests/library-junior-badge.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

global.__AGILO_PROMPT_LIBRARY__ = { library2Live: true, cse89Live: true };

require("../scripts/pages/library/library-api.js");
require("../scripts/pages/library/library-core.js");
require("../scripts/pages/library/library-core-v2.js");

const Api = global.AgiloLibraryApi;
const V2 = global.AgiloLibraryCoreV2;

function card(over) {
  return Object.assign({
    promptModelId: -12,
    cardTitle: "Compte rendu d'appel",
    type: "STANDARD",
    packJunior: false,
    packCse: false,
    canUse: true,
    alreadyCopied: true,
    promptModelStatus: "READY",
    lockReasonCode: "",
    lockReasonMessage: ""
  }, over);
}

describe("pastille Junior v2", function () {
  it("carte junior payante : pastille, data-pack, pas de cadenas ni d'offre CSE", function () {
    Api.setMemberAccess({ hasCse: false, hasJunior: true, businessTypes: ["junior"] });
    var m = card({
      packJunior: true,
      alreadyCopied: true,
      lockReasonCode: "USER_COPY_REQUIRED",
      lockReasonMessage: "Ajoute ce modèle à tes modèles pour l'utiliser.",
      canUse: false
    });
    var html = V2.cardHtml(m);
    assert.equal(V2.VERSION, "2.1.7");
    assert.match(html, /agilo-lib-badge--pack">Junior</);
    assert.match(html, /data-pack="junior"/);
    assert.equal(html.includes(">CSE<"), false);
    assert.equal(html.includes("agilo-lib-card--locked"), false);
    assert.equal(html.includes("agilo-lib-card__lock"), false);
    assert.equal(html.includes("/offres/cse"), false);
    assert.equal(V2.showLockChrome(m), false);
  });

  it("carte CSE : pastille CSE, pas de pastille Junior", function () {
    Api.setMemberAccess({ hasCse: true, hasJunior: false, businessTypes: ["cse"] });
    var m = card({
      promptModelId: -10,
      cardTitle: "Procès-verbal CSE détaillé",
      packCse: true,
      alreadyCopied: false
    });
    var html = V2.cardHtml(m);
    assert.match(html, /agilo-lib-badge--pack">CSE</);
    assert.equal(html.includes(">Junior<"), false);
    assert.match(html, /data-pack="cse"/);
    assert.equal(html.includes('data-pack="junior"'), false);
  });

  it("carte générique : aucune pastille Junior", function () {
    Api.setMemberAccess({ hasCse: false, hasJunior: false, businessTypes: ["generic"] });
    var html = V2.cardHtml(card({ promptModelId: 0, cardTitle: "Compte rendu classique" }));
    assert.equal(html.includes(">Junior<"), false);
    assert.equal(html.includes(">CSE<"), false);
    assert.equal(html.includes("data-pack="), false);
  });
});
