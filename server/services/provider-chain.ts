import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelFactory = (modelId: string) => any;

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
  maxRetries = 5,
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
