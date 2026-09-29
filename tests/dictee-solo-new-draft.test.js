const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ text = 'Ancien texte', audio = true, status = null, choice = 'resume' } = {}) {
  let source = fs.readFileSync(path.join(__dirname,
    '../scripts/pages/dashboard/dictee-solo-document.js'), 'utf8');
  const marker = '  global.AgiloDicteeSoloDocument = {';
  source = source.replace('var choice = await askRecovery(kind, original);', 'var choice = await global.__choice(kind);');
  source = source.replace('var choice = await askRecovery("history", rows);', 'var choice = await global.__choice("history");');
  source = source.replace('await send(latest);', 'global.__retry(latest);');
  const calls = [];
  let currentId = 'old-draft';
  let storedText = text;
  let sessions = audio ? [{ id: 'synthetic-audio', startedAt: 1 }] : [];
  let failClear = false;
  const submission = status ? {
    email: 'test@example.invalid', draftId: 'old-draft', status,
    requestId: 'fixed-request', createdAt: 1, audioSessionIds: ['synthetic-audio']
  } : null;
  const ta = { value: '', readOnly: true };
  const elements = new Map();
  function el(key) {
    if (!elements.has(key)) elements.set(key, {
      hidden: false, disabled: false, checked: false, value: '', textContent: '', href: '',
      classList: { toggle() {} }
    });
    return elements.get(key);
  }
  const root = { hidden: false, classList: { toggle() {} }, querySelector: el };
  const api = {
    getDraftId: () => currentId,
    newId: () => 'new-draft',
    setDraftId: (_email, expected, next) => {
      assert.equal(currentId, expected); currentId = next; calls.push('switch:' + next);
    },
    listSessions: async (_email, draftId) => draftId === 'old-draft' ? sessions : [],
    getSubmission: async (_email, draftId) => draftId === 'old-draft' ? submission : null,
    listUnresolvedSubmissions: async () => submission && ['pending', 'uncertain', 'conflict'].includes(submission.status)
      ? [submission] : [],
    clearAudio: async () => {
      calls.push('clearAudio');
      if (failClear) throw new Error('synthetic_storage_failure');
      sessions = [];
    }
  };
  let ready = false;
  const usages = {
    getUsage: () => 'carnet', getEmail: () => 'test@example.invalid',
    soloTabAllowed: () => true, mesTranscriptsHref: () => '/app/business/mes-transcripts',
    readDraft: () => storedText,
    writeDraft: (_email, value) => { storedText = value; calls.push('write:' + value); return true; },
    persistDraftFromTextarea: () => { storedText = ta.value; calls.push('persist:' + ta.value); },
    holdDraft: () => { ready = false; ta.value = ''; ta.readOnly = true; calls.push('hold'); },
    unlockDraft: (_email, value) => { ready = true; ta.value = value; ta.readOnly = false; calls.push('unlock:' + value); return true; },
    isDraftReady: () => ready, setCarnetError: () => {}
  };
  const sandbox = {
    AgiloSoloAudio: api, AgiloDicteeUsages: usages,
    AgiloDicteeCarnetPicker: { getSelected: () => ({ id: 1 }) },
    localStorage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
    document: { querySelector: () => ta, dispatchEvent() {} },
    CustomEvent: class CustomEvent {},
    __choice: kind => {
      calls.push('choice:' + kind);
      if (kind === 'history') sandbox.__test.state.previousToRetry = submission;
      return typeof choice === 'function' ? choice(kind) : choice;
    },
    __retry: snapshot => calls.push('retry:' + snapshot.requestId)
  };
  vm.runInNewContext(source.replace(marker,
    '  global.__test = { state, hydrate, create, openPrevious, setRoot: function (value) { root = value; } };\n' + marker), sandbox);
  sandbox.__test.setRoot(root);
  return {
    api, usages, ta, calls, root, el, controller: sandbox.AgiloDicteeSoloDocument,
    state: sandbox.__test.state, hydrate: sandbox.__test.hydrate,
    create: sandbox.__test.create, openPrevious: sandbox.__test.openPrevious,
    getStoredText: () => storedText, getCurrentId: () => currentId,
    setChoice: value => { choice = value; },
    setClearFailure: value => { failClear = value; },
    setCurrentId: value => { currentId = value; }
  };
}

test('a recovered text and audio stay hidden until Reprendre, then another take needs no dialog', async () => {
  const ctx = setup();
  await ctx.hydrate();
  assert.equal(ctx.ta.value, '');
  assert.equal(ctx.ta.readOnly, true);
  assert.equal(ctx.state.recoveryPending, true);
  assert.equal(await ctx.controller.prepareStart(), true);
  assert.equal(ctx.ta.value, 'Ancien texte');
  assert.equal(ctx.ta.readOnly, false);
  assert.equal(ctx.controller.canStart(), true);
  assert.equal(ctx.controller.prepareStart(), true);
  assert.equal(ctx.calls.filter(call => call.startsWith('choice:')).length, 1);
});

