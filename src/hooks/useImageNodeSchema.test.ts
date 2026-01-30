import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock modules before imports
vi.mock('../utils/replicateSchemaCache', () => ({
  fetchModelSchema: vi.fn(),
  clearSchemaCache: vi.fn(),
}));

vi.mock('../utils/schemaFieldBuilder', () => ({
  buildDynamicFieldsFromSchema: vi.fn(() => []),
  mergeDefinitionFields: vi.fn((base, dynamic) => [...(base || []), ...(dynamic || [])]),
}));

import { useImageNodeSchema } from './useImageNodeSchema';

// Import after mocks are set up
import { fetchModelSchema, clearSchemaCache } from '../utils/replicateSchemaCache';
import {
  buildDynamicFieldsFromSchema,
  mergeDefinitionFields,
  type DynamicField,
  type ModelSchema,
} from '../utils/schemaFieldBuilder';
import type { ImageFormState } from '../types/imageNode';

// Simple type for mock definition (avoiding heavy zod imports from nodeSchemas)
interface MockNodeDefinition {
  type: string;
  title: string;
  fields: Array<{ key: string; label: string; type: string }>;
  handles: unknown[];
  allowPassthrough?: boolean;
}

const mockedFetchModelSchema = vi.mocked(fetchModelSchema);
const mockedClearSchemaCache = vi.mocked(clearSchemaCache);
const mockedBuildDynamicFieldsFromSchema = vi.mocked(buildDynamicFieldsFromSchema);
const mockedMergeDefinitionFields = vi.mocked(mergeDefinitionFields);

// Helper to create mock definition
const createMockDefinition = (overrides: Partial<MockNodeDefinition> = {}): MockNodeDefinition =>
  ({
    type: 'image',
    title: 'Image Generation',
    fields: [
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'prompt', label: 'Prompt', type: 'textarea' },
    ],
    handles: [],
    ...overrides,
  }) as MockNodeDefinition;

// Helper to create mock schema
const createMockSchema = (inputs: Record<string, unknown> = {}): ModelSchema => ({
  inputs: {
    prompt: { type: 'string', description: 'Image prompt' },
    width: { type: 'integer', default: 1024 },
    height: { type: 'integer', default: 1024 },
    ...inputs,
  },
});

// Helper to create mock dynamic fields
const createMockDynamicFields = (fields: Partial<DynamicField>[] = []): DynamicField[] =>
  fields.map((f, i) => ({
    key: f.key || `field_${i}`,
    label: f.label || `Field ${i}`,
    type: f.type || 'text',
    ...f,
  }));

// Shared stable objects for tests - IMPORTANT: These must be stable references
// to avoid infinite re-render loops in the hook's useEffect
const _STABLE_DEFINITION = createMockDefinition();
const _STABLE_FORM_STATE: ImageFormState = { model: '' };
const _STABLE_DATA: Record<string, unknown> = {};

