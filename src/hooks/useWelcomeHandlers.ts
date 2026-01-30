import { useCallback } from 'react';
import type { Node, Edge, ReactFlowInstance } from 'reactflow';
import { useUpdateNodeInternals } from 'reactflow';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '../utils/eventBus';
import { toSafeWorkflowId } from '../utils/workflowId';
import { buildWorkflowDocument } from '../utils/workflowSchema';
import { applyTemplate } from '../utils/workflowTemplates';
import { markEdgeGlows } from '../utils/workflowHelpers';
import type { WorkflowDocument } from '../utils/workflowSchema';
import type { WorkflowTemplate } from '../utils/workflowTemplates';
import type { Workflow } from './useWorkflowPersistence';

export interface WelcomeHandlersConfig {
  setShowWelcome: React.Dispatch<React.SetStateAction<boolean>>;
  setWelcomePinned: React.Dispatch<React.SetStateAction<boolean>>;
  setHideEmptyHint: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  loadWorkflow: (workflow: Workflow, options?: { onBeforeLoad?: () => void }) => Promise<void>;
  handleRemoveNode: (nodeId: string) => Promise<void>;
  reactFlowInstance: ReactFlowInstance | null;
  openNodeSelectorAt: (event?: React.MouseEvent<HTMLButtonElement>) => void;
}

export interface WelcomeHandlersResult {
  handleCreateWorkflowFromWelcome: (requestedName?: string) => Promise<void>;
  handleBuildWithAI: () => void;
  handleStartFromScratch: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  handleLoadWorkflowFromWelcome: (workflow?: Workflow) => Promise<void>;
  handleLoadTemplate: (template: WorkflowTemplate) => void;
}

export function useWelcomeHandlers({
  setShowWelcome,
  setWelcomePinned,
  setHideEmptyHint,
  setSidebarOpen,
  setNodes,
  setEdges,
  loadWorkflow,
  handleRemoveNode,
  reactFlowInstance,
  openNodeSelectorAt,
}: WelcomeHandlersConfig): WelcomeHandlersResult {
  const updateNodeInternals = useUpdateNodeInternals();

  const handleCreateWorkflowFromWelcome = useCallback(
    async (requestedName?: string): Promise<void> => {
      setShowWelcome(false);
      setWelcomePinned(false);

      let existingIds: string[] = [];
      try {
        const workflowsList = (await invoke('list_workflows')) as Workflow[];
        existingIds = Array.isArray(workflowsList) ? workflowsList.map((wf) => wf.id) : [];
      } catch (error) {
        console.error('Failed to list workflows:', error);
      }

      const trimmedName = typeof requestedName === 'string' ? requestedName.trim() : '';
      const baseName = trimmedName || 'Untitled Workflow';
      let uniqueName = baseName;
      let uniqueId = toSafeWorkflowId(uniqueName);
      let counter = 2;
      while (existingIds.includes(uniqueId)) {
        uniqueName = `${baseName} ${counter}`;
        uniqueId = toSafeWorkflowId(uniqueName);
        counter += 1;
      }

      const document = buildWorkflowDocument({
        id: uniqueId,
        name: uniqueName,
        nodes: [],
        edges: [],
      });
      const newWorkflow = { id: uniqueId, name: uniqueName, data: document };

      try {
        await invoke('save_workflow', { name: newWorkflow.name, data: document });
      } catch (error) {
        console.error('Failed to create workflow:', error);
      }

      await loadWorkflow(newWorkflow);
      reactFlowInstance?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 });
    },
    [loadWorkflow, reactFlowInstance, setShowWelcome, setWelcomePinned]
  );

  const handleBuildWithAI = useCallback((): void => {
    setShowWelcome(false);
    setWelcomePinned(false);
    setHideEmptyHint(true);
    emit('assistantOpen');
  }, [setShowWelcome, setWelcomePinned, setHideEmptyHint]);

  const handleStartFromScratch = useCallback(
    (event?: React.MouseEvent<HTMLButtonElement>): void => {
      setShowWelcome(false);
      setWelcomePinned(false);
      setHideEmptyHint(true);
      openNodeSelectorAt(event);
    },
    [openNodeSelectorAt, setShowWelcome, setWelcomePinned, setHideEmptyHint]
  );

  const handleLoadWorkflowFromWelcome = useCallback(
    async (workflow?: Workflow): Promise<void> => {
      setShowWelcome(false);
      setWelcomePinned(false);

      if (workflow?.id) {
        try {
          const loadedData = (await invoke('load_workflow', { id: workflow.id })) as
            | { data?: WorkflowDocument }
            | WorkflowDocument;
          const workflowData =
            'data' in loadedData && loadedData.data
              ? loadedData.data
              : (loadedData as WorkflowDocument);
          await loadWorkflow({ id: workflow.id, name: workflow.name, data: workflowData });
        } catch (error) {
          console.error('Failed to load workflow from welcome screen:', error);
          setSidebarOpen(true);
        }
      } else {
        setSidebarOpen(true);
      }
    },
    [loadWorkflow, setShowWelcome, setWelcomePinned, setSidebarOpen]
  );

  const handleLoadTemplate = useCallback(
    (template: WorkflowTemplate): void => {
      setShowWelcome(false);
      setWelcomePinned(false);
      setNodes([]);
      setEdges([]);

      const { nodes: templateNodes, edges: templateEdges } = applyTemplate(
        template,
        handleRemoveNode
      );

      // Set nodes first, then update node internals and set edges
      setNodes(templateNodes as Node[]);

      // Use requestAnimationFrame to ensure Handle components have mounted in DOM
      requestAnimationFrame(() => {
        // Force ReactFlow to register handles in its internal store
        const nodeIds = templateNodes.map((n: Node) => n.id);
        nodeIds.forEach((id: string) => updateNodeInternals(id));

        // Set edges after handles are registered
        requestAnimationFrame(() => {
          setEdges(markEdgeGlows(templateEdges as Edge[]));
          requestAnimationFrame(() => {
            reactFlowInstance?.fitView({ padding: 0.2, duration: 800 });
          });
        });
      });
    },
    [
      handleRemoveNode,
      reactFlowInstance,
      setShowWelcome,
      setWelcomePinned,
      setNodes,
      setEdges,
      updateNodeInternals,
    ]
  );

  return {
    handleCreateWorkflowFromWelcome,
    handleBuildWithAI,
    handleStartFromScratch,
    handleLoadWorkflowFromWelcome,
    handleLoadTemplate,
  };
}
