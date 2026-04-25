import { test, expect } from '@playwright/test';

test('Final Network Loop Test', async ({ page }) => {
  // Use the Tailscale IP to simulate external access
  const tailscaleIp = '100.91.227.59';
  await page.goto(`http://${tailscaleIp}:3000`);
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  // Open Settings
  await page.locator('button').filter({ has: page.locator('.lucide-settings') }).click();
  
  // Fill Key (Passes new validation)
  await page.getByPlaceholder('Enter your Cloud API Key').fill('test-key-123-long-enough');
  
  // Start
  await page.getByText('GO! START PRACTICE').click();
  
  // Check for the Red Network Error box specifically
  const errorBox = page.locator('div.bg-red-50');
  const isError = await errorBox.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (isError) {
    const errorText = await errorBox.innerText();
    console.log('FAIL: Network Error Box Detected:', errorText);
  } else {
    console.log('SUCCESS: No immediate network error box.');
    // Check if progress bar appeared
    await expect(page.getByText('Exam Generation')).toBeVisible({ timeout: 10000 });
  }
  
  await page.screenshot({ path: 'final_verification.png' });
});
