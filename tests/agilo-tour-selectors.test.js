/**
 * Alias Agiloshield du tour Driver.js.
 * Exécution : node --test tests/agilo-tour-selectors.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(
  path.join(__dirname, "../scripts/pages/tour/agilo-tour.js"),
  "utf8"
);

describe("agilo-tour selectors", () => {
  it("expose la version 1.0.0", () => {
    assert.match(SRC, /__AGILO_TOUR_VERSION__ = '1\.0\.0'/);
    assert.match(SRC, /agilo-tour\.js v1\.0\.0/);
  });

  it("alias anonymize vers la dropzone Agiloshield", () => {
    assert.match(
      SRC,
      /anonymize:\s*'\[data-tour="anonymize"\], #agfDropzone, \.agf-dropzone'/
    );
  });

  it("alias anon-historique vers la liste de jobs", () => {
    assert.match(
      SRC,
      /'anon-historique':\s*'\[data-tour="anon-historique"\], #agfAnonJobsWrap, \.agf-anon-jobs-list'/
    );
  });

  it("attend 8 s seulement sur les clés anonymiser", () => {
    assert.match(SRC, /var ANON_WAIT_MS\s+=\s+8000;/);
    assert.match(SRC, /var WAIT_MAX_MS\s+=\s+1500;/);
    assert.match(
      SRC,
      /s\.key==='anonymize' \|\| s\.key==='anon-historique'\) \? ANON_WAIT_MS : WAIT_MAX_MS/
    );
  });

  it("n’ajoute pas fallbackCenter sur l’étape drop anonymize", () => {
    const drop = SRC.match(
      /add\('\/dashboard\/anonymiser','anonymize'[\s\S]*?\);/
    );
    assert.ok(drop, "étape anonymize introuvable");
    assert.doesNotMatch(drop[0], /,\s*true\s*\);$/);
  });
});
