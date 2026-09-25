/** Audio and submission journal for the web Dictée solo. Separate from Record's recovery DB. */
(function (global) {
  "use strict";

  var DB_NAME = "agilo-dictee-solo-v1";
  var DRAFT_PREFIX = "agilotext:dicteeSoloDraftId:";
  var dbPromise = null;

  function emailKey(email) {
    return String(email || "").trim().toLowerCase();
  }

  function newId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    if (!global.crypto || typeof global.crypto.getRandomValues !== "function") {
      throw new Error("secure_id_unavailable");
    }
    global.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function getDraftId(email) {
    var key = DRAFT_PREFIX + emailKey(email);
    if (!emailKey(email)) throw new Error("missing_account");
    var id = global.localStorage.getItem(key);
    if (!id) {
      id = newId();
      global.localStorage.setItem(key, id);
    }
    return id;
  }

  function nextDraftId(email) {
    var id = newId();
    global.localStorage.setItem(DRAFT_PREFIX + emailKey(email), id);
    return id;
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) return reject(new Error("indexeddb_unavailable"));
      var request = global.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("sessions")) {
          var sessions = db.createObjectStore("sessions", { keyPath: "id" });
          sessions.createIndex("byDraft", ["email", "draftId"], { unique: false });
        }
        if (!db.objectStoreNames.contains("submissions")) {
          db.createObjectStore("submissions", { keyPath: "id" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { dbPromise = null; reject(request.error || new Error("indexeddb_open_failed")); };
      request.onblocked = function () { dbPromise = null; reject(new Error("indexeddb_blocked")); };
    });
    return dbPromise;
  }

  function put(store, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value);
        tx.oncomplete = function () { resolve(value); };
        tx.onerror = function () { reject(tx.error || new Error("indexeddb_write_failed")); };
        tx.onabort = function () { reject(tx.error || new Error("indexeddb_write_aborted")); };
      });
    });
  }

  function get(store, id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var request = db.transaction(store, "readonly").objectStore(store).get(id);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error || new Error("indexeddb_read_failed")); };
      });
    });
  }

  function listSessions(email, draftId) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var rows = [];
        var request = db.transaction("sessions", "readonly").objectStore("sessions")
          .index("byDraft").openCursor(global.IDBKeyRange.only([emailKey(email), draftId]));
        request.onsuccess = function () {
          var cursor = request.result;
          if (!cursor) {
            rows.sort(function (a, b) { return a.startedAt - b.startedAt || a.id.localeCompare(b.id); });
            resolve(rows);
            return;
          }
          rows.push(cursor.value);
          cursor.continue();
        };
        request.onerror = function () { reject(request.error || new Error("indexeddb_read_failed")); };
      });
    });
  }

  function saveSession(opts) {
    if (!opts.blob || opts.blob.size <= 44) throw new Error("empty_audio");
    var email = emailKey(opts.email);
    if (!email || !opts.draftId || !opts.sessionId) throw new Error("missing_audio_identity");
    return put("sessions", {
      id: email + "|" + opts.draftId + "|" + opts.sessionId,
      email: email,
      draftId: opts.draftId,
      sessionId: opts.sessionId,
      startedAt: Number(opts.startedAt) || Date.now(),
      blob: opts.blob
    });
  }

  function clearAudio(email, draftId, ids) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("sessions", "readwrite");
        var request = tx.objectStore("sessions").index("byDraft")
          .openCursor(global.IDBKeyRange.only([emailKey(email), draftId]));
        request.onsuccess = function () {
          var cursor = request.result;
          if (cursor) {
            if (!ids || ids.indexOf(cursor.value.id) !== -1) cursor.delete();
            cursor.continue();
          }
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error("indexeddb_delete_failed")); };
        tx.onabort = function () { reject(tx.error || new Error("indexeddb_delete_aborted")); };
      });
    });
  }

  function wavParts(buffer) {
    var view = new DataView(buffer);
    function tag(offset) {
      return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3));
    }
    if (buffer.byteLength < 45 || tag(0) !== "RIFF" || tag(8) !== "WAVE" ||
        tag(12) !== "fmt " || tag(36) !== "data" || view.getUint16(20, true) !== 1 ||
        view.getUint16(22, true) !== 1 || view.getUint16(34, true) !== 16) {
      throw new Error("invalid_saved_wav");
    }
    var dataSize = view.getUint32(40, true);
    if (!dataSize || dataSize + 44 > buffer.byteLength) throw new Error("invalid_saved_wav");
    return { rate: view.getUint32(24, true), bytes: new Uint8Array(buffer, 44, dataSize) };
  }

  function wavHeader(rate, bytes) {
    if (bytes > 0xffffffff - 44) throw new Error("audio_too_large");
    var buffer = new ArrayBuffer(44);
    var view = new DataView(buffer);
    function tag(offset, s) { for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
    tag(0, "RIFF"); view.setUint32(4, bytes + 36, true); tag(8, "WAVE"); tag(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    tag(36, "data"); view.setUint32(40, bytes, true);
    return buffer;
  }

  function buildWav(email, draftId, ids) {
    return listSessions(email, draftId).then(function (sessions) {
      if (ids) {
        sessions = sessions.filter(function (s) { return ids.indexOf(s.id) !== -1; });
        if (sessions.length !== ids.length) throw new Error("audio_missing");
      }
      if (!sessions.length) throw new Error("audio_missing");
      return Promise.all(sessions.map(function (s) { return s.blob.arrayBuffer(); }))
        .then(mergeWavBuffers);
    });
  }

  function mergeWavBuffers(buffers) {
    if (!buffers || !buffers.length) throw new Error("audio_missing");
    var parts = buffers.map(wavParts);
    var rate = 16000;
    parts = parts.map(function (p) {
      return { bytes: p.rate === rate ? p.bytes : resamplePcm16(p.bytes, p.rate, rate) };
    });
    var bytes = parts.reduce(function (sum, p) { return sum + p.bytes.length; }, 0);
    return new Blob([wavHeader(rate, bytes)].concat(parts.map(function (p) { return p.bytes; })),
      { type: "audio/wav" });
  }

  function resamplePcm16(bytes, fromRate, toRate) {
    if (!fromRate || fromRate < 8000 || fromRate > 192000 || bytes.length % 2) {
      throw new Error("invalid_saved_wav");
    }
    var input = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var inputCount = bytes.length / 2;
    var outputCount = Math.max(1, Math.round(inputCount * toRate / fromRate));
    var output = new ArrayBuffer(outputCount * 2);
    var view = new DataView(output);
    for (var i = 0; i < outputCount; i++) {
      var x = i * fromRate / toRate;
      var lo = Math.min(inputCount - 1, Math.floor(x));
      var hi = Math.min(inputCount - 1, lo + 1);
      var mix = x - lo;
      var value = Math.round(input.getInt16(lo * 2, true) * (1 - mix) +
        input.getInt16(hi * 2, true) * mix);
      view.setInt16(i * 2, value, true);
    }
    return new Uint8Array(output);
  }

  function submissionId(email, draftId) { return emailKey(email) + "|" + draftId; }
  function saveSubmission(email, draftId, data) {
    return put("submissions", Object.assign({ id: submissionId(email, draftId) }, data));
  }
  function reserveSubmission(email, draftId, data) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("submissions", "readwrite");
        tx.objectStore("submissions").add(Object.assign({ id: submissionId(email, draftId) }, data));
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error("submission_exists")); };
        tx.onabort = function () { reject(tx.error || new Error("submission_exists")); };
      });
    });
  }
  function getSubmission(email, draftId) { return get("submissions", submissionId(email, draftId)); }
  function clearSubmission(email, draftId) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("submissions", "readwrite");
        tx.objectStore("submissions").delete(submissionId(email, draftId));
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error("indexeddb_delete_failed")); };
      });
    });
  }

  global.AgiloSoloAudio = {
    DB_NAME: DB_NAME,
    newId: newId,
    getDraftId: getDraftId,
    nextDraftId: nextDraftId,
    saveSession: saveSession,
    listSessions: listSessions,
    clearAudio: clearAudio,
    buildWav: buildWav,
    saveSubmission: saveSubmission,
    reserveSubmission: reserveSubmission,
    getSubmission: getSubmission,
    clearSubmission: clearSubmission,
    wavParts: wavParts,
    wavHeader: wavHeader,
    mergeWavBuffers: mergeWavBuffers,
    resamplePcm16: resamplePcm16
  };
})(typeof window !== "undefined" ? window : globalThis);
