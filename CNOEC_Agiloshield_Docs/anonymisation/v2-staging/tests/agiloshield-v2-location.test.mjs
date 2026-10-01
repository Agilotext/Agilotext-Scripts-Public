import assert from 'node:assert/strict';
import { originalPdfLocation } from '../agiloshield-v2-location.js';

const entry = {
  format: 'pdf', revision: 'r1', review: { revision: 'r1' },
  regions: { pages: [{ page: 2, rotation: 0, size: [400, 250],
    occurrences: [{ id: 'other', maskOccurrenceId: 'occ-1',
      rectangles: [[72, 94, 202, 109]] }] }] }
};
const row = { id: 'occ-1', page: 2, text: 'Même libellé' };
assert.deepEqual(originalPdfLocation(entry, row), {
  kind: 'exact', page: 2, fragments: [[72, 94, 202, 109]]
});
assert.equal(originalPdfLocation(entry, { ...row, page: null }).kind, 'exact');
assert.equal(originalPdfLocation(entry, { ...row, id: 'occ-2' }).kind, 'page');
assert.equal(originalPdfLocation(entry, { ...row, id: 'occ-2', page: null }).kind, 'unavailable');
assert.equal(originalPdfLocation({ ...entry, revision: 'r2' }, row).kind, 'unavailable');
assert.equal(originalPdfLocation({ ...entry, regions: { pages: [{ page: 2, size: [400, 250],
  occurrences: [{ id: 'occ-1', rectangles: [[0, 0, 500, 20]] }] }] } }, row).kind, 'page');
assert.equal(originalPdfLocation({ ...entry, regions: { pages: [{ page: 2, size: [400, 250],
  occurrences: [{ id: 'occ-1', rectangles: [[72, 94, 202, 109]] },
    { id: 'occ-1', rectangles: [[150, 94, 202, 109]] }] }] } }, row).kind, 'page');
