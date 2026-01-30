/**
 * Workflow-related TypeScript types for the App component and related hooks
 */

import type { Node, Edge, Viewport, CoordinateExtent } from 'reactflow';

// Re-export types from existing files to avoid conflicts
export type { WorkflowTemplate, TemplateNode, TemplateEdge } from '../utils/workflowTemplates';
export type { ValidationError, FailedNode as FailedNodeComponent } from './components';

// ============================================================================
// Node Data Types
// ============================================================================

export interface NodeData {
  title?: string;
  onRemove?: (id: string) => void;
  handles?: HandleDefinition[];
  executionOrder?: number;
  content?: string;
  prompt?: string;
  text?: string;
  model?: string;
  output?: string | null;
  error?: string | null;
  isProcessing?: boolean;
  metadata?: string;
  replicateFileId?: string;
  mediaPath?: string;
  mediaType?: string;
  lastRunDurationMs?: number;
  lastRunAt?: number;
  chipValues?: Record<string, string>;
  convertedSrc?: string;
  imageUrl?: string;
  label?: string;
  childCount?: number;
  [key: string]: unknown;
}

export interface HandleDefinition {
  id: string;
  type: 'source' | 'target' | 'input' | 'output';
  position: string;
  dataType?: string;
}

// ============================================================================
// Workflow Node/Edge Types
// ============================================================================

export interface WorkflowNode extends Node<NodeData> {
  className?: string;
  parentNode?: string;
  parentId?: string;
  extent?: 'parent' | CoordinateExtent;
}

export interface EdgeData {
  isProcessing?: boolean;
  edgeType?: string;
  showSourceGlow?: boolean;
  showTargetGlow?: boolean;
  sourceNodeWidth?: number;
  sourceNodeHeight?: number;
  targetNodeWidth?: number;
  targetNodeHeight?: number;
}

export interface WorkflowEdge extends Edge<EdgeData> {}

// ============================================================================
// RunWorkflow Types (for useWorkflowRunner hook)
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

// ============================================================================
// Workflow Document Types (for local use - compatible with existing types)
// ============================================================================

export interface WorkflowInfo {
  id: string;
  name: string;
  data?: WorkflowDocument;
}

export interface WorkflowDocument {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  outputs?: unknown[];
  metadata?: WorkflowMetadataLocal;
  viewport?: Viewport;
}

export interface WorkflowMetadataLocal {
  id?: string | null;
  name?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface FailedNode {
  id: string;
  error: string;
  node: WorkflowNode;
}

export interface WorkflowResult {
  success: boolean;
  error?: string;
  duration?: number;
  completedCount?: number;
  nodeOutputs?: Record<string, unknown>;
}

export interface HistoryEntry {
  id: string;
  workflowId: string | null;
  workflowName: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  success: boolean;
  nodeCount: number;
  completedCount: number;
  outputCount: number;
  error: string | null;
  trigger: string;
  scope: string[] | string;
}

export interface ExecutionState {
  nodeOutputs: Record<string, unknown>;
  scopeNodeIds: string[];
  failedNodeIds: string[];
}

// ============================================================================
// Gallery/Media Types
// ============================================================================

export interface GalleryDragData {
  type: string;
  value: string;
  prompt?: string;
  model?: string;
}

export interface OutputPayload {
  type: string;
  value: string;
  metadata?: {
    model?: string;
  };
}

// ============================================================================
// Connection Types
// ============================================================================

export interface ConnectionContext {
  sourceNode: string;
  sourceHandle: string;
  handleType: string | null;
}

// ============================================================================
// Handle Alias Types
// ============================================================================

export type HandleAliasMap = {
  [nodeType: string]: {
    source?: Record<string, string>;
    target?: Record<string, string>;
  };
};

// ============================================================================
// Progress Types
// ============================================================================

export interface WorkflowProgress {
  percentage: number;
  completed: number;
  total: number;
}

// ============================================================================
// Callback Types
// ============================================================================

export interface WorkflowCallbacks {
  onNodeStart?: (node: Node) => void;
  onNodeComplete?: (node: Node, output: unknown) => void;
  onNodeError?: (node: Node, error: Error) => void;
  onProgress?: (progress: WorkflowProgress) => void;
}
