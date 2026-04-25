import { test, expect } from '@playwright/test';

test('TOEIC Smoke Test (v0.3.1)', async ({ page }) => {
  const apiKey = '012dfb40f5784a32b1a9d9ad559e9648.zpIv3ACqQY3EZUMmGO8Ig6H7';
  
  await page.goto('http://localhost:5173');
  
  // 1. Dashboard
  await expect(page.locator('h1')).toContainText('TOEIC Practice Exam');
  
  // 2. Settings
  await page.click('button:has(svg.lucide-settings)');
  await page.fill('input[placeholder*="API Key"]', apiKey);
  await page.click('button:has-text("GO! START PRACTICE")');
  
  // 3. Wait for generation to complete - wait for loading to disappear
  console.log('Waiting for exam generation...');
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return !text.includes('Exam Generation') && !text.includes('COMPLETE');
  }, { timeout: 120000 });
  
  console.log('Generation complete, checking exam content...');
  
  // 4. Verify Part 1 exists
  await expect(page.locator('h4').first()).toContainText('Part 1');
  
  // 5. Play button visible  
  await expect(page.locator('.lucide-play').first()).toBeVisible();
  
  // 6. Reading section (if exists)
  const hasReadingBtn = await page.locator('button:has-text("GO TO READING SECTION")').count() > 0;
  if (hasReadingBtn) {
    await page.click('button:has-text("GO TO READING SECTION")');
    await expect(page.locator('h1')).toContainText('Reading Test');
  }
  
  // 7. Complete exam
  const hasCompleteBtn = await page.locator('button:has-text("COMPLETE & SEE SCORE")').count() > 0;
  if (hasCompleteBtn) {
    await page.click('button:has-text("COMPLETE & SEE SCORE")');
    await expect(page.locator('h2')).toContainText('Exam Completed');
  }
  
  console.log('All tests passed!');
});