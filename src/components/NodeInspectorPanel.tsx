import React from 'react';
import type { Edge, Node } from 'reactflow';
import { FaPlay, FaRedo, FaTimes } from 'react-icons/fa';
import type { FailedNode } from '../hooks/useWorkflowExecution';
import type { Output } from './gallery';
import './WorkflowUX.css';

interface NodeInspectorPanelProps {
  selectedNode: Node | null;
  incomingEdges: Edge[];
  outgoingEdges: Edge[];
  outputs: Output[];
  failedNode: FailedNode | null;
  onRunNode: (nodeId: string) => void | Promise<void>;
  onRetryNode: (nodeId: string) => void | Promise<void>;
  onDeleteNode?: (nodeId: string) => void | Promise<void>;
  onMoveNodeOrder?: (nodeId: string, direction: 'up' | 'down') => void;
  onClose: () => void;
}

const pluralize = (count: number, singular: string): string =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

const formatDuration = (ms: unknown): string | null => {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
};

const getNodeTitle = (node: Node): string => {
  const data = node.data || {};
  return String(data.customTitle || data.title || data.label || node.type || node.id);
};

const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = ({
  selectedNode,
  incomingEdges,
  outgoingEdges,
  outputs,
  failedNode,
  onRunNode,
  onRetryNode,
  onDeleteNode,
  onMoveNodeOrder,
  onClose,
}) => {
  if (!selectedNode) {
    return null;
  }

  const nodeTitle = getNodeTitle(selectedNode);
  const model = selectedNode.data?.model || selectedNode.data?.metadata || 'No model selected';
  const nodeOutputs = outputs.filter((output) => output.nodeId === selectedNode.id);
  const duration = formatDuration(selectedNode.data?.lastRunDurationMs);
  const error = failedNode?.error || selectedNode.data?.error;

  return (
    <aside className="node-inspector-panel" aria-label={`Node inspector for ${nodeTitle}`}>
      <div className="inspector-header">
        <div>
          <p className="inspector-eyebrow">{selectedNode.type || 'Node'}</p>
          <h2 className="inspector-title">{nodeTitle}</h2>
        </div>
        <button
          type="button"
          className="inspector-close"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>

      <div className="inspector-body">
        <section className="inspector-section">
          <p className="inspector-section-title">Model</p>
          <div className="inspector-model">{String(model)}</div>
        </section>

        <section className="inspector-section">
          <p className="inspector-section-title">Connections</p>
          <div className="inspector-chip-row">
            <span className="inspector-chip">{pluralize(incomingEdges.length, 'input')}</span>
            <span className="inspector-chip">{pluralize(outgoingEdges.length, 'output')}</span>
            <span className="inspector-chip">
              Order {String(selectedNode.data?.executionOrder || '?')}
            </span>
          </div>
        </section>

        <section className="inspector-section">
          <p className="inspector-section-title">Last Run</p>
          <div className="inspector-chip-row">
            <span className="inspector-chip">{pluralize(nodeOutputs.length, 'saved output')}</span>
            {duration && <span className="inspector-chip">{duration}</span>}
            {selectedNode.data?.output && <span className="inspector-chip">Node output ready</span>}
          </div>
        </section>

        {error && (
          <section className="inspector-section">
            <p className="inspector-section-title">Failure</p>
            <div className="inspector-error">{String(error)}</div>
          </section>
        )}

        <section className="inspector-section">
          <p className="inspector-section-title">Actions</p>
          <div className="inspector-actions">
            <button
              type="button"
              className="execution-action primary"
              onClick={() => void onRunNode(selectedNode.id)}
              aria-label="Run node"
            >
              <FaPlay aria-hidden="true" />
              Run node
            </button>
            <button
              type="button"
              className="execution-action"
              onClick={() => void onRetryNode(selectedNode.id)}
              aria-label="Retry node"
            >
              <FaRedo aria-hidden="true" />
              Retry node
            </button>
            {onMoveNodeOrder && (
              <>
                <button
                  type="button"
                  className="execution-action"
                  onClick={() => onMoveNodeOrder(selectedNode.id, 'up')}
                  aria-label="Move node earlier"
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="execution-action"
                  onClick={() => onMoveNodeOrder(selectedNode.id, 'down')}
                  aria-label="Move node later"
                >
                  Move down
                </button>
              </>
            )}
            {onDeleteNode && (
              <button
                type="button"
                className="execution-action danger"
                onClick={() => void onDeleteNode(selectedNode.id)}
                aria-label="Delete node"
              >
                Delete
              </button>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
};

export default NodeInspectorPanel;
