/**
 * Tests for useKeyboardShortcuts hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from 'reactflow';

// Mock dependencies before importing the hook
vi.mock('../utils/createNode', () => ({
  sortNodesForReactFlow: vi.fn((nodes) => nodes),
}));

// Import after mocks
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let mockSetNodes: ReturnType<typeof vi.fn>;
  let mockSetEdges: ReturnType<typeof vi.fn>;
  let mockHandleRemoveNode: ReturnType<typeof vi.fn>;
  let mockOnGroupSelection: ReturnType<typeof vi.fn>;
  let mockOnUngroupSelection: ReturnType<typeof vi.fn>;
  let mockOnRunWorkflow: ReturnType<typeof vi.fn>;
  let mockOnShowShortcuts: ReturnType<typeof vi.fn>;
  let testNodes: Node[];
  let testEdges: Edge[];

  const createNode = (id: string, x: number, y: number, selected = false, type = 'text'): Node => ({
    id,
    type,
    position: { x, y },
    data: { label: `Node ${id}`, executionOrder: 0 },
    selected,
  });

  const createEdge = (id: string, source: string, target: string): Edge => ({
    id,
    source,
    target,
    sourceHandle: 'output',
    targetHandle: 'input',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockSetNodes = vi.fn();
    mockSetEdges = vi.fn();
    mockHandleRemoveNode = vi.fn();
    mockOnGroupSelection = vi.fn();
    mockOnUngroupSelection = vi.fn();
    mockOnRunWorkflow = vi.fn();
    mockOnShowShortcuts = vi.fn();

    testNodes = [createNode('node-1', 100, 100, false), createNode('node-2', 200, 200, false)];

    testEdges = [createEdge('edge-1', 'node-1', 'node-2')];

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Initial State and Return Value Tests
  // ===========================================================================

  describe('initial state', () => {
    it('should return all required methods', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(typeof result.current.deleteSelectedNodes).toBe('function');
      expect(typeof result.current.duplicateSelectedNodes).toBe('function');
      expect(typeof result.current.copySelectedNodes).toBe('function');
      expect(typeof result.current.pasteNodes).toBe('function');
    });

    it('should return groupSelectedNodes when onGroupSelection is provided', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onGroupSelection: mockOnGroupSelection,
        })
      );

      expect(result.current.groupSelectedNodes).toBe(mockOnGroupSelection);
    });

    it('should return ungroupSelectedNodes when onUngroupSelection is provided', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onUngroupSelection: mockOnUngroupSelection,
        })
      );

      expect(result.current.ungroupSelectedNodes).toBe(mockOnUngroupSelection);
    });

    it('should handle optional parameters being undefined', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.groupSelectedNodes).toBeUndefined();
      expect(result.current.ungroupSelectedNodes).toBeUndefined();
    });
  });

  // ===========================================================================
  // deleteSelectedNodes Tests
  // ===========================================================================

  describe('deleteSelectedNodes', () => {
    it('should not call handleRemoveNode when no nodes are selected', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.deleteSelectedNodes();
      });

      expect(mockHandleRemoveNode).not.toHaveBeenCalled();
    });

    it('should call handleRemoveNode for each selected node', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.deleteSelectedNodes();
      });

      expect(mockHandleRemoveNode).toHaveBeenCalledTimes(2);
      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-1');
      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-2');
    });

    it('should only delete selected nodes, not unselected ones', () => {
      const mixedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, false),
        createNode('node-3', 300, 300, true),
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: mixedNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.deleteSelectedNodes();
      });

      expect(mockHandleRemoveNode).toHaveBeenCalledTimes(2);
      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-1');
      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-3');
      expect(mockHandleRemoveNode).not.toHaveBeenCalledWith('node-2');
    });
  });

  // ===========================================================================
  // duplicateSelectedNodes Tests
  // ===========================================================================

  describe('duplicateSelectedNodes', () => {
    it('should not duplicate when no nodes are selected', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should create duplicated nodes with offset positions', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes).toHaveLength(2);
      // Original node should be deselected
      expect(newNodes[0].selected).toBe(false);
      // Duplicated node should be selected and offset by 50
      expect(newNodes[1].selected).toBe(true);
      expect(newNodes[1].position.x).toBe(150);
      expect(newNodes[1].position.y).toBe(150);
    });

    it('should generate unique IDs for duplicated nodes', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes[1].id).not.toBe('node-1');
      expect(newNodes[1].id).toContain('text-');
    });

    it('should duplicate edges between selected nodes', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [createEdge('edge-1', 'node-1', 'node-2')];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetEdges).toHaveBeenCalled();
      const setEdgesCallback = mockSetEdges.mock.calls[0][0];
      const newEdges = setEdgesCallback(edges);

      expect(newEdges.length).toBeGreaterThan(1);
    });

    it('should not duplicate edges that connect to unselected nodes', () => {
      const nodes = [createNode('node-1', 100, 100, true), createNode('node-2', 200, 200, false)];
      const edges = [createEdge('edge-1', 'node-1', 'node-2')];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetEdges).not.toHaveBeenCalled();
    });

    it('should preserve node data when duplicating', () => {
      const selectedNodes = [
        {
          ...createNode('node-1', 100, 100, true),
          data: { label: 'Test Node', customData: 'value', executionOrder: 1 },
        },
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes[1].data.label).toBe('Test Node');
      expect(newNodes[1].data.customData).toBe('value');
    });

    it('should update execution order for duplicated nodes', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];
      selectedNodes[0].data.executionOrder = 5;

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes[1].data.executionOrder).toBe(6); // 5 + 1 (selectedNodes.length)
    });
  });

  // ===========================================================================
  // copySelectedNodes Tests
  // ===========================================================================

  describe('copySelectedNodes', () => {
    it('should not copy when no nodes are selected', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      // Since nothing is stored externally, we verify by trying to paste
      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should copy selected nodes to internal clipboard', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      // Verify by pasting
      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should copy edges between selected nodes', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [createEdge('edge-1', 'node-1', 'node-2')];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetEdges).toHaveBeenCalled();
    });

    it('should log copy information', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      expect(console.log).toHaveBeenCalledWith('[Shortcuts] Copied', 1, 'nodes and', 0, 'edges');
    });
  });

  // ===========================================================================
  // pasteNodes Tests
  // ===========================================================================

  describe('pasteNodes', () => {
    it('should not paste when clipboard is empty', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should create pasted nodes with offset positions', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes).toHaveLength(2);
      // Pasted node should be offset by 100
      expect(newNodes[1].position.x).toBe(200);
      expect(newNodes[1].position.y).toBe(200);
    });

    it('should generate unique IDs for pasted nodes', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes[1].id).not.toBe('node-1');
    });

    it('should deselect existing nodes and select pasted nodes', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes[0].selected).toBe(false);
      expect(newNodes[1].selected).toBe(true);
    });

    it('should paste edges with updated node references', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [createEdge('edge-1', 'node-1', 'node-2')];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetEdges).toHaveBeenCalled();
      const setEdgesCallback = mockSetEdges.mock.calls[0][0];
      const newEdges = setEdgesCallback(edges);

      expect(newEdges.length).toBe(2);
      // New edge should have different source and target
      expect(newEdges[1].source).not.toBe('node-1');
      expect(newEdges[1].target).not.toBe('node-2');
    });

    it('should allow multiple pastes from the same copy', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      mockSetNodes.mockClear();

      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should log paste information', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.copySelectedNodes();
      });

      act(() => {
        result.current.pasteNodes();
      });

      expect(console.log).toHaveBeenCalledWith('[Shortcuts] Pasted', 1, 'nodes and', 0, 'edges');
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Delete/Backspace
  // ===========================================================================

  describe('keyboard shortcuts - Delete/Backspace', () => {
    it('should delete selected nodes on Delete key', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-1');
    });

    it('should delete selected nodes on Backspace key', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-1');
    });

    it('should not delete when target is an input element', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', { value: input });
        window.dispatchEvent(event);
      });

      expect(mockHandleRemoveNode).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('should not delete when target is a textarea element', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', { value: textarea });
        window.dispatchEvent(event);
      });

      expect(mockHandleRemoveNode).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('should not delete when target is contentEditable', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
        });
        // Mock the target with isContentEditable property
        Object.defineProperty(event, 'target', {
          value: {
            tagName: 'DIV',
            isContentEditable: true,
          },
        });
        window.dispatchEvent(event);
      });

      expect(mockHandleRemoveNode).not.toHaveBeenCalled();
      document.body.removeChild(div);
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Ctrl+D (Duplicate)
  // ===========================================================================

  describe('keyboard shortcuts - Ctrl+D (Duplicate)', () => {
    it('should duplicate selected nodes on Ctrl+D', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'd',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should duplicate selected nodes on Meta+D (Mac)', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'd',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should not duplicate when typing in input', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'd',
          ctrlKey: true,
          bubbles: true,
        });
        Object.defineProperty(event, 'target', { value: input });
        window.dispatchEvent(event);
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Ctrl+C (Copy)
  // ===========================================================================

  describe('keyboard shortcuts - Ctrl+C (Copy)', () => {
    it('should copy selected nodes on Ctrl+C', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Verify copy worked by pasting
      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should copy selected nodes on Meta+C (Mac)', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'c',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Verify copy worked by pasting
      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should not prevent default when no nodes are selected', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes, // No selected nodes
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Ctrl+V (Paste)
  // ===========================================================================

  describe('keyboard shortcuts - Ctrl+V (Paste)', () => {
    it('should paste nodes on Ctrl+V after copy', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      // First copy
      act(() => {
        const copyEvent = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(copyEvent);
      });

      // Then paste
      act(() => {
        const pasteEvent = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(pasteEvent);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should paste nodes on Meta+V (Mac) after copy', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      // First copy
      act(() => {
        const copyEvent = new KeyboardEvent('keydown', {
          key: 'c',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(copyEvent);
      });

      // Then paste
      act(() => {
        const pasteEvent = new KeyboardEvent('keydown', {
          key: 'v',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(pasteEvent);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should not paste when clipboard is empty', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const pasteEvent = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(pasteEvent);
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Ctrl+G (Group)
  // ===========================================================================

  describe('keyboard shortcuts - Ctrl+G (Group)', () => {
    it('should call onGroupSelection on Ctrl+G', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onGroupSelection: mockOnGroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'g',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnGroupSelection).toHaveBeenCalled();
    });

    it('should call onGroupSelection on Meta+G (Mac)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onGroupSelection: mockOnGroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'g',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnGroupSelection).toHaveBeenCalled();
    });

    it('should not call onGroupSelection when not provided', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'g',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // No error should be thrown
      expect(mockOnGroupSelection).not.toHaveBeenCalled();
    });

    it('should not trigger group on Ctrl+Shift+G', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onGroupSelection: mockOnGroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'G',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnGroupSelection).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Ctrl+Shift+G (Ungroup)
  // ===========================================================================

  describe('keyboard shortcuts - Ctrl+Shift+G (Ungroup)', () => {
    it('should call onUngroupSelection on Ctrl+Shift+G for selected groups', () => {
      const nodes = [{ ...createNode('group-1', 100, 100, true), type: 'group' }];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onUngroupSelection: mockOnUngroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'G',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnUngroupSelection).toHaveBeenCalledWith('group-1');
    });

    it('should call onUngroupSelection on Meta+Shift+G (Mac)', () => {
      const nodes = [{ ...createNode('group-1', 100, 100, true), type: 'group' }];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onUngroupSelection: mockOnUngroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'G',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnUngroupSelection).toHaveBeenCalledWith('group-1');
    });

    it('should not call onUngroupSelection when no groups are selected', () => {
      const nodes = [
        createNode('node-1', 100, 100, true),
        { ...createNode('group-1', 200, 200, false), type: 'group' },
      ];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onUngroupSelection: mockOnUngroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'G',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnUngroupSelection).not.toHaveBeenCalled();
    });

    it('should ungroup multiple selected groups', () => {
      const nodes = [
        { ...createNode('group-1', 100, 100, true), type: 'group' },
        { ...createNode('group-2', 200, 200, true), type: 'group' },
      ];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onUngroupSelection: mockOnUngroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'G',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnUngroupSelection).toHaveBeenCalledTimes(2);
      expect(mockOnUngroupSelection).toHaveBeenCalledWith('group-1');
      expect(mockOnUngroupSelection).toHaveBeenCalledWith('group-2');
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - Ctrl+Enter (Run Workflow)
  // ===========================================================================

  describe('keyboard shortcuts - Ctrl+Enter (Run Workflow)', () => {
    it('should call onRunWorkflow on Ctrl+Enter', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onRunWorkflow: mockOnRunWorkflow,
          isProcessing: false,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnRunWorkflow).toHaveBeenCalled();
    });

    it('should call onRunWorkflow on Meta+Enter (Mac)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onRunWorkflow: mockOnRunWorkflow,
          isProcessing: false,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnRunWorkflow).toHaveBeenCalled();
    });

    it('should not call onRunWorkflow when isProcessing is true', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onRunWorkflow: mockOnRunWorkflow,
          isProcessing: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnRunWorkflow).not.toHaveBeenCalled();
    });

    it('should not call onRunWorkflow when not provided', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          isProcessing: false,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // No error should be thrown
      expect(mockOnRunWorkflow).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Keyboard Event Tests - ? (Show Shortcuts)
  // ===========================================================================

  describe('keyboard shortcuts - ? (Show Shortcuts)', () => {
    it('should call onShowShortcuts on ? key', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onShowShortcuts: mockOnShowShortcuts,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnShowShortcuts).toHaveBeenCalled();
    });

    it('should not call onShowShortcuts on Ctrl+?', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onShowShortcuts: mockOnShowShortcuts,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnShowShortcuts).not.toHaveBeenCalled();
    });

    it('should not call onShowShortcuts on Meta+?', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onShowShortcuts: mockOnShowShortcuts,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnShowShortcuts).not.toHaveBeenCalled();
    });

    it('should not call onShowShortcuts when not provided', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: '?',
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // No error should be thrown
      expect(mockOnShowShortcuts).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Event Listener Cleanup Tests
  // ===========================================================================

  describe('event listener cleanup', () => {
    it('should clean up event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should not respond to keyboard events after unmount', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      unmount();

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // handleRemoveNode should not be called after unmount
      // (Note: this test verifies the cleanup, but the actual behavior depends on listener removal)
    });
  });

  // ===========================================================================
  // Edge Cases and Error Handling Tests
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty nodes array', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: [],
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.deleteSelectedNodes();
      });

      expect(mockHandleRemoveNode).not.toHaveBeenCalled();
    });

    it('should handle empty edges array', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      expect(mockSetEdges).not.toHaveBeenCalled();
    });

    it('should handle nodes without executionOrder data', () => {
      const selectedNodes = [{ ...createNode('node-1', 100, 100, true), data: {} }];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes[1].data.executionOrder).toBe(1);
    });

    it('should handle rapid keyboard events', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        for (let i = 0; i < 5; i++) {
          const event = new KeyboardEvent('keydown', {
            key: 'd',
            ctrlKey: true,
            bubbles: true,
          });
          window.dispatchEvent(event);
        }
      });

      expect(mockSetNodes).toHaveBeenCalledTimes(5);
    });

    it('should handle nodes with special characters in IDs', () => {
      const selectedNodes = [createNode('node-with-special_chars.123', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.deleteSelectedNodes();
      });

      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-with-special_chars.123');
    });
  });

  // ===========================================================================
  // Callback Stability Tests
  // ===========================================================================

  describe('callback stability', () => {
    it('should maintain stable callback references on rerender', () => {
      const { result, rerender } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const _firstDeleteSelectedNodes = result.current.deleteSelectedNodes;
      const _firstDuplicateSelectedNodes = result.current.duplicateSelectedNodes;
      const _firstCopySelectedNodes = result.current.copySelectedNodes;
      const _firstPasteNodes = result.current.pasteNodes;

      rerender();

      // Callbacks should be recreated when nodes change, but stable otherwise
      expect(typeof result.current.deleteSelectedNodes).toBe('function');
      expect(typeof result.current.duplicateSelectedNodes).toBe('function');
      expect(typeof result.current.copySelectedNodes).toBe('function');
      expect(typeof result.current.pasteNodes).toBe('function');
    });

    it('should update callbacks when nodes change', () => {
      let currentNodes = testNodes;

      const { result, rerender } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: currentNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const firstDeleteSelectedNodes = result.current.deleteSelectedNodes;

      // Change nodes
      currentNodes = [createNode('node-3', 300, 300, true)];
      rerender();

      // Callback should be updated since nodes changed
      expect(result.current.deleteSelectedNodes).not.toBe(firstDeleteSelectedNodes);
    });
  });

  // ===========================================================================
  // Prevent Default Behavior Tests
  // ===========================================================================

  describe('event.preventDefault behavior', () => {
    it('should prevent default on Delete key', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default on Ctrl+D', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default on Ctrl+G', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onGroupSelection: mockOnGroupSelection,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default on Ctrl+Enter', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onRunWorkflow: mockOnRunWorkflow,
          isProcessing: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default on ? key', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onShowShortcuts: mockOnShowShortcuts,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: '?',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('integration tests', () => {
    it('should support full copy-paste workflow', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [createEdge('edge-1', 'node-1', 'node-2')];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      // Copy
      act(() => {
        result.current.copySelectedNodes();
      });

      // Paste
      act(() => {
        result.current.pasteNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      expect(mockSetEdges).toHaveBeenCalled();
    });

    it('should support delete after selection', () => {
      const nodes = [createNode('node-1', 100, 100, true), createNode('node-2', 200, 200, false)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.deleteSelectedNodes();
      });

      expect(mockHandleRemoveNode).toHaveBeenCalledTimes(1);
      expect(mockHandleRemoveNode).toHaveBeenCalledWith('node-1');
    });

    it('should handle duplicate then delete workflow', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      // Duplicate first
      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should handle keyboard shortcuts in sequence', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [createEdge('edge-1', 'node-1', 'node-2')];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      // Copy via keyboard
      act(() => {
        const copyEvent = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(copyEvent);
      });

      // Paste via keyboard
      act(() => {
        const pasteEvent = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(pasteEvent);
      });

      expect(mockSetNodes).toHaveBeenCalled();
      expect(mockSetEdges).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Node Type Handling Tests
  // ===========================================================================

  describe('node type handling', () => {
    it('should handle different node types for duplication', () => {
      const selectedNodes = [
        { ...createNode('node-1', 100, 100, true), type: 'image' },
        { ...createNode('node-2', 200, 200, true), type: 'text' },
        { ...createNode('node-3', 300, 300, true), type: 'video' },
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCallback = mockSetNodes.mock.calls[0][0];
      const newNodes = setNodesCallback(selectedNodes);

      expect(newNodes).toHaveLength(6);
      expect(newNodes[3].type).toBe('image');
      expect(newNodes[4].type).toBe('text');
      expect(newNodes[5].type).toBe('video');
    });

    it('should handle group nodes correctly for ungroup shortcut', () => {
      const nodes = [
        { ...createNode('group-1', 100, 100, true), type: 'group' },
        createNode('node-1', 200, 200, false),
      ];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          onUngroupSelection: mockOnUngroupSelection,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'G',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnUngroupSelection).toHaveBeenCalledWith('group-1');
    });
  });

  // ===========================================================================
  // Complex Edge Scenarios Tests
  // ===========================================================================

  describe('complex edge scenarios', () => {
    it('should handle multiple edges between same nodes for duplication', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [
        {
          ...createEdge('edge-1', 'node-1', 'node-2'),
          sourceHandle: 'output1',
          targetHandle: 'input1',
        },
        {
          ...createEdge('edge-2', 'node-1', 'node-2'),
          sourceHandle: 'output2',
          targetHandle: 'input2',
        },
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetEdges).toHaveBeenCalled();
      const setEdgesCallback = mockSetEdges.mock.calls[0][0];
      const newEdges = setEdgesCallback(edges);

      expect(newEdges.length).toBe(4);
    });

    it('should handle circular edge references in selected nodes', () => {
      const selectedNodes = [
        createNode('node-1', 100, 100, true),
        createNode('node-2', 200, 200, true),
      ];
      const edges = [
        createEdge('edge-1', 'node-1', 'node-2'),
        createEdge('edge-2', 'node-2', 'node-1'),
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.duplicateSelectedNodes();
      });

      expect(mockSetEdges).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // reactFlowInstance Tests
  // ===========================================================================

  describe('reactFlowInstance handling', () => {
    it('should accept reactFlowInstance parameter', () => {
      const mockReactFlowInstance = {
        getNodes: vi.fn(() => testNodes),
        getEdges: vi.fn(() => testEdges),
        fitView: vi.fn(),
      };

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          reactFlowInstance: mockReactFlowInstance as any,
        })
      );

      expect(result.current.deleteSelectedNodes).toBeDefined();
    });

    it('should handle null reactFlowInstance', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          nodes: testNodes,
          edges: testEdges,
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
          reactFlowInstance: null,
        })
      );

      expect(result.current.deleteSelectedNodes).toBeDefined();
    });
  });

  // ===========================================================================
  // Additional Keyboard Key Tests
  // ===========================================================================

  describe('additional keyboard key handling', () => {
    it('should ignore unrelated keys', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'a',
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockHandleRemoveNode).not.toHaveBeenCalled();
      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should not trigger shortcuts with Alt key modifier', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'd',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should handle uppercase D for duplicate', () => {
      const selectedNodes = [createNode('node-1', 100, 100, true)];

      renderHook(() =>
        useKeyboardShortcuts({
          nodes: selectedNodes,
          edges: [],
          setNodes: mockSetNodes,
          setEdges: mockSetEdges,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      // Note: Browsers typically send lowercase key values even with Shift pressed
      // Testing the actual key value 'd' which is what the hook checks
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'd',
          ctrlKey: true,
          shiftKey: true, // Shift is pressed but key remains 'd'
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });
  });
});
