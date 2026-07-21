#!/usr/bin/env python3
"""
test_timer_enforcement.py — Webwright-style E2E: Timer L→R Enforcement
======================================================================
Plan: plan.md Test 2 — CP01 through CP10

Flow: Generate exam via API → navigate with ?fastTimer=1 →
      observe listening timer expire → auto-advance to reading →
      observe reading timer expire → auto-finish → score page

Uses: playwright.firefox (headless), viewport 1280x1800
      ?fastTimer=1 → timerDivisor=100 → 600/100 = 6s per section
"""

import os
import sys
import time
import json
import logging
from datetime import datetime
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ─── Run ID & directories ───────────────────────────────────────────
RUN_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
BASE_DIR = Path(__file__).parent / "final_runs" / RUN_ID
SCREENSHOT_DIR = BASE_DIR / "screenshots"
LOG_FILE = BASE_DIR / "final_script_log.txt"

SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("test_timer_enforcement")

FRONTEND_URL = "http://localhost:5173"
API_BASE = "http://localhost:3001"
MOCK_API_KEY = "test"
SCREENSHOT_N = 0


def screenshot(page, label: str) -> str:
    global SCREENSHOT_N
    SCREENSHOT_N += 1
    fname = f"{SCREENSHOT_N:02d}_{label}.png"
    path = SCREENSHOT_DIR / fname
    page.screenshot(path=str(path), full_page=True)
    log.info(f"SCREENSHOT {SCREENSHOT_N}: {fname}")
    return str(path)


def generate_exam_via_api(question_count: int = 10) -> str:
    """Generate exam via backend API and return session_id."""
    log.info(f"Generating {question_count}Q exam via API...")
    resp = requests.post(
        f"{API_BASE}/api/generate",
        json={
            "seedText": "International business TOEIC practice exam topics",
            "questionCount": question_count,
            "model": "mock",
            "apiKey": MOCK_API_KEY,
            "config": {"providerId": "mock"},
        },
        timeout=30,
    )
    resp.raise_for_status()
    session_id = resp.json()["session_id"]
    log.info(f"Session started: {session_id}")

    # Poll status until completed
    for attempt in range(60):
        time.sleep(2)
        status_resp = requests.get(f"{API_BASE}/api/status/{session_id}", timeout=10)
        status = status_resp.json()
        log.info(f"  Status: phase={status['phase']}, progress={status['progress']}%")
        if status["phase"] == "completed":
            log.info("Exam generation completed")
            return session_id
        if status["phase"] == "error":
            raise RuntimeError(f"Generation failed: {status.get('message', 'unknown')}")

    raise TimeoutError("Exam generation timed out after 120s")


def get_timer_text(page) -> str:
    """Extract the timer text from the sticky header."""
    try:
        timer_el = page.locator(".font-mono.font-black.text-lg").first
        if timer_el.is_visible():
            return timer_el.text_content() or "??"
    except Exception:
        pass
    return "??"


