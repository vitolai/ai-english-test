import type { Page, Locator } from '@playwright/test';

export interface ExamProgress {
  answered: number;
  total: number;
  percent: number;
}

export interface QuestionState {
  index: number;
  questionId: number;
  text: string;
  selectedAnswer: string | null;
  isAnswered: boolean;
  hasAudio: boolean;
  isPlaying: boolean;
  hasPassage: boolean;
  hasImage: boolean;
  hasTranscript: boolean;
}

export class ExamPage {
  readonly page: Page;

  // ─── Section headers ─────────────────────────────────────
  readonly listeningHeader: Locator;
  readonly readingHeader: Locator;

  // ─── Question cards ──────────────────────────────────────
  readonly questionCards: Locator;

  // ─── Navigation ──────────────────────────────────────────
  readonly goToReadingButton: Locator;
  readonly backButton: Locator;

  // ─── Completion ──────────────────────────────────────────
  readonly completeButton: Locator;
  readonly examCompleted: Locator;
  readonly scoreText: Locator;
  readonly scoreCorrect: Locator;
  readonly scoreTotal: Locator;
  readonly backToDashboardButton: Locator;

  // ─── Audio controls (all play/pause buttons) ─────────────
  readonly audioButtons: Locator;

  // ─── Exam data container ─────────────────────────────────
  readonly examDataContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Section headings
    this.listeningHeader = page.locator('h1:has-text("Listening Comprehension")');
    this.readingHeader = page.locator('h1:has-text("Reading Test")');

    // Question cards — each has an id like q-0, q-1, ...
    this.questionCards = page.locator('[id^="q-"]');

    // Navigation
    this.goToReadingButton = page.getByRole('button', { name: /GO TO READING SECTION/i });
    this.backButton = page.locator('button').filter({ has: page.locator('.lucide-arrow-left') }).first();

    // Completion
    this.completeButton = page.getByRole('button', { name: /COMPLETE & SEE SCORE/i });
    this.examCompleted = page.locator('h2:has-text("Exam Completed")');
    this.scoreText = page.locator('text=/Score:\\s*\\d+\\s*\\/\\s*\\d+/');
    this.scoreCorrect = page.locator('.text-green-600, .text-emerald-600');
    this.scoreTotal = page.locator('.text-blue-600');
    this.backToDashboardButton = page.getByRole('button', { name: /BACK|DASHBOARD/i });

    // Audio play/pause buttons (lucide-play and lucide-pause icons)
    this.audioButtons = page.locator('.lucide-play, .lucide-pause');

