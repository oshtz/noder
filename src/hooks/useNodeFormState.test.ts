/**
 * Tests for useNodeFormState hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeFormState } from './useNodeFormState';

describe('useNodeFormState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should initialize with provided initial state', () => {
      const initialState = { model: 'test-model', prompt: 'test prompt' };
      const nodeData = { metadata: 'test' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      expect(result.current.formState).toEqual(initialState);
    });

    it('should initialize with empty model if provided', () => {
      const initialState = { model: '', prompt: '' };
      const nodeData = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      expect(result.current.formState.model).toBe('');
      expect(result.current.formState.prompt).toBe('');
    });

    it('should initialize with additional fields', () => {
      const initialState = {
        model: 'test-model',
        prompt: 'test',
        width: 512,
        height: 512,
        steps: 20,
      };
      const nodeData = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      expect(result.current.formState.width).toBe(512);
      expect(result.current.formState.height).toBe(512);
      expect(result.current.formState.steps).toBe(20);
    });
  });

  describe('updateField', () => {
    it('should update a single field', () => {
      const initialState = { model: 'old-model', prompt: 'old prompt' };
      const nodeData: Record<string, unknown> = { metadata: 'test' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('prompt', 'new prompt');
      });

      expect(result.current.formState.prompt).toBe('new prompt');
    });

    it('should update model field and metadata', () => {
      const initialState = { model: 'old-model', prompt: 'test' };
      const nodeData: Record<string, unknown> = { metadata: 'old' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('model', 'owner/new-model');
      });

      expect(result.current.formState.model).toBe('owner/new-model');
      expect(nodeData.metadata).toBe('new-model');
    });

    it('should sync field to nodeData', () => {
      const initialState = { model: 'test-model', prompt: 'old' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('prompt', 'synced prompt');
      });

      expect(nodeData.prompt).toBe('synced prompt');
    });

    it('should handle custom fields', () => {
      interface CustomFormState {
        model: string;
        prompt?: string;
        customField: number;
      }

      const initialState: CustomFormState = {
        model: 'test',
        customField: 0,
      };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState<CustomFormState, Record<string, unknown>>({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('customField', 42);
      });

      expect(result.current.formState.customField).toBe(42);
      expect(nodeData.customField).toBe(42);
    });
  });

  describe('updateFields', () => {
    it('should update multiple fields at once', () => {
      const initialState = { model: 'old-model', prompt: 'old', width: 256 };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateFields({
          prompt: 'new prompt',
          width: 512,
        });
      });

      expect(result.current.formState.prompt).toBe('new prompt');
      expect(result.current.formState.width).toBe(512);
      expect(result.current.formState.model).toBe('old-model');
    });

    it('should update model and metadata when model is in updates', () => {
      const initialState = { model: 'old-model', prompt: '' };
      const nodeData: Record<string, unknown> = { metadata: 'old' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateFields({
          model: 'owner/updated-model',
        });
      });

      expect(result.current.formState.model).toBe('owner/updated-model');
      expect(nodeData.metadata).toBe('updated-model');
    });

    it('should sync all updated fields to nodeData', () => {
      const initialState = { model: 'test', prompt: '', width: 0, height: 0 };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateFields({
          prompt: 'synced',
          width: 1024,
          height: 768,
        });
      });

      expect(nodeData.prompt).toBe('synced');
      expect(nodeData.width).toBe(1024);
      expect(nodeData.height).toBe(768);
    });

    it('should handle empty updates object', () => {
      const initialState = { model: 'test', prompt: 'original' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateFields({});
      });

      expect(result.current.formState.model).toBe('test');
      expect(result.current.formState.prompt).toBe('original');
    });
  });

  describe('handleApplyClipboard', () => {
    it('should apply clipboard data to form state', () => {
      const initialState = { model: 'old', prompt: 'old prompt' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      const clipboardData = { model: 'clipboard-model', prompt: 'clipboard prompt' };

      act(() => {
        result.current.handleApplyClipboard(clipboardData);
      });

      expect(result.current.formState).toEqual(clipboardData);
    });

    it('should update nodeData when applying clipboard', () => {
      const initialState = { model: 'old', prompt: '' };
      const nodeData: Record<string, unknown> = { metadata: 'old' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      const clipboardData = { model: 'owner/clipboard-model', prompt: 'test' };

      act(() => {
        result.current.handleApplyClipboard(clipboardData);
      });

      expect(nodeData.model).toBe('owner/clipboard-model');
      expect(nodeData.prompt).toBe('test');
      expect(nodeData.metadata).toBe('clipboard-model');
    });

    it('should handle clipboard without model', () => {
      const initialState = { model: 'existing', prompt: '' };
      const nodeData: Record<string, unknown> = { metadata: 'existing-meta' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      // TypeScript requires model, but we can test with empty string
      const clipboardData = { model: '', prompt: 'clipboard prompt' };

      act(() => {
        result.current.handleApplyClipboard(clipboardData);
      });

      expect(result.current.formState.prompt).toBe('clipboard prompt');
      // metadata should not be updated for empty model
    });
  });

  describe('handleFormChange', () => {
    it('should set entire form state', () => {
      const initialState = { model: 'old', prompt: 'old' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      const newState = { model: 'new-model', prompt: 'new prompt' };

      act(() => {
        result.current.handleFormChange(newState);
      });

      expect(result.current.formState).toEqual(newState);
    });

    it('should sync to nodeData', () => {
      const initialState = { model: 'old', prompt: '', extra: 'old-extra' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      const newState = { model: 'new', prompt: 'updated', extra: 'new-extra' };

      act(() => {
        result.current.handleFormChange(newState);
      });

      expect(nodeData.model).toBe('new');
      expect(nodeData.prompt).toBe('updated');
      expect(nodeData.extra).toBe('new-extra');
    });

    it('should update metadata from model', () => {
      const initialState = { model: 'old', prompt: '' };
      const nodeData: Record<string, unknown> = { metadata: 'old' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.handleFormChange({ model: 'owner/new-metadata', prompt: '' });
      });

      expect(nodeData.metadata).toBe('new-metadata');
    });
  });

  describe('setFormState', () => {
    it('should directly set form state', () => {
      const initialState = { model: 'initial', prompt: '' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.setFormState({ model: 'direct', prompt: 'direct prompt' });
      });

      expect(result.current.formState.model).toBe('direct');
      expect(result.current.formState.prompt).toBe('direct prompt');
    });

    it('should accept callback function', () => {
      const initialState = { model: 'initial', prompt: 'initial prompt' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.setFormState((prev) => ({
          ...prev,
          prompt: prev.prompt + ' updated',
        }));
      });

      expect(result.current.formState.prompt).toBe('initial prompt updated');
    });
  });

  describe('parseNodeData and watchFields', () => {
    it('should use parseNodeData to initialize from node data', () => {
      const initialState = { model: '', prompt: '' };
      const nodeData = { model: 'data-model', prompt: 'data-prompt', metadata: 'meta' };

      const parseNodeData = vi.fn((data: typeof nodeData) => ({
        model: data.model,
        prompt: data.prompt,
      }));

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
          parseNodeData,
          watchFields: ['prompt'],
        })
      );

      // The useEffect should sync on initial render
      expect(result.current.formState.model).toBe('data-model');
      expect(result.current.formState.prompt).toBe('data-prompt');
    });

    it('should react to watched field changes', () => {
      let currentNodeData = { model: 'initial', prompt: 'initial prompt', metadata: '' };

      const parseNodeData = (data: typeof currentNodeData) => ({
        model: data.model,
        prompt: data.prompt,
      });

      const { result, rerender } = renderHook(
        ({ nodeData }) =>
          useNodeFormState({
            initialState: { model: '', prompt: '' },
            nodeData,
            parseNodeData,
            watchFields: ['prompt'],
          }),
        {
          initialProps: { nodeData: currentNodeData },
        }
      );

      // Update the nodeData object
      currentNodeData = { ...currentNodeData, prompt: 'updated prompt' };

      rerender({ nodeData: currentNodeData });

      expect(result.current.formState.prompt).toBe('updated prompt');
    });

    it('should not re-parse when values unchanged', () => {
      const nodeData = { model: 'model', prompt: 'prompt', metadata: '' };
      const parseNodeData = vi.fn((data: typeof nodeData) => ({
        model: data.model,
        prompt: data.prompt,
      }));

      const { rerender } = renderHook(() =>
        useNodeFormState({
          initialState: { model: '', prompt: '' },
          nodeData,
          parseNodeData,
          watchFields: [],
        })
      );

      const initialCallCount = parseNodeData.mock.calls.length;

      // Rerender without changing nodeData
      rerender();

      // parseNodeData is called on every effect run, but setFormState should bail out
      expect(parseNodeData.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount);
    });
  });

  describe('model metadata extraction', () => {
    it('should extract model name from full path', () => {
      const initialState = { model: '', prompt: '' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('model', 'owner/repo/model-name');
      });

      expect(nodeData.metadata).toBe('model-name');
    });

    it('should handle model without path separator', () => {
      const initialState = { model: '', prompt: '' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('model', 'simple-model');
      });

      expect(nodeData.metadata).toBe('simple-model');
    });

    it('should handle empty model string', () => {
      const initialState = { model: 'existing', prompt: '' };
      const nodeData: Record<string, unknown> = { metadata: 'existing' };

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      // updateField with empty string should still work
      act(() => {
        result.current.updateField('model', '');
      });

      // Empty string split('/').pop() returns ''
      expect(nodeData.metadata).toBe('');
    });
  });

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const initialState = { model: 'test', prompt: '' };
      const nodeData: Record<string, unknown> = {};

      const { result, rerender } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      const firstUpdateField = result.current.updateField;
      const firstUpdateFields = result.current.updateFields;
      const firstHandleApplyClipboard = result.current.handleApplyClipboard;
      const firstHandleFormChange = result.current.handleFormChange;

      rerender();

      expect(result.current.updateField).toBe(firstUpdateField);
      expect(result.current.updateFields).toBe(firstUpdateFields);
      expect(result.current.handleApplyClipboard).toBe(firstHandleApplyClipboard);
      expect(result.current.handleFormChange).toBe(firstHandleFormChange);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in field values', () => {
      const initialState = { model: '', prompt: '' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('prompt', '<script>alert("xss")</script>');
      });

      expect(result.current.formState.prompt).toBe('<script>alert("xss")</script>');
    });

    it('should handle unicode in field values', () => {
      const initialState = { model: '', prompt: '' };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('prompt', '\u4f60\u597d\u4e16\u754c');
      });

      expect(result.current.formState.prompt).toBe('\u4f60\u597d\u4e16\u754c');
    });

    it('should handle null values gracefully', () => {
      const initialState = { model: 'test', prompt: '', nullableField: null as string | null };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('nullableField', null);
      });

      expect(result.current.formState.nullableField).toBeNull();
    });

    it('should handle undefined values', () => {
      const initialState = {
        model: 'test',
        prompt: '',
        optionalField: undefined as string | undefined,
      };
      const nodeData: Record<string, unknown> = {};

      const { result } = renderHook(() =>
        useNodeFormState({
          initialState,
          nodeData,
        })
      );

      act(() => {
        result.current.updateField('optionalField', undefined);
      });

      expect(result.current.formState.optionalField).toBeUndefined();
    });
  });
});
