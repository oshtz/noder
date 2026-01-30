/**
 * Tests for useSettingsStore Zustand store
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

// Mock the tauri invoke
vi.mock('../types/tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../types/tauri';
const mockInvoke = vi.mocked(invoke);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useSettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.useFakeTimers();
    // Reset store - set values directly since resetToDefaults also calls saveToTauri
    useSettingsStore.setState({
      isLoaded: false,
      isSaving: false,
      openaiApiKey: '',
      openRouterApiKey: '',
      anthropicApiKey: '',
      replicateApiKey: '',
      geminiApiKey: '',
      ollamaBaseUrl: 'http://localhost:11434',
      lmStudioBaseUrl: 'http://localhost:1234',
      defaultSaveLocation: 'Downloads/noder',
      showTemplates: true,
      showAssistantPanel: true,
      showEditorToolbar: true,
      runButtonUnlocked: false,
      runButtonPosition: { x: 20, y: 20 },
      defaultTextModel: 'openai/gpt-4o-mini',
      defaultImageModel: 'black-forest-labs/flux-2-klein-4b',
      defaultVideoModel: 'lightricks/ltx-2-fast',
      defaultAudioModel: 'google/lyria-2',
      defaultUpscalerModel: 'recraft-ai/recraft-crisp-upscale',
      edgeType: 'bezier',
      currentTheme: 'monochrome',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useSettingsStore.getState();

      expect(state.isLoaded).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.openaiApiKey).toBe('');
      expect(state.replicateApiKey).toBe('');
      expect(state.ollamaBaseUrl).toBe('http://localhost:11434');
      expect(state.lmStudioBaseUrl).toBe('http://localhost:1234');
      expect(state.defaultSaveLocation).toBe('Downloads/noder');
      expect(state.showTemplates).toBe(true);
      expect(state.showAssistantPanel).toBe(true);
      expect(state.runButtonUnlocked).toBe(false);
      expect(state.runButtonPosition).toEqual({ x: 20, y: 20 });
      expect(state.edgeType).toBe('bezier');
      expect(state.currentTheme).toBe('monochrome');
    });
  });

  describe('API key setters', () => {
    it('should set OpenAI API key', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setOpenAIApiKey('sk-test-key');

      expect(useSettingsStore.getState().openaiApiKey).toBe('sk-test-key');
    });

    it('should set OpenRouter API key', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setOpenRouterApiKey('or-key');

      expect(useSettingsStore.getState().openRouterApiKey).toBe('or-key');
    });

    it('should set Anthropic API key', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setAnthropicApiKey('sk-ant-key');

      expect(useSettingsStore.getState().anthropicApiKey).toBe('sk-ant-key');
    });

    it('should set Replicate API key', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setReplicateApiKey('r8_token');

      expect(useSettingsStore.getState().replicateApiKey).toBe('r8_token');
    });

    it('should set Gemini API key', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setGeminiApiKey('gemini-key');

      expect(useSettingsStore.getState().geminiApiKey).toBe('gemini-key');
    });
  });

  describe('service URL setters', () => {
    it('should set Ollama base URL', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setOllamaBaseUrl('http://192.168.1.100:11434');

      expect(useSettingsStore.getState().ollamaBaseUrl).toBe('http://192.168.1.100:11434');
    });

    it('should set LM Studio base URL', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setLmStudioBaseUrl('http://localhost:5000');

      expect(useSettingsStore.getState().lmStudioBaseUrl).toBe('http://localhost:5000');
    });
  });

  describe('UI preference setters', () => {
    it('should set default save location', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setDefaultSaveLocation('/custom/path');

      expect(useSettingsStore.getState().defaultSaveLocation).toBe('/custom/path');
    });

    it('should set show templates', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setShowTemplates(false);

      expect(useSettingsStore.getState().showTemplates).toBe(false);
    });

    it('should set show assistant panel', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setShowAssistantPanel(false);

      expect(useSettingsStore.getState().showAssistantPanel).toBe(false);
    });

    it('should set show editor toolbar', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setShowEditorToolbar(false);

      expect(useSettingsStore.getState().showEditorToolbar).toBe(false);
    });

    it('should set run button unlocked', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setRunButtonUnlocked(true);

      expect(useSettingsStore.getState().runButtonUnlocked).toBe(true);
    });

    it('should set run button position', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setRunButtonPosition({ x: 100, y: 200 });

      expect(useSettingsStore.getState().runButtonPosition).toEqual({ x: 100, y: 200 });
    });
  });

  describe('default model setters', () => {
    it('should set default text model', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setDefaultTextModel('gpt-4');

      expect(useSettingsStore.getState().defaultTextModel).toBe('gpt-4');
    });

    it('should set default image model', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setDefaultImageModel('dall-e-3');

      expect(useSettingsStore.getState().defaultImageModel).toBe('dall-e-3');
    });

    it('should set default video model', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setDefaultVideoModel('video-model');

      expect(useSettingsStore.getState().defaultVideoModel).toBe('video-model');
    });

    it('should set default audio model', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setDefaultAudioModel('audio-model');

      expect(useSettingsStore.getState().defaultAudioModel).toBe('audio-model');
    });

    it('should set default upscaler model', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setDefaultUpscalerModel('upscale-model');

      expect(useSettingsStore.getState().defaultUpscalerModel).toBe('upscale-model');
    });
  });

  describe('appearance setters', () => {
    it('should set edge type', () => {
      useSettingsStore.setState({ isLoaded: true });
      useSettingsStore.getState().setEdgeType('straight');

      expect(useSettingsStore.getState().edgeType).toBe('straight');
    });

    it('should set current theme and save to localStorage', () => {
      useSettingsStore.getState().setCurrentTheme('dark');

      expect(useSettingsStore.getState().currentTheme).toBe('dark');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('noder-theme', 'dark');
    });
  });

  describe('getDefaultModel', () => {
    it('should return text model for text type', () => {
      expect(useSettingsStore.getState().getDefaultModel('text')).toBe('openai/gpt-4o-mini');
    });

    it('should return image model for image type', () => {
      expect(useSettingsStore.getState().getDefaultModel('image')).toBe(
        'black-forest-labs/flux-2-klein-4b'
      );
    });

    it('should return video model for video type', () => {
      expect(useSettingsStore.getState().getDefaultModel('video')).toBe('lightricks/ltx-2-fast');
    });

    it('should return audio model for audio type', () => {
      expect(useSettingsStore.getState().getDefaultModel('audio')).toBe('google/lyria-2');
    });

    it('should return upscaler model for upscaler type', () => {
      expect(useSettingsStore.getState().getDefaultModel('upscaler')).toBe(
        'recraft-ai/recraft-crisp-upscale'
      );
    });

    it('should return null for unknown type', () => {
      // @ts-expect-error - testing unknown type
      expect(useSettingsStore.getState().getDefaultModel('unknown')).toBeNull();
    });
  });

  describe('loadFromTauri', () => {
    it('should load settings from Tauri and update state', async () => {
      mockInvoke.mockResolvedValueOnce({
        openai_api_key: 'loaded-openai-key',
        replicate_api_key: 'loaded-replicate-key',
        ollama_base_url: 'http://custom:11434',
        show_templates: false,
        show_assistant_panel: false,
        edge_type: 'straight',
        default_text_model: 'custom-text-model',
      });

      await useSettingsStore.getState().loadFromTauri();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.openaiApiKey).toBe('loaded-openai-key');
      expect(state.replicateApiKey).toBe('loaded-replicate-key');
      expect(state.ollamaBaseUrl).toBe('http://custom:11434');
      expect(state.showTemplates).toBe(false);
      expect(state.showAssistantPanel).toBe(false);
      expect(state.edgeType).toBe('straight');
      expect(state.defaultTextModel).toBe('custom-text-model');
    });

    it('should use defaults for missing values', async () => {
      mockInvoke.mockResolvedValueOnce({
        // Empty settings
      });

      await useSettingsStore.getState().loadFromTauri();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.ollamaBaseUrl).toBe('http://localhost:11434');
      expect(state.showTemplates).toBe(true);
    });

    it('should load theme from localStorage', async () => {
      localStorageMock.setItem('noder-theme', 'dark');
      mockInvoke.mockResolvedValueOnce({});

      await useSettingsStore.getState().loadFromTauri();

      expect(useSettingsStore.getState().currentTheme).toBe('dark');
    });

    it('should handle load error gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Load failed'));

      await useSettingsStore.getState().loadFromTauri();

      // Should still mark as loaded so app can proceed
      expect(useSettingsStore.getState().isLoaded).toBe(true);
    });
  });

  describe('saveToTauri', () => {
    it('should not save if not loaded', async () => {
      useSettingsStore.setState({ isLoaded: false });
      await useSettingsStore.getState().saveToTauri();

      // Advance timers
      vi.advanceTimersByTime(600);

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should debounce save calls', async () => {
      useSettingsStore.setState({ isLoaded: true });

      useSettingsStore.getState().saveToTauri();
      useSettingsStore.getState().saveToTauri();
      useSettingsStore.getState().saveToTauri();

      // Before debounce timeout
      vi.advanceTimersByTime(400);
      expect(mockInvoke).not.toHaveBeenCalled();

      // After debounce timeout
      vi.advanceTimersByTime(200);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should save settings with correct structure', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      useSettingsStore.setState({
        isLoaded: true,
        openaiApiKey: 'test-key',
        replicateApiKey: 'r8-key',
        showTemplates: false,
      });

      useSettingsStore.getState().saveToTauri();
      vi.advanceTimersByTime(600);

      expect(mockInvoke).toHaveBeenCalledWith('save_settings', {
        settings: expect.objectContaining({
          openai_api_key: 'test-key',
          replicate_api_key: 'r8-key',
          show_templates: false,
        }),
      });
    });

    it('should handle save error gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Save failed'));
      useSettingsStore.setState({ isLoaded: true });

      // Should not throw
      useSettingsStore.getState().saveToTauri();
      vi.advanceTimersByTime(600);

      // Wait for async completion
      await vi.runAllTimersAsync();

      expect(useSettingsStore.getState().isSaving).toBe(false);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      useSettingsStore.setState({
        isLoaded: true,
        openaiApiKey: 'custom-key',
        showTemplates: false,
        edgeType: 'straight',
        currentTheme: 'dark',
      });

      useSettingsStore.getState().resetToDefaults();

      const state = useSettingsStore.getState();
      expect(state.openaiApiKey).toBe('');
      expect(state.showTemplates).toBe(true);
      expect(state.edgeType).toBe('bezier');
      expect(state.currentTheme).toBe('monochrome');
    });
  });
});
