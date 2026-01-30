import { useMemo, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import { migrateWorkflowDocument, LOCAL_WORKFLOW_KEY } from '../utils/workflowSchema';
import { sortNodesForReactFlow } from '../utils/createNode';
import { prepareEdges } from '../utils/workflowHelpers';
import type { WorkflowDocument } from '../utils/workflowSchema';
import type { ValidationError } from '../types/components';

export interface InitialWorkflowResult {
  initialNodes: Node[];
  initialEdges: Edge[];
  initialOutputs: unknown[];
  initialValidationErrors: ValidationError[];
  showWelcomeInitially: boolean;
}

/**
 * Hook that handles loading the initial workflow from localStorage.
 * Migrates legacy workflow formats and prepares nodes/edges for ReactFlow.
 */
export function useInitialWorkflow(): InitialWorkflowResult {
  const validationErrorsRef = useRef<ValidationError[]>([]);

  const initialWorkflow = useMemo(() => {
    try {
      const storedDoc = localStorage.getItem(LOCAL_WORKFLOW_KEY);
      if (storedDoc) {
        return migrateWorkflowDocument(JSON.parse(storedDoc));
      }
    } catch (error) {
      console.error('Failed to parse stored workflow document:', error);
    }

    // Legacy fallback
    const savedNodes = localStorage.getItem('noder-nodes');
    const savedEdges = localStorage.getItem('noder-edges');
    return migrateWorkflowDocument({
      nodes: savedNodes ? JSON.parse(savedNodes) : [],
      edges: savedEdges ? JSON.parse(savedEdges) : [],
      metadata: { name: 'Local Draft' },
    });
  }, []);

  const initialNodes = useMemo(
    () => sortNodesForReactFlow(initialWorkflow.nodes || []) as Node[],
    [initialWorkflow.nodes]
  );

  const initialEdges = useMemo(() => {
    try {
      return prepareEdges(
        (initialWorkflow.edges || []) as Edge[],
        (initialWorkflow.nodes || []) as Node[],
        validationErrorsRef
      );
    } catch (error) {
      console.error('Error loading edges:', error);
      return [];
    }
  }, [initialWorkflow.edges, initialWorkflow.nodes]);

  const initialOutputs = useMemo(
    () => (initialWorkflow as WorkflowDocument).outputs || [],
    [initialWorkflow]
  );

  const showWelcomeInitially = useMemo(() => {
    const hasNodes = initialWorkflow.nodes && initialWorkflow.nodes.length > 0;
    const hasWorkflow = localStorage.getItem(LOCAL_WORKFLOW_KEY);
    return !hasNodes && !hasWorkflow;
  }, [initialWorkflow.nodes]);

  return {
    initialNodes,
    initialEdges,
    initialOutputs,
    initialValidationErrors: validationErrorsRef.current,
    showWelcomeInitially,
  };
}
