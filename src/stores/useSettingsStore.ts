import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '../types/tauri';

// ============================================================================
// Types
// ============================================================================

export type NodeType = 'text' | 'image' | 'video' | 'audio' | 'upscaler';
export type EdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep';

// Provider types for different model categories
export type TextProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'ollama' | 'lmstudio';
export type MediaProvider = 'replicate' | 'fal' | 'openrouter';

export interface RunButtonPosition {
  x: number;
  y: number;
}

export interface SettingsState {
  // Loading state
  isLoaded: boolean;
  isSaving: boolean;

  // API Keys
  openaiApiKey: string;
  openRouterApiKey: string;
  anthropicApiKey: string;
  replicateApiKey: string;
  falApiKey: string;
  geminiApiKey: string;

  // Service URLs
  ollamaBaseUrl: string;
  lmStudioBaseUrl: string;

  // Paths
  defaultSaveLocation: string;

  // UI Preferences
  showTemplates: boolean;
  showAssistantPanel: boolean;
  showEditorToolbar: boolean;
  runButtonUnlocked: boolean;
  runButtonPosition: RunButtonPosition;

  // Default Models
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  defaultAudioModel: string;
  defaultUpscalerModel: string;

  // Edge Appearance
  edgeType: EdgeType;

  // Theme
  currentTheme: string;

  // Default Providers
  defaultTextProvider: TextProvider;
  defaultImageProvider: MediaProvider;
  defaultVideoProvider: MediaProvider;
  defaultAudioProvider: MediaProvider;
  defaultUpscalerProvider: MediaProvider;
}

export interface SettingsActions {
  // Setters
  setOpenAIApiKey: (value: string) => void;
  setOpenRouterApiKey: (value: string) => void;
  setAnthropicApiKey: (value: string) => void;
  setReplicateApiKey: (value: string) => void;
  setFalApiKey: (value: string) => void;
  setGeminiApiKey: (value: string) => void;
  setOllamaBaseUrl: (value: string) => void;
  setLmStudioBaseUrl: (value: string) => void;
  setDefaultSaveLocation: (value: string) => void;
  setShowTemplates: (value: boolean) => void;
  setShowAssistantPanel: (value: boolean) => void;
  setShowEditorToolbar: (value: boolean) => void;
  setRunButtonUnlocked: (value: boolean) => void;
  setRunButtonPosition: (value: RunButtonPosition) => void;
  setDefaultTextModel: (value: string) => void;
  setDefaultImageModel: (value: string) => void;
  setDefaultVideoModel: (value: string) => void;
  setDefaultAudioModel: (value: string) => void;
  setDefaultUpscalerModel: (value: string) => void;
  setEdgeType: (value: EdgeType) => void;
  setCurrentTheme: (value: string) => void;
  setDefaultTextProvider: (value: TextProvider) => void;
  setDefaultImageProvider: (value: MediaProvider) => void;
  setDefaultVideoProvider: (value: MediaProvider) => void;
  setDefaultAudioProvider: (value: MediaProvider) => void;
  setDefaultUpscalerProvider: (value: MediaProvider) => void;

