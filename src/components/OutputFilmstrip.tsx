import React, { useMemo } from 'react';
import type { Node } from 'reactflow';
import { FaImages, FaTimes } from 'react-icons/fa';
import type { Output } from './gallery';
import './WorkflowUX.css';

interface OutputFilmstripProps {
  outputs: Output[];
  nodes: Node[];
  onOpenGallery: () => void;
  onClose?: () => void;
}

const getNodeLabel = (node: Node | undefined, fallback: string | undefined): string => {
  if (!node) return fallback || 'Output';
  const data = node.data || {};
  return String(data.customTitle || data.title || data.label || node.type || fallback || 'Output');
};

const getTimestamp = (output: Output): number =>
  typeof output.timestamp === 'number' ? output.timestamp : Number(output.timestamp || 0);

const OutputFilmstrip: React.FC<OutputFilmstripProps> = ({
  outputs,
  nodes,
  onOpenGallery,
  onClose,
}) => {
  const recentOutputs = useMemo(
    () => [...outputs].sort((a, b) => getTimestamp(b) - getTimestamp(a)).slice(0, 8),
    [outputs]
  );

  if (recentOutputs.length === 0) return null;

  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <section className="output-filmstrip" aria-label="Recent workflow outputs">
      <div className="filmstrip-header">
        <h2 className="filmstrip-title">Recent outputs</h2>
        <button
          type="button"
          className="execution-action"
          onClick={onOpenGallery}
          aria-label="Open gallery"
        >
          <FaImages aria-hidden="true" />
          Open gallery
        </button>
        {onClose && (
          <button
            type="button"
            className="execution-action filmstrip-close"
            onClick={onClose}
            aria-label="Close recent outputs"
          >
            <FaTimes aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="filmstrip-items">
        {recentOutputs.map((output, index) => {
          const nodeLabel = getNodeLabel(nodesById.get(output.nodeId || ''), output.nodeId);
          const key = output.id || `${output.nodeId || 'output'}-${index}`;
          return (
            <article className="filmstrip-item" key={key}>
              <div className="filmstrip-preview">
                {output.type === 'image' ? (
                  <img src={output.value} alt={nodeLabel} loading="lazy" />
                ) : output.type === 'text' ? (
                  <span className="filmstrip-text-preview">{output.value}</span>
                ) : (
                  <span className="filmstrip-chip">{output.type}</span>
                )}
              </div>
              <div className="filmstrip-meta">
                <span className="filmstrip-node">{nodeLabel}</span>
                <span className="filmstrip-chip">{output.type}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default OutputFilmstrip;
