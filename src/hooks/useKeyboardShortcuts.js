import { useCallback, useEffect, useRef } from 'react';
import { sortNodesForReactFlow } from '../utils/createNode';

/**
 * Hook for handling keyboard shortcuts in the workflow editor
 *
 * Shortcuts:
 * - Delete/Backspace: Delete selected nodes
 * - Ctrl+D: Duplicate selected nodes
 * - Ctrl+C: Copy selected nodes
 * - Ctrl+V: Paste copied nodes
 * - Ctrl+G: Group selected nodes
 * - Ctrl+Shift+G: Ungroup selected group
 * - Ctrl+Enter: Run workflow
 */
export const useKeyboardShortcuts = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  handleRemoveNode,
  reactFlowInstance,
  onGroupSelection,
  onUngroupSelection,
  onRunWorkflow,
  isProcessing
}) => {
  const clipboardRef = useRef({ nodes: [], edges: [] });

  // Get selected nodes
  const getSelectedNodes = useCallback(() => {
    return nodes.filter(node => node.selected);
  }, [nodes]);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return;

    selectedNodes.forEach(node => {
      handleRemoveNode(node.id);
    });
  }, [getSelectedNodes, handleRemoveNode]);

  // Duplicate selected nodes
  const duplicateSelectedNodes = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return;

    const offset = 50; // Offset for duplicated nodes
    const nodeIdMap = new Map(); // Map old IDs to new IDs

    // Create duplicated nodes
    const duplicatedNodes = selectedNodes.map(node => {
      const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      nodeIdMap.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset
        },
        selected: true,
        data: {
          ...node.data,
          executionOrder: (node.data.executionOrder || 0) + selectedNodes.length
        }
      };
    });

    // Find edges between selected nodes and duplicate them
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const edgesToDuplicate = edges.filter(
      edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    const duplicatedEdges = edgesToDuplicate.map(edge => ({
      ...edge,
      id: `e${nodeIdMap.get(edge.source)}-${edge.sourceHandle}-${nodeIdMap.get(edge.target)}-${edge.targetHandle}`,
      source: nodeIdMap.get(edge.source),
      target: nodeIdMap.get(edge.target)
    }));

    // Deselect original nodes, add duplicated nodes
    // Sort to ensure parent/group nodes come before children
    setNodes(nds => sortNodesForReactFlow([
      ...nds.map(n => ({ ...n, selected: false })),
      ...duplicatedNodes
    ]));

    if (duplicatedEdges.length > 0) {
      setEdges(eds => [...eds, ...duplicatedEdges]);
    }
  }, [getSelectedNodes, edges, setNodes, setEdges]);

  // Copy selected nodes to clipboard
  const copySelectedNodes = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const edgesToCopy = edges.filter(
      edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    clipboardRef.current = {
      nodes: selectedNodes.map(node => ({
        ...node,
        // Store relative position from first node for paste offset
        _originalId: node.id
      })),
      edges: edgesToCopy
    };

    console.log('[Shortcuts] Copied', selectedNodes.length, 'nodes and', edgesToCopy.length, 'edges');
  }, [getSelectedNodes, edges]);

  // Paste nodes from clipboard
  const pasteNodes = useCallback(() => {
    const { nodes: clipboardNodes, edges: clipboardEdges } = clipboardRef.current;
    if (clipboardNodes.length === 0) return;

    const offset = 100; // Offset for pasted nodes
    const nodeIdMap = new Map();

    // Create new nodes with new IDs
    const pastedNodes = clipboardNodes.map(node => {
      const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      nodeIdMap.set(node._originalId, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset
        },
        selected: true,
        _originalId: undefined,
        data: {
          ...node.data,
          executionOrder: (node.data.executionOrder || 0) + nodes.length
        }
      };
    });

    // Create new edges with updated node references
    const pastedEdges = clipboardEdges.map(edge => ({
      ...edge,
      id: `e${nodeIdMap.get(edge.source) || edge.source}-${edge.sourceHandle}-${nodeIdMap.get(edge.target) || edge.target}-${edge.targetHandle}`,
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target
    }));

    // Deselect existing nodes, add pasted nodes
    // Sort to ensure parent/group nodes come before children
    setNodes(nds => sortNodesForReactFlow([
      ...nds.map(n => ({ ...n, selected: false })),
      ...pastedNodes
    ]));

    if (pastedEdges.length > 0) {
      setEdges(eds => [...eds, ...pastedEdges]);
    }

    console.log('[Shortcuts] Pasted', pastedNodes.length, 'nodes and', pastedEdges.length, 'edges');
  }, [nodes, setNodes, setEdges]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = event.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Delete/Backspace - Delete selected nodes
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedNodes();
        return;
      }

      // Ctrl/Cmd + D - Duplicate
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        duplicateSelectedNodes();
        return;
      }

      // Ctrl/Cmd + C - Copy
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        // Only prevent default if we have selected nodes (let browser handle text copy otherwise)
        const selectedNodes = getSelectedNodes();
        if (selectedNodes.length > 0) {
          event.preventDefault();
          copySelectedNodes();
        }
        return;
      }

      // Ctrl/Cmd + V - Paste
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        // Only handle paste if we have nodes in clipboard
        if (clipboardRef.current.nodes.length > 0) {
          event.preventDefault();
          pasteNodes();
        }
        return;
      }

      // Ctrl/Cmd + G - Group selected nodes
      if ((event.ctrlKey || event.metaKey) && event.key === 'g' && !event.shiftKey) {
        event.preventDefault();
        onGroupSelection?.();
        return;
      }

      // Ctrl/Cmd + Shift + G - Ungroup selected group
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'G') {
        event.preventDefault();
        const selectedGroups = nodes.filter(n => n.selected && n.type === 'group');
        if (selectedGroups.length > 0 && onUngroupSelection) {
          selectedGroups.forEach(group => onUngroupSelection(group.id));
        }
        return;
      }

      // Ctrl/Cmd + Enter - Run workflow
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!isProcessing && onRunWorkflow) {
          onRunWorkflow();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedNodes, duplicateSelectedNodes, copySelectedNodes, pasteNodes, getSelectedNodes, nodes, onGroupSelection, onUngroupSelection, onRunWorkflow, isProcessing]);

  return {
    deleteSelectedNodes,
    duplicateSelectedNodes,
    copySelectedNodes,
    pasteNodes,
    groupSelectedNodes: onGroupSelection,
    ungroupSelectedNodes: onUngroupSelection
  };
};
