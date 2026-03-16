"""
anon_replacer.py

Purpose
-------
Utility functions for rule-based detection of sensitive patterns in text.

What this module does
---------------------
- Compiles regex patterns and detects spans for:
  - EMAIL
  - URL (http/https/ftp, www.*)
  - PHONE (French formats, +33/0033/0X)
  - IBAN (with MOD97 validation, supports foreign IBAN)
  - BIC/SWIFT (context-gated)
- RIB (context-gated or key-validated, including numeric-only 23-digit form)
  - SIREN (with Luhn validation, tolerant on explicit "SIREN:" field)
  - SIRET (with Luhn validation, tolerant on explicit "SIRET:" field)
  - VAT (French VAT number, tolerant on explicit "TVA:" field)
  - APE/NAF (context-gated)
  - FISCAL_ID (13 digits, context-gated)
  - URSSAF_ID (ONLY when explicitly written after "URSSAF")
  - NIR (French SSN, MOD97 key validation, tolerant on explicit SSN fields)
  - DATE (ISO, slash, dash, and "3 janvier 2001" style)
  - POSTAL_CODE (FR + NL + CH + BE + LU, with prudent heuristics)

Output format
-------------
find_regex_spans() returns a list of spans:
  {"start": int, "end": int, "placeholder": str, "source": "regex"}

Notes
-----
- This module intentionally does NOT detect MONEY.
- Validations (MOD97, Luhn) reduce false positives.
- URSSAF is not a "generic id" regex anymore: only explicit URSSAF fields are tagged.
- Postal code: FR 5 digits validated, NL 4+2 letters, CH/BE/LU 4 digits with context heuristics.
"""

import re


