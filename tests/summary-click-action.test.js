const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sourcePath = path.join(
  __dirname,
  '../scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js'
);
const source = fs.readFileSync(sourcePath, 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  const end = source.indexOf('\n  }', start);
  assert.notEqual(end, -1, name);
  return source.slice(start, end + 4);
}

const agiloSummaryClickAction = vm.runInNewContext(
  `${extract('agiloSummaryClickAction')}\nagiloSummaryClickAction;`
);

test('compte rendu déjà bon : le navigateur part', () => {
  assert.equal(agiloSummaryClickAction('ok'), 'native');
});

test('compte rendu manquant : aucun fichier', () => {
  assert.equal(agiloSummaryClickAction('missing'), 'block');
});

test('compte rendu pas encore connu : on vérifie, on n enregistre pas', () => {
  assert.equal(agiloSummaryClickAction(''), 'probe');
  assert.equal(agiloSummaryClickAction(undefined), 'probe');
});

test('le chemin qui enregistre ne force plus le nom summary', () => {
  assert.equal(source.includes('triggerBlobDownload'), false);
  assert.equal(source.includes("|| 'summary'"), false);
  const handler = extract('handleSummaryDownloadClick');
  assert.equal(handler.includes('createObjectURL'), false);
  assert.equal(handler.includes('.download'), false);
  const guard = extract('neutralizeSummaryNavigation');
  assert.equal(guard.includes("removeAttribute('target')"), false);
  assert.equal(guard.includes('keepSummaryTarget'), true);
});
