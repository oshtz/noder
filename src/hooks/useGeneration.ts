/**
 * Unified hook for handling generation (image, text, video).
 * Routes to OpenRouter or Replicate based on model provider.
 * Consolidates shared logic for prediction creation, polling, and output processing.
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEdges, useNodes, Edge, Node } from 'reactflow';
import { emit } from '../utils/eventBus';
import { HANDLE_TYPES, HandleType } from '../constants/handleTypes';
import { fetchModelSchema, buildReplicateInput } from '../utils/replicateSchemaCache';
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

/**
 * Determine which API provider to use for a model
 */
function getModelProvider(modelId: string): 'openrouter' | 'replicate' {
  const [owner] = modelId.split('/');
  const ownerLower = owner.toLowerCase();

  if (OPENROUTER_PROVIDERS.has(ownerLower)) {
    return 'openrouter';
  }

  return 'replicate';
}

// =============================================================================
// Types
// =============================================================================

export type GenerationType = 'image' | 'text' | 'video';

export interface GenerationConfig {
  /** Type of generation (image, text, video) */
  type: GenerationType;
  /** Output handle ID (e.g., 'out', 'video-out') */
  outputHandleId: string;
  /** Max polling attempts */
  maxPollingAttempts?: number;
  /** Polling interval in ms */
  pollingInterval?: number;
}

export interface BaseFormState {
  model: string;
  prompt?: string;
  [key: string]: unknown;
}

export interface BaseNodeData {
  content?: string;
  output?: string;
  metadata?: string;
  [key: string]: unknown;
}

interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string;
}

interface ContentPayload {
  type: HandleType;
  value?: string;
  model?: string;
  fromWorkflow?: boolean;
}

export interface UseGenerationOptions<
  TFormState extends BaseFormState,
  TNodeData extends BaseNodeData,
> {
  nodeId: string;
  data: TNodeData;
  formState: TFormState;
  config: GenerationConfig;
  /** Additional connected inputs (for text nodes that accept images/audio) */
  connectedInputs?: {
    image?: string | null;
    audio?: string | null;
  };
  /** Function to build input from form state (optional, uses schema-based by default) */
  buildInput?: (formState: TFormState, connectedInputs: ConnectedInputs) => Record<string, unknown>;
  /** Function to extract result from prediction output */
  extractResult?: (output: unknown) => string;
}

export interface UseGenerationResult {
  status: 'idle' | 'processing';
  error: string | null;
  output: string | null;
  setOutput: React.Dispatch<React.SetStateAction<string | null>>;
  handleGenerate: () => Promise<void>;
  dispatchOutput: (value: string) => void;
  /** Polling progress info */
  pollingProgress: {
    attempts: number;
    maxAttempts: number;
    elapsedSeconds: number;
  };
}

