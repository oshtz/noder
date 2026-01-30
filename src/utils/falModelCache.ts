/**
 * Fal.ai Model List Cache
 *
 * Caches model lists from fal.ai API to enable instant dropdown display.
 * Updates are fetched in the background and merged with cached data.
 */

import {
  listModels,
  listImageModels,
  listVideoModels,
  listAudioModels,
  type FalModel,
  type FalModelCategory,
} from '../api/fal';

// =============================================================================
// Types
// =============================================================================

/** Cache entry structure */
interface CacheEntry {
  models: FalModel[];
  timestamp: number;
  isFetching: boolean;
}

/** Storage cache structure */
interface StoredCache {
  models: FalModel[];
  timestamp: number;
}

/** Result from getModels function */
export interface GetFalModelsResult {
  models: FalModel[];
  fromCache: boolean;
}

/** Cache status for debugging */
export interface FalCacheStatus {
  [key: string]: {
    modelCount: number;
    timestamp: number;
    age: number;
    isFetching: boolean;
  };
}

/** Update callback function type */
export type OnFalUpdateCallback = (models: FalModel[]) => void;

// =============================================================================
// Constants
// =============================================================================

/** LocalStorage key prefix for persistence */
const CACHE_STORAGE_PREFIX = 'noder-fal-models-';

/** Cache TTL: 30 minutes */
const CACHE_TTL_MS = 30 * 60 * 1000;

// =============================================================================
// State
// =============================================================================

/** In-memory cache for model lists */
const modelListCache = new Map<string, CacheEntry>();

/** Subscribers for cache updates */
const subscribers = new Map<string, Set<OnFalUpdateCallback>>();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a cache key for a model category
 */
function getCacheKey(category?: FalModelCategory | FalModelCategory[]): string {
  if (!category) return 'all';
  if (Array.isArray(category)) return `category:${category.sort().join(',')}`;
  return `category:${category}`;
}

/**
 * Load cached models from localStorage
 */
function loadFromStorage(cacheKey: string): StoredCache | null {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_PREFIX + cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredCache;
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[FalModelCache] Failed to load from storage:', err);
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
    console.warn('[FalModelCache] Failed to save to storage:', err);
  }
}

/**
 * Notify subscribers of cache updates
 */
function notifySubscribers(cacheKey: string, models: FalModel[]): void {
  const subs = subscribers.get(cacheKey);
  if (subs) {
    subs.forEach((callback) => callback(models));
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get cached models or fetch if not available.
 */
export async function getFalModels(
  category?: FalModelCategory | FalModelCategory[],
  onUpdate: OnFalUpdateCallback | null = null
): Promise<GetFalModelsResult> {
  const cacheKey = getCacheKey(category);

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
    const isStale = Date.now() - cacheEntry.timestamp > CACHE_TTL_MS;

    if (isStale && !cacheEntry.isFetching) {
      cacheEntry.isFetching = true;

      listModels({
        category: Array.isArray(category) ? category : category ? [category] : undefined,
      })
        .then((freshModels) => {
          if (freshModels && freshModels.length > 0) {
            const updatedEntry: CacheEntry = {
              models: freshModels,
              timestamp: Date.now(),
              isFetching: false,
            };
            modelListCache.set(cacheKey, updatedEntry);
            saveToStorage(cacheKey, { models: freshModels, timestamp: updatedEntry.timestamp });
            notifySubscribers(cacheKey, freshModels);
          } else {
            const entry = modelListCache.get(cacheKey);
            if (entry) entry.isFetching = false;
          }
        })
        .catch((err) => {
          console.error('[FalModelCache] Background refresh failed:', err);
          const entry = modelListCache.get(cacheKey);
          if (entry) entry.isFetching = false;
        });
    }

    return { models: cacheEntry.models, fromCache: true };
  }

  // No cache, need to fetch
  if (cacheEntry?.isFetching) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const entry = modelListCache.get(cacheKey);
        if (entry && !entry.isFetching) {
          clearInterval(checkInterval);
          resolve({ models: entry.models || [], fromCache: false });
        }
      }, 100);

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
    const models = await listModels({
      category: Array.isArray(category) ? category : category ? [category] : undefined,
    });
    const updatedEntry: CacheEntry = {
      models,
      timestamp: Date.now(),
      isFetching: false,
    };
    modelListCache.set(cacheKey, updatedEntry);
    saveToStorage(cacheKey, { models, timestamp: updatedEntry.timestamp });
    notifySubscribers(cacheKey, models);

    return { models, fromCache: false };
  } catch (err) {
    console.error('[FalModelCache] Failed to fetch models:', err);
    newEntry.isFetching = false;
    throw err;
  }
}

/**
 * Get image generation models from fal.ai
 */
