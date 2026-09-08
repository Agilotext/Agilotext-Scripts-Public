/**
 * Tests unitaires — mini-barre audio flottante
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
assert(AS && typeof AS.computeAudioStickyBox === 'function', 'computeAudioStickyBox exposé');
assert(typeof AS.getEditorChromeBottom === 'function', 'getEditorChromeBottom exposé');
assert(AS.DOCK_GAP === 8, 'DOCK_GAP = 8');

const chromeBottom = 120;
const visible = AS.computeAudioStickyBox(
  { top: 40, bottom: 200 },
  { left: 320, width: 960, bottom: 800 },
  chromeBottom,
  1440,
  { wrapIntersecting: true, transcriptTabActive: true, audioUnavailable: false }
);
assert(visible.shouldShow === false, 'pas de mini-barre si le player intersecte le viewport');

const hidden = AS.computeAudioStickyBox(
  { top: -180, bottom: -20 },
  { left: 320, width: 960, bottom: 800 },
  chromeBottom,
  1440,
  { wrapIntersecting: false, transcriptTabActive: true, audioUnavailable: false }
);
assert(hidden.shouldShow === true, 'mini-barre si player hors ecran et onglet transcription');
assert(hidden.top === chromeBottom + 8, 'top mini-barre = chrome + 8');
assert(hidden.left === 320, 'left aligne sur la colonne transcript');
assert(hidden.width === 960, 'largeur alignee sur la colonne');

const otherTab = AS.computeAudioStickyBox(
  { top: -180, bottom: -20 },
  { left: 320, width: 960, bottom: 800 },
  chromeBottom,
  1440,
  { wrapIntersecting: false, transcriptTabActive: false, audioUnavailable: false }
);
assert(otherTab.shouldShow === false, 'pas de mini-barre hors onglet transcription');

const expired = AS.computeAudioStickyBox(
  { top: -180, bottom: -20 },
  { left: 320, width: 960, bottom: 800 },
  chromeBottom,
  1440,
  { wrapIntersecting: false, transcriptTabActive: true, audioUnavailable: true }
);
assert(expired.shouldShow === false, 'pas de mini-barre si audio indisponible');

const noChrome = AS.computeAudioStickyBox(
  { top: -180, bottom: -20 },
  { left: 320, width: 960, bottom: 800 },
  0,
  1440,
  { wrapIntersecting: false, transcriptTabActive: true, audioUnavailable: false }
);
assert(noChrome.shouldShow === false, 'pas de mini-barre si chromeBottom vaut 0');

const mobile = AS.computeAudioStickyBox(
  { top: -80, bottom: -10 },
  { left: 8, width: 360, bottom: 640 },
  96,
  390,
  { wrapIntersecting: false, transcriptTabActive: true, audioUnavailable: false }
);
assert(mobile.shouldShow === true, 'mini-barre mobile possible');
assert(mobile.width <= 390 - 24, 'largeur bornee au viewport');

console.log('agilo-audio-sticky.test.mjs OK');
