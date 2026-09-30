const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '..', 'scripts/pages/editor');

function extract(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source markers: ${start}`);
  return source.slice(a, b);
}
function seg(id, start, end, speaker, text) {
  const box = { textContent: text };
  const label = { textContent: speaker, classList: { contains: () => false, remove: () => {} } };
  return { dataset: { id, start: String(start), end: String(end), speaker },
    getAttribute: () => '', querySelector: sel => sel === '.ag-seg__text' ? box : sel === '.speaker' ? label : null };
}

test('real editor sync keeps speaker tied to segment ID after the first seven DOM rows disappear', () => {
  const source = fs.readFileSync(path.join(base, 'confidence-v1/Code-main-editor-IFRAME_V04-confidence.js'), 'utf8');
  const body = extract(source, '  function syncDomToModel() {', '  window.syncDomToModel = syncDomToModel;');
  const rows = [seg('s7', 40, 56, 'Intervenante A', 'Présentation'), seg('s8', 57, 63, 'Intervenante B', 'Réponse')];
  const root = { querySelectorAll: () => rows };
  const window = { _segments: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, speaker: 'Ancien', text: 'Ancien' })),
    visibleTextFromBox: box => box.textContent };
  const context = { window, editors: { transcript: root }, __mode: 'structured', getSegList: () => rows };
  vm.runInNewContext(`${body}\nthis.sync = syncDomToModel;`, context);
  assert.equal(context.sync(), true);
  assert.deepEqual(Array.from(window._segments, x => x.id), ['s7', 's8']);
  assert.deepEqual(Array.from(window._segments, x => x.speaker), ['Intervenante A', 'Intervenante B']);
  assert.equal(window._segments[0].start, 40);
  const before = JSON.stringify(window._segments);
  delete rows[0].dataset.end;
  assert.equal(context.sync(), false);
  assert.equal(JSON.stringify(window._segments), before);
});

async function clickFor(save) {
  const source = fs.readFileSync(path.join(base, 'Code-ed-header.js'), 'utf8');
  const body = extract(source, '  function bindInvestigationPvClick(a) {', '  function updateInvestigationPvLink(');
  const calls = { downloads: 0, toasts: [], busy: [] };
  const api = { isBusy: () => false, downloadInvestigationPv: async () => { calls.downloads++; return { ok: true }; } };
  const window = { AgiloFormatInvestigationPv: api };
  if (save !== undefined) window.agiloSaveNow = save;
  const link = { __agiloInvJobId: '9000000001', __agiloInvJob: {},
    addEventListener: (_type, cb) => { link.click = cb; } };
  const context = { window, AUTH: { email: 'test@example.invalid', token: 'fixture', edition: 'ent' },
    toast: msg => calls.toasts.push(msg), setInvestigationLinkBusy: (_a, v) => calls.busy.push(v),
    promptIdFromJob: () => 7 };
  vm.runInNewContext(`${body}\nthis.bind = bindInvestigationPvClick;`, context);
  context.bind(link);
  await link.click({ preventDefault() {}, stopPropagation() {} });
  return calls;
}

test('real Word click refuses missing, failed and concurrent saves', async () => {
  for (const save of [undefined, async () => ({ ok: false }), async () => { throw Error('offline'); }]) {
    const calls = await clickFor(save);
    assert.equal(calls.downloads, 0);
    assert.ok(calls.toasts.length);
    assert.deepEqual(calls.busy, [true, false]);
  }
  assert.equal((await clickFor(async () => ({ ok: true }))).downloads, 1);
});

test('real collective rename keeps the visible labels and model aligned', () => {
  const source = fs.readFileSync(path.join(base, 'confidence-v1/Code-main-editor-IFRAME_V04-confidence.js'), 'utf8');
  const body = extract(source, '  function ag_applyRenameScope(', '  function stickyBottomY()');
  const rows = [seg('s1', 0, 1, 'Intervenante A', 'Texte A'), seg('s2', 1, 2, 'Intervenante A', 'Texte B'), seg('s3', 2, 3, 'Intervenante B', 'Texte C')];
  const model = rows.map(row => ({ id: row.dataset.id, speaker: row.dataset.speaker }));
  const context = { window: { _segments: model }, editors: { transcript: {} }, getSegList: () => rows,
    setSpeakerStyle: () => {} };
  vm.runInNewContext(`${body}\nthis.rename = ag_applyRenameScope;`, context);
  assert.equal(context.rename({ scope: 'all', oldName: 'Intervenante A', newName: 'Intervenante C', idx: 0 }), 2);
  assert.deepEqual(model.map(s => s.speaker), ['Intervenante C', 'Intervenante C', 'Intervenante B']);
  assert.deepEqual(rows.map(row => row.dataset.speaker), model.map(s => s.speaker));
});


test('real transcript loader preserves milliseconds and does not invent missing IDs', () => {
  const source = fs.readFileSync(path.join(base, 'confidence-v1/Code-main-editor-IFRAME_V04-confidence.js'), 'utf8');
  const body = extract(source, '  const msToSec =', '  function isVisible(');
  const context = {};
  vm.runInNewContext(`${body}\nthis.map = mapNicoJsonToSegments;`, context);
  const rows = context.map({ segments: [
    { id: 'original-17', milli_start: 125, milli_end: 64500, speaker: 'A', text: 'Texte' },
    { milli_start: 65000, milli_end: 66000, speaker: 'B', text: 'Autre' }
  ] });
  assert.equal(rows[0].id, 'original-17');
  assert.equal(rows[0].start, 0.125);
  assert.equal(rows[0].end, 64.5);
  assert.equal(rows[1].id, null);
});
