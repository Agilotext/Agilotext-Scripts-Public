/**
 * Tests — Suivre l’audio (ends interpolés, index, couleurs, seek)
 * Exécution : node scripts/pages/share/share-follow.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'share-follow.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  window: { addEventListener: function () {}, document: { addEventListener: function () {}, dispatchEvent: function () {}, getElementById: function () { return null; } } },
  document: { addEventListener: function () {}, dispatchEvent: function () {}, getElementById: function () { return null; } },
  CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
  requestAnimationFrame: function (fn) { fn(); },
  Number: Number,
  Math: Math,
  String: String,
  Array: Array,
  Object: Object
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.CustomEvent = sandbox.CustomEvent;
sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
sandbox.window.Promise = Promise;
sandbox.Promise = Promise;
sandbox.setTimeout = setTimeout;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const F = sandbox.window.AgiloShareFollow;
assert(F, 'AgiloShareFollow exposé');
assert(sandbox.window.AgiloTranscriptFollow, 'AgiloTranscriptFollow exposé pour le dock');
assert(sandbox.window.AgiloTranscriptFollow.armed === true, 'follow armé par défaut');

const raw = [
  { speaker: 'Intervenant 1', start: 0, text: 'A' },
  { speaker: 'Intervenant 2', start: 14, text: 'B' },
  { speaker: 'Intervenant 1', start: 28, text: 'C' }
];
const segs = F.withSegmentEnds(raw, 40);
assert(segs[0].end === 14, 'end = start du suivant');
assert(segs[1].end === 28, 'end 2e = start 3e');
assert(segs[2].end === 40, 'dernier end = duration');

const noDur = F.withSegmentEnds(raw, 0);
assert(noDur[2].end === 29, 'sans duration, dernier = start + 1');

assert(F.resolveActiveSegmentIndex(14, segs, -1) === 1, 't=14 → seg 1');
assert(F.resolveActiveSegmentIndex(0, segs, -1) === 0, 't=0 → seg 0');
assert(F.resolveActiveSegmentIndex(27.9, segs, -1) === 1, 'juste avant 28 → seg 1');
assert(F.resolveActiveSegmentIndex(28, segs, -1) === 2, 't=28 → seg 2');
assert(F.resolveActiveSegmentIndex(100, segs, -1) === -1, 'hors plage');

const withoutEnd = F.resolveActiveSegmentIndex(14, raw, -1);
assert(withoutEnd === -1, 'sans end, index introuvable');

const c1 = F.getSpeakerColor('Intervenant 1');
const c1b = F.getSpeakerColor('Intervenant 1');
const c2 = F.getSpeakerColor('Intervenant 2');
assert(c1 === c1b, 'couleur stable pour un nom');
assert(c1 !== c2, 'deux locuteurs, deux couleurs');
assert(F.SPK_COLORS.length === 20, 'palette 20');
assert(c1 === '#174a96' || F.SPK_COLORS.indexOf(c1) >= 0, 'couleur dans la palette');

assert(typeof F.seekTo === 'function', 'seekTo exposé');
const audio = {
  duration: 40,
  paused: true,
  currentTime: 0,
  play: function () { this.paused = false; return Promise.resolve(); }
};
await F.seekTo(audio, 14);
assert(audio.currentTime === 14, 'seekTo pose currentTime à 14');
assert(audio.paused === false, 'seekTo lance la lecture');
assert(F.resolveActiveSegmentIndex(audio.currentTime, segs, -1) === 1, 'après seek 14 → seg 1');

F.setExpectedDuration(segs, audio);
assert(sandbox.window.__agiloExpectedDuration === 40, 'durée attendue = max(end, duration)');

console.log('share-follow.test.mjs OK');
