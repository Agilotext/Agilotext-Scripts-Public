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
const ok = eco.readImpact({ status: "OK", numberOfLiters: 8.9, co2Grams: 12, attestationUrl: "https://example.test/a.pdf" });
assert(ok && ok.liters === 8.9, "numberOfLiters");
assert(ok.co2Grams === 12, "co2Grams optionnel");
assert(ok.attestationUrl.indexOf("https://") === 0, "attestation seulement si URL");
assert(eco.readImpact({ status: "OK", numberOfLiters: 1, attestationUrl: "note.pdf" }).attestationUrl === "", "pas d'URL relative");
assert(eco.equivalenceLabel(0.2) === "≈ 1 verre (25 cl)", "verre 25 cl");
assert(eco.equivalenceLabel(0.5) === "≈ 1 gourde (50 cl)", "gourde 50 cl");
assert(eco.equivalenceLabel(9) === "≈ 1 pack (9 L)", "pack 9 L");
assert(eco.equivalenceLabel(12) === "", "au-delà du pack : litres seuls");
assert(eco.glassLevel(9) === 100, "verre plein à 9 L");
assert(eco.glassLevel(18) === 100, "plafond visuel");
assert(eco.apiBaseForHost("agilotext-test.webflow.io") === "https://apitest.agilotext.com/api/v1", "apitest sur le site test");
assert(eco.apiBaseForHost("www.agilotext.com") === "https://api.agilotext.com/api/v1", "prod ailleurs");
assert(src.includes("numberOfLiters"), "clé figée");
assert(!src.includes("8.9 L"), "pas de litres en dur");
assert(src.includes(".agilo-quotas-flat"), "cible jauge minutes");
assert(src.includes("getEnvironmentalImpactForMonth"), "endpoint mois");

console.log("agilo-eco-impact.test.mjs OK");
