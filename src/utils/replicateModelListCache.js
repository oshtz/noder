/**
 * Replicate Model List Cache
 * 
 * Caches model lists from Replicate API to enable instant dropdown display.
 * Updates are fetched in the background and merged with cached data.
 */

import { invoke } from '@tauri-apps/api/core';

// In-memory cache for model lists
// Key: cache key (e.g., "collection:text-to-image" or "all")
// Value: { models: [], timestamp: number, isFetching: boolean }
const modelListCache = new Map();

// LocalStorage key prefix for persistence
const CACHE_STORAGE_PREFIX = 'noder-model-cache-';

// Cache TTL: 5 minutes (models don't change that often)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Subscribers for cache updates
const subscribers = new Map();

/**
 * Generate a cache key for a collection slug or combination
 */
function getCacheKey(collectionSlug) {
  if (!collectionSlug) return 'all';
  if (Array.isArray(collectionSlug)) {
    return `collections:${collectionSlug.sort().join(',')}`;
  }
  return `collection:${collectionSlug}`;
}

/**
 * Load cached models from localStorage
 */
function loadFromStorage(cacheKey) {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_PREFIX + cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
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
function saveToStorage(cacheKey, data) {
  try {
    localStorage.setItem(CACHE_STORAGE_PREFIX + cacheKey, JSON.stringify(data));
  } catch (err) {
    console.warn('[ModelListCache] Failed to save to storage:', err);
  }
}

/**
 * Notify subscribers of cache updates
 */
function notifySubscribers(cacheKey, models) {
  const subs = subscribers.get(cacheKey);
  if (subs) {
    subs.forEach(callback => callback(models));
  }
}

/**
 * Fetch models from Replicate API
 */
async function fetchModelsFromAPI(collectionSlug) {
  const collections = Array.isArray(collectionSlug) ? collectionSlug : [collectionSlug];
  
  if (Array.isArray(collectionSlug) && collectionSlug.length > 1) {
    // Fetch from multiple collections and combine
    const allModels = [];
    const seenModels = new Set();
    
    for (const slug of collectionSlug) {
      try {
        const response = await invoke('replicate_list_models', {
          collectionSlug: slug
        });
        
        if (response && response.results) {
          response.results.forEach(model => {
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
      collectionSlug: slug || null
    });
    
    return response?.results || [];
  }
}

/**
 * Get cached models or fetch if not available
 * Returns immediately with cached data if available, then refreshes in background
 * 
 * @param {string|string[]|null} collectionSlug - Collection to fetch
 * @param {function} onUpdate - Callback when models are updated
 * @returns {Promise<{models: Array, fromCache: boolean}>}
 */
export async function getModels(collectionSlug, onUpdate = null) {
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
        isFetching: false
      };
      modelListCache.set(cacheKey, cacheEntry);
    }
  }
  
  // Register update callback
  if (onUpdate) {
    if (!subscribers.has(cacheKey)) {
      subscribers.set(cacheKey, new Set());
    }
    subscribers.get(cacheKey).add(onUpdate);
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
        .then(freshModels => {
          if (freshModels && freshModels.length > 0) {
            const updatedEntry = {
              models: freshModels,
              timestamp: Date.now(),
              isFetching: false
            };
            modelListCache.set(cacheKey, updatedEntry);
            saveToStorage(cacheKey, { models: freshModels, timestamp: updatedEntry.timestamp });
            
            // Notify subscribers of the update
            notifySubscribers(cacheKey, freshModels);
          } else {
            cacheEntry.isFetching = false;
          }
        })
        .catch(err => {
          console.error('[ModelListCache] Background refresh failed:', err);
          cacheEntry.isFetching = false;
        });
    }
    
    return { models: cacheEntry.models, fromCache: true };
  }
  
  // No cache, need to fetch
  if (cacheEntry?.isFetching) {
    // Another fetch is in progress, wait for it
    return new Promise(resolve => {
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
  const newEntry = {
    models: [],
    timestamp: 0,
    isFetching: true
  };
  modelListCache.set(cacheKey, newEntry);
  
  try {
    const models = await fetchModelsFromAPI(collectionSlug);
    const updatedEntry = {
      models,
      timestamp: Date.now(),
      isFetching: false
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
export async function refreshModels(collectionSlug) {
  const cacheKey = getCacheKey(collectionSlug);
  
  try {
    const models = await fetchModelsFromAPI(collectionSlug);
    const entry = {
      models,
      timestamp: Date.now(),
      isFetching: false
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
export function unsubscribe(collectionSlug, callback) {
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
export function clearModelListCache() {
  modelListCache.clear();
  
  // Clear from localStorage
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
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
export function getCacheStatus() {
  const status = {};
  modelListCache.forEach((value, key) => {
    status[key] = {
      modelCount: value.models?.length || 0,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
      isFetching: value.isFetching
    };
  });
  return status;
}
