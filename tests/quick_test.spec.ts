import { test, expect } from '@playwright/test';

test('Provider Toggle Test', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.locator('h1')).toContainText('TOEIC Practice Exam');
  
  // Open settings
  await page.click('button:has(svg.lucide-settings)');
  await expect(page.locator('h2:has-text("AI Configuration")')).toBeVisible();
  
  // Check provider buttons exist
  await expect(page.locator('button:has-text("Ollama")')).toBeVisible();
  await expect(page.locator('button:has-text("Groq")')).toBeVisible();
  
  // Click Groq
  await page.click('button:has-text("Groq")');
  await expect(page.locator('text=Groq API Key')).toBeVisible();
  
  console.log('Provider toggle test passed!');
});