import React from 'react';
import type { ConnectionHint } from '../utils/connectionHints';
import './WorkflowUX.css';

interface ConnectionHintOverlayProps {
  hint: ConnectionHint | null;
}

const ConnectionHintOverlay: React.FC<ConnectionHintOverlayProps> = ({ hint }) => {
  if (!hint) return null;

  const targetCount = hint.compatibleTargets.length;
  const outputTypeLabel =
    hint.sourceHandleType.charAt(0).toUpperCase() + hint.sourceHandleType.slice(1);
  return (
    <aside className="connection-hint-overlay" aria-label="Connection guidance">
      <div className="connection-hint-header">
        <span className="connection-hint-type">{outputTypeLabel} output</span>
        <span className="connection-hint-count">
          {targetCount} compatible {targetCount === 1 ? 'target' : 'targets'}
        </span>
      </div>
      {targetCount > 0 ? (
        <div className="connection-hint-list">
          {hint.compatibleTargets.slice(0, 6).map((target) => (
            <span className="connection-hint-target" key={`${target.nodeId}-${target.handleId}`}>
              {target.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="connection-hint-empty">{hint.invalidReason}</p>
      )}
    </aside>
  );
};

export default ConnectionHintOverlay;
