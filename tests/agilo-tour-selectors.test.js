/**
 * Tour Driver.js v2.0.1 (blueprint v24, seaux, hooks).
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
const ARCHIVE = fs.readFileSync(
  path.join(
    __dirname,
    "../scripts/pages/tour/archive/agilo-tour-v23-1.0.0.js"
  ),
  "utf8"
);

function resolveBucketFromSource(persona, useCase) {
  const fnMatch = SRC.match(
    /function resolveBucket\(ctx\)\{[\s\S]*?return 'default';\n  \}/
  );
  assert.ok(fnMatch, "resolveBucket introuvable");
  const normMatch = SRC.match(
    /function norm\(s\)\{[\s\S]*?\.trim\(\);\n  \}/
  );
  assert.ok(normMatch, "norm introuvable");
  const fn = new Function(
    `${normMatch[0]}\n${fnMatch[0]}\nreturn resolveBucket;`
  )();
  return fn({ persona, useCase });
}

describe("archive v23", () => {
  it("garde le SHA 7d5a786b et l’état v23", () => {
    assert.match(ARCHIVE, /ARCHIVE figee/);
    assert.match(ARCHIVE, /7d5a786b/);
    assert.match(ARCHIVE, /agilo_tour_state_v23/);
    assert.match(ARCHIVE, /__AGILO_TOUR_VERSION__ = '1\.0\.0'/);
  });
});

describe("agilo-tour v2", () => {
  it("expose la version 2.0.1 et le storage v24", () => {
    assert.match(SRC, /agilo-tour\.js v2\.0\.1/);
    assert.match(SRC, /__AGILO_TOUR_VERSION__ = '2\.0\.1'/);
    assert.match(SRC, /agilo_tour_state_v24/);
    assert.match(SRC, /agilo_tour_first_seen_v24/);
    assert.match(SRC, /agilo_tour_completed_v24/);
    assert.doesNotMatch(SRC, /agilo_tour_state_v23/);
  });

  it("définit les 4 seaux + fallback default", () => {
    assert.match(SRC, /default:\s*\{/);
    assert.match(SRC, /public:\s*\{/);
    assert.match(SRC, /dirigeant:\s*\{/);
    assert.match(SRC, /equipe:\s*\{/);
    assert.match(SRC, /bucket: 'default'/);
  });

  it("mappe les radios /auth/setup vers les seaux", () => {
    assert.equal(resolveBucketFromSource("", ""), "default");
    assert.equal(resolveBucketFromSource("skipped", ""), "default");
    assert.equal(
      resolveBucketFromSource("Dirigeant / Fondateur", "Rendez-vous clients"),
      "dirigeant"
    );
    assert.equal(
      resolveBucketFromSource("Salarié / Employé", "Réunions d’équipe / projets"),
      "equipe"
    );
    assert.equal(
      resolveBucketFromSource("Manager / Responsable d’équipe", ""),
      "equipe"
    );
    assert.equal(
      resolveBucketFromSource("", "Rendez-vous juridiques"),
      "public"
    );
    assert.equal(
      resolveBucketFromSource("Profession libérale / Indépendant", "Appels de vente"),
      "default"
    );
  });

  it("alias les hooks stables (picker, share, Word, fichier)", () => {
    assert.match(SRC, /'prompt-picker':\s*'\[data-tour="prompt-picker"\], #agilo-prompt-picker-anchor/);
    assert.match(SRC, /'wb-picker':\s*'\[data-tour="wb-picker"\], #agilo-wb-picker-anchor/);
    assert.match(SRC, /'share-job':\s*'\[data-tour="share-job"\], \.agilo-row-share, #shareLink'/);
    assert.match(SRC, /'download-transcript':\s*'\[data-tour="download-transcript"\], #exportBtn/);
    assert.match(SRC, /file:\s*'\[data-tour="file"\].*#panel-file/);
    assert.match(SRC, /submit:\s*'\[data-tour="submit"\], #submit-button'/);
  });

  it("garde les alias Agiloshield", () => {
    assert.match(
      SRC,
      /anonymize:\s*'\[data-tour="anonymize"\], #agfDropzone, \.agf-dropzone'/
    );
    assert.match(SRC, /var ANON_WAIT_MS\s+=\s+8000;/);
  });

  it("pose data-ms-member meeting-tool si le nœud manque", () => {
    assert.match(SRC, /data-ms-member', 'meeting-tool'/);
    assert.match(SRC, /id = 'ms-meeting-tool'/);
    assert.match(SRC, /\$memberstackDom/);
  });

  it("blueprint court : stop C’est bon / Continuer, pas de catalogue", () => {
    assert.match(SRC, /FIRST_STOP_INDEX = 7/);
    assert.match(SRC, /absoluteIndex <= FIRST_STOP_INDEX/);
    assert.match(SRC, /stopChoice === 'continue'/);
    assert.match(SRC, /stop:true/);
    assert.match(SRC, /C’est bon/);
    assert.match(SRC, /Continuer/);
    assert.match(SRC, /completeFirstRun/);
    assert.match(SRC, /skipIfNoJob:true/);
    assert.doesNotMatch(SRC, /add\('\/dashboard','credits-display'/);
    assert.doesNotMatch(SRC, /add\('\/profile','webhook'/);
    assert.doesNotMatch(SRC, /ia-analyses/);
    assert.doesNotMatch(SRC, /fallbackCenter:true/);
  });

  it("compte 18 add() (8 + suite)", () => {
    const adds = SRC.match(/\n    add\(/g) || [];
    assert.equal(adds.length, 18);
  });

  it("skip les hooks absents (pas de highlight fantôme)", () => {
    assert.match(SRC, /step\.__skip=true/);
    assert.match(SRC, /function hasOpenableJob/);
    assert.match(SRC, /jumpToNextRoute/);
    assert.match(SRC, /\\\/app\\\/free\\b/);
  });
});
