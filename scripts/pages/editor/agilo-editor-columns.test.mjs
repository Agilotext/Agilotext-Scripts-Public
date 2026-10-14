import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const src = fs.readFileSync(new URL('./agilo-editor-columns.js', import.meta.url), 'utf8');

function cssBlock() {
  const start = src.indexOf('var COLUMNS_CSS = [');
  const end = src.indexOf('].join', start);
  assert.ok(start >= 0 && end > start, 'chaine CSS introuvable');
  const css = [...src.slice(start, end).matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
  const mediaAt = css.indexOf('@media (min-width:992px){');
  assert.ok(mediaAt >= 0, 'media desktop manquante');
  return css.slice(mediaAt);
}

test('trois grilles desktop, pas de largeur seule sur le rail', () => {
  const css = cssBlock();
  assert.match(css, /\.ed-body:has\(> \.ed-rail\.is-collapsed\):not\(\.is-ia-hidden\)\{grid-template-columns:3rem minmax\(0, 1fr\) minmax\(14rem, 18rem\);\}/);
  assert.match(css, /\.ed-body\.is-ia-hidden:not\(:has\(> \.ed-rail\.is-collapsed\)\)\{grid-template-columns:minmax\(16rem, 22rem\) minmax\(0, 1fr\);\}/);
  assert.match(css, /\.ed-body\.is-ia-hidden:has\(> \.ed-rail\.is-collapsed\)\{grid-template-columns:3rem minmax\(0, 1fr\);\}/);
  assert.match(css, /\.ed-body\.is-ia-hidden > \.ed-ia\{display:none;\}/);
  assert.doesNotMatch(css, /\.ed-rail\.is-collapsed\s*\{[^}]*\bwidth\s*:/);
});

test('le script ne retoggle pas le rail et mémorise après le clic', () => {
  assert.match(src, /queueMicrotask/);
  assert.doesNotMatch(src, /classList\.toggle\(\s*['"]is-collapsed['"]\s*\)/);
  assert.match(src, /agilo:editor:ia-hidden/);
  assert.match(src, /agilo:editor:rail-collapsed/);
  assert.match(src, /\[data-view="ia"\] \.ed-ia-head/);
});
