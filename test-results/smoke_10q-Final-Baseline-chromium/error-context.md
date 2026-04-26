# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke_10q.spec.ts >> Final Baseline
- Location: tests/smoke_10q.spec.ts:2:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h2')
Expected substring: "Listening"
Received string:    "AI Configuration"
Timeout: 30000ms

Call log:
  - Expect "toContainText" with timeout 30000ms
  - waiting for locator('h2')
    34 × locator resolved to <h2 class="text-2xl font-black text-slate-800 flex items-center gap-3">…</h2>
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
          - button "Groq" [ref=e84]:
            - img [ref=e85]
            - generic [ref=e87]: Groq
      - generic [ref=e88]:
        - generic [ref=e89]: Model
        - combobox [ref=e90]:
          - option "ollama/nemotron-3-super:cloud" [selected]
          - option "ollama/minimax-m2.7:cloud"
          - option "ollama/deepseek-v3.1:671b-cloud"
          - option "ollama/qwen3-coder:480b-cloud"
          - option "Custom..."
      - generic [ref=e91]:
        - generic [ref=e92]: API Endpoint
        - textbox "http://localhost:11434/v1/chat/completions" [ref=e93]
      - generic [ref=e94]:
        - generic [ref=e95]:
          - generic [ref=e96]: Ollama API Key
          - link "Get Ollama" [ref=e97] [cursor=pointer]:
            - /url: https://ollama.com/
            - text: Get Ollama
            - img [ref=e98]
        - generic [ref=e101]:
          - textbox "Enter your Cloud API Key" [ref=e102]
          - button [ref=e103]:
            - img [ref=e104]
    - button "GO! START PRACTICE" [ref=e108]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | test('Final Baseline', async ({ page }) => {
  3  |   await page.goto('http://localhost:3000');
  4  |   await page.getByText('10', { exact: true }).click();
  5  |   await page.getByText('Random Shuffle').click();
  6  |   await page.getByRole('button', { name: /START EXAM|GO! START PRACTICE/ }).click();
> 7  |   await expect(page.locator('h2')).toContainText('Listening', { timeout: 30000 });
     |                                    ^ Error: expect(locator).toContainText(expected) failed
  8  |   await page.screenshot({ path: 'smoke_10q_real_pass.png' });
  9  | });
  10 | 
```