/**
 * Checkout CSE 89/890 : connecté = Stripe add, invité = Sign up Business.
 * @version 1.0.0
 */
(function (root) {
  "use strict";

  var VERSION = "1.0.0";
  var PRICE_ANNUAL = "prc_cse89y-jl40a31";
  var PRICE_MONTHLY = "prc_cse89-8230aqy";
  var PRICE_SET = {};
  PRICE_SET[PRICE_ANNUAL] = true;
  PRICE_SET[PRICE_MONTHLY] = true;
  var STORAGE_KEY = "agiloCsePriceId";
  var STORAGE_AT = "agiloCsePriceAt";
  var MAX_AGE_MS = 2 * 60 * 60 * 1000;
  var SIGNUP_BASE = "/auth/sign-up-business?plan=";
  var LIBRARY = "/app/business/library";
  var ACTIVE = { ACTIVE: 1, TRIALING: 1, GRACE: 1 };

  function isWhitelisted(id) {
    return !!PRICE_SET[String(id || "")];
  }

  function api() {
    return root.$memberstackDom || root.MemberStack || null;
  }

  function memberOf(res) {
    var m = res && res.data !== undefined ? res.data : res;
    return m && m.id ? m : null;
  }

  function planIdOf(p) {
    return String((p && (p.planId || (p.plan && p.plan.id) || p.id)) || "");
  }

  function priceIdOf(p) {
    var pay = (p && p.payment) || {};
    return String(pay.priceId || (p && p.priceId) || "");
  }

  function isActivePlan(p) {
    var s = String((p && p.status) || "").toUpperCase();
    if (s) return !!ACTIVE[s];
    if (p && typeof p.active === "boolean") return p.active;
    return false;
  }

  function hasCsePlan(member) {
    if (!member) return false;
    var list = [].concat(member.planConnections || [], member.plans || []);
    var i;
    for (i = 0; i < list.length; i += 1) {
      var p = list[i];
      if (!isActivePlan(p)) continue;
      if (planIdOf(p).indexOf("pln_cse-") === 0) return true;
      if (isWhitelisted(priceIdOf(p))) return true;
    }
    return false;
  }

  function persistPrice(id) {
    if (!isWhitelisted(id) || typeof sessionStorage === "undefined") return false;
    sessionStorage.setItem(STORAGE_KEY, id);
    sessionStorage.setItem(STORAGE_AT, String(Date.now()));
    return true;
  }

  function readPendingPrice(now) {
    if (typeof sessionStorage === "undefined") return "";
    var id = sessionStorage.getItem(STORAGE_KEY) || "";
    var at = Number(sessionStorage.getItem(STORAGE_AT) || "0");
    var ts = typeof now === "number" ? now : Date.now();
    if (!isWhitelisted(id)) return "";
    if (!at || ts - at > MAX_AGE_MS) return "";
    return id;
  }

  function consumePendingPrice(now) {
    var id = readPendingPrice(now);
    if (typeof sessionStorage === "undefined") return id;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_AT);
    return id;
  }

  function signupUrl(id) {
    return SIGNUP_BASE + encodeURIComponent(id);
  }

  function log(event, payload) {
    var row = { event: event, version: VERSION };
    var k;
    if (payload) {
      for (k in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, k)) row[k] = payload[k];
      }
    }
    if (typeof console !== "undefined" && console.info) {
      console.info("[AGILO_CSE_PAY]", row);
    }
  }

  function toast(message) {
    if (typeof document === "undefined") return;
    var el = document.getElementById("agilo-cse-pay-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "agilo-cse-pay-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;z-index:2147483646;left:50%;bottom:1.5rem;transform:translateX(-50%);max-width:28rem;padding:0.75rem 1rem;border-radius:0.5rem;background:#1b365d;color:#fff;font:600 0.875rem/1.4 Montserrat,sans-serif;box-shadow:0 8px 24px rgba(27,54,93,.25);";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    setTimeout(function () { el.hidden = true; }, 6000);
  }

  function waitForMemberstack(timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function (resolve) {
      var started = Date.now();
      (function tick() {
        var ms = api();
        if (ms && typeof ms.getCurrentMember === "function") {
          resolve(ms);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(null);
          return;
        }
        setTimeout(tick, 120);
      })();
    });
  }

  function ensureHiddenAdd(priceId) {
    if (typeof document === "undefined") return null;
    var sid = "agilo-cse-ms-add-" + priceId;
    var b = document.getElementById(sid);
    if (b) return b;
    b = document.createElement("button");
    b.type = "button";
    b.id = sid;
    b.setAttribute("data-ms-price:add", priceId);
    b.setAttribute("aria-hidden", "true");
    b.tabIndex = -1;
    b.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(b);
    return b;
  }

  function checkoutAdd(priceId) {
    var ms = api();
    if (ms && typeof ms.purchasePlansWithCheckout === "function") {
      return Promise.resolve(ms.purchasePlansWithCheckout({ priceId: priceId }));
    }
    if (ms && typeof ms.openCheckout === "function") {
      return Promise.resolve(ms.openCheckout({ priceId: priceId }));
    }
    var hidden = ensureHiddenAdd(priceId);
    if (hidden) {
      hidden.click();
      return Promise.resolve({ via: "data-ms-price:add" });
    }
    return Promise.reject(new Error("NO_CHECKOUT_API"));
  }

  function goSignup(priceId) {
    persistPrice(priceId);
    if (typeof window !== "undefined") window.location.href = signupUrl(priceId);
  }

  function startCheckout(priceId, opts) {
    opts = opts || {};
    var allowGuestRedirect = opts.allowGuestRedirect !== false;
    if (!isWhitelisted(priceId)) {
      log("price_rejected", { priceId: priceId });
      return Promise.resolve({ ok: false, reason: "bad_price" });
    }
    log("start", { priceId: priceId });
    return waitForMemberstack().then(function (ms) {
      if (!ms) {
        log("memberstack_unavailable", { priceId: priceId, allowGuestRedirect: allowGuestRedirect });
        if (allowGuestRedirect) goSignup(priceId);
        else toast("Memberstack n’est pas prêt. Recharge la page.");
        return { ok: false, reason: "no_ms" };
      }
      return Promise.resolve(ms.getCurrentMember()).then(function (res) {
        var member = memberOf(res);
        if (!member) {
          log("guest", { priceId: priceId, allowGuestRedirect: allowGuestRedirect });
          if (allowGuestRedirect) goSignup(priceId);
          return { ok: false, reason: "guest" };
        }
        if (hasCsePlan(member)) {
          log("already_cse", { memberId: member.id });
          if (typeof window !== "undefined") window.location.replace(LIBRARY);
          return { ok: true, reason: "already_cse" };
        }
        return checkoutAdd(priceId).then(function () {
          log("checkout_opened", { priceId: priceId, memberId: member.id });
          return { ok: true, reason: "checkout" };
        }).catch(function (err) {
          log("checkout_error", { error: String((err && err.message) || err), priceId: priceId });
          toast("Le paiement n’a pas pu s’ouvrir. Réessaie, ou contacte le support.");
          return { ok: false, reason: "checkout_error" };
        });
      });
    }).catch(function (err) {
      log("start_error", { error: String((err && err.message) || err) });
      toast("Le paiement n’a pas pu s’ouvrir. Réessaie, ou contacte le support.");
      return { ok: false, reason: "start_error" };
    });
  }

  var exported = {
    VERSION: VERSION,
    PRICE_ANNUAL: PRICE_ANNUAL,
    PRICE_MONTHLY: PRICE_MONTHLY,
    STORAGE_KEY: STORAGE_KEY,
    STORAGE_AT: STORAGE_AT,
    MAX_AGE_MS: MAX_AGE_MS,
    isWhitelisted: isWhitelisted,
    memberOf: memberOf,
    hasCsePlan: hasCsePlan,
    persistPrice: persistPrice,
    readPendingPrice: readPendingPrice,
    consumePendingPrice: consumePendingPrice,
    signupUrl: signupUrl,
    startCheckout: startCheckout,
    checkoutAdd: checkoutAdd
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
  root.AgiloCseCheckout = exported;

  if (typeof document === "undefined") return;
  if (root.__agiloCsePay) return;
  root.__agiloCsePay = true;

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("[data-agilo-cse-price]");
    if (!el) return;
    var id = el.getAttribute("data-agilo-cse-price");
    if (!isWhitelisted(id)) return;
    e.preventDefault();
    startCheckout(id);
  });

  function bootPayQuery() {
    if (typeof window === "undefined" || !window.location) return;
    var params = new URLSearchParams(window.location.search || "");
    var pay = params.get("pay") || "";
    if (!isWhitelisted(pay)) return;
    startCheckout(pay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPayQuery);
  } else {
    bootPayQuery();
  }
})(typeof window !== "undefined" ? window : globalThis);
