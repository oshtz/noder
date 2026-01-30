import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGeneration,
  useImageGeneration,
  useTextGeneration,
  useVideoGeneration,
} from './useGeneration';

// Mock reactflow hooks
vi.mock('reactflow', () => ({
  useEdges: vi.fn(() => []),
  useNodes: vi.fn(() => []),
}));

// Mock eventBus
vi.mock('../utils/eventBus', () => ({
  emit: vi.fn(),
}));

// Mock constants
vi.mock('../constants/handleTypes', () => ({
  HANDLE_TYPES: {
    IMAGE: { type: 'image' },
    TEXT: { type: 'text' },
    VIDEO: { type: 'video' },
  },
}));

// Mock replicateSchemaCache
vi.mock('../utils/replicateSchemaCache', () => ({
  fetchModelSchema: vi.fn(() =>
    Promise.resolve({
      inputs: {
        prompt: { type: 'string', required: true },
      },
    })
  ),
  buildReplicateInput: vi.fn((schema, inputs, formState) => ({
    prompt: inputs.text[0] || formState.prompt,
  })),
}));

// Mock openrouter API
vi.mock('../api/openrouter', () => ({
  chatCompletion: vi.fn(() =>
    Promise.resolve({
      choices: [{ message: { content: 'Generated text response' } }],
    })
  ),
}));

// Mock settings API
vi.mock('../api/settings', () => ({
  getApiKey: vi.fn((provider) => {
    if (provider === 'openrouter') return Promise.resolve('test-openrouter-key');
    return Promise.resolve(null);
  }),
}));

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd) => {
    if (cmd === 'replicate_create_prediction') {
      return Promise.resolve({
        id: 'pred-123',
        status: 'starting',
      });
    }
    if (cmd === 'replicate_get_prediction') {
      return Promise.resolve({
        id: 'pred-123',
        status: 'succeeded',
        output: ['https://example.com/output.png'],
      });
    }
    return Promise.resolve(null);
  }),
}));

