/**
 * OpenRouter Model List Cache
 *
 * Caches model lists from OpenRouter API to enable instant dropdown display.
 * Updates are fetched in the background and merged with cached data.
 * Supports filtering by output modality (text, image, audio).
 */

import { listModels, type OpenRouterModel, type OutputModality } from '../api/openrouter';

// =============================================================================
// Types
// =============================================================================

/** Cache entry structure */
interface CacheEntry {
  models: OpenRouterModel[];
  timestamp: number;
  isFetching: boolean;
}

/** Storage cache structure */
interface StoredCache {
  models: OpenRouterModel[];
  timestamp: number;
}

/** Result from getModels function */
export interface GetModelsResult {
  models: OpenRouterModel[];
  fromCache: boolean;
}

/** Cache status for debugging */
export interface CacheStatus {
  [key: string]: {
    modelCount: number;
    timestamp: number;
    age: number;
    isFetching: boolean;
  };
}

/** Update callback function type */
export type OnUpdateCallback = (models: OpenRouterModel[]) => void;

// =============================================================================
// Constants
// =============================================================================

/** LocalStorage key prefix for persistence */
const CACHE_STORAGE_PREFIX = 'noder-openrouter-models-';

/** Cache TTL: 30 minutes (OpenRouter model list changes less frequently) */
const CACHE_TTL_MS = 30 * 60 * 1000;

// =============================================================================
// State
// =============================================================================

/** In-memory cache for model lists */
const modelListCache = new Map<string, CacheEntry>();

/** Subscribers for cache updates */
const subscribers = new Map<string, Set<OnUpdateCallback>>();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a cache key for an output modality filter
 */
function getCacheKey(outputModality?: OutputModality): string {
  return outputModality ? `modality:${outputModality}` : 'all';
}

/**
 * Load cached models from localStorage
 */
function loadFromStorage(cacheKey: string): StoredCache | null {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_PREFIX + cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredCache;
      // Check if cache is still valid (within TTL)
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[OpenRouterModelCache] Failed to load from storage:', err);
  }
  return null;
}

/**
 * Save cached models to localStorage
 */
function saveToStorage(cacheKey: string, data: StoredCache): void {
  try {
    localStorage.setItem(CACHE_STORAGE_PREFIX + cacheKey, JSON.stringify(data));
  } catch (err) {
    console.warn('[OpenRouterModelCache] Failed to save to storage:', err);
  }
}

/**
 * Notify subscribers of cache updates
 */
function notifySubscribers(cacheKey: string, models: OpenRouterModel[]): void {
  const subs = subscribers.get(cacheKey);
  if (subs) {
    subs.forEach((callback) => callback(models));
  }
}

/**
 * Fetch models from OpenRouter API
 */
async function fetchModelsFromAPI(outputModality?: OutputModality): Promise<OpenRouterModel[]> {
  const models = await listModels({ outputModality });
  return models;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get cached models or fetch if not available.
 * Returns immediately with cached data if available, then refreshes in background.
 *
 * @param outputModality - Optional filter for output type (text, image, audio)
 * @param onUpdate - Callback when models are updated
 * @returns Promise with models and cache status
 */
export async function getOpenRouterModels(
  outputModality?: OutputModality,
  onUpdate: OnUpdateCallback | null = null
): Promise<GetModelsResult> {
  const cacheKey = getCacheKey(outputModality);

  // Check in-memory cache first
  let cacheEntry = modelListCache.get(cacheKey);

  // Try localStorage if not in memory
  if (!cacheEntry) {
    const stored = loadFromStorage(cacheKey);
    if (stored) {
      cacheEntry = {
        models: stored.models,
        timestamp: stored.timestamp,
        isFetching: false,
      };
      modelListCache.set(cacheKey, cacheEntry);
    }
  }

  // Register update callback
  if (onUpdate) {
    if (!subscribers.has(cacheKey)) {
      subscribers.set(cacheKey, new Set());
    }
    subscribers.get(cacheKey)?.add(onUpdate);
  }

  // If we have cached data, return it and refresh in background
  if (cacheEntry && cacheEntry.models && cacheEntry.models.length > 0) {
    // Check if we should refresh (cache is stale or no active fetch)
    const isStale = Date.now() - cacheEntry.timestamp > CACHE_TTL_MS;

    if (isStale && !cacheEntry.isFetching) {
      // Mark as fetching to prevent duplicate requests
      cacheEntry.isFetching = true;

      // Fetch in background
      fetchModelsFromAPI(outputModality)
        .then((freshModels) => {
          if (freshModels && freshModels.length > 0) {
            const updatedEntry: CacheEntry = {
              models: freshModels,
              timestamp: Date.now(),
              isFetching: false,
            };
            modelListCache.set(cacheKey, updatedEntry);
            saveToStorage(cacheKey, { models: freshModels, timestamp: updatedEntry.timestamp });

            // Notify subscribers of the update
            notifySubscribers(cacheKey, freshModels);
          } else {
            const entry = modelListCache.get(cacheKey);
            if (entry) entry.isFetching = false;
          }
        })
        .catch((err) => {
          console.error('[OpenRouterModelCache] Background refresh failed:', err);
          const entry = modelListCache.get(cacheKey);
          if (entry) entry.isFetching = false;
        });
    }

    return { models: cacheEntry.models, fromCache: true };
  }

  // No cache, need to fetch
  if (cacheEntry?.isFetching) {
    // Another fetch is in progress, wait for it
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const entry = modelListCache.get(cacheKey);
        if (entry && !entry.isFetching) {
          clearInterval(checkInterval);
          resolve({ models: entry.models || [], fromCache: false });
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({ models: [], fromCache: false });
      }, 30000);
    });
  }

  // Create entry and mark as fetching
  const newEntry: CacheEntry = {
    models: [],
    timestamp: 0,
    isFetching: true,
  };
  modelListCache.set(cacheKey, newEntry);

  try {
    const models = await fetchModelsFromAPI(outputModality);
    const updatedEntry: CacheEntry = {
      models,
      timestamp: Date.now(),
      isFetching: false,
    };
    modelListCache.set(cacheKey, updatedEntry);
    saveToStorage(cacheKey, { models, timestamp: updatedEntry.timestamp });

    // Notify subscribers
    notifySubscribers(cacheKey, models);

    return { models, fromCache: false };
  } catch (err) {
    console.error('[OpenRouterModelCache] Failed to fetch models:', err);
    newEntry.isFetching = false;
    throw err;
  }
}

