const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPath = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(rootPath, file), 'utf8');

function makeController(mode = 'faithful') {
  const events = [];
  const savedAudio = [];
  const drafts = [];
  const errors = [];
  const textarea = {
    value: '', readOnly: false, scrollHeight: 0, clientHeight: 1,
    style: {}, classList: { add() {}, remove() {} }
  };
  const root = {
    querySelector(selector) {
      return selector === '[data-agilo-streaming-text]' ? textarea : null;
    },
    contains() { return true; }
  };
  class FakeWebSocket {
    static OPEN = 1;
    static last = null;
    constructor() {
      this.readyState = 0;
      this.listeners = {};
      this.sent = [];
      FakeWebSocket.last = this;
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    emit(name, payload) {
      for (const fn of this.listeners[name] || []) fn(payload);
    }
    send(payload) {
      this.sent.push(payload);
      if (typeof payload === 'string' && JSON.parse(payload).message === 'EndOfStream' && this.onEnd) {
        this.onEnd();
      }
    }
    close() {
      this.readyState = 3;
      this.emit('close');
    }
  }
  const document = {
    documentElement: { contains() { return true; } },
    querySelector() { return null; },
    getElementById() { return null; },
    addEventListener() {},
    dispatchEvent(event) { events.push(event); },
    head: { appendChild() {} }
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options && options.detail; }
  }
  const sandbox = {
    window: null, document, console, Blob, ArrayBuffer, DataView, Int16Array,
    WebSocket: FakeWebSocket, CustomEvent, setTimeout, clearTimeout, setInterval, clearInterval,
    AgiloDicteeUsages: {
      writeDraft(email, text) { drafts.push({ email, text }); },
      persistDraftFromTextarea() { drafts.push({ text: textarea.value }); },
      setCarnetError(message) { errors.push(message); },
      onVoiceStatus() {}
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(read('scripts/shared/agilo-live-transcribe.js'), sandbox);
  const controller = sandbox.AgiloLiveVoice.mount({
    root,
    getUsage: () => 'carnet',
    getSoloMode: () => mode,
    getAgiloAuth: async () => ({ websocketUrl: 'wss://synthetic.invalid/', jwt: 'fake' }),
    onCarnetAudioReady: async (options) => { savedAudio.push(options); },
    postCarnetSegment: async () => { throw new Error('AssemblyAI should not be called'); }
  });
  controller.state.email = 'person@example.invalid';
  controller.state.soloMode = mode;
  controller.state.soloSessionId = 'synthetic-session';
  controller.state.soloDraftId = 'synthetic-draft';
  controller.state.soloStartedAt = 1000;
  controller.state.soloBaseText = 'Texte corrigé auparavant.';
  controller.state.soloFinalText = '';
  controller.state.soloAcceptResults = true;
  controller.state.sampleRate = 16000;
  controller.state.pcmChunks = [new Int16Array(1600).fill(100)];
  controller.state.audioContext = {
    suspend: async () => {}, close: async () => {}
  };
  controller.setStatus('recording', 'En écoute...');
  return { controller, textarea, FakeWebSocket, events, drafts, savedAudio, errors, sandbox };
}

function result(text) {
  return { alternatives: [{ content: text }] };
}

async function connect(controller, FakeWebSocket) {
  const pending = controller.openRealtimeSession();
  await new Promise((resolve) => setImmediate(resolve));
  const ws = FakeWebSocket.last;
  ws.readyState = FakeWebSocket.OPEN;
  ws.emit('open');
  ws.emit('message', { data: JSON.stringify({ message: 'RecognitionStarted' }) });
  await pending;
  return ws;
}

test('Fidèle affiche les partiels, mais ne sauvegarde que les finals et les derniers mots', async () => {
  const { controller, textarea, FakeWebSocket, drafts, savedAudio, events } = makeController();
  const ws = await connect(controller, FakeWebSocket);
  ws.emit('message', { data: JSON.stringify({ message: 'AddPartialTranscript', results: [result('essai provisoire')] }) });
  assert.match(textarea.value, /Texte corrigé auparavant\.\n\nessai provisoire/);
  assert.equal(textarea.readOnly, true);
  assert.equal(drafts.length, 0);
  ws.emit('message', { data: JSON.stringify({ message: 'AddTranscript', results: [result('phrase définitive')] }) });
  ws.onEnd = () => {
    ws.emit('message', { data: JSON.stringify({ message: 'AddTranscript', results: [result('derniers mots.')] }) });
    ws.emit('message', { data: JSON.stringify({ message: 'EndOfTranscript' }) });
  };
  await controller.stop();
  assert.equal(textarea.value, 'Texte corrigé auparavant.\n\nphrase définitive derniers mots.');
  assert.equal(textarea.readOnly, false);
  assert.equal(savedAudio.length, 1);
  assert.equal(savedAudio[0].draftId, 'synthetic-draft');
  assert.ok(drafts.some((entry) => entry.text === textarea.value));
  assert.equal(events.filter((event) => event.type === 'agilo-carnet-segment-failed').length, 0);
});

test('un direct interrompu garde les finals et impose une relecture', async () => {
  const { controller, textarea, FakeWebSocket, events, savedAudio } = makeController();
  const ws = await connect(controller, FakeWebSocket);
  ws.emit('message', { data: JSON.stringify({ message: 'AddTranscript', results: [result('texte acquis')] }) });
  controller.state.soloConnectionLost = true;
  ws.readyState = 3;
  await controller.stop();
  assert.equal(textarea.value, 'Texte corrigé auparavant.\n\ntexte acquis');
  assert.equal(savedAudio.length, 1);
  assert.ok(events.some((event) => event.type === 'agilo-carnet-segment-failed'));
});

test('la clôture du direct expire et ignore les résultats tardifs', async () => {
  const { controller, textarea, FakeWebSocket } = makeController();
  const ws = await connect(controller, FakeWebSocket);
  const complete = await controller.closeRealtimeSession(5);
  assert.equal(complete, false);
  assert.equal(ws.readyState, 3);
  ws.emit('message', { data: JSON.stringify({ message: 'AddTranscript', results: [result('trop tard')] }) });
  assert.equal(textarea.value, 'Texte corrigé auparavant.');
  assert.equal(controller.state.soloFinalText, '');
});

test('Copier est au-dessus du champ, et le choix de moteur reste dans la dictée solo', () => {
  const usages = read('scripts/pages/dashboard/dictee-usages.js');
  assert.match(usages, /wrap\.insertBefore\(tools, ta\)/);
  assert.doesNotMatch(usages, /\.agilo-solo-ta-copy\{position:absolute/);
  assert.match(usages, /<fieldset id="agilo-solo-mode/);
  assert.match(usages, /state\.soloMode = readStoredSoloMode\(email\)/);
  assert.match(read('scripts/pages/dashboard/mount-streaming.js'), /getSoloMode: function/);
  assert.ok(usages.indexOf('value="faithful"') < usages.indexOf('value="smooth"'));
  assert.match(usages, /value="smooth" checked/);
  assert.doesNotMatch(usages, /textContent = .*Speechmatics|textContent = .*AssemblyAI|son est transmis à Speechmatics|extraits audio sont envoyés à AssemblyAI/);
});

test('un brouillon ancien reste caché et protégé jusqu’au choix explicite', () => {
  const values = new Map([['agilotext:dicteeCarnet:person@example.invalid', 'Texte ancien']]);
  const ta = { value: '', readOnly: false };
  const sandbox = {
    window: null, edition: 'ent',
    document: { querySelector: selector => selector === '[data-agilo-streaming-text]' ? ta : null },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    },
    clearTimeout
  };
  sandbox.window = sandbox;
  const source = read('scripts/pages/dashboard/dictee-usages.js');
  vm.runInNewContext(source.replace('  global.AgiloDicteeUsages = {',
    '  global.__test = { state, applyDraftToTextarea, persistDraftFromTextarea };\n  global.AgiloDicteeUsages = {'), sandbox);
  sandbox.__test.state.email = 'person@example.invalid';
  sandbox.__test.state.usage = 'carnet';
  sandbox.__test.applyDraftToTextarea();
  assert.equal(ta.value, '');
  assert.equal(ta.readOnly, true);
  sandbox.__test.persistDraftFromTextarea();
  assert.equal(values.get('agilotext:dicteeCarnet:person@example.invalid'), 'Texte ancien');
  sandbox.AgiloDicteeUsages.unlockDraft('person@example.invalid', 'Texte ancien');
  assert.equal(ta.value, 'Texte ancien');
  assert.equal(ta.readOnly, false);
});

test('deux clics pendant le choix du brouillon ne démarrent qu’une prise', async () => {
  const { controller } = makeController();
  controller.setStatus('idle', 'Prêt');
  controller.getEmail = () => 'person@example.invalid';
  let resolveChoice;
  let starts = 0;
  controller.config.prepareCarnetStart = () => new Promise(resolve => { resolveChoice = resolve; });
  controller._startReady = () => { starts += 1; };
  controller.start();
  controller.start();
  resolveChoice(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1);
});

test('le mode est mémorisé par compte et reste figé pendant une prise', () => {
  const values = new Map();
  const emailInput = { value: 'one@example.invalid' };
  const document = {
    querySelector(selector) { return selector === 'input.memberemail' ? emailInput : null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    dispatchEvent() {}
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const sandbox = {
    window: null, document, edition: 'ent', CustomEvent,
    localStorage: {
      getItem(key) { return values.get(key) || null; },
      setItem(key, value) { values.set(key, value); }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(read('scripts/pages/dashboard/dictee-usages.js'), sandbox);
  const usages = sandbox.AgiloDicteeUsages;
  assert.equal(usages.getSoloMode(), 'smooth');
  usages.setSoloMode('faithful', true);
  assert.equal(usages.getSoloMode(), 'faithful');
  assert.equal(values.get(usages.soloModeKey('one@example.invalid')), 'faithful');
  usages.onVoiceStatus('recording');
  usages.setSoloMode('smooth', true);
  assert.equal(usages.getSoloMode(), 'faithful');
  usages.onVoiceStatus('idle');
  emailInput.value = 'two@example.invalid';
  usages.refreshAccount();
  assert.equal(usages.getSoloMode(), 'smooth');
  emailInput.value = 'one@example.invalid';
  usages.refreshAccount();
  assert.equal(usages.getSoloMode(), 'faithful');
});

test('le démarrage utilise Speechmatics en Fidèle et AssemblyAI en Lissée', async () => {
  for (const mode of ['faithful', 'smooth']) {
    const { controller, textarea } = makeController(mode);
    controller.setStatus('idle', 'Prêt');
    textarea.value = 'Correction précédente';
    controller.getEmail = () => 'person@example.invalid';
    controller._checkLimits = () => true;
    let realtimeCalls = 0;
    let smoothCalls = 0;
    controller.ensureAudioPipeline = async () => {
      controller.state.audioContext = { resume: async () => {}, suspend: async () => {}, close: async () => {} };
    };
    controller.openRealtimeSession = async () => { realtimeCalls += 1; };
    controller._carnetStartSession = () => { smoothCalls += 1; };
    controller.start();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(controller.state.status, 'recording');
    assert.equal(realtimeCalls, mode === 'faithful' ? 1 : 0);
    assert.equal(smoothCalls, mode === 'smooth' ? 1 : 0);
    assert.equal(controller.state.soloBaseText, 'Correction précédente');
    controller.stopTimer();
    controller.setStatus('idle', 'Prêt');
  }
});

test('changer de moteur entre deux prises conserve le texte corrigé et les deux audios', async () => {
  const { controller, textarea, FakeWebSocket, savedAudio } = makeController();
  const ws = await connect(controller, FakeWebSocket);
  ws.emit('message', { data: JSON.stringify({ message: 'AddTranscript', results: [result('Texte fidèle.')] }) });
  ws.onEnd = () => ws.emit('message', { data: JSON.stringify({ message: 'EndOfTranscript' }) });
  await controller.stop();
  textarea.value = 'Correction humaine.\n\nTexte fidèle corrigé.';
  controller.config.getSoloMode = () => 'smooth';
  controller.getEmail = () => 'person@example.invalid';
  controller._checkLimits = () => true;
  controller.ensureAudioPipeline = async () => {
    controller.state.audioContext = { resume: async () => {}, suspend: async () => {}, close: async () => {} };
    controller.state.pcmChunks = [new Int16Array(1600).fill(100)];
  };
  controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.soloMode, 'smooth');
  controller._carnetAppendText('Phrase lissée.');
  await controller.stop();
  assert.equal(textarea.value, 'Correction humaine.\n\nTexte fidèle corrigé.\n\nPhrase lissée.');
  assert.equal(savedAudio.length, 2);
});

test('arrêter pendant la connexion ne redémarre pas la prise après coup', async () => {
  const { controller, textarea } = makeController();
  controller.setStatus('idle', 'Prêt');
  controller.getEmail = () => 'person@example.invalid';
  controller._checkLimits = () => true;
  textarea.value = 'Brouillon conservé';
  let finishPipeline;
  let realtimeCalls = 0;
  controller.ensureAudioPipeline = () => new Promise((resolve) => {
    finishPipeline = () => {
      controller.state.audioContext = { resume: async () => {}, suspend: async () => {}, close: async () => {} };
      resolve();
    };
  });
  controller.openRealtimeSession = async () => { realtimeCalls += 1; };
  controller.start();
  assert.equal(controller.state.status, 'initializing');
  await controller.stop();
  finishPipeline();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.status, 'idle');
  assert.equal(realtimeCalls, 0);
  assert.equal(textarea.value, 'Brouillon conservé');
});

test('une autorisation micro tardive libère sa prise sans toucher la suivante', async () => {
  const { controller, sandbox } = makeController();
  controller.state.audioContext = null;
  controller.state.startToken = 1;
  let resolveMicro;
  let stopped = 0;
  sandbox.navigator = {
    mediaDevices: { getUserMedia: () => new Promise((resolve) => { resolveMicro = resolve; }) }
  };
  const pending = controller.ensureAudioPipeline(1);
  controller.state.startToken = 2;
  resolveMicro({ getTracks: () => [{ stop: () => { stopped += 1; } }] });
  await assert.rejects(pending, /start_cancelled/);
  assert.equal(stopped, 1);
  assert.equal(controller.state.audioContext, null);
});

test('Réunion garde son envoi audio habituel sans sauvegarde solo', async () => {
  const { controller, savedAudio } = makeController();
  controller.setStatus('idle', 'Prêt');
  controller.config.getUsage = () => 'reunion';
  controller.getEmail = () => 'person@example.invalid';
  controller._checkLimits = () => true;
  let uploads = 0;
  controller.config.uploadBlob = async () => { uploads += 1; return { status: 'OK', jobIdList: [123] }; };
  controller.ensureAudioPipeline = async () => {
    controller.state.audioContext = { resume: async () => {}, suspend: async () => {}, close: async () => {} };
    controller.state.pcmChunks = [new Int16Array(1600).fill(100)];
  };
  controller.openRealtimeSession = async () => {};
  controller.closeRealtimeSession = async () => true;
  controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.status, 'recording');
  controller.stop();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(uploads, 1);
  assert.equal(savedAudio.length, 0);
  assert.equal(controller.state.status, 'idle');
});
