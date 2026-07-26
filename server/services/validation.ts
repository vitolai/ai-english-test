import {
  PART1_DATA,
  KNOWN_P1_IDS,
  MOCK_PART3_CONVERSATIONS,
  MOCK_PART4_TALKS,
  MOCK_PART7_PASSAGES,
  P7_PASSAGE_TEMPLATES,
  extractKeywords,
  findPassageTemplate,
  isNonBusinessContent,
  pickRandomBusinessQuestion,
  shuffleOptionsWithAnswer,
  shuffleArray,
} from './mock-data.js';
import { getExpectedPartCounts } from './prompts.js';
import { stripHtml } from './coercion.js';

function buildPassageFromQuestion(q: Record<string, unknown>): string {
  const question = (q['question'] as string) || '';
  const options = (q['options'] as string[]) || [];
  const correctIdx = 'ABCD'.indexOf((q['answer'] as string) || 'A');
  const correctAnswer = options[correctIdx >= 0 ? correctIdx : 0] || '';

  const keywords = extractKeywords(`${question} ${options.join(' ')}`);
  const templatePassage = findPassageTemplate(keywords);
  if (templatePassage) return templatePassage;

  // Fallback: build a synthetic passage embedding the question context
  const sentences = [
    `The following notice is posted for all employees and staff members.`,
    question.replace(/\?+$/, '.'),
    `According to the updated guidelines, the correct procedure is: ${correctAnswer.toLowerCase()}.`,
    `All personnel are expected to follow these instructions carefully.`,
    `Please refer to the company handbook for additional details and reference materials.`,
    `If you have further questions, contact the relevant department during regular business hours.`,
    `These guidelines apply to all departments and locations across the organization.`,
    `Failure to comply may result in review by the Human Resources department.`,
    `Updated information is available on the company intranet for your convenience.`,
    `Thank you for your attention to this important matter and your continued cooperation.`,
  ];

  // Pad to ~150 words by repeating context
  while (sentences.join(' ').split(/\s+/).length < 150) {
    sentences.splice(Math.floor(sentences.length / 2), 0,
      `Management has reviewed the current procedures and determined that these updates are necessary for operational efficiency.`
    );
  }

  return sentences.join(' ');
}

export function ensurePart7Questions(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let mockIdx = 0;
  return questions.map(q => {
    if (q['part'] === 7 && q['type'] === 'reading') {
      // Validate question field: if empty or missing, replace entire entry with mock
      const questionText = (q['question'] as string) || '';
      if (questionText.trim().length === 0) {
        const mock = MOCK_PART7_PASSAGES[mockIdx % MOCK_PART7_PASSAGES.length];
        mockIdx++;
        const shuffled = shuffleOptionsWithAnswer([...mock.options], mock.answer);
        return {
          ...q,
          passage: mock.passage,
          question: mock.question,
          options: shuffled.options,
          answer: shuffled.answer,
        };
      }
      if (typeof q['question'] === 'string') {
        q['question'] = stripHtml(q['question']);
      }
      if (q['passage'] && typeof q['passage'] === 'string') {
        q['passage'] = stripHtml(q['passage']);
      }
      if (Array.isArray(q['options'])) {
        q['options'] = (q['options'] as string[]).map(opt =>
          typeof opt === 'string' ? stripHtml(opt) : opt
        );
      }
      // P7 passage MUST be non-empty: generate from context if missing
      const passage = (q['passage'] as string) || '';
      if (passage.trim().length === 0) {
        q['passage'] = buildPassageFromQuestion(q);
      }
      // FR-GEN-13: shuffle options and set answer to shuffled position
      const opts = (q['options'] as string[]) || [];
      const ans = (q['answer'] as string) || 'A';
      if (opts.length >= 4) {
        const shuffled = shuffleOptionsWithAnswer(opts, ans);
        q['options'] = shuffled.options;
        q['answer'] = shuffled.answer;
      }
    }
    return q;
  });
}

