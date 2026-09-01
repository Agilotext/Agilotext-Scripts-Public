function isFreeSpeakersToggleVisible(checkbox) {
  if (!checkbox) return false;
  if (checkbox.offsetParent !== null) return true;
  try {
    return typeof checkbox.getClientRects === 'function' && checkbox.getClientRects().length > 0;
  } catch {
    return false;
  }
}

function isFreeSpeakersOn(checkbox) {
  if (!checkbox) return true;
  if (!isFreeSpeakersToggleVisible(checkbox)) return true;
  return !!checkbox.checked;
}

function freeSpeakersExpectedValue(select, speakersOn) {
  if (!speakersOn) return '';
  const raw = select && select.value != null ? String(select.value).trim() : '';
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1) return String(Math.round(n));
  return '2';
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isFreeSpeakersOn(null) === true, 'absent → true');
assert(isFreeSpeakersOn({ checked: false, offsetParent: null, getClientRects: () => [] }) === true, 'masqué décoché → true');
assert(isFreeSpeakersOn({ checked: false, offsetParent: {}, getClientRects: () => [{}] }) === false, 'visible décoché → false');
assert(isFreeSpeakersOn({ checked: true, offsetParent: {}, getClientRects: () => [{}] }) === true, 'visible coché → true');
assert(freeSpeakersExpectedValue({ value: '' }, true) === '2', 'défaut 2 si vide');
assert(freeSpeakersExpectedValue({ value: '4' }, true) === '4', 'valeur select conservée');
assert(freeSpeakersExpectedValue({ value: '4' }, false) === '', 'off → pas de speakersExpected');

console.log('Résultat : 7 ok, 0 échec(s)');
