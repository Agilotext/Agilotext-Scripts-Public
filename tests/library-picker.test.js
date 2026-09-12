/**
 * Picker dashboard A : hooks sans jsdom (syncNative, Free, filtre, change).
 */
var fs = require("fs");
var path = require("path");
var lib = path.join(__dirname, "../scripts/pages/library");

globalThis.__AGILO_PROMPT_LIBRARY__ = {
  library2Live: true,
  cse89Live: false,
  pickerSelector: "#agilo-prompt-picker-anchor"
};

eval(fs.readFileSync(path.join(lib, "library-api.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-core.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-picker.js"), "utf8"));

var P = globalThis.AgiloLibraryPicker;
var Api = globalThis.AgiloLibraryApi;
if (!P || P.VERSION !== "2.2.0") throw new Error("AgiloLibraryPicker 2.2 missing");
if (typeof P._groups !== "function") throw new Error("_groups missing");
if (typeof P._syncNative !== "function") throw new Error("_syncNative missing");

function fakeSelect(initial) {
  var opts = (initial || []).map(function (v) {
    return { value: String(v), textContent: String(v) };
  });
  var fired = [];
  return {
    options: opts,
    classList: { add: function () {} },
    required: false,
    value: "",
    appendChild: function (opt) { this.options.push(opt); },
    dispatchEvent: function (ev) { fired.push(ev && ev.type ? ev.type : ev); }
  };
}

var isolated = {
  promptModelId: -7,
  type: "STANDARD",
  cardTitle: "Compte rendu client",
  publicDescription: "Décisions, engagements du cabinet et du client.",
  categoryKey: "general",
  canUse: false,
  requiresUserCopy: true,
  promptModelStatus: "READY"
};
var cse = {
  promptModelId: 7,
  type: "STANDARD",
  cardTitle: "Procès-verbal CSE",
  publicDescription: "Ordre du jour, votes et annexes.",
  categoryKey: "cse",
  canUse: true,
  promptModelStatus: "READY"
};
var pack = {
  promptModelId: 90,
  type: "STANDARD",
  cardTitle: "PV CSE (pack)",
  publicDescription: "PV détaillé réservé au pack CSE.",
  categoryKey: "cse",
  packCse: true,
  canUse: false,
  lockReasonCode: "SUBSCRIPTION_ACCESS_REQUIRED"
};
var user = {
  promptModelId: 746,
  type: "USER",
  cardTitle: "Entretien individuel",
  publicDescription: "Feedback factuel.",
  categoryKey: "rh",
  canUse: true,
  promptModelStatus: "READY"
};
var pending = {
  promptModelId: 803,
  type: "USER",
  cardTitle: "En création",
  canUse: false,
  promptModelStatus: "PENDING"
};
var acquired = {
  promptModelId: -6,
  type: "STANDARD",
  cardTitle: "Entretien individuel",
  canUse: false,
  requiresUserCopy: true,
  acquiredPromptModelId: 746,
  promptModelStatus: "READY"
};

var all = [user, pending, cse, isolated, pack];

var g = P._groups(all, "");
if (g.mine.length !== 2) throw new Error("Mes modèles should have 2 USER");
if (g.off.length !== 3) throw new Error("Agilotext section missing standards");

var cseHits = P._groups(all, "cse");
if (!cseHits.off.some(function (m) { return m.promptModelId === 7; })) {
  throw new Error("filtre cse missed official 7");
}
if (!cseHits.off.some(function (m) { return m.packCse; })) {
  throw new Error("filtre cse missed pack");
}
if (cseHits.mine.length) throw new Error("filtre cse should not keep rh user");
if (!P._filter(cse, "cse")) throw new Error("_filter cse");
if (P._filter(user, "cse")) throw new Error("filtre cse leaked user rh");

if (P._canSelect(isolated)) throw new Error("isolated -7 must not be selectable");
if (P._canSelect(pending)) throw new Error("PENDING must not be selectable");
if (P._canSelect(pack)) throw new Error("pack CSE must not be selectable");
if (!P._canSelect(cse)) throw new Error("official 7 should be selectable");
if (!P._canSelect(user)) throw new Error("USER ready should be selectable");
if (!P._canSelect(acquired)) throw new Error("already copied standard should be choosable");
if (P._chooseId(acquired) !== 746) throw new Error("chooseId must return USER copy");
if (P._chooseId(isolated) !== -7) throw new Error("chooseId isolated stays -7 until copy");

