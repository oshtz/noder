import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Node, Edge, Viewport, applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import type { NodeChange, EdgeChange, Connection } from 'reactflow';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowMetadata {
  id?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface WorkflowDocument {
  id?: string;
  name?: string;
  schema?: string;
  version?: number;
  nodes: Node[];
  edges: Edge[];
  metadata?: WorkflowMetadata;
  viewport?: Viewport;
  outputs?: WorkflowOutput[];
}

export interface Workflow {
  id: string;
  name: string;
  data?: WorkflowDocument;
}

export interface WorkflowOutput {
  id: string;
  nodeId: string;
  type: 'image' | 'video' | 'audio' | 'text';
  value: string;
  prompt?: string;
  model?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowHistoryEntry {
  id: string;
  name: string;
  timestamp: number;
}

export interface WorkflowState {
  // Core workflow data
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;

  // Workflow metadata
  activeWorkflow: Workflow | null;
  workflowMetadata: WorkflowMetadata | null;
  openWorkflows: Workflow[];

  // Persistence state
  hasUnsavedChanges: boolean;

  // Outputs
  workflowOutputs: WorkflowOutput[];

  // Templates
  workflowTemplates: WorkflowDocument[];

  // ReactFlow instance reference (set externally)
  reactFlowInstance: unknown | null;
}

export interface WorkflowActions {
  // Node operations
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  removeNode: (nodeId: string) => void;
  applyNodeChanges: (changes: NodeChange[]) => void;

  // Edge operations
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  addEdge: (edge: Edge | Connection) => void;
  removeEdge: (edgeId: string) => void;
  applyEdgeChanges: (changes: EdgeChange[]) => void;

  // Viewport
  setViewport: (viewport: Viewport) => void;

  // Workflow management
  setActiveWorkflow: (workflow: Workflow | null) => void;
  setWorkflowMetadata: (metadata: WorkflowMetadata | null) => void;
  setOpenWorkflows: (workflows: Workflow[]) => void;
  setHasUnsavedChanges: (value: boolean) => void;

  // Output management
  setWorkflowOutputs: (outputs: WorkflowOutput[]) => void;
  addWorkflowOutput: (output: WorkflowOutput) => void;
  removeWorkflowOutput: (outputId: string) => void;
  clearWorkflowOutputs: () => void;

  // Template management
  setWorkflowTemplates: (templates: WorkflowDocument[]) => void;
  addWorkflowTemplate: (template: WorkflowDocument) => void;

  // ReactFlow instance
  setReactFlowInstance: (instance: unknown) => void;

  // Workflow loading/clearing
  loadWorkflow: (document: WorkflowDocument) => void;
  clearWorkflow: () => void;

  // History
  getNodesSnapshot: () => Node[];
  getEdgesSnapshot: () => Edge[];
}

export type WorkflowStore = WorkflowState & WorkflowActions;

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_STATE: WorkflowState = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  activeWorkflow: null,
  workflowMetadata: null,
  openWorkflows: [],
  hasUnsavedChanges: false,
  workflowOutputs: [],
  workflowTemplates: [],
  reactFlowInstance: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Mark which edges should show glows at their source/target handles.
 * Only the first edge per handle gets to show the glow to avoid stacking.
 */
const markEdgeGlows = (edges: Edge[]): Edge[] => {
  const sourceGlowSet = new Set<string>();
  const targetGlowSet = new Set<string>();

  return edges.map((edge) => {
    const sourceKey = `${edge.source}:${edge.sourceHandle}`;
    const targetKey = `${edge.target}:${edge.targetHandle}`;

    const showSourceGlow = !sourceGlowSet.has(sourceKey);
    const showTargetGlow = !targetGlowSet.has(targetKey);

    if (showSourceGlow) sourceGlowSet.add(sourceKey);
    if (showTargetGlow) targetGlowSet.add(targetKey);

    return {
      ...edge,
      data: {
        ...edge.data,
        showSourceGlow,
        showTargetGlow,
      },
    };
  });
};

/**
 * Sort nodes to ensure parent/group nodes come before children (React Flow requirement)
 */
const sortNodesForReactFlow = (nodes: Node[]): Node[] => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const sorted: Node[] = [];
  const visited = new Set<string>();

  const visit = (node: Node) => {
    if (visited.has(node.id)) return;
    const parentId = node.parentNode || (node as Node & { parentId?: string }).parentId;
    if (parentId && nodeMap.has(parentId)) {
      const parentNode = nodeMap.get(parentId);
      if (parentNode) visit(parentNode);
    }
    visited.add(node.id);
    sorted.push(node);
  };

  // Visit groups first
  nodes.filter((n) => n.type === 'group').forEach((n) => visit(n));

  // Then visit remaining nodes
  nodes.forEach((n) => visit(n));

  return sorted;
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useWorkflowStore = create<WorkflowStore>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_STATE,

    // Node operations
    setNodes: (nodesOrUpdater) => {
      set((state) => ({
        nodes: typeof nodesOrUpdater === 'function' ? nodesOrUpdater(state.nodes) : nodesOrUpdater,
        hasUnsavedChanges: true,
      }));
    },

    addNode: (node) => {
      set((state) => ({
        nodes: sortNodesForReactFlow([...state.nodes, node]),
        hasUnsavedChanges: true,
      }));
    },

    updateNode: (nodeId, updates) => {
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
        hasUnsavedChanges: true,
      }));
    },

    updateNodeData: (nodeId, data) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        ),
        hasUnsavedChanges: true,
      }));
    },

    removeNode: (nodeId) => {
      set((state) => {
        const nodeToRemove = state.nodes.find((n) => n.id === nodeId);
        const isGroupNode = nodeToRemove?.type === 'group';

        // Remove the node and update children if it's a group
        const updatedNodes = state.nodes
          .filter((n) => n.id !== nodeId)
          .map((node) => {
            const parentId = node.parentNode || (node as Node & { parentId?: string }).parentId;
            if (isGroupNode && parentId === nodeId) {
              // Remove parent reference and adjust position
              const { parentNode: _parentNode, ...cleanNode } = node as Node & {
                parentNode?: string;
              };
              const nodeWithoutParentId = { ...cleanNode };
              delete (nodeWithoutParentId as Node & { parentId?: string }).parentId;
              delete (nodeWithoutParentId as Node & { extent?: string }).extent;
              return {
                ...nodeWithoutParentId,
                position: {
                  x: node.position.x + (nodeToRemove?.position?.x || 0),
                  y: node.position.y + (nodeToRemove?.position?.y || 0) - 40,
                },
              };
            }
            return node;
          });

        // Remove connected edges
        const updatedEdges = markEdgeGlows(
          state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
        );

        return {
          nodes: updatedNodes,
          edges: updatedEdges,
          hasUnsavedChanges: true,
        };
      });
    },

    applyNodeChanges: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
        hasUnsavedChanges: changes.some((c) => c.type !== 'select' && c.type !== 'dimensions'),
      }));
    },

    // Edge operations
    setEdges: (edgesOrUpdater) => {
      set((state) => {
        const newEdges =
          typeof edgesOrUpdater === 'function' ? edgesOrUpdater(state.edges) : edgesOrUpdater;
        return {
          edges: markEdgeGlows(newEdges),
          hasUnsavedChanges: true,
        };
      });
    },

    addEdge: (edgeOrConnection) => {
      set((state) => {
        const newEdge: Edge =
          'id' in edgeOrConnection
            ? edgeOrConnection
            : {
                id: `e${edgeOrConnection.source}-${edgeOrConnection.sourceHandle}-${edgeOrConnection.target}-${edgeOrConnection.targetHandle}`,
                source: edgeOrConnection.source ?? '',
                target: edgeOrConnection.target ?? '',
                sourceHandle: edgeOrConnection.sourceHandle,
                targetHandle: edgeOrConnection.targetHandle,
                type: 'custom',
                animated: false,
                data: { isProcessing: false },
              };

        return {
          edges: markEdgeGlows(addEdge(newEdge, state.edges)),
          hasUnsavedChanges: true,
        };
      });
    },

    removeEdge: (edgeId) => {
      set((state) => ({
        edges: markEdgeGlows(state.edges.filter((e) => e.id !== edgeId)),
        hasUnsavedChanges: true,
      }));
    },

    applyEdgeChanges: (changes) => {
      set((state) => {
        const updatedEdges = applyEdgeChanges(changes, state.edges);
        const hasRemovals = changes.some((c) => c.type === 'remove');
        return {
          edges: hasRemovals ? markEdgeGlows(updatedEdges) : updatedEdges,
          hasUnsavedChanges: changes.some((c) => c.type !== 'select'),
        };
      });
    },

    // Viewport
    setViewport: (viewport) => set({ viewport }),

    // Workflow management
    setActiveWorkflow: (workflow) => set({ activeWorkflow: workflow }),
    setWorkflowMetadata: (metadata) => set({ workflowMetadata: metadata }),
    setOpenWorkflows: (workflows) => set({ openWorkflows: workflows }),
    setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),

    // Output management
    setWorkflowOutputs: (outputs) => set({ workflowOutputs: outputs }),
    addWorkflowOutput: (output) =>
      set((state) => ({
        workflowOutputs: [output, ...state.workflowOutputs],
      })),
    removeWorkflowOutput: (outputId) =>
      set((state) => ({
        workflowOutputs: state.workflowOutputs.filter((o) => o.id !== outputId),
      })),
    clearWorkflowOutputs: () => set({ workflowOutputs: [] }),

    // Template management
    setWorkflowTemplates: (templates) => set({ workflowTemplates: templates }),
    addWorkflowTemplate: (template) =>
      set((state) => ({
        workflowTemplates: [...state.workflowTemplates, template],
      })),

    // ReactFlow instance
    setReactFlowInstance: (instance) => set({ reactFlowInstance: instance }),

    // Workflow loading/clearing
    loadWorkflow: (document) => {
      set({
        nodes: sortNodesForReactFlow(document.nodes || []),
        edges: markEdgeGlows(document.edges || []),
        viewport: document.viewport || { x: 0, y: 0, zoom: 1 },
        workflowMetadata: document.metadata || null,
        workflowOutputs: (document.outputs as WorkflowOutput[]) || [],
        hasUnsavedChanges: false,
      });
    },

    clearWorkflow: () => {
      set({
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        activeWorkflow: null,
        workflowMetadata: null,
        hasUnsavedChanges: false,
        workflowOutputs: [],
      });
    },

    // Snapshots for undo/redo
    getNodesSnapshot: () => get().nodes,
    getEdgesSnapshot: () => get().edges,
  }))
);

