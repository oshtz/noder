/**
 * Workflow Executor - Integration layer between DAG runner and event-based nodes
 *
 * This module orchestrates workflow execution by:
 * 1. Using DAG runner for dependency ordering
 * 2. Triggering node execution via the existing event system
 * 3. Managing node state and progress
 * 4. Using schema-based input mapping for Replicate nodes
 * 5. Managing Replicate file uploads and cleanup
 * 6. Routing to OpenRouter or Replicate based on model provider
 */

import { invoke } from '@tauri-apps/api/core';
import { buildDependencyGraph, topologicalSort, getNodeInputs } from './workflowRunner';
import { HANDLE_TYPES } from '../constants/handleTypes';
import { fetchModelSchema, buildReplicateInput, getInputMapping } from './replicateSchemaCache';
import { deleteFileFromReplicate } from './replicateFiles';
import { emit } from './eventBus';
import { chatCompletion } from '../api/openrouter';
import { getApiKey } from '../api/settings';

// =============================================================================
// Provider Detection
// =============================================================================

/** Known OpenRouter model providers (text/chat models) */
const OPENROUTER_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'google',
  'meta-llama',
  'mistralai',
  'deepseek',
  'qwen',
  'cohere',
  'perplexity',
  'openrouter',
]);

/** Known Replicate model owners (image/video/audio generation) */
const REPLICATE_OWNERS = new Set([
  'stability-ai',
  'black-forest-labs',
  'nightmareai',
  'lucataco',
  'cjwbw',
  'minimax',
  'fofr',
  'zsxkib',
  'tencentarc',
  'meta',
]);

/**
 * Determine which API provider to use for a model
 */
function getModelProvider(modelId: string): 'openrouter' | 'replicate' {
  const [owner] = modelId.split('/');
  const ownerLower = owner.toLowerCase();

  // Check if it's a known OpenRouter provider
  if (OPENROUTER_PROVIDERS.has(ownerLower)) {
    return 'openrouter';
  }

  // Check if it's a known Replicate owner
  if (REPLICATE_OWNERS.has(ownerLower)) {
    return 'replicate';
  }

  // Default to Replicate for image/video/audio models (most common use case)
  return 'replicate';
}

type PredictionStatus = 'succeeded' | 'failed' | 'canceled' | string;

type Prediction = {
  id: string;
  status: PredictionStatus;
  output?: unknown;
  error?: string;
};

type PollProgress = {
  attempts: number;
  maxAttempts: number;
  status: PredictionStatus;
};

type PollOptions = {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: (progress: PollProgress) => void;
};

type NodeInputItem = {
  type?: string;
  value?: unknown;
  isChip?: boolean;
  chipId?: string;
};

type NodeInputs = Record<string, NodeInputItem | NodeInputItem[]>;

type NodeOutputValue = {
  type: string;
  value: unknown;
  metadata?: Record<string, unknown>;
  isChip?: boolean;
  chipId?: string;
  success?: boolean;
  timestamp?: string;
};

type NodeOutputs = Record<string, NodeOutputValue | unknown>;

type NodeData = Record<string, unknown>;

type WorkflowNode = {
  id: string;
  type: string;
  data: NodeData;
};

type WorkflowEdge = {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
};

type ExecutionContext = Record<string, unknown>;

type CollectedInputs = {
  text: unknown[];
  image: unknown[];
  video: unknown[];
  audio: unknown[];
};

type InputMappingEntry = {
  role?: string;
  isArray?: boolean;
};

type InputMapping = {
  image: InputMappingEntry[];
  video: InputMappingEntry[];
  audio: InputMappingEntry[];
};

type WorkflowProgress = {
  completed: number;
  total: number;
  percentage: number;
};

type ExecuteWorkflowOptions = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  context?: ExecutionContext;
  onNodeStart?: (node: WorkflowNode) => void;
  onNodeComplete?: (node: WorkflowNode, output: NodeOutputs) => void;
  onNodeError?: (node: WorkflowNode, error: unknown) => void;
  onNodeSkip?: (node: WorkflowNode, reason: string) => void;
  onProgress?: (progress: WorkflowProgress) => void;
  autoCleanup?: boolean;
  initialNodeOutputs?: Record<string, NodeOutputs>;
  skipNodeIds?: string[];
  continueOnError?: boolean;
};

