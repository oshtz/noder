/**
 * Hook for handling node grouping operations
 * Extracted from App.tsx to reduce component size
 */

import { useCallback, useMemo } from 'react';
import type { Node } from 'reactflow';

// ============================================================================
// Types
// ============================================================================

export interface UseGroupOperationsOptions {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  takeSnapshot: (force?: boolean) => void;
  handleRemoveNode: (nodeId: string) => void;
}

export interface UseGroupOperationsReturn {
  groupSelectedNodes: () => void;
  ungroupNode: (groupId: string) => void;
  handleUngroupSelected: () => void;
  selectedNodes: Node[];
  hasSelection: boolean;
  hasGroupSelected: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGroupOperations({
  nodes,
  setNodes,
  takeSnapshot,
  handleRemoveNode,
}: UseGroupOperationsOptions): UseGroupOperationsReturn {
  /**
   * Get currently selected nodes
   */
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  /**
   * Check if we have enough nodes selected for grouping
   */
  const hasSelection = selectedNodes.length >= 2;

  /**
   * Check if any selected node is a group
   */
  const hasGroupSelected = useMemo(
    () => selectedNodes.some((n) => n.type === 'group'),
    [selectedNodes]
  );

  /**
   * Groups the currently selected nodes into a new group
   */
  const groupSelectedNodes = useCallback((): void => {
    const selectedNonGroupNodes = nodes.filter((n) => n.selected && n.type !== 'group');
    if (selectedNonGroupNodes.length < 2) {
      console.log('[Group] Need at least 2 nodes to create a group');
      return;
    }

    takeSnapshot(true);

    // Calculate bounds of selected nodes
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    selectedNonGroupNodes.forEach((node) => {
      const width = node.width || (node.style as { width?: number })?.width || 280;
      const height = node.height || (node.style as { height?: number })?.height || 200;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    });

    const padding = 40;
    const groupId = `group-${Date.now()}`;
    const groupPosition = { x: minX - padding, y: minY - padding };
    const groupWidth = maxX - minX + padding * 2;
    const groupHeight = maxY - minY + padding * 2 + 40;

    const groupNode: Node = {
      id: groupId,
      type: 'group',
      position: groupPosition,
      data: {
        label: 'Group',
        childCount: selectedNonGroupNodes.length,
        onRemove: handleRemoveNode,
      },
      style: {
        width: groupWidth,
        height: groupHeight,
        zIndex: -1,
      },
    };

    const updatedNodes = nodes.map((node) => {
      if (selectedNonGroupNodes.some((s) => s.id === node.id)) {
        return {
          ...node,
          parentNode: groupId,
          extent: 'parent' as const,
          position: {
            x: node.position.x - groupPosition.x,
            y: node.position.y - groupPosition.y + 40,
          },
          selected: false,
        };
      }
      return { ...node, selected: false };
    });

    setNodes([groupNode, ...updatedNodes]);

    console.log('[Group] Created group with', selectedNonGroupNodes.length, 'nodes');
  }, [nodes, setNodes, takeSnapshot, handleRemoveNode]);

  /**
   * Ungroups a specific group node, releasing its children
   */
  const ungroupNode = useCallback(
    (groupId: string): void => {
      const groupNode = nodes.find((n) => n.id === groupId && n.type === 'group');
      if (!groupNode) return;

      takeSnapshot(true);

      const childNodes = nodes.filter((n) => n.parentNode === groupId);

      const updatedNodes = nodes
        .filter((n) => n.id !== groupId)
        .map((node) => {
          if (node.parentNode === groupId) {
            return {
              ...node,
              parentNode: undefined,
              extent: undefined,
              position: {
                x: node.position.x + groupNode.position.x,
                y: node.position.y + groupNode.position.y - 40,
              },
            };
          }
          return node;
        });

      setNodes(updatedNodes);

      console.log('[Group] Ungrouped', childNodes.length, 'nodes');
    },
    [nodes, setNodes, takeSnapshot]
  );

  /**
   * Ungroups the first selected group node
   */
  const handleUngroupSelected = useCallback((): void => {
    const selectedGroup = selectedNodes.find((n) => n.type === 'group');
    if (selectedGroup) {
      ungroupNode(selectedGroup.id);
    }
  }, [selectedNodes, ungroupNode]);

  return {
    groupSelectedNodes,
    ungroupNode,
    handleUngroupSelected,
    selectedNodes,
    hasSelection,
    hasGroupSelected,
  };
}
