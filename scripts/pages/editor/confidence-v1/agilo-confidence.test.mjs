/**
 * Tests unitaires — Confidence transcript V2 (segment-level)
 * Exécution : node scripts/pages/editor/confidence-v1/agilo-confidence.test.mjs
 *
 * Navigation : priorité UI low → verify → textModified (arbitrage plan client V2).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'agilo-confidence.js'), 'utf8');

function makeDom() {
  const elements = new Map();
  const mk = (id) => ({
    id,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }
    },
    style: {
      _m: new Map(),
      setProperty(k, v) { this._m.set(k, v); },
      removeProperty(k) { this._m.delete(k); }
    },
    dataset: {},
    textContent: '',
    innerHTML: '',
    children: [],
    nodeType: 1,
    isConnected: true,
    parentElement: null,
    nextElementSibling: null,
    setAttribute() {},
    removeAttribute() {},
    appendChild(child) { if (child) { child.parentElement = this; this.children.push(child); } },
    insertBefore(child, ref) {
      if (!child) return;
      child.parentElement = this;
      child.nextElementSibling = ref || null;
      this.children.push(child);
    },
    prepend() {},
    querySelectorAll(sel) {
      if (sel === '.ag-seg') return [];
      if (sel === '.ag-seg.is-confidence-nav-active') return [];
      return [];
    },
    querySelector() { return null; },
    addEventListener() {},
    remove() { this.isConnected = false; },
    getBoundingClientRect() { return { top: 0, bottom: 600, left: 24, width: 720 }; },
    scrollIntoView() {},
    closest(sel) {
      if (sel.includes('input') && this.tagName === 'INPUT') return this;
      if (sel.includes('button') && this.tagName === 'BUTTON') return this;
      if (sel.includes('[contenteditable="true"]') && this.contentEditable === 'true') return this;
      return null;
    }
  });

  return {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, mk(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    createElement(tag) {
      const el = mk(`el-${tag}-${Math.random()}`);
      el.tagName = String(tag || '').toUpperCase();
      if (tag === 'span' || tag === 'button' || tag === 'div') {
        el.querySelector = () => null;
        el.querySelectorAll = () => [];
      }
      return el;
    },
    head: { appendChild() {} },
    body: { appendChild() {} },
    readyState: 'complete',
    addEventListener() {}
  };
}

function boot(opts = {}) {
  const storage = new Map(Object.entries(opts.storage || {}));
  const window = {
    __agiloConfidence: false,
    AGILOTEXT_ENABLE_CONFIDENCE: opts.enableConfidence !== false,
    _segments: [],
    innerWidth: 1024,
    fetch: opts.fetch || (async () => ({ ok: false })),
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      }
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame(id) { clearTimeout(id); }
  };
  window.window = window;

  const sandbox = { window, document: makeDom() };
  vm.runInNewContext(src, sandbox);
  const api = sandbox.window.AgiloConfidence;
  api.__storage = storage;
  return api;
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; return; }
  failed++;
  console.error('FAIL:', msg);
}

async function run() {
  const AC = boot();

  const mainSegments = [
    { id: 's0', text: 'Bonjour à tous.' },
    { id: 's1', text: 'Le montant est quinze mille euros.' },
    { id: 's2', text: 'Merci.' }
  ];

  const confidenceAvailable = {
    status: 'OK',
    available: true,
    version: '2.0',
    jobId: 1001,
    summary: {
      globalScore: 0.92,
      totalSegments: 3,
      verifySegments: 1,
      lowSegments: 1,
      modifiedSegments: 1
    },
    segmentsConfidence: [
      { segmentId: 's0', segmentIndex: 0, score: 0.95, level: 'normal', wordCount: 3 },
      { segmentId: 's1', segmentIndex: 1, score: 0.52, level: 'low', wordCount: 6, textModified: true },
      { segmentId: 's2', segmentIndex: 2, score: 0.72, level: 'verify', wordCount: 1 }
    ]
  };

  assert(AC.isConfidenceEnabled() === true, 'feature flag actif par défaut');

  const empty = AC.reconcileConfidenceSegments(mainSegments, { available: false, segmentsConfidence: [] });
  assert(empty.size === 0, 'available:false => Map vide');

  const map = AC.reconcileConfidenceSegments(mainSegments, confidenceAvailable);
  assert(map.size === 3, '3 segments réconciliés');
  assert(map.get('s1')?.level === 'low', 's1 level low');
  assert(map.get('s1')?.textModified === true, 's1 textModified');
  assert(AC.badgeLabel('low', false, 'pending') === 'Prioritaire', 'low => Prioritaire');
  assert(!AC.badgeLabel('low', false, 'pending').includes('Faible confiance'), 'label visible sans Faible confiance');
  assert(AC.badgeLabel('verify', false, 'pending') === 'À relire', 'verify => À relire');
  assert(AC.badgeLabel('normal', true, 'pending') === 'Modifié depuis transcription', 'normal modifié => libellé modifié');
  assert(AC.badgeLabel('low', false, 'verified') === 'Relu', 'état relu prioritaire sur risk label');

  const badId = AC.reconcileConfidenceSegments(mainSegments, {
    available: true,
    segmentsConfidence: [{ segmentId: 'missing', segmentIndex: 1, score: 0.5, level: 'low' }]
  });
  assert(badId.size === 0, 'segmentId introuvable ignoré');

  const byIndex = AC.reconcileConfidenceSegments(mainSegments, {
    available: true,
    segmentsConfidence: [{ segmentIndex: 2, score: 0.8, level: 'verify', wordCount: 1 }]
  });
  assert(byIndex.size === 1, 'fallback segmentIndex OK');
  assert(byIndex.has('s2'), 'fallback résolu en s2');

  const badScore = AC.reconcileConfidenceSegments(mainSegments, {
    available: true,
    segmentsConfidence: [{ segmentId: 's0', score: 1.5, level: 'low' }]
  });
  assert(badScore.size === 0, 'score invalide ignoré');

  const badLevel = AC.reconcileConfidenceSegments(mainSegments, {
    available: true,
    segmentsConfidence: [{ segmentId: 's0', score: 0.5, level: 'unknown' }]
  });
  assert(badLevel.size === 0, 'level inconnu ignoré');

  assert(confidenceAvailable.summary.globalScore === 0.92, 'summary.globalScore présent');

  const fallback = AC.computeSummaryFallback(confidenceAvailable.segmentsConfidence, 0);
  assert(fallback && Math.round(fallback.globalScore * 100) > 0, 'fallback globalScore calculé');
  const weighted = (0.95 * 3 + 0.52 * 6 + 0.72 * 1) / (3 + 6 + 1);
  assert(Math.abs(fallback.globalScore - weighted) < 0.001, 'fallback pondéré wordCount');
  assert(AC.panelMainLabel({ verifySegments: 16, lowSegments: 2 }) === '18 passages à relire · 2 prioritaires', 'panneau: compteurs avant score');
  assert(AC.panelMainLabel({ verifySegments: 1, lowSegments: 0 }) === '1 passage à relire', 'panneau: pas de zéro prioritaire inutile');
  assert(AC.panelMainLabel({ verifySegments: 0, lowSegments: 0 }) === 'Aucun passage signalé à relire', 'panneau: état zéro passage');
  assert(AC.panelMainLabel({ verifySegments: 0, lowSegments: 0 }, { verifySegments: 1, lowSegments: 0 }) === 'Tous les passages signalés sont traités', 'panneau: passages traités après revue');
  assert(AC.qualityLabel({ globalScore: 0.96 }) === 'Qualité estimée : 96%', 'panneau: qualité estimée secondaire');

  const nav = AC.buildNavigationOrder(map);
  assert(nav[0] === 's1', 'navigation: low en premier (priorité UI)');
  assert(nav.includes('s2'), 'navigation: verify inclus');
  assert(typeof AC.goToPreviousConfidenceZone === 'function', 'navigation précédente exposée');
  assert(AC.isConfidenceShortcutEvent({ altKey: true, key: 'ArrowRight' }) === true, 'Alt+ArrowRight reconnu');
  assert(AC.isConfidenceShortcutEvent({ altKey: true, key: 'ArrowLeft' }) === true, 'Alt+ArrowLeft reconnu');
  assert(AC.isConfidenceShortcutEvent({ altKey: false, key: 'ArrowRight' }) === false, 'ArrowRight seul ignoré');
  assert(AC.isConfidenceShortcutEvent({ altKey: true, ctrlKey: true, key: 'ArrowRight' }) === false, 'Ctrl+Alt+Arrow ignoré');

  const inputEl = { nodeType: 1, tagName: 'INPUT', closest: (sel) => sel.includes('input') ? inputEl : null };
  const textEl = { nodeType: 1, contentEditable: 'true', closest: (sel) => sel.includes('[contenteditable="true"]') ? textEl : null };
  const plainEl = { nodeType: 1, closest: () => null };
  assert(AC.isEditableShortcutTarget(inputEl) === true, 'raccourci ignoré dans input');
  assert(AC.isEditableShortcutTarget(textEl) === true, 'raccourci ignoré dans contenteditable');
  assert(AC.isEditableShortcutTarget(plainEl) === false, 'raccourci autorisé hors édition');

  assert(AC.shouldShowHelper({ verifySegments: 1, lowSegments: 0 }) === true, 'helper visible si passages à relire et jamais vu');
  assert(AC.shouldShowHelper({ verifySegments: 0, lowSegments: 0 }) === false, 'helper absent sans passage à relire');
  AC.dismissHelper();
  assert(AC.__storage.get('agilo:confidence-helper-seen:v1') === 'true', 'Compris persiste helper vu');
  assert(AC.shouldShowHelper({ verifySegments: 1, lowSegments: 0 }) === false, 'helper absent après Compris');

  const ACHelperSeen = boot({ storage: { 'agilo:confidence-helper-seen:v1': 'true' } });
  assert(ACHelperSeen.shouldShowHelper({ verifySegments: 1, lowSegments: 0 }) === false, 'helper absent si localStorage helper vu');

  const ACVisibleOff = boot({ storage: { 'agilo:confidence-visible:v1': 'false' } });
  assert(ACVisibleOff.readConfidenceVisiblePreference() === false, 'préférence OFF lue depuis localStorage');
  assert(ACVisibleOff.shouldShowHelper({ verifySegments: 1, lowSegments: 0 }) === false, 'helper absent si zones désactivées');
  ACVisibleOff.toggle(true, true);
  assert(ACVisibleOff.__storage.get('agilo:confidence-visible:v1') === 'true', 'préférence ON persistée');
  ACVisibleOff.toggle(false, true);
  assert(ACVisibleOff.__storage.get('agilo:confidence-visible:v1') === 'false', 'préférence OFF persistée');

  const textWithIssue = 'S’est passé climatisé. ASH.';
  const lowWordStart = textWithIssue.indexOf('climatisé');
  const itemWithIssues = {
    segmentId: 's1',
    score: 0.52,
    level: 'low',
    issues: [
      {
        text: 'climatisé',
        score: 0.6,
        level: 'low',
        startChar: lowWordStart,
        endChar: lowWordStart + 'climatisé'.length,
        startTime: 20,
        endTime: 21,
        wordIndex: 2
      }
    ],
    originalTextHash: AC.textHash(textWithIssue)
  };
  assert(AC.areIssuesCompatible(itemWithIssues, textWithIssue) === true, 'issues[] compatibles avec texte original');
  assert(AC.normalizeWordIssues(itemWithIssues, textWithIssue, false).length === 1, 'highlight mot-à-mot possible si compatible');
  assert(AC.normalizeWordIssues({ ...itemWithIssues, originalTextHash: 'bad-hash' }, textWithIssue, false).length === 0, 'highlight supprimé si hash incompatible');
  assert(AC.normalizeWordIssues(itemWithIssues, textWithIssue.replace('climatisé', 'chauffé'), false).length === 0, 'highlight supprimé si texte incompatible');
  assert(AC.normalizeWordIssues(itemWithIssues, textWithIssue, true).length === 0, 'highlight supprimé si segment modifié');

  const fallbackSegmentOnly = AC.reconcileConfidenceSegments(mainSegments, {
    available: true,
    segmentsConfidence: [{ segmentId: 's1', score: 0.52, level: 'low', wordCount: 6 }]
  });
  assert(fallbackSegmentOnly.size === 1 && !fallbackSegmentOnly.get('s1')?.issues, 'fallback segment-level si issues[] absent');

  const dom = makeDom();
  const root = dom.createElement('div');
  root.id = 'transcriptEditor';
  dom.getElementById = (id) => (id === 'transcriptEditor' ? root : null);

  const mismatch = await AC.applyConfidenceData({
    jobId: '1001',
    confidenceJson: { ...confidenceAvailable, jobId: 9999 },
    mainSegments,
    transcriptRoot: root
  });
  assert(mismatch.applied === false && mismatch.reason === 'jobId_mismatch', 'jobId mismatch ignoré');

  let fetchCalled = false;
  const ACOff = boot({
    enableConfidence: false,
    fetch: async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; }
  });
  const offResult = await ACOff.fetchConfidenceJson('https://api.test/v1', { username: 'a', token: 'b' }, '1');
  assert(offResult === null && fetchCalled === false, 'flag false: pas d appel fetch');

  assert(typeof AC.markSegmentModified === 'function', 'markSegmentModified exposé');
  AC.markSegmentModified(0);

  assert(typeof AC.toggle === 'function', 'toggle exposé');
  assert(typeof AC.reload === 'function', 'reload exposé');
  assert(typeof AC.clear === 'function', 'clear exposé');

  console.log(`\nRésultat : ${passed} ok, ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
