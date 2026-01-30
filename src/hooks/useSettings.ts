import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

export type NodeType = 'text' | 'image' | 'video' | 'audio' | 'upscaler';
export type EdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep';

export interface RunButtonPosition {
  x: number;
  y: number;
}

export interface AppSettings {
  // API Keys
  openai_api_key?: string | null;
  openrouter_api_key?: string | null;
  anthropic_api_key?: string | null;
  replicate_api_key?: string | null;
  gemini_api_key?: string | null;

  // Service URLs
  ollama_base_url?: string;
  lm_studio_base_url?: string;

  // Paths
  default_save_location?: string;

  // UI Preferences
  show_templates?: boolean;
  show_assistant_panel?: boolean;
  run_button_unlocked?: boolean;
  run_button_position?: RunButtonPosition;

  // Default Models
  default_text_model?: string | null;
  default_image_model?: string | null;
  default_video_model?: string | null;
  default_audio_model?: string | null;
  default_upscaler_model?: string | null;

  // Edge Appearance
  edge_type?: EdgeType;
}

export interface UseSettingsReturn {
  // Loading state
  isLoaded: boolean;

  // API Keys
  openaiApiKey: string;
  setOpenAIApiKey: (value: string) => void;
  openRouterApiKey: string;
  setOpenRouterApiKey: (value: string) => void;
  anthropicApiKey: string;
  setAnthropicApiKey: (value: string) => void;
  replicateApiKey: string;
  setReplicateApiKey: (value: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (value: string) => void;

  // Service URLs
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (value: string) => void;
  lmStudioBaseUrl: string;
  setLmStudioBaseUrl: (value: string) => void;

  // Paths
  defaultSaveLocation: string;
  setDefaultSaveLocation: (value: string) => void;

  // UI Preferences
  showTemplates: boolean;
  setShowTemplates: (value: boolean) => void;
  showAssistantPanel: boolean;
  setShowAssistantPanel: (value: boolean) => void;
  showEditorToolbar: boolean;
  setShowEditorToolbar: (value: boolean) => void;
  runButtonUnlocked: boolean;
  setRunButtonUnlocked: (value: boolean) => void;
  runButtonPosition: RunButtonPosition;
  setRunButtonPosition: (value: RunButtonPosition) => void;

  // Default Models
  defaultTextModel: string;
  setDefaultTextModel: (value: string) => void;
  defaultImageModel: string;
  setDefaultImageModel: (value: string) => void;
  defaultVideoModel: string;
  setDefaultVideoModel: (value: string) => void;
  defaultAudioModel: string;
  setDefaultAudioModel: (value: string) => void;
  defaultUpscalerModel: string;
  setDefaultUpscalerModel: (value: string) => void;

  // Edge Appearance
  edgeType: EdgeType;
  setEdgeType: (value: EdgeType) => void;

  // Helpers
  getDefaultModel: (nodeType: NodeType) => string | null;
  resetToDefaults: () => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: {
  openaiApiKey: string;
  openRouterApiKey: string;
  anthropicApiKey: string;
  replicateApiKey: string;
  geminiApiKey: string;
  ollamaBaseUrl: string;
  lmStudioBaseUrl: string;
  defaultSaveLocation: string;
  showTemplates: boolean;
  showAssistantPanel: boolean;
  showEditorToolbar: boolean;
  runButtonUnlocked: boolean;
  runButtonPosition: RunButtonPosition;
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  defaultAudioModel: string;
  defaultUpscalerModel: string;
  edgeType: EdgeType;
} = {
  // API Keys
  openaiApiKey: '',
  openRouterApiKey: '',
  anthropicApiKey: '',
  replicateApiKey: '',
  geminiApiKey: '',

  // Service URLs
  ollamaBaseUrl: 'http://localhost:11434',
  lmStudioBaseUrl: 'http://localhost:1234',

  // Paths
  defaultSaveLocation: 'Downloads/noder',

  // UI Preferences
  showTemplates: true,
  showAssistantPanel: true,
  showEditorToolbar: true,
  runButtonUnlocked: false,
  runButtonPosition: { x: 20, y: 20 },

  // Default Models
  defaultTextModel: 'openai/gpt-4o-mini',
  defaultImageModel: 'black-forest-labs/flux-2-klein-4b',
  defaultVideoModel: 'lightricks/ltx-2-fast',
  defaultAudioModel: 'google/lyria-2',
  defaultUpscalerModel: 'recraft-ai/recraft-crisp-upscale',

  // Edge Appearance
  edgeType: 'bezier',
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing application settings
 * Handles loading, saving, and persisting settings via Tauri
 */
export function useSettings(): UseSettingsReturn {
  // API Keys
  const [openaiApiKey, setOpenAIApiKey] = useState<string>(DEFAULT_SETTINGS.openaiApiKey);
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>(
    DEFAULT_SETTINGS.openRouterApiKey
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(DEFAULT_SETTINGS.anthropicApiKey);
  const [replicateApiKey, setReplicateApiKey] = useState<string>(DEFAULT_SETTINGS.replicateApiKey);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(DEFAULT_SETTINGS.geminiApiKey);

  // Service URLs
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(DEFAULT_SETTINGS.ollamaBaseUrl);
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState<string>(DEFAULT_SETTINGS.lmStudioBaseUrl);

  // Paths
  const [defaultSaveLocation, setDefaultSaveLocation] = useState<string>(
    DEFAULT_SETTINGS.defaultSaveLocation
  );

  // UI Preferences
  const [showTemplates, setShowTemplates] = useState<boolean>(DEFAULT_SETTINGS.showTemplates);
  const [showAssistantPanel, setShowAssistantPanel] = useState<boolean>(
    DEFAULT_SETTINGS.showAssistantPanel
  );
  const [showEditorToolbar, setShowEditorToolbar] = useState<boolean>(
    DEFAULT_SETTINGS.showEditorToolbar
  );
  const [runButtonUnlocked, setRunButtonUnlocked] = useState<boolean>(
    DEFAULT_SETTINGS.runButtonUnlocked
  );
  const [runButtonPosition, setRunButtonPosition] = useState<RunButtonPosition>(
    DEFAULT_SETTINGS.runButtonPosition
  );

  // Default Models
  const [defaultTextModel, setDefaultTextModel] = useState<string>(
    DEFAULT_SETTINGS.defaultTextModel
  );
  const [defaultImageModel, setDefaultImageModel] = useState<string>(
    DEFAULT_SETTINGS.defaultImageModel
  );
  const [defaultVideoModel, setDefaultVideoModel] = useState<string>(
    DEFAULT_SETTINGS.defaultVideoModel
  );
  const [defaultAudioModel, setDefaultAudioModel] = useState<string>(
    DEFAULT_SETTINGS.defaultAudioModel
  );
  const [defaultUpscalerModel, setDefaultUpscalerModel] = useState<string>(
    DEFAULT_SETTINGS.defaultUpscalerModel
  );

  // Edge Appearance
  const [edgeType, setEdgeType] = useState<EdgeType>(DEFAULT_SETTINGS.edgeType);

  // Loading state
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from Tauri on mount
  useEffect(() => {
    const loadAppSettings = async (): Promise<void> => {
      try {
        const settings = await invoke<AppSettings>('load_settings');

        // API Keys
        if (settings.openai_api_key) setOpenAIApiKey(settings.openai_api_key);
        if (settings.openrouter_api_key) setOpenRouterApiKey(settings.openrouter_api_key);
        if (settings.anthropic_api_key) setAnthropicApiKey(settings.anthropic_api_key);
        if (settings.replicate_api_key) setReplicateApiKey(settings.replicate_api_key);
        if (settings.gemini_api_key) setGeminiApiKey(settings.gemini_api_key);

        // Service URLs
        if (settings.ollama_base_url) setOllamaBaseUrl(settings.ollama_base_url);
        if (settings.lm_studio_base_url) setLmStudioBaseUrl(settings.lm_studio_base_url);

        // Paths
        if (settings.default_save_location) setDefaultSaveLocation(settings.default_save_location);

        // UI Preferences
        if (settings.show_templates !== undefined) {
          setShowTemplates(settings.show_templates);
        }
        if (settings.show_assistant_panel !== undefined) {
          setShowAssistantPanel(settings.show_assistant_panel);
        }
        if (settings.run_button_unlocked !== undefined) {
          setRunButtonUnlocked(settings.run_button_unlocked);
        }
        if (settings.run_button_position !== undefined) {
          setRunButtonPosition(settings.run_button_position);
        }

        // Default Models
        if (settings.default_text_model) {
          setDefaultTextModel(settings.default_text_model);
        }
        if (settings.default_image_model) {
          setDefaultImageModel(settings.default_image_model);
        }
        if (settings.default_video_model) {
          setDefaultVideoModel(settings.default_video_model);
        }
        if (settings.default_audio_model) {
          setDefaultAudioModel(settings.default_audio_model);
        }
        if (settings.default_upscaler_model) {
          setDefaultUpscalerModel(settings.default_upscaler_model);
        }

        // Edge Appearance
        if (settings.edge_type) setEdgeType(settings.edge_type);

        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setIsLoaded(true); // Still mark as loaded so app can proceed with defaults
      }
    };

    loadAppSettings();
  }, []);

  // Save settings to Tauri when they change (debounced)
  useEffect(() => {
    // Don't save until initial load is complete
    if (!isLoaded) return;

    const saveAppSettings = async (): Promise<void> => {
      try {
        await invoke('save_settings', {
          settings: {
            // API Keys
            openai_api_key: openaiApiKey || null,
            openrouter_api_key: openRouterApiKey || null,
            anthropic_api_key: anthropicApiKey || null,
            replicate_api_key: replicateApiKey || null,
            gemini_api_key: geminiApiKey || null,

            // Service URLs
            ollama_base_url: ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl,
            lm_studio_base_url: lmStudioBaseUrl || DEFAULT_SETTINGS.lmStudioBaseUrl,

            // Paths
            default_save_location: defaultSaveLocation || DEFAULT_SETTINGS.defaultSaveLocation,

            // UI Preferences
            show_templates: showTemplates,
            show_assistant_panel: showAssistantPanel,
            run_button_unlocked: runButtonUnlocked,
            run_button_position: runButtonPosition,

            // Default Models
            default_text_model: defaultTextModel || null,
            default_image_model: defaultImageModel || null,
            default_video_model: defaultVideoModel || null,
            default_audio_model: defaultAudioModel || null,
            default_upscaler_model: defaultUpscalerModel || null,

            // Edge Appearance
            edge_type: edgeType || DEFAULT_SETTINGS.edgeType,
          },
        });
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    };

    // Debounce the save operation to avoid excessive writes
    const timeoutId = setTimeout(saveAppSettings, 500);
    return () => clearTimeout(timeoutId);
  }, [
    isLoaded,
    openaiApiKey,
    openRouterApiKey,
    anthropicApiKey,
    replicateApiKey,
    geminiApiKey,
    ollamaBaseUrl,
    lmStudioBaseUrl,
    defaultSaveLocation,
    showTemplates,
    showAssistantPanel,
    runButtonUnlocked,
    runButtonPosition,
    defaultTextModel,
    defaultImageModel,
    defaultVideoModel,
    defaultAudioModel,
    defaultUpscalerModel,
    edgeType,
  ]);

  // Helper to get default model by node type
  const getDefaultModel = useCallback(
    (nodeType: NodeType): string | null => {
      switch (nodeType) {
        case 'text':
          return defaultTextModel;
        case 'image':
          return defaultImageModel;
        case 'video':
          return defaultVideoModel;
        case 'audio':
          return defaultAudioModel;
        case 'upscaler':
          return defaultUpscalerModel;
        default:
          return null;
      }
    },
    [
      defaultTextModel,
      defaultImageModel,
      defaultVideoModel,
      defaultAudioModel,
      defaultUpscalerModel,
    ]
  );

  // Helper to reset all settings to defaults
  const resetToDefaults = useCallback((): void => {
    setOpenAIApiKey(DEFAULT_SETTINGS.openaiApiKey);
    setOpenRouterApiKey(DEFAULT_SETTINGS.openRouterApiKey);
    setAnthropicApiKey(DEFAULT_SETTINGS.anthropicApiKey);
    setReplicateApiKey(DEFAULT_SETTINGS.replicateApiKey);
    setGeminiApiKey(DEFAULT_SETTINGS.geminiApiKey);
    setOllamaBaseUrl(DEFAULT_SETTINGS.ollamaBaseUrl);
    setLmStudioBaseUrl(DEFAULT_SETTINGS.lmStudioBaseUrl);
    setDefaultSaveLocation(DEFAULT_SETTINGS.defaultSaveLocation);
    setShowTemplates(DEFAULT_SETTINGS.showTemplates);
    setShowAssistantPanel(DEFAULT_SETTINGS.showAssistantPanel);
    setShowEditorToolbar(DEFAULT_SETTINGS.showEditorToolbar);
    setRunButtonUnlocked(DEFAULT_SETTINGS.runButtonUnlocked);
    setRunButtonPosition(DEFAULT_SETTINGS.runButtonPosition);
    setDefaultTextModel(DEFAULT_SETTINGS.defaultTextModel);
    setDefaultImageModel(DEFAULT_SETTINGS.defaultImageModel);
    setDefaultVideoModel(DEFAULT_SETTINGS.defaultVideoModel);
    setDefaultAudioModel(DEFAULT_SETTINGS.defaultAudioModel);
    setDefaultUpscalerModel(DEFAULT_SETTINGS.defaultUpscalerModel);
    setEdgeType(DEFAULT_SETTINGS.edgeType);
  }, []);

  return {
    // Loading state
    isLoaded,

    // API Keys
    openaiApiKey,
    setOpenAIApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    anthropicApiKey,
    setAnthropicApiKey,
    replicateApiKey,
    setReplicateApiKey,
    geminiApiKey,
    setGeminiApiKey,

    // Service URLs
    ollamaBaseUrl,
    setOllamaBaseUrl,
    lmStudioBaseUrl,
    setLmStudioBaseUrl,

    // Paths
    defaultSaveLocation,
    setDefaultSaveLocation,

    // UI Preferences
    showTemplates,
    setShowTemplates,
    showAssistantPanel,
    setShowAssistantPanel,
    showEditorToolbar,
    setShowEditorToolbar,
    runButtonUnlocked,
    setRunButtonUnlocked,
    runButtonPosition,
    setRunButtonPosition,

    // Default Models
    defaultTextModel,
    setDefaultTextModel,
    defaultImageModel,
    setDefaultImageModel,
    defaultVideoModel,
    setDefaultVideoModel,
    defaultAudioModel,
    setDefaultAudioModel,
    defaultUpscalerModel,
    setDefaultUpscalerModel,

    // Edge Appearance
    edgeType,
    setEdgeType,

    // Helpers
    getDefaultModel,
    resetToDefaults,
  };
}

export default useSettings;
