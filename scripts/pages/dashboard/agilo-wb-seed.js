/**
 * Première connexion Premium / Business : thème WordBoost « Mes mots »
 * si le compte n'a encore aucun thème. Pas de toast. Pas de Free.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.document && typeof root.fetch === "function") api.boot(root);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var API = "https://api.agilotext.com/api/v1";
  var THEME_NAME = "Mes mots";
  var MARKER_KEY = "wb-seed-v1";
  var LOCK_KEY = "wb-seed-lock";
  var LOCK_MS = 30000;
  var MIN_WORD_LEN = 2;
  var MAX_WORD_LEN = 100;
  var WORD_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9''\-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ0-9''\-]+){0,5}$/;

  function trimWord(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function sanitizeWordList(words) {
    var out = [];
    var seen = {};
    (words || []).forEach(function (raw) {
      var normalized = trimWord(raw);
      if (normalized.length < MIN_WORD_LEN || normalized.length > MAX_WORD_LEN) return;
      if (normalized.indexOf("@") !== -1) return;
      if (!WORD_RE.test(normalized)) return;
      var key = normalized.toLocaleLowerCase("fr");
      if (seen[key]) return;
      seen[key] = 1;
      out.push(normalized);
    });
    return out;
  }

  function buildSeedWords(firstName, lastName) {
    var words = sanitizeWordList([firstName, lastName, "Agilotext"]);
    var hasBrand = words.some(function (word) {
      return word.toLocaleLowerCase("fr") === "agilotext";
    });
    if (!hasBrand) words.push("Agilotext");
    return words;
  }

  function parseCatalog(payload) {
    var body = payload || {};
    var list = (body.boostNamesDTOList || []).map(function (item) {
      return { id: +item.boostId || 0, name: String(item.boostName || "") };
    }).filter(function (item) {
      return item.id > 0;
    });
    return { defaultId: +body.defaultBoostId || 0, list: list };
  }

  function shouldCreate(catalog) {
    return !catalog || !catalog.list || catalog.list.length === 0;
  }

  function acquireLock(storage, now) {
    var stamp = Number(storage.getItem(LOCK_KEY) || 0);
    if (stamp && now - stamp < LOCK_MS) return false;
    storage.setItem(LOCK_KEY, String(now));
    return true;
  }

  function releaseLock(storage) {
    try { storage.removeItem(LOCK_KEY); } catch (err) { /* ignore */ }
  }

  function editionFrom(win) {
    var doc = win.document;
    var named = doc && doc.querySelector ? doc.querySelector('[name="edition"]') : null;
    var raw = named && (named.value || named.getAttribute("value"));
    var fromWindow = win.edition;
    var value = String(raw || fromWindow || "").toLowerCase();
    if (value === "pro" || value === "premium") return "pro";
    if (value === "ent" || value === "business") return "ent";
    var path = String((win.location && win.location.pathname) || "").toLowerCase();
    if (path.indexOf("/app/premium") !== -1 || path.indexOf("/app/pro/") !== -1) return "pro";
    if (path.indexOf("/app/business") !== -1) return "ent";
    return "";
  }

  function memberNames(member) {
    var fields = (member && member.customFields) || {};
    return {
      id: String((member && (member.id || member.memberId)) || ""),
      firstName: fields["first-name"] || fields.firstName || "",
      lastName: fields["last-name"] || fields.lastName || ""
    };
  }

  function post(win, route, params) {
    return win.fetch(API + "/" + route, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      credentials: "omit"
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      try { return JSON.parse(text); } catch (err) { return { status: "ERROR" }; }
    });
  }

  function boot(win) {
    var storage = win.localStorage;
    if (!storage) return;
    var edition = editionFrom(win);
    if (edition !== "pro" && edition !== "ent") return;
    var ms = win.$memberstackDom;
    if (!ms || typeof ms.getCurrentMember !== "function") return;

    ms.getCurrentMember().then(function (result) {
      var member = (result && (result.data || result.member)) || result || {};
      var names = memberNames(member);
      if (!names.id) return;
      if (storage.getItem(MARKER_KEY) === names.id) return;
      if (!acquireLock(storage, Date.now())) return;

      var email = String((member.auth && member.auth.email) || member.email || "").trim();
      if (!email) {
        var emailEl = win.document.querySelector('[data-ms-member="email"], [name="memberEmail"]');
        email = emailEl ? String(emailEl.value || emailEl.textContent || "").trim() : "";
      }
      if (!email) {
        releaseLock(storage);
        return;
      }

      var tokenPromise = win.globalToken
        ? Promise.resolve(win.globalToken)
        : post(win, "getToken", { username: email, edition: edition }).then(function (body) {
          return body && body.status === "OK" ? body.token : "";
        });

      return tokenPromise.then(function (token) {
        if (!token) {
          releaseLock(storage);
          return;
        }
        return post(win, "getWordBoostInfo2", {
          username: email,
          token: token,
          edition: edition
        }).then(function (info) {
          var catalog = parseCatalog(info);
          if (!shouldCreate(catalog)) {
            storage.setItem(MARKER_KEY, names.id);
            releaseLock(storage);
            return;
          }
          var words = buildSeedWords(names.firstName, names.lastName);
          return post(win, "setWordBoost2", {
            username: email,
            token: token,
            edition: edition,
            boostId: "0",
            boostName: THEME_NAME,
            wordBoost: JSON.stringify({ wordBoost: words })
          }).then(function (created) {
            var boostId = created && (+created.boostId || +created.boost_id);
            if (!created || created.status !== "OK" || !boostId) {
              releaseLock(storage);
              return;
            }
            storage.setItem(MARKER_KEY, names.id);
            return post(win, "setWordBoostDefault2", {
              username: email,
              token: token,
              edition: edition,
              boostId: String(boostId)
            }).then(function () {
              releaseLock(storage);
            });
          });
        });
      }).catch(function (err) {
        releaseLock(storage);
        if (win.console) win.console.warn("[agilo-wb-seed]", err && err.message ? err.message : err);
      });
    }).catch(function () { /* membre pas encore là */ });
  }

  return {
    THEME_NAME: THEME_NAME,
    MARKER_KEY: MARKER_KEY,
    buildSeedWords: buildSeedWords,
    sanitizeWordList: sanitizeWordList,
    parseCatalog: parseCatalog,
    shouldCreate: shouldCreate,
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    editionFrom: editionFrom,
    memberNames: memberNames,
    boot: boot
  };
});
