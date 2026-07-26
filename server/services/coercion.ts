import {
  PART3_CONVERSATIONS,
  PART4_TALKS,
  PART5_FALLBACK_QUESTIONS,
  MOCK_PART5_FALLBACKS,
  MOCK_PART6_PASSAGES,
  extractKeywords,
  shuffleOptionsWithAnswer,
} from './mock-data.js';

// Fallback: ensure Part 2 questions have a spoken question in transcript
const PART2_FALLBACK_QUESTIONS = [
  'When is the deadline for the project submission?',
  'Where is the meeting scheduled to take place?',
  'How long will the training session last?',
  'Could you send me the updated report by this afternoon?',
  'What time does the conference call start?',
  'Who is responsible for the quarterly audit?',
  'Why was the product launch delayed?',
  'Would you like me to book the conference room?',
];

export function ensurePart2Transcripts(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let p2Index = 0;
  return questions.map(q => {
    if (q['part'] === 2 && q['type'] === 'listening') {
      if (!q['transcript'] || q['transcript'] === '') {
        q['transcript'] = PART2_FALLBACK_QUESTIONS[p2Index % PART2_FALLBACK_QUESTIONS.length];
        p2Index++;
      }
      // Ensure Part 2 has exactly 3 options (not 4)
      const opts = q['options'] as string[];
      if (opts && opts.length > 3) {
        q['options'] = opts.slice(0, 3);
      }
      // TOEIC spec: Part 2 question is spoken (lives in transcript/audio),
      // NEVER displayed on screen. q.question MUST be empty string.
      if (q['question'] && q['question'] !== '') {
        // Defensive: if AI put the spoken question only in q.question and
        // left transcript empty, preserve it in transcript before clearing.
        if ((!q['transcript'] || q['transcript'] === '') && typeof q['question'] === 'string') {
          q['transcript'] = q['question'];
        }
        q['question'] = '';
      }
    }
    return q;
  });
}

export function ensurePart34Transcripts(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let p3Index = 0;
  let p4Index = 0;
  return questions.map(q => {
    if (q['part'] === 3 && q['type'] === 'listening') {
      if (!q['transcript'] || q['transcript'] === '') {
        const conv = PART3_CONVERSATIONS[p3Index % PART3_CONVERSATIONS.length];
        q['transcript'] = conv.transcript;
        if (!q['question'] || q['question'] === '') q['question'] = conv.question;
        if ((!q['options'] || q['options'].length === 0) && conv.options) q['options'] = conv.options;
        if (!q['answer'] || q['answer'] === '') q['answer'] = conv.answer;
        p3Index++;
      }
    }
    if (q['part'] === 4 && q['type'] === 'listening') {
      if (!q['transcript'] || q['transcript'] === '') {
        const talk = PART4_TALKS[p4Index % PART4_TALKS.length];
        q['transcript'] = talk.transcript;
        if (!q['question'] || q['question'] === '') q['question'] = talk.question;
        if ((!q['options'] || q['options'].length === 0) && talk.options) q['options'] = talk.options;
        if (!q['answer'] || q['answer'] === '') q['answer'] = talk.answer;
        p4Index++;
      }
    }
    return q;
  });
}

