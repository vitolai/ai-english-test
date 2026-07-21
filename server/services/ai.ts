import { generateObject, streamObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelFactory = (modelId: string) => any;

// ============================================================
// ZOD SCHEMAS (AI structured output)
// ============================================================

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

export const ExamSchema = z.object({
  questions: z.array(QuestionSchema),
});

export class RetryableDistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableDistributionError';
  }
}

// Fallback: ensure Part 1 questions always have an image
// Verified-working Unsplash photo IDs (return HTTP 200) used as fallbacks
// in ensurePart1Images. Kept in sync with PART1_DATA so that any fallback image
// also has a matching set of descriptive options in the mock generator.
const FALLBACK_PHOTO_IDS = [
  '1556761175-b413da4baf72','1497366216548-37526070297c','1524758631624-e2822e304c36',
  '1591115765373-5207764f72e7','1450101499163-c8848c66ca85','1556740738-b6a63e27c4df',
  '1517502884422-41eaead166d4','1504384308090-c894fdcc538d','1553028826-f4804a6dba3b',
  '1573164713714-d95e436ab8d6','1498050108023-c5249f4df085','1554224155-6726b3ff858f',
  '1522071820081-009f0129c71c','1515187029135-18ee286d815b','1486312338219-ce68d2c6f44d',
  '1527192491265-7e15c55b1ed2','1497366754035-f200968a6e72','1497215842964-222b430dc094',
  '1519389950473-47ba0277781c',
];

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

// Normalize Part 2 (Question-Response): q.question MUST be empty string.
// Per TOEIC spec, Part 2 is audio-only — the spoken question lives in
// q.transcript + audio, never on screen. The real-AI provider sometimes
// returns a non-empty q.question; this normalizer strips it back to "".
// Mirrors the ensurePart1Images / ensurePart34Transcripts pattern.
export function ensurePart2EmptyQuestion(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return questions.map(q => {
    if (q['part'] === 2 && q['type'] === 'listening') {
      if (q['question'] && q['question'] !== '') {
        // Preserve the spoken question in transcript if AI put it only in question
        // and transcript is empty (defensive — do not overwrite a real transcript).
        if ((!q['transcript'] || q['transcript'] === '') && typeof q['question'] === 'string') {
          q['transcript'] = q['question'];
        }
        q['question'] = '';
      }
    }
    return q;
  });
}


// Fallback: ensure Part 3/4 questions have transcript (conversation/talk) and question text
const PART3_CONVERSATIONS = [
  { transcript: "Michael: Did you finish the quarterly report? Jennifer: Almost. I just need to verify the sales figures. Michael: Can you send it by 3 PM? Jennifer: Sure, I'll email it as soon as I verify the numbers.", question: "What is the woman doing?", options: ["Verifying sales figures", "Writing the report", "Sending an email", "Attending a meeting"], answer: "A" },
  { transcript: "Jennifer: When is the deadline for the project proposal? Michael: The client wants it by Friday. Jennifer: That gives us three days. Michael: I'll work on the budget section today.", question: "When is the deadline?", options: ["Monday", "Wednesday", "Friday", "Next week"], answer: "C" },
  { transcript: "Michael: Have you seen the email from the client? Jennifer: Yes, they want to schedule a meeting next week. Michael: What about Thursday morning? Jennifer: That works. I'll confirm with them.", question: "What are they discussing?", options: ["Scheduling a meeting", "Reviewing a contract", "Planning an event", "Hiring a manager"], answer: "A" },
  { transcript: "Jennifer: The new software update is ready for testing. Michael: Has the QA team started? Jennifer: They begin tomorrow. Michael: Good, let me know if there are any critical bugs.", question: "What will happen tomorrow?", options: ["QA testing begins", "Software launches", "Update releases", "Meeting with client"], answer: "A" },
  { transcript: "Michael: How was the client presentation yesterday? Jennifer: It went well. They asked several questions about the timeline. Michael: Did they approve the budget? Jennifer: They want to review it internally first.", question: "What did the client ask about?", options: ["Timeline", "Budget", "Team", "Strategy"], answer: "A" },
  { transcript: "Michael: Did you receive the shipment notification? Jennifer: Yes, it arrives tomorrow morning. Michael: Will you inspect it immediately? Jennifer: Absolutely. I'll check the quality before distribution.", question: "When does the shipment arrive?", options: ["Tomorrow morning", "This afternoon", "Next week", "Today"], answer: "A" },
  { transcript: "Jennifer: The marketing campaign launched last Monday. Michael: How are the initial results? Jennifer: Better than expected. Engagement is up 20%. Michael: Great. Let's increase the ad spend.", question: "What were the results?", options: ["Better than expected", "As expected", "Worse than expected", "Mixed"], answer: "A" },
  { transcript: "Michael: We need to hire two more developers. Jennifer: I'll post the job listings today. Michael: What about the budget? Jennifer: HR approved the salary range.", question: "What will the woman do?", options: ["Post job listings", "Interview candidates", "Review salaries", "Train new hires"], answer: "A" },
  { transcript: "Jennifer: The quarterly review is next Thursday. Michael: Have you prepared the slides? Jennifer: Almost done. I need the latest sales data. Michael: I'll send it by Tuesday.", question: "When is the quarterly review?", options: ["Next Thursday", "This Friday", "Next Tuesday", "Next Monday"], answer: "A" },
  { transcript: "Michael: The server went down at 3 AM. Jennifer: Was data lost? Michael: No, backups worked. Jennifer: Good. Let's investigate the root cause.", question: "What happened at 3 AM?", options: ["Server went down", "Backup failed", "Data was lost", "System updated"], answer: "A" },
];

const PART4_TALKS = [
  { transcript: "Good morning, everyone. Thank you for joining today's quarterly business review. Our revenue increased 15% year over year, driven by strong performance in the Asia-Pacific region. However, operating costs rose 8% due to supply chain disruptions. We're implementing cost-saving measures starting next quarter.", question: "What drove the revenue increase?", options: ["Strong Asia-Pacific performance", "New product launch", "Price increases", "Cost reductions"], answer: "A" },
  { transcript: "Attention all employees. The annual wellness program begins next month. We've partnered with local gyms to offer discounted memberships. Registration opens next Monday. Participants who complete the 12-week program will receive a $200 bonus.", question: "When does registration open?", options: ["Next Monday", "Next Friday", "First of next month", "Today"], answer: "A" },
  { transcript: "Welcome to the new employee orientation. Today we'll cover company policies, benefits enrollment, and IT setup. Your mentor will contact you by end of week. Please complete the online compliance training by end of month.", question: "What is the deadline for compliance training?", options: ["End of month", "End of week", "Next month", "End of quarter"], answer: "A" },
  { transcript: "Our new product launch is scheduled for Q3. The marketing team has prepared a comprehensive campaign including digital ads, social media, and influencer partnerships. We're targeting the 25-40 demographic in urban markets.", question: "When is the product launching?", options: ["Q3", "Q2", "Q4", "Next year"], answer: "A" },
  { transcript: "Due to increased demand, we're expanding our warehouse operations in Dallas. The new facility will add 200,000 square feet of storage and create 150 new jobs. Construction begins next month.", question: "Where is the new warehouse?", options: ["Dallas", "Houston", "Austin", "San Antonio"], answer: "A" },
  { transcript: "Our cybersecurity team detected a phishing attempt targeting the finance department. The email appeared to be from a vendor requesting payment. Please remember: never click links in unsolicited emails. Report suspicious emails to IT immediately.", question: "What department was targeted?", options: ["Finance", "HR", "IT", "Marketing"], answer: "A" },
  { transcript: "The board approved the acquisition of TechStart Inc. for $50 million. The deal is expected to close by end of Q2. TechStart's AI platform will be integrated into our product suite.", question: "How much is the acquisition?", options: ["$50 million", "$25 million", "$75 million", "$100 million"], answer: "A" },
  { transcript: "Starting next month, all employees must use the new expense reporting system. The old system will be deactivated. Training sessions are scheduled for next week. Contact HR with questions.", question: "When does the old system shut down?", options: ["Next month", "Next week", "End of quarter", "Immediately"], answer: "A" },
  { transcript: "Our sustainability initiative reduced carbon emissions by 30% last year. We installed solar panels at three facilities and switched to electric vehicles for the corporate fleet. We're targeting 50% reduction by 2027.", question: "What is the 2027 target?", options: ["50% reduction", "30% reduction", "Carbon neutral", "100% renewable"], answer: "A" },
  { transcript: "The client meeting is rescheduled to Thursday at 2 PM. Please update your calendars. The agenda includes project timeline, budget review, and deliverables. Please prepare your status reports.", question: "When is the meeting now?", options: ["Thursday at 2 PM", "Wednesday at 3 PM", "Friday at 10 AM", "Monday at 1 PM"], answer: "A" },
];