  // Helpers
  getDefaultModel: (nodeType: NodeType) => string | null;
  getDefaultProvider: (nodeType: NodeType) => TextProvider | MediaProvider;
  resetToDefaults: () => void;
  loadFromTauri: () => Promise<void>;
  saveToTauri: () => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: SettingsState = {
  // Loading state
  isLoaded: false,
  isSaving: false,

  // API Keys
  openaiApiKey: '',
  openRouterApiKey: '',
  anthropicApiKey: '',
  replicateApiKey: '',
  falApiKey: '',
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

  // Theme
  currentTheme: 'monochrome',

  // Default Providers
  defaultTextProvider: 'openrouter',
  defaultImageProvider: 'replicate',
  defaultVideoProvider: 'replicate',
  defaultAudioProvider: 'replicate',
  defaultUpscalerProvider: 'replicate',
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      // API Key setters
      setOpenAIApiKey: (value) => {
        set({ openaiApiKey: value });
        get().saveToTauri();
      },
      setOpenRouterApiKey: (value) => {
        set({ openRouterApiKey: value });
        get().saveToTauri();
      },
      setAnthropicApiKey: (value) => {
        set({ anthropicApiKey: value });
        get().saveToTauri();
      },
      setReplicateApiKey: (value) => {
        set({ replicateApiKey: value });
        get().saveToTauri();
      },
      setFalApiKey: (value) => {
        set({ falApiKey: value });
        get().saveToTauri();
      },
      setGeminiApiKey: (value) => {
        set({ geminiApiKey: value });
        get().saveToTauri();
      },

      // Service URL setters
      setOllamaBaseUrl: (value) => {
        set({ ollamaBaseUrl: value });
        get().saveToTauri();
      },
      setLmStudioBaseUrl: (value) => {
        set({ lmStudioBaseUrl: value });
        get().saveToTauri();
      },

      // Path setters
      setDefaultSaveLocation: (value) => {
        set({ defaultSaveLocation: value });
        get().saveToTauri();
      },

      // UI Preference setters
      setShowTemplates: (value) => {
        set({ showTemplates: value });
        get().saveToTauri();
      },
      setShowAssistantPanel: (value) => {
        set({ showAssistantPanel: value });
        get().saveToTauri();
      },
      setShowEditorToolbar: (value) => {
        set({ showEditorToolbar: value });
        get().saveToTauri();
      },
      setRunButtonUnlocked: (value) => {
        set({ runButtonUnlocked: value });
        get().saveToTauri();
      },
      setRunButtonPosition: (value) => {
        set({ runButtonPosition: value });
        get().saveToTauri();
      },

      // Default Model setters
      setDefaultTextModel: (value) => {
        set({ defaultTextModel: value });
        get().saveToTauri();
      },
      setDefaultImageModel: (value) => {
        set({ defaultImageModel: value });
        get().saveToTauri();
      },
      setDefaultVideoModel: (value) => {
        set({ defaultVideoModel: value });
        get().saveToTauri();
      },
      setDefaultAudioModel: (value) => {
        set({ defaultAudioModel: value });
        get().saveToTauri();
      },
      setDefaultUpscalerModel: (value) => {
        set({ defaultUpscalerModel: value });
        get().saveToTauri();
      },

      // Edge Appearance setter
      setEdgeType: (value) => {
        set({ edgeType: value });
        get().saveToTauri();
      },

      // Theme setter
      setCurrentTheme: (value) => {
        set({ currentTheme: value });
        localStorage.setItem('noder-theme', value);
      },

      // Default Provider setters
      setDefaultTextProvider: (value) => {
        set({ defaultTextProvider: value });
        get().saveToTauri();
      },
      setDefaultImageProvider: (value) => {
        set({ defaultImageProvider: value });
        get().saveToTauri();
      },
      setDefaultVideoProvider: (value) => {
        set({ defaultVideoProvider: value });
        get().saveToTauri();
      },
      setDefaultAudioProvider: (value) => {
        set({ defaultAudioProvider: value });
        get().saveToTauri();
      },
      setDefaultUpscalerProvider: (value) => {
        set({ defaultUpscalerProvider: value });
        get().saveToTauri();
      },

      // Helper to get default model by node type
      getDefaultModel: (nodeType) => {
        const state = get();
        switch (nodeType) {
          case 'text':
            return state.defaultTextModel;
          case 'image':
            return state.defaultImageModel;
          case 'video':
            return state.defaultVideoModel;
          case 'audio':
            return state.defaultAudioModel;
          case 'upscaler':
            return state.defaultUpscalerModel;
          default:
            return null;
        }
      },

      // Helper to get default provider by node type
      getDefaultProvider: (nodeType) => {
        const state = get();
        switch (nodeType) {
          case 'text':
            return state.defaultTextProvider;
          case 'image':
            return state.defaultImageProvider;
          case 'video':
            return state.defaultVideoProvider;
          case 'audio':
            return state.defaultAudioProvider;
          case 'upscaler':
            return state.defaultUpscalerProvider;
          default:
            return 'replicate';
        }
      },

      // Reset all settings to defaults
      resetToDefaults: () => {
        set({
          openaiApiKey: DEFAULT_SETTINGS.openaiApiKey,
          openRouterApiKey: DEFAULT_SETTINGS.openRouterApiKey,
          anthropicApiKey: DEFAULT_SETTINGS.anthropicApiKey,
          replicateApiKey: DEFAULT_SETTINGS.replicateApiKey,
          falApiKey: DEFAULT_SETTINGS.falApiKey,
          geminiApiKey: DEFAULT_SETTINGS.geminiApiKey,
          ollamaBaseUrl: DEFAULT_SETTINGS.ollamaBaseUrl,
          lmStudioBaseUrl: DEFAULT_SETTINGS.lmStudioBaseUrl,
          defaultSaveLocation: DEFAULT_SETTINGS.defaultSaveLocation,
          showTemplates: DEFAULT_SETTINGS.showTemplates,
          showAssistantPanel: DEFAULT_SETTINGS.showAssistantPanel,
          showEditorToolbar: DEFAULT_SETTINGS.showEditorToolbar,
          runButtonUnlocked: DEFAULT_SETTINGS.runButtonUnlocked,
          runButtonPosition: DEFAULT_SETTINGS.runButtonPosition,
          defaultTextModel: DEFAULT_SETTINGS.defaultTextModel,
          defaultImageModel: DEFAULT_SETTINGS.defaultImageModel,
          defaultVideoModel: DEFAULT_SETTINGS.defaultVideoModel,
          defaultAudioModel: DEFAULT_SETTINGS.defaultAudioModel,
          defaultUpscalerModel: DEFAULT_SETTINGS.defaultUpscalerModel,
          edgeType: DEFAULT_SETTINGS.edgeType,
          currentTheme: DEFAULT_SETTINGS.currentTheme,
          defaultTextProvider: DEFAULT_SETTINGS.defaultTextProvider,
          defaultImageProvider: DEFAULT_SETTINGS.defaultImageProvider,
          defaultVideoProvider: DEFAULT_SETTINGS.defaultVideoProvider,
          defaultAudioProvider: DEFAULT_SETTINGS.defaultAudioProvider,
          defaultUpscalerProvider: DEFAULT_SETTINGS.defaultUpscalerProvider,
        });
        get().saveToTauri();
      },

      // Load settings from Tauri backend
      loadFromTauri: async () => {
        try {
          const settings = await invoke('load_settings');

          set({
            // API Keys
            openaiApiKey: settings.openai_api_key || DEFAULT_SETTINGS.openaiApiKey,
            openRouterApiKey: settings.openrouter_api_key || DEFAULT_SETTINGS.openRouterApiKey,
            anthropicApiKey: settings.anthropic_api_key || DEFAULT_SETTINGS.anthropicApiKey,
            replicateApiKey: settings.replicate_api_key || DEFAULT_SETTINGS.replicateApiKey,
            falApiKey: settings.fal_api_key || DEFAULT_SETTINGS.falApiKey,
            geminiApiKey: settings.gemini_api_key || DEFAULT_SETTINGS.geminiApiKey,

            // Service URLs
            ollamaBaseUrl: settings.ollama_base_url || DEFAULT_SETTINGS.ollamaBaseUrl,
            lmStudioBaseUrl: settings.lm_studio_base_url || DEFAULT_SETTINGS.lmStudioBaseUrl,

            // Paths
            defaultSaveLocation:
              settings.default_save_location || DEFAULT_SETTINGS.defaultSaveLocation,

            // UI Preferences
            showTemplates:
              settings.show_templates !== undefined && settings.show_templates !== null
                ? settings.show_templates
                : DEFAULT_SETTINGS.showTemplates,
            showAssistantPanel:
              settings.show_assistant_panel !== undefined && settings.show_assistant_panel !== null
                ? settings.show_assistant_panel
                : DEFAULT_SETTINGS.showAssistantPanel,
            runButtonUnlocked:
              settings.run_button_unlocked !== undefined && settings.run_button_unlocked !== null
                ? settings.run_button_unlocked
                : DEFAULT_SETTINGS.runButtonUnlocked,
            runButtonPosition:
              (settings.run_button_position as RunButtonPosition) ||
              DEFAULT_SETTINGS.runButtonPosition,

            // Default Models
            defaultTextModel: settings.default_text_model || DEFAULT_SETTINGS.defaultTextModel,
            defaultImageModel: settings.default_image_model || DEFAULT_SETTINGS.defaultImageModel,
            defaultVideoModel: settings.default_video_model || DEFAULT_SETTINGS.defaultVideoModel,
            defaultAudioModel: settings.default_audio_model || DEFAULT_SETTINGS.defaultAudioModel,
            defaultUpscalerModel:
              settings.default_upscaler_model || DEFAULT_SETTINGS.defaultUpscalerModel,

            // Edge Appearance
            edgeType: (settings.edge_type as EdgeType) || DEFAULT_SETTINGS.edgeType,

            // Default Providers
            defaultTextProvider:
              (settings.default_text_provider as TextProvider) ||
              DEFAULT_SETTINGS.defaultTextProvider,
            defaultImageProvider:
              (settings.default_image_provider as MediaProvider) ||
              DEFAULT_SETTINGS.defaultImageProvider,
            defaultVideoProvider:
              (settings.default_video_provider as MediaProvider) ||
              DEFAULT_SETTINGS.defaultVideoProvider,
            defaultAudioProvider:
              (settings.default_audio_provider as MediaProvider) ||
              DEFAULT_SETTINGS.defaultAudioProvider,
            defaultUpscalerProvider:
              (settings.default_upscaler_provider as MediaProvider) ||
              DEFAULT_SETTINGS.defaultUpscalerProvider,

            isLoaded: true,
          });

          // Load theme from localStorage
          const savedTheme = localStorage.getItem('noder-theme');
          if (savedTheme) {
            set({ currentTheme: savedTheme });
          }
        } catch (error) {
          console.error('Failed to load settings from Tauri:', error);
          set({ isLoaded: true }); // Still mark as loaded so app can proceed with defaults
        }
      },

      // Save settings to Tauri backend (debounced internally)
      saveToTauri: (() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        return async () => {
          const state = get();

          // Don't save if not yet loaded
          if (!state.isLoaded || state.isSaving) return;

          // Debounce
          if (timeoutId) clearTimeout(timeoutId);

          timeoutId = setTimeout(async () => {
            set({ isSaving: true });

            try {
              await invoke('save_settings', {
                settings: {
                  // API Keys
                  openai_api_key: state.openaiApiKey || null,
                  openrouter_api_key: state.openRouterApiKey || null,
                  anthropic_api_key: state.anthropicApiKey || null,
                  replicate_api_key: state.replicateApiKey || null,
                  fal_api_key: state.falApiKey || null,
                  gemini_api_key: state.geminiApiKey || null,

                  // Service URLs
                  ollama_base_url: state.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl,
                  lm_studio_base_url: state.lmStudioBaseUrl || DEFAULT_SETTINGS.lmStudioBaseUrl,

                  // Paths
                  default_save_location:
                    state.defaultSaveLocation || DEFAULT_SETTINGS.defaultSaveLocation,

                  // UI Preferences
                  show_templates: state.showTemplates,
                  show_assistant_panel: state.showAssistantPanel,
                  run_button_unlocked: state.runButtonUnlocked,
                  run_button_position: state.runButtonPosition,

                  // Default Models
                  default_text_model: state.defaultTextModel || null,
                  default_image_model: state.defaultImageModel || null,
                  default_video_model: state.defaultVideoModel || null,
                  default_audio_model: state.defaultAudioModel || null,
                  default_upscaler_model: state.defaultUpscalerModel || null,

                  // Edge Appearance
                  edge_type: state.edgeType || DEFAULT_SETTINGS.edgeType,

                  // Default Providers
                  default_text_provider: state.defaultTextProvider || null,
                  default_image_provider: state.defaultImageProvider || null,
                  default_video_provider: state.defaultVideoProvider || null,
                  default_audio_provider: state.defaultAudioProvider || null,
                  default_upscaler_provider: state.defaultUpscalerProvider || null,
                },
              });
            } catch (error) {
              console.error('Failed to save settings to Tauri:', error);
            } finally {
              set({ isSaving: false });
            }
          }, 500);
        };
      })(),
    }),
    {
      name: 'noder-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist non-sensitive UI preferences locally
        // API keys are handled by Tauri's secure storage
        showTemplates: state.showTemplates,
        showAssistantPanel: state.showAssistantPanel,
        showEditorToolbar: state.showEditorToolbar,
        runButtonUnlocked: state.runButtonUnlocked,
        runButtonPosition: state.runButtonPosition,
        edgeType: state.edgeType,
        currentTheme: state.currentTheme,
      }),
    }
  )
);

// Export selector hooks for convenience
export const useOpenAIApiKey = () => useSettingsStore((s) => s.openaiApiKey);
export const useReplicateApiKey = () => useSettingsStore((s) => s.replicateApiKey);
export const useCurrentTheme = () => useSettingsStore((s) => s.currentTheme);
export const useEdgeType = () => useSettingsStore((s) => s.edgeType);
export const useShowAssistantPanel = () => useSettingsStore((s) => s.showAssistantPanel);
export const useShowEditorToolbar = () => useSettingsStore((s) => s.showEditorToolbar);

export default useSettingsStore;
