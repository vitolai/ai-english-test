# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke_10q.spec.ts >> Smoke Test - 10 Questions (Robust Link Verification)
- Location: tests/smoke_10q.spec.ts:3:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h2')
Expected substring: "Listening"
Received string:    "AI Configuration"
Timeout: 60000ms

Call log:
  - Expect "toContainText" with timeout 60000ms
  - waiting for locator('h2')
    63 × locator resolved to <h2 class="text-2xl font-black text-slate-800 flex items-center gap-3">…</h2>
       - unexpected value "AI Configuration"

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]:
        - heading "TOEIC Practice Exam" [level=1] [ref=e11]
        - paragraph [ref=e12]: Configure your exam settings and start practicing
      - button [ref=e13]:
        - img [ref=e14]
    - generic [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]: Number of Questions
        - generic [ref=e20]:
          - button "10" [ref=e21]
          - button "20" [ref=e22]
          - button "30" [ref=e23]
          - button "50" [ref=e24]
          - button "100" [ref=e25]
          - button "200 (Full)" [ref=e26]
      - generic [ref=e27]:
        - generic [ref=e28]: Content Source
        - generic [ref=e29]:
          - button "Random Shuffle Practice with randomized questions" [ref=e30]:
            - img [ref=e32]
            - generic [ref=e38]:
              - heading "Random Shuffle" [level=3] [ref=e39]
              - paragraph [ref=e40]: Practice with randomized questions
          - button "Web-Sourced Content Real-time news from tech and finance" [ref=e43]:
            - img [ref=e45]
            - generic [ref=e48]:
              - heading "Web-Sourced Content" [level=3] [ref=e49]
              - paragraph [ref=e50]: Real-time news from tech and finance
          - button "Self Import Upload your own PDF or text files" [ref=e52]:
            - img [ref=e54]
            - generic [ref=e57]:
              - heading "Self Import" [level=3] [ref=e58]
              - paragraph [ref=e59]: Upload your own PDF or text files
      - button "START EXAM" [active] [ref=e61]:
        - img [ref=e62]
        - text: START EXAM
  - generic [ref=e65]:
    - generic [ref=e66]:
      - heading "AI Configuration" [level=2] [ref=e67]:
        - img [ref=e68]
        - text: AI Configuration
      - button [ref=e71]:
        - img [ref=e72]
    - generic [ref=e75]:
      - generic [ref=e76]:
        - generic [ref=e77]: AI Provider
        - generic [ref=e78]:
          - button "Ollama" [ref=e79]:
            - img [ref=e80]
            - generic [ref=e83]: Ollama
          - button "Groq (Recommended - Fast ⚡)" [ref=e84]:
            - img [ref=e85]
            - generic [ref=e87]: Groq (Recommended - Fast ⚡)
      - generic [ref=e88]:
        - generic [ref=e89]: Model
        - combobox [ref=e90]:
          - option "Llama 3.1 70B (Fast)" [selected]
          - option "Llama 3.1 8B (Ultra Fast)"
          - option "Mixtral 8x7B"
          - option "Gemma 2 9B"
      - generic [ref=e91]:
        - generic [ref=e92]:
          - generic [ref=e93]: Groq (Recommended - Fast ⚡) API Key
          - link "Get Groq (Recommended - Fast ⚡) Key" [ref=e94] [cursor=pointer]:
            - /url: https://console.groq.com/keys
            - text: Get Groq (Recommended - Fast ⚡) Key
            - img [ref=e95]
        - textbox "Enter your Groq (Recommended - Fast ⚡) API Key" [ref=e98]: gsk_test_audit
        - paragraph [ref=e99]: Groq (Recommended - Fast ⚡) offers free tier with generous rate limits
    - button "GO! START PRACTICE" [ref=e101]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Smoke Test - 10 Questions (Robust Link Verification)', async ({ page }) => {
  4  |   page.on("console", msg => console.log("BROWSER LOG:", msg.text()));
  5  |   await page.goto('http://localhost:3000');
  6  |   
  7  |   // 1. Configure Settings with New Data Test ID
  8  |   await page.locator('.lucide-settings').first().click();
  9  |   await page.getByPlaceholder('Enter your Groq (Recommended - Fast ⚡) API Key').fill('gsk_test_audit');
  10 |   
  11 |   // Robust close using data-testid
  12 |   await page.getByTestId('close-settings').click();
  13 |   await expect(page.getByText('AI Configuration')).toBeHidden();
  14 |   
  15 |   // 2. Select 10 Questions
  16 |   await page.getByText('10', { exact: true }).click();
  17 |   await page.getByText('START EXAM').click();
  18 |   
  19 |   // 3. Verify Timer - 10 * 0.6 = 6:00
  20 |   const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
> 21 |   await expect(page.locator("h2")).toContainText("Listening", { timeout: 60000 });
     |                                    ^ Error: expect(locator).toContainText(expected) failed
  22 |   await expect(timer).toContainText('6:00', { timeout: 30000 });
  23 |   
  24 |   // 4. Verification Screenshot
  25 |   await page.screenshot({ path: 'smoke_10q_success.png', fullPage: true });
  26 |   console.log('SUCCESS: 10-Question Smoke Test Passed.');
  27 | });
  28 | 
```