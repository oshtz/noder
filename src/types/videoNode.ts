/**
 * Types specific to VideoNode and related video generation components
 */

import type { Position } from 'reactflow';
import type { HandleDataType } from './components';

// =============================================================================
// Handle Definition
// =============================================================================

export interface VideoNodeHandle {
  id: string;
  type: 'source' | 'target';
  position: Position;
  dataType: HandleDataType;
}

// =============================================================================
// Node Data
// =============================================================================

export interface VideoNodeData {
  title: string;
  onRemove: (id: string) => void;
  handles: VideoNodeHandle[];
  model: string;
  prompt?: string;
  content?: string;
  imageUrl?: string;
  duration?: number;
  fps?: number;
  output: string | null;
  status: string;
  metadata?: string;
  isProcessing?: boolean;
  chipValues?: Record<string, string>;
}

// =============================================================================
// Props
// =============================================================================

export interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  selected?: boolean;
}

export interface CreateVideoNodeParams {
  id: string;
  handleRemoveNode: (id: string) => void;
  position?: { x: number; y: number };
  defaultModel?: string;
}

// =============================================================================
// Form State
// =============================================================================

export interface VideoFormState {
  model: string;
  prompt?: string;
  imageUrl?: string;
  duration?: number;
  fps?: number;
  [key: string]: unknown;
}

// =============================================================================
// Prediction Types
// =============================================================================

export interface VideoPrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}
