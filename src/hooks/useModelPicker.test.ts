/**
 * Tests for useModelPicker hook
 * Tests model picker state management with outside-click detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModelPicker } from './useModelPicker';

describe('useModelPicker', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let mousedownHandler: ((event: MouseEvent) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture the mousedown handler when addEventListener is called
    addEventListenerSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'mousedown') {
          mousedownHandler = handler as (event: MouseEvent) => void;
        }
      });

    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    mousedownHandler = null;
  });

  describe('initialization', () => {
    it('should initialize isOpen as false', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(result.current.isOpen).toBe(false);
    });

    it('should initialize selectedModel as empty string when no initialModel provided', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(result.current.selectedModel).toBe('');
    });

    it('should initialize selectedModel with initialModel value', () => {
      const { result } = renderHook(() => useModelPicker({ initialModel: 'gpt-4' }));

      expect(result.current.selectedModel).toBe('gpt-4');
    });

    it('should initialize pickerRef as a ref object', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(result.current.pickerRef).toBeDefined();
      expect(result.current.pickerRef.current).toBeNull();
    });

    it('should return all expected properties', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('open');
      expect(result.current).toHaveProperty('close');
      expect(result.current).toHaveProperty('toggle');
      expect(result.current).toHaveProperty('selectedModel');
      expect(result.current).toHaveProperty('setSelectedModel');
      expect(result.current).toHaveProperty('handleSelect');
      expect(result.current).toHaveProperty('pickerRef');
    });

    it('should return functions for open, close, toggle, setSelectedModel, and handleSelect', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(typeof result.current.open).toBe('function');
      expect(typeof result.current.close).toBe('function');
      expect(typeof result.current.toggle).toBe('function');
      expect(typeof result.current.setSelectedModel).toBe('function');
      expect(typeof result.current.handleSelect).toBe('function');
    });
  });

  describe('open()', () => {
    it('should set isOpen to true', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should be idempotent when called multiple times', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
        result.current.open();
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('close()', () => {
    it('should set isOpen to false', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should be idempotent when called on already closed picker', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should be idempotent when called multiple times', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.close();
        result.current.close();
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('should open picker when closed', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should close picker when open', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should toggle back and forth correctly', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);
    });

    it('should handle rapid toggles correctly', () => {
      const { result } = renderHook(() => useModelPicker());

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.toggle();
        });
      }

      // After even number of toggles, should be false (started as false)
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('selectedModel syncing with initialModel', () => {
    it('should sync selectedModel when initialModel prop changes', () => {
      let initialModel = 'gpt-3.5-turbo';

      const { result, rerender } = renderHook(() => useModelPicker({ initialModel }));

      expect(result.current.selectedModel).toBe('gpt-3.5-turbo');

      initialModel = 'gpt-4';
      rerender();

      expect(result.current.selectedModel).toBe('gpt-4');
    });

    it('should sync when initialModel changes from empty to value', () => {
      let initialModel = '';

      const { result, rerender } = renderHook(() => useModelPicker({ initialModel }));

      expect(result.current.selectedModel).toBe('');

      initialModel = 'claude-3-opus';
      rerender();

      expect(result.current.selectedModel).toBe('claude-3-opus');
    });

    it('should sync when initialModel changes from value to empty', () => {
      let initialModel = 'gpt-4';

      const { result, rerender } = renderHook(() => useModelPicker({ initialModel }));

      expect(result.current.selectedModel).toBe('gpt-4');

      initialModel = '';
      rerender();

      expect(result.current.selectedModel).toBe('');
    });

    it('should not cause issues when initialModel is the same', () => {
      const { result, rerender } = renderHook(() => useModelPicker({ initialModel: 'gpt-4' }));

      expect(result.current.selectedModel).toBe('gpt-4');

      rerender();

      expect(result.current.selectedModel).toBe('gpt-4');
    });
  });

  describe('setSelectedModel', () => {
    it('should update selectedModel directly', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.setSelectedModel('new-model');
      });

      expect(result.current.selectedModel).toBe('new-model');
    });

    it('should not close the picker when called', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.setSelectedModel('new-model');
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should not call onModelChange callback', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.setSelectedModel('new-model');
      });

      expect(onModelChange).not.toHaveBeenCalled();
    });

    it('should handle empty string', () => {
      const { result } = renderHook(() => useModelPicker({ initialModel: 'gpt-4' }));

      act(() => {
        result.current.setSelectedModel('');
      });

      expect(result.current.selectedModel).toBe('');
    });

    it('should handle special characters in model name', () => {
      const { result } = renderHook(() => useModelPicker());

      const specialModel = 'openai/gpt-4-turbo-2024-04-09';
      act(() => {
        result.current.setSelectedModel(specialModel);
      });

      expect(result.current.selectedModel).toBe(specialModel);
    });
  });

  describe('handleSelect', () => {
    it('should set selectedModel to the provided model', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.handleSelect('selected-model');
      });

      expect(result.current.selectedModel).toBe('selected-model');
    });

    it('should close the picker', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleSelect('selected-model');
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should call onModelChange callback with selected model', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.handleSelect('gpt-4');
      });

      expect(onModelChange).toHaveBeenCalledTimes(1);
      expect(onModelChange).toHaveBeenCalledWith('gpt-4');
    });

    it('should not throw when onModelChange is undefined', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(() => {
        act(() => {
          result.current.handleSelect('model');
        });
      }).not.toThrow();
    });

    it('should work when picker is already closed', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.handleSelect('model');
      });

      expect(result.current.selectedModel).toBe('model');
      expect(result.current.isOpen).toBe(false);
      expect(onModelChange).toHaveBeenCalledWith('model');
    });

    it('should handle multiple consecutive selections', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.handleSelect('model-1');
      });

      act(() => {
        result.current.handleSelect('model-2');
      });

      act(() => {
        result.current.handleSelect('model-3');
      });

      expect(result.current.selectedModel).toBe('model-3');
      expect(onModelChange).toHaveBeenCalledTimes(3);
      expect(onModelChange).toHaveBeenNthCalledWith(1, 'model-1');
      expect(onModelChange).toHaveBeenNthCalledWith(2, 'model-2');
      expect(onModelChange).toHaveBeenNthCalledWith(3, 'model-3');
    });
  });

  describe('outside click handling', () => {
    it('should add mousedown listener when picker opens', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('should not add listener when picker is closed', () => {
      renderHook(() => useModelPicker());

      // Only the initial render effect runs, no listener added when closed
      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });

    it('should remove listener when picker closes', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.close();
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('should remove listener on unmount when picker is open', () => {
      const { result, unmount } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('should close picker when clicking outside (not in picker container)', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      // Simulate outside click
      const outsideElement = document.createElement('div');
      const mockEvent = {
        target: outsideElement,
      } as unknown as MouseEvent;

      // Mock the closest method to return null (not inside any special container)
      outsideElement.closest = vi.fn().mockReturnValue(null);

      act(() => {
        if (mousedownHandler) {
          mousedownHandler(mockEvent);
        }
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should not close picker when clicking inside pickerRef container', () => {
      const { result } = renderHook(() => useModelPicker());

      // Create a mock container and set it to the ref
      const mockContainer = document.createElement('div');
      const mockTarget = document.createElement('button');
      mockContainer.appendChild(mockTarget);

      // Set the ref's current value
      Object.defineProperty(result.current.pickerRef, 'current', {
        value: mockContainer,
        writable: true,
      });

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      // Simulate click inside the container
      const mockEvent = {
        target: mockTarget,
      } as unknown as MouseEvent;

      // Mock closest to return null (so it would normally close)
      mockTarget.closest = vi.fn().mockReturnValue(null);

      act(() => {
        if (mousedownHandler) {
          mousedownHandler(mockEvent);
        }
      });

      // Should still be open because click was inside pickerRef container
      expect(result.current.isOpen).toBe(true);
    });

    it('should not close picker when clicking inside .replicate-model-picker', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      const mockElement = document.createElement('div');
      const mockEvent = {
        target: mockElement,
      } as unknown as MouseEvent;

      // Mock closest to return an element for .replicate-model-picker
      mockElement.closest = vi.fn().mockImplementation((selector: string) => {
        if (selector === '.replicate-model-picker') {
          return mockElement;
        }
        return null;
      });

      act(() => {
        if (mousedownHandler) {
          mousedownHandler(mockEvent);
        }
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should not close picker when clicking inside .node-metadata-badge', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      const mockElement = document.createElement('div');
      const mockEvent = {
        target: mockElement,
      } as unknown as MouseEvent;

      // Mock closest to return an element for .node-metadata-badge
      mockElement.closest = vi.fn().mockImplementation((selector: string) => {
        if (selector === '.node-metadata-badge') {
          return mockElement;
        }
        return null;
      });

      act(() => {
        if (mousedownHandler) {
          mousedownHandler(mockEvent);
        }
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('callback stability', () => {
    it('should maintain stable open reference', () => {
      const { result, rerender } = renderHook(() => useModelPicker());

      const firstOpen = result.current.open;
      rerender();
      const secondOpen = result.current.open;

      expect(firstOpen).toBe(secondOpen);
    });

    it('should maintain stable close reference', () => {
      const { result, rerender } = renderHook(() => useModelPicker());

      const firstClose = result.current.close;
      rerender();
      const secondClose = result.current.close;

      expect(firstClose).toBe(secondClose);
    });

    it('should maintain stable toggle reference', () => {
      const { result, rerender } = renderHook(() => useModelPicker());

      const firstToggle = result.current.toggle;
      rerender();
      const secondToggle = result.current.toggle;

      expect(firstToggle).toBe(secondToggle);
    });

    it('should maintain stable handleSelect reference when onModelChange is stable', () => {
      const onModelChange = vi.fn();
      const { result, rerender } = renderHook(() => useModelPicker({ onModelChange }));

      const firstHandleSelect = result.current.handleSelect;
      rerender();
      const secondHandleSelect = result.current.handleSelect;

      expect(firstHandleSelect).toBe(secondHandleSelect);
    });

    it('should maintain stable pickerRef reference', () => {
      const { result, rerender } = renderHook(() => useModelPicker());

      const firstRef = result.current.pickerRef;
      rerender();
      const secondRef = result.current.pickerRef;

      expect(firstRef).toBe(secondRef);
    });
  });

  describe('options handling', () => {
    it('should work with no options provided', () => {
      const { result } = renderHook(() => useModelPicker());

      expect(result.current.selectedModel).toBe('');
      expect(result.current.isOpen).toBe(false);
    });

    it('should work with empty options object', () => {
      const { result } = renderHook(() => useModelPicker({}));

      expect(result.current.selectedModel).toBe('');
      expect(result.current.isOpen).toBe(false);
    });

    it('should work with only initialModel option', () => {
      const { result } = renderHook(() => useModelPicker({ initialModel: 'test-model' }));

      expect(result.current.selectedModel).toBe('test-model');
    });

    it('should work with only onModelChange option', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.handleSelect('model');
      });

      expect(onModelChange).toHaveBeenCalledWith('model');
    });

    it('should work with both options', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() =>
        useModelPicker({
          initialModel: 'initial-model',
          onModelChange,
        })
      );

      expect(result.current.selectedModel).toBe('initial-model');

      act(() => {
        result.current.handleSelect('new-model');
      });

      expect(result.current.selectedModel).toBe('new-model');
      expect(onModelChange).toHaveBeenCalledWith('new-model');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined initialModel', () => {
      const { result } = renderHook(() => useModelPicker({ initialModel: undefined }));

      expect(result.current.selectedModel).toBe('');
    });

    it('should handle model names with special characters', () => {
      const { result } = renderHook(() =>
        useModelPicker({ initialModel: 'org/model:version-123_abc' })
      );

      expect(result.current.selectedModel).toBe('org/model:version-123_abc');
    });

    it('should handle very long model names', () => {
      const longModelName = 'a'.repeat(1000);
      const { result } = renderHook(() => useModelPicker({ initialModel: longModelName }));

      expect(result.current.selectedModel).toBe(longModelName);
    });

    it('should handle unicode in model names', () => {
      const unicodeModel = 'model-\u00e9\u00e8\u00ea-test';
      const { result } = renderHook(() => useModelPicker({ initialModel: unicodeModel }));

      expect(result.current.selectedModel).toBe(unicodeModel);
    });

    it('should handle whitespace in model names', () => {
      const { result } = renderHook(() =>
        useModelPicker({ initialModel: '  model with spaces  ' })
      );

      expect(result.current.selectedModel).toBe('  model with spaces  ');
    });
  });

  describe('combined operations', () => {
    it('should handle open then handleSelect correctly', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleSelect('selected');
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.selectedModel).toBe('selected');
      expect(onModelChange).toHaveBeenCalledWith('selected');
    });

    it('should handle setSelectedModel while picker is open', () => {
      const { result } = renderHook(() => useModelPicker());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.setSelectedModel('model-1');
      });

      act(() => {
        result.current.setSelectedModel('model-2');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.selectedModel).toBe('model-2');
    });

    it('should handle toggle then handleSelect', () => {
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useModelPicker({ onModelChange }));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleSelect('model');
      });

      expect(result.current.isOpen).toBe(false);
      expect(onModelChange).toHaveBeenCalledWith('model');
    });

    it('should handle initialModel change while picker is open', () => {
      let initialModel = 'model-1';

      const { result, rerender } = renderHook(() => useModelPicker({ initialModel }));

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.selectedModel).toBe('model-1');

      initialModel = 'model-2';
      rerender();

      expect(result.current.isOpen).toBe(true);
      expect(result.current.selectedModel).toBe('model-2');
    });
  });
});
