import React, { useEffect, useRef, useState } from 'react';
import {
  FaChevronDown,
  FaImages,
  FaLayerGroup,
  FaObjectUngroup,
  FaPlay,
  FaRedo,
  FaSitemap,
  FaStop,
  FaUndo,
} from 'react-icons/fa';
import type { ContextualSurfaceMode } from '../hooks/useContextualSurfaces';
import './WorkflowUX.css';

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

interface CommandDockProps {
  mode: ContextualSurfaceMode;
  isProcessing: boolean;
  processed: number;
  total: number;
  failedCount: number;
  outputCount: number;
  currentNodeName?: string;
  zoomPercent: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasGroupSelected: boolean;
  onRun: () => void | Promise<void>;
  onStop: () => void;
  onRetryFailed: () => void | Promise<void>;
  onOpenOutputs: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAutoLayout?: (direction: LayoutDirection) => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
}

const layoutOptions: Array<{ id: LayoutDirection; label: string }> = [
  { id: 'TB', label: 'Top to Bottom' },
  { id: 'BT', label: 'Bottom to Top' },
  { id: 'LR', label: 'Left to Right' },
  { id: 'RL', label: 'Right to Left' },
];

const CommandDock: React.FC<CommandDockProps> = ({
  mode,
  isProcessing,
  processed,
  total,
  failedCount,
  outputCount,
  currentNodeName = '',
  zoomPercent,
  canUndo,
  canRedo,
  hasSelection,
  hasGroupSelected,
  onRun,
  onStop,
  onRetryFailed,
  onOpenOutputs,
  onUndo,
  onRedo,
  onAutoLayout,
  onGroupSelected,
  onUngroupSelected,
}) => {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const progressPercent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  useEffect(() => {
    if (!layoutMenuOpen) return undefined;
    const closeOnPointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnPointerDown);
    return () => document.removeEventListener('mousedown', closeOnPointerDown);
  }, [layoutMenuOpen]);

  return (
    <section className={`command-dock command-dock--${mode}`} aria-label="Canvas commands">
      <div className="command-dock-main">
        <button
          type="button"
          className="command-dock-button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <FaUndo aria-hidden="true" />
        </button>
        <button
          type="button"
          className="command-dock-button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <FaRedo aria-hidden="true" />
        </button>

        <span className="command-dock-divider" aria-hidden="true" />

        <div className="command-dock-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="command-dock-button command-dock-button--wide"
            onClick={() => setLayoutMenuOpen((open) => !open)}
            aria-label="Auto layout"
            aria-expanded={layoutMenuOpen}
            title="Auto layout"
          >
            <FaSitemap aria-hidden="true" />
            <FaChevronDown className="command-dock-chevron" aria-hidden="true" />
          </button>
          {layoutMenuOpen && (
            <div className="command-dock-menu" role="menu">
              {layoutOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="command-dock-menu-item"
                  onClick={() => {
                    onAutoLayout?.(option.id);
                    setLayoutMenuOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="command-dock-button"
          onClick={onGroupSelected}
          disabled={!hasSelection}
          aria-label="Group selected nodes"
          title="Group selected nodes"
        >
          <FaLayerGroup aria-hidden="true" />
        </button>
        <button
          type="button"
          className="command-dock-button"
          onClick={onUngroupSelected}
          disabled={!hasGroupSelected}
          aria-label="Ungroup selected nodes"
          title="Ungroup selected nodes"
        >
          <FaObjectUngroup aria-hidden="true" />
        </button>

        <span className="command-dock-divider" aria-hidden="true" />
        <span className="command-dock-zoom">{zoomPercent}%</span>

        <span className="command-dock-divider" aria-hidden="true" />

        {isProcessing ? (
          <button
            type="button"
            className="command-dock-action command-dock-action--danger"
            onClick={onStop}
            aria-label="Stop workflow"
          >
            <FaStop aria-hidden="true" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            className="command-dock-action command-dock-action--primary"
            onClick={() => void onRun()}
            disabled={total === 0}
            aria-label="Run workflow"
          >
            <FaPlay aria-hidden="true" />
            <span>Run</span>
          </button>
        )}

        <button
          type="button"
          className="command-dock-button"
          onClick={() => void onRetryFailed()}
          disabled={isProcessing || failedCount === 0}
          aria-label="Retry failed nodes"
          title="Retry failed nodes"
        >
          <FaRedo aria-hidden="true" />
        </button>
        <button
          type="button"
          className="command-dock-button"
          onClick={onOpenOutputs}
          disabled={outputCount === 0}
          aria-label="Open outputs"
          title="Open outputs"
        >
          <FaImages aria-hidden="true" />
        </button>
      </div>

      {(isProcessing || failedCount > 0 || currentNodeName) && (
        <div className="command-dock-status" aria-live="polite">
          <span>{total > 0 ? `${processed} / ${total}` : '0 / 0'}</span>
          {currentNodeName && <span className="command-dock-current">{currentNodeName}</span>}
          {failedCount > 0 && <span>{failedCount} failed</span>}
          <span>{outputCount} outputs</span>
        </div>
      )}

      {isProcessing && (
        <div className="command-dock-progress" aria-hidden="true">
          <div className="command-dock-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
    </section>
  );
};

export default CommandDock;
