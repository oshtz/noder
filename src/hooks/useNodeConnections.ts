/**
 * Hook for handling node connection logic
 * Extracted from App.tsx to reduce component size
 */

import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge, Connection, OnConnectStartParams } from 'reactflow';
import { addEdge } from 'reactflow';
import { validateEdges } from '../utils/handleValidation';
import { emit, on } from '../utils/eventBus';
import { markEdgeGlows } from '../utils/workflowHelpers';
import { nodeTypes as registeredNodeTypes } from '../nodes';
import type { ValidationError } from '../types/components';

// ============================================================================
// Types
// ============================================================================

interface HandleDefinition {
  id: string;
  type: string;
  dataType?: string;
}

interface NodeTypeDefinition {
  component: React.ComponentType;
  defaultData?: {
    handles?: HandleDefinition[];
  };
  handles?: HandleDefinition[];
}

export interface UseNodeConnectionsOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  edgeType: string;
  moveNodeOrder: (nodeId: string, direction: 'up' | 'down') => void;
}

export interface UseNodeConnectionsReturn {
  connectingNodeId: string | null;
  connectingHandleId: string | null;
  connectingHandleType: string | null;
  onConnectStart: (
    event: React.MouseEvent | React.TouchEvent,
    params: OnConnectStartParams
  ) => void;
  onConnectEnd: (event: MouseEvent | TouchEvent) => void;
  onConnect: (params: Connection) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useNodeConnections({
  nodes,
  edges: _edges,
  setNodes,
  setEdges,
  setValidationErrors,
  edgeType,
  moveNodeOrder,
}: UseNodeConnectionsOptions): UseNodeConnectionsReturn {
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [connectingHandleId, setConnectingHandleId] = useState<string | null>(null);
  const [connectingHandleType, setConnectingHandleType] = useState<string | null>(null);

  /**
   * Handles connection start
   */
  const onConnectStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent, params: OnConnectStartParams): void => {
      const { nodeId, handleId, handleType } = params;
      console.log('[onConnectStart] Starting connection from:', { nodeId, handleId, handleType });

      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (sourceNode) {
        console.log('[onConnectStart] Source node:', sourceNode);
        console.log('[onConnectStart] Source node data.handles:', sourceNode.data?.handles);

        let handles = (sourceNode.data?.handles || []) as HandleDefinition[];
        let handle = handles.find((h: HandleDefinition) => h.id === handleId);

        if (!handle || !handle.dataType) {
          const nodeDef = registeredNodeTypes[sourceNode.type as string] as
            | NodeTypeDefinition
            | undefined;
          console.log('[onConnectStart] Node definition:', nodeDef);
          handles = nodeDef?.defaultData?.handles || [];
          handle = handles.find((h: HandleDefinition) => h.id === handleId);
        }

        const dataType = handle?.dataType;
        console.log('[onConnectStart] Found handle:', handle);
        console.log('[onConnectStart] Handle data type:', dataType);

        setConnectingNodeId(nodeId || null);
        setConnectingHandleId(handleId || null);
        setConnectingHandleType(dataType || handleType || null);
      } else {
        setConnectingNodeId(nodeId || null);
        setConnectingHandleId(handleId || null);
        setConnectingHandleType(handleType || null);
      }
    },
    [nodes]
  );

  /**
   * Handles connection end (drop on empty space)
   */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent): void => {
      console.log('[onConnectEnd] Event:', event);
      console.log('[onConnectEnd] Connecting from:', {
        connectingNodeId,
        connectingHandleId,
        connectingHandleType,
      });

      if (!connectingNodeId || !connectingHandleId) {
        console.log('[onConnectEnd] No connection information available');
        setConnectingNodeId(null);
        setConnectingHandleId(null);
        setConnectingHandleType(null);
        return;
      }

      const target = event.target as HTMLElement;
      const targetIsPane = target.classList.contains('react-flow__pane');
      const targetIsRenderer = target.classList.contains('react-flow__renderer');
      const targetIsEdgeLayer = target.classList.contains('react-flow__edges');

      console.log('[onConnectEnd] Target classes:', target.className);
      console.log(
        '[onConnectEnd] Is pane/renderer/edges:',
        targetIsPane,
        targetIsRenderer,
        targetIsEdgeLayer
      );

      if (!targetIsPane && !targetIsRenderer && !targetIsEdgeLayer) {
        console.log('[onConnectEnd] Not dropped on empty space');
        setConnectingNodeId(null);
        setConnectingHandleId(null);
        setConnectingHandleType(null);
        return;
      }

      const sourceNode = nodes.find((n) => n.id === connectingNodeId);
      if (!sourceNode) {
        console.log('[onConnectEnd] Source node not found');
        setConnectingNodeId(null);
        setConnectingHandleId(null);
        setConnectingHandleType(null);
        return;
      }

      console.log('[onConnectEnd] Source node:', sourceNode.id);
      console.log('[onConnectEnd] Source handle:', connectingHandleId);
      console.log('[onConnectEnd] Handle type:', connectingHandleType);

      const clientX =
        'clientX' in event ? event.clientX : (event as TouchEvent).touches?.[0]?.clientX || 0;
      const clientY =
        'clientY' in event ? event.clientY : (event as TouchEvent).touches?.[0]?.clientY || 0;

      const flowWrapper = document.querySelector('.react-flow__renderer');
      const bounds = flowWrapper?.getBoundingClientRect();

      if (bounds) {
        const relativeX = clientX - bounds.left;
        const relativeY = clientY - bounds.top;

        console.log('[onConnectEnd] Opening NodeSelector at:', {
          screenX: clientX,
          screenY: clientY,
          relativeX,
          relativeY,
        });

        emit('openNodeSelector', {
          position: { x: clientX, y: clientY },
          clickPosition: { x: relativeX, y: relativeY },
          connectionContext: {
            sourceNode: sourceNode.id,
            sourceHandle: connectingHandleId,
            handleType: connectingHandleType,
          },
        });
      }

      setConnectingNodeId(null);
      setConnectingHandleId(null);
      setConnectingHandleType(null);
    },
    [nodes, connectingNodeId, connectingHandleId, connectingHandleType]
  );

  /**
   * Handles connection creation
   */
  const onConnect = useCallback(
    (params: Connection): void => {
      const newEdge: Edge = {
        ...params,
        id: `e${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}`,
        source: params.source || '',
        target: params.target || '',
        type: 'custom',
        animated: false,
        data: {
          isProcessing: false,
          edgeType,
        },
      };

      const validationResults = validateEdges([newEdge], nodes);
      if (validationResults.validationErrors.length > 0) {
        setValidationErrors((prev) => [
          ...prev,
          ...(validationResults.validationErrors as unknown as ValidationError[]),
        ]);
        return;
      }

      setEdges((eds) => {
        const updatedEdges = addEdge(newEdge, eds);
        return markEdgeGlows(updatedEdges);
      });

      emit('nodeConnection', {
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      });
      emit('connect', { params });
    },
    [nodes, edgeType, setEdges, setValidationErrors]
  );

  /**
   * Event listener subscriptions for connection-related events
   */
  useEffect(() => {
    const handleDeleteEdge = (event: { detail: { edgeId: string } }): void => {
      const { edgeId } = event.detail;
      setEdges((eds) => markEdgeGlows(eds.filter((edge) => edge.id !== edgeId)));
    };

    const handleMoveNodeOrder = (event: {
      detail: { nodeId: string; direction: 'up' | 'down' };
    }): void => {
      const { nodeId, direction } = event.detail;
      moveNodeOrder(nodeId, direction);
    };

    const handleNodeProcessingComplete = (event: { detail: { nodeId: string } }): void => {
      const { nodeId } = event.detail;
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          className:
            n.id === nodeId
              ? (n.className || 'react-flow__node-resizable').replace(' processing', '')
              : n.className,
        }))
      );
    };

    const handleNodeDataUpdated = (event: {
      detail: { nodeId: string; updates: Record<string, unknown> };
    }): void => {
      const { nodeId, updates } = event.detail;
      console.log('[App] Node data updated:', { nodeId, updates });
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
      );
    };

    const handleAutoConnect = (event: {
      detail: {
        source: string;
        sourceHandle: string;
        target: string;
        handleType: string;
      };
    }): void => {
      const { source, sourceHandle, target, handleType } = event.detail;

      console.log('[handleAutoConnect] Attempting auto-connect:', {
        source,
        sourceHandle,
        target,
        handleType,
      });

      const targetNode = nodes.find((n) => n.id === target);
      if (!targetNode) {
        console.log('[handleAutoConnect] Target node not found:', target);
        return;
      }

      console.log('[handleAutoConnect] Target node found:', targetNode);

      const targetNodeDef = registeredNodeTypes[targetNode.type as string] as
        | NodeTypeDefinition
        | undefined;
      if (!targetNodeDef) {
        console.log('[handleAutoConnect] Node definition not found for type:', targetNode.type);
        return;
      }

      const handles = targetNode.data?.handles || targetNodeDef.handles || [];
      console.log('[handleAutoConnect] Available handles:', handles);

      const compatibleHandle = handles.find((h: HandleDefinition) => {
        const isInput = h.type === 'input' || h.type === 'target';
        const isCompatible = h.dataType === handleType;
        console.log('[handleAutoConnect] Checking handle:', h.id, {
          isInput,
          isCompatible,
          handleDataType: h.dataType,
          requiredType: handleType,
        });
        return isInput && isCompatible;
      });

      if (compatibleHandle) {
        console.log('[handleAutoConnect] Compatible handle found:', compatibleHandle.id);
        onConnect({
          source: source,
          sourceHandle: sourceHandle,
          target: target,
          targetHandle: compatibleHandle.id,
        });
      } else {
        console.log('[handleAutoConnect] No compatible handle found');
      }
    };

    const offDeleteEdge = on('deleteEdge', handleDeleteEdge as (event: unknown) => void);
    const offMoveNodeOrder = on('moveNodeOrder', handleMoveNodeOrder as (event: unknown) => void);
    const offNodeProcessingComplete = on(
      'nodeProcessingComplete',
      handleNodeProcessingComplete as (event: unknown) => void
    );
    const offAutoConnect = on('autoConnect', handleAutoConnect as (event: unknown) => void);
    const offNodeDataUpdated = on(
      'nodeDataUpdated',
      handleNodeDataUpdated as (event: unknown) => void
    );

    return () => {
      offDeleteEdge();
      offMoveNodeOrder();
      offNodeProcessingComplete();
      offAutoConnect();
      offNodeDataUpdated();
    };
  }, [moveNodeOrder, nodes, onConnect, setEdges, setNodes]);

  return {
    connectingNodeId,
    connectingHandleId,
    connectingHandleType,
    onConnectStart,
    onConnectEnd,
    onConnect,
  };
}
