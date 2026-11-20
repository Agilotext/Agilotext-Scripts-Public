import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const embed = fs.readFileSync(path.join(root, 'agiloshield-v2-embed.js'), 'utf8');
const maskStart = embed.indexOf('async function maskWhenEveryPlaceIsKnown');
const maskEnd = embed.indexOf('async function approveHumanReview');
const mask = embed.slice(maskStart, maskEnd);
assert.ok(mask.includes('if(!entry.hasValidationContract)'), 'old server keeps the current mask');
assert.ok(mask.includes('if(!place.publish)return'), 'a missing place skips the old command');
assert.ok(!mask.slice(0, mask.indexOf('hasValidationContract')).includes('skipUnresolved'),
  'the flag is not sent before the contract check');
const oldPath = mask.slice(0, mask.indexOf('skipUnresolved:true'));
assert.ok(oldPath.indexOf('linkPassageBox') < oldPath.indexOf('api.decideAll') &&
  oldPath.indexOf('api.decideAll') < oldPath.indexOf('await apply('));
const fresh = mask.slice(mask.indexOf('if(entry.review&&Object.hasOwn(entry.review,\'workflowState\')'));
assert.ok(fresh.includes('skipUnresolved:true'));
assert.ok(fresh.includes('if(receipt?.appliedCount>0)await apply('), 'apply runs only when something was masked');
assert.ok(!fresh.includes('NEW_MASK_REQUIRES_LINKED_REGION'), 'the new receipt does not block apply');
const approve = embed.slice(maskEnd, embed.indexOf('async function undoLastReview'));
assert.ok(approve.includes('finally'), 'the button is re-enabled after every attempt');
assert.ok(approve.includes('entry.validating=false'));
assert.ok(approve.includes("if(control?.isConnected)control.disabled=false"));
const attested = approve.indexOf('if(entryAttested(entry)){await deliverValidated(entry);return;}');
const post = approve.indexOf('api.approveHumanVerification');
assert.ok(attested !== -1 && attested < post, 'a second click downloads without another attestation');
const leak = approve.indexOf('if(hasKnownLeak(entry))');
assert.ok(leak !== -1 && leak < post, 'a known leak refuses the attestation');
assert.ok(approve.includes('Un passage reste lisible. La validation ne part pas.'));
assert.ok(approve.indexOf('await loadCurrent(entry);') < post);
const deliver = embed.slice(embed.indexOf('async function deliverValidated'), embed.indexOf('function hasKnownLeak'));
assert.ok(deliver.indexOf('defer:true') < deliver.indexOf('link.click()'), 'files are checked before the browser download');
assert.ok(embed.includes('queueProcessingLines(entry.pageProgress)'));
assert.ok(embed.includes('pagesLeftNotice'));
assert.ok(!embed.includes('127.0.0.1:7689') && !embed.includes('__ASV2_PROBE'));
console.log('validation: PASS');
