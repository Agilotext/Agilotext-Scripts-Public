import assert from 'node:assert/strict';
import { itemViewportRect, multiplyTransform, rectsOnPage } from '../agiloshield-v2-autotrace.js';
import { regionRectangles } from '../agiloshield-v2-location.js';

// PDF user space is bottom-left. Viewport scale 1 flips Y: [1, 0, 0, -1, 0, height].
const pageHeight = 800;
const viewport = [1, 0, 0, -1, 0, pageHeight];
const glyph = (x, baseline, width, text, size = 12) => ({
  str: text, width, height: size, transform: [size, 0, 0, size, x, baseline]
});

const rect = itemViewportRect(glyph(100, 700, 40, 'SHOP'), viewport);
assert.deepEqual(rect, [100, 88, 140, 100]);
assert.deepEqual(multiplyTransform(viewport, [12, 0, 0, 12, 100, 700])[5], 100);

const twice = rectsOnPage([
  glyph(100, 700, 40, 'SHOP'),
  glyph(300, 700, 40, 'INPI'),
  glyph(100, 500, 40, 'SHOP')
], viewport, [600, pageHeight], 'SHOP');
assert.equal(twice.ok, true);
assert.equal(twice.rects.length, 2);
assert.deepEqual(twice.rects[0], [100, 88, 140, 100]);

const split = rectsOnPage([
  glyph(100, 700, 24, 'Cam', 12),
  glyph(124, 700, 28, 'ille', 12)
], viewport, [600, pageHeight], 'Camille');
assert.equal(split.ok, true);
assert.equal(split.rects.length, 1);
assert.equal(split.rects[0][0], 100);
assert.equal(split.rects[0][2], 152);

const accent = rectsOnPage([glyph(20, 400, 48, 'Émilie')], viewport, [600, pageHeight], 'emilie');
assert.equal(accent.ok, true);

const wrapped = rectsOnPage([
  glyph(100, 700, 48, 'Camille', 12),
  glyph(100, 680, 40, 'Martin', 12)
], viewport, [600, pageHeight], 'Camille Martin');
assert.equal(wrapped.ok, true);
assert.equal(wrapped.rects.length, 2);

assert.equal(rectsOnPage([glyph(10, 700, 20, 'Ly')], viewport, [600, pageHeight], 'Ly').reason, 'short');

const many = [];
for (let index = 0; index < 11; index++) many.push(glyph(10 + index * 30, 700, 24, 'SHOP'));
assert.equal(rectsOnPage(many, viewport, [2000, pageHeight], 'SHOP').reason, 'tooMany');

const turned = [0, -1, 1, 0, 0, 0];
const turnedRect = itemViewportRect(glyph(100, 700, 40, 'SHOP'), turned);
assert.ok(turnedRect && turnedRect[2] > turnedRect[0] && turnedRect[3] > turnedRect[1]);

const entry = {
  format: 'pdf',
  regions: { pages: [{ page: 1, rotation: 0, size: [600, 800], occurrences: [
    { id: 'a', rectangles: [[100, 88, 140, 100]] },
    { id: 'a', rectangles: [[100, 288, 140, 300]] }
  ] }] }
};
assert.equal(regionRectangles(entry, { id: 'a', page: 1 }).length, 2);

console.log('autotrace: PASS');
