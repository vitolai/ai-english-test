// Provider Registry — Single source of truth for all AI providers
// Used by: Frontend UI, Backend routing, Test Mock, Documentation
// Strategy: BYOK (Bring Your Own Key) proxy — supports ANY OpenAI-compatible endpoint

export interface ModelCapabilities {
  text: boolean;
  streaming: boolean;
  vision: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  videoInput?: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  reasoning: boolean;
  codeExecution: boolean;
  localExecution: boolean;
  offline: boolean;
  apiKeyRequired: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapabilities;
  pricing?: { inputPer1M: number; outputPer1M: number };
  // Legacy aliases for backward compatibility
  supportsJsonMode?: boolean;
  supportsFunctionCalling?: boolean;
  supportsVision?: boolean;
  supportsAudioInput?: boolean;
  supportsAudioOutput?: boolean;
  supportsReasoning?: boolean;
  supportsCodeExecution?: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  authType: 'bearer' | 'header' | 'none';
  authHeader?: string;
  defaultHeaders?: Record<string, string>;
  models: ModelInfo[];
  category: 'cloud' | 'aggregator' | 'local' | 'custom';
  requiresApiKey: boolean;
  userProvidesBaseUrl?: boolean;
  rateLimits?: { requestsPerMinute?: number; tokensPerMinute?: number };
  capabilities: {
    text: boolean; streaming: boolean; vision: boolean;
    audioInput: boolean; audioOutput: boolean; functionCalling: boolean;
    jsonMode: boolean; reasoning: boolean; codeExecution: boolean;
    localExecution: boolean; offline: boolean;
  };
}

const fullCaps: ModelCapabilities = {
  text: true, streaming: true, vision: true, audioInput: true,
  audioOutput: true, videoInput: false, functionCalling: true,
  jsonMode: true, reasoning: true, codeExecution: true,
  localExecution: false, offline: false, apiKeyRequired: true,
};



