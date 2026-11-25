const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helper = require('../scripts/pages/shared/format-investigation-pv.js');

function loadRouting({ jobPromptId, selectedId, withHelper = true }) {
  const calls = [];
  const window = {
    __fixtureCalls: calls,
    __fixtureCreds: { email: 'fixture-user', token: 'fixture-token', edition: 'ent', jobId: '501' },
    __agiloCurrentSummaryModel: { jobId: '501', id: jobPromptId },
    __agiloPendingSummaryChoice: selectedId == null ? null : { jobId: '501', id: selectedId, name: 'Modèle de test' }
  };
  if (withHelper) window.AgiloFormatInvestigationPv = helper;
  const context = vm.createContext({
    window,
    document: { readyState: 'loading', addEventListener() {}, querySelector: () => ({}) },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null },
    URLSearchParams,
    console: { log() {}, error() {} },
    confirm: () => true,
    alert() {},
    setTimeout() { throw new Error('Unexpected timer in routing test'); }
  });
  const source = fs.readFileSync(path.join(__dirname, '../scripts/pages/editor/relance-compte-rendu.js'), 'utf8');
  const anchor = '  window.relancerCompteRendu = relancerCompteRendu;';
  assert.equal(source.split(anchor).length, 2, 'point de contrôle du gestionnaire introuvable');
  const instrumented = source.replace(anchor, `
    ensureCreds = async () => window.__fixtureCreds;
    shouldSkipRegenerationCharge = async () => true;
    hasErrorMessageInDOM = () => true;
    updateButtonVisibility = () => {};
    generateInvestigationPv = async (creds, promptId) => {
      window.__fixtureCalls.push({ route: 'formatInvestigationPv', promptId: Number(promptId), jobId: creds.jobId });
      isGenerating = false;
    };
    fetchRedoSummaryWithRetry = async (url) => {
      window.__fixtureCalls.push({ route: 'redoSummary', url });
      return { ok: false, json: async () => ({ status: 'KO' }) };
    };
    window.__fixtureIsPvPrompt = isPvPrompt;
    ${anchor}
  `);
  vm.runInContext(instrumented, context);
  return { calls, run: window.relancerCompteRendu, isPvPrompt: window.__fixtureIsPvPrompt };
}

describe('routage du gestionnaire réel de régénération', () => {
  for (const withHelper of [true, false]) {
    const mode = withHelper ? 'avec helper' : 'sans helper';

    for (const id of [1107, 1108]) {
      it(`${mode} : ${id} appelle redoSummary et aucun formatage PV`, async () => {
        const fixture = loadRouting({ jobPromptId: id, selectedId: id, withHelper });
        assert.equal(fixture.isPvPrompt(id), false);
        await fixture.run();
        assert.equal(fixture.calls.length, 1);
        assert.equal(fixture.calls[0].route, 'redoSummary');
        const url = new URL(fixture.calls[0].url);
        assert.equal(url.pathname, '/api/v1/redoSummary');
        assert.equal(url.searchParams.get('promptId'), String(id));
        assert.equal(url.searchParams.get('jobId'), '501');
      });
    }

    it(`${mode} : les 16 modèles 705–720 conservent le chemin PV`, async () => {
      for (let id = 705; id <= 720; id += 1) {
        const fixture = loadRouting({ jobPromptId: id, withHelper });
        assert.equal(fixture.isPvPrompt(id), true);
        await fixture.run();
        assert.equal(fixture.calls.length, 1);
        assert.equal(fixture.calls[0].route, 'formatInvestigationPv');
        assert.equal(fixture.calls[0].promptId, id);
      }
    });

    it(`${mode} : le choix temporaire 1107 sur un job 713 régénère le modèle choisi`, async () => {
      const fixture = loadRouting({ jobPromptId: 713, selectedId: 1107, withHelper });
      await fixture.run();
      assert.equal(fixture.calls[0].route, 'redoSummary');
      assert.equal(new URL(fixture.calls[0].url).searchParams.get('promptId'), '1107');
    });

    it(`${mode} : le choix temporaire 713 sur un job 1107 conserve le chemin PV`, async () => {
      const fixture = loadRouting({ jobPromptId: 1107, selectedId: 713, withHelper });
      await fixture.run();
      assert.equal(fixture.calls[0].route, 'formatInvestigationPv');
      assert.equal(fixture.calls[0].promptId, 713);
    });
  }
});
