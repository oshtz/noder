import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Node, Edge, ReactFlowInstance, useUpdateNodeInternals } from 'reactflow';
import { invoke, type WorkflowData } from '../types/tauri';
import {
  buildWorkflowDocument,
  migrateWorkflowDocument,
  LOCAL_WORKFLOW_KEY,
  type WorkflowDocument,
  type WorkflowMetadata,
} from '../utils/workflowSchema';
import { toSafeWorkflowId } from '../utils/workflowId';
import { sortNodesForReactFlow } from '../utils/createNode';

// ============================================================================
// Types
// ============================================================================

// Re-export the types from workflowSchema for backward compatibility
export type { WorkflowDocument, WorkflowMetadata };

export interface Workflow {
  id: string;
  name: string;
  data?: WorkflowDocument;
}

export interface WorkflowHistoryEntry {
  id: string;
  name: string;
  timestamp: number;
}

export interface MigrationErrorsRef {
  current: string[];
}

export interface LoadWorkflowOptions {
  onBeforeLoad?: () => void;
  onAfterLoad?: (workflow: Workflow) => void;
}

export interface UseWorkflowPersistenceOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setValidationErrors: (errors: string[]) => void;
  reactFlowInstance: ReactFlowInstance | null;
  prepareEdges: (edges: Edge[], nodes: Node[], migrationErrorsRef: MigrationErrorsRef) => Edge[];
}

export interface UseWorkflowPersistenceReturn {
  // State
  activeWorkflow: Workflow | null;
  hasUnsavedChanges: boolean;
  openWorkflows: Workflow[];
  workflowMetadata: WorkflowMetadata | null;

  // Setters
  setActiveWorkflow: React.Dispatch<React.SetStateAction<Workflow | null>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>;
  setWorkflowMetadata: React.Dispatch<React.SetStateAction<WorkflowMetadata | null>>;

  // Functions
  saveWorkflow: () => Promise<void>;
  loadWorkflow: (
    workflow: Workflow | WorkflowDocument,
    options?: LoadWorkflowOptions
  ) => Promise<void>;
  saveCurrentWorkflow: () => Promise<WorkflowDocument | null>;
  exportWorkflow: () => void;
  prepareWorkflowData: (
    id: string | undefined | null,
    name: string | undefined | null
  ) => WorkflowDocument;
  appendWorkflowHistory: (entry: WorkflowHistoryEntry) => void;
  getWorkflowHistory: () => WorkflowHistoryEntry[];
}

// ============================================================================
// Constants
// ============================================================================

const WORKFLOW_HISTORY_KEY = 'noder-workflow-history';
const WORKFLOW_HISTORY_LIMIT = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read workflow history from localStorage
 */
const readWorkflowHistory = (): WorkflowHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(WORKFLOW_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[History] Failed to read workflow history:', error);
    return [];
  }
};

/**
 * Write workflow history to localStorage
 */
