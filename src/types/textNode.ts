/**
 * Types specific to TextNode and related text generation components
 */

import type { Position } from 'reactflow';
import type { HandleDataType } from './components';

// =============================================================================
// Handle Definition
// =============================================================================

export interface TextNodeHandle {
  id: string;
  type: 'source' | 'target';
  position: Position;
  dataType: HandleDataType;
}

// =============================================================================
// Node Data
// =============================================================================

export interface TextNodeData {
  title: string;
  onRemove: (id: string) => void;
  handles: TextNodeHandle[];
  model: string;
  prompt?: string;
  content?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  destinationFolder?: string;
  imageUrl?: string;
  audioUrl?: string;
  output: string | null;
  status: string;
  metadata?: string;
  chipValues?: Record<string, string>;
  isProcessing?: boolean;
}

// =============================================================================
// Props
// =============================================================================

export interface TextNodeProps {
  id: string;
  data: TextNodeData;
  selected?: boolean;
}

export interface CreateTextNodeParams {
  id: string;
  handleRemoveNode: (id: string) => void;
  position?: { x: number; y: number };
  defaultModel?: string;
}

// =============================================================================
// Form State
// =============================================================================

export interface TextFormState {
  model: string;
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  destinationFolder?: string;
  [key: string]: unknown;
}

// =============================================================================
// Prediction Types
// =============================================================================

export interface TextPrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | unknown;
  error?: string;
}
