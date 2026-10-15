/**
 * Smoke — jauge eau. node scripts/pages/dashboard/agilo-eco-impact.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, "agilo-eco-impact.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: { AGILO_ECO_SKIP_BOOT: true } };
sandbox.window.window = sandbox.window;
vm.runInNewContext(src, sandbox);
const eco = sandbox.window.AgiloEcoImpact;

assert(eco.readImpact({ status: "KO", errorMessage: "invalid_token" }) == null, "KO masque");
assert(eco.readImpact({ status: "OK" }) == null, "OK sans litres masque");
assert(eco.readImpact({ status: "OK", numberOfLiters: "nope" }) == null, "litres non numériques masque");
const live = eco.readImpact({ status: "OK", water_liters: 8.9, co2_grams: 12, numberOfLiters: 1, co2Grams: 3 });
assert(live && live.liters === 8.9, "water_liters prime sur l'ancien nom");
assert(live.co2Grams === 12, "co2_grams recopié dans co2Grams");
const ok = eco.readImpact({ status: "OK", numberOfLiters: 8.9, co2Grams: 12, attestationUrl: "https://example.test/a.pdf" });
assert(ok && ok.liters === 8.9, "numberOfLiters");
assert(ok.co2Grams === 12, "co2Grams optionnel");
assert(ok.attestationUrl.indexOf("https://") === 0, "attestation seulement si URL");
assert(eco.readImpact({ status: "OK", numberOfLiters: 1, attestationUrl: "note.pdf" }).attestationUrl === "", "pas d'URL relative");
assert(eco.equivalenceLabel(0.2) === "≈ 1 verre (25 cl)", "verre 25 cl");
assert(eco.equivalenceLabel(0.5) === "≈ 1 gourde (50 cl)", "gourde 50 cl");
assert(eco.equivalenceLabel(2.4) === "≈ 5 gourdes (50 cl)", "2,4 L = 5 gourdes");
["www.agilotext.com", "agilotext.com", "agilotext-test.webflow.io"].forEach(function (host) {
  assert(eco.resolveDisplayedImpact(null, host) == null, "JSON vide masqué sur " + host);
  assert(eco.resolveDisplayedImpact({ status: "KO", errorMessage: "invalid_token" }, host) == null, "KO masqué sur " + host);
  assert(eco.resolveDisplayedImpact({ status: "OK" }, host) == null, "litres absents masqués sur " + host);
  assert(eco.resolveDisplayedImpact({ status: "OK", numberOfLiters: 0 }, host) == null, "0 L masqué sur " + host);
  assert(eco.resolveDisplayedImpact({ status: "OK", water_liters: 0 }, host) == null, "water_liters 0 masqué sur " + host);
});
const real = eco.resolveDisplayedImpact({ status: "OK", numberOfLiters: 8.9 }, "www.agilotext.com");
assert(real && real.liters === 8.9 && real.preview === false, "un chiffre positif s'affiche sans aperçu");
assert(eco.resolveDisplayedImpact({ status: "OK", numberOfLiters: 8.9 }, "agilotext-test.webflow.io").liters === 8.9, "le site test n'a plus de 2,4 L");
assert(!src.includes("Aperçu. La mesure réelle"), "plus de mention d'aperçu");
assert(!src.includes("previewImpact"), "plus d'aperçu 2,4 L");
assert(!src.includes(">RSE<"), "plus de pastille RSE");
assert(src.includes('viewBox="0 0 18 18"'), "goutte Nucleo 18");
assert(src.includes("stroke-width=\"1.5\""), "goutte en trait");
assert(src.includes("stopPropagation"), "le clic ne remonte pas aux minutes");
assert(src.includes("Empreinte eau du mois"), "libellé accessible");
assert(!src.includes("z-index:120"), "plus de z-index 120");
assert(src.includes("z-index:9999"), "modale au-dessus de la sidebar");
assert(src.includes("Saviez-vous que ?"), "encadré analogie");
assert(src.includes("L'attestation arrive."), "attestation à venir");
assert(src.includes("agilo-eco-title"), "titre propre");
assert(src.includes("aq-modal"), "classes de la modale minutes");
assert(!src.includes('data-aq="modal"'), "pas d'attribut du widget minutes");
assert(eco.equivalenceLabel(9) === "≈ 1 pack (9 L)", "pack 9 L");
assert(eco.equivalenceLabel(12) === "", "au-delà du pack : litres seuls");
assert(eco.analogySentence(0.1) === "Ça correspond à moins d'un verre (25 cl).", "moins d'un verre en phrase");
assert(eco.analogySentence(0.2) === "Ça correspond à environ 1 verre (25 cl).", "verre en phrase");
assert(eco.analogySentence(8.9) === "Ça correspond à environ 18 gourdes (50 cl).", "8,9 L en phrase");
assert(eco.analogySentence(9) === "Ça correspond à environ 1 pack (9 L).", "pack en phrase");
assert(eco.analogySentence(12) === "Ça correspond à environ 24 gourdes (50 cl).", "12 L en gourdes");
assert(eco.analogySentence(0) === "", "0 L sans phrase");
assert(eco.glassLevel(9) === 100, "verre plein à 9 L");
assert(eco.glassLevel(18) === 100, "plafond visuel");
assert(eco.apiBaseForHost("agilotext-test.webflow.io") === "https://api.agilotext.com/api/v1", "API live, y compris sur le site test");
assert(eco.apiBaseForHost("www.agilotext.com") === "https://api.agilotext.com/api/v1", "API live");
assert(src.includes("water_liters"), "clé live");
assert(src.includes("numberOfLiters"), "ancien nom en secours");
assert(!src.includes("8.9 L"), "pas de litres en dur");
assert(src.includes(".agilo-quotas-flat"), "cible jauge minutes");
assert(src.includes("getEnvironmentalImpactForMonth"), "endpoint mois");

console.log("agilo-eco-impact.test.mjs OK");
