/**
 * Biblio v2 : menus sans doublons, primaire unique, fiche Gratuit floue,
 * header une ligne, wizard 5 étapes, deep link, creds Studio.
 */
var fs = require("fs");
var path = require("path");
var lib = path.join(__dirname, "../scripts/pages/library");

globalThis.__AGILO_PROMPT_LIBRARY__ = {
  library2Live: true,
  cse89Live: false,
  atelierEnabled: true,
  uiV2: true,
  pricingUrl: "/tarifs"
};

eval(fs.readFileSync(path.join(lib, "library-api.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-standards-meta.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-core.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-core-v2.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-fiche-v2.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-wizard-v2.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-overlay.js"), "utf8"));
eval(fs.readFileSync(path.join(lib, "library-catalog-v2.js"), "utf8"));

var C = globalThis.AgiloLibraryCoreV2;
var Fiche = globalThis.AgiloLibraryFicheV2;
var Wiz = globalThis.AgiloLibraryWizardV2;
var Cat = globalThis.AgiloLibraryCatalogV2;
var Api = globalThis.AgiloLibraryApi;

if (!C || !C.cardHtml) throw new Error("AgiloLibraryCoreV2 missing");
if (!Fiche || !Wiz || !Cat) throw new Error("v2 modules missing");

var user = {
  promptModelId: 253,
  cardTitle: "Mon CR client",
  type: "USER",
  publicDescription: "Décisions et actions",
  publicExample: "Décisions · Responsables",
  canUse: true,
  canPin: true,
  canDuplicate: true,
  canEdit: true,
  canDelete: true,
  canManageVersions: true,
  canSetDefault: true,
  isDefault: false
};

var items = C.menuItems(user);
if (!items.some(function (it) { return it.act === "default"; })) throw new Error("card menu missing default");
if (items.some(function (it) { return it.act === "edit" || it.act === "icon"; })) {
  throw new Error("v2 menu still has edit/icon");
}
if (!items.some(function (it) { return it.act === "pin"; })) throw new Error("pin missing");
if (!items.some(function (it) { return it.act === "rename"; })) throw new Error("rename missing from menu");
var ficheItems = C.menuItems(user, { surface: "fiche" });
if (ficheItems.some(function (it) { return it.act === "default"; })) throw new Error("fiche menu still has default");

var std = {
  promptModelId: 0,
  cardTitle: "Compte rendu de réunion",
  type: "STANDARD",
  canUse: true,
  canCopyOfficial: true,
  canPin: true,
  isDefault: false
};
var stdItems = C.menuItems(std);
if (!stdItems.some(function (it) { return it.act === "duplicate"; })) throw new Error("duplicate missing");

var stdCopy = {
  promptModelId: 0,
  cardTitle: "Compte rendu de réunion",
  type: "STANDARD",
  canUse: false,
  canCopyOfficial: true,
  canPin: true,
  isDefault: false
};
if (C.menuItems(stdCopy).some(function (it) { return it.act === "default"; })) {
  throw new Error("copy-only STANDARD menu has default");
}
if (!C.menuItems(stdCopy).some(function (it) { return it.act === "duplicate"; })) {
  throw new Error("copy-only duplicate missing");
}

