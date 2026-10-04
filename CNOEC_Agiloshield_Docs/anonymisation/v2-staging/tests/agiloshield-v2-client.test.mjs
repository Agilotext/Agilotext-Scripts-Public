import assert from 'node:assert/strict';
import { AgiloShieldV2Client, digestListDirectives, freezeJobSelection,
  v2Capabilities, assertCreatedJob, assertPreviewHeaders, currentResultAvailable,
  defaultRestoreUrl } from '../agiloshield-v2-client.js';

assert.equal(await digestListDirectives({anon2ExclusionList:['École des mines'],
  anon2InclusionList:['Jean Dupont','Cœur-de-l’Est']}),
  '273dd46bede9bf24db124ba3d7c9037b04958236c5fe447807fb058384f9d91a');
const mutablePolicy={schemaVersion:1,selectedTypes:['PER'],sensitiveKeepAcknowledged:false,digest:'first'};
const mutableLists={anon2InclusionList:['Jean Dupont'],anon2ExclusionList:[]};
const frozen=freezeJobSelection({policy:mutablePolicy,lists:mutableLists,mode:'ANONYMIZE'});
assert.deepEqual(v2Capabilities({listDirectives:true,
  processingModes:['ANONYMIZE','PSEUDONYMIZE'],pseudonymKeyDownload:true,
  addOccurrence:true,qaReport:true,humanVerification:true,pseudonymKeyReviewRequired:true,
  pseudonymRestore:true}),
  {lists:true,pseudonymize:true,addOccurrence:true,qaReport:true,humanVerification:true,
    pseudonymKeyReviewRequired:true,pseudonymRestore:true});
assert.deepEqual(v2Capabilities({processingModes:['PSEUDONYMIZE']}),
  {lists:false,pseudonymize:false,addOccurrence:false,qaReport:false,
    humanVerification:false,pseudonymKeyReviewRequired:false,pseudonymRestore:false});
assert.deepEqual(assertCreatedJob({jobId:'job-1',status:'PENDING',
  protectionPolicy:{digest:'d1'},listDigest:'list-current',processingMode:'ANONYMIZE'},
  {digest:'d1',listDigest:'list-current',mode:'ANONYMIZE'}).jobId,'job-1');
assert.deepEqual(freezeJobSelection({policy:{selectedTypes:[],digest:'empty',
  sensitiveKeepAcknowledged:true},mode:'ANONYMIZE'}).policy.selectedTypes,[]);
assert.equal(assertCreatedJob({jobId:'empty-job',status:'PENDING',
  protectionPolicy:{digest:'empty'},listDigest:'list-empty',processingMode:'ANONYMIZE'},
  {digest:'empty',listDigest:'list-empty',mode:'ANONYMIZE'}).jobId,'empty-job');
for (const invalid of [
  {jobId:'job-1',status:'PENDING',processingMode:'ANONYMIZE'},
  {jobId:'job-1',status:'PENDING',protectionPolicy:{digest:'d1'}},
  {jobId:'job-1',status:'PENDING',protectionPolicy:{digest:'d1'},processingMode:'PSEUDONYMIZE'},
  {jobId:'job-1',status:'PENDING',protectionPolicy:{digest:'d1'},processingMode:'ANONYMIZE',listDigest:'old'},
]) assert.throws(()=>assertCreatedJob(invalid,{digest:'d1',listDigest:'list-current',mode:'ANONYMIZE'}),
  /Réponse de création incohérente/);
mutablePolicy.selectedTypes.push('ORG');mutablePolicy.digest='second';
mutableLists.anon2InclusionList[0]='Alice Martin';
assert.deepEqual(frozen,{digest:'first',selectedTypes:['PER'],mode:'ANONYMIZE',
  policy:{schemaVersion:1,selectedTypes:['PER'],sensitiveKeepAcknowledged:false},
  lists:{anon2InclusionList:['Jean Dupont'],anon2ExclusionList:[]}});

const seen = [];
let artifactRevision='r2';
const job = {status:'READY', workflowState:'RESULT', assurance:'technical-ready',
  reviewRevision:'r2', protectionPolicy:{digest:'d1'}, listDigest:'list-current',processingMode:'ANONYMIZE'};
const review = {status:'READY', workflowState:'RESULT', deliverable:true,previewAvailable:true,
  revision:'r2', protectionPolicy:{digest:'d1'}, listDigest:'list-current',processingMode:'ANONYMIZE'};
assert.equal(currentResultAvailable(job,review),true);
assert.equal(currentResultAvailable({...job,status:'FAILED'},review),false);
assert.equal(currentResultAvailable({...job,status:'FAILED',resultAvailable:true},
  {...review,status:'FAILED'}),false);
