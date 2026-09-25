const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

function load() {
  const data = new Map();
  const sandbox = {
    Blob,
    ArrayBuffer,
    DataView,
    Uint8Array,
    crypto: webcrypto,
    localStorage: {
      getItem: (key) => data.has(key) ? data.get(key) : null,
      setItem: (key, value) => data.set(key, String(value))
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../scripts/pages/dashboard/dictee-solo-audio.js"), "utf8"), sandbox);
  return { audio: sandbox.AgiloSoloAudio, data };
}

test("les identifiants de brouillon restent séparés par compte", () => {
  const { audio } = load();
  const a = audio.getDraftId(" A@EXAMPLE.COM ");
  const b = audio.getDraftId("b@example.com");
  assert.equal(audio.getDraftId("a@example.com"), a);
  assert.notEqual(a, b);
  assert.notEqual(audio.nextDraftId("a@example.com"), a);
});

test("deux sessions WAV donnent un seul WAV PCM dans le bon ordre", async () => {
  const { audio } = load();
  const first = new Int16Array([100, -200]);
  const second = new Int16Array([300, -400, 500]);
  const wavA = new Blob([audio.wavHeader(16000, first.byteLength), first]);
  const wavB = new Blob([audio.wavHeader(16000, second.byteLength), second]);
  const combined = audio.mergeWavBuffers([await wavA.arrayBuffer(), await wavB.arrayBuffer()]);
  const out = await combined.arrayBuffer();
  assert.equal(combined.size, 44 + first.byteLength + second.byteLength);
  assert.equal(new DataView(out).getUint32(24, true), 16000);
  assert.deepEqual(Array.from(new Int16Array(out.slice(44))), [100, -200, 300, -400, 500]);
});

test("les sessions de fréquences différentes produisent un WAV 16 kHz valide", async () => {
  const { audio } = load();
  const a = await new Blob([audio.wavHeader(16000, 2), new Int16Array([10])]).arrayBuffer();
  const b = await new Blob([audio.wavHeader(48000, 6), new Int16Array([20, 30, 40])]).arrayBuffer();
  const merged = await audio.mergeWavBuffers([a, b]).arrayBuffer();
  assert.equal(new DataView(merged).getUint32(24, true), 16000);
  assert.deepEqual(Array.from(new Int16Array(merged.slice(44))), [10, 20]);
});

test("un WAV illisible est bloqué avant l’envoi", () => {
  const { audio } = load();
  assert.throws(() => audio.mergeWavBuffers([new ArrayBuffer(5)]), /invalid_saved_wav/);
});
