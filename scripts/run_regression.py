#!/usr/bin/env python3
"""
TOEIC AI Pro Regression Test Runner
Usage: python3 scripts/run_regression.py [--smoke|--full|--scale N] [--real]

--real (only meaningful with --scale N): use real AI via OpenRouter instead of
mock data. Requires OPENROUTER_API_KEY in the environment. Mock mode is the
default and unchanged.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

BASE = Path(__file__).parent.parent
SESSION_DIR = BASE / "storage" / "sessions"


def run(cmd, timeout=120):
    """Run command and return (success, output)"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout.strip()
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"


def check_backend():
    ok, out = run("curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health/providers")
    return ok and out == "200"


def check_frontend():
    ok, out = run("curl -s -o /dev/null -w '%{http_code}' http://localhost:5173")
    return ok and out == "200"


def generate_mock(q=10):
    payload = '{{"questionCount":{0},"model":"mock","apiKey":"test","config":{{"providerId":"mock"}}}}'.format(q)
    ok, out = run('curl -s -X POST http://localhost:3001/api/generate -H "Content-Type: application/json" -d \'' + payload + '\'')
    if not ok:
        return None
    try:
        return json.loads(out).get("session_id")
    except:
        return None


def generate_real(q, api_key):
    """POST a real-AI generation request (returns immediately with session_id),
    then poll /api/status/:id until completed or failed."""
    payload = json.dumps({
        "seedText": "International business environment covering office interactions, travel, logistics, corporate meetings, and diverse professional scenarios.",
        "questionCount": q,
        "model": "nvidia/nemotron-3-super-120b-a12b:free",
        "apiKey": api_key,
        "config": {"providerId": "openrouter", "baseURL": "https://openrouter.ai/api/v1"}
    })
    ok, out = run('curl -s -X POST http://localhost:3001/api/generate -H "Content-Type: application/json" -d \'' + payload + '\'')
    if not ok:
        return None
    try:
        session_id = json.loads(out).get("session_id")
    except:
        return None
    if not session_id:
        return None
    timeout = get_real_timeout(q)
    start = time.time()
    while time.time() - start < timeout:
        ok, s = run("curl -s http://localhost:3001/api/status/{}".format(session_id))
        if ok:
            try:
                data = json.loads(s)
                phase = data.get("phase", "")
                if phase == "completed":
                    return session_id
                if phase == "error":
                    print("  FAIL Generation error: {}".format(data.get("message", "unknown")))
                    return None
            except:
                pass
        time.sleep(2)
    print("  FAIL Generation timed out after {}s".format(timeout))
    return None


def get_real_timeout(q):
    """Scale-to-timeout mapping for real-AI (OpenRouter free tier).

    Benchmarks: 10Q~47s, 20Q~110s, 50Q~158s, 100Q~331s, 200Q~666s.
    Mappings below provide ~2x headroom on each tier.
    """
    mapping = {
        10: 180,
        20: 600,
        50: 900,
        100: 1800,
        200: 2400,
    }
    if q in mapping:
        return mapping[q]
    # For unlisted scales, interpolate linearly between nearest tiers
    tiers = sorted(mapping.keys())
    if q < tiers[0]:
        return mapping[tiers[0]]
    if q > tiers[-1]:
        return mapping[tiers[-1]]
    for i in range(len(tiers) - 1):
        lo, hi = tiers[i], tiers[i + 1]
        if lo <= q <= hi:
            t = (q - lo) / (hi - lo)
            return int(mapping[lo] + t * (mapping[hi] - mapping[lo]))
    return 900


