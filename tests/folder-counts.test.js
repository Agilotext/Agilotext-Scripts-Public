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

test("transcriptCount sans jobsCount : 10, 23 et 4 donnent 37", () => {
  const out = counts.countsFromFolderApi({
    status: "OK",
    rootJobsCount: 0,
    transcriptFolders: [
      { folderId: 82, folderName: "EA Pasteur", transcriptCount: 10 },
      { folderId: 66, folderName: "EA Sévigné", transcriptCount: 23 },
      { folderId: 65, folderName: "tests", transcriptCount: 4 }
    ]
  });
  assert.equal(out.rootJobsCount, 0);
  assert.equal(out.folders[0].jobsCount, 10);
  assert.equal(out.folders[1].jobsCount, 23);
  assert.equal(out.folders[2].jobsCount, 4);
  assert.equal(out.total, 37);
});

test("racine 304 et transcriptCount : les dossiers ne tombent pas à 0", () => {
  const out = counts.countsFromFolderApi({
    rootJobsCount: 304,
    transcriptFolders: [
      { folderId: 1, folderName: "A", transcriptCount: 2 },
      { folderId: 2, folderName: "B", transcriptCount: 1 },
      { folderId: 3, folderName: "C", transcriptCount: 1 }
    ]
  });
  assert.equal(out.rootJobsCount, 304);
  assert.equal(out.folders.map((f) => f.jobsCount).join(","), "2,1,1");
  assert.equal(out.total, 308);
});

test("API 0 et aucun dossier reste 0", () => {
  const out = counts.countsFromFolderApi({ rootJobsCount: 0, transcriptFolders: [] });
  assert.equal(out.rootJobsCount, 0);
  assert.equal(out.total, 0);
  assert.equal(out.folders.length, 0);
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
