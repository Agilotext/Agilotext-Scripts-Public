#!/usr/bin/env python3
"""Library2 STANDARD admin pipeline (isolated IDs < -1).

Not Maestro create_prompt (that creates a USER on the token account).
Never targetUsername. Never www. Default visible=false. Never prints tokens.

Auth: AGILOTEXT_USERNAME + AGILOTEXT_TOKEN + AGILOTEXT_EDITION
      or --env-file (KEY=value). Memberstack Super Admin is not enough.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://api.agilotext.com/api/v1"
LIB2 = API + "/library2"

SKELETON_HTML = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Compte rendu Agilotext</title>
</head>
<body>
  <h1>Compte rendu</h1>
  ${CONTENT}
</body>
</html>
"""

WHITELIST_MSG = (
    "403 ADMIN_REQUIRED: ce username n’est pas administrateur API. "
    "Memberstack Super Admin ne suffit pas. Demander à Nico de whitelist "
    "le compte (ParmsAgilotUtil / system username), puis relancer check-admin. "
    "Ne pas inventer d’UI admin dans la biblio client."
)


def eprint(*args: Any) -> None:
    print(*args, file=sys.stderr)


def load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key:
            out[key] = val
    return out


def redact(text: str, token: str) -> str:
    if not text:
        return ""
    s = str(text)
    if token and token in s:
        s = s.replace(token, "[token]")
    return s


