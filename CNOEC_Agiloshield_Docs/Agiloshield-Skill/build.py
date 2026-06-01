#!/usr/bin/env python3
"""Génère un fichier .skill (ZIP) Agiloshield préconfiguré pour un utilisateur."""

from __future__ import annotations

import argparse
import shutil
import zipfile
from datetime import date
from pathlib import Path

PROFILE_TYPES = {
    "ma": ["PER", "ORG", "ADR", "IDN"],
    "legal": ["PER", "ORG", "ADR", "EML", "TEL", "IDN"],
    "hr": ["PER", "ADR", "EML", "TEL", "IDN", "IBA", "JOB"],
    "health": ["PER", "ADR", "EML", "TEL", "IDN", "PII", "DAT"],
    "developer": ["PER", "ORG", "EML", "TEL", "URL", "IDN"],
}

ROOT = Path(__file__).resolve().parent
SKILL_SRC = ROOT / "agiloshield-skill"
SKILL_ZIP_PREFIX = "agiloshield-skill"


def render_config(
    username: str,
    password: str,
    token: str,
    automation_token: str,
    use_get_token: bool,
    edition: str,
    profile: str,
    entity_types: list[str] | None,
    mode: str,
) -> str:
    types = entity_types or PROFILE_TYPES.get(profile, PROFILE_TYPES["ma"])
    types_repr = repr(types)

    password_line = repr(password) if password else '""'
    token_line = repr(token) if token else '""'
    automation_line = repr(automation_token) if automation_token else '""'

    return f'''"""Configuration Agiloshield — générée par build.py."""

API_BASE = "https://api.agilotext.com/api/v1"

USERNAME = {username!r}
USE_GET_TOKEN = {str(use_get_token)}
AUTOMATION_TOKEN = {automation_line}
TOKEN = {token_line}
PASSWORD = {password_line}
EDITION = {edition!r}

PROFILE = {profile!r}
ENTITY_TYPES = {types_repr}
MODE = {mode!r}

OUTPUT_DIR = ""

POLL_TIMEOUT_SECONDS = 300
'''


def build_skill_zip(
    output_path: Path,
    username: str,
    password: str,
    token: str,
    automation_token: str,
    use_get_token: bool,
    edition: str,
    profile: str,
    entity_types: list[str] | None,
    mode: str,
) -> None:
    if not SKILL_SRC.is_dir():
        raise SystemExit(f"Dossier source introuvable: {SKILL_SRC}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    staging = output_path.parent / f".staging-{output_path.stem}"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    shutil.copytree(SKILL_SRC, staging / SKILL_ZIP_PREFIX, dirs_exist_ok=True)

    config_content = render_config(
        username,
        password,
        token,
        automation_token,
        use_get_token,
        edition,
        profile,
        entity_types,
        mode,
    )
    (staging / SKILL_ZIP_PREFIX / "scripts" / "config.py").write_text(
        config_content, encoding="utf-8"
    )

    if output_path.exists():
        output_path.unlink()

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(staging.rglob("*")):
            if file_path.is_file():
                arcname = file_path.relative_to(staging)
                zf.write(file_path, arcname)

    shutil.rmtree(staging)
    print(f"Skill généré: {output_path} ({output_path.stat().st_size} octets)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère un .skill Agiloshield")
    parser.add_argument("--user", required=True, help="Email Agiloshield")
    parser.add_argument("--password", default="", help="Mot de passe application")
    parser.add_argument("--token", default="", help="Token API session (courte durée)")
    parser.add_argument(
        "--automation-token",
        default="",
        help="Clé automation auto_xxx (recommandé — Mon compte → Intégrations)",
    )
    parser.add_argument(
        "--get-token",
        action="store_true",
        help="Auth via GET /getToken headless (compte whitelisté backend)",
    )
    parser.add_argument("--edition", default="ent", choices=["free", "pro", "ent"])
    parser.add_argument(
        "--profile",
        default="ma",
        choices=list(PROFILE_TYPES.keys()) + ["custom"],
    )
    parser.add_argument(
        "--types",
        default="",
        help="Types custom séparés par virgule (ex: PER,ORG,ADR,IDN)",
    )
    parser.add_argument(
        "--mode",
        default="pseudonymize",
        choices=["pseudonymize", "anonymize"],
    )
    parser.add_argument(
        "--output",
        default="",
        help="Chemin du .skill (défaut: dist/agiloshield-{profile}-{date}.skill)",
    )

    args = parser.parse_args()

    if (
        not args.get_token
        and not args.token
        and not args.password
        and not args.automation_token
    ):
        raise SystemExit("Fournir --get-token, --automation-token, --token ou --password")

    entity_types = None
    if args.types.strip():
        entity_types = [t.strip().upper() for t in args.types.split(",") if t.strip()]

    slug = args.user.split("@")[0].replace(".", "-")
    default_name = f"agiloshield-{args.profile}-{slug}-{date.today():%Y%m%d}.skill"
    output = Path(args.output) if args.output else ROOT / "dist" / default_name

    build_skill_zip(
        output,
        args.user,
        args.password,
        args.token,
        args.automation_token,
        args.get_token,
        args.edition,
        args.profile,
        entity_types,
        args.mode,
    )


if __name__ == "__main__":
    main()
