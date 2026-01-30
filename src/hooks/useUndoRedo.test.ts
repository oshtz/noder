/**
 * Tests for useUndoRedo hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from 'reactflow';

// Mock dependencies before importing the hook
vi.mock('lz-string', () => ({
  compressToUTF16: vi.fn((str: string) => str),
  decompressFromUTF16: vi.fn((str: string) => str),
}));

vi.mock('fast-json-patch', () => ({
  compare: vi.fn(() => []),
  applyPatch: vi.fn((doc) => ({ newDocument: doc })),
}));

vi.mock('immer', () => ({
  freeze: vi.fn((obj) => obj),
}));

vi.mock('../utils/createNode', () => ({
  sortNodesForReactFlow: vi.fn((nodes) => nodes),
}));

// Import after mocks
import { useUndoRedo } from './useUndoRedo';

describe('useUndoRedo', () => {
  let mockSetNodes: ReturnType<typeof vi.fn>;
  let mockSetEdges: ReturnType<typeof vi.fn>;
  let testNodes: Node[];
  let testEdges: Edge[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSetNodes = vi.fn();
    mockSetEdges = vi.fn();

    testNodes = [
      { id: 'node-1', type: 'text', position: { x: 100, y: 100 }, data: { label: 'Node 1' } },
      { id: 'node-2', type: 'image', position: { x: 200, y: 200 }, data: { label: 'Node 2' } },
    ] as Node[];

    testEdges = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }] as Edge[];

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty history', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.historyLength).toBe(0);
      expect(result.current.futureLength).toBe(0);
    });

    it('should accept custom maxHistory option', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          maxHistory: 10,
        })
      );

      expect(result.current.historyLength).toBe(0);
    });

    it('should accept custom debounceMs option', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          debounceMs: 500,
        })
      );

      expect(result.current.historyLength).toBe(0);
    });

    it('should return all required methods', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      expect(typeof result.current.undo).toBe('function');
      expect(typeof result.current.redo).toBe('function');
      expect(typeof result.current.takeSnapshot).toBe('function');
      expect(typeof result.current.clearHistory).toBe('function');
    });
  });

  describe('takeSnapshot', () => {
    it('should add snapshot to history when called with immediate=true', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      expect(result.current.historyLength).toBe(1);
      expect(result.current.canUndo).toBe(true);
    });

    it('should not add duplicate snapshot for same state', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      expect(result.current.historyLength).toBe(1);

      act(() => {
        result.current.takeSnapshot(true);
      });

      // Should not add duplicate
      expect(result.current.historyLength).toBe(1);
    });
  });

  describe('undo', () => {
    it('should return false when no history', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      let undoResult: boolean = false;
      act(() => {
        undoResult = result.current.undo();
      });

      expect(undoResult).toBe(false);
    });

    it('should restore previous state and update history', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      expect(result.current.historyLength).toBe(1);

      act(() => {
        result.current.undo();
      });

      expect(result.current.historyLength).toBe(0);
      expect(result.current.canRedo).toBe(true);
    });

    it('should call setNodes and setEdges on undo', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      mockSetNodes.mockClear();
      mockSetEdges.mockClear();

      act(() => {
        result.current.undo();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      expect(mockSetEdges).toHaveBeenCalled();
    });
  });

  describe('redo', () => {
    it('should return false when no future states', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      let redoResult: boolean = false;
      act(() => {
        redoResult = result.current.redo();
      });

      expect(redoResult).toBe(false);
    });

    it('should restore future state after undo', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.redo();
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('should call setNodes and setEdges on redo', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      mockSetNodes.mockClear();
      mockSetEdges.mockClear();

      act(() => {
        result.current.redo();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      expect(mockSetEdges).toHaveBeenCalled();
    });
  });

  describe('clearHistory', () => {
    it('should clear all history states', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      expect(result.current.historyLength).toBe(1);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.historyLength).toBe(0);
      expect(result.current.futureLength).toBe(0);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should clear future states', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.futureLength).toBe(1);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.futureLength).toBe(0);
    });
  });

  describe('keyboard shortcuts', () => {
    it('should handle Ctrl+Z for undo', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      const initialHistory = result.current.historyLength;

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: false,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.historyLength).toBeLessThan(initialHistory);
    });

    it('should handle Ctrl+Shift+Z for redo', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('should handle Ctrl+Y for redo', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'y',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('should clean up event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('canUndo and canRedo', () => {
    it('should update canUndo based on history', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      expect(result.current.canUndo).toBe(false);

      act(() => {
        result.current.takeSnapshot(true);
      });

      expect(result.current.canUndo).toBe(true);
    });

    it('should update canRedo based on future states', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      expect(result.current.canRedo).toBe(false);

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty nodes array', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: [],
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      expect(result.current.historyLength).toBe(1);
    });

    it('should handle undo/redo cycles', () => {
      const { result } = renderHook(() =>
        useUndoRedo({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
        })
      );

      act(() => {
        result.current.takeSnapshot(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.redo();
      });

      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('maxHistory limit', () => {
    it('should respect maxHistory limit', () => {
      const { result, rerender } = renderHook(
        ({ nodes }) =>
          useUndoRedo({
            nodes,
            edges: testEdges,
            setNodes: mockSetNodes,
            setEdges: mockSetEdges,
            maxHistory: 3,
          }),
        { initialProps: { nodes: testNodes } }
      );

      // Add more than maxHistory snapshots
      for (let i = 0; i < 5; i++) {
        const newNodes = [
          { id: `node-${i}`, type: 'text', position: { x: i * 100, y: 100 }, data: {} } as Node,
        ];
        rerender({ nodes: newNodes });
        act(() => {
          result.current.takeSnapshot(true);
        });
      }

      expect(result.current.historyLength).toBeLessThanOrEqual(3);
    });
  });
});
