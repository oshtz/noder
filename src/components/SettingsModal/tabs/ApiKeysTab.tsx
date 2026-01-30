/**
 * ApiKeysTab - API key settings for various AI providers.
 */

import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { SiOpenai, SiAnthropic } from 'react-icons/si';
import {
  OpenRouterIcon,
  ReplicateIcon,
  OllamaIcon,
  LMStudioIcon,
  getProviderIcon,
} from '../../../constants/providerIcons';
import type { ApiKeysTabProps } from '../types';

// Get Google icon from shared module (or fallback)
const GoogleIcon = getProviderIcon('google');

// =============================================================================
// Helper Components
// =============================================================================

interface ApiKeyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyName: string;
  Icon?: React.ComponentType;
  visibleKeys: Record<string, boolean>;
  onToggleVisibility: (keyName: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  label,
  value,
  onChange,
  keyName,
  Icon,
  visibleKeys,
  onToggleVisibility,
}) => (
  <div className="settings-field api-key-field">
    <label className="settings-label">
      {Icon && (
        <span className="settings-label-icon">
          <Icon />
        </span>
      )}
      {label}
    </label>
    <div className="api-key-input-wrapper">
      <input
        type={visibleKeys[keyName] ? 'text' : 'password'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter your ${label} API key`}
        className="settings-input"
      />
      <button
        type="button"
        className="visibility-toggle"
        onClick={() => onToggleVisibility(keyName)}
        title={visibleKeys[keyName] ? 'Hide' : 'Show'}
      >
        {visibleKeys[keyName] ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
  </div>
);

// =============================================================================
// ApiKeysTab Component
// =============================================================================

export const ApiKeysTab: React.FC<ApiKeysTabProps> = ({
  openaiApiKey,
  openRouterApiKey,
  anthropicApiKey,
  replicateApiKey,
  geminiApiKey,
  ollamaBaseUrl,
  lmStudioBaseUrl,
  onOpenAIApiKeyChange,
  onOpenRouterApiKeyChange,
  onAnthropicApiKeyChange,
  onReplicateApiKeyChange,
  onGeminiApiKeyChange,
  onOllamaBaseUrlChange,
  onLmStudioBaseUrlChange,
}) => {
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (keyName: string) => {
    setVisibleKeys((prev) => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  return (
    <div className="settings-tab-content">
      {/* Major AI Providers */}
      <div className="settings-group">
        <h3 className="settings-group-title">Major AI Providers</h3>
        <p className="settings-group-description">
          API keys for leading AI companies. Keys are stored locally and never shared.
        </p>

        <ApiKeyInput
          label="OpenAI"
          value={openaiApiKey}
          onChange={onOpenAIApiKeyChange}
          keyName="openai"
          Icon={SiOpenai}
          visibleKeys={visibleKeys}
          onToggleVisibility={toggleKeyVisibility}
        />
        <ApiKeyInput
          label="Anthropic"
          value={anthropicApiKey}
          onChange={onAnthropicApiKeyChange}
          keyName="anthropic"
          Icon={SiAnthropic}
          visibleKeys={visibleKeys}
          onToggleVisibility={toggleKeyVisibility}
        />
        <ApiKeyInput
          label="Google Gemini"
          value={geminiApiKey}
          onChange={onGeminiApiKeyChange}
          keyName="gemini"
          Icon={GoogleIcon}
          visibleKeys={visibleKeys}
          onToggleVisibility={toggleKeyVisibility}
        />
      </div>

      {/* Model Aggregators */}
      <div className="settings-group">
        <h3 className="settings-group-title">Model Aggregators</h3>
        <p className="settings-group-description">
          Access multiple AI models through unified APIs.
        </p>

        <ApiKeyInput
          label="OpenRouter"
          value={openRouterApiKey}
          onChange={onOpenRouterApiKeyChange}
          keyName="openrouter"
          Icon={OpenRouterIcon}
          visibleKeys={visibleKeys}
          onToggleVisibility={toggleKeyVisibility}
        />
        <ApiKeyInput
          label="Replicate"
          value={replicateApiKey}
          onChange={onReplicateApiKeyChange}
          keyName="replicate"
          Icon={ReplicateIcon}
          visibleKeys={visibleKeys}
          onToggleVisibility={toggleKeyVisibility}
        />
      </div>

      {/* Local AI Providers */}
      <div className="settings-group">
        <h3 className="settings-group-title">Local AI Providers</h3>
        <p className="settings-group-description">
          Configure local AI servers for running models on your own hardware.
        </p>

        <div className="settings-field api-key-field">
          <label className="settings-label">
            <span className="settings-label-icon">
              <OllamaIcon />
            </span>
            Ollama Base URL
          </label>
          <input
            type="text"
            value={ollamaBaseUrl || ''}
            onChange={(e) => onOllamaBaseUrlChange(e.target.value)}
            placeholder="http://localhost:11434"
            className="settings-input"
          />
        </div>

        <div className="settings-field api-key-field">
          <label className="settings-label">
            <span className="settings-label-icon">
              <LMStudioIcon />
            </span>
            LM Studio Base URL
          </label>
          <input
            type="text"
            value={lmStudioBaseUrl || ''}
            onChange={(e) => onLmStudioBaseUrlChange(e.target.value)}
            placeholder="http://localhost:1234"
            className="settings-input"
          />
        </div>
      </div>
    </div>
  );
};

export default ApiKeysTab;
