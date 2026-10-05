import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canCloseAfterBatch } from '../agiloshield-v2-close.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const open = {left: 0, problems: 0, unresolved: 0, reviewRows: 0, hasRevision: true};

assert.equal(canCloseAfterBatch({...open, action: 'KEEP'}), true, 'KEEP with nothing left closes');
assert.equal(canCloseAfterBatch({...open, action: 'MASK'}), true, 'MASK with nothing left closes');
assert.equal(canCloseAfterBatch({...open, action: 'MASK', left: 1}), false, 'a zone left to draw does not close');
assert.equal(canCloseAfterBatch({...open, action: 'KEEP', problems: 1}), false, 'a list rule does not close');
assert.equal(canCloseAfterBatch({...open, action: 'MASK', unresolved: 1}), false, 'an unplaced mask does not close');
assert.equal(canCloseAfterBatch({...open, action: 'KEEP', reviewRows: 2}), false, 'undecided passages do not close');
assert.equal(canCloseAfterBatch({...open, action: 'KEEP', hasRevision: false}), false, 'no revision does not close');
assert.equal(canCloseAfterBatch({...open, action: 'OTHER'}), false, 'an unknown choice does not close');

const embed = fs.readFileSync(path.join(root, 'agiloshield-v2-embed.js'), 'utf8');
assert.ok(embed.includes('validatedByUser'), 'the session remembers the user validation');
assert.ok(embed.includes('skipConfirm'), 'the chosen download skips the second question');
assert.ok(embed.includes("drawerMessage('Document validé.')"), 'the closed review says the document is validated');
const keptStart = embed.indexOf('async function finishKeptBatch');
const keptEnd = embed.indexOf('async function finishGroupedDecision');
assert.ok(embed.slice(keptStart, keptEnd).includes('markUserValidated'), 'KEEP batch can close');
assert.ok(embed.slice(embed.indexOf('async function finishGroupedDecision'),
  embed.indexOf('async function reloadReviewError')).includes('markUserValidated'), 'MASK batch can close');

console.log('close: PASS');
