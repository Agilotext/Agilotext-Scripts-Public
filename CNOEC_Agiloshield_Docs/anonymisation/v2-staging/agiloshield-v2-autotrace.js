// Rectangles in the same space as a hand-drawn zone: PDF.js viewport at scale 1.
// Origin is the top left, Y grows downward, unit is the PDF point.
// That matches bindDrawing (pointer mapped through viewport width and height)
// and the mask overlay (rect divided by the same viewport).

const round = value => Math.round(value * 100) / 100;

export function multiplyTransform(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

export function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function usefulLength(value) {
  return normalizeSearch(value).replace(/[^0-9a-z]/g, '').length;
}

export function itemViewportRect(item, viewportTransform) {
  if (!Array.isArray(item?.transform) || item.transform.length < 6) return null;
  if (!Array.isArray(viewportTransform) || viewportTransform.length < 6) return null;
  const tx = multiplyTransform(viewportTransform, item.transform);
  const height = Math.hypot(tx[2], tx[3]) || Number(item.height) || 0;
  const width = Number(item.width) || 0;
  if (!(width > 0) || !(height > 0)) return null;
  const x0 = tx[4];
  const y1 = tx[5];
  const y0 = y1 - height;
  const x1 = x0 + width;
  if (!(x1 > x0) || !(y1 > y0)) return null;
  return [round(x0), round(y0), round(x1), round(y1)];
}

function unionRect(rects) {
  return [
    round(Math.min(...rects.map(rect => rect[0]))),
    round(Math.min(...rects.map(rect => rect[1]))),
    round(Math.max(...rects.map(rect => rect[2]))),
    round(Math.max(...rects.map(rect => rect[3])))
  ];
}

// Find every exact occurrence of needle in one page of PDF.js text items.
// Items split mid-word are joined when they sit on the same line with no gap.
// A match that crosses a line break becomes one rectangle per line.
export function rectsOnPage(items, viewportTransform, pageSize, needle) {
  const wanted = normalizeSearch(needle);
  if (usefulLength(wanted) < 3) return { ok: false, reason: 'short', rects: [] };
  const pieces = [];
  for (const item of items || []) {
    const text = normalizeSearch(item?.str || '');
    if (!text) continue;
    const rect = itemViewportRect(item, viewportTransform);
    if (!rect) continue;
    if (pageSize && (rect[2] < -1 || rect[3] < -1 || rect[0] > pageSize[0] + 1 || rect[1] > pageSize[1] + 1))
      continue;
    pieces.push({ text, rect });
  }
  pieces.sort((a, b) => a.rect[1] - b.rect[1] || a.rect[0] - b.rect[0]);
  let corpus = '';
  const spans = [];
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    if (index > 0) {
      const prev = pieces[index - 1];
      const mid = rect => (rect[1] + rect[3]) / 2;
      const height = Math.max(piece.rect[3] - piece.rect[1], prev.rect[3] - prev.rect[1], 8);
      const sameLine = Math.abs(mid(piece.rect) - mid(prev.rect)) <= height * 0.7;
      const gap = piece.rect[0] - prev.rect[2];
      if (!sameLine || gap > 1.5) corpus += ' ';
    }
    const start = corpus.length;
    corpus += piece.text;
    spans.push({ start, end: corpus.length, rect: piece.rect });
  }
  const rects = [];
  let from = 0;
  while (from <= corpus.length) {
    const at = corpus.indexOf(wanted, from);
    if (at < 0) break;
    const end = at + wanted.length;
    const hit = spans.filter(span => span.end > at && span.start < end);
    const groups = [];
    for (const span of hit) {
      const mid = (span.rect[1] + span.rect[3]) / 2;
      const height = Math.max(span.rect[3] - span.rect[1], 8);
      const last = groups[groups.length - 1];
      if (last && Math.abs(mid - last.mid) <= height) {
        last.rects.push(span.rect);
        last.mid = (last.mid + mid) / 2;
      } else groups.push({ mid, rects: [span.rect] });
    }
    for (const group of groups) rects.push(unionRect(group.rects));
    from = at + Math.max(1, wanted.length);
    if (rects.length > 10) return { ok: false, reason: 'tooMany', rects: [] };
  }
  return rects.length ? { ok: true, rects } : { ok: false, reason: 'none', rects: [] };
}