test('Nouvelle clears an unsent draft and starts from an empty text and new id', async () => {
  const ctx = setup({ choice: 'new' });
  await ctx.hydrate();
  assert.equal(await ctx.controller.prepareStart(), true);
  assert.equal(ctx.getCurrentId(), 'new-draft');
  assert.equal(ctx.getStoredText(), '');
  assert.equal(ctx.ta.value, '');
  assert.ok(ctx.calls.includes('clearAudio'));
  assert.equal(ctx.controller.canStart(), true);
});

test('Annuler preserves text, audio and draft id', async () => {
  const ctx = setup({ choice: 'cancel' });
  await ctx.hydrate();
  assert.equal(await ctx.controller.prepareStart(), false);
  assert.equal(ctx.getCurrentId(), 'old-draft');
  assert.equal(ctx.getStoredText(), 'Ancien texte');
  assert.equal(ctx.ta.value, '');
  assert.equal(ctx.calls.includes('clearAudio'), false);
});

test('Générer restores a text-only draft without starting or sending', async () => {
  const ctx = setup({ audio: false });
  await ctx.hydrate();
  assert.equal(ctx.el('.agilo-solo-document__button').disabled, false);
  await ctx.create();
  assert.equal(ctx.ta.value, 'Ancien texte');
  assert.equal(ctx.el('.agilo-solo-document__button').disabled, true);
  assert.equal(ctx.calls.some(call => call.startsWith('retry:')), false);
});

test('an uncertain submission remains reachable with the same requestId after Nouvelle', async () => {
  const ctx = setup({ status: 'uncertain', choice: 'new' });
  await ctx.hydrate();
  assert.equal(await ctx.controller.prepareStart(), true);
  assert.equal(ctx.getCurrentId(), 'new-draft');
  assert.equal(ctx.calls.includes('clearAudio'), false);
  assert.equal(ctx.state.unresolved.length, 1);
  ctx.setChoice('retry');
  await ctx.openPrevious();
  assert.ok(ctx.calls.includes('retry:fixed-request'));
});

for (const status of ['pending', 'conflict']) {
  test(`${status} keeps its frozen submission and audio when a new dictation starts`, async () => {
    const ctx = setup({ status, choice: 'new' });
    await ctx.hydrate();
    assert.equal(await ctx.controller.prepareStart(), true);
    assert.equal(ctx.getCurrentId(), 'new-draft');
    assert.equal(ctx.calls.includes('clearAudio'), false);
    assert.equal(ctx.state.unresolved.length, 1);
  });
}

test('no previous content opens no choice', async () => {
  const ctx = setup({ text: '', audio: false });
  await ctx.hydrate();
  assert.equal(ctx.state.recoveryPending, false);
  assert.equal(ctx.controller.prepareStart(), true);
  assert.equal(ctx.calls.some(call => call.startsWith('choice:')), false);
});

test('audio-only recovery offers a choice and Reprendre preserves its recorded take', async () => {
  const ctx = setup({ text: '' });
  await ctx.hydrate();
  assert.equal(ctx.state.recoveryPending, true);
  assert.equal(await ctx.controller.prepareStart(), true);
  assert.equal(ctx.getCurrentId(), 'old-draft');
  assert.equal(ctx.state.audioCount, 1);
});

test('an accepted document remains recorded while a new draft starts', async () => {
  const ctx = setup({ status: 'accepted', choice: 'new' });
  await ctx.hydrate();
  assert.equal(await ctx.controller.prepareStart(), true);
  assert.equal(ctx.getCurrentId(), 'new-draft');
  assert.equal(ctx.calls.includes('clearAudio'), false);
});

test('a failed audio deletion restores the old draft and blocks microphone start', async () => {
  const ctx = setup({ choice: 'new' });
  ctx.setClearFailure(true);
  await ctx.hydrate();
  assert.equal(await ctx.controller.prepareStart(), false);
  assert.equal(ctx.getCurrentId(), 'old-draft');
  assert.equal(ctx.getStoredText(), 'Ancien texte');
  assert.equal(ctx.controller.canStart(), false);
});

test('a draft changed in another tab cannot be discarded from a stale dialog', async () => {
  const ctx = setup();
  await ctx.hydrate();
  ctx.setChoice(() => { ctx.setCurrentId('other-tab-draft'); return 'new'; });
  assert.equal(await ctx.controller.prepareStart(), false);
  assert.equal(ctx.calls.includes('clearAudio'), false);
  assert.equal(ctx.getStoredText(), 'Ancien texte');
});

test('clearing the visible text while audio remains asks before another take', async () => {
  const ctx = setup();
  await ctx.hydrate();
  assert.equal(await ctx.controller.prepareStart(), true);
  ctx.ta.value = '';
  ctx.setChoice('new');
  assert.equal(await ctx.controller.prepareStart(), true);
  assert.equal(ctx.getCurrentId(), 'new-draft');
  assert.equal(ctx.calls.filter(call => call === 'choice:unsent').length, 2);
});
