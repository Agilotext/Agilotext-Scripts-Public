const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '../scripts/pages/editor/orchestrator.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const logicPath = path.join(
  __dirname,
  '../scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js'
);
const logic = fs.readFileSync(logicPath, 'utf8');

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  const end = source.indexOf('\n  }', start);
  assert.notEqual(end, -1, name);
  return source.slice(start, end + 4);
}

const agiloOrchestratorDownloadAction = vm.runInNewContext(
  `${extract('agiloOrchestratorDownloadAction')}\nagiloOrchestratorDownloadAction;`
);

const api = 'https://api.agilotext.com/api/v1/receiveText?format=pdf';
const summary = 'https://api.agilotext.com/api/v1/receiveSummary?format=pdf';
const audio = 'https://api.agilotext.com/api/v1/receiveAudio?jobId=1';
const indexHost = 'https://index-education.agilotext.com/api/v1/receiveSummary?format=pdf';

test('transcription et compte rendu : le navigateur part', () => {
  assert.equal(agiloOrchestratorDownloadAction('text', 'pro', 'pdf', api, false), 'native');
  assert.equal(agiloOrchestratorDownloadAction('summary', 'ent', 'pdf', summary, false), 'native');
  assert.equal(agiloOrchestratorDownloadAction('text', 'free', 'txt', api, false), 'native');
});

test('gratuit doc et pdf : pas de fichier', () => {
  assert.equal(agiloOrchestratorDownloadAction('text', 'free', 'pdf', api, false), 'block');
  assert.equal(agiloOrchestratorDownloadAction('summary', 'free', 'doc', summary, false), 'block');
  assert.equal(agiloOrchestratorDownloadAction('summary', 'gratuit', 'pdf', summary, false), 'block');
});

test('audio garde sa vérification', () => {
  assert.equal(agiloOrchestratorDownloadAction('audio', 'pro', 'mp3', audio, false), 'audio');
  assert.equal(agiloOrchestratorDownloadAction('audio', 'free', 'pdf', audio, false), 'audio');
});

test('hôte Index et lien à ignorer : l orchestrateur ne touche pas au clic', () => {
  assert.equal(agiloOrchestratorDownloadAction('summary', 'ent', 'pdf', indexHost, false), 'ignore');
  assert.equal(agiloOrchestratorDownloadAction('text', 'pro', 'pdf', api, true), 'ignore');
  assert.equal(agiloOrchestratorDownloadAction('text', 'pro', 'pdf', '', false), 'ignore');
  assert.equal(agiloOrchestratorDownloadAction('', 'pro', 'pdf', api, false), 'ignore');
});

test('le clic transcription et compte rendu n attend pas et n ouvre pas de fenêtre', () => {
  const start = source.indexOf("if (action === 'native')");
  const end = source.indexOf("if (action === 'block')");
  const native = source.slice(start, end);
  assert.equal(native.includes('preventDefault'), false);
  assert.equal(native.includes('window.open'), false);
  assert.equal(native.includes('await'), false);
  assert.equal(source.includes('window.open'), true);
});

test('les liens transcription et compte rendu ne gardent pas un nom forcé', () => {
  const textAt = logic.indexOf('aT.href = `${API_BASE}/receiveText');
  const summaryAt = logic.indexOf('aS.href = `${API_BASE}/receiveSummary');
  assert.notEqual(textAt, -1);
  assert.notEqual(summaryAt, -1);
  assert.equal(logic.slice(textAt, textAt + 400).includes("removeAttribute('download')"), true);
  assert.equal(logic.slice(summaryAt, summaryAt + 500).includes("removeAttribute('download')"), true);
});