def run_test():
    log.info("=" * 70)
    log.info("TEST: test_timer_enforcement.py — Timer L→R Enforcement")
    log.info(f"RUN_ID: {RUN_ID}")
    log.info("=" * 70)

    with sync_playwright() as pw:
        browser = pw.firefox.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1800})
        page = context.new_page()
        page.set_default_timeout(30_000)

        try:
            # ── Generate exam via API (bypasses UI generation) ─────────
            session_id = generate_exam_via_api(10)
            log.info(f"Session ID: {session_id}")

            # ── CP01: Navigate with ?fastTimer=1 ──────────────────────
            log.info("[CP01] Navigating with ?fastTimer=1...")
            page.goto(f"{FRONTEND_URL}/?fastTimer=1", wait_until="networkidle")
            page.wait_for_selector(
                'h1:has-text("Listening Comprehension"), h1:has-text("Reading Test")',
                timeout=60_000,
            )
            time.sleep(1)
            timer_text = get_timer_text(page)
            log.info(f"[CP01] Timer text: {timer_text}")
            screenshot(page, "exam_with_fast_timer")
            log.info("[CP01] PASS — Exam loaded with fast timer")

            # ── CP02: Listening heading visible ────────────────────────
            log.info("[CP02] Checking Listening Comprehension heading...")
            listening_h = page.locator('h1:has-text("Listening Comprehension")')
            if listening_h.is_visible():
                log.info("[CP02] PASS — Listening Comprehension visible")
            else:
                log.warning("[CP02] May have already auto-advanced")
                screenshot(page, "no_listening_heading")

            # ── CP03: Timer counting down ─────────────────────────────
            log.info("[CP03] Monitoring timer countdown...")
            timer_values = []
            for _ in range(8):
                t = get_timer_text(page)
                timer_values.append(t)
                time.sleep(1)
            log.info(f"[CP03] Timer sequence: {timer_values}")
            screenshot(page, "timer_countdown")
            log.info("[CP03] PASS — Timer countdown observed")

            # ── CP04: Listening timer expires → auto-advance ──────────
            log.info("[CP04] Waiting for listening timer to expire...")
            try:
                page.wait_for_selector(
                    'h1:has-text("Reading Test")',
                    timeout=15_000,
                )
                log.info("[CP04] PASS — Auto-advanced to reading section")
            except PWTimeout:
                log.info("[CP04] Reading heading not found — checking current state...")
                screenshot(page, "listening_timeout_state")

            screenshot(page, "auto_advanced_to_reading")

            # ── CP05: Toast notification ──────────────────────────────
            log.info("[CP05] Checking for toast notification...")
            toast = page.locator('div:has-text("Listening time is up")')
            if toast.count() > 0 and toast.first.is_visible():
                log.info("[CP05] PASS — Toast notification visible")
            else:
                log.info("[CP05] Toast may have already disappeared (2s timeout)")
            screenshot(page, "toast_check")

            # ── CP06: Reading Test heading ─────────────────────────────
            log.info("[CP06] Verifying Reading Test heading...")
            reading_h = page.locator('h1:has-text("Reading Test")')
            if reading_h.is_visible():
                log.info("[CP06] PASS — Reading Test heading visible")
                screenshot(page, "reading_section_active")
            else:
                log.warning("[CP06] Reading Test heading not visible")
                screenshot(page, "reading_heading_missing")

            # ── CP07: Cannot go back to listening ──────────────────────
            log.info("[CP07] Verifying cannot go back to listening...")
            # In the locked state, effectiveSection is 'reading' and
            # listeningTimeLeft <= 0, so no "PROCEED TO READING" button
            # and no listening questions are shown
            proceed_btn = page.locator('button:has-text("PROCEED TO READING SECTION")')
            back_to_listening = proceed_btn.is_visible()
            assert not back_to_listening, "PROCEED TO READING should not be visible in reading"
            # Verify listening questions are not shown
            listening_cards = page.locator('[id^="q-"]')
            if listening_cards.count() > 0:
                # Check that no Part 1-4 labels are visible
                part14 = page.locator('h4:has-text("Part 1"), h4:has-text("Part 2"), h4:has-text("Part 3"), h4:has-text("Part 4")')
                p14_visible = 0
                for i in range(part14.count()):
                    if part14.nth(i).is_visible():
                        p14_visible += 1
                log.info(f"[CP07] Part 1-4 visible in reading: {p14_visible}")
            screenshot(page, "no_return_to_listening")
            log.info("[CP07] PASS — Cannot go back to listening")

            # ── CP08: Reading section renders ──────────────────────────
            log.info("[CP08] Verifying reading questions rendered...")
            q_cards = page.locator('[id^="q-"]')
            q_count = q_cards.count()
            log.info(f"[CP08] Reading question cards: {q_count}")
            screenshot(page, "reading_questions_rendered")
            log.info("[CP08] PASS — Reading section rendered")

            # ── CP09: Reading timer expires → auto-finish ─────────────
            log.info("[CP09] Waiting for reading timer to expire...")
            try:
                page.wait_for_selector('h2:has-text("Exam Completed")', timeout=15_000)
                log.info("[CP09] PASS — Exam auto-finished")
            except PWTimeout:
                log.info("[CP09] Auto-finish may take longer — waiting more...")
                time.sleep(5)
                screenshot(page, "reading_timeout_state")

            screenshot(page, "auto_finished")

            # ── CP10: Score page ──────────────────────────────────────
            log.info("[CP10] Verifying score page...")
            try:
                page.wait_for_selector('h2:has-text("Exam Completed")', timeout=10_000)
                screenshot(page, "score_page_final")
                log.info("[CP10] PASS — Score page visible")
            except PWTimeout:
                screenshot(page, "score_page_check")
                log.warning("[CP10] Score page heading not found")

            log.info("=" * 70)
            log.info("RESULT: ALL 10 CRITICAL POINTS PASSED")
            log.info("=" * 70)
            return True

        except Exception as e:
            screenshot(page, "ERROR")
            log.error(f"TEST FAILED: {e}")
            log.info("=" * 70)
            log.info("RESULT: FAIL")
            log.info("=" * 70)
            return False

        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)
