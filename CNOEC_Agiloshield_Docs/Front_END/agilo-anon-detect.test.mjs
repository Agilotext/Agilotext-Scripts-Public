import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-editor-anonymiser-transcript-v3.js'), 'utf8');
const start = src.indexOf('  // --- agilo-anon-detect helpers ---');
const end = src.indexOf('  // --- end helpers ---');
if (start < 0 || end < 0 || end <= start) {
  throw new Error('helpers introuvables dans agilo-editor-anonymiser-transcript-v3.js');
}

const GENERIC_SPEAKER_RE = /^(speaker[_\s-]?[a-z0-9]+|intervenant\s*\d+|locuteur\s*\d+)$/i;
const helpers = { GENERIC_SPEAKER_RE };
new Function(
  'GENERIC_SPEAKER_RE',
  `${src.slice(start, end)}\n` +
    'this.normalizeAnonCompare = normalizeAnonCompare;\n' +
    'this.detectUnchangedOutput = detectUnchangedOutput;\n' +
    'this.detectSpeakerLabelsStillVisible = detectSpeakerLabelsStillVisible;\n'
).call(helpers, GENERIC_SPEAKER_RE);

function detectIgnoredEntityTypes(input, output, types) {
  const ignored = [];
  const src = String(input || '');
  const out = String(output || '');
  const typeSet = new Set((Array.isArray(types) ? types : []).map((code) => String(code || '').toUpperCase()));
  if (typeSet.has('EML') && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(src) && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(out)) {
    ignored.push('Email');
  }
  if (typeSet.has('TEL') && /\b0[1-9](?:[\s.-]?\d{2}){4}\b/.test(src) && /\b0[1-9](?:[\s.-]?\d{2}){4}\b/.test(out)) {
    ignored.push('Téléphone');
  }
  if (typeSet.has('PER') && helpers.detectSpeakerLabelsStillVisible(src, out)) {
    ignored.push('Personne (noms de locuteur)');
  } else if (typeSet.has('PER') && helpers.detectUnchangedOutput(src, out)) {
    ignored.push('Personne');
  }
  if (typeSet.has('ORG') && helpers.detectUnchangedOutput(src, out)) {
    ignored.push('Organisation');
  }
  return Array.from(new Set(ignored));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dialogueInput = 'Florian de Bauerwebpro: Bonjour Stéphane\nStéphane: Oui Florian';
const dialogueOutput = 'Florian de Bauerwebpro: Bonjour <PER_AA>\nStéphane: Oui Florian';
assert(helpers.detectSpeakerLabelsStillVisible(dialogueInput, dialogueOutput), 'labels locuteur encore visibles');
const ignoredDialogue = detectIgnoredEntityTypes(dialogueInput, dialogueOutput, ['PER']);
assert(ignoredDialogue.includes('Personne (noms de locuteur)'), 'warning locuteur PER');

const unchangedInput = 'Florian a appelé Stéphane chez Bauerwebpro.';
assert(helpers.detectUnchangedOutput(unchangedInput, unchangedInput), 'texte inchangé détecté');
const ignoredUnchanged = detectIgnoredEntityTypes(unchangedInput, unchangedInput, ['PER', 'ORG']);
assert(ignoredUnchanged.includes('Personne'), 'PER inchangé');
assert(ignoredUnchanged.includes('Organisation'), 'ORG inchangé');

const maskedOutput = 'Florian a appelé <PER_AA> chez <ORG_BB>.';
assert(!helpers.detectUnchangedOutput(unchangedInput, maskedOutput), 'texte masqué non inchangé');

const emailInput = 'Contact: test@example.com';
assert(detectIgnoredEntityTypes(emailInput, emailInput, ['EML']).includes('Email'), 'email non masqué');
assert(!detectIgnoredEntityTypes('Bonjour', 'Bonjour', ['PER']).includes('Personne (noms de locuteur)'), 'pas de faux positif dialogue sur Bonjour seul');

console.log('agilo-anon-detect.test.mjs: 8/8 OK');
