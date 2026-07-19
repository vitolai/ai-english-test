import type { Page, Locator } from '@playwright/test';
import { SettingsModal } from './SettingsModal';

export class DashboardPage {
  readonly page: Page;
  readonly settings: SettingsModal;

  // ─── Dashboard-level locators ────────────────────────────
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly settingsButton: Locator;
  readonly startExamButton: Locator;
  /** @deprecated Use `settings.startButton` instead. Kept for backward compat. */
  readonly goStartButton: Locator;

  // ─── Question count grid ─────────────────────────────────
  readonly questionCountButtons: Locator;

  // ─── Source options ──────────────────────────────────────
  readonly randomSourceButton: Locator;
  readonly webSourceButton: Locator;
  readonly selfImportSourceButton: Locator;

  // ─── Conditional inputs ──────────────────────────────────
  readonly webUrlInput: Locator;
  readonly pdfFileInput: Locator;
  readonly pdfFileName: Locator;

  // ─── Error banner ────────────────────────────────────────
  readonly errorBanner: Locator;
  readonly errorDismissButton: Locator;

  // ─── Loading overlay (App.tsx) ───────────────────────────
  readonly loadingOverlay: Locator;
  readonly loadingSpinner: Locator;
  readonly loadingPhaseHeading: Locator;
  readonly loadingMessage: Locator;
  readonly loadingProgressBar: Locator;
  readonly loadingPercentage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.settings = new SettingsModal(page);

    this.heading = page.getByRole('heading', { name: /TOEIC Practice Exam/i });
    this.subtitle = page.locator('text=Configure your exam settings');
    this.settingsButton = page.locator('button').filter({ has: page.locator('.lucide-settings') }).first();
    this.startExamButton = page.getByRole('button', { name: /START EXAM/i });
    // Proxy to SettingsModal's start button for backward compatibility
    this.goStartButton = this.settings.startButton;

    // Question count buttons (10, 20, 30, 50, 100, 200 (Full))
    this.questionCountButtons = page.locator('.grid.grid-cols-6 button');

    // Source selection buttons
    this.randomSourceButton = page.getByRole('button', { name: /Random Shuffle/i });
    this.webSourceButton = page.getByRole('button', { name: /Web-Sourced Content/i });
    this.selfImportSourceButton = page.getByRole('button', { name: /Self Import/i });

    // Conditional inputs
    this.webUrlInput = page.locator('input[placeholder*="https://"]');
    this.pdfFileInput = page.locator('input[type="file"]');
    this.pdfFileName = page.locator('text=Click to select a PDF').or(
      page.locator('.rounded-2xl.border-dashed span.font-bold'),
    );

    // Error state
    this.errorBanner = page.locator('.bg-red-50.border-red-200');
    this.errorDismissButton = page.getByRole('button', { name: /DISMISS & TRY AGAIN/i });

