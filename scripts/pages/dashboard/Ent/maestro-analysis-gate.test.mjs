import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'maestro-context-ent.js'), 'utf8');
const start = src.indexOf('/* analysisBlocksSubmit:start */');
const end = src.indexOf('/* analysisBlocksSubmit:end */');
assert.ok(start >= 0 && end > start, 'prédicat introuvable');
const block = src.slice(start, end);
const analysisBlocksSubmit = new Function(block + '\nreturn analysisBlocksSubmit;')();

const loading = [{ status: 'loading' }];
const ok = [{ status: 'ok' }];
const warn = [{ status: 'warn' }];

assert.equal(analysisBlocksSubmit([], false, true), false);
assert.equal(analysisBlocksSubmit([], true, true), false);
assert.equal(analysisBlocksSubmit(loading, true, true), true);
assert.equal(analysisBlocksSubmit(loading, false, true), true);
assert.equal(analysisBlocksSubmit(ok, false, true), false);
assert.equal(analysisBlocksSubmit(warn, false, true), false);
assert.equal(analysisBlocksSubmit(loading, false, false), false);
assert.equal(analysisBlocksSubmit([{ status: 'ok' }, { status: 'loading' }], false, true), true);
