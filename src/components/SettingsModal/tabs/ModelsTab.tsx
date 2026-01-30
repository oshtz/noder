/**
 * ModelsTab - Default model settings for different node types.
 */

import React from 'react';
import type { ModelsTabProps } from '../types';

// =============================================================================
// Helper Components
// =============================================================================

interface ModelInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helpText?: string;
}

const ModelInput: React.FC<ModelInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  helpText,
}) => (
  <div className="settings-field">
    <label className="settings-label">{label}</label>
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="settings-input"
    />
    {helpText && <small className="settings-help">{helpText}</small>}
  </div>
);

// =============================================================================
// ModelsTab Component
// =============================================================================

export const ModelsTab: React.FC<ModelsTabProps> = ({
  defaultTextModel,
  defaultImageModel,
  defaultVideoModel,
  defaultAudioModel,
  defaultUpscalerModel,
  onDefaultTextModelChange,
  onDefaultImageModelChange,
  onDefaultVideoModelChange,
  onDefaultAudioModelChange,
  onDefaultUpscalerModelChange,
}) => {
  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">Default Models</h3>
        <p className="settings-group-description">
          Set default models for new nodes. These will be used when you create new nodes of each
          type.
        </p>

        <ModelInput
          label="Text Generation Model"
          value={defaultTextModel}
          onChange={onDefaultTextModelChange}
          placeholder="openai/gpt-4o-mini"
          helpText="Default model for Text/LLM nodes (e.g., openai/gpt-4o-mini, meta/llama-3)"
        />

        <ModelInput
          label="Image Generation Model"
          value={defaultImageModel}
          onChange={onDefaultImageModelChange}
          placeholder="black-forest-labs/flux-2-klein-4b"
          helpText="Default model for Image nodes (e.g., black-forest-labs/flux-2-klein-4b, stability-ai/sdxl)"
        />

        <ModelInput
          label="Video Generation Model"
          value={defaultVideoModel}
          onChange={onDefaultVideoModelChange}
          placeholder="lightricks/ltx-2-fast"
          helpText="Default model for Video nodes (e.g., lightricks/ltx-2-fast, minimax/video-01)"
        />

        <ModelInput
          label="Audio Generation Model"
          value={defaultAudioModel}
          onChange={onDefaultAudioModelChange}
          placeholder="google/lyria-2"
          helpText="Default model for Audio nodes (e.g., google/lyria-2, meta/musicgen)"
        />

        <ModelInput
          label="Upscaler Model"
          value={defaultUpscalerModel}
          onChange={onDefaultUpscalerModelChange}
          placeholder="recraft-ai/recraft-crisp-upscale"
          helpText="Default model for Upscaler nodes (e.g., recraft-ai/recraft-crisp-upscale, nightmareai/real-esrgan)"
        />
      </div>
    </div>
  );
};

export default ModelsTab;