var card = C.cardHtml(user);
if (card.indexOf("Utiliser par défaut") !== -1) throw new Error("old primary label still present");
if (card.indexOf('class="agilo-lib-btn agilo-lib-btn--primary') !== -1) throw new Error("full primary button on card");
if (card.indexOf(">Définir par défaut</button>") !== -1) throw new Error("full default label on card");
if (card.indexOf("data-act=\"default\"") === -1) throw new Error("default act missing");
if (card.indexOf('data-tip="Définir par défaut"') === -1) throw new Error("default tip missing");
if (card.indexOf('aria-label="Définir par défaut"') === -1) throw new Error("default aria missing");
if (card.indexOf("agilo-lib-card__actions--v2") === -1) throw new Error("v2 toolbar missing");
if (card.indexOf("agilo-lib-card__titlebtn") === -1) throw new Error("title button missing");
if (card.indexOf("tabindex") !== -1) throw new Error("article still focusable");
if (card.indexOf("> Voir<") !== -1 || card.indexOf(">Voir<") !== -1) throw new Error("Voir still on card");
if (card.indexOf("agilo-lib-card__preview") === -1) throw new Error("preview missing on normal card");
if (card.indexOf("agilo-lib-card__clamp") === -1) throw new Error("clamp span missing");
if (card.indexOf('data-icon="') === -1) throw new Error("card data-icon missing");
var reportCard = C.cardHtml(Object.assign({}, user, { iconKey: "report" }));
if (reportCard.indexOf('data-icon="report"') === -1) throw new Error("report icon tint key missing");
if (card.indexOf('title="Mon CR client"') === -1) throw new Error("title tooltip missing");
if (card.indexOf('aria-label="Mon CR client"') === -1) throw new Error("aria-label missing on title");

var copyCard = C.cardHtml(stdCopy);
if (copyCard.indexOf("data-act=\"default\"") !== -1) throw new Error("copy-only STANDARD has default quick");

var compactCard = C.cardHtml(user, { size: "compact" });
if (compactCard.indexOf("agilo-lib-card__preview") !== -1) throw new Error("compact must not have preview");

user.isDefault = true;
var defCard = C.cardHtml(user);
if (defCard.indexOf("data-act=\"default\"") !== -1) throw new Error("default state still clickable");
if (defCard.indexOf("is-on") === -1) throw new Error("default check missing is-on");
if ((defCard.match(/agilo-lib-badge--default/g) || []).length !== 1) throw new Error("default badge not unique on card");
if (defCard.indexOf("Modèle par défaut</span>") !== -1) throw new Error("old long default label still visible");
var table = C.tableRowHtml(user);
if (table.indexOf("agilo-lib-td--title") === -1) throw new Error("table title button missing");
if (table.indexOf("> Voir<") !== -1 || table.indexOf(">Voir<") !== -1) throw new Error("Voir still in table");
if ((table.match(/agilo-lib-badge--default/g) || []).length !== 1) throw new Error("default badge not unique in table");
if (table.indexOf("is-on") === -1) throw new Error("table default check missing");

var head = Cat._headHtml();
if (head.indexOf("agilo-lib-head--v2") === -1) throw new Error("v2 header missing");
if (head.indexOf("Créer un modèle") === -1) throw new Error("Créer missing");
if (head.indexOf("agilo-lib-q") === -1) throw new Error("search missing");
if (head.indexOf("Question") !== -1) throw new Error("wizard kicker leaked into header");

Wiz.reset({ restore: false });
var w0 = Wiz.state();
if (w0.step !== 1) throw new Error("wizard start");
if (Wiz.QUESTIONS.length !== 4) throw new Error("4 questions");
if (Wiz.QUESTIONS[0].placeholder.indexOf("Modèle de réunion") === -1) throw new Error("name placeholder");
if (Wiz.QUESTIONS[1].label.indexOf("interlocuteurs") === -1) throw new Error("objective question");
Wiz.state().name = "Comité";
Wiz.state().objective = "Suivi hebdo";
Wiz.state().specificInfo = "Décisions";
Wiz.state().structure = "Résumé puis détail";
if (Wiz.validateAll()) throw new Error("valid draft still invalid");
if (Wiz.validateStep(1)) throw new Error("step 1 should pass with name");
Wiz.state().step = 2;
var q2 = Wiz.html({ canCreate: true, library2Live: true, iconCatalog: [] });
if (q2.indexOf("Question 2") !== -1 || q2.indexOf("Question 2 / 4") !== -1) {
  throw new Error("duplicate question kicker still present");
}
if (q2.indexOf("Étape 2 sur 4") === -1) throw new Error("stepper aria label missing");
Wiz.state().step = 5;
var recap = Wiz.html({ canCreate: true, library2Live: true, iconCatalog: [] });
if (recap.indexOf("Récapitulatif") === -1 && recap.indexOf("agilo-lib-recap") === -1) {
  throw new Error("recap missing at step 5");
}
if (recap.indexOf("Créer le modèle") === -1) throw new Error("create CTA missing");

