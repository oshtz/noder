/**
 * Tests for Replicate API client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePredictionOutput,
  isPredictionComplete,
  isPredictionSucceeded,
  isPredictionFailed,
  createPrediction,
  getPrediction,
  pollPrediction,
  runPrediction,
  uploadFile,
  deleteFile,
  listModels,
  getModel,
} from './replicate';
import { invoke } from '../types/tauri';
import type { ReplicatePrediction } from '../types/tauri';

// Mock the tauri invoke
vi.mock('../types/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock error logger
vi.mock('../utils/errorLogger', () => ({
  logApiError: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe('replicate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parsePredictionOutput', () => {
    it('returns null for non-succeeded prediction', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'processing',
        output: null,
      };

      expect(parsePredictionOutput(prediction, 'text')).toBeNull();
    });

    it('returns null for failed prediction', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'failed',
        output: null,
        error: 'Something went wrong',
      };

      expect(parsePredictionOutput(prediction, 'image')).toBeNull();
    });

    it('joins array output for text type', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: ['Hello', ' ', 'World'],
      };

      expect(parsePredictionOutput(prediction, 'text')).toBe('Hello World');
    });

    it('returns first element for non-text array output', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: ['https://example.com/image1.png', 'https://example.com/image2.png'],
      };

      expect(parsePredictionOutput(prediction, 'image')).toBe('https://example.com/image1.png');
    });

    it('returns string output directly', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: 'https://example.com/video.mp4',
      };

      expect(parsePredictionOutput(prediction, 'video')).toBe('https://example.com/video.mp4');
    });

    it('JSON stringifies object output for text type', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: { key: 'value', nested: { data: true } },
      };

      const result = parsePredictionOutput(prediction, 'text');
      expect(result).toBe(JSON.stringify({ key: 'value', nested: { data: true } }));
    });

    it('returns object output directly for non-text type', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: { url: 'https://example.com/file.mp3' },
      };

      expect(parsePredictionOutput(prediction, 'audio')).toEqual({
        url: 'https://example.com/file.mp3',
      });
    });

    it('handles empty array output', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: [],
      };

      // Empty array doesn't have output[0]
      expect(parsePredictionOutput(prediction, 'image')).toEqual([]);
    });

    it('handles null output for succeeded prediction', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: null,
      };

      // When output is null, text type will JSON.stringify it to "null" string
      // For non-text types, it returns the raw null value
      expect(parsePredictionOutput(prediction, 'image')).toBeNull();
    });
  });

  describe('isPredictionComplete', () => {
    it('returns true for succeeded status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: 'result',
      };

      expect(isPredictionComplete(prediction)).toBe(true);
    });

    it('returns true for failed status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'failed',
        output: null,
        error: 'Error message',
      };

      expect(isPredictionComplete(prediction)).toBe(true);
    });

    it('returns true for canceled status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'canceled',
        output: null,
      };

      expect(isPredictionComplete(prediction)).toBe(true);
    });

    it('returns false for starting status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'starting',
        output: null,
      };

      expect(isPredictionComplete(prediction)).toBe(false);
    });

    it('returns false for processing status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'processing',
        output: null,
      };

      expect(isPredictionComplete(prediction)).toBe(false);
    });
  });

  describe('isPredictionSucceeded', () => {
    it('returns true for succeeded status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: 'result',
      };

      expect(isPredictionSucceeded(prediction)).toBe(true);
    });

    it('returns false for failed status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'failed',
        output: null,
      };

      expect(isPredictionSucceeded(prediction)).toBe(false);
    });

    it('returns false for processing status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'processing',
        output: null,
      };

      expect(isPredictionSucceeded(prediction)).toBe(false);
    });

    it('returns false for canceled status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'canceled',
        output: null,
      };

      expect(isPredictionSucceeded(prediction)).toBe(false);
    });
  });

  describe('isPredictionFailed', () => {
    it('returns true for failed status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'failed',
        output: null,
        error: 'Error message',
      };

      expect(isPredictionFailed(prediction)).toBe(true);
    });

    it('returns false for succeeded status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'succeeded',
        output: 'result',
      };

      expect(isPredictionFailed(prediction)).toBe(false);
    });

    it('returns false for processing status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'processing',
        output: null,
      };

      expect(isPredictionFailed(prediction)).toBe(false);
    });

    it('returns false for canceled status', () => {
      const prediction: ReplicatePrediction = {
        id: 'pred-1',
        status: 'canceled',
        output: null,
      };

      expect(isPredictionFailed(prediction)).toBe(false);
    });
  });

  // =========================================================================
  // Async API Function Tests
  // =========================================================================

  describe('createPrediction', () => {
    it('should call invoke with correct parameters', async () => {
      const mockPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'starting',
        output: null,
      };
      mockInvoke.mockResolvedValueOnce(mockPrediction);

      const result = await createPrediction('owner/model', { prompt: 'test' });

      expect(mockInvoke).toHaveBeenCalledWith('replicate_create_prediction', {
        model: 'owner/model',
        input: { prompt: 'test' },
      });
      expect(result).toEqual(mockPrediction);
    });

    it('should throw on invoke failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('400 Bad Request'));

      await expect(createPrediction('invalid', {})).rejects.toThrow('400 Bad Request');
    });
  });

  describe('getPrediction', () => {
    it('should call invoke with prediction ID', async () => {
      const mockPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'result',
      };
      mockInvoke.mockResolvedValueOnce(mockPrediction);

      const result = await getPrediction('pred-123');

      expect(mockInvoke).toHaveBeenCalledWith('replicate_get_prediction', {
        predictionId: 'pred-123',
      });
      expect(result).toEqual(mockPrediction);
    });
  });

  describe('pollPrediction', () => {
    it('should return immediately if prediction is already succeeded', async () => {
      const completedPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'result',
      };
      mockInvoke.mockResolvedValue(completedPrediction);

      const result = await pollPrediction('pred-123', { intervalMs: 1 });

      expect(result.status).toBe('succeeded');
    });

    it('should return immediately if prediction failed', async () => {
      const failedPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'failed',
        output: null,
        error: 'Error',
      };
      mockInvoke.mockResolvedValue(failedPrediction);

      const result = await pollPrediction('pred-123', { intervalMs: 1 });

      expect(result.status).toBe('failed');
    });

    it('should poll until prediction completes', async () => {
      const processingPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'processing',
        output: null,
      };
      const completedPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'result',
      };

      mockInvoke
        .mockResolvedValueOnce(processingPrediction)
        .mockResolvedValueOnce(completedPrediction);

      const result = await pollPrediction('pred-123', {
        intervalMs: 1,
        maxAttempts: 5,
      });

      expect(result.status).toBe('succeeded');
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should call onProgress callback periodically', async () => {
      const processingPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'processing',
        output: null,
      };
      const completedPrediction: ReplicatePrediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'result',
      };

      // Return processing 11 times, then succeeded
      const responses = Array(11).fill(processingPrediction).concat(completedPrediction);
      responses.forEach((resp) => mockInvoke.mockResolvedValueOnce(resp));

      const onProgress = vi.fn();
      await pollPrediction('pred-123', {
        intervalMs: 1,
        maxAttempts: 20,
        onProgress,
      });

      // onProgress should be called at attempt 10
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('runPrediction', () => {
    it('should create and poll prediction', async () => {
      const newPrediction: ReplicatePrediction = {
        id: 'pred-new',
        status: 'starting',
        output: null,
      };
      const completedPrediction: ReplicatePrediction = {
        id: 'pred-new',
        status: 'succeeded',
        output: 'result',
      };

      mockInvoke
        .mockResolvedValueOnce(newPrediction) // createPrediction
        .mockResolvedValueOnce(completedPrediction); // getPrediction

      const result = await runPrediction('owner/model', { prompt: 'test' }, { intervalMs: 1 });

      expect(result.status).toBe('succeeded');
      expect(mockInvoke).toHaveBeenNthCalledWith(
        1,
        'replicate_create_prediction',
        expect.any(Object)
      );
    });
  });

  describe('uploadFile', () => {
    it('should call invoke with file parameters', async () => {
      const mockResponse = {
        id: 'file-123',
        urls: { get: 'https://files.replicate.com/file-123' },
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await uploadFile('/path/to/file.png', 'file.png', 'image/png');

      expect(mockInvoke).toHaveBeenCalledWith('replicate_upload_file', {
        filePath: '/path/to/file.png',
        filename: 'file.png',
        contentType: 'image/png',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteFile', () => {
    it('should call invoke with file ID', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await deleteFile('file-123');

      expect(mockInvoke).toHaveBeenCalledWith('replicate_delete_file', {
        fileId: 'file-123',
      });
    });
  });

  describe('listModels', () => {
    it('should call invoke without cursor by default', async () => {
      const mockResponse = {
        models: [{ owner: 'test', name: 'model1' }],
        next: null,
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await listModels();

      expect(mockInvoke).toHaveBeenCalledWith('replicate_list_models', {
        cursor: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should call invoke with cursor for pagination', async () => {
      const mockResponse = {
        models: [{ owner: 'test', name: 'model2' }],
        next: 'cursor-2',
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await listModels({ cursor: 'cursor-1' });

      expect(mockInvoke).toHaveBeenCalledWith('replicate_list_models', {
        cursor: 'cursor-1',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getModel', () => {
    it('should call invoke with owner and name', async () => {
      const mockModel = {
        owner: 'stability-ai',
        name: 'sdxl',
        description: 'A text-to-image model',
      };
      mockInvoke.mockResolvedValueOnce(mockModel);

      const result = await getModel('stability-ai', 'sdxl');

      expect(mockInvoke).toHaveBeenCalledWith('replicate_get_model', {
        owner: 'stability-ai',
        name: 'sdxl',
      });
      expect(result).toEqual(mockModel);
    });
  });
});
