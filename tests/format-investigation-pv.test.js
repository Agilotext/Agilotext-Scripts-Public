/**
 * Sidecar formatInvestigationPv : allowlist + contrat HTTP.
 * Exécution : node --test tests/format-investigation-pv.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const api = require("../scripts/pages/shared/format-investigation-pv.js");

describe("isInvestigationPvPromptId", () => {
  it("autorise tous les modèles 705–712, nombres et chaînes", () => {
    for (let id = 705; id <= 712; id += 1) {
      assert.equal(api.isInvestigationPvPromptId(id), true);
      assert.equal(api.isInvestigationPvPromptId(String(id)), true);
    }
  });

  it("autorise tous les modèles 713–720, nombres et chaînes", () => {
    for (let id = 713; id <= 720; id += 1) {
      assert.equal(api.isInvestigationPvPromptId(id), true);
      assert.equal(api.isInvestigationPvPromptId(String(id)), true);
    }
  });

  it("lit un abonnement CSE et reste fermé sinon", () => {
    assert.equal(api.readCseAccess({ businessTypes: ["cse"] }).noun, "PV");
    assert.equal(api.readCseAccess({ sources: ["plan:pln_cse-fixture"] }).hasCse, true);
    assert.equal(api.readCseAccess({ data: { business_types: "cse" } }).noun, "PV");
    assert.equal(api.readCseAccess({ approvedSubscriptionTypes: ["cse"] }).noun, "PV");
    assert.equal(api.readCseAccess({ businessTypes: ["generic"] }).noun, "compte rendu");
    assert.equal(api.readCseAccess(null).hasCse, false);
  });

  it("refuse 1107/1108 et les bornes extérieures", () => {
    [1106, 1107, 1108, "1107", "1108", 1109, 700, 703, 704, 721, 787, 680, -1, "", null].forEach((id) => {
      assert.equal(api.isInvestigationPvPromptId(id), false, String(id));
    });
  });
});

describe("isReadyStatus", () => {
  it("accepte tout READY_SUMMARY_* y compris ON_ERROR", () => {
    assert.equal(api.isReadyStatus("READY_SUMMARY_READY"), true);
    assert.equal(api.isReadyStatus("READY_SUMMARY_ON_ERROR"), true);
    assert.equal(api.isReadyStatus("READY_SUMMARY_PENDING"), true);
  });

  it("refuse les autres statuts", () => {
    assert.equal(api.isReadyStatus("ON_ERROR"), false);
    assert.equal(api.isReadyStatus("IN_PROGRESS"), false);
    assert.equal(api.isReadyStatus(""), false);
  });
});

describe("shouldShowInvestigationPvLink", () => {
  it("cache les modèles 1107/1108 courants ou sélectionnés sans modèle PV", () => {
    for (const id of [1107, 1108]) {
      for (const status of ["READY_SUMMARY_READY", "READY_SUMMARY_ON_ERROR", "READY_SUMMARY_PENDING"]) {
        assert.equal(api.shouldShowInvestigationPvLink(id, status, id), false);
        assert.equal(api.shouldShowInvestigationPvLink(7, status, id), false);
      }
    }
  });

  it("conserve le lien de chaque modèle 705–720 prêt", () => {
    for (let id = 705; id <= 720; id += 1) {
      assert.equal(api.shouldShowInvestigationPvLink(id, "READY_SUMMARY_READY"), true);
      assert.equal(api.shouldShowInvestigationPvLink(id, "IN_PROGRESS"), false);
    }
  });

  it("préserve le choix PV et le repli sur le modèle PV du job", () => {
    assert.equal(api.shouldShowInvestigationPvLink(1107, "READY_SUMMARY_READY", 713), true);
    assert.equal(api.shouldShowInvestigationPvLink(713, "READY_SUMMARY_READY", 1107), true);
  });

  it("montre 705 READY et 713 ON_ERROR", () => {
    assert.equal(api.shouldShowInvestigationPvLink(705, "READY_SUMMARY_READY"), true);
    assert.equal(api.shouldShowInvestigationPvLink(713, "READY_SUMMARY_ON_ERROR"), true);
  });

  it("cache 787 même READY", () => {
    assert.equal(api.shouldShowInvestigationPvLink(787, "READY_SUMMARY_READY"), false);
  });

  it("montre le lien si le modèle choisi est un PV, même si le job est sur une fiche", () => {
    assert.equal(api.shouldShowInvestigationPvLink(7, "READY_SUMMARY_READY", 713), true);
    assert.equal(api.shouldShowInvestigationPvLink(7, "READY_SUMMARY_ON_ERROR", 713), true);
  });
});

describe("resolveInvestigationTemplateId", () => {
  it("ne résout jamais 1107/1108 comme modèle PV", () => {
    for (const id of [1107, 1108]) {
      assert.equal(api.resolveInvestigationTemplateId(id, id), "");
      assert.equal(api.resolveInvestigationTemplateId(id, 7), "");
      assert.equal(api.resolveInvestigationTemplateId(7, id), "");
    }
  });

  it("préserve les situations mixtes avec le modèle 713", () => {
    assert.equal(api.resolveInvestigationTemplateId(713, 1107), "713");
    assert.equal(api.resolveInvestigationTemplateId(1107, 713), "713");
  });

  it("prend le modèle choisi s'il est un PV", () => {
    assert.equal(api.resolveInvestigationTemplateId(713, 7), "713");
  });

  it("retombe sur le prompt du job", () => {
    assert.equal(api.resolveInvestigationTemplateId(0, 713), "713");
    assert.equal(api.resolveInvestigationTemplateId(7, 713), "713");
  });

  it("refuse un couple sans PV", () => {
    assert.equal(api.resolveInvestigationTemplateId(7, 844), "");
  });
});

describe("readStoredPromptId", () => {
  it("lit la clé du job", () => {
    const storage = { getItem: (k) => (k === "agilo:summaryPromptId:101" ? "713" : null) };
    assert.equal(api.readStoredPromptId(storage, "101"), 713);
    assert.equal(api.readStoredPromptId(storage, "102"), 0);
  });
});

describe("buildFormBody", () => {
  it("envoie les 5 champs en x-www-form-urlencoded", () => {
    const body = api.buildFormBody({
      username: "fixture-user",
      token: "tok",
      edition: "ent",
      jobId: "103",
      templateId: "705"
    });
    const params = new URLSearchParams(body);
    assert.equal(params.get("username"), "fixture-user");
    assert.equal(params.get("token"), "tok");
    assert.equal(params.get("edition"), "ent");
    assert.equal(params.get("jobId"), "103");
    assert.equal(params.get("templateId"), "705");
  });
});

describe("parseContentDispositionFilename", () => {
  it("lit filename et retombe sur PV_enquete_<jobId>.docx", () => {
    assert.equal(
      api.parseContentDispositionFilename(
        'attachment; filename="PV_enquete_103.docx"',
        "103"
      ),
      "PV_enquete_103.docx"
    );
    assert.equal(
      api.parseContentDispositionFilename("", "104"),
      "PV_enquete_104.docx"
    );
  });
});

describe("parseApiError", () => {
  it("affiche errorMessage serveur", () => {
    const err = api.parseApiError(
      JSON.stringify({ status: 422, code: "INVALID_CONTENT", errorMessage: "un seul ${CONTENT}" }),
      422
    );
    assert.equal(err.code, "INVALID_CONTENT");
    assert.equal(err.errorMessage, "un seul ${CONTENT}");
  });
});

describe("downloadInvestigationPv", () => {
  it("anti double-clic : 2e appel busy pendant le 1er", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const fetchFn = async () => {
      await gate;
      return {
        ok: true,
        status: 200,
        headers: { get: (k) => (k === "content-type" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "attachment; filename=PV.docx") },
        arrayBuffer: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer
      };
    };
    const first = api.downloadInvestigationPv({
      username: "fixture-user",
      token: "t",
      edition: "ent",
      jobId: "103",
      templateId: "705",
      fetch: fetchFn,
      triggerDownload: () => {}
    });
    const second = await api.downloadInvestigationPv({
      username: "fixture-user",
      token: "t",
      edition: "ent",
      jobId: "103",
      templateId: "705",
      fetch: fetchFn,
      triggerDownload: () => {}
    });
    assert.equal(second.busy, true);
    release();
    const done = await first;
    assert.equal(done.ok, true);
  });

  it("POST form, blob PK → ok", async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        headers: {
          get: (k) => {
            if (k === "content-type") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            if (k === "content-disposition") return 'attachment; filename="PV_enquete_1.docx"';
            return "";
          }
        },
        arrayBuffer: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]).buffer
      };
    };
    const downloaded = [];
    const res = await api.downloadInvestigationPv({
      username: "u",
      token: "tok",
      edition: "ent",
      jobId: "1",
      templateId: "713",
      fetch: fetchFn,
      triggerDownload: (blob, name) => downloaded.push({ size: blob.size, name })
    });
    assert.equal(calls[0].url, api.API_URL);
    assert.equal(calls[0].init.method, "POST");
    assert.match(calls[0].init.headers["Content-Type"], /application\/x-www-form-urlencoded/);
    assert.equal(new URLSearchParams(calls[0].init.body).get("templateId"), "713");
    assert.equal(res.ok, true);
    assert.equal(downloaded[0].name, "PV_enquete_1.docx");
  });

  it("JSON 422 → errorMessage", async () => {
    const fetchFn = async () => ({
      ok: false,
      status: 422,
      headers: { get: () => "application/json" },
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({
        status: 422,
        code: "INVALID_CONTENT",
        errorMessage: "trame sans un seul ${CONTENT}"
      })).buffer
    });
    const res = await api.downloadInvestigationPv({
      username: "u",
      token: "t",
      edition: "ent",
      jobId: "2",
      templateId: "713",
      fetch: fetchFn,
      triggerDownload: () => { throw new Error("no download"); }
    });
    assert.equal(res.ok, false);
    assert.match(res.errorMessage, /CONTENT/);
  });
});
