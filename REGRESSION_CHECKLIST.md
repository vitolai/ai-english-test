# TOEIC AI Pro — Regression Test Checklist

**Purpose**: Run this checklist before every release/deploy to catch regressions.
**Location**: `C:\Users\vitol\Desktop\toeic-test-scripts\REGRESSION_CHECKLIST.md`

---

## 🔴 CRITICAL PATH (Must Pass — Blockers)

| ID | Feature | Test Steps | Expected | Status |
|----|---------|------------|----------|--------|
| **CP-01** | **Frontend Loads** | Open `http://localhost:5173` | Page renders, no console errors | ⬜ |
| **CP-02** | **Backend Health** | `curl http://localhost:3001/api/health/providers` | 200 OK, providers listed | ⬜ |
| **CP-03** | **Mock 10Q Generation** | POST `/api/generate` with `model:mock, apiKey:test` | 10 questions, all parts present | ⬜ |
| **CP-04** | **Real AI 10Q Generation** | POST `/api/generate` with real API key | 10 questions, Parts 1-7 distributed | ⬜ |
| **CP-05** | **Audio Files Exist** | Check `storage/sessions/*/audio/q1.mp3` after gen | 5+ audio files, 20KB+ each | ⬜ |
| **CP-06** | **Audio Playable via Proxy** | `curl http://localhost:5173/storage/sessions/.../q1.mp3` | 200 OK, >10KB | ⬜ |

---

## 🟠 PART-SPECIFIC LOGIC (TOEIC Spec Compliance)

### Part 1 — Photographs (6% ≈ 1/10Q, 2/20Q, 4/50Q, 6/100Q, 12/200Q)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P1-01** | Photo displayed | Image loads from Unsplash, unique per question | ⬜ |
| **P1-02** | No transcript shown | `transcript` empty, not rendered in UI | ⬜ |
| **P1-03** | No question text | Instruction only, no "Question:" label | ⬜ |
| **P1-04** | Options hidden (audio only) | Buttons show "(Listen to audio)", no text | ⬜ |
| **P1-05** | Audio: 4 options in 1 file | Single MP3 speaks A/B/C/D sequentially | ⬜ |
| **P1-06** | Photo count scales | 10Q=1, 20Q=2, 50Q=4, 100Q=6, 200Q=12 | ⬜ |

### Part 2 — Question-Response (25%)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P2-01** | No photo | No image element | ⬜ |
| **P2-02** | No question text | Empty `question` field, spoken Q in `transcript` | ⬜ |
| **P2-03** | No transcript shown | `transcript` not rendered in UI | ⬜ |
| **P2-04** | Exactly 3 options (A/B/C) | Array length = 3 | ⬜ |
| **P2-05** | Audio: Q + 3 responses | Single MP3 with question + A/B/C | ⬜ |

### Part 3 — Conversations (39%)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P3-01** | Transcript present | `transcript` non-empty (conversation text) | ⬜ |
| **P3-02** | Question text visible | `question` field rendered | ⬜ |
| **P3-03** | 4 options (A/B/C/D) | Array length = 4 | ⬜ |
| **P3-04** | 3 questions share transcript | Same `transcript` for Q group | ⬜ |
| **P3-05** | Audio: transcript + Q + opts | MP3 contains conversation + Q + A/B/C/D | ⬜ |

### Part 4 — Talks (30%)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P4-01** | Transcript present | `transcript` non-empty (talk/announcement) | ⬜ |
| **P4-02** | Question text visible | `question` field rendered | ⬜ |
| **P4-03** | 4 options (A/B/C/D) | Array length = 4 | ⬜ |
| **P4-04** | 3 questions share transcript | Same `transcript` for Q group | ⬜ |
| **P4-05** | Audio: talk + Q + opts | MP3 contains talk + Q + A/B/C/D | ⬜ |

### Part 5 — Incomplete Sentences (30%)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P5-01** | Type = reading | `type: "reading"` | ⬜ |
| **P5-02** | Single sentence with blank | `question` contains `___` or `____` | ⬜ |
| **P5-03** | 4 written options | Array length = 4, text options | ⬜ |
| **P5-04** | No transcript, no audio | `transcript` empty, `audio` undefined | ⬜ |

### Part 6 — Text Completion (16%)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P6-01** | Passage with blanks | `context`/`passage` present | ⬜ |
| **P6-02** | 4 options per blank | Array length = 4 | ⬜ |

### Part 7 — Reading Comprehension (54%)
| ID | Test | Expected | Status |
|----|------|----------|--------|
| **P7-01** | Passage(s) present | `context`/`passage` present | ⬜ |
| **P7-02** | Questions reference passage | `question` about passage | ⬜ |
| **P7-03** | 4 written options | Array length = 4 | ⬜ |

---

## 🟡 UI / UX REGRESSIONS