if (P._showAdd(isolated, false)) throw new Error("Free must not show Ajouter");
if (!P._showAdd(isolated, true)) throw new Error("Pro must show Ajouter on -7");
if (P._showAdd(acquired, true)) throw new Error("already copied must not show Ajouter");
if (P._addKind(acquired, true) !== "select-copy") throw new Error("alreadyAcquired is select-copy");
if (P._addKind(isolated, true) !== "duplicate") throw new Error("isolated Pro is duplicate");
if (P._addKind(isolated, false) !== "none") throw new Error("isolated Free is none");
if (P._addKind(pack, true) !== "cse-pack") throw new Error("pack is cse-pack");
if (P._addKind(isolated, true) === "cse-pack") throw new Error("isolated Pro must not be cse-pack");

var hintOff = P._hintHtml(false);
if (hintOff.indexOf("agilo-lib-picker__hint") === -1) throw new Error("hint missing when summary OFF");
if (hintOff.indexOf("compte rendu est désactivé") === -1) throw new Error("hint copy missing");
if (P._hintHtml(true) !== "") throw new Error("hint should be empty when summary ON");

var cseCta = P._packCta();
if (!cseCta || String(cseCta.href).indexOf("/offres/cse") === -1) {
  throw new Error("pack CTA should land on /offres/cse");
}
if (String(cseCta.href).indexOf("mailto:") !== -1) throw new Error("pack CTA still mailto");
if (cseCta.label.indexOf("offre CSE") === -1) throw new Error("pack CTA label");

var freeList = P._visibleModels(all, false);
if (freeList.some(function (m) { return Number(m.promptModelId) < -1; })) {
  throw new Error("Free visible list still has isolated ids");
}
if (freeList.some(function (m) { return m.promptModelId === 7; })) {
  throw new Error("Free should hide official 7");
}
var proList = P._visibleModels(all, true);
if (proList.some(function (m) { return m.promptModelId === 7; })) {
  throw new Error("Pro should hide official 7");
}

var sel = fakeSelect(["0", "1", "7"]);
P._syncNative(sel, all, 7);
var values = sel.options.map(function (o) { return String(o.value); });
if (values.indexOf("-7") !== -1) throw new Error("syncNative wrote -7");
if (values.indexOf("-6") !== -1) throw new Error("syncNative wrote -6");
if (values.indexOf("746") === -1) throw new Error("syncNative should add USER 746");
if (values.indexOf("0") === -1) throw new Error("syncNative stripped hardcoded 0");
if (sel.value !== "7") throw new Error("syncNative selected 7");

var unsafe = fakeSelect(["0"]);
P._syncNative(unsafe, [isolated], -7);
if (unsafe.options.some(function (o) { return String(o.value) === "-7"; })) {
  throw new Error("-7 absent de syncNative failed");
}
if (unsafe.value === "-7") throw new Error("syncNative selected -7");

var changeSel = fakeSelect(["7"]);
var types = [];
changeSel.dispatchEvent = function (ev) { types.push(ev && ev.type); };
P._writeSelect(changeSel, 7);
if (changeSel.value !== "7") throw new Error("writeSelect value");
if (types.indexOf("change") === -1) throw new Error("change not dispatched");

if (!Api.isGenerationSafeId(7)) throw new Error("7 should be safe");
if (Api.isGenerationSafeId(-7)) throw new Error("-7 must be unsafe");
if (Api.canCreate({ edition: "free" })) throw new Error("Free canCreate");
if (!Api.canCreate({ edition: "ent" })) throw new Error("ent canCreate");
if (!Api.canCreate({ edition: "pro" })) throw new Error("pro canCreate");

var css = fs.readFileSync(path.join(lib, "library.css"), "utf8");
if (css.indexOf(".agilo-lib-picker__panel") === -1) throw new Error("panel CSS missing");
if (css.indexOf("z-index: 200") === -1) throw new Error("z-index 200 missing");
if (css.indexOf("max-height: min(20rem, 70vh)") === -1) throw new Error("mobile max-height missing");
if (css.indexOf(".agilo-lib-picker-on #default-template-select.agilo-lib-native-select") === -1) {
  throw new Error("hide select rule missing");
}
if (css.indexOf("outline: 1px solid var(--lib-blue)") === -1) throw new Error("global focus 1px missing");
if (css.indexOf("outline: 2px solid var(--lib-blue)") !== -1) throw new Error("old 2px focus still there");
if (css.indexOf(".agilo-lib-picker__search:focus") === -1) throw new Error("search :focus missing");
if (css.indexOf("box-shadow: 0 0 0 1px var(--lib-blue)") === -1) {
  throw new Error("picker search focus must follow radius, not square outline");
}
if (css.indexOf(".agilo-lib-picker__opt-title {\n  font-weight: 400") === -1) {
  throw new Error("opt-title must be weight 400");
}
if (css.indexOf(".agilo-lib-picker__opt-title {\n  font-weight: 600") !== -1) {
  throw new Error("opt-title still 600");
}
if (css.indexOf("text-transform: uppercase") !== -1 && css.indexOf(".agilo-lib-picker__sec") !== -1) {
  var secBlock = css.slice(css.indexOf(".agilo-lib-picker__sec"));
  secBlock = secBlock.slice(0, secBlock.indexOf(".agilo-lib-picker__empty"));
  if (secBlock.indexOf("uppercase") !== -1) throw new Error("sec still uppercase");
  if (secBlock.indexOf("font-weight: 700") !== -1) throw new Error("sec still 700");
}
if (css.indexOf(".agilo-lib-picker__opt.is-hi { outline:") !== -1) {
  throw new Error("is-hi still has outline");
}