type ExecuteWorkflowResult = {
  success: boolean;
  workflowId: string;
  duration: number;
  nodeOutputs: Record<string, NodeOutputs>;
  completedCount: number;
  skippedNodes: string[];
  error?: string;
  errors?: unknown[];
};
/**
 * Poll a Replicate prediction until it completes or times out
 * @param {string} predictionId - The prediction ID to poll
 * @param {Object} options - Polling options
 * @param {number} options.maxAttempts - Maximum polling attempts (default: 120)
 * @param {number} options.intervalMs - Interval between polls in ms (default: 1000)
 * @param {Function} options.onProgress - Optional progress callback
 * @returns {Promise<Object>} The final prediction object
 */
async function pollPrediction(
  predictionId: string,
  options: PollOptions = {}
): Promise<Prediction> {
  const { maxAttempts = 120, intervalMs = 1000, onProgress = null } = options;

  let currentPrediction = await invoke<Prediction>('replicate_get_prediction', { predictionId });
  let attempts = 0;

  while (
    currentPrediction.status !== 'succeeded' &&
    currentPrediction.status !== 'failed' &&
    currentPrediction.status !== 'canceled' &&
    attempts < maxAttempts
  ) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    currentPrediction = await invoke<Prediction>('replicate_get_prediction', { predictionId });
    attempts++;

    if (onProgress && attempts % 10 === 0) {
      onProgress({ attempts, maxAttempts, status: currentPrediction.status });
    }
  }

  return currentPrediction;
}

/**
 * Handle the result of a completed Replicate prediction
 * @param {Object} prediction - The prediction object
 * @param {string} outputType - The expected output type (from HANDLE_TYPES)
 * @param {Object} metadata - Additional metadata to include in the result
 * @returns {Object} The formatted output result
 * @throws {Error} If prediction failed, was canceled, or timed out
 */
function handlePredictionResult(
  prediction: Prediction,
  outputType: string,
  metadata: Record<string, unknown> = {}
): NodeOutputs {
  if (prediction.status === 'succeeded') {
    const output = prediction.output;
    let result;

    if (Array.isArray(output) && output.length > 0) {
      // For text nodes, join array; for media, take first element
      if (outputType === HANDLE_TYPES.TEXT.type) {
        result = output.join('');
      } else {
        result = output[0];
      }
    } else if (typeof output === 'string') {
      result = output;
    } else {
      if (outputType === HANDLE_TYPES.TEXT.type) {
        result = JSON.stringify(output);
      } else {
        throw new Error('Unexpected output format');
      }
    }

    return {
      out: {
        type: outputType,
        value: result,
        metadata: { ...metadata, predictionId: prediction.id },
      },
    };
  } else if (prediction.status === 'failed') {
    throw new Error(prediction.error || 'Prediction failed');
  } else if (prediction.status === 'canceled') {
    throw new Error('Prediction was canceled');
  } else {
    throw new Error('Prediction timed out');
  }
}

/**
 * Create and poll a Replicate prediction until completion
 * @param {string} model - The model identifier
 * @param {Object} input - The input parameters for the model
 * @param {string} outputType - The expected output type (from HANDLE_TYPES)
 * @param {Object} options - Additional options
 * @param {number} options.maxAttempts - Maximum polling attempts
 * @param {Function} options.onProgress - Optional progress callback
 * @returns {Promise<Object>} The formatted output result
 */
async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
  outputType: string,
  options: PollOptions = {}
): Promise<NodeOutputs> {
  const prediction = await invoke<Prediction>('replicate_create_prediction', { model, input });

  const finalPrediction = await pollPrediction(prediction.id, {
    maxAttempts: options.maxAttempts || 120,
    onProgress: options.onProgress,
  });

  return handlePredictionResult(finalPrediction, outputType, { model });
}

/**
 * Run a text completion using OpenRouter
 */
async function runOpenRouterCompletion(
  model: string,
  prompt: string,
  options: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    imageUrl?: string;
  } = {}
): Promise<NodeOutputs> {
  const apiKey = await getApiKey('openrouter');

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Please add it in Settings.');
  }

  // Build messages array
  const messages: {
    role: 'system' | 'user' | 'assistant';
    content: string | Record<string, unknown>[];
  }[] = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  // Handle multimodal input (text + image)
  if (options.imageUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: options.imageUrl } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  console.log(`[Executor] Running OpenRouter completion`, { model, messages });

  const response = await chatCompletion({
    apiKey,
    model,
    messages: messages as unknown as Parameters<typeof chatCompletion>[0]['messages'],
  });

  const content = response?.choices?.[0]?.message?.content || '';

  return {
    out: {
      type: HANDLE_TYPES.TEXT.type,
      value: content,
      metadata: { model, provider: 'openrouter' },
    },
  };
}

