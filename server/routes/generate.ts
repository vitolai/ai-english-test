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
  ensureRandomModeBusiness,
  ensureListeningCoherence,
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
    const { seedText, questionCount, model, apiKey, config, sourceType } = req.body as {
      seedText?: string;
      questionCount: number;
      model?: string;
      apiKey?: string;
      config?: { providerId?: string; baseURL?: string; fallbacks?: Array<{ id: string; model: string; apiKey: string; baseURL?: string }> };
      sourceType?: string;
    };

    const session_id = `${new Date().toISOString().split('T')[0]}-${uuidv4().slice(0, 8)}`;
    const sessionDir = path.join(storageDir, session_id);
    fs.mkdirSync(sessionDir, { recursive: true });
    const audioDir = path.join(sessionDir, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });

    sessionStatus.set(session_id, { phase: 'starting', progress: 0, message: 'Initializing...' });

    console.log(`[Generate] ${questionCount} questions | session=${session_id}`);

    req.setTimeout(0);

    const maxValidationRetries = 5;

    for (let validationAttempt = 1; validationAttempt <= maxValidationRetries; validationAttempt++) {
      try {
        let finalQuestions: Array<Record<string, unknown>> = [];

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

          const dist = getQuestionDistribution(questionCount);
          const listeningCount = dist.listening.part1 + dist.listening.part2 + dist.listening.part3 + dist.listening.part4;
          const readingCount = dist.reading.part5 + dist.reading.part6 + dist.reading.part7;

          // PHASE 1: Generate listening questions (Parts 1-4 only)
          const LISTENING_CHUNK_SIZE = 13;
          const listeningChunks: Array<{ offset: number; count: number }> = [];
          let remaining = listeningCount;
          let chunkOffset = 0;
          while (remaining > 0) {
            const chunkCount = Math.min(remaining, LISTENING_CHUNK_SIZE);
            listeningChunks.push({ offset: chunkOffset, count: chunkCount });
            chunkOffset += chunkCount;
            remaining -= chunkCount;
          }

          console.log(`[AI] Phase 1: Generating ${listeningCount} listening questions in ${listeningChunks.length} chunk(s): ${listeningChunks.map(c => c.count).join('+')}`);
          setStatus(session_id, {
            phase: 'generating',
            progress: 10,
            message: `Phase 1: Generating ${listeningCount} listening questions (${listeningChunks.length} chunks)...`,
          });

          const listeningQuestions: Array<Record<string, unknown>> = [];

          for (let ci = 0; ci < listeningChunks.length; ci++) {
            const chunk = listeningChunks[ci];
            const startId = chunk.offset + 1;
            const endId = chunk.offset + chunk.count;

            const listeningPrompt = `CRITICAL INSTRUCTION: You are generating ONLY listening questions. Do NOT generate ANY reading questions (no Part 5, 6, or 7). Generate EXACTLY ${chunk.count} listening questions. Count your output carefully.

Generate a JSON object with a "questions" array containing EXACTLY ${chunk.count} TOEIC LISTENING questions starting at ID ${startId}.

LISTENING DISTRIBUTION for this chunk (${chunk.count} questions):
- Part 1 (Photographs): ${ci === 0 ? dist.listening.part1 : 0} questions — photo + 4 audio descriptions, empty transcript
- Part 2 (Question-Response): ${ci === 0 ? dist.listening.part2 : 0} questions — spoken question in transcript + 3 responses (NOT 4), empty question field
- Part 3 (Conversations): ${ci === 0 ? dist.listening.part3 : 0} questions — conversation in transcript + question text + 4 options
- Part 4 (Talks): ${ci === 0 ? dist.listening.part4 : 0} questions — talk in transcript + question text + 4 options

Note: All questions in this chunk have IDs from ${startId} to ${endId}.

FORBIDDEN: Do NOT include any questions with type "reading" or parts 5, 6, 7. ONLY type "listening" with parts 1, 2, 3, 4.
${ci === 0 ? buildPart1Instruction(1, dist.listening.part1, getPart1Count(questionCount, 1), questionCount) : ''}
CRITICAL: BASE ALL QUESTIONS ON THIS SOURCE TEXT. Use vocabulary, topics, names, companies, and scenarios directly from this text:
SOURCE TEXT:
${seedText || 'International business environment.'}
END SOURCE TEXT.
The questions MUST reference topics, vocabulary, or scenarios from the source text above. Do NOT generate generic questions unrelated to the source text.
Return ONLY valid JSON: { "questions": [...] }`;

            const progressBase = 10 + (ci / listeningChunks.length) * 35;
            setStatus(session_id, {
              phase: 'generating',
              progress: progressBase,
              message: `Phase 1: Generating listening chunk ${ci + 1}/${listeningChunks.length} (questions ${startId}-${endId})...`,
            });

            let chunkListening: Array<Record<string, unknown>> = [];
            let chunkAttempts = 0;
            const maxChunkRetries = 3;

            while (chunkListening.length < chunk.count && chunkAttempts < maxChunkRetries) {
              chunkAttempts++;
              try {
                const { object: listeningData } = await generateWithFallback(chain, ExamSchema, listeningPrompt, 2);
                if ((listeningData as { questions?: unknown[] }).questions?.length) {
                  const questions = (listeningData as { questions: Array<Record<string, unknown>> }).questions;
                  const onlyListening = questions.filter(q => q.type === 'listening');
                  console.log(`[AI] Phase 1 chunk ${ci + 1}: received ${questions.length} total, ${onlyListening.length} listening (attempt ${chunkAttempts})`);
                  const needed = chunk.count - chunkListening.length;
                  const picked = onlyListening.filter(q => {
                    const qid = q.id as number;
                    return qid >= startId && qid <= endId;
                  }).slice(0, needed);
                  if (picked.length === 0) {
                    chunkListening.push(...onlyListening.slice(0, needed));
                  } else {
                    chunkListening.push(...picked);
                  }
                }
                if (chunkListening.length < chunk.count) {
                  console.warn(`[AI] Phase 1 chunk ${ci + 1}: got ${chunkListening.length}/${chunk.count} — retrying chunk`);
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[AI] Phase 1 chunk ${ci + 1} failed (attempt ${chunkAttempts}):`, msg);
                if (chunkAttempts >= maxChunkRetries) {
                  throw new Error(`Phase 1 listening chunk ${ci + 1} failed after ${maxChunkRetries} attempts: ${msg}`);
                }
              }
            }

            if (chunkListening.length < chunk.count) {
              throw new Error(`Phase 1 listening chunk ${ci + 1}: only generated ${chunkListening.length}/${chunk.count} questions after ${maxChunkRetries} attempts`);
            }

            listeningQuestions.push(...chunkListening.map(q => {
              return { ...q, audio: `sessions/${session_id}/audio/q${q.id}.mp3` };
            }));
          }

          if (listeningQuestions.length < listeningCount) {
            throw new Error(`Phase 1 listening: only generated ${listeningQuestions.length}/${listeningCount} questions total`);
          }

          finalQuestions = [...listeningQuestions];

          // PHASE 2: Generate reading questions (Parts 5-7 only)
          const readingStartId = listeningQuestions.length + 1;
          console.log(`[AI] Phase 2: Generating ${readingCount} reading questions starting at ID ${readingStartId}`);

          const READING_CHUNK_SIZE = 13;
          const readingChunks: Array<{ offset: number; count: number }> = [];
          remaining = readingCount;
          chunkOffset = 0;
          while (remaining > 0) {
            const chunkCount = Math.min(remaining, READING_CHUNK_SIZE);
            readingChunks.push({ offset: readingStartId + chunkOffset, count: chunkCount });
            chunkOffset += chunkCount;
            remaining -= chunkCount;
          }

          console.log(`[AI] Phase 2: Generating ${readingCount} reading questions in ${readingChunks.length} chunk(s): ${readingChunks.map(c => c.count).join('+')}`);

          for (let ci = 0; ci < readingChunks.length; ci++) {
            const chunk = readingChunks[ci];

            const readingPrompt = `CRITICAL INSTRUCTION: You are generating ONLY reading questions. Do NOT generate ANY listening questions (no Part 1, 2, 3, or 4). Generate EXACTLY ${chunk.count} reading questions. Count your output carefully.

Generate a JSON object with a "questions" array containing EXACTLY ${chunk.count} TOEIC READING questions starting at ID ${chunk.offset}.

READING DISTRIBUTION for this chunk (${chunk.count} questions):
- Part 5 (Incomplete Sentences): ${ci === 0 ? dist.reading.part5 : 0} questions — fill-in-the-blank + 4 options
- Part 6 (Text Completion): ${ci === 0 ? dist.reading.part6 : 0} questions — passage + 4 options
- Part 7 (Reading Comprehension): ${ci === 0 ? dist.reading.part7 : 0} questions — passage + 4 options

Note: All questions in this chunk have IDs from ${chunk.offset} to ${chunk.offset + chunk.count - 1}.

FORBIDDEN: Do NOT include any questions with type "listening" or parts 1, 2, 3, 4. ONLY type "reading" with parts 5, 6, 7.
CRITICAL: BASE ALL QUESTIONS ON THIS SOURCE TEXT. Use vocabulary, topics, names, companies, and scenarios directly from this text:
SOURCE TEXT:
${seedText || 'International business environment.'}
END SOURCE TEXT.
The questions MUST reference topics, vocabulary, or scenarios from the source text above. Do NOT generate generic questions unrelated to the source text.
Return ONLY valid JSON: { "questions": [...] }`;

            const progressBase = 50 + (ci / readingChunks.length) * 35;
            setStatus(session_id, {
              phase: 'generating',
              progress: progressBase,
              message: `Phase 2: Generating reading chunk ${ci + 1}/${readingChunks.length}...`,
            });

            let chunkReading: Array<Record<string, unknown>> = [];
            let chunkAttempts = 0;
            const maxChunkRetries = 3;

            while (chunkReading.length < chunk.count && chunkAttempts < maxChunkRetries) {
              chunkAttempts++;
              try {
                const { object: readingData } = await generateWithFallback(chain, ExamSchema, readingPrompt, 2);
                if ((readingData as { questions?: unknown[] }).questions?.length) {
                  const questions = (readingData as { questions: Array<Record<string, unknown>> }).questions;
                  const onlyReading = questions.filter(q => q.type === 'reading');
                  console.log(`[AI] Phase 2 chunk ${ci + 1}: received ${questions.length} total, ${onlyReading.length} reading (attempt ${chunkAttempts})`);
                  const needed = chunk.count - chunkReading.length;
                  const picked = onlyReading.filter(q => {
                    const qid = q.id as number;
                    return qid >= chunk.offset && qid < chunk.offset + chunk.count;
                  }).slice(0, needed);
                  if (picked.length === 0) {
                    chunkReading.push(...onlyReading.slice(0, needed));
                  } else {
                    chunkReading.push(...picked);
                  }
                }
                if (chunkReading.length < chunk.count) {
                  console.warn(`[AI] Phase 2 chunk ${ci + 1}: got ${chunkReading.length}/${chunk.count} — retrying chunk`);
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[AI] Phase 2 chunk ${ci + 1} failed (attempt ${chunkAttempts}):`, msg);
                if (chunkAttempts >= maxChunkRetries) {
                  throw new Error(`Phase 2 reading chunk ${ci + 1} failed after ${maxChunkRetries} attempts: ${msg}`);
                }
              }
            }

            if (chunkReading.length < chunk.count) {
              throw new Error(`Phase 2 reading chunk ${ci + 1}: only generated ${chunkReading.length}/${chunk.count} questions after ${maxChunkRetries} attempts`);
            }

            finalQuestions.push(...chunkReading);
          }

          if (finalQuestions.length < listeningCount + readingCount) {
            throw new Error(`Total questions: expected ${listeningCount + readingCount}, got ${finalQuestions.length}`);
          }
        }

        if (finalQuestions.length === 0) {
          console.warn('[Fallback] No questions generated — using mock data');
          finalQuestions = generateMockData(questionCount, session_id).questions as Array<Record<string, unknown>>;
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
        finalQuestions = ensureRandomModeBusiness(finalQuestions, sourceType);
        finalQuestions = ensureListeningCoherence(finalQuestions);

        const times = getExamTimes(questionCount);
        const examData = { title: 'TOEIC Session', questions: finalQuestions, listeningTime: times.listeningTime, readingTime: times.readingTime };
        const jsonPath = path.join(sessionDir, 'exam_data.json');
        fs.writeFileSync(jsonPath, JSON.stringify(examData, null, 2));

        setStatus(session_id, { phase: 'audio', progress: 95, message: 'Generating audio files...' });
        await generateAudio(jsonPath, audioDir);

        sessionStatus.set(session_id, { phase: 'completed', progress: 100, message: 'Done!' });
        sendSSE(session_id, { type: 'complete', session_id, data: examData });
        console.log(`[Done] Session ${session_id}: ${finalQuestions.length} questions`);

        res.json({ session_id });
        return;
      } catch (err) {
        const isRetryable = err instanceof RetryableDistributionError ||
          (err instanceof Error && err.message.startsWith('Phase'));
        if (isRetryable && validationAttempt < maxValidationRetries) {
          console.warn(`[Retry] Attempt ${validationAttempt} failed: ${err instanceof Error ? err.message : String(err)} — retrying`);
          fs.rmSync(sessionDir, { recursive: true, force: true });
          fs.mkdirSync(sessionDir, { recursive: true });
          fs.mkdirSync(audioDir, { recursive: true });
          sessionStatus.set(session_id, { phase: 'generating', progress: 0, message: `Retry ${validationAttempt}/${maxValidationRetries}: regenerating questions...` });
          sendSSE(session_id, { type: 'progress', phase: 'retrying', progress: 0, message: `Retrying (${validationAttempt}/${maxValidationRetries}): regenerating questions...` });
          const delayMs = validationAttempt * 2000;
          console.log(`[Retry] Waiting ${delayMs}ms before retry ${validationAttempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Fatal]', msg);
        sessionStatus.set(session_id, { phase: 'error', progress: 0, message: msg });
        sendSSE(session_id, { type: 'error', message: msg });
        fs.rmSync(sessionDir, { recursive: true, force: true });
        res.status(500).json({ error: msg });
        return;
      }
    }
  });

  return router;
}
