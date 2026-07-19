import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(_config: FullConfig) {
  console.log('🔧 Global Setup: Starting test environment...');
  
  // Ensure test results directory exists
  const resultsDir = path.resolve(process.cwd(), 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Check if server is running (for E2E tests)
  if (process.env.BASE_URL) {
    try {
      await fetch(process.env.BASE_URL, { method: 'HEAD' });
      console.log(`✅ Server is running at ${process.env.BASE_URL}`);
    } catch {
      console.warn(`⚠️  Server not reachable at ${process.env.BASE_URL}. E2E tests may fail.`);
    }
  }

  console.log('🔧 Global Setup: Complete');
}

export default globalSetup;
