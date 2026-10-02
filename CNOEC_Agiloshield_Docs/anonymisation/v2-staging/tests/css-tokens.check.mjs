import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'agiloshield-v2.css'), 'utf8');
const errors = [];

if (css.split('{').length !== css.split('}').length) errors.push('Unbalanced CSS braces');

const tokenBlockEnd = css.indexOf('}', css.indexOf('--asv2-blue:'));
const body = css.slice(tokenBlockEnd + 1);

const hex = body.match(/#[0-9a-fA-F]{3,8}\b/g);
if (hex) errors.push(`Hex outside the token block: ${[...new Set(hex)].join(', ')}`);

const rgba = body.match(/rgba?\(/g);
if (rgba) errors.push('rgba() outside the token block, use color-mix with a token');

if (/border-left\s*:\s*\d|border-left-(width|color)\s*:|border-inline-start\s*:/.test(css)) {
  errors.push('Lateral colored border is forbidden (Design_System/design.md)');
}

const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map(m => m[1].trim());
const radiusPart = /^(0|50%|inherit|var\(--asv2-r-(sm|md|lg|pill)\))$/;
const badRadii = radii.filter(v => !v.split(/\s+/).every(part => radiusPart.test(part)));
if (badRadii.length) errors.push(`Radius not from tokens: ${[...new Set(badRadii)].join(', ')}`);


{
  let depth = 0, start = 0;
  const seen = new Map();
  for (let i = 0; i < css.length; i++) {
    if (css.startsWith('/*', i)) { i = css.indexOf('*/', i + 2) + 1; if (!depth) start = i + 1; continue; }
    if (css[i] === '{') {
      if (!depth) {
        const selector = css.slice(start, i).trim().replace(/\s+/g, ' ');
        if (!selector.startsWith('@')) seen.set(selector, (seen.get(selector) || 0) + 1);
      }
      depth++;
    } else if (css[i] === '}') { depth--; if (!depth) start = i + 1; }
  }
  const dup = [...seen].filter(([selector, count]) => count > 1 && selector !== '#agiloshield-v2-staging');
  if (dup.length) errors.push(`Duplicate top-level selectors (run tests/css-merge.mjs): ${dup.map(([s]) => s).slice(0, 5).join(' | ')}`);
}

if (/transition\s*:\s*all\b/.test(css)) errors.push('transition:all is forbidden, list properties');

for (const required of ['--color--blue', '--agilo-primary', '.asv2-drawer-icon', '.asv2-queue-remove', '.asv2-mask-marker', '.asv2-review-summary', '.asv2-issue-locate-icon', '.asv2-text-hit', '.asv2-help-pill', '.asv2-settings-row', '.asv2-mode-hint']) {
  if (!css.includes(required)) errors.push(`Missing ${required}`);
}

if (/\.asv2-help-button/.test(css)) errors.push('Old bordered round help button still styled');
if (!/\.asv2-help-pill\{[^}]*border:0/.test(css)) errors.push('Help pill must not draw a round border around the icon');
if (/\.asv2-surface-tabs\{display:flex\}/.test(css)) errors.push('Surface tabs must not come back on mobile');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('css tokens: PASS');
