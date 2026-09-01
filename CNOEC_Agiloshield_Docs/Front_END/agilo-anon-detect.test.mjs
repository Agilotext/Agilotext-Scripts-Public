import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-editor-anonymiser-transcript-v3.js'), 'utf8');

function loadBlock(startMark, endMark) {
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('bloc introuvable: ' + startMark);
  }
  return src.slice(start, end);
}

const GENERIC_SPEAKER_RE = /^(speaker[_\s-]?[a-z0-9]+|intervenant\s*\d+|locuteur\s*\d+)$/i;
const ALL_MASK_ENTITY_TYPES = ['PER', 'ORG', 'LOC', 'EML', 'TEL', 'ADR'];
const MIN_ENTITY_TYPES = 2;
const helpers = { GENERIC_SPEAKER_RE, ALL_MASK_ENTITY_TYPES, MIN_ENTITY_TYPES };

new Function(
  'GENERIC_SPEAKER_RE',
  `${loadBlock('  // --- agilo-anon-detect helpers ---', '  // --- end helpers ---')}\n` +
    'this.normalizeAnonCompare = normalizeAnonCompare;\n' +
    'this.detectUnchangedOutput = detectUnchangedOutput;\n' +
    'this.detectSpeakerLabelsStillVisible = detectSpeakerLabelsStillVisible;\n'
).call(helpers, GENERIC_SPEAKER_RE);

new Function(
  `${loadBlock('  // --- agilo-anon2 helpers ---', '  // --- end anon2 helpers ---')}\n` +
    'this.extractJobIds = extractJobIds;\n' +
    'this.normalizeAnon2Output = normalizeAnon2Output;\n' +
    'this.mapAnonStatus = mapAnonStatus;\n'
).call(helpers);

new Function(
  'ALL_MASK_ENTITY_TYPES',
  'MIN_ENTITY_TYPES',
  `${src.slice(src.indexOf('  function sanitizeEntityTypes'), src.indexOf('  function resolveEntityTypes'))}\n` +
    'this.sanitizeEntityTypes = sanitizeEntityTypes;\n' +
    'this.assertMinEntityTypes = assertMinEntityTypes;\n'
).call(helpers, ALL_MASK_ENTITY_TYPES, MIN_ENTITY_TYPES);

new Function(
  'GENERIC_SPEAKER_RE',
  'window',
  `${src.slice(src.indexOf('  function isGenericSpeaker'), src.indexOf('  function buildSegmentElement'))}\n` +
    'this.parseSpeakerAndText = parseSpeakerAndText;\n' +
    'this.splitPreviewBlocks = splitPreviewBlocks;\n' +
    'this.mapPreviewToOriginalSegments = mapPreviewToOriginalSegments;\n' +
    'this.normalizeSpeakerForSegment = normalizeSpeakerForSegment;\n' +
    'this.isGenericSpeaker = isGenericSpeaker;\n'
).call(helpers, GENERIC_SPEAKER_RE, {});

function detectIgnoredEntityTypes(input, output, types) {
  const ignored = [];
  const srcText = String(input || '');
  const out = String(output || '');
  const typeSet = new Set((Array.isArray(types) ? types : []).map((code) => String(code || '').toUpperCase()));
  if (typeSet.has('EML') && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(srcText) && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(out)) {
    ignored.push('Email');
  }
  if (typeSet.has('TEL') && /\b0[1-9](?:[\s.-]?\d{2}){4}\b/.test(srcText) && /\b0[1-9](?:[\s.-]?\d{2}){4}\b/.test(out)) {
    ignored.push('Téléphone');
  }
  if (typeSet.has('PER') && helpers.detectSpeakerLabelsStillVisible(srcText, out)) {
    ignored.push('Personne (noms de locuteur)');
  } else if (typeSet.has('PER') && helpers.detectUnchangedOutput(srcText, out)) {
    ignored.push('Personne');
  }
  if (typeSet.has('ORG') && helpers.detectUnchangedOutput(srcText, out)) {
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
assert(detectIgnoredEntityTypes(dialogueInput, dialogueOutput, ['PER']).includes('Personne (noms de locuteur)'), 'warning locuteur PER');

const unchangedInput = 'Florian a appelé Stéphane chez Bauerwebpro.';
assert(helpers.detectUnchangedOutput(unchangedInput, unchangedInput), 'texte inchangé détecté');
assert(detectIgnoredEntityTypes(unchangedInput, unchangedInput, ['PER', 'ORG']).includes('Personne'), 'PER inchangé');
assert(detectIgnoredEntityTypes(unchangedInput, unchangedInput, ['PER', 'ORG']).includes('Organisation'), 'ORG inchangé');
assert(!helpers.detectUnchangedOutput(unchangedInput, 'Florian a appelé <PER_AA> chez <ORG_BB>.'), 'texte masqué non inchangé');
assert(detectIgnoredEntityTypes('Contact: test@example.com', 'Contact: test@example.com', ['EML']).includes('Email'), 'email non masqué');
assert(!detectIgnoredEntityTypes('Bonjour', 'Bonjour', ['PER']).includes('Personne (noms de locuteur)'), 'pas de faux positif dialogue');

assert.deep = null;
assert(helpers.extractJobIds({ jobIdList: [1000039453] }).join() === '1000039453', 'jobIdList');
assert(helpers.extractJobIds({ jobIds: ['12', '13'] }).join() === '12,13', 'jobIds');
assert(helpers.extractJobIds({ jobs: [{ jobId: 7 }] }).join() === '7', 'jobs');

const normalized = helpers.normalizeAnon2Output('\uFEFFHello\r\nStéphane:\r\n\r\n');
assert(normalized === 'Hello\nStéphane:', 'normalize BOM CRLF');

assert(helpers.mapAnonStatus('READY').status === 'done', 'READY');
assert(helpers.mapAnonStatus('ON_ERROR', { userErrorMessage: 'boom' }).status === 'error', 'ON_ERROR');
assert(helpers.mapAnonStatus('PENDING').status === 'pending', 'PENDING');

assert(helpers.sanitizeEntityTypes(['per', 'ORG']).join() === 'PER,ORG', 'sanitize');
let threw = false;
try { helpers.assertMinEntityTypes(['PER']); } catch (err) { threw = /au moins 2/.test(err.message); }
assert(threw, 'min 2 types');

const segs = [{ id: '1', speaker: 'Florian', text: 'Bonjour' }, { id: '2', speaker: 'Stéphane', text: 'Oui' }];
const mapped = helpers.mapPreviewToOriginalSegments('Florian: Bonjour <PER_AA>\n\nStéphane: Oui', segs);
assert(mapped && mapped.length === 2 && mapped[0].text === 'Bonjour <PER_AA>', 'remap OK');
assert(helpers.mapPreviewToOriginalSegments('un seul bloc', segs) === null, 'remap null si count différent');

assert(/__agiloAnonVersion = '3.3.0'/.test(src), 'version 3.3.0');
assert(!/\/anonText'/.test(src), 'plus de /anonText');

console.log('agilo-anon-detect.test.mjs: 20/20 OK');
