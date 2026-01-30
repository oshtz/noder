/**
 * UpdatesTab - App update settings and status.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { UpdatesTabProps } from '../types';

// =============================================================================
// Constants
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  checking: 'Checking for updates',
  available: 'Update available',
  downloading: 'Downloading update',
  ready: 'Ready to install',
  installing: 'Installing update',
  'up-to-date': 'Up to date',
  error: 'Update failed',
};

// =============================================================================
// UpdatesTab Component
// =============================================================================

export const UpdatesTab: React.FC<UpdatesTabProps> = ({ updateState, updateActions }) => {
  const {
    supported: updateSupported = false,
    currentVersion = null,
    updateStatus = 'idle',
    updateInfo = null,
    updatePath = null,
    updateError = null,
    lastUpdateCheck = null,
  } = updateState;

  const {
    onCheck: onUpdateCheck,
    onDownload: onUpdateDownload,
    onInstall: onUpdateInstall,
  } = updateActions;

  const statusText = STATUS_LABELS[updateStatus] || 'Unknown';
  const lastCheckedText = lastUpdateCheck ? new Date(lastUpdateCheck).toLocaleString() : 'Never';
  const publishedText = updateInfo?.publishedAt
    ? new Date(updateInfo.publishedAt).toLocaleDateString()
    : '-';
  const isBusy = ['checking', 'downloading', 'installing'].includes(updateStatus);

  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <h3 className="settings-group-title">App Updates</h3>
        <p className="settings-group-description">Check for updates and keep noder up to date.</p>

        {!updateSupported && (
          <div className="update-banner">Updates are available in the desktop build.</div>
        )}

        <div className="update-meta-grid">
          <div className="update-meta-item">
            <span className="update-meta-label">Current version</span>
            <span className="update-meta-value">{currentVersion || 'Unknown'}</span>
          </div>
          <div className="update-meta-item">
            <span className="update-meta-label">Latest version</span>
            <span className="update-meta-value">{updateInfo?.version || '-'}</span>
          </div>
          <div className="update-meta-item">
            <span className="update-meta-label">Last checked</span>
            <span className="update-meta-value">{lastCheckedText}</span>
          </div>
          <div className="update-meta-item">
            <span className="update-meta-label">Status</span>
            <span className={`update-status-pill status-${updateStatus}`}>{statusText}</span>
          </div>
          <div className="update-meta-item">
            <span className="update-meta-label">Published</span>
            <span className="update-meta-value">{publishedText}</span>
          </div>
        </div>

        {updateError && <div className="update-error">{updateError}</div>}

        <div className="update-actions">
          <button
            type="button"
            className="update-action-button"
            onClick={() => onUpdateCheck?.()}
            disabled={!updateSupported || isBusy}
          >
            Check for updates
          </button>
          {updateInfo && !updatePath && (
            <button
              type="button"
              className="update-action-button"
              onClick={() => onUpdateDownload?.()}
              disabled={!updateSupported || isBusy}
            >
              Download update
            </button>
          )}
          {updatePath && (
            <button
              type="button"
              className="update-action-button primary"
              onClick={() => onUpdateInstall?.()}
              disabled={!updateSupported || isBusy}
            >
              Install and restart
            </button>
          )}
        </div>

        {updateInfo?.notes && (
          <div className="update-notes">
            <div className="update-notes-title">Release notes</div>
            <ReactMarkdown className="update-notes-content">{updateInfo.notes}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatesTab;