// ============================================================================
// Selector Hooks
// ============================================================================

export const useNodes = () => useWorkflowStore((s) => s.nodes);
export const useEdges = () => useWorkflowStore((s) => s.edges);
export const useViewport = () => useWorkflowStore((s) => s.viewport);
export const useActiveWorkflow = () => useWorkflowStore((s) => s.activeWorkflow);
export const useWorkflowMetadata = () => useWorkflowStore((s) => s.workflowMetadata);
export const useHasUnsavedChanges = () => useWorkflowStore((s) => s.hasUnsavedChanges);
export const useWorkflowOutputs = () => useWorkflowStore((s) => s.workflowOutputs);

// Node selectors
export const useNode = (nodeId: string) =>
  useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
export const useNodeData = (nodeId: string) =>
  useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId)?.data);

// Edge selectors
export const useNodeEdges = (nodeId: string) =>
  useWorkflowStore((s) => s.edges.filter((e) => e.source === nodeId || e.target === nodeId));
export const useIncomingEdges = (nodeId: string) =>
  useWorkflowStore((s) => s.edges.filter((e) => e.target === nodeId));
export const useOutgoingEdges = (nodeId: string) =>
  useWorkflowStore((s) => s.edges.filter((e) => e.source === nodeId));

export default useWorkflowStore;
