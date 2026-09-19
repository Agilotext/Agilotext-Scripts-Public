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

assert(C.foldSpeakerSearch('MÉNISSIER') === C.foldSpeakerSearch('menissier'), 'fold accents');
assert(C.foldSpeakerSearch('meni') === 'meni', 'fold lower');
assert(C.isJunkSpeakerLabel('Speaker_3') === true, 'junk Speaker_3');
assert(C.isJunkSpeakerLabel('Locuteur 2') === true, 'junk Locuteur 2');
assert(C.isJunkSpeakerLabel('spk-1') === true, 'junk spk-1');
assert(C.isJunkSpeakerLabel('Sandra MÉNISSIER') === false, 'vrai nom pas junk');
assert(C.isJunkSpeakerLabel('') === true, 'vide = junk');
const roster = ['Sandra MÉNISSIER', 'Florian BAUER', 'Speaker_3'];
const hit = C.filterSpeakerRoster(roster, 'meni');
assert(hit.length === 1 && hit[0] === 'Sandra MÉNISSIER', 'filtre conserve la casse');
assert(C.filterSpeakerRoster(roster, '').length === 3, 'query vide = tout');
assert(typeof C.shouldCreateSpeakerFromQuery === 'function', 'shouldCreateSpeakerFromQuery exposé');
assert(C.shouldCreateSpeakerFromQuery('Florian', []) === true, 'query sans roster → créer');
assert(C.shouldCreateSpeakerFromQuery('Florian', ['Florian']) === false, 'fold exact → pas créer');
assert(C.shouldCreateSpeakerFromQuery('FLORIAN', ['Florian']) === false, 'fold casse → pas créer');
assert(C.shouldCreateSpeakerFromQuery('Florian', ['Florian BAUER']) === true, 'partiel ≠ exact');
assert(C.shouldCreateSpeakerFromQuery('meni', ['Sandra MÉNISSIER']) === true, 'hit partiel, helper true (UI n’offre pas Ajouter s’il y a des lignes)');
assert(C.shouldCreateSpeakerFromQuery('', roster) === false, 'vide → pas créer');
assert(C.shouldCreateSpeakerFromQuery('   ', roster) === false, 'blancs → pas créer');
assert(typeof C.clampOffset === 'function', 'clampOffset exposé');
assert(typeof C.sliceTextAt === 'function', 'sliceTextAt exposé');
assert(typeof C.computeMidStart === 'function', 'computeMidStart exposé');
assert(typeof C.hasSpeakerLabels === 'function', 'hasSpeakerLabels exposé');
{
  const mid = C.sliceTextAt('abc', 1);
  assert(mid.left === 'a' && mid.right === 'bc', 'sliceTextAt milieu');
  const start = C.sliceTextAt('abc', 0);
  assert(start.left === '' && start.right === 'abc', 'sliceTextAt offset 0');
  const end = C.sliceTextAt('abc', 3);
  assert(end.left === 'abc' && end.right === '', 'sliceTextAt fin');
  const over = C.sliceTextAt('abc', 99);
  assert(over.left === 'abc' && over.right === '', 'sliceTextAt hors bornes haut');
  const neg = C.sliceTextAt('abc', -4);
  assert(neg.left === '' && neg.right === 'abc', 'sliceTextAt hors bornes bas');
  assert(C.clampOffset(1.8, 3) === 1, 'clampOffset floor');
  assert(C.clampOffset('x', 3) === 0, 'clampOffset non numérique');
}
assert(C.computeMidStart(0, 10) === 5, 'computeMidStart 0-10');
assert(C.computeMidStart(null, null) === null, 'computeMidStart sans times');
assert(C.computeMidStart(undefined, undefined) === null, 'computeMidStart undefined');
assert(C.hasSpeakerLabels([{ speaker: '' }]) === false, 'un locuteur vide → false');
assert(C.hasSpeakerLabels([{ speaker: 'Speaker_A' }]) === false, 'Speaker_A seul → false');
assert(C.hasSpeakerLabels([{ speaker: 'DURAND' }, { speaker: 'MARTIN' }]) === true, 'deux noms → true');
assert(C.hasSpeakerLabels([{ speaker: 'DURAND' }]) === true, 'un vrai nom → true');
assert(C.hasSpeakerLabels([]) === false, 'liste vide → false');

assert(C.speakerRosterStorageKey('1000040705') === 'agilo:speaker-roster:1000040705', 'clé job');
assert(C.speakerRosterStorageKey('') === '', 'pas de jobId → pas de clé');
assert(C.speakerRosterStorageKey(null) === '', 'null → pas de clé');

assert(typeof C.computePopoverPlace === 'function', 'computePopoverPlace exposé');
assert(typeof C.anchorVisibleInPane === 'function', 'anchorVisibleInPane exposé');
{
  const below = C.computePopoverPlace({
    anchor: { top: 100, left: 40, bottom: 120 },
    size: { width: 260, height: 80 },
    viewport: { width: 800, height: 600 },
    pad: 8
  });
  assert(below.top === 128 && below.left === 40, 'place sous l’ancre');
  const flip = C.computePopoverPlace({
    anchor: { top: 520, left: 40, bottom: 540 },
    size: { width: 260, height: 200 },
    viewport: { width: 800, height: 600 },
    pad: 8
  });
  assert(flip.top === 312, 'flip au-dessus si plus de place en bas');
  const clampL = C.computePopoverPlace({
    anchor: { top: 40, left: -20, bottom: 60 },
    size: { width: 260, height: 80 },
    viewport: { width: 800, height: 600 },
    pad: 8
  });
  assert(clampL.left === 8, 'clamp gauche');
  const sticky = C.computePopoverPlace({
    anchor: { top: 10, left: 40, bottom: 28 },
    size: { width: 260, height: 80 },
    viewport: { width: 800, height: 600 },
    pad: 8,
    stickyBottom: 48
  });
  assert(sticky.top === 56, 'stickyBottom pousse top');
}
const pane = { left: 0, top: 80, right: 400, bottom: 500 };
assert(C.anchorVisibleInPane({ left: 10, top: 90, right: 40, bottom: 110 }, pane) === true, '1 px dans le pane → visible');
assert(C.anchorVisibleInPane({ left: 10, top: 40, right: 40, bottom: 70 }, pane) === false, 'ratio 0 → hidden');
assert(C.anchorVisibleInPane({ left: 10, top: 499, right: 40, bottom: 510 }, pane) === true, '1 px encore visible');
assert(C.anchorVisibleInPane({ left: 10, top: 500, right: 40, bottom: 520 }, pane) === false, 'bord touché = hors');

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
