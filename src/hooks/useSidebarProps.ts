import { useCallback, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { LOCAL_WORKFLOW_KEY } from '../utils/workflowSchema';
import type { Workflow } from './useWorkflowPersistence';
import type { WorkflowTemplate } from '../utils/workflowTemplates';

export interface UpdateState {
  supported: boolean;
  currentVersion: string;
  updateStatus: string;
  updateInfo: { version?: string; publishedAt?: string; notes?: string } | null | undefined;
  updatePath: string | null;
  updateError: string | null;
  lastUpdateCheck: number | null;
}

export interface UpdateActions {
  onCheck: () => Promise<unknown>;
  onDownload: (info: unknown) => Promise<string | null>;
  onInstall: () => Promise<void>;
}

export interface SidebarPropsConfig {
  // Workflow state
  activeWorkflow: Workflow | null;
  hasUnsavedChanges: boolean;
  workflowOutputs: unknown[];
  workflowTemplates: WorkflowTemplate[];

  // Actions
  loadWorkflow: (workflow: Workflow, options?: { onBeforeLoad?: () => void }) => Promise<void>;
  saveCurrentWorkflow: () => Promise<void>;
  saveWorkflow: () => Promise<unknown>;
  exportWorkflow: () => void;
  handleLoadTemplate: (template: WorkflowTemplate) => void;
  handleLoadWorkflow: (workflow: Workflow) => Promise<void>;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showEditorToolbar: boolean;
  setShowEditorToolbar: (show: boolean) => void;
  setShowWelcome: React.Dispatch<React.SetStateAction<boolean>>;
  setWelcomePinned: React.Dispatch<React.SetStateAction<boolean>>;

  // Node/edge state
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;

  // Database
  database: unknown;

  // Update system
  updateSupported: boolean;
  currentVersion: string;
  updateStatus: string;
  updateInfo: { version?: string; publishedAt?: string; notes?: string } | null | undefined;
  updatePath: string | null;
  updateError: string | null;
  lastUpdateCheck: number | null;
  checkForUpdate: () => Promise<unknown>;
  downloadUpdate: (info: unknown) => Promise<string | null>;
  installUpdate: () => Promise<void>;
}

export interface SidebarPropsResult {
  sidebarProps: {
    onWorkflowLoad: (workflow: { id: string; name: string }) => void;
    activeWorkflow: { id: string; name: string } | null;
    hasUnsavedChanges: boolean;
    onSave: () => Promise<void>;
    isOpen: boolean;
    onToggle: () => void;
    workflowOutputs: { id?: string; type?: string; value?: unknown }[];
    database: unknown;
    workflowTemplates: {
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      nodes: unknown[];
      edges: unknown[];
    }[];
    onLoadTemplate: (template: {
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      nodes: unknown[];
      edges: unknown[];
    }) => void;
    onGalleryDragStart: () => void;
    onGalleryDragEnd: () => void;
    updateState: UpdateState;
    updateActions: UpdateActions;
    onSaveWorkflow: () => Promise<unknown>;
    onLoadWorkflow: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExportWorkflow: () => void;
    onClearWorkflow: () => void;
    showEditorToolbar: boolean;
    onShowEditorToolbarChange: (show: boolean) => void;
    onGoHome: () => void;
  };
}

/**
 * Hook that consolidates all Sidebar props into a single object.
 * This reduces the verbosity of the Sidebar component usage in App.tsx.
 */
export function useSidebarProps({
  activeWorkflow,
  hasUnsavedChanges,
  workflowOutputs,
  workflowTemplates,
  loadWorkflow,
  saveCurrentWorkflow,
  saveWorkflow,
  exportWorkflow,
  handleLoadTemplate,
  handleLoadWorkflow,
  sidebarOpen,
  setSidebarOpen,
  showEditorToolbar,
  setShowEditorToolbar,
  setShowWelcome,
  setWelcomePinned,
  setNodes,
  setEdges,
  database,
  updateSupported,
  currentVersion,
  updateStatus,
  updateInfo,
  updatePath,
  updateError,
  lastUpdateCheck,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
}: SidebarPropsConfig): SidebarPropsResult {
  const handleClearWorkflow = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the current workflow?')) {
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('noder-nodes');
      localStorage.removeItem('noder-edges');
      localStorage.removeItem(LOCAL_WORKFLOW_KEY);
    }
  }, [setNodes, setEdges]);

  const handleGoHome = useCallback(() => {
    setWelcomePinned(true);
    setShowWelcome(true);
  }, [setWelcomePinned, setShowWelcome]);

  const handleToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, [setSidebarOpen]);

  const updateState = useMemo<UpdateState>(
    () => ({
      supported: updateSupported,
      currentVersion,
      updateStatus,
      updateInfo,
      updatePath,
      updateError,
      lastUpdateCheck,
    }),
    [
      updateSupported,
      currentVersion,
      updateStatus,
      updateInfo,
      updatePath,
      updateError,
      lastUpdateCheck,
    ]
  );

  const updateActions = useMemo<UpdateActions>(
    () => ({
      onCheck: checkForUpdate,
      onDownload: downloadUpdate,
      onInstall: installUpdate,
    }),
    [checkForUpdate, downloadUpdate, installUpdate]
  );

  const sidebarProps = useMemo(
    () => ({
      onWorkflowLoad: loadWorkflow as unknown as (workflow: { id: string; name: string }) => void,
      activeWorkflow: activeWorkflow as unknown as { id: string; name: string } | null,
      hasUnsavedChanges,
      onSave: saveCurrentWorkflow,
      isOpen: sidebarOpen,
      onToggle: handleToggle,
      workflowOutputs: workflowOutputs as unknown as {
        id?: string;
        type?: string;
        value?: unknown;
      }[],
      database,
      workflowTemplates: workflowTemplates as unknown as {
        id: string;
        name: string;
        description: string;
        icon: string;
        category: string;
        nodes: unknown[];
        edges: unknown[];
      }[],
      onLoadTemplate: handleLoadTemplate as unknown as (template: {
        id: string;
        name: string;
        description: string;
        icon: string;
        category: string;
        nodes: unknown[];
        edges: unknown[];
      }) => void,
      onGalleryDragStart: () => {},
      onGalleryDragEnd: () => {},
      updateState,
      updateActions,
      onSaveWorkflow: saveWorkflow,
      onLoadWorkflow: handleLoadWorkflow as unknown as (
        e: React.ChangeEvent<HTMLInputElement>
      ) => void,
      onExportWorkflow: exportWorkflow,
      onClearWorkflow: handleClearWorkflow,
      showEditorToolbar,
      onShowEditorToolbarChange: setShowEditorToolbar,
      onGoHome: handleGoHome,
    }),
    [
      loadWorkflow,
      activeWorkflow,
      hasUnsavedChanges,
      saveCurrentWorkflow,
      sidebarOpen,
      handleToggle,
      workflowOutputs,
      database,
      workflowTemplates,
      handleLoadTemplate,
      updateState,
      updateActions,
      saveWorkflow,
      handleLoadWorkflow,
      exportWorkflow,
      handleClearWorkflow,
      showEditorToolbar,
      setShowEditorToolbar,
      handleGoHome,
    ]
  );

  return { sidebarProps };
}
