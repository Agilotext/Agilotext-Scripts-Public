/**
 * Pin follow 1.09.8 : plus de chip pane, event agilo:transcript-follow.
 * Exécution : node scripts/pages/editor/confidence-v1/Code-main-editor-IFRAME_V04-confidence.follow.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'Code-main-editor-IFRAME_V04-confidence.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(src.includes("window.__agiloEditorConfidenceVersion = '1.09.8-follow'"), 'version 1.09.8-follow');
assert(!src.includes("'1.09.7-follow'"), 'plus de 1.09.7-follow');
assert(!src.includes('function ensureFollowChip'), 'ensureFollowChip retiré');
assert(!src.includes('function updateFollowChip'), 'updateFollowChip retiré');
assert(!src.includes('#agilo-transcript-follow{display:none'), 'pas de CSS pane chip');
assert(src.includes("new CustomEvent('agilo:transcript-follow'"), 'dispatch agilo:transcript-follow');
assert(src.includes('function removePaneFollowLeftover'), 'leftover pane retiré au boot');
assert(src.includes("leftover.closest('#agilo-audio-sticky')"), 'leftover épargne sticky');
assert(src.includes("leftover.closest('#agilo-audio-wrap')"), 'leftover épargne wrap');
assert(src.includes("leftover.closest('#ag-editor-chrome-dock')"), 'leftover épargne dock');
assert(!/addEventListener\(\s*'scroll'/.test(src), 'pas de listener scroll générique follow');
assert(src.includes("addEventListener('wheel'"), 'molette désarme');
assert(src.includes("addEventListener('touchmove'"), 'touch désarme');

console.log('Code-main-editor-IFRAME_V04-confidence.follow.test.mjs OK');
