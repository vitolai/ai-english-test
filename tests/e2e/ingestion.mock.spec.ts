import { test, expect } from '@playwright/test';
import { DashboardPage, ExamPage } from './pages';
import { MOCK_API_KEY, TEST_WEB_URL, TEST_PDF_PATH } from './fixtures';
import { ExamDataSchema } from '../contracts/exam.schema';

async function extractExamDataFromPage(page: import('@playwright/test').Page) {
  const el = page.locator('[data-exam-data]');
  await expect(el).toBeAttached({ timeout: 30_000 });
  const raw = await el.getAttribute('data-exam-data');
  expect(raw).toBeTruthy();
  return JSON.parse(raw!);
}

test.describe('E2E Ingestion — Mock Mode', () => {
  test.describe.configure({ retries: 0, timeout: 180_000 });

  // ────────────────────────────────────────────────────────────
  // WEB INGESTION
  // ────────────────────────────────────────────────────────────
  test.describe('Web URL Ingestion', () => {
    test('W1: Ingest web URL → generate 10-question exam', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'web', MOCK_API_KEY, TEST_WEB_URL);

      await dashboard.waitForLoadingStart().catch(() => {});
      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      const count = await exam.getQuestionCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('W2: Web ingestion → full exam flow (listening + reading → score)', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'web', MOCK_API_KEY, TEST_WEB_URL);

      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      await exam.answerAllListeningQuestions('C');
      await exam.goToReading();
      await expect(exam.readingHeader).toBeVisible();

      await exam.answerAllReadingQuestions('A');
      await exam.completeExam();

      const score = await exam.getScore();
      expect(score.total).toBe(10);
      expect(score.correct).toBeGreaterThanOrEqual(0);
      expect(score.correct).toBeLessThanOrEqual(10);
    });

    test('W3: Web ingestion → 20-question exam generates correctly', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(20, 'web', MOCK_API_KEY, TEST_WEB_URL);

      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      const count = await exam.getQuestionCount();
      expect(count).toBe(20);
    });

    test('W4: Web ingestion → exam data validates against ExamDataSchema', async ({ page }) => {
      const dashboard = new DashboardPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'web', MOCK_API_KEY, TEST_WEB_URL);
      await dashboard.waitForExamReady();

      const examData = await extractExamDataFromPage(page);

      const result = ExamDataSchema.safeParse(examData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBeTruthy();
        expect(result.data.questions.length).toBe(10);

        const listening = result.data.questions.filter((q) => q.type === 'listening');
        const reading = result.data.questions.filter((q) => q.type === 'reading');
        expect(listening.length).toBeGreaterThan(0);
        expect(reading.length).toBeGreaterThan(0);

        for (const q of result.data.questions) {
          expect(q.id).toBeGreaterThanOrEqual(1);
          expect(q.part).toBeGreaterThanOrEqual(1);
          expect(q.part).toBeLessThanOrEqual(7);
          expect(['listening', 'reading']).toContain(q.type);
          expect(q.options).toHaveLength(4);
          expect(q.options.every((opt: string) => opt.length > 0)).toBe(true);
          expect(['A', 'B', 'C', 'D']).toContain(q.answer);
          expect(q.question.length).toBeGreaterThan(0);
        }

        for (const q of listening) {
          expect(q.audio).toBeTruthy();
          expect(q.transcript).toBeTruthy();
        }

        for (const q of reading) {
          expect(q.audio).toBeFalsy();
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // PDF INGESTION
  // ────────────────────────────────────────────────────────────
  test.describe('PDF File Ingestion', () => {
    test('P1: Upload PDF → generate 10-question exam', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'self', MOCK_API_KEY, TEST_PDF_PATH);

      await dashboard.waitForLoadingStart().catch(() => {});
      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      const count = await exam.getQuestionCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('P2: PDF ingestion → full exam flow (listening + reading → score)', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'self', MOCK_API_KEY, TEST_PDF_PATH);

      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      await exam.answerAllListeningQuestions('B');
      await exam.goToReading();
      await expect(exam.readingHeader).toBeVisible();

      await exam.answerAllReadingQuestions('D');
      await exam.completeExam();

      const score = await exam.getScore();
      expect(score.total).toBe(10);
      expect(score.correct).toBeGreaterThanOrEqual(0);
      expect(score.correct).toBeLessThanOrEqual(10);
    });

    test('P3: PDF ingestion → 20-question exam generates correctly', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(20, 'self', MOCK_API_KEY, TEST_PDF_PATH);

      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      const count = await exam.getQuestionCount();
      expect(count).toBe(20);
    });

    test('P4: PDF ingestion → exam data validates against ExamDataSchema', async ({ page }) => {
      const dashboard = new DashboardPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'self', MOCK_API_KEY, TEST_PDF_PATH);
      await dashboard.waitForExamReady();

      const examData = await extractExamDataFromPage(page);

      const result = ExamDataSchema.safeParse(examData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBeTruthy();
        expect(result.data.questions.length).toBe(10);

        const listening = result.data.questions.filter((q) => q.type === 'listening');
        const reading = result.data.questions.filter((q) => q.type === 'reading');
        expect(listening.length).toBeGreaterThan(0);
        expect(reading.length).toBeGreaterThan(0);

        for (const q of result.data.questions) {
          expect(q.id).toBeGreaterThanOrEqual(1);
          expect(q.part).toBeGreaterThanOrEqual(1);
          expect(q.part).toBeLessThanOrEqual(7);
          expect(['listening', 'reading']).toContain(q.type);
          expect(q.options).toHaveLength(4);
          expect(q.options.every((opt: string) => opt.length > 0)).toBe(true);
          expect(['A', 'B', 'C', 'D']).toContain(q.answer);
          expect(q.question.length).toBeGreaterThan(0);
        }

        for (const q of listening) {
          expect(q.audio).toBeTruthy();
          expect(q.transcript).toBeTruthy();
        }

        for (const q of reading) {
          expect(q.audio).toBeFalsy();
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // RANDOM BASELINE (for comparison)
  // ────────────────────────────────────────────────────────────
  test.describe('Random Source Baseline', () => {
    test('R1: Random 10 questions → full exam flow', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      const exam = new ExamPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(10, 'random', MOCK_API_KEY);

      await dashboard.waitForExamReady();
      await expect(exam.listeningHeader).toBeVisible();

      await exam.answerAllListeningQuestions('A');
      await exam.goToReading();
      await expect(exam.readingHeader).toBeVisible();

      await exam.answerAllReadingQuestions('B');
      await exam.completeExam();

      const score = await exam.getScore();
      expect(score.total).toBe(10);
    });
  });

  // ────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ────────────────────────────────────────────────────────────
  test.describe('Error Handling', () => {
    test('E1: Missing API key shows error', async ({ page }) => {
      const dashboard = new DashboardPage(page);

      await dashboard.goto();
      await dashboard.selectQuestionCount(10);
      await dashboard.selectSource('random');

      await dashboard.startExamButton.click();
      await page.waitForSelector('h2:has-text("AI Configuration")');

      const apiKeyInput = page.locator('input[placeholder*="API Key"], input[placeholder*="OpenClaw"], input[placeholder*="sk-or"], input[placeholder*="gsk_"]').first();
      await apiKeyInput.fill('');
      await dashboard.goStartButton.click();

      await page.waitForSelector('text=No API Key provided', { timeout: 10_000 });
      await expect(page.locator('text=No API Key provided')).toBeVisible();
    });

    test('E2: Invalid web URL triggers error', async ({ page }) => {
      const dashboard = new DashboardPage(page);

      await dashboard.goto();
      await dashboard.startExamWithMockKey(
        10,
        'web',
        MOCK_API_KEY,
        'https://this-domain-does-not-exist-12345.invalid/',
      );

      await page.waitForSelector('text=Generation Failed', { timeout: 60_000 });
      await expect(page.locator('text=Generation Failed')).toBeVisible();
    });
  });
});