export async function getImageModels(
  onUpdate: OnFalUpdateCallback | null = null
): Promise<GetFalModelsResult> {
  const cacheKey = 'category:text-to-image,image-to-image';

  // Check cache first
  let cacheEntry = modelListCache.get(cacheKey);
  if (!cacheEntry) {
    const stored = loadFromStorage(cacheKey);
    if (stored) {
      cacheEntry = { models: stored.models, timestamp: stored.timestamp, isFetching: false };
      modelListCache.set(cacheKey, cacheEntry);
    }
  }

  if (onUpdate) {
    if (!subscribers.has(cacheKey)) {
      subscribers.set(cacheKey, new Set());
    }
    subscribers.get(cacheKey)?.add(onUpdate);
  }

  if (cacheEntry && cacheEntry.models.length > 0) {
    const isStale = Date.now() - cacheEntry.timestamp > CACHE_TTL_MS;
    if (isStale && !cacheEntry.isFetching) {
      cacheEntry.isFetching = true;
      listImageModels()
        .then((models) => {
          const entry: CacheEntry = { models, timestamp: Date.now(), isFetching: false };
          modelListCache.set(cacheKey, entry);
          saveToStorage(cacheKey, { models, timestamp: entry.timestamp });
          notifySubscribers(cacheKey, models);
        })
        .catch(() => {
          const entry = modelListCache.get(cacheKey);
          if (entry) entry.isFetching = false;
        });
    }
    return { models: cacheEntry.models, fromCache: true };
  }

  const models = await listImageModels();
  const entry: CacheEntry = { models, timestamp: Date.now(), isFetching: false };
  modelListCache.set(cacheKey, entry);
  saveToStorage(cacheKey, { models, timestamp: entry.timestamp });
  return { models, fromCache: false };
}

/**
 * Get video generation models from fal.ai
 */
export async function getVideoModels(
  onUpdate: OnFalUpdateCallback | null = null
): Promise<GetFalModelsResult> {
  const cacheKey = 'category:text-to-video,image-to-video';

  let cacheEntry = modelListCache.get(cacheKey);
  if (!cacheEntry) {
    const stored = loadFromStorage(cacheKey);
    if (stored) {
      cacheEntry = { models: stored.models, timestamp: stored.timestamp, isFetching: false };
      modelListCache.set(cacheKey, cacheEntry);
    }
  }

  if (onUpdate) {
    if (!subscribers.has(cacheKey)) {
      subscribers.set(cacheKey, new Set());
    }
    subscribers.get(cacheKey)?.add(onUpdate);
  }

  if (cacheEntry && cacheEntry.models.length > 0) {
    const isStale = Date.now() - cacheEntry.timestamp > CACHE_TTL_MS;
    if (isStale && !cacheEntry.isFetching) {
      cacheEntry.isFetching = true;
      listVideoModels()
        .then((models) => {
          const entry: CacheEntry = { models, timestamp: Date.now(), isFetching: false };
          modelListCache.set(cacheKey, entry);
          saveToStorage(cacheKey, { models, timestamp: entry.timestamp });
          notifySubscribers(cacheKey, models);
        })
        .catch(() => {
          const entry = modelListCache.get(cacheKey);
          if (entry) entry.isFetching = false;
        });
    }
    return { models: cacheEntry.models, fromCache: true };
  }

  const models = await listVideoModels();
  const entry: CacheEntry = { models, timestamp: Date.now(), isFetching: false };
  modelListCache.set(cacheKey, entry);
  saveToStorage(cacheKey, { models, timestamp: entry.timestamp });
  return { models, fromCache: false };
}

/**
 * Get audio generation models from fal.ai
 */
export async function getAudioModels(
  onUpdate: OnFalUpdateCallback | null = null
): Promise<GetFalModelsResult> {
  const cacheKey = 'category:text-to-audio,text-to-speech';

  let cacheEntry = modelListCache.get(cacheKey);
  if (!cacheEntry) {
    const stored = loadFromStorage(cacheKey);
    if (stored) {
      cacheEntry = { models: stored.models, timestamp: stored.timestamp, isFetching: false };
      modelListCache.set(cacheKey, cacheEntry);
    }
  }

  if (onUpdate) {
    if (!subscribers.has(cacheKey)) {
      subscribers.set(cacheKey, new Set());
    }
    subscribers.get(cacheKey)?.add(onUpdate);
  }

  if (cacheEntry && cacheEntry.models.length > 0) {
    const isStale = Date.now() - cacheEntry.timestamp > CACHE_TTL_MS;
    if (isStale && !cacheEntry.isFetching) {
      cacheEntry.isFetching = true;
      listAudioModels()
        .then((models) => {
          const entry: CacheEntry = { models, timestamp: Date.now(), isFetching: false };
          modelListCache.set(cacheKey, entry);
          saveToStorage(cacheKey, { models, timestamp: entry.timestamp });
          notifySubscribers(cacheKey, models);
        })
        .catch(() => {
          const entry = modelListCache.get(cacheKey);
          if (entry) entry.isFetching = false;
        });
    }
    return { models: cacheEntry.models, fromCache: true };
  }

  const models = await listAudioModels();
  const entry: CacheEntry = { models, timestamp: Date.now(), isFetching: false };
  modelListCache.set(cacheKey, entry);
  saveToStorage(cacheKey, { models, timestamp: entry.timestamp });
  return { models, fromCache: false };
}

/**
 * Unsubscribe from cache updates
 */
export function unsubscribe(
  category: FalModelCategory | FalModelCategory[] | undefined,
  callback: OnFalUpdateCallback
): void {
  const cacheKey = getCacheKey(category);
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
export function clearFalCache(): void {
  modelListCache.clear();

  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn('[FalModelCache] Failed to clear storage:', err);
  }

  console.log('[FalModelCache] Cache cleared');
}

/**
 * Get cache status for debugging
 */
export function getFalCacheStatus(): FalCacheStatus {
  const status: FalCacheStatus = {};
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
