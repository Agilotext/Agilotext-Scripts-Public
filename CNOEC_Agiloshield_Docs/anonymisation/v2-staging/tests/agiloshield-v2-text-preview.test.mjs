import assert from 'node:assert/strict';
import { TextPreviewController, textPreviewAvailable } from '../agiloshield-v2-text-preview.js';

const capability={textPreview:{enabled:true,ephemeral:true,schemaVersion:1,
  processingModes:['ANONYMIZE'],maxChars:200}};
assert.equal(textPreviewAvailable({},capability),false);
assert.equal(textPreviewAvailable({TEXT_PREVIEW_READY:true},{}),false);
assert.equal(textPreviewAvailable({TEXT_PREVIEW_READY:true},{textPreview:{...capability.textPreview,
  ephemeral:false}}),false);
assert.equal(textPreviewAvailable({TEXT_PREVIEW_READY:true},capability),true);

const events=[];const requests=[];
let resolveFirst;
const snapshot=async()=>({policy:{digest:'policy-1',selectedTypes:[],
  sensitiveKeepAcknowledged:true},lists:{anon2InclusionList:[],anon2ExclusionList:[]},
  listDigest:'list-1'});
const controller=new TextPreviewController({snapshot,delay:5,render:event=>events.push(event),
  request:(payload,signal)=>{
    requests.push({payload,signal});
    if(requests.length===1)return new Promise(resolve=>{resolveFirst=resolve;});
    return Promise.resolve({requestId:payload.requestId,policyDigest:'policy-1',
      listDigest:'list-1',status:'READY',assurance:'EPHEMERAL_PREVIEW',qa:{passed:true},
      fragments:[{kind:'plain',text:'<script>alert(1)</script>'},
        {kind:'masked',text:'[PER]'}]});
  }});
controller.input('plus de dix caractères');
await new Promise(resolve=>setTimeout(resolve,12));
assert.equal(requests.length,0,'disabled controller must not contact Java');
controller.configure(true,200);
controller.input('court');
await new Promise(resolve=>setTimeout(resolve,12));
assert.equal(requests.length,0);
controller.input('Première valeur à protéger');
await new Promise(resolve=>setTimeout(resolve,12));
assert.equal(requests.length,1);
assert.deepEqual(requests[0].payload.protectionPolicy.selectedTypes,[]);
assert.deepEqual(requests[0].payload.anon2ExclusionList,[]);
controller.input('Seconde valeur à protéger');
await new Promise(resolve=>setTimeout(resolve,12));
assert.equal(requests.length,2);
resolveFirst({requestId:requests[0].payload.requestId,policyDigest:'policy-1',
  listDigest:'list-1',status:'READY',assurance:'EPHEMERAL_PREVIEW',qa:{passed:true},
  fragments:[{kind:'plain',text:'OLD'}]});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(events.filter(event=>event.state==='result').length,1);
assert.equal(events.at(-1).response.fragments[0].text,'<script>alert(1)</script>');
controller.input('');
assert.equal(events.at(-1).state,'empty');
controller.configure(false);
controller.input('Encore un texte à protéger');
await new Promise(resolve=>setTimeout(resolve,12));
assert.equal(requests.length,2);
console.log('dormant text preview controller: PASS');
