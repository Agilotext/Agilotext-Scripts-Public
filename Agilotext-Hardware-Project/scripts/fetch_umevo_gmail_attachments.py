#!/usr/bin/env python3
"""Download UMEVO email attachments from Gmail (Agilotext account)."""
from __future__ import annotations

import base64
import csv
import hashlib
import json
import re
from email.utils import parsedate_to_datetime
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

TOKEN_PATH = Path.home() / ".config/google-cloud/gmail-agilotext-token.json"
OUT_ROOT = Path(__file__).resolve().parents[1] / "vendors/UMEVO/inbound/2026-05-22_email-package"
RAW_DIR = OUT_ROOT / "_raw_attachments"
EMAILS_DIR = OUT_ROOT / "_emails"

MESSAGE_IDS = [
    ("main", "19e4f1c90b416e09"),
    ("part1", "19e4f1e2a9810439"),
    ("part2", "19e4f1f337fb0754"),
    ("part3a", "19e4f1fd70e9c0b6"),
    ("part3b", "19e4f205a8e26c79"),
    ("part4", "19e4f20baa7f475e"),
    ("part5", "19e4f21e827bc938"),
    ("part6", "19e4f2277c744fbc"),
]


def gmail_service():
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH))
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def decode_body(data: str) -> str:
    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")


def walk_parts(parts, acc: list):
    for p in parts or []:
        if p.get("parts"):
            walk_parts(p["parts"], acc)
        else:
            acc.append(p)


def extract_text_html(payload) -> tuple[str, str]:
    text, html = "", ""
    parts = []
    if payload.get("parts"):
        walk_parts(payload["parts"], parts)
    else:
        parts = [payload]
    for p in parts:
        mime = p.get("mimeType", "")
        body = p.get("body", {})
        data = body.get("data")
        if not data:
            continue
        content = decode_body(data)
        if mime == "text/plain":
            text += content
        elif mime == "text/html":
            html += content
    return text, html


def sanitize_filename(name: str) -> str:
    name = name or "attachment"
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    return name.strip() or "attachment"


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    EMAILS_DIR.mkdir(parents=True, exist_ok=True)
    svc = gmail_service()
    manifest_rows = []
    seen_hashes: dict[str, str] = {}

    for part_label, msg_id in MESSAGE_IDS:
        msg = svc.users().messages().get(userId="me", id=msg_id, format="full").execute()
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        subject = headers.get("subject", "")
        date_hdr = headers.get("date", "")
        try:
            email_date = parsedate_to_datetime(date_hdr).isoformat() if date_hdr else ""
        except Exception:
            email_date = date_hdr

        text, html = extract_text_html(msg.get("payload", {}))
        email_md = EMAILS_DIR / f"{part_label}_{msg_id}.md"
        email_md.write_text(
            f"# {part_label}\n\n- **message_id**: `{msg_id}`\n- **date**: {email_date}\n- **subject**: {subject}\n\n## Body (plain)\n\n{text}\n",
            encoding="utf-8",
        )

        parts = []
        payload = msg.get("payload", {})
        if payload.get("parts"):
            walk_parts(payload["parts"], parts)
        else:
            parts = [payload]

        att_idx = 0
        for p in parts:
            filename = p.get("filename") or ""
            body = p.get("body", {})
            att_id = body.get("attachmentId")
            if not att_id and not filename:
                continue
            if not att_id:
                continue
            att = svc.users().messages().attachments().get(
                userId="me", messageId=msg_id, id=att_id
            ).execute()
            data = base64.urlsafe_b64decode(att["data"])
            sha = hashlib.sha256(data).hexdigest()
            if sha in seen_hashes:
                notes = f"duplicate_of:{seen_hashes[sha]}"
                stored_name = seen_hashes[sha]
            else:
                att_idx += 1
                safe = sanitize_filename(filename)
                stored_name = f"{part_label}_{att_idx:02d}_{safe}"
                out_path = RAW_DIR / stored_name
                out_path.write_bytes(data)
                seen_hashes[sha] = stored_name
                notes = ""
            manifest_rows.append(
                {
                    "stored_filename": stored_name,
                    "original_filename": filename,
                    "sha256": sha,
                    "size_bytes": len(data),
                    "mime": p.get("mimeType", ""),
                    "email_date": email_date,
                    "email_subject": subject,
                    "part_label": part_label,
                    "message_id": msg_id,
                    "classified_folder": "",
                    "notes": notes,
                }
            )

    manifest_path = OUT_ROOT.parent.parent / "analysis/MANIFEST.csv"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(manifest_rows[0].keys()) if manifest_rows else []
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(manifest_rows)

    summary = {
        "messages": len(MESSAGE_IDS),
        "attachment_records": len(manifest_rows),
        "unique_files": len(seen_hashes),
        "manifest": str(manifest_path),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
