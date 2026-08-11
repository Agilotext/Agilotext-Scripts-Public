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
  assert(typeof AC.buildNavControlsHtml === 'function', 'buildNavControlsHtml exposée');
  const navHtml = AC.buildNavControlsHtml(true);
  assert(navHtml.includes('id="ag-confidence-prev"'), 'nav HTML: bouton précédent');
  assert(navHtml.includes('id="ag-confidence-next"'), 'nav HTML: bouton suivant');
  assert(navHtml.includes('id="ag-confidence-nav-count"'), 'nav HTML: compteur Passage X / N');
  assert(navHtml.includes('Passage précédent'), 'nav HTML: libellé Passage précédent');
  assert(navHtml.includes('aria-keyshortcuts="Alt+ArrowLeft"'), 'nav HTML: raccourci précédent');
  assert(navHtml.includes('aria-keyshortcuts="Alt+ArrowRight"'), 'nav HTML: raccourci suivant');
  assert(navHtml.indexOf('ag-confidence-prev') < navHtml.indexOf('ag-confidence-next'), 'nav HTML: précédent avant suivant');
  assert(AC.buildNavControlsHtml(false) === '', 'nav HTML: vide sans passages à relire');
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

  // --- Non-régression : panneau flottant sous les onglets (bug 1.09.2) ---
  assert(typeof AC.computeConfidenceFloatingBox === 'function', 'computeConfidenceFloatingBox exposé');
  assert(typeof AC.getEditorChromeBottom === 'function', 'getEditorChromeBottom exposé');
  assert(typeof AC.ensureActiveEditorPane === 'function', 'ensureActiveEditorPane exposé');

  const chromeBottom = 120;
  const floatCoveringTabs = AC.computeConfidenceFloatingBox(
    { top: 4 },
    { left: 320, width: 960, bottom: 800 },
    chromeBottom,
    1440
  );
  assert(floatCoveringTabs.shouldFloat === true, 'float actif quand sentinel sous chrome');
  assert(floatCoveringTabs.top >= chromeBottom + 8, 'top flottant sous la barre d onglets');
  assert(floatCoveringTabs.top > 10, 'top flottant ne reste pas a 10px viewport');

  const noFloat = AC.computeConfidenceFloatingBox(
    { top: 200 },
    { left: 320, width: 960, bottom: 800 },
    chromeBottom,
    1440
  );
  assert(noFloat.shouldFloat === false, 'pas de float si sentinel encore visible sous chrome');

  const mobileFloat = AC.computeConfidenceFloatingBox(
    { top: 0 },
    { left: 8, width: 360, bottom: 640 },
    96,
    390
  );
  assert(mobileFloat.shouldFloat === true, 'float mobile possible');
  assert(mobileFloat.width <= 390 - 24, 'largeur flottante bornee au viewport');
  assert(mobileFloat.top >= 96 + 8, 'top mobile sous chrome');

  const noFloatZeroChrome = AC.computeConfidenceFloatingBox(
    { top: 0 },
    { left: 320, width: 960, bottom: 800 },
    0,
    1440
  );
  assert(noFloatZeroChrome.shouldFloat === false, 'pas de float si chromeBottom vaut 0');

  const noFloatNegativeChrome = AC.computeConfidenceFloatingBox(
    { top: 0 },
    { left: 320, width: 960, bottom: 800 },
    -12,
    1440
  );
  assert(noFloatNegativeChrome.shouldFloat === false, 'pas de float si chromeBottom negatif');

  assert(floatCoveringTabs.top === chromeBottom + 8, 'top flottant = chromeBottom + 8 sans plancher 10px');

  const cssSrc = readFileSync(path.join(__dirname, 'agilo-confidence.css.js'), 'utf8');
  assert(!cssSrc.includes('main.ed-main > .ed-tabs'), 'CSS sans regle z-index sur ed-tabs');
  assert(!cssSrc.includes('main.ed-main > nav.ed-tabs'), 'CSS sans regle z-index sur nav.ed-tabs');
  assert(!cssSrc.includes('main.ed-main > .ed-toolbar'), 'CSS sans regle z-index sur ed-toolbar');

  // --- Invariant multi-panneaux : toggle ne doit pas tout masquer ---
  function makeEditorDom() {
    const mk = (tag, props = {}) => {
      const el = {
        tagName: String(tag).toUpperCase(),
        id: props.id || '',
        className: props.className || '',
        classList: {
          _s: new Set(String(props.className || '').split(/\s+/).filter(Boolean)),
          add(c) { this._s.add(c); el.className = [...this._s].join(' '); },
          remove(c) { this._s.delete(c); el.className = [...this._s].join(' '); },
          contains(c) { return this._s.has(c); },
          toggle(c, v) {
            if (v) this.add(c);
            else this.remove(c);
          }
        },
        dataset: { ...(props.dataset || {}) },
        attrs: { ...(props.attrs || {}) },
        children: [],
        parentElement: null,
        style: { _m: new Map(), setProperty(k, v) { this._m.set(k, v); }, removeProperty(k) { this._m.delete(k); } },
        getAttribute(name) {
          if (name === 'aria-selected') return this.attrs['aria-selected'];
          if (name === 'aria-controls') return this.attrs['aria-controls'];
          if (name === 'hidden') return Object.prototype.hasOwnProperty.call(this.attrs, 'hidden') ? '' : null;
          return this.attrs[name] ?? null;
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        removeAttribute(name) { delete this.attrs[name]; },
        hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); },
        querySelector(sel) {
          return this.querySelectorAll(sel)[0] || null;
        },
        querySelectorAll(sel) {
          const all = [];
          const walk = (node) => {
            if (!node) return;
            all.push(node);
            (node.children || []).forEach(walk);
          };
          walk(this);
          if (sel === '.edtr-pane') return all.filter((n) => n.classList.contains('edtr-pane'));
          if (sel === '.ed-tab') return all.filter((n) => n.classList.contains('ed-tab'));
          if (sel.startsWith('#')) return all.filter((n) => n.id === sel.slice(1));
          if (sel.startsWith('.ed-tab[data-tab=')) {
            const tab = sel.match(/data-tab="([^"]+)"/)?.[1];
            return all.filter((n) => n.classList.contains('ed-tab') && n.dataset.tab === tab);
          }
          return [];
        }
      };
      return el;
    };

    const root = mk('main', { className: 'ed-main', attrs: { 'data-ed-tabs': '' } });
    root.id = '';
    const tabs = [
      mk('button', { id: 'tab-transcript', className: 'ed-tab is-active', dataset: { tab: 'transcript' }, attrs: { 'aria-selected': 'true', 'aria-controls': 'pane-transcript' } }),
      mk('button', { id: 'tab-summary', className: 'ed-tab', dataset: { tab: 'summary' }, attrs: { 'aria-selected': 'false', 'aria-controls': 'pane-summary' } }),
      mk('button', { id: 'tab-chat', className: 'ed-tab', dataset: { tab: 'chat' }, attrs: { 'aria-selected': 'false', 'aria-controls': 'pane-chat' } })
    ];
    const panes = [
      mk('section', { id: 'pane-transcript', className: 'edtr-pane is-active' }),
      mk('section', { id: 'pane-summary', className: 'edtr-pane', attrs: { hidden: '' } }),
      mk('section', { id: 'pane-chat', className: 'edtr-pane', attrs: { hidden: '' } })
    ];
    root.children = [...tabs, ...panes];
    tabs.forEach((t) => { t.parentElement = root; });
    panes.forEach((p) => { p.parentElement = root; });

    root.querySelector = (sel) => {
      if (sel === '#pane-transcript') return panes[0];
      if (sel.startsWith('#tab-')) return tabs.find((t) => t.id === sel.slice(1)) || null;
      if (sel.startsWith('.ed-tab[data-tab=')) {
        const tab = sel.match(/data-tab="([^"]+)"/)?.[1];
        return tabs.find((t) => t.dataset.tab === tab) || null;
      }
      return null;
    };
    root.querySelectorAll = (sel) => {
      if (sel === '.edtr-pane') return panes;
      if (sel === '.ed-tab') return tabs;
      return [];
    };

    const fakeDoc = {
      querySelector(sel) {
        if (sel.includes('main.ed-main') || sel.includes('[data-ed-tabs]')) return root;
        if (sel.startsWith('#')) return [...tabs, ...panes].find((n) => n.id === sel.slice(1)) || null;
        return root.querySelector(sel);
      },
      querySelectorAll() { return []; }
    };

    return { fakeDoc, root, tabs, panes };
  }

  const editorA = makeEditorDom();
  // Simule perte totale de .is-active
  editorA.panes.forEach((p) => {
    p.classList.remove('is-active');
    p.setAttribute('hidden', '');
  });
  editorA.tabs.forEach((t) => {
    t.classList.remove('is-active');
    t.setAttribute('aria-selected', 'false');
  });
  const restored = AC.ensureActiveEditorPane(editorA.fakeDoc);
  assert(restored === true, 'ensureActiveEditorPane restaure un volet');
  assert(editorA.panes[0].classList.contains('is-active') === true, 'pane-transcript redevient actif');
  assert(editorA.panes[0].hasAttribute('hidden') === false, 'pane-transcript n a plus hidden');
  assert(editorA.panes.filter((p) => p.classList.contains('is-active')).length === 1, 'exactement un volet actif');
  assert(editorA.tabs[0].classList.contains('is-active') === true, 'onglet transcript actif');

  const editorB = makeEditorDom();
  const noop = AC.ensureActiveEditorPane(editorB.fakeDoc);
  assert(noop === false, 'ensureActiveEditorPane no-op si deja valide');
  assert(editorB.panes[0].classList.contains('is-active') === true, 'volet transcript conserve');

  // Toggle ON/OFF ne doit pas casser la preference ni exposer un chemin beforeload
  const ACTogglePanes = boot({ storage: { 'agilo:confidence-visible:v1': 'true' } });
  ACTogglePanes.toggle(false, true);
  assert(ACTogglePanes.__storage.get('agilo:confidence-visible:v1') === 'false', 'toggle OFF persiste sans rechargement');
  ACTogglePanes.toggle(true, true);
  assert(ACTogglePanes.__storage.get('agilo:confidence-visible:v1') === 'true', 'toggle ON persiste sans rechargement');

  // --- Non-régression : scroll « Passage suivant » borné (bug 1.09.3) ---
  assert(typeof AC.findConfidenceScrollContainer === 'function', 'findConfidenceScrollContainer exposé');
  assert(typeof AC.scrollSegmentIntoView === 'function', 'scrollSegmentIntoView exposé');
  assert(typeof AC.captureAncestorScroll === 'function', 'captureAncestorScroll exposé');
  assert(typeof AC.restoreNonTargetScroll === 'function', 'restoreNonTargetScroll exposé');
  assert(typeof AC.repairEditorShellScroll === 'function', 'repairEditorShellScroll exposé');
  assert(typeof AC.ensureTranscriptPaneActive === 'function', 'ensureTranscriptPaneActive exposé');

  function makeScrollDom() {
    const styleMap = new Map();
    const setStyle = (el, styles) => styleMap.set(el, { ...styles });

    const mkScrollEl = (props = {}) => {
      const el = {
        id: props.id || '',
        className: props.className || '',
        tagName: props.tagName || 'DIV',
        parentElement: null,
        children: [],
        scrollTop: props.scrollTop || 0,
        scrollLeft: 0,
        scrollHeight: props.scrollHeight ?? 2000,
        clientHeight: props.clientHeight ?? 400,
        scrollWidth: 100,
        clientWidth: 100,
        offsetHeight: props.offsetHeight ?? 24,
        scrollIntoViewCalls: 0,
        scrollToCalls: [],
        classList: {
          _s: new Set(String(props.className || '').split(/\s+/).filter(Boolean)),
          add(c) { this._s.add(c); el.className = [...this._s].join(' '); },
          remove(c) { this._s.delete(c); el.className = [...this._s].join(' '); },
          contains(c) { return this._s.has(c); },
          toggle(c, v) { v ? this.add(c) : this.remove(c); }
        },
        attrs: { ...(props.attrs || {}) },
        getAttribute(name) {
          if (name === 'hidden') return Object.prototype.hasOwnProperty.call(this.attrs, 'hidden') ? '' : null;
          return this.attrs[name] ?? null;
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        removeAttribute(name) { delete this.attrs[name]; },
        hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); },
        getBoundingClientRect() {
          return props.rect || { top: 500, bottom: 524, left: 40, width: 720, height: 24 };
        },
        closest(sel) {
          if (sel.includes('edtr-pane') && el.className.includes('edtr-pane')) return el;
          return el.parentElement?.closest?.(sel) || null;
        },
        scrollIntoView() { this.scrollIntoViewCalls += 1; },
        scrollTo(opts) { this.scrollToCalls.push(opts); if (opts?.top != null) this.scrollTop = opts.top; }
      };
      setStyle(el, props.styles || { overflowY: 'visible' });
      return el;
    };

    const hiddenBody = mkScrollEl({ className: 'ed-body', scrollTop: 120, styles: { overflowY: 'hidden', overflow: 'hidden' } });
    const edMain = mkScrollEl({ className: 'ed-main', styles: { overflowY: 'visible' } });
    const pane = mkScrollEl({
      id: 'pane-transcript',
      className: 'edtr-pane is-active',
      tagName: 'SECTION',
      styles: { overflowY: 'auto', overflow: 'auto' },
      rect: { top: 120, bottom: 520, left: 24, width: 760, height: 400 }
    });
    const seg = mkScrollEl({
      className: 'ag-seg',
      tagName: 'ARTICLE',
      rect: { top: 500, bottom: 524, left: 40, width: 720, height: 24 }
    });

    pane.children = [seg];
    seg.parentElement = pane;
    edMain.children = [pane];
    pane.parentElement = edMain;
    hiddenBody.children = [edMain];
    edMain.parentElement = hiddenBody;

    const getComputedStyle = (node) => styleMap.get(node) || { overflowY: 'visible', overflow: 'visible', overflowX: 'visible' };

    return { hiddenBody, edMain, pane, seg, getComputedStyle };
  }

  const scrollDom = makeScrollDom();
  const scrollBoot = boot({});
  const scrollSandbox = {
    window: {
      __agiloConfidence: false,
      AGILOTEXT_ENABLE_CONFIDENCE: true,
      innerWidth: 1280,
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: (fn) => { fn(); return 1; },
      addEventListener() {},
      removeEventListener() {}
    },
    document: {
      body: scrollDom.hiddenBody,
      documentElement: scrollDom.hiddenBody,
      scrollingElement: { scrollTop: 0, scrollLeft: 0 },
      getElementById(id) {
        if (id === 'pane-transcript') return scrollDom.pane;
        return null;
      },
      querySelector(sel) {
        if (sel === '.ed-body') return scrollDom.hiddenBody;
        if (sel === '.ed-main') return scrollDom.edMain;
        if (sel.includes('main.ed-main')) return scrollDom.edMain;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.edtr-pane') return [scrollDom.pane];
        if (sel === '.ed-tab') return [];
        return [];
      },
      readyState: 'complete',
      addEventListener() {}
    },
    getComputedStyle: scrollDom.getComputedStyle
  };
  scrollSandbox.window.window = scrollSandbox.window;
  vm.runInNewContext(src, scrollSandbox);
  const ACScroll = scrollSandbox.window.AgiloConfidence;
  scrollDom.hiddenBody.scrollTop = 120;

  const container = ACScroll.findConfidenceScrollContainer(scrollDom.seg);
  assert(container === scrollDom.pane, 'findConfidenceScrollContainer retourne le pane overflow:auto');

  const capturedBefore = ACScroll.captureAncestorScroll(scrollDom.seg);
  assert(capturedBefore.some((c) => c.node === scrollDom.hiddenBody && c.top === 120), 'capture enregistre ed-body scrollTop');

  const target = ACScroll.scrollSegmentIntoView(scrollDom.seg);
  assert(target === scrollDom.pane, 'scrollSegmentIntoView cible le pane');
  assert(scrollDom.seg.scrollIntoViewCalls === 0, 'scrollSegmentIntoView n appelle jamais scrollIntoView natif');
  assert(scrollDom.pane.scrollToCalls.length === 1, 'scrollSegmentIntoView appelle scrollTo sur le pane');

  ACScroll.restoreNonTargetScroll(capturedBefore, target);
  assert(scrollDom.hiddenBody.scrollTop === 120, 'restoreNonTargetScroll preserve ed-body scrollTop initial');

  const capturedZero = ACScroll.captureAncestorScroll(scrollDom.seg);
  scrollDom.hiddenBody.scrollTop = 50;
  ACScroll.restoreNonTargetScroll(capturedZero, target);
  assert(scrollDom.hiddenBody.scrollTop === 120, 'restoreNonTargetScroll remet ed-body a sa valeur capturee');

  const noScrollDom = makeScrollDom();
  noScrollDom.pane.scrollHeight = 100;
  noScrollDom.pane.clientHeight = 100;
  noScrollDom.getComputedStyle(noScrollDom.pane).overflowY = 'visible';
  const noTarget = ACScroll.scrollSegmentIntoView(noScrollDom.seg);
  assert(noTarget === null, 'aucun conteneur scrollable: pas de scroll');

  const repairDoc = {
    querySelector(sel) {
      if (sel === '.ed-body') return scrollDom.hiddenBody;
      if (sel === '.ed-main') return scrollDom.edMain;
      return null;
    }
  };
  scrollDom.hiddenBody.scrollTop = 88;
  ACScroll.repairEditorShellScroll(repairDoc);
  assert(scrollDom.hiddenBody.scrollTop === 0, 'repairEditorShellScroll remet ed-body a 0');

  const inactiveEditor = makeEditorDom();
  inactiveEditor.panes[0].classList.remove('is-active');
  inactiveEditor.panes[0].setAttribute('hidden', '');
  inactiveEditor.panes[1].classList.add('is-active');
  inactiveEditor.panes[1].removeAttribute('hidden');
  const activated = AC.ensureTranscriptPaneActive(inactiveEditor.fakeDoc);
  assert(activated === true, 'ensureTranscriptPaneActive reactive transcript');
  assert(inactiveEditor.panes[0].classList.contains('is-active') === true, 'pane transcript actif apres ensureTranscriptPaneActive');

  const reducedBoot = boot({});
  const reducedSandbox = {
    window: {
      __agiloConfidence: false,
      AGILOTEXT_ENABLE_CONFIDENCE: true,
      matchMedia: () => ({ matches: true }),
      addEventListener() {},
      removeEventListener() {}
    },
    document: makeDom(),
    getComputedStyle: () => ({ overflowY: 'auto', overflow: 'auto', overflowX: 'visible' })
  };
  reducedSandbox.window.window = reducedSandbox.window;
  vm.runInNewContext(src, reducedSandbox);
  assert(reducedSandbox.window.AgiloConfidence.scrollConfidenceBehavior() === 'auto', 'prefers-reduced-motion => auto');

  // --- Non-régression : garde scroll shell (retrait sticky 1.09.4) ---
  assert(typeof AC.startEditorShellScrollGuard === 'function', 'startEditorShellScrollGuard exposé');
  assert(typeof AC.stopEditorShellScrollGuard === 'function', 'stopEditorShellScrollGuard exposé');
  assert(typeof AC.resetHiddenShellScroll === 'function', 'resetHiddenShellScroll exposé');

  const guardStyleMap = new Map();
  const guardBody = {
    className: 'ed-body',
    classList: { contains(c) { return c === 'ed-body'; } },
    scrollTop: 200,
    scrollLeft: 5
  };
  const guardPane = {
    className: 'edtr-pane is-active',
    classList: { contains(c) { return c === 'edtr-pane'; } },
    scrollTop: 100,
    scrollLeft: 0
  };
  guardStyleMap.set(guardBody, { overflowY: 'hidden', overflow: 'hidden', overflowX: 'hidden' });
  guardStyleMap.set(guardPane, { overflowY: 'auto', overflow: 'auto', overflowX: 'visible' });

  const guardSandbox = {
    window: {
      __agiloConfidence: false,
      AGILOTEXT_ENABLE_CONFIDENCE: true,
      addEventListener() {},
      removeEventListener() {}
    },
    document: { querySelector: () => null, readyState: 'complete', addEventListener() {} },
    getComputedStyle: (el) => guardStyleMap.get(el) || { overflowY: 'visible', overflow: 'visible', overflowX: 'visible' }
  };
  guardSandbox.window.window = guardSandbox.window;
  vm.runInNewContext(src, guardSandbox);
  const ACGuard = guardSandbox.window.AgiloConfidence;

  assert(ACGuard.resetHiddenShellScroll(guardBody) === true, 'garde remet ed-body hidden a 0');
  assert(guardBody.scrollTop === 0 && guardBody.scrollLeft === 0, 'ed-body scroll remis a zero');
  assert(ACGuard.resetHiddenShellScroll(guardPane) === false, 'garde ignore overflow auto');
  assert(guardPane.scrollTop === 100, 'pane transcript scroll preserve');

  const guardDoc2 = {
    listeners: [],
    querySelector: () => null,
    readyState: 'complete',
    addEventListener(type, fn, opts) { this.listeners.push({ type, fn, opts }); },
    removeEventListener(type, fn, capture) {
      this.listeners = this.listeners.filter((l) => l.fn !== fn);
    }
  };
  const guardBody2 = {
    className: 'ed-body',
    classList: { contains(c) { return c === 'ed-body'; } },
    scrollTop: 0,
    scrollLeft: 0
  };
  const guardSandbox2 = {
    window: {
      __agiloConfidence: false,
      AGILOTEXT_ENABLE_CONFIDENCE: true,
      addEventListener() {},
      removeEventListener() {}
    },
    document: guardDoc2,
    getComputedStyle: () => ({ overflowY: 'hidden', overflow: 'hidden', overflowX: 'hidden' })
  };
  guardSandbox2.window.window = guardSandbox2.window;
  vm.runInNewContext(src, guardSandbox2);
  const ACGuard2 = guardSandbox2.window.AgiloConfidence;
  const scrollListeners = guardDoc2.listeners.filter((l) => l.type === 'scroll');
  assert(scrollListeners.length === 1, 'un seul listener scroll a l init');
  assert(ACGuard2.startEditorShellScrollGuard(guardDoc2) === false, 'startEditorShellScrollGuard idempotent');
  assert(guardDoc2.listeners.filter((l) => l.type === 'scroll').length === 1, 'toujours un seul listener apres second start');

  guardBody2.scrollTop = 150;
  scrollListeners[0].fn({ target: guardBody2 });
  assert(guardBody2.scrollTop === 0, 'listener scroll remet ed-body a 0');

  console.log(`\nRésultat : ${passed} ok, ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
