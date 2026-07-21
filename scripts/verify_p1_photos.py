#!/usr/bin/env python3
"""Quick verification: extract all image IDs from PART1_DATA, test each, report any still-broken."""
import re
import subprocess
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_TS_PATH = os.path.join(PROJECT_ROOT, "server", "services", "ai.ts")


def test_photo_id(photo_id, timeout=10):
    url = f"https://images.unsplash.com/photo-{photo_id}?w=400"
    try:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", str(timeout), url],
            capture_output=True, text=True, timeout=timeout + 5
        )
        return result.stdout.strip() == "200"
    except Exception:
        return False


with open(AI_TS_PATH) as f:
    content = f.read()

match = re.search(r"const PART1_DATA:.*?=\s*\[(.*?)\];", content, re.DOTALL)
ids = re.findall(r"image:\s*'([^']+)'", match.group(1))
unique = list(set(ids))
print(f"Verifying {len(unique)} unique IDs from PART1_DATA...")

broken = []
with ThreadPoolExecutor(max_workers=20) as ex:
    futs = {ex.submit(test_photo_id, pid): pid for pid in unique}
    for f in as_completed(futs):
        pid = futs[f]
        if not f.result():
            broken.append(pid)

if broken:
    print(f"STILL BROKEN ({len(broken)}):")
    for b in sorted(broken):
        print(f"  - {b}")
    sys.exit(1)
else:
    print("All IDs verified OK!")
