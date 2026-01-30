import React, { useState, useEffect, useRef, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import {
  getModels,
  unsubscribe as unsubscribeReplicate,
  type OnUpdateCallback as ReplicateOnUpdateCallback,
} from '../utils/replicateModelListCache';
import {
  getImageModels as getOpenRouterImageModels,
  unsubscribe as unsubscribeOpenRouter,
} from '../utils/openrouterModelCache';
import {
  getImageModels as getFalImageModels,
  getVideoModels as getFalVideoModels,
  getAudioModels as getFalAudioModels,
  unsubscribe as unsubscribeFal,
  type OnFalUpdateCallback,
} from '../utils/falModelCache';
import { SkeletonModelPicker } from './Skeleton';
import {
  ReplicateIcon,
  OpenRouterIcon,
  FalIcon,
  getProviderIcon,
} from '../constants/providerIcons';
import type { OpenRouterModel } from '../api/openrouter';
import type { FalModel, FalModelCategory } from '../api/fal';
import type { ReplicateModel } from '../types/tauri';
import './ReplicateModelPicker.css';

// =============================================================================
// Types
// =============================================================================

/** Model source type */
export type ModelSource = 'replicate' | 'openrouter' | 'fal' | 'all';

/** Unified model interface */
interface UnifiedModel {
  id: string;
  owner: string;
  name: string;
  description?: string;
  source: 'replicate' | 'openrouter' | 'fal';
}

/** Model type for fal.ai category selection */
type FalModelType = 'image' | 'video' | 'audio';

interface ModelPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Which source(s) to show models from */
  source?: ModelSource;
  /** Collection slug for Replicate models */
  collectionSlug?: string | string[] | null;
  /** Model type for fal.ai (determines which category to load) */
  falModelType?: FalModelType;
}

// =============================================================================
// Helper Functions
// =============================================================================

/** Convert Replicate model to unified format */
function toUnifiedModel(model: ReplicateModel, source: 'replicate'): UnifiedModel;
function toUnifiedModel(model: OpenRouterModel, source: 'openrouter'): UnifiedModel;
function toUnifiedModel(model: FalModel, source: 'fal'): UnifiedModel;
function toUnifiedModel(
  model: ReplicateModel | OpenRouterModel | FalModel,
  source: 'replicate' | 'openrouter' | 'fal'
): UnifiedModel {
  if (source === 'replicate') {
    const m = model as ReplicateModel;
    return {
      id: `${m.owner}/${m.name}`,
      owner: m.owner,
      name: m.name,
      description: m.description ?? undefined,
      source: 'replicate',
    };
  } else if (source === 'openrouter') {
    const m = model as OpenRouterModel;
    const [owner, ...nameParts] = m.id.split('/');
    return {
      id: m.id,
      owner: owner || m.id,
      name: nameParts.join('/') || m.name,
      description: m.description,
      source: 'openrouter',
    };
  } else {
    // fal
    const m = model as FalModel;
    const [owner, ...nameParts] = m.endpoint_id.split('/');
    return {
      id: m.endpoint_id,
      owner: owner || 'fal',
      name: nameParts.join('/') || m.name || m.endpoint_id,
      description: m.description,
      source: 'fal',
    };
  }
}

// =============================================================================
// ModelPicker Component
// =============================================================================

/**
 * A searchable dropdown for selecting models from Replicate and/or OpenRouter.
 * Uses cached model lists for instant display, with background refresh.
 */
