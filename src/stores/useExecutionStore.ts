import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
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

export interface ExecutionStoreState {
  // Processing state
  isProcessing: boolean;
  currentWorkflowId: string | null;

  // Error state
  failedNodes: FailedNode[];
  showErrorRecovery: boolean;

  // Execution tracking
  executionState: ExecutionState;
  nodeTimings: NodeTimings;

  // Progress tracking
  processedNodeCount: number;
  totalNodeCount: number;
  currentNodeId: string | null;
}

export interface ExecutionStoreActions {
  // Processing control
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
  setShowErrorRecovery: (value: boolean) => void;

  // Execution state access
  getExecutionState: () => ExecutionState;
  hasResumeState: () => boolean;
  prepareResumeState: (
    scopedNodeIds: string[],
    retryNodeIds?: string[],
    retryFailed?: boolean,
    edges?: Edge[]
  ) => ResumeState;
  getDownstreamNodeIds: (startIds: Set<string> | string[], edges: Edge[]) => Set<string>;

  // Progress tracking
  setProgress: (processed: number, total: number, currentNodeId?: string | null) => void;
  incrementProgress: () => void;

  // Node output management
  setNodeOutput: (nodeId: string, output: NodeOutput) => void;
  getNodeOutput: (nodeId: string) => NodeOutput | null;
  clearNodeOutputs: () => void;

  // Reset
  reset: () => void;
}

export type ExecutionStore = ExecutionStoreState & ExecutionStoreActions;

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_EXECUTION_STATE: ExecutionState = {
  nodeOutputs: {},
  scopeNodeIds: [],
  failedNodeIds: [],
};

