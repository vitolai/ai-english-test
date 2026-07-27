import { describe, it, expect } from 'vitest';
import { QuestionSchema, ExamDataSchema } from "./exam.schema";
import type { Question, ExamData } from "./exam.schema";

describe('Contract Tests — Zod Schemas', () => {
  describe('QuestionSchema', () => {
    it('should validate a valid listening question', () => {
      const validQuestion: Question = {
        id: 1,
        part: 1,
        type: 'listening',
        question: 'What is the man doing?',
        options: ['Running', 'Walking', 'Sitting', 'Standing'],
        answer: 'B',
      };

      const result = QuestionSchema.safeParse(validQuestion);
      expect(result.success).toBe(true);
    });

    it('should validate a valid reading question', () => {
      const validQuestion: Question = {
        id: 10,
        part: 5,
        type: 'reading',
        question: 'The new policy was _______ implemented.',
        options: ['effect', 'effective', 'effectively', 'effects'],
        answer: 'C',
      };

      const result = QuestionSchema.safeParse(validQuestion);
      expect(result.success).toBe(true);
    });

    it('should reject invalid part number', () => {
      const invalidQuestion = {
        id: 1,
        part: 8, // Invalid: must be 1-7
        type: 'listening',
        question: 'What is this?',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
      };

      const result = QuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const invalidQuestion = {
        id: 1,
        part: 1,
        type: 'speaking', // Invalid: must be 'listening' or 'reading'
        question: 'What is this?',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
      };

      const result = QuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
    });

    it('should reject question with wrong number of options', () => {
      const invalidQuestion = {
        id: 1,
        part: 1,
        type: 'listening',
        question: 'What is this?',
        options: ['A', 'B', 'C'], // Invalid: must have exactly 4 options
        answer: 'A',
      };

      const result = QuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
    });

    it('should reject invalid answer', () => {
      const invalidQuestion = {
        id: 1,
        part: 1,
        type: 'listening',
        question: 'What is this?',
        options: ['A', 'B', 'C', 'D'],
        answer: 'E', // Invalid: must be 'A', 'B', 'C', or 'D'
      };

      const result = QuestionSchema.safeParse(invalidQuestion);
      expect(result.success).toBe(false);
    });

    it('should accept optional fields (image, transcript, passage, audio)', () => {
      const questionWithOptionals: Question = {
        id: 1,
        part: 1,
        type: 'listening',
        image: 'https://example.com/image.jpg',
        transcript: 'This is a transcript',
        audio: 'sessions/abc/audio/q1.mp3',
        question: 'What is this?',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
      };

      const result = QuestionSchema.safeParse(questionWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const incompleteQuestion = {
        id: 1,
        part: 1,
        // Missing 'type'
        question: 'What is this?',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
      };

      const result = QuestionSchema.safeParse(incompleteQuestion);
      expect(result.success).toBe(false);
    });
  });

  describe('ExamDataSchema', () => {
    it('should validate a valid exam with multiple questions', () => {
      const validExam: ExamData = {
        questions: [
          {
            id: 1,
            part: 1,
            type: 'listening',
            question: 'What is the man doing?',
            options: ['Running', 'Walking', 'Sitting', 'Standing'],
            answer: 'B',
          },
          {
            id: 2,
            part: 5,
            type: 'reading',
            question: 'The report was _______ submitted.',
            options: ['timely', 'timeliness', 'timeliness', 'timeliness'],
            answer: 'A',
          },
        ],
      };

      const result = ExamDataSchema.safeParse(validExam);
      expect(result.success).toBe(true);
    });

    it('should reject exam with empty questions array', () => {
      const invalidExam = {
        questions: [],
      };

      const result = ExamDataSchema.safeParse(invalidExam);
      expect(result.success).toBe(true); // Empty array is valid
    });

    it('should reject exam with invalid question', () => {
      const invalidExam = {
        questions: [
          {
            id: 1,
            part: 1,
            type: 'invalid', // Invalid type
            question: 'What is this?',
            options: ['A', 'B', 'C', 'D'],
            answer: 'A',
          },
        ],
      };

      const result = ExamDataSchema.safeParse(invalidExam);
      expect(result.success).toBe(false);
    });

    it('should reject missing questions field', () => {
      const invalidExam = {
        title: 'Test Exam',
        // Missing 'questions' field
      };

      const result = ExamDataSchema.safeParse(invalidExam);
      expect(result.success).toBe(false);
    });

    it('should validate exam with many questions (100 questions)', () => {
      const questions = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        part: (i % 7) + 1,
        type: i < 50 ? 'listening' as const : 'reading' as const,
        question: `Question ${i + 1}`,
        options: ['A', 'B', 'C', 'D'],
        answer: 'A' as const,
      }));

      const validExam: ExamData = { questions };
      const result = ExamDataSchema.safeParse(validExam);
      expect(result.success).toBe(true);
    });
  });
});
