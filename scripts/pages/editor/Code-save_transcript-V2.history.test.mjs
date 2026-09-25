import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'Code-save_transcript-V2.js'), 'utf8');
const start = source.indexOf('  function validateBackupDto(');
const end = source.indexOf('  // ✅ CORRECTION DÉFINITIVE : doSave', start);
assert.ok(start > 0 && end > start);
let request;
class FakeXHR {
  open(method, url) { request = {method, url}; }
  setRequestHeader(name, value) { request.header = [name, value]; }
  send(body) {
    request.body = body;
    this.status = 200;
    this.responseText = '{"status":"OK"}';
    this.onload();
  }
}
const { validateBackupDto, postTranscriptDto } = new Function('ENDPOINT', 'XMLHttpRequest',
  `${source.slice(start, end)}\nreturn {validateBackupDto, postTranscriptDto};`
)('https://api.agilotext.com/api/v1/updateTranscriptFile', FakeXHR);

test('backup write preserves the DTO and keeps credentials out of the URL', async () => {
  const dto = {version:'v1', job_meta:{jobId:123, milli_duration:27000, speakerLabels:true}, segments:[
    {id:'old-id', milli_start:1240, milli_end:26780, speaker:'Alice', text:'Bonjour\nmerci'}
  ]};
  validateBackupDto(dto, '123');
  const result = await postTranscriptDto({username:'test@example.invalid', token:'secret', jobId:'123', edition:'ent'}, dto);
  assert.equal(result.j.status, 'OK');
  assert.equal(request.method, 'POST');
  assert.equal(request.url, 'https://api.agilotext.com/api/v1/updateTranscriptFile');
  const form = new URLSearchParams(request.body);
  assert.equal(form.get('token'), 'secret');
  assert.deepEqual(JSON.parse(form.get('transcriptContent')), dto);
});

test('backup write rejects an empty or malformed transcript', () => {
  assert.throws(() => validateBackupDto({job_meta:{jobId:123}, segments:[]}, '123'));
  assert.throws(() => validateBackupDto({job_meta:{jobId:123}, segments:[
    {id:'s0', milli_start:2000, milli_end:1000, speaker:'Alice', text:'Bonjour'}
  ]}, '123'));
});

test('superseded debounce resolves its pending save and keeps the busy signal', async () => {
  const from = source.indexOf('  async function doSave(');
  const to = source.indexOf('  /* ===== NOUVELLES FONCTIONNALITÉS ===== */', from);
  assert.ok(from > 0 && to > from);
  let nextTimer = 0;
  const timers = new Map();
  const page = {__agiloTranscriptHistoryRestoring:false,dispatchEvent() {}};
  const create = new Function('window','CustomEvent','pickJobId','setTimeout','clearTimeout',
    `let isSaving=false, saveDebounceTimer=null, pendingSaveResolve=null; const SAVE_DEBOUNCE_MS=5000;\n${source.slice(from,to)}\nreturn doSave;`
  );
  const doSave = create(page, class {constructor(){}}, () => '123',
    (fn) => {const id=++nextTimer;timers.set(id,fn);return id;},
    (id) => timers.delete(id));
  const first = doSave(null);
  const second = doSave(null);
  assert.deepEqual(await first,{ok:false,reason:'superseded'});
  assert.equal(page.__agiloSavePending,true);
  assert.equal(timers.size,1);
  // Le second timer reste volontairement non exécuté : le test porte sur la promesse annulée.
  void second;
});
