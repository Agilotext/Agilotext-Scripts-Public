/**
 * Messages rétention honnêtes (audio vs fantôme, Free / Pro / Business).
 * Exécution : node --test tests/retention-messages.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { message, normalizeEdition } = require('../scripts/shared/retention-messages.js');

describe('normalizeEdition', () => {
  it('mappe premium et business', () => {
    assert.equal(normalizeEdition('premium'), 'pro');
    assert.equal(normalizeEdition('Business'), 'ent');
    assert.equal(normalizeEdition('free'), 'free');
  });
});

describe('audio_expired', () => {
  it('ne promet jamais que le texte reste accessible', () => {
    for (const ed of ['free', 'pro', 'ent']) {
      const text = message(ed, 'audio_expired');
      assert.equal(text.includes('restent accessibles'), false);
      assert.equal(text.includes('reste accessible'), false);
    }
  });

  it('distingue les durées par offre', () => {
    assert.match(message('free', 'audio_expired'), /24 heures/);
    assert.match(message('pro', 'audio_expired'), /30 jours \(offre Pro\)/);
    assert.match(message('ent', 'audio_expired'), /30 jours \(offre Business\)/);
    assert.equal(message('pro', 'audio_expired').includes('Business'), false);
  });
});

describe('ghost_transcript', () => {
  it('Business : anomalie, pas une expiration normale', () => {
    const text = message('ent', 'ghost_transcript', { jobId: '1000032508' });
    assert.match(text, /pas le comportement prévu de l’offre Business/);
    assert.match(text, /1000032508/);
    assert.equal(text.includes('selon la durée de conservation'), false);
  });

  it('Pro : support sans dire Business', () => {
    const text = message('pro', 'ghost_transcript', { jobId: '42' });
    assert.equal(text.includes('Business'), false);
    assert.match(text, /support/);
    assert.match(text, /42/);
  });
});

describe('text_retention', () => {
  it('Free 7 jours, Pro 1 an', () => {
    assert.match(message('free', 'text_retention'), /7 jours/);
    assert.match(message('pro', 'text_retention'), /1 an/);
  });
});
