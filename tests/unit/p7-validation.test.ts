import { describe, it, expect } from 'vitest';
import { ensurePart7Questions, validateAndRebalanceDistribution, generateMockData, ensureListeningCoherence } from '../../server/services/ai.js';

function makeP7(overrides: Partial<{ question: string; passage: string; options: string[]; answer: string }> = {}) {
  return {
    id: 1,
    part: 7,
    type: 'reading',
    question: overrides.question ?? 'What is the deadline?',
    passage: overrides.passage ?? 'Some passage text here.',
    options: overrides.options ?? ['Option A', 'Option B', 'Option C', 'Option D'],
    answer: overrides.answer ?? 'A',
  } as Record<string, unknown>;
}

describe('ensurePart7Questions — missing question validation', () => {
  it('replaces a P7 entry with empty question with a complete mock entry', () => {
    const q = makeP7({ question: '' });
    const result = ensurePart7Questions([q]);
    expect(result[0].question).not.toBe('');
    expect((result[0].question as string).length).toBeGreaterThan(0);
    expect((result[0].passage as string).length).toBeGreaterThan(20);
    expect((result[0].options as string[]).length).toBe(4);
    expect(['A', 'B', 'C', 'D']).toContain(result[0].answer);
  });

  it('replaces a P7 entry with missing question field with a complete mock entry', () => {
    const q = makeP7();
    delete q['question'];
    const result = ensurePart7Questions([q]);
    expect(result[0].question).not.toBe('');
    expect((result[0].question as string).length).toBeGreaterThan(0);
  });

  it('does not replace a valid P7 entry', () => {
    const q = makeP7({ question: 'A valid question about parking rules?' });
    const result = ensurePart7Questions([q]);
    expect(result[0].question).toBe('A valid question about parking rules?');
  });

  it('preserves non-P7 questions unchanged', () => {
    const q = { id: 5, part: 5, type: 'reading', question: 'Fill in the blank', options: ['a', 'b', 'c', 'd'], answer: 'A' };
    const result = ensurePart7Questions([q]);
    expect(result[0].question).toBe('Fill in the blank');
  });
});

describe('validateAndRebalanceDistribution — malformed P7 trimming', () => {
  it('prefers trimming malformed P7 entries over valid ones', () => {
    const dist = { listening: { part1: 0, part2: 0, part3: 0, part4: 0 }, reading: { part5: 0, part6: 0, part7: 2 } };
    const malformed = makeP7({ question: '' });
    const valid1 = makeP7({ id: 2, question: 'Valid question 1?' });
    const valid2 = makeP7({ id: 3, question: 'Valid question 2?' });
    const questions = [malformed, valid1, valid2];
    const result = validateAndRebalanceDistribution(questions, dist);
    expect(result.questions.length).toBe(2);
    // Malformed should have been removed first
    const remaining = result.questions as Array<Record<string, unknown>>;
    expect(remaining.every(q => ((q['question'] as string) || '').trim().length > 0)).toBe(true);
  });
});

describe('generateMockData — 100Q P7 entries have valid question fields', () => {
  it('generates 100 questions with all P7 having non-empty question', () => {
    const { questions } = generateMockData(100, 'test-session');
    const p7 = questions.filter(q => q.part === 7 && q.type === 'reading');
    expect(p7.length).toBeGreaterThan(0);
    for (const q of p7) {
      expect(q.question).toBeDefined();
      expect(typeof q.question).toBe('string');
      expect((q.question as string).trim().length).toBeGreaterThan(0);
      expect(q.options.length).toBe(4);
      expect(['A', 'B', 'C', 'D']).toContain(q.answer);
    }
  });
});

describe('ensureListeningCoherence — P2 image field leak (issue #37)', () => {
  it('removes image field from P2 questions after processing', () => {
    // Simulate a P2 question that leaked an image from P1
    const questions = [
      {
        id: 1, part: 1, type: 'listening', image: '1556761175-b413da4baf72',
        question: 'Look at the photograph...', options: ['A', 'B', 'C', 'D'], answer: 'A', transcript: '',
      },
      {
        id: 2, part: 2, type: 'listening', image: '1556761175-b413da4baf72',
        question: '', options: ['A', 'B', 'C'], answer: 'A', transcript: 'When is the deadline?',
      },
    ] as Array<Record<string, unknown>>;
    const result = ensureListeningCoherence(questions);
    const p2 = result.find(q => q['part'] === 2);
    expect(p2).toBeDefined();
    expect(p2!['image']).toBeUndefined();
  });

  it('10Q mock: no P2 question has an image field', () => {
    const { questions } = generateMockData(10, 'test-p2-image');
    const coherenceResult = ensureListeningCoherence(
      questions as Array<Record<string, unknown>>
    );
    const p2Questions = coherenceResult.filter(q => q['part'] === 2 && q['type'] === 'listening');
    expect(p2Questions.length).toBeGreaterThan(0);
    for (const q of p2Questions) {
      expect(q['image']).toBeUndefined();
    }
  });

  it('100Q mock: no P2 question has an image field', () => {
    const { questions } = generateMockData(100, 'test-p2-image-100');
    const coherenceResult = ensureListeningCoherence(
      questions as Array<Record<string, unknown>>
    );
    const p2Questions = coherenceResult.filter(q => q['part'] === 2 && q['type'] === 'listening');
    expect(p2Questions.length).toBeGreaterThan(0);
    for (const q of p2Questions) {
      expect(q['image']).toBeUndefined();
    }
  });
});
