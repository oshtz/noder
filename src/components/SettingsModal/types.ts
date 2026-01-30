/**
 * Types for SettingsModal components.
 */

import React from 'react';
import type { EdgeType } from '../../stores/useSettingsStore';

// =============================================================================
// Tab Types
// =============================================================================

export interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// =============================================================================
// Update Types
// =============================================================================

export interface UpdateState {
  supported?: boolean;
  currentVersion?: string | null;
  updateStatus?: string;
  updateInfo?: {
    version?: string;
    publishedAt?: string;
    notes?: string;
  } | null;
  updatePath?: string | null;
  updateError?: string | null;
  lastUpdateCheck?: number | null;
}

export interface UpdateActions {
  onCheck?: () => void;
  onDownload?: () => void;
  onInstall?: () => void;
}

// =============================================================================
// Workflow Types
// =============================================================================

export interface WorkflowActions {
  onSaveWorkflow?: () => void;
  onLoadWorkflow?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearWorkflow?: () => void;
  onExportWorkflow?: () => void;
}

// =============================================================================
// Settings Props Types
// =============================================================================

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateState?: UpdateState;
  updateActions?: UpdateActions;
  workflowActions?: WorkflowActions;
}

// =============================================================================
// Tab Component Props
// =============================================================================

export interface GeneralTabProps {
  defaultSaveLocation: string;
  showTemplates: boolean;
  showAssistantPanel: boolean;
  runButtonUnlocked: boolean;
  runButtonPosition: { x: number; y: number } | null;
  onDefaultSaveLocationChange: (value: string) => void;
  onShowTemplatesChange: (value: boolean) => void;
  onShowAssistantPanelChange: (value: boolean) => void;
  onRunButtonUnlockedChange: (value: boolean) => void;
  onResetRunButtonPosition: () => void;
}

export interface ApiKeysTabProps {
  openaiApiKey: string;
  openRouterApiKey: string;
  anthropicApiKey: string;
  replicateApiKey: string;
  geminiApiKey: string;
  ollamaBaseUrl: string;
  lmStudioBaseUrl: string;
  onOpenAIApiKeyChange: (value: string) => void;
  onOpenRouterApiKeyChange: (value: string) => void;
  onAnthropicApiKeyChange: (value: string) => void;
  onReplicateApiKeyChange: (value: string) => void;
  onGeminiApiKeyChange: (value: string) => void;
  onOllamaBaseUrlChange: (value: string) => void;
  onLmStudioBaseUrlChange: (value: string) => void;
}

export interface ModelsTabProps {
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  defaultAudioModel: string;
  defaultUpscalerModel: string;
  onDefaultTextModelChange: (value: string) => void;
  onDefaultImageModelChange: (value: string) => void;
  onDefaultVideoModelChange: (value: string) => void;
  onDefaultAudioModelChange: (value: string) => void;
  onDefaultUpscalerModelChange: (value: string) => void;
}

export interface AppearanceTabProps {
  currentTheme: string;
  edgeType: EdgeType;
  onCurrentThemeChange: (value: string) => void;
  onEdgeTypeChange: (value: EdgeType) => void;
}

export interface UpdatesTabProps {
  updateState: UpdateState;
  updateActions: UpdateActions;
}

export interface WorkflowTabProps {
  workflowActions: WorkflowActions;
}
