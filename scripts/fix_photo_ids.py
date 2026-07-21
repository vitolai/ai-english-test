#!/usr/bin/env python3
"""Fix broken Unsplash photo IDs in server/services/ai.ts.

Reads PART1_DATA from ai.ts, tests each image ID via curl against
images.unsplash.com, and replaces any returning 404 with verified IDs
from a curated list (used cyclically). Writes the fixed file back.
"""

import re
import subprocess
import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_TS_PATH = os.path.join(PROJECT_ROOT, "server", "services", "ai.ts")

# 19 verified-working Unsplash photo IDs (all confirmed HTTP 200)
VERIFIED_IDS = [
    "1556761175-b413da4baf72",
    "1497366216548-37526070297c",
    "1524758631624-e2822e304c36",
    "1591115765373-5207764f72e7",
    "1450101499163-c8848c66ca85",
    "1556740738-b6a63e27c4df",
    "1517502884422-41eaead166d4",
    "1504384308090-c894fdcc538d",
    "1553028826-f4804a6dba3b",
    "1573164713714-d95e436ab8d6",
    "1498050108023-c5249f4df085",
    "1554224155-6726b3ff858f",
    "1522071820081-009f0129c71c",
    "1515187029135-18ee286d815b",
    "1486312338219-ce68d2c6f44d",
    "1527192491265-7e15c55b1ed2",
    "1497366754035-f200968a6e72",
    "1497215842964-222b430dc094",
    "1519389950473-47ba0277781c",
]


def extract_image_ids(content: str) -> list[str]:
    """Extract all image IDs from PART1_DATA in the file content."""
    # Find the PART1_DATA array
    match = re.search(
        r"const PART1_DATA:.*?=\s*\[(.*?)\];", content, re.DOTALL
    )
    if not match:
        print("ERROR: Could not find PART1_DATA in ai.ts")
        sys.exit(1)
    block = match.group(1)
    # Extract IDs from image fields like: image: '1556761175-b413da4baf72',
    ids = re.findall(r"image:\s*'([^']+)'", block)
    return ids


def test_photo_id(photo_id: str, timeout: int = 10) -> bool:
    """Test if an Unsplash photo ID returns HTTP 200."""
    url = f"https://images.unsplash.com/photo-{photo_id}?w=400"
    try:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", str(timeout), url],
            capture_output=True, text=True, timeout=timeout + 5
        )
        code = result.stdout.strip()
        return code == "200"
    except Exception:
        return False


def test_ids_concurrent(ids: list[str], max_workers: int = 20) -> dict[str, bool]:
    """Test all IDs concurrently and return a dict of id -> is_valid."""
    results = {}
    total = len(ids)
    done = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_id = {executor.submit(test_photo_id, pid): pid for pid in ids}
        for future in as_completed(future_to_id):
            pid = future_to_id[future]
            try:
                results[pid] = future.result()
            except Exception:
                results[pid] = False
            done += 1
            status = "OK" if results[pid] else "BROKEN"
            if done % 20 == 0 or done == total:
                print(f"  Tested {done}/{total} ... ({sum(1 for v in results.values() if v)} OK, {sum(1 for v in results.values() if not v)} broken)")

    return results


def build_replacement_map(broken_ids: list[str], verified_ids: list[str]) -> dict[str, str]:
    """Map each broken ID to a verified ID (cyclically)."""
    replacement = {}
    for i, broken_id in enumerate(broken_ids):
        replacement[broken_id] = verified_ids[i % len(verified_ids)]
    return replacement


def replace_ids_in_file(content: str, replacement_map: dict[str, str]) -> str:
    """Replace broken IDs in both PART1_DATA and FALLBACK_PHOTO_IDS."""
    new_content = content

    # Replace in image fields: image: 'broken-id'
    for old_id, new_id in replacement_map.items():
        new_content = new_content.replace(f"image: '{old_id}'", f"image: '{new_id}'")

    # Replace in comment lines: // Photo N: Unsplash ID broken-id
    for old_id, new_id in replacement_map.items():
        new_content = new_content.replace(f"Unsplash ID {old_id}", f"Unsplash ID {new_id}")

    return new_content


def main():
    print("=" * 60)
    print("Unsplash Photo ID Fixer")
    print("=" * 60)

    # Read the file
    print(f"\nReading {AI_TS_PATH} ...")
    with open(AI_TS_PATH, "r") as f:
        content = f.read()

    # Extract IDs
    ids = extract_image_ids(content)
    print(f"Found {len(ids)} image IDs in PART1_DATA")

    # Deduplicate for testing
    unique_ids = list(set(ids))
    print(f"Unique IDs to test: {len(unique_ids)}")

    # Test all unique IDs
    print(f"\nTesting IDs against images.unsplash.com ...")
    results = test_ids_concurrent(unique_ids)

    broken_ids = [pid for pid in unique_ids if not results[pid]]
    valid_ids = [pid for pid in unique_ids if results[pid]]
    print(f"\nResults: {len(valid_ids)} valid, {len(broken_ids)} broken")

    if not broken_ids:
        print("\nAll IDs are valid! No changes needed.")
        return

    print(f"\nBroken IDs ({len(broken_ids)}):")
    for bid in broken_ids:
        print(f"  - {bid}")

    # Build replacement map
    replacement_map = build_replacement_map(broken_ids, VERIFIED_IDS)
    print(f"\nReplacement map ({len(replacement_map)} entries):")
    for old, new in replacement_map.items():
        print(f"  {old} -> {new}")

    # Replace in file content
    new_content = replace_ids_in_file(content, replacement_map)

    # Write back
    print(f"\nWriting fixed file to {AI_TS_PATH} ...")
    with open(AI_TS_PATH, "w") as f:
        f.write(new_content)

    print("Done! File updated successfully.")

    # Summary
    total_replaced = sum(1 for pid in ids if pid in replacement_map)
    print(f"\nSummary: Replaced {total_replaced} occurrences of {len(broken_ids)} broken IDs")


if __name__ == "__main__":
    main()
