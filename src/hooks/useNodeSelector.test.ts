import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeSelector, type SelectorPosition } from './useNodeSelector';

describe('useNodeSelector', () => {
  let setNodes: ReturnType<typeof vi.fn>;
  let setSelectorOpen: ReturnType<typeof vi.fn>;
  let setSelectorPosition: ReturnType<typeof vi.fn>;
  let selectorPosition: SelectorPosition;
  let handleRemoveNode: ReturnType<typeof vi.fn>;
  let handleRunWorkflow: ReturnType<typeof vi.fn>;
  let screenToFlowPosition: ReturnType<typeof vi.fn>;
  let handleAddNode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    setNodes = vi.fn();
    setSelectorOpen = vi.fn();
    setSelectorPosition = vi.fn();
    selectorPosition = { x: 100, y: 200 };
    handleRemoveNode = vi.fn();
    handleRunWorkflow = vi.fn();
    screenToFlowPosition = vi.fn((pos) => ({
      x: pos.x - 50, // Simulate offset
      y: pos.y - 50,
    }));
    handleAddNode = vi.fn();
  });

  describe('handleNodeSelect', () => {
    it('should convert screen position to flow position', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      act(() => {
        result.current.handleNodeSelect('image');
      });

      expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 100, y: 200 });
    });

    it('should call handleAddNode with type and flow position', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      act(() => {
        result.current.handleNodeSelect('image');
      });

      expect(handleAddNode).toHaveBeenCalledWith('image', { x: 50, y: 150 });
    });

    it('should close the selector after adding node', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      act(() => {
        result.current.handleNodeSelect('text');
      });

      expect(setSelectorOpen).toHaveBeenCalledWith(false);
    });

    it('should handle different node types', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const nodeTypes = ['image', 'text', 'video', 'audio', 'media', 'group'];

      for (const type of nodeTypes) {
        act(() => {
          result.current.handleNodeSelect(type);
        });

        expect(handleAddNode).toHaveBeenLastCalledWith(type, expect.any(Object));
      }
    });

    it('should use current selector position', () => {
      selectorPosition = { x: 500, y: 300 };

      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      act(() => {
        result.current.handleNodeSelect('image');
      });

      expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 500, y: 300 });
    });
  });

  describe('onPaneDoubleClick', () => {
    it('should set selector position to click coordinates', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const mockEvent = {
        clientX: 300,
        clientY: 400,
        target: {
          getBoundingClientRect: () => ({
            top: 50,
            left: 100,
            width: 800,
            height: 600,
          }),
        },
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.onPaneDoubleClick(mockEvent);
      });

      expect(setSelectorPosition).toHaveBeenCalledWith({ x: 300, y: 400 });
    });

    it('should open the selector', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const mockEvent = {
        clientX: 300,
        clientY: 400,
        target: {
          getBoundingClientRect: () => ({
            top: 50,
            left: 100,
            width: 800,
            height: 600,
          }),
        },
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.onPaneDoubleClick(mockEvent);
      });

      expect(setSelectorOpen).toHaveBeenCalledWith(true);
    });

    it('should handle clicks at origin', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const mockEvent = {
        clientX: 0,
        clientY: 0,
        target: {
          getBoundingClientRect: () => ({
            top: 0,
            left: 0,
            width: 800,
            height: 600,
          }),
        },
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.onPaneDoubleClick(mockEvent);
      });

      expect(setSelectorPosition).toHaveBeenCalledWith({ x: 0, y: 0 });
      expect(setSelectorOpen).toHaveBeenCalledWith(true);
    });

    it('should handle clicks at large coordinates', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const mockEvent = {
        clientX: 10000,
        clientY: 5000,
        target: {
          getBoundingClientRect: () => ({
            top: 100,
            left: 200,
            width: 1920,
            height: 1080,
          }),
        },
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.onPaneDoubleClick(mockEvent);
      });

      expect(setSelectorPosition).toHaveBeenCalledWith({ x: 10000, y: 5000 });
    });
  });

  describe('hook stability', () => {
    it('should return stable handleNodeSelect reference', () => {
      const { result, rerender } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const first = result.current.handleNodeSelect;
      rerender();
      const second = result.current.handleNodeSelect;

      expect(first).toBe(second);
    });

    it('should return stable onPaneDoubleClick reference', () => {
      const { result, rerender } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      const first = result.current.onPaneDoubleClick;
      rerender();
      const second = result.current.onPaneDoubleClick;

      expect(first).toBe(second);
    });
  });

  describe('return value', () => {
    it('should return handleNodeSelect and onPaneDoubleClick', () => {
      const { result } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          selectorPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      expect(result.current).toHaveProperty('handleNodeSelect');
      expect(result.current).toHaveProperty('onPaneDoubleClick');
      expect(typeof result.current.handleNodeSelect).toBe('function');
      expect(typeof result.current.onPaneDoubleClick).toBe('function');
    });
  });

  describe('dependency updates', () => {
    it('should update handleNodeSelect when selectorPosition changes', () => {
      let currentPosition = { x: 100, y: 200 };

      const { result, rerender } = renderHook(() =>
        useNodeSelector(
          setNodes,
          setSelectorOpen,
          setSelectorPosition,
          currentPosition,
          handleRemoveNode,
          handleRunWorkflow,
          screenToFlowPosition,
          handleAddNode
        )
      );

      act(() => {
        result.current.handleNodeSelect('image');
      });

      expect(screenToFlowPosition).toHaveBeenLastCalledWith({ x: 100, y: 200 });

      // Update position
      currentPosition = { x: 500, y: 600 };
      rerender();

      act(() => {
        result.current.handleNodeSelect('text');
      });

      expect(screenToFlowPosition).toHaveBeenLastCalledWith({ x: 500, y: 600 });
    });
  });
});