| ID | Feature | Test Steps | Expected | Status |
|----|---------|------------|----------|--------|
| **UX-01** | **Audio URL uses relative path** | Inspect `<audio src>` in DevTools | `/storage/...` NOT `http://localhost:3001/...` | ⬜ |
| **UX-02** | **Image URL uses relative path** | Inspect `<img src>` for Part 1 | `/storage/...` or Unsplash URL | ⬜ |
| **UX-03** | **Part 1: Instruction → Audio → Photo → Options** | Visual order check | Correct order | ⬜ |
| **UX-04** | **Part 2: No text, audio only** | Visual check | Audio player + 3 option buttons | ⬜ |
| **UX-05** | **Part 3/4: Question + 4 options** | Visual check | Question text + A/B/C/D | ⬜ |
| **UX-06** | **Score page: Detailed review** | Complete exam → score page | Table with: Q#, Part, Your Ans, Correct, ✅/❌ | ⬜ |
| **UX-07** | **Score page: Part label (L1, L2, L3, L4, R5, R6, R7)** | Check each row | Correct prefix | ⬜ |
| **UX-08** | **Web source: Target Website URL visible** | Dashboard → Web source | Input shows `https://news.google.com/` | ⬜ |
| **UX-09** | **Web source: Content relevance** | Generate from URL → check questions | 40-50% keyword match | ⬜ |

---

## 🔧 INFRASTRUCTURE / DEVOPS

| ID | Test | Expected | Status |
|----|------|----------|--------|
| **INF-01** | Vite binds 0.0.0.0 | `ss -tlnp \| grep 5173` shows `0.0.0.0:5173` | ⬜ |
| **INF-02** | Vite proxy /api → :3001 | POST `/api/generate` works | ⬜ |
| **INF-03** | Vite proxy /storage → :3001 | GET `/storage/.../q1.mp3` works | ⬜ |
| **INF-04** | inotify watches sufficient | `cat /proc/sys/fs/inotify/max_user_watches` ≥ 524288 | ⬜ |
| **INF-05** | node_modules owned by user | `ls -la node_modules` | ⬜ |
| **INF-06** | edge-tts installed | `python3 -c "import edge_tts"` succeeds | ⬜ |
| **INF-07** | Firecrawl reachable | `curl -X POST https://api.firecrawl.dev/v2/scrape ...` returns markdown | ⬜ |
| **INF-08** | Netbird mesh connected | `netbird status` shows all peers | ⬜ |

---

## 📊 SCALE TESTS (Run at least one per release)

| Scale | Questions | Time Budget | Parts Present | Audio Files | Status |
|-------|-----------|-------------|---------------|-------------|--------|
| **10Q** | 10 | 60s | 1,2,3,4,5,6,7 | 5-6 | ⬜ |
| **20Q** | 20 | 120s | All 7 | 12-14 | ⬜ |
| **50Q** | 50 | 180s | All 7 | 30-35 | ⬜ |
| **100Q** | 100 | 360s | All 7 | 60-70 | ⬜ |
| **200Q** | 200 | 720s | All 7 | 120-140 | ⬜ |

**Scaling checks**:
- [ ] Part 1 count matches TOEIC ratio
- [ ] Part 4 generated (historically under-generated)
- [ ] Part 7 generated (historically under-generated)
- [ ] `maxAttempts = Math.ceil(Q/10) + 5` working (no truncation)

---

## 🧪 MOCK MODE VERIFICATION

| ID | Test | Expected | Status |
|----|------|----------|--------|
| **MM-01** | `apiKey: "test"` triggers mock | No external API calls | ⬜ |
| **MM-02** | Deterministic output | Same session_id = same questions | ⬜ |
| **MM-03** | Instant generation | <2s for 200Q | ⬜ |
| **MM-04** | All 7 parts present | Parts 1-7 all have questions | ⬜ |

---

## 📋 HOW TO RUN

```bash
# 1. Quick smoke test (default scale)
cd /home/vlw/toeic-ai-pro-w
python3 scripts/run_regression.py

# 2. Custom scale test (pick your scale)
python3 scripts/run_regression.py --scale 10   # or 20, 50, 100, 200

# 3. Real provider mode (optional)
python3 scripts/run_regression.py --scale 50 --real

# 4. Mock mode CI
npm run test:contract && npm run test:e2e:mock
```

---

## 🐛 KNOWN REGRESSIONS (History)

| Date | Bug | Root Cause | Fix Applied | Test ID |
|------|-----|------------|-------------|---------|
| 2026-07-18 | Audio 404 | `http://localhost:3001/...` in Exam.tsx | Relative `/storage/` via Vite proxy | CP-06, UX-01 |
| 2026-07-18 | Part 1 shows transcript | Missing `isPart1` guard in QuestionCard | `isPart1 && isPart2` hide text | P1-02 |
| 2026-07-18 | Part 1 same photo | AI picks first ID, no fallback | `ensurePart1Images()` assigns unique IDs | P1-01 |
| 2026-07-18 | Part 2 has 4 options | Spec says 3 (A/B/C) | Mock + AI prompt: 3 options | P2-04 |
| 2026-07-18 | Part 3/4 empty transcript | AI ignores `transcript` field | `ensurePart34Transcripts()` fallback | P3-01, P4-01 |
| 2026-07-18 | Part 4/7 under-generated | AI ignores distribution | `getQuestionDistribution()` + prompt | Scale |
| 2026-07-18 | Chunking fails at 100Q+ | Hardcoded `maxAttempts=5` | Dynamic `Math.ceil(Q/10)+5` | Scale |
| 2026-07-18 | Web source broken | `source==='url'` vs `'web'` | Fixed App.tsx + Firecrawl ingest | UX-08 |
| 2026-07-18 | Score page minimal | No per-question review | Detailed table with ✅/❌ | UX-06 |
| 2026-07-18 | Audio labels spoken | TTS said "A. text B. text" | Removed labels from gen_audio.py | P1-05, P2-05 |

---

## ✅ SIGN-OFF

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Dev Lead | | | |
| Release Manager | | | |

---
*Generated from session history — update after each bug fix*