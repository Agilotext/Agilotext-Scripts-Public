/**
 * Tests — garde popup empreinte vs tour Driver.js
 * Exécution : node scripts/shared/agilo-voice-popup-tour-guard.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-voice-popup-tour-guard.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = { window: {}, globalThis: null };
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);

const G = sandbox.window.AgiloVoicePopupGuard;
assert(G, 'AgiloVoicePopupGuard exposé');
assert(G.GRACE_MS === 2500, 'grâce 2,5 s');
assert(G.DEBOUNCE_MS === 400, 'debounce 400 ms');

function fakeDoc(opts) {
  opts = opts || {};
  const overlay = opts.overlay === false ? null : (opts.overlay || null);
  const popover = opts.popover === false ? null : (opts.popover || null);
  return {
    querySelector: function (sel) {
      if (sel === '.driver-overlay') return overlay;
      if (sel === '.driver-popover') return popover;
      return null;
    },
    defaultView: opts.defaultView || null
  };
}

// 1. Pas d’overlay
assert(G.isTourBlocking(fakeDoc({ overlay: null, popover: null })) === false, 'pas d overlay');
assert(
  G.shouldHoldVoicePopup({
    blocking: false,
    pendingFirstTour: false,
    firstSeen: true,
    seenOverlayThisVisit: false,
    waitedMs: 3000,
    idleMs: 1000
  }) === false,
  'returning user sans overlay'
);

// 2. Overlay présent
const overlayEl = { style: {} };
assert(G.isTourBlocking(fakeDoc({ overlay: overlayEl, popover: null })) === true, 'overlay bloque');
assert(
  G.shouldHoldVoicePopup({ blocking: true, firstSeen: true, waitedMs: 8000, idleMs: 0 }) === true,
  'blocking = hold'
);

const hiddenOverlay = { style: { display: 'none' } };
assert(
  G.isTourBlocking(fakeDoc({ overlay: hiddenOverlay, popover: null })) === false,
  'overlay display none'
);

// 3. Grâce première visite
assert(
  G.shouldHoldVoicePopup({
    blocking: false,
    pendingFirstTour: true,
    firstSeen: false,
    seenOverlayThisVisit: false,
    waitedMs: 1000,
    idleMs: 1000
  }) === true,
  'grâce pending first tour'
);
assert(
  G.shouldHoldVoicePopup({
    blocking: false,
    pendingFirstTour: false,
    firstSeen: false,
    seenOverlayThisVisit: false,
    waitedMs: 1000,
    idleMs: 1000
  }) === true,
  'grâce first_seen absent'
);

// 4. Overlay parti + debounce
assert(
  G.shouldHoldVoicePopup({
    blocking: false,
    pendingFirstTour: false,
    firstSeen: true,
    seenOverlayThisVisit: true,
    waitedMs: 8000,
    idleMs: 100
  }) === true,
  'debounce overlay parti'
);
assert(
  G.shouldHoldVoicePopup({
    blocking: false,
    pendingFirstTour: false,
    firstSeen: true,
    seenOverlayThisVisit: true,
    waitedMs: 8000,
    idleMs: 400
  }) === false,
  'debounce écoulé'
);

// 5. Driver jamais monté après grâce
assert(
  G.shouldHoldVoicePopup({
    blocking: false,
    pendingFirstTour: true,
    firstSeen: false,
    seenOverlayThisVisit: false,
    waitedMs: 2500,
    idleMs: 2500
  }) === false,
  'grâce écoulée sans overlay'
);

console.log('agilo-voice-popup-tour-guard.test.mjs OK');
