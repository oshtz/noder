/**
 * Fal.ai API Client
 *
 * Centralized module for fal.ai API operations.
 * Provides model listing and search functionality.
 */

import { useSettingsStore } from '../stores/useSettingsStore';

// =============================================================================
// Constants
// =============================================================================

const _FAL_BASE_URL = 'https://fal.run';
const FAL_MODELS_URL = 'https://api.fal.ai/v1/models';
const DEFAULT_TIMEOUT_MS = 30000;

// =============================================================================
// Types
// =============================================================================

/** Fal model definition */
export interface FalModel {
  endpoint_id: string;
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  pricing?: {
    base_price?: number;
    per_unit_price?: number;
    unit?: string;
  };
}

/** Models list response */
export interface FalModelsResponse {
  data: FalModel[];
  next_cursor?: string;
}

/** Model category filter */
export type FalModelCategory =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-audio'
  | 'text-to-speech'
  | 'speech-to-text'
  | 'llm';

/** List models options */
export interface ListFalModelsOptions {
  category?: FalModelCategory | FalModelCategory[];
  search?: string;
  signal?: AbortSignal;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the fal API key from the settings store
 */
function getApiKey(): string {
  return useSettingsStore.getState().falApiKey;
}

/**
 * Create a timeout controller for fetch requests
 */
function createTimeoutController(
  timeoutMs: number,
  existingSignal?: AbortSignal
): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  return { controller, timeoutId };
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * List available models from fal.ai
 */
export async function listModels(options: ListFalModelsOptions = {}): Promise<FalModel[]> {
  const { category, search, signal } = options;
  const apiKey = getApiKey();

  const { controller, timeoutId } = createTimeoutController(DEFAULT_TIMEOUT_MS, signal);

  try {
    const params = new URLSearchParams();

    // Add category filter if provided
    if (category) {
      if (Array.isArray(category)) {
        category.forEach((c) => params.append('category', c));
      } else {
        params.append('category', category);
      }
    }

    // Add search query if provided
    if (search) {
      params.append('query', search);
    }

    const url = params.toString() ? `${FAL_MODELS_URL}?${params}` : FAL_MODELS_URL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if API key is available
    if (apiKey) {
      headers['Authorization'] = `Key ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fal API error: ${response.status} - ${errorText}`);
    }

    const data: FalModelsResponse = await response.json();
    return data.data || [];
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }

    throw error;
  }
}

/**
 * List image generation models from fal.ai
 */
export async function listImageModels(signal?: AbortSignal): Promise<FalModel[]> {
  return listModels({ category: ['text-to-image', 'image-to-image'], signal });
}

/**
 * List video generation models from fal.ai
 */
export async function listVideoModels(signal?: AbortSignal): Promise<FalModel[]> {
  return listModels({ category: ['text-to-video', 'image-to-video'], signal });
}

/**
 * List audio generation models from fal.ai
 */
export async function listAudioModels(signal?: AbortSignal): Promise<FalModel[]> {
  return listModels({ category: ['text-to-audio', 'text-to-speech'], signal });
}

/**
 * List LLM models from fal.ai
 */
export async function listLLMModels(signal?: AbortSignal): Promise<FalModel[]> {
  return listModels({ category: 'llm', signal });
}

/**
 * Search for models by query
 */
export async function searchModels(query: string, signal?: AbortSignal): Promise<FalModel[]> {
  return listModels({ search: query, signal });
}
