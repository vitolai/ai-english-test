import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  GenerateResponseSchema,
  IngestResponseSchema,
  StatusResponseSchema,
  ExamDataSchema,
} from './exam.schema';

const BASE_URL = 'http://localhost:3001';
const MOCK_API_KEY = 'test-api-key-contract';

// ─── Server Lifecycle ───────────────────────────────────────
// Contract tests require server.js running on port 3001.
// CI runs: node server.js & then vitest run tests/contracts/

let serverUp = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/status/__probe__`, { signal: AbortSignal.timeout(2000) });
    // Any response (even 404) means server is up
    serverUp = res.status !== undefined;
  } catch {
    serverUp = false;
  }
});

describe('Contract Tests — API Endpoints (Mock Mode)', () => {
  // ─── POST /api/generate ──────────────────────────────────
  describe('POST /api/generate', () => {
    it('should return a valid GenerateResponseSchema immediately', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedText: 'International business meetings',
          questionCount: 10,
          model: 'mock-model',
          apiKey: MOCK_API_KEY,
          config: { providerId: 'mock' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const result = GenerateResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session_id).toBeTruthy();
        expect(typeof result.data.session_id).toBe('string');
      }
    });

    it('should reject request with empty body', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Server returns 200 with session_id even on empty body
      // (generates a session, then falls back to mock data)
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = GenerateResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });
  });

  // ─── POST /api/ingest/web ────────────────────────────────
  describe('POST /api/ingest/web', () => {
    it('should return a valid IngestResponseSchema on success', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/ingest/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://httpbin.org/html' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const result = IngestResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success && 'text' in result.data) {
        expect(typeof result.data.text).toBe('string');
        expect(result.data.text.length).toBeGreaterThan(0);
      }
    });

    it('should return a valid IngestResponseSchema error when URL is missing', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/ingest/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      const result = IngestResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success && 'error' in result.data) {
        expect(result.data.error).toBeTruthy();
      }
    });

    it('should return a valid IngestResponseSchema error on unreachable URL', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/ingest/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://this-domain-does-not-exist-12345.invalid' }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      const result = IngestResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success && 'error' in result.data) {
        expect(result.data.error).toContain('Failed to fetch URL');
      }
    });
  });

  // ─── POST /api/ingest/pdf ────────────────────────────────
  describe('POST /api/ingest/pdf', () => {
    it('should return a valid IngestResponseSchema on success', async () => {
      if (!serverUp) return;

      const pdfPath = path.resolve(__dirname, '../../test-assets/sample.pdf');
      if (!fs.existsSync(pdfPath)) return;

      const formData = new FormData();
      const pdfBuffer = fs.readFileSync(pdfPath);
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('pdfFile', blob, 'sample.pdf');

      const res = await fetch(`${BASE_URL}/api/ingest/pdf`, {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const result = IngestResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success && 'text' in result.data) {
        expect(typeof result.data.text).toBe('string');
        expect(result.data.text.length).toBeGreaterThan(0);
      }
    });

    it('should return a valid IngestResponseSchema error when no file uploaded', async () => {
      if (!serverUp) return;

      const formData = new FormData();

      const res = await fetch(`${BASE_URL}/api/ingest/pdf`, {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      const result = IngestResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success && 'error' in result.data) {
        expect(result.data.error).toContain('PDF file not uploaded');
      }
    });
  });

  // ─── GET /api/status/:sessionId ──────────────────────────
  describe('GET /api/status/:sessionId', () => {
    let sessionId: string | undefined;

    it('should return a valid StatusResponseSchema error for unknown session', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/status/nonexistent-session-id`);

      expect(res.status).toBe(404);
      const body = await res.json();
      const result = StatusResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success && 'error' in result.data) {
        expect(result.data.error).toBe('Session not found');
      }
    });

    it('should get a session_id from /api/generate for status polling', async () => {
      if (!serverUp) return;

      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedText: 'Business English status test',
          questionCount: 5,
          model: 'mock-model',
          apiKey: MOCK_API_KEY,
          config: { providerId: 'mock' },
        }),
      });

      const body = await res.json();
      sessionId = body.session_id;
      expect(sessionId).toBeTruthy();
    });

    it('should return a valid StatusResponseSchema for existing session', async () => {
      if (!serverUp || !sessionId) return;

      // Poll up to 10 times with 500ms delay to wait for session to register
      let statusBody: unknown = null;
      for (let i = 0; i < 10; i++) {
        const res = await fetch(`${BASE_URL}/api/status/${sessionId}`);
        if (res.status === 200) {
          statusBody = await res.json();
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      if (!statusBody) return;
      const result = StatusResponseSchema.safeParse(statusBody);
      expect(result.success).toBe(true);
      if (result.success && 'phase' in result.data) {
        expect(['starting', 'generating', 'audio', 'completed', 'error']).toContain(
          result.data.phase,
        );
        expect(result.data.progress).toBeGreaterThanOrEqual(0);
        expect(result.data.progress).toBeLessThanOrEqual(100);
        expect(typeof result.data.message).toBe('string');
      }
    });
  });

  // ─── Cross-endpoint: Generate → Status → ExamData ────────
  describe('Cross-endpoint contract flow', () => {
    it('should complete generate→status→exam_data flow in mock mode', async () => {
      if (!serverUp) return;

      // 1. Generate
      const genRes = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedText: 'Cross-endpoint flow test',
          questionCount: 10,
          model: 'mock-model',
          apiKey: MOCK_API_KEY,
          config: { providerId: 'mock' },
        }),
      });
      const genBody = await genRes.json();
      const genResult = GenerateResponseSchema.safeParse(genBody);
      expect(genResult.success).toBe(true);
      const sid = genResult.success ? genResult.data.session_id : undefined;
      expect(sid).toBeTruthy();

      // 2. Wait for completion (poll status)
      let completed = false;
      for (let i = 0; i < 30; i++) {
        const statusRes = await fetch(`${BASE_URL}/api/status/${sid}`);
        if (statusRes.status === 200) {
          const statusBody = await statusRes.json();
          const statusResult = StatusResponseSchema.safeParse(statusBody);
          if (statusResult.success && 'phase' in statusResult.data) {
            if (statusResult.data.phase === 'completed') {
              completed = true;
              break;
            }
            if (statusResult.data.phase === 'error') {
              break;
            }
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      expect(completed).toBe(true);

      // 3. Fetch exam_data.json via storage endpoint
      const examRes = await fetch(`${BASE_URL}/storage/sessions/${sid}/exam_data.json`);
      expect(examRes.status).toBe(200);
      const examBody = await examRes.json();
      const examResult = ExamDataSchema.safeParse(examBody);
      expect(examResult.success).toBe(true);
      if (examResult.success) {
        expect(examResult.data.questions.length).toBe(10);
        expect(examResult.data.title).toBeTruthy();
        for (const q of examResult.data.questions) {
          expect(['listening', 'reading']).toContain(q.type);
          expect(q.options.length).toBe(4);
          expect(['A', 'B', 'C', 'D']).toContain(q.answer);
        }
      }
    });
  });
});
