import React, { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';
import type { Node, Edge } from 'reactflow';

// =============================================================================
// Types
// =============================================================================

/** Context value shape */
export interface WorkflowContextValue {
  nodes: Node[];
  edges: Edge[];
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  getNodes: () => Node[];
  getEdges: () => Edge[];
}

/** Provider props */
export interface WorkflowProviderProps {
  children: ReactNode;
  nodes: Node[];
  edges: Edge[];
}

/** Global refs type */
interface GlobalWorkflowRefs {
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
}

// =============================================================================
// Context
// =============================================================================

/**
 * Context for sharing workflow state (nodes/edges) across the application
 * Replaces window.nodesRef and window.edgesRef globals
 */
const WorkflowContext = createContext<WorkflowContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function WorkflowProvider({
  children,
  nodes,
  edges,
}: WorkflowProviderProps): React.ReactElement {
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  // Keep refs in sync with latest state
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const getNodes = useCallback((): Node[] => nodesRef.current || [], []);
  const getEdges = useCallback((): Edge[] => edgesRef.current || [], []);

  const value: WorkflowContextValue = {
    nodes,
    edges,
    nodesRef,
    edgesRef,
    getNodes,
    getEdges,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access workflow state
 * @returns Workflow context value
 */
export function useWorkflow(): WorkflowContextValue {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}

/**
 * Hook to get nodes ref (for non-React contexts like validation utils)
 * Returns a stable ref that always has current nodes
 */
export function useNodesRef(): React.MutableRefObject<Node[]> {
  const { nodesRef } = useWorkflow();
  return nodesRef;
}

/**
 * Hook to get edges ref (for non-React contexts)
 * Returns a stable ref that always has current edges
 */
export function useEdgesRef(): React.MutableRefObject<Edge[]> {
  const { edgesRef } = useWorkflow();
  return edgesRef;
}

// =============================================================================
// Global Refs (for non-React contexts)
// =============================================================================

/**
 * Utility to get workflow refs outside of React components
 * This is a temporary bridge for utility functions that can't use hooks
 * Should be set by App component on mount
 */
let globalWorkflowRefs: GlobalWorkflowRefs = {
  nodesRef: { current: [] },
  edgesRef: { current: [] },
};

export function setGlobalWorkflowRefs(
  nodesRef: React.MutableRefObject<Node[]>,
  edgesRef: React.MutableRefObject<Edge[]>
): void {
  globalWorkflowRefs = { nodesRef, edgesRef };
}

export function getGlobalNodesRef(): React.MutableRefObject<Node[]> {
  return globalWorkflowRefs.nodesRef;
}

export function getGlobalEdgesRef(): React.MutableRefObject<Edge[]> {
  return globalWorkflowRefs.edgesRef;
}

export default WorkflowContext;
