/* Pure rule: a finished mask or keep batch can close the review. */
export function canCloseAfterBatch({
  action, left = 0, problems = 0, unresolved = 0, reviewRows = 0, hasRevision = false,
} = {}) {
  if (action !== 'MASK' && action !== 'KEEP') return false;
  if (!hasRevision) return false;
  if (left > 0 || problems > 0 || unresolved > 0 || reviewRows > 0) return false;
  return true;
}
