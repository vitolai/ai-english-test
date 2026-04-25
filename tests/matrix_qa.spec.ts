import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_URL = 'https://www.reuters.com/';
const PDF_PATH = path.resolve(__dirname, '../test-assets/nvidia_report.pdf');

const runTest = async (page: any, source: string, model = 'default') => {
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
  
  await page.goto(baseUrl);
  
  // 1. Configure Settings
  await page.click('button.p-3.bg-slate-100.rounded-xl');
  
  if (model === 'custom') {
    await page.selectOption('select', 'custom');
    await page.getByPlaceholder('Enter model name').fill('gemini-3-flash-preview:cloud');
  } else {
    // Keep default: nemotron-3-super:cloud
  }
  
  // Fill API Key from the provided record (not hardcoded in the component itself)
  await page.getByPlaceholder("Enter 'test' for Offline Mock Mode").fill('012dfb40f5784a32b1a9d9ad559e9648.zpIv3ACqQY3EZUMmGO8Ig6H7');
  
  await page.click('button:has-text("GO! START PRACTICE")');
  await expect(page.locator('text=AI Configuration')).not.toBeVisible();
  
  // 2. Select Source
  if (source === 'web') {
    await page.click('button:has-text("Web-Sourced Content")');
    await page.locator('#web-ingest-url').fill(WEB_URL);
  } else if (source === 'self') {
    await page.click('button:has-text("Self Import")');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PDF_PATH);
  } else {
    await page.click('button:has-text("Random Shuffle")');
  }
  
  // 3. Start 10-Question Exam
  await page.click('button:has-text("10")');
  await page.click('#start-exam-button');
  
  // 4. Verification: Exam Starts (Increase timeout for AI)
  await expect(page.locator('h1')).toContainText('Listening Comprehension', { timeout: 180000 });
  
  // 5. Verify Audio Button
  const playButton = page.locator('.lucide-play').first();
  await expect(playButton).toBeVisible();
  await playButton.click();
  await expect(page.locator('.bg-blue-600.animate-pulse')).toBeVisible({ timeout: 15000 });
  
  // 6. Transition to Reading
  await page.click('button:has-text("GO TO READING SECTION")');
  await expect(page.locator('h1')).toContainText('Reading Test');
  
  // 7. Complete Exam
  await page.click('button:has-text("COMPLETE & SEE SCORE")');
  await expect(page.locator('h2')).toContainText('Exam Completed!');
};

test.describe('TOEIC v0.3.1 - Standardized Matrix Validation', () => {
  test('A1: Random + Default Model', async ({ page }) => {
    await runTest(page, 'random', 'default');
  });

  test('B1: Web + Default Model', async ({ page }) => {
    await runTest(page, 'web', 'default');
  });

  test('C1: Import + Default Model', async ({ page }) => {
    await runTest(page, 'self', 'default');
  });

  test('A2: Random + Custom Model', async ({ page }) => {
    await runTest(page, 'random', 'custom');
  });

  test('B2: Web + Custom Model', async ({ page }) => {
    await runTest(page, 'web', 'custom');
  });

  test('C2: Import + Custom Model', async ({ page }) => {
    await runTest(page, 'self', 'custom');
  });
});