// Part 5 fill-in-the-blank answer choice.
function isInvalidP5Option(opt: string): boolean {
  if (!opt || typeof opt !== 'string') return true;
  const trimmed = opt.trim();
  // Too short
  if (trimmed.length < 2) return true;
  // Purely numeric, %, degrees, currency, or symbols (no letters)
  if (/^[\d\s.,%°$€£¥#*+\-/\\=<>@!&(){}\[\]|;:]+$/.test(trimmed)) return true;
  // Contains only whitespace + punctuation / symbols
  if (!/[a-zA-Z]/.test(trimmed)) return true;
  return false;
}

export function ensurePart5Questions(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let p5Index = 0;

  return questions.map(q => {
    if (q['part'] === 5 && q['type'] === 'reading') {
      const hasEmpty = !q['question'] || q['question'] === '' || !q['options'] || (q['options'] as string[]).length < 4;

      // If the question or options are missing entirely, use full fallback
      if (hasEmpty) {
        const fb = PART5_FALLBACK_QUESTIONS[p5Index % PART5_FALLBACK_QUESTIONS.length];
        if (!q['question'] || q['question'] === '') q['question'] = fb.question;
        if (!q['options'] || (q['options'] as string[]).length < 4) q['options'] = fb.options;
        if (!q['answer'] || q['answer'] === '') q['answer'] = fb.answer;
        p5Index++;
        return q;
      }

      // Validate individual options: reject numeric-only, duplicate, too-short, symbol-only
      const opts = q['options'] as string[];
      const seen = new Set<string>();
      let allValid = true;

      for (const opt of opts) {
        const lower = opt.toLowerCase().trim();
        if (isInvalidP5Option(opt) || seen.has(lower)) {
          allValid = false;
          break;
        }
        seen.add(lower);
      }

      if (!allValid) {
        // Replace with a full mock question to guarantee coherence
        const fb = MOCK_PART5_FALLBACKS[p5Index % MOCK_PART5_FALLBACKS.length];
        q['question'] = fb.question;
        q['options'] = fb.options;

        // Randomly distribute the correct answer across A/B/C/D
        const correctIdx = Math.floor(Math.random() * 4);
        const answerKey = (['A', 'B', 'C', 'D'] as const)[correctIdx];
        q['answer'] = answerKey;

        // Rotate options so the correct answer is at the chosen index
        if (correctIdx !== 0) {
          const rotated = [...fb.options];
          const correctOption = rotated[0];
          rotated.splice(0, 1);
          rotated.splice(correctIdx, 0, correctOption);
          q['options'] = rotated;
        }

        console.warn(`[P5] Invalid options detected (id=${q['id']}) — replaced with mock fallback (answer=${answerKey})`);
        p5Index++;
      } else {
        // Options pass validation — still randomize answer position
        const opts = q['options'] as string[];
        const correctIdx = Math.floor(Math.random() * 4);
        const answerKey = (['A', 'B', 'C', 'D'] as const)[correctIdx];

        if (correctIdx !== 0) {
          const correctOption = opts[0];
          opts.splice(0, 1);
          opts.splice(correctIdx, 0, correctOption);
          q['options'] = opts;
        }

        q['answer'] = answerKey;
        p5Index++;
      }
    }
    return q;
  });
}

// Check if P6 question keywords appear in the passage text.
// Returns true if at least `threshold` content words from the question appear in the passage.
function isP6Aligned(passage: string, question: string, threshold = 2): boolean {
  const qWords = extractKeywords(question);
  if (qWords.length === 0) return true; // no keywords to check
  const passageLower = passage.toLowerCase();
  const matched = qWords.filter(w => passageLower.includes(w));
  return matched.length >= Math.min(threshold, qWords.length);
}

// Find the best matching MOCK_PART6 entry for a given passage, then return
// one of its questions that aligns with that passage.
function regenerateP6QuestionFromPassage(
  passage: string,
  fallbackIdx: number,
): { question: string; options: string[]; answer: string } {
  // Try to find a MOCK_PART6 entry whose passage is closest to ours
  for (const entry of MOCK_PART6_PASSAGES) {
    if (entry.passage === passage) {
      // Exact match — pick a question that aligns with this passage
      for (const q of entry.questions) {
        if (isP6Aligned(passage, q.question)) return q;
      }
      return entry.questions[0];
    }
  }

  // No exact match — find the entry whose passage shares the most keywords
  const passageKws = new Set(extractKeywords(passage));
  let bestEntry = MOCK_PART6_PASSAGES[fallbackIdx % MOCK_PART6_PASSAGES.length];
  let bestScore = 0;
  for (const entry of MOCK_PART6_PASSAGES) {
    const entryKws = extractKeywords(entry.passage);
    const overlap = entryKws.filter(k => passageKws.has(k)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestEntry = entry;
    }
  }

  // Pick the question from the best entry that aligns with our passage
  for (const q of bestEntry.questions) {
    if (isP6Aligned(passage, q.question)) return q;
  }
  return bestEntry.questions[0];
}

export function ensurePart6Questions(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let p6Index = 0;
  return questions.map(q => {
    if (q['part'] === 6 && q['type'] === 'reading') {
      const hasEmptyPassage = !q['passage'] || q['passage'] === '';
      const hasEmptyQuestion = !q['question'] || q['question'] === '';
      if (hasEmptyPassage || hasEmptyQuestion) {
        const entry = MOCK_PART6_PASSAGES[p6Index % MOCK_PART6_PASSAGES.length];
        if (hasEmptyPassage) q['passage'] = entry.passage;
        if (hasEmptyQuestion) {
          const localIdx = p6Index % entry.questions.length;
          const fb = entry.questions[localIdx];
          q['question'] = fb.question;
        }
        if (!q['options'] || (q['options'] as string[]).length < 4) {
          const localIdx = p6Index % entry.questions.length;
          q['options'] = entry.questions[localIdx].options;
        }
        if (!q['answer'] || q['answer'] === '') {
          const localIdx = p6Index % entry.questions.length;
          q['answer'] = entry.questions[localIdx].answer;
        }
      } else {
        // Passage and question both exist — verify alignment
        const passage = (q['passage'] as string) || '';
        const question = (q['question'] as string) || '';
        if (!isP6Aligned(passage, question)) {
          const replacement = regenerateP6QuestionFromPassage(passage, p6Index);
          console.warn(`[P6] Question keywords not in passage — regenerating (id=${q['id']})`);
          q['question'] = replacement.question;
          q['options'] = replacement.options;
          q['answer'] = replacement.answer;
        }
      }
      // FR-GEN-13: shuffle options and set answer to shuffled position
      const opts = q['options'] as string[];
      const ans = (q['answer'] as string) || 'A';
      const shuffled = shuffleOptionsWithAnswer(opts, ans);
      q['options'] = shuffled.options;
      q['answer'] = shuffled.answer;
      p6Index++;
    }
    return q;
  });
}

// Strip HTML tags from a string: replaces <br>, <br/>, <br /> with a space,
// then removes all remaining HTML tags.
export function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}
