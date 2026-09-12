/**
 * Tests checkout CSE (whitelist, pending session, hasCsePlan).
 * node --test tests/cse-checkout.test.js
 */
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const store = {};
global.sessionStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

const cse = require("../scripts/pages/marketing/cse-checkout.js");

describe("cse-checkout whitelist", () => {
  it("accepte 89 et 890", () => {
    assert.equal(cse.isWhitelisted("prc_cse89-8230aqy"), true);
    assert.equal(cse.isWhitelisted("prc_cse89y-jl40a31"), true);
  });
  it("refuse Business et vide", () => {
    assert.equal(cse.isWhitelisted("prc_business-1-seat-aj1780sye"), false);
    assert.equal(cse.isWhitelisted(""), false);
  });
});

describe("pending session", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });
  it("persiste et relit dans les 2 h", () => {
    const now = 1_000_000;
    assert.equal(cse.persistPrice("prc_cse89y-jl40a31"), true);
    store.agiloCsePriceAt = String(now);
    assert.equal(cse.readPendingPrice(now + 60 * 1000), "prc_cse89y-jl40a31");
  });
  it("expire après 2 h", () => {
    cse.persistPrice("prc_cse89-8230aqy");
    const now = Number(store.agiloCsePriceAt);
    assert.equal(cse.readPendingPrice(now + 3 * 60 * 60 * 1000), "");
  });
  it("consume est one-shot", () => {
    cse.persistPrice("prc_cse89y-jl40a31");
    const id = cse.consumePendingPrice();
    assert.equal(id, "prc_cse89y-jl40a31");
    assert.equal(cse.readPendingPrice(), "");
  });
  it("refuse un price hors whitelist en storage", () => {
    store.agiloCsePriceId = "prc_business-1-seat-aj1780sye";
    store.agiloCsePriceAt = String(Date.now());
    assert.equal(cse.readPendingPrice(), "");
  });
});

describe("hasCsePlan", () => {
  it("détecte pln_cse- actif", () => {
    assert.equal(cse.hasCsePlan({
      planConnections: [{ status: "ACTIVE", planId: "pln_cse-5920aby", active: true }]
    }), true);
  });
  it("détecte price 890 actif", () => {
    assert.equal(cse.hasCsePlan({
      planConnections: [{
        status: "ACTIVE",
        planId: "pln_unknown",
        payment: { priceId: "prc_cse89y-jl40a31" }
      }]
    }), true);
  });
  it("ignore CSE canceled et Business actif", () => {
    assert.equal(cse.hasCsePlan({
      planConnections: [
        { status: "CANCELED", planId: "pln_cse-5920aby", active: false },
        { status: "ACTIVE", planId: "pln_business-2-seats--un1770epi", active: true }
      ]
    }), false);
  });
});

describe("memberOf", () => {
  it("lit data.id v2", () => {
    assert.equal(cse.memberOf({ data: { id: "mem_1" } }).id, "mem_1");
  });
  it("null si data null", () => {
    assert.equal(cse.memberOf({ data: null }), null);
  });
});