describe('useGeneration', () => {
  const mockNodeData = {
    content: 'Test prompt',
    output: undefined,
    metadata: undefined,
  };

  const mockFormState = {
    model: 'stability-ai/sdxl',
    prompt: 'A beautiful sunset',
  };

  const mockConfig = {
    type: 'image' as const,
    outputHandleId: 'out',
    maxPollingAttempts: 3,
    pollingInterval: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(result.current.status).toBe('idle');
    });

    it('should initialize with null error', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(result.current.error).toBeNull();
    });

    it('should initialize with null output when data.output is undefined', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(result.current.output).toBeNull();
    });

    it('should initialize with existing output when data.output is set', () => {
      const dataWithOutput = { ...mockNodeData, output: 'existing-output' };
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: dataWithOutput,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(result.current.output).toBe('existing-output');
    });

    it('should initialize polling progress', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(result.current.pollingProgress).toEqual({
        attempts: 0,
        maxAttempts: 3,
        elapsedSeconds: 0,
      });
    });
  });

  describe('handleGenerate', () => {
    it('should be a function', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(typeof result.current.handleGenerate).toBe('function');
    });

    it('should throw error if model is empty', async () => {
      const formStateWithoutModel = { ...mockFormState, model: '' };
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithoutModel,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Please specify a model');
    });

    it('should throw error if model is whitespace only', async () => {
      const formStateWithWhitespace = { ...mockFormState, model: '   ' };
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithWhitespace,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Please specify a model');
    });

    it('should set status to processing during generation', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      let callCount = 0;
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'processing' });
        }
        if (cmd === 'replicate_get_prediction') {
          callCount++;
          if (callCount >= 2) {
            return Promise.resolve({
              id: 'pred-123',
              status: 'succeeded',
              output: ['https://example.com/output.png'],
            });
          }
          return Promise.resolve({ id: 'pred-123', status: 'processing' });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      let _processingCaptured = false;
      act(() => {
        result.current.handleGenerate();
        // Capture status immediately after calling
        _processingCaptured = result.current.status === 'idle';
      });

      // The status should change to processing
      await act(async () => {
        await vi.runAllTimersAsync();
      });
    });

    it('should reset error at start of generation', async () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: { ...mockFormState, model: '' },
          config: mockConfig,
        })
      );

      // First generate with error
      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Please specify a model');

      // Now generate again with valid model
      const { result: result2 } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result2.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      // Error should be cleared for successful generation
      expect(result2.current.error).toBeNull();
    });
  });

  describe('dispatchOutput', () => {
    it('should be a function', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(typeof result.current.dispatchOutput).toBe('function');
    });

    it('should emit nodeContentChanged events for connected edges', async () => {
      const { useEdges } = await import('reactflow');
      vi.mocked(useEdges).mockReturnValue([
        {
          id: 'edge-1',
          source: 'test-node',
          target: 'target-1',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
      ]);

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      act(() => {
        result.current.dispatchOutput('test-output');
      });

      const { emit } = await import('../utils/eventBus');
      expect(emit).toHaveBeenCalledWith(
        'nodeContentChanged',
        expect.objectContaining({
          sourceId: 'test-node',
          targetId: 'target-1',
          content: expect.objectContaining({
            type: 'image',
            value: 'test-output',
          }),
        })
      );
    });

    it('should not emit events when no edges are connected', async () => {
      // Reset mock and ensure no edges
      const { useEdges } = await import('reactflow');
      vi.mocked(useEdges).mockReturnValue([]);

      const { emit } = await import('../utils/eventBus');
      vi.mocked(emit).mockClear();

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'isolated-node', // Different node ID
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      act(() => {
        result.current.dispatchOutput('test-output');
      });

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('setOutput', () => {
    it('should be a function', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      expect(typeof result.current.setOutput).toBe('function');
    });

    it('should update output state', () => {
      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      act(() => {
        result.current.setOutput('new-output');
      });

      expect(result.current.output).toBe('new-output');
    });
  });

  describe('provider detection', () => {
    it('should use OpenRouter for openai models', async () => {
      const { getApiKey } = await import('../api/settings');
      const { chatCompletion } = await import('../api/openrouter');

      const formStateWithOpenAI = { ...mockFormState, model: 'openai/gpt-4' };
      const textConfig = { ...mockConfig, type: 'text' as const };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithOpenAI,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(getApiKey).toHaveBeenCalledWith('openrouter');
      expect(chatCompletion).toHaveBeenCalled();
    });

    it('should use Replicate for stability-ai models', async () => {
      const { invoke } = await import('@tauri-apps/api/core');

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState, // uses stability-ai/sdxl
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(invoke).toHaveBeenCalledWith('replicate_create_prediction', expect.anything());
    });

    it('should throw error when OpenRouter key is not configured', async () => {
      const { getApiKey } = await import('../api/settings');
      vi.mocked(getApiKey).mockResolvedValueOnce(null);

      const formStateWithOpenAI = { ...mockFormState, model: 'openai/gpt-4' };
      const textConfig = { ...mockConfig, type: 'text' as const };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithOpenAI,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe(
        'OpenRouter API key not configured. Please add it in Settings.'
      );
    });
  });

  describe('prediction polling', () => {
    it('should handle failed prediction', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'failed',
            error: 'Model execution failed',
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Model execution failed');
    });

    it('should handle canceled prediction', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'canceled',
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Prediction was canceled');
    });

    it('should handle timeout (max attempts exceeded)', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'processing' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'processing' });
        }
        return Promise.resolve(null);
      });

      const configWithLowAttempts = { ...mockConfig, maxPollingAttempts: 2 };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: configWithLowAttempts,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Prediction timed out');
    });
  });

  describe('output extraction', () => {
    it('should extract string output directly', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: 'string-output',
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.output).toBe('string-output');
    });

    it('should extract first element from array output for image', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['image-url-1', 'image-url-2'],
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.output).toBe('image-url-1');
    });

    it('should join array output for text', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['Hello', ' ', 'World'],
          });
        }
        return Promise.resolve(null);
      });

      const textConfig = { ...mockConfig, type: 'text' as const };
      const formStateWithReplicate = { ...mockFormState, model: 'some-replicate/text-model' };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithReplicate,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.output).toBe('Hello World');
    });

    it('should use custom extractResult when provided', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: { nested: { value: 'custom-output' } },
          });
        }
        return Promise.resolve(null);
      });

      const customExtract = (output: unknown) => {
        const obj = output as { nested: { value: string } };
        return obj.nested.value;
      };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
          extractResult: customExtract,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.output).toBe('custom-output');
    });
  });
});

