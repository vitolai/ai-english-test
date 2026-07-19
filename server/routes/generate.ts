import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ExamSchema,
  buildProviderChain,
  getPart1Count,
  getQuestionDistribution,
  buildPart1Instruction,
  generateWithFallback,
  generateMockData,
  ensurePart1Images,
  ensurePart2EmptyQuestion,
  ensurePart2Transcripts,
  ensurePart34Transcripts,
} from '../services/ai.js';
import { generateAudio } from '../services/audio.js';
import type { SessionStores } from '../app.js';

const router = Router();

export function createGenerateRouter(stores: SessionStores, storageDir: string): Router {
  const { sseClients, sessionStatus } = stores;

  function sendSSE(sessionId: string, data: Record<string, unknown>) {
    const client = sseClients.get(sessionId);
    if (client && !client.destroyed) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  function setStatus(sessionId: string, status: { phase: string; progress: number; message: string }) {
    sessionStatus.set(sessionId, status);
    sendSSE(sessionId, { type: 'progress', ...status });
  }

  router.post('/api/generate', async (req, res) => {
    const { seedText, questionCount, model, apiKey, config } = req.body as {
      seedText?: string;
      questionCount: number;
      model?: string;
      apiKey?: string;
      config?: { providerId?: string; baseURL?: string; fallbacks?: Array<{ id: string; model: string; apiKey: string; baseURL?: string }> };
    };

    const session_id = `${new Date().toISOString().split('T')[0]}-${uuidv4().slice(0, 8)}`;
    const sessionDir = path.join(storageDir, session_id);
    fs.mkdirSync(sessionDir, { recursive: true });
    const audioDir = path.join(sessionDir, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });

    sessionStatus.set(session_id, { phase: 'starting', progress: 0, message: 'Initializing...' });

    console.log(`[Generate] ${questionCount} questions | session=${session_id}`);

    res.json({ session_id });

    (async () => {
      try {
        req.setTimeout(0);
        let finalQuestions: Array<Record<string, unknown>> = [];
        let attempts = 0;
        const maxAttempts = Math.ceil(questionCount / 10) + 5;

        const isTestMode = apiKey && apiKey.toLowerCase().includes('test');

        if (isTestMode) {
          console.log('[Mock] Test mode triggered — generating mock data');
          setStatus(session_id, { phase: 'generating', progress: 50, message: 'Mock mode: generating sample data...' });
          finalQuestions = generateMockData(questionCount, session_id).questions as Array<Record<string, unknown>>;
        } else {
          const chain = buildProviderChain(config, model, apiKey);

          if (chain.length === 0) {
            throw new Error('No valid provider configured. Select a provider and enter your API key.');
          }

          console.log(`[AI] Fallback chain: ${chain.map(c => c.id).join(' → ')}`);

          while (finalQuestions.length < questionCount && attempts < maxAttempts) {
            attempts++;
            const remainingCount = questionCount - finalQuestions.length;
            const currentChunkSize = Math.min(20, remainingCount);
            const startId = finalQuestions.length + 1;

            const part1Count = getPart1Count(questionCount, startId);
            const part1Instruction = buildPart1Instruction(startId, currentChunkSize, part1Count);
            const dist = getQuestionDistribution(questionCount);

            const prompt = `Generate a JSON object with a "questions" array containing EXACTLY ${currentChunkSize} TOEIC questions starting at ID ${startId}.

DISTRIBUTION (based on real TOEIC ratios, 50% listening / 50% reading):
- Listening Part 1 (Photographs): ${dist.listening.part1} questions — photo + 4 audio descriptions, empty transcript
- Listening Part 2 (Question-Response): ${dist.listening.part2} questions — spoken question in transcript + 3 responses (NOT 4), empty question field
- Listening Part 3 (Conversations): ${dist.listening.part3} questions — conversation in transcript + question text + 4 options
- Listening Part 4 (Talks): ${dist.listening.part4} questions — talk in transcript + question text + 4 options
- Reading Part 5 (Incomplete Sentences): ${dist.reading.part5} questions — fill-in-the-blank + 4 options
- Reading Part 6 (Text Completion): ${dist.reading.part6} questions — passage + 4 options
- Reading Part 7 (Reading Comprehension): ${dist.reading.part7} questions — passage + 4 options
${part1Instruction}
CRITICAL: BASE ALL QUESTIONS ON THIS SOURCE TEXT. Use vocabulary, topics, names, companies, and scenarios directly from this text:
SOURCE TEXT:
${seedText || 'International business environment.'}
END SOURCE TEXT.
The questions MUST reference topics, vocabulary, or scenarios from the source text above. Do NOT generate generic questions unrelated to the source text.
Return ONLY valid JSON: { "questions": [...] }`;

            const progress = Math.round((finalQuestions.length / questionCount) * 100);
            setStatus(session_id, {
              phase: 'generating',
              progress,
              message: `Chunk ${attempts}: Q${startId}–${startId + currentChunkSize - 1} (${finalQuestions.length}/${questionCount})`,
            });

            try {
              const { object: chunkData } = await generateWithFallback(chain, ExamSchema, prompt, 2);

              if ((chunkData as { questions?: unknown[] }).questions?.length) {
                const questions = (chunkData as { questions: Array<Record<string, unknown>> }).questions;
                console.log(`[AI] Received ${questions.length} questions`);
                const newQuestions = questions.slice(0, remainingCount).map(q => {
                  if (q.type === 'listening') {
                    return { ...q, audio: `sessions/${session_id}/audio/q${q.id}.mp3` };
                  }
                  return q;
                });
                finalQuestions = [...finalQuestions, ...newQuestions];
              } else {
                console.warn(`[AI] Attempt ${attempts}: empty or invalid question array`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error('[AI] Chunk generation failed:', msg);
              if (attempts >= maxAttempts && finalQuestions.length === 0) throw err;
            }
          }
        }

        if (finalQuestions.length === 0) {
          console.warn('[Fallback] No questions generated — using mock data');
          finalQuestions = generateMockData(questionCount, session_id).questions as Array<Record<string, unknown>>;
        }

        finalQuestions = ensurePart1Images(finalQuestions);
        finalQuestions = ensurePart2EmptyQuestion(finalQuestions);
        finalQuestions = ensurePart2Transcripts(finalQuestions);
        finalQuestions = ensurePart34Transcripts(finalQuestions);
        const examData = { title: 'TOEIC Session', questions: finalQuestions };
        const jsonPath = path.join(sessionDir, 'exam_data.json');
        fs.writeFileSync(jsonPath, JSON.stringify(examData, null, 2));

        setStatus(session_id, { phase: 'audio', progress: 95, message: 'Generating audio files...' });
        await generateAudio(jsonPath, audioDir);

        sessionStatus.set(session_id, { phase: 'completed', progress: 100, message: 'Done!' });
        sendSSE(session_id, { type: 'complete', session_id, data: examData });
        console.log(`[Done] Session ${session_id}: ${finalQuestions.length} questions`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Fatal]', msg);
        sessionStatus.set(session_id, { phase: 'error', progress: 0, message: msg });
        sendSSE(session_id, { type: 'error', message: msg });
      }
    })();
  });

  return router;
}
