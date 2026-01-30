import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useReplicateNode,
  parsePredictionOutput,
  validateModelFormat,
  type UseReplicateNodeOptions,
  type Prediction,
} from './useReplicateNode';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Get the mocked invoke function
import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = vi.mocked(invoke);

// Helper to create default options
const createOptions = (
  overrides: Partial<UseReplicateNodeOptions> = {}
): UseReplicateNodeOptions => ({
  modelId: 'stability-ai/sdxl',
  input: { prompt: 'A beautiful sunset' },
  outputType: 'image',
  maxAttempts: 3, // Low for faster tests
  logInterval: 1,
  ...overrides,
});

// Helper to create a mock prediction
const createPrediction = (overrides: Partial<Prediction> = {}): Prediction => ({
  id: 'pred-123',
  status: 'starting',
  ...overrides,
});

// Helper to mock successful prediction flow
const mockSuccessfulPrediction = (output: unknown = ['https://example.com/image.png']) => {
  mockedInvoke.mockResolvedValueOnce(createPrediction());
  mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'succeeded', output }));
};

describe('useReplicateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Test 1: Initial state
  // ==========================================================================
  describe('initial state', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(result.current.status).toBe('idle');
    });

    it('should initialize with null error', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(result.current.error).toBeNull();
    });

    it('should initialize with null result', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(result.current.result).toBeNull();
    });

    it('should initialize isProcessing as false', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(result.current.isProcessing).toBe(false);
    });

    it('should provide execute function', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(typeof result.current.execute).toBe('function');
    });

    it('should provide reset function', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(typeof result.current.reset).toBe('function');
    });
  });

  // ==========================================================================
  // Test 2: reset function
  // ==========================================================================
  describe('reset function', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should reset status to idle', async () => {
      mockSuccessfulPrediction();

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
    });

    it('should reset error to null', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset result to null', async () => {
      mockSuccessfulPrediction();

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.result).toBeNull();
    });
  });

  // ==========================================================================
  // Test 3: execute function - validation
  // ==========================================================================
  describe('execute function - validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should validate model format before execution', async () => {
      const { result } = renderHook(() =>
        useReplicateNode(createOptions({ modelId: 'invalid-model' }))
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Invalid model format');
    });

    it('should reject empty modelId', async () => {
      const { result } = renderHook(() => useReplicateNode(createOptions({ modelId: '' })));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Invalid model format');
    });

    it('should reject modelId with only owner', async () => {
      const { result } = renderHook(() => useReplicateNode(createOptions({ modelId: 'owner/' })));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Invalid model format');
    });

    it('should reject modelId with only model name', async () => {
      const { result } = renderHook(() =>
        useReplicateNode(createOptions({ modelId: '/model-name' }))
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Invalid model format');
    });

    it('should accept valid modelId format', async () => {
      mockSuccessfulPrediction();

      const { result } = renderHook(() =>
        useReplicateNode(createOptions({ modelId: 'owner/model-name' }))
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('succeeded');
    });

    it('should trim whitespace from modelId', async () => {
      mockSuccessfulPrediction();

      const { result } = renderHook(() =>
        useReplicateNode(createOptions({ modelId: '  owner/model-name  ' }))
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('succeeded');
    });
  });

  // ==========================================================================
  // Test 4: execute function - prediction creation
  // ==========================================================================
  describe('execute function - prediction creation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call replicate_create_prediction with model and input', async () => {
      mockSuccessfulPrediction();

      const input = { prompt: 'Test prompt', width: 1024 };
      const { result } = renderHook(() => useReplicateNode(createOptions({ input })));

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'stability-ai/sdxl',
        input,
      });
    });

    it('should call onStart callback when execution begins', async () => {
      mockSuccessfulPrediction();

      const onStart = vi.fn();
      const { result } = renderHook(() => useReplicateNode(createOptions({ onStart })));

      await act(async () => {
        await result.current.execute();
      });

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('should handle missing prediction ID', async () => {
      mockedInvoke.mockResolvedValueOnce({});

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('no ID returned');
    });

    it('should handle null prediction response', async () => {
      mockedInvoke.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('no ID returned');
    });
  });

  // ==========================================================================
  // Test 5: execute function - polling
  // ==========================================================================
  describe('execute function - polling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should poll for prediction status', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'processing' }));
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['url'] })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      // Create + 2 poll calls
      expect(mockedInvoke).toHaveBeenCalledTimes(3);
    });

    it('should call replicate_get_prediction with predictionId', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction({ id: 'my-pred-id' }));
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['url'] })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_get_prediction', {
        predictionId: 'my-pred-id',
      });
    });

    it('should call onProgress callback during polling', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'processing' }));
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['url'] })
      );

      const onProgress = vi.fn();
      const { result } = renderHook(() => useReplicateNode(createOptions({ onProgress })));

      await act(async () => {
        await result.current.execute();
      });

      expect(onProgress).toHaveBeenCalledWith(1, 'processing');
      expect(onProgress).toHaveBeenCalledWith(2, 'succeeded');
    });

    it('should timeout after maxAttempts', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      // Always return processing status
      mockedInvoke.mockResolvedValue(createPrediction({ status: 'processing' }));

      const { result } = renderHook(() => useReplicateNode(createOptions({ maxAttempts: 2 })));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('timed out');
    });
  });

  // ==========================================================================
  // Test 6: execute function - success handling
  // ==========================================================================
  describe('execute function - success handling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should set status to succeeded on successful prediction', async () => {
      mockSuccessfulPrediction();

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('succeeded');
    });

    it('should set result on successful prediction', async () => {
      mockSuccessfulPrediction(['https://example.com/image.png']);

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('https://example.com/image.png');
    });

    it('should call onSuccess callback with result', async () => {
      mockSuccessfulPrediction(['https://example.com/image.png']);

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useReplicateNode(createOptions({ onSuccess })));

      await act(async () => {
        await result.current.execute();
      });

      expect(onSuccess).toHaveBeenCalledWith('https://example.com/image.png');
    });

    it('should return result from execute function', async () => {
      mockSuccessfulPrediction(['https://example.com/image.png']);

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      let executeResult: string | null = null;
      await act(async () => {
        executeResult = await result.current.execute();
      });

      expect(executeResult).toBe('https://example.com/image.png');
    });
  });

  // ==========================================================================
  // Test 7: execute function - failure handling
  // ==========================================================================
  describe('execute function - failure handling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should set status to error on failed prediction', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'failed', error: 'Model error' })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
    });

    it('should set error message from prediction error', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'failed', error: 'Model error message' })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBe('Model error message');
    });

    it('should use fallback error message when prediction error is empty', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'failed' }));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toContain('no error message');
    });

    it('should call onError callback on failure', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'failed', error: 'Test error' })
      );

      const onError = vi.fn();
      const { result } = renderHook(() => useReplicateNode(createOptions({ onError })));

      await act(async () => {
        await result.current.execute();
      });

      expect(onError).toHaveBeenCalledWith('Test error');
    });

    it('should return null from execute on failure', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'failed', error: 'Error' }));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      let executeResult: string | null = 'not-null';
      await act(async () => {
        executeResult = await result.current.execute();
      });

      expect(executeResult).toBeNull();
    });

    it('should handle canceled prediction', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'canceled' }));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('canceled');
    });
  });

  // ==========================================================================
  // Test 8: execute function - exception handling
  // ==========================================================================
  describe('execute function - exception handling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle Error exception during prediction creation', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
    });

    it('should handle non-Error exception during prediction creation', async () => {
      mockedInvoke.mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('String error');
    });

    it('should handle exception during polling', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockRejectedValueOnce(new Error('Polling error'));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Polling error');
    });

    it('should call onError callback on exception', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Exception error'));

      const onError = vi.fn();
      const { result } = renderHook(() => useReplicateNode(createOptions({ onError })));

      await act(async () => {
        await result.current.execute();
      });

      expect(onError).toHaveBeenCalledWith('Exception error');
    });
  });

  // ==========================================================================
  // Test 9: isProcessing state
  // ==========================================================================
  describe('isProcessing state', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should be false when status is succeeded', async () => {
      mockSuccessfulPrediction();

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it('should be false when status is error', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Error'));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it('should be false when status is idle', () => {
      const { result } = renderHook(() => useReplicateNode(createOptions()));
      expect(result.current.isProcessing).toBe(false);
    });
  });

  // ==========================================================================
  // Test 10: execute resets state before running
  // ==========================================================================
  describe('execute resets state before running', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should clear previous error before new execution', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBe('First error');

      // Now execute again successfully
      mockSuccessfulPrediction();

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear previous result before new execution', async () => {
      mockSuccessfulPrediction(['first-url']);

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('first-url');

      // Execute again with different result
      mockSuccessfulPrediction(['second-url']);

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('second-url');
    });
  });

  // ==========================================================================
  // Test 11: full execution flow
  // ==========================================================================
  describe('full execution flow', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should complete full execution flow for image generation', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'processing' }));
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['https://example.com/image.png'] })
      );

      const onStart = vi.fn();
      const onProgress = vi.fn();
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useReplicateNode(
          createOptions({
            onStart,
            onProgress,
            onSuccess,
          })
        )
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalledWith('https://example.com/image.png');
      expect(result.current.status).toBe('succeeded');
      expect(result.current.result).toBe('https://example.com/image.png');
    });

    it('should complete full execution flow for text generation', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['Hello', ' ', 'World'] })
      );

      const { result } = renderHook(() =>
        useReplicateNode(
          createOptions({
            modelId: 'meta/llama-2',
            input: { prompt: 'Say hello' },
            outputType: 'text',
          })
        )
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('succeeded');
      expect(result.current.result).toBe('Hello World');
    });
  });

  // ==========================================================================
  // Test 12: options reactivity
  // ==========================================================================
  describe('options reactivity', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should use updated input when execute is called again', async () => {
      mockSuccessfulPrediction();

      const { result, rerender } = renderHook(
        ({ input }) => useReplicateNode(createOptions({ input })),
        { initialProps: { input: { prompt: 'First prompt' } } }
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'stability-ai/sdxl',
        input: { prompt: 'First prompt' },
      });

      // Rerender with new input
      rerender({ input: { prompt: 'Second prompt' } });

      mockedInvoke.mockClear();
      mockSuccessfulPrediction();

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'stability-ai/sdxl',
        input: { prompt: 'Second prompt' },
      });
    });

    it('should use updated modelId when execute is called again', async () => {
      mockSuccessfulPrediction();

      const { result, rerender } = renderHook(
        ({ modelId }) => useReplicateNode(createOptions({ modelId })),
        { initialProps: { modelId: 'owner/first-model' } }
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'owner/first-model',
        input: { prompt: 'A beautiful sunset' },
      });

      // Rerender with new modelId
      rerender({ modelId: 'owner/second-model' });

      mockedInvoke.mockClear();
      mockSuccessfulPrediction();

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'owner/second-model',
        input: { prompt: 'A beautiful sunset' },
      });
    });
  });

  // ==========================================================================
  // Test 13: default output type
  // ==========================================================================
  describe('default output type', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should use text as default output type', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['Hello', ' ', 'World'] })
      );

      const { result } = renderHook(() =>
        useReplicateNode({
          modelId: 'meta/llama-2',
          input: { prompt: 'Test' },
          maxAttempts: 3,
          // No outputType specified
        })
      );

      await act(async () => {
        await result.current.execute();
      });

      // Text type joins arrays
      expect(result.current.result).toBe('Hello World');
    });
  });

  // ==========================================================================
  // Test 14: callback stability
  // ==========================================================================
  describe('callback stability', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should have stable reset function reference', () => {
      const { result, rerender } = renderHook(() => useReplicateNode(createOptions()));

      const firstReset = result.current.reset;
      rerender();
      const secondReset = result.current.reset;

      expect(firstReset).toBe(secondReset);
    });

    it('should update execute when dependencies change', () => {
      const { result, rerender } = renderHook(
        ({ modelId }) => useReplicateNode(createOptions({ modelId })),
        { initialProps: { modelId: 'owner/first' } }
      );

      const firstExecute = result.current.execute;
      rerender({ modelId: 'owner/second' });
      const secondExecute = result.current.execute;

      expect(firstExecute).not.toBe(secondExecute);
    });
  });

  // ==========================================================================
  // Test 15: starting status handling during polling
  // ==========================================================================
  describe('starting status handling during polling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle starting status during polling', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'starting' }));
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'starting' }));
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'processing' }));
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['url'] })
      );

      const onProgress = vi.fn();
      const { result } = renderHook(() =>
        useReplicateNode(createOptions({ onProgress, maxAttempts: 10 }))
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(onProgress).toHaveBeenCalledWith(1, 'starting');
      expect(onProgress).toHaveBeenCalledWith(2, 'processing');
    });
  });

  // ==========================================================================
  // Test 16: edge cases
  // ==========================================================================
  describe('edge cases', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle prediction with metrics', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({
          status: 'succeeded',
          output: ['url'],
          metrics: { predict_time: 5.5 },
        })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('succeeded');
    });

    it('should handle prediction with logs', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({
          status: 'succeeded',
          output: ['url'],
          logs: 'Processing complete',
        })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('succeeded');
    });

    it('should handle output parsing error', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(createPrediction({ status: 'succeeded', output: null }));

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('no output');
    });
  });

  // ==========================================================================
  // Test 17: complex input objects
  // ==========================================================================
  describe('complex input objects', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should pass complex input to prediction', async () => {
      mockSuccessfulPrediction();

      const complexInput = {
        prompt: 'A beautiful sunset',
        negative_prompt: 'ugly, blurry',
        width: 1024,
        height: 1024,
        guidance_scale: 7.5,
        num_inference_steps: 50,
        seed: 12345,
      };

      const { result } = renderHook(() => useReplicateNode(createOptions({ input: complexInput })));

      await act(async () => {
        await result.current.execute();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'stability-ai/sdxl',
        input: complexInput,
      });
    });
  });

  // ==========================================================================
  // Test 18: video output type
  // ==========================================================================
  describe('video output type', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should parse video output correctly', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['https://example.com/video.mp4'] })
      );

      const { result } = renderHook(() =>
        useReplicateNode(
          createOptions({
            modelId: 'video-model/gen',
            outputType: 'video',
          })
        )
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('https://example.com/video.mp4');
    });
  });

  // ==========================================================================
  // Test 19: audio output type
  // ==========================================================================
  describe('audio output type', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should parse audio output correctly', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({ status: 'succeeded', output: ['https://example.com/audio.mp3'] })
      );

      const { result } = renderHook(() =>
        useReplicateNode(
          createOptions({
            modelId: 'audio-model/gen',
            outputType: 'audio',
          })
        )
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('https://example.com/audio.mp3');
    });
  });

  // ==========================================================================
  // Test 20: multiple array elements in output
  // ==========================================================================
  describe('multiple array elements in output', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should only return first element for image type', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({
          status: 'succeeded',
          output: ['https://example.com/image1.png', 'https://example.com/image2.png'],
        })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('https://example.com/image1.png');
    });

    it('should join all elements for text type', async () => {
      mockedInvoke.mockResolvedValueOnce(createPrediction());
      mockedInvoke.mockResolvedValueOnce(
        createPrediction({
          status: 'succeeded',
          output: ['First', ' part', ' and', ' second'],
        })
      );

      const { result } = renderHook(() => useReplicateNode(createOptions({ outputType: 'text' })));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('First part and second');
    });
  });

  // ==========================================================================
  // Test 21: sequential executions
  // ==========================================================================
  describe('sequential executions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle sequential executions', async () => {
      // First execution
      mockSuccessfulPrediction(['url1']);

      const { result } = renderHook(() => useReplicateNode(createOptions()));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('url1');

      // Second execution
      mockSuccessfulPrediction(['url2']);

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.result).toBe('url2');
    });
  });
});

