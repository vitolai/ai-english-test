import { test, expect } from '@playwright/test';

test('Smoke Test - Home Page Loads', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Dashboard H1 check
  const h1 = page.locator('h1');
  await expect(h1).toBeVisible({ timeout: 15000 });
  
  console.log('Final Title:', await h1.innerText());
  await page.screenshot({ path: 'smoke_dashboard_fixed.png' });
});
