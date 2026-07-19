import { z } from 'zod';

/**
 * Contract Test Zod Schemas
 * 單一真相來源：所有 API 回傳格式的 Schema 定義
 * 用於 tests/contracts/ 驗證 server.js 回傳是否符合合約
 */

// ─── Question ────────────────────────────────────────────
// 對齊 src/lib/providers.ts QuestionSchema（canonical）
export const QuestionSchema = z.object({
  id: z.number(),
  part: z.number().min(1).max(7),
  type: z.enum(['listening', 'reading']),
  image: z.string().optional(),
  transcript: z.string().optional(),
  passage: z.string().optional(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.enum(['A', 'B', 'C', 'D']),
  audio: z.string().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

// ─── ExamData ────────────────────────────────────────────
// server.js 實際回傳：{ title, questions } 加上可選的時間欄位
export const ExamDataSchema = z.object({
  title: z.string(),
  questions: z.array(QuestionSchema),
  listeningTime: z.number().optional(),
  readingTime: z.number().optional(),
});

export type ExamData = z.infer<typeof ExamDataSchema>;

// ─── GenerateResponse ────────────────────────────────────
// POST /api/generate 立即回傳（非 SSE）
export const GenerateResponseSchema = z.object({
  session_id: z.string(),
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

// ─── IngestResponse ──────────────────────────────────────
// POST /api/ingest/pdf 和 POST /api/ingest/web 的回傳
export const IngestSuccessSchema = z.object({
  text: z.string(),
});

export const IngestErrorSchema = z.object({
  error: z.string(),
});

export const IngestResponseSchema = z.union([
  IngestSuccessSchema,
  IngestErrorSchema,
]);

export type IngestResponse = z.infer<typeof IngestResponseSchema>;

// ─── StatusResponse ──────────────────────────────────────
// GET /api/status/:sessionId 的回傳
export const StatusSuccessSchema = z.object({
  phase: z.enum(['starting', 'generating', 'audio', 'completed', 'error']),
  progress: z.number().min(0).max(100),
  message: z.string(),
});

export const StatusErrorSchema = z.object({
  error: z.string(),
});

export const StatusResponseSchema = z.union([
  StatusSuccessSchema,
  StatusErrorSchema,
]);

export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// ─── SSE Events ──────────────────────────────────────────
// GET /api/events/:sessionId 的 SSE 訊息格式
export const SSEProgressEventSchema = z.object({
  type: z.literal('progress'),
  phase: z.string(),
  progress: z.number(),
  message: z.string(),
});

export const SSECompleteEventSchema = z.object({
  type: z.literal('complete'),
  session_id: z.string(),
  data: ExamDataSchema,
});

export const SSEErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const SSEEventSchema = z.union([
  SSEProgressEventSchema,
  SSECompleteEventSchema,
  SSEErrorEventSchema,
]);

export type SSEEvent = z.infer<typeof SSEEventSchema>;