var freeCreds = { email: "a@b.c", token: "t", edition: "free" };
var proCreds = { email: "a@b.c", token: "t", edition: "ent" };
if (Fiche.previewMode(user, freeCreds) !== "free") throw new Error("free preview mode");
if (Fiche.previewMode(user, proCreds) !== "text") throw new Error("pro preview mode");
if (Fiche.canShowPrompt(user, freeCreds)) throw new Error("free must not show prompt");

var locked = {
  promptModelId: 8,
  cardTitle: "PV CSE",
  type: "STANDARD",
  packCse: true,
  canUse: false,
  lockReasonCode: "SUBSCRIPTION_ACCESS_REQUIRED",
  lockReasonMessage: "Réservé au Pack CSE."
};
if (Fiche.previewMode(locked, proCreds) !== "locked") throw new Error("locked mode");
var lockedCard = C.cardHtml(locked);
if (lockedCard.indexOf("agilo-lib-card__cta-link") === -1) throw new Error("locked CTA link missing");
if (lockedCard.indexOf("Bientôt disponible") === -1) throw new Error("locked CTA label");
if (lockedCard.indexOf("mailto:contact@agilotext.com") === -1) throw new Error("locked CTA href");
if (lockedCard.indexOf("agilo-lib-btn--cta") !== -1) throw new Error("fat CSE CTA on card");
if (lockedCard.indexOf("data-act=\"default\"") !== -1) throw new Error("locked card has default quick");

var pending = Object.assign({}, user, { promptModelStatus: "PENDING" });
if (Fiche.previewMode(pending, proCreds) !== "pending") throw new Error("pending mode");

var freeHtml = Fiche.html(user, { previewText: "SECRET_PROMPT_BODY" }, freeCreds);
if (freeHtml.indexOf("SECRET_PROMPT_BODY") !== -1) throw new Error("free DOM leaked prompt");
if (freeHtml.indexOf("agilo-lib-blur") === -1) throw new Error("blur missing");
if (freeHtml.indexOf("Passer en Pro") === -1) throw new Error("upgrade CTA missing");
if (freeHtml.indexOf("disabled") === -1) throw new Error("edit must be disabled on free");

var proHtml = Fiche.html(user, { previewText: "Tu es un assistant", previewLoading: false }, proCreds);
if (proHtml.indexOf("Tu es un assistant") === -1) throw new Error("pro preview missing");
if (proHtml.indexOf("Modifier le prompt") === -1) throw new Error("edit CTA missing");
if (proHtml.indexOf("Définir par défaut") === -1 && proHtml.indexOf("Par défaut") === -1) {
  throw new Error("fiche primary missing");
}
if (proHtml.indexOf("jamais affiché") !== -1) throw new Error("old never-shown copy still there");
if (proHtml.indexOf("agilo-lib-fiche__scroll") === -1) throw new Error("fiche scroll body missing");
if (proHtml.indexOf("agilo-lib-fiche__iconwrap") === -1) throw new Error("fiche icon wrap missing");
if (proHtml.indexOf("agilo-lib-iconpop") !== -1) throw new Error("icon popover should be closed by default");

var openIcon = Fiche.html(user, { iconOpen: true, previewText: "x", previewLoading: false }, proCreds);
if (openIcon.indexOf("agilo-lib-fiche__iconwrap") === -1) throw new Error("icon wrap missing when picker open");

var stdHtml = Fiche.html(std, { previewText: "Prompt officiel", previewLoading: false }, proCreds);
if (stdHtml.indexOf("Voir le prompt") === -1) throw new Error("readonly studio label");

