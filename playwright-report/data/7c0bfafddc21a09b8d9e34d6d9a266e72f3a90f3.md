# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke_full.spec.ts >> TOEIC Full Loop - 10 Qs
- Location: tests/smoke_full.spec.ts:3:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h2')
Expected substring: "Listening"
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 20000ms
  - waiting for locator('h2')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e6]:
    - img [ref=e8]
    - generic [ref=e11]:
      - paragraph [ref=e12]: Generation Failed
      - paragraph [ref=e13]: "Invalid API Key: Key is too short to be valid. Please check your credentials in Settings."
      - button "DISMISS & TRY AGAIN" [ref=e14]
    - button [ref=e15]:
      - img [ref=e16]
  - generic [ref=e22]:
    - generic [ref=e23]:
      - generic [ref=e24]:
        - heading "TOEIC Practice Exam" [level=1] [ref=e25]
        - paragraph [ref=e26]: Configure your exam settings and start practicing
      - button [ref=e27]:
        - img [ref=e28]
    - generic [ref=e31]:
      - generic [ref=e32]:
        - generic [ref=e33]: Number of Questions
        - generic [ref=e34]:
          - button "10" [ref=e35]
          - button "20" [ref=e36]
          - button "30" [ref=e37]
          - button "50" [ref=e38]
          - button "100" [ref=e39]
          - button "200 (Full)" [ref=e40]
      - generic [ref=e41]:
        - generic [ref=e42]: Content Source
        - generic [ref=e43]:
          - button "Random Shuffle Practice with randomized questions" [ref=e44]:
            - img [ref=e46]
            - generic [ref=e52]:
              - heading "Random Shuffle" [level=3] [ref=e53]
              - paragraph [ref=e54]: Practice with randomized questions
          - button "Web-Sourced Content Real-time news from tech and finance" [ref=e57]:
            - img [ref=e59]
            - generic [ref=e62]:
              - heading "Web-Sourced Content" [level=3] [ref=e63]
              - paragraph [ref=e64]: Real-time news from tech and finance
          - button "Self Import Upload your own PDF or text files" [ref=e66]:
            - img [ref=e68]
            - generic [ref=e71]:
              - heading "Self Import" [level=3] [ref=e72]
              - paragraph [ref=e73]: Upload your own PDF or text files
      - button "START EXAM" [ref=e75]:
        - img [ref=e76]
        - text: START EXAM
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('TOEIC Full Loop - 10 Qs', async ({ page }) => {
  4  |   page.setDefaultTimeout(60000);
  5  |   await page.goto('http://localhost:3000');
  6  |   
  7  |   // 1. Check Dashboard
  8  |   await expect(page.locator('h1')).toContainText('TOEIC');
  9  |   
  10 |   // 2. Select 10 questions
  11 |   await page.locator('button').filter({ hasText: /^10$/ }).click();
  12 |   
  13 |   // 3. Open Settings
  14 |   await page.locator('button').filter({ has: page.locator('.lucide-settings') }).click();
  15 |   
  16 |   // 4. Input Test Key
  17 |   await page.getByPlaceholder('Enter your Cloud API Key').fill('TEST-KEY-123');
  18 |   await page.getByText('GO! START PRACTICE').click();
  19 |   
  20 |   // 5. Verify Exam View
> 21 |   await expect(page.locator('h2')).toContainText('Listening', { timeout: 20000 });
     |                                    ^ Error: expect(locator).toContainText(expected) failed
  22 |   
  23 |   // 6. Verify Timer (06:00)
  24 |   const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  25 |   await expect(timer).toContainText('06:00');
  26 |   
  27 |   console.log('SUCCESS: 10 Qs = 06:00 Timer Verified');
  28 |   await page.screenshot({ path: 'smoke_exam_view_success.png' });
  29 | });
  30 | 
```