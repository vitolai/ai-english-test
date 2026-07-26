import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  PROVIDER_IDS,
  getProvider,
  getModel,
} from '../../src/lib/providers';

describe('Provider Registry', () => {
  describe('PROVIDERS constant', () => {
    it('should have all expected providers', () => {
      expect(PROVIDERS).toHaveProperty('nvidia');
      expect(PROVIDERS).toHaveProperty('openrouter');
      expect(PROVIDERS).toHaveProperty('groq');
      expect(PROVIDERS).toHaveProperty('mock');
    });

    it('should have correct provider count', () => {
      expect(Object.keys(PROVIDERS)).toHaveLength(13);
    });

    it('should have nvidia with correct properties', () => {
      const provider = PROVIDERS.nvidia;
      expect(provider.id).toBe('nvidia');
      expect(provider.name).toBe('NVIDIA Nemotron');
      expect(provider.category).toBe('cloud');
      expect(provider.requiresApiKey).toBe(true);
      expect(provider.models).toHaveLength(3);
    });

    it('should have openrouter with correct properties', () => {
      const provider = PROVIDERS.openrouter;
      expect(provider.id).toBe('openrouter');
      expect(provider.name).toBe('OpenRouter');
      expect(provider.category).toBe('aggregator');
      expect(provider.models.length).toBeGreaterThan(0);
    });

    it('should have groq with correct properties', () => {
      const provider = PROVIDERS.groq;
      expect(provider.id).toBe('groq');
      expect(provider.name).toBe('Groq');
      expect(provider.category).toBe('cloud');
      expect(provider.models).toHaveLength(3);
    });

    it('should have mock provider for testing', () => {
      const provider = PROVIDERS.mock;
      expect(provider.id).toBe('mock');
      expect(provider.name).toBe('Mock');
      expect(provider.requiresApiKey).toBe(false);
      expect(provider.models).toHaveLength(1);
    });
  });

  describe('PROVIDER_IDS', () => {
    it('should contain all provider IDs', () => {
      expect(PROVIDER_IDS).toContain('nvidia');
      expect(PROVIDER_IDS).toContain('openrouter');
      expect(PROVIDER_IDS).toContain('groq');
      expect(PROVIDER_IDS).toContain('mock');
    });

    it('should have 13 providers', () => {
      expect(PROVIDER_IDS).toHaveLength(13);
    });
  });

  describe('getProvider()', () => {
    it('should return provider by ID', () => {
      const provider = getProvider('nvidia');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('nvidia');
      expect(provider?.name).toBe('NVIDIA Nemotron');
    });

    it('should return undefined for unknown provider ID', () => {
      const provider = getProvider('unknown');
      expect(provider).toBeUndefined();
    });

    it('should return mock provider with hidden flag', () => {
      const provider = getProvider('mock');
      expect(provider).toBeDefined();
      expect(provider?.hidden).toBe(true);
    });
  });

  describe('getModel()', () => {
    it('should return model by provider and namespaced model ID', () => {
      const model = getModel('nvidia', 'nvidia/nemotron-3-ultra-550b');
      expect(model).toBeDefined();
      expect(model?.id).toBe('nvidia/nemotron-3-ultra-550b');
      expect(model?.name).toBe('Nemotron 3 Ultra (550B)');
    });

    it('should return undefined for non-existent model', () => {
      const model = getModel('nvidia', 'non-existent-model');
      expect(model).toBeUndefined();
    });

    it('should return undefined for non-existent provider', () => {
      const model = getModel('unknown', 'model-id');
      expect(model).toBeUndefined();
    });
  });

  describe('Model specifications', () => {
    it('should have valid pricing for openrouter models', () => {
      const openrouter = PROVIDERS.openrouter;
      openrouter.models.forEach(model => {
        expect(model.pricing).toBeDefined();
        expect(model.pricing?.inputPer1M).toBeGreaterThanOrEqual(0);
        expect(model.pricing?.outputPer1M).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have valid context windows', () => {
      Object.values(PROVIDERS).forEach(provider => {
        provider.models.forEach(model => {
          expect(model.contextWindow).toBeGreaterThan(0);
          expect(model.maxOutputTokens).toBeGreaterThan(0);
        });
      });
    });

    it('should have valid JSON mode support', () => {
      Object.values(PROVIDERS).forEach(provider => {
        provider.models.forEach(model => {
          expect(typeof model.supportsJsonMode).toBe('boolean');
        });
      });
    });
  });
});