interface ConnectedInputs {
  text: string[];
  image: string[];
  video: string[];
  audio: string[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<Pick<GenerationConfig, 'maxPollingAttempts' | 'pollingInterval'>> = {
  maxPollingAttempts: 300, // 5 minutes at 1s intervals
  pollingInterval: 1000,
};

const HANDLE_TYPE_MAP: Record<GenerationType, HandleType> = {
  image: HANDLE_TYPES.IMAGE.type,
  text: HANDLE_TYPES.TEXT.type,
  video: HANDLE_TYPES.VIDEO.type,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert an HTTP URL to a data URL by fetching and encoding.
 */
async function urlToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Failed to convert URL to data URL: ${url}`, error);
    throw error;
  }
}

/**
 * Collect images from connected nodes for img2img workflows.
 */
async function collectConnectedImages(
  edges: Edge[],
  nodes: Node[],
  nodeId: string
): Promise<string[]> {
  const connectedImageEdges = edges.filter(
    (e: Edge) => e.target === nodeId && e.targetHandle === 'in'
  );

  const collectedImages: string[] = [];

  for (const edge of connectedImageEdges) {
    const sourceNode = nodes.find((n: Node) => n.id === edge.source);
    if (!sourceNode) continue;

    const sourceData = sourceNode.data as BaseNodeData;

    if (sourceData.convertedSrc) {
      collectedImages.push(sourceData.convertedSrc as string);
    } else if (sourceData.output) {
      try {
        const dataUrl = await urlToDataUrl(sourceData.output);
        collectedImages.push(dataUrl);
      } catch (error) {
        console.warn(`Failed to convert image URL, skipping: ${sourceData.output}`, error);
      }
    } else if (sourceData.mediaPath) {
      const mediaPath = sourceData.mediaPath as string;
      if (mediaPath.startsWith('data:')) {
        collectedImages.push(mediaPath);
      }
    }
  }

  return collectedImages;
}

/**
 * Default result extractor for prediction output.
 */
function defaultExtractResult(output: unknown, type: GenerationType): string {
  if (Array.isArray(output) && output.length > 0) {
    if (type === 'text') {
      return output.join('');
    }
    return output[0];
  }
  if (typeof output === 'string') {
    return output;
  }
  if (type === 'text') {
    return JSON.stringify(output);
  }
  throw new Error('Unexpected output format');
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Unified hook for managing generation with Replicate API.
 *
 * Supports image, text, and video generation with shared logic for:
 * - Output dispatch to connected nodes
 * - Prediction creation and polling
 * - Error handling
 * - Progress tracking
 *
 * @example
 * ```tsx
 * const { status, error, output, handleGenerate } = useGeneration({
 *   nodeId,
 *   data,
 *   formState,
 *   config: { type: 'image', outputHandleId: 'out' },
 * });
 * ```
 */
export function useGeneration<
  TFormState extends BaseFormState = BaseFormState,
  TNodeData extends BaseNodeData = BaseNodeData,
>({
  nodeId,
  data,
  formState,
  config,
  connectedInputs: externalInputs,
  buildInput: customBuildInput,
  extractResult: customExtractResult,
}: UseGenerationOptions<TFormState, TNodeData>): UseGenerationResult {
  const edges = useEdges();
  const nodes = useNodes();

  const [status, setStatus] = useState<'idle' | 'processing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(data.output || null);
  const [pollingProgress, setPollingProgress] = useState({
    attempts: 0,
    maxAttempts: config.maxPollingAttempts ?? DEFAULT_CONFIG.maxPollingAttempts,
    elapsedSeconds: 0,
  });

  const handleType = HANDLE_TYPE_MAP[config.type];
  const maxAttempts = config.maxPollingAttempts ?? DEFAULT_CONFIG.maxPollingAttempts;
  const pollingInterval = config.pollingInterval ?? DEFAULT_CONFIG.pollingInterval;

  // Dispatch output to connected nodes
  const dispatchOutput = useCallback(
    (value: string): void => {
      const outgoing = edges.filter(
        (edge: Edge) => edge.source === nodeId && edge.sourceHandle === config.outputHandleId
      );

      const payload: ContentPayload = {
        type: handleType,
        value,
        model: formState.model,
        fromWorkflow: true,
      };

      outgoing.forEach((edge: Edge) => {
        emit('nodeContentChanged', {
          sourceId: nodeId,
          targetId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          content: payload,
        });
      });
    },
    [edges, nodeId, formState.model, config.outputHandleId, handleType]
  );

  // Main generation function
  const handleGenerate = useCallback(async (): Promise<void> => {
    setStatus('processing');
    setError(null);
    setPollingProgress({ attempts: 0, maxAttempts, elapsedSeconds: 0 });

    const startTime = Date.now();

    try {
      const prompt = formState.prompt || data.content || '';

      // Validation
      if (!formState.model.trim()) {
        throw new Error('Please specify a model');
      }

      // Determine which provider to use
      const provider = getModelProvider(formState.model);

      // Collect connected inputs for image generation
      const collectedImages =
        config.type === 'image' ? await collectConnectedImages(edges, nodes, nodeId) : [];

      // Build connected inputs
      const connectedInputsData: ConnectedInputs = {
        text: prompt.trim() ? [prompt.trim()] : [],
        image: [...collectedImages, ...(externalInputs?.image ? [externalInputs.image] : [])],
        video: [],
        audio: externalInputs?.audio ? [externalInputs.audio] : [],
      };

      console.log(`[useGeneration] Using provider: ${provider} for model: ${formState.model}`);

      // Route to OpenRouter for text generation with supported providers
      if (provider === 'openrouter' && config.type === 'text') {
        const apiKey = await getApiKey('openrouter');

        if (!apiKey) {
          throw new Error('OpenRouter API key not configured. Please add it in Settings.');
        }

        // Build messages for OpenRouter
        const messages: { role: 'system' | 'user' | 'assistant'; content: string | unknown[] }[] =
          [];

        if (formState.systemPrompt) {
          messages.push({ role: 'system', content: formState.systemPrompt as string });
        }

        // Handle multimodal input (text + image)
        if (connectedInputsData.image.length > 0) {
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: connectedInputsData.image[0] } },
            ],
          });
        } else {
          messages.push({ role: 'user', content: prompt });
        }

        console.log('[useGeneration] Calling OpenRouter:', { model: formState.model, messages });

        const response = await chatCompletion({
          apiKey,
          model: formState.model,
          messages: messages as Parameters<typeof chatCompletion>[0]['messages'],
        });

        const result = response?.choices?.[0]?.message?.content || '';

        data.output = result;
        data.metadata = formState.model.split('/').pop() || formState.model;
        setOutput(result);
        dispatchOutput(result);

        return;
      }

      // Replicate path for image/video/audio or Replicate text models
      // Build input
      let input: Record<string, unknown>;

      if (customBuildInput) {
        input = customBuildInput(formState, connectedInputsData);
      } else {
        try {
          const schema = await fetchModelSchema(formState.model);
          input = buildReplicateInput(schema, connectedInputsData, formState);
        } catch (schemaError) {
          console.warn('Schema fetch failed, using fallback:', schemaError);
          input = buildFallbackInput(formState, connectedInputsData, config.type);
        }
      }

      console.log(`Creating Replicate ${config.type} prediction:`, {
        model: formState.model,
        input,
      });

      // Create prediction
      const prediction = (await invoke('replicate_create_prediction', {
        model: formState.model,
        input,
      })) as Prediction;

      console.log('Prediction created:', prediction);

      // Poll for completion
      let currentPrediction = prediction;
      let attempts = 0;

      while (
        currentPrediction.status !== 'succeeded' &&
        currentPrediction.status !== 'failed' &&
        currentPrediction.status !== 'canceled' &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
        currentPrediction = (await invoke('replicate_get_prediction', {
          predictionId: currentPrediction.id,
        })) as Prediction;
        attempts++;

        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        setPollingProgress({ attempts, maxAttempts, elapsedSeconds });

        if (attempts % 10 === 0) {
          console.log(`Polling attempt ${attempts}:`, currentPrediction.status);
        }
      }

      // Handle result
      if (currentPrediction.status === 'succeeded') {
        const result = customExtractResult
          ? customExtractResult(currentPrediction.output)
          : defaultExtractResult(currentPrediction.output, config.type);

        data.output = result;
        data.metadata = formState.model.split('/').pop() || formState.model;
        setOutput(result);
        dispatchOutput(result);
      } else if (currentPrediction.status === 'failed') {
        throw new Error(currentPrediction.error || 'Prediction failed');
      } else if (currentPrediction.status === 'canceled') {
        throw new Error('Prediction was canceled');
      } else {
        throw new Error('Prediction timed out');
      }
    } catch (e) {
      console.error(`Error generating ${config.type}:`, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage || 'Failed to run model');
    } finally {
      setStatus('idle');
    }
  }, [
    formState,
    data,
    edges,
    nodes,
    nodeId,
    config,
    externalInputs,
    customBuildInput,
    customExtractResult,
    dispatchOutput,
    maxAttempts,
    pollingInterval,
  ]);

  return {
    status,
    error,
    output,
    setOutput,
    handleGenerate,
    dispatchOutput,
    pollingProgress,
  };
}

// =============================================================================
// Fallback Input Builder
// =============================================================================

/**
 * Build fallback input when schema fetch fails.
 */
function buildFallbackInput(
  formState: BaseFormState,
  connectedInputs: ConnectedInputs,
  type: GenerationType
): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  // Add prompt if available
  if (connectedInputs.text.length > 0) {
    input.prompt = connectedInputs.text[0];
  }

  // Add images for image generation
  if (type === 'image' && connectedInputs.image.length > 0) {
    if (connectedInputs.image.length === 1) {
      input.image = connectedInputs.image[0];
    } else {
      input.image_input = connectedInputs.image;
    }
  }

  // Add audio for text (transcription models)
  if (type === 'text' && connectedInputs.audio.length > 0) {
    input.audio = connectedInputs.audio[0];
  }

  // Add common optional parameters
  if (formState.negativePrompt) {
    input.negative_prompt = formState.negativePrompt;
  }
  if (formState.width) {
    input.width = formState.width;
  }
  if (formState.height) {
    input.height = formState.height;
  }
  if (formState.numOutputs) {
    input.num_outputs = formState.numOutputs;
  }
  if (formState.systemPrompt) {
    input.system_prompt = formState.systemPrompt;
  }
  if (formState.temperature !== undefined) {
    input.temperature = formState.temperature;
  }
  if (formState.maxTokens) {
    input.max_tokens = formState.maxTokens;
  }
  if (formState.duration) {
    input.duration = formState.duration;
  }
  if (formState.fps) {
    input.fps = formState.fps;
  }

  return input;
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Pre-configured hook for image generation.
 */
export function useImageGeneration<
  TFormState extends BaseFormState,
  TNodeData extends BaseNodeData,
>(options: Omit<UseGenerationOptions<TFormState, TNodeData>, 'config'>): UseGenerationResult {
  return useGeneration({
    ...options,
    config: {
      type: 'image',
      outputHandleId: 'out',
      maxPollingAttempts: 120, // 2 minutes
    },
  });
}

/**
 * Pre-configured hook for text generation.
 */
export function useTextGeneration<TFormState extends BaseFormState, TNodeData extends BaseNodeData>(
  options: Omit<UseGenerationOptions<TFormState, TNodeData>, 'config'>
): UseGenerationResult {
  return useGeneration({
    ...options,
    config: {
      type: 'text',
      outputHandleId: 'out',
      maxPollingAttempts: 120, // 2 minutes
    },
  });
}

/**
 * Pre-configured hook for video generation.
 */
export function useVideoGeneration<
  TFormState extends BaseFormState,
  TNodeData extends BaseNodeData,
>(options: Omit<UseGenerationOptions<TFormState, TNodeData>, 'config'>): UseGenerationResult {
  return useGeneration({
    ...options,
    config: {
      type: 'video',
      outputHandleId: 'video-out',
      maxPollingAttempts: 300, // 5 minutes
    },
  });
}

export default useGeneration;
