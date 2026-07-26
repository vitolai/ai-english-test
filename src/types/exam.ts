export interface Question {
  id: number;
  part: number;
  type: 'listening' | 'reading';
  answer: string;
  options: string[];
  image?: string;
  audio?: string;
  question?: string;
  context?: string;
  passage?: string;
  transcript?: string;
}

export interface ExamData {
  title: string;
  questions: Question[];
  listeningTime?: number;
  readingTime?: number;
}

export interface Status {
  phase: 'starting' | 'generating' | 'audio' | 'completed' | 'error';
  progress: number;
  message: string;
}
