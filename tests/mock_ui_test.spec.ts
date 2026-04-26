import { test, expect } from '@playwright/test';

test('Isolated UI Mock Test - 10 Qs', async ({ page }) => {
  // 1. Visit the app
  await page.goto('http://localhost:3000');
  
  // 2. Open Settings and Input 'TEST-MOCK-AUDIT'
  await page.locator('button').filter({ has: page.locator('.lucide-settings') }).first().click();
  await page.getByPlaceholder('Enter your Cloud API Key').fill('audit-mock-key');
  await page.locator('button').filter({ has: page.locator('.lucide-x') }).click();
  
  // 3. We will intercept the /api/generate call and return a MOCK 10-question set
  await page.route('**/api/generate', async route => {
    const json = {
      session_id: 'mock-session-123',
      data: {
        title: 'Mock TOEIC Exam',
        questions: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          part: i === 0 ? 1 : 2,
          type: i < 5 ? 'listening' : 'reading',
          question: 'Mock Question ' + (i + 1),
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          answer: 'A',
          transcript: 'This is a mock transcript for audit verification.',
          image: i === 0 ? 'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=800' : undefined
        }))
      }
    };
    await route.fulfill({ json });
  });

  // 4. Trigger Start
  await page.locator('button').filter({ hasText: /^10$/ }).click();
  await page.getByText('GO! START PRACTICE').click();
  
  // 5. Verify UI Layout without live API calls
  await expect(page.locator('h2')).toContainText('Listening');
  
  // Verify Timer: 10 Qs * 0.6 min = 6:00
  const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  await expect(timer).toContainText('06:00');
  
  // Verify Transcript Overlay
  await expect(page.getByText('[AUDIT TRANSCRIPT]:')).toBeVisible();
  
  await page.screenshot({ path: 'mock_ui_verification.png', fullPage: true });
  console.log('SUCCESS: UI Module Verified with Mock Data.');
});
