/* UI-only list handling. Python remains authoritative for matching and privacy decisions. */
const MAX_TERMS = 100;
const MAX_TERM_LENGTH = 256;
const STORAGE_PREFIX = 'agiloshield-v2-staging-lists-v1:';

export const emptyLists = () => ({anon2InclusionList:[], anon2ExclusionList:[]});

export function termKey(value) {
  // Mirrors the common NFKD/casefold/alphanumeric cases of Python list_directives._fold.
  // Python still validates the request; this is only immediate form feedback.
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]/gu, '');
}

export function addTerms(current, raw, label) {
  if (!Array.isArray(current) || typeof raw !== 'string') throw new Error('Liste invalide.');
  const incoming = raw.split(/\r?\n/).map(term => term.trim()).filter(Boolean);
  if (!incoming.length) throw new Error('Saisissez au moins un terme à '+label+'.');
  const result = [...current];
  const seen = new Set(result.map(termKey));
  for (const term of incoming) {
    if ([...term].length > MAX_TERM_LENGTH || /\p{Cc}/u.test(term))
      throw new Error('Chaque terme doit contenir au plus 256 caractères, sans caractère de contrôle.');
    const key = termKey(term);
    if (!key) throw new Error('Un terme doit contenir au moins une lettre ou un chiffre.');
    if (seen.has(key)) throw new Error('Ce terme figure déjà dans cette liste.');
    if (result.length >= MAX_TERMS) throw new Error('Chaque liste est limitée à 100 termes.');
    result.push(term);seen.add(key);
  }
  return result;
}

export function validateLists(value) {
  if (!value || !Array.isArray(value.anon2InclusionList) ||
      !Array.isArray(value.anon2ExclusionList)) throw new Error('Listes invalides.');
  const output = emptyLists();
  for (const [field,label] of [['anon2InclusionList','inclure'],['anon2ExclusionList','exclure']]) {
    if (value[field].some(term => typeof term !== 'string' || !term.trim() || /[\r\n]/.test(term)))
      throw new Error('Liste invalide.');
    for (const term of value[field]) output[field] = addTerms(output[field],term,label);
  }
  return output;
}

async function storageKey(accountRef, cryptoImpl) {
  if (typeof accountRef !== 'string' || !accountRef) return null;
  const bytes = await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(accountRef));
  return STORAGE_PREFIX+[...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}

export async function loadStoredLists(accountRef,{storage,
  cryptoImpl=globalThis.crypto}={}) {
  try {
    const key=await storageKey(accountRef,cryptoImpl);
    if (!key) return {lists:emptyLists(),persistent:false,
      warning:'Compte non identifiable : listes utilisables uniquement tant que cette page reste ouverte.'};
    const raw=(storage||globalThis.localStorage).getItem(key);
    if (!raw) return {lists:emptyLists(),persistent:true};
    const saved=JSON.parse(raw);
    if (!saved || saved.schemaVersion!==1) throw new Error('Invalid stored schema');
    return {lists:validateLists(saved),persistent:true};
  } catch (_) {
    return {lists:emptyLists(),persistent:false,
      warning:'Listes locales illisibles ou stockage indisponible : aucun terme mémorisé n’est appliqué.'};
  }
}

export async function saveStoredLists(accountRef,lists,{storage,
  cryptoImpl=globalThis.crypto}={}) {
  const checked=validateLists(lists);
  try {
    const key=await storageKey(accountRef,cryptoImpl);
    if (!key) return false;
    (storage||globalThis.localStorage).setItem(key,JSON.stringify({schemaVersion:1,...checked}));
    return true;
  } catch (_) {return false;}
}

export async function clearStoredLists(accountRef,{storage,
  cryptoImpl=globalThis.crypto}={}) {
  try {
    const key=await storageKey(accountRef,cryptoImpl);
    if (!key) return false;
    (storage||globalThis.localStorage).removeItem(key);return true;
  } catch (_) {return false;}
}