// ============================================================
// RANDOM MODE BUSINESS ENFORCEMENT
// ============================================================
// When sourceType is 'random', the AI sometimes generates non-business
// content (politics, weather, sports). This normalizer replaces P6/P7
// questions whose passage/question contains non-business keywords with
// business-themed mock data. Only applies for sourceType='random';
// web-sourced and self-import modes keep AI content as-is.
export function ensureRandomModeBusiness(
  questions: Array<Record<string, unknown>>,
  sourceType?: string,
): Array<Record<string, unknown>> {
  if (sourceType && sourceType !== 'random') return questions;

  return questions.map(q => {
    const part = q['part'] as number;
    if (part !== 6 && part !== 7) return q;

    const passage = (q['passage'] as string) || '';
    const question = (q['question'] as string) || '';

    if (isNonBusinessContent(passage) || isNonBusinessContent(question)) {
      console.warn(`[RandomMode] Non-business content detected in part ${part} (id=${q['id']}) — overriding with mock business data`);
      const mock = pickRandomBusinessQuestion();
      q['passage'] = mock.passage;
      q['question'] = mock.question;
      // FR-GEN-13: shuffle options and set answer to shuffled position
      const shuffled = shuffleOptionsWithAnswer([...mock.options], mock.answer);
      q['options'] = shuffled.options;
      q['answer'] = shuffled.answer;
    }

    return q;
  });
}

// Assign mock entries to groups ensuring no two adjacent groups share
// the same entry. Each group of 3 questions gets one mock entry.
function assignNonAdjacentGroups<T>(pool: readonly T[], numGroups: number): T[] {
  if (numGroups <= 0 || pool.length === 0) return [];
  if (pool.length === 1) return Array(numGroups).fill(pool[0]);

  const shuffled = shuffleArray(pool);
  const result: T[] = [];
  let lastUsed: T | undefined;

  for (let g = 0; g < numGroups; g++) {
    let idx = g % shuffled.length;
    let chosen = shuffled[idx];
    // Ensure no two adjacent groups get the same mock entry
    if (lastUsed !== undefined && chosen === lastUsed) {
      idx = (idx + 1) % shuffled.length;
      chosen = shuffled[idx];
    }
    result.push(chosen);
    lastUsed = chosen;
  }
  return result;
}

// ============================================================
// LISTENING COHERENCE — force P1-P4 fields from canonical mock data
// ============================================================
// After AI generation and other normalizers, some P1-P4 questions may still
// carry AI-generated content that doesn't match the canonical mock datasets.
// This normalizer unconditionally replaces the relevant fields so that every
// listening question is guaranteed coherent with its source image/transcript.
export function ensureListeningCoherence(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!questions || questions.length === 0) return questions;

  // Deterministic grouping for P3/P4: max 3 questions share the same
  // transcript. Track usage count per transcript index. When 3 questions
  // have been assigned to the current transcript, increment to the next.
  // Q1-3 get transcript 0, Q4-6 get transcript 1, etc. Cycle through
  // available mock transcripts if more groups are needed.
  let p3TranscriptIdx = 0;
  let p3UsageCount = 0;
  let p4TranscriptIdx = 0;
  let p4UsageCount = 0;

  return questions.map(q => {
    const part = q['part'] as number;
    const type = q['type'] as string;

    if (type === 'listening' && part === 1) {
      const d = PART1_DATA[Math.floor(Math.random() * PART1_DATA.length)];
      q['image'] = d.image;
      q['question'] = 'Look at the photograph and listen to the four statements. Choose the statement that best describes what you see in the picture.';
      q['options'] = [...d.options];
      q['answer'] = d.answer;
    }

    if (type === 'listening' && part === 2) {
      const d = PART2_DATA[Math.floor(Math.random() * PART2_DATA.length)];
      q['transcript'] = d.transcript;
      q['options'] = [...d.options];
      q['answer'] = d.answer;
      // Part 2 is audio-only — must never carry an image field.
      // Without this, a P1 image can leak when the AI relabels a P1 question
      // as P2 or when ensureListeningCoherence processes a question that
      // previously had an image assigned by ensurePart1Images.
      delete q['image'];
    }

    if (type === 'listening' && part === 3) {
      const hasTranscript = q['transcript'] && (q['transcript'] as string).trim() !== '';
      if (!hasTranscript) {
        // Track usage: after 3 questions assigned to the current transcript,
        // move to the next. Cycle through available mock transcripts.
        if (p3UsageCount >= 3) {
          p3UsageCount = 0;
          p3TranscriptIdx = (p3TranscriptIdx + 1) % MOCK_PART3_CONVERSATIONS.length;
        }
        const mockConv = MOCK_PART3_CONVERSATIONS[p3TranscriptIdx];
        const qInGroup = Math.min(p3UsageCount, mockConv.questions.length - 1);
        const mockQ = mockConv.questions[qInGroup];
        q['transcript'] = mockConv.transcript;
        q['question'] = mockQ.question;
        // FR-GEN-13: shuffle options and set answer to shuffled position
        const shuffled = shuffleOptionsWithAnswer([...mockQ.options], mockQ.answer);
        q['options'] = shuffled.options;
        q['answer'] = shuffled.answer;
        p3UsageCount++;
      }
    }

    if (type === 'listening' && part === 4) {
      const hasTranscript = q['transcript'] && (q['transcript'] as string).trim() !== '';
      if (!hasTranscript) {
        // Track usage: after 3 questions assigned to the current talk transcript,
        // move to the next. Cycle through available mock transcripts.
        if (p4UsageCount >= 3) {
          p4UsageCount = 0;
          p4TranscriptIdx = (p4TranscriptIdx + 1) % MOCK_PART4_TALKS.length;
        }
        const mockTalk = MOCK_PART4_TALKS[p4TranscriptIdx];
        const qInGroup = Math.min(p4UsageCount, mockTalk.questions.length - 1);
        const mockQ = mockTalk.questions[qInGroup];
        q['transcript'] = mockTalk.transcript;
        q['question'] = mockQ.question;
        // FR-GEN-13: shuffle options and set answer to shuffled position
        const shuffled = shuffleOptionsWithAnswer([...mockQ.options], mockQ.answer);
        q['options'] = shuffled.options;
        q['answer'] = shuffled.answer;
        p4UsageCount++;
      }
    }

    return q;
  });
}

