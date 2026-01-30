/**
 * Replicate Model List Cache
 *
 * Caches model lists from Replicate API to enable instant dropdown display.
 * Updates are fetched in the background and merged with cached data.
 */

import { invoke } from '../types/tauri';
import type { ReplicateModel, ReplicateModelsResponse } from '../types/tauri';

// =============================================================================
// Types
// =============================================================================

/** Cache entry structure */
interface CacheEntry {
  models: ReplicateModel[];
  timestamp: number;
  isFetching: boolean;
}

/** Storage cache structure */
interface StoredCache {
  models: ReplicateModel[];
  timestamp: number;
}

/** Result from getModels function */
export interface GetModelsResult {
  models: ReplicateModel[];
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
export type OnUpdateCallback = (models: ReplicateModel[]) => void;

/** Collection slug type */
export type CollectionSlug = string | string[] | null | undefined;

// =============================================================================
// Constants
// =============================================================================

/** LocalStorage key prefix for persistence */
const CACHE_STORAGE_PREFIX = 'noder-model-cache-';

/** Cache TTL: 5 minutes (models don't change that often) */
const CACHE_TTL_MS = 5 * 60 * 1000;

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
 * Generate a cache key for a collection slug or combination
 */
function getCacheKey(collectionSlug: CollectionSlug): string {
  if (!collectionSlug) return 'all';
  if (Array.isArray(collectionSlug)) {
    return `collections:${collectionSlug.sort().join(',')}`;
  }
  return `collection:${collectionSlug}`;
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
    console.warn('[ModelListCache] Failed to load from storage:', err);
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
    console.warn('[ModelListCache] Failed to save to storage:', err);
  }
}

/**
 * Notify subscribers of cache updates
 */
function notifySubscribers(cacheKey: string, models: ReplicateModel[]): void {
  const subs = subscribers.get(cacheKey);
  if (subs) {
    subs.forEach((callback) => callback(models));
  }
}

/**
 * Fetch models from Replicate API
 */
async function fetchModelsFromAPI(collectionSlug: CollectionSlug): Promise<ReplicateModel[]> {
  if (Array.isArray(collectionSlug) && collectionSlug.length > 1) {
    // Fetch from multiple collections and combine
    const allModels: ReplicateModel[] = [];
    const seenModels = new Set<string>();

    for (const slug of collectionSlug) {
      try {
        const response: ReplicateModelsResponse = await invoke('replicate_list_models', {
          collectionSlug: slug,
        });

        if (response && response.results) {
          response.results.forEach((model) => {
            const modelId = `${model.owner}/${model.name}`;
            if (!seenModels.has(modelId)) {
              seenModels.add(modelId);
              allModels.push(model);
            }
          });
        }
      } catch (err) {
        console.error(`[ModelListCache] Error fetching from collection ${slug}:`, err);
      }
    }

    return allModels;
  } else {
    // Single collection or no filter
    const slug = Array.isArray(collectionSlug) ? collectionSlug[0] : collectionSlug;
    const response = await invoke('replicate_list_models', {
      collectionSlug: slug || undefined,
    });

    return response?.results || [];
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get cached models or fetch if not available
 * Returns immediately with cached data if available, then refreshes in background
 *
 * @param collectionSlug - Collection to fetch
 * @param onUpdate - Callback when models are updated
 * @returns Promise with models and cache status
 */
export async function getModels(
  collectionSlug: CollectionSlug,
  onUpdate: OnUpdateCallback | null = null
): Promise<GetModelsResult> {
  const cacheKey = getCacheKey(collectionSlug);

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
      fetchModelsFromAPI(collectionSlug)
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
          console.error('[ModelListCache] Background refresh failed:', err);
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
    const models = await fetchModelsFromAPI(collectionSlug);
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
    console.error('[ModelListCache] Failed to fetch models:', err);
    newEntry.isFetching = false;
    throw err;
  }
}

/**
 * Force refresh models from API (ignores cache)
 */
export async function refreshModels(collectionSlug: CollectionSlug): Promise<ReplicateModel[]> {
  const cacheKey = getCacheKey(collectionSlug);

  try {
    const models = await fetchModelsFromAPI(collectionSlug);
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
    console.error('[ModelListCache] Failed to refresh models:', err);
    throw err;
  }
}

/**
 * Unsubscribe from cache updates
 */
export function unsubscribe(collectionSlug: CollectionSlug, callback: OnUpdateCallback): void {
  const cacheKey = getCacheKey(collectionSlug);
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
export function clearModelListCache(): void {
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
    console.warn('[ModelListCache] Failed to clear storage:', err);
  }

  console.log('[ModelListCache] Cache cleared');
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
