import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantMessages, type Message } from './useAssistantMessages';

// ============================================================================
// Mocks
// ============================================================================

const mockStreamOpenRouter = vi.fn();
const mockGetOpenRouterTools = vi.fn();

vi.mock('../utils/openrouterClient', () => ({
  streamOpenRouter: (opts: unknown) => mockStreamOpenRouter(opts),
}));

vi.mock('../utils/assistantTools', () => ({
  getOpenRouterTools: () => mockGetOpenRouterTools(),
}));

// ============================================================================
// Test Utilities
// ============================================================================

interface CreateOptionsParams {
  openRouterApiKey?: string;
  systemPrompt?: string;
  executeToolCall?: (call: unknown) => Promise<unknown>;
  model?: string;
  rememberModel?: (modelId: string) => void;
  maxToolRounds?: number;
}

const createDefaultOptions = (overrides: CreateOptionsParams = {}) => ({
  openRouterApiKey: overrides.openRouterApiKey ?? 'test-api-key',
  systemPrompt: overrides.systemPrompt ?? 'You are a helpful assistant.',
  executeToolCall: overrides.executeToolCall ?? vi.fn().mockResolvedValue({ success: true }),
  model: overrides.model ?? 'openai/gpt-4o',
  rememberModel: overrides.rememberModel ?? vi.fn(),
  maxToolRounds: overrides.maxToolRounds,
});

const createMockToolCall = (name: string, args: Record<string, unknown> = {}) => ({
  id: `tool-call-${Date.now()}`,
  type: 'function',
  function: {
    name,
    arguments: JSON.stringify(args),
  },
});

// ============================================================================
// Tests
// ============================================================================

