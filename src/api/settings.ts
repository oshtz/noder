/**
 * Settings API Client
 *
 * Centralized module for settings persistence operations via Tauri.
 * Provides consistent error handling and logging for settings CRUD.
 */

import { invoke } from '../types/tauri';
import { logApiError } from '../utils/errorLogger';
import type { AppSettings, FloatingButtonPosition } from '../types/tauri';

// =============================================================================
// Types
// =============================================================================

/** API provider names */
export type ApiProvider = 'openai' | 'openrouter' | 'anthropic' | 'replicate' | 'gemini';

/** Node types that have default models */
export type NodeType = 'text' | 'image' | 'video' | 'audio' | 'upscaler';

/** Settings key for API providers */
type ApiKeySettingKey =
  | 'openai_api_key'
  | 'openrouter_api_key'
  | 'anthropic_api_key'
  | 'replicate_api_key'
  | 'gemini_api_key';

/** Settings key for default models */
type DefaultModelSettingKey =
  | 'default_text_model'
  | 'default_image_model'
  | 'default_video_model'
  | 'default_audio_model'
  | 'default_upscaler_model';

/** Extended settings with all possible keys */
export interface Settings extends AppSettings {
  // Local defaults not stored in Tauri
  ollama_base_url?: string | null;
  lm_studio_base_url?: string | null;
  show_editor_toolbar?: boolean | null;
}

/** Provider availability map */
export interface ConfiguredProviders {
  openai: boolean;
  openrouter: boolean;
  anthropic: boolean;
  replicate: boolean;
  gemini: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: Settings = {
  // API Keys
  openai_api_key: null,
  openrouter_api_key: null,
  anthropic_api_key: null,
  replicate_api_key: null,
  gemini_api_key: null,

  // Service URLs
  ollama_base_url: 'http://localhost:11434',
  lm_studio_base_url: 'http://localhost:1234',

  // Paths
  default_save_location: 'Downloads/noder',

  // UI Preferences
  show_templates: true,
  show_assistant_panel: true,
  show_editor_toolbar: true,
  run_button_unlocked: false,
  run_button_position: { x: 20, y: 20 } as FloatingButtonPosition,

  // Default Models
  default_text_model: 'openai/gpt-4o-mini',
  default_image_model: 'black-forest-labs/flux-2-klein-4b',
  default_video_model: 'lightricks/ltx-2-fast',
  default_audio_model: 'google/lyria-2',
  default_upscaler_model: 'recraft-ai/recraft-crisp-upscale',

  // Edge Appearance
  edge_type: 'bezier',
};

/** Map of API provider to settings key */
const API_KEY_MAP: Record<ApiProvider, ApiKeySettingKey> = {
  openai: 'openai_api_key',
  openrouter: 'openrouter_api_key',
  anthropic: 'anthropic_api_key',
  replicate: 'replicate_api_key',
  gemini: 'gemini_api_key',
};

/** Map of node type to default model settings key */
const MODEL_KEY_MAP: Record<NodeType, DefaultModelSettingKey> = {
  text: 'default_text_model',
  image: 'default_image_model',
  video: 'default_video_model',
  audio: 'default_audio_model',
  upscaler: 'default_upscaler_model',
};

// =============================================================================
// Functions
// =============================================================================

/**
 * Load all settings from persistent storage
 *
 * @returns Settings object merged with defaults
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const settings = await invoke('load_settings');
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'load_settings');
    console.error('Failed to load settings:', error);
    // Return defaults on error so app can continue
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save all settings to persistent storage
 *
 * @param settings - Settings object to save
 */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await invoke('save_settings', { settings });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logApiError(err, 'save_settings');
    console.error('Failed to save settings:', error);
    throw err;
  }
}

/**
 * Load a single setting by key
 *
 * @param key - Setting key (snake_case)
 * @returns Setting value or default
 */
export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const settings = await loadSettings();
  return settings[key] ?? DEFAULT_SETTINGS[key] ?? null;
}

/**
 * Update a single setting
 *
 * @param key - Setting key (snake_case)
 * @param value - New value
 */
export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  const settings = await loadSettings();
  settings[key] = value;
  await saveSettings(settings);
}

/**
 * Update multiple settings at once
 *
 * @param updates - Object with key-value pairs to update
 */
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const settings = await loadSettings();
  Object.assign(settings, updates);
  await saveSettings(settings);
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  await saveSettings(DEFAULT_SETTINGS);
}

/**
 * Get API key by provider name
 *
 * @param provider - Provider name (openai, openrouter, anthropic, replicate, gemini)
 * @returns API key or null
 */
export async function getApiKey(provider: ApiProvider): Promise<string | null> {
  const key = API_KEY_MAP[provider.toLowerCase() as ApiProvider];
  if (!key) {
    return null;
  }

  const value = await getSetting(key);
  return value ?? null;
}

/**
 * Set API key for a provider
 *
 * @param provider - Provider name
 * @param apiKey - API key value
 */
export async function setApiKey(provider: ApiProvider, apiKey: string | null): Promise<void> {
  const key = API_KEY_MAP[provider.toLowerCase() as ApiProvider];
  if (!key) {
    throw new Error(`Unknown API provider: ${provider}`);
  }

  await setSetting(key, apiKey);
}

/**
 * Get default model for a node type
 *
 * @param nodeType - Node type (text, image, video, audio, upscaler)
 * @returns Default model identifier or null
 */
export async function getDefaultModel(nodeType: NodeType): Promise<string | null> {
  const key = MODEL_KEY_MAP[nodeType.toLowerCase() as NodeType];
  if (!key) {
    return null;
  }

  const value = await getSetting(key);
  return value ?? null;
}

/**
 * Set default model for a node type
 *
 * @param nodeType - Node type
 * @param model - Model identifier
 */
export async function setDefaultModel(nodeType: NodeType, model: string | null): Promise<void> {
  const key = MODEL_KEY_MAP[nodeType.toLowerCase() as NodeType];
  if (!key) {
    throw new Error(`Unknown node type: ${nodeType}`);
  }

  await setSetting(key, model);
}

/**
 * Check if a required API key is configured
 *
 * @param provider - Provider name
 * @returns True if API key is set
 */
export async function hasApiKey(provider: ApiProvider): Promise<boolean> {
  const key = await getApiKey(provider);
  return !!key && key.trim().length > 0;
}

/**
 * Get all configured API keys (for checking which services are available)
 *
 * @returns Object with provider names as keys and boolean availability
 */
export async function getConfiguredProviders(): Promise<ConfiguredProviders> {
  const settings = await loadSettings();
  return {
    openai: !!settings.openai_api_key,
    openrouter: !!settings.openrouter_api_key,
    anthropic: !!settings.anthropic_api_key,
    replicate: !!settings.replicate_api_key,
    gemini: !!settings.gemini_api_key,
  };
}
