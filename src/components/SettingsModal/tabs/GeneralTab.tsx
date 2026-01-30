/**
 * GeneralTab - General settings for file storage, sidebar, and controls.
 */

import React from 'react';
import { FaFolder } from 'react-icons/fa';
import type { GeneralTabProps } from '../types';

// =============================================================================
// Helper Components
// =============================================================================

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}

const Toggle: React.FC<ToggleProps> = ({ value, onChange, label, description }) => (
  <div className="settings-field">
    <div className="toggle-row">
      <div className="toggle-info">
        <label className="settings-label">{label}</label>
        {description && <small className="settings-help">{description}</small>}
      </div>
      <button
        type="button"
        className={`toggle-switch ${value ? 'active' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  </div>
);

interface ActionButtonProps {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  description,
  onClick,
  disabled = false,
}) => (
  <div className="settings-field">
    <button type="button" className="settings-action-button" onClick={onClick} disabled={disabled}>
      <span className="settings-action-title">{label}</span>
      {description && <span className="settings-action-desc">{description}</span>}
    </button>
  </div>
);

// =============================================================================
// GeneralTab Component
// =============================================================================

export const GeneralTab: React.FC<GeneralTabProps> = ({
  defaultSaveLocation,
  showTemplates,
  showAssistantPanel,
  runButtonUnlocked,
  runButtonPosition,
  onDefaultSaveLocationChange,
  onShowTemplatesChange,
  onShowAssistantPanelChange,
  onRunButtonUnlockedChange,
  onResetRunButtonPosition,
}) => {
  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">File Storage</h3>
        <div className="settings-field">
          <label className="settings-label">Default Save Location</label>
          <div className="input-with-icon">
            <FaFolder className="input-icon" />
            <input
              type="text"
              value={defaultSaveLocation || ''}
              onChange={(e) => onDefaultSaveLocationChange(e.target.value)}
              placeholder="Downloads/noder"
              className="settings-input with-icon"
            />
          </div>
          <small className="settings-help">Default folder for saving generated media files</small>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Sidebar</h3>
        <Toggle
          value={showTemplates}
          onChange={onShowTemplatesChange}
          label="Show Templates Button"
          description="Show or hide the workflow templates button in the sidebar"
        />
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Assistant & Controls</h3>
        <Toggle
          value={showAssistantPanel}
          onChange={onShowAssistantPanelChange}
          label="Show AI Assistant Panel"
          description="Show or hide the noder.bot assistant panel"
        />
        <Toggle
          value={runButtonUnlocked}
          onChange={onRunButtonUnlockedChange}
          label="Unlock Run Workflow Button"
          description="Enable the drag handle to reposition the floating Run Workflow button"
        />
        <ActionButton
          label="Reset Run Button Position"
          description="Restore the default bottom-right position"
          onClick={onResetRunButtonPosition}
          disabled={!runButtonPosition}
        />
      </div>
    </div>
  );
};

export default GeneralTab;
