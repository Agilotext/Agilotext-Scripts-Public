#!/usr/bin/env python3
"""Agiloshield anonymization CLI for Claude Agent Skills.

Stdlib-only client for api.agilotext.com Anon2. Bundled in the skill ZIP so
Claude can pseudonymize local files before reading them. Each subcommand prints
a single JSON object to stdout on success; errors go to stderr as {"error": "..."}.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sys
import time
import zipfile
import zlib
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

try:
    from . import config
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import config  # type: ignore

PROFILE_TYPES: dict[str, list[str]] = {
    "ma": ["PER", "ORG", "ADR", "IDN"],
    "legal": ["PER", "ORG", "ADR", "EML", "TEL", "IDN"],
    "hr": ["PER", "ADR", "EML", "TEL", "IDN", "IBA", "JOB"],
    "health": ["PER", "ADR", "EML", "TEL", "IDN", "PII", "DAT"],
    "developer": ["PER", "ORG", "EML", "TEL", "URL", "IDN"],
}

SUPPORTED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "json", "fec",
}

POLL_INTERVAL_INITIAL = 2.5
POLL_INTERVAL_MAX = 5.0

TOKEN_PATTERN = re.compile(r"<[A-Z]{2,4}_[A-Z0-9]{1,4}>")
EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    re.IGNORECASE,
)
PHONE_FR_RE = re.compile(
    r"(?:\+33|0033|0)\s*[1-9](?:[\s.\-]?\d{2}){4}\b"
)
SIREN_RE = re.compile(r"\b\d{3}\s?\d{3}\s?\d{3}\b")
SIRET_RE = re.compile(r"\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b")
IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){2,7}[A-Z0-9]{1,4}\b")
NIR_RE = re.compile(
    r"\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b"
)
MAX_LEAK_SAMPLES = 5


def die(message: str, exit_code: int = 1) -> None:
    sys.stderr.write(json.dumps({"error": message}) + "\n")
    sys.exit(exit_code)


def emit(payload: Any) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")


def api_url(path: str) -> str:
    return config.API_BASE.rstrip("/") + path


def resolve_entity_types() -> list[str]:
    profile = getattr(config, "PROFILE", "ma")
    custom = getattr(config, "ENTITY_TYPES", None)
    if custom and profile == "custom":
        return [t.upper() for t in custom]
    if custom and profile != "custom":
        return [t.upper() for t in custom]
    return list(PROFILE_TYPES.get(profile, PROFILE_TYPES["ma"]))


def is_pseudonymize_mode() -> bool:
    mode = getattr(config, "MODE", "pseudonymize").lower()
    return mode != "anonymize"


def parse_content_disposition_filename(header: str | None) -> str | None:
    if not header:
        return None
    match = re.search(r'filename[*]?=(?:UTF-8\'\'|")?([^";\n]+)', header, re.I)
    if not match:
        return None
    return urllib.parse.unquote(match.group(1).replace('"', "").strip())


def encode_multipart(
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str | None]] | None = None,
) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    lines: list[bytes] = []

    for name, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        lines.append(f"{value}\r\n".encode())

    for name, (filename, content, content_type) in (files or {}).items():
        ctype = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        lines.append(f"Content-Type: {ctype}\r\n\r\n".encode())
        lines.append(content)
        lines.append(b"\r\n")

    lines.append(f"--{boundary}--\r\n".encode())
    body = b"".join(lines)
    return body, f"multipart/form-data; boundary={boundary}"


def uses_get_token() -> bool:
    return bool(getattr(config, "USE_GET_TOKEN", False))


class AgiloshieldClient:
    def __init__(self) -> None:
        self._token: str | None = None

    def fetch_get_token(self) -> str:
        edition = getattr(config, "EDITION", "ent")
        query = urllib.parse.urlencode(
            {"username": config.USERNAME, "edition": edition}
        )
        req = urllib.request.Request(
            api_url("/getToken") + "?" + query,
            headers={"User-Agent": "Python-urllib/3.12"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            die(f"HTTP {exc.code} getToken: {exc.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as exc:
            die(f"Réseau getToken: {exc.reason}")

        if data.get("status") != "OK" or not data.get("token"):
            die(f"getToken échoué: {data}")

        return str(data["token"])

    def ensure_token(self) -> str:
        auto_token = getattr(config, "AUTOMATION_TOKEN", "") or ""
        if auto_token.strip():
            return auto_token.strip()

        if self._token:
            return self._token

        if uses_get_token():
            self._token = self.fetch_get_token()
            return self._token

        token = getattr(config, "TOKEN", "") or ""
        if token.strip():
            self._token = token.strip()
            return self._token

        password = getattr(config, "PASSWORD", "") or ""
        if not password.strip():
            die(
                "Auth manquante dans config.py — SKILL_TOKEN, USE_GET_TOKEN, AUTOMATION_TOKEN, TOKEN ou PASSWORD requis"
            )

        body = urllib.parse.urlencode(
            {
                "username": config.USERNAME,
                "password": password,
                "edition": getattr(config, "EDITION", "ent"),
            }
        ).encode()

        req = urllib.request.Request(
            api_url("/getAuthToken"),
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            die(f"HTTP {exc.code} getAuthToken: {exc.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as exc:
            die(f"Réseau getAuthToken: {exc.reason}")

        if data.get("status") != "OK" or not data.get("token"):
            die(f"Authentification échouée: {data}")

        self._token = str(data["token"])
        return self._token

    def _auth_fields(self) -> dict[str, str]:
        skill_token = getattr(config, "SKILL_TOKEN", "") or ""
        if skill_token.strip():
            return {
                "username": config.USERNAME,
                "skillToken": skill_token.strip(),
                "edition": getattr(config, "EDITION", "agiloshield"),
            }

        auto_token = getattr(config, "AUTOMATION_TOKEN", "") or ""
        if auto_token.strip():
            return {
                "username": config.USERNAME,
                "automationToken": auto_token.strip(),
                "edition": getattr(config, "EDITION", "ent"),
            }

        token = self.ensure_token()
        return {
            "username": config.USERNAME,
            "token": token,
            "edition": getattr(config, "EDITION", "ent"),
        }

    def post_urlencoded(self, path: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        fields = {**self._auth_fields(), **(extra or {})}
        body = urllib.parse.urlencode({k: str(v) for k, v in fields.items()}).encode()
        req = urllib.request.Request(
            api_url(path),
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
                if not raw:
                    return {}
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            die(f"HTTP {exc.code} {path}: {exc.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as exc:
            die(f"Réseau {path}: {exc.reason}")
        return {}

    def post_urlencoded_binary(
        self, path: str, extra: dict[str, Any] | None = None
    ) -> tuple[bytes, str | None]:
        fields = {**self._auth_fields(), **(extra or {})}
        body = urllib.parse.urlencode({k: str(v) for k, v in fields.items()}).encode()
        req = urllib.request.Request(
            api_url(path),
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                content = resp.read()
                filename = parse_content_disposition_filename(resp.headers.get("Content-Disposition"))
                return content, filename
        except urllib.error.HTTPError as exc:
            die(f"HTTP {exc.code} {path}: {exc.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as exc:
            die(f"Réseau {path}: {exc.reason}")
        return b"", None

    def post_multipart_json(
        self,
        path: str,
        extra: dict[str, Any] | None = None,
        files: dict[str, tuple[str, bytes]] | None = None,
    ) -> dict[str, Any]:
        fields = {k: str(v) for k, v in {**self._auth_fields(), **(extra or {})}.items()}
        file_payload = {
            k: (fn, data, None) for k, (fn, data) in (files or {}).items()
        }
        body, content_type = encode_multipart(fields, file_payload)
        req = urllib.request.Request(
            api_url(path),
            data=body,
            headers={"Content-Type": content_type},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                raw = resp.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except urllib.error.HTTPError as exc:
            die(f"HTTP {exc.code} {path}: {exc.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as exc:
            die(f"Réseau {path}: {exc.reason}")
        return {}

    def post_multipart_binary(
        self,
        path: str,
        extra: dict[str, Any] | None = None,
        files: dict[str, tuple[str, bytes]] | None = None,
    ) -> tuple[bytes, str | None]:
        fields = {k: str(v) for k, v in {**self._auth_fields(), **(extra or {})}.items()}
        file_payload = {
            k: (fn, data, None) for k, (fn, data) in (files or {}).items()
        }
        body, content_type = encode_multipart(fields, file_payload)
        req = urllib.request.Request(
            api_url(path),
            data=body,
            headers={"Content-Type": content_type},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                content = resp.read()
                filename = parse_content_disposition_filename(resp.headers.get("Content-Disposition"))
                return content, filename
        except urllib.error.HTTPError as exc:
            die(f"HTTP {exc.code} {path}: {exc.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as exc:
            die(f"Réseau {path}: {exc.reason}")
        return b"", None

    def get_user_defaults(self) -> dict[str, Any]:
        try:
            return self.post_urlencoded("/getAnon2UserDefaults")
        except SystemExit:
            raise
        except Exception:
            return self.post_urlencoded("/getAnon2UserOptions")

    def set_user_defaults(self, types: list[str], do_pseudo: bool) -> None:
        self.post_urlencoded(
            "/setAnon2UserDefaults",
            {
                "anon2OptionsJson": json.dumps(types),
                "doPseudoAnon": "true" if do_pseudo else "false",
            },
        )

    def extract_job_ids(self, data: dict[str, Any]) -> list[int]:
        if isinstance(data.get("jobIdList"), list):
            return [int(x) for x in data["jobIdList"] if str(x).isdigit() or isinstance(x, int)]
        if isinstance(data.get("jobIds"), list):
            return [int(x) for x in data["jobIds"]]
        if data.get("jobId") is not None:
            return [int(data["jobId"])]
        return []

    def upload_file(self, file_path: Path) -> int:
        content = file_path.read_bytes()
        data = self.post_multipart_json(
            "/anon2AsyncOfficeText",
            {"removeImages": "true"},
            {"fileUpload[]": (file_path.name, content)},
        )
        job_ids = self.extract_job_ids(data)
        if not job_ids:
            die(f"Aucun jobId retourné: {data}")
        return job_ids[0]

    def poll_until_done(self, job_id: int, timeout: float) -> None:
        deadline = time.monotonic() + timeout
        delay = POLL_INTERVAL_INITIAL
        last_status = "PENDING"

        while time.monotonic() < deadline:
            data = self.post_urlencoded("/getAnon2Status", {"jobId": job_id})
            anon_status = str(data.get("anonStatus", "")).upper()
            last_status = anon_status or "PENDING"

            if anon_status == "READY":
                return
            if anon_status == "ON_ERROR":
                msg = data.get("userErrorMessage") or data.get("javaException") or "Erreur serveur"
                die(f"Job {job_id} en erreur: {msg}")
            if anon_status in ("CANCELED", "CANCELLED"):
                die(f"Job {job_id} annulé")

            time.sleep(delay)
            delay = min(delay * 1.2, POLL_INTERVAL_MAX)

        die(f"Timeout ({int(timeout)}s) en attente du job {job_id}, dernier statut: {last_status}")

    def receive_file(self, job_id: int, file_type: str) -> bytes:
        content, _ = self.post_urlencoded_binary(
            "/receiveAnon2Text",
            {"jobId": job_id, "fileType": file_type},
        )
        return content


def assert_supported(path: Path) -> None:
    ext = path.suffix.lstrip(".").lower()
    if ext not in SUPPORTED_EXTENSIONS:
        die(
            f"Extension .{ext} non supportée. Formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )


def sandbox_root(source_path: Path) -> Path:
    custom = getattr(config, "OUTPUT_DIR", "") or ""
    if custom.strip():
        return Path(custom).expanduser().resolve()

    resolved = source_path.expanduser().resolve()
    for index, part in enumerate(resolved.parts):
        if part == ".agiloshield":
            return Path(*resolved.parts[: index + 1])

    return resolved.parent / ".agiloshield"


def unique_output_path(directory: Path, base: str, suffix: str, ext: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    safe_base = re.sub(r"[^\w.-]+", "_", base)
    candidate = directory / f"{safe_base}{suffix}{ext}"
    if not candidate.exists():
        return candidate
    index = 2
    while True:
        candidate = directory / f"{safe_base}{suffix}.{index}{ext}"
        if not candidate.exists():
            return candidate
        index += 1


def is_safe_output_path(path: Path) -> bool:
    name = path.name.lower()
    return ".pseudonymized." in name or ".anonymized." in name or name.endswith(
        (".pseudonymized", ".anonymized")
    )


def luhn_check(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if len(digits) < 2:
        return False
    total = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0


def iban_mod97(iban: str) -> bool:
    cleaned = re.sub(r"\s+", "", iban.upper())
    if len(cleaned) < 15 or len(cleaned) > 34:
        return False
    if not re.match(r"^[A-Z]{2}\d{2}[A-Z0-9]+$", cleaned):
        return False
    rearranged = cleaned[4:] + cleaned[:4]
    numeric = ""
    for char in rearranged:
        if char.isdigit():
            numeric += char
        elif "A" <= char <= "Z":
            numeric += str(ord(char) - 55)
        else:
            return False
    try:
        return int(numeric) % 97 == 1
    except ValueError:
        return False


def mask_sample(value: str, visible: int = 4) -> str:
    compact = value.strip()
    if len(compact) <= visible:
        return "***"
    return compact[:visible] + "…"


def append_leak(
    leaks: list[dict[str, str]],
    leak_type: str,
    sample: str,
    seen: set[tuple[str, str]],
) -> None:
    if len(leaks) >= MAX_LEAK_SAMPLES:
        return
    key = (leak_type, sample[:80])
    if key in seen:
        return
    seen.add(key)
    leaks.append({"type": leak_type, "sample": mask_sample(sample)})


def extract_office_xml_text(path: Path) -> str:
    parts: list[str] = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if not name.endswith(".xml"):
                continue
            if not any(
                fragment in name
                for fragment in ("word/", "xl/", "ppt/", "docProps/", "content.xml")
            ):
                continue
            try:
                parts.append(archive.read(name).decode("utf-8", errors="ignore"))
            except KeyError:
                continue
    return "\n".join(parts)


def extract_pdf_text_best_effort(data: bytes) -> str:
    chunks: list[str] = []
    for match in re.finditer(rb"[\x20-\x7e]{8,}", data):
        chunks.append(match.group().decode("ascii", errors="ignore"))
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data, re.DOTALL):
        stream = match.group(1).strip(b"\r\n")
        if not stream:
            continue
        try:
            decompressed = zlib.decompress(stream)
            chunks.append(decompressed.decode("latin-1", errors="ignore"))
        except zlib.error:
            continue
    return "\n".join(chunks)


def extract_text_for_verify(path: Path) -> tuple[str, str]:
    ext = path.suffix.lstrip(".").lower()
    data = path.read_bytes()

    if ext in {"txt", "csv", "json", "fec"}:
        return data.decode("utf-8", errors="ignore"), ext
    if ext in {"doc", "docx", "xls", "xlsx", "ppt", "pptx"}:
        try:
            return extract_office_xml_text(path), ext
        except zipfile.BadZipFile:
            return data.decode("latin-1", errors="ignore"), f"{ext}_raw"
    if ext == "pdf":
        return extract_pdf_text_best_effort(data), "pdf_best_effort"
    return data.decode("latin-1", errors="ignore"), ext


def scan_potential_leaks(text: str) -> list[dict[str, str]]:
    leaks: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for match in EMAIL_RE.finditer(text):
        append_leak(leaks, "email", match.group(0), seen)

    for match in PHONE_FR_RE.finditer(text):
        append_leak(leaks, "phone_fr", match.group(0), seen)

    for match in SIRET_RE.finditer(text):
        digits = re.sub(r"\D", "", match.group(0))
        if len(digits) == 14 and luhn_check(digits):
            append_leak(leaks, "siret", match.group(0), seen)

    for match in SIREN_RE.finditer(text):
        digits = re.sub(r"\D", "", match.group(0))
        if len(digits) == 9 and luhn_check(digits):
            append_leak(leaks, "siren", match.group(0), seen)

    for match in IBAN_RE.finditer(text):
        if iban_mod97(match.group(0)):
            append_leak(leaks, "iban", match.group(0), seen)

    for match in NIR_RE.finditer(text):
        append_leak(leaks, "nir", match.group(0), seen)

    return leaks


def save_saved_defaults(data: dict[str, Any]) -> dict[str, Any]:
    raw = data.get("anon2OptionsJson")
    if isinstance(raw, list):
        anon2_options = json.dumps(raw)
    elif isinstance(raw, str):
        anon2_options = raw
    else:
        anon2_options = None

    pseudo = data.get("doPseudoAnon")
    do_pseudo = pseudo is True or str(pseudo).lower() in ("true", "1")

    return {"anon2OptionsJson": anon2_options, "doPseudoAnon": do_pseudo}


def restore_defaults(client: AgiloshieldClient, saved: dict[str, Any]) -> None:
    if not saved.get("anon2OptionsJson"):
        return
    try:
        types = json.loads(saved["anon2OptionsJson"])
        client.set_user_defaults(types, saved.get("doPseudoAnon", False))
    except (json.JSONDecodeError, TypeError):
        pass


def cmd_pseudonymize(args: argparse.Namespace) -> None:
    source = Path(args.file).expanduser().resolve()
    if not source.is_file():
        die(f"Fichier introuvable: {source}")
    assert_supported(source)

    types = resolve_entity_types()
    do_pseudo = is_pseudonymize_mode()
    client = AgiloshieldClient()
    timeout = float(getattr(config, "POLL_TIMEOUT_SECONDS", 300))

    saved = save_saved_defaults(client.get_user_defaults())
    client.set_user_defaults(types, do_pseudo)

    try:
        job_id = client.upload_file(source)
        client.poll_until_done(job_id, timeout)

        suffix = ".pseudonymized" if do_pseudo else ".anonymized"
        ext = source.suffix
        base = source.stem

        outputs_dir = sandbox_root(source) / "outputs"
        keys_dir = sandbox_root(source) / "keys"

        anon_content = client.receive_file(job_id, "ANON")
        pseudo_path = unique_output_path(outputs_dir, base, suffix, ext)
        pseudo_path.write_bytes(anon_content)

        result: dict[str, Any] = {
            "job_id": job_id,
            "pseudonymized": str(pseudo_path),
            "source": str(source),
            "profile": getattr(config, "PROFILE", "ma"),
            "types": types,
            "mode": "pseudonymize" if do_pseudo else "anonymize",
        }

        if do_pseudo:
            try:
                props_content = client.receive_file(job_id, "properties")
                props_path = unique_output_path(keys_dir, base, "", ".properties")
                props_path.write_bytes(props_content)
                result["properties"] = str(props_path)
            except SystemExit:
                raise
            except Exception as exc:
                die(f"Clé .properties indisponible — restauration impossible: {exc}")

        result["next_step"] = "verify"
        result["verify_command"] = (
            f'python3 agiloshield.py verify "{result["pseudonymized"]}"'
        )
        result["gate"] = (
            "STOP: lancer verify, presenter le recap, attendre l'accord explicite "
            "de l'utilisateur avant toute lecture du fichier pseudonymise."
        )
        emit(result)
    finally:
        restore_defaults(client, saved)


def cmd_verify(args: argparse.Namespace) -> None:
    target = Path(args.file).expanduser().resolve()
    if not target.is_file():
        die(f"Fichier introuvable: {target}")
    if not is_safe_output_path(target):
        die(
            "verify n'accepte que les sorties .pseudonymized.* ou .anonymized.* — "
            "ne jamais verifier l'original."
        )

    text, format_scanned = extract_text_for_verify(target)
    tokens = TOKEN_PATTERN.findall(text)
    leaks = scan_potential_leaks(text)
    verified = len(leaks) == 0

    note = ""
    if format_scanned == "pdf_best_effort":
        note = (
            "Scan PDF best-effort (flux compresses) ; relire manuellement si doute."
        )

    emit(
        {
            "verified": verified,
            "tokens_found": len(tokens),
            "potential_leaks": leaks,
            "format_scanned": format_scanned,
            "path": str(target),
            "note": note,
            "gate": (
                "STOP: demander l'accord explicite de l'utilisateur avant d'analyser "
                "ce fichier. Ne jamais deduire l'accord du silence."
            ),
        }
    )


def cmd_restore(args: argparse.Namespace) -> None:
    pseudo = Path(args.pseudonymized).expanduser().resolve()
    props = Path(args.properties).expanduser().resolve()

    if not pseudo.is_file():
        die(f"Fichier pseudonymisé introuvable: {pseudo}")
    if not props.is_file():
        die(f"Fichier .properties introuvable: {props}")

    client = AgiloshieldClient()
    content, _ = client.post_multipart_binary(
        "/reconcileAnon2Text",
        {},
        {
            "anonFile": (pseudo.name, pseudo.read_bytes()),
            "propertiesFile": (props.name, props.read_bytes()),
        },
    )

    restored_dir = sandbox_root(pseudo) / "restored"
    ext = pseudo.suffix
    base = pseudo.stem.replace(".pseudonymized", "").replace(".anonymized", "")
    if base.endswith(".pseudonymized") or base.endswith(".anonymized"):
        base = Path(base).stem

    restored_path = unique_output_path(restored_dir, base, ".restored", ext)
    restored_path.write_bytes(content)

    emit({"restored": str(restored_path), "source_pseudonymized": str(pseudo)})


def cmd_settings(_: argparse.Namespace) -> None:
    auth_method = "getToken"
    if getattr(config, "SKILL_TOKEN", ""):
        auth_method = "skillToken"
    elif getattr(config, "AUTOMATION_TOKEN", ""):
        auth_method = "automationToken"
    elif not uses_get_token() and getattr(config, "PASSWORD", ""):
        auth_method = "getAuthToken"
    elif not uses_get_token() and getattr(config, "TOKEN", ""):
        auth_method = "staticToken"

    emit(
        {
            "api_base": config.API_BASE,
            "username": config.USERNAME,
            "edition": getattr(config, "EDITION", "ent"),
            "profile": getattr(config, "PROFILE", "ma"),
            "entity_types": resolve_entity_types(),
            "mode": getattr(config, "MODE", "pseudonymize"),
            "auth_method": auth_method,
            "use_get_token": uses_get_token(),
            "has_token": bool(getattr(config, "TOKEN", "")),
            "has_password": bool(getattr(config, "PASSWORD", "")),
        }
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="agiloshield", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_pseudo = sub.add_parser(
        "pseudonymize",
        help="Pseudonymise un fichier local via l'API Agiloshield Anon2.",
    )
    p_pseudo.add_argument("file", help="Chemin absolu ou relatif du document.")
    p_pseudo.set_defaults(func=cmd_pseudonymize)

    p_restore = sub.add_parser(
        "restore",
        help="Restaure un fichier pseudonymisé avec sa clé .properties.",
    )
    p_restore.add_argument("pseudonymized", help="Fichier .pseudonymized.*")
    p_restore.add_argument(
        "--properties",
        required=True,
        help="Chemin du fichier .properties associé.",
    )
    p_restore.set_defaults(func=cmd_restore)

    p_verify = sub.add_parser(
        "verify",
        help="Verifie une sortie pseudonymisee (tokens + fuites PII residuelles).",
    )
    p_verify.add_argument(
        "file",
        help="Chemin du fichier .pseudonymized.* ou .anonymized.* uniquement.",
    )
    p_verify.set_defaults(func=cmd_verify)

    p_settings = sub.add_parser("settings", help="Affiche la configuration active.")
    p_settings.set_defaults(func=cmd_settings)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
