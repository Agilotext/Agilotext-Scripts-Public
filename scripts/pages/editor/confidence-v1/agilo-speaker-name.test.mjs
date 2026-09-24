/**
 * Tests — libellé interlocuteur (un seul champ)
 * Exécution : node scripts/pages/editor/confidence-v1/agilo-speaker-name.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-speaker-name.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {}, globalThis: null };
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const U = sandbox.window.AgiloSpeakerName;
assert(U, 'AgiloSpeakerName exposé');

assert(U.isPersonNameLabel('Loïc') === true, 'Loïc personne');
assert(U.displayLabel('Loïc') === 'Loïc', 'Loïc une chaîne');
assert(U.displayLabel('Michaël Tarttar') === 'Michaël Tarttar', 'Tarttar une chaîne');
assert(U.displayLabel('Florian de BauerWebPro') === 'Florian de BauerWebPro', 'de BauerWebPro une chaîne');
assert(U.isPersonNameLabel('Speaker 2') === false, 'Speaker 2');
assert(U.isPersonNameLabel('') === false, 'vide');

console.log('agilo-speaker-name.test.mjs OK');
