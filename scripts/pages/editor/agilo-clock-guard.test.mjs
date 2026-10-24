import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const saveSrc = fs.readFileSync(new URL('./Code-save_transcript-CORRIGE-V2.js', import.meta.url), 'utf8');
const editorSrc = fs.readFileSync(new URL('./confidence-v1/Code-main-editor-IFRAME_V04-confidence.js', import.meta.url), 'utf8');

function extract(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extract(saveSrc, 'agiloClocksAbsent') + '\nthis.agiloClocksAbsent = agiloClocksAbsent;', sandbox);
const agiloClocksAbsent = sandbox.agiloClocksAbsent;

const zeros = [
  { startSec: 0, endSec: 0 },
  { startSec: 0, endSec: 0 }
];
assert.equal(agiloClocksAbsent(zeros, 10_920_000, false), true);
assert.equal(agiloClocksAbsent([{ startSec: 0, endSec: 0 }], 10_920_000, false), false);
assert.equal(agiloClocksAbsent([
  { start: 0, end: 0 },
  { start: 90, end: 95 }
], 10_920_000, false), false);
assert.equal(agiloClocksAbsent(zeros, 0, true), true);
assert.match(saveSrc, /Horodatage absent, enregistrement arrêté pour ne pas effacer la durée\./);
assert.match(saveSrc, /agiloClocksAbsent\(segments, audioMs, window\.__agiloClocksAbsent\)/);
assert.match(saveSrc, /reason:'audio_duration_pending'/);
assert.match(editorSrc, /if \(!agiloClocksAbsent\(segments\)\)/);
assert.match(saveSrc, /fromSegments > 0 \? fromSegments : agiloKnownAudioMs\(\)/);

console.log('agilo-clock-guard.test.mjs OK');
