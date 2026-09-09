/**
 * Tests unitaires — dock chrome (panel + audio) dans le transcript
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
assert(AS && typeof AS.computeAudioRowState === 'function', 'computeAudioRowState exposé');
assert(typeof AS.applyShellFit !== 'function', 'applyShellFit retiré');
assert(typeof AS.getShellFitState !== 'function', 'getShellFitState retiré');
assert(AS.FIT_CLASS === undefined, 'FIT_CLASS retiré');
assert(typeof AS.computeEditorShellLock !== 'function', 'computeEditorShellLock retiré');
assert(typeof AS.applyIoHysteresis === 'function', 'applyIoHysteresis exposé');
assert(typeof AS.placePinHost !== 'function', 'placePinHost retiré');
assert(typeof AS.placeChromeDock === 'function', 'placeChromeDock exposé');
assert(typeof AS.placeAudioRow === 'function', 'placeAudioRow exposé');
assert(typeof AS.getEditorChromeBottom === 'function', 'getEditorChromeBottom exposé');
assert(typeof AS.resolveConfidenceChromeBottom === 'function', 'resolveConfidenceChromeBottom exposé');
assert(typeof AS.computeChromeDockFloatingBox === 'function', 'computeChromeDockFloatingBox exposé');
assert(typeof AS.getChromeDockState === 'function', 'getChromeDockState exposé');
assert(AS.ROW_ID === 'ag-editor-audio-row', 'ROW_ID');
assert(AS.DOCK_ID === 'ag-editor-chrome-dock', 'DOCK_ID');
assert(AS.PIN_HOST_ID === undefined, 'PIN_HOST_ID retiré');
assert(AS.LOCK_CLASS === undefined, 'LOCK_CLASS retiré');
assert(AS.IO_SHOW_RATIO === 0.12, 'hystérésis ratio');
assert(typeof AS.getEditorChromeTop !== 'function', 'getEditorChromeTop retiré');
assert(typeof AS.computeAudioSlotState !== 'function', 'computeAudioSlotState retiré');

const visible = AS.computeAudioRowState({
  wrapIntersecting: true,
  audioUnavailable: false
});
assert(visible.shouldShow === false, 'ligne fermée si le player intersecte le viewport');

const hidden = AS.computeAudioRowState({
  wrapIntersecting: false,
  audioUnavailable: false
});
assert(hidden.shouldShow === true, 'ligne ouverte si player hors ecran');

const expired = AS.computeAudioRowState({
  wrapIntersecting: false,
  audioUnavailable: true
});
assert(expired.shouldShow === false, 'ligne fermée si audio indisponible');

assert(src.includes('position:sticky'), 'CSS sticky nominal');
assert(src.includes('.ag-editor-chrome-dock.is-floating{position:fixed;'), 'fixed seulement avec is-floating');
assert((src.match(/position:fixed/g) || []).length === 1, 'un seul position:fixed');
assert(!src.includes('z-index:26'), 'pas de z-index overlay 26');
assert(!src.includes('z-index:9999'), 'pas de z-index 9999');
assert(src.includes('z-index:25'), 'z-index 25 sous les menus');
assert(!src.includes('html.ag-editor-shell-lock'), 'pas de lock html actif');
assert(!src.includes('ag-editor-shell-fit .ed-body'), 'pas de fit 100dvh');
assert(!src.includes('.ed-body > *:not(main)'), 'pas de borne sidebar');
assert(!src.includes('html.ag-editor-shell-fit,html.ag-editor-shell-fit body{overflow:hidden'), 'pas de overflow hidden sur html/body');
assert(!src.includes('html{overflow:hidden'), 'pas de overflow hidden sur le sélecteur html seul');
assert(!src.includes('.page-wrapper'), 'pas d override page-wrapper');
assert(!src.includes('top:var(--ag-editor-chrome-top'), 'pas de top chrome sticky');
assert(!/setProperty\([^)]*--ag-editor-chrome-top/.test(src), 'ne pose plus --ag-editor-chrome-top');
assert(src.includes("setAttribute('inert'"), 'inert sur le wrap original quand proxy actif');
assert(src.includes('.ag-editor-audio-row{display:none'), 'ligne fermée invisible');
assert(src.includes('.ag-editor-audio-row.is-open{display:block'), 'ligne ouverte visible');
assert(src.includes('agilo-audio-sticky__ico'), 'icônes mobile 15s/30s');
assert(src.includes('prefers-reduced-motion'), 'reduced-motion');
assert(src.includes("setWrapInert(true)"), 'inert posé à l ouverture seulement');
assert(src.includes("setWrapInert(false)"), 'inert retiré à la fermeture');
assert(src.includes("addEventListener('agilo:load'"), 'recalcul IO sur agilo:load');
assert(!src.includes('lockShell'), 'lockShell retiré');
assert(!src.includes('unlockShell'), 'unlockShell retiré');
assert(!src.includes('is-fallback-fixed'), 'filet fixed retiré');
assert(!src.includes('bindUnlockGestures'), 'gestes unlock retirés');
assert(!src.includes('ag-editor-pin-host') || src.includes("LEGACY_PIN_ID = 'ag-editor-pin-host'"), 'pin-host seulement en nettoyage legacy');

function makeNode(id, className) {
  const node = {
    id: id || '',
    className: className || '',
    parentNode: null,
    nextElementSibling: null,
    previousElementSibling: null,
    firstChild: null,
    children: [],
    isConnected: false,
    classList: {
      contains(c) { return String(node.className || '').split(/\s+/).includes(c); }
    },
    getBoundingClientRect() { return { top: 40, bottom: 80, left: 24, width: 720, height: 40 }; },
    insertBefore(child, ref) {
      if (child.parentNode && child.parentNode !== this) {
        const prevKids = child.parentNode.children;
        const idx = prevKids.indexOf(child);
        if (idx >= 0) prevKids.splice(idx, 1);
        child.parentNode = null;
      }
      child.parentNode = this;
      child.isConnected = true;
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i >= 0) this.children.splice(i, 0, child);
      else this.children.push(child);
      this.firstChild = this.children[0] || null;
      this.children.forEach((c, k) => {
        c.nextElementSibling = this.children[k + 1] || null;
        c.previousElementSibling = this.children[k - 1] || null;
      });
    },
    appendChild(child) { this.insertBefore(child, null); },
    querySelector() { return null; }
  };
  return node;
}

const pane = makeNode('pane-transcript', 'edtr-pane is-active');
const editor = makeNode('transcriptEditor', '');
pane.insertBefore(editor, null);

const dock = makeNode('ag-editor-chrome-dock', 'ag-editor-chrome-dock');
const row = makeNode('ag-editor-audio-row', 'ag-editor-audio-row');
const doc = {
  querySelector() { return null; },
  getElementById(id) {
    if (id === 'pane-transcript') return pane;
    if (id === 'transcriptEditor') return editor;
    if (id === 'ag-editor-chrome-dock') return dock.parentNode ? dock : null;
    return null;
  }
};

assert(AS.placeAudioRow(row, doc) === false, 'placeAudioRow refuse sans dock');
assert(AS.placeChromeDock(dock, doc) === true, 'placeChromeDock ancre dans pane-transcript');
assert(dock.parentNode === pane, 'dock enfant de #pane-transcript');
assert(dock.nextElementSibling === editor, 'dock avant #transcriptEditor');
assert(pane.children.indexOf(dock) === 0, 'dock premier enfant du pane');
assert(AS.placeAudioRow(row, doc) === true, 'placeAudioRow ancre dans le dock');
assert(row.parentNode === dock, 'ligne enfant du dock');
assert(AS.placeChromeDock(dock, doc) === true, 'placeChromeDock idempotent');
assert(AS.placeAudioRow(row, doc) === true, 'placeAudioRow idempotent');
assert(pane.children.filter((c) => c.id === 'ag-editor-chrome-dock').length === 1, 'un seul dock');
assert(dock.children.filter((c) => c.id === 'ag-editor-audio-row').length === 1, 'une seule ligne');

const fallbackPane = makeNode('pane-transcript', 'edtr-pane');
const fallbackSeg = makeNode('', 'ag-seg');
fallbackPane.insertBefore(fallbackSeg, null);
const fallbackDock = makeNode('ag-editor-chrome-dock', 'ag-editor-chrome-dock');
const fallbackRow = makeNode('ag-editor-audio-row', 'ag-editor-audio-row');
const fallbackDoc = {
  querySelector() { return null; },
  getElementById(id) {
    if (id === 'pane-transcript') return fallbackPane;
    if (id === 'ag-editor-chrome-dock') return fallbackDock.parentNode ? fallbackDock : null;
    return null;
  }
};
assert(AS.placeChromeDock(fallbackDock, fallbackDoc) === true, 'repli dock pane-transcript sans editor');
assert(fallbackDock.parentNode === fallbackPane, 'repli: dock dans le pane');
assert(fallbackPane.firstChild === fallbackDock, 'repli: dock premier enfant du pane');
assert(AS.placeAudioRow(fallbackRow, fallbackDoc) === true, 'repli: ligne dans dock');
assert(fallbackRow.parentNode === fallbackDock, 'repli: ligne dans le dock');

assert(AS.applyIoHysteresis(true, { isIntersecting: false, intersectionRatio: 0 }) === false, 'IO: hors ecran → fermer hystérésis');
assert(AS.applyIoHysteresis(false, { isIntersecting: true, intersectionRatio: 0.5 }) === true, 'IO: ratio haut → player visible');
assert(AS.applyIoHysteresis(false, { isIntersecting: true, intersectionRatio: 0.02 }) === false, 'IO: ratio trop bas garde l état précédent');
assert(AS.applyIoHysteresis(true, { isIntersecting: true, intersectionRatio: 0.02 }) === true, 'IO: petite intersection ne flicker pas');

const chromeBottom = 120;
const floatCoveringTabs = AS.computeChromeDockFloatingBox(
  { top: 4 },
  { left: 320, width: 960, bottom: 800 },
  chromeBottom,
  1440
);
assert(floatCoveringTabs.shouldFloat === true, 'float actif quand sentinel sous chrome');
assert(floatCoveringTabs.top === chromeBottom + 8, 'top flottant = chromeBottom + 8');

const noFloat = AS.computeChromeDockFloatingBox(
  { top: 200 },
  { left: 320, width: 960, bottom: 800 },
  chromeBottom,
  1440
);
assert(noFloat.shouldFloat === false, 'pas de float si sentinel encore visible sous chrome');

const mobileFloat = AS.computeChromeDockFloatingBox(
  { top: 0 },
  { left: 8, width: 360, bottom: 640 },
  96,
  390
);
assert(mobileFloat.shouldFloat === true, 'float mobile possible');
assert(mobileFloat.width <= 390 - 24, 'largeur flottante bornee au viewport');
assert(mobileFloat.top >= 96 + 8, 'top mobile sous chrome');

const probeDoc = {
  querySelector(sel) {
    if (sel === 'nav.ed-tabs') {
      return { getBoundingClientRect() { return { bottom: 110, height: 40 }; } };
    }
    return null;
  },
  getElementById(id) {
    if (id === 'ag-editor-chrome-dock') {
      return {
        isConnected: true,
        classList: { contains(c) { return c === 'is-floating'; } },
        previousElementSibling: {
          className: 'ag-editor-chrome-dock-sentinel',
          getBoundingClientRect() { return { top: 12 }; }
        }
      };
    }
    return null;
  }
};
const probe = AS.getChromeDockState(probeDoc);
assert(probe.dockConnected === true, 'sonde: dock connecté');
assert(probe.isFloating === true, 'sonde: is-floating');
assert(probe.chromeBottom === 110, 'sonde: chromeBottom onglets');
assert(probe.sentinelTop === 12, 'sonde: sentinelTop');

console.log('agilo-audio-sticky.test.mjs OK');
