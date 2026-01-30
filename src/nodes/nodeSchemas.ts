import { z, ZodTypeAny, ZodObject, ZodRawShape } from 'zod';
import { Position } from 'reactflow';
import { HANDLE_TYPES } from '../constants/handleTypes';

// ============================================================================
// Type Definitions
// ============================================================================

export type FieldType = 'text' | 'textarea' | 'number' | 'slider' | 'select';

export interface BaseField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  default?: string | number;
  help?: string;
}

export interface TextField extends BaseField {
  type: 'text' | 'textarea';
  rows?: number;
  default?: string;
}

export interface NumberField extends BaseField {
  type: 'number' | 'slider';
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export interface SelectField extends BaseField {
  type: 'select';
  options: string[];
  default?: string;
}

export type Field = TextField | NumberField | SelectField;

export type HandleType = 'source' | 'target';

export interface Handle {
  id: string;
  type: HandleType;
  position: Position;
  dataType: string;
  style?: React.CSSProperties;
}

export type NodeType = 'text' | 'image' | 'upscaler' | 'video' | 'audio' | 'chip' | 'media';

export interface NodeDefinition {
  type: NodeType;
  title: string;
  fields: Field[];
  handles: Handle[];
}

export interface BuiltNodeSchema<T extends ZodRawShape = ZodRawShape> extends NodeDefinition {
  zod: ZodObject<T>;
  defaults: Record<string, unknown>;
}

// ============================================================================
// Schema Building Functions
// ============================================================================

const toZodField = (field: Field): ZodTypeAny => {
  switch (field.type) {
    case 'number':
    case 'slider': {
      const numField = field as NumberField;
      const fallback =
        typeof numField.default === 'number'
          ? numField.default
          : typeof numField.min === 'number'
            ? numField.min
            : 0;
      let base = z.number({ invalid_type_error: `${numField.label} must be a number` });
      if (typeof numField.min === 'number') base = base.min(numField.min);
      if (typeof numField.max === 'number') base = base.max(numField.max);
      return z.preprocess((value) => {
        if (value === '' || value === null || value === undefined) return fallback;
        const num = Number(value);
        return Number.isNaN(num) ? value : num;
      }, base);
    }
    case 'select': {
      const selectField = field as SelectField;
      const options =
        selectField.options && selectField.options.length ? selectField.options : ['option'];
      const baseSchema = z.enum(options as [string, ...string[]]);
      if (selectField.default) {
        return baseSchema.default(selectField.default);
      }
      return baseSchema;
    }
    case 'textarea':
    case 'text':
    default: {
      const textField = field as TextField;
      const baseStringSchema = z.string();
      if (typeof textField.default === 'string') {
        return baseStringSchema.default(textField.default);
      }
      return baseStringSchema.default('');
    }
  }
};

const buildSchema = <T extends NodeDefinition>(
  definition: T
): T & { zod: ZodObject<ZodRawShape>; defaults: Record<string, unknown> } => {
  const shape: ZodRawShape = {};
  const defaults: Record<string, unknown> = {};

  (definition.fields || []).forEach((field) => {
    shape[field.key] = toZodField(field);

    if (field.default !== undefined) {
      defaults[field.key] = field.default;
      return;
    }

    switch (field.type) {
      case 'number':
      case 'slider': {
        const numField = field as NumberField;
        defaults[field.key] = typeof numField.min === 'number' ? numField.min : 0;
        break;
      }
      case 'select': {
        const selectField = field as SelectField;
        defaults[field.key] =
          selectField.options && selectField.options.length ? selectField.options[0] : 'option';
        break;
      }
      case 'textarea':
      case 'text':
      default:
        defaults[field.key] = '';
        break;
    }
  });

  // Use passthrough() to preserve unknown fields (like aspect_ratio from dynamic model schemas)
  const zodSchema = z.object(shape).passthrough();
  const parsedDefaults = zodSchema.safeParse(defaults);

  return {
    ...definition,
    zod: zodSchema,
    defaults: parsedDefaults.success ? parsedDefaults.data : defaults,
  };
};

// ============================================================================
// Node Definitions
// ============================================================================

const textDefinition = buildSchema({
  type: 'text' as const,
  title: 'Text (LLM)',
  fields: [
    {
      key: 'model',
      label: 'Model',
      type: 'text' as const,
      placeholder: 'openai/gpt-4o-mini',
      default: 'openai/gpt-4o-mini',
      help: 'Replicate text/LLM model (e.g., openai/gpt-4o-mini, meta/llama-3)',
    },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea' as const,
      placeholder: 'Enter your prompt here...',
      rows: 4,
      default: '',
    },
    {
      key: 'systemPrompt',
      label: 'System Prompt (optional)',
      type: 'textarea' as const,
      placeholder: 'You are a helpful assistant',
      rows: 2,
      default: '',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'slider' as const,
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.7,
      help: '0 = deterministic, 2 = creative',
    },
    {
      key: 'maxTokens',
      label: 'Max Tokens',
      type: 'number' as const,
      min: 1,
      max: 4096,
      default: 512,
      help: 'Maximum number of tokens to generate',
    },
    {
      key: 'destinationFolder',
      label: 'Save Location',
      type: 'text' as const,
      placeholder: 'Downloads/noder',
      default: '',
      help: 'Folder to save generated text. Leave empty for default (Downloads/noder)',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: 'any',
      style: { top: '50%' },
    },
    {
      id: 'out',
      type: 'source' as const,
      position: Position.Right,
      dataType: 'any',
      style: { top: '50%' },
    },
  ],
});

