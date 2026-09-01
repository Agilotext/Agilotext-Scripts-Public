import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-cr-history.js'), 'utf8');
const start = src.indexOf('  // --- agilo-cr-history helpers ---');
const end = src.indexOf('  // --- end helpers ---');
if (start < 0 || end < 0 || end <= start) {
  throw new Error('helpers introuvables dans agilo-cr-history.js');
}

const helpers = {};
new Function(
  `${src.slice(start, end)}\n` +
    'this.stripVersionUrls = stripVersionUrls;\n' +
    'this.previousVersionsOf = previousVersionsOf;\n' +
    'this.shouldShowHistory = shouldShowHistory;\n' +
    'this.canRestoreHistory = canRestoreHistory;\n' +
    'this.restoreIncrementsRegenerations = restoreIncrementsRegenerations;\n' +
    'this.formatVersionWhen = formatVersionWhen;\n' +
    'this.formatVersionRow = formatVersionRow;\n' +
    'this.formatUndoLabel = formatUndoLabel;\n'
).call(helpers);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(helpers.shouldShowHistory([]) === false, 'liste vide = rien');
assert(helpers.shouldShowHistory(null) === false, 'null = rien');
assert(helpers.shouldShowHistory([{ versionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }]) === true, 'une archive = horloge');

const stripped = helpers.stripVersionUrls({
  status: 'OK',
  currentVersion: { versionId: '11111111-1111-1111-1111-111111111111', url: 'https://example.invalid/x', promptModelName: 'Modele A' },
  previousVersions: [
    { versionId: '22222222-2222-2222-2222-222222222222', url: 'https://example.invalid/y', createdAt: '2026-09-01T12:00:00.000Z', promptModelName: 'Modele B' }
  ]
});
assert(!stripped.currentVersion.url, 'url courant retiré');
assert(!stripped.previousVersions[0].url, 'url archive retiré');
assert(stripped.previousVersions[0].versionId === '22222222-2222-2222-2222-222222222222', 'versionId conservé');

assert(helpers.canRestoreHistory({ pending: true, versionId: 'x', previousVersions: [{}] }) === false, 'refuse si pending');
assert(helpers.canRestoreHistory({ pending: false, versionId: '', previousVersions: [{}] }) === false, 'refuse sans versionId');
assert(
  helpers.canRestoreHistory({
    pending: false,
    versionId: '22222222-2222-2222-2222-222222222222',
    previousVersions: [{ versionId: '22222222-2222-2222-2222-222222222222' }]
  }) === true,
  'restore OK hors pending'
);

assert(helpers.restoreIncrementsRegenerations() === false, 'restore n incremente pas les relances');

const row = helpers.formatVersionRow({
  createdAt: '2026-09-01T14:26:24.373Z',
  promptModelName: 'Modele par Default'
});
assert(row.includes('Modele par Default'), 'nom de modele dans la ligne');
assert(row.includes('·'), 'separateur date / modele');
assert(helpers.formatUndoLabel({ createdAt: '2026-09-01T14:26:24.373Z' }).startsWith('Revenir'), 'label Revenir');

const sorted = helpers.previousVersionsOf({
  previousVersions: [
    { versionId: 'old', archivedAt: '2026-09-01T10:00:00.000Z' },
    { versionId: 'new', archivedAt: '2026-09-01T16:00:00.000Z' }
  ]
});
assert(sorted[0].versionId === 'new', 'archives les plus recentes en premier');

console.log('Résultat : 12 ok, 0 échec(s)');
