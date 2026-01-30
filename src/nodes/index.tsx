import React, { ComponentType, lazy, Suspense } from 'react';

// Lazy-loaded node components for code splitting (larger components)
const DisplayTextNode = lazy(() => import('./core/DisplayTextNode'));
const MarkdownNode = lazy(() => import('./core/MarkdownNode'));
const TextNode = lazy(() => import('./core/TextNode'));
const ImageNode = lazy(() => import('./core/ImageNode'));
const UpscalerNode = lazy(() => import('./core/UpscalerNode'));
const VideoNode = lazy(() => import('./core/VideoNode'));
const AudioNode = lazy(() => import('./core/AudioNode'));
const MediaNode = lazy(() => import('./core/MediaNode'));
// ChipNode and GroupNode are statically imported (small, commonly used)

// Re-export constants and createNode functions (these are small and needed synchronously)
import {
  NODE_TYPE as DISPLAY_TEXT_TYPE,
  createNode as createDisplayTextNode,
} from './core/DisplayTextNode';
import { NODE_TYPE as MARKDOWN_TYPE, createNode as createMarkdownNode } from './core/MarkdownNode';
import { NODE_TYPE as TEXT_TYPE, createNode as createTextNode } from './core/TextNode';
import { NODE_TYPE as IMAGE_TYPE, createNode as createImageNode } from './core/ImageNode';
import { NODE_TYPE as UPSCALER_TYPE, createNode as createUpscalerNode } from './core/UpscalerNode';
import { NODE_TYPE as VIDEO_TYPE, createNode as createVideoNode } from './core/VideoNode';
import { NODE_TYPE as AUDIO_TYPE, createNode as createAudioNode } from './core/AudioNode';
import { NODE_TYPE as MEDIA_TYPE, createNode as createMediaNode } from './core/MediaNode';
// ChipNode and GroupNode: use regular imports since they're small and commonly used
import ChipNodeComponent, {
  NODE_TYPE as CHIP_TYPE,
  createNode as createChipNode,
} from './core/ChipNode';
import GroupNodeComponent, {
  NODE_TYPE as GROUP_TYPE,
  createNode as createGroupNode,
} from './core/GroupNode';

import { HANDLE_TYPES, HandleDataType } from '../constants/handleTypes';
import { getNodeSchema } from './nodeSchemas';
import { NodeErrorBoundary } from '../components/ErrorBoundary';

// =============================================================================
// Types
// =============================================================================

interface HandleDefinition {
  id: string;
  type: 'input' | 'output';
  dataType: HandleDataType;
}

interface NodeTypeDefinition {
  component: ComponentType<NodeProps>;
  defaultData: {
    handles: HandleDefinition[];
  };
}

interface NodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
  [key: string]: unknown;
}

export interface NodeDefinition {
  type: string;
  label: string;
  description: string;
  category: 'Process' | 'Input' | 'Output';
  defaultData?: {
    handles?: HandleDefinition[];
  };
  handles?: HandleDefinition[];
}

interface CreateNodeParams {
  id: string;
  handleRemoveNode?: (id: string) => void;
  position?: { x: number; y: number };
  defaultModel?: string;
  data?: Record<string, unknown>;
}

type NodeCreator = (params: CreateNodeParams) => {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
};

// =============================================================================
// Error Boundary Wrapper
// =============================================================================

/**
 * Node loading fallback component
 */
const NodeLoadingFallback: React.FC = () => (
  <div
    style={{
      padding: '16px',
      background: 'var(--node-bg)',
      borderRadius: '12px',
      minWidth: '150px',
      minHeight: '100px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-secondary)',
      fontSize: '12px',
    }}
  >
    Loading...
  </div>
);

/**
 * Wrap a node component with NodeErrorBoundary and Suspense
 * This catches errors within individual nodes without crashing the entire canvas
 * and handles lazy loading with a fallback
 */
function withNodeErrorBoundary<P extends NodeProps>(
  NodeComponent: ComponentType<P>,
  nodeType: string
): ComponentType<P> {
  const WrappedNode = (props: P) => (
    <NodeErrorBoundary nodeId={props.id} nodeType={nodeType}>
      <Suspense fallback={<NodeLoadingFallback />}>
        <NodeComponent {...props} />
      </Suspense>
    </NodeErrorBoundary>
  );
  WrappedNode.displayName = `ErrorBoundary(${(NodeComponent as { displayName?: string }).displayName || NodeComponent.name || nodeType})`;
  return WrappedNode;
}

// =============================================================================
// Built-in Node Types
// =============================================================================

/**
 * Built-in node types
 * All node components are wrapped with NodeErrorBoundary for error isolation
 */