const DEFAULT_STATE: ExecutionStoreState = {
  isProcessing: false,
  currentWorkflowId: null,
  failedNodes: [],
  showErrorRecovery: false,
  executionState: { ...DEFAULT_EXECUTION_STATE },
  nodeTimings: {},
  processedNodeCount: 0,
  totalNodeCount: 0,
  currentNodeId: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useExecutionStore = create<ExecutionStore>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_STATE,

    // Processing control
    startExecution: (workflowId, resetState = true) => {
      set({
        currentWorkflowId: workflowId,
        isProcessing: true,
        processedNodeCount: 0,
        currentNodeId: null,
        ...(resetState
          ? {
              executionState: { ...DEFAULT_EXECUTION_STATE },
              nodeTimings: {},
            }
          : {}),
      });
    },

    endExecution: (result = null, scopeNodeIds = [], failedNodeIds = []) => {
      if (result && result.success === false) {
        set({
          executionState: {
            nodeOutputs: result.nodeOutputs || {},
            scopeNodeIds,
            failedNodeIds,
          },
          isProcessing: false,
          currentWorkflowId: null,
          currentNodeId: null,
        });
      } else {
        set({
          executionState: { ...DEFAULT_EXECUTION_STATE },
          isProcessing: false,
          currentWorkflowId: null,
          currentNodeId: null,
        });
      }
    },

    setIsProcessing: (value) => set({ isProcessing: value }),
    setCurrentWorkflowId: (value) => set({ currentWorkflowId: value }),

    // Node timing
    recordNodeStart: (nodeId) => {
      set((state) => ({
        nodeTimings: {
          ...state.nodeTimings,
          [nodeId]: Date.now(),
        },
        currentNodeId: nodeId,
      }));
    },

    getNodeDuration: (nodeId) => {
      const startTime = get().nodeTimings[nodeId];
      if (!startTime) return null;
      return Date.now() - startTime;
    },

    // Error recovery
    addFailedNode: (nodeId, error, node) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set((state) => {
        // Avoid duplicates
        if (state.failedNodes.some((fn) => fn.id === nodeId)) {
          return state;
        }
        return {
          failedNodes: [...state.failedNodes, { id: nodeId, error: errorMessage, node }],
          showErrorRecovery: true,
        };
      });
    },

    removeFailedNode: (nodeId) => {
      set((state) => ({
        failedNodes: state.failedNodes.filter((fn) => fn.id !== nodeId),
        showErrorRecovery: state.failedNodes.length > 1, // Hide if no more errors
      }));
    },

    clearFailedNodes: () => {
      set({
        failedNodes: [],
        showErrorRecovery: false,
      });
    },

    closeErrorRecovery: () => {
      set({ showErrorRecovery: false });
    },

    setShowErrorRecovery: (value) => set({ showErrorRecovery: value }),

    // Execution state access
    getExecutionState: () => get().executionState,

    hasResumeState: () => {
      const state = get().executionState;
      return (
        Object.keys(state.nodeOutputs).length > 0 ||
        state.scopeNodeIds.length > 0 ||
        state.failedNodeIds.length > 0
      );
    },

    prepareResumeState: (scopedNodeIds, retryNodeIds = [], retryFailed = false, edges = []) => {
      const state = get();
      const { executionState } = state;

      // Convert to sets for faster lookups
      const failedNodeIdSet = new Set(executionState.failedNodeIds);
      const scopedNodeIdSet = new Set(scopedNodeIds);
      const retryNodeIdSet = new Set(retryNodeIds);

      // If retrying failed nodes, add them to retry set
      if (retryFailed) {
        failedNodeIdSet.forEach((id) => retryNodeIdSet.add(id));
      }

      // Get downstream nodes that need to be re-executed
      const downstreamIds = get().getDownstreamNodeIds(retryNodeIdSet, edges);
      downstreamIds.forEach((id) => {
        if (scopedNodeIdSet.has(id)) {
          retryNodeIdSet.add(id);
        }
      });

      // Build initial outputs from nodes not being retried
      const initialNodeOutputs: Record<string, NodeOutput> = {};
      Object.entries(executionState.nodeOutputs).forEach(([nodeId, output]) => {
        if (!retryNodeIdSet.has(nodeId) && scopedNodeIdSet.has(nodeId)) {
          initialNodeOutputs[nodeId] = output;
        }
      });

      return {
        initialNodeOutputs,
        failedNodeIdSet,
        retryNodeIdSet,
      };
    },

    getDownstreamNodeIds: (startIds, edges) => {
      const startSet = startIds instanceof Set ? startIds : new Set(startIds);
      const downstream = new Set<string>();
      const queue = [...startSet];

      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) continue;
        for (const edge of edges) {
          if (edge.source === current && !downstream.has(edge.target)) {
            downstream.add(edge.target);
            queue.push(edge.target);
          }
        }
      }

      return downstream;
    },

    // Progress tracking
    setProgress: (processed, total, currentNodeId = null) => {
      set({
        processedNodeCount: processed,
        totalNodeCount: total,
        currentNodeId,
      });
    },

    incrementProgress: () => {
      set((state) => ({
        processedNodeCount: state.processedNodeCount + 1,
      }));
    },

    // Node output management
    setNodeOutput: (nodeId, output) => {
      set((state) => ({
        executionState: {
          ...state.executionState,
          nodeOutputs: {
            ...state.executionState.nodeOutputs,
            [nodeId]: output,
          },
        },
      }));
    },

    getNodeOutput: (nodeId) => {
      return get().executionState.nodeOutputs[nodeId] || null;
    },

    clearNodeOutputs: () => {
      set((state) => ({
        executionState: {
          ...state.executionState,
          nodeOutputs: {},
        },
      }));
    },

    // Reset
    reset: () => set(DEFAULT_STATE),
  }))
);

// ============================================================================
// Selector Hooks
// ============================================================================

export const useIsProcessing = () => useExecutionStore((s) => s.isProcessing);
export const useCurrentWorkflowId = () => useExecutionStore((s) => s.currentWorkflowId);
export const useFailedNodes = () => useExecutionStore((s) => s.failedNodes);
export const useShowErrorRecovery = () => useExecutionStore((s) => s.showErrorRecovery);
export const useExecutionProgress = () =>
  useExecutionStore((s) => ({
    processed: s.processedNodeCount,
    total: s.totalNodeCount,
    current: s.currentNodeId,
    percent: s.totalNodeCount > 0 ? Math.round((s.processedNodeCount / s.totalNodeCount) * 100) : 0,
  }));

export default useExecutionStore;
