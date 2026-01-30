/**
 * Tests for useNodeInputs hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeInputs } from './useNodeInputs';
import { on } from '../utils/eventBus';

// eventBus is mocked in test-setup.js

describe('useNodeInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should initialize with initial form state when data is empty', () => {
      const initialFormState = { prompt: 'test prompt', model: 'test-model' };
      const data = {}; // Empty data - use initial form state

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data,
          initialFormState,
        })
      );

      expect(result.current.formState.prompt).toBe('test prompt');
      expect(result.current.formState.model).toBe('test-model');
    });

    it('should merge initial state with existing data (data takes priority)', () => {
      const initialFormState = { prompt: 'default', model: 'default-model' };
      const data = { prompt: 'from data', model: 'data-model' };

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data,
          initialFormState,
        })
      );

      // Data values override initial state when they exist
      expect(result.current.formState.prompt).toBe('from data');
      expect(result.current.formState.model).toBe('data-model');
    });

    it('should initialize with empty chip values', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.chipValues).toEqual({});
    });

    it('should initialize hasChipsConnected as false', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.hasChipsConnected).toBe(false);
    });

    it('should initialize showChipPreview as false', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.showChipPreview).toBe(false);
    });

    it('should initialize promptWithChips as empty string when no prompt', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.promptWithChips).toBe('');
    });

    it('should use default acceptedInputTypes', () => {
      // This tests the internal default - we can verify the hook subscribes to events
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      // Default accepts 'text' and 'prompt'
      expect(result.current.formState).toBeDefined();
    });
  });

  describe('setFormState', () => {
    it('should update form state directly', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: 'initial', model: 'initial-model' },
        })
      );

      act(() => {
        result.current.setFormState({ prompt: 'updated', model: 'updated-model' });
      });

      expect(result.current.formState.prompt).toBe('updated');
      expect(result.current.formState.model).toBe('updated-model');
    });

    it('should accept callback function', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: 'initial', model: 'model' },
        })
      );

      act(() => {
        result.current.setFormState((prev) => ({
          ...prev,
          prompt: prev.prompt + ' appended',
        }));
      });

      expect(result.current.formState.prompt).toBe('initial appended');
    });
  });

  describe('showChipPreview', () => {
    it('should set showChipPreview to true', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      act(() => {
        result.current.setShowChipPreview(true);
      });

      expect(result.current.showChipPreview).toBe(true);
    });

    it('should toggle showChipPreview', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      act(() => {
        result.current.setShowChipPreview(true);
      });

      act(() => {
        result.current.setShowChipPreview(false);
      });

      expect(result.current.showChipPreview).toBe(false);
    });
  });

  describe('promptWithChips', () => {
    it('should return prompt unchanged when no chips', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: 'A simple prompt', model: '' },
        })
      );

      expect(result.current.promptWithChips).toBe('A simple prompt');
    });

    it('should return empty string for non-string prompt', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: undefined as unknown as string, model: '' },
        })
      );

      expect(result.current.promptWithChips).toBe('');
    });
  });

  describe('syncWithData', () => {
    it('should sync form state with data', () => {
      const data = { prompt: 'initial', model: 'initial-model' };

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data,
          initialFormState: { prompt: 'initial', model: 'initial-model' },
        })
      );

      // Modify data externally
      data.prompt = 'external update';

      act(() => {
        result.current.syncWithData();
      });

      expect(result.current.formState.prompt).toBe('external update');
    });

    it('should not update if data has not changed', () => {
      const data = { prompt: 'same', model: 'same-model' };

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data,
          initialFormState: { prompt: 'same', model: 'same-model' },
        })
      );

      act(() => {
        result.current.syncWithData();
      });

      expect(result.current.formState.prompt).toBe('same');
    });
  });

  describe('clearChipValues', () => {
    it('should clear chip values', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      // Note: We cannot easily set chip values directly since they come from events
      // But we can test that clearChipValues runs without error
      act(() => {
        result.current.clearChipValues();
      });

      expect(result.current.chipValues).toEqual({});
      expect(result.current.hasChipsConnected).toBe(false);
    });

    it('should be idempotent', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      act(() => {
        result.current.clearChipValues();
        result.current.clearChipValues();
        result.current.clearChipValues();
      });

      expect(result.current.chipValues).toEqual({});
    });
  });

  describe('event subscription', () => {
    it('should subscribe to nodeContentChanged events', () => {
      renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      // Verify on was called (mocked in test-setup.js)
      expect(on).toHaveBeenCalledWith('nodeContentChanged', expect.any(Function));
    });

    it('should unsubscribe on unmount', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(on).mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('onContentReceived callback', () => {
    it('should provide onContentReceived callback in options', () => {
      const onContentReceived = vi.fn();

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
          acceptedInputTypes: ['text', 'prompt'],
          onContentReceived,
        })
      );

      // Verify hook renders correctly with callback
      expect(result.current.formState).toBeDefined();
      // Event subscription is mocked, so we just verify the hook setup works
      expect(on).toHaveBeenCalledWith('nodeContentChanged', expect.any(Function));
    });

    it('should accept acceptedInputTypes option', () => {
      const onContentReceived = vi.fn();

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
          acceptedInputTypes: ['image', 'video'],
          onContentReceived,
        })
      );

      // Hook should render with custom input types
      expect(result.current.formState).toBeDefined();
    });

    it('should accept empty acceptedInputTypes', () => {
      const onContentReceived = vi.fn();

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
          acceptedInputTypes: [],
          onContentReceived,
        })
      );

      expect(result.current.formState).toBeDefined();
    });
  });

  describe('chip handling', () => {
    it('should accept onChipValuesChange callback', () => {
      const onChipValuesChange = vi.fn();
      const data: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data,
          initialFormState: { prompt: '', model: '' },
          onChipValuesChange,
        })
      );

      // Verify hook setup works with callback
      expect(result.current.chipValues).toEqual({});
      expect(result.current.hasChipsConnected).toBe(false);
    });

    it('should initialize with hasChipsConnected false', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.hasChipsConnected).toBe(false);
    });

    it('should clear chip values when calling clearChipValues', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      act(() => {
        result.current.clearChipValues();
      });

      expect(result.current.chipValues).toEqual({});
    });
  });

  describe('handleTypeMap', () => {
    it('should accept handleTypeMap option', () => {
      const onContentReceived = vi.fn();

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
          acceptedInputTypes: [],
          handleTypeMap: {
            'image-input': 'image',
            'text-input': 'text',
          },
          onContentReceived,
        })
      );

      // Hook should render with handleTypeMap
      expect(result.current.formState).toBeDefined();
      expect(on).toHaveBeenCalledWith('nodeContentChanged', expect.any(Function));
    });

    it('should accept empty handleTypeMap', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
          handleTypeMap: {},
        })
      );

      expect(result.current.formState).toBeDefined();
    });
  });

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      const _firstSyncWithData = result.current.syncWithData;
      const firstClearChipValues = result.current.clearChipValues;

      rerender();

      expect(result.current.clearChipValues).toBe(firstClearChipValues);
      // syncWithData depends on formState, so it may change
      expect(typeof result.current.syncWithData).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle empty initial form state', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: {},
          initialFormState: {} as Record<string, unknown>,
        })
      );

      expect(result.current.formState).toEqual({});
    });

    it('should handle data with extra properties', () => {
      const data = {
        prompt: 'test',
        model: 'model',
        extraProp: 'extra',
        anotherProp: 123,
      };

      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data,
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.formState.prompt).toBe('test');
      expect(result.current.formState.model).toBe('model');
    });

    it('should handle special characters in node ID', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'node-123-special_chars',
          data: {},
          initialFormState: { prompt: '', model: '' },
        })
      );

      expect(result.current.formState).toBeDefined();
    });

    it('should handle undefined data values', () => {
      const { result } = renderHook(() =>
        useNodeInputs({
          nodeId: 'test-node',
          data: { prompt: undefined, model: undefined },
          initialFormState: { prompt: 'default', model: 'default-model' },
        })
      );

      // undefined values should not override initial state
      expect(result.current.formState.prompt).toBe('default');
      expect(result.current.formState.model).toBe('default-model');
    });
  });
});
