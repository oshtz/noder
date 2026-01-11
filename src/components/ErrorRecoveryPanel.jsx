import React from 'react';
import { FaExclamationCircle, FaTimes, FaRedo, FaArrowRight } from 'react-icons/fa';
import './ErrorRecoveryPanel.css';

/**
 * ErrorRecoveryPanel component
 * Shows a panel with retry options when workflow execution encounters errors
 */
const ErrorRecoveryPanel = ({ failedNodes, onRetry, onRetryAll, onSkip, onClose }) => {
  if (!failedNodes || failedNodes.length === 0) return null;

  return (
    <div className="error-recovery-panel">
      <div className="error-recovery-header">
        <div className="error-recovery-title">
          <FaExclamationCircle size={20} />
          <span>Workflow Error ({failedNodes.length} node{failedNodes.length > 1 ? 's' : ''} failed)</span>
        </div>
        <button className="error-recovery-close" onClick={onClose} title="Close">
          <FaTimes size={16} />
        </button>
      </div>

      <div className="error-recovery-body">
        <div className="error-recovery-description">
          The workflow encountered errors during execution. You can retry individual nodes or all failed nodes at once.
        </div>

        <div className="failed-nodes-list">
          {failedNodes.map((node) => (
            <div key={node.id} className="failed-node-item">
              <div className="failed-node-info">
                <div className="failed-node-name">{node.data?.label || node.type}</div>
                <div className="failed-node-error">{node.data?.error || 'Unknown error'}</div>
              </div>
              <button
                className="retry-button"
                onClick={() => onRetry(node.id)}
                title="Retry this node"
              >
                <FaRedo size={16} />
                Retry
              </button>
            </div>
          ))}
        </div>

        <div className="error-recovery-actions">
          <button className="action-button primary" onClick={onRetryAll}>
            <FaRedo size={16} />
            Retry All ({failedNodes.length})
          </button>
          <button className="action-button secondary" onClick={onSkip}>
            <FaArrowRight size={16} />
            Skip Errors
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorRecoveryPanel;
