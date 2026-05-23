#!/usr/bin/env python3
"""Classify UMEVO raw attachments into vendor folders and update MANIFEST."""
from __future__ import annotations

import csv
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "vendors/UMEVO"
INBOUND = ROOT / "inbound/2026-05-22_email-package"
RAW = INBOUND / "_raw_attachments"
MANIFEST = ROOT / "analysis/MANIFEST.csv"

FOLDERS = {
    "commercial": INBOUND / "commercial",
    "technical-gen1": INBOUND / "technical-gen1",
    "packaging-branding": INBOUND / "packaging-branding",
    "compliance": INBOUND / "compliance",
    "legal-ip": INBOUND / "legal-ip",
    "unknown": INBOUND / "unknown",
    "email-assets": INBOUND / "email-assets",
}


def classify(name: str) -> str:
    n = name.lower()
    if any(x in n for x in ("outlook-", ".gif")) or n.endswith("inthebox.png"):
        return "email-assets"
    if "packaging" in n or "artwork" in n or "die-cut" in n or "silk" in n:
        return "packaging-branding"
    if "parameters" in n or "note_plus" in n or (n.endswith("manual.pdf") or "_manual.pdf" in n):
        return "technical-gen1"
    if any(
        x in n
        for x in (
            "ce",
            "red",
            "rohs",
            "emc",
            "lvd",
            "fcc",
            "un38",
            "battery",
            "967",
            "sds",
            "海运",
            "堆码",
            "ble",
            "edr",
            "label and location",
            "huax",
            "ctb25052700601",
            "ctb25052700602",
            "tct25",
            "26-1223",
        )
    ):
        return "compliance"
    if any(x in n for x in ("nda", "contract", "agreement", "quotation", "quote")):
        return "legal-ip"
    return "unknown"


def main():
    for d in FOLDERS.values():
        d.mkdir(parents=True, exist_ok=True)

    rows = []
    with MANIFEST.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        for row in reader:
            rows.append(row)

    unique = {}
    for row in rows:
        fn = row["stored_filename"]
        if row.get("notes", "").startswith("duplicate"):
            row["classified_folder"] = unique.get(fn, ("", ""))[0]
            rows[rows.index(row)] = row
            continue
        folder = classify(fn)
        unique[fn] = (folder, row["sha256"])
        src = RAW / fn
        if src.exists():
            dst = FOLDERS[folder] / fn
            if not dst.exists():
                shutil.copy2(src, dst)
        row["classified_folder"] = folder
        rows[rows.index(row)] = row

    with MANIFEST.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    from collections import Counter

    c = Counter(r["classified_folder"] for r in rows if not r.get("notes", "").startswith("duplicate"))
    print("unique by folder:", dict(c))


if __name__ == "__main__":
    main()
