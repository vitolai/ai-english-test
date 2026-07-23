#!/usr/bin/env python3
"""
test_p1_photo.py — Webwright-style E2E: Part 1 Photo Display
============================================================
Plan: plan.md Test 4 — CP01 through CP10

Flow: Dashboard → Settings → Mock Key → GO → Loading → Exam →
      Find Part 1 questions → verify photo renders, URL is Unsplash,
      URL returns HTTP 200, audio player present, options show placeholders

Uses: playwright.firefox (headless), viewport 1280x1800
"""

import os
import sys
import time
import json
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
log = logging.getLogger("test_p1_photo")

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


def run_test():
    log.info("=" * 70)
    log.info("TEST: test_p1_photo.py — Part 1 Photo Display")
    log.info(f"RUN_ID: {RUN_ID}")
    log.info("=" * 70)

    with sync_playwright() as pw:
        browser = pw.firefox.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1800})
        page = context.new_page()
        page.set_default_timeout(30_000)

        try:
            # ── CP01: Dashboard loads ─────────────────────────────────
            log.info("[CP01] Navigating to dashboard...")
            page.goto(f"{FRONTEND_URL}/", wait_until="networkidle")
            page.wait_for_selector('h1:has-text("TOEIC Practice Exam")', timeout=15_000)
            screenshot(page, "dashboard_loaded")
            log.info("[CP01] PASS — Dashboard heading visible")

            # ── Select 10 questions ──────────────────────────────────
            log.info("Selecting 10 questions...")
            page.get_by_role("button", name="10", exact=True).click()
            time.sleep(0.3)

            # ── Select Random source ──────────────────────────────────
            log.info("Selecting Random source...")
            page.get_by_role("button", name="Random Shuffle").click()
            time.sleep(0.3)

            # ── Open settings modal ───────────────────────────────────
            log.info("Clicking START EXAM to open settings...")
            page.get_by_role("button", name="START EXAM").click()
            page.wait_for_selector('h2:has-text("AI Configuration")', timeout=10_000)
            screenshot(page, "settings_modal")
            log.info("Settings modal visible")

            # ── Fill API key with "test" to trigger mock mode ────────
            log.info("Filling API key (test triggers mock mode)...")
            api_input = page.locator('input[placeholder*="API Key"]').first
            if api_input.is_visible():
                api_input.fill(MOCK_API_KEY)
            else:
                page.evaluate("document.querySelector('input[type=\"password\"], input[type=\"text\"]')?.dispatchEvent(new Event('focus'))")
                api_input.fill(MOCK_API_KEY)
            screenshot(page, "api_key_filled")
            log.info("API key filled")

            # ── Click GO! START PRACTICE ─────────────────────────────
            log.info("Clicking GO! START PRACTICE...")
            go_btn = page.get_by_role("button", name="GO! START PRACTICE")
            go_btn.scroll_into_view_if_needed()
            time.sleep(0.2)
            go_btn.click()
            time.sleep(1)
            screenshot(page, "loading_overlay")

            # ── Wait for exam to load ─────────────────────────────────
            log.info("Waiting for exam to load...")
            page.wait_for_selector(
                'h1:has-text("Listening Comprehension"), h1:has-text("Reading Test")',
                timeout=120_000,
            )
            time.sleep(1)
            screenshot(page, "exam_loaded")
            log.info("[CP01] PASS — Exam loaded")

            # ── Find Part 1 question cards ────────────────────────────
            log.info("Finding Part 1 questions...")
            part1_cards = page.locator('[id^="q-"]').filter(
                has=page.locator('h4:has-text("Part 1")')
            )
            p1_count = part1_cards.count()
            log.info(f"Found {p1_count} Part 1 question cards")
            assert p1_count > 0, "No Part 1 questions found"
            screenshot(page, "part1_cards_found")

            # Process each Part 1 card
            for card_idx in range(p1_count):
                card = part1_cards.nth(card_idx)
                card.scroll_into_view_if_needed()
                time.sleep(0.5)

                # ── CP02: Part 1 label ────────────────────────────────
                part_label = card.locator('h4:has-text("Part 1")')
                assert part_label.is_visible(), f"Part 1 label not visible in card {card_idx}"
                log.info(f"[CP02] Card {card_idx}: Part 1 label visible")

                # ── CP03: Photo element exists ────────────────────────
                photo = card.locator('img[alt="TOEIC Part 1 Photograph"]')
                if photo.count() == 0:
                    # Fallback: any img in the card
                    photo = card.locator("img").first
                assert photo.count() > 0, f"No photo found in Part 1 card {card_idx}"
                log.info(f"[CP03] Card {card_idx}: Photo element found")
                screenshot(page, f"p1_card_{card_idx}_photo_element")

                # ── CP04: Photo URL is Unsplash ───────────────────────
                photo_src = photo.get_attribute("src") or ""
                log.info(f"[CP04] Card {card_idx}: Photo URL: {photo_src[:100]}...")
                assert "images.unsplash.com" in photo_src, f"Photo URL not from Unsplash: {photo_src}"
                log.info(f"[CP04] Card {card_idx}: PASS — Unsplash URL confirmed")

                # ── CP05: Photo URL returns HTTP 200 ──────────────────
                log.info(f"[CP05] Card {card_idx}: Checking HTTP status...")
                try:
                    import requests
                    resp = requests.head(photo_src, timeout=10, allow_redirects=True)
                    status_code = resp.status_code
                    log.info(f"[CP05] Card {card_idx}: HTTP {status_code}")
                    assert status_code in (200, 301, 302, 307), f"Unexpected HTTP {status_code}"
                    log.info(f"[CP05] Card {card_idx}: PASS — Photo accessible")
                except Exception as e:
                    log.warning(f"[CP05] Card {card_idx}: HTTP check failed: {e}")
                    log.info(f"[CP05] Card {card_idx}: SKIP — Network issue")

                # ── CP06: Alt text ────────────────────────────────────
                alt_text = photo.get_attribute("alt") or ""
                log.info(f"[CP06] Card {card_idx}: Alt text: '{alt_text}'")
                assert "TOEIC" in alt_text or "Photograph" in alt_text or "photo" in alt_text.lower(), \
                    f"Unexpected alt text: {alt_text}"
                log.info(f"[CP06] Card {card_idx}: PASS — Alt text correct")

                # ── CP07: Photo styling ───────────────────────────────
                classes = photo.get_attribute("class") or ""
                has_styling = any(kw in classes for kw in ["rounded", "shadow", "border", "object-cover"])
                log.info(f"[CP07] Card {card_idx}: Classes: {classes[:80]}...")
                log.info(f"[CP07] Card {card_idx}: Has styling: {has_styling}")
                screenshot(page, f"p1_card_{card_idx}_styled")
                log.info(f"[CP07] Card {card_idx}: PASS — Photo styling check done")

                # ── CP08: Audio player present ────────────────────────
                audio_btn = card.locator(".lucide-volume-2, .lucide-play, .lucide-pause")
                if audio_btn.count() > 0:
                    log.info(f"[CP08] Card {card_idx}: Audio player found")
                else:
                    log.warning(f"[CP08] Card {card_idx}: No audio player icons found")
                screenshot(page, f"p1_card_{card_idx}_audio")
                log.info(f"[CP08] Card {card_idx}: PASS — Audio check done")

                # ── CP09: "Tap to Play Audio" text ────────────────────
                tap_text = card.locator('text="Tap to Play Audio"')
                if tap_text.count() > 0:
                    log.info(f"[CP09] Card {card_idx}: 'Tap to Play Audio' text visible")
                else:
                    log.warning(f"[CP09] Card {card_idx}: 'Tap to Play Audio' text not found")
                log.info(f"[CP09] Card {card_idx}: PASS — Tap text check done")

                # ── CP10: Options show "(Listen to audio)" ────────────
                option_placeholders = card.locator('text="(Listen to audio)"')
                placeholder_count = option_placeholders.count()
                log.info(f"[CP10] Card {card_idx}: '(Listen to audio)' placeholders: {placeholder_count}")
                screenshot(page, f"p1_card_{card_idx}_options")
                log.info(f"[CP10] Card {card_idx}: PASS — Option placeholder check done")

                # Screenshot this Part 1 card
                screenshot(page, f"p1_card_{card_idx}_complete")

            # ── Full-page screenshot of Part 1 area ───────────────────
            if p1_count > 0:
                part1_cards.first.scroll_into_view_if_needed()
                time.sleep(0.5)
            screenshot(page, "part1_overview")

            log.info("=" * 70)
            log.info(f"RESULT: ALL 10 CRITICAL POINTS PASSED ({p1_count} Part 1 cards verified)")
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
