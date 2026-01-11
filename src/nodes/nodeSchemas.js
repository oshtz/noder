import { z } from "zod";
import { Position } from "reactflow";
import { HANDLE_TYPES } from "../constants/handleTypes";

const toZodField = (field) => {
  switch (field.type) {
    case 'number': {
      const fallback = typeof field.default === 'number'
        ? field.default
        : (typeof field.min === 'number' ? field.min : 0);
      let base = z.number({ invalid_type_error: `${field.label} must be a number` });
      if (typeof field.min === 'number') base = base.min(field.min);
      if (typeof field.max === 'number') base = base.max(field.max);
      return z.preprocess((value) => {
        if (value === '' || value === null || value === undefined) return fallback;
        const num = Number(value);
        return Number.isNaN(num) ? value : num;
      }, base);
    }
    case 'slider': {
      const fallback = typeof field.default === 'number'
        ? field.default
        : (typeof field.min === 'number' ? field.min : 0);
      let base = z.number({ invalid_type_error: `${field.label} must be a number` });
      if (typeof field.min === 'number') base = base.min(field.min);
      if (typeof field.max === 'number') base = base.max(field.max);
      return z.preprocess((value) => {
        if (value === '' || value === null || value === undefined) return fallback;
        const num = Number(value);
        return Number.isNaN(num) ? value : num;
      }, base);
    }
    case 'select': {
      const options = field.options && field.options.length ? field.options : ['option'];
      let schema = z.enum(options);
      if (field.default) schema = schema.default(field.default);
      return schema;
    }
    case 'textarea':
    case 'text':
    default: {
      let schema = z.string();
      if (typeof field.default === 'string') {
        schema = schema.default(field.default);
      } else {
        schema = schema.default('');
      }
      return schema;
    }
  }
};

const buildSchema = (definition) => {
  const shape = {};
  const defaults = {};

  (definition.fields || []).forEach((field) => {
    shape[field.key] = toZodField(field);

    if (field.default !== undefined) {
      defaults[field.key] = field.default;
      return;
    }

    switch (field.type) {
      case 'number':
      case 'slider':
        defaults[field.key] = typeof field.min === 'number' ? field.min : 0;
        break;
      case 'select':
        defaults[field.key] = (field.options && field.options.length) ? field.options[0] : 'option';
        break;
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
    defaults: parsedDefaults.success ? parsedDefaults.data : defaults
  };
};

const textDefinition = buildSchema({
  type: "text",
  title: "Text (LLM)",
  fields: [
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "google/gemini-2.5-flash",
      default: "google/gemini-2.5-flash",
      help: "Replicate text/LLM model (e.g., google/gemini-2.5-flash, meta/llama-3)"
    },
    {
      key: "prompt",
      label: "Prompt",
      type: "textarea",
      placeholder: "Enter your prompt here...",
      rows: 4,
      default: ""
    },
    {
      key: "systemPrompt",
      label: "System Prompt (optional)",
      type: "textarea",
      placeholder: "You are a helpful assistant",
      rows: 2,
      default: ""
    },
    {
      key: "temperature",
      label: "Temperature",
      type: "slider",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.7,
      help: "0 = deterministic, 2 = creative"
    },
    {
      key: "maxTokens",
      label: "Max Tokens",
      type: "number",
      min: 1,
      max: 4096,
      default: 512,
      help: "Maximum number of tokens to generate"
    },
    {
      key: "destinationFolder",
      label: "Save Location",
      type: "text",
      placeholder: "Downloads/noder",
      default: "",
      help: "Folder to save generated text. Leave empty for default (Downloads/noder)"
    }
  ],
  handles: [
    {
      id: "in",
      type: "target",
      position: Position.Left,
      dataType: "any",
      style: { top: '50%' }
    },
    {
      id: "out",
      type: "source",
      position: Position.Right,
      dataType: "any",
      style: { top: '50%' }
    }
  ]
});

const imageDefinition = buildSchema({
  type: "image",
  title: "Image Generation",
  fields: [
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "black-forest-labs/flux-schnell",
      default: "black-forest-labs/flux-schnell",
      help: "Replicate image model (e.g., flux-schnell, sdxl, stable-diffusion)"
    },
    {
      key: "prompt",
      label: "Prompt",
      type: "textarea",
      placeholder: "Describe the image to generate...",
      rows: 4,
      default: ""
    },
    {
      key: "negativePrompt",
      label: "Negative Prompt (optional)",
      type: "textarea",
      placeholder: "What to avoid in the image...",
      rows: 2,
      default: ""
    },
    {
      key: "width",
      label: "Width",
      type: "number",
      min: 256,
      max: 2048,
      default: 1024,
      help: "Image width in pixels"
    },
    {
      key: "height",
      label: "Height",
      type: "number",
      min: 256,
      max: 2048,
      default: 1024,
      help: "Image height in pixels"
    },
    {
      key: "numOutputs",
      label: "Number of Images",
      type: "number",
      min: 1,
      max: 4,
      default: 1,
      help: "Number of images to generate"
    },
    {
      key: "destinationFolder",
      label: "Save Location",
      type: "text",
      placeholder: "Downloads/noder",
      default: "",
      help: "Folder to save generated images. Leave empty for default (Downloads/noder)"
    }
  ],
  handles: [
    {
      id: "in",
      type: "target",
      position: Position.Left,
      dataType: "any",
      style: { top: '50%' }
    },
    {
      id: "out",
      type: "source",
      position: Position.Right,
      dataType: "any",
      style: { top: '50%' }
    }
  ]
});

