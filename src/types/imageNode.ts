/**
 * Types specific to ImageNode and related image generation components
 */

import type { Position } from 'reactflow';
import type { HandleDataType } from './components';

// =============================================================================
// Handle Definition
// =============================================================================

export interface ImageNodeHandle {
  id: string;
  type: 'source' | 'target';
  position: Position;
  dataType: HandleDataType;
}

// =============================================================================
// Node Data
// =============================================================================

export interface ImageNodeData {
  title: string;
  onRemove: (id: string) => void;
  handles: ImageNodeHandle[];
  model: string;
  prompt?: string;
  content?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numOutputs?: number;
  inputImages?: string[];
  output: string | null;
  status: string;
  metadata?: string;
  isProcessing?: boolean;
  chipValues?: Record<string, string>;
  convertedSrc?: string;
  mediaPath?: string;
  imageUrl?: string;
}

// =============================================================================
// Props
// =============================================================================

export interface ImageNodeProps {
  id: string;
  data: ImageNodeData;
  selected?: boolean;
}

export interface CreateImageNodeParams {
  id: string;
  handleRemoveNode: (id: string) => void;
  position?: { x: number; y: number };
  defaultModel?: string;
}

// =============================================================================
// Event Types
// =============================================================================

export interface ContentPayload {
  type: string;
  value?: string;
  url?: string;
  chipId?: string;
  isChip?: boolean;
  model?: string;
  fromWorkflow?: boolean;
}

export interface NodeContentChangedEvent {
  detail: {
    sourceId?: string;
    targetId?: string;
    sourceHandle?: string;
    targetHandle?: string;
    content?: ContentPayload;
  };
}

// =============================================================================
// Form State
// =============================================================================

export interface ImageFormState {
  model: string;
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numOutputs?: number;
  [key: string]: unknown;
}

// =============================================================================
// Prediction Types
// =============================================================================

export interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}

// =============================================================================
// Connected Preview Types
// =============================================================================

export interface ConnectedImagePreview {
  sourceId: string;
  title: string;
  url: string | null;
}

// =============================================================================
// Schema Status Types
// =============================================================================

export type SchemaStatus = 'idle' | 'loading' | 'loaded' | 'error';
