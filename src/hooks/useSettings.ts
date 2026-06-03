import { useEffect } from 'react';
import { logger } from '../utils/logger';
import {
  useSettingsStore,
  type EdgeType,
  type NodeType,
  type RunButtonPosition,
} from '../stores/useSettingsStore';

export type { EdgeType, NodeType, RunButtonPosition };

export interface AppSettings {
  openai_api_key?: string | null;
  openrouter_api_key?: string | null;
  anthropic_api_key?: string | null;
  replicate_api_key?: string | null;
  fal_api_key?: string | null;
  gemini_api_key?: string | null;
  ollama_base_url?: string;
  lm_studio_base_url?: string;
  default_save_location?: string;
  show_templates?: boolean;
  show_assistant_panel?: boolean;
  show_editor_toolbar?: boolean;
  run_button_unlocked?: boolean;
  run_button_position?: RunButtonPosition;
  default_text_model?: string | null;
  default_image_model?: string | null;
  default_video_model?: string | null;
  default_audio_model?: string | null;
  default_upscaler_model?: string | null;
  edge_type?: EdgeType;
}

export interface UseSettingsReturn {
  isLoaded: boolean;
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
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (value: string) => void;
  lmStudioBaseUrl: string;
  setLmStudioBaseUrl: (value: string) => void;
  defaultSaveLocation: string;
  setDefaultSaveLocation: (value: string) => void;
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
  edgeType: EdgeType;
  setEdgeType: (value: EdgeType) => void;
  getDefaultModel: (nodeType: NodeType) => string | null;
  resetToDefaults: () => void;
}

export function useSettings(): UseSettingsReturn {
  const store = useSettingsStore();

  useEffect(() => {
    useSettingsStore
      .getState()
      .loadFromTauri()
      .catch((error) => {
        logger.error('Failed to load settings:', error);
      });
  }, []);

  return {
    isLoaded: store.isLoaded,
    openaiApiKey: store.openaiApiKey,
    setOpenAIApiKey: store.setOpenAIApiKey,
    openRouterApiKey: store.openRouterApiKey,
    setOpenRouterApiKey: store.setOpenRouterApiKey,
    anthropicApiKey: store.anthropicApiKey,
    setAnthropicApiKey: store.setAnthropicApiKey,
    replicateApiKey: store.replicateApiKey,
    setReplicateApiKey: store.setReplicateApiKey,
    geminiApiKey: store.geminiApiKey,
    setGeminiApiKey: store.setGeminiApiKey,
    ollamaBaseUrl: store.ollamaBaseUrl,
    setOllamaBaseUrl: store.setOllamaBaseUrl,
    lmStudioBaseUrl: store.lmStudioBaseUrl,
    setLmStudioBaseUrl: store.setLmStudioBaseUrl,
    defaultSaveLocation: store.defaultSaveLocation,
    setDefaultSaveLocation: store.setDefaultSaveLocation,
    showTemplates: store.showTemplates,
    setShowTemplates: store.setShowTemplates,
    showAssistantPanel: store.showAssistantPanel,
    setShowAssistantPanel: store.setShowAssistantPanel,
    showEditorToolbar: store.showEditorToolbar,
    setShowEditorToolbar: store.setShowEditorToolbar,
    runButtonUnlocked: store.runButtonUnlocked,
    setRunButtonUnlocked: store.setRunButtonUnlocked,
    runButtonPosition: store.runButtonPosition,
    setRunButtonPosition: store.setRunButtonPosition,
    defaultTextModel: store.defaultTextModel,
    setDefaultTextModel: store.setDefaultTextModel,
    defaultImageModel: store.defaultImageModel,
    setDefaultImageModel: store.setDefaultImageModel,
    defaultVideoModel: store.defaultVideoModel,
    setDefaultVideoModel: store.setDefaultVideoModel,
    defaultAudioModel: store.defaultAudioModel,
    setDefaultAudioModel: store.setDefaultAudioModel,
    defaultUpscalerModel: store.defaultUpscalerModel,
    setDefaultUpscalerModel: store.setDefaultUpscalerModel,
    edgeType: store.edgeType,
    setEdgeType: store.setEdgeType,
    getDefaultModel: store.getDefaultModel,
    resetToDefaults: store.resetToDefaults,
  };
}

export default useSettings;