const upscalerDefinition = buildSchema({
  type: "upscaler",
  title: "Upscaler",
  fields: [
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "recraft-ai/recraft-crisp-upscale",
      default: "recraft-ai/recraft-crisp-upscale",
      help: "Replicate upscaler model (e.g., recraft-ai/recraft-crisp-upscale, nightmareai/real-esrgan)"
    },
    {
      key: "imageUrl",
      label: "Image URL (optional)",
      type: "text",
      placeholder: "https://... or connect an image input",
      default: "",
      help: "Optional direct image URL to upscale if no input is connected"
    },
    {
      key: "prompt",
      label: "Prompt (optional)",
      type: "textarea",
      placeholder: "Optional guidance prompt",
      rows: 2,
      default: ""
    },
    {
      key: "scale",
      label: "Scale",
      type: "number",
      min: 1,
      max: 8,
      default: 4,
      help: "Upscale factor (model-dependent)"
    }
  ],
  handles: [
    {
      id: "in",
      type: "target",
      position: Position.Left,
      dataType: HANDLE_TYPES.IMAGE.dataType,
      style: { top: '50%' }
    },
    {
      id: "out",
      type: "source",
      position: Position.Right,
      dataType: HANDLE_TYPES.IMAGE.dataType,
      style: { top: '50%' }
    }
  ]
});

const videoDefinition = buildSchema({
  type: "video",
  title: "Video",
  fields: [
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "wan-video/wan-2.5-t2v-fast",
      default: "wan-video/wan-2.5-t2v-fast",
      help: "Replicate video model. Text-to-video: wan-video/wan-2.5-t2v-fast, Image-to-video: wan-video/wan-2.5-i2v-fast"
    },
    {
      key: "prompt",
      label: "Prompt",
      type: "textarea",
      placeholder: "Describe the video to generate...",
      rows: 4,
      default: ""
    },
    {
      key: "imageUrl",
      label: "Input Image URL (optional)",
      type: "text",
      placeholder: "https://... or connect an image input",
      default: "",
      help: "Optional starting image for image-to-video models"
    },
    {
      key: "videoUrl",
      label: "Input Video URL (optional)",
      type: "text",
      placeholder: "https://... or connect a video input",
      default: "",
      help: "Optional starting video for enhance/upscale models"
    },
    {
      key: "duration",
      label: "Duration (seconds)",
      type: "number",
      min: 1,
      max: 10,
      default: 5,
      help: "Video duration in seconds (model-dependent)"
    },
    {
      key: "fps",
      label: "FPS",
      type: "number",
      min: 8,
      max: 60,
      default: 24,
      help: "Frames per second"
    },
    {
      key: "destinationFolder",
      label: "Save Location",
      type: "text",
      placeholder: "Downloads/noder",
      default: "",
      help: "Folder to save generated videos. Leave empty for default (Downloads/noder)"
    }
  ],
  handles: [
    {
      id: "prompt-in",
      type: "target",
      position: Position.Left,
      dataType: HANDLE_TYPES.TEXT.dataType,
      style: { top: '25%' }
    },
    {
      id: "image-in",
      type: "target",
      position: Position.Left,
      dataType: HANDLE_TYPES.IMAGE.dataType,
      style: { top: '50%' }
    },
    {
      id: "video-in",
      type: "target",
      position: Position.Left,
      dataType: HANDLE_TYPES.VIDEO.dataType,
      style: { top: '75%' }
    },
    {
      id: "video-out",
      type: "source",
      position: Position.Right,
      dataType: HANDLE_TYPES.VIDEO.dataType,
      style: { top: '50%' }
    }
  ]
});