/**
 * Replace chip placeholders in a prompt string
 * Chips are identified by __CHIPID__ pattern and replaced with their values
 */
function replaceChipPlaceholders(prompt: string, chipValues: Record<string, string>): string {
  if (!prompt || !chipValues || Object.keys(chipValues).length === 0) {
    return prompt;
  }

  let result = prompt;

  // Replace each chip placeholder with its value
  Object.entries(chipValues).forEach(([chipId, value]) => {
    // Support both __CHIPID__ and __chipid__ patterns (case-insensitive)
    const pattern = new RegExp(`__${chipId}__`, 'gi');
    result = result.replace(pattern, value);
  });

  return result;
}

/**
 * Collect chip values from inputs and node data
 * Returns an object mapping chipId -> content
 */
function collectChipValues(inputs: NodeInputs, nodeData: NodeData = {}): Record<string, string> {
  const chipValues: Record<string, string> = {};

  // First, get chip values stored in node data (from real-time updates)
  if (nodeData.chipValues) {
    Object.assign(chipValues, nodeData.chipValues);
  }

  // Then collect from inputs (these take precedence)
  Object.entries(inputs).forEach(([_handleId, data]) => {
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (item?.isChip && item?.chipId) {
          chipValues[item.chipId] = (item.value || '') as string;
        }
      });
    } else if (data?.isChip && data?.chipId) {
      chipValues[data.chipId] = (data.value || '') as string;
    }
  });

  return chipValues;
}

/**
 * Execute Text node - routes to OpenRouter or Replicate based on model
 */
async function executeTextNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<NodeOutputs> {
  const collectedInputs = collectInputsByType(inputs);
  const chipValues = collectChipValues(inputs, node.data);

  if (collectedInputs.video.length > 0 || collectedInputs.audio.length > 0) {
    throw new Error('Text: video/audio inputs are not supported for this node.');
  }

  // Get base prompt and apply chip replacements
  let prompt = getFirstInputValue(collectedInputs, 'text') || node.data.prompt || '';
  prompt = replaceChipPlaceholders(prompt, chipValues);

  if (!prompt.trim()) {
    throw new Error('No prompt provided');
  }

  const model = node.data.model || 'meta/meta-llama-3-70b-instruct';
  const provider = getModelProvider(model);

  console.log(`[Executor] Running Text node ${node.id} via ${provider}`, { model, prompt });

  // Route to the appropriate provider
  if (provider === 'openrouter') {
    return await runOpenRouterCompletion(model, prompt, {
      systemPrompt: node.data.systemPrompt,
      temperature: node.data.temperature,
      maxTokens: node.data.maxTokens,
      imageUrl: collectedInputs.image.length > 0 ? collectedInputs.image[0] : undefined,
    });
  }

  // Replicate path
  if (collectedInputs.image.length > 0) {
    try {
      const schema = await fetchModelSchema(model);
      validateConnectedInputs(schema, collectedInputs, node, model);
    } catch (error) {
      if (
        (error as Error)?.message?.includes('does not accept') ||
        (error as Error)?.message?.includes('accepts a single')
      ) {
        throw error;
      }
      console.warn(`[Executor] Skipping schema validation for ${model}:`, error);
    }
  }

  const input: Record<string, unknown> = { prompt };
  if (collectedInputs.image.length > 0) {
    input.image = collectedInputs.image[0];
  }

  if (node.data.systemPrompt && (node.data.systemPrompt as string).trim()) {
    input.system_prompt = node.data.systemPrompt;
  }
  if (node.data.temperature !== undefined) {
    input.temperature = node.data.temperature;
  }
  if (node.data.maxTokens) {
    input.max_tokens = node.data.maxTokens;
  }

  return await runReplicatePrediction(model, input, HANDLE_TYPES.TEXT.type);
}
/**
 * Collect inputs by data type from node inputs
 * Handles both single connections and arrays of connections
 * NOTE: Chip inputs are excluded - they are only used for placeholder replacement
 */
function collectInputsByType(inputs: NodeInputs): CollectedInputs {
  const collected: CollectedInputs = {
    text: [],
    image: [],
    video: [],
    audio: [],
  };

  Object.entries(inputs).forEach(([_handleId, data]) => {
    if (Array.isArray(data)) {
      // Multiple connections to same handle
      data.forEach((item) => {
        // Skip chip inputs - they're handled separately for placeholder replacement
        if (item?.isChip) return;

        const inputType = item?.type as keyof CollectedInputs | undefined;
        if (inputType && inputType in collected) {
          collected[inputType].push(item.value);
        }
      });
    } else if (data) {
      // Skip chip inputs - they're handled separately for placeholder replacement
      if (data.isChip) return;

      // Single connection
      const inputType = data.type as keyof CollectedInputs | undefined;
      if (inputType && inputType in collected) {
        collected[inputType].push(data.value);
      }
    }
  });

  return collected;
}

