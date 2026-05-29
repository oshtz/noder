import React, { ComponentType } from 'react';
import type { Node } from 'reactflow';

import DisplayTextNode, {
  NODE_TYPE as DISPLAY_TEXT_TYPE,
  createNode as createDisplayTextNode,
} from './core/DisplayTextNode';
import MarkdownNode, {
  NODE_TYPE as MARKDOWN_TYPE,
  createNode as createMarkdownNode,
} from './core/MarkdownNode';
import TextNode, { NODE_TYPE as TEXT_TYPE, createNode as createTextNode } from './core/TextNode';
import ImageNode, {
  NODE_TYPE as IMAGE_TYPE,
  createNode as createImageNode,
} from './core/ImageNode';
import UpscalerNode, {
  NODE_TYPE as UPSCALER_TYPE,
  createNode as createUpscalerNode,
} from './core/UpscalerNode';
import VideoNode, {
  NODE_TYPE as VIDEO_TYPE,
  createNode as createVideoNode,
} from './core/VideoNode';
import AudioNode, {
  NODE_TYPE as AUDIO_TYPE,
  createNode as createAudioNode,
} from './core/AudioNode';
import MediaNode, {
  NODE_TYPE as MEDIA_TYPE,
  createNode as createMediaNode,
} from './core/MediaNode';
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
  type: 'input' | 'output' | 'target' | 'source';
  dataType?: HandleDataType;
  position?: unknown;
  style?: React.CSSProperties;
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

interface NodeCreatorParams {
  id: string;
  handleRemoveNode?: (id: string) => void;
  position?: { x: number; y: number };
  defaultModel?: string;
  data?: Record<string, unknown>;
  style?: { width: number; height: number };
  className?: string;
  dragHandle?: string;
}

type CreatedNode = Node<Record<string, unknown>> & {
  style?: React.CSSProperties;
  selectable?: boolean;
  draggable?: boolean;
};

type NodeCreator = (params: NodeCreatorParams) => CreatedNode;

// =============================================================================
// Error Boundary Wrapper
// =============================================================================

/**
 * Wrap a node component with NodeErrorBoundary
 * This catches errors within individual nodes without crashing the entire canvas
 */
const asNodeComponent = (component: unknown): ComponentType<NodeProps> =>
  component as ComponentType<NodeProps>;

const asNodeCreator = (creator: unknown): NodeCreator => creator as NodeCreator;

function withNodeErrorBoundary(
  NodeComponent: ComponentType<NodeProps>,
  nodeType: string
): ComponentType<NodeProps> {
  const WrappedNode = (props: NodeProps) => (
    <NodeErrorBoundary nodeId={props.id} nodeType={nodeType}>
      <NodeComponent {...props} />
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
    component: withNodeErrorBoundary(asNodeComponent(DisplayTextNode), DISPLAY_TEXT_TYPE),
    defaultData: {
      handles: [
        { id: 'text-in', type: 'input', dataType: HANDLE_TYPES.TEXT.dataType },
        { id: 'text-out', type: 'output', dataType: HANDLE_TYPES.TEXT.dataType },
      ],
    },
  },
  [MARKDOWN_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(MarkdownNode), MARKDOWN_TYPE),
    defaultData: {
      handles: [{ id: 'text-in', type: 'input', dataType: HANDLE_TYPES.TEXT.dataType }],
    },
  },
  [TEXT_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(TextNode), TEXT_TYPE),
    defaultData: {
      handles: getNodeSchema(TEXT_TYPE)?.handles || [],
    },
  },
  [IMAGE_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(ImageNode), IMAGE_TYPE),
    defaultData: {
      handles: getNodeSchema(IMAGE_TYPE)?.handles || [],
    },
  },
  [UPSCALER_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(UpscalerNode), UPSCALER_TYPE),
    defaultData: {
      handles: getNodeSchema(UPSCALER_TYPE)?.handles || [],
    },
  },
  [VIDEO_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(VideoNode), VIDEO_TYPE),
    defaultData: {
      handles: getNodeSchema(VIDEO_TYPE)?.handles || [],
    },
  },
  [AUDIO_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(AudioNode), AUDIO_TYPE),
    defaultData: {
      handles: getNodeSchema(AUDIO_TYPE)?.handles || [],
    },
  },
  [MEDIA_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(MediaNode), MEDIA_TYPE),
    defaultData: {
      handles: getNodeSchema(MEDIA_TYPE)?.handles || [],
    },
  },
  [CHIP_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(ChipNodeComponent), CHIP_TYPE),
    defaultData: {
      handles: getNodeSchema(CHIP_TYPE)?.handles || [],
    },
  },
  [GROUP_TYPE]: {
    component: withNodeErrorBoundary(asNodeComponent(GroupNodeComponent), GROUP_TYPE),
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
  [TEXT_TYPE]: asNodeCreator(createTextNode),
  [IMAGE_TYPE]: asNodeCreator(createImageNode),
  [UPSCALER_TYPE]: asNodeCreator(createUpscalerNode),
  [VIDEO_TYPE]: asNodeCreator(createVideoNode),
  [AUDIO_TYPE]: asNodeCreator(createAudioNode),
  [MEDIA_TYPE]: asNodeCreator(createMediaNode),
  [CHIP_TYPE]: asNodeCreator(createChipNode),
  [DISPLAY_TEXT_TYPE]: asNodeCreator(createDisplayTextNode),
  [MARKDOWN_TYPE]: asNodeCreator(createMarkdownNode),
  [GROUP_TYPE]: asNodeCreator(createGroupNode),
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
