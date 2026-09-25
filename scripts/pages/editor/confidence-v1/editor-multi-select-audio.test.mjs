import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const dir = path.dirname(fileURLToPath(import.meta.url));
const editor = readFileSync(path.join(dir, 'Code-main-editor-IFRAME_V04-confidence.js'), 'utf8');
const audioSource = readFileSync(path.join(dir, '..', 'Code-lecteur-audio-V3.4.js'), 'utf8');

function sliceBetween(source, begin, end) {
  const start = source.indexOf(begin);
  const stop = source.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && stop > start, `code section: ${begin}`);
  return source.slice(start, stop);
}

const selectionCode = sliceBetween(editor,
  '  function selectionStatusForSegments(', '  function currentSelectionStatus(');
const selection = vm.runInNewContext(`${selectionCode}\nselectionStatusForSegments`, {});
const segments = [
  { speaker: 'Alice', text: 'un', start: 0 },
  { speaker: 'Bob', text: 'deux', start: 1 },
  { speaker: 'Alice', text: 'trois', start: 2 },
  { speaker: 'alice', text: 'quatre', start: 3 },
  { speaker: 'Alice ', text: 'cinq', start: 4 },
  { speaker: '   ', text: 'six', start: 5 }
];
assert.equal(selection(new Set([0, 2]), segments).eligible, true, 'noncontiguous, same exact label');
assert.equal(selection(new Set([0, 3]), segments).eligible, false, 'case difference');
assert.equal(selection(new Set([0, 4]), segments).eligible, false, 'space difference');
assert.match(selection(new Set([0, 1]), segments).reason, /différents/);
assert.match(selection(new Set([0, 5]), segments).reason, /sans locuteur/);
assert.equal(selection(new Set([0]), segments).eligible, false, 'at least two');
assert.equal(selection(new Set([0, 99]), segments).eligible, false, 'stale index');

const snapshotContext = {
  _selectedSegs: new Set([0, 2]), _selectionRevision: 0,
  editors: { transcript: { children: [] } },
  window: { _segments: structuredClone(segments) }
};
snapshotContext.editors.transcript.children = snapshotContext.window._segments.map(() => ({
  classList: { contains: name => name === 'ag-seg' }
}));
const snapshotCode = selectionCode + sliceBetween(editor,
  '  function currentSelectionStatus(', '  function clearSegSelection(');
vm.createContext(snapshotContext);
vm.runInContext(snapshotCode, snapshotContext);
const snapshot = snapshotContext.captureSelectionSnapshot();
assert.equal(snapshotContext.isSelectionSnapshotCurrent(snapshot), true);
snapshotContext._selectedSegs.delete(2);
snapshotContext._selectedSegs.add(4);
snapshotContext._selectionRevision++;
assert.equal(snapshotContext.isSelectionSnapshotCurrent(snapshot), false,
  'changed selection while picker is open');
snapshotContext._selectedSegs = new Set([0, 2]);
snapshotContext._selectionRevision = snapshot.revision;
snapshotContext.window._segments[2].speaker = 'Alice ';
assert.equal(snapshotContext.isSelectionSnapshotCurrent(snapshot), false,
  'changed label while picker is open');

function makeSegmentNode(name) {
  const speaker = { textContent: name, classList: { remove() {} } };
  return {
    dataset: { speaker: name },
    querySelector(selector) { return selector === '.speaker' ? speaker : null; },
    speaker
  };
}
const nodes = segments.map(s => makeSegmentNode(s.speaker));
const renameContext = {
  editors: { transcript: { children: nodes } },
  window: { _segments: structuredClone(segments) },
  setSpeakerStyle() {},
  ag_contiguousRangeFrom() { throw Error('wrong scope'); }
};
const renameCode = sliceBetween(editor, '  function ag_applyRenameScope(', '  function stickyBottomY(');
const rename = vm.runInNewContext(`${renameCode}\nag_applyRenameScope`, renameContext);
assert.equal(rename({ scope: 'selected', oldName: 'Alice', newName: 'Alicia', indices: [0, 2] }), 2);
assert.deepEqual(Array.from(renameContext.window._segments, s => s.speaker),
  ['Alicia', 'Bob', 'Alicia', 'alice', 'Alice ', '   ']);
assert.equal(nodes[0].speaker.textContent, 'Alicia');
assert.equal(nodes[2].speaker.textContent, 'Alicia');
assert.equal(nodes[4].speaker.textContent, 'Alice ');
assert.equal(segments[0].text, 'un');
assert.equal(segments[2].start, 2);
assert.equal(rename({ scope: 'selected', newName: 'Wrong', indices: [0, 99] }), 0,
  'invalid list causes no partial mutation');
assert.equal(renameContext.window._segments[0].speaker, 'Alicia');

const audioHandlerCode = sliceBetween(audioSource, '      const keyHandler = (e) => {',
  '      document.addEventListener(\'keydown\', keyHandler);');
function makeAudioHandler() {
  const player = {
    paused: true, plays: 0, pauses: 0,
    play() { this.plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; }
  };
  const context = {
    audio: player, getSafeDuration: () => 30, seekLocked: false,
    volRange: null, setRate() {}
  };
  const handler = vm.runInNewContext(`${audioHandlerCode}\nkeyHandler`, context);
  return { handler, player };
}
function event(overrides = {}) {
  const result = {
    key: 'Enter', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false,
    isComposing: false, repeat: false, prevented: false, stopped: false,
    target: { isContentEditable: true, closest: s => s === '#pane-transcript .ag-seg__text' ? {} : null },
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; },
    ...overrides
  };
  return result;
}
const { handler, player } = makeAudioHandler();
let e = event(); handler(e);
assert.equal(player.plays, 1); assert.equal(e.prevented, true); assert.equal(e.stopped, true);
e = event({ ctrlKey: false, metaKey: true }); handler(e);
assert.equal(player.pauses, 1, 'Cmd+Enter toggles pause');
e = event({ repeat: true }); handler(e);
assert.equal(player.plays, 1, 'key repeat does not toggle'); assert.equal(e.prevented, true);
e = event({ isComposing: true }); handler(e);
assert.equal(player.plays, 1, 'IME composition does not toggle');
e = event({ altKey: true }); handler(e);
assert.equal(player.plays, 1, 'other modifiers do not toggle');
e = event({ ctrlKey: true, metaKey: true }); handler(e);
assert.equal(player.plays, 1, 'both control modifiers do not toggle');
e = event({ target: { tagName: 'INPUT', closest: () => null } }); handler(e);
assert.equal(player.plays, 1, 'search input does not toggle');
assert.equal(e.prevented, false);

console.log('editor multi select and audio: synthetic cases passed');
