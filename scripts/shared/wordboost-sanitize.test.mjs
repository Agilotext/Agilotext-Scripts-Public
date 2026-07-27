/**
 * Tests — wordboost-sanitize
 * node scripts/shared/wordboost-sanitize.test.mjs
 */
import assert from "node:assert/strict";
import {
  validateWord,
  sanitizeWordList,
  unwrapBracketArtifact,
  isBracketServerErrorMessage,
} from "./wordboost-sanitize.mjs";

let ok = 0;
function check(cond, label) {
  assert.ok(cond, label);
  ok++;
  console.log("ok", label);
}

check(unwrapBracketArtifact("oiuytr").unwrapped === false, "unwrap: plain");
check(unwrapBracketArtifact("[oiuytr]").value === "oiuytr", "unwrap: List.toString simple");
check(unwrapBracketArtifact('["oiuytr"]').value === "oiuytr", "unwrap: quoted");
check(unwrapBracketArtifact("[a, b]").value === null, "unwrap: multi list rejected");

check(validateWord("oiuytr").ok === true, "validate: ascii ok");
check(validateWord("[oiuytr]").ok === true, "validate: unwrap then ok");
check(validateWord("[oiuytr]").normalized === "oiuytr", "validate: normalized sans crochets");
check(validateWord("[oiuytr]").corrected === true, "validate: corrected flag");
check(validateWord("Sœurs").normalized === "Soeurs", "validate: ligature oe");
check(validateWord("[a, b]").ok === false, "validate: multi list invalide");

const clean = sanitizeWordList(["[oiuytr]", "Sœurs", "oiuytr", "[bad, list]"]);
check(clean.words.includes("oiuytr"), "sanitize: oiuytr present");
check(clean.words.includes("Soeurs"), "sanitize: Soeurs present");
check(clean.words.filter((w) => w === "oiuytr").length === 1, "sanitize: dédup");
check(clean.rejected.some((r) => r.reason === "list_tostring"), "sanitize: multi rejeté");

check(
  isBracketServerErrorMessage('Invalid to-word: got "[oiuytr]"') === true,
  "ON_ERROR bracket detect"
);
check(isBracketServerErrorMessage('got "oiuytr"') === false, "ON_ERROR plain not bracket");

console.log(`\nRésultat : ${ok} ok`);
