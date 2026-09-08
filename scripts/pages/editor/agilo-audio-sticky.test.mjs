/**
 * Tests unitaires — rangée audio in-flow
 * Exécution : node scripts/pages/editor/agilo-audio-sticky.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-audio-sticky.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  window: { AGILO_AUDIO_STICKY_SKIP_BOOT: true },
  document: undefined
};
sandbox.window.window = sandbox.window;
sandbox.global = sandbox;
vm.runInNewContext(src, sandbox);

const AS = sandbox.window.AgiloAudioSticky;
assert(AS && typeof AS.computeAudioSlotState === 'function', 'computeAudioSlotState exposé');
assert(typeof AS.getEditorChromeTop === 'function', 'getEditorChromeTop exposé');
assert(typeof AS.applyIoHysteresis === 'function', 'applyIoHysteresis exposé');
assert(AS.SLOT_ID === 'ag-editor-audio-slot', 'SLOT_ID');
assert(AS.IO_SHOW_RATIO === 0.12, 'hystérésis ratio');

const visible = AS.computeAudioSlotState({
  wrapIntersecting: true,
  transcriptTabActive: true,
  audioUnavailable: false,
  chromeTop: 120
});
assert(visible.shouldShow === false, 'slot fermé si le player intersecte le viewport');

const hidden = AS.computeAudioSlotState({
  wrapIntersecting: false,
  transcriptTabActive: true,
  audioUnavailable: false,
  chromeTop: 120
});
assert(hidden.shouldShow === true, 'slot ouvert si player hors ecran et onglet transcription');
assert(hidden.chromeTop === 120, 'chromeTop onglets transmis');

const otherTab = AS.computeAudioSlotState({
  wrapIntersecting: false,
  transcriptTabActive: false,
  audioUnavailable: false,
  chromeTop: 120
});
assert(otherTab.shouldShow === false, 'slot fermé hors onglet transcription');

const expired = AS.computeAudioSlotState({
  wrapIntersecting: false,
  transcriptTabActive: true,
  audioUnavailable: true,
  chromeTop: 120
});
assert(expired.shouldShow === false, 'slot fermé si audio indisponible');

const noChrome = AS.computeAudioSlotState({
  wrapIntersecting: false,
  transcriptTabActive: true,
  audioUnavailable: false,
  chromeTop: 0
});
assert(noChrome.shouldShow === true, 'slot possible même si onglets hors viewport');

assert(src.includes("position:sticky"), 'CSS sticky in-flow');
assert(!/\.agilo-audio-sticky\{[^}]*position:fixed/.test(src.replace(/\n/g, '')), 'rangée sans position:fixed');
assert(!src.includes('z-index:26'), 'pas de z-index overlay 26');
assert(src.includes("setAttribute('inert'"), 'inert sur le wrap original quand proxy actif');
assert(src.includes('height:0'), 'slot hauteur 0 par défaut');
assert(src.includes('is-open'), 'slot hauteur auto via is-open');
assert(src.includes('agilo-audio-sticky__ico'), 'icônes mobile 15s/30s');
assert(src.includes('prefers-reduced-motion'), 'reduced-motion sans animation de hauteur');

const tabsOnly = AS.getEditorChromeTop({
  querySelector(sel) {
    if (sel.includes('ed-tabs')) {
      return {
        getBoundingClientRect() {
          return { bottom: 88, height: 44 };
        }
      };
    }
    if (sel.includes('ed-toolbar')) {
      return {
        getBoundingClientRect() {
          return { bottom: 140, height: 52 };
        }
      };
    }
    return null;
  }
});
assert(tabsOnly === 88, 'getEditorChromeTop mesure les onglets, pas la toolbar');

assert(AS.applyIoHysteresis(true, { isIntersecting: false, intersectionRatio: 0 }) === false, 'IO: hors ecran → fermer hystérésis');
assert(AS.applyIoHysteresis(false, { isIntersecting: true, intersectionRatio: 0.5 }) === true, 'IO: ratio haut → player visible');
assert(AS.applyIoHysteresis(false, { isIntersecting: true, intersectionRatio: 0.02 }) === false, 'IO: ratio trop bas garde l état précédent');
assert(AS.applyIoHysteresis(true, { isIntersecting: true, intersectionRatio: 0.02 }) === true, 'IO: petite intersection ne flicker pas');

console.log('agilo-audio-sticky.test.mjs OK');