if (typeof Api.credsForStudio !== "function") throw new Error("credsForStudio missing");
Api.setActiveCreds({ email: "preview@agilotext.com", token: "mock", edition: "ent" });
var auth = Api.credsForStudio();
if (!auth || auth.username !== "preview@agilotext.com") throw new Error("getAuth shape");
if (!auth.token || !auth.edition) throw new Error("getAuth fields");
if (typeof Api.getPromptContent !== "function") throw new Error("getPromptContent missing");
if (typeof Api.appPath !== "function") throw new Error("appPath missing");

globalThis.location = { pathname: "/app/premium/profile", search: "", hash: "", href: "" };
if (Api.appPath("bibliotheque") !== "/app/premium/bibliotheque") throw new Error("bibliotheque path");
if (Api.appPath("profile").indexOf("tab=prompts") === -1) throw new Error("profile path kept for fallback");

globalThis.location = { search: "", hash: "#modele=253", pathname: "/app/business/bibliotheque" };
Cat._readHash();
if (Cat._state().pendingDeepLink !== 253) throw new Error("deep link #modele=");

var css = fs.readFileSync(path.join(lib, "library-v2.css"), "utf8");
if (css.indexOf("border-left: 1px") === -1) throw new Error("banner 1px border missing");
if (css.indexOf("agilo-lib-head--v2") === -1) throw new Error("header css missing");
if (css.indexOf("agilo-lib-card__actions--v2") === -1) throw new Error("actions css missing");
if (css.indexOf("agilo-lib-blur") === -1) throw new Error("blur css missing");
if (css.indexOf("container-type: inline-size") !== -1) throw new Error("container query should be gone");
if (css.indexOf("grid-template-areas") !== -1) throw new Error("action grid still present");
if (css.indexOf("[data-tip]") === -1) throw new Error("tooltip css missing");
if (css.indexOf("width: 36px") === -1) throw new Error("36px toolbar missing");
if (css.indexOf("width: 44px") === -1) throw new Error("44px mobile toolbar missing");
if (css.indexOf("4.2rem") === -1) throw new Error("compact preview height missing");
if (css.indexOf("max-height: 12rem") === -1) throw new Error("icon popover max-height missing");
if (css.indexOf("opacity: 0.5") === -1) throw new Error("pencil rest opacity missing");

var main = fs.readFileSync(path.join(lib, "library-main.js"), "utf8");
if (main.indexOf("AgiloLibraryCatalogV2") === -1) throw new Error("main switch missing");
if (main.indexOf("uiV2") === -1) throw new Error("uiV2 switch missing");

var coreSrc = fs.readFileSync(path.join(lib, "library-core.js"), "utf8");
if (coreSrc.indexOf("{ once: true }") !== -1) throw new Error("menu still uses once:true");
if (coreSrc.indexOf("aria-expanded") === -1) throw new Error("aria-expanded missing");
if (coreSrc.indexOf("menuAnchor === anchor") === -1) throw new Error("menu toggle missing");
if (coreSrc.indexOf("addEventListener(\"scroll\"") === -1) throw new Error("scroll close missing");
if (coreSrc.indexOf("addEventListener(\"resize\"") === -1) throw new Error("resize close missing");

var overlaySrc = fs.readFileSync(path.join(lib, "library-overlay.js"), "utf8");
var overlayOpen = overlaySrc.slice(overlaySrc.indexOf("function open("), overlaySrc.indexOf("function update("));
var overlayUpdate = overlaySrc.slice(overlaySrc.indexOf("function update("), overlaySrc.indexOf("function close("));
var overlayClose = overlaySrc.slice(overlaySrc.indexOf("function close("), overlaySrc.indexOf("function isOpen("));
if (overlayOpen.indexOf("closeLibMenus") === -1) throw new Error("overlay.open missing closeMenus");
if (overlayClose.indexOf("closeLibMenus") === -1) throw new Error("overlay.close missing closeMenus");
if (overlayUpdate.indexOf("closeLibMenus") !== -1 || overlayUpdate.indexOf("closeMenus") !== -1) {
  throw new Error("overlay.update must not closeMenus");
}
if (overlaySrc.indexOf('querySelector(".agilo-lib-menu")') === -1) throw new Error("overlay Escape menu check missing");

