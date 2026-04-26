# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pressure_test_100.spec.ts >> Pressure Test - 100 Questions (General User)
- Location: tests/pressure_test_100.spec.ts:3:1

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.click: Test timeout of 180000ms exceeded.
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
        - button "10" [ref=e21]
        - button "20" [ref=e22]
        - button "30" [ref=e23]
        - button "50" [ref=e24]
        - button "100" [active] [ref=e25]
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
  3  | test('Pressure Test - 100 Questions (General User)', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000');
  5  |   
  6  |   // 1. Configure Settings
  7  |   await page.locator('.lucide-settings').first().click();
  8  |   await page.getByPlaceholder('Enter your Groq (Recommended - Fast ⚡) API Key').fill('gsk_test_audit');
  9  |   await page.locator('button').filter({ has: page.locator('.lucide-x') }).click();
  10 |   
  11 |   // 2. Select 100 Questions
  12 |   await page.getByText('100', { exact: true }).click();
> 13 |   await page.getByText('GO! START PRACTICE').click();
     |                                              ^ Error: locator.click: Test timeout of 180000ms exceeded.
  14 |   
  15 |   // 3. Verify Timer - 100 * 0.6 = 30:00
  16 |   const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  17 |   await expect(timer).toContainText('30:00');
  18 |   
  19 |   // 4. Check UI Responsiveness (Scroll to bottom)
  20 |   await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  21 |   
  22 |   // 5. Verify a sample question exists (e.g., Q25)
  23 |   await expect(page.getByText('Question 25')).toBeVisible();
  24 |   
  25 |   await page.screenshot({ path: 'pressure_test_100_result.png', fullPage: true });
  26 |   console.log('SUCCESS: 100-Question Pressure Test Verified.');
  27 | });
  28 | 
```