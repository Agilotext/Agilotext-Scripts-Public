import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'Code-save_transcript-CORRIGE-V2.js'), 'utf8');

function extract(fnName) {
  const start = source.indexOf('  function ' + fnName + '(');
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
