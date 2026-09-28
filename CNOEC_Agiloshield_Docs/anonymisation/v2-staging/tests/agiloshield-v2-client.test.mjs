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
await client.decide(7, 'd1', {revision:'r2', occurrenceId:'o1', action:'KEEP', reason:'test'});
assert.equal(seen.at(-1).options.headers['X-Agiloshield-Policy-Digest'], 'd1');
await client.addLinkedRegion(7, 'd1', {revision:'r2', page:1, rect:[1,2,3,4],
  occurrenceId:'o1', sourceRevision:'s1', documentId:'doc', reason:'test'});
assert.equal(JSON.parse(seen.at(-1).options.body).occurrenceId, 'o1');
job.reviewRevision = 'r3';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1', expectedRevision:'r2'}), /Stale/);
assert.ok(seen.every(call => !call.url.includes(':8091')));
console.log('reference client contract: PASS');
