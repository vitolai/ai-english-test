import { test, expect } from '@playwright/test';

test('Audit Generation Network Flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  // 2. Trigger Action
  await page.locator('button').filter({ has: page.locator('.lucide-settings') }).click();
  await page.getByPlaceholder('Enter your Cloud API Key').fill('sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'); // Simulate long key
  await page.getByText('GO! START PRACTICE').click();

  // 3. Wait for progress
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'audit_network_state.png' });
});
