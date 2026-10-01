import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'Code-save_transcript-CORRIGE-V2.js'), 'utf8');

function extract(fnName) {
  let start = source.indexOf('  function ' + fnName + '(');
  if (start < 0) start = source.indexOf('  async function ' + fnName + '(');
  assert.ok(start > 0, fnName);
  let depth = 0;
  let end = start;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return source.slice(start, end);
}

const validateBackupDto = new Function(extract('validateBackupDto') + '\nreturn validateBackupDto;')();
const payloadFromSegments = new Function(
  extract('buildTranscriptStatusJson') + '\n' + extract('payloadFromSegments') + '\nreturn payloadFromSegments;'
)();
const transcriptHelpers = new Function(
  extract('canonicalTranscript') + '\n' +
  extract('hashText') + '\n' +
  extract('transcriptHash') + '\n' +
  extract('sameTranscriptExact') +
  '\nreturn { canonicalTranscript, transcriptHash, sameTranscriptExact };'
)();
const verifyServerTranscript = new Function(
  'readServerTranscript', 'sameTranscriptExact', 'transcriptHash', 'sleep',
  extract('verifyServerTranscript') + '\nreturn verifyServerTranscript;'
);

test('backup DTO rejects empty or inverted segments', () => {
  assert.throws(() => validateBackupDto({ job_meta: { jobId: 123 }, segments: [] }, '123'));
  assert.throws(() => validateBackupDto({
    job_meta: { jobId: 123 },
    segments: [{ id: 's0', milli_start: 2000, milli_end: 1000, speaker: 'Alice', text: 'Bonjour' }]
  }, '123'));
});

test('agiloGetPayload adapter exposes pick.segmentsMs for history', () => {
  const payload = payloadFromSegments({ jobId: '123' }, [
    { id: 's0', startSec: 1, endSec: 3, speaker: 'Alice', text: 'Bonjour' }
  ]);
  assert.equal(payload.pick.segmentsMs[0].milli_start, 1000);
  assert.equal(payload.pick.segmentsMs[0].milli_end, 3000);
  assert.equal(payload.transcript_status.job_meta.jobId, 123);
});

test('verified save fingerprint is stable and compares every persisted field', () => {
  const dto = { job_meta:{jobId:123,milli_duration:64500,speakerLabels:true}, segments:[
    {id:'s7', milli_start:125, milli_end:64500, speaker:'Alice', text:'Bonjour\r\nmonde'}
  ]};
  const normalized = { job_meta:{jobId:'123',milli_duration:64500,speakerLabels:true}, segments:[
    {id:'s7', milli_start:125, milli_end:64500, speaker:'Alice', text:'Bonjour\nmonde'}
  ]};
  assert.equal(transcriptHelpers.sameTranscriptExact(dto, normalized), true);
  assert.equal(transcriptHelpers.transcriptHash(dto), transcriptHelpers.transcriptHash(normalized));
  for (const changed of [
    {...normalized, segments:[{...normalized.segments[0], id:'s8'}]},
    {...normalized, segments:[{...normalized.segments[0], milli_start:126}]},
    {...normalized, segments:[{...normalized.segments[0], speaker:'Bob'}]},
    {...normalized, segments:[{...normalized.segments[0], text:'Bonsoir'}]}
  ]) assert.equal(transcriptHelpers.sameTranscriptExact(dto, changed), false);
  assert.equal(transcriptHelpers.sameTranscriptExact(dto, {
    ...normalized, job_meta:{...normalized.job_meta, speakerLabels:false}
  }), false);
});

test('server verification tolerates a short stale read but never accepts a mismatch', async () => {
  const expected = {job_meta:{jobId:123,milli_duration:1000,speakerLabels:true},segments:[
    {id:'s1',milli_start:0,milli_end:1000,speaker:'Alice',text:'Bonjour'}
  ]};
  const stale = {...expected,segments:[{...expected.segments[0],speaker:'Ancien'}]};
  let reads = 0;
  const verify = verifyServerTranscript(
    async () => (++reads < 3 ? stale : expected),
    transcriptHelpers.sameTranscriptExact,
    transcriptHelpers.transcriptHash,
    async () => {}
  );
  const result = await verify({}, expected);
  assert.equal(reads, 3);
  assert.equal(result.payloadHash, transcriptHelpers.transcriptHash(expected));

  const reject = verifyServerTranscript(
    async () => stale,
    transcriptHelpers.sameTranscriptExact,
    transcriptHelpers.transcriptHash,
    async () => {}
  );
  await assert.rejects(() => reject({}, expected), /exactement/);
});

test('save script owns one capture hotkey and blocks duplicate Webflow handlers', () => {
  assert.equal((source.match(/addEventListener\(['"]keydown/g) || []).length, 1);
  assert.match(source, /document\.addEventListener\('keydown',[\s\S]*stopImmediatePropagation\(\)[\s\S]*}, true\)/);
  assert.doesNotMatch(source, /window\.addEventListener\('keydown', \(e\)=>/);
});
