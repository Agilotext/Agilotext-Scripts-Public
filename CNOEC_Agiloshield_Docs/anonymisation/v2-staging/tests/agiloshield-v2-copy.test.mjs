import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY, jobErrorMessage, pageProgressLabel, plural, queueProcessingLines, unprocessedPagesNotice } from '../agiloshield-v2-copy.js';

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
assert.ok(/PDF/.test(COPY.mode.pseudo), 'pseudo hint mentions PDF');
assert.ok(!/sans retour possible|définitif/i.test(COPY.mode.pseudo), 'pseudo hint does not say PDF cannot be restored');
assert.ok(embed.includes("'Restaurer avec la clé'"), 'restore entry in document menu');
assert.equal(COPY.review.batch.maskAll, 'Tout masquer et valider');
assert.equal(COPY.review.batch.keepAll, 'Tout laisser visible et valider');
assert.equal(COPY.review.batch.title(3), '3 passages n’ont pas été vérifiés');
assert.equal(COPY.review.batch.progress(3, 12), 'Décision 3 sur 12');
assert.equal(COPY.review.applying, 'Application en cours.');
assert.equal(COPY.review.batch.slow, 'Les décisions partent d’abord. Le document est mis à jour une seule fois à la fin.');
assert.equal(COPY.review.batch.skippedConflict, 'Certains passages restent à vérifier : une décision inverse existe déjà sur le même texte.');
assert.equal(COPY.review.batch.blockedZones(2), '2 zones à placer avant validation');
assert.ok(embed.includes('validate.disabled=Boolean(entry.commandBusy)||Boolean(entry.batchRunning)'),
  'validate stays clickable while passages remain');
assert.ok(!embed.includes("confirmAction('Valider votre vérification de ce document ?')"), 'no confirm when all is verified');
assert.equal(COPY.errors.needsZone, 'Ce passage n’a pas de position unique. Tracez sa zone sur le document, puis le masquage sera appliqué.');
assert.equal(COPY.errors.rolledBack, 'Le document a été remis à l’état précédent. Reprenez le passage.');
assert.equal(COPY.errors.pendingDecision, 'Une décision attend encore d’être appliquée. Le document est rechargé.');
assert.equal(COPY.review.batch.finishTrace, undefined);
assert.ok(!embed.includes('finishTrace'), 'batch is not blocked by an armed trace');
assert.ok(embed.includes('releaseTrace(entry)'), 'a batch clears an armed trace');
assert.ok(embed.includes('markPlace(entry,zone.occurrenceId)'), 'a skipped zone stays a card');
assert.ok(!embed.includes('armLinkedZone'), 'a missing position does not arm the trace');
assert.ok(embed.includes("accountStorageKey(':mode')"), 'mode is stored per account');
assert.ok(embed.indexOf("el('span','Pseudonymiser'")<embed.indexOf("el('span','Anonymiser'"), 'pseudo is listed first');
assert.ok(embed.includes("svgIcon('key',pseudoMode,16)"), 'pseudo option has an icon');
assert.ok(embed.includes("svgIcon('eye-slash',anonMode,16)"), 'anon option has an icon');
assert.ok(embed.includes('api.reconcile'), 'restore uses the Java reconcile endpoint');
assert.ok(!embed.includes('RESTORE_WORKFLOW_QUALIFIED'), 'restore is visible without a qualification flag');
assert.ok(embed.includes("'.pdf,.docx,.xlsx,.pptx,.txt,.csv'"), 'restore accepts PDF');
assert.ok(embed.includes('Relancer la vérification'), 'a stale row can be reloaded');
assert.ok(embed.includes('retryStale'), 'a stale review is retried once');
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
const batchApply = embed.indexOf('if(revision)await apply(entry,revision,{untilPublished:true})');
const unplaced = embed.lastIndexOf('if(left.length){', batchApply);
assert.ok(batchApply > 0 && unplaced > 0 && unplaced < batchApply, 'unplaced mask blocks execute');
assert.ok(embed.includes('untilPublished:options?.untilPublished===true'), 'batch waits for the published file');
assert.ok(embed.includes('async function deliverReady'), 'a ready document downloads itself');
assert.ok(embed.includes('await download(entry,true)'), 'a ready result downloads without a second confirmation');
assert.ok(!embed.includes('copy.review.batch.heldByServer'), 'validation no longer shows the server-held banner');
assert.ok(!embed.includes('Document non prêt'), 'the drawer does not say the document is not ready');
assert.ok(embed.includes('copy.review.validatePromise'), 'Je valide promises a verified document');
assert.equal(COPY.review.validatePromise, 'Je valide marque le document comme vérifié, puis vous donne le fichier et la clé.');
assert.equal(COPY.review.validatePromiseFile, 'Je valide marque le document comme vérifié, puis vous donne le fichier.');
assert.equal(COPY.review.processingStay, 'Le traitement continue. Vous pouvez laisser cette page ouverte.');
assert.ok(embed.includes('queueProcessingLines(entry.pageProgress)'), 'a running document says the page can stay open');
const approveStart=embed.indexOf('async function approveHumanReview');
const approveEnd=embed.indexOf('async function undoLastReview');
const approve=embed.slice(approveStart, approveEnd);
assert.ok(approve.includes('hasKnownLeak(entry)'), 'a known leak still stops validation');
const leakFn=embed.slice(embed.indexOf('function hasKnownLeak'), embed.indexOf('async function maskWhenEveryPlaceIsKnown'));
assert.ok(leakFn.includes('known_leak_or_missing_transform'), 'the leak stop names the server blocker');
assert.ok(approve.indexOf('maskWhenEveryPlaceIsKnown')<approve.indexOf('api.approveHumanVerification'), 'masking is attempted before attestation');
assert.ok(!approve.includes('canApproveHumanVerification'), 'an engine veto does not block attestation');
assert.ok(!approve.includes('stillManual') && !approve.includes('pendingStuck'), 'a missing place does not stop the validated file');
const maskStart=embed.indexOf('async function maskWhenEveryPlaceIsKnown');
const maskEnd=embed.indexOf('async function approveHumanReview');
const mask=embed.slice(maskStart, maskEnd);
assert.ok(mask.indexOf('linkPassageBox')<mask.indexOf('api.decideAll') && mask.indexOf('api.decideAll')<mask.indexOf('await apply('), 'link, then one mask command, then apply');
assert.ok(mask.includes('if(!place.publish)return'), 'a missing place skips apply');
assert.ok(!embed.includes('Vérification finale nécessaire'), 'the old final banner is gone');
assert.ok(!embed.includes('Si une donnée reste visible'), 'the banner no longer asks to draw a zone');
assert.ok(embed.includes('dataset.occurrenceId'), 'a preview marker keeps its passage id');
assert.ok(embed.includes('entry.othersOpen'), 'the masked list stays open');
assert.equal(COPY.review.batch.heldByServer, 'Le serveur garde ce document à vérifier. Il n’est pas prêt.');
assert.equal(COPY.errors.engineFailed, 'Le traitement a échoué. Déposez le fichier à nouveau ou contactez-nous.');
assert.equal(jobErrorMessage({reasons:['mask_leak:13'],status:'FAILED'}), COPY.errors.leakFailed);
assert.equal(jobErrorMessage({errorCode:'ENGINE_FAILED'}), COPY.errors.engineFailed);
assert.ok(!embed.includes('known.length>10') && !embed.includes('rects.length>10'), 'page search has no cap of ten');
const keptStart = embed.indexOf('async function finishKeptBatch');
const keptEnd = embed.indexOf('async function finishGroupedDecision');
assert.ok(keptStart > 0 && keptEnd > keptStart, 'KEEP batch is separate');
assert.ok(!embed.slice(keptStart, keptEnd).includes('settleSkippedZone'),
  'KEEP batch does not send a follow-up command');
