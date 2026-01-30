/**
 * Types for Sidebar components.
 */

import { ChangeEvent, RefObject } from 'react';
import type { UpdateState, UpdateActions } from '../SettingsModal/types';

// =============================================================================
// Workflow Types
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

export interface WorkflowOutput {
  id?: string;
  type?: string;
  value?: unknown;
  nodeId?: string;
  timestamp?: number;
}

// =============================================================================
// Template Types
// =============================================================================

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  nodes: unknown[];
  edges: unknown[];
}

export interface TemplateCategory {
  id: string;
  label: string;
  icon: string;
}

// =============================================================================
// Popover Types
// =============================================================================

export type PopoverType = 'workflows' | 'templates' | 'gallery' | null;
export type WorkflowSortBy = 'recent' | 'name' | 'created';

export interface TemplateIndicatorStyle {
  width: number;
  transform: string;
  opacity: number;
}

// =============================================================================
// Component Props
// =============================================================================

export interface SidebarProps {
  onWorkflowLoad: (workflow: Workflow) => void;
  activeWorkflow: Workflow | null;
  hasUnsavedChanges: boolean;
  onSave?: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
  workflowOutputs?: WorkflowOutput[];
  database?: unknown;
  onSaveWorkflow?: () => void;
  onLoadWorkflow?: (e: ChangeEvent<HTMLInputElement>) => void;
  onExportWorkflow?: () => void;
  onClearWorkflow?: () => void;
  onLoadTemplate?: (template: Template) => void;
  workflowTemplates?: Template[];
  onGalleryDragStart?: () => void;
  onGalleryDragEnd?: () => void;
  updateState?: UpdateState | null;
  updateActions?: UpdateActions | null;
  showEditorToolbar?: boolean;
  onShowEditorToolbarChange?: (show: boolean) => void;
  onGoHome?: () => void;
}

export interface WorkflowItemProps {
  workflow: Workflow;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onLoad: (workflow: Workflow) => void;
  onStartEditing: (workflow: Workflow) => void;
  onCancelEditing: () => void;
  onRename: (workflowId: string, newName: string) => void;
  onDelete: (workflowId: string) => void;
  onEditingNameChange: (name: string) => void;
}

export interface WorkflowsPopoverProps {
  workflows: Workflow[];
  sortedWorkflows: Workflow[];
  isLoading: boolean;
  activeWorkflow: Workflow | null;
  hasUnsavedChanges: boolean;
  sortBy: WorkflowSortBy;
  editingId: string | null;
  editingName: string;
  targetRef: RefObject<HTMLElement>;
  onClose: () => void;
  onSave?: () => void;
  onSortByChange: (sortBy: WorkflowSortBy) => void;
  onLoad: (workflow: Workflow) => void;
  onStartEditing: (workflow: Workflow) => void;
  onCancelEditing: () => void;
  onRename: (workflowId: string, newName: string) => void;
  onDelete: (workflowId: string) => void;
  onEditingNameChange: (name: string) => void;
}

export interface TemplatesPopoverProps {
  templates: Template[];
  selectedCategory: string;
  indicatorStyle: TemplateIndicatorStyle;
  categoriesRef: RefObject<HTMLDivElement>;
  categoryButtonRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  targetRef: RefObject<HTMLElement>;
  onClose: () => void;
  onCategoryChange: (category: string) => void;
  onLoadTemplate: (template: Template) => void;
}

export interface TemplateCardProps {
  template: Template;
  onClick: () => void;
}