var catSrc = fs.readFileSync(path.join(lib, "library-catalog-v2.js"), "utf8");
var paintFn = catSrc.slice(catSrc.indexOf("function paint("), catSrc.indexOf("function versionsHtml("));
var handleActFn = catSrc.slice(catSrc.indexOf("function handleAct("), catSrc.indexOf("function dashboardLink("));
var openFicheFn = catSrc.slice(catSrc.indexOf("function openFiche("), catSrc.indexOf("function openFicheIcons("));
var openWizardFn = catSrc.slice(catSrc.indexOf("function openWizard("), catSrc.indexOf("function openVersions("));
if (paintFn.indexOf("closeMenus") === -1) throw new Error("catalog paint missing closeMenus");
if (handleActFn.indexOf("closeMenus") === -1) throw new Error("handleAct missing closeMenus");
if (openFicheFn.indexOf("closeMenus") === -1) throw new Error("openFiche missing closeMenus");
if (openWizardFn.indexOf("closeMenus") === -1) throw new Error("openWizard missing closeMenus");
if (catSrc.indexOf("ce filtre") !== -1) throw new Error("empty copy still says ce filtre");
if (catSrc.indexOf("Voir tous les modèles") === -1) throw new Error("reset chip CTA missing");
if (catSrc.indexOf("state.category = \"all\"") === -1) throw new Error("setTab does not reset category");
if (catSrc.indexOf("Épinglez jusqu’à 5 modèles depuis le menu") === -1) throw new Error("pins banner copy stale");

Cat._state().q = "";
Cat._state().category = "cse";
var cseCount = Cat._countLine(8, 1);
if (cseCount.indexOf("1 modèle dans CSE / PV") === -1) throw new Error("filtered count missing: " + cseCount);
var cseEmpty = Cat._countLine(8, 0);
if (cseEmpty.indexOf("Aucun modèle dans CSE / PV") === -1) throw new Error("empty filtered count missing");
Cat._state().category = "all";
if (Cat._countLine(8, 8).indexOf("8 modèles") === -1) throw new Error("all count missing");

var mdUser = Object.assign({}, user, { isDefault: false });
var mdHtml = Fiche.html(mdUser, { previewText: "**Hello** world", previewLoading: false }, proCreds);
if (mdHtml.indexOf("**Hello**") !== -1) throw new Error("markdown stars leaked in preview");
if (mdHtml.indexOf("Hello world") === -1) throw new Error("stripped preview missing");
var defFiche = Fiche.html(Object.assign({}, user, { isDefault: true }), { previewText: "x", previewLoading: false }, proCreds);
if ((defFiche.match(/Par défaut/g) || []).length !== 1) throw new Error("fiche Par défaut not unique");
if (css.indexOf("line-clamp: 3") === -1) throw new Error("desc clamp missing");
if (css.indexOf("agilo-lib-card__clamp") === -1) throw new Error("clamp css missing");
if (css.indexOf("flex: 0 0 auto") === -1) throw new Error("desc flex lock missing");
if (css.indexOf("line-clamp: 2") === -1) throw new Error("example clamp missing");
if (css.indexOf("--lib-tint") === -1) throw new Error("card tint token missing");
if (css.indexOf('[data-icon="report"]') === -1) throw new Error("report tint missing");
if (css.indexOf('[data-icon="education"]') === -1) throw new Error("education tint missing");
if (css.indexOf("minmax(min(100%, 16.5rem), 1fr)") === -1) throw new Error("featured grid missing");
if (css.indexOf("overflow: hidden") === -1) throw new Error("card overflow hidden missing");
if (css.indexOf("max-height: 4.35em") !== -1) throw new Error("desc max-height should be gone");
if (css.indexOf("max-height: 1.45em") !== -1) throw new Error("example max-height should be gone");
if (css.indexOf("min-height: 2.6em") !== -1) throw new Error("title min-height should be gone");
if (css.indexOf("100050") === -1) throw new Error("overlay z-index bump missing");
if (css.indexOf("margin-left: auto") === -1) throw new Error("wizard icon align missing");
if (css.indexOf("agilo-lib-badge--acquired") === -1) throw new Error("acquired badge css missing");

