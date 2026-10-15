import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const src = fs.readFileSync(new URL('./Code-main-editor-IFRAME_V04-confidence.js', import.meta.url), 'utf8');

test('la confirmation corriger explique avant de lancer', () => {
  assert.equal(src.includes('le le budget'), true);
  assert.equal(src.includes('on va on va'), false);
  assert.equal(src.includes('Ne plus afficher ce message'), true);
  assert.equal(src.includes('agilo-correction-skip-intro'), true);
  assert.equal(src.includes('Déjà corrigée'), true);
  assert.equal(src.includes('Correction déjà tentée'), true);
  for (const format of ['txt', 'rtf', 'doc', 'docx', 'pdf']) {
    assert.equal(src.includes('format=' + format), true);
  }
  assert.equal(src.includes("btn.addEventListener('click', () => correctionAsk(true))"), false);
  assert.equal(src.includes('correctionAsk(true)'), true);
  assert.equal(src.includes('data-aq="modal"'), false);
  assert.equal(src.includes('aq-modal__close'), true);
  assert.equal(src.includes('button bleu'), true);
  assert.equal(src.includes('button cancel'), true);
  assert.equal(src.includes('--aq-radius'), true);
  assert.equal(src.includes('z-index:100000'), true);
  assert.equal(src.includes('.agilo-correction-dialog__ok'), false);
  assert.equal(src.includes("link.className = 'button cancel'"), false);
  const formatLinks = src.includes('.aq-modal__downloads a{display:inline;width:auto;min-width:0;height:auto;min-height:0;flex:0 0 auto;padding:0;margin:0;border:0;border-radius:0;background:transparent');
  assert.equal(formatLinks, true);
  assert.equal(src.includes('padding:0'), true);
  assert.equal(src.includes('width:auto'), true);
  assert.equal(src.includes('background:transparent'), true);
});
