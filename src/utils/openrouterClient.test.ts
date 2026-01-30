/**
 * Tests for openrouterClient (legacy)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  callOpenRouter,
  streamOpenRouter,
  type Message,
  type Tool,
  type OpenRouterResponse,
} from './openrouterClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('openrouterClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('callOpenRouter', () => {
    const defaultOptions = {
      apiKey: 'test-api-key',
      model: 'openai/gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    it('should make a successful API call', async () => {
      const mockResponse: OpenRouterResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'openai/gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await callOpenRouter(defaultOptions);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            model: 'openai/gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        })
      );
    });

    it('should throw when API key is missing', async () => {
      await expect(
        callOpenRouter({
          ...defaultOptions,
          apiKey: '',
        })
      ).rejects.toThrow('Missing OpenRouter API key');
    });

    it('should include tools in request when provided', async () => {
      const tools: Tool[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ choices: [] })),
      });

      await callOpenRouter({
        ...defaultOptions,
        tools,
        toolChoice: 'auto',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'openai/gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            tools,
            tool_choice: 'auto',
          }),
        })
      );
    });

    it('should not include tools when array is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ choices: [] })),
      });

      await callOpenRouter({
        ...defaultOptions,
        tools: [],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toBeUndefined();
      expect(callBody.tool_choice).toBeUndefined();
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: {
                message: 'Invalid API key',
                details: 'Authentication failed',
              },
            })
          ),
      });

      await expect(callOpenRouter(defaultOptions)).rejects.toThrow(
        'OpenRouter error: Invalid API key (Authentication failed)'
      );
    });

    it('should handle error response without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('{}'),
      });

      await expect(callOpenRouter(defaultOptions)).rejects.toThrow(
        'OpenRouter error: Internal Server Error'
      );
    });

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('not valid json'),
      });

      const result = await callOpenRouter(defaultOptions);

      expect(result).toEqual({});
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const result = await callOpenRouter(defaultOptions);

      expect(result).toEqual({});
    });

    it('should pass abort signal to fetch', async () => {
      const controller = new AbortController();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ choices: [] })),
      });

      await callOpenRouter({
        ...defaultOptions,
        signal: controller.signal,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should include referer headers in browser environment', async () => {
      // Simulate browser environment
      const originalWindow = global.window;
      global.window = {
        location: { origin: 'https://myapp.com' },
      } as unknown as typeof window;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ choices: [] })),
      });

      await callOpenRouter(defaultOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://myapp.com',
            'X-Title': 'noder',
          }),
        })
      );

      global.window = originalWindow;
    });

    it('should handle multiple messages', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '4' },
        { role: 'user', content: 'And 3+3?' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ choices: [] })),
      });

      await callOpenRouter({
        ...defaultOptions,
        messages,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages).toEqual(messages);
    });

    it('should handle tool messages', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'tool',
          content: '{"temperature": 72}',
          tool_call_id: 'call_123',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ choices: [] })),
      });

      await callOpenRouter({
        ...defaultOptions,
        messages,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages).toEqual(messages);
    });

    it('should handle response with tool calls', async () => {
      const mockResponse: OpenRouterResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"NYC"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await callOpenRouter(defaultOptions);

      expect(result.choices?.[0]?.message.tool_calls).toHaveLength(1);
    });
  });

  describe('streamOpenRouter', () => {
    const defaultOptions = {
      apiKey: 'test-api-key',
      model: 'openai/gpt-4',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    // Helper to create a mock ReadableStream
    const createMockStream = (chunks: string[]) => {
      let index = 0;
      return {
        getReader: () => ({
          read: async () => {
            if (index < chunks.length) {
              const value = new TextEncoder().encode(chunks[index]);
              index++;
              return { done: false, value };
            }
            return { done: true, value: undefined };
          },
        }),
      };
    };

    it('should stream tokens successfully', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const onToken = vi.fn();
      const onComplete = vi.fn();

      const result = await streamOpenRouter({
        ...defaultOptions,
        onToken,
        onComplete,
      });

      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onToken).toHaveBeenNthCalledWith(2, ' world');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('Hello world');
      expect(result.role).toBe('assistant');
    });

    it('should throw when API key is missing', async () => {
      await expect(
        streamOpenRouter({
          ...defaultOptions,
          apiKey: '',
        })
      ).rejects.toThrow('Missing OpenRouter API key');
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: {
                message: 'Invalid API key',
              },
            })
          ),
      });

      const onError = vi.fn();

      await expect(
        streamOpenRouter({
          ...defaultOptions,
          onError,
        })
      ).rejects.toThrow('OpenRouter error: Invalid API key');

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should handle error response without parseable JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('Gateway timeout'),
      });

      await expect(streamOpenRouter(defaultOptions)).rejects.toThrow(
        'OpenRouter error: Service Unavailable'
      );
    });

    it('should throw when response body is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const onError = vi.fn();

      await expect(
        streamOpenRouter({
          ...defaultOptions,
          onError,
        })
      ).rejects.toThrow('No response body for streaming');

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should handle tool calls in streaming', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"get_weather"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"loc"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ation\\":\\"NYC\\"}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const onToolCall = vi.fn();

      const result = await streamOpenRouter({
        ...defaultOptions,
        onToolCall,
      });

      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(onToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"NYC"}',
          },
        })
      );
      expect(result.tool_calls).toHaveLength(1);
    });

    it('should handle multiple tool calls', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"tool_a","arguments":"{}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_2","type":"function","function":{"name":"tool_b","arguments":"{}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const result = await streamOpenRouter(defaultOptions);

      expect(result.tool_calls).toHaveLength(2);
      expect(result.tool_calls?.[0]?.function.name).toBe('tool_a');
      expect(result.tool_calls?.[1]?.function.name).toBe('tool_b');
    });

    it('should include tools in request when provided', async () => {
      const tools: Tool[] = [
        {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(['data: [DONE]\n\n']),
      });

      await streamOpenRouter({
        ...defaultOptions,
        tools,
        toolChoice: 'auto',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toEqual(tools);
      expect(callBody.tool_choice).toBe('auto');
      expect(callBody.stream).toBe(true);
    });

    it('should not include tools when array is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(['data: [DONE]\n\n']),
      });

      await streamOpenRouter({
        ...defaultOptions,
        tools: [],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.tools).toBeUndefined();
      expect(callBody.stream).toBe(true);
    });

    it('should skip malformed JSON lines', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Start"}}]}\n\n',
        'data: not valid json\n\n',
        'data: {"choices":[{"delta":{"content":" End"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const result = await streamOpenRouter(defaultOptions);

      expect(result.content).toBe('Start End');
    });

    it('should handle empty lines', async () => {
      const chunks = [
        '\n',
        '   \n',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        '\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const result = await streamOpenRouter(defaultOptions);

      expect(result.content).toBe('Hello');
    });

    it('should pass abort signal to fetch', async () => {
      const controller = new AbortController();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(['data: [DONE]\n\n']),
      });

      await streamOpenRouter({
        ...defaultOptions,
        signal: controller.signal,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should rethrow AbortError without calling onError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(abortError),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const onError = vi.fn();

      await expect(
        streamOpenRouter({
          ...defaultOptions,
          onError,
        })
      ).rejects.toThrow('Aborted');

      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onError for non-abort errors during streaming', async () => {
      const networkError = new Error('Network failure');

      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(networkError),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const onError = vi.fn();

      await expect(
        streamOpenRouter({
          ...defaultOptions,
          onError,
        })
      ).rejects.toThrow('Network failure');

      expect(onError).toHaveBeenCalledWith(networkError);
    });

    it('should return message without tool_calls when none present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream([
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      });

      const result = await streamOpenRouter(defaultOptions);

      expect(result.tool_calls).toBeUndefined();
    });

    it('should handle tool call without id by generating one', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"test","arguments":"{}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const result = await streamOpenRouter(defaultOptions);

      expect(result.tool_calls?.[0]?.id).toMatch(/^toolcall-\d+-0$/);
    });

    it('should update existing tool call id when provided later', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"test"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"real_id_123"}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks),
      });

      const result = await streamOpenRouter(defaultOptions);

      expect(result.tool_calls?.[0]?.id).toBe('real_id_123');
    });
  });
});