const builtInNodeTypes: Record<string, NodeTypeDefinition> = {
  [DISPLAY_TEXT_TYPE]: {
    component: withNodeErrorBoundary(
      DisplayTextNode as ComponentType<NodeProps>,
      DISPLAY_TEXT_TYPE
    ),
    defaultData: {
      handles: [
        { id: 'text-in', type: 'input', dataType: HANDLE_TYPES.TEXT.dataType },
        { id: 'text-out', type: 'output', dataType: HANDLE_TYPES.TEXT.dataType },
      ],
    },
  },
  [MARKDOWN_TYPE]: {
    component: withNodeErrorBoundary(MarkdownNode as ComponentType<NodeProps>, MARKDOWN_TYPE),
    defaultData: {
      handles: [{ id: 'text-in', type: 'input', dataType: HANDLE_TYPES.TEXT.dataType }],
    },
  },
  [TEXT_TYPE]: {
    component: withNodeErrorBoundary(TextNode as ComponentType<NodeProps>, TEXT_TYPE),
    defaultData: {
      handles: getNodeSchema(TEXT_TYPE)?.handles || [],
    },
  },
  [IMAGE_TYPE]: {
    component: withNodeErrorBoundary(ImageNode as ComponentType<NodeProps>, IMAGE_TYPE),
    defaultData: {
      handles: getNodeSchema(IMAGE_TYPE)?.handles || [],
    },
  },
  [UPSCALER_TYPE]: {
    component: withNodeErrorBoundary(UpscalerNode as ComponentType<NodeProps>, UPSCALER_TYPE),
    defaultData: {
      handles: getNodeSchema(UPSCALER_TYPE)?.handles || [],
    },
  },
  [VIDEO_TYPE]: {
    component: withNodeErrorBoundary(VideoNode as ComponentType<NodeProps>, VIDEO_TYPE),
    defaultData: {
      handles: getNodeSchema(VIDEO_TYPE)?.handles || [],
    },
  },
  [AUDIO_TYPE]: {
    component: withNodeErrorBoundary(AudioNode as ComponentType<NodeProps>, AUDIO_TYPE),
    defaultData: {
      handles: getNodeSchema(AUDIO_TYPE)?.handles || [],
    },
  },
  [MEDIA_TYPE]: {
    component: withNodeErrorBoundary(MediaNode as ComponentType<NodeProps>, MEDIA_TYPE),
    defaultData: {
      handles: getNodeSchema(MEDIA_TYPE)?.handles || [],
    },
  },
  [CHIP_TYPE]: {
    component: withNodeErrorBoundary(ChipNodeComponent as ComponentType<NodeProps>, CHIP_TYPE),
    defaultData: {
      handles: getNodeSchema(CHIP_TYPE)?.handles || [],
    },
  },
  [GROUP_TYPE]: {
    component: withNodeErrorBoundary(GroupNodeComponent as ComponentType<NodeProps>, GROUP_TYPE),
    defaultData: {
      handles: [],
    },
  },
};

// =============================================================================
// Exports
// =============================================================================

/**
 * Node types registry
 */
export const nodeTypes: Record<string, NodeTypeDefinition> = {
  ...builtInNodeTypes,
};

export const nodeCreators: Record<string, NodeCreator> = {
  [TEXT_TYPE]: createTextNode,
  [IMAGE_TYPE]: createImageNode,
  [UPSCALER_TYPE]: createUpscalerNode,
  [VIDEO_TYPE]: createVideoNode,
  [AUDIO_TYPE]: createAudioNode,
  [MEDIA_TYPE]: createMediaNode,
  [CHIP_TYPE]: createChipNode,
  [DISPLAY_TEXT_TYPE]: createDisplayTextNode,
  [MARKDOWN_TYPE]: createMarkdownNode,
  [GROUP_TYPE]: createGroupNode,
};

export const nodeDefinitions: NodeDefinition[] = [
  {
    type: TEXT_TYPE,
    label: 'Text (LLM)',
    description: 'Generate text using LLM models',
    category: 'Process',
  },
  {
    type: IMAGE_TYPE,
    label: 'Image',
    description: 'Generate images using AI models (flux, sdxl, stable-diffusion, etc.)',
    category: 'Process',
  },
  {
    type: UPSCALER_TYPE,
    label: 'Upscaler',
    description: 'Upscale or enhance images using AI models (Real-ESRGAN, CodeFormer, etc.)',
    category: 'Process',
  },
  {
    type: VIDEO_TYPE,
    label: 'Video',
    description: 'Generate videos using AI models (minimax/video-01, runway/gen-2, etc.)',
    category: 'Process',
  },
  {
    type: AUDIO_TYPE,
    label: 'Audio',
    description: 'Generate audio/music/speech using AI models (meta/musicgen, suno-ai/bark, etc.)',
    category: 'Process',
  },
  {
    type: MEDIA_TYPE,
    label: 'Media',
    description: 'Display uploaded media files (images, videos, audio)',
    category: 'Input',
  },
  {
    type: DISPLAY_TEXT_TYPE,
    label: 'Display Text',
    description: 'A node for displaying text output',
    category: 'Output',
  },
  {
    type: MARKDOWN_TYPE,
    label: 'Markdown',
    description: 'A node for rendering markdown content',
    category: 'Output',
  },
  {
    type: CHIP_TYPE,
    label: 'Chip',
    description:
      'Reusable text value that injects into connected node prompts. Set chipId (e.g. "STYLE") and content (e.g. "anime"). In connected prompts, use __STYLE__ placeholder which gets replaced with the chip content. Connect chip output to image/text node input.',
    category: 'Input',
  },
];
