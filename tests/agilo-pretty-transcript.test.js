/**
 * Transcript joli Free (parser Pro/Business)
 * node --test tests/agilo-pretty-transcript.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const pretty = require("../scripts/pages/dashboard/Free/agilo-pretty-transcript.js");

describe("parseRawTranscript speakers + SRT", function () {
  it("lit nom puis timecode comme le screenshot Business", function () {
    const raw = [
      "Florian de Bauerwebpro",
      "00:00 --> 00:07",
      "Donc là je viens de tester la reconnaissance des intervenants."
    ].join("\n");
    const segs = pretty.parseRawTranscript(raw);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].speaker, "Florian de Bauerwebpro");
    assert.equal(segs[0].start, 0);
    assert.equal(segs[0].end, 7);
    assert.match(segs[0].text, /reconnaissance des intervenants/);
  });

  it("conserve Speaker_A avec un timecode", function () {
    const raw = "Speaker_A\n00:00 --> 00:05\nBonjour.";
    const segs = pretty.parseRawTranscript(raw);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].speaker, "Speaker_A");
    assert.equal(segs[0].start, 0);
  });

  it("fmtHMS affiche 00:00 sans heure", function () {
    assert.equal(pretty.fmtHMS(0), "00:00");
    assert.equal(pretty.fmtHMS(7), "00:07");
    assert.equal(pretty.fmtHMS(3661), "01:01:01");
  });
});

describe("parseRawTranscript format-only", function () {
  it("pousse chaque ligne comme cas D sans speaker ni time", function () {
    const raw = "Premier paragraphe.\n\nDeuxième paragraphe.";
    const segs = pretty.parseRawTranscript(raw);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].speaker, "");
    assert.equal(segs[0].start, null);
    assert.equal(segs[0].text, "Premier paragraphe.");
    assert.equal(segs[1].text, "Deuxième paragraphe.");
  });
});

describe("mountPretty cache le textarea", function () {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const src = fs.readFileSync(
    path.join(__dirname, "../scripts/pages/dashboard/Free/agilo-pretty-transcript.js"),
    "utf8"
  );

  function el(id, extras) {
    const node = {
      id: id || "",
      tagName: (extras && extras.tagName) || "DIV",
      className: (extras && extras.className) || "",
      textContent: extras && extras.textContent || "",
      value: extras && extras.value || "",
      style: {},
      attrs: {},
      children: [],
      parentNode: null,
      dataset: {},
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
      setAttribute: function (name, value) { node.attrs[name] = String(value); },
      getAttribute: function (name) { return node.attrs[name] || null; },
      querySelector: function (sel) {
        return node.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll: function (sel) {
        const out = [];
        function walk(cur) {
          (cur.children || []).forEach(function (child) {
            if (sel === ".ag-seg" && child.className === "ag-seg") out.push(child);
            if (sel === ".search-hit" && child.className === "search-hit") out.push(child);
            if (sel === ".speaker" && child.className === "speaker") out.push(child);
            if (sel === ".rename-btn" && String(child.className).indexOf("rename-btn") !== -1) out.push(child);
            if (sel === ".time" && child.className === "time") out.push(child);
            if (sel === ".ag-seg__text" && child.className === "ag-seg__text") out.push(child);
            if (sel === ".w-tab-menu .w-tab-link") return;
            walk(child);
          });
        }
        walk(node);
        return out;
      },
      appendChild: function (child) {
        node.children.push(child);
        child.parentNode = node;
        return child;
      },
      insertAdjacentElement: function (where, child) {
        if (where === "afterbegin") {
          node.children.unshift(child);
          child.parentNode = node;
        } else {
          node.appendChild(child);
        }
        return child;
      },
      replaceChildren: function () {
        node.children = Array.prototype.slice.call(arguments);
        node.children.forEach(function (c) { c.parentNode = node; });
      },
      addEventListener: function () {},
      closest: function () { return node; },
      contains: function () { return false; },
      normalize: function () {}
    };
    return node;
  }

  it("crée des blocs .ag-seg et cache #transcriptText", function () {
    const host = el("transcriptTextContainer");
    const ta = el("transcriptText", { tagName: "TEXTAREA" });
    ta.value = "Florian de Bauerwebpro\n00:00 --> 00:07\nTexte du paragraphe.";
    host.appendChild(ta);
    const head = el("head");
    const body = el("body");
    const byId = { transcriptTextContainer: host, transcriptText: ta };
    const sandbox = {
      window: null,
      document: {
        head: head,
        body: body,
        getElementById: function (id) { return byId[id] || null; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        createElement: function (tag) {
          const node = el("", { tagName: String(tag).toUpperCase() });
          const origSet = node.setAttribute;
          node.setAttribute = function (name, value) {
            origSet(name, value);
            if (name === "id") {
              node.id = String(value);
              byId[node.id] = node;
            }
          };
          return node;
        },
        createDocumentFragment: function () {
          const frag = el("frag");
          frag.replaceChildren = function () {
            frag.children = Array.prototype.slice.call(arguments);
          };
          return frag;
        },
        addEventListener: function () {},
        createTreeWalker: function (scope) {
          return { nextNode: function () { return null; } };
        }
      },
      NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_SKIP: 3, FILTER_ACCEPT: 1 },
      addEventListener: function () {},
      setTimeout: function (fn) { fn(); },
      location: { pathname: "/app/free/dashboard" },
      prompt: function () { return null; },
      console: console,
      JSON: JSON,
      Date: Date,
      Math: Math,
      Number: Number,
      String: String,
      Array: Array,
      Object: Object,
      Boolean: Boolean,
      RegExp: RegExp,
      parseFloat: parseFloat,
      parseInt: parseInt,
      isNaN: isNaN
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.document.body = body;
    vm.runInNewContext(src, sandbox, { timeout: 2000 });
    const prettyRoot = host.children.find(function (child) {
      return child.id === "ag-pretty-transcript";
    }) || byId["ag-pretty-transcript"];
    assert.ok(prettyRoot);
    assert.equal(ta.style.display, "none");
    const segs = prettyRoot.querySelectorAll(".ag-seg");
    assert.ok(segs.length >= 1);
    assert.ok(prettyRoot.querySelectorAll(".rename-btn").length >= 1);
    const speaker = prettyRoot.querySelector(".speaker");
    assert.equal(speaker && speaker.textContent, "Florian de Bauerwebpro");
  });
});
