/**
 * Sidecar formatInvestigationPv : allowlist + contrat HTTP.
 * Exécution : node --test tests/format-investigation-pv.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const api = require("../scripts/pages/shared/format-investigation-pv.js");

describe("isInvestigationPvPromptId", () => {
  it("autorise Bauer 705–712", () => {
    assert.equal(api.isInvestigationPvPromptId(705), true);
    assert.equal(api.isInvestigationPvPromptId(712), true);
  });

  it("autorise Magali 713–720", () => {
    assert.equal(api.isInvestigationPvPromptId(713), true);
    assert.equal(api.isInvestigationPvPromptId(720), true);
  });

  it("refuse 700 / 703 / 704 / 787 / CSE", () => {
    [700, 703, 704, 787, 680, -1, "", null].forEach((id) => {
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
  it("montre 705 READY et 713 ON_ERROR", () => {
    assert.equal(api.shouldShowInvestigationPvLink(705, "READY_SUMMARY_READY"), true);
    assert.equal(api.shouldShowInvestigationPvLink(713, "READY_SUMMARY_ON_ERROR"), true);
  });

  it("cache 787 même READY", () => {
    assert.equal(api.shouldShowInvestigationPvLink(787, "READY_SUMMARY_READY"), false);
  });
});

describe("buildFormBody", () => {
  it("envoie les 5 champs en x-www-form-urlencoded", () => {
    const body = api.buildFormBody({
      username: "bauerwebpro@gmail.com",
      token: "tok",
      edition: "ent",
      jobId: "1000040858",
      templateId: "705"
    });
    const params = new URLSearchParams(body);
    assert.equal(params.get("username"), "bauerwebpro@gmail.com");
    assert.equal(params.get("token"), "tok");
    assert.equal(params.get("edition"), "ent");
    assert.equal(params.get("jobId"), "1000040858");
    assert.equal(params.get("templateId"), "705");
  });
});

describe("parseContentDispositionFilename", () => {
  it("lit filename et retombe sur PV_enquete_<jobId>.docx", () => {
    assert.equal(
      api.parseContentDispositionFilename(
        'attachment; filename="PV_enquete_1000040858.docx"',
        "1000040858"
      ),
      "PV_enquete_1000040858.docx"
    );
    assert.equal(
      api.parseContentDispositionFilename("", "1000039953"),
      "PV_enquete_1000039953.docx"
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
      username: "a@b.c",
      token: "t",
      edition: "ent",
      jobId: "1000040858",
      templateId: "705",
      fetch: fetchFn,
      triggerDownload: () => {}
    });
    const second = await api.downloadInvestigationPv({
      username: "a@b.c",
      token: "t",
      edition: "ent",
      jobId: "1000040858",
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
