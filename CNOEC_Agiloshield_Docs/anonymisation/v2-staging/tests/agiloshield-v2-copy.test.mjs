import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY, jobErrorMessage, plural } from '../agiloshield-v2-copy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(jobErrorMessage({ errorCode: 'PSEUDO_KEY_INVALID' }),
  'La pseudonymisation de ce fichier a échoué. Réessayez ou choisissez Anonymiser.');
assert.equal(jobErrorMessage({ error: 'Job #12 : PSEUDO_KEY_INVALID' }),
  'La pseudonymisation de ce fichier a échoué. Réessayez ou choisissez Anonymiser.');
assert.equal(jobErrorMessage({ error: { code: 'QUOTA_EXCEEDED' } }),
  'Vous avez atteint la limite de documents de votre offre.');
assert.equal(jobErrorMessage({ error: 'SOMETHING_UNKNOWN' }), COPY.errors.failed);
assert.equal(jobErrorMessage(null), COPY.errors.failed);
assert.equal(plural(1, 'passage', 'passages'), '1 passage');
assert.equal(plural(2, 'passage', 'passages'), '2 passages');
assert.equal(COPY.review.toCheckOnPage(2, 1), '2 passages à vérifier sur la page 1');

for (const value of Object.values(COPY.status)) assert.ok(value.length <= 18, value);

const visibleStrings = file => {
  const src = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...src.matchAll(/'([^'\\\n]*(?:\\.[^'\\\n]*)*)'/g)].map(m => m[1]).filter(s => /\s/.test(s));
};
const strings = [...visibleStrings('agiloshield-v2-embed.js'), ...visibleStrings('agiloshield-v2-copy.js')];
for (const text of strings) {
  assert.ok(!/obligation|région vérifiée|périmé|\(s\)/i.test(text), 'jargon: ' + text);
  assert.ok(!text.includes('—'), 'em dash in UI text: ' + text);
  assert.ok(!/Job #/.test(text), 'job id shown to users: ' + text);
}
console.log('copy: PASS');
