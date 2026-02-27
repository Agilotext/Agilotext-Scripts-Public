"""
anon_processor.py  —  v8.1.0-touati

Pipeline (name regex AVANT SpaCy pour ne pas morceler les noms) :
1. Name regex sur le texte ORIGINAL : Prénom NOM, NOM Prénom, Mme/M., 411NOM (compta).
2. SpaCy NER sur le texte original : PERSON / ORGANIZATION / LOCATION.
3. Fusion : on garde les spans name_regex qui ne chevauchent pas un LOCATION/ORG NER.
4. NOUVEAU (v8.1.0) : règles post-NER — noms composés, ville après CP, entités juridiques.
5. On retire les spans (fusionnés) qui chevauchent les regex dures.
6. On applique les spans fusionnés, puis les regex sur le texte masqué.
7. NOUVEAU (v8.1.0) : filtre faux codes (années ≠ CP, montants ≠ SIREN).

Corrections issues de l'audit Touati (25/02/2026) :
- Stoplist NER étendue (+40 termes : comptabilité, langues, évaluations, tech)
- Règle post-NER : extension noms composés (tirets)
- Règle post-NER : ville après code postal
- Règle post-NER : détection entités juridiques (SARL, SAS…)
- Filtre post-regex : années ≠ POSTAL_CODE, montants ≠ SIREN
"""

from pathlib import Path
import re

from anon.anon_replacer import AnonReplacer
from anon.anon_util import AnonUtil


MIN_LENGTH_FOR_NER = 2
DEBUG = False

# --- NER stoplist (v8.1.0-touati) : stoplist 8.0.0 + faux positifs audit Touati ---
NER_STOPLIST = {
    # Identifiants
    "iban", "bic", "swift", "rib", "nir", "nss", "siren", "siret", "tva",
    "ape", "naf", "urssaf", "nic",

    # Documents
    "bulletin", "contrat", "facture", "relance", "courrier", "objet",
    "extrait", "attestation", "certificat", "déclaration", "declaration",
    "fiche", "liste", "balance", "journal", "grand livre",
    "de paie", "de prestation", "de travail", "de service",

    # Comptabilité (existant + audit Touati)
    "conseil", "prestation", "ht", "ttc", "net", "brut",
    "total", "sous-total", "solde",
    "clients", "client", "fournisseurs", "fournisseur",
    "nominative", "fictif", "salarié", "salarie", "employeur",
    "salaire", "virement", "règlement", "reglement", "paiement",
    "exercice", "période", "periode", "compte", "bancaire",
    "sociale", "sociale nominative",
    "report", "créances", "creances", "amort", "amort.",
    "amortissement", "amortissements",
    "immobilisée", "immobilisee", "immobilisations",
    "capitaux", "classe", "passif", "actif",
    "résultat", "resultat", "dotations", "provisions",
    "charges", "produits", "exploitation",
    "euros", "caf", "ebe", "is",

    # Personnes génériques
    "madame", "monsieur", "mme", "mr", "m.",

    # Pays
    "ue", "france", "belgique", "luxembourg", "suisse", "allemagne",
    "pays", "autres pays",

    # Coordonnées
    "téléphone", "telephone", "tel", "tél", "fax", "email", "e-mail",
    "adresse", "mobile", "portable",

    # Langues (audit Touati — fichier 320)
    "français", "francais", "anglais", "espagnol",
    "allemand", "italien", "portugais", "arabe",
    "chinois", "japonais", "russe",
    "néerlandais", "neerlandais",
    "langue", "langues", "langue maternelle",
    "bilingue", "intermédiaire", "intermediaire",

    # Niveaux évaluation (audit Touati — fichier 321)
    "conforme", "très bon", "tres bon",
    "insuffisant", "exceptionnel",
    "à améliorer", "a ameliorer",

    # Tech / abréviations (audit Touati)
    "cv", "aws", "ci/cd", "devops", "saas", "paas", "iaas",

    # Mots génériques (audit Touati — fichier 320)
    "utilisateur", "utilisatrice",
    "linkedin", "linkedin.com",
}

