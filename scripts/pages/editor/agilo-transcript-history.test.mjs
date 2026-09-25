import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'agilo-transcript-history.js'), 'utf8');
const window = {};
const document = { readyState: 'loading', addEventListener() {} };
vm.runInNewContext(source, { window, document, Date, URLSearchParams, setTimeout, clearTimeout, console });
const h = window.__agiloTxHistoryHelpers;

test('dates API are parsed explicitly and invalid dates are rejected', () => {
  assert.equal(h.parseApiDate('25-09-2026 08:07:06').time, '08:07');
  assert.equal(h.parseApiDate('31-02-2026 08:07:06'), null);
  assert.equal(h.parseApiDate('2026-09-25T08:07:06Z'), null);
});

test('rotating slots are sorted by date and tokenized URLs are discarded', () => {
  const rows = h.cleanSavedList({status:'OK', savedTranscripts:[
    {index:7, date:'24-09-2026 12:00:00', filename:'ancien.txt', url:'https://example.invalid/?token=secret'},
    {index:2, date:'25-09-2026 08:00:00', filename:'récent.txt', url:'https://example.invalid/?token=secret'}
  ]});
  assert.equal(rows[0].index, 2);
  assert.equal(rows[1].index, 7);
  assert.equal(JSON.stringify(rows).includes('secret'), false);
  assert.equal(JSON.stringify(rows).includes('url'), false);
  assert.deepEqual(Array.from(h.cleanSavedList({status:'OK', savedTranscripts:[]})), []);
  assert.throws(() => h.cleanSavedList({status:'OK', savedTranscripts:[{index:0,date:'25-09-2026 08:00:00',filename:''}]}));
  assert.throws(() => h.cleanSavedList({status:'OK', savedTranscripts:[
    {index:0,date:'25-09-2026 08:00:00',filename:'a.txt'},
    {index:0,date:'24-09-2026 08:00:00',filename:'b.txt'}
  ]}));
});

test('download body must be a complete transcript for the current job', () => {
  const dto = {job_meta:{jobId:123}, segments:[
    {id:'s0', milli_start:0, milli_end:2000, speaker:'Alice', text:'Bonjour'}
  ]};
  assert.equal(h.validateTranscript(dto, '123'), dto);
  assert.throws(() => h.validateTranscript({...dto, job_meta:{jobId:124}}, '123'));
  assert.throws(() => h.validateTranscript({status:'KO', errorMessage:'failure'}, '123'));
  assert.throws(() => h.validateTranscript({...dto, segments:[{...dto.segments[0], milli_end:-1}]}, '123'));
});

test('semantic comparison ignores regenerated IDs and millisecond rounding but detects edits', () => {
  const original = {segments:[{id:'original', milli_start:1240, milli_end:26780, speaker:'Alice', text:'Bonjour\\nmerci'}]};
  const displayed = {segments:[{id:'s0', milli_start:1000, milli_end:26000, speaker:'Alice', text:'Bonjour\nmerci'}]};
  assert.equal(h.sameTranscript(original, displayed), true);
  assert.equal(h.sameTranscript(original, {segments:[{...displayed.segments[0], text:'Bonsoir'}]}), false);
  assert.equal(h.sameTranscript(original, {segments:[{...displayed.segments[0], speaker:'Bob'}]}), false);
});

function makeFlow({dirty = false, conflict = false, presaveOk = true, reloadMatches = true} = {}) {
  const calls = [];
  const saved = {job_meta:{jobId:123}, segments:[
    {id:'s0', milli_start:0, milli_end:2000, speaker:'Alice', text:'Version actuelle'}
  ]};
  const target = {job_meta:{jobId:123}, segments:[
    {id:'s1', milli_start:0, milli_end:2000, speaker:'Bob', text:'Version ancienne'}
  ]};
  const local = {segmentsMs:[{...saved.segments[0], text:dirty ? 'Brouillon' : 'Version actuelle'}]};
  const row = {index:9, date:'25-09-2026 08:00:00', filename:'archive.txt'};
  return {calls, target, options:{
    row, jobId:'123', reference:saved,
    list:async () => {calls.push('list'); return [row];},
    display:async () => {calls.push('display'); return target;},
    current:async () => {calls.push('current'); return conflict ? target : saved;},
    local:async () => {calls.push('local'); return local;},
    presave:async () => {calls.push('presave'); return {ok:presaveOk};},
    write:async (dto) => {calls.push('write'); assert.equal(dto, target); return {ok:true};},
    reload:async () => {calls.push('reload'); return reloadMatches ? target : saved;},
    finish:async () => {calls.push('finish');},
    checkJob:() => {calls.push('checkJob');}
  }};
}

test('clean restore reads the target before writing and skips presave', async () => {
  const flow = makeFlow();
  await h.restoreTransaction(flow.options);
  assert.equal(flow.calls.includes('presave'), false);
  assert.ok(flow.calls.indexOf('display') < flow.calls.indexOf('write'));
  assert.equal(flow.calls.at(-1), 'finish');
});

test('dirty restore saves the draft after reading the target', async () => {
  const flow = makeFlow({dirty:true});
  await h.restoreTransaction(flow.options);
  assert.ok(flow.calls.indexOf('display') < flow.calls.indexOf('presave'));
  assert.ok(flow.calls.indexOf('presave') < flow.calls.indexOf('write'));
});

test('server conflict and failed presave never write the backup', async () => {
  for (const variant of [{conflict:true}, {dirty:true, presaveOk:false}]) {
    const flow = makeFlow(variant);
    await assert.rejects(() => h.restoreTransaction(flow.options));
    assert.equal(flow.calls.includes('write'), false);
    assert.equal(flow.calls.includes('finish'), false);
  }
});

test('draft cleanup waits for confirmed editor reload', async () => {
  const flow = makeFlow({reloadMatches:false});
  await assert.rejects(() => h.restoreTransaction(flow.options), /reload_mismatch/);
  assert.equal(flow.calls.includes('write'), true);
  assert.equal(flow.calls.includes('finish'), false);
});
