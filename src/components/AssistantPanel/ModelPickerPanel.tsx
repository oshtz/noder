/**
 * ModelPickerPanel - Component for selecting AI models.
 */

import React, { ChangeEvent, KeyboardEvent } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { ModelPickerPanelProps, ModelCatalogEntry } from './types';

export const ModelPickerPanel: React.FC<ModelPickerPanelProps> = ({
  model,
  modelPickerOpen,
  modelProvider,
  providerOptions,
  featuredModels,
  filteredModels,
  recentEntries,
  modelQuery,
  showCustomOption,
  activeModelId,
  modelPickerRef,
  onModelInputChange,
  onModelFocus,
  onModelKeyDown,
  onModelClear,
  onProviderChange,
  onModelSelect,
  providerMatches,
}) => {
  const renderModelOption = (entry: ModelCatalogEntry): React.ReactElement => (
    <button
      type="button"
      key={entry.id}
      className={`assistant-model-option ${activeModelId === entry.id ? 'is-active' : ''}`}
      onClick={() => onModelSelect(entry.id)}
    >
      <div className="assistant-model-main">
        <span className="assistant-model-label">{entry.label}</span>
        <span className="assistant-model-id">{entry.id}</span>
      </div>
      <span className="assistant-model-provider">{entry.provider}</span>
    </button>
  );

  return (
    <div className="assistant-config">
      <label htmlFor="assistant-model">Model</label>
      <div className="assistant-model-picker" ref={modelPickerRef}>
        <div className="assistant-model-input-row">
          <input
            id="assistant-model"
            type="text"
            value={model}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onModelInputChange(e.target.value)}
            onFocus={onModelFocus}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => onModelKeyDown(e)}
            placeholder="Search or enter model id"
            autoComplete="off"
          />
          {model && (
            <button
              type="button"
              className="assistant-model-clear"
              onClick={onModelClear}
              title="Clear model"
              aria-label="Clear model"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {modelPickerOpen && (
          <div className="assistant-model-menu">
            <div className="assistant-model-filters">
              {providerOptions.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className={`assistant-model-filter ${modelProvider === provider ? 'is-active' : ''}`}
                  onClick={() => onProviderChange(provider)}
                >
                  {provider}
                </button>
              ))}
            </div>

            {modelQuery ? (
              <div className="assistant-model-group">
                <div className="assistant-model-group-title">
                  {filteredModels.length ? 'Matches' : 'No matches'}
                </div>
                {filteredModels.map((entry) => renderModelOption(entry))}
                {showCustomOption && (
                  <button
                    type="button"
                    className="assistant-model-option is-custom"
                    onClick={() => onModelSelect(modelQuery)}
                  >
                    <div className="assistant-model-main">
                      <span className="assistant-model-label">Use custom model id</span>
                      <span className="assistant-model-id">{modelQuery}</span>
                    </div>
                    <span className="assistant-model-provider">Custom</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {recentEntries.filter(providerMatches).length > 0 && (
                  <div className="assistant-model-group">
                    <div className="assistant-model-group-title">Recent</div>
                    {recentEntries.filter(providerMatches).map((entry) => renderModelOption(entry))}
                  </div>
                )}
                {featuredModels.filter(providerMatches).length > 0 && (
                  <div className="assistant-model-group">
                    <div className="assistant-model-group-title">Featured</div>
                    {featuredModels
                      .filter(providerMatches)
                      .map((entry) => renderModelOption(entry))}
                  </div>
                )}
                <div className="assistant-model-group">
                  <div className="assistant-model-group-title">All models</div>
                  {filteredModels.length ? (
                    filteredModels.map((entry) => renderModelOption(entry))
                  ) : (
                    <div className="assistant-model-empty">No models for this filter.</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelPickerPanel;