# Mots-clés indiquant qu'un nombre 4 chiffres est une année, pas un CP
_YEAR_CONTEXT_KEYWORDS = {
    "exercice", "net", "brut", "année", "annee", "fiscal",
    "résultat", "resultat", "bilan", "antérieur", "anterieur",
    "précédent", "precedent", "clôture", "cloture",
    "n-1", "n-2", "n+1",
}

# Mots-clés indiquant qu'un nombre 9 chiffres est un montant, pas un SIREN
_AMOUNT_CONTEXT_KEYWORDS = {
    "résultat", "resultat", "bénéfice", "benefice", "perte",
    "chiffre d'affaires", "exercice", "marge", "total", "bilan", "montant",
    "solde", "charges", "produits", "dotation", "provision",
    "€", "eur", "euros",
}

# Regex pour ville après code postal
_CITY_AFTER_CP = re.compile(
    r"(\b\d{5}\b)"
    r"\s+"
    r"([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\-]+(?:\s*[A-ZÀ-Ÿa-zà-ÿ\-]+)*)"
)

# Patterns de raisons sociales françaises
_LEGAL_ENTITY_PATTERNS = [
    re.compile(
        r"(?<![a-zà-ÿ])"
        r"([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s&\-']+?)"
        r"\s+(SARL|SAS|SA|SCI|EURL|SNC|GIE|SASU|SEL|SELARL)"
        r"(?![a-zà-ÿ])"
    ),
    re.compile(
        r"(?<![a-zà-ÿ])"
        r"(SARL|SAS|SA|SCI|EURL|SNC|GIE|SASU|SEL|SELARL)"
        r"\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s&\-']+)"
        r"(?=[,\.\s\n]|$)"
    ),
    re.compile(
        r"(?:Cabinet|Société|Societe|Entreprise|Ets|Établissement|Etablissement)"
        r"\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s&\-']+)"
        r"(?=[,\.\s\n]|$)"
    ),
    re.compile(
        r"([A-ZÀ-Ÿ]{2,})"
        r"\s+(?:et|&)\s+(?:ASSOCIÉS|Associés|ASSOCIES|Associes)"
    ),
]


