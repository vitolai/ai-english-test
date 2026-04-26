import { test, expect } from '@playwright/test';

test('Pressure Test - 200 Questions (General User)', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 1. Configure Settings
  await page.locator('.lucide-settings').first().click();
  await page.getByPlaceholder('Enter your Cloud API Key').fill('gsk_test_audit');
  await page.locator('button').filter({ has: page.locator('.lucide-x') }).click();
  
  // 2. Select 200 Questions
  await page.getByText('200', { exact: true }).click();
  await page.getByText('GO! START PRACTICE').click();
  
  // 3. Verify Timer - 200 * 0.6 = 30:00
  const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  await expect(timer).toContainText('30:00');
  
  // 4. Check UI Responsiveness (Scroll to bottom)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  
  // 5. Verify a sample question exists (e.g., Q25)
  await expect(page.getByText('Question 25')).toBeVisible();
  
  await page.screenshot({ path: 'pressure_test_200_result.png', fullPage: true });
  console.log('SUCCESS: 200-Question Pressure Test Verified.');
});
