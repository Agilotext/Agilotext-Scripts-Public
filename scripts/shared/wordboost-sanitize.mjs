/**
 * WordBoost — normalisation et validation partagée (scripts admin Node).
 * Le front Webflow duplique la même logique dans scripts/pages/profile/wordboost2.js
 */

/** Ligatures Unicode + ligatures typographiques Word/PDF */
export const LIGATURE_MAP = {
  œ: "oe",
  Œ: "Oe",
  æ: "ae",
  Æ: "Ae",
  ß: "ss",
  ĳ: "ij",
  Ĳ: "IJ",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB00": "ff",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
};

const LIGATURE_RE = /[œŒæÆßĳĲ\uFB01\uFB02\uFB00\uFB03\uFB04]/g;

export const MIN_WORD_LEN = 2;
export const MAX_WORD_LEN = 100;
export const MAX_WORD_PARTS = 6;

const SEG = "[A-Za-zÀ-ÖØ-öø-ÿ0-9''\\-]+";
const WORD_RE = new RegExp(`^${SEG}(\\s+${SEG}){0,${MAX_WORD_PARTS - 1}}$`);

export const normalizeLigatures = (w) =>
  String(w ?? "").replace(LIGATURE_RE, (c) => LIGATURE_MAP[c] ?? c);

export const trimWord = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

/** Détecte un texte lu en UTF-8 alors qu'il est en Windows-1252/latin-1 */
export function looksLikeMojibake(text) {
  return /[\uFFFD]/.test(text) || /(?:Ã.|Â.)/.test(text);
}

/**
 * Détecte un artefact Java List.toString() du type `[oiuytr]` ou `["oiuytr"]`.
 * @returns {{ unwrapped: boolean, value: string|null, reason?: string }}
 */
export function unwrapBracketArtifact(raw) {
  const trimmed = trimWord(raw);
  const m = /^\[(.*)\]$/.exec(trimmed);
  if (!m) return { unwrapped: false, value: trimmed };

  const innerRaw = m[1].trim();
  // Liste multi-éléments Java : "[a, b]" → invalide comme terme unique
  if (/,/.test(innerRaw)) {
    return { unwrapped: true, value: null, reason: "list_tostring" };
  }

  let inner = innerRaw;
  if (
    (inner.startsWith('"') && inner.endsWith('"')) ||
    (inner.startsWith("'") && inner.endsWith("'"))
  ) {
    inner = inner.slice(1, -1);
  }
  inner = trimWord(inner);
  if (!inner) return { unwrapped: true, value: null, reason: "invalide" };
  return { unwrapped: true, value: inner };
}

/**
 * Valide UN mot/terme après normalisation (+ unwrap crochets défensif).
 * @returns {{ ok: boolean, reason?: string, normalized: string, corrected?: boolean }}
 */
export function validateWord(raw) {
  const bracket = unwrapBracketArtifact(raw);
  if (bracket.unwrapped && bracket.value == null) {
    return {
      ok: false,
      reason: bracket.reason || "invalide",
      normalized: trimWord(raw),
      corrected: false,
    };
  }

  const source = bracket.value;
  const trimmed = trimWord(source);
  const normalized = normalizeLigatures(trimmed);
  const corrected = normalized !== trimWord(raw) || bracket.unwrapped;

  if (normalized.length < MIN_WORD_LEN) {
    return { ok: false, reason: "trop_court", normalized, corrected };
  }
  if (normalized.length > MAX_WORD_LEN) {
    return { ok: false, reason: "trop_long", normalized, corrected };
  }
  if (!WORD_RE.test(normalized)) {
    return { ok: false, reason: "invalide", normalized, corrected };
  }
  return { ok: true, normalized, corrected };
}

/**
 * Nettoie une liste de tokens pour l'API (Node/admin) ou re-load getWordBoost2.
 * @returns {{ words: string[], corrected: Array<{from:string,to:string}>, rejected: Array<{word:string,reason:string}> }}
 */
export function sanitizeWordList(words) {
  const out = [];
  const corrected = [];
  const rejected = [];
  const seen = new Set();

  for (const raw of words) {
    const v = validateWord(raw);
    if (!v.ok) {
      rejected.push({ word: String(raw ?? "").trim(), reason: v.reason ?? "invalide" });
      continue;
    }
    const key = v.normalized.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    if (v.corrected) corrected.push({ from: trimWord(raw), to: v.normalized });
    out.push(v.normalized);
  }

  return { words: out, corrected, rejected };
}

/** Message ON_ERROR : crochets dans got "..." = artefact serveur probable */
export function isBracketServerErrorMessage(userErrorMessage) {
  return /got "\[[^\"]*\]"/.test(String(userErrorMessage || ""));
}