// Normalize a Part 1 image field to a bare, valid Unsplash photo ID.
// The AI provider sometimes returns IDs already prefixed with 'photo'/'photo-'
// or malformed concatenations. The frontend builds the URL as
// 'photo-${id}', so we must store the bare ID (no 'photo' prefix) and ensure
// it matches the Unsplash format; otherwise fall back to a known-good ID.
function normalizeUnsplashId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let id = raw.trim().replace(/^photo-?/i, '');
  if (!/^\d+-[a-z0-9_-]+$/i.test(id)) return null;
  return id;
}

export function ensurePart1Images(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const expectedCounts = getExpectedPartCounts(questions.length);
  const expectedPart1 = expectedCounts[1] || 1;
  
  // Only inject images for the FIRST expectedPart1 Part 1 questions
  // Any extra Part 1 questions beyond expected get converted to Part 2
  let part1Index = 0;
  return questions.map(q => {
    if (q['part'] === 1 && q['type'] === 'listening') {
      if (part1Index < expectedPart1) {
        // This is a legitimate Part 1 question — normalize/ensure it has a
        // valid bare Unsplash photo ID (strips stray 'photo' prefix, falls
        // back to a known-good ID when missing or malformed).
        const normalized = normalizeUnsplashId(q['image']);
        if (!q['image'] || q['image'] === '' || normalized === null || normalized !== q['image'] || !KNOWN_P1_IDS.has(normalized)) {
          const fallback = PART1_DATA[Math.floor(Math.random() * PART1_DATA.length)];
          q['image'] = fallback.image;
          q['options'] = fallback.options;
          q['answer'] = fallback.answer;
        }
        part1Index++;
      } else {
        // Too many Part 1 questions — convert to Part 2 (Question-Response)
        // Part 2: the question is spoken, options are 3 spoken responses
        // Move the first option to be the question, keep remaining as responses
        q['part'] = 2;
        q['image'] = '';
        const opts = q['options'] as string[];
        if (opts && opts.length >= 3) {
          // Use a generic Part 2 question + 3 response options from the original descriptions
          q['question'] = 'Could you please tell me about the current project status?';
          q['transcript'] = '';
          q['options'] = opts.slice(0, 3); // Part 2 has only 3 options (A/B/C)
        } else {
          q['question'] = 'When will the meeting be rescheduled?';
          q['transcript'] = '';
          q['options'] = ['It has been moved to next Tuesday.', 'The meeting was canceled.', 'I will check the schedule and let you know.'];
        }
      }
    }
    return q;
  });
}