    // Exam data container (data attribute for extracting exam JSON)
    this.examDataContainer = page.locator('[data-exam-data]');
  }

  // ─── Question card access ────────────────────────────────

  /**
   * Get a specific question card by its 0-based index.
   */
  getQuestionCard(index: number): Locator {
    return this.questionCards.nth(index);
  }

  /**
   * Get the total number of visible question cards.
   */
  async getQuestionCount(): Promise<number> {
    return this.questionCards.count();
  }

  /**
   * Get the question ID (as rendered in the DOM, e.g. "Q1", "Q2") for a card.
   */
  getQuestionLabel(index: number): Locator {
    return this.questionCards.nth(index).locator('p.font-bold').first();
  }

  // ─── Answer interaction ──────────────────────────────────

  /**
   * Select an answer (A/B/C/D) for a specific question by index.
   */
  async answerQuestion(index: number, option: 'A' | 'B' | 'C' | 'D') {
    const card = this.questionCards.nth(index);
    await card.getByRole('button', { name: option, exact: true }).click();
  }

  /**
   * Answer all currently visible questions with the same option.
   * Skips questions where the option button is not visible.
   */
  async answerAllVisibleQuestions(option: 'A' | 'B' | 'C' | 'D' = 'C') {
    const count = await this.questionCards.count();
    for (let i = 0; i < count; i++) {
      const card = this.questionCards.nth(i);
      const btn = card.getByRole('button', { name: option, exact: true });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
      }
    }
  }

  /**
   * Alias: answer all listening section questions.
   */
  async answerAllListeningQuestions(option: 'A' | 'B' | 'C' | 'D' = 'C') {
    await this.answerAllVisibleQuestions(option);
  }

  /**
   * Alias: answer all reading section questions.
   */
  async answerAllReadingQuestions(option: 'A' | 'B' | 'C' | 'D' = 'A') {
    await this.answerAllVisibleQuestions(option);
  }

  /**
   * Get the currently selected answer for a specific question.
   * Returns the option label (e.g. "A") or null if unanswered.
   * Works by checking which answer button has the active (blue) state.
   */
  async getSelectedAnswer(index: number): Promise<string | null> {
    const card = this.questionCards.nth(index);
    for (const label of ['A', 'B', 'C', 'D']) {
      const btn = card.getByRole('button', { name: label, exact: true });
      const classes = await btn.getAttribute('class').catch(() => '');
      if (classes && classes.includes('border-blue-600') && classes.includes('bg-blue-50')) {
        return label;
      }
    }
    return null;
  }

  /**
   * Check if a specific question has been answered.
   */
  async isQuestionAnswered(index: number): Promise<boolean> {
    return this.getSelectedAnswer(index).then((a) => a !== null);
  }

  /**
   * Count how many questions are currently answered.
   */
  async getAnsweredCount(): Promise<number> {
    let count = 0;
    const total = await this.questionCards.count();
    for (let i = 0; i < total; i++) {
      if (await this.isQuestionAnswered(i)) count++;
    }
    return count;
  }

  // ─── Question state inspection ───────────────────────────

  /**
   * Get the full state of a specific question card.
   */
  async getQuestionState(index: number): Promise<QuestionState> {
    const card = this.questionCards.nth(index);

    const questionIdText = await card.locator('p.font-bold').first().textContent().catch(() => '');
    const questionIdMatch = questionIdText?.match(/Q(\d+)/);
    const questionId = questionIdMatch ? parseInt(questionIdMatch[1], 10) : index;

    const text = await card.locator('p.font-bold').first().textContent() ?? '';
    const selectedAnswer = await this.getSelectedAnswer(index);

    const hasAudio = await card.locator('.lucide-play, .lucide-pause').count() > 0;
    const isPlaying = hasAudio && (await card.locator('.lucide-pause').count() > 0);
    const hasPassage = await card.locator('.bg-slate-50').count() > 0;
    const hasImage = await card.locator('img').count() > 0;
    const hasTranscript = await card.locator('p.italic').count() > 0;

    return {
      index,
      questionId,
      text,
      selectedAnswer,
      isAnswered: selectedAnswer !== null,
      hasAudio,
      isPlaying,
      hasPassage,
      hasImage,
      hasTranscript,
    };
  }

  /**
   * Get the state of all visible questions.
   */
  async getAllQuestionStates(): Promise<QuestionState[]> {
    const count = await this.questionCards.count();
    const states: QuestionState[] = [];
    for (let i = 0; i < count; i++) {
      states.push(await this.getQuestionState(i));
    }
    return states;
  }

  // ─── Audio controls ──────────────────────────────────────

  /**
   * Get the audio button for a specific question (by question card index).
   * The button contains either a Play or Pause icon.
   */
  getAudioButton(index: number): Locator {
    return this.questionCards.nth(index).locator('.lucide-play, .lucide-pause').first();
  }

  /**
   * Click the play button of the first audio element.
   */
  async playFirstAudio() {
    const playBtn = this.page.locator('.lucide-play').first();
    await playBtn.click();
  }

  /**
   * Play audio for a specific question by card index.
   */
  async playAudio(index: number) {
    const btn = this.getAudioButton(index);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }
  }

  /**
   * Pause audio for a specific question (clicks the pause button).
   */
  async pauseAudio(index: number) {
    const card = this.questionCards.nth(index);
    const pauseBtn = card.locator('.lucide-pause').first();
    if (await pauseBtn.isVisible().catch(() => false)) {
      await pauseBtn.click();
    }
  }

  /**
   * Toggle audio play/pause for a specific question.
   */
  async toggleAudio(index: number) {
    const btn = this.getAudioButton(index);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }
  }

  /**
   * Check if audio is currently playing for a specific question.
   * Playing state is indicated by the Pause icon being visible.
   */
  async isAudioPlaying(index: number): Promise<boolean> {
    const card = this.questionCards.nth(index);
    return card.locator('.lucide-pause').first().isVisible().catch(() => false);
  }

  /**
   * Check if audio play buttons are present.
   */
  async hasAudio(): Promise<boolean> {
    return this.page.locator('.lucide-play').first().isVisible().catch(() => false);
  }

  /**
   * Count how many questions have audio controls.
   */
  async getAudioQuestionCount(): Promise<number> {
    let count = 0;
    const total = await this.questionCards.count();
    for (let i = 0; i < total; i++) {
      const card = this.questionCards.nth(i);
      if (await card.locator('.lucide-play, .lucide-pause').count() > 0) count++;
    }
    return count;
  }

  // ─── Progress tracking ───────────────────────────────────

  /**
   * Get the overall exam progress: answered questions vs total.
   */
  async getProgress(): Promise<ExamProgress> {
    const total = await this.questionCards.count();
    const answered = await this.getAnsweredCount();
    return {
      answered,
      total,
      percent: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }

  /**
   * Get the indices of all answered questions.
   */
  async getAnsweredQuestionIndices(): Promise<number[]> {
    const indices: number[] = [];
    const count = await this.questionCards.count();
    for (let i = 0; i < count; i++) {
      if (await this.isQuestionAnswered(i)) indices.push(i);
    }
    return indices;
  }

  /**
   * Get the indices of all unanswered questions.
   */
  async getUnansweredQuestionIndices(): Promise<number[]> {
    const indices: number[] = [];
    const count = await this.questionCards.count();
    for (let i = 0; i < count; i++) {
      if (!(await this.isQuestionAnswered(i))) indices.push(i);
    }
    return indices;
  }

  // ─── Question navigation ─────────────────────────────────

  /**
   * Scroll to a specific question card by index.
   * Useful for long exams where questions are off-screen.
   */
  async scrollToQuestion(index: number) {
    const card = this.questionCards.nth(index);
    await card.scrollIntoViewIfNeeded();
  }

  /**
   * Scroll to the top of the exam page.
   */
  async scrollToTop() {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  /**
   * Scroll to the bottom of the exam page.
   */
  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  /**
   * Get the total scroll height and current scroll position.
   */
  async getScrollPosition(): Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }> {
    return this.page.evaluate(() => ({
      scrollTop: document.documentElement.scrollTop,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
  }

  // ─── Mark / Review (future feature) ─────────────────────
  // These methods provide the API for a planned "mark for review" feature.
  // They will become functional once the feature is implemented in Exam.tsx.
  // The expected implementation adds a flag/bookmark icon per question card
  // and a question navigation panel showing marked questions.

  /**
   * Mark a question for review (toggle bookmark).
   * @requires Exam.tsx must implement a "mark for review" toggle button per question card.
   * Expected selector: button with data-testid="mark-review-{index}" or similar inside each card.
   */
  async toggleMarkReview(index: number) {
    const card = this.questionCards.nth(index);
    // TODO: Update selector once mark-review feature is implemented in Exam.tsx
    // Expected: a flag/bookmark button inside each question card
    const markBtn = card.locator('[data-testid^="mark-review"], button:has(.lucide-flag), button:has(.lucide-bookmark)').first();
    if (await markBtn.isVisible().catch(() => false)) {
      await markBtn.click();
    }
  }

  /**
   * Check if a question is marked for review.
   * @requires Exam.tsx must implement visual state for marked questions.
   */
  async isMarkedForReview(index: number): Promise<boolean> {
    const card = this.questionCards.nth(index);
    // TODO: Update selector once mark-review feature is implemented
    // Expected: the mark button gets an active class when marked
    const markBtn = card.locator('[data-testid^="mark-review"], button:has(.lucide-flag), button:has(.lucide-bookmark)').first();
    if (!(await markBtn.isVisible().catch(() => false))) return false;
    const classes = await markBtn.getAttribute('class').catch(() => '');
    return !!(classes && (classes.includes('text-amber') || classes.includes('text-yellow') || classes.includes('bg-')));
  }

  /**
   * Get all question indices that are marked for review.
   */
  async getMarkedQuestionIndices(): Promise<number[]> {
    const indices: number[] = [];
    const count = await this.questionCards.count();
    for (let i = 0; i < count; i++) {
      if (await this.isMarkedForReview(i)) indices.push(i);
    }
    return indices;
  }

  /**
   * Get a question navigation panel (future feature).
   * Expected to return a grid of question numbers for quick navigation.
   * @requires A question navigation panel component in Exam.tsx.
   */
  getQuestionNavPanel(): Locator {
    // TODO: Update selector once question nav panel is implemented
    // Expected: a sidebar or bottom panel with numbered buttons for each question
    return this.page.locator('[data-testid="question-nav-panel"], .question-nav-panel, nav[aria-label="Question navigation"]');
  }

  /**
   * Jump to a specific question using the question navigation panel.
   * @requires Question nav panel to be implemented in Exam.tsx.
   */
  async jumpToQuestion(index: number) {
    const panel = this.getQuestionNavPanel();
    if (await panel.isVisible().catch(() => false)) {
      const btn = panel.locator(`button:has-text("${index + 1}")`).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        return;
      }
    }
    // Fallback: scroll directly to the question
    await this.scrollToQuestion(index);
  }

  // ─── Section navigation ──────────────────────────────────

  /**
   * Transition from listening to reading section.
   */
  async goToReading() {
    await this.goToReadingButton.click();
    await this.readingHeader.waitFor();
  }

  /**
   * Check which section is currently active.
   */
  async getCurrentSection(): Promise<'listening' | 'reading' | 'completed' | 'unknown'> {
    if (await this.examCompleted.isVisible().catch(() => false)) return 'completed';
    if (await this.readingHeader.isVisible().catch(() => false)) return 'reading';
    if (await this.listeningHeader.isVisible().catch(() => false)) return 'listening';
    return 'unknown';
  }

  // ─── Exam data extraction ────────────────────────────────

  /**
   * Extract the exam data JSON from the data-exam-data attribute.
   * Useful for contract validation in E2E tests.
   */
  async extractExamData(): Promise<unknown> {
    const raw = await this.examDataContainer.getAttribute('data-exam-data');
    if (!raw) throw new Error('data-exam-data attribute not found');
    return JSON.parse(raw);
  }

  // ─── Exam completion ─────────────────────────────────────

  /**
   * Submit the exam and wait for the completion screen.
   */
  async completeExam() {
    await this.completeButton.click();
    await this.examCompleted.waitFor();
  }

  /**
   * Parse the score text and return structured result.
   * Expects format: "Score: X / Y"
   */
  async getScore(): Promise<{ total: number; correct: number; percent: number }> {
    const text = await this.scoreText.textContent();
    if (!text) throw new Error('Score text not found');
    const match = text.match(/Score:\s*(\d+)\s*\/\s*(\d+)/);
    if (!match) throw new Error(`Could not parse score: ${text}`);
    const correct = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    return { total, correct, percent: Math.round((correct / total) * 100) };
  }

  /**
   * Navigate back to dashboard from completion screen.
   */
  async backToDashboard() {
    await this.backToDashboardButton.click();
  }

  // ─── Keyboard navigation ────────────────────────────────

  /**
   * Press Tab to move focus to the next interactive element within the exam.
   */
  async pressTab() {
    await this.page.keyboard.press('Tab');
  }

  /**
   * Press Shift+Tab to move focus to the previous interactive element.
   */
  async pressShiftTab() {
    await this.page.keyboard.press('Shift+Tab');
  }

  /**
   * Press Enter on the currently focused element.
   */
  async pressEnter() {
    await this.page.keyboard.press('Enter');
  }

  /**
   * Press Space on the currently focused element (useful for answer buttons).
   */
  async pressSpace() {
    await this.page.keyboard.press('Space');
  }

  /**
   * Get the currently focused element info.
   */
  async getFocusedElement(): Promise<{ tagName: string; role: string | null; text: string | null }> {
    return this.page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return { tagName: 'BODY', role: null, text: null };
      }
      return {
        tagName: el.tagName,
        role: el.getAttribute('role'),
        text: el.textContent?.trim() || null,
      };
    });
  }
}