var js = fs.readFileSync(path.join(lib, "library-picker.js"), "utf8");
if (js.indexOf('edition: \'ent\'') !== -1 || js.indexOf('edition: "ent"') !== -1) {
  throw new Error("picker hardcoded edition ent");
}
if (js.indexOf("agilo-lib-picker-on") === -1) throw new Error("picker-on class missing");
if (js.indexOf("if (!summaryOn()) return") !== -1) throw new Error("picker still blocks when summary OFF");
if (js.indexOf("setDisabled(!summaryOn())") !== -1) throw new Error("picker still disables on summary");
if (js.indexOf("ctaMailto") !== -1) throw new Error("picker still uses ctaMailto");
if (js.indexOf("agilo-lib-picker__hint") === -1) throw new Error("hint class missing in JS");
if (js.indexOf("agilo-lib-picker__ico--locked") === -1) throw new Error("locked ico class missing");
if (js.indexOf("agilo-lib-card__lockico") !== -1) throw new Error("picker still uses lockico");
if (js.indexOf("opt-desc") !== -1) throw new Error("picker list still renders publicDescription");
if (js.indexOf('agilo-lib-picker__opt-label" title="') === -1 &&
    js.indexOf("agilo-lib-picker__opt-label\" title=\"") === -1 &&
    js.indexOf("opt-label\" title=\"") === -1) {
  throw new Error("opt-label title missing");
}
if (js.indexOf("agilo-lib-picker__sec--off") === -1) throw new Error("sec--off class missing in JS");
if (css.indexOf(".agilo-lib-picker__sec--off") === -1) throw new Error("sec--off CSS missing");
if (css.indexOf(".agilo-lib-picker__hint") === -1) throw new Error("hint CSS missing");
if (css.indexOf("line-clamp: 2") === -1) throw new Error("opt-label 2-line clamp missing");
if (css.indexOf(".agilo-lib-picker__ico--locked::after") === -1) throw new Error("locked ico overlay missing");

if (typeof P._sortMine !== "function" || typeof P._titleText !== "function") {
  throw new Error("_sortMine/_titleText missing");
}
var older = {
  promptModelId: 101,
  type: "USER",
  cardTitle: "Ancien",
  canUse: true,
  dtCreation: 1000,
  dtUpdate: 1000
};
var newer = {
  promptModelId: 102,
  type: "USER",
  cardTitle: "Recent",
  canUse: true,
  dtCreation: 1000,
  dtUpdate: 200000
};
var stdFirst = { promptModelId: 7, type: "STANDARD", cardTitle: "PV", canUse: true, categoryKey: "cse" };
var stdSecond = { promptModelId: 0, type: "STANDARD", cardTitle: "Réunion", canUse: true, categoryKey: "general" };
var sorted = P._groups([older, newer, stdFirst, stdSecond], "");
if (sorted.mine[0].promptModelId !== 102) throw new Error("recent USER should be first");
if (sorted.mine[1].promptModelId !== 101) throw new Error("older USER should be second");
if (sorted.off[0].promptModelId !== 7 || sorted.off[1].promptModelId !== 0) {
  throw new Error("official order must stay");
}
var filtered = P._groups([older, newer, stdFirst], "recent");
if (filtered.mine.length !== 1 || filtered.mine[0].promptModelId !== 102) {
  throw new Error("filter plus sort failed");
}
if (P._titleText(stdFirst) !== "PV") throw new Error("standard title is name only");
if (P._titleText({ promptModelId: 103, type: "USER", cardTitle: "Sans date", dtUpdate: 0, dtCreation: 0 }) !== "Sans date") {
  throw new Error("zero date must be name only");
}
var createdTip = P._titleText(older);
if (createdTip.indexOf("créé le") === -1) throw new Error("same ts is créé le");
if (createdTip.indexOf("Ancien") === -1) throw new Error("created title missing name");
var editedTip = P._titleText(newer);
if (editedTip.indexOf("modifié le") === -1) throw new Error("distinct ts is modifié le");
if (editedTip.indexOf("Recent") === -1) throw new Error("edited title missing name");

console.log("library-picker.test.js ok");
