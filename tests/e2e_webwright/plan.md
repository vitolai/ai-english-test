# E2E Webwright Tests — Critical Points Plan

## Test Environment
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3001 (Express server)
- **Mock Mode**: apiKey contains "test" → triggers mock data generation
- **Browser**: Playwright Firefox, headless, viewport 1280x1800
- **Timer**: `?fastTimer=1` URL param → `timerDivisor=100` → 600/100 = 6s listening timer

## API Flow
1. `POST /api/generate` → `{ session_id }` (async generation starts)
2. `GET /api/status/:sid` → poll until `phase === 'completed'`
3. `GET /storage/sessions/:sid/exam_data.json` → full exam data

---

## Test 1: test_exam_flow.py — Full Exam Flow

### Critical Points
- [ ] CP01: Dashboard loads — `h1:has-text("TOEIC Practice Exam")` visible
- [ ] CP02: 10-question count button selected (active state)
- [ ] CP03: Random source button selected (active state)
- [ ] CP04: Settings modal opens — `h2:has-text("AI Configuration")` visible
- [ ] CP05: API key input filled with "test"
- [ ] CP06: Loading overlay appears — spinner + progress bar visible
- [ ] CP07: Loading phase text shows "Exam Generation" or "Visual Analysis"
- [ ] CP08: Exam view loads — "Listening Comprehension" heading visible
- [ ] CP09: At least 1 question card rendered (`[id^="q-"]`)
- [ ] CP10: Part labels visible — check for Part 1-4 in listening section
- [ ] CP11: Audio players present (Volume2 icons in listening cards)
- [ ] CP12: All listening questions answered (option buttons clicked)
- [ ] CP13: "PROCEED TO READING SECTION" button visible
- [ ] CP14: "PROCEED TO READING SECTION" clicked → reading view loads
- [ ] CP15: "Reading Test" heading visible
- [ ] CP16: All reading questions answered
- [ ] CP17: "FINISH EXAM & VIEW SCORE" button visible and clicked
- [ ] CP18: Score page — "Exam Completed!" heading visible
- [ ] CP19: Score text matches `Score: X / 10`
- [ ] CP20: Correct/Incorrect/Percentage summary visible

### Approach
- Full UI flow from dashboard through exam to score
- Navigate via `page.goto("/")` (no fastTimer needed — timer is long enough)
- Screenshot at every CP milestone
- Answer all questions with option "C" (listening) and "A" (reading)

---

## Test 2: test_timer_enforcement.py — Timer L→R Enforcement

### Critical Points
- [ ] CP01: Exam loads with `?fastTimer=1` — listening timer shows ~00:06
- [ ] CP02: "Listening Comprehension" heading visible
- [ ] CP03: Timer counting down (verify changes over time)
- [ ] CP04: After ~6s, listening timer expires → auto-advance to reading
- [ ] CP05: Toast notification "Listening time is up!" appears
- [ ] CP06: "Reading Test" heading visible (auto-switched)
- [ ] CP07: Cannot go back to listening — no "PROCEED TO READING" button, listening questions hidden
- [ ] CP08: Reading section renders with reading questions
- [ ] CP09: After reading timer expires (~6s more) → exam auto-finishes
- [ ] CP10: Score page — "Exam Completed!" heading visible

### Approach
- Generate exam via API (POST /api/generate), poll status, load exam data
- Navigate to `http://localhost:5173/?fastTimer=1`
- Wait for exam to load, then observe timer countdown
- Verify auto-advance at listening expiry
- Verify no way to return to listening
- Wait for reading expiry → auto-finish

---

## Test 3: test_review_page.py — Score Page Review

