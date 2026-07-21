import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ExamSchema,
  RetryableDistributionError,
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
  ensurePart5Questions,
  ensurePart6Questions,
  ensurePart7Questions,
  validateAndRebalanceDistribution,
  getExamTimes,
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
      let activeSessionId = session_id;
      let activeSessionDir = sessionDir;
      let activeAudioDir = audioDir;
      const maxValidationRetries = 5;

      for (let validationAttempt = 1; validationAttempt <= maxValidationRetries; validationAttempt++) {
        try {
          req.setTimeout(0);
          let finalQuestions: Array<Record<string, unknown>> = [];

          const isTestMode = apiKey && apiKey.toLowerCase().includes('test');

          if (isTestMode) {
            console.log('[Mock] Test mode triggered — generating mock data');
            setStatus(activeSessionId, { phase: 'generating', progress: 50, message: 'Mock mode: generating sample data...' });
            finalQuestions = generateMockData(questionCount, activeSessionId).questions as Array<Record<string, unknown>>;
          } else {
            const chain = buildProviderChain(config, model, apiKey);

            if (chain.length === 0) {
              throw new Error('No valid provider configured. Select a provider and enter your API key.');
            }

            console.log(`[AI] Fallback chain: ${chain.map(c => c.id).join(' → ')}`);

            const dist = getQuestionDistribution(questionCount);
            const listeningCount = dist.listening.part1 + dist.listening.part2 + dist.listening.part3 + dist.listening.part4;
            const readingCount = dist.reading.part5 + dist.reading.part6 + dist.reading.part7;

            // PHASE 1: Generate listening questions (Parts 1-4 only)
            console.log(`[AI] Phase 1: Generating ${listeningCount} listening questions`);
            setStatus(activeSessionId, {
              phase: 'generating',
              progress: 10,
              message: `Phase 1: Generating ${listeningCount} listening questions...`,
            });

            const listeningPrompt = `CRITICAL INSTRUCTION: You are generating ONLY listening questions. Do NOT generate ANY reading questions (no Part 5, 6, or 7). Generate EXACTLY ${listeningCount} listening questions. Count your output carefully.

Generate a JSON object with a "questions" array containing EXACTLY ${listeningCount} TOEIC LISTENING questions starting at ID 1.

LISTENING DISTRIBUTION:
- Part 1 (Photographs): ${dist.listening.part1} questions — photo + 4 audio descriptions, empty transcript
- Part 2 (Question-Response): ${dist.listening.part2} questions — spoken question in transcript + 3 responses (NOT 4), empty question field
- Part 3 (Conversations): ${dist.listening.part3} questions — conversation in transcript + question text + 4 options
- Part 4 (Talks): ${dist.listening.part4} questions — talk in transcript + question text + 4 options

FORBIDDEN: Do NOT include any questions with type "reading" or parts 5, 6, 7. ONLY type "listening" with parts 1, 2, 3, 4.
${buildPart1Instruction(1, dist.listening.part1, getPart1Count(questionCount, 1), questionCount)}
CRITICAL: BASE ALL QUESTIONS ON THIS SOURCE TEXT. Use vocabulary, topics, names, companies, and scenarios directly from this text:
SOURCE TEXT:
${seedText || 'International business environment.'}
END SOURCE TEXT.
The questions MUST reference topics, vocabulary, or scenarios from the source text above. Do NOT generate generic questions unrelated to the source text.
Return ONLY valid JSON: { "questions": [...] }`;

            let listeningQuestions: Array<Record<string, unknown>> = [];
            try {
              const { object: listeningData } = await generateWithFallback(chain, ExamSchema, listeningPrompt, 2);
              if ((listeningData as { questions?: unknown[] }).questions?.length) {
                const questions = (listeningData as { questions: Array<Record<string, unknown>> }).questions;
                const onlyListening = questions.filter(q => q.type === 'listening');
                console.log(`[AI] Phase 1: received ${questions.length} total, ${onlyListening.length} listening`);
                listeningQuestions = onlyListening.slice(0, listeningCount).map(q => {
                  return { ...q, audio: `sessions/${activeSessionId}/audio/q${q.id}.mp3` };
                });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error('[AI] Phase 1 (listening) failed:', msg);
            }

            finalQuestions = [...listeningQuestions];

            // PHASE 2: Generate reading questions (Parts 5-7 only)
            const readingStartId = listeningQuestions.length + 1;
            console.log(`[AI] Phase 2: Generating ${readingCount} reading questions starting at ID ${readingStartId}`);
            setStatus(activeSessionId, {
              phase: 'generating',
              progress: 50,
              message: `Phase 2: Generating ${readingCount} reading questions...`,
            });

            const readingPrompt = `CRITICAL INSTRUCTION: You are generating ONLY reading questions. Do NOT generate ANY listening questions (no Part 1, 2, 3, or 4). Generate EXACTLY ${readingCount} reading questions. Count your output carefully.

Generate a JSON object with a "questions" array containing EXACTLY ${readingCount} TOEIC READING questions starting at ID ${readingStartId}.

READING DISTRIBUTION:
- Part 5 (Incomplete Sentences): ${dist.reading.part5} questions — fill-in-the-blank + 4 options
- Part 6 (Text Completion): ${dist.reading.part6} questions — passage + 4 options
- Part 7 (Reading Comprehension): ${dist.reading.part7} questions — passage + 4 options

FORBIDDEN: Do NOT include any questions with type "listening" or parts 1, 2, 3, 4. ONLY type "reading" with parts 5, 6, 7.
CRITICAL: BASE ALL QUESTIONS ON THIS SOURCE TEXT. Use vocabulary, topics, names, companies, and scenarios directly from this text:
SOURCE TEXT:
${seedText || 'International business environment.'}
END SOURCE TEXT.
The questions MUST reference topics, vocabulary, or scenarios from the source text above. Do NOT generate generic questions unrelated to the source text.
Return ONLY valid JSON: { "questions": [...] }`;

            try {
              const { object: readingData } = await generateWithFallback(chain, ExamSchema, readingPrompt, 2);
              if ((readingData as { questions?: unknown[] }).questions?.length) {
                const questions = (readingData as { questions: Array<Record<string, unknown>> }).questions;
                const onlyReading = questions.filter(q => q.type === 'reading');
                console.log(`[AI] Phase 2: received ${questions.length} total, ${onlyReading.length} reading`);
                finalQuestions = [...finalQuestions, ...onlyReading.slice(0, readingCount)];
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error('[AI] Phase 2 (reading) failed:', msg);
            }
          }

          if (finalQuestions.length === 0) {
            console.warn('[Fallback] No questions generated — using mock data');
            finalQuestions = generateMockData(questionCount, activeSessionId).questions as Array<Record<string, unknown>>;
          }

          const dist = getQuestionDistribution(questionCount);
          const validation = validateAndRebalanceDistribution(finalQuestions, dist, { strict: true });
          if (validation.warnings.length > 0) {
            console.warn("[Distribution validation] warnings:", validation.warnings);
          }
          finalQuestions = validation.questions;

          finalQuestions = ensurePart1Images(finalQuestions);
          finalQuestions = ensurePart2EmptyQuestion(finalQuestions);
          finalQuestions = ensurePart2Transcripts(finalQuestions);
          finalQuestions = ensurePart34Transcripts(finalQuestions);
          finalQuestions = ensurePart5Questions(finalQuestions);
          finalQuestions = ensurePart6Questions(finalQuestions);
          finalQuestions = ensurePart7Questions(finalQuestions);

          const times = getExamTimes(questionCount);
          const examData = { title: 'TOEIC Session', questions: finalQuestions, listeningTime: times.listeningTime, readingTime: times.readingTime };
          const jsonPath = path.join(activeSessionDir, 'exam_data.json');
          fs.writeFileSync(jsonPath, JSON.stringify(examData, null, 2));

          setStatus(activeSessionId, { phase: 'audio', progress: 95, message: 'Generating audio files...' });
          await generateAudio(jsonPath, activeAudioDir);

          sessionStatus.set(activeSessionId, { phase: 'completed', progress: 100, message: 'Done!' });
          sendSSE(activeSessionId, { type: 'complete', session_id: activeSessionId, data: examData });
          console.log(`[Done] Session ${activeSessionId}: ${finalQuestions.length} questions`);
          return;
        } catch (err) {
          if (err instanceof RetryableDistributionError && validationAttempt < maxValidationRetries) {
            console.warn(`[Retry] Validation attempt ${validationAttempt} failed: ${err.message} — retrying with same session`);
            fs.rmSync(activeSessionDir, { recursive: true, force: true });
            fs.mkdirSync(activeSessionDir, { recursive: true });
            fs.mkdirSync(activeAudioDir, { recursive: true });
            sessionStatus.set(activeSessionId, { phase: 'generating', progress: 0, message: `Retry ${validationAttempt}/${maxValidationRetries}: regenerating questions...` });
            sendSSE(activeSessionId, { type: 'progress', phase: 'retrying', progress: 0, message: `Retrying (${validationAttempt}/${maxValidationRetries}): AI produced too few questions, regenerating...` });
            // Add delay between retries to avoid rate limiting and give AI time to reset
            const delayMs = validationAttempt * 2000;
            console.log(`[Retry] Waiting ${delayMs}ms before retry ${validationAttempt + 1}...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[Fatal]', msg);
          sessionStatus.set(activeSessionId, { phase: 'error', progress: 0, message: msg });
          sendSSE(session_id, { type: 'error', message: msg });
          return;
        }
      }
    })();
  });

  return router;
}
