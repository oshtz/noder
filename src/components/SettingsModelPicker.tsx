import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTextModels, getImageModels } from '../utils/openrouterModelCache';
import { getModels as getReplicateModels } from '../utils/replicateModelListCache';
import {
  getImageModels as getFalImageModels,
  getVideoModels as getFalVideoModels,
  getAudioModels as getFalAudioModels,
} from '../utils/falModelCache';
import type { TextProvider, MediaProvider } from '../stores/useSettingsStore';
import './SettingsModelPicker.css';

// =============================================================================
// Types
// =============================================================================

interface UnifiedModel {
  id: string;
  name: string;
  description?: string;
  source: string;
}

type ModelType = 'text' | 'image' | 'video' | 'audio' | 'upscaler';

interface SettingsModelPickerProps {
  value: string;
  onChange: (value: string) => void;
  provider: TextProvider | MediaProvider;
  modelType: ModelType;
  placeholder?: string;
}

// Keywords for filtering Replicate models by type
// Since Replicate doesn't provide a type field, we filter by name/description keywords
const MODEL_TYPE_KEYWORDS: Record<ModelType, string[]> = {
  text: [
    'llama',
    'gpt',
    'mistral',
    'claude',
    'gemma',
    'phi',
    'qwen',
    'yi',
    'vicuna',
    'wizard',
    'falcon',
    'mpt',
    'dolly',
    'llm',
    'chat',
    'instruct',
    'language',
    'text-generation',
    'completion',
    'codellama',
    'deepseek',
    'solar',
    'openchat',
  ],
  image: [
    'flux',
    'stable-diffusion',
    'sdxl',
    'dall-e',
    'midjourney',
    'kandinsky',
    'image',
    'img2img',
    'controlnet',
    'lora',
    'dreambooth',
    'inpainting',
    'outpainting',
    'txt2img',
    'text-to-image',
    'image-generation',
    'diffusion',
    'juggernaut',
    'photon',
    'playground',
    'realvisxl',
    'animagine',
    'pony',
    'proteus',
    'dreamshaper',
    'epicrealism',
    'deliberate',
    'openjourney',
  ],
  video: [
    'video',
    'animate',
    'motion',
    'film',
    'wan',
    'ltx',
    'mochi',
    'kling',
    'runway',
    'pika',
    'gen-2',
    'text-to-video',
    'image-to-video',
    'i2v',
    'animatediff',
    'svd',
    'stable-video',
    'zeroscope',
    'modelscope',
    'cogvideo',
    'luma',
    'minimax',
    'hunyuan',
  ],
  audio: [
    'audio',
    'music',
    'speech',
    'voice',
    'whisper',
    'bark',
    'musicgen',
    'audiogen',
    'text-to-speech',
    'tts',
    'stt',
    'speech-to-text',
    'tortoise',
    'eleven',
    'coqui',
    'rvc',
    'so-vits',
    'xtts',
    'parler',
    'f5-tts',
    'kokoro',
    'sound',
    'singing',
  ],
  upscaler: [
    'upscale',
    'upscaler',
    'esrgan',
    'real-esrgan',
    'enhance',
    'super-resolution',
    'sr',
    '4x',
    '2x',
    'restoration',
    'gfpgan',
    'codeformer',
    'face-restore',
    'clarity',
    'tile',
    'swinir',
    'supir',
    'aura-sr',
  ],
};

/**
 * Filter models by type using keyword matching
 */
function filterModelsByType(models: UnifiedModel[], modelType: ModelType): UnifiedModel[] {
  const keywords = MODEL_TYPE_KEYWORDS[modelType];
  if (!keywords || keywords.length === 0) return models;

  return models.filter((model) => {
    const searchText = `${model.id} ${model.name} ${model.description || ''}`.toLowerCase();
    return keywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
  });
}

// =============================================================================
// Component
// =============================================================================