### Critical Points
- [ ] CP01: Score page loaded after completing exam
- [ ] CP02: Trophy icon visible
- [ ] CP03: Score heading "Score: X / 10 (Z%)" displayed
- [ ] CP04: Correct count displayed (green number)
- [ ] CP05: Incorrect count displayed (red number)
- [ ] CP06: Percentage displayed
- [ ] CP07: "Detailed Answer Review (10 questions)" table header visible
- [ ] CP08: Question text shown (NO truncation — full text in review)
- [ ] CP09: All 4 options (A/B/C/D) visible per question in review
- [ ] CP10: User answer highlighted (green if correct, red if incorrect)
- [ ] CP11: Correct answer shown in green (emerald styling)
- [ ] CP12: Part labels (LP1/LP2/RP5 etc.) visible per question
- [ ] CP13: "Print Results" button exists
- [ ] CP14: "RETURN TO DASHBOARD" button exists
- [ ] CP15: Unanswered questions show "Unanswered" badge

### Approach
- Full exam flow → score page
- Scroll through review table
- Verify each review row has: part label, Q number, question text, options, user answer, correct answer
- Verify print button and return button exist

---

## Test 4: test_p1_photo.py — Part 1 Photo Display

### Critical Points
- [ ] CP01: Exam loads with Part 1 questions visible
- [ ] CP02: Part 1 card has `h4:has-text("Part 1")` label
- [ ] CP03: Part 1 card contains an `<img>` element
- [ ] CP04: Photo `src` is from Unsplash (`images.unsplash.com`)
- [ ] CP05: Photo URL returns HTTP 200
- [ ] CP06: Photo `alt` text is "TOEIC Part 1 Photograph"
- [ ] CP07: Photo has proper styling (rounded, shadow, border)
- [ ] CP08: Audio player present in Part 1 card (Volume2 icon)
- [ ] CP09: "Tap to Play Audio" text visible
- [ ] CP10: Options show "(Listen to audio)" placeholder text

### Approach
- Generate exam via API, navigate to frontend
- Find Part 1 question cards
- For each Part 1 card: extract image src, verify Unsplash URL, fetch URL for HTTP 200
- Verify audio player and option placeholders
- Screenshot the Part 1 card

---

## Shared Infrastructure

### Screenshot & Log Convention
```python
RUN_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
SCREENSHOT_DIR = f"final_runs/{RUN_ID}/screenshots"
LOG_FILE = f"final_runs/{RUN_ID}/final_script_log.txt"
```

### API Helper (used by tests 2-4 for fast setup)
```python
def generate_exam(page_count=10):
    # POST /api/generate → session_id
    # Poll GET /api/status/:sid → completed
    # Return session_id
```

### Browser Setup
```python
browser = playwright.firefox.launch(headless=True)
context = browser.new_context(viewport={"width": 1280, "height": 1800})
page = context.new_page()
```

### Key Selectors
| Element | Selector |
|---------|----------|
| Dashboard heading | `h1:has-text("TOEIC Practice Exam")` |
| Question count 10 | `button:has-text("10")` in `.grid.grid-cols-6` |
| Random source | `button:has-text("Random Shuffle")` |
| Start Exam | `button:has-text("START EXAM")` |
| Settings heading | `h2:has-text("AI Configuration")` |
| API key input | `input[placeholder*="API Key"]` |
| Go Start | `button:has-text("GO! START PRACTICE")` |
| Loading overlay | `.fixed.inset-0.z-50` |
| Listening header | `h1:has-text("Listening Comprehension")` |
| Reading header | `h1:has-text("Reading Test")` |
| Question cards | `[id^="q-"]` |
| Part labels | `h4:has-text("Part N")` |
| Option buttons | `button` inside card with exact text A/B/C/D |
| Go to Reading | `button:has-text("PROCEED TO READING SECTION")` |
| Finish Exam | `button:has-text("FINISH EXAM & VIEW SCORE")` |
| Score heading | `h2:has-text("Exam Completed")` |
| Score text | `text=/Score:\s*\d+\s*\/\s*\d+/` |
| Review header | `div:has-text("Detailed Answer Review")` |
| Print button | `button:has-text("Print Results")` |
| Return button | `button:has-text("RETURN TO DASHBOARD")` |
| Photo image | `img[alt="TOEIC Part 1 Photograph"]` |
| Audio icon | `.lucide-volume-2` |
| Toast | `div:has-text("Listening time is up")` |
