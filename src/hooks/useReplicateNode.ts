import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types
// =============================================================================

export interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string;
  logs?: string;
  metrics?: {
    predict_time?: number;
  };
}

export interface UseReplicateNodeOptions {
  /** Replicate model ID (e.g., "owner/model-name") */
  modelId: string;
  /** Input parameters for the model */
  input: Record<string, unknown>;
  /** Maximum polling attempts before timeout (default: 120 = 2 minutes) */
  maxAttempts?: number;
  /** Interval between log messages (default: 10, logs every 10 attempts) */
  logInterval?: number;
  /** Output type for proper parsing: 'text', 'image', 'video', 'audio' */
  outputType?: 'text' | 'image' | 'video' | 'audio';
  /** Called with progress updates during polling */
  onProgress?: (attempts: number, status: string) => void;
  /** Called when prediction starts */
  onStart?: () => void;
  /** Called when prediction completes successfully */
  onSuccess?: (result: string) => void;
  /** Called when prediction fails */
  onError?: (error: string) => void;
}

export interface UseReplicateNodeReturn {
  /** Current prediction status */
  status: 'idle' | 'starting' | 'processing' | 'succeeded' | 'failed' | 'error';
  /** Error message if failed */
  error: string | null;
  /** Result output from the prediction */
  result: string | null;
  /** Whether a prediction is currently running */
  isProcessing: boolean;
  /** Execute the prediction */
  execute: () => Promise<string | null>;
  /** Reset state to idle */
  reset: () => void;
}

// =============================================================================
// Output Parsing Utilities
// =============================================================================

/**
 * Parse prediction output based on expected type
 */
export function parsePredictionOutput(
  output: unknown,
  outputType: 'text' | 'image' | 'video' | 'audio'
): string {
  if (output === null || output === undefined) {
    throw new Error('Prediction returned no output');
  }

  // Text output - join arrays, stringify objects
  if (outputType === 'text') {
    if (Array.isArray(output)) {
      return output.join('');
    }
    if (typeof output === 'string') {
      return output;
    }
    return JSON.stringify(output);
  }

  // Media outputs (image, video, audio) - extract URL
  if (Array.isArray(output) && output.length > 0) {
    // Handle nested arrays (some models return [[url]])
    const firstItem = output[0];
    if (Array.isArray(firstItem) && firstItem.length > 0) {
      return String(firstItem[0]);
    }
    return String(firstItem);
  }

  if (typeof output === 'string') {
    return output;
  }

  // Check for common output field names
  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, unknown>;
    for (const key of ['url', 'output', 'result', 'file', 'video', 'audio', 'image']) {
      if (typeof obj[key] === 'string') {
        return obj[key] as string;
      }
    }
  }

  throw new Error(`Unexpected ${outputType} output format: ${JSON.stringify(output)}`);
}

/**
 * Validate model format (owner/model-name)
 */
export function validateModelFormat(modelId: string): { owner: string; name: string } {
  const trimmed = modelId.trim();
  const parts = trimmed.split('/');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid model format: "${modelId}". Expected "owner/model-name" format.`);
  }

  return { owner: parts[0], name: parts[1] };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useReplicateNode - Shared hook for Replicate API prediction execution
 *
 * Centralizes the common polling logic used across ImageNode, TextNode,
 * VideoNode, and AudioNode components.
 *
 * @example
 * ```tsx
 * const { execute, status, result, error, isProcessing } = useReplicateNode({
 *   modelId: 'stability-ai/sdxl',
 *   input: { prompt: 'A beautiful sunset' },
 *   outputType: 'image',
 *   maxAttempts: 120,
 *   onSuccess: (url) => setImageUrl(url),
 * });
 *
 * // Trigger execution
 * await execute();
 * ```
 */
export function useReplicateNode(options: UseReplicateNodeOptions): UseReplicateNodeReturn {
  const {
    modelId,
    input,
    maxAttempts = 120,
    logInterval = 10,
    outputType = 'text',
    onProgress,
    onStart,
    onSuccess,
    onError,
  } = options;

  const [status, setStatus] = useState<UseReplicateNodeReturn['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setResult(null);
  }, []);

  const execute = useCallback(async (): Promise<string | null> => {
    try {
      // Validate model format
      validateModelFormat(modelId);

      // Reset state
      setError(null);
      setResult(null);
      setStatus('starting');
      onStart?.();

      // Create prediction
      const prediction = (await invoke('replicate_create_prediction', {
        model: modelId,
        input,
      })) as Prediction;

      if (!prediction || !prediction.id) {
        throw new Error('Failed to create prediction - no ID returned');
      }

      console.log(`Created prediction ${prediction.id} for model ${modelId}`);

      // Poll for completion
      let currentPrediction = prediction;
      let attempts = 0;

      while (
        currentPrediction.status !== 'succeeded' &&
        currentPrediction.status !== 'failed' &&
        currentPrediction.status !== 'canceled' &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        currentPrediction = (await invoke('replicate_get_prediction', {
          predictionId: currentPrediction.id,
        })) as Prediction;

        attempts++;
        setStatus(currentPrediction.status === 'starting' ? 'starting' : 'processing');

        // Log progress at intervals
        if (attempts % logInterval === 0) {
          console.log(`Polling attempt ${attempts}/${maxAttempts}: ${currentPrediction.status}`);
        }

        onProgress?.(attempts, currentPrediction.status);
      }

      // Handle final status
      if (currentPrediction.status === 'succeeded') {
        const output = parsePredictionOutput(currentPrediction.output, outputType);
        setResult(output);
        setStatus('succeeded');
        onSuccess?.(output);
        console.log(`Prediction succeeded: ${output.substring(0, 100)}...`);
        return output;
      } else if (currentPrediction.status === 'failed') {
        const errorMsg = currentPrediction.error || 'Prediction failed with no error message';
        throw new Error(errorMsg);
      } else if (currentPrediction.status === 'canceled') {
        throw new Error('Prediction was canceled');
      } else {
        throw new Error(`Prediction timed out after ${maxAttempts} seconds`);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`Replicate prediction error for ${modelId}:`, errorMessage);
      setError(errorMessage);
      setStatus('error');
      onError?.(errorMessage);
      return null;
    }
  }, [
    modelId,
    input,
    maxAttempts,
    logInterval,
    outputType,
    onStart,
    onSuccess,
    onError,
    onProgress,
  ]);

  return {
    status,
    error,
    result,
    isProcessing: status === 'starting' || status === 'processing',
    execute,
    reset,
  };
}

export default useReplicateNode;