class Library2Admin:
    def __init__(self, username: str, token: str, edition: str, password: str = "") -> None:
        self.username = username
        self.token = token
        self.edition = edition or "ent"
        self.password = password

    def auth(self) -> dict[str, str]:
        return {
            "username": self.username,
            "token": self.token,
            "edition": self.edition,
        }

    def refresh_token(self) -> bool:
        if not self.password:
            return False
        payload = urlencode({
            "username": self.username,
            "password": self.password,
            "edition": self.edition,
        }).encode("utf-8")
        req = Request(API + "/getAuthToken", data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("Accept", "application/json")
        status, _, body = self._open(req)
        try:
            data = json.loads(body.decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            return False
        token = ""
        if isinstance(data, dict):
            token = str(data.get("token") or data.get("authToken") or "")
            if not token and isinstance(data.get("data"), dict):
                token = str(data["data"].get("token") or "")
        if status == 200 and token:
            self.token = token
            print("token rafraîchi via getAuthToken (hash non affiché)")
            return True
        return False

    def _open(self, req: Request) -> tuple[int, str, bytes]:
        try:
            with urlopen(req, timeout=45) as res:
                body = res.read()
                return res.status, res.headers.get("Content-Type", ""), body
        except HTTPError as err:
            body = err.read() if err.fp else b""
            return err.code, err.headers.get("Content-Type", "") if err.headers else "", body
        except URLError as err:
            raise SystemExit("Réseau: " + redact(str(err.reason), self.token)) from err

    def post_form(self, url: str, fields: dict[str, Any], *, _retried: bool = False) -> dict[str, Any]:
        payload = urlencode({k: str(v) for k, v in {**self.auth(), **fields}.items()}).encode("utf-8")
        req = Request(url, data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("Accept", "application/json")
        status, ctype, body = self._open(req)
        parsed = self._parse(status, ctype, body)
        if not _retried and (status == 401 or str(parsed.get("code") or "") in ("INVALID_TOKEN", "ERROR_INVALID_TOKEN")):
            if self.refresh_token():
                return self.post_form(url, fields, _retried=True)
        return parsed

    def post_multipart(self, url: str, fields: dict[str, Any], filename: str, html: bytes) -> dict[str, Any]:
        boundary = "----AgiloLib2" + uuid.uuid4().hex
        chunks: list[bytes] = []
        merged = {**self.auth(), **fields}

        def add_field(name: str, value: str) -> None:
            chunks.append(f"--{boundary}\r\n".encode("utf-8"))
            chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
            chunks.append(value.encode("utf-8") + b"\r\n")

        for name, value in merged.items():
            add_field(name, str(value))
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(
            f'Content-Disposition: form-data; name="fileUpload"; filename="{filename}"\r\n'.encode("utf-8")
        )
        chunks.append(b"Content-Type: text/html; charset=UTF-8\r\n\r\n")
        chunks.append(html)
        chunks.append(b"\r\n")
        chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
        body = b"".join(chunks)
        req = Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        req.add_header("Accept", "application/json")
        status, ctype, raw = self._open(req)
        return self._parse(status, ctype, raw)

    def get_bytes(self, url: str, fields: dict[str, Any]) -> tuple[int, str, bytes]:
        payload = urlencode({k: str(v) for k, v in {**self.auth(), **fields}.items()}).encode("utf-8")
        req = Request(url, data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        return self._open(req)

    def _parse(self, status: int, ctype: str, body: bytes) -> dict[str, Any]:
        text = body.decode("utf-8", errors="replace")
        data: Any
        try:
            data = json.loads(text) if text else {}
        except json.JSONDecodeError:
            data = {"raw": redact(text[:400], self.token)}
        if isinstance(data, dict):
            data["_http"] = status
            data["_ctype"] = ctype
            if isinstance(data.get("message"), str):
                data["message"] = redact(data["message"], self.token)
        return data if isinstance(data, dict) else {"_http": status, "raw": data}

    def member_access(self) -> dict[str, Any]:
        return self.post_form(LIB2 + "/member-access", {})

    def audit(self, limit: int = 1) -> dict[str, Any]:
        return self.post_form(LIB2 + "/listPromptLibraryAudit", {"limit": limit})

    def list_standard(self) -> dict[str, Any]:
        return self.post_form(LIB2 + "/getPromptModelsStandardInfo", {})

    def card(self, prompt_id: int) -> dict[str, Any] | None:
        res = self.list_standard()
        rows = res.get("promptModeInfoDTOList") or []
        for row in rows:
            if Number(row.get("promptModelId")) == prompt_id:
                return row
        return None

    def create(self, name: str, content: str, business_type: str, reason: str) -> dict[str, Any]:
        return self.post_form(
            LIB2 + "/createPromptModelStandard",
            {
                "promptName": name,
                "promptContent": content,
                "businessType": business_type or "generic",
                "reason": reason,
            },
        )

    def metadata(self, prompt_id: int, revision: int, reason: str, fields: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "promptId": prompt_id,
            "expectedRevision": revision,
            "reason": reason,
        }
        payload.update(fields)
        return self.post_form(LIB2 + "/updatePromptModelStandardMetadata", payload)

    def upload_html(
        self, prompt_id: int, name: str, content: str, revision: int, reason: str, html: bytes
    ) -> dict[str, Any]:
        return self.post_multipart(
            LIB2 + "/updatePromptModelFileStandard",
            {
                "promptId": prompt_id,
                "promptName": name,
                "promptContent": content,
                "expectedRevision": revision,
                "reason": reason,
            },
            f"template-{prompt_id}.html",
            html,
        )

    def get_user_content(self, prompt_id: int) -> dict[str, Any]:
        return self.post_form(API + "/getPromptModelContent", {"promptId": prompt_id})

    def receive_html(self, prompt_id: int) -> tuple[int, bytes]:
        status, ctype, body = self.get_bytes(LIB2 + "/receivePromptModelTemplate", {"promptId": prompt_id})
        return status, body


def Number(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def creds_from(args: argparse.Namespace) -> Library2Admin:
    env: dict[str, str] = {}
    if args.env_file:
        path = Path(args.env_file).expanduser()
        if not path.is_file():
            raise SystemExit(f"env-file introuvable: {path}")
        env = load_env_file(path)
    username = os.environ.get("AGILOTEXT_USERNAME") or os.environ.get("AGILO_USERNAME") or env.get("AGILOTEXT_USERNAME") or ""
    token = os.environ.get("AGILOTEXT_TOKEN") or os.environ.get("AGILO_TOKEN") or env.get("AGILOTEXT_TOKEN") or ""
    edition = os.environ.get("AGILOTEXT_EDITION") or os.environ.get("AGILO_EDITION") or env.get("AGILOTEXT_EDITION") or "ent"
    password = (
        os.environ.get("AGILOTEXT_PASSWORD")
        or os.environ.get("AGILOTEXT_APP_PASSWORD")
        or os.environ.get("AGILOTEXT_ADMIN_PASSWORD")
        or env.get("AGILOTEXT_PASSWORD")
        or env.get("AGILOTEXT_APP_PASSWORD")
        or env.get("AGILOTEXT_ADMIN_PASSWORD")
        or ""
    )
    if not username or not (token or password):
        raise SystemExit("Manque AGILOTEXT_USERNAME et TOKEN ou mot de passe (ou --env-file).")
    return Library2Admin(username, token, edition, password)


def print_json(data: dict[str, Any]) -> None:
    slim = {k: v for k, v in data.items() if k not in ("token",)}
    print(json.dumps(slim, ensure_ascii=False, indent=2))


def cmd_check_admin(api: Library2Admin) -> int:
    access = api.member_access()
    hint = access.get("admin")
    print("member-access http=%s admin_field=%s username=%s" % (
        access.get("_http"), hint, access.get("username") or api.username
    ))
    if access.get("_http") in (401, 403) and access.get("code") not in ("ADMIN_REQUIRED", None):
        eprint("Auth: " + str(access.get("code") or access.get("message") or access.get("_http")))
        return 1
    audit = api.audit(1)
    code = audit.get("code")
    http = audit.get("_http")
    print("listPromptLibraryAudit http=%s code=%s" % (http, code or audit.get("status")))
    if http == 403 or code == "ADMIN_REQUIRED":
        eprint(WHITELIST_MSG)
        return 2
    if http != 200:
        eprint("Audit inattendu: " + json.dumps({k: audit.get(k) for k in ("status", "code", "message", "_http")}, ensure_ascii=False))
        return 1
    print("OK: le token a le rôle administrateur API (pas seulement member-access.admin).")
    print("createPromptModelStandard n’a pas été appelé (pas de STANDARD fantôme).")
    print("Pour créer: pipeline.py create --manifest … (reste hidden). Publish: --i-reviewed.")
    return 0


def read_manifest(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit("Manifest JSON objet requis.")
    return data


def resolve_text(manifest: dict[str, Any], key: str, path_key: str, base: Path) -> str:
    if manifest.get(path_key):
        p = Path(manifest[path_key])
        if not p.is_absolute():
            p = base / p
        return p.read_text(encoding="utf-8")
    return str(manifest.get(key) or "")


def extract_content(res: dict[str, Any]) -> str:
    for key in ("promptModelContent", "promptContent", "content", "text", "promptText", "prompt"):
        val = res.get(key)
        if isinstance(val, str) and val.strip():
            return val
    data = res.get("data")
    if isinstance(data, dict):
        return extract_content(data)
    return ""


def public_card(card: dict[str, Any] | None) -> dict[str, Any]:
    if not card:
        return {}
    keys = (
        "promptModelId", "promptModelName", "visible", "revision", "hasHtml",
        "categoryKey", "iconKey", "businessType", "featured", "requiresUserCopy",
        "canUse", "acquiredPromptModelId", "usageCountGlobal", "ratingAvg", "ratingCount",
    )
    return {k: card.get(k) for k in keys}


def cmd_create(api: Library2Admin, args: argparse.Namespace) -> int:
    man_path = Path(args.manifest).expanduser()
    man = read_manifest(man_path)
    base = man_path.parent
    name = str(man.get("promptName") or "").strip()
    content = resolve_text(man, "promptContent", "promptContentPath", base).strip()
    reason = str(man.get("reason") or args.reason or "Flo library2 hidden create").strip()
    if not name or not content:
        raise SystemExit("Manifest: promptName + promptContent (ou promptContentPath) requis.")
    if args.publish and not args.i_reviewed:
        raise SystemExit("Publish refusé: passe --i-reviewed après recette du hidden.")
    created = api.create(name, content, str(man.get("businessType") or "generic"), reason)
    if created.get("_http") == 403 or created.get("code") == "ADMIN_REQUIRED":
        eprint(WHITELIST_MSG)
        print_json(created)
        return 2
    if created.get("_http") != 200 or str(created.get("status", "")).upper() != "OK":
        eprint("create échoué")
        print_json(created)
        return 1
    prompt_id = Number(created.get("promptModelId"))
    print("created promptModelId=%s visible=false" % prompt_id)
    card = api.card(prompt_id)
    print("card", json.dumps(public_card(card), ensure_ascii=False))
    revision = Number(card.get("revision") if card else 1) or 1
    meta_fields = {}
    for key in ("publicDescription", "publicExample", "iconKey", "categoryKey", "businessType"):
        if man.get(key) not in (None, ""):
            meta_fields[key] = man[key]
    if man.get("featured") is not None:
        meta_fields["featured"] = "true" if man.get("featured") else "false"
    if man.get("sortOrder") is not None:
        meta_fields["sortOrder"] = man["sortOrder"]
    if meta_fields:
        meta = api.metadata(prompt_id, revision, reason, meta_fields)
        if meta.get("_http") != 200:
            eprint("metadata échoué (le STANDARD reste hidden)")
            print_json(meta)
            return 1
        card = api.card(prompt_id)
        revision = Number(card.get("revision") if card else revision + 1)
        print("metadata ok revision=%s" % revision)
    html = b""
    if man.get("htmlPath"):
        html_path = Path(man["htmlPath"])
        if not html_path.is_absolute():
            html_path = base / html_path
        html = html_path.read_bytes()
    elif man.get("htmlInline") == "skeleton":
        html = SKELETON_HTML.encode("utf-8")
    if html:
        up = api.upload_html(prompt_id, name, content, revision, reason, html)
        if up.get("_http") != 200:
            eprint("HTML échoué (le STANDARD reste hidden, texte OK)")
            print_json(up)
            return 1
        card = api.card(prompt_id)
        print("html ok hasHtml=%s revision=%s" % (
            (card or {}).get("hasHtml"), (card or {}).get("revision")
        ))
    if args.publish:
        return cmd_publish(api, prompt_id, reason)
    print("STOP: visible=false. Recette Bauer/admin, puis: publish --id %s --i-reviewed --reason '…'" % prompt_id)
    return 0


def cmd_promote(api: Library2Admin, args: argparse.Namespace) -> int:
    user_id = args.user_id
    src = api.get_user_content(user_id)
    content = extract_content(src)
    if src.get("_http") != 200 or not content.strip():
        eprint("Impossible de lire le USER %s" % user_id)
        print_json(src)
        return 1
    man_path = Path(args.manifest).expanduser()
    man = read_manifest(man_path)
    man["promptContent"] = content
    man.pop("promptContentPath", None)
    html_status, html_body = api.receive_html(user_id)
    if html_status == 200 and html_body.strip():
        tmp = Path(tempfile.mkdtemp(prefix="agilo-lib2-")) / ("user-%s.html" % user_id)
        tmp.write_bytes(html_body)
        man["htmlPath"] = str(tmp)
        print("HTML USER copié vers un fichier temporaire (%s octets)" % len(html_body))
    elif html_status == 404:
        print("USER sans HTML disque. htmlInline=skeleton si tu veux un ${CONTENT}.")
        if man.get("htmlInline") != "skeleton":
            man.pop("htmlPath", None)
    else:
        eprint("receivePromptModelTemplate http=%s (on continue sans HTML)" % html_status)
        man.pop("htmlPath", None)
    tmp_man = Path(tempfile.mkdtemp(prefix="agilo-lib2-")) / "promote-manifest.json"
    tmp_man.write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    args.manifest = str(tmp_man)
    return cmd_create(api, args)


def cmd_publish(api: Library2Admin, prompt_id: int, reason: str) -> int:
    if prompt_id >= -1:
        raise SystemExit("publish: ID isolé < -1 uniquement (pas 0–7).")
    card = api.card(prompt_id)
    if not card:
        eprint("STANDARD %s introuvable (hidden seulement visible pour l’admin)." % prompt_id)
        return 1
    revision = Number(card.get("revision")) or 1
    res = api.metadata(prompt_id, revision, reason, {"visible": "true"})
    if res.get("_http") != 200:
        eprint("publish échoué")
        print_json(res)
        return 1
    card = api.card(prompt_id)
    print("published", json.dumps(public_card(card), ensure_ascii=False))
    return 0


def cmd_show(api: Library2Admin, prompt_id: int) -> int:
    card = api.card(prompt_id)
    if not card:
        eprint("Pas dans le catalogue admin (id=%s)." % prompt_id)
        return 1
    print(json.dumps(public_card(card), ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--env-file", help="Fichier KEY=value (jamais loggé)")
    p = argparse.ArgumentParser(
        description="Library2 STANDARD admin (hidden → HTML → publish). Pas create_prompt MCP.",
        parents=[common],
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check-admin", parents=[common], help="listPromptLibraryAudit: 200 vs 403 ADMIN_REQUIRED")

    c = sub.add_parser("create", parents=[common], help="create hidden + metadata + HTML. Pas de publish par défaut.")
    c.add_argument("--manifest", required=True)
    c.add_argument("--reason", default="")
    c.add_argument("--publish", action="store_true")
    c.add_argument("--i-reviewed", action="store_true")

    pr = sub.add_parser("promote", parents=[common], help="USER Bauer → STANDARD hidden (prompt + HTML si présent)")
    pr.add_argument("--user-id", type=int, required=True)
    pr.add_argument("--manifest", required=True, help="Métadonnées (nom, desc, icon, category, reason)")
    pr.add_argument("--reason", default="")
    pr.add_argument("--publish", action="store_true")
    pr.add_argument("--i-reviewed", action="store_true")

    pub = sub.add_parser("publish", parents=[common], help="visible=true après recette")
    pub.add_argument("--id", type=int, required=True)
    pub.add_argument("--reason", required=True)
    pub.add_argument("--i-reviewed", action="store_true", required=True)

    sh = sub.add_parser("show", parents=[common], help="Carte publique (pas le prompt)")
    sh.add_argument("--id", type=int, required=True)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    api = creds_from(args)
    if args.cmd == "check-admin":
        return cmd_check_admin(api)
    if args.cmd == "create":
        return cmd_create(api, args)
    if args.cmd == "promote":
        return cmd_promote(api, args)
    if args.cmd == "publish":
        return cmd_publish(api, args.id, args.reason)
    if args.cmd == "show":
        return cmd_show(api, args.id)
    raise SystemExit("commande inconnue")


if __name__ == "__main__":
    sys.exit(main())
