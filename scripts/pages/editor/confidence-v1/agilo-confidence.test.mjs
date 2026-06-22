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
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    children: [],
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    insertBefore() {},
    prepend() {},
    querySelectorAll(sel) {
      if (sel === '.ag-seg') return [];
      if (sel === '.ag-seg.is-confidence-nav-active') return [];
      return [];
    },
    querySelector() { return null; },
    addEventListener() {},
    remove() {},
    parentElement: { insertBefore() {} },
    scrollIntoView() {}
  });

  return {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, mk(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    createElement(tag) {
      const el = mk(`el-${tag}-${Math.random()}`);
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
  const window = {
    __agiloConfidence: false,
    AGILOTEXT_ENABLE_CONFIDENCE: opts.enableConfidence !== false,
    _segments: [],
    fetch: opts.fetch || (async () => ({ ok: false })),
    addEventListener() {}
  };
  window.window = window;

  const sandbox = { window, document: makeDom() };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.AgiloConfidence;
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
  assert(AC.badgeLabel('low', false, 'pending') === 'À vérifier en priorité', 'low => À vérifier en priorité');
  assert(!AC.badgeLabel('low', false, 'pending').includes('Faible confiance'), 'label visible sans Faible confiance');
  assert(AC.badgeLabel('verify', false, 'pending') === 'À vérifier', 'verify => À vérifier');
  assert(AC.badgeLabel('normal', true, 'pending') === 'Modifié depuis transcription', 'normal modifié => libellé modifié');
  assert(AC.badgeLabel('low', false, 'verified') === 'Vérifié', 'état vérifié prioritaire sur risk label');

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

  const nav = AC.buildNavigationOrder(map);
  assert(nav[0] === 's1', 'navigation: low en premier (priorité UI)');
  assert(nav.includes('s2'), 'navigation: verify inclus');

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