function getFirstInputValue(
  collectedInputs: CollectedInputs,
  type: keyof CollectedInputs
): unknown {
  return collectedInputs[type]?.[0] || '';
}

function validateConnectedInputs(
  schema: unknown,
  connectedInputs: CollectedInputs,
  node: WorkflowNode,
  modelId: string
): void {
  const mapping = getInputMapping(schema) as InputMapping;
  const unsupported: string[] = [];

  // style_reference and img2img fields are supported (inpainting not yet implemented)
  const usableImageFields = mapping.image.filter(
    (f) => f.role === 'style_reference' || f.role === 'img2img'
  );
  const supportsImage = usableImageFields.length > 0;

  if (connectedInputs.image?.length && !supportsImage) {
    // Check if model only has inpainting fields
    const hasPrimaryOnly = mapping.image.some((f) => f.role === 'primary');
    if (hasPrimaryOnly) {
      console.warn(
        `[Executor] Image connected to model "${modelId}" but model only supports inpainting (not yet implemented). Image will be ignored.`
      );
    } else {
      unsupported.push('image');
    }
  }
  if (connectedInputs.video?.length && mapping.video.length === 0) {
    unsupported.push('video');
  }
  if (connectedInputs.audio?.length && mapping.audio.length === 0) {
    unsupported.push('audio');
  }

  if (unsupported.length) {
    const nodeLabel = node?.data?.title || node?.type || 'Node';
    throw new Error(
      `${nodeLabel}: model "${modelId}" does not accept ${unsupported.join(', ')} inputs.`
    );
  }

  const checkSingleInput = (type: keyof CollectedInputs, entries: InputMappingEntry[]) => {
    const count = connectedInputs[type]?.length || 0;
    if (!count || !entries.length) return;
    const supportsArray = entries.some((entry) => entry.isArray);
    if (!supportsArray && count > 1) {
      const nodeLabel = node?.data?.title || node?.type || 'Node';
      throw new Error(
        `${nodeLabel}: model "${modelId}" accepts a single ${type} input, but ${count} are connected.`
      );
    }
  };

  // Only check usable image fields (style_reference and img2img)
  checkSingleInput('image', usableImageFields);
  checkSingleInput('video', mapping.video);
  checkSingleInput('audio', mapping.audio);
}

/**
 * Execute Replicate Image node with schema-based input mapping
 */
async function executeImageNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<NodeOutputs> {
  const model = node.data.model || 'black-forest-labs/flux-2-klein-4b';
  const connectedInputs = collectInputsByType(inputs);
  const chipValues = collectChipValues(inputs, node.data);

  console.log(`[Executor] Running Replicate Image node ${node.id}`, { model });

  try {
    // Fetch model schema
    const schema = await fetchModelSchema(model);

    console.log(`[Executor] Connected inputs:`, connectedInputs);

    validateConnectedInputs(schema, connectedInputs, node, model);

    // Apply chip replacements to text inputs
    if (connectedInputs.text.length > 0) {
      connectedInputs.text = connectedInputs.text.map((text) =>
        replaceChipPlaceholders(text, chipValues)
      );
    }

    // Also apply chip replacements to node data prompt
    const nodeDataWithChips = { ...node.data };
    if (nodeDataWithChips.prompt) {
      nodeDataWithChips.prompt = replaceChipPlaceholders(nodeDataWithChips.prompt, chipValues);
    }
    if (nodeDataWithChips.negativePrompt) {
      nodeDataWithChips.negativePrompt = replaceChipPlaceholders(
        nodeDataWithChips.negativePrompt,
        chipValues
      );
    }

    // Build input using schema
    const input = buildReplicateInput(schema, connectedInputs, nodeDataWithChips) as Record<
      string,
      unknown
    >;

    console.log(`[Executor] Built input from schema:`, input);
    console.log(`[Executor] Image input URL (if any):`, input.image || 'no image');

    return await runReplicatePrediction(model, input, HANDLE_TYPES.IMAGE.type);
  } catch (schemaError) {
    // Fallback to manual input building if schema fetch fails
    console.warn(`[Executor] Schema fetch failed, using fallback:`, schemaError);

    if (connectedInputs.video.length > 0 || connectedInputs.audio.length > 0) {
      throw new Error('Image Generation: video/audio inputs are not supported for this node.');
    }

    let prompt = getFirstInputValue(connectedInputs, 'text') || node.data.prompt || '';
    // Apply chip replacements in fallback mode
    prompt = replaceChipPlaceholders(prompt, chipValues);

    if (!prompt.trim()) {
      throw new Error('No prompt provided');
    }

    const input: Record<string, unknown> = { prompt };

    if (connectedInputs.image.length > 0) {
      if (connectedInputs.image.length === 1) {
        input.image = connectedInputs.image[0];
      } else {
        input.image_input = connectedInputs.image;
      }
    }

    let negativePrompt = node.data.negativePrompt || '';
    negativePrompt = replaceChipPlaceholders(negativePrompt, chipValues);
    if (negativePrompt.trim()) {
      input.negative_prompt = negativePrompt;
    }
    if (node.data.width) {
      input.width = node.data.width;
    }
    if (node.data.height) {
      input.height = node.data.height;
    }
    if (node.data.numOutputs) {
      input.num_outputs = node.data.numOutputs;
    }

    return await runReplicatePrediction(model, input, HANDLE_TYPES.IMAGE.type);
  }
}
/**
 * Execute Replicate Upscaler node
 */