assert.equal(COPY.review.batch.nothingApplied, 'Le serveur n’a rien appliqué. Le document n’est pas validé.');
assert.equal(COPY.errors.regionRefused, 'Le serveur a refusé la zone. Le document n’est pas validé.');

assert.equal(pageProgressLabel(null), null);
assert.equal(pageProgressLabel({ currentPage: 0, totalPages: 12 }), null);
assert.equal(pageProgressLabel({ currentPage: 13, totalPages: 12 }), null);
assert.equal(pageProgressLabel({ currentPage: 3 }), null);
assert.equal(pageProgressLabel({ currentPage: '3', totalPages: 12 }), null);
assert.equal(pageProgressLabel({ currentUnit: 3, totalUnits: 12 }), null);
assert.equal(pageProgressLabel({ currentPage: 3, totalPages: 12 }), 'Page 3 sur 12');
assert.deepEqual(queueProcessingLines({ currentPage: 3, totalPages: 12 }),
  ['Page 3 sur 12', COPY.review.processingStay]);
assert.deepEqual(queueProcessingLines(null), [COPY.review.processingStay]);
assert.deepEqual(queueProcessingLines({ currentPage: 2, totalPages: 8 }),
  ['Page 2 sur 8', COPY.review.processingStay]);
assert.notEqual(queueProcessingLines({ currentPage: 2, totalPages: 8 })[0],
  queueProcessingLines({ currentPage: 3, totalPages: 12 })[0]);
assert.equal(unprocessedPagesNotice([]), null);
assert.equal(unprocessedPagesNotice(null), null);
assert.equal(unprocessedPagesNotice([{ unit: 4 }]), COPY.review.pagesUnprocessed);
assert.ok(embed.includes('entry.pageProgress'), 'each queue row keeps its own progress');
assert.ok(!embed.includes('state.pageProgress'), 'page progress is not global');
assert.ok(embed.includes('copy.review.progress('), 'review passage counter stays');
assert.ok(embed.includes("entry.uploadProgress+'%'"), 'upload percent stays');
assert.ok(embed.includes('pagesLeftNotice'), 'unprocessed pages stay off the queue');
assert.ok(!embed.includes('127.0.0.1:7689') && !embed.includes('__ASV2_PROBE'));
console.log('copy: PASS');
