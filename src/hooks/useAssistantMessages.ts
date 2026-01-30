/**
 * Hook for managing assistant message state and operations.
 * Handles message list, sending, tool execution, and streaming.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { streamOpenRouter, StreamToolCall } from '../utils/openrouterClient';
import { getOpenRouterTools } from '../utils/assistantTools';

// =============================================================================
// Types
// =============================================================================

interface ToolCallFunction {
  name: string;
  arguments: string;
}

interface ToolCall {
  id: string;
  type: string;
  function: ToolCallFunction;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolResult {
  error?: string;
  [key: string]: unknown;
}

interface UseAssistantMessagesOptions {
  openRouterApiKey: string;
  systemPrompt: string;
  executeToolCall: (call: ToolCall) => Promise<ToolResult>;
  model: string;
  rememberModel: (modelId: string) => void;
  maxToolRounds?: number;
}

interface UseAssistantMessagesReturn {
  /** List of messages */
  messages: Message[];
  /** Visible messages (excluding tool messages) */
  visibleMessages: Message[];
  /** Whether currently loading */
  isLoading: boolean;
  /** Current streaming content */
  streamingContent: string;
  /** Active tool calls being executed */
  activeToolCalls: string[];
  /** Current error message */
  error: string;
  /** Set error message */
  setError: (error: string) => void;
  /** Draft message content */
  draft: string;
  /** Set draft content */
  setDraft: (draft: string) => void;
  /** Handle sending a message */
  handleSend: () => Promise<void>;
  /** Handle resetting the conversation */
  handleReset: () => void;
  /** Ref for messages */
  messagesRef: React.MutableRefObject<Message[]>;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_TOOL_ROUNDS = 8;

// =============================================================================
// Helper Functions
// =============================================================================

const normalizeMessagesForTools = (messages: Message[]): Message[] => {
  const toolCallIds = new Set<string>();
  const toolMessagesById = new Map<string, Message>();
  const toolCallNamesById = new Map<string, string>();

  messages.forEach((message) => {
    if (message.role === 'assistant' && message.tool_calls?.length) {
      message.tool_calls.forEach((call) => {
        if (call?.id) {
          toolCallIds.add(call.id);
          if (call.function?.name) {
            toolCallNamesById.set(call.id, call.function.name);
          }
        }
      });
    }
    if (message.role === 'tool' && message.tool_call_id) {
      toolMessagesById.set(message.tool_call_id, message);
    }
  });

  const normalized: Message[] = [];
  const consumed = new Set<string>();

  messages.forEach((message) => {
    if (message.role === 'tool' && message.tool_call_id && toolCallIds.has(message.tool_call_id)) {
      return;
    }

    normalized.push(message);

    if (message.role === 'assistant' && message.tool_calls?.length) {
      message.tool_calls.forEach((call) => {
        if (call?.id && !consumed.has(call.id)) {
          const toolMessage = toolMessagesById.get(call.id);
          if (toolMessage) {
            normalized.push(toolMessage);
            consumed.add(call.id);
            return;
          }

          normalized.push({
            role: 'tool',
            tool_call_id: call.id,
            name: toolCallNamesById.get(call.id),
            content: JSON.stringify({
              error: 'Missing tool output. Auto-inserted placeholder.',
            }),
          });
          consumed.add(call.id);
        }
      });
    }
  });

  return normalized;
};

const findMissingToolOutputs = (messages: Message[]): string[] => {
  const missing = new Set<string>();
  let pendingIds: string[] = [];

  messages.forEach((message) => {
    if (pendingIds.length > 0) {
      if (message.role === 'tool') {
        const idx = message.tool_call_id ? pendingIds.indexOf(message.tool_call_id) : -1;
        if (idx >= 0) {
          pendingIds.splice(idx, 1);
        }
        return;
      }

      if (message.role === 'assistant' || message.role === 'user') {
        pendingIds.forEach((id) => missing.add(id));
        pendingIds = [];
      }
    }

    if (pendingIds.length === 0 && message.role === 'assistant' && message.tool_calls?.length) {
      pendingIds = message.tool_calls.map((call) => call.id).filter(Boolean);
    }
  });

  pendingIds.forEach((id) => missing.add(id));
  return Array.from(missing);
};