def wait_completion(session_id, timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        ok, out = run("curl -s http://localhost:3001/api/status/{}".format(session_id))
        if ok:
            try:
                data = json.loads(out)
                if data.get("phase") == "completed":
                    return True, data
                if data.get("phase") == "error":
                    return False, data.get("message", "error")
            except:
                pass
        time.sleep(1)
    return False, "timeout"


def load_session(session_id):
    path = SESSION_DIR / session_id / "exam_data.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


def check_part1(data):
    p1 = [q for q in data["questions"] if q.get("part") == 1 and q.get("type") == "listening"]
    if not p1:
        return False, "No Part 1 questions"
    for q in p1:
        if not q.get("image"):
            return False, "Q{}: missing image".format(q["id"])
        if q.get("transcript", "") != "":
            return False, "Q{}: transcript should be empty".format(q["id"])
        if q.get("options") and len(q["options"]) != 4:
            return False, "Q{}: should have 4 options".format(q["id"])
    return True, "Part 1: {} questions OK".format(len(p1))


def check_part2(data):
    p2 = [q for q in data["questions"] if q.get("part") == 2 and q.get("type") == "listening"]
    if not p2:
        return False, "No Part 2 questions"
    for q in p2:
        if q.get("image"):
            return False, "Q{}: should not have image".format(q["id"])
        if q.get("question", "") != "":
            return False, "Q{}: question should be empty".format(q["id"])
        if q.get("options") and len(q["options"]) != 3:
            return False, "Q{}: should have 3 options".format(q["id"])
    return True, "Part 2: {} questions OK".format(len(p2))


def check_part3(data):
    p3 = [q for q in data["questions"] if q.get("part") == 3 and q.get("type") == "listening"]
    if not p3:
        return False, "No Part 3 questions"
    for q in p3:
        if not q.get("transcript"):
            return False, "Q{}: missing transcript".format(q["id"])
        if not q.get("question"):
            return False, "Q{}: missing question".format(q["id"])
        if q.get("options") and len(q["options"]) != 4:
            return False, "Q{}: should have 4 options".format(q["id"])
    transcripts = {}
    for q in p3:
        t = q.get("transcript", "")
        transcripts[t] = transcripts.get(t, 0) + 1
    for t, count in transcripts.items():
        if count > 3:
            return False, "Part 3 transcript shared by {} questions (max 3 per conversation)".format(count)
    return True, "Part 3: {} questions OK".format(len(p3))


def check_part4(data):
    p4 = [q for q in data["questions"] if q.get("part") == 4 and q.get("type") == "listening"]
    if not p4:
        return False, "No Part 4 questions"
    for q in p4:
        if not q.get("transcript"):
            return False, "Q{}: missing transcript".format(q["id"])
        if not q.get("question"):
            return False, "Q{}: missing question".format(q["id"])
        if q.get("options") and len(q["options"]) != 4:
            return False, "Q{}: should have 4 options".format(q["id"])
    transcripts = {}
    for q in p4:
        t = q.get("transcript", "")
        transcripts[t] = transcripts.get(t, 0) + 1
    for t, count in transcripts.items():
        if count > 3:
            return False, "Part 4 transcript shared by {} questions (max 3 per talk)".format(count)
    return True, "Part 4: {} questions OK".format(len(p4))


def check_reading(data):
    for part in [5, 6, 7]:
        qs = [q for q in data["questions"] if q.get("part") == part and q.get("type") == "reading"]
        if not qs:
            return False, "No Part {} questions".format(part)
        for q in qs:
            if not q.get("question"):
                return False, "P{} Q{}: missing question".format(part, q["id"])
            if q.get("options") and len(q["options"]) != 4:
                return False, "P{} Q{}: should have 4 options".format(part, q["id"])
    return True, "Parts 5/6/7 OK"


def check_audio(session_id):
    data = load_session(session_id)
    if not data:
        return False, "No session data"
    for q in data["questions"]:
        if q.get("type") == "listening" and q.get("audio"):
            rel = q["audio"]
            # q["audio"] is "sessions/<sid>/audio/qN.mp3" (relative to storage/)
            if rel.startswith("sessions/"):
                audio_path = BASE / "storage" / rel
            else:
                audio_path = BASE / "storage" / rel
            if not audio_path.exists():
                return False, "Missing audio: {}".format(audio_path)
            if audio_path.stat().st_size < 1000:
                return False, "Audio too small: {} ({}b)".format(audio_path, audio_path.stat().st_size)
    return True, "Audio files OK"


def check_score_page(session_id=None):
    """Use Playwright to walk through the full exam flow and verify the
    score page renders 'Detailed Answer Review'.

    The flow:
      1. Navigate to the dashboard at localhost:5173
      2. Open the AI Configuration modal, select Mock provider
      3. Start a 10-question mock exam
      4. Answer all listening questions, proceed to reading
      5. Answer all reading questions, finish the exam
      6. Assert the 'Detailed Answer Review' text is visible on the score page
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  SKIP playwright not installed")
        return False

    BASE_URL = "http://localhost:5173"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                page.goto(BASE_URL, timeout=30_000)

                # Wait for dashboard to be ready
                page.wait_for_selector('h1:has-text("TOEIC Practice Exam")', timeout=15_000)

                # Select 10 questions (should already be default, but be explicit)
                page.locator('button:text-is("10")').click()

                # Open settings modal
                page.locator('button:has-text("START EXAM")').click()
                page.wait_for_selector('h2:has-text("AI Configuration")', timeout=10_000)

                # Select Mock provider
                page.locator('button:has-text("Mock")').click()

                # Fill API key with a test key (mock mode accepts any key)
                api_input = page.locator('input[placeholder*="API Key"]').first
                api_input.fill("test-mock-key-regression")

                # Start the exam
                page.locator('button:has-text("GO! START PRACTICE")').click()

                # Wait for loading overlay to disappear and exam to appear
                page.wait_for_selector(
                    'h1:has-text("Listening Comprehension")', timeout=120_000
                )

                # Answer every listening question (click first option in each card)
                listening_cards = page.locator('[id^="q-"]')
                lcount = listening_cards.count()
                for i in range(lcount):
                    card = listening_cards.nth(i)
                    card.locator("button").first.click()

                # Proceed to reading section
                page.locator('button:has-text("PROCEED TO READING SECTION")').click()
                page.wait_for_selector('h1:has-text("Reading Test")', timeout=15_000)

                # Answer every reading question
                reading_cards = page.locator('[id^="q-"]')
                rcount = reading_cards.count()
                for i in range(rcount):
                    card = reading_cards.nth(i)
                    card.locator("button").first.click()

                # Finish the exam
                page.locator('button:has-text("FINISH EXAM & VIEW SCORE")').click()

                # Verify the detailed review table is present
                page.wait_for_selector(
                    "text=Detailed Answer Review", timeout=15_000
                )

                # Additional sanity checks on the score page
                assert page.locator("text=Exam Completed!").is_visible()
                score_el = page.locator("text=/Score:\\s*\\d+\\s*\\/\\s*\\d+/")
                assert score_el.is_visible()

                return True
            finally:
                browser.close()
    except Exception as exc:
        print("  Score page check failed: {}".format(str(exc)[:200]))
        return False


def run_smoke():
    print("SMOKE TEST")
    checks = [
        ("Backend", check_backend),
        ("Frontend", check_frontend),
        ("Mock 10Q Gen", lambda: generate_mock(10) is not None),
    ]
    for name, check in checks:
        result = check()
        status = "PASS" if result else "FAIL"
        print("  {} {}".format(status, name))
        if not result:
            return 1
    print("Smoke test passed")
    return 0


def run_full():
    print("FULL REGRESSION TEST")
    
    print("\nInfrastructure...")
    for name, check in [("Backend", check_backend), ("Frontend", check_frontend)]:
        result = check()
        status = "PASS" if result else "FAIL"
        print("  {} {}".format(status, name))
        if not result:
            return 4
    
    print("\nGenerating mock 10Q...")
    sid = generate_mock(10)
    if not sid:
        print("  FAIL Generation failed")
        return 1
    print("  Session: {}".format(sid))
    
    ok, _ = wait_completion(sid)
    if not ok:
        print("  FAIL Generation timeout/error")
        return 1
    print("  PASS Generation complete")
    
    data = load_session(sid)
    if not data:
        print("  FAIL Could not load session")
        return 1
    
    print("\nPart validation...")
    checks = [
        ("Part 1", check_part1),
        ("Part 2", check_part2),
        ("Part 3", check_part3),
        ("Part 4", check_part4),
        ("Parts 5/6/7", check_reading),
    ]
    for name, check in checks:
        result, msg = check(data)
        status = "PASS" if result else "FAIL"
        print("  {} {}: {}".format(status, name, msg))
        if not result:
            return 2
    
    print("\nAudio validation...")
    result, msg = check_audio(sid)
    status = "PASS" if result else "FAIL"
    print("  {} {}".format(status, msg))
    if not result:
        return 1
    
    print("\nScore page (Playwright integration)...")
    result = check_score_page(sid)
    status = "PASS" if result else "FAIL"
    print("  {} Detailed review present: {}".format(status, result))
    if not result:
        return 3
    
    print("\nDistribution check...")
    parts = {}
    for q in data["questions"]:
        if q.get("type") == "listening":
            parts[q.get("part")] = parts.get(q.get("part"), 0) + 1
    print("  Parts: {}".format(parts))
    if parts.get(1, 0) != 1:
        print("  WARN Part 1 count: {} (expected 1 for 10Q)".format(parts.get(1, 0)))
    
    print("\nFULL REGRESSION PASSED")
    return 0


def run_scale(q, real=False):
    mode = "REAL" if real else "MOCK"
    print("SCALE TEST: {} questions ({})".format(q, mode))

    if real:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            print("ERROR: --real requires OPENROUTER_API_KEY environment variable")
            return 1
        sid = generate_real(q, api_key)
    else:
        sid = generate_mock(q)

    if not sid:
        print("FAIL Generation failed to start")
        return 1
    print("  Session: {}".format(sid))

    start = time.time()
    if real:
        timeout = get_real_timeout(q)
    else:
        timeout = 600 if q >= 100 else 180
    ok, msg = wait_completion(sid, timeout=timeout)
    duration = time.time() - start
    print("DURATION {:.1f}".format(duration))
    if not ok:
        print("FAIL Completion failed: {}".format(msg))
        return 1

    data = load_session(sid)
    if not data:
        print("FAIL Could not load session")
        return 1
    print("  Questions: {}".format(len(data["questions"])))

    if len(data["questions"]) != q:
        print("FAIL Got {} questions, expected {}".format(len(data["questions"]), q))
        return 5

    parts_present = set(qq.get("part") for qq in data["questions"])
    expected = {1, 2, 3, 4, 5, 6, 7}
    missing = expected - parts_present
    if missing:
        print("FAIL Missing parts: {}".format(missing))
        return 5

    print("PASS All 7 parts present")

    if real:
        # Detailed per-part + audio checks so callers can parse pass/fail counts
        # and failing check names. Mock mode keeps its original minimal output.
        checks = [
            ("Part1", check_part1),
            ("Part2", check_part2),
            ("Part3", check_part3),
            ("Part4", check_part4),
            ("Reading", check_reading),
        ]
        passed = 0
        failed = 0
        failing_names = []
        for name, check in checks:
            result, m = check(data)
            if result:
                print("PASS {}: {}".format(name, m))
                passed += 1
            else:
                print("FAIL {}: {}".format(name, m))
                failed += 1
                failing_names.append(name)
        result, m = check_audio(sid)
        if result:
            print("PASS Audio: {}".format(m))
            passed += 1
        else:
            print("FAIL Audio: {}".format(m))
            failed += 1
            failing_names.append("Audio")
        print("SUMMARY passed={} failed={} failing={}".format(
            passed, failed, ",".join(failing_names) if failing_names else "none"))
        if failed > 0:
            return 5
    else:
        print("PASS All 7 parts present, distribution OK")

    print("RESULT PASS")
    return 0


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--smoke", action="store_true", help="Quick smoke test")
    group.add_argument("--full", action="store_true", help="Full regression")
    group.add_argument("--scale", type=int, help="Scale test (10, 20, 50, 100, 200)")
    parser.add_argument("--real", action="store_true",
                        help="Use real AI via OpenRouter instead of mock (requires OPENROUTER_API_KEY env var). Only meaningful with --scale.")
    args = parser.parse_args()
    
    os.chdir(BASE)
    
    if args.smoke:
        return run_smoke()
    elif args.full:
        return run_full()
    elif args.scale:
        return run_scale(args.scale, real=args.real)
    
    return 1


if __name__ == "__main__":
    sys.exit(main())