async function executeUpscalerNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<NodeOutputs> {
  const model = node.data.model || 'nightmareai/real-esrgan';
  const connectedInputs = collectInputsByType(inputs);
  const fallbackImage = node.data.imageUrl ? node.data.imageUrl.trim() : '';

  if (connectedInputs.image.length === 0 && fallbackImage) {
    connectedInputs.image = [fallbackImage];
  }

  if (connectedInputs.image.length === 0) {
    throw new Error('Upscaler: connect an image or provide an image URL.');
  }

  console.log(`[Executor] Running Replicate Upscaler node ${node.id}`, { model });

  try {
    const schema = await fetchModelSchema(model);

    console.log(`[Executor] Connected inputs:`, connectedInputs);

    validateConnectedInputs(schema, connectedInputs, node, model);

    const input = buildReplicateInput(
      schema,
      connectedInputs,
      node.data as Record<string, unknown>
    ) as Record<string, unknown>;

    console.log(`[Executor] Built input from schema:`, input);

    return await runReplicatePrediction(model, input, HANDLE_TYPES.IMAGE.type);
  } catch (schemaError) {
    console.warn(`[Executor] Upscaler schema fetch failed, using fallback:`, schemaError);

    if (connectedInputs.video.length > 0 || connectedInputs.audio.length > 0) {
      throw new Error('Upscaler: video/audio inputs are not supported for this node.');
    }

    const input: Record<string, unknown> = { image: connectedInputs.image[0] };
    const prompt = getFirstInputValue(connectedInputs, 'text') || node.data.prompt || '';
    if (prompt.trim()) {
      input.prompt = prompt;
    }
    if (node.data.scale) {
      input.scale = node.data.scale;
    }

    return await runReplicatePrediction(model, input, HANDLE_TYPES.IMAGE.type);
  }
}

/**
 * Execute Replicate Video node with schema-based input mapping
 * Supports video upscaling and generation models
 */