    // Loading overlay (rendered by App.tsx when `loading === true`)
    this.loadingOverlay = page.locator('.fixed.inset-0.z-50.bg-blue-900\\/60');
    this.loadingSpinner = this.loadingOverlay.locator('.animate-spin');
    this.loadingPhaseHeading = this.loadingOverlay.locator('h2');
    this.loadingMessage = this.loadingOverlay.locator('.text-blue-200');
    this.loadingProgressBar = this.loadingOverlay.locator('.bg-gradient-to-r');
    this.loadingPercentage = this.loadingOverlay.locator('text=/% COMPLETE/');
  }

  // ─── Navigation ──────────────────────────────────────────

  async goto() {
    await this.page.goto('/');
    await this.heading.waitFor();
  }

  // ─── Question count ──────────────────────────────────────

  async selectQuestionCount(count: number) {
    const label = count === 200 ? '200 (Full)' : String(count);
    await this.page.getByRole('button', { name: label, exact: true }).click();
  }

  /**
   * Get the currently selected question count.
   * Returns the text of the active button (e.g. "10", "200 (Full)").
   */
  async getSelectedQuestionCount(): Promise<string | null> {
    const active = this.questionCountButtons.locator('.bg-blue-600.text-white');
    if (await active.count() === 0) return null;
    return active.first().textContent();
  }

  // ─── Source selection ────────────────────────────────────

  async selectSource(source: 'random' | 'web' | 'self') {
    const buttons = {
      random: this.randomSourceButton,
      web: this.webSourceButton,
      self: this.selfImportSourceButton,
    } as const;
    await buttons[source].click();
  }

  /**
   * Check which source is currently selected by looking for the active state.
   */
  async getSelectedSource(): Promise<'random' | 'web' | 'self' | null> {
    if (await this.randomSourceButton.locator('.bg-blue-600').count() > 0) return 'random';
    if (await this.webSourceButton.locator('.bg-blue-600').count() > 0) return 'web';
    if (await this.selfImportSourceButton.locator('.bg-blue-600').count() > 0) return 'self';
    return null;
  }

  async fillWebUrl(url: string) {
    await this.webUrlInput.fill(url);
  }

  async uploadPdf(filePath: string) {
    await this.pdfFileInput.setInputFiles(filePath);
  }

  // ─── Settings modal delegation ───────────────────────────

  async openSettings() {
    await this.settingsButton.click();
    await this.settings.waitForOpen();
  }

  async closeSettings() {
    await this.settings.close();
  }

  async selectProvider(name: 'Nemotron' | 'OpenRouter' | 'Groq') {
    await this.settings.selectProvider(name);
  }

  async fillApiKey(key: string) {
    await this.settings.fillApiKey(key);
  }

  // ─── Loading overlay ─────────────────────────────────────

  /**
   * Wait for the loading overlay to appear (exam generation started).
   */
  async waitForLoadingStart(timeout = 10_000) {
    await this.loadingOverlay.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for the loading overlay to disappear (exam ready or error).
   */
  async waitForLoadingFinish(timeout = 180_000) {
    await this.loadingOverlay.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Read the current progress percentage from the loading overlay.
   * Returns a number 0-100, or null if overlay is not visible.
   */
  async getLoadingProgress(): Promise<number | null> {
    const text = await this.loadingPercentage.textContent().catch(() => null);
    if (!text) return null;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Read the current status message from the loading overlay.
   */
  async getLoadingMessage(): Promise<string | null> {
    return this.loadingMessage.textContent().catch(() => null);
  }

  /**
   * Read the phase label (e.g. "AI Generation", "Exam Generation").
   */
  async getLoadingPhase(): Promise<string | null> {
    return this.loadingPhaseHeading.textContent().catch(() => null);
  }

  /**
   * Check if the loading overlay is currently visible.
   */
  async isLoading(): Promise<boolean> {
    return this.loadingOverlay.isVisible().catch(() => false);
  }

  // ─── Keyboard navigation ────────────────────────────────

  /**
   * Press Tab to move focus to the next interactive element.
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
   * Press Escape to close modals or dismiss popups.
   */
  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Press Space on the currently focused element (useful for buttons/checkboxes).
   */
  async pressSpace() {
    await this.page.keyboard.press('Space');
  }

  /**
   * Get the currently focused element's tag and role info.
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

  /**
   * Navigate through interactive elements using Tab and collect focused elements.
   * Useful for accessibility audits and keyboard navigation tests.
   */
  async tabThroughElements(count: number): Promise<Array<{ tagName: string; role: string | null; text: string | null }>> {
    const results: Array<{ tagName: string; role: string | null; text: string | null }> = [];
    for (let i = 0; i < count; i++) {
      await this.pressTab();
      results.push(await this.getFocusedElement());
    }
    return results;
  }

  // ─── Composite workflows ─────────────────────────────────

  /**
   * Full flow: configure dashboard + open settings + fill key + start.
   * This is the primary method for E2E tests.
   */
  async startExamWithMockKey(
    count: number,
    source: 'random' | 'web' | 'self',
    mockApiKey: string,
    payload?: string,
  ) {
    await this.selectQuestionCount(count);
    await this.selectSource(source);

    if (source === 'web' && payload) {
      await this.fillWebUrl(payload);
    }

    if (source === 'self' && payload) {
      await this.uploadPdf(payload);
    }

    // Click START EXAM → opens settings modal
    await this.startExamButton.click();
    await this.settings.waitForOpen();

    // Fill API key and start
    await this.settings.startWithMockKey(mockApiKey);
  }

  /**
   * Start with full provider configuration (not just mock key).
   */
  async startExamWithConfig(
    count: number,
    source: 'random' | 'web' | 'self',
    config: {
      provider: 'Nemotron' | 'OpenRouter' | 'Groq';
      apiKey: string;
      model?: string;
      customBaseUrl?: string;
    },
    payload?: string,
  ) {
    await this.selectQuestionCount(count);
    await this.selectSource(source);

    if (source === 'web' && payload) {
      await this.fillWebUrl(payload);
    }

    if (source === 'self' && payload) {
      await this.uploadPdf(payload);
    }

    await this.startExamButton.click();
    await this.settings.waitForOpen();

    await this.settings.configureAndStart(config.provider, config.apiKey, {
      model: config.model,
      customBaseUrl: config.customBaseUrl,
    });
  }

  /**
   * Start exam and wait for the exam page to be ready.
   * Combines startExamWithMockKey + waitForLoadingFinish + wait for listening header.
   */
  async startAndReadyExam(
    count: number,
    source: 'random' | 'web' | 'self',
    mockApiKey: string,
    payload?: string,
    timeout = 180_000,
  ) {
    await this.startExamWithMockKey(count, source, mockApiKey, payload);
    await this.waitForLoadingFinish(timeout);
    await this.page.waitForSelector('h1:has-text("Listening Comprehension")', { timeout });
  }

  // ─── State checks ────────────────────────────────────────

  async waitForExamReady(timeout = 180_000) {
    await this.page.waitForSelector('h1:has-text("Listening Comprehension")', { timeout });
  }

  async waitForError(timeout = 30_000) {
    await this.page.waitForSelector('text=Generation Failed', { timeout });
  }

  async hasError(): Promise<boolean> {
    return this.errorBanner.isVisible().catch(() => false);
  }

  async dismissError() {
    await this.errorDismissButton.click();
  }

  /**
   * Get the error message text if an error banner is visible.
   */
  async getErrorMessage(): Promise<string | null> {
    if (!(await this.hasError())) return null;
    return this.errorBanner.locator('p.text-sm.font-bold').textContent().catch(() => null);
  }
}
