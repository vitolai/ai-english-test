import { test, expect } from '@playwright/test';

test('Capture Exam View After Start', async ({ page }) => {
  page.setDefaultTimeout(120000);
  await page.goto('http://localhost:3000');
  
  // 1. Open Settings
  await page.locator('button').filter({ has: page.locator('.lucide-settings') }).first().click();
  
  // 2. Fill Key
  await page.getByPlaceholder('Enter your Cloud API Key').fill('audit-test-key-valid-length-12345');
  
  // 3. Close Settings (CRITICAL FIX)
  // Look for the X button or click outside
  await page.locator('button').filter({ has: page.locator('.lucide-x') }).click();
  
  // 4. Start 10-question exam
  await page.locator('button').filter({ hasText: /^10$/ }).click();
  await page.getByText('GO! START PRACTICE').click();
  
  console.log('Waiting for Exam View to mount...');
  // 5. Wait for the Exam H2 title Listening
  await expect(page.locator('h2')).toContainText('Listening', { timeout: 90000 });
  
  // 6. Final UI Proof
  await page.waitForTimeout(3000); 
  await page.screenshot({ path: 'exam_view_proof.png', fullPage: true });
  console.log('Success! Screenshot saved.');
});