describe('useAssistantMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpenRouterTools.mockReturnValue([
      {
        type: 'function',
        function: {
          name: 'workflow_create',
          description: 'Create nodes',
          parameters: { type: 'object', properties: {} },
        },
      },
    ]);
    mockStreamOpenRouter.mockResolvedValue({
      role: 'assistant',
      content: 'Hello! How can I help you?',
      tool_calls: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Initial State Tests
  // --------------------------------------------------------------------------

  describe('initial state', () => {
    it('should start with empty messages array', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.messages).toEqual([]);
    });

    it('should start with empty visibleMessages array', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.visibleMessages).toEqual([]);
    });

    it('should start with isLoading as false', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.isLoading).toBe(false);
    });

    it('should start with empty streamingContent', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.streamingContent).toBe('');
    });

    it('should start with empty activeToolCalls array', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.activeToolCalls).toEqual([]);
    });

    it('should start with empty error string', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.error).toBe('');
    });

    it('should start with empty draft string', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.draft).toBe('');
    });

    it('should provide messagesRef with current messages', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.messagesRef.current).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Draft Management Tests
  // --------------------------------------------------------------------------

  describe('draft management', () => {
    it('should update draft when setDraft is called', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello world');
      });

      expect(result.current.draft).toBe('Hello world');
    });

    it('should handle empty draft', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Some text');
      });

      act(() => {
        result.current.setDraft('');
      });

      expect(result.current.draft).toBe('');
    });

    it('should handle long draft content', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      const longText = 'a'.repeat(10000);
      act(() => {
        result.current.setDraft(longText);
      });

      expect(result.current.draft).toBe(longText);
    });

    it('should handle special characters in draft', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      const specialText = 'Hello! @#$%^&*() \n\t "quotes"';
      act(() => {
        result.current.setDraft(specialText);
      });

      expect(result.current.draft).toBe(specialText);
    });
  });

  // --------------------------------------------------------------------------
  // Error Management Tests
  // --------------------------------------------------------------------------

  describe('error management', () => {
    it('should update error when setError is called', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setError('Something went wrong');
      });

      expect(result.current.error).toBe('Something went wrong');
    });

    it('should clear error when setError is called with empty string', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setError('Error');
      });

      act(() => {
        result.current.setError('');
      });

      expect(result.current.error).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // handleSend Tests
  // --------------------------------------------------------------------------

  describe('handleSend', () => {
    it('should not send if draft is empty', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      await act(async () => {
        await result.current.handleSend();
      });

      expect(mockStreamOpenRouter).not.toHaveBeenCalled();
    });

    it('should not send if draft is only whitespace', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('   \n\t   ');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(mockStreamOpenRouter).not.toHaveBeenCalled();
    });

    it('should not send if isLoading is true', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      // Create a delayed promise to keep loading state
      let resolveStream: (value: unknown) => void = () => {};
      mockStreamOpenRouter.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStream = resolve;
          })
      );

      act(() => {
        result.current.setDraft('First message');
      });

      // Start first send
      const sendPromise = act(async () => {
        result.current.handleSend();
      });

      // Wait for loading to be true
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Try second send while loading
      act(() => {
        result.current.setDraft('Second message');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Resolve first send
      resolveStream({
        role: 'assistant',
        content: 'Response',
        tool_calls: undefined,
      });

      await sendPromise;

      // Should only have been called once
      expect(mockStreamOpenRouter).toHaveBeenCalledTimes(1);
    });

    it('should set error if API key is missing', async () => {
      const options = createDefaultOptions({ openRouterApiKey: '' });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe(
        'Add an OpenRouter API key in Settings to use the assistant.'
      );
      expect(mockStreamOpenRouter).not.toHaveBeenCalled();
    });

    it('should set error if model is empty', async () => {
      const options = createDefaultOptions({ model: '' });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe('Add a model id before sending.');
      expect(mockStreamOpenRouter).not.toHaveBeenCalled();
    });

    it('should set error if model is only whitespace', async () => {
      const options = createDefaultOptions({ model: '   ' });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe('Add a model id before sending.');
    });

    it('should call rememberModel when sending', async () => {
      const rememberModel = vi.fn();
      const options = createDefaultOptions({ rememberModel });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(rememberModel).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('should clear error before sending', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setError('Previous error');
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe('');
    });

    it('should clear draft after sending', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.draft).toBe('');
    });

    it('should set isLoading to true during send', async () => {
      let resolveStream: (value: unknown) => void = () => {};
      mockStreamOpenRouter.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStream = resolve;
          })
      );

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      const sendPromise = act(async () => {
        result.current.handleSend();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolveStream({
        role: 'assistant',
        content: 'Response',
        tool_calls: undefined,
      });

      await sendPromise;
    });

    it('should set isLoading to false after send completes', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should add user message to messages', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello, assistant!');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages[0]).toEqual({
        role: 'user',
        content: 'Hello, assistant!',
      });
    });

    it('should add assistant response to messages', async () => {
      mockStreamOpenRouter.mockResolvedValue({
        role: 'assistant',
        content: 'Hello! I am here to help.',
        tool_calls: undefined,
      });

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]).toEqual({
        role: 'assistant',
        content: 'Hello! I am here to help.',
        tool_calls: undefined,
      });
    });

    it('should handle "continue" message specially', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('continue');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages[0]).toEqual({
        role: 'user',
        content: 'Continue with the previous task where you left off.',
      });
    });

    it('should handle "CONTINUE" message case-insensitively', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('CONTINUE');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages[0]).toEqual({
        role: 'user',
        content: 'Continue with the previous task where you left off.',
      });
    });

    it('should pass correct parameters to streamOpenRouter', async () => {
      const options = createDefaultOptions({
        openRouterApiKey: 'my-api-key',
        model: 'custom-model',
        systemPrompt: 'System prompt here',
      });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(mockStreamOpenRouter).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'my-api-key',
          model: 'custom-model',
          messages: expect.arrayContaining([
            { role: 'system', content: 'System prompt here' },
            { role: 'user', content: 'Hello' },
          ]),
          tools: expect.any(Array),
        })
      );
    });

    it('should not include system message if systemPrompt is empty', async () => {
      const options = createDefaultOptions({
        systemPrompt: '',
      });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      const callArgs = mockStreamOpenRouter.mock.calls[0][0] as { messages: Message[] };
      expect(callArgs.messages.find((m) => m.role === 'system')).toBeUndefined();
    });

    it('should not include system message if systemPrompt is only whitespace', async () => {
      const options = createDefaultOptions({
        systemPrompt: '   \n\t   ',
      });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      const callArgs = mockStreamOpenRouter.mock.calls[0][0] as { messages: Message[] };
      expect(callArgs.messages.find((m) => m.role === 'system')).toBeUndefined();
    });

    it('should set error when API call fails', async () => {
      mockStreamOpenRouter.mockRejectedValue(new Error('Network error'));

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should set default error message when error has no message', async () => {
      mockStreamOpenRouter.mockRejectedValue({});

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe('Failed to reach OpenRouter.');
    });
  });

  // --------------------------------------------------------------------------
  // Tool Execution Tests
  // --------------------------------------------------------------------------

  describe('tool execution', () => {
    it('should execute tool calls when assistant responds with tools', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_create', { nodes: [] });

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Done!',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Create a workflow');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(executeToolCall).toHaveBeenCalledWith(toolCall);
    });

    it('should add tool result message after execution', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ result: 'success' });
      const toolCall = createMockToolCall('workflow_get_state', {});

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Here is the state.',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Get state');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      const toolMessage = result.current.messages.find(
        (m) => m.role === 'tool' && m.tool_call_id === toolCall.id
      );
      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toContain('success');
    });

    it('should handle tool execution errors', async () => {
      const executeToolCall = vi.fn().mockRejectedValue(new Error('Tool failed'));
      const toolCall = createMockToolCall('workflow_run', {});

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'I see there was an error.',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Run workflow');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      const toolMessage = result.current.messages.find(
        (m) => m.role === 'tool' && m.tool_call_id === toolCall.id
      );
      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toContain('Tool failed');
    });

    it('should handle tool returning error object', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ error: 'Invalid input' });
      const toolCall = createMockToolCall('workflow_create', {});

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Let me fix that.',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Create workflow');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Should add system message about failed tools
      const systemMessage = result.current.messages.find(
        (m) => m.role === 'system' && m.content.includes('failed')
      );
      expect(systemMessage).toBeDefined();
    });

    it('should execute multiple tool calls in sequence', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall1 = createMockToolCall('workflow_get_state', {});
      const toolCall2 = createMockToolCall('workflow_create', { nodes: [] });

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall1, toolCall2],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Done!',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Check and create');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(executeToolCall).toHaveBeenCalledTimes(2);
      expect(executeToolCall).toHaveBeenNthCalledWith(1, toolCall1);
      expect(executeToolCall).toHaveBeenNthCalledWith(2, toolCall2);
    });

    it('should respect maxToolRounds limit', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_run', {});

      // Mock responses to always return tool calls
      mockStreamOpenRouter.mockResolvedValue({
        role: 'assistant',
        content: '',
        tool_calls: [toolCall],
      });

      const options = createDefaultOptions({
        executeToolCall,
        maxToolRounds: 2,
      });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Run repeatedly');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Should stop after maxToolRounds
      expect(result.current.error).toContain('Reached tool limit');
    });

    it('should use default maxToolRounds of 8', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_run', {});

      let callCount = 0;
      mockStreamOpenRouter.mockImplementation(() => {
        callCount++;
        if (callCount <= 9) {
          return Promise.resolve({
            role: 'assistant',
            content: '',
            tool_calls: [toolCall],
          });
        }
        return Promise.resolve({
          role: 'assistant',
          content: 'Final response',
          tool_calls: undefined,
        });
      });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Run');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Should stop at round 8 + 1 initial = 9 calls max
      expect(result.current.error).toContain('Reached tool limit (8 rounds)');
    });

    it('should continue after tool limit if user types continue', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_run', {});

      let callCount = 0;
      mockStreamOpenRouter.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            role: 'assistant',
            content: '',
            tool_calls: [toolCall],
          });
        }
        return Promise.resolve({
          role: 'assistant',
          content: 'Done!',
          tool_calls: undefined,
        });
      });

      const options = createDefaultOptions({
        executeToolCall,
        maxToolRounds: 1,
      });
      const { result } = renderHook(() => useAssistantMessages(options));

      // First message - hits limit
      act(() => {
        result.current.setDraft('Run');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toContain('Reached tool limit');

      // Continue
      act(() => {
        result.current.setDraft('continue');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Should have more calls now
      expect(callCount).toBeGreaterThan(1);
    });
  });

  // --------------------------------------------------------------------------
  // visibleMessages Tests
  // --------------------------------------------------------------------------

  describe('visibleMessages', () => {
    it('should filter out tool messages', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_get_state', {});

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Let me check.',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Here is the result.',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Get state');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // messages should include tool messages
      const hasToolMessage = result.current.messages.some((m) => m.role === 'tool');
      expect(hasToolMessage).toBe(true);

      // visibleMessages should not include tool messages
      const hasVisibleToolMessage = result.current.visibleMessages.some((m) => m.role === 'tool');
      expect(hasVisibleToolMessage).toBe(false);
    });

    it('should filter out assistant messages with empty content', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_create', {});

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Created!',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Create');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Check visible messages don't include empty assistant messages
      const emptyAssistant = result.current.visibleMessages.find(
        (m) => m.role === 'assistant' && !m.content?.trim()
      );
      expect(emptyAssistant).toBeUndefined();
    });

    it('should include user messages in visibleMessages', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      const userMessage = result.current.visibleMessages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Hello');
    });

    it('should include assistant messages with content in visibleMessages', async () => {
      mockStreamOpenRouter.mockResolvedValue({
        role: 'assistant',
        content: 'Hello there!',
        tool_calls: undefined,
      });

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hi');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      const assistantMessage = result.current.visibleMessages.find((m) => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBe('Hello there!');
    });
  });

  // --------------------------------------------------------------------------
  // handleReset Tests
  // --------------------------------------------------------------------------

  describe('handleReset', () => {
    it('should clear all messages', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.handleReset();
      });

      expect(result.current.messages).toEqual([]);
    });

    it('should clear messagesRef', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      act(() => {
        result.current.handleReset();
      });

      expect(result.current.messagesRef.current).toEqual([]);
    });

    it('should clear draft', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Some draft text');
      });

      act(() => {
        result.current.handleReset();
      });

      expect(result.current.draft).toBe('');
    });

    it('should clear error', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setError('Some error');
      });

      act(() => {
        result.current.handleReset();
      });

      expect(result.current.error).toBe('');
    });

    it('should allow sending after reset', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('First');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      act(() => {
        result.current.handleReset();
      });

      act(() => {
        result.current.setDraft('Second');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages).toHaveLength(2); // user + assistant
      expect(result.current.messages[0].content).toBe('Second');
    });
  });

  // --------------------------------------------------------------------------
  // Streaming Tests
  // --------------------------------------------------------------------------

  describe('streaming', () => {
    it('should call onToken callback during streaming', async () => {
      let capturedOnToken: ((token: string) => void) | undefined;

      mockStreamOpenRouter.mockImplementation((opts: { onToken?: (token: string) => void }) => {
        capturedOnToken = opts.onToken;
        // Simulate streaming tokens
        if (opts.onToken) {
          opts.onToken('Hello');
          opts.onToken(' world');
        }
        return Promise.resolve({
          role: 'assistant',
          content: 'Hello world',
          tool_calls: undefined,
        });
      });

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hi');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(capturedOnToken).toBeDefined();
    });

    it('should call onToolCall callback when tool calls are streamed', async () => {
      let capturedOnToolCall: ((tc: { function: { name: string } }) => void) | undefined;

      mockStreamOpenRouter.mockImplementation(
        (opts: { onToolCall?: (tc: { function: { name: string } }) => void }) => {
          capturedOnToolCall = opts.onToolCall;
          return Promise.resolve({
            role: 'assistant',
            content: 'Done',
            tool_calls: undefined,
          });
        }
      );

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(capturedOnToolCall).toBeDefined();
    });

    it('should update activeToolCalls when tool calls are streamed', async () => {
      let capturedOnToolCall: ((tc: { function: { name: string } }) => void) | undefined;
      let resolveStream: (value: unknown) => void = () => {};

      mockStreamOpenRouter.mockImplementation(
        (opts: { onToolCall?: (tc: { function: { name: string } }) => void }) => {
          capturedOnToolCall = opts.onToolCall;
          return new Promise((resolve) => {
            resolveStream = resolve;
          });
        }
      );

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      const sendPromise = act(async () => {
        result.current.handleSend();
      });

      await waitFor(() => {
        expect(capturedOnToolCall).toBeDefined();
      });

      act(() => {
        capturedOnToolCall!({ function: { name: 'workflow_create' } });
      });

      expect(result.current.activeToolCalls).toContain('workflow_create');

      resolveStream({
        role: 'assistant',
        content: 'Done',
        tool_calls: undefined,
      });

      await sendPromise;
    });

    it('should not duplicate activeToolCalls', async () => {
      let capturedOnToolCall: ((tc: { function: { name: string } }) => void) | undefined;
      let resolveStream: (value: unknown) => void = () => {};

      mockStreamOpenRouter.mockImplementation(
        (opts: { onToolCall?: (tc: { function: { name: string } }) => void }) => {
          capturedOnToolCall = opts.onToolCall;
          return new Promise((resolve) => {
            resolveStream = resolve;
          });
        }
      );

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      const sendPromise = act(async () => {
        result.current.handleSend();
      });

      await waitFor(() => {
        expect(capturedOnToolCall).toBeDefined();
      });

      act(() => {
        capturedOnToolCall!({ function: { name: 'workflow_create' } });
        capturedOnToolCall!({ function: { name: 'workflow_create' } });
        capturedOnToolCall!({ function: { name: 'workflow_create' } });
      });

      expect(result.current.activeToolCalls).toHaveLength(1);

      resolveStream({
        role: 'assistant',
        content: 'Done',
        tool_calls: undefined,
      });

      await sendPromise;
    });

    it('should clear activeToolCalls after stream completes', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.activeToolCalls).toEqual([]);
    });

    it('should clear streamingContent after stream completes', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.streamingContent).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Message Normalization Tests
  // --------------------------------------------------------------------------

  describe('message normalization', () => {
    it('should handle missing tool outputs by inserting placeholders', async () => {
      // This tests the normalizeMessagesForTools function indirectly
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_get_state', {});

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Done',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Should have a tool message
      const toolMessages = result.current.messages.filter((m) => m.role === 'tool');
      expect(toolMessages.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Return Value Structure Tests
  // --------------------------------------------------------------------------

  describe('return value structure', () => {
    it('should return all expected properties', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current).toHaveProperty('messages');
      expect(result.current).toHaveProperty('visibleMessages');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('streamingContent');
      expect(result.current).toHaveProperty('activeToolCalls');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('setError');
      expect(result.current).toHaveProperty('draft');
      expect(result.current).toHaveProperty('setDraft');
      expect(result.current).toHaveProperty('handleSend');
      expect(result.current).toHaveProperty('handleReset');
      expect(result.current).toHaveProperty('messagesRef');
    });

    it('should return handleSend as async function', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(typeof result.current.handleSend).toBe('function');
    });

    it('should return handleReset as function', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(typeof result.current.handleReset).toBe('function');
    });

    it('should return setError as function', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(typeof result.current.setError).toBe('function');
    });

    it('should return setDraft as function', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(typeof result.current.setDraft).toBe('function');
    });

    it('should return messagesRef as React ref object', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      expect(result.current.messagesRef).toHaveProperty('current');
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases Tests
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle rapid setDraft calls', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.setDraft(`Draft ${i}`);
        }
      });

      expect(result.current.draft).toBe('Draft 99');
    });

    it('should handle null tool_calls in response', async () => {
      mockStreamOpenRouter.mockResolvedValue({
        role: 'assistant',
        content: 'Response',
        tool_calls: null,
      });

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages).toHaveLength(2);
    });

    it('should handle empty tool_calls array', async () => {
      mockStreamOpenRouter.mockResolvedValue({
        role: 'assistant',
        content: 'Response',
        tool_calls: [],
      });

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages).toHaveLength(2);
    });

    it('should handle tool call with missing function name', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = {
        id: 'tc-1',
        type: 'function',
        function: {
          name: '',
          arguments: '{}',
        },
      };

      mockStreamOpenRouter
        .mockResolvedValueOnce({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'Done',
          tool_calls: undefined,
        });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(executeToolCall).toHaveBeenCalled();
    });

    it('should handle very long conversation', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      // Simulate many messages
      for (let i = 0; i < 50; i++) {
        act(() => {
          result.current.setDraft(`Message ${i}`);
        });

        await act(async () => {
          await result.current.handleSend();
        });
      }

      expect(result.current.messages.length).toBe(100); // 50 user + 50 assistant
    });

    it('should handle unicode content', async () => {
      mockStreamOpenRouter.mockResolvedValue({
        role: 'assistant',
        content: 'Response with unicode',
        tool_calls: undefined,
      });

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Hello with unicode chars');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.messages[0].content).toBe('Hello with unicode chars');
    });

    it('should handle multiple resets', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
        result.current.setError('Error');
      });

      act(() => {
        result.current.handleReset();
        result.current.handleReset();
        result.current.handleReset();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.draft).toBe('');
      expect(result.current.error).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Tools Configuration Tests
  // --------------------------------------------------------------------------

  describe('tools configuration', () => {
    it('should get tools from getOpenRouterTools', async () => {
      const mockTools = [
        { type: 'function', function: { name: 'test_tool', description: 'Test', parameters: {} } },
      ];
      mockGetOpenRouterTools.mockReturnValue(mockTools);

      const options = createDefaultOptions();
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Test');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(mockStreamOpenRouter).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: mockTools,
        })
      );
    });

    it('should memoize tools', () => {
      const options = createDefaultOptions();
      const { _result, rerender } = renderHook(() => useAssistantMessages(options));

      const initialCallCount = mockGetOpenRouterTools.mock.calls.length;

      rerender();
      rerender();
      rerender();

      // Should not call getOpenRouterTools again due to useMemo
      expect(mockGetOpenRouterTools.mock.calls.length).toBe(initialCallCount);
    });
  });

  // --------------------------------------------------------------------------
  // Round Context Tests
  // --------------------------------------------------------------------------

  describe('round context', () => {
    it('should add round context for tool rounds', async () => {
      const executeToolCall = vi.fn().mockResolvedValue({ success: true });
      const toolCall = createMockToolCall('workflow_run', {});

      let callCount = 0;
      mockStreamOpenRouter.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            role: 'assistant',
            content: '',
            tool_calls: [toolCall],
          });
        }
        return Promise.resolve({
          role: 'assistant',
          content: 'Done!',
          tool_calls: undefined,
        });
      });

      const options = createDefaultOptions({ executeToolCall });
      const { result } = renderHook(() => useAssistantMessages(options));

      act(() => {
        result.current.setDraft('Run');
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Second call should include round context
      const secondCallArgs = mockStreamOpenRouter.mock.calls[1][0] as { messages: Message[] };
      const roundContextMessage = secondCallArgs.messages.find(
        (m) => m.role === 'system' && m.content.includes('Tool round')
      );
      expect(roundContextMessage).toBeDefined();
    });
  });
});
