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
assert.equal(COPY.review.applying, 'Application en cours.');
assert.equal(COPY.review.batch.slow, 'Les décisions partent d’abord. Le document est mis à jour une seule fois à la fin.');
assert.equal(COPY.review.batch.skippedConflict, 'Certains passages restent à vérifier : une décision inverse existe déjà sur le même texte.');
assert.equal(COPY.review.batch.blockedZones(2), '2 zones à placer avant validation');
assert.ok(embed.includes('validate.disabled=!verified&&(Boolean(entry.commandBusy)||Boolean(entry.batchRunning))'),
  'validate stays clickable while passages remain');
assert.ok(!embed.includes("confirmAction('Valider votre vérification de ce document ?')"), 'no confirm when all is verified');
assert.equal(COPY.errors.needsZone, 'Ce passage n’a pas de position unique. Tracez sa zone sur le document, puis le masquage sera appliqué.');
assert.equal(COPY.errors.rolledBack, 'Le document a été remis à l’état précédent. Reprenez le passage.');
assert.equal(COPY.errors.pendingDecision, 'Une décision attend encore d’être appliquée. Le document est rechargé.');
assert.equal(COPY.review.batch.finishTrace, 'Terminez le tracé en cours avant cette action.');
assert.ok(embed.includes('api.decideAll'), 'batch sends one grouped decision');
assert.ok(embed.includes('batchOpUnsupported'), 'unknown operation falls back without a second apply');
assert.ok(embed.includes('visualNeedsPlace'), 'a logo without a rectangle stays to place');
assert.ok(embed.includes("skipCode(item)==='NEW_MASK_REQUIRES_LINKED_REGION'"), 'a skipped zone opens after the batch apply');
assert.ok(embed.includes('intervalMs:1000,expectRevision:revision'), 'one execute polls every second without assuming the old revision');
assert.ok(embed.includes('review.imageRegions'), 'logos and images already listed by the review become cards');
assert.ok(embed.includes('asv2-others-line'), 'a masked row can be reopened');
assert.ok(!embed.includes('state.previewSerial++;state.previewCleanup?.();\n  renderDrawer(entry);renderQueue();'),
  'apply no longer wipes the preview before execute');
const maskAt = embed.indexOf('const maskReceipt=await postDecision');
const regionAt = embed.indexOf('revision:maskReceipt.revision');
const applyAt = embed.indexOf('await apply(entry,regionReceipt.revision)');
assert.ok(maskAt>0 && regionAt>maskAt && applyAt>regionAt, 'MASK, then linked zone, then one execute');
assert.ok(embed.includes('occurrenceId:target.occurrenceId||target.id||target.maskOccurrenceId') ||
  embed.includes('const occurrenceId=target.occurrenceId||target.id||target.maskOccurrenceId'),
  'linked zone sends occurrenceId');
console.log('copy: PASS');