const imageDefinition = buildSchema({
  type: 'image' as const,
  title: 'Image Generation',
  fields: [
    {
      key: 'model',
      label: 'Model',
      type: 'text' as const,
      placeholder: 'black-forest-labs/flux-2-klein-4b',
      default: 'black-forest-labs/flux-2-klein-4b',
      help: 'Replicate image model (e.g., flux-2-klein-4b, sdxl, stable-diffusion)',
    },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea' as const,
      placeholder: 'Describe the image to generate...',
      rows: 4,
      default: '',
    },
    {
      key: 'negativePrompt',
      label: 'Negative Prompt (optional)',
      type: 'textarea' as const,
      placeholder: 'What to avoid in the image...',
      rows: 2,
      default: '',
    },
    {
      key: 'width',
      label: 'Width',
      type: 'number' as const,
      min: 256,
      max: 2048,
      default: 1024,
      help: 'Image width in pixels',
    },
    {
      key: 'height',
      label: 'Height',
      type: 'number' as const,
      min: 256,
      max: 2048,
      default: 1024,
      help: 'Image height in pixels',
    },
    {
      key: 'numOutputs',
      label: 'Number of Images',
      type: 'number' as const,
      min: 1,
      max: 4,
      default: 1,
      help: 'Number of images to generate',
    },
    {
      key: 'destinationFolder',
      label: 'Save Location',
      type: 'text' as const,
      placeholder: 'Downloads/noder',
      default: '',
      help: 'Folder to save generated images. Leave empty for default (Downloads/noder)',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: 'any',
      style: { top: '50%' },
    },
    {
      id: 'out',
      type: 'source' as const,
      position: Position.Right,
      dataType: 'any',
      style: { top: '50%' },
    },
  ],
});

