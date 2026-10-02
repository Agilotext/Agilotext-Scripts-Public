// Fusionne les règles de premier niveau qui répètent le même sélecteur (hors @media).
// La règle fusionnée prend la place de la dernière occurrence ; une déclaration plus tardive gagne,
// sauf si une plus ancienne est !important et pas la nouvelle.
// Usage : node tests/css-merge.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(new URL('..', import.meta.url).pathname, 'agiloshield-v2.css');
const css = fs.readFileSync(file, 'utf8');

export function splitTop(source) {
  const blocks = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { let j = i; while (j < source.length && /\s/.test(source[j])) j++; blocks.push({ kind: 'ws', raw: source.slice(i, j) }); i = j; continue; }
    if (source.startsWith('/*', i)) { const j = source.indexOf('*/', i + 2) + 2; blocks.push({ kind: 'comment', raw: source.slice(i, j) }); i = j; continue; }
    const open = source.indexOf('{', i);
    let depth = 0, j = open;
    for (; j < source.length; j++) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') { depth--; if (!depth) break; }
    }
    const head = source.slice(i, open).trim();
    const body = source.slice(open + 1, j);
    blocks.push(head.startsWith('@') ? { kind: 'at', raw: source.slice(i, j + 1) } : { kind: 'rule', selector: head.replace(/\s+/g, ' '), body });
    i = j + 1;
  }
  return blocks;
}

function decls(body) {
  return body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const k = d.indexOf(':');
    return [d.slice(0, k).trim(), d.slice(k + 1).trim()];
  });
}

const blocks = splitTop(css);
const groups = new Map();
blocks.forEach((b, index) => { if (b.kind === 'rule') (groups.get(b.selector) || groups.set(b.selector, []).get(b.selector)).push(index); });

let merged = 0;
for (const [selector, indexes] of groups) {
  if (indexes.length < 2) continue;
  const map = new Map();
  for (const index of indexes) {
    for (const [prop, value] of decls(blocks[index].body)) {
      const previous = map.get(prop);
      if (previous && /!important$/.test(previous) && !/!important$/.test(value)) continue;
      map.delete(prop);
      map.set(prop, value);
    }
  }
  const last = indexes.at(-1);
  blocks[last].body = [...map].map(([p, v]) => p + ':' + v).join(';');
  for (const index of indexes.slice(0, -1)) blocks[index] = { kind: 'removed' };
  merged++;
}

const render = (b) => {
  if (b.kind === 'removed') return '';
  if (b.kind === 'rule') return b.selector + '{' + b.body + '}';
  return b.raw;
};
const media = blocks.filter((b) => b.kind === 'at' && /^@media/.test(b.raw));
const marker = '/* Responsive and motion overrides, always after the base rules. */';
const rest = blocks.filter((b) => !media.includes(b) && b.raw !== marker);
const out = (rest.map(render).join('') + '\n' + marker + '\n' +
  media.map(render).join('\n') + '\n').replace(/\n{3,}/g, '\n\n');

console.log('selectors merged:', merged, 'bytes', css.length, '->', out.length);
if (process.argv.includes('--write')) fs.writeFileSync(file, out);
