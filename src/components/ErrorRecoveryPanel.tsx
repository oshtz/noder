import React from 'react';
import { FaExclamationCircle, FaTimes, FaRedo, FaArrowRight } from 'react-icons/fa';
import { useExecutionStore, type FailedNode as StoreFailedNode } from '../stores/useExecutionStore';
import type { FailedNode as ComponentFailedNode } from '../types/components';
import './ErrorRecoveryPanel.css';

// Union type for both failed node formats
type AnyFailedNode = ComponentFailedNode | StoreFailedNode;

// Helper to get node label from either format
const getNodeLabel = (node: AnyFailedNode): string => {
  if ('data' in node && node.data?.label) {
    return node.data.label;
  }
  if ('node' in node && node.node?.data?.label) {
    return String(node.node.data.label);
  }
  if ('type' in node) {
    return node.type;
  }
  if ('node' in node && node.node?.type) {
    return node.node.type;
  }
  return 'Unknown Node';
};

// Helper to get error message from either format
const getNodeError = (node: AnyFailedNode): string => {
  if ('error' in node && typeof node.error === 'string') {
    return node.error;
  }
  if ('data' in node && node.data?.error) {
    return node.data.error;
  }
  if ('node' in node && node.node?.data?.error) {
    return String(node.node.data.error);
  }
  return 'Unknown error';
};

export interface ErrorRecoveryPanelProps {
  /** List of nodes that failed during execution (optional - will read from store if not provided) */
  failedNodes?: AnyFailedNode[] | null;
  /** Called when retrying a single node */
  onRetry: (nodeId: string) => void;
  /** Called when retrying all failed nodes */
  onRetryAll: () => void;
  /** Called when skipping failed nodes and continuing */
  onSkip: () => void;
  /** Called when closing the panel (optional - uses store if not provided) */
  onClose?: () => void;
}

/**
 * ErrorRecoveryPanel - Shows retry options when workflow execution fails
 * Allows users to retry individual nodes, all failed nodes, or skip errors
 * Now reads state from useExecutionStore by default
 */
const ErrorRecoveryPanel: React.FC<ErrorRecoveryPanelProps> = ({
  failedNodes: externalFailedNodes,
  onRetry,
  onRetryAll,
  onSkip,
  onClose: externalOnClose,
}) => {
  // Read from store
  const storeFailedNodes = useExecutionStore((s) => s.failedNodes);
  const closeErrorRecovery = useExecutionStore((s) => s.closeErrorRecovery);

  // Use external props if provided, otherwise use store
  const failedNodes: AnyFailedNode[] = externalFailedNodes ?? storeFailedNodes;
  const onClose = externalOnClose ?? closeErrorRecovery;

  // Only render if panel should be shown and there are failed nodes
  if (!failedNodes || failedNodes.length === 0) return null;

  return (
    <div className="error-recovery-panel">
      <div className="error-recovery-header">
        <div className="error-recovery-title">
          <FaExclamationCircle size={20} />
          <span>
            Workflow Error ({failedNodes.length} node{failedNodes.length > 1 ? 's' : ''} failed)
          </span>
        </div>
        <button className="error-recovery-close" onClick={onClose} title="Close">
          <FaTimes size={16} />
        </button>
      </div>

      <div className="error-recovery-body">
        <div className="error-recovery-description">
          The workflow encountered errors during execution. You can retry individual nodes or all
          failed nodes at once.
        </div>

        <div className="failed-nodes-list">
          {failedNodes.map((node) => (
            <div key={node.id} className="failed-node-item">
              <div className="failed-node-info">
                <div className="failed-node-name">{getNodeLabel(node)}</div>
                <div className="failed-node-error">{getNodeError(node)}</div>
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
