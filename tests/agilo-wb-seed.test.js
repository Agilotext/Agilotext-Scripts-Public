const test = require("node:test");
const assert = require("node:assert/strict");
const seed = require("../scripts/pages/dashboard/agilo-wb-seed.js");

test("Mes mots contient le prénom et le nom, pas Agilotext", () => {
  assert.deepEqual(seed.buildSeedWords("Camille", "Boyer"), ["Camille", "Boyer"]);
});

test("sans prénom, aucune liste", () => {
  assert.deepEqual(seed.buildSeedWords("", "  "), []);
});

test("un e-mail n'entre pas dans la liste", () => {
  assert.deepEqual(seed.buildSeedWords("ada@example.com", "Martin"), ["Martin"]);
});

test("Agilotext n'est pas semé, même s'il est passé comme prénom", () => {
  assert.deepEqual(seed.buildSeedWords("Agilotext", "Dupont"), ["Dupont"]);
});

test("catalogue vide : créer", () => {
  assert.equal(seed.shouldCreate(seed.parseCatalog({ boostNamesDTOList: [] })), true);
  assert.equal(seed.shouldCreate(seed.parseCatalog({})), true);
});

test("catalogue rempli : ne pas créer", () => {
  const catalog = seed.parseCatalog({
    defaultBoostId: 4,
    boostNamesDTOList: [{ boostId: 4, boostName: "CSE" }]
  });
  assert.equal(seed.shouldCreate(catalog), false);
});

test("un second appel pendant le verrou ne part pas", () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key)
  };
  assert.equal(seed.acquireLock(storage, 1000), true);
  assert.equal(seed.acquireLock(storage, 1500), false);
  seed.releaseLock(storage);
  assert.equal(seed.acquireLock(storage, 2000), true);
});

test("édition lue sur le chemin", () => {
  assert.equal(seed.editionFrom({ location: { pathname: "/app/premium/dashboard" }, document: { querySelector: () => null } }), "pro");
  assert.equal(seed.editionFrom({ location: { pathname: "/app/business/dashboard" }, document: { querySelector: () => null } }), "ent");
  assert.equal(seed.editionFrom({ location: { pathname: "/app/free/dashboard" }, document: { querySelector: () => null } }), "");
});
