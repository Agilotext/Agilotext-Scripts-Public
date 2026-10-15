import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const src = fs.readFileSync(new URL('./Code-main-editor-IFRAME_V04-confidence.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start < 0) throw new Error(`missing ${name}`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

function loadAll(names) {
  const body = names.map((name) => extractFunction(name)).join('\n');
  return new Function(`${body}\nreturn { ${names.join(', ')} };`)();
}

const { selectSegmentIndices, parseTimedTranscript, displaySpeakerLabel, syncDomToModel } = loadAll([
  'parseClockToSec',
  'selectSegmentIndices',
  'parseTimedTranscript',
  'displaySpeakerLabel',
  'syncDomToModel'
]);

test('clic simple pose l ancre sur un seul segment', () => {
  const picked = selectSegmentIndices(5, 0, 3, new Set([0, 1]), 'one');
  assert.deepEqual([...picked.selected], [3]);
  assert.equal(picked.anchor, 3);
});

test('maj clic prend la plage entre l ancre et le clic', () => {
  const picked = selectSegmentIndices(8, 1, 4, new Set([7]), 'range');
  assert.deepEqual([...picked.selected], [1, 2, 3, 4]);
  assert.equal(picked.anchor, 1);
});

test('plage inverse garde l ancre', () => {
  const picked = selectSegmentIndices(8, 5, 2, new Set(), 'range');
  assert.deepEqual([...picked.selected], [2, 3, 4, 5]);
  assert.equal(picked.anchor, 5);
});

test('plage sans ancre utilise le segment cliqué', () => {
  const picked = selectSegmentIndices(4, -1, 2, new Set([0]), 'range');
  assert.deepEqual([...picked.selected], [2]);
  assert.equal(picked.anchor, 2);
});

test('cmd clic ajoute puis retire un segment', () => {
  const added = selectSegmentIndices(5, 1, 3, new Set([1]), 'toggle');
  assert.deepEqual([...added.selected], [1, 3]);
  assert.equal(added.anchor, 3);
  const removed = selectSegmentIndices(5, added.anchor, 1, added.selected, 'toggle');
  assert.deepEqual([...removed.selected], [3]);
  assert.equal(removed.anchor, 1);
});

test('index hors liste ne change rien', () => {
  const selected = new Set([1]);
  const picked = selectSegmentIndices(3, 1, 9, selected, 'one');
  assert.deepEqual([...picked.selected], [1]);
  assert.equal(picked.anchor, 1);
});

test('export timé entre crochets', () => {
  const blocks = parseTimedTranscript([
    '[00:01] Alice: Bonjour',
    '[00:02] Bob: Oui',
    '[1:00:03] Alice: Suite'
  ].join('\n'));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].start, 1);
  assert.equal(blocks[0].end, 2);
  assert.equal(blocks[0].speaker, 'Alice');
  assert.equal(blocks[0].text, 'Bonjour');
  assert.equal(blocks[2].start, 3603);
  assert.equal(blocks[2].speaker, 'Alice');
});

test('fleche et horloge sans crochets', () => {
  const blocks = parseTimedTranscript([
    '00:10 → Camille: Première',
    '00:20 -> Denis: Deuxième',
    '00:30 Ève',
    'Troisième ligne'
  ].join('\n'));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].speaker, 'Camille');
  assert.equal(blocks[0].text, 'Première');
  assert.equal(blocks[1].speaker, 'Denis');
  assert.equal(blocks[2].speaker, 'Ève');
  assert.equal(blocks[2].text, 'Troisième ligne');
});

test('prose sans heure ne fait aucun bloc', () => {
  assert.deepEqual(parseTimedTranscript('Bonjour tout le monde\nSans horloge'), []);
});

test('libellé machine affiché en français, prénom inchangé', () => {
  assert.equal(displaySpeakerLabel('Speaker_A'), 'Intervenant 1');
  assert.equal(displaySpeakerLabel('speaker_a'), 'Intervenant 1');
  assert.equal(displaySpeakerLabel('Speaker_B'), 'Intervenant 2');
  assert.equal(displaySpeakerLabel('Speaker_S1'), 'Intervenant 1');
  assert.equal(displaySpeakerLabel('Speaker_S2'), 'Intervenant 2');
  assert.equal(displaySpeakerLabel('Speaker_1'), 'Intervenant 1');
  assert.equal(displaySpeakerLabel('locuteur 2'), 'Intervenant 2');
  assert.equal(displaySpeakerLabel('Speaker_0'), 'Speaker_0');
  assert.equal(displaySpeakerLabel('Lucile'), 'Lucile');
  assert.equal(displaySpeakerLabel('Intervenant 1'), 'Intervenant 1');
  assert.equal(displaySpeakerLabel(''), '');
  assert.equal(displaySpeakerLabel('   '), '');
});

test('syncDomToModel accepte le libellé affiché et garde la valeur brute', () => {
  assert.match(extractFunction('syncDomToModel'), /displaySpeakerLabel\(speaker\)/);
  assert.equal(typeof syncDomToModel, 'function');
});
