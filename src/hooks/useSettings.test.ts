import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings, type NodeType } from './useSettings';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for load_settings
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_settings') {
        return Promise.resolve({});
      }
      return Promise.resolve(undefined);
    });
  });

  describe('initialization', () => {
    it('should start with isLoaded as false', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.isLoaded).toBe(false);
    });

    it('should call load_settings on mount', async () => {
      renderHook(() => useSettings());
      await waitFor(() => {
        expect(mockedInvoke).toHaveBeenCalledWith('load_settings');
      });
    });

    it('should set isLoaded to true after loading settings', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it('should set isLoaded to true even if load_settings fails', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('Failed to load'));
      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it('should load API keys from settings', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            openai_api_key: 'test-openai-key',
            replicate_api_key: 'test-replicate-key',
            openrouter_api_key: 'test-openrouter-key',
            anthropic_api_key: 'test-anthropic-key',
            gemini_api_key: 'test-gemini-key',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.openaiApiKey).toBe('test-openai-key');
        expect(result.current.replicateApiKey).toBe('test-replicate-key');
        expect(result.current.openRouterApiKey).toBe('test-openrouter-key');
        expect(result.current.anthropicApiKey).toBe('test-anthropic-key');
        expect(result.current.geminiApiKey).toBe('test-gemini-key');
      });
    });

    it('should load UI preferences from settings', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            show_templates: false,
            show_assistant_panel: false,
            run_button_unlocked: true,
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.showTemplates).toBe(false);
        expect(result.current.showAssistantPanel).toBe(false);
        expect(result.current.runButtonUnlocked).toBe(true);
      });
    });

    it('should load service URLs from settings', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            ollama_base_url: 'http://custom:11434',
            lm_studio_base_url: 'http://custom:1234',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.ollamaBaseUrl).toBe('http://custom:11434');
        expect(result.current.lmStudioBaseUrl).toBe('http://custom:1234');
      });
    });

    it('should load default models from settings', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            default_text_model: 'custom-text-model',
            default_image_model: 'custom-image-model',
            default_video_model: 'custom-video-model',
            default_audio_model: 'custom-audio-model',
            default_upscaler_model: 'custom-upscaler-model',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.defaultTextModel).toBe('custom-text-model');
        expect(result.current.defaultImageModel).toBe('custom-image-model');
        expect(result.current.defaultVideoModel).toBe('custom-video-model');
        expect(result.current.defaultAudioModel).toBe('custom-audio-model');
        expect(result.current.defaultUpscalerModel).toBe('custom-upscaler-model');
      });
    });

    it('should load edge type from settings', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            edge_type: 'straight',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => {
        expect(result.current.edgeType).toBe('straight');
      });
    });
  });

  describe('default values', () => {
    it('should have default API keys as empty strings', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      expect(result.current.openaiApiKey).toBe('');
      expect(result.current.replicateApiKey).toBe('');
    });

    it('should have default service URLs', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      expect(result.current.ollamaBaseUrl).toBe('http://localhost:11434');
      expect(result.current.lmStudioBaseUrl).toBe('http://localhost:1234');
    });

    it('should have default UI preferences', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      expect(result.current.showTemplates).toBe(true);
      expect(result.current.showAssistantPanel).toBe(true);
      expect(result.current.runButtonUnlocked).toBe(false);
    });

    it('should have default edge type as bezier', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      expect(result.current.edgeType).toBe('bezier');
    });
  });

  describe('setters', () => {
    it('should update openai API key', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.setOpenAIApiKey('new-key');
      });

      expect(result.current.openaiApiKey).toBe('new-key');
    });

    it('should update replicate API key', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.setReplicateApiKey('new-replicate-key');
      });

      expect(result.current.replicateApiKey).toBe('new-replicate-key');
    });

    it('should update show templates preference', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.setShowTemplates(false);
      });

      expect(result.current.showTemplates).toBe(false);
    });

    it('should update edge type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.setEdgeType('straight');
      });

      expect(result.current.edgeType).toBe('straight');
    });

    it('should update default models', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.setDefaultImageModel('new-image-model');
      });

      expect(result.current.defaultImageModel).toBe('new-image-model');
    });

    it('should update run button position', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      act(() => {
        result.current.setRunButtonPosition({ x: 100, y: 200 });
      });

      expect(result.current.runButtonPosition).toEqual({ x: 100, y: 200 });
    });
  });

  describe('saving', () => {
    it('should call save_settings after settings change', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      mockedInvoke.mockClear();

      act(() => {
        result.current.setOpenAIApiKey('new-key');
      });

      // Wait for debounce to complete
      await waitFor(
        () => {
          expect(mockedInvoke).toHaveBeenCalledWith(
            'save_settings',
            expect.objectContaining({
              settings: expect.objectContaining({
                openai_api_key: 'new-key',
              }),
            })
          );
        },
        { timeout: 1000 }
      );
    });
  });

  describe('getDefaultModel', () => {
    it('should return correct model for text type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      const model = result.current.getDefaultModel('text' as NodeType);
      expect(model).toBe('openai/gpt-4o-mini');
    });

    it('should return correct model for image type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      const model = result.current.getDefaultModel('image' as NodeType);
      expect(model).toBe('black-forest-labs/flux-2-klein-4b');
    });

    it('should return correct model for video type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      const model = result.current.getDefaultModel('video' as NodeType);
      expect(model).toBe('lightricks/ltx-2-fast');
    });

    it('should return correct model for audio type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      const model = result.current.getDefaultModel('audio' as NodeType);
      expect(model).toBe('google/lyria-2');
    });

    it('should return correct model for upscaler type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      const model = result.current.getDefaultModel('upscaler' as NodeType);
      expect(model).toBe('recraft-ai/recraft-crisp-upscale');
    });

    it('should return null for unknown type', async () => {
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      const model = result.current.getDefaultModel('unknown' as NodeType);
      expect(model).toBeNull();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all API keys to empty strings', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            openai_api_key: 'test-key',
            replicate_api_key: 'test-key',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.openaiApiKey).toBe('test-key'));

      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.openaiApiKey).toBe('');
      expect(result.current.replicateApiKey).toBe('');
    });

    it('should reset service URLs to defaults', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            ollama_base_url: 'http://custom:11434',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.ollamaBaseUrl).toBe('http://custom:11434'));

      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.ollamaBaseUrl).toBe('http://localhost:11434');
    });

    it('should reset UI preferences to defaults', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            show_templates: false,
            show_assistant_panel: false,
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.showTemplates).toBe(false));

      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.showTemplates).toBe(true);
      expect(result.current.showAssistantPanel).toBe(true);
    });

    it('should reset edge type to bezier', async () => {
      mockedInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_settings') {
          return Promise.resolve({
            edge_type: 'straight',
          });
        }
        return Promise.resolve(undefined);
      });

      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.edgeType).toBe('straight'));

      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.edgeType).toBe('bezier');
    });
  });
});
