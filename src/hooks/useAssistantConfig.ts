/**
 * Hook for assistant panel configuration
 * Extracted from App.tsx to reduce component size
 */

import { useMemo, useCallback } from 'react';
import type { Node, Edge, ReactFlowInstance } from 'reactflow';
import { nodeDefinitions, nodeTypes as registeredNodeTypes, NodeDefinition } from '../nodes';
import { getNodeSchema } from '../nodes/nodeSchemas';
import { buildAssistantSystemPrompt } from '../utils/assistantPrompt';
import { createToolExecutor } from '../utils/assistantToolExecutor';
import { ASSISTANT_ALLOWED_NODE_TYPES } from '../constants/app';
import type { WorkflowTemplate } from '../utils/workflowTemplates';
import type { ValidationError } from '../types/components';

// ============================================================================
// Types
// ============================================================================

export interface RunWorkflowOptions {
  targetNodeIds?: string[] | null;
  trigger?: string;
  resume?: boolean;
  retryNodeIds?: string[] | null;
  retryFailed?: boolean;
  skipFailed?: boolean;
  continueOnError?: boolean;
}

export interface UseAssistantConfigOptions {
  nodes: Node[];
  edges: Edge[];
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  handleRemoveNode: (nodeId: string) => void;
  runWorkflow: (options?: RunWorkflowOptions) => Promise<void>;
  reactFlowInstance: ReactFlowInstance | null;
  workflowTemplates: WorkflowTemplate[];
}

export interface UseAssistantConfigReturn {
  assistantSystemPrompt: string;
  executeToolCall: (toolCall: unknown) => unknown;
  assistantNodeDefinitions: NodeDefinition[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAssistantConfig({
  nodes,
  edges,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  setValidationErrors,
  handleRemoveNode,
  runWorkflow,
  reactFlowInstance,
  workflowTemplates,
}: UseAssistantConfigOptions): UseAssistantConfigReturn {
  /**
   * Filtered node definitions for assistant (only allowed types)
   */
  const assistantNodeDefinitions = useMemo(
    () =>
      nodeDefinitions.filter((node: NodeDefinition) =>
        ASSISTANT_ALLOWED_NODE_TYPES.includes(node.type)
      ),
    []
  );

  /**
   * Node schemas for assistant (only allowed types)
   */
  const assistantNodeSchemas = useMemo(() => {
    const entries = assistantNodeDefinitions
      .map((node: NodeDefinition) => {
        const schema = getNodeSchema(node.type);
        return schema ? [node.type, schema] : null;
      })
      .filter(Boolean) as [string, unknown][];
    return Object.fromEntries(entries);
  }, [assistantNodeDefinitions]);

  /**
   * Node types for assistant (only allowed types)
   */
  const assistantNodeTypes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(registeredNodeTypes).filter(([type]) =>
          ASSISTANT_ALLOWED_NODE_TYPES.includes(type)
        )
      ),
    []
  );

  /**
   * System prompt for assistant
   */
  const assistantSystemPrompt = useMemo(
    () =>
      buildAssistantSystemPrompt({
        nodeDefinitions: assistantNodeDefinitions,
        nodeTypes: assistantNodeTypes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeSchemas: assistantNodeSchemas as any,
        workflowTemplates: workflowTemplates,
      }),
    [assistantNodeDefinitions, assistantNodeSchemas, assistantNodeTypes, workflowTemplates]
  );

  /**
   * Tool executor for assistant
   */
  const toolExecutor = useMemo(
    () =>
      createToolExecutor({
        getNodes: () => nodesRef.current || nodes,
        getEdges: () => edgesRef.current || edges,
        setNodes,
        setEdges,
        handleRemoveNode,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setValidationErrors: setValidationErrors as any,
        runWorkflow,
        allowedNodeTypes: ASSISTANT_ALLOWED_NODE_TYPES,
        focusCanvas: () => {
          if (!reactFlowInstance) return;
          setTimeout(() => {
            reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
          }, 0);
        },
      }),
    [
      edges,
      handleRemoveNode,
      nodes,
      nodesRef,
      edgesRef,
      reactFlowInstance,
      runWorkflow,
      setEdges,
      setNodes,
      setValidationErrors,
    ]
  );

  /**
   * Execute a tool call from the assistant
   */
  const executeToolCall = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (toolCall: unknown) => toolExecutor.executeToolCall(toolCall as any),
    [toolExecutor]
  );

  return {
    assistantSystemPrompt,
    executeToolCall,
    assistantNodeDefinitions,
  };
}