assert.equal(currentResultAvailable({...job,status:'REVIEW_REQUIRED',assurance:'non-verified'},
  {...review,status:'REVIEW_REQUIRED',deliverable:false}),true);
assert.equal(currentResultAvailable({...job,status:'REVIEW_REQUIRED',assurance:'non-verified'},
  {...review,status:'REVIEW_REQUIRED',deliverable:false,previewAvailable:false}),false);
assert.equal(currentResultAvailable({...job,status:'REVIEW_REQUIRED',resultAvailable:true,
  workflowState:'DIRTY'}, {...review,status:'REVIEW_REQUIRED'}),false);
const previewHeaders=new Headers({
  'X-Agiloshield-Policy-Digest':'d1','X-Agiloshield-List-Digest':'list-current',
  'X-Agiloshield-Revision':'r2','X-Agiloshield-Status':'READY',
  'X-Agiloshield-Processing-Mode':'ANONYMIZE',
  'X-Agiloshield-Assurance':'review-preview'});
const previewResponse={headers:previewHeaders};
const previewExpected={kind:'anon',digest:'d1',listDigest:'list-current',
  revision:'r2',status:'READY',mode:'ANONYMIZE'};
assert.equal(assertPreviewHeaders(previewResponse,previewExpected),previewResponse);
previewHeaders.delete('X-Agiloshield-List-Digest');
assert.equal(assertPreviewHeaders(previewResponse,previewExpected),previewResponse);
previewHeaders.set('X-Agiloshield-List-Digest','stale-list');
assert.throws(()=>assertPreviewHeaders(previewResponse,previewExpected),/Aperçu non conforme/);
previewHeaders.delete('X-Agiloshield-List-Digest');
const fetchImpl = async (url, options) => {
  seen.push({url, options});
  const path = new URL(url).pathname;
  if (path.endsWith('/review')) return new Response(JSON.stringify(review), {status:200});
  if (path.endsWith('/download')) return new Response('file', {status:200, headers:{
    'X-Agiloshield-Policy-Digest':'d1', 'X-Agiloshield-Revision':artifactRevision,
    'X-Agiloshield-Processing-Mode':job.processingMode,
    'X-Agiloshield-Status':'READY', 'X-Agiloshield-Assurance':'technical-ready'}});
  if (path.endsWith('/pseudonym-key')) return new Response('SYNTHETIC_KEY', {status:200, headers:{
    'X-Agiloshield-Policy-Digest':'d1','X-Agiloshield-List-Digest':'list-current',
    'X-Agiloshield-Revision':'r2','X-Agiloshield-Status':'READY',
    'X-Agiloshield-Assurance':'technical-ready','X-Agiloshield-Processing-Mode':'PSEUDONYMIZE'}});
  if (path.endsWith('/review/commands')) return new Response(JSON.stringify({revision:'r3'}), {status:200});
  if (path.endsWith('/reconcileAnon2Text')) {
    const count = options.body.getAll('anonFile').length;
    if (count > 1) return new Response('not-a-zip', {status:200,
      headers:{'Content-Type':'application/octet-stream'}});
    return new Response('RESTORED', {status:200, headers:{
      'Content-Type':'application/pdf',
      'Content-Disposition':'attachment; filename="restaure-secret.pdf"'}});
  }
  return new Response(JSON.stringify(job), {status:200});
};
const client = new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
  authHeaders:async () => ({'X-Agilotext-Token':'USER_ONLY'}), fetchImpl});
const response = await client.checkedArtifact(7, {expectedDigest:'d1', expectedListDigest:'list-current',
  expectedRevision:'r2',expectedMode:'ANONYMIZE'});
assert.equal(await response.text(), 'file');
job.status='REVIEW_REQUIRED';job.assurance='non-verified';
review.status='REVIEW_REQUIRED';review.deliverable=false;
const nonVerifiedClient = new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
  authHeaders:async () => ({'X-Agilotext-Token':'USER_ONLY'}), fetchImpl:async (url,options) => {
    const path=new URL(url).pathname;
    if(path.endsWith('/review'))return new Response(JSON.stringify(review),{status:200});
    if(path.endsWith('/result')){
      assert.equal(options.headers['X-Agiloshield-Confirm-Non-Verifie'],'true');
      return new Response(JSON.stringify({error:'RESULT_NOT_AVAILABLE',errorMessage:'Current result is not available'}),
        {status:409,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify(job),{status:200});
  }});
await assert.rejects(()=>nonVerifiedClient.checkedArtifact(7,{certified:false,
  expectedDigest:'d1',expectedListDigest:'list-current',expectedRevision:'r2',expectedMode:'ANONYMIZE'}),
  error=>error.status===409&&error.code==='RESULT_NOT_AVAILABLE');
