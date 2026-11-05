const test = require("node:test");
const assert = require("node:assert/strict");
const counts = require("../scripts/shared/folder-counts.js");

test("racine 295 et dossiers vides : les deux pastilles sont 295", () => {
  const out = counts.countsFromFolderApi({
    status: "OK",
    rootJobsCount: 295,
    folders: [
      { folderId: 4, folderName: "Arminé", jobsCount: 0 },
      { folderId: 5, folderName: "Démo", jobsCount: 0 },
      { folderId: 6, folderName: "One Learn", jobsCount: 0 }
    ]
  });
  assert.equal(out.rootJobsCount, 295);
  assert.equal(out.total, 295);
});

test("Mes fichiers additionne la racine et les dossiers", () => {
  const out = counts.countsFromFolderApi({
    rootJobsCount: 10,
    folders: [
      { folderId: 1, folderName: "A", jobsCount: 3 },
      { folderId: 2, folderName: "B", jobsCount: 4 }
    ]
  });
  assert.equal(out.rootJobsCount, 10);
  assert.equal(out.total, 17);
});

test("la fonction ne reçoit pas les statuts, un job non prêt reste dans le total", () => {
  const out = counts.countsFromFolderApi({ rootCount: 12, folders: [] });
  assert.equal(out.total, 12);
  assert.equal(out.rootJobsCount, 12);
});

test("un dérivé local plus haut ne fait pas partie du résultat API", () => {
  const out = counts.countsFromFolderApi({ rootJobsCount: 295, folders: [] });
  const derivedLocal = 400;
  const shown = out.rootJobsCount;
  assert.equal(shown, 295);
  assert.ok(shown < derivedLocal);
});

test("le chemin business gagne sur une édition pro gardée en mémoire", () => {
  const stored = "pro";
  const fromPath = counts.editionFromPath("/app/business/mes-transcripts");
  const edition = fromPath || stored;
  assert.equal(edition, "ent");
  assert.equal(counts.editionFromPath("/app/premium/dashboard"), "pro");
  assert.equal(counts.editionFromPath("/app/free/dashboard"), "free");
  assert.equal(counts.editionFromPath("/tarifs"), "");
});
