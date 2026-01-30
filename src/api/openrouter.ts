/**
 * OpenRouter API Client
 *
 * Centralized module for all OpenRouter API operations.
 * Provides consistent error handling, logging, and retry logic.
 */

import { logApiError } from '../utils/errorLogger';

// =============================================================================
// Constants
// =============================================================================

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_URL = `${OPENROUTER_BASE_URL}/chat/completions`;
const OPENROUTER_MODELS_URL = `${OPENROUTER_BASE_URL}/models`;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 60000;

// =============================================================================
// Types
// =============================================================================

/** Chat message role */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** Chat message structure */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

/** Tool function definition */
export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/** Tool definition */
export interface Tool {
  type: 'function';
  function: ToolFunction;
}

/** Tool call from response */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** Chat completion choice */
export interface ChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

/** Usage statistics */
export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Chat completion response */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: UsageStats;
}

/** Chat completion request options */
export interface ChatCompletionOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  signal?: AbortSignal;
  timeout?: number;
}

/** Error with additional metadata */
interface OpenRouterError extends Error {
  statusCode?: number;
  data?: Record<string, unknown>;
}

// =============================================================================
// Model Types
// =============================================================================

/** Model architecture details */
export interface ModelArchitecture {
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  tokenizer?: string;
}

/** Model pricing per token */
export interface ModelPricing {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  web_search?: string;
}

/** OpenRouter model definition */
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  created?: number;
  context_length: number;
  architecture: ModelArchitecture;
  pricing: ModelPricing;
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/** Models list response */
export interface ModelsListResponse {
  data: OpenRouterModel[];
}

/** Output modality filter */
export type OutputModality = 'text' | 'image' | 'audio';

/** Options for listing models */
export interface ListModelsOptions {
  /** Filter by output modality */
  outputModality?: OutputModality;
  /** Optional abort signal */
  signal?: AbortSignal;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Delay helper for retries
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build request headers for OpenRouter API
 */
function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined' && window.location?.origin) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'noder';
  }

  return headers;
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(
  timeoutMs: number,
  existingSignal?: AbortSignal
): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If there's an existing signal, listen for its abort
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  return { controller, timeoutId };
}

/**
 * Parse error response from OpenRouter
 */
function parseErrorResponse(
  data: { error?: { message?: string; details?: string } },
  response: Response
): string {
  const message = data?.error?.message || response.statusText || 'Bad Request';
  const details = data?.error?.details;
  const suffix = details ? ` (${details})` : '';
  return `OpenRouter error: ${message}${suffix}`;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, statusCode?: number): boolean {
  // Don't retry client errors (4xx) except 429 (rate limit)
  if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
    return false;
  }
  // Don't retry aborted requests
  if (error.name === 'AbortError') {
    return false;
  }
  return true;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Send a chat completion request to OpenRouter
 *
 * @param options - Request options
 * @returns Chat completion response
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const {
    apiKey,
    model,
    messages,
    tools = [],
    toolChoice = 'auto',
    signal,
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;

  if (!apiKey) {
    throw new Error('Missing OpenRouter API key');
  }

  if (!model) {
    throw new Error('Missing model identifier');
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required');
  }

  const body: Record<string, unknown> = {
    model,
    messages,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  let lastError: OpenRouterError | undefined;
  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { controller, timeoutId } = createTimeoutController(timeout, signal);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatusCode = response.status;

      const responseText = await response.text();
      let data: Record<string, unknown> = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { raw: responseText };
      }

      if (!response.ok) {
        const errorMessage = parseErrorResponse(
          data as { error?: { message?: string; details?: string } },
          response
        );
        const error: OpenRouterError = new Error(errorMessage);
        error.statusCode = response.status;
        error.data = data;
        throw error;
      }

      return data as unknown as ChatCompletionResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? (error as OpenRouterError) : new Error(String(error));

      // Check if we should retry
      if (!isRetryableError(lastError, lastStatusCode) || attempt >= MAX_RETRIES) {
        break;
      }

      console.warn(
        `[OpenRouter API] Request failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
      );
      await delay(RETRY_DELAY_MS * attempt);
    }
  }

  // Log the final error
  if (lastError) {
    logApiError(lastError, 'openrouter_chat_completion', {
      model,
      messageCount: messages.length,
      hasTools: tools.length > 0,
      statusCode: lastStatusCode,
    });
    throw lastError;
  }

  throw new Error('Request failed after all retries');
}

/**
 * Stream a chat completion from OpenRouter (if supported)
 * Note: Currently returns non-streaming response
 *
 * @param options - Same as chatCompletion
 * @returns Chat completion response
 */
export async function chatCompletionStream(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  // OpenRouter supports streaming, but for simplicity we use non-streaming
  // This can be enhanced to support Server-Sent Events in the future
  return chatCompletion(options);
}

/**
 * List available models from OpenRouter
 *
 * @param options - Optional filters and settings
 * @returns Array of available models
 */
export async function listModels(options: ListModelsOptions = {}): Promise<OpenRouterModel[]> {
  const { outputModality, signal } = options;

  const { controller, timeoutId } = createTimeoutController(DEFAULT_TIMEOUT_MS, signal);

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch models: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as ModelsListResponse;
    let models = data.data || [];

    // Filter by output modality if specified
    if (outputModality) {
      models = models.filter(
        (model) =>
          model.architecture?.output_modalities?.includes(outputModality) ||
          model.architecture?.modality?.includes(outputModality)
      );
    }

    return models;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out while fetching models');
    }

    throw error;
  }
}

/**
 * List text generation models from OpenRouter
 */
export async function listTextModels(signal?: AbortSignal): Promise<OpenRouterModel[]> {
  return listModels({ outputModality: 'text', signal });
}

/**
 * List image generation models from OpenRouter
 */
export async function listImageModels(signal?: AbortSignal): Promise<OpenRouterModel[]> {
  return listModels({ outputModality: 'image', signal });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract assistant message content from response
 *
 * @param response - Chat completion response
 * @returns Message content or null
 */
export function extractMessageContent(response: ChatCompletionResponse): string | null {
  return response?.choices?.[0]?.message?.content || null;
}

/**
 * Extract tool calls from response
 *
 * @param response - Chat completion response
 * @returns Array of tool calls or empty array
 */
export function extractToolCalls(response: ChatCompletionResponse): ToolCall[] {
  return response?.choices?.[0]?.message?.tool_calls || [];
}

/**
 * Check if response contains tool calls
 *
 * @param response - Chat completion response
 * @returns True if response has tool calls
 */
export function hasToolCalls(response: ChatCompletionResponse): boolean {
  return extractToolCalls(response).length > 0;
}

/**
 * Get finish reason from response
 *
 * @param response - Chat completion response
 * @returns Finish reason ('stop', 'tool_calls', 'length', etc.)
 */
export function getFinishReason(
  response: ChatCompletionResponse
): 'stop' | 'tool_calls' | 'length' | 'content_filter' | null {
  return response?.choices?.[0]?.finish_reason || null;
}

/**
 * Get usage statistics from response
 *
 * @param response - Chat completion response
 * @returns Usage object with prompt_tokens, completion_tokens, total_tokens
 */
export function getUsage(response: ChatCompletionResponse): UsageStats | null {
  return response?.usage || null;
}
