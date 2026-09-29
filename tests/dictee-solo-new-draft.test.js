const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(status, confirmed = true) {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/pages/dashboard/dictee-solo-document.js'), 'utf8');
  const marker = '  global.AgiloDicteeSoloDocument = {';
  const calls = [];
  const old = status ? { status, text: 'Ancien texte', requestId: 'old-request' } : null;
  const ta = { value: 'Ancien texte', dispatchEvent: event => calls.push('input:' + event.type) };
  const elements = new Map();
  function el(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: false, disabled: false, checked: false, value: '', href: '', textContent: '',
      classList: { toggle() {} }
    });
    return elements.get(selector);
  }
  const root = { hidden: false, classList: { toggle() {} }, querySelector: el };
  const storage = new Map();
  const api = {
    getSubmission: async () => old,
    clearAudio: async () => calls.push('clearAudio'),
    clearSubmission: async () => calls.push('clearSubmission'),
    nextDraftId: () => { calls.push('nextDraftId'); return 'new-draft'; }
  };
  const usages = { getUsage: () => 'carnet', writeDraft: (_email, text) => calls.push('writeDraft:' + text) };
  const sandbox = {
    AgiloSoloAudio: api, AgiloDicteeUsages: usages,
    AgiloDicteeCarnetPicker: { getSelected: () => ({ id: 1 }) },
    localStorage: { removeItem: key => storage.delete(key), setItem: (key, value) => storage.set(key, value) },
    confirm: message => { calls.push('confirm:' + message); return confirmed; },
    Event: class Event { constructor(type) { this.type = type; } },
    document: { querySelector: () => ta }
  };
  vm.runInNewContext(source.replace(marker,
    '  global.__test = { state, reset, setRoot: function (value) { root = value; }, update };\n' + marker), sandbox);
  sandbox.__test.setRoot(root);
  Object.assign(sandbox.__test.state, {
    email: 'test@example.invalid', draftId: 'old-draft', ready: true,
    audioCount: 1, submission: old
  });
  sandbox.__test.update();
  return { controller: sandbox.AgiloDicteeSoloDocument, test: sandbox.__test, root, el, ta, calls };
}

test('accepted draft exposes a fresh start and clears old local draft after confirmation', async () => {
  const ctx = setup('accepted');
  assert.equal(ctx.el('.agilo-solo-document__new').hidden, false);
  assert.equal(ctx.controller.canStart(), false);
  await ctx.test.reset();
  assert.deepEqual(ctx.calls.slice(0, 4), [
    'confirm:Le document précédent reste dans Mes fichiers. Démarrer une nouvelle dictée solo ?',
    'clearAudio', 'clearSubmission', 'nextDraftId'
  ]);
  assert.equal(ctx.ta.value, '');
  assert.equal(ctx.test.state.draftId, 'new-draft');
  assert.equal(ctx.controller.canStart(), true);
  assert.ok(ctx.calls.includes('input:input'));
  assert.ok(ctx.calls.includes('writeDraft:'));
});

test('uncertain submission can start fresh without deleting or retrying its frozen request', async () => {
  const ctx = setup('uncertain');
  assert.equal(ctx.controller.canStart(), false);
  await ctx.test.reset();
  assert.equal(ctx.controller.canStart(), true);
  assert.equal(ctx.test.state.draftId, 'new-draft');
  assert.equal(ctx.calls.includes('clearAudio'), false);
  assert.equal(ctx.calls.includes('clearSubmission'), false);
  assert.match(ctx.calls[0], /peut encore être traité/);
});

test('conflicting submission remains archived when starting fresh', async () => {
  const ctx = setup('conflict');
  await ctx.test.reset();
  assert.equal(ctx.controller.canStart(), true);
  assert.equal(ctx.calls.includes('clearAudio'), false);
  assert.equal(ctx.calls.includes('clearSubmission'), false);
});

test('cancelling a fresh start keeps the previous draft intact', async () => {
  const ctx = setup('pending', false);
  await ctx.test.reset();
  assert.equal(ctx.test.state.draftId, 'old-draft');
  assert.equal(ctx.ta.value, 'Ancien texte');
  assert.equal(ctx.controller.canStart(), false);
  assert.equal(ctx.calls.some(call => call.startsWith('clear') || call === 'nextDraftId'), false);
});