const upscalerDefinition = buildSchema({
  type: 'upscaler' as const,
  title: 'Upscaler',
  fields: [
    {
      key: 'model',
      label: 'Model',
      type: 'text' as const,
      placeholder: 'recraft-ai/recraft-crisp-upscale',
      default: 'recraft-ai/recraft-crisp-upscale',
      help: 'Replicate upscaler model (e.g., recraft-ai/recraft-crisp-upscale, nightmareai/real-esrgan)',
    },
    {
      key: 'imageUrl',
      label: 'Image URL (optional)',
      type: 'text' as const,
      placeholder: 'https://... or connect an image input',
      default: '',
      help: 'Optional direct image URL to upscale if no input is connected',
    },
    {
      key: 'prompt',
      label: 'Prompt (optional)',
      type: 'textarea' as const,
      placeholder: 'Optional guidance prompt',
      rows: 2,
      default: '',
    },
    {
      key: 'scale',
      label: 'Scale',
      type: 'number' as const,
      min: 1,
      max: 8,
      default: 4,
      help: 'Upscale factor (model-dependent)',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: HANDLE_TYPES.IMAGE.dataType,
      style: { top: '50%' },
    },
    {
      id: 'out',
      type: 'source' as const,
      position: Position.Right,
      dataType: HANDLE_TYPES.IMAGE.dataType,
      style: { top: '50%' },
    },
  ],
});

const videoDefinition = buildSchema({
  type: 'video' as const,
  title: 'Video',
  fields: [
    {
      key: 'model',
      label: 'Model',
      type: 'text' as const,
      placeholder: 'lightricks/ltx-2-fast',
      default: 'lightricks/ltx-2-fast',
      help: 'Replicate video model. Text-to-video: lightricks/ltx-2-fast, Image-to-video: lightricks/ltx-2-fast',
    },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea' as const,
      placeholder: 'Describe the video to generate...',
      rows: 4,
      default: '',
    },
    {
      key: 'imageUrl',
      label: 'Input Image URL (optional)',
      type: 'text' as const,
      placeholder: 'https://... or connect an image input',
      default: '',
      help: 'Optional starting image for image-to-video models',
    },
    {
      key: 'videoUrl',
      label: 'Input Video URL (optional)',
      type: 'text' as const,
      placeholder: 'https://... or connect a video input',
      default: '',
      help: 'Optional starting video for enhance/upscale models',
    },
    {
      key: 'duration',
      label: 'Duration (seconds)',
      type: 'number' as const,
      min: 1,
      max: 10,
      default: 5,
      help: 'Video duration in seconds (model-dependent)',
    },
    {
      key: 'fps',
      label: 'FPS',
      type: 'number' as const,
      min: 8,
      max: 60,
      default: 24,
      help: 'Frames per second',
    },
    {
      key: 'destinationFolder',
      label: 'Save Location',
      type: 'text' as const,
      placeholder: 'Downloads/noder',
      default: '',
      help: 'Folder to save generated videos. Leave empty for default (Downloads/noder)',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: 'any', // Accepts text, image, or video - node determines type from connection
      style: { top: '50%' },
    },
    {
      id: 'video-out',
      type: 'source' as const,
      position: Position.Right,
      dataType: HANDLE_TYPES.VIDEO.dataType,
      style: { top: '50%' },
    },
  ],
});

const audioDefinition = buildSchema({
  type: 'audio' as const,
  title: 'Audio',
  fields: [
    {
      key: 'model',
      label: 'Model',
      type: 'text' as const,
      placeholder: 'google/lyria-2',
      default: 'google/lyria-2',
      help: 'Replicate audio model (e.g., google/lyria-2, meta/musicgen)',
    },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea' as const,
      placeholder: 'Describe the audio/music to generate or text to speak...',
      rows: 4,
      default: '',
    },
    {
      key: 'duration',
      label: 'Duration (seconds)',
      type: 'number' as const,
      min: 1,
      max: 30,
      default: 8,
      help: 'Audio duration in seconds (for music generation)',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'slider' as const,
      min: 0,
      max: 1.5,
      step: 0.1,
      default: 1.0,
      help: 'Creativity level for generation',
    },
    {
      key: 'destinationFolder',
      label: 'Save Location',
      type: 'text' as const,
      placeholder: 'Downloads/noder',
      default: '',
      help: 'Folder to save generated audio. Leave empty for default (Downloads/noder)',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: 'any',
      style: { top: '50%' },
    },
    {
      id: 'out',
      type: 'source' as const,
      position: Position.Right,
      dataType: 'any',
      style: { top: '50%' },
    },
  ],
});

