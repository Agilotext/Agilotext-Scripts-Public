const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(fetch) {
  const source = fs.readFileSync(path.join(__dirname,
    '../scripts/pages/dashboard/dictee-solo-document.js'), 'utf8');
  const marker = '  global.AgiloDicteeSoloDocument = {';
  assert.equal(source.split(marker).length, 2, 'test hook must target one module export');
  const sandbox = {
    Blob, File, FormData, fetch,
    ensureValidToken: async () => true,
    globalToken: 'synthetic-token'
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source.replace(marker,
    '  global.__soloContractTest = { postFrozen, submissionError };\n' + marker), sandbox);
  return sandbox.__soloContractTest;
}

test('the final request always sends the frozen text, selected model, WAV and requestId', async () => {
  const sent = [];
  const contract = load(async (_url, options) => {
    sent.push(options.body);
    return { ok: true, status: 200, json: async () => ({ status: 'OK', jobId: 123 }) };
  });
  const snapshot = {
    email: 'test@example.invalid', edition: 'ent',
    text: 'Premier passage. Second passage corrigé.', promptId: 817,
    requestId: '4c303bf0-d6a8-49c1-8507-9ee268ec0c78'
  };
  const wav = new Blob([new Uint8Array([82, 73, 70, 70, 1, 2])], { type: 'audio/wav' });
  assert.equal(await contract.postFrozen(snapshot, wav), '123');
  assert.equal(await contract.postFrozen(snapshot, wav), '123');
  assert.equal(sent.length, 2);
  for (const form of sent) {
    assert.deepEqual(Array.from(form.keys()), [
      'username', 'token', 'edition', 'transcriptContent', 'audio', 'promptId', 'requestId'
    ]);
    assert.equal(form.get('requestId'), snapshot.requestId);
    assert.equal(form.get('promptId'), '817');
    assert.equal(form.get('transcriptContent'), snapshot.text);
    assert.equal(form.get('audio').name, 'dictee-solo.wav');
    assert.equal(form.get('audio').size, wav.size);
  }
});

test('the server rejection keeps its code and yields a useful message', async () => {
  const contract = load(async () => ({
    ok: false, status: 400,
    json: async () => ({ status: 'KO', errorMessage: 'invalid_request',
      errorDetails: 'Invalid or inaccessible promptId: 817' })
  }));
  await assert.rejects(contract.postFrozen({
    email: 'test@example.invalid', edition: 'ent', text: 'Texte fictif',
    promptId: 817, requestId: '4c303bf0-d6a8-49c1-8507-9ee268ec0c78'
  }, new Blob(['wav'])), error => {
    assert.equal(error.message, 'invalid_request');
    assert.equal(error.httpStatus, 400);
    assert.equal(error.certain, true);
    assert.match(contract.submissionError(error), /modèle choisi.*accessible/i);
    return true;
  });
  assert.match(contract.submissionError({ message: 'invalid_request',
    details: 'Missing required multipart part' }), /compatible avec le serveur/);
  assert.match(contract.submissionError({ message: 'invalid_audio' }), /audio.*illisible/i);
  assert.match(contract.submissionError({ message: 'idempotency_conflict' }), /Mes fichiers/);
});