export const PROVIDERS: Record<string, ProviderConfig> = {
  nvidia: {
    id: 'nvidia', name: 'NVIDIA Nemotron',
    description: 'NVIDIA Nemotron via NVIDIA Cloud API. Ultra 550B/Super 120B/Nano. Requires NVIDIA_API_KEY.',
    baseUrl: 'https://integrate.api.nvidia.com/v1', authType: 'bearer', authHeader: 'Authorization',
    defaultHeaders: { 'Content-Type': 'application/json' },
    category: 'cloud', requiresApiKey: true,
    models: [
      { id: 'nvidia/nemotron-3-ultra-550b', name: 'Nemotron 3 Ultra (550B)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { ...fullCaps, apiKeyRequired: true }, pricing: { inputPer1M: 0.27, outputPer1M: 1.08 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'nvidia/nemotron-3-super-120b', name: 'Nemotron 3 Super (120B)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { ...fullCaps, apiKeyRequired: true }, pricing: { inputPer1M: 0.06, outputPer1M: 0.24 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'nvidia/nemotron-3-nano-30b', name: 'Nemotron 3 Nano (30B)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { ...fullCaps, apiKeyRequired: true }, pricing: { inputPer1M: 0.015, outputPer1M: 0.06 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 60, tokensPerMinute: 500000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  openrouter: {
    id: 'openrouter', name: 'OpenRouter',
    description: 'Aggregator for 200+ models via single API key. Includes Nemotron free tier, Gemini, Claude, Llama, etc.',
    baseUrl: 'https://openrouter.ai/api/v1', authType: 'bearer', authHeader: 'Authorization',
    defaultHeaders: { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://toeic-ai-pro.local', 'X-Title': 'AI Exam Generator' },
    category: 'aggregator', requiresApiKey: true,
    models: [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra (Free)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super (Free)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'google/gemma-4-31b-it:free', name: 'Gemini 2.5 Pro (Free)', contextWindow: 2000000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemini 2.5 Flash (Free)', contextWindow: 1000000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Claude 3.5 Sonnet (Free)', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.2 90B Vision (Free)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 60, tokensPerMinute: 1000000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  groq: {
    id: 'groq', name: 'Groq',
    description: 'Ultra-fast inference for Llama models. Free tier available. Llama 3.2 90B Vision for Part I photo description.',
    baseUrl: 'https://api.groq.com/openai/v1', authType: 'bearer', authHeader: 'Authorization',
    defaultHeaders: { 'Content-Type': 'application/json' },
    category: 'cloud', requiresApiKey: true,
    models: [
      { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision (Preview)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', contextWindow: 131072, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: false, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.59, outputPer1M: 0.79 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: true, supportsCodeExecution: false },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 131072, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: false, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.05, outputPer1M: 0.08 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: false },
    ],
    rateLimits: { requestsPerMinute: 30, tokensPerMinute: 6000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  anthropic: {
    id: 'anthropic', name: 'Anthropic',
    description: 'Claude models direct from Anthropic. Best for reasoning, coding, analysis.',
    baseUrl: 'https://api.anthropic.com/v1', authType: 'bearer', authHeader: 'x-api-key',
    defaultHeaders: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    category: 'cloud', requiresApiKey: true,
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { ...fullCaps, apiKeyRequired: true }, pricing: { inputPer1M: 3.00, outputPer1M: 15.00 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { ...fullCaps, apiKeyRequired: true }, pricing: { inputPer1M: 0.80, outputPer1M: 4.00 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 50, tokensPerMinute: 1000000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  google: {
    id: 'google', name: 'Google Gemini',
    description: 'Gemini models direct from Google. 2M context, native multimodal, generous free tier.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', authType: 'header', authHeader: 'x-goog-api-key',
    defaultHeaders: { 'Content-Type': 'application/json' },
    category: 'cloud', requiresApiKey: true,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2000000, maxOutputTokens: 8192, capabilities: { ...fullCaps, apiKeyRequired: true }, pricing: { inputPer1M: 1.25, outputPer1M: 10.00 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.075, outputPer1M: 0.30 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 60, tokensPerMinute: 1000000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  azure: {
    id: 'azure', name: 'Azure OpenAI',
    description: 'Enterprise OpenAI on Azure. User provides deployment endpoint. Best for enterprise compliance.',
    baseUrl: 'USER_PROVIDED', authType: 'header', authHeader: 'api-key',
    category: 'cloud', requiresApiKey: true, userProvidesBaseUrl: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxOutputTokens: 16384, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 5.00, outputPer1M: 15.00 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, maxOutputTokens: 16384, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.15, outputPer1M: 0.60 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  together: {
    id: 'together', name: 'Together.ai',
    description: 'Fast inference for open models. Good free tier. Supports Llama, Qwen, Mixtral, etc.',
    baseUrl: 'https://api.together.xyz/v1', authType: 'bearer', authHeader: 'Authorization',
    defaultHeaders: { 'Content-Type': 'application/json' },
    category: 'aggregator', requiresApiKey: true,
    models: [
      { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct', name: 'Llama 3.2 90B Vision', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.90, outputPer1M: 0.90 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 100, tokensPerMinute: 1000000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  deepseek: {
    id: 'deepseek', name: 'DeepSeek',
    description: 'Strong reasoning models. DeepSeek-V3, R1 for math/code. Very competitive pricing.',
    baseUrl: 'https://api.deepseek.com/v1', authType: 'bearer', authHeader: 'Authorization',
    defaultHeaders: { 'Content-Type': 'application/json' },
    category: 'cloud', requiresApiKey: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.14, outputPer1M: 0.28 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoning)', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0.55, outputPer1M: 2.19 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 60, tokensPerMinute: 1000000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  cohere: {
    id: 'cohere', name: 'Cohere',
    description: 'Enterprise RAG, embeddings, command models. Good for retrieval-augmented generation.',
    baseUrl: 'https://api.cohere.ai/v1', authType: 'bearer', authHeader: 'Authorization',
    defaultHeaders: { 'Content-Type': 'application/json' },
    category: 'cloud', requiresApiKey: true,
    models: [
      { id: 'command-r-plus', name: 'Command R+', contextWindow: 128000, maxOutputTokens: 4096, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 3.00, outputPer1M: 15.00 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: true, supportsCodeExecution: true },
    ],
    capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  bedrock: {
    id: 'bedrock', name: 'AWS Bedrock',
    description: 'Enterprise managed AI on AWS. Requires AWS credentials + region. Supports Anthropic, Meta, Cohere, Mistral, Titan.',
    baseUrl: 'https://bedrock-runtime.{region}.amazonaws.com', authType: 'header', authHeader: 'Authorization',
    category: 'cloud', requiresApiKey: true, userProvidesBaseUrl: true,
    models: [
      { id: 'anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude 3.5 Sonnet', contextWindow: 200000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 3.00, outputPer1M: 15.00 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  custom: {
    id: 'custom', name: 'Custom / Self-hosted',
    description: 'Any OpenAI-compatible endpoint. User provides base URL + API key. Supports Ollama, vLLM, TGI, LM Studio, LocalAI, etc.',
    baseUrl: 'USER_PROVIDED', authType: 'bearer', authHeader: 'Authorization',
    category: 'custom', requiresApiKey: false, userProvidesBaseUrl: true,
    models: [
      { id: 'custom-model', name: 'Custom Model (user-defined)', contextWindow: 32768, maxOutputTokens: 4096, capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: true, offline: false, apiKeyRequired: false }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: true, supportsAudioInput: true, supportsAudioOutput: true, supportsReasoning: true, supportsCodeExecution: true },
    ],
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: true, offline: false },
  },

  ollama: {
    id: 'ollama', name: 'Ollama Cloud',
    description: 'Ollama Cloud API. Requires OLLAMA_CLOUD_API_KEY. Cloud-only service.',
    baseUrl: 'https://ollama.com/v1', authType: 'bearer', authHeader: 'Authorization',
    category: 'cloud', requiresApiKey: true, userProvidesBaseUrl: false,
    models: [
      { id: 'nemotron-3-super', name: 'Nemotron 3 Super', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'nemotron-3-ultra', name: 'Nemotron 3 Ultra', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: true, supportsCodeExecution: true },
      { id: 'gpt-oss:120b', name: 'GPT-OSS 120B', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
      { id: 'gpt-oss:20b', name: 'GPT-OSS 20B', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
      { id: 'kimi-k2.5', name: 'Kimi K2.5', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
      { id: 'glm-5.1', name: 'GLM 5.1', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
      { id: 'gemma4:31b', name: 'Gemma 4 31B', contextWindow: 128000, maxOutputTokens: 8192, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: true, jsonMode: true, reasoning: false, codeExecution: true, localExecution: false, offline: false, apiKeyRequired: true }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: true, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: true },
    ],
    rateLimits: { requestsPerMinute: 60, tokensPerMinute: 1000000 },
    capabilities: { text: true, streaming: true, vision: true, audioInput: true, audioOutput: true, functionCalling: true, jsonMode: true, reasoning: true, codeExecution: true, localExecution: false, offline: false },
  },

  mock: {
    id: 'mock', name: 'Mock',
    description: 'Deterministic mock generator for testing. Triggered when API key contains "test". Zero external calls, zero cost, deterministic output.',
    baseUrl: 'mock://local', authType: 'none', category: 'aggregator', requiresApiKey: false,
    models: [
      { id: 'mock-toeic-generator', name: 'Mock TOEIC Generator', contextWindow: 4096, maxOutputTokens: 4096, capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: false, jsonMode: true, reasoning: false, codeExecution: false, localExecution: false, offline: true, apiKeyRequired: false }, pricing: { inputPer1M: 0, outputPer1M: 0 }, supportsJsonMode: true, supportsFunctionCalling: false, supportsVision: false, supportsAudioInput: false, supportsAudioOutput: false, supportsReasoning: false, supportsCodeExecution: false },
    ],
    capabilities: { text: true, streaming: true, vision: false, audioInput: false, audioOutput: false, functionCalling: false, jsonMode: true, reasoning: false, codeExecution: false, localExecution: false, offline: true },
  },
};

// ============================================================
// TYPE EXPORTS & UTILITIES
// ============================================================

export type ProviderId = keyof typeof PROVIDERS;
export type ModelId = string;

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const CLOUD_PROVIDERS = ['nvidia', 'anthropic', 'google', 'azure', 'groq', 'deepseek', 'cohere', 'bedrock'];
export const AGGREGATOR_PROVIDERS = ['openrouter', 'together', 'fireworks', 'mock'];
export const LOCAL_PROVIDERS = ['ollama', 'custom'];
export const ALL_PROVIDERS = ['nvidia', 'openrouter', 'groq', 'anthropic', 'google', 'azure', 'together', 'fireworks', 'deepseek', 'cohere', 'bedrock', 'ollama', 'custom', 'mock'];

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS[id];
}

export function getModel(providerId: string, modelId: string): ModelInfo | undefined {
  const p = PROVIDERS[providerId];
  return p?.models.find(m => m.id === modelId);
}

export function getAllModels(): Array<{ providerId: string; model: ModelInfo }> {
  const r = [];
  for (const pid of Object.keys(PROVIDERS)) {
    for (const m of PROVIDERS[pid].models) {
      r.push({ providerId: pid, model: m });
    }
  }
  return r;
}

export const LEGACY_AI_SOURCE_MAP: Record<string, string> = { 'local-ollama': 'ollama', 'ai-cloud': 'nvidia', 'mock-mode': 'mock' };
export function resolveProviderFromLegacySource(s: string): string {
  return LEGACY_AI_SOURCE_MAP[s] || 'nvidia';
}

export const GATEWAY_URLS: Record<string, string> = {
  orcln: 'http://orcln:8080/v1',
  pi5n: 'http://pi5n:8080/v1',
  wsl2n: 'http://localhost:8080/v1',
  msin: 'http://localhost:8080/v1',
  ecn2: 'http://ecn2:8080/v1',
  gcpn: 'http://gcpn:8080/v1',
};
export function getGatewayUrlForHost(h: string): string {
  return GATEWAY_URLS[h] || 'https://integrate.api.nvidia.com/v1';
}

export function getModelsWithCapability<K extends keyof ModelCapabilities>(capability: K, v = true) {
  return getAllModels().filter(({ model }) => model.capabilities[capability] === v);
}

export function getModelsWithCapabilities(caps: Partial<ModelCapabilities>) {
  return getAllModels().filter(({ model }) => Object.entries(caps).every(([c, req]) => !req || model.capabilities[c as keyof ModelCapabilities] === true));
}

export function getModelsForTask(task: 'part1-photo' | 'text-only' | 'audio-input' | 'audio-output' | 'function-calling' | 'json-mode' | 'reasoning' | 'code' | 'local' | 'offline') {
  const capMap = {
    'part1-photo': { vision: true },
    'text-only': { text: true },
    'audio-input': { audioInput: true },
    'audio-output': { audioOutput: true },
    'function-calling': { functionCalling: true },
    'json-mode': { jsonMode: true },
    'reasoning': { reasoning: true },
    'code': { codeExecution: true },
    'local': { localExecution: true },
    'offline': { offline: true },
  };
  const req = capMap[task] || { text: true };
  const r = [];
  for (const pid of Object.keys(PROVIDERS)) {
    for (const m of PROVIDERS[pid].models) {
      if (Object.entries(req).every(([c, req]) => !req || m.capabilities[c as keyof ModelCapabilities] === true)) {
        r.push({ providerId: pid, model: m });
      }
    }
  }
  return r;
}

export function getDefaultModelForTask(task: 'part1-photo' | 'text' | 'e2e' | 'audio') {
  const models = getAllModels();
  const taskMap = { 'part1-photo': 'part1-photo', 'text': 'text-only', 'e2e': 'text-only', 'audio': 'audio-output' };
  const filtered = models.filter(({ model }) => {
    const req = { vision: taskMap[task] === 'part1-photo', audioOutput: taskMap[task] === 'audio-output' };
    return Object.entries(req).every(([c, req]) => !req || model.capabilities[c as keyof ModelCapabilities] === true);
  });
  if (!filtered.length) return null;
  return filtered.sort((a, b) => (b.model.pricing?.inputPer1M === 0 ? 1 : 0) - (a.model.pricing?.inputPer1M === 0 ? 1 : 0))[0];
}