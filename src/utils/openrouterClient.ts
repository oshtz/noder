/**
 * OpenRouter Client (Legacy)
 *
 * Simple OpenRouter API client.
 * Note: For new code, prefer using src/api/openrouter.ts which has better types and retry logic.
 */

// =============================================================================
// Types
// =============================================================================

/** Chat message role */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** Chat message */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

/** Tool definition */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/** API request options */
export interface CallOpenRouterOptions {
  apiKey: string;
  model: string;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | string;
  signal?: AbortSignal;
}

/** Streaming request options */
export interface StreamOpenRouterOptions extends CallOpenRouterOptions {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: StreamToolCall) => void;
  onComplete?: (message: StreamMessage) => void;
  onError?: (error: Error) => void;
}

/** Streaming tool call */
export interface StreamToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

/** Streaming message result */
export interface StreamMessage {
  role: string;
  content: string;
  tool_calls?: StreamToolCall[];
}

/** API response */
export interface OpenRouterResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: unknown[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message?: string;
    details?: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// =============================================================================
// Functions
// =============================================================================

/**
 * Build request headers
 */
const buildHeaders = (apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined' && window.location?.origin) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'noder';
  }

  return headers;
};

/**
 * Call OpenRouter API
 * @param options - Request options
 * @returns API response
 */
export const callOpenRouter = async ({
  apiKey,
  model,
  messages,
  tools = [],
  toolChoice = 'auto',
  signal,
}: CallOpenRouterOptions): Promise<OpenRouterResponse> => {
  if (!apiKey) {
    throw new Error('Missing OpenRouter API key.');
  }

  const body: Record<string, unknown> = {
    model,
    messages,
  };

  if (tools.length) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });

  const responseText = await response.text();
  let data: OpenRouterResponse = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = data?.error?.message || response.statusText || 'Bad Request';
    const details = data?.error?.details || responseText;
    const suffix = details ? ` (${details})` : '';
    throw new Error(`OpenRouter error: ${message}${suffix}`);
  }

  return data;
};

/**
 * Stream OpenRouter API response
 * @param options - Request options with streaming callbacks
 * @returns Promise that resolves when stream completes
 */
export const streamOpenRouter = async ({
  apiKey,
  model,
  messages,
  tools = [],
  toolChoice = 'auto',
  signal,
  onToken,
  onToolCall,
  onComplete,
  onError,
}: StreamOpenRouterOptions): Promise<StreamMessage> => {
  if (!apiKey) {
    throw new Error('Missing OpenRouter API key.');
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };

  if (tools.length) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText || 'Bad Request';
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData?.error?.message || errorMessage;
    } catch {
      // Use status text
    }
    const error = new Error(`OpenRouter error: ${errorMessage}`);
    onError?.(error);
    throw error;
  }

  if (!response.body) {
    const error = new Error('No response body for streaming');
    onError?.(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCalls: Map<number, StreamToolCall> = new Map();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;

          if (delta?.content) {
            content += delta.content;
            onToken?.(delta.content);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0;
              let existing = toolCalls.get(index);

              if (!existing) {
                existing = {
                  id: tc.id || `toolcall-${Date.now()}-${index}`,
                  type: tc.type || 'function',
                  function: {
                    name: tc.function?.name || '',
                    arguments: '',
                  },
                };
                toolCalls.set(index, existing);
              }

              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name = tc.function.name;
              if (tc.function?.arguments) {
                existing.function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw err;
    }
    onError?.(err as Error);
    throw err;
  }

  // Notify tool calls
  const toolCallsArray = Array.from(toolCalls.values());
  for (const tc of toolCallsArray) {
    onToolCall?.(tc);
  }

  const message: StreamMessage = {
    role: 'assistant',
    content,
    tool_calls: toolCallsArray.length > 0 ? toolCallsArray : undefined,
  };

  onComplete?.(message);
  return message;
};
