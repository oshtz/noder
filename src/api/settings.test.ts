/**
 * Tests for settings API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  getSetting,
  setSetting,
  updateSettings,
  resetSettings,
  getApiKey,
  setApiKey,
  getDefaultModel,
  setDefaultModel,
  hasApiKey,
  getConfiguredProviders,
  DEFAULT_SETTINGS,
} from './settings';
import { invoke } from '../types/tauri';

// Mock the invoke function
vi.mock('../types/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock errorLogger to prevent console noise
vi.mock('../utils/errorLogger', () => ({
  logApiError: vi.fn(),
}));

describe('settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DEFAULT_SETTINGS', () => {
    it('has expected default values', () => {
      expect(DEFAULT_SETTINGS.openai_api_key).toBeNull();
      expect(DEFAULT_SETTINGS.replicate_api_key).toBeNull();
      expect(DEFAULT_SETTINGS.show_templates).toBe(true);
      expect(DEFAULT_SETTINGS.show_assistant_panel).toBe(true);
      expect(DEFAULT_SETTINGS.default_text_model).toBe('openai/gpt-4o-mini');
      expect(DEFAULT_SETTINGS.default_image_model).toBe('black-forest-labs/flux-2-klein-4b');
      expect(DEFAULT_SETTINGS.edge_type).toBe('bezier');
    });
  });

  describe('loadSettings', () => {
    it('loads settings and merges with defaults', async () => {
      const savedSettings = {
        openai_api_key: 'sk-test-key',
        show_templates: false,
      };
      vi.mocked(invoke).mockResolvedValue(savedSettings);

      const result = await loadSettings();

      expect(invoke).toHaveBeenCalledWith('load_settings');
      expect(result.openai_api_key).toBe('sk-test-key');
      expect(result.show_templates).toBe(false);
      // Should have defaults for unset values
      expect(result.default_text_model).toBe('openai/gpt-4o-mini');
    });

    it('returns defaults on error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Load failed'));

      const result = await loadSettings();

      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('saveSettings', () => {
    it('saves settings via invoke', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const settings = { ...DEFAULT_SETTINGS, openai_api_key: 'new-key' };
      await saveSettings(settings);

      expect(invoke).toHaveBeenCalledWith('save_settings', { settings });
    });

    it('throws error on failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Save failed'));

      await expect(saveSettings(DEFAULT_SETTINGS)).rejects.toThrow('Save failed');
    });
  });

  describe('getSetting', () => {
    it('gets a specific setting', async () => {
      vi.mocked(invoke).mockResolvedValue({ openai_api_key: 'test-key' });

      const value = await getSetting('openai_api_key');

      expect(value).toBe('test-key');
    });

    it('returns default when setting is null', async () => {
      vi.mocked(invoke).mockResolvedValue({});

      const value = await getSetting('default_text_model');

      expect(value).toBe('openai/gpt-4o-mini');
    });
  });

  describe('setSetting', () => {
    it('updates a single setting', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce({}) // loadSettings
        .mockResolvedValueOnce(undefined); // saveSettings

      await setSetting('openai_api_key', 'new-api-key');

      expect(invoke).toHaveBeenCalledTimes(2);
      expect(invoke).toHaveBeenLastCalledWith(
        'save_settings',
        expect.objectContaining({
          settings: expect.objectContaining({ openai_api_key: 'new-api-key' }),
        })
      );
    });
  });

  describe('updateSettings', () => {
    it('updates multiple settings at once', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce({ openai_api_key: 'old-key' }) // loadSettings
        .mockResolvedValueOnce(undefined); // saveSettings

      await updateSettings({
        openai_api_key: 'new-key',
        show_templates: false,
      });

      expect(invoke).toHaveBeenLastCalledWith(
        'save_settings',
        expect.objectContaining({
          settings: expect.objectContaining({
            openai_api_key: 'new-key',
            show_templates: false,
          }),
        })
      );
    });
  });

  describe('resetSettings', () => {
    it('saves default settings', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await resetSettings();

      expect(invoke).toHaveBeenCalledWith('save_settings', { settings: DEFAULT_SETTINGS });
    });
  });

  describe('getApiKey', () => {
    it('gets API key for valid provider', async () => {
      vi.mocked(invoke).mockResolvedValue({ openai_api_key: 'sk-openai' });

      const key = await getApiKey('openai');

      expect(key).toBe('sk-openai');
    });

    it('returns null for unknown provider', async () => {
      const key = await getApiKey('unknown' as any);

      expect(key).toBeNull();
    });

    it('returns null when key is not set', async () => {
      vi.mocked(invoke).mockResolvedValue({});

      const key = await getApiKey('openai');

      expect(key).toBeNull();
    });

    it('handles case insensitive provider names', async () => {
      vi.mocked(invoke).mockResolvedValue({ replicate_api_key: 'r8_test' });

      const key = await getApiKey('REPLICATE' as any);

      expect(key).toBe('r8_test');
    });
  });

  describe('setApiKey', () => {
    it('sets API key for valid provider', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce({}) // loadSettings
        .mockResolvedValueOnce(undefined); // saveSettings

      await setApiKey('replicate', 'r8_new_key');

      expect(invoke).toHaveBeenLastCalledWith(
        'save_settings',
        expect.objectContaining({
          settings: expect.objectContaining({ replicate_api_key: 'r8_new_key' }),
        })
      );
    });

    it('throws for unknown provider', async () => {
      await expect(setApiKey('unknown' as any, 'key')).rejects.toThrow('Unknown API provider');
    });

    it('allows setting key to null', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce({ openai_api_key: 'old-key' })
        .mockResolvedValueOnce(undefined);

      await setApiKey('openai', null);

      expect(invoke).toHaveBeenLastCalledWith(
        'save_settings',
        expect.objectContaining({
          settings: expect.objectContaining({ openai_api_key: null }),
        })
      );
    });
  });

  describe('getDefaultModel', () => {
    it('gets default model for valid node type', async () => {
      vi.mocked(invoke).mockResolvedValue({ default_image_model: 'custom/model' });

      const model = await getDefaultModel('image');

      expect(model).toBe('custom/model');
    });

    it('returns null for unknown node type', async () => {
      const model = await getDefaultModel('unknown' as any);

      expect(model).toBeNull();
    });

    it('returns default when not customized', async () => {
      vi.mocked(invoke).mockResolvedValue({});

      const model = await getDefaultModel('text');

      expect(model).toBe('openai/gpt-4o-mini');
    });
  });

  describe('setDefaultModel', () => {
    it('sets default model for valid node type', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({}).mockResolvedValueOnce(undefined);

      await setDefaultModel('video', 'custom/video-model');

      expect(invoke).toHaveBeenLastCalledWith(
        'save_settings',
        expect.objectContaining({
          settings: expect.objectContaining({ default_video_model: 'custom/video-model' }),
        })
      );
    });

    it('throws for unknown node type', async () => {
      await expect(setDefaultModel('unknown' as any, 'model')).rejects.toThrow('Unknown node type');
    });
  });

  describe('hasApiKey', () => {
    it('returns true when key is set', async () => {
      vi.mocked(invoke).mockResolvedValue({ anthropic_api_key: 'sk-ant-test' });

      const has = await hasApiKey('anthropic');

      expect(has).toBe(true);
    });

    it('returns false when key is null', async () => {
      vi.mocked(invoke).mockResolvedValue({ anthropic_api_key: null });

      const has = await hasApiKey('anthropic');

      expect(has).toBe(false);
    });

    it('returns false when key is empty string', async () => {
      vi.mocked(invoke).mockResolvedValue({ anthropic_api_key: '   ' });

      const has = await hasApiKey('anthropic');

      expect(has).toBe(false);
    });

    it('returns false for unknown provider', async () => {
      const has = await hasApiKey('unknown' as any);

      expect(has).toBe(false);
    });
  });

  describe('getConfiguredProviders', () => {
    it('returns configured status for all providers', async () => {
      vi.mocked(invoke).mockResolvedValue({
        openai_api_key: 'sk-openai',
        openrouter_api_key: null,
        anthropic_api_key: 'sk-ant',
        replicate_api_key: '',
        gemini_api_key: 'gemini-key',
      });

      const providers = await getConfiguredProviders();

      expect(providers.openai).toBe(true);
      expect(providers.openrouter).toBe(false);
      expect(providers.anthropic).toBe(true);
      expect(providers.replicate).toBe(false);
      expect(providers.gemini).toBe(true);
    });

    it('returns all false when no keys configured', async () => {
      vi.mocked(invoke).mockResolvedValue({});

      const providers = await getConfiguredProviders();

      expect(providers.openai).toBe(false);
      expect(providers.openrouter).toBe(false);
      expect(providers.anthropic).toBe(false);
      expect(providers.replicate).toBe(false);
      expect(providers.gemini).toBe(false);
    });
  });
});
