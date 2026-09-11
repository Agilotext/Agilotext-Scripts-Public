/**
 * Picker icônes, garde USER, member-access businessTypes, standards-meta library2.
 */
var fs = require("fs");
var path = require("path");
var lib = path.join(__dirname, "../scripts/pages/library");

globalThis.__AGILO_PROMPT_LIBRARY__ = { library2Live: true, cse89Live: false };
globalThis.AgiloLibraryApi = {
  ctaForLocked: function () { return null; },
  isGenerationSafeId: function () { return true; },
  canSetUserIcon: function (id, type) {
    return Number(id) > 100 && String(type).toUpperCase() === "USER";
  },
  cfg: function () { return globalThis.__AGILO_PROMPT_LIBRARY__; }
};

eval(fs.readFileSync(path.join(lib, "library-core.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-standards-meta.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-icon-picker.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-api.js"), "utf8"));

var C = globalThis.AgiloLibraryCore;
var P = globalThis.AgiloLibraryIconPicker;
var Api = globalThis.AgiloLibraryApi;
var S = globalThis.AgiloLibraryStandards;

if (!P || !P.html) throw new Error("no icon picker");
if (typeof Api.canSetUserIcon !== "function") throw new Error("canSetUserIcon missing");
if (Api.canSetUserIcon(7, "STANDARD")) throw new Error("prompt 7 must not set icon");
if (Api.canSetUserIcon(3, "STANDARD")) throw new Error("id 3 must not set icon");
if (!Api.canSetUserIcon(253, "USER")) throw new Error("USER 253 must set icon");
if (Api.canSetUserIcon(253, "STANDARD")) throw new Error("type STANDARD blocked even if id>100");

globalThis.__AGILO_PROMPT_LIBRARY__.library2Live = false;
if (Api.canSetUserIcon(253, "USER")) throw new Error("flag false must hide picker");
globalThis.__AGILO_PROMPT_LIBRARY__.library2Live = true;

var userItems = C.menuItems({
  promptModelId: 253,
  type: "USER",
  canDuplicate: true,
  canEdit: true,
  canPin: true,
  canDelete: true
});
if (!userItems.some(function (it) { return it.act === "icon"; })) {
  throw new Error("USER menu missing Changer l’icône");
}

var stdItems = C.menuItems({
  promptModelId: 7,
  type: "STANDARD",
  canCopyOfficial: true,
  canUse: true
});
if (stdItems.some(function (it) { return it.act === "icon"; })) {
  throw new Error("STANDARD 7 must not have Changer l’icône");
}

var html = P.html({
  selectedKey: "shield",
  query: "",
  icons: [
    { iconKey: "shield", labelFr: "Bouclier", url: "https://api.agilotext.com/icon.svg" },
    { iconKey: "file-text", label: "File text", url: "https://api.agilotext.com/ft.svg" }
  ]
});
if (html.indexOf("Bouclier") === -1) throw new Error("labelFr missing from aria");
if (html.indexOf(">Bouclier<") !== -1) throw new Error("grid must not show Bouclier caption");
if (html.indexOf("is-on") === -1) throw new Error("selected cell missing");
if (html.indexOf("agilo-lib-iconpick__q") === -1) throw new Error("filter missing");
if (html.indexOf("File text") !== -1) throw new Error("EN label should not show in cell");
if (html.indexOf('title="file-text"') !== -1) throw new Error("title slug must not leak");
if (html.indexOf('aria-label="file-text"') === -1) throw new Error("icon key aria-label missing");
if (html.indexOf("Rechercher une icône") === -1) throw new Error("picker placeholder");

if (!P.matchesQuery({ iconKey: "shield", labelFr: "Bouclier" }, "bouc")) {
  throw new Error("filter labelFr");
}
if (P.matchesQuery({ iconKey: "mic", labelFr: "Micro" }, "shield")) {
  throw new Error("filter should reject");
}

var access = Api.parseMemberAccess({
  ok: true,
  data: { sources: [], businessTypes: ["cse", "generic"] }
});
if (!access.hasCse) throw new Error("businessTypes cse must set hasCse");
if (access.businessTypes.indexOf("cse") === -1) throw new Error("businessTypes not parsed");

if (!Api.isPackCseCard({ businessType: "cse" })) throw new Error("pack cse via businessType");
if (Api.isPackCseCard({ businessType: "generic" })) throw new Error("generic is not pack cse");

var card = {
  promptModelId: 0,
  type: "STANDARD",
  iconKey: "file-text",
  cardTitle: "Modèle par Default"
};
S.applyTo(card);
if (card.iconKey !== "file-text") throw new Error("library2Live must keep file-text, got " + card.iconKey);
if (card.cardTitle !== "Compte rendu de réunion") throw new Error("FR title still applied");

globalThis.__AGILO_PROMPT_LIBRARY__.library2Live = false;
var cardV1 = {
  promptModelId: 0,
  type: "STANDARD",
  iconKey: "document",
  cardTitle: "Modèle par Default"
};
S.applyTo(cardV1);
if (cardV1.iconKey !== "document") throw new Error("v1 still maps empty/document to meta");

console.log("library-icon.test.js ok");
