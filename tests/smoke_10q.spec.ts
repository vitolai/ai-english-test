import { test, expect } from '@playwright/test';
test('Final Baseline', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByText('10', { exact: true }).click();
  await page.getByText('Random Shuffle').click();
  await page.getByRole('button', { name: /START EXAM|GO! START PRACTICE/ }).click();
  await expect(page.locator('h2')).toContainText('Listening', { timeout: 30000 });
  await page.screenshot({ path: 'smoke_10q_real_pass.png' });
});