const audioDefinition = buildSchema({
  type: "audio",
  title: "Audio",
  fields: [
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "google/lyria-2",
      default: "google/lyria-2",
      help: "Replicate audio model (e.g., google/lyria-2, meta/musicgen)"
    },
    {
      key: "prompt",
      label: "Prompt",
      type: "textarea",
      placeholder: "Describe the audio/music to generate or text to speak...",
      rows: 4,
      default: ""
    },
    {
      key: "duration",
      label: "Duration (seconds)",
      type: "number",
      min: 1,
      max: 30,
      default: 8,
      help: "Audio duration in seconds (for music generation)"
    },
    {
      key: "temperature",
      label: "Temperature",
      type: "slider",
      min: 0,
      max: 1.5,
      step: 0.1,
      default: 1.0,
      help: "Creativity level for generation"
    },
    {
      key: "destinationFolder",
      label: "Save Location",
      type: "text",
      placeholder: "Downloads/noder",
      default: "",
      help: "Folder to save generated audio. Leave empty for default (Downloads/noder)"
    }
  ],
  handles: [
    {
      id: "in",
      type: "target",
      position: Position.Left,
      dataType: "any",
      style: { top: '50%' }
    },
    {
      id: "out",
      type: "source",
      position: Position.Right,
      dataType: "any",
      style: { top: '50%' }
    }
  ]
});

const chipDefinition = buildSchema({
  type: "chip",
  title: "Chip",
  fields: [
    {
      key: "content",
      label: "Content",
      type: "text",
      placeholder: "Value to inject...",
      default: "",
      help: "The text value that will replace the chip placeholder in prompts"
    },
    {
      key: "chipId",
      label: "Chip ID",
      type: "text",
      placeholder: "CHIP1",
      default: "",
      help: "Custom identifier for the chip (e.g., COLOR, STYLE). Used as __CHIPID__ placeholder"
    }
  ],
  handles: [
    {
      id: "out",
      type: "source",
      position: Position.Right,
      dataType: HANDLE_TYPES.TEXT.dataType,
      style: { top: '50%' }
    }
  ]
});

const mediaDefinition = buildSchema({
  type: "media",
  title: "Media",
  fields: [
    {
      key: "mediaPath",
      label: "Media Path",
      type: "text",
      placeholder: "Path to media file",
      default: "",
      help: "Path to the uploaded media file"
    },
    {
      key: "mediaType",
      label: "Media Type",
      type: "select",
      options: ["image", "video", "audio"],
      default: "image",
      help: "Type of media (image, video, or audio)"
    },
    {
      key: "autoUpload",
      label: "Auto-upload to Replicate",
      type: "select",
      options: ["true", "false"],
      default: "true",
      help: "Automatically upload media to Replicate when file changes"
    },
    {
      key: "objectFit",
      label: "Image Fit",
      type: "select",
      options: ["cover", "contain", "fill", "none"],
      default: "cover",
      help: "How the image should fit in the container"
    },
    {
      key: "autoPlay",
      label: "Auto-play Video/Audio",
      type: "select",
      options: ["true", "false"],
      default: "true",
      help: "Automatically play video/audio when loaded"
    },
    {
      key: "loop",
      label: "Loop Media",
      type: "select",
      options: ["true", "false"],
      default: "true",
      help: "Loop video/audio playback"
    },
    {
      key: "showUploadStatus",
      label: "Show Upload Badge",
      type: "select",
      options: ["true", "false"],
      default: "true",
      help: "Display upload status indicator on media"
    }
  ],
  handles: [
    {
      id: "in",
      type: "target",
      position: Position.Left,
      dataType: "any",
      style: { top: '50%' }
    },
    {
      id: "out",
      type: "source",
      position: Position.Right,
      dataType: HANDLE_TYPES.IMAGE.type,
      style: { top: '50%' }
    }
  ]
});

export const NODE_SCHEMAS = {
  [textDefinition.type]: textDefinition,
  [imageDefinition.type]: imageDefinition,
  [upscalerDefinition.type]: upscalerDefinition,
  [videoDefinition.type]: videoDefinition,
  [audioDefinition.type]: audioDefinition,
  [chipDefinition.type]: chipDefinition,
  [mediaDefinition.type]: mediaDefinition
};

export const getNodeSchema = (type) => NODE_SCHEMAS[type];

export const parseNodeData = (definition, data = {}) => {
  const merged = { ...definition.defaults };
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  });

  const parsed = definition.zod.safeParse(merged);
  return parsed.success ? parsed.data : definition.defaults;
};
