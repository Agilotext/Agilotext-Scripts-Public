// Remove every selector that targets one of the given classes, in all layers and media queries,
// so a component can be restyled in one place. `[hidden]` selectors are always kept.
// Usage: node tests/css-purge.mjs agiloshield-v2.css asv2-drop asv2-drop-title ...
import fs from 'node:fs';

const [file, ...classes] = process.argv.slice(2);
const css = fs.readFileSync(file, 'utf8');
const pattern = new RegExp('\\.(' + classes.map(c => c.replace(/[-]/g, '\\-')).join('|') + ')(?![\\w-])');

function parse(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) { out.push({ raw: text.slice(i) }); break; }
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const prelude = text.slice(i, open);
    const body = text.slice(open + 1, j - 1);
    out.push({ prelude, body, nested: /^\s*(\/\*[\s\S]*?\*\/\s*)*@media/.test(prelude) });
    i = j;
  }
  return out;
}

let removed = 0;
function rewrite(text) {
  return parse(text).map(node => {
    if (node.raw !== undefined) return node.raw;
    if (node.nested) {
      const inner = rewrite(node.body);
      return inner.trim() ? node.prelude + '{' + inner + '}' : node.prelude.replace(/@media[\s\S]*$/, '');
    }
    const commentMatch = node.prelude.match(/^([\s\S]*\*\/)?(\s*)([\s\S]*)$/);
    const lead = (commentMatch[1] || '') + commentMatch[2];
    const selectors = commentMatch[3].split(',');
    const kept = selectors.filter(sel => sel.includes('[hidden]') || !pattern.test(sel));
    removed += selectors.length - kept.length;
    if (!kept.length) return lead.replace(/\s+$/, '\n');
    return lead + kept.map(s => s.trim()).join(',') + '{' + node.body + '}';
  }).join('');
}

const result = rewrite(css).replace(/\n{3,}/g, '\n\n');
fs.writeFileSync(file, result);
console.log('removed selectors:', removed);