/**
 * Get text generation models from OpenRouter
 */
export async function getTextModels(
  onUpdate: OnUpdateCallback | null = null
): Promise<GetModelsResult> {
  return getOpenRouterModels('text', onUpdate);
}

/**
 * Get image generation models from OpenRouter
 */
export async function getImageModels(
  onUpdate: OnUpdateCallback | null = null
): Promise<GetModelsResult> {
  return getOpenRouterModels('image', onUpdate);
}

/**
 * Force refresh models from API (ignores cache)
 */
export async function refreshModels(outputModality?: OutputModality): Promise<OpenRouterModel[]> {
  const cacheKey = getCacheKey(outputModality);

  try {
    const models = await fetchModelsFromAPI(outputModality);
    const entry: CacheEntry = {
      models,
      timestamp: Date.now(),
      isFetching: false,
    };
    modelListCache.set(cacheKey, entry);
    saveToStorage(cacheKey, { models, timestamp: entry.timestamp });

    // Notify subscribers
    notifySubscribers(cacheKey, models);

    return models;
  } catch (err) {
    console.error('[OpenRouterModelCache] Failed to refresh models:', err);
    throw err;
  }
}

/**
 * Unsubscribe from cache updates
 */
export function unsubscribe(
  outputModality: OutputModality | undefined,
  callback: OnUpdateCallback
): void {
  const cacheKey = getCacheKey(outputModality);
  const subs = subscribers.get(cacheKey);
  if (subs) {
    subs.delete(callback);
    if (subs.size === 0) {
      subscribers.delete(cacheKey);
    }
  }
}

/**
 * Clear all cached model lists
 */
export function clearOpenRouterCache(): void {
  modelListCache.clear();

  // Clear from localStorage
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn('[OpenRouterModelCache] Failed to clear storage:', err);
  }

  console.log('[OpenRouterModelCache] Cache cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): CacheStatus {
  const status: CacheStatus = {};
  modelListCache.forEach((value, key) => {
    status[key] = {
      modelCount: value.models?.length || 0,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
      isFetching: value.isFetching,
    };
  });
  return status;
}

/**
 * Convert OpenRouter model to a format compatible with ModelCatalogEntry
 */
export function toModelCatalogEntry(model: OpenRouterModel): {
  id: string;
  label: string;
  provider: string;
  tags: string[];
  featured: boolean;
  description?: string;
  contextLength?: number;
  pricing?: { prompt: string; completion: string };
} {
  // Extract provider from model ID (e.g., "openai/gpt-4" -> "OpenAI")
  const [providerSlug] = model.id.split('/');
  const providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    'meta-llama': 'Meta',
    mistralai: 'Mistral',
    deepseek: 'DeepSeek',
    qwen: 'Qwen',
    cohere: 'Cohere',
    perplexity: 'Perplexity',
    'black-forest-labs': 'Black Forest Labs',
    'stability-ai': 'Stability AI',
  };

  const provider = providerLabels[providerSlug] || providerSlug;

  // Build tags from modalities and other properties
  const tags: string[] = [];
  if (model.architecture?.output_modalities?.includes('image')) {
    tags.push('image');
  }
  if (model.architecture?.output_modalities?.includes('text')) {
    tags.push('text');
  }
  if (model.architecture?.input_modalities?.includes('image')) {
    tags.push('multimodal');
  }
  if (model.context_length >= 100000) {
    tags.push('long-context');
  }

  return {
    id: model.id,
    label: model.name,
    provider,
    tags,
    featured: false,
    description: model.description,
    contextLength: model.context_length,
    pricing: model.pricing
      ? { prompt: model.pricing.prompt, completion: model.pricing.completion }
      : undefined,
  };
}
