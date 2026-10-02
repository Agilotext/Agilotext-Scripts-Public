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
assert.equal(jobErrorMessage({ errorCode: 'COMMAND_INVALID' }),
  'Le masquage n’a pas pu être appliqué. Le document n’a pas changé. Réessayez.');
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
const embed = fs.readFileSync(path.join(root, 'agiloshield-v2-embed.js'), 'utf8');
assert.ok(!embed.includes('Masquer définitivement la zone tracée'), 'zone confirm popup removed');
assert.ok(embed.includes('undoLastReview'), 'undo helper present');
assert.ok(embed.includes("event.key.toLowerCase()==='z'"), 'cmd-z shortcut present');
assert.ok(embed.includes('highlightPdfText'), 'text locate highlight present');
assert.ok(COPY.review.shortcuts.includes('⌘Z'), 'shortcut legend includes undo');
assert.ok(embed.includes('surfaceTabs.remove()'), 'Fichiers/Texte tablist removed from the page');
assert.ok(embed.includes("'Coller du texte'"), 'paste text button present');
assert.ok(embed.includes('typesButton.hidden=true;listsButton.hidden=true'), 'one settings entry, not two buttons');
assert.ok(!/'Listes'|'Listes,/.test(embed), 'no « Listes » label left');
assert.ok(!embed.includes("'asv2-help-button'"), 'help button without double circle');
assert.ok(!/hors PDF/.test(COPY.mode.pseudo), 'pseudo hint does not say PDF is refused');
assert.ok(/PDF/.test(COPY.mode.pseudo), 'pseudo hint explains PDF is not reversible');
assert.ok(embed.includes("'Restaurer avec la clé'"), 'restore entry in document menu');
assert.equal(COPY.review.batch.maskAll, 'Tout masquer et valider');
assert.equal(COPY.review.batch.keepAll, 'Tout laisser visible et valider');
assert.equal(COPY.review.batch.title(3), '3 passages n’ont pas été vérifiés');
assert.equal(COPY.review.batch.progress(3, 12), 'Décision 3 sur 12');
assert.equal(COPY.review.batch.blockedZones(2), '2 zones à placer avant validation');
assert.ok(embed.includes('validate.disabled=!verified&&(Boolean(entry.commandBusy)||Boolean(entry.batchRunning))'),
  'validate stays clickable while passages remain');
assert.ok(!embed.includes("confirmAction('Valider votre vérification de ce document ?')"), 'no confirm when all is verified');
console.log('copy: PASS');
