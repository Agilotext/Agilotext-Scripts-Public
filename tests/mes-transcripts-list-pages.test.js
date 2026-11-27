/**
 * La liste continue seulement quand le serveur peut encore avoir des lignes.
 * Exécution : node --test tests/mes-transcripts-list-pages.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function loadFns() {
  const src = fs.readFileSync(
    path.join(__dirname, "../scripts/pages/dashboard/Code-mes-transcripts-logic-v2.js"),
    "utf8"
  );
  const names = [
    "dedupeJobsById",
    "serverJobTotal",
    "shouldFetchMoreJobPages",
    "isJobListComplete"
  ];
  const chunks = names.map((name) => {
    const start = src.indexOf("function " + name + "(");
    if (start < 0) throw new Error("missing " + name);
    let i = src.indexOf("{", start);
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    throw new Error("unclosed " + name);
  });
  return new Function(chunks.join("\n") + "\nreturn { dedupeJobsById, serverJobTotal, shouldFetchMoreJobPages, isJobListComplete };")();
}

const fns = loadFns();

describe("liste mes transcripts", () => {
  it("ne redemande rien quand le total annoncé est déjà là", () => {
    assert.equal(fns.shouldFetchMoreJobPages(39, 39, 39), false);
  });

  it("continue si le total annoncé dépasse les fichiers reçus", () => {
    assert.equal(fns.shouldFetchMoreJobPages(39, 39, 309), true);
  });

  it("continue si l’ancien serveur n’envoie pas de total et que la page n’est pas vide", () => {
    assert.equal(fns.shouldFetchMoreJobPages(39, 39, null), true);
    assert.equal(fns.shouldFetchMoreJobPages(100, 100, null), true);
  });

  it("s’arrête sur une page vide", () => {
    assert.equal(fns.shouldFetchMoreJobPages(0, 0, null), false);
  });

  it("dédoublonne le premier lot par jobid", () => {
    const rows = fns.dedupeJobsById([
      { jobid: 1, name: "a" },
      { jobid: "1", name: "b" },
      { jobid: 2, name: "c" }
    ]);
    assert.deepEqual(rows.map((row) => String(row.jobid)), ["1", "2"]);
    assert.equal(rows[0].name, "b");
  });

  it("lit totalCount et ignore une valeur absente", () => {
    assert.equal(fns.serverJobTotal({ totalCount: 39 }), 39);
    assert.equal(fns.serverJobTotal({}), null);
  });

  it("ne marque pas la liste finie si le total annoncé reste plus grand", () => {
    assert.equal(fns.isJobListComplete(39, 309, true), false);
    assert.equal(fns.isJobListComplete(39, 39, true), true);
    assert.equal(fns.isJobListComplete(39, null, true), true);
    assert.equal(fns.isJobListComplete(2000, 3000, false), false);
  });
});
