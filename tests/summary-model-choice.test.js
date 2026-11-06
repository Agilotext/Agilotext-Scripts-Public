const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function loadChoice() {
  const src = fs.readFileSync(
    path.join(__dirname, '../scripts/pages/editor/Code-modeles-compte-rendu.js'),
    'utf8'
  );
  const match = src.match(/\/\* @export-start summary-model-choice \*\/([\s\S]*?)\/\* @export-end summary-model-choice \*\//);
  assert.ok(match, 'bloc summary-model-choice introuvable');
  return new Function(match[1] + '\nreturn { summaryModelChoice, promptIdSuffix, normalizePromptId };')();
}

describe('choix de modèle pour redoSummary', () => {
  const api = loadChoice();

  it('garde le choix en cours même si le job a déjà un promptid', () => {
    const choice = api.summaryModelChoice({
      pending: { jobId: '100', id: 0, name: 'Modèle par Default' },
      jobId: '100',
      jobPromptId: 12,
      defaultId: 2
    });
    assert.equal(choice.source, 'pending');
    assert.equal(choice.id, 0);
    assert.equal(choice.name, 'Modèle par Default');
    assert.equal(api.promptIdSuffix(choice.id), '&promptId=0');
  });

  it('revient au promptid du job une fois le choix retiré', () => {
    const choice = api.summaryModelChoice({
      pending: null,
      jobId: '100',
      jobPromptId: 12,
      defaultId: 2
    });
    assert.equal(choice.source, 'job');
    assert.equal(choice.id, 12);
    assert.equal(choice.name, '');
  });

  it('envoie l’id 0 et ignore -1', () => {
    assert.equal(api.promptIdSuffix(0), '&promptId=0');
    assert.equal(api.promptIdSuffix(-1), '');
    assert.equal(api.promptIdSuffix(null), '');
    assert.equal(api.normalizePromptId(0), 0);
    assert.equal(api.normalizePromptId(-1), null);
  });
});