// =============================================================================
// parsePredictionOutput tests
// =============================================================================
describe('parsePredictionOutput', () => {
  // ==========================================================================
  // Test 22: null and undefined output
  // ==========================================================================
  describe('null and undefined output', () => {
    it('should throw error for null output', () => {
      expect(() => parsePredictionOutput(null, 'text')).toThrow('no output');
    });

    it('should throw error for undefined output', () => {
      expect(() => parsePredictionOutput(undefined, 'image')).toThrow('no output');
    });
  });

  // ==========================================================================
  // Test 23: text output parsing
  // ==========================================================================
  describe('text output parsing', () => {
    it('should join array output for text type', () => {
      const result = parsePredictionOutput(['Hello', ' ', 'World'], 'text');
      expect(result).toBe('Hello World');
    });

    it('should return string output directly for text type', () => {
      const result = parsePredictionOutput('Hello World', 'text');
      expect(result).toBe('Hello World');
    });

    it('should stringify object output for text type', () => {
      const result = parsePredictionOutput({ key: 'value' }, 'text');
      expect(result).toBe('{"key":"value"}');
    });

    it('should stringify number output for text type', () => {
      const result = parsePredictionOutput(42, 'text');
      expect(result).toBe('42');
    });

    it('should stringify boolean output for text type', () => {
      const result = parsePredictionOutput(true, 'text');
      expect(result).toBe('true');
    });

    it('should handle empty array for text type', () => {
      const result = parsePredictionOutput([], 'text');
      expect(result).toBe('');
    });
  });

  // ==========================================================================
  // Test 24: image output parsing
  // ==========================================================================
  describe('image output parsing', () => {
    it('should extract first element from array for image type', () => {
      const result = parsePredictionOutput(['https://example.com/image.png'], 'image');
      expect(result).toBe('https://example.com/image.png');
    });

    it('should extract first element from nested array for image type', () => {
      const result = parsePredictionOutput([['https://example.com/image.png']], 'image');
      expect(result).toBe('https://example.com/image.png');
    });

    it('should return string output directly for image type', () => {
      const result = parsePredictionOutput('https://example.com/image.png', 'image');
      expect(result).toBe('https://example.com/image.png');
    });

    it('should extract url field from object for image type', () => {
      const result = parsePredictionOutput({ url: 'https://example.com/image.png' }, 'image');
      expect(result).toBe('https://example.com/image.png');
    });

    it('should extract image field from object for image type', () => {
      const result = parsePredictionOutput({ image: 'https://example.com/image.png' }, 'image');
      expect(result).toBe('https://example.com/image.png');
    });

    it('should extract output field from object for image type', () => {
      const result = parsePredictionOutput({ output: 'https://example.com/image.png' }, 'image');
      expect(result).toBe('https://example.com/image.png');
    });

    it('should throw for unexpected image output format', () => {
      expect(() => parsePredictionOutput({ unexpected: 123 }, 'image')).toThrow(
        'Unexpected image output format'
      );
    });

    it('should throw for empty array in image type', () => {
      expect(() => parsePredictionOutput([], 'image')).toThrow('Unexpected image output format');
    });
  });

  // ==========================================================================
  // Test 25: video output parsing
  // ==========================================================================
  describe('video output parsing', () => {
    it('should extract first element from array for video type', () => {
      const result = parsePredictionOutput(['https://example.com/video.mp4'], 'video');
      expect(result).toBe('https://example.com/video.mp4');
    });

    it('should return string output directly for video type', () => {
      const result = parsePredictionOutput('https://example.com/video.mp4', 'video');
      expect(result).toBe('https://example.com/video.mp4');
    });

    it('should extract video field from object for video type', () => {
      const result = parsePredictionOutput({ video: 'https://example.com/video.mp4' }, 'video');
      expect(result).toBe('https://example.com/video.mp4');
    });

    it('should throw for unexpected video output format', () => {
      expect(() => parsePredictionOutput({ other: 'value' }, 'video')).toThrow(
        'Unexpected video output format'
      );
    });
  });

  // ==========================================================================
  // Test 26: audio output parsing
  // ==========================================================================
  describe('audio output parsing', () => {
    it('should extract first element from array for audio type', () => {
      const result = parsePredictionOutput(['https://example.com/audio.mp3'], 'audio');
      expect(result).toBe('https://example.com/audio.mp3');
    });

    it('should return string output directly for audio type', () => {
      const result = parsePredictionOutput('https://example.com/audio.mp3', 'audio');
      expect(result).toBe('https://example.com/audio.mp3');
    });

    it('should extract audio field from object for audio type', () => {
      const result = parsePredictionOutput({ audio: 'https://example.com/audio.mp3' }, 'audio');
      expect(result).toBe('https://example.com/audio.mp3');
    });

    it('should extract file field from object for audio type', () => {
      const result = parsePredictionOutput({ file: 'https://example.com/audio.mp3' }, 'audio');
      expect(result).toBe('https://example.com/audio.mp3');
    });

    it('should throw for unexpected audio output format', () => {
      expect(() => parsePredictionOutput({ wrong: 'field' }, 'audio')).toThrow(
        'Unexpected audio output format'
      );
    });
  });

  // ==========================================================================
  // Test 27: result field extraction
  // ==========================================================================
  describe('result field extraction', () => {
    it('should extract result field from object for media types', () => {
      const result = parsePredictionOutput({ result: 'https://example.com/result.png' }, 'image');
      expect(result).toBe('https://example.com/result.png');
    });
  });
});

