import DisplayTextNode, { NODE_TYPE as DISPLAY_TEXT_TYPE, createNode as createDisplayTextNode } from "./core/DisplayTextNode";
import MarkdownNode, { NODE_TYPE as MARKDOWN_TYPE, createNode as createMarkdownNode } from "./core/MarkdownNode";
import TextNode, { NODE_TYPE as TEXT_TYPE, createNode as createTextNode } from "./core/TextNode";
import ImageNode, { NODE_TYPE as IMAGE_TYPE, createNode as createImageNode } from "./core/ImageNode";
import UpscalerNode, { NODE_TYPE as UPSCALER_TYPE, createNode as createUpscalerNode } from "./core/UpscalerNode";
import VideoNode, { NODE_TYPE as VIDEO_TYPE, createNode as createVideoNode } from "./core/VideoNode";
import AudioNode, { NODE_TYPE as AUDIO_TYPE, createNode as createAudioNode } from "./core/AudioNode";
import MediaNode, { NODE_TYPE as MEDIA_TYPE, createNode as createMediaNode } from "./core/MediaNode";
import ChipNode, { NODE_TYPE as CHIP_TYPE, createNode as createChipNode } from "./core/ChipNode";
import GroupNode, { NODE_TYPE as GROUP_TYPE, createNode as createGroupNode } from "./core/GroupNode";
import { HANDLE_TYPES } from '../constants/handleTypes';
import { getNodeSchema } from './nodeSchemas';

/**
 * Built-in node types
 */
const builtInNodeTypes = {
  [DISPLAY_TEXT_TYPE]: {
    component: DisplayTextNode,
    defaultData: {
      handles: [
        { id: "text-in", type: "input", dataType: HANDLE_TYPES.TEXT.dataType },
        { id: "text-out", type: "output", dataType: HANDLE_TYPES.TEXT.dataType }
      ]
    }
  },
  [MARKDOWN_TYPE]: {
    component: MarkdownNode,
    defaultData: {
      handles: [{ id: "text-in", type: "input", dataType: HANDLE_TYPES.TEXT.dataType }]
    }
  },
  [TEXT_TYPE]: {
    component: TextNode,
    defaultData: {
      handles: getNodeSchema(TEXT_TYPE)?.handles || []
    }
  },
  [IMAGE_TYPE]: {
    component: ImageNode,
    defaultData: {
      handles: getNodeSchema(IMAGE_TYPE)?.handles || []
    }
  },
  [UPSCALER_TYPE]: {
    component: UpscalerNode,
    defaultData: {
      handles: getNodeSchema(UPSCALER_TYPE)?.handles || []
    }
  },
  [VIDEO_TYPE]: {
    component: VideoNode,
    defaultData: {
      handles: getNodeSchema(VIDEO_TYPE)?.handles || []
    }
  },
  [AUDIO_TYPE]: {
    component: AudioNode,
    defaultData: {
      handles: getNodeSchema(AUDIO_TYPE)?.handles || []
    }
  },
  [MEDIA_TYPE]: {
    component: MediaNode,
    defaultData: {
      handles: getNodeSchema(MEDIA_TYPE)?.handles || []
    }
  },
  [CHIP_TYPE]: {
    component: ChipNode,
    defaultData: {
      handles: getNodeSchema(CHIP_TYPE)?.handles || []
    }
  },
  [GROUP_TYPE]: {
    component: GroupNode,
    defaultData: {
      handles: []
    }
  }
};

/**
 * Node types registry
 */
export const nodeTypes = {
  ...builtInNodeTypes
};

export const nodeCreators = {
  [TEXT_TYPE]: createTextNode,
  [IMAGE_TYPE]: createImageNode,
  [UPSCALER_TYPE]: createUpscalerNode,
  [VIDEO_TYPE]: createVideoNode,
  [AUDIO_TYPE]: createAudioNode,
  [MEDIA_TYPE]: createMediaNode,
  [CHIP_TYPE]: createChipNode,
  [DISPLAY_TEXT_TYPE]: createDisplayTextNode,
  [MARKDOWN_TYPE]: createMarkdownNode,
  [GROUP_TYPE]: createGroupNode
};

export const nodeDefinitions = [
  {
    type: TEXT_TYPE,
    label: "Text (LLM)",
    description: "Generate text using LLM models",
    category: "Process"
  },
  {
    type: IMAGE_TYPE,
    label: "Image",
    description: "Generate images using AI models (flux, sdxl, stable-diffusion, etc.)",
    category: "Process"
  },
  {
    type: UPSCALER_TYPE,
    label: "Upscaler",
    description: "Upscale or enhance images using AI models (Real-ESRGAN, CodeFormer, etc.)",
    category: "Process"
  },
  {
    type: VIDEO_TYPE,
    label: "Video",
    description: "Generate videos using AI models (minimax/video-01, runway/gen-2, etc.)",
    category: "Process"
  },
  {
    type: AUDIO_TYPE,
    label: "Audio",
    description: "Generate audio/music/speech using AI models (meta/musicgen, suno-ai/bark, etc.)",
    category: "Process"
  },
  {
    type: MEDIA_TYPE,
    label: "Media",
    description: "Display uploaded media files (images, videos, audio)",
    category: "Input"
  },
  {
    type: DISPLAY_TEXT_TYPE,
    label: "Display Text",
    description: "A node for displaying text output",
    category: "Output"
  },
  {
    type: MARKDOWN_TYPE,
    label: "Markdown",
    description: "A node for rendering markdown content",
    category: "Output"
  },
  {
    type: CHIP_TYPE,
    label: "Chip",
    description: "Small text value that injects into prompts via __CHIPID__ placeholders",
    category: "Input"
  }
];
