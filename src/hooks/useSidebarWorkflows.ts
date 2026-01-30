/**
 * Hook for managing sidebar workflow operations.
 * Handles workflow CRUD with optimistic updates.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toSafeWorkflowId } from '../utils/workflowId';

// =============================================================================
// Types
// =============================================================================

export interface Workflow {
  id: string;
  name: string;
  created?: number;
  modified?: number;
  lastAccessed?: number;
  data?: {
    nodes: unknown[];
    edges: unknown[];
  };
}

export type WorkflowSortBy = 'recent' | 'name' | 'created';

interface UseSidebarWorkflowsOptions {
  onWorkflowLoad: (workflow: Workflow) => void;
  activeWorkflow: Workflow | null;
}

interface UseSidebarWorkflowsReturn {
  /** List of all workflows */
  workflows: Workflow[];
  /** Sorted workflows based on current sort setting */
  sortedWorkflows: Workflow[];
  /** Whether workflows are loading */
  isLoading: boolean;
  /** Current sort method */
  sortBy: WorkflowSortBy;
  /** Set sort method */
  setSortBy: (sortBy: WorkflowSortBy) => void;
  /** Editing state */
  editingId: string | null;
  editingName: string;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  /** Operations */
  loadWorkflows: () => Promise<void>;
  handleRename: (workflowId: string, newName: string) => Promise<void>;
  handleDelete: (workflowId: string) => Promise<void>;
  handleLoad: (workflow: Workflow) => Promise<void>;
  handleNewWorkflow: (name: string) => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing workflow operations with optimistic updates.
 */
export function useSidebarWorkflows({
  onWorkflowLoad,
  activeWorkflow,
}: UseSidebarWorkflowsOptions): UseSidebarWorkflowsReturn {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<WorkflowSortBy>('recent');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sort workflows based on selected criteria
  const sortedWorkflows = useMemo(() => {
    if (!workflows || workflows.length === 0) return [];

    const sorted = [...workflows];

    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => {
          const timeA = a.lastAccessed || a.modified || a.created || 0;
          const timeB = b.lastAccessed || b.modified || b.created || 0;
          return timeB - timeA;
        });
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'created':
        return sorted.sort((a, b) => {
          const timeA = a.created || 0;
          const timeB = b.created || 0;
          return timeB - timeA;
        });
      default:
        return sorted;
    }
  }, [workflows, sortBy]);

  const loadWorkflows = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const workflowsList = (await invoke('list_workflows')) as Workflow[];
      setWorkflows(workflowsList);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRename = useCallback(
    async (workflowId: string, newName: string): Promise<void> => {
      const trimmedName = newName.trim();
      if (!trimmedName) return;

      const nextId = toSafeWorkflowId(trimmedName);
      if (workflows.some((wf) => wf.id === nextId && wf.id !== workflowId)) {
        alert('A workflow with this name already exists.');
        return;
      }

      try {
        await invoke('rename_workflow', { id: workflowId, newName: trimmedName });
        setEditingId(null);
        await loadWorkflows();
      } catch (error) {
        console.error('Failed to rename workflow:', error);
      }
    },
    [workflows, loadWorkflows]
  );

  const handleDelete = useCallback(
    async (workflowId: string): Promise<void> => {
      if (!window.confirm('Are you sure you want to delete this workflow?')) {
        return;
      }

      // Save previous state for rollback
      const previousWorkflows = [...workflows];
      const isActiveWorkflow = activeWorkflow?.id === workflowId;

      // Optimistically remove from UI
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));

      try {
        await invoke('delete_workflow', { id: workflowId });

        // If we deleted the active workflow, select another one
        if (isActiveWorkflow) {
          const remainingWorkflows = previousWorkflows.filter((w) => w.id !== workflowId);
          if (remainingWorkflows.length > 0) {
            const loadedWorkflowData = (await invoke('load_workflow', {
              id: remainingWorkflows[0].id,
            })) as { data?: unknown };
            const loadedWorkflow: Workflow = {
              id: remainingWorkflows[0].id,
              name: remainingWorkflows[0].name,
              data: (loadedWorkflowData.data || loadedWorkflowData) as Workflow['data'],
            };
            onWorkflowLoad(loadedWorkflow);
          }
        }
      } catch (error) {
        // Rollback on error
        console.error('Failed to delete workflow:', error);
        setWorkflows(previousWorkflows);
      }
    },
    [workflows, activeWorkflow, onWorkflowLoad]
  );

  const handleLoad = useCallback(
    async (workflow: Workflow): Promise<void> => {
      try {
        const loadedWorkflowData = (await invoke('load_workflow', { id: workflow.id })) as {
          data?: unknown;
        };
        const loadedWorkflow: Workflow = {
          id: workflow.id,
          name: workflow.name,
          data: (loadedWorkflowData.data || loadedWorkflowData) as Workflow['data'],
        };
        onWorkflowLoad(loadedWorkflow);
      } catch (error) {
        console.error('Failed to load workflow:', error);
      }
    },
    [onWorkflowLoad]
  );

  const handleNewWorkflow = useCallback(
    async (name: string): Promise<void> => {
      // Determine a unique name
      const baseName = name && name.trim() ? name.trim() : 'Untitled Workflow';
      let uniqueName = baseName;
      let counter = 2;
      const existingIds = workflows.map((wf) => wf.id);
      let uniqueId = toSafeWorkflowId(uniqueName);
      while (existingIds.includes(uniqueId)) {
        uniqueName = `${baseName} ${counter}`;
        uniqueId = toSafeWorkflowId(uniqueName);
        counter++;
      }

      const newWorkflow: Workflow = {
        name: uniqueName,
        id: uniqueId,
        created: Date.now(),
        modified: Date.now(),
        data: {
          nodes: [],
          edges: [],
        },
      };

      // Save previous state for rollback
      const previousWorkflows = [...workflows];

      // Optimistically add to UI
      setWorkflows((prev) => [newWorkflow, ...prev]);

      // Load the newly created workflow immediately
      onWorkflowLoad(newWorkflow);

      try {
        await invoke('save_workflow', {
          name: newWorkflow.name,
          data: newWorkflow.data,
        });
      } catch (error) {
        // Rollback on error
        console.error('Failed to create workflow:', error);
        setWorkflows(previousWorkflows);
      }
    },
    [workflows, onWorkflowLoad]
  );

  return {
    workflows,
    sortedWorkflows,
    isLoading,
    sortBy,
    setSortBy,
    editingId,
    editingName,
    setEditingId,
    setEditingName,
    loadWorkflows,
    handleRename,
    handleDelete,
    handleLoad,
    handleNewWorkflow,
  };
}

export default useSidebarWorkflows;