const writeWorkflowHistory = (entries: WorkflowHistoryEntry[]): void => {
  try {
    localStorage.setItem(WORKFLOW_HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[History] Failed to write workflow history:', error);
  }
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing workflow persistence
 * Handles saving, loading, and auto-saving workflows to both local storage and the file system
 */
export function useWorkflowPersistence({
  nodes,
  edges,
  setNodes,
  setEdges,
  setValidationErrors,
  reactFlowInstance,
  prepareEdges,
}: UseWorkflowPersistenceOptions): UseWorkflowPersistenceReturn {
  // Hook to force ReactFlow to update node internals (recalculate handle positions)
  const updateNodeInternals = useUpdateNodeInternals();

  // State
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openWorkflows, setOpenWorkflows] = useState<Workflow[]>([]);
  const [workflowMetadata, setWorkflowMetadata] = useState<WorkflowMetadata | null>(null);

  // Refs for close handler
  const saveCurrentWorkflowRef = useRef<(() => Promise<WorkflowDocument | null>) | null>(null);
  const activeWorkflowRef = useRef<Workflow | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const isClosingRef = useRef(false);

  /**
   * Prepare workflow data for saving
   */
  const prepareWorkflowData = useCallback(
    (id: string | undefined | null, name: string | undefined | null): WorkflowDocument => {
      const processedNodes = nodes.map((node, index) => ({
        ...node,
        data: {
          ...node.data,
          executionOrder: (node.data?.executionOrder as number) ?? index + 1,
          convertedSrc: undefined,
        },
      }));

      const processedEdges = edges.map((edge) => ({
        ...edge,
        type: 'custom',
        animated: false,
        data: {
          ...edge.data,
          isProcessing: false,
        },
      }));

      const viewport = reactFlowInstance
        ? reactFlowInstance.getViewport()
        : { x: 0, y: 0, zoom: 1 };

      return {
        id: id || name || undefined,
        name: name || id || undefined,
        nodes: processedNodes,
        edges: processedEdges,
        viewport,
        metadata: {
          ...workflowMetadata,
          name: name || id || workflowMetadata?.name,
        },
      };
    },
    [edges, nodes, reactFlowInstance, workflowMetadata]
  );

  /**
   * Save workflow with a name prompt
   */
  const saveWorkflow = useCallback(async (): Promise<void> => {
    const workflowName = prompt('Enter a name for this workflow:');
    if (!workflowName) return;
    const trimmedName = workflowName.trim();
    if (!trimmedName) return;
    const workflowId = toSafeWorkflowId(trimmedName);

    try {
      const workflowData = prepareWorkflowData(workflowId, trimmedName);
      const document = buildWorkflowDocument(workflowData);

      await invoke('save_workflow', {
        name: trimmedName,
        data: document as unknown as WorkflowData,
      });
      setWorkflowMetadata(document.metadata || null);
      const savedWorkflow: Workflow = {
        name: trimmedName,
        id: workflowId,
        data: document,
      };
      setActiveWorkflow(savedWorkflow);
      setOpenWorkflows((prev) => {
        const existingIndex = prev.findIndex((w) => w.id === savedWorkflow.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = savedWorkflow;
          return updated;
        }
        return [...prev, savedWorkflow];
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  }, [prepareWorkflowData]);

  /**
   * Export workflow to a JSON file
   */
  const exportWorkflow = useCallback((): void => {
    try {
      const workflowName = activeWorkflow?.name || workflowMetadata?.name || 'workflow';
      const workflowData = prepareWorkflowData(
        activeWorkflow?.id || workflowMetadata?.id,
        workflowName
      );
      const workflowDoc = buildWorkflowDocument(workflowData);

      // Create a blob with the workflow data
      const jsonString = JSON.stringify(workflowDoc, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workflowName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('[Export] Workflow exported successfully:', workflowName);
    } catch (error) {
      console.error('[Export] Failed to export workflow:', error);
      alert('Failed to export workflow. Please try again.');
    }
  }, [activeWorkflow, workflowMetadata, prepareWorkflowData]);

  /**
   * Save the current active workflow
   */
  const saveCurrentWorkflow = useCallback(async (): Promise<WorkflowDocument | null> => {
    if (!activeWorkflow) return null;

    try {
      const workflowData = prepareWorkflowData(activeWorkflow.id, activeWorkflow.name);
      const document = buildWorkflowDocument(workflowData);

      await invoke('save_workflow', {
        name: activeWorkflow.name,
        data: document as unknown as WorkflowData,
      });
      setWorkflowMetadata(document.metadata || null);
      setActiveWorkflow((prev) => {
        if (prev && prev.id === activeWorkflow.id) {
          return { ...prev, data: document };
        }
        return prev;
      });

      setOpenWorkflows((prev) => {
        const existingIndex = prev.findIndex((w) => w.id === activeWorkflow.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          const existingWorkflow = prev[existingIndex];
          if (existingWorkflow) {
            updated[existingIndex] = { ...existingWorkflow, ...activeWorkflow, data: document };
          }
          return updated;
        }
        return [...prev, { ...activeWorkflow, data: document }];
      });

      setHasUnsavedChanges(false);
      return document;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return null;
    }
  }, [activeWorkflow, prepareWorkflowData]);

  /**
   * Load a workflow
   */
  const loadWorkflow = useCallback(
    async (
      workflow: Workflow | WorkflowDocument,
      options: LoadWorkflowOptions = {}
    ): Promise<void> => {
      const { onBeforeLoad, onAfterLoad } = options;

      // Type guard to check if it's a Workflow with id
      const workflowId =
        (workflow as Workflow).id ||
        (workflow as WorkflowDocument).id ||
        (workflow as Workflow).name;

      if (activeWorkflow && workflowId === activeWorkflow.id) return;

      // Call beforeLoad callback (e.g., to hide welcome screen)
      if (onBeforeLoad) {
        onBeforeLoad();
      }

      // Auto-save current workflow before switching
      if (activeWorkflow) {
        await saveCurrentWorkflow();
      }

      const workflowData = (workflow as Workflow).data || workflow;
      const migrated = migrateWorkflowDocument(workflowData as WorkflowDocument);
      const workflowName =
        (workflow as Workflow).name ||
        (workflow as WorkflowDocument).name ||
        migrated.name ||
        migrated.metadata?.name ||
        'Untitled';

      const normalizedWorkflow: Workflow = {
        id: migrated.id || workflowId || workflowName,
        name: workflowName,
        data: migrated,
      };

      // Load the selected workflow
      const migrationErrorsRef: MigrationErrorsRef = { current: [] };
      const processedEdges = prepareEdges(
        migrated.edges || [],
        migrated.nodes || [],
        migrationErrorsRef
      );

      // Sort nodes to ensure parent/group nodes come before children (React Flow requirement)
      // Set nodes first, edges are deferred to allow Handle components to mount
      setNodes(sortNodesForReactFlow(migrated.nodes || []));
      setValidationErrors(migrationErrorsRef.current || []);
      setWorkflowMetadata({
        ...migrated.metadata,
        name: migrated.metadata?.name || workflowName,
      });
      setActiveWorkflow(normalizedWorkflow);
      setOpenWorkflows((prev) => {
        const existingIndex = prev.findIndex((w) => w.id === normalizedWorkflow.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = normalizedWorkflow;
          return updated;
        }
        return [...prev, normalizedWorkflow];
      });
      setHasUnsavedChanges(false);

      // Defer edge setting to allow Handle components to mount in DOM
      // This prevents ReactFlow "handle not found" errors
      requestAnimationFrame(() => {
        // Force ReactFlow to register handles in its internal store
        const nodeIds = (migrated.nodes || []).map((n: Node) => n.id);
        nodeIds.forEach((id: string) => updateNodeInternals(id));

        // Set edges after handles are registered
        requestAnimationFrame(() => {
          setEdges(processedEdges);

          // Restore viewport (zoom and position) if available
          if (migrated.viewport && reactFlowInstance) {
            reactFlowInstance.setViewport(migrated.viewport, { duration: 800 });
          }

          // Call afterLoad callback
          if (onAfterLoad) {
            onAfterLoad(normalizedWorkflow);
          }
        });
      });
    },
    [
      activeWorkflow,
      saveCurrentWorkflow,
      prepareEdges,
      setNodes,
      setEdges,
      setValidationErrors,
      reactFlowInstance,
      updateNodeInternals,
    ]
  );

  /**
   * Append to workflow history
   */
  const appendWorkflowHistory = useCallback((entry: WorkflowHistoryEntry): void => {
    const history = readWorkflowHistory();
    const next = [entry, ...history].slice(0, WORKFLOW_HISTORY_LIMIT);
    writeWorkflowHistory(next);
  }, []);

  /**
   * Get workflow history
   */
  const getWorkflowHistory = useCallback((): WorkflowHistoryEntry[] => {
    return readWorkflowHistory();
  }, []);

  // Track changes to nodes and edges for unsaved changes indicator
  useEffect(() => {
    if (!activeWorkflow) return;

    const savedEntry = openWorkflows.find(
      (w) => w.id === activeWorkflow.id || w.name === activeWorkflow.name
    );
    if (!savedEntry?.data) return;

    const currentDocument = buildWorkflowDocument(
      prepareWorkflowData(activeWorkflow.id, activeWorkflow.name)
    );
    const normalizeForComparison = (doc: WorkflowDocument | undefined): string =>
      JSON.stringify({
        id: doc?.id,
        name: doc?.name,
        schema: doc?.schema,
        version: doc?.version,
        nodes: doc?.nodes || [],
        edges: doc?.edges || [],
        metadata: { ...(doc?.metadata || {}), updatedAt: undefined },
        viewport: doc?.viewport,
        outputs: doc?.outputs || [],
      });

    const hasChanges =
      normalizeForComparison(currentDocument) !== normalizeForComparison(savedEntry.data);
    setHasUnsavedChanges(hasChanges);
  }, [activeWorkflow, openWorkflows, prepareWorkflowData]);

  // Keep refs in sync
  useEffect(() => {
    saveCurrentWorkflowRef.current = saveCurrentWorkflow;
  }, [saveCurrentWorkflow]);

  useEffect(() => {
    activeWorkflowRef.current = activeWorkflow;
  }, [activeWorkflow]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Keep workflow metadata name aligned with active workflow name
  useEffect(() => {
    if (activeWorkflow?.name) {
      setWorkflowMetadata((prev) => ({
        ...prev,
        name: activeWorkflow.name,
      }));
    }
  }, [activeWorkflow]);

  // Window close handler - auto-save before closing
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let removeCloseListener: (() => void) | undefined;

    const registerCloseHandler = async (): Promise<void> => {
      try {
        removeCloseListener = await appWindow.onCloseRequested(async (event) => {
          if (isClosingRef.current) return;
          isClosingRef.current = true;
          try {
            event.preventDefault();
            await saveCurrentWorkflowRef.current?.();
          } catch (error) {
            console.error('Failed to save workflow before close:', error);
          } finally {
            if (removeCloseListener) {
              removeCloseListener();
              removeCloseListener = undefined;
            }
            appWindow.close();
          }
        });
      } catch (error) {
        console.error('Failed to register close handler:', error);
      }
    };

    registerCloseHandler();

    const handleBeforeUnload = (e: BeforeUnloadEvent): string | void => {
      // Best effort to persist the active workflow when the window is about to unload
      if (activeWorkflowRef.current) {
        saveCurrentWorkflowRef.current?.();
      }

      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (removeCloseListener) {
        removeCloseListener();
      }
    };
  }, []);

  // Auto-save nodes to localStorage
  useEffect(() => {
    if (nodes.length > 0) {
      const sanitizedNodes = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          convertedSrc: undefined,
        },
      }));

      try {
        localStorage.setItem('noder-nodes', JSON.stringify(sanitizedNodes));
      } catch (error) {
        console.error('Failed to save nodes to localStorage:', error);
        try {
          const minimalNodes = nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              convertedSrc: undefined,
              output: undefined,
            },
          }));
          localStorage.setItem('noder-nodes', JSON.stringify(minimalNodes));
        } catch (e) {
          console.error('Failed to save even minimal nodes:', e);
        }
      }
    }
  }, [nodes]);

  // Auto-save edges to localStorage
  useEffect(() => {
    if (edges.length > 0) {
      localStorage.setItem(
        'noder-edges',
        JSON.stringify(
          edges.map((edge) => ({
            ...edge,
            style: edge.style || {},
            data: {
              ...edge.data,
              handleColor:
                (edge.style as { stroke?: string })?.stroke ||
                (edge.data as { handleColor?: string })?.handleColor ||
                '#555',
            },
          }))
        )
      );
    }
  }, [edges]);

  // Track if we've loaded initial edges to avoid overwriting them prematurely
  const hasLoadedInitialEdges = useRef(false);
  const initialEdgeCount = useRef<number | null>(null);

  // Track initial edge count on first meaningful edges update
  useEffect(() => {
    if (edges.length > 0 && initialEdgeCount.current === null) {
      initialEdgeCount.current = edges.length;
      hasLoadedInitialEdges.current = true;
    }
  }, [edges]);

  // Persist versioned workflow document to localStorage
  useEffect(() => {
    // Don't save if we have nodes but no edges - this prevents overwriting
    // valid edges from localStorage during initialization race conditions.
    // Only skip if we haven't loaded initial edges yet (to allow saving empty workflows intentionally).
    if (nodes.length > 0 && edges.length === 0 && !hasLoadedInitialEdges.current) {
      console.debug(
        '[Persistence] Skipping save: nodes exist but edges empty during initialization'
      );
      return;
    }

    const workflowName = activeWorkflow?.name || workflowMetadata?.name || 'Local Draft';

    const sanitizedNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        convertedSrc: undefined,
      },
    }));

    const document = buildWorkflowDocument({
      id: activeWorkflow?.id || workflowMetadata?.id,
      name: workflowName,
      nodes: sanitizedNodes,
      edges,
      metadata: workflowMetadata || undefined,
    });

    try {
      localStorage.setItem(LOCAL_WORKFLOW_KEY, JSON.stringify(document));
    } catch (error) {
      console.error('Failed to persist local workflow document:', error);
    }
  }, [nodes, edges, workflowMetadata, activeWorkflow]);

  return {
    // State
    activeWorkflow,
    hasUnsavedChanges,
    openWorkflows,
    workflowMetadata,

    // Setters
    setActiveWorkflow,
    setHasUnsavedChanges,
    setOpenWorkflows,
    setWorkflowMetadata,

    // Functions
    saveWorkflow,
    loadWorkflow,
    saveCurrentWorkflow,
    exportWorkflow,
    prepareWorkflowData,
    appendWorkflowHistory,
    getWorkflowHistory,
  };
}
