/**
 * Constants for AssistantPanel components.
 */

import type { ModelCatalogEntry } from './types';

// =============================================================================
// Configuration Constants
// =============================================================================

export const MAX_TOOL_ROUNDS = 8;
export const MAX_RECENT_MODELS = 6;
export const PANEL_OPEN_STORAGE_KEY = 'assistant-panel-open';

// =============================================================================
// Model Catalog
// =============================================================================

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'openrouter/auto',
    label: 'Auto Router',
    provider: 'OpenRouter',
    tags: ['auto'],
    featured: true,
  },
  {
    id: 'openai/gpt-5.2',
    label: 'GPT-5.2',
    provider: 'OpenAI',
    tags: ['reasoning', 'tools'],
    featured: true,
  },
  {
    id: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    provider: 'OpenAI',
    tags: ['general', 'tools'],
    featured: true,
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    tags: ['multimodal', 'tools'],
    featured: true,
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    tags: ['reasoning', 'tools'],
    featured: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    tags: ['general', 'tools'],
    featured: true,
  },
  {
    id: 'anthropic/claude-3-haiku',
    label: 'Claude 3 Haiku',
    provider: 'Anthropic',
    tags: ['fast'],
    featured: false,
  },
  {
    id: 'google/gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'Google',
    tags: ['multimodal', 'fast'],
    featured: true,
  },
  {
    id: 'google/gemini-2.0-pro',
    label: 'Gemini 2.0 Pro',
    provider: 'Google',
    tags: ['multimodal', 'reasoning'],
    featured: true,
  },
  {
    id: 'google/gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'Google',
    tags: ['multimodal'],
    featured: false,
  },
  {
    id: 'google/gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'Google',
    tags: ['fast'],
    featured: false,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B Instruct',
    provider: 'Meta',
    tags: ['open', 'reasoning'],
    featured: true,
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B Instruct',
    provider: 'Meta',
    tags: ['open', 'fast'],
    featured: false,
  },
  {
    id: 'mistralai/mistral-large',
    label: 'Mistral Large',
    provider: 'Mistral',
    tags: ['general'],
    featured: true,
  },
  {
    id: 'mistralai/mistral-small',
    label: 'Mistral Small',
    provider: 'Mistral',
    tags: ['fast'],
    featured: false,
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1',
    provider: 'DeepSeek',
    tags: ['reasoning'],
    featured: true,
  },
  {
    id: 'deepseek/deepseek-v3',
    label: 'DeepSeek V3',
    provider: 'DeepSeek',
    tags: ['general'],
    featured: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B Instruct',
    provider: 'Qwen',
    tags: ['open', 'reasoning'],
    featured: true,
  },
  {
    id: 'qwen/qwen-2.5-32b-instruct',
    label: 'Qwen 2.5 32B Instruct',
    provider: 'Qwen',
    tags: ['open'],
    featured: false,
  },
  // Ollama (Local) models
  {
    id: 'ollama/llama3.2',
    label: 'Llama 3.2',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: true,
  },
  {
    id: 'ollama/llama3.1',
    label: 'Llama 3.1',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/mistral',
    label: 'Mistral',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/codellama',
    label: 'Code Llama',
    provider: 'Ollama',
    tags: ['local', 'code'],
    featured: false,
  },
  {
    id: 'ollama/gemma2',
    label: 'Gemma 2',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/qwen2.5',
    label: 'Qwen 2.5',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/deepseek-r1',
    label: 'DeepSeek R1',
    provider: 'Ollama',
    tags: ['local', 'reasoning'],
    featured: true,
  },
  // LM Studio (Local) models
  {
    id: 'lmstudio/local-model',
    label: 'Local Model',
    provider: 'LM Studio',
    tags: ['local'],
    featured: true,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

export const buildModelSearchText = (entry: ModelCatalogEntry): string =>
  [entry.id, entry.label, entry.provider, ...(entry.tags || [])].join(' ').toLowerCase();