export const SettingsModelPicker: React.FC<SettingsModelPickerProps> = ({
  value,
  onChange,
  provider,
  modelType,
  placeholder = 'Select or search for a model...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [models, setModels] = useState<UnifiedModel[]>([]);
  const [filteredModels, setFilteredModels] = useState<UnifiedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef(false);

  // Load models based on provider and model type
  const loadModels = useCallback(async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    setLoading(true);
    setError(null);

    try {
      let loadedModels: UnifiedModel[] = [];

      if (modelType === 'text') {
        if (provider === 'openrouter') {
          const { models: orModels } = await getTextModels(null);
          loadedModels = orModels.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            source: 'openrouter',
          }));
        } else if (provider === 'replicate') {
          const { models: repModels } = await getReplicateModels(null, null);
          const allModels = repModels.map((m) => ({
            id: `${m.owner}/${m.name}`,
            name: `${m.owner}/${m.name}`,
            description: m.description || undefined,
            source: 'replicate',
          }));
          // Filter by type using keywords
          loadedModels = filterModelsByType(allModels, 'text');
        }
        // Other text providers (OpenAI, Anthropic, etc.) need manual entry
      } else if (modelType === 'image') {
        if (provider === 'replicate') {
          const { models: repModels } = await getReplicateModels(
            null, // Fetch all public models
            null
          );
          const allModels = repModels.map((m) => ({
            id: `${m.owner}/${m.name}`,
            name: `${m.owner}/${m.name}`,
            description: m.description || undefined,
            source: 'replicate',
          }));
          // Filter by type using keywords
          loadedModels = filterModelsByType(allModels, 'image');
        } else if (provider === 'fal') {
          const { models: falModels } = await getFalImageModels(null);
          loadedModels = falModels.map((m) => ({
            id: m.endpoint_id,
            name: m.name || m.endpoint_id,
            description: m.description || undefined,
            source: 'fal',
          }));
        } else if (provider === 'openrouter') {
          const { models: orModels } = await getImageModels(null);
          loadedModels = orModels.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            source: 'openrouter',
          }));
        }
      } else if (modelType === 'video') {
        if (provider === 'replicate') {
          const { models: repModels } = await getReplicateModels(
            null, // Fetch all public models
            null
          );
          const allModels = repModels.map((m) => ({
            id: `${m.owner}/${m.name}`,
            name: `${m.owner}/${m.name}`,
            description: m.description || undefined,
            source: 'replicate',
          }));
          // Filter by type using keywords
          loadedModels = filterModelsByType(allModels, 'video');
        } else if (provider === 'fal') {
          const { models: falModels } = await getFalVideoModels(null);
          loadedModels = falModels.map((m) => ({
            id: m.endpoint_id,
            name: m.name || m.endpoint_id,
            description: m.description || undefined,
            source: 'fal',
          }));
        }
      } else if (modelType === 'audio') {
        if (provider === 'replicate') {
          const { models: repModels } = await getReplicateModels(
            null, // Fetch all public models
            null
          );
          const allModels = repModels.map((m) => ({
            id: `${m.owner}/${m.name}`,
            name: `${m.owner}/${m.name}`,
            description: m.description || undefined,
            source: 'replicate',
          }));
          // Filter by type using keywords
          loadedModels = filterModelsByType(allModels, 'audio');
        } else if (provider === 'fal') {
          const { models: falModels } = await getFalAudioModels(null);
          loadedModels = falModels.map((m) => ({
            id: m.endpoint_id,
            name: m.name || m.endpoint_id,
            description: m.description || undefined,
            source: 'fal',
          }));
        }
      } else if (modelType === 'upscaler') {
        // Upscaler - Replicate only for now (Fal doesn't have dedicated upscaler category)
        if (provider === 'replicate') {
          const { models: repModels } = await getReplicateModels(
            null, // Fetch all public models
            null
          );
          const allModels = repModels.map((m) => ({
            id: `${m.owner}/${m.name}`,
            name: `${m.owner}/${m.name}`,
            description: m.description || undefined,
            source: 'replicate',
          }));
          // Filter by type using keywords
          loadedModels = filterModelsByType(allModels, 'upscaler');
        }
        // Fal upscaler models would need manual entry
      }

      setModels(loadedModels);
    } catch (err) {
      console.error('[SettingsModelPicker] Failed to load models:', err);
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [provider, modelType]);

  // Load models when dropdown opens
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      loadModels();
    }
  }, [isOpen, loadModels]);

  // Reset loaded state when provider changes
  useEffect(() => {
    hasLoadedRef.current = false;
    setModels([]);
  }, [provider]);

  // Filter models based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredModels(models);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = models.filter(
      (m) =>
        m.id.toLowerCase().includes(term) ||
        m.name.toLowerCase().includes(term) ||
        (m.description && m.description.toLowerCase().includes(term))
    );
    setFilteredModels(filtered);
  }, [searchTerm, models]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (model: UnifiedModel) => {
    onChange(model.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    // Allow manual input when dropdown is closed
    if (!isOpen) {
      onChange(newValue);
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
    inputRef.current?.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm) {
      onChange(searchTerm);
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const displayValue = isOpen ? searchTerm : value || '';

  return (
    <div className="settings-model-picker" ref={dropdownRef}>
      <div className="settings-model-picker-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="settings-model-picker-input"
          value={displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="settings-model-picker-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle model list"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d={isOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="settings-model-picker-dropdown">
          {loading && <div className="settings-model-picker-loading">Loading models...</div>}

          {error && <div className="settings-model-picker-error">{error}</div>}

          {!loading && !error && filteredModels.length === 0 && (
            <div className="settings-model-picker-empty">
              {searchTerm
                ? 'No models found. Press Enter to use custom model ID.'
                : models.length === 0
                  ? 'No models available for this provider'
                  : 'Start typing to search...'}
            </div>
          )}

          {!loading && !error && filteredModels.length > 0 && (
            <div className="settings-model-picker-list">
              {filteredModels.slice(0, 50).map((model) => (
                <div
                  key={model.id}
                  className="settings-model-picker-item"
                  onClick={() => handleSelect(model)}
                >
                  <div className="settings-model-picker-item-name">{model.id}</div>
                  {model.description && (
                    <div className="settings-model-picker-item-description">
                      {model.description}
                    </div>
                  )}
                </div>
              ))}
              {filteredModels.length > 50 && (
                <div className="settings-model-picker-more">
                  + {filteredModels.length - 50} more (refine search)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsModelPicker;
