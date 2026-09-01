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
  'this.looksLikeHtmlTable = looksLikeHtmlTable;\n' +
  'this.isThinkingMarkup = isThinkingMarkup;\n'
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

const thinkingV05 = '<div class="thinking-indicator mistral-thinking"><div class="thinking-dots"><div class="thinking-dot"></div></div><span>Assistant réfléchit</span></div>';
const thinkingV06 = '<div class="thinking-indicator mistral-thinking"><div class="mistral-thinking__avatar">x</div><span class="mistral-thinking__label">Assistant réfléchit…</span></div>';
assert(helpers.isThinkingMarkup(thinkingV05) === true, 'thinking V05 détecté');
assert(helpers.isThinkingMarkup(thinkingV06) === true, 'thinking V06 détecté');
assert(helpers.isThinkingMarkup('Voici le PV de la réunion') === false, 'réponse modèle pas thinking');
const keptV05 = helpers.isThinkingMarkup(thinkingV05) ? thinkingV05 : helpers.normalizeModelMarkup(thinkingV05);
const keptV06 = helpers.isThinkingMarkup(thinkingV06) ? thinkingV06 : helpers.normalizeModelMarkup(thinkingV06);
assert(keptV05.includes('thinking-indicator') && keptV05.includes('thinking-dot'), 'thinking V05 non strippé');
assert(keptV06.includes('mistral-thinking') && keptV06.includes('mistral-thinking__avatar'), 'thinking V06 non strippé');
assert(!helpers.normalizeModelMarkup(thinkingV05).includes('<div'), 'normalize seul strip encore le thinking (bypass obligatoire)');

console.log('Résultat : 14 ok, 0 échec(s)');
