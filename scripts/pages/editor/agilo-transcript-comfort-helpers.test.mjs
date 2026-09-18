/**
 * Tests unitaires — confort transcription Magali (follow + trim split)
 * Exécution : node scripts/pages/editor/agilo-transcript-comfort-helpers.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-transcript-comfort-helpers.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {}, globalThis: null };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);

const C = sandbox.AgiloTranscriptComfort;
assert(C && typeof C.trimSplitNewlines === 'function', 'trimSplitNewlines exposé');
assert(typeof C.shouldScrollFollow === 'function', 'shouldScrollFollow exposé');
assert(typeof C.createFollowController === 'function', 'createFollowController exposé');
assert(typeof C.resolveActiveSegmentIndex === 'function', 'resolveActiveSegmentIndex exposé');

const segs = [
  { start: 0, end: 10 },
  { start: 10, end: 20 },
  { start: 20, end: 30 }
];
assert(C.resolveActiveSegmentIndex(5, segs, -1) === 0, 'index au début seg 0');
assert(C.resolveActiveSegmentIndex(15, segs, 0) === 1, 'recalc si active invalide');
assert(C.resolveActiveSegmentIndex(15, segs, 1) === 1, 'garde active si valide');
assert(C.resolveActiveSegmentIndex(99, segs, 1) === -1, 'hors plage → -1');
assert(C.resolveActiveSegmentIndex(5, [], 0) === -1, 'segments vides → -1');

const t1 = C.trimSplitNewlines('bonjour\n\n', '\n\n\nle texte');
assert(t1.left === 'bonjour', 'trim trailing newlines left');
assert(t1.right === 'le texte', 'trim leading newlines right');

const t2 = C.trimSplitNewlines('ok', 'suite');
assert(t2.left === 'ok' && t2.right === 'suite', 'inchangé sans blancs');

const t3 = C.trimSplitNewlines(null, undefined);
assert(t3.left === '' && t3.right === '', 'null/undefined → vide');

assert(C.shouldScrollFollow(true, true) === true, 'armé + hors vue → scroll');
assert(C.shouldScrollFollow(true, false) === false, 'armé + dans vue → pas de scroll');
assert(C.shouldScrollFollow(false, true) === false, 'gelé + hors vue → pas de scroll');
assert(C.shouldScrollFollow(false, false) === false, 'gelé + dans vue → pas de scroll');

let last = null;
const follow = C.createFollowController({ onChange(v) { last = v; } });
assert(follow.armed === true, 'défaut armé');
assert(follow.shouldScroll(true) === true, 'scroll si armé hors vue');

follow.disarm();
assert(follow.armed === false, 'disarm molette');
assert(last === false, 'onChange gelé');
assert(follow.shouldScroll(true) === false, 'pas de scroll gelé');

follow.arm();
assert(follow.armed === true, 'réarme horodatage');
assert(last === true, 'onChange armé');

follow.beginProgrammatic();
follow.disarm();
assert(follow.armed === true, 'scroll programmatique ne désarme pas');
follow.endProgrammatic();
follow.disarm();
assert(follow.armed === false, 'après programmatic, molette désarme');

console.log('agilo-transcript-comfort-helpers.test.mjs OK');
