/**
 * Tour Driver.js v2.1.2 (blueprint v25, Terminer = primaire, progress FR).
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

function loadIsHighlightable() {
  const fnMatch = SRC.match(
    /function isHighlightable\(el\)\{[\s\S]*?catch \(_\) \{ return false; \}\n  \}/
  );
  assert.ok(fnMatch, "isHighlightable introuvable");
  return new Function(
    "window",
    `${fnMatch[0]}\nreturn isHighlightable;`
  );
}

function loadFirstHighlightable() {
  const hi = SRC.match(
    /function isHighlightable\(el\)\{[\s\S]*?catch \(_\) \{ return false; \}\n  \}/
  );
  const first = SRC.match(
    /function firstHighlightable\(sel\)\{[\s\S]*?return null;\n  \}/
  );
  assert.ok(hi && first, "firstHighlightable introuvable");
  return new Function(
    "window",
    "document",
    `${hi[0]}\n${first[0]}\nreturn firstHighlightable;`
  );
}

describe("archive v23", () => {
  it("garde le SHA 7d5a786b et l’état v23", () => {
    assert.match(ARCHIVE, /ARCHIVE figee/);
    assert.match(ARCHIVE, /7d5a786b/);
    assert.match(ARCHIVE, /agilo_tour_state_v23/);
    assert.match(ARCHIVE, /__AGILO_TOUR_VERSION__ = '1\.0\.0'/);
  });
});

describe("agilo-tour v2.1", () => {
  it("expose la version 2.1.2 et le storage v25", () => {
    assert.match(SRC, /agilo-tour\.js v2\.1\.2/);
    assert.match(SRC, /__AGILO_TOUR_VERSION__ = '2\.1\.2'/);
    assert.match(SRC, /agilo_tour_state_v25/);
    assert.match(SRC, /agilo_tour_first_seen_v25/);
    assert.match(SRC, /agilo_tour_completed_v25/);
    assert.doesNotMatch(SRC, /agilo_tour_state_v24/);
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

  it("alias les hooks visibles (picker, share, ed-actions, audio wrap, save)", () => {
    assert.match(SRC, /'prompt-picker':\s*'\[data-tour="prompt-picker"\], #agilo-prompt-picker-anchor/);
    assert.match(SRC, /'wb-picker':\s*'\[data-tour="wb-picker"\], #agilo-wb-picker-anchor/);
    assert.match(SRC, /'share-job':\s*'\[data-tour="share-job"\], \.agilo-row-share, #shareLink'/);
    assert.match(SRC, /'download-transcript':\s*'\[data-tour="download-transcript"\], \.ed-actions'/);
    assert.match(SRC, /audio:\s*'\[data-tour="audio"\], #agilo-audio-wrap, #ag-editor-audio-row, #agilo-play'/);
    assert.match(SRC, /save:\s*'\[data-tour="save"\], button\[data-action="save-transcript"\]/);
    assert.match(SRC, /file:\s*'\[data-tour="file"\].*#panel-file/);
    assert.match(SRC, /submit:\s*'\[data-tour="submit"\], #submit-button'/);
    assert.match(SRC, /'editor-open':\s*'\[data-tour="editor-open"\], button\.button-open'/);
    assert.doesNotMatch(SRC, /#exportBtn/);
    assert.doesNotMatch(SRC, /#audioPlayer/);
    assert.doesNotMatch(SRC, /audio, \.ed-audio/);
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

  it("blueprint : 2 stops, library, pas de nav-library vers anonymiser", () => {
    assert.match(SRC, /FIRST_STOP_INDEX = 7/);
    assert.match(SRC, /_gIndex <= FIRST_STOP_INDEX/);
    assert.match(SRC, /_gIndex > FIRST_STOP_INDEX/);
    assert.match(SRC, /stopChoice === 'continue'/);
    assert.match(SRC, /stop:true/);
    assert.match(SRC, /C’est bon/);
    assert.match(SRC, /ferme le guide/);
    assert.match(SRC, /title:'Télécharger'/);
    assert.match(SRC, /Continuer/);
    assert.match(SRC, /completeFirstRun/);
    assert.match(SRC, /skipIfNoJob:true/);
    assert.match(SRC, /canShowAgiloshield/);
    assert.match(SRC, /add\('\/library','lib-tabs'/);
    assert.match(SRC, /add\('\/library','lib-create'/);
    assert.match(SRC, /'\/library'/);
    assert.match(SRC, /'\/bibliotheque': '\/library'/);
    assert.doesNotMatch(SRC, /nav-library/);
    assert.doesNotMatch(SRC, /clôt/);
    assert.doesNotMatch(SRC, /add\('\/dashboard','credits-display'/);
    assert.doesNotMatch(SRC, /add\('\/profile','webhook'/);
    assert.doesNotMatch(SRC, /ia-analyses/);
    assert.doesNotMatch(SRC, /fallbackCenter:true/);
  });

  it("compte 19 add() (8 + suite editor + library + support + shield)", () => {
    const adds = SRC.match(/\n    add\(/g) || [];
    assert.equal(adds.length, 19);
  });

  it("skip les hooks absents (pas d’ancre 1px si navigateTo)", () => {
    assert.match(SRC, /step\.__skip=true/);
    assert.match(SRC, /function hasOpenableJob/);
    assert.match(SRC, /jumpToNextRoute/);
    assert.match(SRC, /\\\/app\\\/free\\b/);
    assert.match(SRC, /if \(s\.fallbackCenter\)\{ step\.element=ensureCenterAnchor/);
    assert.doesNotMatch(
      SRC,
      /if \(s\.fallbackCenter \|\| s\.navigateTo\)\{ step\.element=ensureCenterAnchor/
    );
  });

  it("force l’onglet transcription avant audio / télécharger / save", () => {
    assert.match(SRC, /function ensureTranscriptTab/);
    assert.match(SRC, /ensureTab\('transcript'\)/);
    assert.match(SRC, /STEP_TAB = \{ audio:'transcript', 'download-transcript':'transcript', save:'transcript' \}/);
  });

  it("Support stop : Continuer Agiloshield seulement hors Free", () => {
    assert.match(SRC, /add\('\/dashboard','nav-support','nav-support','right','center', null, \{ stop:true \}\)/);
    assert.match(SRC, /if \(s\.key==='nav-support' && canShowAgiloshield\(\)\)/);
    assert.match(SRC, /step\.__nav = '\/dashboard\/anonymiser'/);
    assert.match(SRC, /function patchStopFooter\(showContinue, doneLabel\)/);
    assert.match(SRC, /var showContinue = isFirstStop \|\| canShowAgiloshield\(\)/);
    assert.match(SRC, /driver-popover-next-btn driver-popover-done-btn/);
    assert.match(SRC, /progressText:'\{\{current\}\} \/ \{\{total\}\}'/);
    assert.match(SRC, /title:'Réécouter'/);
    assert.match(SRC, /title:'Bibliothèque'/);
    assert.match(SRC, /title:'C’est bon \?'/);
    assert.match(SRC, /Étape '/);
    assert.match(SRC, /déjà écrit/);
    assert.match(SRC, /épinglés/);
    assert.doesNotMatch(SRC, /progressText:.* of /);
  });

  it("attend les jobs Mes fichiers une fois, sans /editor nu", () => {
    assert.match(SRC, /function waitForJobs/);
    assert.match(SRC, /var JOBS_WAIT_MS\s+=\s+8000;/);
    assert.match(SRC, /LAUNCH_GUARD\.building/);
    assert.match(SRC, /function editorUrlFrom/);
    assert.match(SRC, /data-editor-url/);
    assert.match(SRC, /function resolveNavTarget/);
    assert.match(SRC, /function patchNavFooter/);
    assert.match(SRC, /route === '\/mes-transcripts'\) \? waitForJobs/);
    assert.match(SRC, /:not\(\[data-job-id=""\]\)|:not\(\[data-job-id="\\"\]\)|\.wrapper-content_item-row\[data-job-id\]/);
    assert.doesNotMatch(SRC, /add\('\/mes-transcripts','editor-open','editor-open','center','center','\/editor'/);
    assert.doesNotMatch(SRC, /a\[href\*="\/editor"\]/);
    assert.match(SRC, /if \(id && String\(id\)\.trim\(\)\) return true/);
  });
});

describe("hasOpenableJob", () => {
  it("refuse data-job-id vide et accepte un row avec id", () => {
    const fnMatch = SRC.match(
      /function hasOpenableJob\(\)\{\n    var rows = document\.querySelectorAll\('\.wrapper-content_item-row\[data-job-id\]'\);[\s\S]*?return false;\n  \}/
    );
    assert.ok(fnMatch, "hasOpenableJob introuvable");
    function run(nodes) {
      const fn = new Function(
        "document",
        `${fnMatch[0]}\nreturn hasOpenableJob;`
      )({ querySelectorAll: () => nodes });
      return fn();
    }
    assert.equal(
      run([{ getAttribute: () => "" }]),
      false
    );
    assert.equal(
      run([{ getAttribute: () => "   " }]),
      false
    );
    assert.equal(
      run([{ getAttribute: () => "1000040316" }]),
      true
    );
  });
});

describe("isHighlightable", () => {
  it("refuse un rect 0×0 et accepte un bloc visible ≥ 8×8", () => {
    const make = loadIsHighlightable();
    const isHighlightable = make({
      getComputedStyle: (el) => el.__style
    });
    const hidden = {
      nodeType: 1,
      __style: { display: "block", visibility: "visible", opacity: "1" },
      getBoundingClientRect: () => ({ width: 0, height: 0 })
    };
    const visible = {
      nodeType: 1,
      __style: { display: "block", visibility: "visible", opacity: "1" },
      getBoundingClientRect: () => ({ width: 120, height: 40 })
    };
    const none = {
      nodeType: 1,
      __style: { display: "none", visibility: "visible", opacity: "1" },
      getBoundingClientRect: () => ({ width: 120, height: 40 })
    };
    assert.equal(isHighlightable(hidden), false);
    assert.equal(isHighlightable(visible), true);
    assert.equal(isHighlightable(none), false);
  });

  it("prend le premier match highlightable, pas le premier du DOM", () => {
    const make = loadFirstHighlightable();
    const tiny = {
      nodeType: 1,
      __style: { display: "block", visibility: "visible", opacity: "1" },
      getBoundingClientRect: () => ({ width: 1, height: 1 })
    };
    const big = {
      nodeType: 1,
      __style: { display: "block", visibility: "visible", opacity: "1" },
      getBoundingClientRect: () => ({ width: 80, height: 24 })
    };
    const firstHighlightable = make(
      { getComputedStyle: (el) => el.__style },
      { querySelectorAll: () => [tiny, big] }
    );
    assert.equal(firstHighlightable("audio"), big);
  });
});