async function executeVideoNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<NodeOutputs> {
  const model = node.data.model || 'minimax/video-01';
  const connectedInputs = collectInputsByType(inputs);
  const chipValues = collectChipValues(inputs, node.data);

  console.log(`[Executor] Running Replicate Video node ${node.id}`, { model, connectedInputs });

  // Add fallback video URL from node data if available
  const fallbackVideo = node.data.videoUrl ? node.data.videoUrl.trim() : '';
  if (connectedInputs.video.length === 0 && fallbackVideo) {
    connectedInputs.video = [fallbackVideo];
  }

  // Add fallback image URL from node data if available
  const fallbackImage = node.data.imageUrl ? node.data.imageUrl.trim() : '';
  if (connectedInputs.image.length === 0 && fallbackImage) {
    connectedInputs.image = [fallbackImage];
  }

  // Apply chip replacements to text inputs
  if (connectedInputs.text.length > 0) {
    connectedInputs.text = connectedInputs.text.map((text) =>
      replaceChipPlaceholders(text, chipValues)
    );
  }

  // Check if we have a prompt or media input (some models require either/or)
  const hasPrompt =
    connectedInputs.text.length > 0 || (node.data.prompt && node.data.prompt.trim());
  const hasMediaInput = connectedInputs.image.length > 0 || connectedInputs.video.length > 0;

  if (!hasPrompt && !hasMediaInput) {
    throw new Error('Video: provide a prompt or connect a video/image input');
  }

  try {
    // Fetch model schema for validation and input building
    const schema = await fetchModelSchema(model);

    console.log(`[Executor] Connected inputs:`, connectedInputs);

    // Validate connected inputs against schema
    validateConnectedInputs(schema, connectedInputs, node, model);

    // Apply chip replacements to node data prompt
    const nodeDataWithChips = { ...node.data };
    if (nodeDataWithChips.prompt) {
      nodeDataWithChips.prompt = replaceChipPlaceholders(nodeDataWithChips.prompt, chipValues);
    }

    // Build input using schema
    const input = buildReplicateInput(schema, connectedInputs, nodeDataWithChips) as Record<
      string,
      unknown
    >;

    console.log(`[Executor] Built input from schema:`, input);

    return await runReplicatePrediction(model, input, HANDLE_TYPES.VIDEO.type, {
      maxAttempts: 300,
      onProgress: ({ attempts, status }) => {
        console.log(`[Executor] Polling attempt ${attempts}:`, status);
      },
    });
  } catch (schemaError) {
    // Fallback to manual input building if schema fetch fails
    console.warn(`[Executor] Video schema fetch failed, using fallback:`, schemaError);

    if (connectedInputs.audio.length > 0) {
      throw new Error('Video: audio inputs are not supported for this node.');
    }

    let prompt = getFirstInputValue(connectedInputs, 'text') || node.data.prompt || '';
    // Apply chip replacements in fallback mode
    prompt = replaceChipPlaceholders(prompt, chipValues);

    // Build fallback input
    const input: Record<string, unknown> = {};

    if ((prompt as string).trim()) {
      input.prompt = prompt;
    }

    if (connectedInputs.video.length > 0) {
      input.video = connectedInputs.video[0];
    }

    if (connectedInputs.image.length > 0) {
      input.image = connectedInputs.image[0];
    }

    if (node.data.duration) {
      input.duration = node.data.duration;
    }
    if (node.data.fps) {
      input.fps = node.data.fps;
    }

    // Validate we have at least one input
    if (Object.keys(input).length === 0) {
      throw new Error('No valid input for video generation');
    }

    console.log(`[Executor] Using fallback input:`, input);

    return await runReplicatePrediction(model, input, HANDLE_TYPES.VIDEO.type, {
      maxAttempts: 300,
      onProgress: ({ attempts, status }) => {
        console.log(`[Executor] Polling attempt ${attempts}:`, status);
      },
    });
  }
}
/**
 * Execute Replicate Audio node
 */
async function executeAudioNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<NodeOutputs> {
  const collectedInputs = collectInputsByType(inputs);
  const chipValues = collectChipValues(inputs, node.data);

  if (
    collectedInputs.image.length > 0 ||
    collectedInputs.video.length > 0 ||
    collectedInputs.audio.length > 0
  ) {
    throw new Error('Audio Generation: only text prompt inputs are supported.');
  }

  let prompt = getFirstInputValue(collectedInputs, 'text') || node.data.prompt || '';
  // Apply chip replacements
  prompt = replaceChipPlaceholders(prompt, chipValues);

  if (!prompt.trim()) {
    throw new Error('No prompt provided');
  }

  const model = node.data.model || 'meta/musicgen';

  console.log(`[Executor] Running Replicate Audio node ${node.id}`, { model, prompt });

  const input: Record<string, unknown> = { prompt };

  if (node.data.duration) {
    input.duration = node.data.duration;
  }
  if (node.data.temperature !== undefined) {
    input.temperature = node.data.temperature;
  }

  return await runReplicatePrediction(model, input, HANDLE_TYPES.AUDIO.type, { maxAttempts: 180 });
}

/**
 * Execute Save Media node
 */