// --- Part 6: Text Completion (passage with fill-in-the-blank questions) ---
// Each passage contains numbered blanks (1), (2), (3). The questions array
// has one entry per blank, and each question refers to the sentence context
// surrounding that blank in the passage.
const MOCK_PART6_PASSAGES: { passage: string; questions: { question: string; options: string[]; answer: string }[] }[] = [
  {
    passage: "Dear Valued Customer,\n\nThank you for your recent purchase from our online store. We are pleased to confirm that your order has been (1)______ and will be shipped within 2 business days. If you have any questions about your order, please don't hesitate to (2)______ our customer service team at support@example.com.\n\nSincerely,\nThe Customer Service Team",
    questions: [
      { question: "1. Your order has been ______ and will be shipped within 2 business days.", options: ["processed", "process", "processing", "processes"], answer: "A" },
      { question: "2. Please don't hesitate to ______ our customer service team.", options: ["contact", "contacts", "contacted", "contacting"], answer: "A" },
    ],
  },
  {
    passage: "To: All Department Managers\nFrom: Human Resources\nSubject: Quarterly Performance Reviews\n\nPlease be reminded that quarterly performance reviews must be (1)______ by the end of this month. Managers are expected to schedule one-on-one meetings with each team member to discuss goals, achievements, and areas for (2)______. Completed forms should be submitted to the HR office no later than the last business day of the quarter.",
    questions: [
      { question: "1. Quarterly performance reviews must be ______ by the end of this month.", options: ["completed", "complete", "completing", "completes"], answer: "A" },
      { question: "2. Managers should discuss goals, achievements, and areas for ______.", options: ["improvement", "improve", "improved", "improving"], answer: "A" },
    ],
  },
  {
    passage: "NOTICE: Office Renovation\n\nBeginning Monday, the third floor will be closed for renovations. Employees currently stationed on the third floor are (1)______ to temporarily relocate to the second floor. Desks and equipment will be moved over the weekend. Please ensure all personal items are (2)______ in labeled boxes before Friday end of business. The renovation is expected to last approximately six weeks.",
    questions: [
      { question: "1. Employees on the third floor are ______ to temporarily relocate to the second floor.", options: ["required", "require", "requiring", "requires"], answer: "A" },
      { question: "2. Please ensure all personal items are ______ in labeled boxes before Friday.", options: ["placed", "place", "placing", "places"], answer: "A" },
    ],
  },
  {
    passage: "Company Picnic Announcement\n\nWe are excited to announce that the annual company picnic will be held at Riverside Park on Saturday, August 15th. The event will (1)______ from 11 AM to 4 PM. Lunch and refreshments will be (2)______. Employees are welcome to bring their families. Please RSVP by August 1st to help us plan for seating and catering.",
    questions: [
      { question: "1. The event will ______ from 11 AM to 4 PM.", options: ["take place", "takes place", "taking place", "taken place"], answer: "A" },
      { question: "2. Lunch and refreshments will be ______.", options: ["provided", "provide", "providing", "provides"], answer: "A" },
    ],
  },
  {
    passage: "Memo: IT System Upgrade\n\nPlease be advised that a major system upgrade will be (1)______ this weekend, Saturday and Sunday. During this time, all company email and intranet services will be temporarily (2)______. Employees are encouraged to save all work and log off before 5 PM on Friday. Technical support will be available (3)______ via the IT help desk hotline.",
    questions: [
      { question: "1. A major system upgrade will be ______ this weekend.", options: ["performed", "perform", "performing", "performs"], answer: "A" },
      { question: "2. Email and intranet services will be temporarily ______.", options: ["unavailable", "available", "availability", "availably"], answer: "A" },
      { question: "3. Technical support will be available ______ via the IT help desk hotline.", options: ["throughout", "through", "thorough", "thoroughly"], answer: "A" },
    ],
  },
  {
    passage: "Job Posting: Marketing Coordinator\n\nXYZ Corporation is seeking a (1)______ Marketing Coordinator to join our growing team. The ideal candidate will have at least two years of experience in digital marketing and a strong (2)______ of social media platforms. This is a full-time (3)______ position with benefits. Please submit your resume and cover letter by the end of the month.",
    questions: [
      { question: "1. XYZ Corporation is seeking a ______ Marketing Coordinator.", options: ["qualified", "qualify", "qualifying", "qualifies"], answer: "A" },
      { question: "2. The ideal candidate will have a strong ______ of social media platforms.", options: ["understanding", "understand", "understood", "understandingly"], answer: "A" },
      { question: "3. This is a full-time ______ position with benefits.", options: ["permanent", "permanently", "permanence", "permanency"], answer: "A" },
    ],
  },
  {
    passage: "Customer Service Update\n\nWe are writing to inform you that our return policy has been (1)______ effective immediately. Customers now have 30 days from the date of purchase to return (2)______ items for a full refund. Items must be in their original packaging and accompanied by a (3)______. For more details, please visit our website or contact your nearest store.",
    questions: [
      { question: "1. Our return policy has been ______ effective immediately.", options: ["updated", "update", "updating", "updates"], answer: "A" },
      { question: "2. Customers can return ______ items for a full refund.", options: ["unopened", "open", "opening", "opens"], answer: "A" },
      { question: "3. Items must be accompanied by a ______.", options: ["receipt", "receive", "received", "receiving"], answer: "A" },
    ],
  },
  {
    passage: "Training Workshop Invitation\n\nYou are cordially invited to attend a professional development workshop on effective communication in the workplace. The session will be (1)______ by Dr. Sarah Chen, a renowned expert in organizational behavior. Attendance is (2)______ for all team leads and strongly encouraged for other staff members. Please confirm your attendance by replying to this email (3)______ Friday.",
    questions: [
      { question: "1. The session will be ______ by Dr. Sarah Chen.", options: ["led", "lead", "leading", "leads"], answer: "A" },
      { question: "2. Attendance is ______ for all team leads.", options: ["mandatory", "mandate", "mandated", "mandating"], answer: "A" },
      { question: "3. Please confirm your attendance by replying ______ Friday.", options: ["before", "beforely", "beforing", "befored"], answer: "A" },
    ],
  },
];

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

// Fallback: ensure Part 5 questions have fill-in-the-blank format
const PART5_FALLBACK_QUESTIONS = [
  { question: "Please ______ the financial statements before the audit.", options: ["submit", "submits", "submitted", "submitting"], answer: "A" },
  { question: "Despite the heavy rain, the flight ______ as scheduled.", options: ["departed", "depart", "departing", "departs"], answer: "A" },
  { question: "The committee members ______ with the proposal after long discussion.", options: ["agreed", "agree", "agreeing", "agreement"], answer: "A" },
  { question: "All employees must ______ the safety training by end of quarter.", options: ["complete", "completes", "completed", "completing"], answer: "A" },
  { question: "The new policy will take ______ starting next month.", options: ["effect", "affect", "effective", "effects"], answer: "A" },
  { question: "The manager asked the team to ______ the project timeline.", options: ["review", "reviews", "reviewing", "reviewed"], answer: "A" },
  { question: "We appreciate your ______ in this matter.", options: ["patience", "patient", "patients", "patiently"], answer: "A" },
  { question: "The conference room has been ______ for tomorrow's meeting.", options: ["reserved", "reserve", "reserving", "reserves"], answer: "A" },
];

export function ensurePart5Questions(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let p5Index = 0;
  return questions.map(q => {
    if (q['part'] === 5 && q['type'] === 'reading') {
      if (!q['question'] || q['question'] === '' || !q['options'] || (q['options'] as string[]).length < 4) {
        const fb = PART5_FALLBACK_QUESTIONS[p5Index % PART5_FALLBACK_QUESTIONS.length];
        if (!q['question'] || q['question'] === '') q['question'] = fb.question;
        if (!q['options'] || (q['options'] as string[]).length < 4) q['options'] = fb.options;
        if (!q['answer'] || q['answer'] === '') q['answer'] = fb.answer;
        p5Index++;
      }
    }
    return q;
  });
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
        p6Index++;
      }
    }
    return q;
  });
}

