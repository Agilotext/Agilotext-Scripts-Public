import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const maestro = fs.readFileSync(new URL('./maestro-context-ent.js', import.meta.url), 'utf8');
const editor = fs.readFileSync(new URL('../../editor/maestro-job-documents.js', import.meta.url), 'utf8');

function extract(source, name) {
  const start = source.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
  let i = source.indexOf('{', start);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const sandbox = {};
vm.runInNewContext(
  [
    extract(maestro, 'decideContextSend'),
    extract(maestro, 'sameNameSet'),
    extract(maestro, 'documentNamesFromContext'),
    extract(editor, 'namesFromJobContext'),
    'this.api = { decideContextSend, sameNameSet, documentNamesFromContext, namesFromJobContext };'
  ].join('\n'),
  sandbox
);

const { decideContextSend, sameNameSet, documentNamesFromContext, namesFromJobContext } = sandbox.api;
const file = (name) => ({ name });

assert.equal(decideContextSend('ctx-1', [file('a.txt'), file('b.txt')]).mode, 'contextId');
assert.equal(decideContextSend(null, [file('a.txt')]).mode, 'files');
assert.equal(decideContextSend(null, [file('a.txt')]).count, 1);
assert.equal(decideContextSend('', [file('a.txt'), file('b.txt')]).count, 2);
assert.equal(decideContextSend(null, []).mode, 'hold');
assert.equal(sameNameSet(['B.txt', 'a.TXT'], ['a.txt', 'b.txt']), true);
assert.equal(sameNameSet(['a.txt'], ['a.txt', 'b.txt']), false);
assert.equal(sameNameSet(['a.txt', 'b.txt'], ['a.txt']), false);

const payload = { analysis: { documents: [{ filename: 'ODJ.txt' }, { filename: 'Convocation.pdf' }] } };
assert.equal(JSON.stringify(documentNamesFromContext(payload)), JSON.stringify(['ODJ.txt', 'Convocation.pdf']));
assert.equal(JSON.stringify(namesFromJobContext(payload)), JSON.stringify(['ODJ.txt', 'Convocation.pdf']));
assert.equal(JSON.stringify(namesFromJobContext({ status: 'OK' })), '[]');

assert.equal(maestro.includes("reason: 'preanalyze_fallback_file'"), false);
assert.equal(maestro.includes('preanalyze_fallback_all'), true);
assert.equal(maestro.includes('Aperçu. Les documents seront joints à l’envoi.'), true);
assert.equal(editor.includes('Documents joints'), true);
assert.equal(editor.includes('Télécharger les originaux'), true);
assert.equal(editor.includes('M7.75,5v6.75'), true);
assert.equal(editor.includes('ed-title-wrap'), true);
assert.equal(editor.includes('aria-expanded'), true);
assert.equal(editor.includes('panel.hidden = true'), true);
assert.equal(editor.includes('#e8f5e9'), false);
assert.equal(editor.includes("querySelector('main')"), false);
assert.equal(editor.includes('firstChild'), false);
assert.equal(editor.includes('agenda'), false);
assert.equal(editor.includes('wordBoost'), false);
assert.equal(editor.includes('word boost'), false);

console.log('maestro-context-send.test: ok');
