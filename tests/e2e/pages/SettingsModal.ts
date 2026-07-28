import type { Page, Locator } from '@playwright/test';

type ProviderName = 'Nemotron' | 'OpenRouter' | 'Groq';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  Nemotron: 'Nemotron',
  OpenRouter: 'OpenRouter',
  Groq: 'Groq',
};

export class SettingsModal {
  readonly page: Page;

  // ─── Modal shell ─────────────────────────────────────────
  readonly modal: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  readonly startButton: Locator;

  // ─── Primary provider ────────────────────────────────────
  readonly providerButtons: Locator;

  // ─── Model ───────────────────────────────────────────────
  readonly modelSelect: Locator;

  // ─── API Key ─────────────────────────────────────────────
  readonly apiKeyInput: Locator;
  readonly apiKeyToggle: Locator;
  readonly apiKeyDocsLink: Locator;

  // ─── Advanced ────────────────────────────────────────────
  readonly advancedDetails: Locator;
  readonly customBaseUrlInput: Locator;

  // ─── Fallback ────────────────────────────────────────────
  readonly fallbackCheckbox: Locator;
  readonly fallbackSection: Locator;
  readonly fallbackProviderButtons: Locator;
  readonly fallbackModelSelect: Locator;
  readonly fallbackApiKeyInput: Locator;
  readonly fallbackApiKeyToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Modal container — the fixed overlay with zoom-in animation
    this.modal = page.locator('.fixed.inset-0.z-50');
    this.title = this.modal.getByRole('heading', { name: /AI Configuration/i });
    this.closeButton = this.modal.locator('button').filter({ has: page.locator('.lucide-x') }).first();
    this.startButton = this.modal.getByRole('button', { name: /GO! START PRACTICE/i });

    // Primary provider grid (3-col grid inside the modal)
    this.providerButtons = this.modal.locator('.grid.grid-cols-3').first().locator('button');

    // Model dropdown
    this.modelSelect = this.modal.locator('select').first();

    // API key — the first input whose placeholder hints at an API key
    this.apiKeyInput = this.modal.locator(
      'input[placeholder*="API Key"], input[placeholder*="API Key"], input[placeholder*="sk-or"], input[placeholder*="gsk_"]',
    ).first();

    // Eye toggle next to API key
    this.apiKeyToggle = this.apiKeyInput.locator('..').locator('button');

    // "Get Key" docs link
    this.apiKeyDocsLink = this.modal.locator('a[target="_blank"]', { hasText: 'Get Key' });

    // Advanced section (details/summary)
    this.advancedDetails = this.modal.locator('details.group');
    this.customBaseUrlInput = this.advancedDetails.locator('input[type="text"]');

