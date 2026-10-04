function normalizeFragments(value) {
  if (value == null) return null;
  if (Array.isArray(value) && value.length === 4 && value.every(item => typeof item === 'number'))
    return [value];
  if (Array.isArray(value) && value.every(item => Array.isArray(item))) return value;
  return [];
}

// Resolve only identifiers supplied by the review and original-region contracts.
// A page-only result is useful navigation, never a claim that a word was located.
export function originalPdfLocation(entry, row) {
  if (entry?.format !== 'pdf' || !row?.id ||
      String(entry?.review?.revision) !== String(entry?.revision))
    return { kind: 'unavailable', page: null, fragments: [] };
  const suppliedPage = row.page == null ? null : Number(row.page);
  if (suppliedPage != null && (!Number.isSafeInteger(suppliedPage) || suppliedPage < 1))
    return { kind: 'unavailable', page: null, fragments: [] };
  const matches = (entry?.regions?.pages || []).flatMap(source =>
    (source.occurrences || []).filter(item =>
      [item.id, item.maskOccurrenceId, item.originalId].some(id =>
        id != null && String(id) === String(row.id))).map(item => ({ source, item })));
  const matched = matches.length === 1 ? matches[0] : null;
  const page = suppliedPage ?? (matched ? Number(matched.source.page) : null);
  if (!Number.isSafeInteger(page) || page < 1)
    return { kind: 'unavailable', page: null, fragments: [] };
  const sourcePage = entry?.regions?.pages?.find(item => Number(item.page) === page);
  const size = sourcePage?.size;
  if (!Array.isArray(size) || size.length !== 2 ||
      !size.every(value => Number.isFinite(value) && value > 0) ||
      Number(sourcePage.rotation || 0) !== 0)
    return { kind: 'page', page, fragments: [] };

  const supplied = normalizeFragments(row?.fragments);
  // A present but unusable shape stays on the page. Do not invent a rectangle.
  let fragments = supplied === null
    ? (matched && Number(matched.source.page) === page ? matched.item.rectangles : [])
    : supplied;
  const valid = (fragments || []).filter(rect => Array.isArray(rect) && rect.length === 4 &&
    rect.every(Number.isFinite) && rect[0] >= 0 && rect[1] >= 0 &&
    rect[0] < rect[2] && rect[1] < rect[3] &&
    rect[2] <= size[0] && rect[3] <= size[1]);
  return valid.length ? { kind: 'exact', page, fragments: valid } :
    { kind: 'page', page, fragments: [] };
}

// Every rectangle the server already tied to this passage, including repeats.
// A single ambiguous match stays unresolved for navigation; the list is for automatic masking.
export function regionRectangles(entry, row) {
  if (entry?.format !== 'pdf' || row?.id == null) return [];
  const wanted = String(row.id);
  const out = [];
  const accept = (page, rect, size) => Array.isArray(rect) && rect.length === 4 &&
    rect.every(Number.isFinite) && rect[0] >= 0 && rect[1] >= 0 &&
    rect[0] < rect[2] && rect[1] < rect[3] &&
    (!size || (rect[2] <= size[0] && rect[3] <= size[1]));
  for (const source of entry?.regions?.pages || []) {
    if (Number(source.rotation || 0) !== 0) continue;
    const size = source.size;
    if (!Array.isArray(size) || size.length !== 2 ||
        !size.every(value => Number.isFinite(value) && value > 0)) continue;
    const page = Number(source.page);
    if (!Number.isSafeInteger(page) || page < 1) continue;
    for (const item of source.occurrences || []) {
      if (![item?.id, item?.maskOccurrenceId, item?.originalId].some(id =>
        id != null && String(id) === wanted)) continue;
      for (const rect of normalizeFragments(item?.rectangles) || []) {
        if (accept(page, rect, size)) out.push({ page, rect });
      }
    }
  }
  if (!out.length && Number.isSafeInteger(Number(row.page)) && Number(row.page) >= 1) {
    for (const rect of normalizeFragments(row.fragments) || []) {
      if (accept(Number(row.page), rect, null)) out.push({ page: Number(row.page), rect });
    }
  }
  return out;
}
