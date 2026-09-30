import assert from 'node:assert/strict';
import { AgiloShieldV2Client, digestListDirectives, freezeJobSelection } from '../agiloshield-v2-client.js';

assert.equal(await digestListDirectives({anon2ExclusionList:['École des mines'],
  anon2InclusionList:['Jean Dupont','Cœur-de-l’Est']}),
  '273dd46bede9bf24db124ba3d7c9037b04958236c5fe447807fb058384f9d91a');
const mutablePolicy={schemaVersion:1,selectedTypes:['PER'],sensitiveKeepAcknowledged:false,digest:'first'};
const mutableLists={anon2InclusionList:['Jean Dupont'],anon2ExclusionList:[]};
const frozen=freezeJobSelection({policy:mutablePolicy,lists:mutableLists,mode:'ANONYMIZE'});
mutablePolicy.selectedTypes.push('ORG');mutablePolicy.digest='second';
mutableLists.anon2InclusionList[0]='Alice Martin';
assert.deepEqual(frozen,{digest:'first',selectedTypes:['PER'],mode:'ANONYMIZE',
  policy:{schemaVersion:1,selectedTypes:['PER'],sensitiveKeepAcknowledged:false},
  lists:{anon2InclusionList:['Jean Dupont'],anon2ExclusionList:[]}});

const seen = [];
let artifactRevision='r2';
const job = {status:'READY', reviewRevision:'r2', protectionPolicy:{digest:'d1'}};
const review = {revision:'r2', protectionPolicy:{digest:'d1'}};
const fetchImpl = async (url, options) => {
  seen.push({url, options});
  const path = new URL(url).pathname;
  if (path.endsWith('/review')) return new Response(JSON.stringify(review), {status:200});
  if (path.endsWith('/download')) return new Response('file', {status:200, headers:{
    'X-Agiloshield-Policy-Digest':'d1', 'X-Agiloshield-Revision':artifactRevision,
    'X-Agiloshield-Status':'READY', 'X-Agiloshield-Assurance':'technical-ready'}});
  if (path.endsWith('/pseudonym-key')) return new Response('SYNTHETIC_KEY', {status:200, headers:{
    'X-Agiloshield-Policy-Digest':'d1','X-Agiloshield-List-Digest':'list-current',
    'X-Agiloshield-Revision':'r2','X-Agiloshield-Status':'READY',
    'X-Agiloshield-Assurance':'technical-ready','X-Agiloshield-Processing-Mode':'PSEUDONYMIZE'}});
  if (path.endsWith('/review/commands')) return new Response(JSON.stringify({revision:'r3'}), {status:200});
  return new Response(JSON.stringify(job), {status:200});
};
const client = new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
  authHeaders:async () => ({'X-Agilotext-Token':'USER_ONLY'}), fetchImpl});
const previewAbort=new AbortController();
await client.textPreview({processingMode:'ANONYMIZE',text:'Synthetic only'},previewAbort.signal);
assert.equal(seen.at(-1).url,'https://staging.example/api/text/preview');
assert.equal(seen.at(-1).options.method,'POST');
assert.equal(seen.at(-1).options.signal,previewAbort.signal);
assert.throws(()=>client.textPreview({processingMode:'PSEUDONYMIZE'}),/anonymize only/);
const response = await client.checkedArtifact(7, {expectedDigest:'d1', expectedRevision:'r2'});
assert.equal(await response.text(), 'file');
await client.upload(new Blob(['synthetic']), {schemaVersion:1,selectedTypes:[]}, {
  anon2InclusionList:['MOT A'],anon2ExclusionList:[]});
const form=seen.at(-1).options.body;
assert.deepEqual(JSON.parse(form.get('anon2InclusionList')), ['MOT A']);
assert.deepEqual(JSON.parse(form.get('anon2ExclusionList')), []);
await client.listHistory('/history/v2',{cursor:'page-2',limit:12});
assert.equal(new URL(seen.at(-1).url).searchParams.get('cursor'),'page-2');
assert.throws(()=>client.listHistory('https://external.test/jobs'),/Invalid Java history route/);
await client.downloadZip('/history/v2/zip',[
  {jobId:'1',revision:'r1',policyDigest:'d1'},
  {jobId:'2',revision:'r2',policyDigest:'d2'}]);