class AnonReplacer:
    _RIB_CONTEXT_KEYWORDS = (
        "rib",
        "releve d'identite bancaire",
        "releve d'identité bancaire",
        "iban",
        "banque",
        "bancaire",
        "compte",
        "n° compte",
        "nº compte",
        "numero de compte",
        "numéro de compte",
        "cpt",
        "bpm",
        "credit agricole",
        "crédit agricole",
        "ca cpt",
    )

    _SIREN_EXCLUDE_CONTEXT = (
        "résultat",
        "resultat",
        "exercice",
        "marge",
        "excédent",
        "excedent",
        "total",
        "bilan",
        "montant",
        "produit",
        "charge",
        "dotation",
        "provision",
        "solde",
        "bénéfice",
        "benefice",
        "perte",
        "euros",
        "€",
    )

    @staticmethod
    def build_patterns():
        months = (
            r"janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|"
            r"septembre|octobre|novembre|décembre|decembre"
        )

        return {
            "EMAIL": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),

            # URL: http(s)://..., ftp://..., www....
            "URL": re.compile(
                r"(?<!\w)(?:https?://|ftp://|www\.)"
                r"[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}"
                r"(?:/[^\s<>\"]*)?",
                re.IGNORECASE
            ),

            # Phone numbers: handles "+33636123575" and "+33 (0)1 56 40 08 79"
            "PHONE": re.compile(
                r"(?<!\w)(?:"
                r"(?:\(\s*)?(?:\+33|0033)(?:\s*\))?\s*(?:[\s.\-]*\(\s*0\s*\)\s*)?[1-9](?:[\s.\-]*\d{2}){4}"
                r"|"
                r"0[1-9](?:[\s.\-]*\d{2}){4}"
                r")(?!\d)"
            ),

            # Any country IBAN, validated with MOD97
            # (?<!\w)/(?!\w) and \s* after country code for "FR 76 ..." and letters in account (e.g. 3M02)
            "IBAN": re.compile(
                r"(?<!\w)[A-Z]{2}\s*\d{2}(?:[\s.\-]*[A-Z0-9]){11,30}(?!\w)",
                re.IGNORECASE
            ),

            "BIC": re.compile(r"\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b"),

            # RIB blocks: bank(5) branch(5) account(11 alnum) key(2)
            "RIB": re.compile(r"\b\d{5}[\s.\-]*\d{5}[\s.\-]*[A-Z0-9]{11}[\s.\-]*\d{2}\b", re.IGNORECASE),
            # Numeric-only legacy French account format (23 contiguous digits)
            "RIB_23": re.compile(r"(?<!\d)\d{23}(?!\d)"),

            # SIREN / SIRET: digits with optional separators; use digit lookarounds (safer than \b)
            "SIREN": re.compile(r"(?<!\d)(?:\d[\s.\-]*){8}\d(?!\d)"),
            "SIRET": re.compile(r"(?<!\d)(?:\d[\s.\-]*){13}\d(?!\d)"),

            # French VAT: FR + 2 chars key + 9 digits (SIREN); \s* after FR for "FR 12 534990981"
            "VAT_FR": re.compile(r"(?<!\w)FR\s*[0-9A-Z]{2}(?:[\s.\-]*\d){9}(?!\w)", re.IGNORECASE),

            # APE/NAF: 4 digits + 1 letter, context-gated
            "APE": re.compile(r"\b\d{4}\s*[A-Z]\b", re.IGNORECASE),

            # FISCAL_ID: 13 digits, context-gated
            "FISCAL_ID": re.compile(r"(?<!\d)(?:\d[\s.\-]*){12}\d(?!\d)"),

            # URSSAF: allow optional region text, but require explicit number marker
            "URSSAF_LINE": re.compile(
                r"(?im)\burssaf\b[^\d\n]{0,100}?(?:n[°o]|num(?:e|é)ro)\s*[:#-]?\s*"
                r"(\d(?:[ .-]?\d){8,17})"
            ),
            # RCS line: capture the SIREN part even when "SIREN" keyword is absent
            "RCS_SIREN_LINE": re.compile(
                r"(?im)\brcs\b[^\n\d]{0,80}((?:\d[\s.\-]*){8}\d)"
            ),

            # NIR (French SSN), 15 chars; [\s.\-]* for DSN no-space format and with spaces
            "NIR": re.compile(
                r"(?<!\d)[12][\s.\-]*\d{2}[\s.\-]*(?:0[1-9]|1[0-2])[\s.\-]*(?:\d{2}|2[AB])[\s.\-]*\d{3}[\s.\-]*\d{3}[\s.\-]*\d{2}(?!\d)",
                re.IGNORECASE
            ),

            # NIR explicit field: capture only after SSN keywords
            "NIR_FIELD_LINE": re.compile(
                r"(?im)\b(?:nir|nss|n[°o]\s*ss|num(?:e|é)ro\s+de\s+s[eé]curit[eé]\s+sociale|"
                r"secu(?:rit[eé])?\s+sociale|n[°o]\s*secu)\b\s*(?:[:#-]\s*)?"
                r"([0-9AB\s.\-]{11,30})"
            ),

            "DATE_TEXT": re.compile(rf"\b(?:\d{{1,2}}|1er)\s+(?:{months})\s+\d{{4}}\b", re.IGNORECASE),
            "DATE_ISO": re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
            "DATE_SLASH": re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"),
            "DATE_DASH": re.compile(r"\b\d{1,2}-\d{1,2}-\d{2,4}\b"),

            # POSTAL CODE
            "POSTAL_FR": re.compile(r"(?<!\d)\d{5}(?!\d)"),
            "POSTAL_NL": re.compile(r"\b\d{4}\s*[A-Z]{2}\b", re.IGNORECASE),
            "POSTAL_PREFIX_4": re.compile(r"\b(?:CH|BE|B|LU|L)\s*[-]?\s*(\d{4})\b", re.IGNORECASE),
            "POSTAL_4": re.compile(r"(?<!\d)\d{4}(?!\d)"),
        }

    @staticmethod
    def _normalize_alnum(s: str) -> str:
        return re.sub(r"[^A-Za-z0-9]", "", s or "")

    @staticmethod
    def _normalize_digits(s: str) -> str:
        return re.sub(r"\D", "", s or "")

    @staticmethod
    def _trim_trailing_punct(text: str, start: int, end: int) -> int:
        while end > start and text[end - 1] in ".,);:,":
            end -= 1
        return end

    @staticmethod
    def _context_window(text: str, start: int, end: int, radius: int = 40) -> str:
        a = max(0, start - radius)
        b = min(len(text), end + radius)
        return (text or "")[a:b].lower()

    @staticmethod
    def _context_has_keywords(ctx: str, keywords) -> bool:
        if not ctx:
            return False
        return any(k in ctx for k in keywords)

    @staticmethod
    def _rib_account_to_digits(account: str) -> str:
        trans = {
            "A": "1", "J": "1",
            "B": "2", "K": "2", "S": "2",
            "C": "3", "L": "3", "T": "3",
            "D": "4", "M": "4", "U": "4",
            "E": "5", "N": "5", "V": "5",
            "F": "6", "O": "6", "W": "6",
            "G": "7", "P": "7", "X": "7",
            "H": "8", "Q": "8", "Y": "8",
            "I": "9", "R": "9", "Z": "9",
        }
        out = []
        for ch in (account or "").upper():
            if "0" <= ch <= "9":
                out.append(ch)
            elif "A" <= ch <= "Z":
                mapped = trans.get(ch)
                if mapped is None:
                    return ""
                out.append(mapped)
            else:
                return ""
        return "".join(out)

    @staticmethod
    def _rib_key_is_valid(bank: str, branch: str, account: str, key: str) -> bool:
        bank_n = AnonReplacer._normalize_digits(bank)
        branch_n = AnonReplacer._normalize_digits(branch)
        account_n = AnonReplacer._rib_account_to_digits(AnonReplacer._normalize_alnum(account))
        key_n = AnonReplacer._normalize_digits(key)

        if len(bank_n) != 5 or len(branch_n) != 5 or len(account_n) != 11 or len(key_n) != 2:
            return False

        value = (89 * int(bank_n) + 15 * int(branch_n) + 3 * int(account_n)) % 97
        expected = 97 - value
        if expected == 0:
            expected = 97

        return int(key_n) == expected

    @staticmethod
    def _luhn_is_valid(number: str) -> bool:
        if number is None or not number.isdigit():
            return False

        total = 0
        parity = len(number) % 2
        for i, ch in enumerate(number):
            d = ord(ch) - 48
            if i % 2 == parity:
                d *= 2
                if d > 9:
                    d -= 9
            total += d
        return total % 10 == 0

    @staticmethod
    def _iban_mod97_is_valid(iban_raw: str) -> bool:
        if iban_raw is None:
            return False

        iban = AnonReplacer._normalize_alnum(iban_raw).upper()
        if len(iban) < 15 or len(iban) > 34:
            return False

        if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{11,30}", iban):
            return False

        rearranged = iban[4:] + iban[:4]

        mod = 0
        for ch in rearranged:
            if "0" <= ch <= "9":
                mod = (mod * 10 + (ord(ch) - 48)) % 97
            else:
                v = ord(ch) - 55
                mod = (mod * 100 + v) % 97

        return mod == 1

    @staticmethod
    def _vat_fr_is_valid(vat_raw: str) -> bool:
        vat = AnonReplacer._normalize_alnum(vat_raw).upper()
        if not vat.startswith("FR"):
            return False
        if len(vat) != 13:
            return False

        key2 = vat[2:4]
        siren = vat[4:]

        if not siren.isdigit() or len(siren) != 9:
            return False

        if key2.isdigit():
            k = int(key2)
            s = int(siren)
            expected = (12 + 3 * (s % 97)) % 97
            return k == expected

        return False

    @staticmethod
    def _nir_is_valid(nir_raw: str) -> bool:
        nir = AnonReplacer._normalize_alnum(nir_raw).upper()
        if len(nir) != 15:
            return False

        body = nir[:13]
        key = nir[13:]
        if not key.isdigit():
            return False

        dep = body[5:7]
        if dep == "2A":
            body_num = body[:5] + "19" + body[7:]
        elif dep == "2B":
            body_num = body[:5] + "18" + body[7:]
        else:
            body_num = body

        if not body_num.isdigit():
            return False

        n = int(body_num)
        k = int(key)
        expected = 97 - (n % 97)
        if expected == 97:
            expected = 0

        return k == expected

    @staticmethod
    def _postal_fr_is_valid(code_raw: str) -> bool:
        code = AnonReplacer._normalize_digits(code_raw)
        if len(code) != 5:
            return False
        if code == "00000":
            return False
        if code == "98000":
            return True
        dep2 = code[:2]
        try:
            dep = int(dep2)
        except Exception:
            return False
        if dep == 20:
            return True
        if 1 <= dep <= 95:
            return True
        if dep2 in ("97", "98"):
            return True
        return False

    @staticmethod
    def _postal_4_is_valid(code_raw: str) -> bool:
        code = AnonReplacer._normalize_digits(code_raw)
        if len(code) != 4:
            return False
        if code == "0000":
            return False
        if code[0] == "0":
            return False
        v = int(code)
        return 1000 <= v <= 9999

    @staticmethod
    def _postal_keywords_in_context(ctx: str) -> bool:
        return (
            re.search(r"\bcp\b", ctx) is not None
            or "code postal" in ctx
            or "postal code" in ctx
            or "postcode" in ctx
            or "zip" in ctx
            or re.search(r"\bnpa\b", ctx) is not None
            or re.search(r"\bplz\b", ctx) is not None
        )

    @staticmethod
    def _country_hint_in_context(ctx: str) -> bool:
        return (
            "suisse" in ctx or "switzerland" in ctx or "schweiz" in ctx
            or "belgique" in ctx or "belgie" in ctx or "belgië" in ctx or "belgium" in ctx
            or "luxembourg" in ctx or "luxemburg" in ctx
            or "pays-bas" in ctx or "nederland" in ctx or "netherlands" in ctx
        )

    @staticmethod
    def _looks_like_city_after(text: str, end: int) -> bool:
        tail = (text or "")[end:end + 50]
        m = re.match(r"\s+([A-Za-zÀ-ÿ])([A-Za-zÀ-ÿ' -]{1,})", tail)
        if not m:
            return False
        if not m.group(1).isupper():
            return False
        word = (m.group(1) + m.group(2)).strip().lower()
        months = {
            "janvier", "février", "fevrier", "mars", "avril", "mai", "juin",
            "juillet", "août", "aout", "septembre", "octobre", "novembre",
            "décembre", "decembre"
        }
        if word.split(" ")[0] in months:
            return False
        return True

    @staticmethod
    def find_regex_spans(text: str, patterns, cell_mode: bool = False):
        spans = []

        def add(label: str, start: int, end: int):
            end2 = AnonReplacer._trim_trailing_punct(text, start, end)
            if end2 <= start:
                return
            spans.append({
                "start": start,
                "end": end2,
                "placeholder": "[" + label + "]",
                "source": "regex"
            })

        # EMAIL
        for m in patterns["EMAIL"].finditer(text):
            add("EMAIL", m.start(), m.end())

        # URL
        for m in patterns["URL"].finditer(text):
            add("URL", m.start(), m.end())

        # PHONE
        for m in patterns["PHONE"].finditer(text):
            add("PHONE", m.start(), m.end())

        # --- Patch 4: IBAN with structural fallback ---
        # Known IBAN lengths by country (ISO 13616)
        _IBAN_LENGTHS = {
            "FR": 27, "DE": 22, "BE": 16, "LU": 20, "CH": 21,
            "ES": 24, "IT": 27, "NL": 18, "PT": 25, "AT": 20,
            "GB": 22, "IE": 22, "MC": 27, "LI": 21, "AD": 24,
        }
        for m in patterns["IBAN"].finditer(text):
            raw = m.group(0)
            if AnonReplacer._iban_mod97_is_valid(raw):
                add("IBAN", m.start(), m.end())
            else:
                # Structural fallback: accept if format + length match a known country
                norm = AnonReplacer._normalize_alnum(raw).upper()
                country = norm[:2] if len(norm) >= 2 else ""
                expected_len = _IBAN_LENGTHS.get(country)
                if expected_len and len(norm) == expected_len:
                    add("IBAN", m.start(), m.end())
                elif len(norm) >= 15 and re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{11,30}", norm):
                    # Unknown country but strong structural match + context hint
                    ctx = AnonReplacer._context_window(text, m.start(), m.end(), 60)
                    if ("iban" in ctx) or ("virement" in ctx) or ("compte" in ctx) or ("bancaire" in ctx):
                        add("IBAN", m.start(), m.end())

        # BIC (context-gated)
        for m in patterns["BIC"].finditer(text):
            ctx = AnonReplacer._context_window(text, m.start(), m.end(), 40)
            if ("bic" in ctx) or ("swift" in ctx) or ("iban" in ctx):
                add("BIC", m.start(), m.end())

        # RIB (context or key validated) + numeric-only 23-digit variant
        rib_seen = set()

        def add_rib_if_valid(start: int, end: int, raw: str):
            norm = AnonReplacer._normalize_alnum(raw).upper()
            if len(norm) != 23:
                return

            is_valid_key = AnonReplacer._rib_key_is_valid(
                norm[:5], norm[5:10], norm[10:21], norm[21:23]
            )
            ctx = AnonReplacer._context_window(text, start, end, 60)
            has_context = AnonReplacer._context_has_keywords(ctx, AnonReplacer._RIB_CONTEXT_KEYWORDS)

            if not (is_valid_key or has_context):
                return

            span_key = (start, end)
            if span_key in rib_seen:
                return
            rib_seen.add(span_key)
            add("RIB", start, end)

        for m in patterns["RIB"].finditer(text):
            add_rib_if_valid(m.start(), m.end(), m.group(0))
        for m in patterns["RIB_23"].finditer(text):
            add_rib_if_valid(m.start(), m.end(), m.group(0))

        # VAT first (it can include SIREN digits)
        for m in patterns["VAT_FR"].finditer(text):
            raw = m.group(0)
            if AnonReplacer._vat_fr_is_valid(raw):
                add("VAT", m.start(), m.end())
            else:
                ctx = AnonReplacer._context_window(text, m.start(), m.end(), 40)
                if ("tva" in ctx) or ("vat" in ctx):
                    add("VAT", m.start(), m.end())

        # RCS explicit line: SIREN is expected after "RCS <city>"
        for m in patterns["RCS_SIREN_LINE"].finditer(text):
            raw = m.group(1)
            digits = AnonReplacer._normalize_digits(raw)
            if len(digits) == 9:
                add("SIREN", m.start(1), m.end(1))

        # SIRET
        for m in patterns["SIRET"].finditer(text):
            digits = AnonReplacer._normalize_digits(m.group(0))
            already_covered = False
            for existing in spans:
                if existing["placeholder"] in ("[IBAN]", "[NIR]", "[VAT]") and \
                   m.start() < existing["end"] and existing["start"] < m.end():
                    already_covered = True
                    break
            if already_covered:
                continue
            if len(digits) == 14 and AnonReplacer._luhn_is_valid(digits):
                add("SIRET", m.start(), m.end())
            else:
                ctx = AnonReplacer._context_window(text, m.start(), m.end(), 30)
                if ("siret" in ctx or "siren" in ctx or "employeur" in ctx
                        or "société" in ctx or "societe" in ctx or "sarl" in ctx
                        or "sas" in ctx or "sci" in ctx or "eurl" in ctx) and len(digits) == 14:
                    add("SIRET", m.start(), m.end())

        # URSSAF: only replace the captured value after the keyword
        for m in patterns["URSSAF_LINE"].finditer(text):
            raw = m.group(1)
            digits = AnonReplacer._normalize_digits(raw)
            if 9 <= len(digits) <= 18:
                add("URSSAF_ID", m.start(1), m.end(1))

        # NIR explicit field
        for m in patterns["NIR_FIELD_LINE"].finditer(text):
            raw = m.group(1)
            if raw is None:
                continue
            norm = AnonReplacer._normalize_alnum(raw).upper()

            if len(norm) == 15:
                # Tolerant on explicit field
                add("NIR", m.start(1), m.end(1))
            elif len(norm) == 13 and norm.isdigit():
                add("NIR", m.start(1), m.end(1))

        # --- Patch 3: NIR with structural acceptance --- (before SIREN so NIR wins on overlap)
        for m in patterns["NIR"].finditer(text):
            raw = m.group(0)
            norm = AnonReplacer._normalize_alnum(raw).upper()
            if len(norm) == 15 and norm[0] in "12":
                add("NIR", m.start(), m.end())
            elif AnonReplacer._nir_is_valid(raw):
                add("NIR", m.start(), m.end())
            else:
                ctx = AnonReplacer._context_window(text, m.start(), m.end(), 40)
                if ("nir" in ctx) or ("nss" in ctx) or ("securite sociale" in ctx) or ("sécurité sociale" in ctx):
                    add("NIR", m.start(), m.end())

        # SIREN — after NIR/VAT/SIRET/IBAN; skip if this match is inside an existing protected span
        for m in patterns["SIREN"].finditer(text):
            digits = AnonReplacer._normalize_digits(m.group(0))
            if len(digits) != 9:
                continue
            ctx = AnonReplacer._context_window(text, m.start(), m.end(), 80)
            has_explicit_siren = re.search(r"\bsiren\b", ctx) is not None
            has_excluded_context = AnonReplacer._context_has_keywords(
                ctx, AnonReplacer._SIREN_EXCLUDE_CONTEXT
            )
            if has_excluded_context and not has_explicit_siren:
                continue
            already_covered = False
            for existing in spans:
                if existing["placeholder"] in ("[IBAN]", "[NIR]", "[SIRET]", "[VAT]") and \
                   m.start() < existing["end"] and existing["start"] < m.end():
                    already_covered = True
                    break
            if already_covered:
                continue
            if AnonReplacer._luhn_is_valid(digits):
                add("SIREN", m.start(), m.end())
            else:
                if has_explicit_siren and len(digits) == 9:
                    add("SIREN", m.start(), m.end())

        # FISCAL_ID (context-gated)
        for m in patterns["FISCAL_ID"].finditer(text):
            digits = AnonReplacer._normalize_digits(m.group(0))
            if len(digits) == 13 and digits[0] in ("0", "1", "2", "3"):
                ctx = AnonReplacer._context_window(text, m.start(), m.end(), 60)
                if ("numero fiscal" in ctx) or ("num fiscal" in ctx) or ("identifiant fiscal" in ctx) or ("nif" in ctx) or ("fiscal" in ctx):
                    add("FISCAL_ID", m.start(), m.end())

        # APE/NAF (context-gated)
        for m in patterns["APE"].finditer(text):
            ctx = AnonReplacer._context_window(text, m.start(), m.end(), 30)
            if ("ape" in ctx) or ("naf" in ctx):
                add("APE", m.start(), m.end())

        # POSTAL CODE - NL first (strong pattern)
        for m in patterns["POSTAL_NL"].finditer(text):
            raw = m.group(0)
            digits = AnonReplacer._normalize_digits(raw)
            if len(digits) == 4 and AnonReplacer._postal_4_is_valid(digits):
                add("POSTAL_CODE", m.start(), m.end())

        # POSTAL CODE - FR (5 digits, validated); skip if context suggests check number (CHQ n°)
        for m in patterns["POSTAL_FR"].finditer(text):
            if not AnonReplacer._postal_fr_is_valid(m.group(0)):
                continue
            ctx_before = (text or "")[max(0, m.start() - 30):m.start()].lower()
            if re.search(r"\b(?:chq|cheque|chèque|n°|nº)\s*$", ctx_before):
                continue
            add("POSTAL_CODE", m.start(), m.end())

        # POSTAL CODE - prefixed 4 digits: CH-1202, BE 1000, L-1116, etc.
        for m in patterns["POSTAL_PREFIX_4"].finditer(text):
            code4 = m.group(1)
            if code4 is None:
                continue
            if AnonReplacer._postal_4_is_valid(code4):
                add("POSTAL_CODE", m.start(1), m.end(1))

        # POSTAL CODE - 4 digits (CH/BE/LU)
        for m in patterns["POSTAL_4"].finditer(text):
            code4 = m.group(0)
            if not AnonReplacer._postal_4_is_valid(code4):
                continue
            stripped = (text or "").strip()
            if cell_mode and stripped == code4:
                add("POSTAL_CODE", m.start(), m.end())
                continue
            ctx = AnonReplacer._context_window(text, m.start(), m.end(), 60)
            if AnonReplacer._postal_keywords_in_context(ctx):
                add("POSTAL_CODE", m.start(), m.end())
                continue
            if AnonReplacer._country_hint_in_context(ctx):
                add("POSTAL_CODE", m.start(), m.end())
                continue
            if AnonReplacer._looks_like_city_after(text, m.end()):
                add("POSTAL_CODE", m.start(), m.end())
                continue

        # Dates
        for key in ("DATE_TEXT", "DATE_ISO", "DATE_SLASH", "DATE_DASH"):
            for m in patterns[key].finditer(text):
                add("DATE", m.start(), m.end())

        return spans
