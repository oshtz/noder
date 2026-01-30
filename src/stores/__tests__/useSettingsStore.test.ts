import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../useSettingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
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

  describe('initial state', () => {
    it('should have default values', () => {
      const state = useSettingsStore.getState();
      expect(state.openaiApiKey).toBe('');
      expect(state.replicateApiKey).toBe('');
      expect(state.showTemplates).toBe(true);
      expect(state.showAssistantPanel).toBe(true);
      expect(state.edgeType).toBe('bezier');
      expect(state.currentTheme).toBe('monochrome');
    });
  });

  describe('setters', () => {
    it('should update API keys', () => {
      const store = useSettingsStore.getState();

      store.setOpenAIApiKey('sk-test-key');
      expect(useSettingsStore.getState().openaiApiKey).toBe('sk-test-key');

      store.setReplicateApiKey('r8-test-key');
      expect(useSettingsStore.getState().replicateApiKey).toBe('r8-test-key');
    });

    it('should update UI preferences', () => {
      const store = useSettingsStore.getState();

      store.setShowTemplates(false);
      expect(useSettingsStore.getState().showTemplates).toBe(false);

      store.setShowAssistantPanel(false);
      expect(useSettingsStore.getState().showAssistantPanel).toBe(false);

      store.setShowEditorToolbar(false);
      expect(useSettingsStore.getState().showEditorToolbar).toBe(false);
    });

    it('should update run button position', () => {
      const store = useSettingsStore.getState();

      store.setRunButtonPosition({ x: 100, y: 200 });
      expect(useSettingsStore.getState().runButtonPosition).toEqual({ x: 100, y: 200 });
    });

    it('should update edge type', () => {
      const store = useSettingsStore.getState();

      store.setEdgeType('straight');
      expect(useSettingsStore.getState().edgeType).toBe('straight');

      store.setEdgeType('smoothstep');
      expect(useSettingsStore.getState().edgeType).toBe('smoothstep');
    });

    it('should update theme', () => {
      const store = useSettingsStore.getState();

      store.setCurrentTheme('dark');
      expect(useSettingsStore.getState().currentTheme).toBe('dark');
    });

    it('should update default models', () => {
      const store = useSettingsStore.getState();

      store.setDefaultTextModel('openai/gpt-4');
      expect(useSettingsStore.getState().defaultTextModel).toBe('openai/gpt-4');

      store.setDefaultImageModel('stability-ai/sdxl');
      expect(useSettingsStore.getState().defaultImageModel).toBe('stability-ai/sdxl');
    });
  });

  describe('getDefaultModel', () => {
    it('should return correct model for each node type', () => {
      const store = useSettingsStore.getState();

      expect(store.getDefaultModel('text')).toBe('openai/gpt-4o-mini');
      expect(store.getDefaultModel('image')).toBe('black-forest-labs/flux-2-klein-4b');
      expect(store.getDefaultModel('video')).toBe('lightricks/ltx-2-fast');
      expect(store.getDefaultModel('audio')).toBe('google/lyria-2');
      expect(store.getDefaultModel('upscaler')).toBe('recraft-ai/recraft-crisp-upscale');
    });

    it('should return updated model after change', () => {
      const store = useSettingsStore.getState();

      store.setDefaultImageModel('new-model');
      expect(store.getDefaultModel('image')).toBe('new-model');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      const store = useSettingsStore.getState();

      // Change some values
      store.setOpenAIApiKey('test-key');
      store.setShowTemplates(false);
      store.setEdgeType('straight');

      // Reset
      store.resetToDefaults();

      const state = useSettingsStore.getState();
      expect(state.openaiApiKey).toBe('');
      expect(state.showTemplates).toBe(true);
      expect(state.edgeType).toBe('bezier');
    });
  });
});