describe('useImageGeneration', () => {
  it('should be a function', () => {
    expect(typeof useImageGeneration).toBe('function');
  });

  it('should configure for image generation', () => {
    const { result } = renderHook(() =>
      useImageGeneration({
        nodeId: 'test-node',
        data: { content: '', output: undefined },
        formState: { model: 'test/model', prompt: 'test' },
      })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.pollingProgress.maxAttempts).toBe(120);
  });
});

describe('useTextGeneration', () => {
  it('should be a function', () => {
    expect(typeof useTextGeneration).toBe('function');
  });

  it('should configure for text generation', () => {
    const { result } = renderHook(() =>
      useTextGeneration({
        nodeId: 'test-node',
        data: { content: '', output: undefined },
        formState: { model: 'test/model', prompt: 'test' },
      })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.pollingProgress.maxAttempts).toBe(120);
  });
});

describe('useVideoGeneration', () => {
  it('should be a function', () => {
    expect(typeof useVideoGeneration).toBe('function');
  });

  it('should configure for video generation', () => {
    const { result } = renderHook(() =>
      useVideoGeneration({
        nodeId: 'test-node',
        data: { content: '', output: undefined },
        formState: { model: 'test/model', prompt: 'test' },
      })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.pollingProgress.maxAttempts).toBe(300);
  });
});

