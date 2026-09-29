import assert from 'node:assert/strict';
import { AgiloShieldV2Client } from '../agiloshield-v2-client.js';

const seen = [];
const job = {status:'READY', reviewRevision:'r2', protectionPolicy:{digest:'d1'}};
const review = {revision:'r2', protectionPolicy:{digest:'d1'}};
const fetchImpl = async (url, options) => {
  seen.push({url, options});
  const path = new URL(url).pathname;
  if (path.endsWith('/review')) return new Response(JSON.stringify(review), {status:200});
  if (path.endsWith('/download')) return new Response('file', {status:200, headers:{
    'X-Agiloshield-Policy-Digest':'d1', 'X-Agiloshield-Revision':'r2',
    'X-Agiloshield-Status':'READY', 'X-Agiloshield-Assurance':'technical-ready'}});
  if (path.endsWith('/review/commands')) return new Response(JSON.stringify({revision:'r3'}), {status:200});
  return new Response(JSON.stringify(job), {status:200});
};
const client = new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
  authHeaders:async () => ({'X-Agilotext-Token':'USER_ONLY'}), fetchImpl});
const response = await client.checkedArtifact(7, {expectedDigest:'d1', expectedRevision:'r2'});
assert.equal(await response.text(), 'file');
await client.upload(new Blob(['synthetic']), {schemaVersion:1,selectedTypes:[]}, {
  anon2InclusionList:['MOT A'],anon2ExclusionList:[]});
const form=seen.at(-1).options.body;
assert.deepEqual(JSON.parse(form.get('anon2InclusionList')), ['MOT A']);
assert.deepEqual(JSON.parse(form.get('anon2ExclusionList')), []);
await assert.rejects(() => client.upload(new Blob(['synthetic']), {}, {
  anon2InclusionList:[]}), /Both V2 list arrays/);
await client.decide(7, 'd1', {revision:'r2', occurrenceId:'o1', action:'KEEP', reason:'test'});
assert.equal(seen.at(-1).options.headers['X-Agiloshield-Policy-Digest'], 'd1');
await client.addLinkedRegion(7, 'd1', {revision:'r2', page:1, rect:[1,2,3,4],
  occurrenceId:'o1', sourceRevision:'s1', documentId:'doc', reason:'test'});
assert.equal(JSON.parse(seen.at(-1).options.body).occurrenceId, 'o1');
job.reviewRevision = 'r3';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1', expectedRevision:'r2'}), /Stale/);
job.reviewRevision='r2';
job.listDigest='list-current';review.listDigest='list-current';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1',
  expectedListDigest:'list-older', expectedRevision:'r2'}), /Stale/);
assert.ok(seen.every(call => !call.url.includes(':8091')));
const nativeFetch = globalThis.fetch;
try {
  globalThis.fetch = function () {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return new Response(JSON.stringify({protectionPolicy:{selectedTypes:[]}}), {status:200});
  };
  const browserLikeClient = new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
    authHeaders:async () => ({})});
  assert.deepEqual((await browserLikeClient.preferences()).protectionPolicy.selectedTypes, []);
} finally { globalThis.fetch = nativeFetch; }
console.log('reference client contract: PASS');