assert.deepEqual(JSON.parse(seen.at(-1).options.body).jobs.map(item=>item.jobId),['1','2']);
assert.throws(()=>client.downloadZip('/history/v2/zip',[
  {jobId:'1',revision:'r1',policyDigest:'d1'}]),/Invalid certified ZIP selection/);
await assert.rejects(() => client.upload(new Blob(['synthetic']), {}, {
  anon2InclusionList:[]}), /Both V2 list arrays/);
await client.decide(7, 'd1', {revision:'r2', occurrenceId:'o1', action:'KEEP', reason:'test'});
assert.equal(seen.at(-1).options.headers['X-Agiloshield-Policy-Digest'], 'd1');
await client.addLinkedRegion(7, 'd1', {revision:'r2', page:1, rect:[1,2,3,4],
  occurrenceId:'o1', sourceRevision:'s1', documentId:'doc', reason:'test'});
assert.equal(JSON.parse(seen.at(-1).options.body).occurrenceId, 'o1');
await client.addManualRegion(7, 'd1', {revision:'r2', page:1, rect:[5,6,15,16]});
assert.equal(JSON.parse(seen.at(-1).options.body).op, 'ADD_MANUAL_REGION');
assert.equal(JSON.parse(seen.at(-1).options.body).occurrenceId, undefined);
assert.deepEqual(JSON.parse(seen.at(-1).options.body).rect, [5,6,15,16]);
job.reviewRevision = 'r3';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1', expectedRevision:'r2'}), /Stale/);
job.reviewRevision='r2';
job.listDigest='list-current';review.listDigest='list-current';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1',
  expectedListDigest:'list-older', expectedRevision:'r2'}), /Stale/);
job.processingMode='PSEUDONYMIZE';
assert.equal(await (await client.checkedArtifact(7,{kind:'key',expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2'})).text(),'SYNTHETIC_KEY');
job.status='REVIEW_REQUIRED';
await assert.rejects(() => client.checkedArtifact(7,{kind:'key',expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2'}),/Stale/);
job.status='READY';
artifactRevision='r1';
await assert.rejects(() => client.checkedArtifact(7,{expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2'}),/Stale artifact/);
artifactRevision='r2';
assert.ok(seen.every(call => !call.url.includes(':8091')));
const xhrCalls=[];
const progress=[];
const xhrClient=new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
  authHeaders:async()=>({'X-Agilotext-Token':'USER_ONLY'}),
  xhrFactory:()=>({upload:{},headers:{},open(method,url){this.method=method;this.url=url;},
    setRequestHeader(name,value){this.headers[name]=value;},send(body){
      xhrCalls.push({method:this.method,url:this.url,headers:this.headers,body});
      this.upload.onprogress({lengthComputable:true,loaded:5,total:10});
      this.status=202;this.responseText=JSON.stringify({jobId:'synthetic-1'});this.onload();
    }})});
assert.equal((await xhrClient.upload(new Blob(['test']),{schemaVersion:1,selectedTypes:[]},
  {processingMode:'ANONYMIZE',uploadId:'stable-operation-1',
    onUploadProgress:(loaded,total)=>progress.push([loaded,total])})).jobId,'synthetic-1');
assert.deepEqual(progress,[[5,10]]);
assert.equal(xhrCalls[0].headers['X-Agiloshield-Upload-Id'],'stable-operation-1');
assert.equal(xhrCalls[0].headers['X-Agilotext-Token'],'USER_ONLY');
assert.equal(xhrCalls[0].headers['Content-Type'],undefined);
assert.equal(xhrCalls[0].body.get('processingMode'),'ANONYMIZE');
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