const chipDefinition = buildSchema({
  type: 'chip' as const,
  title: 'Chip',
  fields: [
    {
      key: 'content',
      label: 'Content',
      type: 'text' as const,
      placeholder: 'e.g. anime, cyberpunk, red',
      default: '',
      help: 'The value that replaces __CHIPID__ in connected prompts',
    },
    {
      key: 'chipId',
      label: 'Chip ID',
      type: 'text' as const,
      placeholder: 'e.g. STYLE, COLOR, CHARACTER',
      default: '',
      help: 'Creates placeholder __CHIPID__ (e.g. chipId="STYLE" creates __STYLE__). Use this placeholder in connected node prompts.',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: HANDLE_TYPES.TEXT.dataType,
      style: { top: '50%' },
    },
    {
      id: 'out',
      type: 'source' as const,
      position: Position.Right,
      dataType: HANDLE_TYPES.TEXT.dataType,
      style: { top: '50%' },
    },
  ],
});

const mediaDefinition = buildSchema({
  type: 'media' as const,
  title: 'Media',
  fields: [
    {
      key: 'mediaPath',
      label: 'Media Path',
      type: 'text' as const,
      placeholder: 'Path to media file',
      default: '',
      help: 'Path to the uploaded media file',
    },
    {
      key: 'mediaType',
      label: 'Media Type',
      type: 'select' as const,
      options: ['image', 'video', 'audio'],
      default: 'image',
      help: 'Type of media (image, video, or audio)',
    },
    {
      key: 'autoUpload',
      label: 'Auto-upload to Replicate',
      type: 'select' as const,
      options: ['true', 'false'],
      default: 'true',
      help: 'Automatically upload media to Replicate when file changes',
    },
    {
      key: 'objectFit',
      label: 'Image Fit',
      type: 'select' as const,
      options: ['cover', 'contain', 'fill', 'none'],
      default: 'cover',
      help: 'How the image should fit in the container',
    },
    {
      key: 'autoPlay',
      label: 'Auto-play Video/Audio',
      type: 'select' as const,
      options: ['true', 'false'],
      default: 'true',
      help: 'Automatically play video/audio when loaded',
    },
    {
      key: 'loop',
      label: 'Loop Media',
      type: 'select' as const,
      options: ['true', 'false'],
      default: 'true',
      help: 'Loop video/audio playback',
    },
    {
      key: 'showUploadStatus',
      label: 'Show Upload Badge',
      type: 'select' as const,
      options: ['true', 'false'],
      default: 'true',
      help: 'Display upload status indicator on media',
    },
  ],
  handles: [
    {
      id: 'in',
      type: 'target' as const,
      position: Position.Left,
      dataType: 'any',
      style: { top: '50%' },
    },
    {
      id: 'out',
      type: 'source' as const,
      position: Position.Right,
      dataType: HANDLE_TYPES.IMAGE.type,
      style: { top: '50%' },
    },
  ],
});

// ============================================================================
// Exports
// ============================================================================

export const NODE_SCHEMAS: Record<NodeType, BuiltNodeSchema> = {
  [textDefinition.type]: textDefinition,
  [imageDefinition.type]: imageDefinition,
  [upscalerDefinition.type]: upscalerDefinition,
  [videoDefinition.type]: videoDefinition,
  [audioDefinition.type]: audioDefinition,
  [chipDefinition.type]: chipDefinition,
  [mediaDefinition.type]: mediaDefinition,
};

export const getNodeSchema = (type: NodeType | string): BuiltNodeSchema | undefined =>
  NODE_SCHEMAS[type as NodeType];

export const parseNodeData = <T extends Record<string, unknown>>(
  definition: BuiltNodeSchema,
  data: T | null | undefined = {} as T
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...definition.defaults };
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  });

  const parsed = definition.zod.safeParse(merged);
  return parsed.success ? parsed.data : definition.defaults;
};
