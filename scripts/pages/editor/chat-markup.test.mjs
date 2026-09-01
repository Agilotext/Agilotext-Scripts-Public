import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'Code-chat_V05.js'), 'utf8');
const start = src.indexOf('  const HTML_TABLE_RE');
const end = src.indexOf('  function mdToHtml(md)');
if (start < 0 || end < 0 || end <= start) {
  throw new Error('helpers markup introuvables dans Code-chat_V05.js');
}

const helpers = {};
new Function(
  `${src.slice(start, end)}\n` +
  'this.normalizeModelMarkup = normalizeModelMarkup;\n' +
  'this.sanitizeAllowlistedHtml = sanitizeAllowlistedHtml;\n' +
  'this.looksLikeHtmlTable = looksLikeHtmlTable;\n'
).call(helpers);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const brStrong = helpers.normalizeModelMarkup('Bonjour<br>le <strong>PV</strong>');
assert(brStrong.includes('\n'), 'br → newline');
assert(brStrong.includes('**PV**'), 'strong → markdown');
assert(!brStrong.includes('<br>'), 'plus de balise br visible');
assert(!brStrong.includes('<strong>'), 'plus de balise strong visible');

const xss = helpers.normalizeModelMarkup('ok <img onerror="alert(1)" src=x> fin');
assert(!xss.includes('<img'), 'img dangereux retiré');
assert(!xss.includes('onerror'), 'onerror retiré');
assert(xss.includes('ok'), 'texte utile conservé');

const table = helpers.sanitizeAllowlistedHtml(
  '<table class="x" onclick="alert(1)"><tr><td><img onerror="alert(1)" src=x><strong>A</strong></td></tr></table>'
);
assert(table.includes('<table>'), 'table keep');
assert(table.includes('<strong>A</strong>'), 'strong allowlist keep');
assert(!table.includes('onclick'), 'attributs retirés');
assert(!table.includes('<img'), 'img hors allowlist retiré');
assert(helpers.looksLikeHtmlTable('<table><tr><td>a</td></tr></table>') === true, 'detect table');

const mdTableLine = '| A | B |\n| --- | --- |\n| 1 | 2 |';
assert(helpers.looksLikeHtmlTable(mdTableLine) === false, 'GFM markdown table n est pas du HTML');
assert(helpers.normalizeModelMarkup(mdTableLine).includes('| A | B |'), 'GFM table intacte après normalize');

console.log('Résultat : 8 ok, 0 échec(s)');
