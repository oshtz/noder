/**
 * WorkflowTab - Workflow management settings.
 */

import React from 'react';
import { FaDownload, FaUpload, FaFileExport, FaTrash } from 'react-icons/fa';
import type { WorkflowTabProps } from '../types';

// =============================================================================
// WorkflowTab Component
// =============================================================================

export const WorkflowTab: React.FC<WorkflowTabProps> = ({ workflowActions }) => {
  const { onSaveWorkflow, onLoadWorkflow, onExportWorkflow, onClearWorkflow } = workflowActions;

  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">Workflow Management</h3>
        <p className="settings-group-description">Save, load, and manage your workflows</p>

        <div className="workflow-actions-grid">
          <button className="workflow-action-card" onClick={onSaveWorkflow}>
            <div className="workflow-action-icon">
              <FaDownload />
            </div>
            <div className="workflow-action-info">
              <span className="workflow-action-title">Save Workflow</span>
              <span className="workflow-action-desc">Download current workflow as JSON</span>
            </div>
          </button>

          <button
            className="workflow-action-card"
            onClick={() => document.getElementById('settingsLoadWorkflowInput')?.click()}
          >
            <div className="workflow-action-icon">
              <FaUpload />
            </div>
            <div className="workflow-action-info">
              <span className="workflow-action-title">Load Workflow</span>
              <span className="workflow-action-desc">Import workflow from JSON file</span>
            </div>
            <input
              id="settingsLoadWorkflowInput"
              type="file"
              accept=".json"
              onChange={onLoadWorkflow}
              style={{ display: 'none' }}
            />
          </button>

          {onExportWorkflow && (
            <button className="workflow-action-card" onClick={onExportWorkflow}>
              <div className="workflow-action-icon">
                <FaFileExport />
              </div>
              <div className="workflow-action-info">
                <span className="workflow-action-title">Export Workflow</span>
                <span className="workflow-action-desc">Export as shareable format</span>
              </div>
            </button>
          )}

          <button className="workflow-action-card danger" onClick={onClearWorkflow}>
            <div className="workflow-action-icon">
              <FaTrash />
            </div>
            <div className="workflow-action-info">
              <span className="workflow-action-title">Clear Workflow</span>
              <span className="workflow-action-desc">Remove all nodes and connections</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowTab;