var acquiredRaw = {
  promptModelId: 0,
  promptModelType: "STANDARD",
  promptModelName: "Compte rendu de réunion",
  canDuplicate: true,
  canUse: true,
  acquiredPromptModelId: 736,
  usageCountGlobal: 0,
  ratingAvg: 0,
  ratingCount: 0
};
var acquiredCard = Api._normalizeCard(acquiredRaw, null);
if (acquiredCard.acquiredPromptModelId !== 736) throw new Error("acquiredPromptModelId not mapped");
if (!acquiredCard.alreadyCopied) throw new Error("alreadyCopied should follow acquiredPromptModelId");
if (acquiredCard.usageCountGlobal !== 0) throw new Error("usage still expected 0");

var heuristicRaw = {
  promptModelId: -2,
  promptModelType: "STANDARD",
  promptModelName: "Isolé",
  canDuplicate: true,
  canUse: false,
  requiresUserCopy: true
};
var heuristicCard = Api._normalizeCard(heuristicRaw, null);
if (heuristicCard.alreadyCopied) throw new Error("canDuplicate true must not mean alreadyCopied");
if (heuristicCard.acquiredPromptModelId !== 0) throw new Error("missing acquired should be 0");

var isoCopied = {
  promptModelId: -3,
  cardTitle: "PV isolé",
  type: "STANDARD",
  canUse: false,
  canCopyOfficial: true,
  alreadyCopied: true,
  acquiredPromptModelId: 900,
  canPin: true,
  isDefault: false
};
var isoItems = C.menuItems(isoCopied);
if (isoItems.some(function (it) { return it.act === "duplicate"; })) {
  throw new Error("already copied still offers Ajouter");
}
if (!isoItems.some(function (it) { return it.act === "open-copy"; })) {
  throw new Error("open-copy missing from menu");
}
var isoCard = C.cardHtml(isoCopied);
if (isoCard.indexOf("Dans Mes modèles") === -1) throw new Error("acquired badge missing");
if (isoCard.indexOf("usageCount") !== -1 || isoCard.indexOf("ratingAvg") !== -1) {
  throw new Error("usage/rating leaked into card HTML");
}
if (isoCard.indexOf("data-act=\"duplicate\"") !== -1) throw new Error("Ajouter still on acquired card");
var isoFiche = Fiche.html(isoCopied, { previewText: "x", previewLoading: false }, proCreds);
if (isoFiche.indexOf("Voir dans Mes modèles") === -1) throw new Error("fiche missing Voir dans Mes modèles");
if (isoFiche.indexOf("Ajouter à mes modèles") !== -1) throw new Error("Ajouter still in acquired fiche");
if (isoFiche.indexOf("usageCount") !== -1) throw new Error("usage leaked into fiche");

Cat._state().models = [
  { promptModelId: 0, type: "STANDARD", categoryKey: "general", cardTitle: "Réunion" },
  { promptModelId: 7, type: "STANDARD", categoryKey: "cse", cardTitle: "PV" }
];
Cat._state().category = "all";
var chips = Cat._chipsHtml();
if (chips.indexOf("data-cat=\"education\"") !== -1) throw new Error("empty Formation chip still visible");
if (chips.indexOf("data-cat=\"cse\"") === -1) throw new Error("CSE chip missing");
if (chips.indexOf("data-cat=\"all\"") === -1) throw new Error("Tous chip missing");
if (handleActFn.indexOf("open-copy") === -1) throw new Error("handleAct missing open-copy");
if (catSrc.indexOf("function openAcquiredCopy") === -1) throw new Error("openAcquiredCopy missing");

console.log("library-v2.test.js ok");
