import { test, expect } from '@playwright/test';

test('Smoke Test - 10 Questions (Robust Link Verification)', async ({ page }) => {
  page.on("console", msg => console.log("BROWSER LOG:", msg.text()));
  await page.goto('http://localhost:3000');
  
  // 1. Configure Settings with New Data Test ID
  await page.locator('.lucide-settings').first().click();
  await page.getByPlaceholder('Enter your Groq (Recommended - Fast ⚡) API Key').fill('gsk_test_audit');
  
  // Robust close using data-testid
  await page.getByTestId('close-settings').click();
  await expect(page.getByText('AI Configuration')).toBeHidden();
  
  // 2. Select 10 Questions
  await page.getByText('10', { exact: true }).click();
  await page.getByText('START EXAM').click();
  
  // 3. Verify Timer - 10 * 0.6 = 6:00
  const timer = page.locator('div').filter({ has: page.locator('.lucide-clock') }).last();
  await expect(page.locator("h2")).toContainText("Listening", { timeout: 60000 });
  await expect(timer).toContainText('6:00', { timeout: 30000 });
  
  // 4. Verification Screenshot
  await page.screenshot({ path: 'smoke_10q_success.png', fullPage: true });
  console.log('SUCCESS: 10-Question Smoke Test Passed.');
});
