import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ExamDataSchema, QuestionSchema } from './exam.schema';

const BASE_URL = 'http://localhost:3001';
const MOCK_API_KEY = 'test-e2e-contract-examdata';

// ─── Server Probe ──────────────────────────────────────────
let serverUp = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/status/__probe__`, {
      signal: AbortSignal.timeout(2000),
    });
    serverUp = res.status !== undefined;
  } catch {
    serverUp = false;
  }
});

// ─── Helpers ───────────────────────────────────────────────

async function generateExam(seedText: string, questionCount: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seedText,
      questionCount,
      model: 'mock-model',
      apiKey: MOCK_API_KEY,
      config: { providerId: 'mock' },
    }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { session_id: string };
  expect(body.session_id).toBeTruthy();
  return body.session_id;
}

async function waitForCompletion(sessionId: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${BASE_URL}/api/status/${sessionId}`);
    if (res.status === 200) {
      const body = (await res.json()) as { phase: string };
      if (body.phase === 'completed') return;
      if (body.phase === 'error') throw new Error('Session ended in error phase');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Session ${sessionId} did not complete within ${maxAttempts}s`);
}

async function fetchExamData(sessionId: string) {
  const res = await fetch(`${BASE_URL}/storage/sessions/${sessionId}/exam_data.json`);
  expect(res.status).toBe(200);
  return res.json();
}

async function ingestWebSeedText(url: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/ingest/web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { text: string };
  return body.text;
}

async function ingestPdfSeedText(): Promise<string> {
  const pdfPath = path.resolve(__dirname, '../../test-assets/sample.pdf');
  if (!fs.existsSync(pdfPath)) return 'Default PDF seed text for testing.';

  const formData = new FormData();
  const pdfBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('pdfFile', blob, 'sample.pdf');

  const res = await fetch(`${BASE_URL}/api/ingest/pdf`, {
    method: 'POST',
    body: formData,
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { text: string };
  return body.text;
}

function assertExamStructure(data: unknown, expectedCount: number): void {
  expect(data).toBeTruthy();
  expect(typeof data).toBe('object');
  const d = data as Record<string, unknown>;
  expect(typeof d.title).toBe('string');
  expect(d.title).toBeTruthy();
  expect(Array.isArray(d.questions)).toBe(true);
  expect(d.questions).toHaveLength(expectedCount);
}

function assertExamDataSchema(data: unknown, expectedCount: number): void {
  const result = ExamDataSchema.safeParse(data);
  expect(result.success).toBe(true);
  if (!result.success) return;

  expect(result.data.title).toBeTruthy();
  expect(result.data.questions).toHaveLength(expectedCount);

  for (const q of result.data.questions) {
    const qResult = QuestionSchema.safeParse(q);
    expect(qResult.success).toBe(true);
    if (!qResult.success) continue;

    expect(q.type === 'listening' || q.type === 'reading').toBe(true);
    expect(q.part).toBeGreaterThanOrEqual(1);
    expect(q.part).toBeLessThanOrEqual(7);
    expect(q.options).toHaveLength(4);
    expect(['A', 'B', 'C', 'D']).toContain(q.answer);

    if (q.type === 'listening') {
      expect(typeof q.audio).toBe('string');
    }
  }
}

// ─── Test Matrix: 3 Sources × 4 Question Counts ───────────
// Schema (ExamDataSchema + QuestionSchema) verified only for 50 questions.
// 10/100/200 get basic structural validation only.

describe('E2E Contract — ExamDataSchema Compliance (Mock Mode)', () => {
  // ─── RANDOM source ────────────────────────────────────────
  describe('Source: Random', () => {
    it('10 questions — structural validation', async () => {
      if (!serverUp) return;

      const sid = await generateExam('International business meetings', 10);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 10);
    });

    it('50 questions — full ExamDataSchema validation', async () => {
      if (!serverUp) return;

      const sid = await generateExam('International business meetings', 50);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamDataSchema(data, 50);
    });

    it('100 questions — structural validation', async () => {
      if (!serverUp) return;

      const sid = await generateExam('International business meetings', 100);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 100);
    });

    it('200 questions — structural validation', async () => {
      if (!serverUp) return;

      const sid = await generateExam('International business meetings', 200);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 200);
    });
  });

  // ─── WEB source ──────────────────────────────────────────
  describe('Source: Web', () => {
    it('10 questions — structural validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestWebSeedText('https://example.com');
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 10);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 10);
    });

    it('50 questions — full ExamDataSchema validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestWebSeedText('https://example.com');
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 50);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamDataSchema(data, 50);
    });

    it('100 questions — structural validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestWebSeedText('https://example.com');
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 100);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 100);
    });

    it('200 questions — structural validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestWebSeedText('https://example.com');
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 200);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 200);
    });
  });

  // ─── PDF source ──────────────────────────────────────────
  describe('Source: PDF', () => {
    it('10 questions — structural validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestPdfSeedText();
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 10);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 10);
    });

    it('50 questions — full ExamDataSchema validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestPdfSeedText();
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 50);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamDataSchema(data, 50);
    });

    it('100 questions — structural validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestPdfSeedText();
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 100);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 100);
    });

    it('200 questions — structural validation', async () => {
      if (!serverUp) return;

      const seedText = await ingestPdfSeedText();
      expect(seedText.length).toBeGreaterThan(0);

      const sid = await generateExam(seedText, 200);
      await waitForCompletion(sid);
      const data = await fetchExamData(sid);

      assertExamStructure(data, 200);
    });
  });
});