// Strip HTML tags from a string: replaces <br>, <br/>, <br /> with a space,
// then removes all remaining HTML tags.
function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function ensurePart7Questions(questions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return questions.map(q => {
    if (q['part'] === 7 && q['type'] === 'reading') {
      if (q['question'] && typeof q['question'] === 'string') {
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

export type ExamData = z.infer<typeof ExamSchema>;

// ============================================================
// PROVIDER CHAIN TYPES
// ============================================================

export interface ProviderEntry {
  id: string;
  model: string;
  apiKey: string;
  baseURL?: string;
}

// ============================================================
// AI SDK PROVIDER FACTORY
// ============================================================

export function createLanguageModel(providerId: string, apiKey: string, baseURL?: string): ModelFactory {
  if (providerId === 'groq') {
    const groq = createGroq({ apiKey });
    return groq;
  }

  return createOpenAI({
    apiKey: apiKey || 'missing-key',
    ...(baseURL ? { baseURL } : {}),
    name: providerId,
  });
}

// ============================================================
// GENERATE WITH FALLBACK
// ============================================================

export async function generateWithFallback(
  chain: ProviderEntry[],
  schema: z.ZodSchema,
  prompt: string,
  maxRetries = 2,
) {
  let lastError: Error | undefined;

  for (const entry of chain) {
    try {
      console.log(`[AI] Trying provider: ${entry.id} / ${entry.model}`);
      const providerFactory = createLanguageModel(entry.id, entry.apiKey, entry.baseURL);
      const model = providerFactory(entry.model);
      const result = await generateObject({
        model,
        schema,
        prompt,
        maxRetries,
      });
      console.log(`[AI] Success with provider: ${entry.id}`);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] Provider ${entry.id} failed: ${lastError.message}`);
    }
  }

  throw lastError || new Error('All providers failed');
}

// ============================================================
// STREAM WITH FALLBACK
// ============================================================

export async function streamWithFallback(
  chain: ProviderEntry[],
  schema: z.ZodSchema,
  prompt: string,
  maxRetries = 2,
) {
  let lastError: Error | undefined;

  for (const entry of chain) {
    try {
      console.log(`[AI] Streaming with provider: ${entry.id} / ${entry.model}`);
      const providerFactory = createLanguageModel(entry.id, entry.apiKey, entry.baseURL);
      const model = providerFactory(entry.model);
      const result = streamObject({
        model,
        schema,
        prompt,
        maxRetries,
      });
      console.log(`[AI] Stream started: ${entry.id}`);
      return { result, providerId: entry.id };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] Provider ${entry.id} stream failed: ${lastError.message}`);
    }
  }

  throw lastError || new Error('All providers failed');
}

// ============================================================
// PROVIDER CHAIN BUILDER
// ============================================================

interface FallbackConfig {
  id: string;
  model: string;
  apiKey: string;
  baseURL?: string;
}

interface RequestConfig {
  providerId?: string;
  baseURL?: string;
  fallbacks?: FallbackConfig[];
}

export function buildProviderChain(
  config: RequestConfig | undefined,
  model: string | undefined,
  apiKey: string | undefined,
): ProviderEntry[] {
  const chain: ProviderEntry[] = [];

  if (config?.providerId && model && apiKey) {
    chain.push({
      id: config.providerId,
      model,
      apiKey,
      baseURL: config.baseURL,
    });
  }

  if (config?.fallbacks && Array.isArray(config.fallbacks)) {
    for (const fb of config.fallbacks) {
      if (fb.id && fb.model && fb.apiKey) {
        chain.push({
          id: fb.id,
          model: fb.model,
          apiKey: fb.apiKey,
          baseURL: fb.baseURL,
        });
      }
    }
  }

  return chain;
}

// ============================================================
// PART 1 LOGIC
// ============================================================

// Unified TOEIC distribution based on real exam ratios
// Real TOEIC 100Q listening: P1=6, P2=25, P3=39, P4=30
// Real TOEIC 100Q reading: P5=30, P6=16, P7=54
// Our app: 50% listening, 50% reading, scaled proportionally
export function getQuestionDistribution(questionCount: number): {
  listening: { part1: number; part2: number; part3: number; part4: number };
  reading: { part5: number; part6: number; part7: number };
} {
  const half = Math.floor(questionCount / 2);
  // Listening distribution (P1=6%, P2=25%, P3=39%, P4=30% of listening)
  // Part 3 & 4 must be multiples of 3 (3 questions per conversation/talk)
  const part1 = Math.max(1, Math.round(half * 0.06));
  let part2 = Math.max(1, Math.round(half * 0.25));
  // Round Part 3 to nearest multiple of 3
  const part3Raw = Math.round(half * 0.39);
  let part3 = Math.max(3, Math.round(part3Raw / 3) * 3);
  // Part 4: remainder (ensure at least 1 question for small counts)
  let part4Raw = half - part1 - part2 - part3;
  let part4 = Math.max(0, Math.round(part4Raw / 3) * 3);
  // For small question counts, steal from Part 3 to give Part 4 at least 1.
  // INVARIANT: sum(listening) === half. Steal exactly 1 from part3 (3->2),
  // give 1 to part4 (0->1): net 0, total preserved. (Round 6 Bug 2: the
  // previous code removed 2 and added 1, losing 1 from the total at scales
  // 10 and 100.)
  if (part4 === 0 && half >= 4) {
    part3 = Math.max(1, part3 - 1);  // remove 1 from P3
    part4 = 1;                       // add 1 to P4  → net 0
  }
  // Adjust if total exceeds half. Reduce part4 (in multiples of 3) first,
  // then part3; the removed count is added back to part2 so the listening
  // total stays exactly  (INVARIANT preserved). (Round 6 Bug 2: the
  // previous code dropped the excess silently, making scale 50 produce 51.)
  const totalListening = part1 + part2 + part3 + part4;
  if (totalListening > half) {
    const excess = totalListening - half;
    const reduce4 = Math.min(part4, Math.round(excess / 3) * 3);
    part4 -= reduce4;
    let remaining = excess - reduce4;
    if (remaining > 0) {
      const reduce3 = Math.min(part3 - 1, Math.round(remaining / 3) * 3);
      part3 -= reduce3;
      remaining -= reduce3;
    }
    // Anything still over (rounding residue) comes off part2, which has no
    // multiple-of-3 constraint and can absorb a unit change cleanly.
    if (remaining > 0) {
      const reduce2 = Math.min(part2 - 1, remaining);
      part2 -= reduce2;
      remaining -= reduce2;
    }
    // Guard: if somehow still off, trim part7's counterpart is NOT possible
    // here (reading computed below) — instead nudge part4 by the residue.
    if (remaining > 0) {
      part4 = Math.max(0, part4 - remaining);
    }
  }
  // If total is BELOW half (multiples-of-3 rounding leaves a gap, e.g.
  // n=100 where part3=21 + part4=12 = 33 < 50-part1-part2=34), add the
  // deficit to part2 (no multiple-of-3 constraint) so the listening total
  // reaches exactly . INVARIANT: sum(listening) === half.
  const deficit = half - (part1 + part2 + part3 + part4);
  if (deficit > 0) {
    part2 += deficit;
  }
  // Reading distribution (P5=30%, P6=16%, P7=54% of reading)
  const part5 = Math.max(1, Math.round(half * 0.30));
  const part6 = Math.max(1, Math.round(half * 0.16));
  const part7 = Math.max(0, half - part5 - part6);
  return {
    listening: { part1, part2, part3, part4 },
    reading: { part5, part6, part7 },
  };
}

export function getPart1Count(
  questionCount: number,
  startId: number,
): { total: number; needed: number } {
  const dist = getQuestionDistribution(questionCount);
  const part1Count = dist.listening.part1;
  return { total: part1Count, needed: Math.max(0, part1Count - startId + 1) };
}

// Get expected counts for all parts (used by ensurePart functions)
export function getExpectedPartCounts(questionCount: number): Record<number, number> {
  const dist = getQuestionDistribution(questionCount);
  return {
    1: dist.listening.part1,
    2: dist.listening.part2,
    3: dist.listening.part3,
    4: dist.listening.part4,
    5: dist.reading.part5,
    6: dist.reading.part6,
    7: dist.reading.part7,
  };
}

export function buildPart1Instruction(
  startId: number,
  chunkSize: number,
  part1: { total: number; needed: number },
  questionCount: number,
): string {
  if (part1.needed > 0) {
    const count = Math.min(chunkSize, part1.needed);
    const photoCount = questionCount <= 100 ? 3 : questionCount >= 200 ? 6 : 4;
    const shuffled = [...PART1_DATA].sort(() => Math.random() - 0.5).slice(0, photoCount);
    const photoExamples = shuffled.map((d, i) =>
      `Photo ${i + 1}: ID "${d.image}" — "${d.options[0]}"`
    ).join("\n");
    return [
      "",
      "PART 1 (PHOTOGRAPHS) - GENERATE " + count + " QUESTION(S):",
      "IDs " + startId + " through " + (startId + count - 1) + ".",
      "Each Part 1 question MUST have:",
      "- part: 1, type: \"listening\"",
      "- image: an Unsplash photo ID (string), unique per question",
      "- transcript: \"\" (empty string - audio plays separately)",
      "- question: \"Look at the photograph and listen to the four statements. Choose the statement that best describes what you see in the picture.\"",
      "- options: array of 4 descriptive statements about a photo",
      "- answer: one of \"A\", \"B\", \"C\", \"D\"",
      "",
      "Use one of these verified photo IDs (each ID is paired with its first option as description):",
      photoExamples,
      "",
    ].join("\n");
  }
  return "";
}

export function getExamTimes(questionCount: number): { listeningTime: number; readingTime: number } {
  const known: Array<{ q: number; l: number; r: number }> = [
    { q: 10, l: 300, r: 300 },
    { q: 20, l: 480, r: 720 },
    { q: 50, l: 1200, r: 1800 },
    { q: 100, l: 1800, r: 1800 },
    { q: 200, l: 2700, r: 4500 },
  ];

  // Clamp to known range
  const n = Math.max(known[0].q, Math.min(questionCount, known[known.length - 1].q));

  // Exact match
  for (const k of known) {
    if (n === k.q) return { listeningTime: k.l, readingTime: k.r };
  }

  // Find bracketing points for linear interpolation
  let lo = known[0];
  let hi = known[known.length - 1];
  for (let i = 0; i < known.length - 1; i++) {
    if (n > known[i].q && n < known[i + 1].q) {
      lo = known[i];
      hi = known[i + 1];
      break;
    }
  }

  const t = (n - lo.q) / (hi.q - lo.q);
  return {
    listeningTime: Math.round(lo.l + t * (hi.l - lo.l)),
    readingTime: Math.round(lo.r + t * (hi.r - lo.r)),
  };
}

// ============================================================
// MOCK DATA GENERATOR
// ============================================================

// --- Part 1: Photographs (empty transcript, 4 descriptive options) ---
// Each entry PAIRS a verified-working Unsplash photo ID with four descriptive
// statements whose CORRECT answer (the `answer` field) actually describes that
// photograph. The photo and options are ALIGNED BY INDEX so the audio spoken
// for a question always matches the displayed image. Photo IDs were verified
// to return HTTP 200 from images.unsplash.com and visually inspected to
// confirm the scene matches the correct option text.
// Auto-generated by scripts/gen_p1_data.py — DO NOT EDIT MANUALLY
const PART1_DATA: { image: string; options: string[]; answer: 'A' | 'B' | 'C' | 'D' }[] = [
  // Photo 1: Unsplash ID 1556761175-b413da4baf72
  {
    image: '1556761175-b413da4baf72',
    options: [
      'Three colleagues are collaborating around a wooden desk with laptops in a modern open-plan office.',
      'A delivery truck is being unloaded at a warehouse loading dock.',
      'A technician is repairing a copy machine in a corridor.',
      'A customer is returning a product at a service counter.',
    ],
    answer: 'A',
  },
  // Photo 2: Unsplash ID 1497366216548-37526070297c
  {
    image: '1497366216548-37526070297c',
    options: [
      'A woman is speaking on the phone at her reception desk.',
      'An empty modern office corridor with glass partitions, polished floors, and a wooden shelving unit.',
      'People are entering a building through revolving glass doors.',
      'A security guard is checking identification badges at a desk.',
    ],
    answer: 'B',
  },
  // Photo 3: Unsplash ID 1524758631624-e2822e304c36
  {
    image: '1524758631624-e2822e304c36',
    options: [
      'A technician is repairing a copy machine in a copy room.',
      'Office workers are having a discussion near a window.',
      'A modern office lounge area with minimalist armchairs, a sofa, and a large black floor lamp.',
      'A delivery truck is being unloaded at a warehouse.',
    ],
    answer: 'C',
  },
  // Photo 4: Unsplash ID 1591115765373-5207764f72e7
  {
    image: '1591115765373-5207764f72e7',
    options: [
      'A worker is adjusting a ceiling light fixture.',
      'An employee is filing documents in a cabinet.',
      'Two colleagues are shaking hands in a hallway.',
      'A person is giving a presentation to a seated audience in an industrial-style office.',
    ],
    answer: 'D',
  },
  // Photo 5: Unsplash ID 1450101499163-c8848c66ca85
  {
    image: '1450101499163-c8848c66ca85',
    options: [
      'A delivery truck is being unloaded at a warehouse.',
      'A person in a blue shirt is signing a document with a pen on a desk.',
      'A team is collaborating around a conference table.',
      'A security guard is checking identification badges at a desk.',
    ],
    answer: 'B',
  },
  // Photo 6: Unsplash ID 1556740738-b6a63e27c4df
  {
    image: '1556740738-b6a63e27c4df',
    options: [
      'A group of employees are seated around a large conference table during a meeting.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'A',
  },
  // Photo 7: Unsplash ID 1517502884422-41eaead166d4
  {
    image: '1517502884422-41eaead166d4',
    options: [
      'A receptionist is greeting a visitor at the front desk of an office building.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'B',
  },
  // Photo 8: Unsplash ID 1504384308090-c894fdcc538d
  {
    image: '1504384308090-c894fdcc538d',
    options: [
      'Two business professionals are shaking hands after closing a deal in a boardroom.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'C',
  },
  // Photo 9: Unsplash ID 1522071820081-009f0129c71c
  {
    image: '1522071820081-009f0129c71c',
    options: [
      'A team leader is writing on a whiteboard during a strategy session.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'D',
  },
  // Photo 10: Unsplash ID 1553028826-f4804a6dba3b
  {
    image: '1553028826-f4804a6dba3b',
    options: [
      'Colleagues are gathered around a laptop discussing a project in a bright office.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'A',
  },
  // Photo 11: Unsplash ID 1573164713714-d95e436ab8d6
  {
    image: '1573164713714-d95e436ab8d6',
    options: [
      'An employee is typing on a laptop at a clean, organized desk with a potted plant.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'A',
  },
  // Photo 12: Unsplash ID 1498050108023-c5249f4df085
  {
    image: '1498050108023-c5249f4df085',
    options: [
      'A messy desk covered with paperwork, sticky notes, and two computer monitors.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 13: Unsplash ID 1554224155-6726b3ff858f
  {
    image: '1554224155-6726b3ff858f',
    options: [
      'A standing desk with dual monitors, a keyboard, and a small succulent plant in a bright office.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'C',
  },
  // Photo 14: Unsplash ID 1522071820081-009f0129c71c
  {
    image: '1522071820081-009f0129c71c',
    options: [
      'A corner office with a large window overlooking a city skyline and a mahogany desk.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 15: Unsplash ID 1515187029135-18ee286d815b
  {
    image: '1515187029135-18ee286d815b',
    options: [
      'A home office setup with a monitor, keyboard, and ergonomic chair in front of a window.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'A',
  },
  // Photo 16: Unsplash ID 1486312338219-ce68d2c6f44d
  {
    image: '1486312338219-ce68d2c6f44d',
    options: [
      'An open-plan workspace with rows of identical desks and task chairs under fluorescent lights.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 17: Unsplash ID 1527192491265-7e15c55b1ed2
  {
    image: '1527192491265-7e15c55b1ed2',
    options: [
      'A minimalist desk with a tablet, a coffee mug, and a notepad in a sunlit room.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'C',
  },
  // Photo 18: Unsplash ID 1497366754035-f200968a6e72
  {
    image: '1497366754035-f200968a6e72',
    options: [
      'A collaborative workspace with bean bags, whiteboards, and colorful wall art.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 19: Unsplash ID 1497215842964-222b430dc094
  {
    image: '1497215842964-222b430dc094',
    options: [
      'A private office with a glass desk, two monitors, and a filing cabinet against the wall.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'A',
  },
  // Photo 20: Unsplash ID 1519389950473-47ba0277781c
  {
    image: '1519389950473-47ba0277781c',
    options: [
      'A woman is writing on a notepad while seated at a conference table.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'B',
  },
  // Photo 21: Unsplash ID 1521737604893-d14cc237f11d
  {
    image: '1521737604893-d14cc237f11d',
    options: [
      'A man is reviewing printed reports while holding a cup of coffee at his desk.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'C',
  },
  // Photo 22: Unsplash ID 1542744173-8e7e53415bb0
  {
    image: '1542744173-8e7e53415bb0',
    options: [
      'Two colleagues are looking at a tablet together in a break room.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'D',
  },
  // Photo 23: Unsplash ID 1497366811353-6870744d04b2
  {
    image: '1497366811353-6870744d04b2',
    options: [
      'A team of engineers is gathered around a prototype on a lab bench.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'A',
  },
  // Photo 24: Unsplash ID 1556761223-4c4282c73f77
  {
    image: '1556761223-4c4282c73f77',
    options: [
      'An accountant is working on a spreadsheet at a desk cluttered with calculators.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'B',
  },
  // Photo 25: Unsplash ID 1521791136064-7986c2920216
  {
    image: '1521791136064-7986c2920216',
    options: [
      'A marketing specialist is brainstorming ideas on a colorful sticky-note wall.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'C',
  },
  // Photo 26: Unsplash ID 1553877522-43269d4ea984
  {
    image: '1553877522-43269d4ea984',
    options: [
      'A project manager is pointing at a Gantt chart on a large wall display.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'D',
  },
  // Photo 27: Unsplash ID 1531973576160-7125cd663d86
  {
    image: '1531973576160-7125cd663d86',
    options: [
      'A software developer is coding on a dual-monitor setup with a mechanical keyboard.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'A',
  },
  // Photo 28: Unsplash ID 1560472354-b33ff0c44a43
  {
    image: '1560472354-b33ff0c44a43',
    options: [
      'A human resources officer is interviewing a candidate across a small table.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'B',
  },
  // Photo 29: Unsplash ID 1517245386807-bb43f82c33c4
  {
    image: '1517245386807-bb43f82c33c4',
    options: [
      'A logistics coordinator is checking shipping schedules on a large monitor.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'C',
  },
  // Photo 30: Unsplash ID 1513364776144-60967b0f800f
  {
    image: '1513364776144-60967b0f800f',
    options: [
      'A bright cafeteria with long tables, pendant lights, and employees eating lunch.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'D',
  },
  // Photo 31: Unsplash ID 1551836022-deb4988cc6c0
  {
    image: '1551836022-deb4988cc6c0',
    options: [
      'An executive boardroom with a long table, leather chairs, and a city view through floor-to-ceiling windows.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'A',
  },
  // Photo 32: Unsplash ID 1519389950473-47ba0277781c
  {
    image: '1519389950473-47ba0277781c',
    options: [
      'A small startup office with exposed brick walls, hanging plants, and standing desks.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'B',
  },
  // Photo 33: Unsplash ID 1553028826-f4804a6dba3b
  {
    image: '1553028826-f4804a6dba3b',
    options: [
      'A reception area with a curved wooden desk, company logo on the wall, and comfortable seating.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'C',
  },
  // Photo 34: Unsplash ID 1556745757-8d76bdb6984b
  {
    image: '1556745757-8d76bdb6984b',
    options: [
      'A modern open office with rows of sit-stand desks and monitors under track lighting.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'D',
  },
  // Photo 35: Unsplash ID 1507003211169-0a1dd7228f2d
  {
    image: '1507003211169-0a1dd7228f2d',
    options: [
      'A quiet library workspace with individual cubicles, desk lamps, and books on shelves.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'A',
  },
  // Photo 36: Unsplash ID 1523240795612-9a054b0db644
  {
    image: '1523240795612-9a054b0db644',
    options: [
      'A glass-walled meeting room with a round table and six empty chairs.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 37: Unsplash ID 1516321318423-f06f85e504b3
  {
    image: '1516321318423-f06f85e504b3',
    options: [
      'A co-working space with colorful furniture, a coffee bar, and people working on laptops.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'C',
  },
  // Photo 38: Unsplash ID 1554469384-e58fac16e23a
  {
    image: '1554469384-e58fac16e23a',
    options: [
      'An atrium lobby with a tall indoor tree, marble floors, and a security desk.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 39: Unsplash ID 1507679799987-c73779587ccf
  {
    image: '1507679799987-c73779587ccf',
    options: [
      'A break room with a ping-pong table, a fridge, and a coffee machine on the counter.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'A',
  },
  // Photo 40: Unsplash ID 1568992687947-868a62a9f521
  {
    image: '1568992687947-868a62a9f521',
    options: [
      'A server room with rows of blinking racks and blue LED lighting.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'B',
  },
  // Photo 41: Unsplash ID 1556740758-90de374c12ad
  {
    image: '1556740758-90de374c12ad',
    options: [
      'A large format printer producing architectural blueprints on a roll of paper.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'C',
  },
  // Photo 42: Unsplash ID 1559136555-9303baea8ebd
  {
    image: '1559136555-9303baea8ebd',
    options: [
      'A video conference call displayed on a 65-inch screen with four participants visible.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'D',
  },
  // Photo 43: Unsplash ID 1522202176988-66273c2fd55f
  {
    image: '1522202176988-66273c2fd55f',
    options: [
      'A 3D printer creating a prototype model on a build plate in a design lab.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'A',
  },
  // Photo 44: Unsplash ID 1560179707-f14e90ef3623
  {
    image: '1560179707-f14e90ef3623',
    options: [
      'A whiteboard filled with flowcharts, diagrams, and colored markers in a meeting room.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'B',
  },
  // Photo 45: Unsplash ID 1551288049-bebda4e38f71
  {
    image: '1551288049-bebda4e38f71',
    options: [
      'A desk with a laptop, external keyboard, mouse, and two large monitors displaying code.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'C',
  },
  // Photo 46: Unsplash ID 1576091160550-2173dba999ef
  {
    image: '1576091160550-2173dba999ef',
    options: [
      'A projector screen showing quarterly sales bar charts during a presentation.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'D',
  },
  // Photo 47: Unsplash ID 1454165804606-c3d57bc86b40
  {
    image: '1454165804606-c3d57bc86b40',
    options: [
      'A tablet on a stand displaying a digital checklist next to a clipboard on a counter.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'A',
  },
  // Photo 48: Unsplash ID 1505664194779-8beaceb93744
  {
    image: '1505664194779-8beaceb93744',
    options: [
      'An automated robotic arm assembling components on a production line.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'B',
  },
  // Photo 49: Unsplash ID 1566576912321-d58ddd7a6088
  {
    image: '1566576912321-d58ddd7a6088',
    options: [
      'A digital kiosk touchscreen displaying a building directory in an office lobby.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'C',
  },
  // Photo 50: Unsplash ID 1543286386-713bdd548da4
  {
    image: '1543286386-713bdd548da4',
    options: [
      'A group of employees walking through a glass-door entrance carrying briefcases.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'D',
  },
  // Photo 51: Unsplash ID 1513635269975-59663e0ac1ad
  {
    image: '1513635269975-59663e0ac1ad',
    options: [
      'A woman in business attire stepping out of an elevator on an office floor.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'A',
  },
  // Photo 52: Unsplash ID 1497366216548-37526070297c
  {
    image: '1497366216548-37526070297c',
    options: [
      'Two colleagues walking down a hallway while reviewing documents on a tablet.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'B',
  },
  // Photo 53: Unsplash ID 1524661135-423995f22d0b
  {
    image: '1524661135-423995f22d0b',
    options: [
      'A person carrying a stack of file folders through an office corridor.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'C',
  },
  // Photo 54: Unsplash ID 1504384764586-bb4cdc1707b0
  {
    image: '1504384764586-bb4cdc1707b0',
    options: [
      'A courier delivering packages to a mailroom where employees are sorting mail.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'D',
  },
  // Photo 55: Unsplash ID 1553028826-f4804a6dba3b
  {
    image: '1553028826-f4804a6dba3b',
    options: [
      'An employee holding a door open for a colleague carrying a laptop bag.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'A',
  },
  // Photo 56: Unsplash ID 1498050108023-c5249f4df085
  {
    image: '1498050108023-c5249f4df085',
    options: [
      'A manager walking briskly through an open office with a coffee cup in hand.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 57: Unsplash ID 1497366754035-f200968a6e72
  {
    image: '1497366754035-f200968a6e72',
    options: [
      'Two interns following a senior employee on a tour of the facility.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'C',
  },
  // Photo 58: Unsplash ID 1556740738-b6a63e27c4df
  {
    image: '1556740738-b6a63e27c4df',
    options: [
      'A receptionist walking toward the front desk carrying a stack of mail.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 59: Unsplash ID 1486312338219-ce68d2c6f44d
  {
    image: '1486312338219-ce68d2c6f44d',
    options: [
      'A group of professionals exiting a train station during morning rush hour.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'A',
  },
  // Photo 60: Unsplash ID 1486312338219-ce68d2c6f44d
  {
    image: '1486312338219-ce68d2c6f44d',
    options: [
      'Employees gathered around a kitchen island eating lunch from takeout containers.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'B',
  },
  // Photo 61: Unsplash ID 1527192491265-7e15c55b1ed2
  {
    image: '1527192491265-7e15c55b1ed2',
    options: [
      'A coffee station with an espresso machine, cups, and a tip jar in an office pantry.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'C',
  },
  // Photo 62: Unsplash ID 1497366216548-37526070297c
  {
    image: '1497366216548-37526070297c',
    options: [
      'A vending machine with snacks and drinks in the corner of an office break room.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'D',
  },
  // Photo 63: Unsplash ID 1554224155-6726b3ff858f
  {
    image: '1554224155-6726b3ff858f',
    options: [
      'Two coworkers chatting while waiting for the microwave in a shared kitchen.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'A',
  },
  // Photo 64: Unsplash ID 1553028826-f4804a6dba3b
  {
    image: '1553028826-f4804a6dba3b',
    options: [
      'A catered lunch spread on a buffet table with salads, sandwiches, and drinks.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'B',
  },
  // Photo 65: Unsplash ID 1498050108023-c5249f4df085
  {
    image: '1498050108023-c5249f4df085',
    options: [
      'A person pouring hot water from a kettle into a tea cup at an office kitchen counter.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'C',
  },
  // Photo 66: Unsplash ID 1515187029135-18ee286d815b
  {
    image: '1515187029135-18ee286d815b',
    options: [
      'An office fridge covered with magnets, name labels, and sticky notes.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'D',
  },
  // Photo 67: Unsplash ID 1554224155-6726b3ff858f
  {
    image: '1554224155-6726b3ff858f',
    options: [
      'A group of colleagues sitting at an outdoor patio table during a coffee break.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'A',
  },
  // Photo 68: Unsplash ID 1524758631624-e2822e304c36
  {
    image: '1524758631624-e2822e304c36',
    options: [
      'A snack drawer opened in a desk showing granola bars, nuts, and dried fruit.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'B',
  },
  // Photo 69: Unsplash ID 1517502884422-41eaead166d4
  {
    image: '1517502884422-41eaead166d4',
    options: [
      'A person stirring a mug of coffee while reading an email on their phone at a table.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'C',
  },
  // Photo 70: Unsplash ID 1573164713714-d95e436ab8d6
  {
    image: '1573164713714-d95e436ab8d6',
    options: [
      'A close-up of a hand writing notes in a lined notebook next to a laptop.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'D',
  },
  // Photo 71: Unsplash ID 1517502884422-41eaead166d4
  {
    image: '1517502884422-41eaead166d4',
    options: [
      'A person highlighting text in a printed contract with a yellow marker at a desk.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'A',
  },
  // Photo 72: Unsplash ID 1553028826-f4804a6dba3b
  {
    image: '1553028826-f4804a6dba3b',
    options: [
      'An employee organizing documents into labeled folders in a filing cabinet.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'B',
  },
  // Photo 73: Unsplash ID 1556761175-b413da4baf72
  {
    image: '1556761175-b413da4baf72',
    options: [
      'A stack of printed reports with a red pen resting on top on a conference table.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'C',
  },
  // Photo 74: Unsplash ID 1554224155-6726b3ff858f
  {
    image: '1554224155-6726b3ff858f',
    options: [
      'A person stamping a document with an official company seal at a counter.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'D',
  },
  // Photo 75: Unsplash ID 1517502884422-41eaead166d4
  {
    image: '1517502884422-41eaead166d4',
    options: [
      'A businesswoman reviewing a printed spreadsheet and making corrections with a pen.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'A',
  },
  // Photo 76: Unsplash ID 1591115765373-5207764f72e7
  {
    image: '1591115765373-5207764f72e7',
    options: [
      'A person signing a contract at a desk with a fountain pen and a paperweight.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 77: Unsplash ID 1450101499163-c8848c66ca85
  {
    image: '1450101499163-c8848c66ca85',
    options: [
      'An open planner on a desk with handwritten appointments and colorful sticky tabs.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'C',
  },
  // Photo 78: Unsplash ID 1515187029135-18ee286d815b
  {
    image: '1515187029135-18ee286d815b',
    options: [
      'A pair of reading glasses resting on top of a stack of legal documents.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 79: Unsplash ID 1524758631624-e2822e304c36
  {
    image: '1524758631624-e2822e304c36',
    options: [
      'A close-up of a person typing on a laptop with a printed outline document beside them.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'A',
  },
  // Photo 80: Unsplash ID 1450101499163-c8848c66ca85
  {
    image: '1450101499163-c8848c66ca85',
    options: [
      'A receptionist sitting behind a curved desk answering a phone call.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'B',
  },
  // Photo 81: Unsplash ID 1522071820081-009f0129c71c
  {
    image: '1522071820081-009f0129c71c',
    options: [
      'A visitor signing in at a digital check-in kiosk in a modern office lobby.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'C',
  },
  // Photo 82: Unsplash ID 1556761175-b413da4baf72
  {
    image: '1556761175-b413da4baf72',
    options: [
      'A waiting area with rows of chairs, a water cooler, and magazines on a coffee table.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'D',
  },
  // Photo 83: Unsplash ID 1527192491265-7e15c55b1ed2
  {
    image: '1527192491265-7e15c55b1ed2',
    options: [
      'A security guard monitoring CCTV screens at a front desk console.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'A',
  },
  // Photo 84: Unsplash ID 1556740738-b6a63e27c4df
  {
    image: '1556740738-b6a63e27c4df',
    options: [
      'A corporate lobby with a large company logo mounted on a stone feature wall.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'B',
  },
  // Photo 85: Unsplash ID 1497366216548-37526070297c
  {
    image: '1497366216548-37526070297c',
    options: [
      'An elevator bank with brushed steel doors and floor indicators in an office tower.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'C',
  },
  // Photo 86: Unsplash ID 1497215842964-222b430dc094
  {
    image: '1497215842964-222b430dc094',
    options: [
      'A visitor holding a lanyard badge while speaking with a receptionist.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'D',
  },
  // Photo 87: Unsplash ID 1573164713714-d95e436ab8d6
  {
    image: '1573164713714-d95e436ab8d6',
    options: [
      'A person pressing the elevator button while carrying a briefcase in a lobby.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'A',
  },
  // Photo 88: Unsplash ID 1498050108023-c5249f4df085
  {
    image: '1498050108023-c5249f4df085',
    options: [
      'An umbrella stand and coat rack near the entrance of an office building.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'B',
  },
  // Photo 89: Unsplash ID 1450101499163-c8848c66ca85
  {
    image: '1450101499163-c8848c66ca85',
    options: [
      'A directory board mounted on the wall listing company names and floor numbers.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'C',
  },
  // Photo 90: Unsplash ID 1556740738-b6a63e27c4df
  {
    image: '1556740738-b6a63e27c4df',
    options: [
      'A modern glass office building reflecting the sky with a landscaped entrance.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'D',
  },
  // Photo 91: Unsplash ID 1504384308090-c894fdcc538d
  {
    image: '1504384308090-c894fdcc538d',
    options: [
      'A corporate campus with a walking path, trees, and benches between two office buildings.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'A',
  },
  // Photo 92: Unsplash ID 1524758631624-e2822e304c36
  {
    image: '1524758631624-e2822e304c36',
    options: [
      'A company parking lot with designated visitor spaces and directional signage.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'B',
  },
  // Photo 93: Unsplash ID 1556740738-b6a63e27c4df
  {
    image: '1556740738-b6a63e27c4df',
    options: [
      'A row of bicycles parked at a bike rack outside an office building.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'C',
  },
  // Photo 94: Unsplash ID 1556761175-b413da4baf72
  {
    image: '1556761175-b413da4baf72',
    options: [
      'A loading dock at the back of a commercial building with a delivery van parked.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'D',
  },
  // Photo 95: Unsplash ID 1524758631624-e2822e304c36
  {
    image: '1524758631624-e2822e304c36',
    options: [
      'A plaza with outdoor seating, potted trees, and employees having a coffee break.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'A',
  },
  // Photo 96: Unsplash ID 1517502884422-41eaead166d4
  {
    image: '1517502884422-41eaead166d4',
    options: [
      'A signpost with directional arrows pointing to different office wings on a campus.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 97: Unsplash ID 1497366754035-f200968a6e72
  {
    image: '1497366754035-f200968a6e72',
    options: [
      'A flagpole with a company flag flying in front of a low-rise office building.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'C',
  },
  // Photo 98: Unsplash ID 1497366754035-f200968a6e72
  {
    image: '1497366754035-f200968a6e72',
    options: [
      'An outdoor covered walkway connecting two buildings on a corporate campus.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 99: Unsplash ID 1554224155-6726b3ff858f
  {
    image: '1554224155-6726b3ff858f',
    options: [
      'A landscaped courtyard with a fountain, benches, and employees walking through.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'A',
  },
  // Photo 100: Unsplash ID 1497366216548-37526070297c
  {
    image: '1497366216548-37526070297c',
    options: [
      'A warehouse worker scanning a barcode on a cardboard box with a handheld scanner.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'B',
  },
  // Photo 101: Unsplash ID 1522071820081-009f0129c71c
  {
    image: '1522071820081-009f0129c71c',
    options: [
      'Stacked shipping boxes on a wooden pallet wrapped in clear plastic film.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'C',
  },
  // Photo 102: Unsplash ID 1522071820081-009f0129c71c
  {
    image: '1522071820081-009f0129c71c',
    options: [
      'A conveyor belt moving packages toward a loading area in a distribution center.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'D',
  },
  // Photo 103: Unsplash ID 1504384308090-c894fdcc538d
  {
    image: '1504384308090-c894fdcc538d',
    options: [
      'A delivery driver loading boxes into the back of a white van at a loading bay.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'A',
  },
  // Photo 104: Unsplash ID 1486312338219-ce68d2c6f44d
  {
    image: '1486312338219-ce68d2c6f44d',
    options: [
      'A person taping shut a cardboard box on a packing table with a tape gun.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'B',
  },
  // Photo 105: Unsplash ID 1504384308090-c894fdcc538d
  {
    image: '1504384308090-c894fdcc538d',
    options: [
      'A shipping label printer producing a label from a roll at a packing station.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'C',
  },
  // Photo 106: Unsplash ID 1519389950473-47ba0277781c
  {
    image: '1519389950473-47ba0277781c',
    options: [
      'A receiving dock with stacked pallets and a worker checking a packing list.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'D',
  },
  // Photo 107: Unsplash ID 1527192491265-7e15c55b1ed2
  {
    image: '1527192491265-7e15c55b1ed2',
    options: [
      'A worker weighing a sealed package on a digital scale before shipment.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'A',
  },
  // Photo 108: Unsplash ID 1556761175-b413da4baf72
  {
    image: '1556761175-b413da4baf72',
    options: [
      'A mailroom with sorting bins labeled by department and a scale on the counter.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'B',
  },
  // Photo 109: Unsplash ID 1591115765373-5207764f72e7
  {
    image: '1591115765373-5207764f72e7',
    options: [
      'A hand placing a fragile sticker on a cardboard shipping box.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'C',
  },
  // Photo 110: Unsplash ID 1504384308090-c894fdcc538d
  {
    image: '1504384308090-c894fdcc538d',
    options: [
      'A presenter standing beside a projection screen showing a bar chart to an audience.',
      'A janitor is mopping the floor in an empty hallway.',
      'A forklift is moving pallets in a warehouse.',
      'A chef is preparing food in a commercial kitchen.',
    ],
    answer: 'D',
  },
  // Photo 111: Unsplash ID 1497215842964-222b430dc094
  {
    image: '1497215842964-222b430dc094',
    options: [
      'A trainer writing bullet points on a flip chart during a workshop session.',
      'A painter is applying wallpaper in a residential room.',
      'A pilot is doing pre-flight checks on an aircraft.',
      'A librarian is shelving books in the stacks.',
    ],
    answer: 'A',
  },
  // Photo 112: Unsplash ID 1497215842964-222b430dc094
  {
    image: '1497215842964-222b430dc094',
    options: [
      'An audience of employees seated in rows listening to a speaker at a podium.',
      'A dentist is examining a patient\'s teeth.',
      'A barista is making espresso at a coffee shop.',
      'A lifeguard is scanning the pool area from a tall chair.',
    ],
    answer: 'B',
  },
  // Photo 113: Unsplash ID 1591115765373-5207764f72e7
  {
    image: '1591115765373-5207764f72e7',
    options: [
      'A person pointing at a pie chart on a screen during a team meeting.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'C',
  },
  // Photo 114: Unsplash ID 1573164713714-d95e436ab8d6
  {
    image: '1573164713714-d95e436ab8d6',
    options: [
      'A classroom-style training room with desks, chairs, and a projector at the front.',
      'A welder is working on a steel beam at a construction site.',
      'A bus driver is checking passengers\' tickets.',
      'A florist is arranging flowers in a shop window.',
    ],
    answer: 'D',
  },
  // Photo 115: Unsplash ID 1573164713714-d95e436ab8d6
  {
    image: '1573164713714-d95e436ab8d6',
    options: [
      'A new employee looking at a company handbook while sitting at a training desk.',
      'A surgeon is performing an operation in an operating room.',
      'A postal worker is sorting letters in a distribution center.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'A',
  },
  // Photo 116: Unsplash ID 1591115765373-5207764f72e7
  {
    image: '1591115765373-5207764f72e7',
    options: [
      'A speaker gesturing while explaining a diagram on a large presentation screen.',
      'A chef is sautéing vegetables in a stainless steel pan.',
      'A librarian is shelving books in the stacks.',
      'A gymnast is performing a floor routine on a mat.',
    ],
    answer: 'B',
  },
  // Photo 117: Unsplash ID 1519389950473-47ba0277781c
  {
    image: '1519389950473-47ba0277781c',
    options: [
      'Employees wearing headphones and watching a training video on individual monitors.',
      'A construction worker is pouring concrete from a mixer truck.',
      'A nurse is checking a patient\'s blood pressure.',
      'A photographer is adjusting a studio lighting setup.',
    ],
    answer: 'C',
  },
  // Photo 118: Unsplash ID 1515187029135-18ee286d815b
  {
    image: '1515187029135-18ee286d815b',
    options: [
      'A certificate of completion displayed on a desk next to a pen and folder.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'D',
  },
  // Photo 119: Unsplash ID 1450101499163-c8848c66ca85
  {
    image: '1450101499163-c8848c66ca85',
    options: [
      'A trainer handing out printed worksheets to participants at a conference table.',
      'A mechanic is changing a tire in an auto repair shop.',
      'Children are playing on a playground at recess.',
      'A farmer is harvesting crops in a field.',
    ],
    answer: 'A',
  },
  // Photo 120: Unsplash ID 1498050108023-c5249f4df085
  {
    image: '1498050108023-c5249f4df085',
    options: [
      'A person organizing binders on a supply shelf in an office storage room.',
      'A plumber is fixing pipes under a kitchen sink.',
      'An astronaut is floating in zero gravity inside a space station.',
      'A fisherman is casting a net from a small boat.',
    ],
    answer: 'B',
  },
];

const KNOWN_P1_IDS = new Set(PART1_DATA.map(d => d.image));

// --- Part 2: Question-Response (spoken question in transcript, empty question, 3 options) ---
const PART2_DATA: { transcript: string; options: string[]; answer: string }[] = [
  { transcript: "Could you send me the report by this afternoon?", options: ["Yes, I'll send it right away.", "No, I haven't seen it.", "At 3 o'clock this afternoon."], answer: "A" },
  { transcript: "When does the meeting start tomorrow?", options: ["By Friday at the latest.", "It starts at 9 AM sharp.", "The blue one, please."], answer: "B" },
  { transcript: "Where can I find the manager's office?", options: ["I'll check and let you know.", "About 20 minutes from here.", "It's on the second floor."], answer: "C" },
  { transcript: "Would you like me to book the conference room?", options: ["Certainly, I'll make the reservation.", "The report is on your desk.", "Next Monday would work."], answer: "A" },
  { transcript: "How long does the training session last?", options: ["She's in a meeting right now.", "About two hours.", "We'll need more time."], answer: "B" },
  { transcript: "Who is responsible for the quarterly audit?", options: ["Mr. Tanaka is the manager.", "I prefer the morning flight.", "The audit team handles it."], answer: "C" },
  { transcript: "Why was the product launch delayed?", options: ["We had supply chain issues.", "Yes, she's in her office.", "I agree completely."], answer: "A" },
  { transcript: "What time does the conference call start?", options: ["At 10 AM sharp.", "It's on the second floor.", "No, I haven't seen it."], answer: "A" },
];

// --- Part 3: Conversations (3 questions per conversation, sharing same transcript) ---
const MOCK_PART3_CONVERSATIONS: { transcript: string; questions: { question: string; options: string[]; answer: string }[] }[] = [
  {
    transcript: "Michael: Have you finished the quarterly report? Jennifer: Almost. I just need to check the financial figures. Michael: Can you send it to me by 3 PM? Jennifer: Sure, I'll email it as soon as I verify the numbers.",
    questions: [
      { question: "What does the man ask the woman to do?", options: ["Send the report by 3 PM", "Verify the marketing data", "Attend a meeting", "Call the client"], answer: "A" },
      { question: "What does the woman need to do first?", options: ["Check the financial figures", "Write the report", "Schedule a meeting", "Send an email"], answer: "A" },
      { question: "When will the man receive the report?", options: ["By 3 PM today", "Tomorrow morning", "Next week", "After the meeting"], answer: "A" },
    ],
  },
  {
    transcript: "Jennifer: When is the deadline for the project proposal? Michael: The client wants it by Friday. Jennifer: That gives us three days. Michael: I'll work on the budget section today.",
    questions: [
      { question: "When is the deadline?", options: ["Monday", "Wednesday", "Friday", "Next week"], answer: "C" },
      { question: "What will the man do today?", options: ["Work on the budget section", "Call the client", "Review the contract", "Attend a meeting"], answer: "A" },
      { question: "How many days do they have?", options: ["One", "Two", "Three", "Four"], answer: "C" },
    ],
  },
  {
    transcript: "Michael: Did you receive the email from the client? Jennifer: Yes, they want to schedule a meeting next week. Michael: What about Thursday morning? Jennifer: That works. I'll confirm with them.",
    questions: [
      { question: "What does the client want?", options: ["Schedule a meeting", "Cancel the contract", "Change the deadline", "Review the budget"], answer: "A" },
      { question: "What day is proposed?", options: ["Thursday", "Friday", "Tuesday", "Monday"], answer: "A" },
      { question: "What will the woman do?", options: ["Confirm with the client", "Send a reminder", "Cancel the meeting", "Reschedule for Friday"], answer: "A" },
    ],
  },
  {
    transcript: "Jennifer: The new software update is ready for testing. Michael: Has the QA team started? Jennifer: They begin tomorrow. Michael: Good, let me know if there are any critical bugs.",
    questions: [
      { question: "What is ready for testing?", options: ["Software update", "New hardware", "Database migration", "Security patch"], answer: "A" },
      { question: "When does QA start?", options: ["Tomorrow", "Next week", "Today", "Next month"], answer: "A" },
      { question: "What should the man be notified about?", options: ["Critical bugs", "Test completion", "Budget approval", "Release date"], answer: "A" },
    ],
  },
  {
    transcript: "Michael: How was the client presentation yesterday? Jennifer: It went well. They asked several questions about the timeline. Michael: Did they approve the budget? Jennifer: They want to review it internally first.",
    questions: [
      { question: "How was the presentation?", options: ["It went well", "It was canceled", "There were technical issues", "The client was unhappy"], answer: "A" },
      { question: "What did the client ask about?", options: ["The timeline", "The budget", "The team", "The contract"], answer: "A" },
      { question: "What will the client do?", options: ["Review the budget internally", "Approve immediately", "Request changes", "Cancel the project"], answer: "A" },
    ],
  },
  {
    transcript: "Michael: Did you receive the shipment notification? Jennifer: Yes, it arrives tomorrow morning. Michael: Will you inspect it immediately? Jennifer: Absolutely. I'll check the quality before distribution.",
    questions: [
      { question: "When does the shipment arrive?", options: ["Tomorrow morning", "This afternoon", "Next week", "Today"], answer: "A" },
      { question: "What will the woman do?", options: ["Check the quality before distribution", "Return the shipment", "Contact the supplier", "Store in warehouse"], answer: "A" },
      { question: "What did the man ask?", options: ["Will you inspect it immediately?", "Where is the shipment?", "Who delivered it?", "How many items?"], answer: "A" },
    ],
  },
  {
    transcript: "Jennifer: The marketing campaign launched last Monday. Michael: How are the initial results? Jennifer: Better than expected. Engagement is up 20%. Michael: Great. Let's increase the ad spend.",
    questions: [
      { question: "When did the campaign launch?", options: ["Last Monday", "Last Friday", "Last Wednesday", "Yesterday"], answer: "A" },
      { question: "What was the engagement increase?", options: ["20%", "15%", "10%", "5%"], answer: "A" },
      { question: "What will they do next?", options: ["Increase ad spend", "Pause the campaign", "Change the target audience", "Hire more staff"], answer: "A" },
    ],
  },
  {
    transcript: "Michael: We need to hire two more developers. Jennifer: I'll post the job listings today. Michael: What about the budget? Jennifer: HR approved the salary range.",
    questions: [
      { question: "How many developers are needed?", options: ["Two", "One", "Three", "Four"], answer: "A" },
      { question: "What will the woman do today?", options: ["Post the job listings", "Interview candidates", "Review salaries", "Train new hires"], answer: "A" },
      { question: "What did HR approve?", options: ["The salary range", "The hiring plan", "The budget cut", "The new office"], answer: "A" },
    ],
  },
];

// --- Part 4: Talks (3 questions per talk, sharing same transcript) ---
const MOCK_PART4_TALKS: { transcript: string; questions: { question: string; options: string[]; answer: string }[] }[] = [
  {
    transcript: "Good morning, everyone. Thank you for joining today's quarterly business review. Our revenue increased 15% year over year, driven by strong performance in the Asia-Pacific region. However, operating costs rose 8% due to supply chain disruptions. We're implementing cost-saving measures starting next quarter.",
    questions: [
      { question: "What drove the revenue increase?", options: ["Strong Asia-Pacific performance", "New product launch", "Price increases", "Cost reductions"], answer: "A" },
      { question: "Why did operating costs rise?", options: ["Supply chain disruptions", "Higher salaries", "New office space", "Marketing spend"], answer: "A" },
      { question: "When will cost-saving measures start?", options: ["Next quarter", "Next month", "Next year", "Immediately"], answer: "A" },
    ],
  },
  {
    transcript: "Attention all employees. The annual wellness program begins next month. We've partnered with local gyms to offer discounted memberships. Registration opens next Monday. Participants who complete the 12-week program will receive a $200 bonus.",
    questions: [
      { question: "When does the wellness program begin?", options: ["Next month", "Next week", "Next quarter", "Next year"], answer: "A" },
      { question: "What do participants receive for completing the program?", options: ["$200 bonus", "Extra vacation day", "Gift card", "Certificate"], answer: "A" },
      { question: "When does registration open?", options: ["Next Monday", "Next Friday", "Next month", "Today"], answer: "A" },
    ],
  },
  {
    transcript: "Welcome to the new employee orientation. Today we'll cover company policies, benefits enrollment, and IT setup. Your mentor will contact you by end of week. Please complete the online compliance training by end of month.",
    questions: [
      { question: "What will be covered in orientation?", options: ["Policies, benefits, IT setup", "Only IT setup", "Only benefits", "Only policies"], answer: "A" },
      { question: "When will the mentor contact you?", options: ["By end of week", "Next week", "Next month", "Immediately"], answer: "A" },
      { question: "What is the deadline for compliance training?", options: ["End of month", "End of week", "End of quarter", "End of year"], answer: "A" },
    ],
  },
  {
    transcript: "Our new product launch is scheduled for Q3. The marketing team has prepared a comprehensive campaign including digital ads, social media, and influencer partnerships. We're targeting the 25-40 demographic in urban markets.",
    questions: [
      { question: "When is the product launching?", options: ["Q3", "Q2", "Q4", "Next year"], answer: "A" },
      { question: "What channels will the campaign use?", options: ["Digital, social media, influencers", "TV and radio only", "Print only", "Email only"], answer: "A" },
      { question: "Who is the target demographic?", options: ["25-40 urban", "18-25 rural", "40-60 suburban", "All ages"], answer: "A" },
    ],
  },
  {
    transcript: "Due to increased demand, we're expanding our warehouse operations in Dallas. The new facility will add 200,000 square feet of storage and create 150 new jobs. Construction begins next month.",
    questions: [
      { question: "Where is the new warehouse?", options: ["Dallas", "Houston", "Austin", "San Antonio"], answer: "A" },
      { question: "How much storage space will be added?", options: ["200,000 sq ft", "100,000 sq ft", "300,000 sq ft", "50,000 sq ft"], answer: "A" },
      { question: "How many jobs will be created?", options: ["150", "100", "200", "50"], answer: "A" },
    ],
  },
  {
    transcript: "Our cybersecurity team detected a phishing attempt targeting the finance department. The email appeared to be from a vendor requesting payment. Please remember: never click links in unsolicited emails. Report suspicious emails to IT immediately.",
    questions: [
      { question: "What department was targeted?", options: ["Finance", "HR", "IT", "Marketing"], answer: "A" },
      { question: "What should you do with suspicious emails?", options: ["Report to IT immediately", "Click the link to verify", "Reply to the sender", "Delete without reporting"], answer: "A" },
      { question: "What was the email about?", options: ["Vendor requesting payment", "Password reset", "Account closure", "Security update"], answer: "A" },
    ],
  },
  {
    transcript: "The board approved the acquisition of TechStart Inc. for $50 million. The deal is expected to close by end of Q2. TechStart's AI platform will be integrated into our product suite.",
    questions: [
      { question: "How much is the acquisition?", options: ["$50 million", "$25 million", "$75 million", "$100 million"], answer: "A" },
      { question: "When is the deal expected to close?", options: ["End of Q2", "End of Q1", "End of Q3", "End of Q4"], answer: "A" },
      { question: "What will be integrated?", options: ["AI platform", "Customer database", "Manufacturing process", "Sales team"], answer: "A" },
    ],
  },
  {
    transcript: "Starting next month, all employees must use the new expense reporting system. The old system will be deactivated. Training sessions are scheduled for next week. Contact HR with questions.",
    questions: [
      { question: "When does the new system start?", options: ["Next month", "Next week", "Today", "Next quarter"], answer: "A" },
      { question: "What happens to the old system?", options: ["Deactivated", "Kept as backup", "Upgraded", "Merged with new"], answer: "A" },
      { question: "Where can employees get help?", options: ["HR", "IT", "Finance", "Manager"], answer: "A" },
    ],
  },
];

// --- Part 5/6/7: Reading questions ---
const PART5_QUESTIONS: { question: string; options: string[]; answer: string }[] = [
  { question: "Please ______ the financial statements before the audit.", options: ["submit", "submits", "submitted", "submitting"], answer: "A" },
  { question: "Despite the heavy rain, the flight ______ as scheduled.", options: ["departed", "depart", "departing", "departs"], answer: "A" },
  { question: "The committee members ______ with the proposal after long discussion.", options: ["agreed", "agree", "agreeing", "agreement"], answer: "A" },
  { question: "All employees must ______ the safety training by end of quarter.", options: ["complete", "completes", "completed", "completing"], answer: "A" },
  { question: "The new policy will take ______ starting next month.", options: ["effect", "affect", "effective", "effects"], answer: "A" },
];

const PART6_QUESTIONS: { question: string; options: string[]; answer: string }[] = [
  { question: "The new software update will ______ improved performance and security.", options: ["provide", "provides", "provided", "providing"], answer: "A" },
  { question: "Please let us know if you require any further ______.", options: ["assistance", "assist", "assistant", "assisting"], answer: "A" },
  { question: "The meeting has been ______ to next Tuesday due to a scheduling conflict.", options: ["rescheduled", "reschedule", "reschedules", "rescheduling"], answer: "A" },
  { question: "All participants will receive a certificate upon ______ the course.", options: ["completing", "complete", "completed", "completes"], answer: "A" },
];

const PART7_QUESTIONS: { question: string; options: string[]; answer: string }[] = [
  { question: "Where should employees park starting next Monday?", options: ["In the underground garage", "On the street", "In the visitor lot", "At the old building"], answer: "A" },
  { question: "What is the main purpose of the announcement?", options: ["Inform about a policy change", "Advertise a product", "Invite to a party", "Request feedback"], answer: "A" },
  { question: "Who is most likely the intended audience?", options: ["All employees", "Only managers", "New hires only", "External clients"], answer: "A" },
  { question: "What should employees do if they have questions?", options: ["Contact HR", "Call the CEO", "Email the client", "Post on social media"], answer: "A" },
  { question: "When does the new policy take effect?", options: ["Next Monday", "Tomorrow", "Next quarter", "End of year"], answer: "A" },
  { question: "What is the deadline for compliance training?", options: ["End of month", "End of week", "End of quarter", "End of year"], answer: "A" },
];

export function generateMockData(count: number, sessionId: string): ExamData {
  const questions: z.infer<typeof QuestionSchema>[] = [];
  const dist = getQuestionDistribution(count);
  const part1Count = dist.listening.part1;
  const part2Count = dist.listening.part2;
  const part3Count = dist.listening.part3;
  const part4Count = dist.listening.part4;
  const part5Count = dist.reading.part5;
  const part6Count = dist.reading.part6;
  const part7Count = dist.reading.part7;

  // Cumulative end indices within the listening section
  const endP1 = part1Count;
  const endP2 = part1Count + part2Count;
  const endP3 = part1Count + part2Count + part3Count;
  const endP4 = part1Count + part2Count + part3Count + part4Count;
  const listeningCount = endP4;
  // Cumulative end indices within the reading section (offset by listeningCount)
  const endP5 = listeningCount + part5Count;
  const endP6 = listeningCount + part5Count + part6Count;
  const endP7 = listeningCount + part5Count + part6Count + part7Count;

  for (let i = 1; i <= count; i++) {
    if (i <= endP1) {
      // Part 1: Photographs - photo and options are ALIGNED via PART1_DATA so
      // the audio statements correctly describe the displayed image.
      const d1 = PART1_DATA[Math.floor(Math.random() * PART1_DATA.length)];
      questions.push({
        id: i,
        part: 1,
        type: 'listening',
        image: d1.image,
        transcript: '',
        audio: `sessions/${sessionId}/audio/q${i}.mp3`,
        question: 'Look at the photograph and listen to the four statements. Choose the statement that best describes what you see in the picture.',
        options: d1.options,
        answer: d1.answer,
      });
    } else if (i <= endP2) {
      // Part 2: Question-Response - spoken question in transcript, empty question field, 3 options
      const idx2 = (i - endP1 - 1) % PART2_DATA.length;
      const d = PART2_DATA[idx2];
      questions.push({
        id: i,
        part: 2,
        type: 'listening',
        image: undefined,
        transcript: d.transcript,
        audio: `sessions/${sessionId}/audio/q${i}.mp3`,
        question: '',
        options: d.options,
        answer: d.answer as 'A' | 'B' | 'C' | 'D',
      });
    } else if (i <= endP3) {
      // Part 3: Conversations - 3 questions per conversation, sharing same transcript
      const offset = i - endP2 - 1;
      const convIdx = Math.floor(offset / 3) % MOCK_PART3_CONVERSATIONS.length;
      const qIdx = offset % 3;
      const conv = MOCK_PART3_CONVERSATIONS[convIdx];
      const q = conv.questions[qIdx];
      questions.push({
        id: i,
        part: 3,
        type: 'listening',
        image: undefined,
        transcript: conv.transcript,
        audio: `sessions/${sessionId}/audio/q${i}.mp3`,
        question: q.question,
        options: q.options,
        answer: q.answer as 'A' | 'B' | 'C' | 'D',
      });
    } else if (i <= endP4) {
      // Part 4: Talks - 3 questions per talk, sharing same transcript
      const offset = i - endP3 - 1;
      const talkIdx = Math.floor(offset / 3) % MOCK_PART4_TALKS.length;
      const qIdx = offset % 3;
      const talk = MOCK_PART4_TALKS[talkIdx];
      const q = talk.questions[qIdx];
      questions.push({
        id: i,
        part: 4,
        type: 'listening',
        image: undefined,
        transcript: talk.transcript,
        audio: `sessions/${sessionId}/audio/q${i}.mp3`,
        question: q.question,
        options: q.options,
        answer: q.answer as 'A' | 'B' | 'C' | 'D',
      });
    } else if (i <= endP5) {
      // Part 5: Incomplete Sentences - fill-in-the-blank, 4 options
      const d = PART5_QUESTIONS[(i - listeningCount - 1) % PART5_QUESTIONS.length];
      questions.push({
        id: i,
        part: 5,
        type: 'reading',
        image: undefined,
        transcript: undefined,
        audio: undefined,
        question: d.question,
        options: d.options,
        answer: d.answer as 'A' | 'B' | 'C' | 'D',
      });
    } else if (i <= endP6) {
      // Part 6: Text Completion - fill-in-the-blank in passage context, 4 options
      const d = PART6_QUESTIONS[(i - endP5 - 1) % PART6_QUESTIONS.length];
      questions.push({
        id: i,
        part: 6,
        type: 'reading',
        image: undefined,
        transcript: undefined,
        audio: undefined,
        question: d.question,
        options: d.options,
        answer: d.answer as 'A' | 'B' | 'C' | 'D',
      });
    } else if (i <= endP7) {
      // Part 7: Reading Comprehension - question about passage, 4 options
      const d = PART7_QUESTIONS[(i - endP6 - 1) % PART7_QUESTIONS.length];
      questions.push({
        id: i,
        part: 7,
        type: 'reading',
        image: undefined,
        transcript: undefined,
        audio: undefined,
        question: d.question,
        options: d.options,
        answer: d.answer as 'A' | 'B' | 'C' | 'D',
      });
    }
  }

  const times = getExamTimes(count);
  return { questions, listeningTime: times.listeningTime, readingTime: times.readingTime };
}
// validateAndRebalanceDistribution — B012 fix
// Added 2026-07-19: enforce the distribution from getQuestionDistribution
// after AI generation, since AI ignores format ~30% of the time.

export function validateAndRebalanceDistribution(
  questions: Array<Record<string, unknown>>,
  expectedDist: { listening: { part1: number; part2: number; part3: number; part4: number }; reading: { part5: number; part6: number; part7: number } },
  opts?: { strict?: boolean; maxMismatch?: number }
): { questions: Array<Record<string, unknown>>; actualDist: typeof expectedDist; warnings: string[] } {
  const { strict = false, maxMismatch = 1 } = opts || {};

  // Count actual questions by type/part
  const actual = {
    listening: { part1: 0, part2: 0, part3: 0, part4: 0 },
    reading: { part5: 0, part6: 0, part7: 0 },
  };

  for (const q of questions) {
    const type = q.type as string;
    const part = q.part as number;
    if (type === 'listening' && part >= 1 && part <= 4) {
      actual.listening[`part${part}` as keyof typeof actual.listening]++;
    } else if (type === 'reading' && part >= 5 && part <= 7) {
      actual.reading[`part${part}` as keyof typeof actual.reading]++;
    }
  }

  const warnings: string[] = [];

  // Compare expected vs actual
  const expectedL = expectedDist.listening;
  const expectedR = expectedDist.reading;

  // Check listening total
  const actL = actual.listening.part1 + actual.listening.part2 + actual.listening.part3 + actual.listening.part4;
  const expL = expectedL.part1 + expectedL.part2 + expectedL.part3 + expectedL.part4;

  // Check reading total
  const actR = actual.reading.part5 + actual.reading.part6 + actual.reading.part7;
  const expR = expectedR.part5 + expectedR.part6 + expectedR.part7;

  // Per-part check (informational)
  const parts = [
    { key: 'part1', exp: expectedL.part1, act: actual.listening.part1, type: 'listening' },
    { key: 'part2', exp: expectedL.part2, act: actual.listening.part2, type: 'listening' },
    { key: 'part3', exp: expectedL.part3, act: actual.listening.part3, type: 'listening' },
    { key: 'part4', exp: expectedL.part4, act: actual.listening.part4, type: 'listening' },
    { key: 'part5', exp: expectedR.part5, act: actual.reading.part5, type: 'reading' },
    { key: 'part6', exp: expectedR.part6, act: actual.reading.part6, type: 'reading' },
    { key: 'part7', exp: expectedR.part7, act: actual.reading.part7, type: 'reading' },
  ];

  for (const p of parts) {
    if (p.act !== p.exp) {
      warnings.push(`${p.type} ${p.key}: expected ${p.exp}, got ${p.act}`);
    }
  }

  // Rebalance within each type:
  // 1. Re-label questions between parts (e.g. extra part3 → part4)
  // 2. If totals still differ (AI over/under-generated), trim excess questions
  //    from the most-overrepresented parts to hit the expected total.
  let adjusted = [...questions];

  for (const [typeKey, expectedType] of [['listening', expectedL], ['reading', expectedR]] as const) {
    const actualType = actual[typeKey];
    const totalAct = Object.values(actualType).reduce((a, b) => a + b, 0);
    const totalExp = Object.values(expectedType).reduce((a, b) => a + b, 0);

    if (totalAct === totalExp) {
      // Totals match — just re-label between parts
    } else if (totalAct > totalExp) {
      // AI generated too many questions for this type.
      // Step 1: re-label between parts to fix per-part skew
      // Step 2: trim the remaining excess from the most-overrepresented parts
      const excess = totalAct - totalExp;
      warnings.push(`${typeKey} total mismatch: expected ${totalExp}, got ${totalAct} (trimming ${excess} excess)`);

      // First pass: re-label between parts (same logic as below)
      const overflowParts: Array<{ part: string; excess: number }> = [];
      const deficitParts: Array<{ part: string; needed: number }> = [];

      for (const p of Object.keys(expectedType) as string[]) {
        const diff = actualType[p as keyof typeof actualType] - expectedType[p as keyof typeof expectedType];
        if (diff > 0) overflowParts.push({ part: p, excess: diff });
        else if (diff < 0) deficitParts.push({ part: p, needed: -diff });
      }

      for (const overflow of overflowParts) {
        let remainingExcess = overflow.excess;
        for (const deficit of deficitParts) {
          if (remainingExcess <= 0 || deficit.needed <= 0) continue;
          const move = Math.min(remainingExcess, deficit.needed);
          const overflowPartNum = parseInt(overflow.part.replace('part', ''));
          const deficitPartNum = parseInt(deficit.part.replace('part', ''));

          for (const q of adjusted) {
            if (remainingExcess <= 0 || deficit.needed <= 0) break;
            if (q.type === typeKey && q.part === overflowPartNum) {
              q.part = deficitPartNum;
              remainingExcess--;
              deficit.needed--;
              actualType[overflow.part as keyof typeof actualType]--;
              actualType[deficit.part as keyof typeof actualType]++;
            }
          }
        }
      }

      // Second pass: trim remaining excess from most-overrepresented parts
      // Build a list of (part, overage) sorted descending by overage
      const trimCandidates: Array<{ part: string; partNum: number; overage: number }> = [];
      for (const p of Object.keys(expectedType) as string[]) {
        const overage = actualType[p as keyof typeof actualType] - expectedType[p as keyof typeof expectedType];
        if (overage > 0) {
          trimCandidates.push({ part: p, partNum: parseInt(p.replace('part', '')), overage });
        }
      }
      trimCandidates.sort((a, b) => b.overage - a.overage);

      let remainingTrim = excess;
      for (const candidate of trimCandidates) {
        if (remainingTrim <= 0) break;
        const trim = Math.min(remainingTrim, candidate.overage);
        let trimmed = 0;
        adjusted = adjusted.filter(q => {
          if (trimmed >= trim) return true;
          if (q.type === typeKey && q.part === candidate.partNum) {
            trimmed++;
            actualType[candidate.part as keyof typeof actualType]--;
            return false;
          }
          return true;
        });
        remainingTrim -= trimmed;
      }

      continue;
    } else {
      // AI generated too few — can't add without re-generating
      warnings.push(`${typeKey} total mismatch: expected ${totalExp}, got ${totalAct} (deficit, cannot fix without re-generation)`);
      if (strict) {
        throw new RetryableDistributionError(`${typeKey} deficit: expected ${totalExp}, got ${totalAct} — retrying generation`);
      }
      continue;
    }

    // Re-label between parts when totals match
    const overflowParts: Array<{ part: string; excess: number }> = [];
    const deficitParts: Array<{ part: string; needed: number }> = [];

    for (const p of Object.keys(expectedType) as string[]) {
      const diff = actualType[p as keyof typeof actualType] - expectedType[p as keyof typeof expectedType];
      if (diff > 0) overflowParts.push({ part: p, excess: diff });
      else if (diff < 0) deficitParts.push({ part: p, needed: -diff });
    }

    for (const overflow of overflowParts) {
      let remainingExcess = overflow.excess;
      for (const deficit of deficitParts) {
        if (remainingExcess <= 0 || deficit.needed <= 0) continue;
        const overflowPartNum = parseInt(overflow.part.replace('part', ''));
        const deficitPartNum = parseInt(deficit.part.replace('part', ''));

        for (const q of adjusted) {
          if (remainingExcess <= 0 || deficit.needed <= 0) break;
          if (q.type === typeKey && q.part === overflowPartNum) {
            q.part = deficitPartNum;
            remainingExcess--;
            deficit.needed--;
            actualType[overflow.part as keyof typeof actualType]--;
            actualType[deficit.part as keyof typeof actualType]++;
          }
        }
      }
    }
  }

  // Recount from the final adjusted array to get accurate post-trimming counts
  const finalCounts = {
    listening: { part1: 0, part2: 0, part3: 0, part4: 0 },
    reading: { part5: 0, part6: 0, part7: 0 },
  };
  for (const q of adjusted) {
    const type = q.type as string;
    const part = q.part as number;
    if (type === 'listening' && part >= 1 && part <= 4) {
      finalCounts.listening[`part${part}` as keyof typeof finalCounts.listening]++;
    } else if (type === 'reading' && part >= 5 && part <= 7) {
      finalCounts.reading[`part${part}` as keyof typeof finalCounts.reading]++;
    }
  }

  // Strict-mode: reject if the trimmed/rebalanced array still doesn't match
  const finalActL = finalCounts.listening.part1 + finalCounts.listening.part2 + finalCounts.listening.part3 + finalCounts.listening.part4;
  const finalActR = finalCounts.reading.part5 + finalCounts.reading.part6 + finalCounts.reading.part7;

  if (strict && Math.abs(finalActL - expL) > maxMismatch) {
    if (finalActL < expL) {
      throw new RetryableDistributionError(`listening deficit: expected ${expL}, got ${finalActL} — retrying generation`);
    }
    throw new Error(`Distribution mismatch (listening): expected ${expL}, got ${finalActL} — rejecting session`);
  }
  if (strict && Math.abs(finalActR - expR) > maxMismatch) {
    if (finalActR < expR) {
      throw new RetryableDistributionError(`reading deficit: expected ${expR}, got ${finalActR} — retrying generation`);
    }
    throw new Error(`Distribution mismatch (reading): expected ${expR}, got ${finalActR} — rejecting session`);
  }

  return { questions: adjusted, actualDist: finalCounts, warnings };
}