job.status='READY';job.assurance='technical-ready';
review.status='READY';review.deliverable=true;
await client.upload(new Blob(['synthetic']), {schemaVersion:1,selectedTypes:[]}, {
  anon2InclusionList:['MOT A'],anon2ExclusionList:[]});
const form=seen.at(-1).options.body;
assert.deepEqual(JSON.parse(form.get('anon2InclusionList')), ['MOT A']);
assert.deepEqual(JSON.parse(form.get('anon2ExclusionList')), []);
await client.listHistory('/history/v2',{cursor:'page-2',limit:12});
assert.equal(new URL(seen.at(-1).url).searchParams.get('cursor'),'page-2');
assert.throws(()=>client.listHistory('https://external.test/jobs'),/Invalid history route/);
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
await client.decideAll(7, 'd1', {revision:'r2', action:'MASK'});
const batchBody=JSON.parse(seen.at(-1).options.body);
assert.equal(batchBody.op, 'DECIDE_ALL_REVIEW');
assert.equal(batchBody.action, 'MASK');
assert.equal(batchBody.reason, 'review_batch');
assert.equal(batchBody.revision, 'r2');
assert.equal(typeof batchBody.commandId, 'string');
assert.ok(batchBody.commandId.length>8);
await client.decideAll(7, 'd1', {revision:'r2', action:'KEEP'});
assert.notEqual(JSON.parse(seen.at(-1).options.body).commandId, batchBody.commandId);
assert.throws(()=>client.decideAll(7,'d1',{revision:'r2',action:'DROP'}),/Invalid decision/);
assert.equal(defaultRestoreUrl('https://apitest.agilotext.com/api/agiloshield-v2'),
  'https://apitest.agilotext.com/api/v1/reconcileAnon2Text');
const pdf=new File(['%PDF'],'secret.pdf',{type:'application/pdf'});
const key=new File(['a=b'],'secret.properties',{type:'text/plain'});
const reconcileClient=new AgiloShieldV2Client({
  baseUrl:'https://apitest.agilotext.com/api/agiloshield-v2',
  authHeaders:async()=>({'X-Agilotext-Username':'anon@test.com',
    'X-Agilotext-Token':'TOKEN','X-Agilotext-Edition':'ent'}),
  fetchImpl});
const restored=await reconcileClient.reconcile([pdf],[key]);
assert.equal(await restored.text(),'RESTORED');
const reconcileForm=seen.at(-1).options.body;
assert.equal(reconcileForm.get('anonFile').name,'secret.pdf');
assert.equal(reconcileForm.get('propertiesFile').name,'secret.properties');
assert.equal(reconcileForm.get('username'),'anon@test.com');
assert.equal(new URL(seen.at(-1).url).pathname,'/api/v1/reconcileAnon2Text');
await assert.rejects(()=>reconcileClient.reconcile([pdf,pdf],[key,key]),/archive/);
await client.execute(7, 'd1', 'r3');
assert.equal(JSON.parse(seen.at(-1).options.body).revision, 'r3');
await client.addLinkedRegion(7, 'd1', {revision:'r2', page:1, rect:[1,2,3,4],
  occurrenceId:'o1', sourceRevision:'s1', documentId:'doc', reason:'test'});
assert.equal(JSON.parse(seen.at(-1).options.body).occurrenceId, 'o1');
await client.addOccurrence(7,'d1',{revision:'r2',surfaceId:'txt:1',start:2,end:5,
  selectedText:'A😀B'});
assert.deepEqual(JSON.parse(seen.at(-1).options.body),{
  op:'ADD_OCCURRENCE',revision:'r2',
  commandId:JSON.parse(seen.at(-1).options.body).commandId,
  surfaceId:'txt:1',start:2,end:5,selectedText:'A😀B',action:'MASK',reason:'human_added'});
assert.throws(()=>client.addOccurrence(7,'d1',{revision:'r2',surfaceId:'txt:1',
  start:2,end:4,selectedText:'A😀B'}),/Sélection originale invalide/);
const sevenChecks={names:true,addresses:true,phones:true,identifiers:true,
  logos_images:true,visual_regions:true,original_vs_final_all_pages:true};
await client.approveHumanVerification(7,'d1',{revision:'r2',checks:sevenChecks});
assert.deepEqual(JSON.parse(seen.at(-1).options.body).checks,sevenChecks);
assert.throws(()=>client.approveHumanVerification(7,'d1',{revision:'r2',
  checks:{...sevenChecks,names:false}}),/Vérifications humaines incomplètes/);
await client.addManualRegion(7,'d1',{revision:'r2',page:1,rect:[10,20,100,200]});
assert.deepEqual(JSON.parse(seen.at(-1).options.body),{
  op:'ADD_MANUAL_REGION',revision:'r2',
  commandId:JSON.parse(seen.at(-1).options.body).commandId,
  page:1,rect:[10,20,100,200],reason:'ZONE_MASQUEE_MANUELLEMENT'});
