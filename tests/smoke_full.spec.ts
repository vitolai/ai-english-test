import { test, expect } from '@playwright/test';

test('TOEIC Full Loop - 10 Qs', async ({ page }) => {
  page.setDefaultTimeout(60000);
  await page.goto('http://localhost:3000');
  
  // 1. Check Dashboard
  await expect(page.locator('h1')).toContainText('TOEIC');
  
  // 2. Select 10 questions
  await page.locator('button').filter({ hasText: /^10$/ }).click();
  
  // 3. Open Settings
  await page.locator('button').filter({ has: page.locator('.lucide-settings') }).click();
  
  // 4. Input Test Key
  await page.getByPlaceholder('Enter your Cloud API Key').fill('TEST-KEY-123');
  await page.getByText('GO! START PRACTICE').click();
  
  // 5. Verify Exam View
  await expect(page.locator('h2')).toContainText('Listening', { timeout: 20000 });
  
  // 6. Verify Timer (06:00)
  const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  await expect(timer).toContainText('06:00');
  
  console.log('SUCCESS: 10 Qs = 06:00 Timer Verified');
  await page.screenshot({ path: 'smoke_exam_view_success.png' });
});
