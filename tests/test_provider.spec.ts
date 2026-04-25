import { test, expect } from '@playwright/test';

test('Groq Provider Selection Test', async ({ page }) => {
  // Note: This test just verifies the UI elements for provider selection
  // Actual API calls would require valid API keys
  
  await page.goto('http://localhost:5174');
  
  // 1. Dashboard loads
  await expect(page.locator('h1')).toContainText('TOEIC Practice Exam');
  
  // 2. Open Settings
  await page.click('button:has(svg.lucide-settings)');
  await expect(page.locator('h2:has-text("AI Configuration")')).toBeVisible();
  
  // 3. Check for Provider buttons (Ollama and Groq)
  const ollamaBtn = page.locator('button:has-text("Ollama")');
  const groqBtn = page.locator('button:has-text("Groq")');
  
  await expect(ollamaBtn).toBeVisible();
  await expect(groqBtn).toBeVisible();
  
  // 4. Default is Ollama - check Ollama fields are visible
  await expect(page.locator('text=Ollama API Key')).toBeVisible();
  await expect(page.locator('select').first()).toBeVisible(); // Model selector
  
  // 5. Click Groq provider
  await groqBtn.click();
  
  // 6. Check Groq fields appear
  await expect(page.locator('text=Groq API Key')).toBeVisible();
  await expect(page.locator('text=Groq offers free tier')).toBeVisible();
  
  // 7. Switch back to Ollama
  await ollamaBtn.click();
  
  // 8. Check Ollama fields are back
  await expect(page.locator('text=Ollama API Key')).toBeVisible();
  
  console.log('Provider toggle UI test passed!');
});