import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('./Code-main-editor-IFRAME_V04-confidence.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name);
  let depth = 0;
  let seen = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
      seen = true;
    } else if (ch === '}') {
      depth--;
      if (seen && depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('fonction introuvable: ' + name);
}

function sliceFunction(name) {
  return extractFunction(name);
}

const plan = vm.runInNewContext(extractFunction('correctionBaselinePlan') + '\ncorrectionBaselinePlan;', {});

test('une sauvegarde manuelle aligne la base sur le texte visible enregistré', () => {
  const rows = [
    { id: 's0', visible: 'Bonjour', loaded: 'Ancien', modelText: 'Ancien' },
    { id: 's1', visible: 'Suite', loaded: 'Suite', modelText: 'Suite' }
  ];
  const next = plan('100', 'manual', '100', rows, [
    { id: 's0', text: 'Bonjour' },
    { id: 's1', text: 'Suite' }
  ]);
  assert.equal(next[0].id, 's0');
  assert.equal(next[0].visible, 'Bonjour');
  assert.equal(next[0].loaded, 'Bonjour');
  assert.equal(next[0].modelText, 'Bonjour');
  assert.equal(next[1].loaded, 'Suite');
  assert.equal(next[1].modelText, 'Suite');
});

test('Cmd+S et la présauvegarde historique suivent la même règle', () => {
  const rows = [{ id: 'a', visible: 'Texte', loaded: 'Avant', modelText: 'Avant' }];
  const saved = [{ id: 'a', text: 'Texte' }];
  for (const source of ['requested', 'history-presave']) {
    const next = plan('9', source, '9', rows, saved);
    assert.equal(next[0].loaded, 'Texte');
    assert.equal(next[0].modelText, 'Texte');
  }
});

test('une frappe différente de l’envoi ne change pas la base', () => {
  const rows = [{ id: 's0', visible: 'Bonjour encore', loaded: 'Ancien', modelText: 'Ancien' }];
  const next = plan('100', 'manual', '100', rows, [{ id: 's0', text: 'Bonjour' }]);
  assert.equal(next[0], rows[0]);
});

test('un retour d’historique ou un autre dossier ne change rien', () => {
  const rows = [{ id: 's0', visible: 'Bonjour', loaded: 'Ancien', modelText: 'Ancien' }];
  const saved = [{ id: 's0', text: 'Bonjour' }];
  assert.equal(plan('100', 'history-restore', '100', rows, saved), null);
  assert.equal(plan('100', 'manual', '200', rows, saved), null);
  assert.equal(plan('100', 'autre', '100', rows, saved), null);
});

test('le clic ouvre la fenêtre, les deux autres contrôles gardent le toast', () => {
  const toast = 'Enregistrez ou abandonnez vos modifications d’abord.';
  assert.equal(src.split(toast).length - 1, 2);
  assert.equal(sliceFunction('correctionOnButtonClick').includes(toast), false);
  const ask = sliceFunction('correctionAsk');
  assert.equal(ask.split(toast).length - 1, 2);
  assert.ok(ask.indexOf('await correctionSaveNow()') < ask.indexOf("correctionStatus = 'running'"));
  assert.ok(ask.includes('correctionScreenStamp() !== correctionLaunchText'));
});

test('le rendu et la comparaison utilisent la même lecture visible', () => {
  assert.equal(src.includes("window.__agiloEditorConfidenceVersion = '1.09.33-correction-after-save'"), true);
  assert.equal(src.includes('body.dataset.agiloLoaded = correctionVisibleText(body)'), true);
  assert.equal(sliceFunction('correctionDirty').includes('correctionVisibleText(box)'), true);
  assert.equal(sliceFunction('correctionDirty').includes('textContent'), false);
  assert.equal(src.includes("window.addEventListener('agilo:transcript-saved'"), true);
  assert.equal(sliceFunction('correctionApply').includes('box.dataset.agiloLoaded = shown'), true);
});
