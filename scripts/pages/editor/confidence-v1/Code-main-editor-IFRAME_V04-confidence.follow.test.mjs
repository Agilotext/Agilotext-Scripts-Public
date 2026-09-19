/**
 * Pin 1.09.13-plus-picker : liste locuteurs sur le +, ghost ancre, scope one.
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

assert(src.includes("window.__agiloEditorConfidenceVersion = '1.09.13-plus-picker'"), 'version 1.09.13-plus-picker');
assert(!src.includes("'1.09.12-combobox'"), 'plus de 1.09.12-combobox');
assert(!src.includes("'1.09.11-anchor'"), 'plus de 1.09.11-anchor');
assert(!src.includes("'1.09.10-roster'"), 'plus de 1.09.10-roster');
assert(!src.includes('Nouveau nom'), 'pas de bouton Nouveau nom');
assert(!src.includes('Prénom NOM'), 'pas de champ Prénom NOM');
assert(!src.includes("input.type = 'search'"), 'pas de type=search (anneau Safari)');
assert(src.includes("input.type = 'text'"), 'champ type=text');
assert(src.includes('function shouldCreateSpeakerFromQuery'), 'shouldCreateSpeakerFromQuery dans le fork');
assert(src.includes('function tryCreateFromQuery'), 'Entrée crée via tryCreateFromQuery');
assert(src.includes('normalizeName(query)'), 'Entrée sans hit → normalizeName(query)');
assert(src.includes("nucleoIcon('userPlus'"), 'ligne Ajouter = user-plus Nucleo');
assert(src.includes('Tapez un nom, Entrée pour l'), 'hint vide Apple');
assert(src.includes('--color--blanc_gris'), 'hover blanc_gris pas wash bleu');
assert(!src.includes("color-mix(in srgb, var(--color--blue, #174a96) 12%, transparent)"), 'pas de wash bleu 12% picker/menu');
assert(!src.includes("'1.09.9-follow'"), 'plus de 1.09.9-follow');
assert(!src.includes("'1.09.8-follow'"), 'plus de 1.09.8-follow');
assert(src.includes('function ag_showSpeakerPicker'), 'ag_showSpeakerPicker');
assert(src.includes('function ag_bindAnchoredPopover'), 'ag_bindAnchoredPopover');
assert(src.includes('function computePopoverPlace'), 'computePopoverPlace dans le fork');
assert(src.includes('overscroll-behavior:contain'), 'overscroll liste');
assert(src.includes('_transcriptFollow.disarm()'), 'disarm Suivre à l’ouverture');
assert(src.includes('--0-5_radius'), 'token radius Webflow');
assert(!src.includes('.ag-speaker-picker-backdrop{'), 'pas de CSS voile picker');
assert(!src.includes('.ag-rename-backdrop{'), 'pas de CSS voile portée');
assert(!src.includes('aria-modal'), 'aria-modal retiré');
assert(src.includes('agilo_speaker_picker'), 'flag recette picker');
assert(src.includes("prompt('Renommer le locuteur"), 'prompt fallback présent');
{
  const promptHits = src.split("prompt('Renommer le locuteur").length - 1;
  assert(promptHits === 2, 'prompt seulement flag off + catch');
}
assert(!src.includes('Nom du nouveau locuteur'), 'pas de prompt Intervenant dans le fork');
assert(!src.includes('function afterPlus'), 'afterPlus retiré');
assert(!src.includes('function openPickerOnCaretSeg'), 'openPickerOnCaretSeg retiré');
assert(!src.includes('openPickerOnCaretSeg()'), 'plus d’appel openPickerOnCaretSeg');
assert(src.includes('e.stopPropagation()'), 'stopPropagation intercept +');
assert(src.includes('.ag-ux-plus'), 'clic .ag-ux-plus');
assert(src.includes('data-agilo-plus-ghost'), 'ancre ghost plus');
assert(src.includes('ag_showSpeakerPicker(ghost'), 'picker + ancré sur ghost, pas sur .ag-ux-plus');
assert(!src.includes('ag_showSpeakerPicker(plus'), 'pas d’ancre plusBtn');
assert(!src.includes('ag_showSpeakerPicker(e.target'), 'pas d’ancre e.target plus');
assert(src.includes('cloneNode(true)'), 'split par cloneNode');
assert(src.includes("clone.classList.remove('is-active', 'is-selected')"), 'clone sans is-active');
assert(src.includes('function agiloApplyPlusSpeakerName'), 'apply plus dédié');
assert(src.includes("ag_applyRenameScope({ scope: 'one', oldName: '', newName, idx })"), 'plus = scope one, pas de 2e menu');
assert(src.includes('function agiloSplitAtCaretCreateSpeaker'), 'split fork');
assert(src.includes('function startPlusSpeakerFlow'), 'startPlusSpeakerFlow');
assert(src.includes('function hasSpeakerLabels'), 'hasSpeakerLabels dans le fork');
assert(src.includes('function sliceTextAt'), 'sliceTextAt dans le fork');
assert(src.includes('function computeMidStart'), 'computeMidStart dans le fork');
assert(!src.includes("addEventListener('dblclick'"), 'plus de dblclick locuteur');
assert(src.includes("e.target.closest('.speaker')"), 'clic simple locuteur');
assert(src.includes('function isSpeakerPickerEnabled'), 'flag picker');
assert(src.includes('function foldSpeakerSearch'), 'fold dans le fork');
assert(src.includes('.ag-speaker-picker{'), 'CSS picker à côté du menu portée');
assert(src.includes('function scrollToActivePlaybackSegment'), 'scrollToActivePlaybackSegment');
assert(src.includes('scrollToActivePlaybackSegment({ force: true })'), 'scroll forcé arm/seek');
assert(src.includes('scrollToActivePlaybackSegment({ force: false })'), 'timeupdate scroll conditionnel');
assert(src.includes('function resolveActiveSegmentIndex'), 'resolveActiveSegmentIndex dans fork');
assert(src.includes('if (armed) scrollToActivePlaybackSegment'), 'onChange réarme → scroll');
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
