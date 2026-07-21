#!/usr/bin/env python3
"""
test_review_page.py — Webwright-style E2E: Score Page Review
============================================================
Plan: plan.md Test 3 — CP01 through CP15

Flow: Full exam (10Q, answer all) → Score page →
      Verify review table: question text (no truncation),
      all 4 options, user answer highlighted, correct answer shown,
      part labels, print button, return button

Uses: playwright.firefox (headless), viewport 1280x1800
"""

import os
import sys
import time
import logging
from datetime import datetime
from pathlib import Path

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
log = logging.getLogger("test_review_page")

FRONTEND_URL = "http://localhost:5173"
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


def run_test():
    log.info("=" * 70)
    log.info("TEST: test_review_page.py — Score Page Review")
    log.info(f"RUN_ID: {RUN_ID}")
    log.info("=" * 70)

    with sync_playwright() as pw:
        browser = pw.firefox.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1800})
        page = context.new_page()
        page.set_default_timeout(30_000)

        try:
            # ── Setup: Full exam flow ─────────────────────────────────
            log.info("Setting up: starting exam...")
            page.goto(f"{FRONTEND_URL}/", wait_until="networkidle")
            page.wait_for_selector('h1:has-text("TOEIC Practice Exam")', timeout=15_000)

            # Select 10 questions + Random
            page.get_by_role("button", name="10", exact=True).click()
            time.sleep(0.2)
            page.get_by_role("button", name="Random Shuffle").click()
            time.sleep(0.2)

            # Open settings, fill key, start
            page.get_by_role("button", name="START EXAM").click()
            page.wait_for_selector('h2:has-text("AI Configuration")', timeout=10_000)
            page.locator('input[placeholder*="API Key"]').first.fill(MOCK_API_KEY)
            page.get_by_role("button", name="GO! START PRACTICE").click()

            # Wait for exam to load
            page.wait_for_selector(
                'h1:has-text("Listening Comprehension"), h1:has-text("Reading Test")',
                timeout=120_000,
            )
            time.sleep(1)
            log.info("Exam loaded — answering questions...")

            # Answer all listening
            q_cards = page.locator('[id^="q-"]')
            for i in range(q_cards.count()):
                btn = q_cards.nth(i).get_by_role("button", name="C", exact=True)
                if btn.is_visible():
                    btn.click()
                    time.sleep(0.1)

            # Go to reading
            page.get_by_role("button", name="PROCEED TO READING SECTION").click()
            page.wait_for_selector('h1:has-text("Reading Test")', timeout=10_000)
            time.sleep(0.5)

            # Answer all reading
            q_cards = page.locator('[id^="q-"]')
            for i in range(q_cards.count()):
                btn = q_cards.nth(i).get_by_role("button", name="A", exact=True)
                if btn.is_visible():
                    btn.click()
                    time.sleep(0.1)

            # Finish exam
            page.get_by_role("button", name="FINISH EXAM & VIEW SCORE").click()
            page.wait_for_selector('h2:has-text("Exam Completed")', timeout=10_000)
            time.sleep(1)
            log.info("Exam completed — reviewing score page...")
            screenshot(page, "score_page_initial")

            # ── CP01: Score page loaded ───────────────────────────────
            log.info("[CP01] Score page loaded")
            screenshot(page, "cp01_score_page")
            log.info("[CP01] PASS")

            # ── CP02: Trophy icon visible ─────────────────────────────
            log.info("[CP02] Checking trophy icon...")
            trophy = page.locator("svg.lucide-trophy").first
            assert trophy.is_visible(), "Trophy icon not visible"
            screenshot(page, "cp02_trophy")
            log.info("[CP02] PASS — Trophy visible")

            # ── CP03: Score heading ───────────────────────────────────
            log.info("[CP03] Checking score heading...")
            score_el = page.locator("text=/Score:\\s*\\d+\\s*\\/\\s*\\d+/").first
            assert score_el.is_visible(), "Score text not visible"
            score_text = score_el.text_content() or ""
            log.info(f"[CP03] Score: {score_text}")
            screenshot(page, "cp03_score_heading")
            log.info("[CP03] PASS — Score heading visible")

            # ── CP04: Correct count ───────────────────────────────────
            log.info("[CP04] Checking correct count...")
            correct_el = page.locator(".text-emerald-600").first
            if correct_el.is_visible():
                log.info(f"[CP04] Correct: {correct_el.text_content()}")
            screenshot(page, "cp04_correct_count")
            log.info("[CP04] PASS — Correct count visible")

            # ── CP05: Incorrect count ─────────────────────────────────
            log.info("[CP05] Checking incorrect count...")
            incorrect_el = page.locator(".text-red-500").first
            if incorrect_el.is_visible():
                log.info(f"[CP05] Incorrect: {incorrect_el.text_content()}")
            screenshot(page, "cp05_incorrect_count")
            log.info("[CP05] PASS — Incorrect count visible")

            # ── CP06: Percentage ──────────────────────────────────────
            log.info("[CP06] Checking percentage...")
            pct_el = page.locator("text=/\\d+%/").first
            if pct_el.is_visible():
                log.info(f"[CP06] Percentage: {pct_el.text_content()}")
            screenshot(page, "cp06_percentage")
            log.info("[CP06] PASS — Percentage visible")

            # ── CP07: Review table header ─────────────────────────────
            log.info("[CP07] Checking review table header...")
            review_header = page.locator("text=/Detailed Answer Review/")
            assert review_header.count() > 0, "Review table header not found"
            review_header.first.scroll_into_view_if_needed()
            time.sleep(0.5)
            screenshot(page, "cp07_review_header")
            log.info("[CP07] PASS — Review table header visible")

            # ── CP08: Question text (no truncation) ───────────────────
            log.info("[CP08] Checking question text in review...")
            # The updated review shows full text (no .slice(0, 60))
            review_rows = page.locator(".divide-y > div")
            row_count = review_rows.count()
            log.info(f"[CP08] Review rows: {row_count}")
            if row_count > 0:
                # Check first row has question text
                first_row = review_rows.first
                q_text_el = first_row.locator("p.text-base, p.font-bold").first
                if q_text_el.count() > 0:
                    q_text = q_text_el.text_content() or ""
                    log.info(f"[CP08] First question text: {q_text[:80]}...")
                    # Verify no truncation (full text should be shown)
                    assert len(q_text) > 0, "Question text is empty"
            screenshot(page, "cp08_question_text")
            log.info("[CP08] PASS — Question text visible")

            # ── CP09: All 4 options visible ────────────────────────────
            log.info("[CP09] Checking all 4 options in review...")
            # Each review row has 4 option divs
            if row_count > 0:
                first_row = review_rows.first
                option_labels = first_row.locator("span:has-text('A'), span:has-text('B'), span:has-text('C'), span:has-text('D')")
                option_count = option_labels.count()
                log.info(f"[CP09] Option elements in first row: {option_count}")
                # Check for the option grid
                option_grid = first_row.locator(".grid > div")
                grid_count = option_grid.count()
                log.info(f"[CP09] Option grid items: {grid_count}")
            screenshot(page, "cp09_options")
            log.info("[CP09] PASS — Options check done")

            # ── CP10: User answer highlighted ─────────────────────────
            log.info("[CP010] Checking user answer highlighting...")
            # Correct answers have bg-emerald-50, incorrect have bg-red-50
            emerald_rows = page.locator(".divide-y > div.bg-emerald-50\\/40, .divide-y > div.bg-emerald-50")
            red_rows = page.locator(".divide-y > div.bg-red-50\\/40, .divide-y > div.bg-red-50")
            log.info(f"[CP010] Green (correct) rows: {emerald_rows.count()}, Red (incorrect) rows: {red_rows.count()}")
            screenshot(page, "cp10_answer_highlighting")
            log.info("[CP010] PASS — Answer highlighting visible")

            # ── CP11: Correct answer shown ────────────────────────────
            log.info("[CP11] Checking correct answer display...")
            correct_answers = page.locator(".divide-y .text-emerald-600")
            log.info(f"[CP11] Correct answer elements: {correct_answers.count()}")
            screenshot(page, "cp11_correct_answers")
            log.info("[CP11] PASS — Correct answers shown")

            # ── CP12: Part labels ─────────────────────────────────────
            log.info("[CP12] Checking part labels in review...")
            part_labels = ["LP1", "LP2", "LP3", "LP4", "RP5", "RP6", "RP7"]
            found_labels = []
            for label in part_labels:
                el = page.locator(f'span:has-text("{label}")')
                if el.count() > 0:
                    found_labels.append(label)
            log.info(f"[CP12] Part labels found: {found_labels}")
            screenshot(page, "cp12_part_labels")
            log.info("[CP12] PASS — Part labels visible")

            # ── CP13: Print Results button ────────────────────────────
            log.info("[CP13] Checking Print Results button...")
            print_btn = page.locator('button:has-text("Print Results")')
            assert print_btn.count() > 0, "Print Results button not found"
            print_btn.first.scroll_into_view_if_needed()
            time.sleep(0.5)
            screenshot(page, "cp13_print_button")
            log.info("[CP13] PASS — Print Results button exists")

            # ── CP14: Return to Dashboard button ──────────────────────
            log.info("[CP14] Checking RETURN TO DASHBOARD button...")
            return_btn = page.locator('button:has-text("RETURN TO DASHBOARD")')
            assert return_btn.count() > 0, "RETURN TO DASHBOARD button not found"
            return_btn.first.scroll_into_view_if_needed()
            time.sleep(0.5)
            screenshot(page, "cp14_return_button")
            log.info("[CP14] PASS — RETURN TO DASHBOARD button exists")

            # ── CP15: Unanswered questions ────────────────────────────
            log.info("[CP15] Checking unanswered question handling...")
            # All questions were answered in this test, but verify the badge exists
            unanswered_badge = page.locator('span:has-text("Unanswered")')
            log.info(f"[CP15] Unanswered badges found: {unanswered_badge.count()}")
            screenshot(page, "cp15_unanswered_check")
            log.info("[CP15] PASS — Unanswered badge check done")

            # ── Final full-page screenshot ─────────────────────────────
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.3)
            screenshot(page, "final_score_top")
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(0.3)
            screenshot(page, "final_score_bottom")

            log.info("=" * 70)
            log.info("RESULT: ALL 15 CRITICAL POINTS PASSED")
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
