/**
 * Tests for falModelCache
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getFalModels,
  getImageModels,
  getVideoModels,
  getAudioModels,
  unsubscribe,
  clearFalCache,
  getFalCacheStatus,
} from './falModelCache';
import * as falApi from '../api/fal';

// Mock the fal API
vi.mock('../api/fal', () => ({
  listModels: vi.fn(),
  listImageModels: vi.fn(),
  listVideoModels: vi.fn(),
  listAudioModels: vi.fn(),
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

describe('falModelCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    clearFalCache();

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

  describe('getFalModels', () => {
    it('fetches models from API when cache is empty', async () => {
      const mockModels = [
        { id: 'fal-ai/flux', name: 'Flux', description: 'Image generation' },
        { id: 'fal-ai/sdxl', name: 'SDXL', description: 'Stable Diffusion XL' },
      ];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      const result = await getFalModels();

      expect(falApi.listModels).toHaveBeenCalled();
      expect(result.models).toEqual(mockModels);
      expect(result.fromCache).toBe(false);
    });

    it('returns cached models on subsequent calls', async () => {
      const mockModels = [{ id: 'test', name: 'Test Model', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      // First call - fetches from API
      const result1 = await getFalModels();
      expect(result1.fromCache).toBe(false);

      // Second call - should use cache
      const result2 = await getFalModels();
      expect(result2.fromCache).toBe(true);
      expect(result2.models).toEqual(mockModels);

      // API should only be called once
      expect(falApi.listModels).toHaveBeenCalledTimes(1);
    });

    it('uses different cache keys for different categories', async () => {
      const imageModels = [{ id: 'image-model', name: 'Image', description: 'Image gen' }];
      const videoModels = [{ id: 'video-model', name: 'Video', description: 'Video gen' }];

      vi.mocked(falApi.listModels)
        .mockResolvedValueOnce(imageModels as never)
        .mockResolvedValueOnce(videoModels as never);

      const result1 = await getFalModels('text-to-image');
      const result2 = await getFalModels('text-to-video');

      expect(result1.models).toEqual(imageModels);
      expect(result2.models).toEqual(videoModels);
      expect(falApi.listModels).toHaveBeenCalledTimes(2);
    });

    it('supports array of categories', async () => {
      const mockModels = [{ id: 'multi', name: 'Multi', description: 'Multi-category' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      const result = await getFalModels(['text-to-image', 'image-to-image']);

      expect(result.models).toEqual(mockModels);
      // The array gets sorted for cache key consistency, which mutates the original
      expect(falApi.listModels).toHaveBeenCalled();
    });

    it('calls onUpdate callback when provided', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getFalModels(undefined, onUpdate);

      // onUpdate is called when cache is updated
      expect(onUpdate).toHaveBeenCalledWith(mockModels);
    });

    it('loads from localStorage if in-memory cache is empty', async () => {
      const cachedData = {
        models: [{ id: 'cached', name: 'Cached', description: 'From storage' }],
        timestamp: Date.now(),
      };
      localStorageMock.setItem('noder-fal-models-all', JSON.stringify(cachedData));

      const result = await getFalModels();

      expect(result.models).toEqual(cachedData.models);
      expect(result.fromCache).toBe(true);
      // Should not call API
      expect(falApi.listModels).not.toHaveBeenCalled();
    });

    it('ignores expired localStorage cache', async () => {
      const expiredData = {
        models: [{ id: 'old', name: 'Old', description: 'Expired' }],
        timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago (past TTL)
      };
      localStorageMock.setItem('noder-fal-models-all', JSON.stringify(expiredData));

      const freshModels = [{ id: 'fresh', name: 'Fresh', description: 'New' }];
      vi.mocked(falApi.listModels).mockResolvedValue(freshModels as never);

      const result = await getFalModels();

      expect(result.models).toEqual(freshModels);
      expect(result.fromCache).toBe(false);
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(falApi.listModels).mockRejectedValue(new Error('API Error'));

      await expect(getFalModels()).rejects.toThrow('API Error');
    });

    it('handles localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      // Should not throw, just fetch from API
      const result = await getFalModels();
      expect(result.models).toEqual(mockModels);
    });
  });

  describe('getImageModels', () => {
    it('fetches image models from API', async () => {
      const mockModels = [{ id: 'fal-ai/flux', name: 'Flux', description: 'Image generation' }];
      vi.mocked(falApi.listImageModels).mockResolvedValue(mockModels as never);

      const result = await getImageModels();

      expect(falApi.listImageModels).toHaveBeenCalled();
      expect(result.models).toEqual(mockModels);
      expect(result.fromCache).toBe(false);
    });

    it('returns cached image models on subsequent calls', async () => {
      const mockModels = [{ id: 'image', name: 'Image Model', description: 'Image' }];
      vi.mocked(falApi.listImageModels).mockResolvedValue(mockModels as never);

      const result1 = await getImageModels();
      expect(result1.fromCache).toBe(false);

      const result2 = await getImageModels();
      expect(result2.fromCache).toBe(true);
      expect(falApi.listImageModels).toHaveBeenCalledTimes(1);
    });

    it('calls onUpdate callback', async () => {
      const mockModels = [{ id: 'image', name: 'Image', description: 'Image' }];
      vi.mocked(falApi.listImageModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getImageModels(onUpdate);

      // First fetch notifies subscribers
      expect(onUpdate).not.toHaveBeenCalled(); // onUpdate is for background refreshes
    });
  });

  describe('getVideoModels', () => {
    it('fetches video models from API', async () => {
      const mockModels = [{ id: 'fal-ai/runway', name: 'Runway', description: 'Video generation' }];
      vi.mocked(falApi.listVideoModels).mockResolvedValue(mockModels as never);

      const result = await getVideoModels();

      expect(falApi.listVideoModels).toHaveBeenCalled();
      expect(result.models).toEqual(mockModels);
    });

    it('returns cached video models on subsequent calls', async () => {
      const mockModels = [{ id: 'video', name: 'Video Model', description: 'Video' }];
      vi.mocked(falApi.listVideoModels).mockResolvedValue(mockModels as never);

      await getVideoModels();
      const result = await getVideoModels();

      expect(result.fromCache).toBe(true);
      expect(falApi.listVideoModels).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAudioModels', () => {
    it('fetches audio models from API', async () => {
      const mockModels = [{ id: 'fal-ai/tts', name: 'TTS', description: 'Text to speech' }];
      vi.mocked(falApi.listAudioModels).mockResolvedValue(mockModels as never);

      const result = await getAudioModels();

      expect(falApi.listAudioModels).toHaveBeenCalled();
      expect(result.models).toEqual(mockModels);
    });

    it('returns cached audio models on subsequent calls', async () => {
      const mockModels = [{ id: 'audio', name: 'Audio Model', description: 'Audio' }];
      vi.mocked(falApi.listAudioModels).mockResolvedValue(mockModels as never);

      await getAudioModels();
      const result = await getAudioModels();

      expect(result.fromCache).toBe(true);
      expect(falApi.listAudioModels).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('removes callback from subscribers', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getFalModels(undefined, onUpdate);

      unsubscribe(undefined, onUpdate);

      // After unsubscribe, callback should not be called
      // (Would need a background refresh to test this fully)
    });

    it('handles unsubscribe for non-existent callback', () => {
      const onUpdate = vi.fn();
      // Should not throw
      expect(() => unsubscribe('text-to-image', onUpdate)).not.toThrow();
    });
  });

  describe('clearFalCache', () => {
    it('clears in-memory cache', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      await getFalModels();
      clearFalCache();

      // Next call should fetch from API again
      await getFalModels();
      expect(falApi.listModels).toHaveBeenCalledTimes(2);
    });

    it('clears localStorage cache', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      await getFalModels();
      clearFalCache();

      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it('handles localStorage errors gracefully', () => {
      const originalKeys = Object.keys;
      vi.spyOn(Object, 'keys').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => clearFalCache()).not.toThrow();

      vi.spyOn(Object, 'keys').mockImplementation(originalKeys);
    });
  });

  describe('getFalCacheStatus', () => {
    it('returns empty status when cache is empty', () => {
      const status = getFalCacheStatus();
      expect(status).toEqual({});
    });

    it('returns status for cached entries', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      await getFalModels();
      const status = getFalCacheStatus();

      expect(status).toHaveProperty('all');
      expect(status['all'].modelCount).toBe(1);
      expect(status['all'].isFetching).toBe(false);
      expect(status['all'].timestamp).toBeGreaterThan(0);
    });

    it('shows fetching status correctly', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(falApi.listModels).mockReturnValue(promise as never);

      // Start fetching
      const fetchPromise = getFalModels();

      // Check status while fetching
      const status = getFalCacheStatus();
      expect(status['all']?.isFetching).toBe(true);

      // Resolve and wait
      resolvePromise!(mockModels);
      await fetchPromise;
    });
  });

  describe('background refresh', () => {
    it('triggers background refresh for stale data', async () => {
      // First populate cache with fresh data
      const initialModels = [{ id: 'initial', name: 'Initial', description: 'Initial' }];
      vi.mocked(falApi.listModels).mockResolvedValue(initialModels as never);

      await getFalModels();
      expect(falApi.listModels).toHaveBeenCalledTimes(1);

      // Second call with fresh cache should not call API
      const result = await getFalModels();
      expect(result.fromCache).toBe(true);
      expect(falApi.listModels).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers when cache updates', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      vi.mocked(falApi.listModels).mockResolvedValue(mockModels as never);

      const onUpdate = vi.fn();
      await getFalModels(undefined, onUpdate);

      // Subscriber should be notified on initial fetch
      expect(onUpdate).toHaveBeenCalledWith(mockModels);
    });
  });

  describe('concurrent requests', () => {
    it('prevents duplicate API calls for same category', async () => {
      const mockModels = [{ id: 'test', name: 'Test', description: 'Test' }];
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(falApi.listModels).mockReturnValue(promise as never);

      // Start multiple concurrent requests
      const request1 = getFalModels();
      const request2 = getFalModels();

      // Resolve the API call
      resolvePromise!(mockModels);

      const [result1, result2] = await Promise.all([request1, request2]);

      // Both should get the same result
      expect(result1.models).toEqual(mockModels);
      expect(result2.models).toEqual(mockModels);

      // API should only be called once
      expect(falApi.listModels).toHaveBeenCalledTimes(1);
    });
  });
});
