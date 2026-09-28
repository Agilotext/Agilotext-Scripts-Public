import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../agiloshield-v2-auth.js',import.meta.url),'utf8');
const win={};
const requests=[];
const dom={querySelector(selector){
  if(selector==='[name="memberEmail"]')return {value:''};
  if(selector==='[data-ms-member="email"]')return {textContent:'fixture@example.test'};
  return null;
}};
runInNewContext(source,{window:win,document:dom,fetch:async url=>{
  requests.push(String(url));return {ok:true,json:async()=>({status:'OK',token:'SYNTHETIC-ONLY'})};
},setTimeout,clearTimeout,AbortController,Date,Error});
const headers=await win.agiloshieldV2UserHeaders();
assert.equal(headers['X-Agilotext-Username'],'fixture@example.test');
assert.equal(headers['X-Agilotext-Edition'],'ent');
assert.equal(headers['X-Agilotext-Token'],'SYNTHETIC-ONLY');
assert.equal(requests.length,1);
assert.match(requests[0],/^https:\/\/api\.agilotext\.com\/api\/v1\/getToken\?/);
console.log('memberstack v1 navbar auth adapter: PASS');
