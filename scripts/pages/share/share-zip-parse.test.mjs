/**
 * Tests — parse zip de partage (noms de fichiers, pas un vrai zip)
 * Exécution : node scripts/pages/share/share-zip-parse.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'share-zip-parse.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {}, module: { exports: {} } };
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const Z = sandbox.window.AgiloShareZip;
assert(Z, 'AgiloShareZip exposé');
assert(Z.classifyName('Entretien Dupont.txt') === 'txt', 'txt');
assert(Z.classifyName('compte-rendu.html') === 'summary', 'summary by name');
assert(Z.classifyName('transcription.txt') === 'transcript', 'transcript by name');
assert(Z.classifyName('audio.m4a') === 'skip', 'skip audio');
assert(Z.isZipBuffer(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])), 'zip magic');
assert(!Z.isZipBuffer(new Uint8Array([0x3c, 0x68, 0x74, 0x6d])), 'html not zip');
assert(Z.looksLikeGoneHtml('<!DOCTYPE html><html>fichier n\'existe plus</html>'), 'gone html');

const job = Z.jobFromZipFiles([
  { name: 'Réunion équipe.txt', text: 'Intervenant 1: Bonjour.\nIntervenant 2: On envoie le CR.' },
  { name: 'Réunion équipe.html', text: '<h2>Décisions</h2><p>Relancer le compte.</p>' }
]);
assert(job, 'job from typical zip');
assert(job.summaryHtml.indexOf('Décisions') !== -1, 'html = CR');
assert(job.segments.length >= 2, 'txt speakers');
assert(/Réunion/i.test(job.jobTitle), 'title from filename');

const named = Z.jobFromZipFiles([
  { name: 'transcription.txt', text: 'Verbatim seul sans speakers sur chaque ligne.' },
  { name: 'compte-rendu.html', text: '<h2>Compte rendu</h2><p>OK</p>' }
]);
assert(named.summaryHtml.indexOf('Compte rendu') !== -1, 'summary by filename');
assert(named.transcriptHtml.indexOf('Verbatim') !== -1, 'transcript by filename');

console.log('share-zip-parse.test.mjs OK');
