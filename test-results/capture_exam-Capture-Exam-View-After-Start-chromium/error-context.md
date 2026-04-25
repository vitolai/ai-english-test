# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: capture_exam.spec.ts >> Capture Exam View After Start
- Location: tests/capture_exam.spec.ts:3:1

# Error details

```
TimeoutError: locator.click: Timeout 120000ms exceeded.
Call log:
  - waiting for getByText('GO! START PRACTICE')

```

# Page snapshot

```yaml
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
        - button "10" [active] [ref=e21]
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
    - button "START EXAM" [ref=e61]:
      - img [ref=e62]
      - text: START EXAM
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Capture Exam View After Start', async ({ page }) => {
  4  |   page.setDefaultTimeout(120000);
  5  |   await page.goto('http://localhost:3000');
  6  |   
  7  |   // 1. Open Settings
  8  |   await page.locator('button').filter({ has: page.locator('.lucide-settings') }).first().click();
  9  |   
  10 |   // 2. Fill Key
  11 |   await page.getByPlaceholder('Enter your Cloud API Key').fill('audit-test-key-valid-length-12345');
  12 |   
  13 |   // 3. Close Settings (CRITICAL FIX)
  14 |   // Look for the X button or click outside
  15 |   await page.locator('button').filter({ has: page.locator('.lucide-x') }).click();
  16 |   
  17 |   // 4. Start 10-question exam
  18 |   await page.locator('button').filter({ hasText: /^10$/ }).click();
> 19 |   await page.getByText('GO! START PRACTICE').click();
     |                                              ^ TimeoutError: locator.click: Timeout 120000ms exceeded.
  20 |   
  21 |   console.log('Waiting for Exam View to mount...');
  22 |   // 5. Wait for the Exam H2 title Listening
  23 |   await expect(page.locator('h2')).toContainText('Listening', { timeout: 90000 });
  24 |   
  25 |   // 6. Final UI Proof
  26 |   await page.waitForTimeout(3000); 
  27 |   await page.screenshot({ path: 'exam_view_proof.png', fullPage: true });
  28 |   console.log('Success! Screenshot saved.');
  29 | });
  30 | 
```