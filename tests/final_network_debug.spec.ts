import { test, expect } from '@playwright/test';

test('Deep Network Debug', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  // Open settings
  await page.locator('button').filter({ has: page.locator('.lucide-settings') }).click();
  
  // Input short key and ensure endpoint is clearly 'http://localhost:3001' (backend)
  // Actually, the App.tsx sends request to API_BASE = 'http://localhost:3001'
  await page.getByPlaceholder('Enter your Cloud API Key').fill('test-key');
  await page.getByText('GO! START PRACTICE').click();

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'final_network_debug.png' });
});
