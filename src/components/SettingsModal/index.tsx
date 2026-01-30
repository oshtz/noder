/**
 * SettingsModal - Application settings panel
 * Refactored to use separate tab components for better maintainability.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FaKey,
  FaPalette,
  FaCog,
  FaTimes,
  FaCloudDownloadAlt,
  FaProjectDiagram,
  FaCube,
} from 'react-icons/fa';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { GeneralTab } from './tabs/GeneralTab';
import { ApiKeysTab } from './tabs/ApiKeysTab';
import { ModelsTab } from './tabs/ModelsTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { UpdatesTab } from './tabs/UpdatesTab';
import { WorkflowTab } from './tabs/WorkflowTab';
import type { SettingsModalProps, Tab } from './types';
import '../SettingsModal.css';

// Re-export types for backwards compatibility
export type { UpdateState, UpdateActions, WorkflowActions, SettingsModalProps } from './types';

// =============================================================================
// Constants
// =============================================================================

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: FaCog },
  { id: 'apiKeys', label: 'API Keys', icon: FaKey },
  { id: 'models', label: 'Models', icon: FaCube },
  { id: 'appearance', label: 'Appearance', icon: FaPalette },
  { id: 'updates', label: 'Updates', icon: FaCloudDownloadAlt },
  { id: 'workflow', label: 'Workflow', icon: FaProjectDiagram },
];

// =============================================================================
// SettingsModal Component
// =============================================================================

export function SettingsModal({
  isOpen,
  onClose,
  updateState = {},
  updateActions = {},
  workflowActions = {},
}: SettingsModalProps) {
  // Use Zustand store directly
  const {
    // API Keys
    openaiApiKey,
    openRouterApiKey,
    anthropicApiKey,
    replicateApiKey,
    geminiApiKey,
    ollamaBaseUrl,
    lmStudioBaseUrl,
    // General settings
    defaultSaveLocation,
    showTemplates,
    showAssistantPanel,
    runButtonUnlocked,
    runButtonPosition,
    // Default models
    defaultTextModel,
    defaultImageModel,
    defaultVideoModel,
    defaultAudioModel,
    defaultUpscalerModel,
    // Edge appearance
    edgeType,
    // Theme
    currentTheme,
    // Setters
    setOpenAIApiKey,
    setOpenRouterApiKey,
    setAnthropicApiKey,
    setReplicateApiKey,
    setGeminiApiKey,
    setOllamaBaseUrl,
    setLmStudioBaseUrl,
    setDefaultSaveLocation,
    setShowTemplates,
    setShowAssistantPanel,
    setRunButtonUnlocked,
    setRunButtonPosition,
    setDefaultTextModel,
    setDefaultImageModel,
    setDefaultVideoModel,
    setDefaultAudioModel,
    setDefaultUpscalerModel,
    setEdgeType,
    setCurrentTheme,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState('general');
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            defaultSaveLocation={defaultSaveLocation}
            showTemplates={showTemplates}
            showAssistantPanel={showAssistantPanel}
            runButtonUnlocked={runButtonUnlocked}
            runButtonPosition={runButtonPosition}
            onDefaultSaveLocationChange={setDefaultSaveLocation}
            onShowTemplatesChange={setShowTemplates}
            onShowAssistantPanelChange={setShowAssistantPanel}
            onRunButtonUnlockedChange={setRunButtonUnlocked}
            onResetRunButtonPosition={() => setRunButtonPosition({ x: 20, y: 20 })}
          />
        );
      case 'apiKeys':
        return (
          <ApiKeysTab
            openaiApiKey={openaiApiKey}
            openRouterApiKey={openRouterApiKey}
            anthropicApiKey={anthropicApiKey}
            replicateApiKey={replicateApiKey}
            geminiApiKey={geminiApiKey}
            ollamaBaseUrl={ollamaBaseUrl}
            lmStudioBaseUrl={lmStudioBaseUrl}
            onOpenAIApiKeyChange={setOpenAIApiKey}
            onOpenRouterApiKeyChange={setOpenRouterApiKey}
            onAnthropicApiKeyChange={setAnthropicApiKey}
            onReplicateApiKeyChange={setReplicateApiKey}
            onGeminiApiKeyChange={setGeminiApiKey}
            onOllamaBaseUrlChange={setOllamaBaseUrl}
            onLmStudioBaseUrlChange={setLmStudioBaseUrl}
          />
        );
      case 'models':
        return (
          <ModelsTab
            defaultTextModel={defaultTextModel}
            defaultImageModel={defaultImageModel}
            defaultVideoModel={defaultVideoModel}
            defaultAudioModel={defaultAudioModel}
            defaultUpscalerModel={defaultUpscalerModel}
            onDefaultTextModelChange={setDefaultTextModel}
            onDefaultImageModelChange={setDefaultImageModel}
            onDefaultVideoModelChange={setDefaultVideoModel}
            onDefaultAudioModelChange={setDefaultAudioModel}
            onDefaultUpscalerModelChange={setDefaultUpscalerModel}
          />
        );
      case 'appearance':
        return (
          <AppearanceTab
            currentTheme={currentTheme}
            edgeType={edgeType}
            onCurrentThemeChange={setCurrentTheme}
            onEdgeTypeChange={setEdgeType}
          />
        );
      case 'updates':
        return <UpdatesTab updateState={updateState} updateActions={updateActions} />;
      case 'workflow':
        return <WorkflowTab workflowActions={workflowActions} />;
      default:
        return (
          <GeneralTab
            defaultSaveLocation={defaultSaveLocation}
            showTemplates={showTemplates}
            showAssistantPanel={showAssistantPanel}
            runButtonUnlocked={runButtonUnlocked}
            runButtonPosition={runButtonPosition}
            onDefaultSaveLocationChange={setDefaultSaveLocation}
            onShowTemplatesChange={setShowTemplates}
            onShowAssistantPanelChange={setShowAssistantPanel}
            onRunButtonUnlockedChange={setRunButtonUnlocked}
            onResetRunButtonPosition={() => setRunButtonPosition({ x: 20, y: 20 })}
          />
        );
    }
  };

  return createPortal(
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="settings-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-modal-header">
          <h2 id="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close settings">
            <FaTimes />
          </button>
        </div>

        <div className="settings-modal-body">
          <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`settings-panel-${tab.id}`}
                id={`settings-tab-${tab.id}`}
              >
                <tab.icon className="tab-icon" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div
            className="settings-content"
            role="tabpanel"
            id={`settings-panel-${activeTab}`}
            aria-labelledby={`settings-tab-${activeTab}`}
          >
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SettingsModal;