    // Fallback section
    this.fallbackCheckbox = this.modal.locator('input[type="checkbox"]');
    this.fallbackSection = this.modal.locator('.border-l-2.border-blue-100');
    this.fallbackProviderButtons = this.fallbackSection.locator('.grid.grid-cols-3 button, .grid.grid-cols-2 button');
    this.fallbackModelSelect = this.fallbackSection.locator('select');
    this.fallbackApiKeyInput = this.fallbackSection.locator(
      'input[placeholder*="API Key"], input[placeholder*="API Key"], input[placeholder*="sk-or"], input[placeholder*="gsk_"]',
    ).first();
    this.fallbackApiKeyToggle = this.fallbackApiKeyInput.locator('..').locator('button');
  }

  // ─── Visibility checks ───────────────────────────────────

  async waitForOpen() {
    await this.title.waitFor();
  }

  async waitForClosed() {
    await this.modal.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }

  async isOpen(): Promise<boolean> {
    return this.title.isVisible().catch(() => false);
  }

  async close() {
    await this.closeButton.click();
    await this.waitForClosed();
  }

  // ─── Provider selection & queries ────────────────────────

  async selectProvider(name: ProviderName) {
    const label = PROVIDER_LABELS[name];
    await this.providerButtons.filter({ hasText: label }).click();
  }

  /**
   * Get the currently selected provider name.
   * Works by checking which provider button has the active (blue) state.
   */
  async getSelectedProvider(): Promise<ProviderName | null> {
    for (const name of Object.keys(PROVIDER_LABELS) as ProviderName[]) {
      const label = PROVIDER_LABELS[name];
      const btn = this.providerButtons.filter({ hasText: label });
      const classes = await btn.getAttribute('class').catch(() => '');
      if (classes && classes.includes('border-blue-600') && classes.includes('bg-blue-50')) {
        return name;
      }
    }
    return null;
  }

  /**
   * Check if a specific provider is currently selected.
   */
  async isProviderSelected(name: ProviderName): Promise<boolean> {
    return this.getSelectedProvider().then((p) => p === name);
  }

  /**
   * Get the number of available provider buttons.
   */
  async getProviderCount(): Promise<number> {
    return this.providerButtons.count();
  }

  // ─── Model selection & queries ───────────────────────────

  async selectModel(modelName: string) {
    await this.modelSelect.selectOption({ label: modelName });
  }

  async selectModelByValue(value: string) {
    await this.modelSelect.selectOption(value);
  }

  /**
   * Get the currently selected model's display name.
   */
  async getSelectedModel(): Promise<string | null> {
    return this.modelSelect.locator('option[selected]').textContent().catch(() => null)
      ?? this.modelSelect.inputValue().then(async (val) => {
        const option = this.modelSelect.locator(`option[value="${val}"]`);
        return option.textContent().catch(() => null);
      });
  }

  /**
   * Get the currently selected model's value attribute.
   */
  async getSelectedModelValue(): Promise<string | null> {
    return this.modelSelect.inputValue().catch(() => null);
  }

  /**
   * Get all available model options in the dropdown.
   * Returns an array of { value, label } objects.
   */
  async getAvailableModels(): Promise<Array<{ value: string; label: string }>> {
    const options = this.modelSelect.locator('option');
    const count = await options.count();
    const models: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const value = await option.getAttribute('value') ?? '';
      const label = await option.textContent() ?? '';
      models.push({ value, label });
    }
    return models;
  }

  /**
   * Get the count of available models.
   */
  async getModelCount(): Promise<number> {
    return this.modelSelect.locator('option').count();
  }

  // ─── API Key ─────────────────────────────────────────────

  async fillApiKey(key: string) {
    await this.apiKeyInput.fill(key);
  }

  async toggleApiKeyVisibility() {
    await this.apiKeyToggle.click();
  }

  async isApiKeyVisible(): Promise<boolean> {
    return this.apiKeyInput.getAttribute('type').then((t) => t === 'text');
  }

  /**
   * Get the current value of the API key input.
   */
  async getApiKey(): Promise<string> {
    return this.apiKeyInput.inputValue();
  }

  /**
   * Check if the API key docs link ("Get Key") is visible.
   */
  async hasApiKeyDocsLink(): Promise<boolean> {
    return this.apiKeyDocsLink.isVisible().catch(() => false);
  }

  // ─── Advanced settings ───────────────────────────────────

  async fillCustomBaseUrl(url: string) {
    await this.advancedDetails.locator('summary').click();
    await this.customBaseUrlInput.fill(url);
  }

  /**
   * Check if the advanced section is expanded.
   */
  async isAdvancedOpen(): Promise<boolean> {
    return this.advancedDetails.locator('input[type="text"]').isVisible().catch(() => false);
  }

  /**
   * Get the current custom base URL value.
   */
  async getCustomBaseUrl(): Promise<string> {
    return this.customBaseUrlInput.inputValue().catch(() => '');
  }

  // ─── Fallback provider ───────────────────────────────────

  async enableFallback() {
    await this.fallbackCheckbox.check();
    await this.fallbackSection.waitFor();
  }

  async disableFallback() {
    await this.fallbackCheckbox.uncheck();
  }

  async isFallbackEnabled(): Promise<boolean> {
    return this.fallbackCheckbox.isChecked();
  }

  async selectFallbackProvider(name: ProviderName) {
    const label = PROVIDER_LABELS[name];
    await this.fallbackProviderButtons.filter({ hasText: label }).click();
  }

  async selectFallbackModel(modelName: string) {
    await this.fallbackModelSelect.selectOption({ label: modelName });
  }

  async fillFallbackApiKey(key: string) {
    await this.fallbackApiKeyInput.fill(key);
  }

  async toggleFallbackApiKeyVisibility() {
    await this.fallbackApiKeyToggle.click();
  }

  /**
   * Get the currently selected fallback provider name.
   */
  async getSelectedFallbackProvider(): Promise<ProviderName | null> {
    const buttons = this.fallbackProviderButtons;
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const classes = await btn.getAttribute('class').catch(() => '');
      if (classes && classes.includes('border-blue-600')) {
        const text = await btn.textContent() ?? '';
        for (const [name, label] of Object.entries(PROVIDER_LABELS)) {
          if (text.includes(label)) return name as ProviderName;
        }
      }
    }
    return null;
  }

  /**
   * Get the currently selected fallback model display name.
   */
  async getSelectedFallbackModel(): Promise<string | null> {
    return this.fallbackModelSelect.locator('option[selected]').textContent().catch(() => null)
      ?? this.fallbackModelSelect.inputValue().then(async (val) => {
        const option = this.fallbackModelSelect.locator(`option[value="${val}"]`);
        return option.textContent().catch(() => null);
      });
  }

  /**
   * Get all available fallback model options.
   */
  async getAvailableFallbackModels(): Promise<Array<{ value: string; label: string }>> {
    const options = this.fallbackModelSelect.locator('option');
    const count = await options.count();
    const models: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const value = await option.getAttribute('value') ?? '';
      const label = await option.textContent() ?? '';
      models.push({ value, label });
    }
    return models;
  }

  // ─── Full state snapshot ─────────────────────────────────

  /**
   * Get a complete snapshot of the current settings state.
   * Useful for assertions and debugging.
   */
  async getState(): Promise<{
    isOpen: boolean;
    selectedProvider: ProviderName | null;
    selectedModel: string | null;
    apiKeyLength: number;
    fallbackEnabled: boolean;
    selectedFallbackProvider: ProviderName | null;
    selectedFallbackModel: string | null;
    advancedOpen: boolean;
  }> {
    return {
      isOpen: await this.isOpen(),
      selectedProvider: await this.getSelectedProvider(),
      selectedModel: await this.getSelectedModel(),
      apiKeyLength: (await this.getApiKey()).length,
      fallbackEnabled: await this.isFallbackEnabled(),
      selectedFallbackProvider: await this.getSelectedFallbackProvider(),
      selectedFallbackModel: await this.getSelectedFallbackModel(),
      advancedOpen: await this.isAdvancedOpen(),
    };
  }

  // ─── Composite workflows ─────────────────────────────────

  /**
   * Quick setup: select provider + fill API key + start.
   * Assumes the modal is already open.
   */
  async configureAndStart(
    provider: ProviderName,
    apiKey: string,
    options?: { model?: string; customBaseUrl?: string },
  ) {
    await this.selectProvider(provider);
    if (options?.model) await this.selectModel(options.model);
    await this.fillApiKey(apiKey);
    if (options?.customBaseUrl) await this.fillCustomBaseUrl(options.customBaseUrl);
    await this.startButton.click();
  }

  /**
   * Full mock setup: fill API key + start (provider defaults to Nemotron).
   */
  async startWithMockKey(apiKey: string) {
    await this.fillApiKey(apiKey);
    await this.startButton.click();
  }

  /**
   * Configure and start with full state verification.
   * Returns the state snapshot before starting for post-hoc assertions.
   */
  async configureAndStartWithSnapshot(
    provider: ProviderName,
    apiKey: string,
    options?: { model?: string; customBaseUrl?: string },
  ) {
    const stateBeforeStart = await this.getState();
    await this.configureAndStart(provider, apiKey, options);
    return stateBeforeStart;
  }
}