export const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  placeholder = 'Select or search for a model...',
  source = 'all',
  collectionSlug = null,
  falModelType = 'image',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [models, setModels] = useState<UnifiedModel[]>([]);
  const [filteredModels, setFilteredModels] = useState<UnifiedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ModelSource>(source);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef<{ replicate: boolean; openrouter: boolean; fal: boolean }>({
    replicate: false,
    openrouter: false,
    fal: false,
  });

  // Handle Replicate cache updates
  const handleReplicateCacheUpdate: ReplicateOnUpdateCallback = useCallback((updatedModels) => {
    console.log('[ModelPicker] Replicate cache updated with', updatedModels.length, 'models');
    const unified = updatedModels.map((m) => toUnifiedModel(m, 'replicate'));
    setModels((prev) => {
      const otherModels = prev.filter((m) => m.source !== 'replicate');
      return [...unified, ...otherModels];
    });
  }, []);

  // Handle OpenRouter cache updates
  const handleOpenRouterCacheUpdate = useCallback((updatedModels: OpenRouterModel[]) => {
    console.log('[ModelPicker] OpenRouter cache updated with', updatedModels.length, 'models');
    const unified = updatedModels.map((m) => toUnifiedModel(m, 'openrouter'));
    setModels((prev) => {
      const otherModels = prev.filter((m) => m.source !== 'openrouter');
      return [...otherModels, ...unified];
    });
  }, []);

  // Handle Fal cache updates
  const handleFalCacheUpdate: OnFalUpdateCallback = useCallback((updatedModels) => {
    console.log('[ModelPicker] Fal cache updated with', updatedModels.length, 'models');
    const unified = updatedModels.map((m) => toUnifiedModel(m, 'fal'));
    setModels((prev) => {
      const otherModels = prev.filter((m) => m.source !== 'fal');
      return [...otherModels, ...unified];
    });
  }, []);

  // Load models from sources
  useEffect(() => {
    const loadModels = async (): Promise<void> => {
      if (!isOpen) return;

      const shouldLoadReplicate =
        (source === 'replicate' || source === 'all') && !hasLoadedRef.current.replicate;
      const shouldLoadOpenRouter =
        (source === 'openrouter' || source === 'all') && !hasLoadedRef.current.openrouter;
      const shouldLoadFal = (source === 'fal' || source === 'all') && !hasLoadedRef.current.fal;

      if (!shouldLoadReplicate && !shouldLoadOpenRouter && !shouldLoadFal) return;

      setLoading(true);
      setError(null);

      const allModels: UnifiedModel[] = [];

      try {
        // Load Replicate models
        if (shouldLoadReplicate) {
          hasLoadedRef.current.replicate = true;
          try {
            const { models: replicateModels } = await getModels(
              collectionSlug,
              handleReplicateCacheUpdate
            );
            const unified = replicateModels.map((m) => toUnifiedModel(m, 'replicate'));
            allModels.push(...unified);
            console.log('[ModelPicker] Loaded', replicateModels.length, 'Replicate models');
          } catch (err) {
            console.error('[ModelPicker] Error loading Replicate models:', err);
          }
        }

        // Load OpenRouter models
        if (shouldLoadOpenRouter) {
          hasLoadedRef.current.openrouter = true;
          try {
            const { models: openrouterModels } = await getOpenRouterImageModels(
              handleOpenRouterCacheUpdate
            );
            const unified = openrouterModels.map((m) => toUnifiedModel(m, 'openrouter'));
            allModels.push(...unified);
            console.log('[ModelPicker] Loaded', openrouterModels.length, 'OpenRouter models');
          } catch (err) {
            console.error('[ModelPicker] Error loading OpenRouter models:', err);
          }
        }

        // Load Fal models
        if (shouldLoadFal) {
          hasLoadedRef.current.fal = true;
          try {
            let falModels: FalModel[] = [];
            if (falModelType === 'image') {
              const result = await getFalImageModels(handleFalCacheUpdate);
              falModels = result.models;
            } else if (falModelType === 'video') {
              const result = await getFalVideoModels(handleFalCacheUpdate);
              falModels = result.models;
            } else if (falModelType === 'audio') {
              const result = await getFalAudioModels(handleFalCacheUpdate);
              falModels = result.models;
            }
            const unified = falModels.map((m) => toUnifiedModel(m, 'fal'));
            allModels.push(...unified);
            console.log('[ModelPicker] Loaded', falModels.length, 'Fal models');
          } catch (err) {
            console.error('[ModelPicker] Error loading Fal models:', err);
          }
        }

        // Merge with existing models
        setModels((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newModels = allModels.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newModels];
        });
      } catch (err) {
        console.error('[ModelPicker] Error loading models:', err);
        setError('Failed to load models. Using manual input.');
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [
    isOpen,
    source,
    collectionSlug,
    falModelType,
    handleReplicateCacheUpdate,
    handleOpenRouterCacheUpdate,
    handleFalCacheUpdate,
  ]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      unsubscribeReplicate(collectionSlug, handleReplicateCacheUpdate as ReplicateOnUpdateCallback);
      unsubscribeOpenRouter('image', handleOpenRouterCacheUpdate);
      // Fal unsubscribe based on model type
      const falCategory: FalModelCategory[] =
        falModelType === 'image'
          ? ['text-to-image', 'image-to-image']
          : falModelType === 'video'
            ? ['text-to-video', 'image-to-video']
            : ['text-to-audio', 'text-to-speech'];
      unsubscribeFal(falCategory, handleFalCacheUpdate as OnFalUpdateCallback);
    };
  }, [
    collectionSlug,
    falModelType,
    handleReplicateCacheUpdate,
    handleOpenRouterCacheUpdate,
    handleFalCacheUpdate,
  ]);

  // Filter models based on search term and active source
  useEffect(() => {
    let filtered = models;

    // Filter by source if not "all"
    if (activeSource !== 'all') {
      filtered = filtered.filter((m) => m.source === activeSource);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((model) => {
        const fullName = model.id.toLowerCase();
        const description = (model.description || '').toLowerCase();
        return fullName.includes(term) || description.includes(term);
      });
    }

    setFilteredModels(filtered);
  }, [searchTerm, models, activeSource]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (model: UnifiedModel): void => {
    onChange(model.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    setSearchTerm(newValue);

    // Allow manual input - update parent immediately
    if (!isOpen) {
      onChange(newValue);
    }
  };

  const handleInputClick = (): void => {
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && searchTerm) {
      onChange(searchTerm);
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const displayValue = searchTerm || value || '';

  // Count models by source for tabs
  const replicateCount = models.filter((m) => m.source === 'replicate').length;
  const openrouterCount = models.filter((m) => m.source === 'openrouter').length;
  const falCount = models.filter((m) => m.source === 'fal').length;
  const showSourceTabs =
    source === 'all' && (replicateCount > 0 || openrouterCount > 0 || falCount > 0);

  return (
    <div className="replicate-model-picker" ref={dropdownRef}>
      <div className="model-picker-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="model-picker-input"
          value={displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button type="button" className="model-picker-toggle" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '▲' : '▼'}
        </button>
      </div>

      {isOpen && (
        <div className="model-picker-dropdown nowheel" onWheel={(e) => e.stopPropagation()}>
          {/* Source filter tabs */}
          {showSourceTabs && (
            <div className="model-picker-tabs">
              <button
                type="button"
                className={`model-picker-tab ${activeSource === 'all' ? 'is-active' : ''}`}
                onClick={() => setActiveSource('all')}
              >
                All ({models.length})
              </button>
              {replicateCount > 0 && (
                <button
                  type="button"
                  className={`model-picker-tab ${activeSource === 'replicate' ? 'is-active' : ''}`}
                  onClick={() => setActiveSource('replicate')}
                >
                  <ReplicateIcon /> Replicate ({replicateCount})
                </button>
              )}
              {openrouterCount > 0 && (
                <button
                  type="button"
                  className={`model-picker-tab ${activeSource === 'openrouter' ? 'is-active' : ''}`}
                  onClick={() => setActiveSource('openrouter')}
                >
                  <OpenRouterIcon /> OpenRouter ({openrouterCount})
                </button>
              )}
              {falCount > 0 && (
                <button
                  type="button"
                  className={`model-picker-tab ${activeSource === 'fal' ? 'is-active' : ''}`}
                  onClick={() => setActiveSource('fal')}
                >
                  <FalIcon /> Fal ({falCount})
                </button>
              )}
            </div>
          )}

          {loading && <SkeletonModelPicker />}

          {error && <div className="model-picker-error">{error}</div>}

          {!loading && !error && filteredModels.length === 0 && (
            <div className="model-picker-empty">
              {searchTerm
                ? 'No models found. Press Enter to use custom model ID.'
                : 'No models available'}
            </div>
          )}

          {!loading && !error && filteredModels.length > 0 && (
            <div className="model-picker-list nowheel" onWheel={(e) => e.stopPropagation()}>
              {filteredModels.slice(0, 50).map((model) => {
                const OwnerIcon = getProviderIcon(model.owner);
                const SourceIcon =
                  model.source === 'replicate'
                    ? ReplicateIcon
                    : model.source === 'fal'
                      ? FalIcon
                      : OpenRouterIcon;
                const sourceClass = `source-${model.source}`;

                return (
                  <div
                    key={`${model.source}:${model.id}`}
                    className="model-picker-item"
                    onClick={() => handleSelect(model)}
                  >
                    <div className="model-picker-item-header">
                      <span className={`model-picker-source-icon ${sourceClass}`}>
                        <SourceIcon />
                      </span>
                      <span className="model-picker-item-name">{model.id}</span>
                      {OwnerIcon && (
                        <span className="model-picker-origin-badge">
                          <OwnerIcon />
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <div className="model-picker-item-description">{model.description}</div>
                    )}
                  </div>
                );
              })}
              {filteredModels.length > 50 && (
                <div className="model-picker-more">
                  + {filteredModels.length - 50} more models (refine search)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** @deprecated Use ModelPicker instead */
export const ReplicateModelPicker = ModelPicker;

export default ModelPicker;
