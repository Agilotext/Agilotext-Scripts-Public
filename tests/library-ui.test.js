/**
 * Chrome biblio : icônes Nucleo 18 px, titre non cliquable, Voir + défaut, iconUrl intact.
 */
globalThis.AgiloLibraryApi = {
  ctaForLocked: function () { return null; },
  isGenerationSafeId: function () { return true; }
};
eval(require("fs").readFileSync(require("path").join(__dirname, "../scripts/pages/library/library-core.js"), "utf8"));
var C = globalThis.AgiloLibraryCore;
if (!C) throw new Error("no core");
var x = C.svgIcon("xmark", 16);
if (x.indexOf('viewBox="0 0 18 18"') === -1) throw new Error("viewBox");
var card = C.cardHtml({
  promptModelId: 1,
  cardTitle: "Test CR",
  type: "STANDARD",
  canUse: true,
  publicDescription: "d",
  publicExample: "e"
});
if (card.indexOf("title-btn") !== -1) throw new Error("title still button");
if (card.indexOf("Voir") === -1) throw new Error("missing Voir");
if (card.indexOf("Utiliser par défaut") === -1) throw new Error("missing default label");
if (card.indexOf('<h3 class="agilo-lib-card__title">Test CR</h3>') === -1) throw new Error("title text");
var ico = C.iconHtml({
  iconUrl: "https://cdn.example/icon.svg",
  cardTitle: "X",
  promptModelId: 2,
  type: "STANDARD"
}, 18);
if (ico.indexOf('<img src="https://cdn.example/icon.svg"') === -1) throw new Error("iconUrl must stay img");
if (ico.indexOf("onerror=") === -1) throw new Error("iconUrl img must fallback on error");
console.log("library-ui.test.js ok");
