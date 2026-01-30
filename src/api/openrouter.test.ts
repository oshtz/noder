/**
 * Tests for OpenRouter API client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractMessageContent,
  extractToolCalls,
  hasToolCalls,
  getFinishReason,
  getUsage,
  chatCompletion,
  chatCompletionStream,
  listModels,
  listTextModels,
  listImageModels,
} from './openrouter';
import type { ChatCompletionResponse, ToolCall, OpenRouterModel } from './openrouter';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock error logger
vi.mock('../utils/errorLogger', () => ({
  logApiError: vi.fn(),
}));

describe('openrouter API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('extractMessageContent', () => {
    it('extracts content from valid response', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello, how can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
      };

      expect(extractMessageContent(response)).toBe('Hello, how can I help you?');
    });

    it('returns null for null content', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                { id: 'call-1', type: 'function', function: { name: 'test', arguments: '{}' } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      expect(extractMessageContent(response)).toBeNull();
    });

    it('returns null for empty choices', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [],
      };

      expect(extractMessageContent(response)).toBeNull();
    });

    it('returns null for undefined response', () => {
      expect(extractMessageContent(undefined as unknown as ChatCompletionResponse)).toBeNull();
    });
  });

  describe('extractToolCalls', () => {
    it('extracts tool calls from response', () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'get_weather', arguments: '{"city": "NYC"}' },
        },
        { id: 'call-2', type: 'function', function: { name: 'get_time', arguments: '{}' } },
      ];

      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: toolCalls,
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      expect(extractToolCalls(response)).toEqual(toolCalls);
    });

    it('returns empty array when no tool calls', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Regular message',
            },
            finish_reason: 'stop',
          },
        ],
      };

      expect(extractToolCalls(response)).toEqual([]);
    });

    it('returns empty array for undefined response', () => {
      expect(extractToolCalls(undefined as unknown as ChatCompletionResponse)).toEqual([]);
    });
  });

  describe('hasToolCalls', () => {
    it('returns true when tool calls exist', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                { id: 'call-1', type: 'function', function: { name: 'test', arguments: '{}' } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      expect(hasToolCalls(response)).toBe(true);
    });

    it('returns false when no tool calls', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello',
            },
            finish_reason: 'stop',
          },
        ],
      };

      expect(hasToolCalls(response)).toBe(false);
    });
  });

  describe('getFinishReason', () => {
    it('returns stop finish reason', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Done' },
            finish_reason: 'stop',
          },
        ],
      };

      expect(getFinishReason(response)).toBe('stop');
    });

    it('returns tool_calls finish reason', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null },
            finish_reason: 'tool_calls',
          },
        ],
      };

      expect(getFinishReason(response)).toBe('tool_calls');
    });

    it('returns length finish reason', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Truncated...' },
            finish_reason: 'length',
          },
        ],
      };

      expect(getFinishReason(response)).toBe('length');
    });

    it('returns null for missing finish reason', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Message' },
            finish_reason: null,
          },
        ],
      };

      expect(getFinishReason(response)).toBeNull();
    });
  });

  describe('getUsage', () => {
    it('returns usage statistics', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      expect(getUsage(response)).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });

    it('returns null when no usage data', () => {
      const response: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello' },
            finish_reason: 'stop',
          },
        ],
      };

      expect(getUsage(response)).toBeNull();
    });
  });

  describe('chatCompletion', () => {
    it('throws error when API key is missing', async () => {
      await expect(
        chatCompletion({
          apiKey: '',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('Missing OpenRouter API key');
    });

    it('throws error when model is missing', async () => {
      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: '',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('Missing model identifier');
    });

    it('throws error when messages are empty', async () => {
      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: 'gpt-4',
          messages: [],
        })
      ).rejects.toThrow('Messages array is required');
    });

    it('throws error when messages is not an array', async () => {
      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: 'gpt-4',
          messages: null as unknown as [],
        })
      ).rejects.toThrow('Messages array is required');
    });

    it('makes successful API call', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await chatCompletion({
        apiKey: 'test-key',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('includes tools in request when provided', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Using tool' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await chatCompletion({
        apiKey: 'test-key',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather info',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
      });

      const [url, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(body.tools).toBeDefined();
      expect(body.tool_choice).toBe('auto');
    });

    it('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Invalid request' } })),
      });

      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('OpenRouter error: Invalid request');
    });

    it('retries on 5xx errors', async () => {
      // First call fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Server error' } })),
      });

      // Second call succeeds
      const mockResponse: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Success!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await chatCompletion({
        apiKey: 'test-key',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Invalid API key' } })),
      });

      await expect(
        chatCompletion({
          apiKey: 'bad-key',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('OpenRouter error: Invalid API key');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 rate limit errors', async () => {
      vi.useFakeTimers();

      // First call fails with 429 (rate limit)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Rate limit exceeded' } })),
      });

      // Second call succeeds
      const mockResponse: ChatCompletionResponse = {
        id: 'resp-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Success after rate limit!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const resultPromise = chatCompletion({
        apiKey: 'test-key',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('handles non-JSON error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Not a JSON response'),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Still not JSON'),
      });

      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('OpenRouter error: Internal Server Error');
    });

    it('handles abort signal', async () => {
      const abortController = new AbortController();

      mockFetch.mockImplementationOnce(() => {
        abortController.abort();
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          signal: abortController.signal,
        })
      ).rejects.toThrow();
    });

    it('includes error details in message when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: {
                message: 'Invalid request',
                details: 'Missing required field: prompt',
              },
            })
          ),
      });

      await expect(
        chatCompletion({
          apiKey: 'test-key',
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('OpenRouter error: Invalid request (Missing required field: prompt)');
    });

    it('handles empty response text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      });

      const result = await chatCompletion({
        apiKey: 'test-key',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      // Should not throw, returns empty object
      expect(result).toEqual({});
    });
  });

  describe('listModels', () => {
    it('fetches models successfully', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          context_length: 8192,
          architecture: {
            modality: 'text',
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
          pricing: { prompt: '0.00003', completion: '0.00006' },
        },
        {
          id: 'dalle-3',
          name: 'DALL-E 3',
          context_length: 4096,
          architecture: {
            modality: 'image',
            input_modalities: ['text'],
            output_modalities: ['image'],
          },
          pricing: { prompt: '0.00004', completion: '0.00004' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listModels();

      expect(result).toEqual(mockModels);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('filters models by text output modality', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          context_length: 8192,
          architecture: {
            modality: 'text',
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
          pricing: { prompt: '0.00003', completion: '0.00006' },
        },
        {
          id: 'dalle-3',
          name: 'DALL-E 3',
          context_length: 4096,
          architecture: {
            modality: 'image',
            input_modalities: ['text'],
            output_modalities: ['image'],
          },
          pricing: { prompt: '0.00004', completion: '0.00004' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listModels({ outputModality: 'text' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4');
    });

    it('filters models by image output modality', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          context_length: 8192,
          architecture: {
            modality: 'text',
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
          pricing: { prompt: '0.00003', completion: '0.00006' },
        },
        {
          id: 'dalle-3',
          name: 'DALL-E 3',
          context_length: 4096,
          architecture: {
            modality: 'image',
            input_modalities: ['text'],
            output_modalities: ['image'],
          },
          pricing: { prompt: '0.00004', completion: '0.00004' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listModels({ outputModality: 'image' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dalle-3');
    });

    it('handles model fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await expect(listModels()).rejects.toThrow('Failed to fetch models: 500 Server error');
    });

    it('handles timeout on model fetch', async () => {
      vi.useFakeTimers();

      const error = new Error('Aborted');
      error.name = 'AbortError';

      mockFetch.mockRejectedValueOnce(error);

      const resultPromise = listModels();

      await expect(resultPromise).rejects.toThrow('Request timed out while fetching models');

      vi.useRealTimers();
    });

    it('handles empty data array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: null }),
      });

      const result = await listModels();

      expect(result).toEqual([]);
    });

    it('filters by modality field as fallback', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'old-model',
          name: 'Old Model',
          context_length: 4096,
          architecture: {
            modality: 'text-generation', // Old-style modality field
            input_modalities: [],
            output_modalities: [],
          },
          pricing: { prompt: '0.00003', completion: '0.00006' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listModels({ outputModality: 'text' });

      expect(result).toHaveLength(1);
    });
  });

  describe('listTextModels', () => {
    it('calls listModels with text output modality', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          context_length: 8192,
          architecture: {
            modality: 'text',
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
          pricing: { prompt: '0.00003', completion: '0.00006' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listTextModels();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gpt-4');
    });
  });

  describe('listImageModels', () => {
    it('calls listModels with image output modality', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'dalle-3',
          name: 'DALL-E 3',
          context_length: 4096,
          architecture: {
            modality: 'image',
            input_modalities: ['text'],
            output_modalities: ['image'],
          },
          pricing: { prompt: '0.00004', completion: '0.00004' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockModels }),
      });

      const result = await listImageModels();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dalle-3');
    });
  });

  describe('chatCompletionStream', () => {
    it('returns same result as chatCompletion (currently non-streaming)', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'resp-stream',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Streaming response!' },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await chatCompletionStream({
        apiKey: 'test-key',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual(mockResponse);
    });
  });
});