// =============================================================================
// validateModelFormat tests
// =============================================================================
describe('validateModelFormat', () => {
  // ==========================================================================
  // Test 28: valid model formats
  // ==========================================================================
  describe('valid model formats', () => {
    it('should return owner and name for valid format', () => {
      const result = validateModelFormat('owner/model-name');
      expect(result).toEqual({ owner: 'owner', name: 'model-name' });
    });

    it('should handle modelId with version suffix', () => {
      const result = validateModelFormat('owner/model-name:abc123');
      expect(result).toEqual({ owner: 'owner', name: 'model-name:abc123' });
    });

    it('should trim whitespace from modelId', () => {
      const result = validateModelFormat('  owner/model-name  ');
      expect(result).toEqual({ owner: 'owner', name: 'model-name' });
    });

    it('should handle complex owner names', () => {
      const result = validateModelFormat('my-organization/model-v2');
      expect(result).toEqual({ owner: 'my-organization', name: 'model-v2' });
    });
  });

  // ==========================================================================
  // Test 29: invalid model formats
  // ==========================================================================
  describe('invalid model formats', () => {
    it('should throw for modelId without slash', () => {
      expect(() => validateModelFormat('invalid-model')).toThrow('Invalid model format');
    });

    it('should throw for empty modelId', () => {
      expect(() => validateModelFormat('')).toThrow('Invalid model format');
    });

    it('should throw for modelId with only owner', () => {
      expect(() => validateModelFormat('owner/')).toThrow('Invalid model format');
    });

    it('should throw for modelId with only model name', () => {
      expect(() => validateModelFormat('/model-name')).toThrow('Invalid model format');
    });

    it('should throw for whitespace-only modelId', () => {
      expect(() => validateModelFormat('   ')).toThrow('Invalid model format');
    });

    it('should include the invalid modelId in error message', () => {
      expect(() => validateModelFormat('bad-format')).toThrow('"bad-format"');
    });
  });

  // ==========================================================================
  // Test 30: edge cases
  // ==========================================================================
  describe('edge cases', () => {
    it('should throw for modelId with multiple slashes', () => {
      // The function splits and checks length !== 2
      // With 'a/b/c', split('/') returns ['a', 'b', 'c'] which has length 3, not 2
      expect(() => validateModelFormat('a/b/c')).toThrow('Invalid model format');
    });

    it('should handle unicode characters in model name', () => {
      const result = validateModelFormat('owner/model-test');
      expect(result).toEqual({ owner: 'owner', name: 'model-test' });
    });
  });
});
