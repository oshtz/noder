/**
 * Hook for managing assistant model selection.
 * Handles model picker state, recent models, and filtering.
 * Dynamically loads models from OpenRouter API.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getTextModels,
  unsubscribe as unsubscribeOpenRouter,
  toModelCatalogEntry,
} from '../utils/openrouterModelCache';
import type { OpenRouterModel } from '../api/openrouter';

// =============================================================================
// Types
// =============================================================================

export interface ModelCatalogEntry {
  id: string;
  label: string;
  provider: string;
  tags: string[];
  featured: boolean;
}

interface UseAssistantModelOptions {
  defaultModel?: string;
  maxRecentModels?: number;
  /** Whether to load models dynamically from OpenRouter */
  loadDynamicModels?: boolean;
}

interface UseAssistantModelReturn {
  /** Current model ID */
  model: string;
  /** Set model ID */
  setModel: (model: string) => void;
  /** Whether the model picker is open */
  modelPickerOpen: boolean;
  /** Set model picker open state */
  setModelPickerOpen: (open: boolean) => void;
  /** Current provider filter */
  modelProvider: string;
  /** Set provider filter */
  setModelProvider: (provider: string) => void;
  /** List of recent model IDs */
  recentModels: string[];
  /** Remember a model as recently used */
  rememberModel: (modelId: string) => void;
  /** Handle model selection */
  handleSelectModel: (modelId: string) => void;
  /** Handle model input change */
  handleModelInputChange: (value: string) => void;
  /** Provider options for filter */
  providerOptions: string[];
  /** Featured models */
  featuredModels: ModelCatalogEntry[];
  /** Filtered models based on provider and search */
  filteredModels: ModelCatalogEntry[];
  /** Recent model entries */
  recentEntries: ModelCatalogEntry[];
  /** Current model query */
  modelQuery: string;
  /** Whether to show custom model option */
  showCustomOption: boolean;
  /** Check if entry matches provider filter */
  providerMatches: (entry: ModelCatalogEntry) => boolean;
  /** Active model ID */
  activeModelId: string;
  /** Ref for model picker container */
  modelPickerRef: React.RefObject<HTMLDivElement>;
  /** Whether models are loading */
  isLoadingModels: boolean;
  /** Full model catalog (static + dynamic) */
  modelCatalog: ModelCatalogEntry[];
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RECENT_MODELS = 6;

/** Static model catalog - local providers and fallback models */
const STATIC_MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'openrouter/auto',
    label: 'Auto Router',
    provider: 'OpenRouter',
    tags: ['auto'],
    featured: true,
  },
  {
    id: 'openai/gpt-5.2',
    label: 'GPT-5.2',
    provider: 'OpenAI',
    tags: ['reasoning', 'tools'],
    featured: true,
  },
  {
    id: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    provider: 'OpenAI',
    tags: ['general', 'tools'],
    featured: true,
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    tags: ['multimodal', 'tools'],
    featured: true,
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    tags: ['reasoning', 'tools'],
    featured: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    tags: ['general', 'tools'],
    featured: true,
  },
  {
    id: 'anthropic/claude-3-haiku',
    label: 'Claude 3 Haiku',
    provider: 'Anthropic',
    tags: ['fast'],
    featured: false,
  },
  {
    id: 'google/gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'Google',
    tags: ['multimodal', 'fast'],
    featured: true,
  },
  {
    id: 'google/gemini-2.0-pro',
    label: 'Gemini 2.0 Pro',
    provider: 'Google',
    tags: ['multimodal', 'reasoning'],
    featured: true,
  },
  {
    id: 'google/gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'Google',
    tags: ['multimodal'],
    featured: false,
  },
  {
    id: 'google/gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'Google',
    tags: ['fast'],
    featured: false,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B Instruct',
    provider: 'Meta',
    tags: ['open', 'reasoning'],
    featured: true,
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B Instruct',
    provider: 'Meta',
    tags: ['open', 'fast'],
    featured: false,
  },
  {
    id: 'mistralai/mistral-large',
    label: 'Mistral Large',
    provider: 'Mistral',
    tags: ['general'],
    featured: true,
  },
  {
    id: 'mistralai/mistral-small',
    label: 'Mistral Small',
    provider: 'Mistral',
    tags: ['fast'],
    featured: false,
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1',
    provider: 'DeepSeek',
    tags: ['reasoning'],
    featured: true,
  },
  {
    id: 'deepseek/deepseek-v3',
    label: 'DeepSeek V3',
    provider: 'DeepSeek',
    tags: ['general'],
    featured: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B Instruct',
    provider: 'Qwen',
    tags: ['open', 'reasoning'],
    featured: true,
  },
  {
    id: 'qwen/qwen-2.5-32b-instruct',
    label: 'Qwen 2.5 32B Instruct',
    provider: 'Qwen',
    tags: ['open'],
    featured: false,
  },
  // Ollama (Local) models
  {
    id: 'ollama/llama3.2',
    label: 'Llama 3.2',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: true,
  },
  {
    id: 'ollama/llama3.1',
    label: 'Llama 3.1',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/mistral',
    label: 'Mistral',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/codellama',
    label: 'Code Llama',
    provider: 'Ollama',
    tags: ['local', 'code'],
    featured: false,
  },
  {
    id: 'ollama/gemma2',
    label: 'Gemma 2',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/qwen2.5',
    label: 'Qwen 2.5',
    provider: 'Ollama',
    tags: ['local', 'open'],
    featured: false,
  },
  {
    id: 'ollama/deepseek-r1',
    label: 'DeepSeek R1',
    provider: 'Ollama',
    tags: ['local', 'reasoning'],
    featured: true,
  },
  // LM Studio (Local) models
  {
    id: 'lmstudio/local-model',
    label: 'Local Model',
    provider: 'LM Studio',
    tags: ['local'],
    featured: true,
  },
];

