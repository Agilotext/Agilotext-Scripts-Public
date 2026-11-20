/**
 * Portée « de ce passage jusqu’à la fin ».
 * node scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.follow.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'Code-main-editor-IFRAME_V04-confidence.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function extractFunction(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('fonction absente: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('fonction non fermée: ' + name);
}

const api = new Function(
  extractFunction('ag_speakerName') + '\n' +
  extractFunction('ag_renameTargetIndices') + '\n' +
  extractFunction('ag_clocksAllZero') + '\n' +
  extractFunction('ag_formatClock') + '\n' +
  extractFunction('ag_forwardMenuLabel') + '\n' +
  extractFunction('ag_shouldOfferForward') + '\n' +
  'return { ag_renameTargetIndices, ag_shouldOfferForward, ag_forwardMenuLabel };'
)();

const marie = [
  { speaker: 'Marie', start: 0 },
  { speaker: 'Marie', start: 40 },
  { speaker: 'Paul', start: 90 },
  { speaker: 'Marie', start: 4324 },
  { speaker: 'Marie', start: 4400 },
  { speaker: 'Marie', start: 4500 }
];

const forward = api.ag_renameTargetIndices(marie, 'forward', 'Marie', 3);
assert(JSON.stringify(forward) === JSON.stringify([3, 4, 5]), 'forward depuis 3 garde 3, 4 et 5');
assert(!forward.includes(0) && !forward.includes(1), 'le début déjà corrigé n’est pas repris');
assert(!forward.includes(2), 'un autre nom au milieu n’est pas pris');
assert(api.ag_shouldOfferForward(marie, 'Marie', 3) === true, 'la ligne est proposée quand elle n’est ni un segment ni tout');
assert(api.ag_shouldOfferForward(marie, 'Marie', 0) === false, 'depuis le premier, jusqu’à la fin égale toutes les occurrences');
assert(api.ag_shouldOfferForward([{ speaker: 'Marie', start: 10 }], 'Marie', 0) === false, 'un seul segment ne propose pas la ligne');
assert(api.ag_forwardMenuLabel(marie, 3) === 'De ce passage (01:12:04) jusqu’à la fin', 'heure réelle du passage');
const zeros = marie.map((s) => ({ speaker: s.speaker, start: 0 }));
assert(api.ag_forwardMenuLabel(zeros, 3) === 'De ce passage jusqu’à la fin', 'horloges nulles: pas d’heure');

assert(src.includes("window.__agiloEditorConfidenceVersion = '1.09.35-rename-forward'"), 'version 1.09.35-rename-forward');
assert(!src.includes('applyAllBox.checked = true'), 'plus de case toutes les prises cochée');
assert(!src.includes("finishRename('all'"), 'Maj n’applique plus tout avant le menu');
assert(src.includes('counts.offerForward'), 'le menu n’ajoute la ligne que si le calcul le dit');
assert(src.includes("ag_applyRenameScope({ scope: 'one', oldName: '', newName, idx })"), 'le + reste sur un seul segment');
assert(src.includes("selectionMode ? 'selected'"), 'la sélection de passages reste limitée à la sélection');

console.log('rename-forward OK');
