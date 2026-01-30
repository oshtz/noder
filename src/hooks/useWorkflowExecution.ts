import { useState, useRef, useCallback } from 'react';
import { Node, Edge } from 'reactflow';

// ============================================================================
// Types
// ============================================================================

export interface NodeOutput {
  [key: string]: unknown;
}

export interface ExecutionState {
  nodeOutputs: Record<string, NodeOutput>;
  scopeNodeIds: string[];
  failedNodeIds: string[];
}

export interface FailedNode {
  id: string;
  error: string;
  node: Node;
}

export interface NodeTimings {
  [nodeId: string]: number;
}

export interface ResumeState {
  initialNodeOutputs: Record<string, NodeOutput>;
  failedNodeIdSet: Set<string>;
  retryNodeIdSet: Set<string>;
}

export interface UseWorkflowExecutionReturn {
  // State
  isProcessing: boolean;
  currentWorkflowId: string | null;
  failedNodes: FailedNode[];
  showErrorRecovery: boolean;

  // Refs (for direct access when needed)
  executionStateRef: React.MutableRefObject<ExecutionState>;
  nodeTimingsRef: React.MutableRefObject<NodeTimings>;

  // Actions
  startExecution: (workflowId: string, resetState?: boolean) => void;
  endExecution: (
    result?: { success: boolean; nodeOutputs?: Record<string, NodeOutput> } | null,
    scopeNodeIds?: string[],
    failedNodeIds?: string[]
  ) => void;
  setIsProcessing: (value: boolean) => void;
  setCurrentWorkflowId: (value: string | null) => void;

  // Node timing
  recordNodeStart: (nodeId: string) => void;
  getNodeDuration: (nodeId: string) => number | null;

  // Error recovery
  addFailedNode: (nodeId: string, error: Error | string, node: Node) => void;
  removeFailedNode: (nodeId: string) => void;
  clearFailedNodes: () => void;
  closeErrorRecovery: () => void;
  setFailedNodes: React.Dispatch<React.SetStateAction<FailedNode[]>>;
  setShowErrorRecovery: (value: boolean) => void;

  // Resume helpers
  getExecutionState: () => ExecutionState;
  hasResumeState: () => boolean;
  prepareResumeState: (
    scopedNodeIds: string[],
    retryNodeIds?: string[],
    retryFailed?: boolean,
    edges?: Edge[]
  ) => ResumeState;
  getDownstreamNodeIds: (startIds: Set<string> | string[], edges: Edge[]) => Set<string>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing workflow execution state
 * Handles processing state, failed nodes, error recovery, and execution tracking
 */
export function useWorkflowExecution(): UseWorkflowExecutionReturn {
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);

  // Error state
  const [failedNodes, setFailedNodes] = useState<FailedNode[]>([]);
  const [showErrorRecovery, setShowErrorRecovery] = useState(false);

  // Refs for execution tracking
  const executionStateRef = useRef<ExecutionState>({
    nodeOutputs: {},
    scopeNodeIds: [],
    failedNodeIds: [],
  });
  const nodeTimingsRef = useRef<NodeTimings>({});

  /**
   * Start a new workflow execution
   */
  const startExecution = useCallback((workflowId: string, resetState = true): void => {
    if (resetState) {
      executionStateRef.current = {
        nodeOutputs: {},
        scopeNodeIds: [],
        failedNodeIds: [],
      };
    }
    nodeTimingsRef.current = {};
    setCurrentWorkflowId(workflowId);
    setIsProcessing(true);
  }, []);

  /**
   * End the current workflow execution
   */
  const endExecution = useCallback(
    (
      result: { success: boolean; nodeOutputs?: Record<string, NodeOutput> } | null = null,
      scopeNodeIds: string[] = [],
      failedNodeIds: string[] = []
    ): void => {
      if (result && result.success === false) {
        executionStateRef.current = {
          nodeOutputs: result.nodeOutputs || {},
          scopeNodeIds: scopeNodeIds,
          failedNodeIds: failedNodeIds,
        };
      } else {
        executionStateRef.current = {
          nodeOutputs: {},
          scopeNodeIds: [],
          failedNodeIds: [],
        };
      }
      setIsProcessing(false);
      setCurrentWorkflowId(null);
    },
    []
  );

  /**
   * Record node start time
   */
  const recordNodeStart = useCallback((nodeId: string): void => {
    nodeTimingsRef.current[nodeId] = Date.now();
  }, []);

  /**
   * Get node run duration
   */
  const getNodeDuration = useCallback((nodeId: string): number | null => {
    const startTime = nodeTimingsRef.current[nodeId];
    return startTime ? Date.now() - startTime : null;
  }, []);