class AnonProcessor:

    _patterns = None

    @staticmethod
    def debug(text):
        if DEBUG:
            print(text)

    @staticmethod
    def _overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
        return a_start < b_end and b_start < a_end

    @staticmethod
    def _contained_in(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
        return b_start <= a_start and a_end <= b_end

    @staticmethod
    def _dedupe_non_overlapping(spans):
        spans_sorted = sorted(spans, key=lambda s: (s["start"], -(s["end"] - s["start"])))
        kept = []
        for s in spans_sorted:
            overlapped = False
            for k in kept:
                if AnonProcessor._overlaps(s["start"], s["end"], k["start"], k["end"]):
                    overlapped = True
                    break
            if not overlapped:
                kept.append(s)
        return kept

    @staticmethod
    def _apply_spans(text: str, spans):
        spans2 = AnonProcessor._dedupe_non_overlapping(spans)
        if not spans2:
            return text
        n = len(text)
        out = []
        last = 0
        for s in sorted(spans2, key=lambda x: (x["start"], -(x["end"] - x["start"]))):
            start = max(0, min(s["start"], n))
            end = max(start, min(s["end"], n))
            if start >= end or start < last:
                continue
            out.append(text[last:start])
            out.append(s["placeholder"])
            last = end
        out.append(text[last:])
        return "".join(out)

    @staticmethod
    def _context_window(text: str, start: int, end: int, radius: int = 50) -> str:
        a = max(0, start - radius)
        b = min(len(text), end + radius)
        return text[a:b].lower()

    @staticmethod
    def _relabel_birth_context(text: str, spans):
        birth_date_keywords = (
            "ne le", "née le", "nee le", "date de naissance", "né le", "nee(e) le"
        )
        birth_place_keywords = (
            "ne a", "née à", "nee a", "né à", "lieu de naissance"
        )

        for s in spans:
            if s.get("source") != "regex":
                continue
            if s.get("placeholder") == "[DATE]":
                ctx = AnonProcessor._context_window(text, s["start"], s["end"], 60)
                if any(k in ctx for k in birth_date_keywords):
                    s["placeholder"] = "[BIRTH_DATE]"

        for s in spans:
            if s.get("source") != "ner":
                continue
            if s.get("placeholder") == "[LOCATION]":
                ctx = AnonProcessor._context_window(text, s["start"], s["end"], 60)
                if any(k in ctx for k in birth_place_keywords):
                    s["placeholder"] = "[BIRTH_PLACE]"

        return spans

    @staticmethod
    def _init_patterns_if_needed():
        if AnonProcessor._patterns is None:
            AnonProcessor._patterns = AnonReplacer.build_patterns()

    @staticmethod
    def _build_ner_spans(doc):
        if doc is None:
            return []
        ner_spans = []
        doc_len = len(doc.text) if doc.text is not None else 0
        for ent in doc.ents:
            if ent is None:
                continue
            if ent.start_char is None or ent.end_char is None:
                continue
            if ent.text is None or len(ent.text.strip()) < MIN_LENGTH_FOR_NER:
                continue
            start = min(max(0, ent.start_char), doc_len)
            end = min(max(0, ent.end_char), doc_len)
            if start >= end:
                continue

            ent_lower = ent.text.strip().lower()
            if ent_lower in NER_STOPLIST:
                continue
            if any(ent_lower.startswith(s) or ent_lower.endswith(s) for s in NER_STOPLIST if len(s) > 2 and s in ent_lower):
                continue

            label = ent.label_
            if label in ("PER", "PERSON"):
                ner_spans.append({"start": start, "end": end, "placeholder": "[PERSON]", "source": "ner"})
            elif label == "ORG":
                ner_spans.append({"start": start, "end": end, "placeholder": "[ORGANIZATION]", "source": "ner"})
            elif label in ("LOC", "GPE"):
                ner_spans.append({"start": start, "end": end, "placeholder": "[LOCATION]", "source": "ner"})

        return ner_spans

    # --- Name regex on ORIGINAL text ---
    _NAME_PATTERNS = [
        re.compile(r"(?:Mme/M\.|Mme\s*/\s*M\.)\s+[A-ZÀ-Ÿ]{2,}\s+[A-ZÀ-Ÿ][a-zà-ÿ]+"),
        re.compile(r"(?:Mme/M\.|Mme\s*/\s*M\.)\s+[A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ]{2,}"),
        re.compile(r"(?<![A-ZÀ-Ÿa-zà-ÿ])([A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ]{2,})(?![A-ZÀ-Ÿa-zà-ÿ])"),
        re.compile(r"(?<![A-ZÀ-Ÿa-zà-ÿ])([A-ZÀ-Ÿ]{2,}\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)(?![A-ZÀ-Ÿa-zà-ÿ])"),
        re.compile(r"(?:Madame|Monsieur|Mme|M\.)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ]{2,})"),
        re.compile(r"(?:Compte\s+)?4\d{2}\s*([A-ZÀ-Ÿ]{2,})(?=\s|:|$)"),
    ]

    _NAME_STOPLIST = {
        "de", "du", "la", "le", "les", "des", "en", "et", "ou", "au", "aux",
        "rue", "bd", "boulevard", "avenue", "impasse", "chemin", "quai", "allée",
        "place", "passage", "cours", "route",
        "sarl", "sas", "sa", "sci", "sci", "eurl", "snc", "gie",
        "siret", "siren", "nir", "iban", "bic", "tva", "vat",
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
        "paie", "facture", "prestation", "contrat",
        "ht", "ttc", "net", "brut", "total",
        "fournisseurs", "clients", "fournisseur", "client",
        "abc", "xyz",
    }

    @staticmethod
    def _build_name_regex_spans(text: str):
        spans = []
        for pat in AnonProcessor._NAME_PATTERNS:
            for m in pat.finditer(text):
                has_group = pat.groups and pat.groups > 0
                name = m.group(1) if has_group else m.group(0)
                if name is None:
                    continue
                name_lower = name.strip().lower()
                words = name_lower.replace(".", " ").split()
                if any(w in AnonProcessor._NAME_STOPLIST for w in words):
                    continue
                if len(name.strip()) < 4:
                    continue
                start = m.start(1) if has_group else m.start(0)
                end = m.end(1) if has_group else m.end(0)
                spans.append({
                    "start": start,
                    "end": end,
                    "placeholder": "[PERSON]",
                    "source": "name_regex"
                })
        return spans

    # --- v8.1.0-touati : règles post-NER ---

    @staticmethod
    def _post_ner_extend_compound_names(text, spans):
        """Étendre les spans [PERSON] aux noms composés (Marie-X, X-André)."""
        extended = []
        for s in spans:
            if s.get("placeholder") != "[PERSON]":
                extended.append(s)
                continue

            start, end = s["start"], s["end"]

            if start >= 2 and text[start - 1] == "-":
                left = start - 2
                while left > 0 and (text[left - 1].isalpha() or text[left - 1] in "àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ"):
                    left -= 1
                if text[left].isupper():
                    start = left

            if end < len(text) - 1 and text[end] == "-":
                right = end + 1
                while right < len(text) and (text[right].isalpha() or text[right] in "àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ"):
                    right += 1
                if end + 1 < len(text) and text[end + 1].isupper():
                    end = right

            extended.append({**s, "start": start, "end": end})
        return extended

    @staticmethod
    def _post_ner_city_after_cp(text, existing_spans):
        """Taguer [LOCATION] les villes qui suivent immédiatement un [POSTAL_CODE]."""
        cp_ends = set()
        for s in existing_spans:
            if s.get("placeholder") == "[POSTAL_CODE]":
                cp_ends.add(s["end"])

        new_spans = []
        for m in _CITY_AFTER_CP.finditer(text):
            cp_end_pos = m.start(1) + len(m.group(1))
            if cp_end_pos not in cp_ends:
                digits = m.group(1)
                if not any(s["start"] <= m.start(1) < s["end"] for s in existing_spans
                           if s.get("placeholder") == "[POSTAL_CODE]"):
                    continue

            city_start = m.start(2)
            city_end = m.end(2)
            city_text = m.group(2).strip()

            if len(city_text) < 2:
                continue

            months = {"janvier", "février", "fevrier", "mars", "avril", "mai", "juin",
                      "juillet", "août", "aout", "septembre", "octobre", "novembre",
                      "décembre", "decembre"}
            if city_text.lower().split()[0] in months:
                continue

            if any(AnonProcessor._overlaps(city_start, city_end, s["start"], s["end"])
                   for s in existing_spans if s.get("placeholder") != "[POSTAL_CODE]"):
                continue

            new_spans.append({
                "start": city_start,
                "end": city_end,
                "placeholder": "[LOCATION]",
                "source": "post_ner_rule"
            })

        return existing_spans + new_spans

    @staticmethod
    def _post_ner_legal_entities(text, existing_spans):
        """Détecter les raisons sociales (SARL, SAS, Cabinet…) non couvertes par NER."""
        new_spans = []
        for pat in _LEGAL_ENTITY_PATTERNS:
            for m in pat.finditer(text):
                start, end = m.start(), m.end()
                if any(AnonProcessor._overlaps(start, end, s["start"], s["end"])
                       for s in existing_spans):
                    continue
                new_spans.append({
                    "start": start,
                    "end": end,
                    "placeholder": "[ORGANIZATION]",
                    "source": "post_ner_rule"
                })
        return existing_spans + new_spans

    @staticmethod
    def _post_regex_filter_false_codes(text, regex_spans):
        """Filtrer les faux POSTAL_CODE (années) et faux SIREN (montants)."""
        filtered = []
        for s in regex_spans:
            keep = True

            if s["placeholder"] == "[POSTAL_CODE]":
                matched = text[s["start"]:s["end"]].strip()
                if re.match(r"^\d{4}$", matched):
                    year = int(matched)
                    if 1900 <= year <= 2030:
                        ctx = AnonProcessor._context_window(text, s["start"], s["end"], 40)
                        if any(kw in ctx for kw in _YEAR_CONTEXT_KEYWORDS):
                            keep = False

            elif s["placeholder"] == "[SIREN]":
                ctx = AnonProcessor._context_window(text, s["start"], s["end"], 60)
                if any(kw in ctx for kw in _AMOUNT_CONTEXT_KEYWORDS):
                    keep = False

            if keep:
                filtered.append(s)
        return filtered

    # --- Pipeline principal ---

    @staticmethod
    def _process_text(text: str, doc, cell_mode: bool):
        AnonProcessor._init_patterns_if_needed()

        # 1. Name regex on ORIGINAL text
        name_spans = AnonProcessor._build_name_regex_spans(text)

        # 2. Regex dures
        regex_spans_original = AnonReplacer.find_regex_spans(
            text, AnonProcessor._patterns, cell_mode=cell_mode
        )
        hard_placeholders = {
            "[EMAIL]", "[URL]", "[PHONE]", "[IBAN]", "[BIC]", "[RIB]",
            "[VAT]", "[SIRET]", "[SIREN]", "[NIR]", "[URSSAF_ID]", "[FISCAL_ID]",
            "[POSTAL_CODE]", "[DATE]"
        }
        hard_regex = [s for s in regex_spans_original if s["placeholder"] in hard_placeholders]

        # 3. NER SpaCy
        ner_spans = AnonProcessor._build_ner_spans(doc)
        filtered_ner = [
            n for n in ner_spans
            if not any(AnonProcessor._overlaps(n["start"], n["end"], h["start"], h["end"])
                       for h in hard_regex)
        ]

        filtered_ner = [
            n for n in filtered_ner
            if n["placeholder"] != "[PERSON]"
            or not any(AnonProcessor._contained_in(n["start"], n["end"], ns["start"], ns["end"])
                       for ns in name_spans)
        ]

        name_spans_ok = [
            ns for ns in name_spans
            if not any(AnonProcessor._overlaps(ns["start"], ns["end"], n["start"], n["end"])
                       for n in filtered_ner if n["placeholder"] in ("[LOCATION]", "[ORGANIZATION]"))
        ]

        combined = name_spans_ok + filtered_ner

        # 4. Règles post-NER (v8.1.0-touati)
        combined = AnonProcessor._post_ner_extend_compound_names(text, combined)
        combined = AnonProcessor._post_ner_city_after_cp(text, combined + hard_regex)
        combined = [s for s in combined if s.get("placeholder") != "[POSTAL_CODE]" or s.get("source") != "regex"]
        combined = combined + [s for s in hard_regex if s.get("placeholder") == "[POSTAL_CODE]"]
        combined = AnonProcessor._post_ner_legal_entities(text, combined)

        combined = AnonProcessor._relabel_birth_context(text, combined)
        text1 = AnonProcessor._apply_spans(text, combined)

        # 5. Regex finales sur texte masqué
        regex_spans = AnonReplacer.find_regex_spans(
            text1, AnonProcessor._patterns, cell_mode=cell_mode
        )
        regex_spans = AnonProcessor._post_regex_filter_false_codes(text1, regex_spans)
        regex_spans = AnonProcessor._relabel_birth_context(text1, regex_spans)

        return AnonProcessor._apply_spans(text1, regex_spans)

    @staticmethod
    def do_anon_text(text: str, nlp, cell_mode: bool = False):
        if text is None:
            text = ""
        if not isinstance(text, str):
            text = str(text)

        doc = nlp(text)
        return AnonProcessor._process_text(text, doc, cell_mode=cell_mode)

    @staticmethod
    def do_anon_nodes(nodes, nlp):
        if nodes is None:
            raise ValueError("nodes cannot be null")

        texts = ["" if x is None else (x if isinstance(x, str) else str(x)) for x in nodes]
        docs = list(nlp.pipe(texts))
        out = []
        for s, d in zip(texts, docs):
            try:
                out.append(AnonProcessor._process_text(s, d, cell_mode=True))
            except Exception as e:
                print("AnonProcessor: error on one node, keeping original. Error: " + str(e))
                out.append(s)

        return out

    @staticmethod
    def do_anon_main(file_path: str, nlp):
        text = Path(file_path).read_text(encoding="utf-8", errors="replace")
        out_text = AnonProcessor.do_anon_text(text, nlp, cell_mode=False)

        AnonUtil.display_with_time("Anonymisation done.")
        return out_text
