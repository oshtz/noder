/**
 * Shared TypeScript types for React components
 */

// ============================================================================
// Common Props
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

// ============================================================================
// Validation Errors
// ============================================================================

export interface ValidationError {
  type: string;
  message: string;
  edge?: {
    source?: string;
    target?: string;
    sourceHandle?: string;
    targetHandle?: string;
  };
  errors?: string[];
}

// ============================================================================
// Failed Nodes
// ============================================================================

export interface FailedNodeData {
  label?: string;
  error?: string;
  [key: string]: unknown;
}

export interface FailedNode {
  id: string;
  type: string;
  data: FailedNodeData;
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowOutput {
  id: string;
  nodeId: string;
  type: 'image' | 'video' | 'audio' | 'text';
  value: string;
  prompt?: string;
  model?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Node Handle Types
// ============================================================================

export type HandleDataType = 'image' | 'video' | 'audio' | 'text' | 'number' | 'boolean' | 'any';

export type HandlePosition = 'left' | 'right' | 'top' | 'bottom';

export interface NodeHandle {
  id: string;
  type: 'source' | 'target' | 'input' | 'output';
  dataType: HandleDataType;
  position?: HandlePosition;
  label?: string;
}

// ============================================================================
// Node Data
// ============================================================================

export interface BaseNodeData {
  label?: string;
  executionOrder?: number;
  handles?: NodeHandle[];
  onRemove?: (nodeId: string) => void;
  [key: string]: unknown;
}

// ============================================================================
// Schema Types
// ============================================================================

export interface SchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  'x-order'?: number;
}

export interface SchemaDefinition {
  type: string;
  title?: string;
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  allOf?: SchemaDefinition[];
}

// ============================================================================
// Model Types
// ============================================================================

export interface ReplicateModel {
  owner: string;
  name: string;
  description?: string;
  visibility?: string;
  github_url?: string;
  paper_url?: string;
  run_count?: number;
  cover_image_url?: string;
  default_example?: {
    input?: Record<string, unknown>;
    output?: unknown;
  };
  latest_version?: {
    id: string;
    created_at: string;
    openapi_schema?: SchemaDefinition;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface NodeConnectionEvent {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface NodeDataUpdateEvent {
  nodeId: string;
  updates: Record<string, unknown>;
}
