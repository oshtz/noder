/**
 * Tests for fal.ts API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  listModels,
  listImageModels,
  listVideoModels,
  listAudioModels,
  listLLMModels,
  searchModels,
  type FalModel,
} from './fal';

// Mock the settings store
vi.mock('../stores/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      falApiKey: 'test-api-key',
    })),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fal API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listModels', () => {
    it('fetches models from fal API', async () => {
      const mockModels: FalModel[] = [
        { endpoint_id: 'fal-ai/flux', name: 'Flux', category: 'text-to-image' },
        { endpoint_id: 'fal-ai/sdxl', name: 'SDXL', category: 'text-to-image' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fal.ai/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Key test-api-key',
          },
        })
      );
      expect(result).toEqual(mockModels);
    });

    it('adds category parameter for single category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await listModels({ category: 'text-to-image' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fal.ai/v1/models?category=text-to-image',
        expect.any(Object)
      );
    });

    it('adds multiple category parameters for array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await listModels({ category: ['text-to-image', 'image-to-image'] });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('category=text-to-image');
      expect(callUrl).toContain('category=image-to-image');
    });

    it('adds search query parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await listModels({ search: 'flux' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fal.ai/v1/models?query=flux',
        expect.any(Object)
      );
    });

    it('combines category and search parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await listModels({ category: 'text-to-image', search: 'flux' });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('category=text-to-image');
      expect(callUrl).toContain('query=flux');
    });

    it('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(listModels()).rejects.toThrow('Fal API error: 401 - Unauthorized');
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(listModels()).rejects.toThrow('Network error');
    });

    it('handles timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(listModels()).rejects.toThrow('Request timed out');
    });

    it('returns empty array when data is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await listModels();

      expect(result).toEqual([]);
    });

    it('handles abort signal', async () => {
      const controller = new AbortController();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(listModels({ signal: controller.signal })).rejects.toThrow('Request timed out');
    });
  });

  describe('listImageModels', () => {
    it('fetches image generation models', async () => {
      const mockModels = [{ endpoint_id: 'flux', category: 'text-to-image' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listImageModels();

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('category=text-to-image');
      expect(callUrl).toContain('category=image-to-image');
      expect(result).toEqual(mockModels);
    });

    it('passes abort signal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const controller = new AbortController();
      await listImageModels(controller.signal);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('listVideoModels', () => {
    it('fetches video generation models', async () => {
      const mockModels = [{ endpoint_id: 'minimax', category: 'text-to-video' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listVideoModels();

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('category=text-to-video');
      expect(callUrl).toContain('category=image-to-video');
      expect(result).toEqual(mockModels);
    });
  });

  describe('listAudioModels', () => {
    it('fetches audio generation models', async () => {
      const mockModels = [{ endpoint_id: 'tts', category: 'text-to-audio' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listAudioModels();

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('category=text-to-audio');
      expect(callUrl).toContain('category=text-to-speech');
      expect(result).toEqual(mockModels);
    });
  });

  describe('listLLMModels', () => {
    it('fetches LLM models', async () => {
      const mockModels = [{ endpoint_id: 'llm', category: 'llm' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listLLMModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fal.ai/v1/models?category=llm',
        expect.any(Object)
      );
      expect(result).toEqual(mockModels);
    });
  });

  describe('searchModels', () => {
    it('searches models by query', async () => {
      const mockModels = [{ endpoint_id: 'flux', name: 'Flux' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await searchModels('flux');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fal.ai/v1/models?query=flux',
        expect.any(Object)
      );
      expect(result).toEqual(mockModels);
    });

    it('passes abort signal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const controller = new AbortController();
      await searchModels('test', controller.signal);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('API key handling', () => {
    it('includes authorization header when API key is present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await listModels();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Key test-api-key',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('handles 404 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(listModels()).rejects.toThrow('Fal API error: 404 - Not found');
    });

    it('handles 500 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      await expect(listModels()).rejects.toThrow('Fal API error: 500 - Internal server error');
    });

    it('handles rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      await expect(listModels()).rejects.toThrow('Fal API error: 429 - Rate limit exceeded');
    });
  });
});
