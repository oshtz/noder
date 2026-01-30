/**
 * Tests for openrouterModelCache
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getOpenRouterModels,
  getTextModels,
  getImageModels,
  refreshModels,
  unsubscribe,
  clearOpenRouterCache,
  getCacheStatus,
  toModelCatalogEntry,
} from './openrouterModelCache';
import * as openrouterApi from '../api/openrouter';

// Mock the openrouter API
vi.mock('../api/openrouter', () => ({
  listModels: vi.fn(),
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

describe('openrouterModelCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    clearOpenRouterCache();

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

  describe('getOpenRouterModels', () => {
    it('fetches models from API when cache is empty', async () => {
      const mockModels = [
        { id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 },
        { id: 'anthropic/claude-3', name: 'Claude 3', context_length: 200000 },
      ];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const result = await getOpenRouterModels();

      expect(openrouterApi.listModels).toHaveBeenCalledWith({ outputModality: undefined });
      expect(result.models).toEqual(mockModels);
      expect(result.fromCache).toBe(false);
    });

    it('returns cached models on subsequent calls', async () => {
      const mockModels = [{ id: 'test/model', name: 'Test Model', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      // First call - fetches from API
      const result1 = await getOpenRouterModels();
      expect(result1.fromCache).toBe(false);

      // Second call - should use cache
      const result2 = await getOpenRouterModels();
      expect(result2.fromCache).toBe(true);
      expect(result2.models).toEqual(mockModels);

      // API should only be called once
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(1);
    });

    it('uses different cache keys for different modalities', async () => {
      const textModels = [{ id: 'text/model', name: 'Text', context_length: 4096 }];
      const imageModels = [{ id: 'image/model', name: 'Image', context_length: 4096 }];

      vi.mocked(openrouterApi.listModels)
        .mockResolvedValueOnce(textModels as never)
        .mockResolvedValueOnce(imageModels as never);

      const result1 = await getOpenRouterModels('text');
      const result2 = await getOpenRouterModels('image');

      expect(result1.models).toEqual(textModels);
      expect(result2.models).toEqual(imageModels);
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(2);
    });

    it('calls onUpdate callback when provided', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getOpenRouterModels(undefined, onUpdate);

      // onUpdate is called when cache is updated
      expect(onUpdate).toHaveBeenCalledWith(mockModels);
    });

    it('loads from localStorage if in-memory cache is empty', async () => {
      const cachedData = {
        models: [{ id: 'cached/model', name: 'Cached', context_length: 4096 }],
        timestamp: Date.now(),
      };
      localStorageMock.setItem('noder-openrouter-models-all', JSON.stringify(cachedData));

      const result = await getOpenRouterModels();

      expect(result.models).toEqual(cachedData.models);
      expect(result.fromCache).toBe(true);
      // Should not call API
      expect(openrouterApi.listModels).not.toHaveBeenCalled();
    });

    it('ignores expired localStorage cache', async () => {
      const expiredData = {
        models: [{ id: 'old/model', name: 'Old', context_length: 4096 }],
        timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago (past TTL)
      };
      localStorageMock.setItem('noder-openrouter-models-all', JSON.stringify(expiredData));

      const freshModels = [{ id: 'fresh/model', name: 'Fresh', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(freshModels as never);

      const result = await getOpenRouterModels();

      expect(result.models).toEqual(freshModels);
      expect(result.fromCache).toBe(false);
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(openrouterApi.listModels).mockRejectedValue(new Error('API Error'));

      await expect(getOpenRouterModels()).rejects.toThrow('API Error');
    });

    it('handles localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      // Should not throw, just fetch from API
      const result = await getOpenRouterModels();
      expect(result.models).toEqual(mockModels);
    });
  });

  describe('getTextModels', () => {
    it('fetches text models from API', async () => {
      const mockModels = [{ id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const result = await getTextModels();

      expect(openrouterApi.listModels).toHaveBeenCalledWith({ outputModality: 'text' });
      expect(result.models).toEqual(mockModels);
    });

    it('returns cached text models on subsequent calls', async () => {
      const mockModels = [{ id: 'text/model', name: 'Text Model', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const result1 = await getTextModels();
      expect(result1.fromCache).toBe(false);

      const result2 = await getTextModels();
      expect(result2.fromCache).toBe(true);
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(1);
    });
  });

  describe('getImageModels', () => {
    it('fetches image models from API', async () => {
      const mockModels = [{ id: 'stability/sdxl', name: 'SDXL', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const result = await getImageModels();

      expect(openrouterApi.listModels).toHaveBeenCalledWith({ outputModality: 'image' });
      expect(result.models).toEqual(mockModels);
    });

    it('returns cached image models on subsequent calls', async () => {
      const mockModels = [{ id: 'image/model', name: 'Image Model', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      await getImageModels();
      const result = await getImageModels();

      expect(result.fromCache).toBe(true);
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshModels', () => {
    it('forces refresh from API ignoring cache', async () => {
      const cachedModels = [{ id: 'cached', name: 'Cached', context_length: 4096 }];
      const freshModels = [{ id: 'fresh', name: 'Fresh', context_length: 4096 }];

      vi.mocked(openrouterApi.listModels)
        .mockResolvedValueOnce(cachedModels as never)
        .mockResolvedValueOnce(freshModels as never);

      // First call caches
      await getOpenRouterModels();

      // Force refresh
      const result = await refreshModels();

      expect(result).toEqual(freshModels);
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(2);
    });

    it('updates cache after refresh', async () => {
      const freshModels = [{ id: 'fresh', name: 'Fresh', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(freshModels as never);

      await refreshModels();

      // Subsequent get should use refreshed cache
      const result = await getOpenRouterModels();
      expect(result.models).toEqual(freshModels);
      expect(result.fromCache).toBe(true);
    });

    it('notifies subscribers after refresh', async () => {
      const initialModels = [{ id: 'initial', name: 'Initial', context_length: 4096 }];
      const freshModels = [{ id: 'fresh', name: 'Fresh', context_length: 4096 }];

      vi.mocked(openrouterApi.listModels)
        .mockResolvedValueOnce(initialModels as never)
        .mockResolvedValueOnce(freshModels as never);

      const onUpdate = vi.fn();
      await getOpenRouterModels(undefined, onUpdate);

      await refreshModels();

      expect(onUpdate).toHaveBeenCalledWith(freshModels);
    });

    it('handles refresh errors', async () => {
      vi.mocked(openrouterApi.listModels).mockRejectedValue(new Error('Refresh Error'));

      await expect(refreshModels()).rejects.toThrow('Refresh Error');
    });
  });

  describe('unsubscribe', () => {
    it('removes callback from subscribers', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getOpenRouterModels(undefined, onUpdate);

      unsubscribe(undefined, onUpdate);

      // After unsubscribe, callback should not be called on refresh
    });

    it('handles unsubscribe for non-existent callback', () => {
      const onUpdate = vi.fn();
      // Should not throw
      expect(() => unsubscribe('text', onUpdate)).not.toThrow();
    });
  });

  describe('clearOpenRouterCache', () => {
    it('clears in-memory cache', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      await getOpenRouterModels();
      clearOpenRouterCache();

      // Next call should fetch from API again
      await getOpenRouterModels();
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(2);
    });

    it('clears localStorage cache', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      await getOpenRouterModels();
      clearOpenRouterCache();

      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it('handles localStorage errors gracefully', () => {
      vi.spyOn(Object, 'keys').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => clearOpenRouterCache()).not.toThrow();
    });
  });

  describe('getCacheStatus', () => {
    it('returns empty status when cache is empty', () => {
      const status = getCacheStatus();
      expect(status).toEqual({});
    });

    it('returns status for cached entries', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      await getOpenRouterModels();
      const status = getCacheStatus();

      expect(status).toHaveProperty('all');
      expect(status['all'].modelCount).toBe(1);
      expect(status['all'].isFetching).toBe(false);
      expect(status['all'].timestamp).toBeGreaterThan(0);
    });

    it('shows fetching status correctly', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(openrouterApi.listModels).mockReturnValue(promise as never);

      // Start fetching
      const fetchPromise = getOpenRouterModels();

      // Check status while fetching
      const status = getCacheStatus();
      expect(status['all']?.isFetching).toBe(true);

      // Resolve and wait
      resolvePromise!(mockModels);
      await fetchPromise;
    });
  });

  describe('toModelCatalogEntry', () => {
    it('converts OpenRouter model to catalog entry', () => {
      const model = {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        description: 'OpenAI GPT-4 model',
        context_length: 8192,
        pricing: {
          prompt: '0.03',
          completion: '0.06',
        },
        architecture: {
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
      };

      const entry = toModelCatalogEntry(model as never);

      expect(entry.id).toBe('openai/gpt-4');
      expect(entry.label).toBe('GPT-4');
      expect(entry.provider).toBe('OpenAI');
      expect(entry.description).toBe('OpenAI GPT-4 model');
      expect(entry.contextLength).toBe(8192);
      expect(entry.pricing).toEqual({ prompt: '0.03', completion: '0.06' });
    });

    it('extracts provider from model ID', () => {
      const testCases = [
        { id: 'openai/gpt-4', expected: 'OpenAI' },
        { id: 'anthropic/claude-3', expected: 'Anthropic' },
        { id: 'google/gemini', expected: 'Google' },
        { id: 'meta-llama/llama-3', expected: 'Meta' },
        { id: 'mistralai/mistral', expected: 'Mistral' },
        { id: 'deepseek/coder', expected: 'DeepSeek' },
        { id: 'unknown/model', expected: 'unknown' },
      ];

      for (const { id, expected } of testCases) {
        const entry = toModelCatalogEntry({ id, name: 'Test' } as never);
        expect(entry.provider).toBe(expected);
      }
    });

    it('adds tags based on modalities', () => {
      const imageModel = {
        id: 'test/image',
        name: 'Image Model',
        architecture: {
          output_modalities: ['image'],
        },
      };

      const entry = toModelCatalogEntry(imageModel as never);
      expect(entry.tags).toContain('image');
    });

    it('adds multimodal tag for image input', () => {
      const multimodalModel = {
        id: 'test/multimodal',
        name: 'Multimodal Model',
        architecture: {
          input_modalities: ['text', 'image'],
          output_modalities: ['text'],
        },
      };

      const entry = toModelCatalogEntry(multimodalModel as never);
      expect(entry.tags).toContain('multimodal');
      expect(entry.tags).toContain('text');
    });

    it('adds long-context tag for large context windows', () => {
      const longContextModel = {
        id: 'test/long',
        name: 'Long Context Model',
        context_length: 128000,
      };

      const entry = toModelCatalogEntry(longContextModel as never);
      expect(entry.tags).toContain('long-context');
    });

    it('handles missing optional fields', () => {
      const minimalModel = {
        id: 'test/minimal',
        name: 'Minimal Model',
      };

      const entry = toModelCatalogEntry(minimalModel as never);
      expect(entry.id).toBe('test/minimal');
      expect(entry.label).toBe('Minimal Model');
      expect(entry.tags).toEqual([]);
      expect(entry.featured).toBe(false);
    });
  });

  describe('background refresh', () => {
    it('triggers background refresh for stale data', async () => {
      // First populate cache with fresh data
      const initialModels = [{ id: 'initial', name: 'Initial', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(initialModels as never);

      await getOpenRouterModels();
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(1);

      // Second call with fresh cache should not call API
      const result = await getOpenRouterModels();
      expect(result.fromCache).toBe(true);
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers when cache updates', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      vi.mocked(openrouterApi.listModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getOpenRouterModels(undefined, onUpdate);

      // Subscriber should be notified on initial fetch
      expect(onUpdate).toHaveBeenCalledWith(mockModels);
    });
  });

  describe('concurrent requests', () => {
    it('prevents duplicate API calls for same modality', async () => {
      const mockModels = [{ id: 'test', name: 'Test', context_length: 4096 }];
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(openrouterApi.listModels).mockReturnValue(promise as never);

      // Start multiple concurrent requests
      const request1 = getOpenRouterModels();
      const request2 = getOpenRouterModels();

      // Resolve the API call
      resolvePromise!(mockModels);

      const [result1, result2] = await Promise.all([request1, request2]);

      // Both should get the same result
      expect(result1.models).toEqual(mockModels);
      expect(result2.models).toEqual(mockModels);

      // API should only be called once
      expect(openrouterApi.listModels).toHaveBeenCalledTimes(1);
    });
  });
});
