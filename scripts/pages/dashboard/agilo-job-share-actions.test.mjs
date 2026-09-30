import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('agilo-job-share-actions syntax and exports', () => {
  const content = readFileSync('scripts/pages/dashboard/agilo-job-share-actions.js', 'utf8');

  // Verify Nucleo SVG and classes
  assert.ok(content.includes('agilo-ico-share'), 'Contient la classe agilo-ico-share');
  assert.ok(content.includes('agilo-ico-check'), 'Contient la classe agilo-ico-check');
  assert.ok(content.includes('agilo-actions-cell'), 'Contient la classe agilo-actions-cell');
  assert.ok(content.includes('agilo-action-btn'), 'Contient la classe agilo-action-btn');

  // Verify delete button preserves classes
  assert.ok(content.includes('.delete-job-button_to-confirm'), 'Preserve la classe delete-job-button_to-confirm');
  assert.ok(content.includes('.delete-job-button'), 'Preserve la classe delete-job-button');

  // Verify header rename to Actions
  assert.ok(content.includes("d.textContent = 'Actions'"), 'Renomme bien le header en Actions');

  // Verify REM dimensions in injected styles
  assert.ok(content.includes('1.875rem'), 'Bouton calibré à 1.875rem');
  assert.ok(content.includes('1.125rem'), 'Icônes calibrées à 1.125rem');
  assert.ok(content.includes('0.5rem'), 'Gap calibré à 0.5rem');
  assert.ok(content.includes('4.75rem'), 'Cellule avec min-width de 4.75rem');

  // Verify status guard
  assert.ok(content.includes('isJobReady'), 'Contient la vérification du statut du job');
  assert.ok(content.includes('Partage disponible lorsque la transcription est prête'), 'Tooltip pour job non prêt');
});

test('Code-mes-transcripts-logic-v2 fallback row HTML', () => {
  const content = readFileSync('scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js', 'utf8');

  assert.ok(content.includes('agilo-row-share'), 'Fallback contient le bouton agilo-row-share');
  assert.ok(content.includes('delete-job-button_to-confirm'), 'Fallback contient delete-job-button_to-confirm');
  assert.ok(content.includes('actions-cell'), 'Fallback contient actions-cell');
});
