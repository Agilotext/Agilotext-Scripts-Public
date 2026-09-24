/**
 * Tests — découpe Prénom / Nom
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

const tart = U.splitPersonName('Michaël Tarttar');
assert(tart.prenom === 'Michaël' && tart.nom === 'Tarttar', 'Tarttar');

const de = U.splitPersonName('Florian de Bauer');
assert(de.prenom === 'Florian' && de.nom === 'de Bauer', 'particule de');

const pom = U.splitPersonName('Nicolas de Pomereu');
assert(pom.prenom === 'Nicolas' && pom.nom === 'de Pomereu', 'de Pomereu');

assert(U.isPersonNameLabel('Speaker 2') === false, 'Speaker 2');
assert(U.isPersonNameLabel('Locuteur 3') === false, 'Locuteur');
assert(U.isPersonNameLabel('') === false, 'vide');
assert(U.isPersonNameLabel('Michaël Tarttar') === true, 'personne');

const one = U.splitPersonName('Valentin');
assert(one.prenom === 'Valentin' && one.nom === '', 'un seul mot');

assert(U.joinPersonName('Michaël', 'Tartar') === 'Michaël Tartar', 'join');
assert(U.joinPersonName('  ', '  ') === '', 'join vide');

console.log('agilo-speaker-name.test.mjs OK');
