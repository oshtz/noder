import { useCallback } from 'react';
import type { Node, Edge, NodeChange, EdgeChange } from 'reactflow';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { emit } from '../utils/eventBus';
import { deleteFileFromReplicate } from '../utils/replicateFiles';
import { markEdgeGlows } from '../utils/workflowHelpers';
import { getHelperLines } from '../components/HelperLines';
import { nodeCreators } from '../nodes';

export interface NodeOperationsConfig {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setHelperLines: React.Dispatch<
    React.SetStateAction<{ horizontal: number | null; vertical: number | null }>
  >;
  takeSnapshotRef: React.MutableRefObject<((force?: boolean) => void) | null>;
  showWelcome: boolean;
  setShowWelcome: React.Dispatch<React.SetStateAction<boolean>>;
  setWelcomePinned: React.Dispatch<React.SetStateAction<boolean>>;
  defaultTextModel?: string;
  defaultImageModel?: string;
  defaultVideoModel?: string;
  defaultAudioModel?: string;
  defaultUpscalerModel?: string;
}

export interface NodeOperationsResult {
  handleRemoveNode: (nodeId: string) => Promise<void>;
  handleAddNode: (type: string, position?: { x: number; y: number }) => string | null;
  moveNodeOrder: (nodeId: string, direction: 'up' | 'down') => void;
  handleNodesChange: (changes: NodeChange[]) => void;
  handleEdgesChange: (changes: EdgeChange[]) => void;
  handleNodeDragStart: () => void;
  handleNodeDrag: (event: React.MouseEvent, node: Node) => void;
  handleNodeDragStop: () => void;
}

