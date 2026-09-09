/**
 * Tests unitaires — pin-host in-flow, sans verrou html
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
assert(typeof AS.applyShellFit === 'function', 'applyShellFit exposé');
assert(typeof AS.getShellFitState === 'function', 'getShellFitState exposé');
assert(AS.FIT_CLASS === 'ag-editor-shell-fit', 'FIT_CLASS');
assert(typeof AS.computeEditorShellLock !== 'function', 'computeEditorShellLock retiré');
assert(typeof AS.applyIoHysteresis === 'function', 'applyIoHysteresis exposé');
assert(typeof AS.placePinHost === 'function', 'placePinHost exposé');
assert(typeof AS.placeAudioRow === 'function', 'placeAudioRow exposé');
assert(AS.ROW_ID === 'ag-editor-audio-row', 'ROW_ID');
assert(AS.PIN_HOST_ID === 'ag-editor-pin-host', 'PIN_HOST_ID');
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

assert(!src.includes('position:sticky'), 'CSS sans position:sticky');
assert(!src.includes('position:fixed'), 'CSS sans position:fixed');
assert(!src.includes('z-index:26'), 'pas de z-index overlay 26');
assert(!src.includes('ag-editor-shell-lock'), 'pas de classe lock html');
assert(src.includes('html.ag-editor-shell-fit .ed-body{height:100dvh;max-height:100dvh;min-height:0}'), 'fit: ed-body 100dvh');
assert(src.includes('html.ag-editor-shell-fit main.ed-main{height:100%;min-height:0;display:flex;'), 'fit: ed-main flex column');
assert(src.includes('html.ag-editor-shell-fit main.ed-main > .edtr-pane{flex:1 1 auto;min-height:0;overflow:auto}'), 'fit: pane overflow auto');
assert(src.includes('html.ag-editor-shell-fit .ed-body > *:not(main){max-height:100%;min-height:0;overflow:auto}'), 'fit: colonnes latérales bornées');
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

function makeNode(id, className) {
  const node = {
    id: id || '',
    className: className || '',
    parentNode: null,
    nextElementSibling: null,
    firstChild: null,
    children: [],
    insertBefore(child, ref) {
      if (child.parentNode && child.parentNode !== this) {
        const prevKids = child.parentNode.children;
        const idx = prevKids.indexOf(child);
        if (idx >= 0) prevKids.splice(idx, 1);
        child.parentNode = null;
      }
      child.parentNode = this;
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i >= 0) this.children.splice(i, 0, child);
      else this.children.push(child);
      this.firstChild = this.children[0] || null;
      this.children.forEach((c, k) => {
        c.nextElementSibling = this.children[k + 1] || null;
      });
    },
    appendChild(child) { this.insertBefore(child, null); },
    querySelector(sel) {
      if (sel === '.edtr-pane') return this.children.find((c) => c.className.includes('edtr-pane')) || null;
      return null;
    }
  };
  return node;
}

const main = makeNode('', 'ed-main');
const tabs = makeNode('', 'ed-tabs');
const toolbar = makeNode('', 'ed-toolbar');
const pane = makeNode('pane-transcript', 'edtr-pane is-active');
const summary = makeNode('pane-summary', 'edtr-pane');
main.insertBefore(tabs, null);
main.insertBefore(toolbar, null);
main.insertBefore(pane, null);
main.insertBefore(summary, null);

const pin = makeNode('ag-editor-pin-host', 'ag-editor-pin-host');
const row = makeNode('ag-editor-audio-row', 'ag-editor-audio-row');
const doc = {
  querySelector(sel) {
    if (sel === 'main.ed-main') return main;
    return null;
  },
  getElementById(id) {
    if (id === 'pane-transcript') return pane;
    if (id === 'ag-editor-pin-host') return pin.parentNode ? pin : null;
    return null;
  }
};

assert(AS.placeAudioRow(row, doc) === false, 'placeAudioRow refuse sans pin-host');
assert(AS.placePinHost(pin, doc) === true, 'placePinHost ancre dans ed-main');
assert(pin.parentNode === main, 'pin-host enfant de main.ed-main');
assert(pin.nextElementSibling === pane, 'pin-host avant le premier .edtr-pane');
assert(main.children.indexOf(pin) === 2, 'pin-host après onglets et toolbar');
assert(AS.placeAudioRow(row, doc) === true, 'placeAudioRow ancre dans pin-host');
assert(row.parentNode === pin, 'ligne enfant du pin-host');
assert(pin.firstChild === row, 'ligne dans le pin-host');
assert(AS.placePinHost(pin, doc) === true, 'placePinHost idempotent');
assert(AS.placeAudioRow(row, doc) === true, 'placeAudioRow idempotent');
assert(main.children.filter((c) => c.id === 'ag-editor-pin-host').length === 1, 'un seul pin-host');
assert(pin.children.filter((c) => c.id === 'ag-editor-audio-row').length === 1, 'une seule ligne');

const fallbackPane = makeNode('pane-transcript', 'edtr-pane');
const fallbackSeg = makeNode('', 'ag-seg');
fallbackPane.insertBefore(fallbackSeg, null);
const fallbackPin = makeNode('ag-editor-pin-host', 'ag-editor-pin-host');
const fallbackRow = makeNode('ag-editor-audio-row', 'ag-editor-audio-row');
const fallbackDoc = {
  querySelector() { return null; },
  getElementById(id) {
    if (id === 'pane-transcript') return fallbackPane;
    if (id === 'ag-editor-pin-host') return fallbackPin.parentNode ? fallbackPin : null;
    return null;
  }
};
assert(AS.placePinHost(fallbackPin, fallbackDoc) === true, 'repli pin-host pane-transcript');
assert(fallbackPin.parentNode === fallbackPane, 'repli: pin-host dans le pane');
assert(fallbackPane.firstChild === fallbackPin, 'repli: pin-host premier enfant du pane');
assert(AS.placeAudioRow(fallbackRow, fallbackDoc) === true, 'repli: ligne dans pin-host');
assert(fallbackRow.parentNode === fallbackPin, 'repli: ligne dans le pin-host');

assert(AS.applyIoHysteresis(true, { isIntersecting: false, intersectionRatio: 0 }) === false, 'IO: hors ecran → fermer hystérésis');
assert(AS.applyIoHysteresis(false, { isIntersecting: true, intersectionRatio: 0.5 }) === true, 'IO: ratio haut → player visible');
assert(AS.applyIoHysteresis(false, { isIntersecting: true, intersectionRatio: 0.02 }) === false, 'IO: ratio trop bas garde l état précédent');
assert(AS.applyIoHysteresis(true, { isIntersecting: true, intersectionRatio: 0.02 }) === true, 'IO: petite intersection ne flicker pas');

const fitRoot = {
  classList: {
    _s: new Set(),
    add(c) { this._s.add(c); },
    contains(c) { return this._s.has(c); }
  }
};
assert(AS.applyShellFit(fitRoot) === true, 'applyShellFit pose la classe');
assert(fitRoot.classList.contains('ag-editor-shell-fit') === true, 'html reçoit ag-editor-shell-fit');
assert(AS.applyShellFit(fitRoot) === true, 'applyShellFit idempotent');

const fitDoc = {
  documentElement: fitRoot,
  scrollingElement: { scrollTop: 80 },
  querySelector(sel) {
    if (sel === '.ed-body') {
      return { getBoundingClientRect() { return { height: 700, top: 12 }; } };
    }
    if (sel === 'main.ed-main') {
      return { getBoundingClientRect() { return { height: 688, top: 24 }; } };
    }
    return null;
  }
};
const probe = AS.getShellFitState(fitDoc);
assert(probe.fitClass === true, 'sonde: fitClass true');
assert(probe.edBodyHeight === 700, 'sonde: hauteur ed-body');
assert(probe.edBodyTop === 12, 'sonde: top ed-body');
assert(probe.mainTop === 24, 'sonde: top main.ed-main');
assert(probe.documentScrollTop === 80, 'sonde: scroll résiduel document');

console.log('agilo-audio-sticky.test.mjs OK');
