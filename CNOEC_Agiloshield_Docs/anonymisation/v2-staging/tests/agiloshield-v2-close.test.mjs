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
assert.ok(!embed.includes('validatedByUser'), 'the page does not invent a local Prêt');
assert.ok(!embed.includes('markUserValidated'), 'a batch does not mark the document ready');
assert.ok(!embed.includes('skipConfirm:true'), 'a non verified download still asks');
const keptStart = embed.indexOf('async function finishKeptBatch');
const keptEnd = embed.indexOf('async function finishGroupedDecision');
assert.ok(embed.slice(keptStart, keptEnd).includes('notReady'), 'KEEP waits for the server');
const grouped = embed.slice(keptEnd, embed.indexOf('async function reloadReviewError'));
assert.ok(grouped.includes('notReady'), 'MASK waits for the server');
assert.ok(grouped.includes('mustStayMasked'), 'a mandatory passage stays masked and is said so');
const settle = embed.slice(embed.indexOf('async function settleSkippedZone'),
  embed.indexOf('async function maskFoundPlaces'));
const keepBranch = settle.slice(0, settle.indexOf('const found=await passageBoxes'));
assert.ok(!keepBranch.includes("'MASK'"), 'leave visible never sends MASK');
assert.ok(settle.includes('passageBoxes(entry,row)'), 'a mask uses a known zone, not a search');
assert.ok(embed.includes('passageBoxes(entry,current,{search:true})'), 'search only highlights');

console.log('close: PASS');