export function useNodeOperations({
  nodes,
  edges: _edges,
  setNodes,
  setEdges,
  selectedNodeId,
  setSelectedNodeId,
  setHelperLines,
  takeSnapshotRef,
  showWelcome,
  setShowWelcome,
  setWelcomePinned,
  defaultTextModel,
  defaultImageModel,
  defaultVideoModel,
  defaultAudioModel,
  defaultUpscalerModel,
}: NodeOperationsConfig): NodeOperationsResult {
  // Node removal handler
  const handleRemoveNode = useCallback(
    async (nodeId: string): Promise<void> => {
      const nodeToRemove = nodes.find((n) => n.id === nodeId);

      if (nodeToRemove?.type === 'media' && nodeToRemove.data.replicateFileId) {
        try {
          await deleteFileFromReplicate(nodeToRemove.data.replicateFileId);
        } catch (error) {
          console.warn(`Failed to cleanup file for node ${nodeId}:`, error);
        }
      }

      setNodes((nds) => {
        const removingNode = nds.find((n) => n.id === nodeId);
        const isGroupNode = removingNode?.type === 'group';

        return nds
          .filter((node) => node.id !== nodeId)
          .map((node) => {
            if (isGroupNode && (node.parentNode === nodeId || node.parentId === nodeId)) {
              const {
                parentNode: _parentNode,
                parentId: _parentId,
                extent: _extent,
                ...cleanNode
              } = node;
              return {
                ...cleanNode,
                position: {
                  x: node.position.x + (removingNode?.position?.x || 0),
                  y: node.position.y + (removingNode?.position?.y || 0) - 40,
                },
              } as Node;
            }
            return node;
          });
      });

      setEdges((eds) =>
        markEdgeGlows(eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
      );
      emit('deleteElements', { nodeId });
    },
    [nodes, setNodes, setEdges]
  );

  // Node addition handler
  const handleAddNode = useCallback(
    (type: string, position: { x: number; y: number } = { x: 100, y: 100 }): string | null => {
      if (showWelcome) {
        setShowWelcome(false);
        setWelcomePinned(false);
      }

      const nodeId = `${type}-${Date.now()}`;
      const createNodeFn = nodeCreators[type];
      if (!createNodeFn) {
        console.error(`No creator function found for node type: ${type}`);
        return null;
      }

      const highestOrder = nodes.reduce(
        (max, node) => Math.max(max, node.data.executionOrder || 0),
        0
      );

      const defaultModelMap: Record<string, string | undefined> = {
        text: defaultTextModel,
        image: defaultImageModel,
        video: defaultVideoModel,
        audio: defaultAudioModel,
        upscaler: defaultUpscalerModel,
      };

      const newNode = createNodeFn({
        id: nodeId,
        handleRemoveNode: handleRemoveNode,
        position: position,
        defaultModel: defaultModelMap[type],
        data: {
          executionOrder: highestOrder + 1,
        },
      });

      setNodes((nds) => nds.concat(newNode as Node));
      return nodeId;
    },
    [
      handleRemoveNode,
      nodes,
      setNodes,
      showWelcome,
      setShowWelcome,
      setWelcomePinned,
      defaultTextModel,
      defaultImageModel,
      defaultVideoModel,
      defaultAudioModel,
      defaultUpscalerModel,
    ]
  );

  // Move node order handler
  const moveNodeOrder = useCallback(
    (nodeId: string, direction: 'up' | 'down'): void => {
      setNodes((nds) => {
        const sortedNodes = [...nds].sort(
          (a, b) => (a.data.executionOrder || 0) - (b.data.executionOrder || 0)
        );
        const nodeIndex = sortedNodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) return nds;

        let newIndex = nodeIndex;
        if (direction === 'up' && nodeIndex > 0) newIndex = nodeIndex - 1;
        else if (direction === 'down' && nodeIndex < sortedNodes.length - 1) {
          newIndex = nodeIndex + 1;
        }

        if (newIndex !== nodeIndex) {
          const nodeA = sortedNodes[nodeIndex];
          const nodeB = sortedNodes[newIndex];
          if (nodeA && nodeB) {
            sortedNodes[nodeIndex] = nodeB;
            sortedNodes[newIndex] = nodeA;
          }
        }

        return sortedNodes.map((node, idx) => ({
          ...node,
          data: { ...node.data, executionOrder: idx + 1 },
        }));
      });
    },
    [setNodes]
  );

  // Handle nodes change
  const handleNodesChange = useCallback(
    (changes: NodeChange[]): void => {
      const hasStructuralChange = changes.some((c) => c.type === 'add' || c.type === 'remove');

      setNodes((nds) => {
        let updatedNodes = applyNodeChanges(changes, nds as Node[]) as Node[];

        const removedGroupIds = changes
          .filter((c) => c.type === 'remove')
          .map((c) => c.id)
          .filter((id) => nds.find((n) => n.id === id)?.type === 'group');

        if (removedGroupIds.length > 0) {
          updatedNodes = updatedNodes.map((node) => {
            const parentId = node.parentNode || node.parentId;
            if (parentId && removedGroupIds.includes(parentId)) {
              const removedGroup = nds.find((n) => n.id === parentId);
              const {
                parentNode: _parentNode2,
                parentId: _pId,
                extent: _extent2,
                ...cleanNode
              } = node;
              return {
                ...cleanNode,
                position: {
                  x: node.position.x + (removedGroup?.position?.x || 0),
                  y: node.position.y + (removedGroup?.position?.y || 0) - 40,
                },
              } as Node;
            }
            return node;
          });
        }

        return updatedNodes;
      });

      changes.forEach((change) => {
        if (change.type === 'select') {
          if (change.selected) setSelectedNodeId(change.id);
          else if (selectedNodeId === change.id) setSelectedNodeId(null);
        }
      });

      if (hasStructuralChange) takeSnapshotRef.current?.(true);
    },
    [selectedNodeId, setSelectedNodeId, setNodes, takeSnapshotRef]
  );

  // Handle edges change
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]): void => {
      const hasRemovals = changes.some((c) => c.type === 'remove');
      const hasAdditions = changes.some((c) => c.type === 'add');

      changes.forEach((change) => {
        if (change.type === 'remove') emit('deleteEdge', { edgeId: change.id });
      });

      if (hasRemovals || hasAdditions) takeSnapshotRef.current?.(true);

      setEdges((eds) => {
        const updatedEdges = applyEdgeChanges(changes, eds as Edge[]) as Edge[];
        return hasRemovals ? markEdgeGlows(updatedEdges) : updatedEdges;
      });

      emit('edgesChange', { changes });
      if (hasRemovals) emit('deleteElements', { changes });
    },
    [setEdges, takeSnapshotRef]
  );

  // Node drag handlers
  const handleNodeDragStart = useCallback(() => takeSnapshotRef.current?.(true), [takeSnapshotRef]);

  const handleNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node): void => {
      const { horizontal, vertical, snapPosition } = getHelperLines(node, nodes as Node[]);
      setHelperLines({ horizontal, vertical });
      if (snapPosition) {
        setNodes((nds) =>
          nds.map((n) => (n.id === node.id ? { ...n, position: snapPosition } : n))
        );
      }
    },
    [nodes, setNodes, setHelperLines]
  );

  const handleNodeDragStop = useCallback(() => {
    setHelperLines({ horizontal: null, vertical: null });
  }, [setHelperLines]);

  return {
    handleRemoveNode,
    handleAddNode,
    moveNodeOrder,
    handleNodesChange,
    handleEdgesChange,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
  };
}