describe('useImageNodeSchema', () => {
  let mockSetFormState: ReturnType<typeof vi.fn>;
  let _stableDefinition: MockNodeDefinition;
  let _stableFormState: ImageFormState;
  let _stableData: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetFormState = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater({});
      }
      return updater;
    });
    // Reset stable objects for each test
    _stableDefinition = createMockDefinition();
    _stableFormState = { model: '' };
    _stableData = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Test 1: Initial state with no modelId
  // ==========================================================================
  describe('initial state with no modelId', () => {
    it('should return idle status when modelId is empty', () => {
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: '',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      expect(result.current.schemaStatus).toBe('idle');
      expect(result.current.dynamicFields).toEqual([]);
      expect(result.current.schemaError).toBeNull();
    });

    it('should not fetch schema when modelId is empty', () => {
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: '',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      expect(mockedFetchModelSchema).not.toHaveBeenCalled();
    });

    it('should return base definition as activeDefinition when no dynamic fields', () => {
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: '',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      expect(result.current.activeDefinition).toBe(definition);
    });
  });

  // ==========================================================================
  // Test 2: Fetching schema when modelId is provided
  // ==========================================================================
  describe('fetching schema when modelId is provided', () => {
    it('should call fetchModelSchema with the provided modelId', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/model-name');
      });
    });

    it('should trim modelId before fetching', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: '  owner/model-name  ',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/model-name');
      });
    });
  });

  // ==========================================================================
  // Test 3: Setting schemaStatus to 'loading' during fetch
  // ==========================================================================
  describe('setting schemaStatus to loading during fetch', () => {
    it('should set status to loading when fetch begins', async () => {
      let resolvePromise: (value: ModelSchema) => void;
      const fetchPromise = new Promise<ModelSchema>((resolve) => {
        resolvePromise = resolve;
      });
      mockedFetchModelSchema.mockReturnValueOnce(fetchPromise as never);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loading');
      });

      // Resolve to clean up
      act(() => {
        resolvePromise!(createMockSchema());
      });
    });

    it('should clear schemaError when starting a new fetch', async () => {
      // First, trigger an error
      mockedFetchModelSchema.mockRejectedValueOnce(new Error('First error'));

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ modelId }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/model-1' } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('error');
        expect(result.current.schemaError).toBe('First error');
      });

      // Now trigger a new fetch
      let resolvePromise: (value: ModelSchema) => void;
      const fetchPromise = new Promise<ModelSchema>((resolve) => {
        resolvePromise = resolve;
      });
      mockedFetchModelSchema.mockReturnValueOnce(fetchPromise as never);

      rerender({ modelId: 'owner/model-2' });

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loading');
        expect(result.current.schemaError).toBeNull();
      });

      // Resolve to clean up
      act(() => {
        resolvePromise!(createMockSchema());
      });
    });
  });

  // ==========================================================================
  // Test 4: Setting schemaStatus to 'loaded' on success
  // ==========================================================================
  describe('setting schemaStatus to loaded on success', () => {
    it('should set status to loaded after successful fetch', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });
    });

    it('should call buildDynamicFieldsFromSchema with fetched schema', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(mockedBuildDynamicFieldsFromSchema).toHaveBeenCalledWith(mockSchema);
      });
    });
  });

  // ==========================================================================
  // Test 5: Setting schemaStatus to 'error' on failure
  // ==========================================================================
  describe('setting schemaStatus to error on failure', () => {
    it('should set status to error when fetch fails', async () => {
      mockedFetchModelSchema.mockRejectedValueOnce(new Error('Network error'));

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('error');
      });
    });

    it('should set schemaError message from error', async () => {
      mockedFetchModelSchema.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaError).toBe('API rate limit exceeded');
      });
    });

    it('should use fallback error message when error has no message', async () => {
      mockedFetchModelSchema.mockRejectedValueOnce({});

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaError).toBe('Failed to load model schema.');
      });
    });

    it('should clear dynamicFields on error', async () => {
      // First, successfully load some fields
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_field' }]);
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ modelId }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/model-1' } }
      );

      await waitFor(() => {
        expect(result.current.dynamicFields).toEqual(mockFields);
      });

      // Now trigger an error
      mockedFetchModelSchema.mockRejectedValueOnce(new Error('Failed'));

      rerender({ modelId: 'owner/model-2' });

      await waitFor(() => {
        expect(result.current.dynamicFields).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // Test 6: Building dynamicFields from schema
  // ==========================================================================
  describe('building dynamicFields from schema', () => {
    it('should update dynamicFields with result from buildDynamicFieldsFromSchema', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
        { key: 'height', label: 'Height', type: 'number', default: 1024 },
        { key: 'guidance_scale', label: 'Guidance Scale', type: 'number', default: 7.5 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.dynamicFields).toEqual(mockFields);
      });
    });

    it('should handle empty dynamic fields', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
        expect(result.current.dynamicFields).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // Test 7: Applying default values to formState
  // ==========================================================================
  describe('applying default values to formState', () => {
    it('should apply default values from dynamic fields to formState', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
        { key: 'guidance_scale', label: 'Guidance Scale', type: 'number', default: 7.5 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(mockSetFormState).toHaveBeenCalled();
      });
    });

    it('should apply default values for undefined formState keys', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const capturedUpdates: ImageFormState[] = [];
      const setFormStateMock = vi.fn((updater) => {
        const result = typeof updater === 'function' ? updater({}) : updater;
        capturedUpdates.push(result);
        return result;
      });

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: setFormStateMock,
          data,
        })
      );

      await waitFor(() => {
        expect(setFormStateMock).toHaveBeenCalled();
        const lastUpdate = capturedUpdates[capturedUpdates.length - 1];
        expect(lastUpdate.width).toBe(1024);
      });
    });

    it('should apply default values for null formState keys', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const capturedUpdates: ImageFormState[] = [];
      const setFormStateMock = vi.fn((updater) => {
        const result = typeof updater === 'function' ? updater({ width: null }) : updater;
        capturedUpdates.push(result);
        return result;
      });

      const definition = createMockDefinition();
      const formState: ImageFormState = {
        model: 'owner/model-name',
        width: null as unknown as number,
      };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: setFormStateMock,
          data,
        })
      );

      await waitFor(() => {
        expect(setFormStateMock).toHaveBeenCalled();
        const lastUpdate = capturedUpdates[capturedUpdates.length - 1];
        expect(lastUpdate.width).toBe(1024);
      });
    });

    it('should apply default values for empty string formState keys', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'select', default: '16:9' },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const capturedUpdates: ImageFormState[] = [];
      const setFormStateMock = vi.fn((updater) => {
        const result = typeof updater === 'function' ? updater({ aspect_ratio: '' }) : updater;
        capturedUpdates.push(result);
        return result;
      });

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name', aspect_ratio: '' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: setFormStateMock,
          data,
        })
      );

      await waitFor(() => {
        expect(setFormStateMock).toHaveBeenCalled();
        const lastUpdate = capturedUpdates[capturedUpdates.length - 1];
        expect(lastUpdate.aspect_ratio).toBe('16:9');
      });
    });
  });

  // ==========================================================================
  // Test 8: Applying default values to data object
  // ==========================================================================
  describe('applying default values to data object', () => {
    it('should apply default values to data object for undefined keys', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
        { key: 'height', label: 'Height', type: 'number', default: 768 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const dataObject: Record<string, unknown> = {};
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data: dataObject,
        })
      );

      await waitFor(() => {
        expect(dataObject.width).toBe(1024);
        expect(dataObject.height).toBe(768);
      });
    });

    it('should apply default values to data object for null keys', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'guidance_scale', label: 'Guidance Scale', type: 'number', default: 7.5 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const dataObject: Record<string, unknown> = { guidance_scale: null };
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data: dataObject,
        })
      );

      await waitFor(() => {
        expect(dataObject.guidance_scale).toBe(7.5);
      });
    });

    it('should apply default values to data object for empty string keys', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'scheduler', label: 'Scheduler', type: 'select', default: 'euler' },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const dataObject: Record<string, unknown> = { scheduler: '' };
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data: dataObject,
        })
      );

      await waitFor(() => {
        expect(dataObject.scheduler).toBe('euler');
      });
    });
  });

  // ==========================================================================
  // Test 9: Not overwriting existing values in formState
  // ==========================================================================
  describe('not overwriting existing values in formState', () => {
    it('should not overwrite existing non-empty values in formState', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
        { key: 'height', label: 'Height', type: 'number', default: 1024 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const capturedUpdates: ImageFormState[] = [];
      const setFormStateMock = vi.fn((updater) => {
        const result = typeof updater === 'function' ? updater({ width: 512 }) : updater;
        capturedUpdates.push(result);
        return result;
      });

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name', width: 512 };
      const data: Record<string, unknown> = { width: 512 };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: setFormStateMock,
          data,
        })
      );

      await waitFor(() => {
        expect(setFormStateMock).toHaveBeenCalled();
        const lastUpdate = capturedUpdates[capturedUpdates.length - 1];
        expect(lastUpdate.width).toBe(512); // Should keep existing value
        expect(lastUpdate.height).toBe(1024); // Should apply default
      });
    });

    it('should not overwrite existing values in data object', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const dataObject: Record<string, unknown> = { width: 2048 };
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data: dataObject,
        })
      );

      await waitFor(() => {
        expect(dataObject.width).toBe(2048); // Should keep existing value
      });
    });

    it('should preserve zero values in formState', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'seed', label: 'Seed', type: 'number', default: 42 },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const capturedUpdates: ImageFormState[] = [];
      const setFormStateMock = vi.fn((updater) => {
        const result = typeof updater === 'function' ? updater({ seed: 0 }) : updater;
        capturedUpdates.push(result);
        return result;
      });

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name', seed: 0 };
      const data: Record<string, unknown> = { seed: 0 };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: setFormStateMock,
          data,
        })
      );

      await waitFor(() => {
        expect(setFormStateMock).toHaveBeenCalled();
        const lastUpdate = capturedUpdates[capturedUpdates.length - 1];
        expect(lastUpdate.seed).toBe(0); // Zero should be preserved
      });
    });

    it('should preserve false boolean values in formState', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'safety_check', label: 'Safety Check', type: 'boolean', default: true },
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const capturedUpdates: ImageFormState[] = [];
      const setFormStateMock = vi.fn((updater) => {
        const result = typeof updater === 'function' ? updater({ safety_check: false }) : updater;
        capturedUpdates.push(result);
        return result;
      });

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name', safety_check: false };
      const data: Record<string, unknown> = { safety_check: false };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: setFormStateMock,
          data,
        })
      );

      await waitFor(() => {
        expect(setFormStateMock).toHaveBeenCalled();
        const lastUpdate = capturedUpdates[capturedUpdates.length - 1];
        expect(lastUpdate.safety_check).toBe(false); // False should be preserved
      });
    });
  });

  // ==========================================================================
  // Test 10: Merging definition fields with dynamic fields
  // ==========================================================================
  describe('merging definition fields with dynamic fields', () => {
    it('should call mergeDefinitionFields with base and dynamic fields', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'guidance_scale', label: 'Guidance Scale', type: 'number' },
      ]);
      const definition = createMockDefinition();

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(mockedMergeDefinitionFields).toHaveBeenCalledWith(definition.fields, mockFields);
      });
    });

    it('should return activeDefinition with merged fields', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'guidance_scale', label: 'Guidance Scale', type: 'number' },
      ]);
      const definition = createMockDefinition();

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);
      mockedMergeDefinitionFields.mockReturnValueOnce([
        ...definition.fields,
        ...mockFields,
      ] as DynamicField[]);

      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.activeDefinition.fields).toHaveLength(
          definition.fields.length + mockFields.length
        );
      });
    });

    it('should set allowPassthrough to true when dynamic fields exist', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_field' }]);
      const definition = createMockDefinition();

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.activeDefinition.allowPassthrough).toBe(true);
      });
    });

    it('should not set allowPassthrough when no dynamic fields', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
        expect(result.current.activeDefinition.allowPassthrough).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // Test 11: refreshSchema() clearing cache and refetching
  // ==========================================================================
  describe('refreshSchema() clearing cache and refetching', () => {
    it('should call clearSchemaCache when refreshSchema is called', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValue(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      mockedClearSchemaCache.mockClear();

      act(() => {
        result.current.refreshSchema();
      });

      expect(mockedClearSchemaCache).toHaveBeenCalled();
    });

    it('should refetch schema when refreshSchema is called', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValue(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      mockedFetchModelSchema.mockClear();

      act(() => {
        result.current.refreshSchema();
      });

      await waitFor(() => {
        expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/model-name');
      });
    });

    it('should set status to loading during refresh', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      let resolvePromise: (value: ModelSchema) => void;
      const fetchPromise = new Promise<ModelSchema>((resolve) => {
        resolvePromise = resolve;
      });
      mockedFetchModelSchema.mockReturnValueOnce(fetchPromise as never);

      act(() => {
        result.current.refreshSchema();
      });

      expect(result.current.schemaStatus).toBe('loading');

      // Resolve to clean up
      await act(async () => {
        resolvePromise!(createMockSchema());
      });
    });

    it('should clear dynamicFields during refresh', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_field' }]);
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.dynamicFields).toEqual(mockFields);
      });

      let resolvePromise: (value: ModelSchema) => void;
      const fetchPromise = new Promise<ModelSchema>((resolve) => {
        resolvePromise = resolve;
      });
      mockedFetchModelSchema.mockReturnValueOnce(fetchPromise as never);

      act(() => {
        result.current.refreshSchema();
      });

      expect(result.current.dynamicFields).toEqual([]);

      // Resolve to clean up
      await act(async () => {
        resolvePromise!(createMockSchema());
      });
    });

    it('should not refresh when modelId is empty', async () => {
      mockedFetchModelSchema.mockResolvedValue(createMockSchema() as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: '',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      mockedClearSchemaCache.mockClear();
      mockedFetchModelSchema.mockClear();

      act(() => {
        result.current.refreshSchema();
      });

      expect(mockedClearSchemaCache).not.toHaveBeenCalled();
      expect(mockedFetchModelSchema).not.toHaveBeenCalled();
    });

    it('should handle error during refresh', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      mockedFetchModelSchema.mockRejectedValueOnce(new Error('Refresh failed'));

      act(() => {
        result.current.refreshSchema();
      });

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('error');
        expect(result.current.schemaError).toBe('Refresh failed');
      });
    });
  });

  // ==========================================================================
  // Test 12: Handling empty modelId (trimmed)
  // ==========================================================================
  describe('handling empty modelId (trimmed)', () => {
    it('should treat whitespace-only modelId as empty', () => {
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: '   ',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      expect(result.current.schemaStatus).toBe('idle');
      expect(mockedFetchModelSchema).not.toHaveBeenCalled();
    });

    it('should treat tab and newline modelId as empty', () => {
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: '\t\n',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      expect(result.current.schemaStatus).toBe('idle');
      expect(mockedFetchModelSchema).not.toHaveBeenCalled();
    });

    it('should reset state when modelId changes from valid to empty', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_field' }]);
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ modelId }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/model-name' } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
        expect(result.current.dynamicFields).toEqual(mockFields);
      });

      rerender({ modelId: '' });

      expect(result.current.schemaStatus).toBe('idle');
      expect(result.current.dynamicFields).toEqual([]);
      expect(result.current.schemaError).toBeNull();
    });
  });

  // ==========================================================================
  // Test 13: Cancellation when modelId changes during fetch
  // ==========================================================================
  describe('cancellation when modelId changes during fetch', () => {
    it('should start new fetch when modelId changes', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValue(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const dataRef: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ modelId, data }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/first-model', data: dataRef } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/first-model');

      mockedFetchModelSchema.mockClear();

      // Change modelId
      rerender({ modelId: 'owner/second-model', data: dataRef });

      await waitFor(() => {
        expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/second-model');
      });
    });

    it('should not update state if component unmounts during fetch', async () => {
      let resolvePromise: (value: ModelSchema) => void;
      const fetchPromise = new Promise<ModelSchema>((resolve) => {
        resolvePromise = resolve;
      });
      mockedFetchModelSchema.mockReturnValueOnce(fetchPromise as never);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result, unmount } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loading');
      });

      // Unmount before fetch completes
      unmount();

      // Resolve after unmount
      act(() => {
        resolvePromise!(createMockSchema());
      });

      // No error should be thrown (cancelled fetch)
    });

    it('should trigger new fetch on modelId change during loading', async () => {
      let firstResolve: (value: ModelSchema) => void;
      const firstPromise = new Promise<ModelSchema>((resolve) => {
        firstResolve = resolve;
      });
      mockedFetchModelSchema.mockReturnValueOnce(firstPromise as never);

      const definition = createMockDefinition();
      const dataRef: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ modelId, data }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/first-model', data: dataRef } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loading');
      });

      // Set up second fetch before rerender
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      // Change modelId while still loading
      rerender({ modelId: 'owner/second-model', data: dataRef });

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      // Second modelId should have been fetched
      expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/second-model');

      // Clean up first promise
      act(() => {
        firstResolve!(createMockSchema());
      });
    });

    it('should correctly apply defaults from the latest fetch', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_default', default: 'test_value' }]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const dataObject: Record<string, unknown> = {};
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data: dataObject,
        })
      );

      await waitFor(() => {
        expect(dataObject.test_default).toBe('test_value');
      });
    });
  });

  // ==========================================================================
  // Additional Tests for edge cases and comprehensive coverage
  // ==========================================================================
  describe('edge cases', () => {
    it('should handle modelId with version suffix', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce([]);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name:abc123' };
      const data: Record<string, unknown> = {};

      renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name:abc123',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(mockedFetchModelSchema).toHaveBeenCalledWith('owner/model-name:abc123');
      });
    });

    it('should handle fields with no default value', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([
        { key: 'prompt', label: 'Prompt', type: 'textarea' }, // No default
      ]);

      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      // No errors should occur
      expect(result.current.dynamicFields).toEqual(mockFields);
    });

    it('should handle multiple rapid modelId changes', async () => {
      mockedFetchModelSchema.mockResolvedValue(createMockSchema() as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { rerender } = renderHook(
        ({ modelId }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/model-1' } }
      );

      rerender({ modelId: 'owner/model-2' });
      rerender({ modelId: 'owner/model-3' });
      rerender({ modelId: 'owner/model-4' });

      await waitFor(() => {
        expect(mockedFetchModelSchema).toHaveBeenLastCalledWith('owner/model-4');
      });
    });

    it('should memoize activeDefinition correctly', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_field' }]);
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ formState }) =>
          useImageNodeSchema({
            modelId: 'owner/model-name',
            definition,
            formState,
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { formState: { model: 'owner/model-name' } as ImageFormState } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      const firstActiveDefinition = result.current.activeDefinition;

      // Re-render with different formState (should not affect activeDefinition)
      rerender({ formState: { model: 'owner/model-name', prompt: 'test' } });

      expect(result.current.activeDefinition).toBe(firstActiveDefinition);
    });

    it('should handle undefined modelId', () => {
      const definition = createMockDefinition();
      const formState: ImageFormState = { model: '' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: undefined as unknown as string,
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      expect(result.current.schemaStatus).toBe('idle');
      expect(mockedFetchModelSchema).not.toHaveBeenCalled();
    });

    it('should handle definition with no fields', async () => {
      const mockSchema = createMockSchema();
      const mockFields = createMockDynamicFields([{ key: 'test_field' }]);
      mockedFetchModelSchema.mockResolvedValueOnce(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValueOnce(mockFields);

      const definition = createMockDefinition({ fields: [] });
      const formState: ImageFormState = { model: 'owner/model-name' };
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useImageNodeSchema({
          modelId: 'owner/model-name',
          definition,
          formState,
          setFormState: mockSetFormState,
          data,
        })
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
        expect(mockedMergeDefinitionFields).toHaveBeenCalledWith([], mockFields);
      });
    });
  });

  describe('refreshSchema stability', () => {
    it('should have stable refreshSchema reference across renders', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValue(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ formState }) =>
          useImageNodeSchema({
            modelId: 'owner/model-name',
            definition,
            formState,
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { formState: { model: 'owner/model-name' } as ImageFormState } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      const firstRefreshSchema = result.current.refreshSchema;

      // Re-render with different formState
      rerender({ formState: { model: 'owner/model-name', prompt: 'updated' } });

      // refreshSchema should be the same reference (useCallback with modelId dep)
      expect(result.current.refreshSchema).toBe(firstRefreshSchema);
    });

    it('should update refreshSchema reference when modelId changes', async () => {
      const mockSchema = createMockSchema();
      mockedFetchModelSchema.mockResolvedValue(mockSchema as never);
      mockedBuildDynamicFieldsFromSchema.mockReturnValue([]);

      const definition = createMockDefinition();
      const data: Record<string, unknown> = {};

      const { result, rerender } = renderHook(
        ({ modelId }) =>
          useImageNodeSchema({
            modelId,
            definition,
            formState: { model: modelId },
            setFormState: mockSetFormState,
            data,
          }),
        { initialProps: { modelId: 'owner/model-1' } }
      );

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      const firstRefreshSchema = result.current.refreshSchema;

      // Change modelId
      rerender({ modelId: 'owner/model-2' });

      await waitFor(() => {
        expect(result.current.schemaStatus).toBe('loaded');
      });

      // refreshSchema should be a new reference
      expect(result.current.refreshSchema).not.toBe(firstRefreshSchema);
    });
  });
});
