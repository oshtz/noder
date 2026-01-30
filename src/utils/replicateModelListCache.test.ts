/**
 * Tests for replicateModelListCache
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getModels,
  refreshModels,
  unsubscribe,
  clearModelListCache,
  getCacheStatus,
} from './replicateModelListCache';
import { invoke } from '../types/tauri';

// Mock the invoke function
vi.mock('../types/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
    get store() {
      return store;
    },
    keys: () => Object.keys(store),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Backup the original keys method
const originalKeys = Object.keys;

describe('replicateModelListCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    clearModelListCache();

    // Silence console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock Object.keys to return localStorage keys
    vi.spyOn(Object, 'keys').mockImplementation((obj) => {
      if (obj === localStorage) {
        return localStorageMock.keys();
      }
      return originalKeys(obj);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getModels', () => {
    it('fetches models from API when cache is empty', async () => {
      const mockModels = [
        { owner: 'stability-ai', name: 'sdxl', description: 'SDXL' },
        { owner: 'black-forest-labs', name: 'flux-2-klein-4b', description: 'Flux' },
      ];
      vi.mocked(invoke).mockResolvedValue({ results: mockModels });

      const result = await getModels(null);

      expect(invoke).toHaveBeenCalledWith('replicate_list_models', { collectionSlug: undefined });
      expect(result.models).toEqual(mockModels);
      expect(result.fromCache).toBe(false);
    });

    it('returns cached models on subsequent calls', async () => {
      const mockModels = [{ owner: 'test', name: 'model', description: 'Test' }];
      vi.mocked(invoke).mockResolvedValue({ results: mockModels });

      // First call - fetches from API
      const result1 = await getModels('text-generation');
      expect(result1.fromCache).toBe(false);

      // Second call - should use cache
      const result2 = await getModels('text-generation');
      expect(result2.fromCache).toBe(true);
      expect(result2.models).toEqual(mockModels);
    });

    it('calls update callback when models are updated', async () => {
      const mockModels = [{ owner: 'test', name: 'model', description: 'Test' }];
      vi.mocked(invoke).mockResolvedValue({ results: mockModels });

      const callback = vi.fn();
      await getModels('text-generation', callback);

      // Callback should be called with models after fetch
      expect(callback).toHaveBeenCalledWith(mockModels);
    });

    it('handles collection slug array', async () => {
      const mockModels1 = [{ owner: 'test1', name: 'model1', description: 'Test 1' }];
      const mockModels2 = [{ owner: 'test2', name: 'model2', description: 'Test 2' }];

      vi.mocked(invoke)
        .mockResolvedValueOnce({ results: mockModels1 })
        .mockResolvedValueOnce({ results: mockModels2 });

      const result = await getModels(['text-generation', 'image-generation']);

      expect(invoke).toHaveBeenCalledTimes(2);
      expect(result.models.length).toBe(2);
    });

    it('deduplicates models from multiple collections', async () => {
      const sharedModel = { owner: 'shared', name: 'model', description: 'Shared' };
      const uniqueModel = { owner: 'unique', name: 'model', description: 'Unique' };

      vi.mocked(invoke)
        .mockResolvedValueOnce({ results: [sharedModel] })
        .mockResolvedValueOnce({ results: [sharedModel, uniqueModel] });

      const result = await getModels(['collection1', 'collection2']);

      // Should have 2 models (shared is deduplicated)
      expect(result.models.length).toBe(2);
    });

    it('handles API error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('API error'));

      await expect(getModels('text-generation')).rejects.toThrow('API error');
    });

    it('loads from localStorage if memory cache is empty', async () => {
      const cachedData = {
        models: [{ owner: 'cached', name: 'model', description: 'Cached' }],
        timestamp: Date.now() - 1000, // Recent cache
      };
      localStorageMock.setItem('noder-model-cache-collection:test', JSON.stringify(cachedData));

      const result = await getModels('test');

      expect(result.fromCache).toBe(true);
      expect(result.models).toEqual(cachedData.models);
    });

    it('ignores expired localStorage cache', async () => {
      const expiredCache = {
        models: [{ owner: 'old', name: 'model', description: 'Old' }],
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes old (expired)
      };
      localStorageMock.setItem('noder-model-cache-collection:test', JSON.stringify(expiredCache));

      const freshModels = [{ owner: 'fresh', name: 'model', description: 'Fresh' }];
      vi.mocked(invoke).mockResolvedValue({ results: freshModels });

      const result = await getModels('test');

      expect(result.fromCache).toBe(false);
      expect(result.models).toEqual(freshModels);
    });
  });

  describe('refreshModels', () => {
    it('forces fresh fetch ignoring cache', async () => {
      const cachedModels = [{ owner: 'cached', name: 'model', description: 'Cached' }];
      const freshModels = [{ owner: 'fresh', name: 'model', description: 'Fresh' }];

      // Pre-populate cache
      vi.mocked(invoke).mockResolvedValueOnce({ results: cachedModels });
      await getModels('text-generation');

      // Now refresh
      vi.mocked(invoke).mockResolvedValueOnce({ results: freshModels });
      const result = await refreshModels('text-generation');

      expect(result).toEqual(freshModels);
    });

    it('updates localStorage on refresh', async () => {
      const freshModels = [{ owner: 'fresh', name: 'model', description: 'Fresh' }];
      vi.mocked(invoke).mockResolvedValue({ results: freshModels });

      await refreshModels('text-generation');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'noder-model-cache-collection:text-generation',
        expect.any(String)
      );
    });

    it('notifies subscribers on refresh', async () => {
      const freshModels = [{ owner: 'fresh', name: 'model', description: 'Fresh' }];
      vi.mocked(invoke).mockResolvedValue({ results: freshModels });

      const callback = vi.fn();
      await getModels('test', callback);
      callback.mockClear();

      await refreshModels('test');

      expect(callback).toHaveBeenCalledWith(freshModels);
    });
  });

  describe('unsubscribe', () => {
    it('removes callback from subscribers', async () => {
      const mockModels = [{ owner: 'test', name: 'model', description: 'Test' }];
      vi.mocked(invoke).mockResolvedValue({ results: mockModels });

      const callback = vi.fn();
      await getModels('test', callback);
      callback.mockClear();

      unsubscribe('test', callback);

      // Refresh should not call the unsubscribed callback
      await refreshModels('test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('clearModelListCache', () => {
    it('clears in-memory cache', async () => {
      const mockModels = [{ owner: 'test', name: 'model', description: 'Test' }];
      vi.mocked(invoke).mockResolvedValue({ results: mockModels });

      await getModels('test');
      const statusBefore = getCacheStatus();
      expect(Object.keys(statusBefore).length).toBeGreaterThan(0);

      clearModelListCache();

      const statusAfter = getCacheStatus();
      expect(Object.keys(statusAfter).length).toBe(0);
    });

    it('clears localStorage cache', async () => {
      localStorageMock.setItem('noder-model-cache-test', 'data');

      clearModelListCache();

      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('getCacheStatus', () => {
    it('returns empty object when cache is empty', () => {
      const status = getCacheStatus();
      expect(status).toEqual({});
    });

    it('returns cache entry info', async () => {
      const mockModels = [{ owner: 'test', name: 'model', description: 'Test' }];
      vi.mocked(invoke).mockResolvedValue({ results: mockModels });

      await getModels('test');

      const status = getCacheStatus();
      const key = 'collection:test';

      expect(status[key]).toBeDefined();
      expect(status[key].modelCount).toBe(1);
      expect(status[key].isFetching).toBe(false);
      expect(typeof status[key].age).toBe('number');
    });
  });

  describe('cache key generation', () => {
    it('generates correct key for null slug', async () => {
      vi.mocked(invoke).mockResolvedValue({ results: [] });
      await getModels(null);

      const status = getCacheStatus();
      expect(status['all']).toBeDefined();
    });

    it('generates correct key for single slug', async () => {
      vi.mocked(invoke).mockResolvedValue({ results: [] });
      await getModels('text-generation');

      const status = getCacheStatus();
      expect(status['collection:text-generation']).toBeDefined();
    });

    it('generates correct key for array of slugs', async () => {
      vi.mocked(invoke).mockResolvedValue({ results: [] });
      await getModels(['text-gen', 'image-gen']);

      const status = getCacheStatus();
      expect(status['collections:image-gen,text-gen']).toBeDefined();
    });
  });
});
