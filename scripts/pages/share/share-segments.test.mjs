/**
 * Tests — mapGuestSegments (milli_start → secondes)
 * Exécution : node scripts/pages/share/share-segments.test.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { mapGuestSegments } = require(path.join(__dirname, 'share-segments.js'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const a = mapGuestSegments([{ milli_start: 65000, speaker: 'A', text: 'x' }]);
assert(a.length === 1 && a[0].start === 65, 'milli_start 65000 → 65 (pas 65000)');

const b = mapGuestSegments([{ milli_start: 1000, text: 'y' }]);
assert(b[0].start === 1, 'milli_start 1000 → 1');

const c = mapGuestSegments([{ start: 14, text: 'mock' }]);
assert(c[0].start === 14, 'start mock reste en secondes');

const d = mapGuestSegments([{ start: 7200000, text: 'ms' }]);
assert(d[0].start === 7200, 'start > 1e6 traité comme ms');

const e = mapGuestSegments([{ milliStart: 45000, text: 'camel' }]);
assert(e[0].start === 45, 'milliStart camelCase');

const f = mapGuestSegments([{ milli_start: 0, text: 'z' }, { milli_start: 100, text: '' }]);
assert(f.length === 1 && f[0].start === 0, 'filtre texte vide ; 0 ms → 0 s');

console.log('share-segments.test.mjs OK');