async function executeSaveMediaNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<NodeOutputs> {
  // Debug logging
  console.log('[Executor] SaveMediaNode inputs:', inputs);
  console.log('[Executor] SaveMediaNode node.data:', node.data);

  // Get URL from any connected input handle or node data
  // Check all possible input handles: file-in, image-in, video-in, text-in, etc.
  let url = node.data.url || '';

  // Try to find URL from any input
  for (const [handleId, inputData] of Object.entries(inputs)) {
    const inputValue = (inputData as NodeInputItem)?.value;
    if (inputValue) {
      url = inputValue;
      console.log(`[Executor] SaveMediaNode found input from handle: ${handleId}`);
      break;
    }
  }

  console.log('[Executor] SaveMediaNode extracted URL:', url);

  if (!url || !url.trim()) {
    throw new Error('No file URL to save. Connect a media output or enter a URL.');
  }

  const filename = node.data.filename ? node.data.filename.trim() : null;
  const destinationFolder = node.data.destinationFolder ? node.data.destinationFolder.trim() : null;

  console.log(`[Executor] Saving media file from URL:`, { url, filename, destinationFolder });

  try {
    const savedPath = await invoke<string>('download_and_save_file', {
      url: url.trim(),
      filename,
      destinationFolder,
    });

    console.log(`[Executor] File saved successfully:`, savedPath);

    return {
      'success-out': {
        type: HANDLE_TYPES.TEXT.type,
        value: savedPath,
        success: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(`[Executor] Error saving file:`, error);
    throw new Error(`Failed to save file: ${(error as Error)?.message || error}`);
  }
}
/**
 * Execute a single node based on its type
 */
async function executeNode(
  node: WorkflowNode,
  inputs: NodeInputs,
  context: ExecutionContext
): Promise<NodeOutputs> {
  const { type, data } = node;

  switch (type) {
    case 'text':
      return await executeTextNode(node, inputs, context);

    case 'image':
      return await executeImageNode(node, inputs, context);

    case 'upscaler':
      return await executeUpscalerNode(node, inputs, context);

    case 'video':
      return await executeVideoNode(node, inputs, context);

    case 'audio':
      return await executeAudioNode(node, inputs, context);

    case 'save-media':
      return await executeSaveMediaNode(node, inputs, context);

    case 'media': {
      // Media node outputs the Replicate URL if uploaded, otherwise local path
      const mediaType = data.mediaType || 'image';
      const mediaPath = data.mediaPath || '';
      const replicateUrl = data.replicateUrl || null;

      // Prefer Replicate URL for remote consumption, fallback to local path
      const outputValue = replicateUrl || mediaPath;

      console.log(`[Executor] Media node ${node.id} output:`, {
        mediaType,
        localPath: mediaPath,
        replicateUrl,
        outputValue,
      });

      const handleTypeKey = mediaType.toUpperCase() as keyof typeof HANDLE_TYPES;
      const handleType = HANDLE_TYPES[handleTypeKey]?.type || HANDLE_TYPES.IMAGE.type;

      return {
        out: {
          type: handleType,
          value: outputValue,
          metadata: {
            isReplicateUrl: !!replicateUrl,
            localPath: mediaPath,
          },
        },
      };
    }

    case 'display-text':
    case 'markdown':
      // These nodes just receive input, no execution needed
      return { received: true };

    case 'chip': {
      // Chip nodes output their content with chip metadata for placeholder replacement
      const chipContent = data.content || '';
      const chipId = data.chipId || node.id;

      console.log(`[Executor] Chip node ${node.id} output:`, { chipId, content: chipContent });

      return {
        out: {
          type: HANDLE_TYPES.TEXT.type,
          value: chipContent,
          chipId: chipId,
          isChip: true,
        },
      };
    }

    default:
      console.warn(`[Executor] Unknown node type: ${type}`);
      return { passthrough: true };
  }
}

/**
 * Dispatch output to connected nodes via events
 */
function dispatchNodeOutput(nodeId: string, outputs: NodeOutputs, edges: WorkflowEdge[]): void {
  Object.entries(outputs).forEach(([handleId, output]) => {
    const outgoingEdges = edges.filter((e) => e.source === nodeId && e.sourceHandle === handleId);

    outgoingEdges.forEach((edge) => {
      emit('nodeContentChanged', {
        sourceId: nodeId,
        targetId: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        content: output,
      });
    });
  });
}

/**
 * Clean up uploaded Replicate files after workflow execution
 */
async function cleanupWorkflowFiles(nodes: WorkflowNode[]): Promise<void> {
  console.log('[Executor] Cleaning up Replicate files...');

  const mediaNodes = nodes.filter((node) => node.type === 'media');
  const cleanupPromises = mediaNodes
    .filter((node) => node.data.replicateFileId)
    .map(async (node) => {
      try {
        console.log(
          `[Executor] Cleaning up file for node ${node.id}: ${node.data.replicateFileId}`
        );
        await deleteFileFromReplicate(node.data.replicateFileId);
        // Clear the file info from node data
        node.data.replicateFileId = null;
        node.data.replicateUrl = null;
      } catch (error) {
        console.warn(`[Executor] Failed to cleanup file for node ${node.id}:`, error);
      }
    });

  await Promise.allSettled(cleanupPromises);
  console.log('[Executor] Cleanup complete');
}
/**
 * Execute workflow using DAG-based orchestration
 */
export async function executeWorkflow({
  nodes,
  edges,
  context = {},
  onNodeStart = () => {},
  onNodeComplete = () => {},
  onNodeError = () => {},
  onNodeSkip = () => {},
  onProgress = () => {},
  autoCleanup = true,
  initialNodeOutputs = {},
  skipNodeIds = [],
  continueOnError = false,
}: ExecuteWorkflowOptions): Promise<ExecuteWorkflowResult> {
  const startTime = Date.now();
  const workflowId = `workflow-${startTime}`;
  const nodeOutputs: Record<string, NodeOutputs> = { ...(initialNodeOutputs || {}) };
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const skipNodeIdSet = new Set(skipNodeIds || []);
  let completedCount = Object.keys(nodeOutputs).filter((nodeId) => nodeIdSet.has(nodeId)).length;
  const errors: unknown[] = [];
  const skippedNodes: string[] = [];

  if (completedCount > 0) {
    onProgress({
      completed: completedCount,
      total: nodes.length,
      percentage: Math.round((completedCount / nodes.length) * 100),
    });
  }

  try {
    // Build dependency graph
    const { graph, inDegree } = buildDependencyGraph(nodes, edges);

    // Get execution layers
    const layers = topologicalSort(nodes, graph, inDegree) as WorkflowNode[][];

    console.log(`[Executor] Executing ${nodes.length} nodes in ${layers.length} layers`);

    // Execute each layer sequentially
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex] as WorkflowNode[];
      console.log(`[Executor] Layer ${layerIndex + 1}/${layers.length}: ${layer.length} nodes`);

      // Execute all nodes in this layer in parallel
      const layerPromises = layer.map(async (node) => {
        if (skipNodeIdSet.has(node.id)) {
          skippedNodes.push(node.id);
          onNodeSkip(node, 'skipped');
          return { nodeId: node.id, skipped: true };
        }

        if (nodeOutputs[node.id]) {
          onNodeSkip(node, 'cached');
          return { nodeId: node.id, skipped: true, cached: true };
        }

        try {
          onNodeStart(node);

          // Get inputs for this node
          const inputs = getNodeInputs(node, edges, nodes, nodeOutputs) as NodeInputs;
          console.log(`[Executor] Node ${node.id} (${node.type}) inputs:`, inputs);

          // Execute the node
          const output = await executeNode(node, inputs, context);
          console.log(`[Executor] Node ${node.id} (${node.type}) output:`, output);

          // Store output
          nodeOutputs[node.id] = output;
          console.log(`[Executor] Stored outputs:`, nodeOutputs);

          // Dispatch output to connected nodes
          dispatchNodeOutput(node.id, output, edges);

          completedCount++;
          onProgress({
            completed: completedCount,
            total: nodes.length,
            percentage: Math.round((completedCount / nodes.length) * 100),
          });

          onNodeComplete(node, output);

          return { nodeId: node.id, success: true };
        } catch (error) {
          onNodeError(node, error);
          return { nodeId: node.id, success: false, error };
        }
      });

      // Wait for all nodes in this layer
      const layerResults = await Promise.all(layerPromises);
      const layerErrors = layerResults
        .filter((result) => result && result.success === false && result.error)
        .map((result) => result.error);

      if (layerErrors.length > 0) {
        errors.push(...layerErrors);
        if (!continueOnError) {
          throw layerErrors[0];
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Executor] Workflow completed in ${duration}ms`);

    // Cleanup Replicate files after successful execution
    if (autoCleanup) {
      await cleanupWorkflowFiles(nodes);
    }

    return {
      success: errors.length === 0,
      workflowId,
      duration,
      nodeOutputs,
      completedCount,
      skippedNodes,
      error: (errors[0] as Error | undefined)?.message,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Executor] Workflow failed:`, error);

    // Cleanup Replicate files even on error
    if (autoCleanup) {
      try {
        await cleanupWorkflowFiles(nodes);
      } catch (cleanupError) {
        console.warn('[Executor] Cleanup after error failed:', cleanupError);
      }
    }

    return {
      success: false,
      workflowId,
      duration,
      error: (error as Error)?.message,
      nodeOutputs,
      completedCount,
      skippedNodes,
      errors,
    };
  }
}