const buildRequestMessages = (systemPrompt: string | undefined, messages: Message[]): Message[] => {
  const trimmed = systemPrompt?.trim();
  const system: Message[] = trimmed ? [{ role: 'system', content: trimmed }] : [];
  return [...system, ...messages];
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAssistantMessages({
  openRouterApiKey,
  systemPrompt,
  executeToolCall,
  model,
  rememberModel,
  maxToolRounds = MAX_TOOL_ROUNDS,
}: UseAssistantMessagesOptions): UseAssistantMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<string[]>([]);
  const [error, setError] = useState('');

  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const tools = useMemo(() => getOpenRouterTools(), []);

  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (message.role === 'tool') return false;
        if (message.role === 'assistant' && !message.content?.trim()) return false;
        return true;
      }),
    [messages]
  );

  const appendMessage = useCallback((message: Message): void => {
    const next = [...messagesRef.current, message];
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const executeToolCalls = useCallback(
    async (toolCalls: ToolCall[]): Promise<boolean> => {
      let hadError = false;

      for (const call of toolCalls) {
        let toolResult: ToolResult | null = null;
        let toolError: string | null = null;

        try {
          toolResult = await executeToolCall(call);
        } catch (err) {
          toolError = (err as Error).message || 'Tool execution failed.';
          toolResult = { error: toolError };
        }

        if (!toolError && toolResult?.error) {
          toolError = toolResult.error;
        }

        if (toolError) {
          hadError = true;
        }

        appendMessage({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResult ?? { error: toolError }),
          name: call.function?.name,
        });
      }

      return hadError;
    },
    [executeToolCall, appendMessage]
  );

  const sendToOpenRouter = useCallback(
    async (nextMessages: Message[], toolDepth: number = 0): Promise<void> => {
      const modelId = model.trim();
      if (!modelId) {
        throw new Error('Add a model id before sending.');
      }

      const normalizedMessages = normalizeMessagesForTools(nextMessages);
      const missingToolOutputs = findMissingToolOutputs(normalizedMessages);

      if (missingToolOutputs.length) {
        setError(`Recovered missing tool outputs for ${missingToolOutputs.join(', ')}.`);
      }

      if (
        normalizedMessages.length !== nextMessages.length ||
        normalizedMessages.some((message, index) => message !== nextMessages[index])
      ) {
        messagesRef.current = normalizedMessages;
        setMessages(normalizedMessages);
      }

      // Add round awareness context for multi-step operations
      let messagesWithContext = normalizedMessages;
      if (toolDepth > 0) {
        const roundsRemaining = maxToolRounds - toolDepth;
        const roundContext = `[Tool round ${toolDepth + 1}/${maxToolRounds}. ${roundsRemaining} rounds remaining. Continue with the task.]`;
        messagesWithContext = [
          ...normalizedMessages,
          { role: 'system' as const, content: roundContext },
        ];
      }

      const requestMessages = buildRequestMessages(systemPrompt, messagesWithContext);

      // Reset streaming state
      setStreamingContent('');
      setActiveToolCalls([]);

      // Use streaming API
      const streamedMessage = await streamOpenRouter({
        apiKey: openRouterApiKey,
        model: modelId,
        messages: requestMessages,
        tools,
        onToken: (token: string) => {
          setStreamingContent((prev) => prev + token);
        },
        onToolCall: (tc: StreamToolCall) => {
          setActiveToolCalls((prev) => {
            if (prev.includes(tc.function.name)) return prev;
            return [...prev, tc.function.name];
          });
        },
      });

      // Clear streaming state after complete
      setStreamingContent('');
      setActiveToolCalls([]);

      // Convert StreamMessage to Message format
      const assistantMessage: Message = {
        role: 'assistant',
        content: streamedMessage.content || '',
        tool_calls: streamedMessage.tool_calls?.map((tc: StreamToolCall) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };

      appendMessage(assistantMessage);

      if (assistantMessage.tool_calls?.length) {
        if (toolDepth >= maxToolRounds) {
          setError(
            `Reached tool limit (${maxToolRounds} rounds). Type "continue" to proceed with more actions.`
          );
          return;
        }

        const hadError = await executeToolCalls(assistantMessage.tool_calls);
        if (hadError) {
          // Enhanced error recovery: add context for the assistant to retry
          const failedTools = assistantMessage.tool_calls
            .map((call) => call.function?.name)
            .join(', ');
          appendMessage({
            role: 'system',
            content: `Some tool actions failed (${failedTools}). Consider using workflow_get_state to check current state and retry with corrected parameters.`,
          });
        }

        await sendToOpenRouter(messagesRef.current, toolDepth + 1);
      }
    },
    [model, systemPrompt, openRouterApiKey, tools, maxToolRounds, appendMessage, executeToolCalls]
  );

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;

    if (!openRouterApiKey) {
      setError('Add an OpenRouter API key in Settings to use the assistant.');
      return;
    }

    if (!model.trim()) {
      setError('Add a model id before sending.');
      return;
    }

    rememberModel(model);
    setError('');
    setDraft('');
    setIsLoading(true);

    // Check if user is continuing after hitting tool limit
    const isContinue = trimmed.toLowerCase() === 'continue';
    const userMessage: Message = {
      role: 'user',
      content: isContinue ? 'Continue with the previous task where you left off.' : trimmed,
    };
    appendMessage(userMessage);

    try {
      // Reset tool depth when continuing to allow more rounds
      await sendToOpenRouter(messagesRef.current, 0);
    } catch (err) {
      setError((err as Error).message || 'Failed to reach OpenRouter.');
    } finally {
      setIsLoading(false);
    }
  }, [draft, isLoading, openRouterApiKey, model, rememberModel, appendMessage, sendToOpenRouter]);

  const handleReset = useCallback((): void => {
    setMessages([]);
    messagesRef.current = [];
    setDraft('');
    setError('');
  }, []);

  return {
    messages,
    visibleMessages,
    isLoading,
    streamingContent,
    activeToolCalls,
    error,
    setError,
    draft,
    setDraft,
    handleSend,
    handleReset,
    messagesRef,
  };
}

export default useAssistantMessages;