const buildModelSearchText = (entry: ModelCatalogEntry): string =>
  [entry.id, entry.label, entry.provider, ...(entry.tags || [])].join(' ').toLowerCase();

// =============================================================================
// Hook Implementation
// =============================================================================

/** Re-export static catalog for backward compatibility */
export const MODEL_CATALOG = STATIC_MODEL_CATALOG;

export function useAssistantModel({
  defaultModel = 'openai/gpt-5.2',
  maxRecentModels = MAX_RECENT_MODELS,
  loadDynamicModels = true,
}: UseAssistantModelOptions = {}): UseAssistantModelReturn {
  const [model, setModel] = useState(defaultModel);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState('All');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<ModelCatalogEntry[]>([]);
  const [recentModels, setRecentModels] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('assistant-recent-models');
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  });

  const modelPickerRef = useRef<HTMLDivElement>(null);
  const hasLoadedDynamicModels = useRef(false);

  // Load dynamic models from OpenRouter
  useEffect(() => {
    if (!loadDynamicModels || hasLoadedDynamicModels.current) return;

    const loadModels = async (): Promise<void> => {
      setIsLoadingModels(true);
      try {
        const handleUpdate = (models: OpenRouterModel[]): void => {
          const entries = models.map((m) => toModelCatalogEntry(m) as ModelCatalogEntry);
          setDynamicModels(entries);
        };

        const { models } = await getTextModels(handleUpdate);
        const entries = models.map((m) => toModelCatalogEntry(m) as ModelCatalogEntry);
        setDynamicModels(entries);
        hasLoadedDynamicModels.current = true;
      } catch (err) {
        console.error('[useAssistantModel] Failed to load dynamic models:', err);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();

    return () => {
      unsubscribeOpenRouter('text', () => {});
    };
  }, [loadDynamicModels]);

  // Merge static and dynamic catalogs
  const modelCatalog = useMemo(() => {
    // Start with static catalog (local providers like Ollama, LM Studio)
    const staticLocal = STATIC_MODEL_CATALOG.filter(
      (m) => m.provider === 'Ollama' || m.provider === 'LM Studio'
    );

    // Dynamic models from OpenRouter (if available)
    if (dynamicModels.length > 0) {
      // Deduplicate by ID, preferring dynamic models
      const dynamicIds = new Set(dynamicModels.map((m) => m.id));
      const staticNonLocal = STATIC_MODEL_CATALOG.filter(
        (m) => m.provider !== 'Ollama' && m.provider !== 'LM Studio' && !dynamicIds.has(m.id)
      );
      return [...dynamicModels, ...staticLocal, ...staticNonLocal];
    }

    // Fallback to static catalog
    return STATIC_MODEL_CATALOG;
  }, [dynamicModels]);

  // Persist recent models
  useEffect(() => {
    try {
      localStorage.setItem(
        'assistant-recent-models',
        JSON.stringify(recentModels.slice(0, maxRecentModels))
      );
    } catch {
      // Ignore storage failures
    }
  }, [recentModels, maxRecentModels]);

  // Close picker on outside click
  useEffect(() => {
    if (!modelPickerOpen) return;

    const handleClick = (event: MouseEvent): void => {
      if (!modelPickerRef.current) return;
      if (!modelPickerRef.current.contains(event.target as Node)) {
        setModelPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [modelPickerOpen]);

  // Computed values
  const providerOptions = useMemo(() => {
    const providers = modelCatalog.map((entry) => entry.provider);
    return ['All', ...Array.from(new Set(providers))];
  }, [modelCatalog]);

  const featuredModels = useMemo(() => {
    // For dynamic models, mark popular ones as featured
    return modelCatalog.filter((entry) => entry.featured);
  }, [modelCatalog]);

  const filteredModels = useMemo(() => {
    const query = model.trim().toLowerCase();
    const providerFiltered =
      modelProvider === 'All'
        ? modelCatalog
        : modelCatalog.filter((entry) => entry.provider === modelProvider);
    if (!query) return providerFiltered;
    return providerFiltered.filter((entry) => buildModelSearchText(entry).includes(query));
  }, [model, modelProvider, modelCatalog]);

  const recentEntries = useMemo(() => {
    return recentModels.map((entry) => {
      const match = modelCatalog.find((modelEntry) => modelEntry.id === entry);
      return (
        match || {
          id: entry,
          label: entry,
          provider: 'Custom',
          tags: ['custom'],
          featured: false,
        }
      );
    });
  }, [recentModels, modelCatalog]);

  const modelQuery = model.trim();
  const hasVisibleMatch = filteredModels.some((entry) => entry.id === modelQuery);
  const showCustomOption = modelQuery.length > 0 && !hasVisibleMatch;
  const activeModelId = model.trim();

  const providerMatches = useCallback(
    (entry: ModelCatalogEntry): boolean =>
      modelProvider === 'All' || entry.provider === modelProvider,
    [modelProvider]
  );

  const rememberModel = useCallback(
    (modelId: string): void => {
      const trimmed = modelId.trim();
      if (!trimmed) return;
      setRecentModels((prev) => {
        const next = [trimmed, ...prev.filter((entry) => entry !== trimmed)];
        return next.slice(0, maxRecentModels);
      });
    },
    [maxRecentModels]
  );

  const handleSelectModel = useCallback(
    (modelId: string): void => {
      setModel(modelId);
      setModelPickerOpen(false);
      rememberModel(modelId);
    },
    [rememberModel]
  );

  const handleModelInputChange = useCallback((value: string): void => {
    setModel(value);
    setModelPickerOpen(true);
  }, []);

  return {
    model,
    setModel,
    modelPickerOpen,
    setModelPickerOpen,
    modelProvider,
    setModelProvider,
    recentModels,
    rememberModel,
    handleSelectModel,
    handleModelInputChange,
    providerOptions,
    featuredModels,
    filteredModels,
    recentEntries,
    modelQuery,
    showCustomOption,
    providerMatches,
    activeModelId,
    modelPickerRef,
    isLoadingModels,
    modelCatalog,
  };
}

export default useAssistantModel;
