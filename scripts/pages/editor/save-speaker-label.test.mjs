import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const src = fs.readFileSync(new URL('./Code-save_transcript-CORRIGE-V2.js', import.meta.url), 'utf8');

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

const { displaySpeakerLabel } = new Function(`${extractFunction('displaySpeakerLabel')}\nreturn { displaySpeakerLabel };`)();

function labelOk(speaker, shown) {
  return speaker === shown || shown === displaySpeakerLabel(speaker);
}

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

test('la sauvegarde accepte Intervenant et refuse un autre nom', () => {
  assert.equal(src.includes('shownSpeaker === displaySpeakerLabel(speaker)'), true);
  assert.equal(src.includes('save-manual-simple-v1.4-restore-notice'), true);
  assert.equal(src.includes('return { id, startSec, endSec, speaker,'), true);
  assert.equal(labelOk('Speaker_A', 'Intervenant 1'), true);
  assert.equal(labelOk('Marie', 'Marie'), true);
  assert.equal(labelOk('Speaker_A', 'Marie'), false);
});
