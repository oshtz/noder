/**
 * Zustand Stores for Noder
 *
 * This module exports all Zustand stores used for state management in the application.
 * These stores replace the many useState calls in App.jsx and provide:
 * - Centralized state management
 * - Reduced prop drilling
 * - Better performance through selective re-renders
 * - Easier testing and debugging
 */

// Settings Store - API keys, preferences, theme, default models
export {
  useSettingsStore,
  useOpenAIApiKey,
  useReplicateApiKey,
  useCurrentTheme,
  useEdgeType,
  useShowAssistantPanel,
  useShowEditorToolbar,
} from './useSettingsStore';
export type {
  SettingsState,
  SettingsActions,
  SettingsStore,
  NodeType,
  EdgeType,
  RunButtonPosition,
} from './useSettingsStore';

// UI Store - modal states, panel visibility, selection, helper lines
export {
  useUIStore,
  useSidebarOpen,
  useShowGallery,
  useShowWelcome,
  useSelectedNodeId,
  useValidationErrors,
  useHelperLines,
} from './useUIStore';
export type { UIState, UIActions, UIStore, NodeSelectorContext } from './useUIStore';

// Workflow Store - nodes, edges, metadata, outputs
export {
  useWorkflowStore,
  useNodes,
  useEdges,
  useViewport,
  useActiveWorkflow,
  useWorkflowMetadata,
  useHasUnsavedChanges,
  useWorkflowOutputs,
  useNode,
  useNodeData,
  useNodeEdges,
  useIncomingEdges,
  useOutgoingEdges,
} from './useWorkflowStore';
export type {
  WorkflowState,
  WorkflowActions,
  WorkflowStore,
  WorkflowMetadata,
  WorkflowDocument,
  Workflow,
  WorkflowOutput,
  WorkflowHistoryEntry,
} from './useWorkflowStore';

// Execution Store - processing state, errors, progress
export {
  useExecutionStore,
  useIsProcessing,
  useCurrentWorkflowId,
  useFailedNodes,
  useShowErrorRecovery,
  useExecutionProgress,
} from './useExecutionStore';
export type {
  ExecutionStoreState,
  ExecutionStoreActions,
  ExecutionStore,
  NodeOutput,
  ExecutionState,
  FailedNode,
  NodeTimings,
  ResumeState,
} from './useExecutionStore';

/**
 * Initialize all stores
 * Call this on app startup to load persisted state
 */
export async function initializeStores(): Promise<void> {
  const { useSettingsStore } = await import('./useSettingsStore');

  // Load settings from Tauri backend
  await useSettingsStore.getState().loadFromTauri();
}