  /**
   * Add a failed node to the list
   */
  const addFailedNode = useCallback((nodeId: string, error: Error | string, node: Node): void => {
    setFailedNodes((prev) => {
      const existing = prev.find((n) => n.id === nodeId);
      if (existing) return prev;
      const errorMessage = typeof error === 'string' ? error : error.message || String(error);
      return [...prev, { id: nodeId, error: errorMessage, node }];
    });
    setShowErrorRecovery(true);
  }, []);

  /**
   * Remove a specific failed node from the list
   */
  const removeFailedNode = useCallback((nodeId: string): void => {
    setFailedNodes((prev) => {
      const next = prev.filter((n) => n.id !== nodeId);
      if (next.length === 0) {
        setShowErrorRecovery(false);
      }
      return next;
    });
  }, []);

  /**
   * Clear all failed nodes
   */
  const clearFailedNodes = useCallback((): void => {
    setFailedNodes([]);
    setShowErrorRecovery(false);
  }, []);

  /**
   * Close error recovery panel without clearing failed nodes
   */
  const closeErrorRecovery = useCallback((): void => {
    setShowErrorRecovery(false);
  }, []);

  /**
   * Get the current execution state for resuming
   */
  const getExecutionState = useCallback((): ExecutionState => {
    return executionStateRef.current;
  }, []);

  /**
   * Check if we have resume state available
   */
  const hasResumeState = useCallback((): boolean => {
    return (
      executionStateRef.current &&
      Object.keys(executionStateRef.current.nodeOutputs || {}).length > 0
    );
  }, []);

  /**
   * Get downstream node IDs from a set of starting nodes
   */
  const getDownstreamNodeIds = useCallback(
    (startIds: Set<string> | string[], edges: Edge[]): Set<string> => {
      const adjacency = new Map<string, string[]>();
      edges.forEach((edge) => {
        if (!adjacency.has(edge.source)) {
          adjacency.set(edge.source, []);
        }
        adjacency.get(edge.source)?.push(edge.target);
      });

      const visited = new Set<string>();
      const stack = Array.from(startIds);
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach((nextId) => {
          if (!visited.has(nextId)) {
            stack.push(nextId);
          }
        });
      }
      return visited;
    },
    []
  );

  /**
   * Prepare initial node outputs for resume execution
   */
  const prepareResumeState = useCallback(
    (
      scopedNodeIds: string[],
      retryNodeIds: string[] = [],
      retryFailed = false,
      edges: Edge[] = []
    ): ResumeState => {
      const scopedNodeIdSet = new Set(scopedNodeIds);
      const failedNodeIdSet = new Set(executionStateRef.current.failedNodeIds || []);
      const initialNodeOutputs: Record<string, NodeOutput> = {};

      // Copy existing outputs that are in scope
      Object.entries(executionStateRef.current.nodeOutputs || {}).forEach(([nodeId, output]) => {
        if (scopedNodeIdSet.has(nodeId)) {
          initialNodeOutputs[nodeId] = output;
        }
      });

      // Remove failed node outputs
      failedNodeIdSet.forEach((nodeId) => {
        delete initialNodeOutputs[nodeId];
      });

      // Build retry set
      const retryNodeIdSet = new Set<string>();
      if (Array.isArray(retryNodeIds)) {
        retryNodeIds.forEach((nodeId) => {
          if (nodeId) retryNodeIdSet.add(nodeId);
        });
      }
      if (retryFailed) {
        failedNodeIdSet.forEach((nodeId) => retryNodeIdSet.add(nodeId));
      }

      // Add downstream nodes to retry set
      if (retryNodeIdSet.size > 0) {
        const downstreamIds = getDownstreamNodeIds(retryNodeIdSet, edges);
        downstreamIds.forEach((nodeId) => retryNodeIdSet.add(nodeId));
        retryNodeIdSet.forEach((nodeId) => {
          delete initialNodeOutputs[nodeId];
        });
      }

      return {
        initialNodeOutputs,
        failedNodeIdSet,
        retryNodeIdSet,
      };
    },
    [getDownstreamNodeIds]
  );

  return {
    // State
    isProcessing,
    currentWorkflowId,
    failedNodes,
    showErrorRecovery,

    // Refs (for direct access when needed)
    executionStateRef,
    nodeTimingsRef,

    // Actions
    startExecution,
    endExecution,
    setIsProcessing,
    setCurrentWorkflowId,

    // Node timing
    recordNodeStart,
    getNodeDuration,

    // Error recovery
    addFailedNode,
    removeFailedNode,
    clearFailedNodes,
    closeErrorRecovery,
    setFailedNodes,
    setShowErrorRecovery,

    // Resume helpers
    getExecutionState,
    hasResumeState,
    prepareResumeState,
    getDownstreamNodeIds,
  };
}

export default useWorkflowExecution;
