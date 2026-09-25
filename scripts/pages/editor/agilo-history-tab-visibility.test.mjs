import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const dir = path.dirname(fileURLToPath(import.meta.url));

function loadHelpers(file, exportName) {
  const source = readFileSync(path.join(dir, file), 'utf8');
  const window = {};
  const document = {
    readyState: 'loading',
    documentElement: {},
    addEventListener() {},
    querySelector() { return null; }
  };
  vm.runInNewContext(source, {
    window, document, Date, URLSearchParams, setTimeout, clearTimeout, console, MutationObserver: class { observe() {} }
  });
  return window[exportName];
}

const tx = loadHelpers('agilo-transcript-history.js', '__agiloTxHistoryHelpers');
const cr = loadHelpers('agilo-cr-history.js', '__agiloCrHistoryHelpers');

test('transcript Revenir only on Transcription tab', () => {
  assert.equal(tx.isTranscriptTab('tab-transcript'), true);
  assert.equal(tx.isTranscriptTab('tab-summary'), false);
  assert.equal(tx.isTranscriptTab('tab-chat'), false);
});

test('CR Revenir only on Compte-rendu tab', () => {
  assert.equal(cr.isSummaryTab('tab-summary'), true);
  assert.equal(cr.isSummaryTab('tab-transcript'), false);
  assert.equal(cr.isSummaryTab('tab-chat'), false);
});
