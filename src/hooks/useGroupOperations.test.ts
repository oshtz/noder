/**
 * Tests for useGroupOperations hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGroupOperations } from './useGroupOperations';
import type { Node } from 'reactflow';

// Mock console.log
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('useGroupOperations', () => {
  const mockSetNodes = vi.fn();
  const mockTakeSnapshot = vi.fn();
  const mockHandleRemoveNode = vi.fn();

  const createNode = (id: string, x: number, y: number, selected = false, type = 'text'): Node => ({
    id,
    type,
    position: { x, y },
    data: { label: `Node ${id}` },
    selected,
    width: 280,
    height: 200,
  });

  const createGroupNode = (id: string, x: number, y: number, selected = false): Node => ({
    id,
    type: 'group',
    position: { x, y },
    data: { label: 'Group', childCount: 2 },
    selected,
    style: { width: 400, height: 300 },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectedNodes', () => {
    it('should return empty array when no nodes are selected', () => {
      const nodes = [createNode('1', 0, 0, false), createNode('2', 100, 0, false)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.selectedNodes).toEqual([]);
    });

    it('should return selected nodes', () => {
      const nodes = [
        createNode('1', 0, 0, true),
        createNode('2', 100, 0, false),
        createNode('3', 200, 0, true),
      ];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.selectedNodes).toHaveLength(2);
      expect(result.current.selectedNodes.map((n) => n.id)).toEqual(['1', '3']);
    });
  });

  describe('hasSelection', () => {
    it('should return false when less than 2 nodes selected', () => {
      const nodes = [createNode('1', 0, 0, true), createNode('2', 100, 0, false)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.hasSelection).toBe(false);
    });

    it('should return true when 2 or more nodes selected', () => {
      const nodes = [createNode('1', 0, 0, true), createNode('2', 100, 0, true)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.hasSelection).toBe(true);
    });
  });

  describe('hasGroupSelected', () => {
    it('should return false when no group node selected', () => {
      const nodes = [createNode('1', 0, 0, true), createNode('2', 100, 0, true)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.hasGroupSelected).toBe(false);
    });

    it('should return true when group node is selected', () => {
      const nodes = [createNode('1', 0, 0, true), createGroupNode('group-1', 0, 0, true)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.hasGroupSelected).toBe(true);
    });
  });

  describe('groupSelectedNodes', () => {
    it('should not create group with less than 2 non-group nodes', () => {
      const nodes = [createNode('1', 0, 0, true)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
      expect(mockTakeSnapshot).not.toHaveBeenCalled();
    });

    it('should create group from selected nodes', () => {
      const nodes = [
        createNode('1', 0, 0, true),
        createNode('2', 300, 0, true),
        createNode('3', 600, 0, false),
      ];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      expect(mockTakeSnapshot).toHaveBeenCalledWith(true);
      expect(mockSetNodes).toHaveBeenCalled();

      // Check the nodes passed to setNodes
      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];

      // First node should be the group
      expect(newNodes[0].type).toBe('group');
      expect(newNodes[0].id).toMatch(/^group-/);

      // Selected nodes should have parentNode set
      const node1 = newNodes.find((n) => n.id === '1');
      const node2 = newNodes.find((n) => n.id === '2');
      expect(node1?.parentNode).toBe(newNodes[0].id);
      expect(node2?.parentNode).toBe(newNodes[0].id);
      expect(node1?.extent).toBe('parent');
      expect(node2?.extent).toBe('parent');

      // Unselected node should remain unchanged
      const node3 = newNodes.find((n) => n.id === '3');
      expect(node3?.parentNode).toBeUndefined();
    });

    it('should calculate correct group bounds', () => {
      const nodes = [
        { ...createNode('1', 100, 100, true), width: 100, height: 80 },
        { ...createNode('2', 300, 200, true), width: 100, height: 80 },
      ];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];
      const groupNode = newNodes[0];

      // Group should encompass all nodes with padding
      // minX = 100, minY = 100, maxX = 400, maxY = 280
      // padding = 40
      expect(groupNode.position.x).toBe(60); // 100 - 40
      expect(groupNode.position.y).toBe(60); // 100 - 40
    });

    it('should exclude group nodes from selection', () => {
      const nodes = [
        createNode('1', 0, 0, true),
        createNode('2', 100, 0, true),
        createGroupNode('existing-group', 200, 0, true),
      ];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];

      // The existing group should not have parentNode
      const existingGroup = newNodes.find((n) => n.id === 'existing-group');
      expect(existingGroup?.parentNode).toBeUndefined();
    });

    it('should deselect all nodes after grouping', () => {
      const nodes = [createNode('1', 0, 0, true), createNode('2', 100, 0, true)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];

      // All nodes should be deselected (either false or undefined)
      newNodes.forEach((node) => {
        expect(node.selected).toBeFalsy();
      });
    });
  });

  describe('ungroupNode', () => {
    it('should do nothing if group not found', () => {
      const nodes = [createNode('1', 0, 0, false)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.ungroupNode('nonexistent-group');
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should ungroup children and remove group node', () => {
      const groupNode = createGroupNode('group-1', 100, 100, false);
      const childNode1: Node = {
        ...createNode('child-1', 50, 90, false),
        parentNode: 'group-1',
        extent: 'parent',
      };
      const childNode2: Node = {
        ...createNode('child-2', 150, 90, false),
        parentNode: 'group-1',
        extent: 'parent',
      };
      const nodes = [groupNode, childNode1, childNode2];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.ungroupNode('group-1');
      });

      expect(mockTakeSnapshot).toHaveBeenCalledWith(true);
      expect(mockSetNodes).toHaveBeenCalled();

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];

      // Group node should be removed
      expect(newNodes.find((n) => n.id === 'group-1')).toBeUndefined();

      // Children should have parentNode removed
      const child1 = newNodes.find((n) => n.id === 'child-1');
      const child2 = newNodes.find((n) => n.id === 'child-2');
      expect(child1?.parentNode).toBeUndefined();
      expect(child2?.parentNode).toBeUndefined();
      expect(child1?.extent).toBeUndefined();
      expect(child2?.extent).toBeUndefined();
    });

    it('should restore child positions to absolute', () => {
      const groupNode = createGroupNode('group-1', 100, 100, false);
      const childNode: Node = {
        ...createNode('child-1', 50, 90, false), // Relative to group
        parentNode: 'group-1',
        extent: 'parent',
      };
      const nodes = [groupNode, childNode];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.ungroupNode('group-1');
      });

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];
      const child = newNodes.find((n) => n.id === 'child-1');

      // Position should be converted back to absolute
      // x = 50 + 100 = 150, y = 90 + 100 - 40 = 150
      expect(child?.position.x).toBe(150);
      expect(child?.position.y).toBe(150);
    });
  });

  describe('handleUngroupSelected', () => {
    it('should do nothing if no group selected', () => {
      const nodes = [createNode('1', 0, 0, true), createNode('2', 100, 0, true)];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.handleUngroupSelected();
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should ungroup the first selected group', () => {
      const groupNode = createGroupNode('group-1', 100, 100, true);
      const childNode: Node = {
        ...createNode('child-1', 50, 90, false),
        parentNode: 'group-1',
        extent: 'parent',
      };
      const nodes = [groupNode, childNode];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.handleUngroupSelected();
      });

      expect(mockTakeSnapshot).toHaveBeenCalledWith(true);
      expect(mockSetNodes).toHaveBeenCalled();

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];
      expect(newNodes.find((n) => n.id === 'group-1')).toBeUndefined();
    });

    it('should only ungroup first selected group when multiple groups selected', () => {
      const groupNode1 = createGroupNode('group-1', 0, 0, true);
      const groupNode2 = createGroupNode('group-2', 500, 0, true);
      const nodes = [groupNode1, groupNode2];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.handleUngroupSelected();
      });

      expect(mockSetNodes).toHaveBeenCalledTimes(1);

      const newNodes = mockSetNodes.mock.calls[0][0] as Node[];
      // Only first group should be removed
      expect(newNodes.find((n) => n.id === 'group-1')).toBeUndefined();
      expect(newNodes.find((n) => n.id === 'group-2')).toBeDefined();
    });
  });

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const nodes = [createNode('1', 0, 0, false)];

      const { result, rerender } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      const firstGroupSelectedNodes = result.current.groupSelectedNodes;
      const firstUngroupNode = result.current.ungroupNode;
      const firstHandleUngroupSelected = result.current.handleUngroupSelected;

      rerender();

      // Callbacks should be memoized
      expect(result.current.groupSelectedNodes).toBe(firstGroupSelectedNodes);
      expect(result.current.ungroupNode).toBe(firstUngroupNode);
      expect(result.current.handleUngroupSelected).toBe(firstHandleUngroupSelected);
    });

    it('should update callbacks when nodes change', () => {
      let nodes = [createNode('1', 0, 0, false)];

      const { result, rerender } = renderHook(
        ({ nodes: n }) =>
          useGroupOperations({
            nodes: n,
            setNodes: mockSetNodes,
            takeSnapshot: mockTakeSnapshot,
            handleRemoveNode: mockHandleRemoveNode,
          }),
        { initialProps: { nodes } }
      );

      const firstGroupSelectedNodes = result.current.groupSelectedNodes;

      // Update nodes
      nodes = [createNode('1', 0, 0, false), createNode('2', 100, 0, true)];
      rerender({ nodes });

      // Callback should be updated since nodes changed
      expect(result.current.groupSelectedNodes).not.toBe(firstGroupSelectedNodes);
    });
  });

  describe('edge cases', () => {
    it('should handle empty nodes array', () => {
      const { result } = renderHook(() =>
        useGroupOperations({
          nodes: [],
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      expect(result.current.selectedNodes).toEqual([]);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.hasGroupSelected).toBe(false);
    });

    it('should handle nodes with custom dimensions from style', () => {
      const nodes = [
        {
          ...createNode('1', 0, 0, true),
          width: undefined,
          height: undefined,
          style: { width: 150, height: 100 },
        },
        {
          ...createNode('2', 200, 0, true),
          width: undefined,
          height: undefined,
          style: { width: 150, height: 100 },
        },
      ];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should use default dimensions when none specified', () => {
      const nodes = [
        {
          ...createNode('1', 0, 0, true),
          width: undefined,
          height: undefined,
          style: {},
        },
        {
          ...createNode('2', 100, 0, true),
          width: undefined,
          height: undefined,
          style: {},
        },
      ];

      const { result } = renderHook(() =>
        useGroupOperations({
          nodes,
          setNodes: mockSetNodes,
          takeSnapshot: mockTakeSnapshot,
          handleRemoveNode: mockHandleRemoveNode,
        })
      );

      act(() => {
        result.current.groupSelectedNodes();
      });

      // Should use default 280x200 dimensions
      expect(mockSetNodes).toHaveBeenCalled();
    });
  });
});
