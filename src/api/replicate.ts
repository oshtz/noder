/**
 * Replicate API Client
 *
 * Centralized module for all Replicate API operations.
 * Provides consistent error handling, logging, and retry logic.
 */

import { invoke } from '../types/tauri';
import { logApiError } from '../utils/errorLogger';
import type { ReplicatePrediction, ReplicateModel, ReplicateModelsResponse } from '../types/tauri';

// =============================================================================
// Constants
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// Types
// =============================================================================

/** Options for retry wrapper */
export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  operation?: string;
}

/** Options for polling a prediction */
export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: ((progress: PollProgress) => void) | null;
}

/** Progress callback data for polling */
export interface PollProgress {
  attempts: number;
  maxAttempts: number;
  status: ReplicatePrediction['status'];
}

/** Options for listing models */
export interface ListModelsOptions {
  cursor?: string;
}

/** Output types for prediction parsing */
export type PredictionOutputType = 'text' | 'image' | 'video' | 'audio';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Delay helper for retries
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if an error is a client error (4xx) that shouldn't be retried
 */
function isClientError(error: Error): boolean {
  const message = error.message || '';
  return (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404')
  );
}

/**
 * Generic retry wrapper for API calls
 */
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = MAX_RETRIES, retryDelay = RETRY_DELAY_MS, operation = 'api_call' } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (4xx)
      if (isClientError(lastError)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        console.warn(
          `[Replicate API] ${operation} failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`
        );
        await delay(retryDelay * attempt); // Exponential backoff
      }
    }
  }

  // Log the final error
  if (lastError) {
    logApiError(lastError, operation, { attempts: maxRetries });
    throw lastError;
  }

  // This shouldn't happen, but TypeScript needs it
  throw new Error(`${operation} failed after ${maxRetries} attempts`);
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Create a new prediction
 *
 * @param model - Model identifier (owner/name or version)
 * @param input - Input parameters for the model
 * @returns Prediction object with id and status
 */
export async function createPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  return withRetry(() => invoke('replicate_create_prediction', { model, input }), {
    operation: 'replicate_create_prediction',
  });
}

/**
 * Get prediction status and results
 *
 * @param predictionId - The prediction ID to check
 * @returns Prediction object with status and output
 */
export async function getPrediction(predictionId: string): Promise<ReplicatePrediction> {
  return withRetry(() => invoke('replicate_get_prediction', { predictionId }), {
    operation: 'replicate_get_prediction',
    maxRetries: 2,
  });
}

/**
 * Poll a prediction until it completes
 *
 * @param predictionId - The prediction ID to poll
 * @param options - Polling options
 * @returns Final prediction object
 */
export async function pollPrediction(
  predictionId: string,
  options: PollOptions = {}
): Promise<ReplicatePrediction> {
  const { maxAttempts = 120, intervalMs = 1000, onProgress = null } = options;

  let currentPrediction = await getPrediction(predictionId);
  let attempts = 0;

  while (
    currentPrediction.status !== 'succeeded' &&
    currentPrediction.status !== 'failed' &&
    currentPrediction.status !== 'canceled' &&
    attempts < maxAttempts
  ) {
    await delay(intervalMs);
    currentPrediction = await getPrediction(predictionId);
    attempts++;

    if (onProgress && attempts % 10 === 0) {
      onProgress({ attempts, maxAttempts, status: currentPrediction.status });
    }
  }

  return currentPrediction;
}

/**
 * Run a prediction and wait for results
 *
 * @param model - Model identifier
 * @param input - Input parameters
 * @param options - Execution options
 * @returns Final prediction with results
 */
export async function runPrediction(
  model: string,
  input: Record<string, unknown>,
  options: PollOptions = {}
): Promise<ReplicatePrediction> {
  const prediction = await createPrediction(model, input);
  return pollPrediction(prediction.id, options);
}

/**
 * Upload a file to Replicate
 *
 * @param filePath - Local file path to upload
 * @param filename - Original filename
 * @param contentType - MIME content type
 * @returns Upload response with file URL
 */
export async function uploadFile(
  filePath: string,
  filename: string,
  contentType: string
): Promise<{ id: string; urls: { get: string } }> {
  return withRetry(() => invoke('replicate_upload_file', { filePath, filename, contentType }), {
    operation: 'replicate_upload_file',
  });
}

/**
 * Delete a file from Replicate
 *
 * @param fileId - The file ID to delete
 */
export async function deleteFile(fileId: string): Promise<void> {
  return withRetry(() => invoke('replicate_delete_file', { fileId }), {
    operation: 'replicate_delete_file',
    maxRetries: 2,
  });
}

/**
 * List available models
 *
 * @param options - List options
 * @returns Models list with pagination info
 */
export async function listModels(
  options: ListModelsOptions = {}
): Promise<ReplicateModelsResponse> {
  const { cursor } = options;
  return withRetry(() => invoke('replicate_list_models', { cursor }), {
    operation: 'replicate_list_models',
  });
}

/**
 * Get model details and schema
 *
 * @param owner - Model owner
 * @param name - Model name
 * @returns Model details including schema
 */
export async function getModel(owner: string, name: string): Promise<ReplicateModel> {
  return withRetry(() => invoke('replicate_get_model', { owner, name }), {
    operation: 'replicate_get_model',
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse prediction output based on expected type
 *
 * @param prediction - Completed prediction object
 * @param outputType - Expected output type (text, image, video, audio)
 * @returns Parsed output value
 */
export function parsePredictionOutput(
  prediction: ReplicatePrediction,
  outputType: PredictionOutputType
): unknown {
  if (prediction.status !== 'succeeded') {
    return null;
  }

  const output = prediction.output;

  if (Array.isArray(output) && output.length > 0) {
    if (outputType === 'text') {
      return output.join('');
    }
    return output[0];
  }

  if (typeof output === 'string') {
    return output;
  }

  if (outputType === 'text') {
    return JSON.stringify(output);
  }

  return output;
}

/**
 * Check if a prediction is complete (succeeded, failed, or canceled)
 */
export function isPredictionComplete(prediction: ReplicatePrediction): boolean {
  return ['succeeded', 'failed', 'canceled'].includes(prediction.status);
}

/**
 * Check if a prediction succeeded
 */
export function isPredictionSucceeded(prediction: ReplicatePrediction): boolean {
  return prediction.status === 'succeeded';
}

/**
 * Check if a prediction failed
 */
export function isPredictionFailed(prediction: ReplicatePrediction): boolean {
  return prediction.status === 'failed';
}
