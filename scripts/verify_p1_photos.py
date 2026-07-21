#!/usr/bin/env python3
"""Extract photo IDs from PART1_DATA in server/services/ai.ts and test each with Unsplash."""

import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

AI_TS = Path("server/services/ai.ts")
CONTENT = AI_TS.read_text()

# Extract all image IDs from the PART1_DATA array
part1_ids = re.findall(r"image:\s+'([^']+)'", CONTENT)
unique_ids = list(dict.fromkeys(part1_ids))

# FALLBACK_PHOTO_IDS section
fallback_start = CONTENT.index("const FALLBACK_PHOTO_IDS")
fallback_section = CONTENT[fallback_start:]
fallback_end = fallback_section.index("];")
fallback_raw = fallback_section[:fallback_end]
fallback_ids = re.findall(r"'([^']+)'", fallback_raw)

def test_id(photo_id):
    url = f"https://images.unsplash.com/photo-{photo_id}?w=100"
    try:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", url, "--max-time", "5"],
            capture_output=True, text=True, timeout=10
        )
        code = result.stdout.strip()
        return photo_id, code, ""
    except Exception as e:
        return photo_id, "ERR", str(e)

# Test all unique IDs
results = {}
print(f"Testing {len(unique_ids)} unique photo IDs from PART1_DATA...")
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(test_id, pid): pid for pid in unique_ids}
    for future in as_completed(futures):
        pid, code, err = future.result()
        results[pid] = (code, err)

print("\nResults:")
print("-"*80)
broken = []
working = []
for pid in unique_ids:
    code, err = results[pid]
    if code == "200":
        working.append(pid)
        print(f"  OK  {code} {pid}")
    else:
        broken.append(pid)
        print(f"  BROKEN {code} {pid} {err}")

print(f"\nTotal unique: {len(unique_ids)}")
print(f"Working: {len(working)}")
print(f"Broken: {len(broken)}")

if broken:
    print("\nBroken IDs:")
    for pid in broken:
        print(f"  {pid}")
    sys.exit(1)
else:
    print("\nAll photos verified OK!")
    sys.exit(0)
