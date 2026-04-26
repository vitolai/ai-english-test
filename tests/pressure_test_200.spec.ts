import { test, expect } from '@playwright/test';

test('Pressure Test - 200 Questions (General User)', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 1. Configure Settings
  await page.locator('.lucide-settings').first().click();
  await page.getByPlaceholder('Enter your Groq (Recommended - Fast ⚡) API Key').fill('gsk_test_audit');
  
  // Robust close using Escape and waiting for overlay to clear
  await page.keyboard.press('Escape');
  await expect(page.getByText('AI Configuration')).toBeHidden();
  
  // 2. Select 200 Questions
  await page.getByText('200', { exact: true }).click();
  await page.getByText('START EXAM').click();
  
  // 3. Verify Timer - 200 * 0.6 = 120:00 (increased timeout for AI generation)
  const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  await expect(timer).toContainText('120:00', { timeout: 150000 });
  
  // 4. Check UI Responsiveness
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  
  // 5. Verify a sample question exists (e.g., Q25)
  await expect(page.getByText('Question 25')).toBeVisible();
  
  await page.screenshot({ path: 'pressure_test_200_result.png', fullPage: true });
  console.log('SUCCESS: 200-Question Pressure Test Verified.');
});
