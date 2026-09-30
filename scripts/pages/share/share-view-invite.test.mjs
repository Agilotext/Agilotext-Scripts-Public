import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inviteScriptPath = path.resolve(__dirname, 'share-view-invite.js');

test('share-view-invite.js invariants and safety checks', () => {
  const content = fs.readFileSync(inviteScriptPath, 'utf8');

  // 1. Verify no-store is NOT present (avoids CORS preflight failures on backend)
  assert.ok(!content.includes("cache: 'no-store'"), 'Aucun cache: no-store pour éviter le rejet CORS preflight');
  assert.ok(!content.includes('cache:"no-store"'), 'Aucun cache: no-store condensé');

  // 2. Verify progressive audio loading is decoupled from document fetch
  assert.ok(content.includes('fetchGuestBlob'), 'Fonction fetchGuestBlob présente');
  assert.ok(content.includes('fetchGuestDocument'), 'Fonction fetchGuestDocument présente');
  assert.ok(content.includes('⏳ Chargement audio…'), 'Indicateur de chargement progressif de l’audio');

  // 3. Verify audioUnavailable dataset is marked on hidePlayer to prevent phantom sticky dock
  assert.ok(content.includes("wrap.dataset.audioUnavailable = 'unavailable'"), 'Marque audioUnavailable lors du hidePlayer');

  // 4. Verify mountPlayer clears audioUnavailable dataset
  assert.ok(content.includes("wrap.removeAttribute('data-audio-unavailable')"), 'Supprime data-audio-unavailable lors du mountPlayer');

  // 5. Verify Nucleo icon action markup
  assert.ok(content.includes('data-act="copy-active"'), 'Bouton de copie de la transcription ou du compte-rendu');
  assert.ok(content.includes('data-act="download-guest"'), 'Bouton de téléchargement du zip invité');
});
