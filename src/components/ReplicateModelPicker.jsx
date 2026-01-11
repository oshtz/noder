import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getModels, unsubscribe } from '../utils/replicateModelListCache';
import './ReplicateModelPicker.css';

/**
 * A searchable dropdown for selecting Replicate models
 * Uses cached model lists for instant display, with background refresh
 */
export const ReplicateModelPicker = ({
  value,
  onChange,
  placeholder = "Select or search for a model...",
  collectionSlug = null // Optional: filter by collection (e.g., "text-to-image", "text-generation")
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Handle cache updates (when background refresh completes)
  const handleCacheUpdate = useCallback((updatedModels) => {
    console.log('[ModelPicker] Cache updated with', updatedModels.length, 'models');
    setModels(updatedModels);
    setFilteredModels(prevFiltered => {
      // Re-apply current search filter to new models
      if (!searchTerm) return updatedModels;
      const term = searchTerm.toLowerCase();
      return updatedModels.filter(model => {
        const fullName = `${model.owner}/${model.name}`.toLowerCase();
        const description = (model.description || '').toLowerCase();
        return fullName.includes(term) || description.includes(term);
      });
    });
  }, [searchTerm]);

  // Fetch models using cache
  useEffect(() => {
    const loadModels = async () => {
      // Only load once when dropdown opens
      if (!isOpen || hasLoadedRef.current) return;
      
      setLoading(true);
      setError(null);
      hasLoadedRef.current = true;
      
      try {
        console.log('[ModelPicker] Loading models for:', collectionSlug);
        const { models: cachedModels, fromCache } = await getModels(collectionSlug, handleCacheUpdate);
        
        console.log('[ModelPicker] Got', cachedModels.length, 'models', fromCache ? '(from cache)' : '(fresh)');
        setModels(cachedModels);
        setFilteredModels(cachedModels);
      } catch (err) {
        console.error('[ModelPicker] Error loading models:', err);
        setError('Failed to load models. Using manual input.');
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [isOpen, collectionSlug, handleCacheUpdate]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      unsubscribe(collectionSlug, handleCacheUpdate);
    };
  }, [collectionSlug, handleCacheUpdate]);

  // Filter models based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredModels(models);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = models.filter(model => {
      const fullName = `${model.owner}/${model.name}`.toLowerCase();
      const description = (model.description || '').toLowerCase();
      return fullName.includes(term) || description.includes(term);
    });

    setFilteredModels(filtered);
  }, [searchTerm, models]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (model) => {
    const modelId = `${model.owner}/${model.name}`;
    onChange(modelId);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Allow manual input - update parent immediately
    if (!isOpen) {
      onChange(newValue);
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm) {
      // Allow manual entry on Enter
      onChange(searchTerm);
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const displayValue = searchTerm || value || '';

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
        <button
          type="button"
          className="model-picker-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? '▲' : '▼'}
        </button>
      </div>

      {isOpen && (
        <div
          className="model-picker-dropdown nowheel"
          onWheel={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="model-picker-loading">
              Loading models...
            </div>
          )}

          {error && (
            <div className="model-picker-error">
              {error}
            </div>
          )}

          {!loading && !error && filteredModels.length === 0 && (
            <div className="model-picker-empty">
              {searchTerm ? 'No models found. Press Enter to use custom model ID.' : 'No models available'}
            </div>
          )}

          {!loading && !error && filteredModels.length > 0 && (
            <div
              className="model-picker-list nowheel"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredModels.slice(0, 50).map((model) => (
                <div
                  key={`${model.owner}/${model.name}`}
                  className="model-picker-item"
                  onClick={() => handleSelect(model)}
                >
                  <div className="model-picker-item-name">
                    {model.owner}/{model.name}
                  </div>
                  {model.description && (
                    <div className="model-picker-item-description">
                      {model.description}
                    </div>
                  )}
                </div>
              ))}
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

export default ReplicateModelPicker;