assert.throws(()=>client.addManualRegion(7,'d1',{revision:'r2',page:1,rect:[100,20,10,200]}),/Invalid PDF rectangle/);
job.reviewRevision = 'r3';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1',
  expectedListDigest:'list-current', expectedRevision:'r2',expectedMode:'ANONYMIZE'}), /Stale/);
job.reviewRevision='r2';
await assert.rejects(() => client.checkedArtifact(7, {expectedDigest:'d1',
  expectedListDigest:'list-older', expectedRevision:'r2',expectedMode:'ANONYMIZE'}), /Stale/);
job.processingMode='PSEUDONYMIZE';
review.processingMode='PSEUDONYMIZE';
await assert.rejects(() => client.checkedArtifact(7,{expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2',expectedMode:'ANONYMIZE'}),/Stale/);
assert.equal(await (await client.checkedArtifact(7,{kind:'key',expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2',expectedMode:'PSEUDONYMIZE'})).text(),'SYNTHETIC_KEY');
job.status='REVIEW_REQUIRED';
await assert.rejects(() => client.checkedArtifact(7,{kind:'key',expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2',expectedMode:'PSEUDONYMIZE'}),/Stale/);
job.status='READY';
job.assurance='non-verified';
await assert.rejects(() => client.checkedArtifact(7,{expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2',expectedMode:'PSEUDONYMIZE'}),/Stale/);
job.assurance='technical-ready';
artifactRevision='r1';
await assert.rejects(() => client.checkedArtifact(7,{expectedDigest:'d1',
  expectedListDigest:'list-current',expectedRevision:'r2',expectedMode:'PSEUDONYMIZE'}),/Stale artifact/);
artifactRevision='r2';
job.status='REVIEW_REQUIRED';job.assurance='non-verified';
review.status='REVIEW_REQUIRED';review.deliverable=false;
review.humanVerifiedDeliverable=true;review.humanVerification={reviewer:'synthetic-user'};
const editorCalls=[];
const editorClient=new AgiloShieldV2Client({baseUrl:'https://staging.example/api',
  authHeaders:async()=>({'X-Agilotext-Token':'USER_ONLY'}),fetchImpl:async(url,options)=>{
    editorCalls.push({url,options});const path=new URL(url).pathname;
    if(path.endsWith('/review'))return new Response(JSON.stringify(review));
    if(path.endsWith('/pseudonym-key')||path.endsWith('/human-verified-download'))
      return new Response('SYNTHETIC_ONLY',{headers:{
        'X-Agiloshield-Policy-Digest':'d1','X-Agiloshield-Revision':'r2',
        'X-Agiloshield-Status':'REVIEW_REQUIRED',
        'X-Agiloshield-Processing-Mode':'PSEUDONYMIZE',
        'X-Agiloshield-Assurance':path.endsWith('/pseudonym-key')?'non-verified':'human-verified'}});
    if(path.endsWith('/pseudonym/restore/inspect'))return new Response(JSON.stringify({inspectionId:'restore-'+'a'.repeat(32)}));
    if(path.endsWith('/pseudonym/restore'))return new Response('SYNTHETIC_RESTORE');
    return new Response(JSON.stringify(job));
  }});
assert.equal(await (await editorClient.checkedArtifact(7,{kind:'key',certified:false,
  expectedDigest:'d1',expectedListDigest:'list-current',expectedRevision:'r2',
  expectedMode:'PSEUDONYMIZE'})).text(),'SYNTHETIC_ONLY');
assert.equal(editorCalls.at(-1).options.headers['X-Agiloshield-Confirm-Non-Verifie'],'true');
assert.equal(await (await editorClient.checkedArtifact(7,{kind:'human',certified:false,
  expectedDigest:'d1',expectedListDigest:'list-current',expectedRevision:'r2',
  expectedMode:'PSEUDONYMIZE'})).text(),'SYNTHETIC_ONLY');
review.humanVerifiedDeliverable=false;
await assert.rejects(()=>editorClient.checkedArtifact(7,{kind:'human',certified:false,
  expectedDigest:'d1',expectedListDigest:'list-current',expectedRevision:'r2',
  expectedMode:'PSEUDONYMIZE'}),/Stale job state/);
const inspected=await editorClient.inspectRestore(new Blob(['synthetic']),new Blob(['synthetic-key']));
assert.equal(inspected.inspectionId,'restore-'+'a'.repeat(32));
assert.equal(editorCalls.at(-1).options.body.get('file').size,9);
await editorClient.executeRestore(inspected.inspectionId);
assert.equal(JSON.parse(editorCalls.at(-1).options.body).confirmSensitiveRestore,true);
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
