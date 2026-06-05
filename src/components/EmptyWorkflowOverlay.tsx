import React from 'react';
import { FaMagic, FaRobot } from 'react-icons/fa';
import { useShowAssistantPanel } from '../stores/useSettingsStore';

export interface EmptyWorkflowOverlayProps {
  onBuildWithAI: () => void;
  onStartFromScratch: (event?: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Overlay shown when the workflow is empty, prompting the user to
 * either build with AI or start from scratch.
 */
export function EmptyWorkflowOverlay({
  onBuildWithAI,
  onStartFromScratch,
}: EmptyWorkflowOverlayProps): React.ReactElement {
  // Read showAssistantPanel from settings store
  const showAssistantPanel = useShowAssistantPanel();
  return (
    <div className="empty-workflow-overlay">
      <div className="empty-workflow-card" role="status" aria-live="polite">
        <div className="empty-workflow-eyebrow">Empty workflow</div>
        <h2 className="empty-workflow-title">How do you want to start?</h2>
        <p className="empty-workflow-subtitle">
          Double-click the canvas to open the node menu, or pick a path below.
        </p>
        <div className="empty-workflow-instructions" aria-label="Canvas shortcuts">
          <span className="empty-workflow-kbd">Double-click</span>
          <span>Open node menu anywhere on the canvas</span>
        </div>
        <div className="empty-workflow-actions">
          {showAssistantPanel && (
            <button
              type="button"
              className="empty-workflow-button is-primary"
              onClick={onBuildWithAI}
            >
              <span className="empty-workflow-button-icon" aria-hidden="true">
                <FaRobot />
              </span>
              <span className="empty-workflow-button-copy">
                <span className="empty-workflow-button-title">Build with AI</span>
                <span className="empty-workflow-button-description">
                  Open noder.bot and describe your workflow.
                </span>
              </span>
            </button>
          )}
          <button type="button" className="empty-workflow-button" onClick={onStartFromScratch}>
            <span className="empty-workflow-button-icon" aria-hidden="true">
              <FaMagic />
            </span>
            <span className="empty-workflow-button-copy">
              <span className="empty-workflow-button-title">Open node menu</span>
              <span className="empty-workflow-button-description">
                Choose the first block and place it exactly where you want it.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmptyWorkflowOverlay;