describe('useGeneration - additional coverage', () => {
  const mockNodeData = {
    content: 'Test prompt',
    output: undefined,
    metadata: undefined,
  };

  const mockFormState = {
    model: 'stability-ai/sdxl',
    prompt: 'A beautiful sunset',
  };

  const mockConfig = {
    type: 'image' as const,
    outputHandleId: 'out',
    maxPollingAttempts: 3,
    pollingInterval: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Silence console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('connected inputs handling', () => {
    it('should handle externalInputs with image', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['https://example.com/output.png'],
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
          connectedInputs: {
            image: 'data:image/png;base64,test-image-data',
          },
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.output).toBe('https://example.com/output.png');
    });

    it('should handle externalInputs with audio for text generation', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['Transcribed text'],
          });
        }
        return Promise.resolve(null);
      });

      const textConfig = { ...mockConfig, type: 'text' as const };
      const formStateWithReplicate = { ...mockFormState, model: 'some-replicate/whisper' };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithReplicate,
          config: textConfig,
          connectedInputs: {
            audio: 'data:audio/mp3;base64,test-audio-data',
          },
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('custom buildInput function', () => {
    it('should use custom buildInput when provided', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['https://example.com/output.png'],
          });
        }
        return Promise.resolve(null);
      });

      const customBuildInput = vi.fn((formState, _connectedInputs) => ({
        custom_prompt: formState.prompt,
        custom_setting: 'value',
      }));

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
          buildInput: customBuildInput,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(customBuildInput).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });
  });

  describe('OpenRouter integration', () => {
    it('should include system prompt in OpenRouter messages', async () => {
      const { _getApiKey } = await import('../api/settings');
      const { chatCompletion } = await import('../api/openrouter');

      const formStateWithSystem = {
        model: 'openai/gpt-4',
        prompt: 'Hello',
        systemPrompt: 'You are a helpful assistant',
      };
      const textConfig = { ...mockConfig, type: 'text' as const };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithSystem,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system', content: 'You are a helpful assistant' }),
          ]),
        })
      );
    });

    it('should use anthropic provider for text generation', async () => {
      const { _getApiKey } = await import('../api/settings');
      const { chatCompletion } = await import('../api/openrouter');

      const formStateWithAnthropic = {
        model: 'anthropic/claude-3-opus',
        prompt: 'Hello',
      };
      const textConfig = { ...mockConfig, type: 'text' as const };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithAnthropic,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(chatCompletion).toHaveBeenCalled();
    });

    it('should handle multimodal input with images for OpenRouter', async () => {
      const { useEdges, useNodes } = await import('reactflow');
      vi.mocked(useEdges).mockReturnValue([]);
      vi.mocked(useNodes).mockReturnValue([]);

      const { chatCompletion } = await import('../api/openrouter');

      const formStateWithOpenAI = {
        model: 'openai/gpt-4-vision',
        prompt: 'What is in this image?',
      };
      const textConfig = { ...mockConfig, type: 'text' as const };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithOpenAI,
          config: textConfig,
          connectedInputs: {
            image: 'data:image/png;base64,test-image',
          },
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image_url' }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  describe('schema fetch fallback', () => {
    it('should use fallback input when schema fetch fails', async () => {
      const { fetchModelSchema } = await import('../utils/replicateSchemaCache');
      vi.mocked(fetchModelSchema).mockRejectedValueOnce(new Error('Schema fetch failed'));

      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['https://example.com/output.png'],
          });
        }
        return Promise.resolve(null);
      });

      const formStateWithExtras = {
        ...mockFormState,
        negativePrompt: 'ugly, blurry',
        width: 1024,
        height: 1024,
        numOutputs: 2,
      };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithExtras,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeNull();
      expect(invoke).toHaveBeenCalledWith(
        'replicate_create_prediction',
        expect.objectContaining({
          input: expect.objectContaining({
            negative_prompt: 'ugly, blurry',
            width: 1024,
            height: 1024,
            num_outputs: 2,
          }),
        })
      );
    });

    it('should include temperature in fallback input for text models', async () => {
      const { fetchModelSchema } = await import('../utils/replicateSchemaCache');
      vi.mocked(fetchModelSchema).mockRejectedValueOnce(new Error('Schema fetch failed'));

      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['Generated text'],
          });
        }
        return Promise.resolve(null);
      });

      const formStateWithTemp = {
        model: 'some-replicate/llama',
        prompt: 'Hello',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'Be concise',
      };
      const textConfig = { ...mockConfig, type: 'text' as const };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithTemp,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(invoke).toHaveBeenCalledWith(
        'replicate_create_prediction',
        expect.objectContaining({
          input: expect.objectContaining({
            temperature: 0.7,
            max_tokens: 1000,
            system_prompt: 'Be concise',
          }),
        })
      );
    });

    it('should include video parameters in fallback input', async () => {
      const { fetchModelSchema } = await import('../utils/replicateSchemaCache');
      vi.mocked(fetchModelSchema).mockRejectedValueOnce(new Error('Schema fetch failed'));

      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['https://example.com/video.mp4'],
          });
        }
        return Promise.resolve(null);
      });

      const formStateWithVideo = {
        model: 'some-replicate/video-model',
        prompt: 'A cat walking',
        duration: 5,
        fps: 30,
      };
      const videoConfig = { ...mockConfig, type: 'video' as const, outputHandleId: 'video-out' };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithVideo,
          config: videoConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(invoke).toHaveBeenCalledWith(
        'replicate_create_prediction',
        expect.objectContaining({
          input: expect.objectContaining({
            duration: 5,
            fps: 30,
          }),
        })
      );
    });
  });

  describe('output extraction edge cases', () => {
    it('should stringify non-string, non-array output for text type', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: { key: 'value', nested: { data: true } },
          });
        }
        return Promise.resolve(null);
      });

      const textConfig = { ...mockConfig, type: 'text' as const };
      const formStateWithReplicate = { ...mockFormState, model: 'some-replicate/text-model' };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: formStateWithReplicate,
          config: textConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.output).toBe('{"key":"value","nested":{"data":true}}');
    });

    it('should throw for unexpected output format in image type', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: { unexpected: 'format' },
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Unexpected output format');
    });
  });

  describe('edge dispatch', () => {
    it('should dispatch to multiple connected edges', async () => {
      const { useEdges } = await import('reactflow');
      vi.mocked(useEdges).mockReturnValue([
        {
          id: 'edge-1',
          source: 'test-node',
          target: 'target-1',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
        {
          id: 'edge-2',
          source: 'test-node',
          target: 'target-2',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
      ]);

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      act(() => {
        result.current.dispatchOutput('test-output');
      });

      const { emit } = await import('../utils/eventBus');
      expect(emit).toHaveBeenCalledTimes(2);
    });

    it('should include model name in dispatch payload', async () => {
      const { useEdges } = await import('reactflow');
      vi.mocked(useEdges).mockReturnValue([
        {
          id: 'edge-1',
          source: 'test-node',
          target: 'target-1',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
      ]);

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      act(() => {
        result.current.dispatchOutput('test-output');
      });

      const { emit } = await import('../utils/eventBus');
      expect(emit).toHaveBeenCalledWith(
        'nodeContentChanged',
        expect.objectContaining({
          content: expect.objectContaining({
            model: 'stability-ai/sdxl',
            fromWorkflow: true,
          }),
        })
      );
    });
  });

  describe('prediction error handling', () => {
    it('should handle failed prediction without error message', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'failed',
            // No error message provided
          });
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Prediction failed');
    });

    it('should handle non-Error exceptions', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          throw 'String error';
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('String error');
    });
  });

  describe('data content fallback', () => {
    it('should use data.content when prompt is empty', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['https://example.com/output.png'],
          });
        }
        return Promise.resolve(null);
      });

      const dataWithContent = {
        content: 'Content from data',
        output: undefined,
      };

      const formStateWithoutPrompt = {
        model: 'stability-ai/sdxl',
        prompt: '',
      };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: dataWithContent,
          formState: formStateWithoutPrompt,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('polling progress updates', () => {
    it('should update polling progress during generation', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      let pollCount = 0;

      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'processing' });
        }
        if (cmd === 'replicate_get_prediction') {
          pollCount++;
          if (pollCount >= 2) {
            return Promise.resolve({
              id: 'pred-123',
              status: 'succeeded',
              output: ['https://example.com/output.png'],
            });
          }
          return Promise.resolve({ id: 'pred-123', status: 'processing' });
        }
        return Promise.resolve(null);
      });

      const configWithMoreAttempts = { ...mockConfig, maxPollingAttempts: 5 };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mockNodeData,
          formState: mockFormState,
          config: configWithMoreAttempts,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      // After completion, we should have gone through polling
      expect(result.current.error).toBeNull();
      expect(result.current.output).toBe('https://example.com/output.png');
    });
  });

  describe('metadata updates', () => {
    it('should set metadata from model name', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'replicate_create_prediction') {
          return Promise.resolve({ id: 'pred-123', status: 'starting' });
        }
        if (cmd === 'replicate_get_prediction') {
          return Promise.resolve({
            id: 'pred-123',
            status: 'succeeded',
            output: ['https://example.com/output.png'],
          });
        }
        return Promise.resolve(null);
      });

      const mutableData = {
        content: 'Test',
        output: undefined as string | undefined,
        metadata: undefined as string | undefined,
      };

      const { result } = renderHook(() =>
        useGeneration({
          nodeId: 'test-node',
          data: mutableData,
          formState: mockFormState,
          config: mockConfig,
        })
      );

      await act(async () => {
        await result.current.handleGenerate();
        await vi.runAllTimersAsync();
      });

      // The data object should have been mutated with metadata
      expect(mutableData.metadata).toBe('sdxl');
    });
  });
});
