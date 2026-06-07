import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaGripLines, FaImages, FaPlay, FaRedo, FaStop } from 'react-icons/fa';
import { useSettingsStore } from '../stores/useSettingsStore';
import './WorkflowUX.css';

export interface ButtonPosition {
  x: number;
  y: number;
}

interface ExecutionDockProps {
  isProcessing: boolean;
  processed: number;
  total: number;
  failedCount: number;
  outputCount: number;
  currentNodeName?: string;
  onRun: () => void | Promise<void>;
  onStop: () => void;
  onRetryFailed: () => void | Promise<void>;
  onOpenOutputs: () => void;
}

interface DragState {
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  moved: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getStatusLabel = (isProcessing: boolean, failedCount: number, total: number): string => {
  if (isProcessing) return 'Running';
  if (failedCount > 0) return 'Needs attention';
  if (total > 0) return 'Ready';
  return 'No workflow';
};

const ExecutionDock: React.FC<ExecutionDockProps> = ({
  isProcessing,
  processed,
  total,
  failedCount,
  outputCount,
  currentNodeName = '',
  onRun,
  onStop,
  onRetryFailed,
  onOpenOutputs,
}) => {
  const isUnlocked = useSettingsStore((state) => state.runButtonUnlocked);
  const position = useSettingsStore((state) => state.runButtonPosition);
  const onPositionChange = useSettingsStore((state) => state.setRunButtonPosition);

  const dockRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const positionRef = useRef<ButtonPosition | null>(position);
  const [localPosition, setLocalPosition] = useState<ButtonPosition | null>(position);
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = useCallback((candidate: ButtonPosition | null): ButtonPosition | null => {
    if (!candidate) return null;
    const dock = dockRef.current;
    const width = dock?.offsetWidth || 0;
    const height = dock?.offsetHeight || 0;
    const padding = 8;
    return {
      x: Math.round(
        clamp(candidate.x, padding, Math.max(padding, window.innerWidth - width - padding))
      ),
      y: Math.round(
        clamp(candidate.y, padding, Math.max(padding, window.innerHeight - height - padding))
      ),
    };
  }, []);

  useEffect(() => {
    positionRef.current = position;
    if (isDragging) return;
    const nextPosition = clampPosition(position);
    positionRef.current = nextPosition;
    setLocalPosition(nextPosition);
  }, [clampPosition, isDragging, position]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (event: MouseEvent): void => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) > 3) {
        dragState.moved = true;
      }
      const padding = 8;
      const nextPosition = {
        x: Math.round(
          clamp(
            event.clientX - dragState.offsetX,
            padding,
            Math.max(padding, window.innerWidth - dragState.width - padding)
          )
        ),
        y: Math.round(
          clamp(
            event.clientY - dragState.offsetY,
            padding,
            Math.max(padding, window.innerHeight - dragState.height - padding)
          )
        ),
      };
      positionRef.current = nextPosition;
      setLocalPosition(nextPosition);
    };

    const handleMouseUp = (): void => {
      if (dragStateRef.current?.moved && positionRef.current) {
        onPositionChange(positionRef.current);
      }
      dragStateRef.current = null;
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onPositionChange]);

  const handleDragStart = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (!isUnlocked) return;
    event.preventDefault();
    event.stopPropagation();
    const dock = dockRef.current;
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    positionRef.current = positionRef.current || { x: rect.left, y: rect.top };
    setIsDragging(true);
  };

  const statusLabel = getStatusLabel(isProcessing, failedCount, total);
  const progressPercent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const dockStyle: React.CSSProperties = localPosition
    ? {
        left: localPosition.x,
        top: localPosition.y,
        right: 'auto',
        bottom: 'auto',
      }
    : {};

  return (
    <section
      ref={dockRef}
      className={`execution-dock${isDragging ? ' is-dragging' : ''}`}
      style={dockStyle}
      aria-label="Workflow execution"
      data-testid="execution-dock"
    >
      <div className="execution-dock-header">
        <div className="execution-dock-title">
          {isUnlocked && (
            <button
              type="button"
              className="execution-dock-drag"
              onMouseDown={handleDragStart}
              aria-label="Drag execution dock"
              title="Drag to reposition"
            >
              <FaGripLines size={11} aria-hidden="true" />
            </button>
          )}
          <span
            className={`execution-status-dot ${isProcessing ? 'running' : failedCount > 0 ? 'failed' : ''}`}
          />
          <span>{statusLabel}</span>
        </div>
        <span className="execution-chip">{total === 1 ? '1 node' : `${total} nodes`}</span>
      </div>

      <div className="execution-dock-meta">
        <span className="execution-chip">{total > 0 ? `${processed} / ${total}` : '0 / 0'}</span>
        <span className="execution-chip">{outputCount} outputs</span>
        {failedCount > 0 && <span className="execution-chip">{failedCount} failed</span>}
        {isProcessing && currentNodeName && (
          <span className="execution-chip execution-current-node">{currentNodeName}</span>
        )}
      </div>

      <div className="execution-progress-track" aria-hidden="true">
        <div className="execution-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="execution-dock-actions">
        {isProcessing ? (
          <button
            type="button"
            className="execution-action danger"
            onClick={onStop}
            aria-label="Stop workflow"
          >
            <FaStop aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="execution-action primary"
            onClick={() => void onRun()}
            disabled={total === 0}
            aria-label="Run workflow"
          >
            <FaPlay aria-hidden="true" />
            Run
          </button>
        )}
        <button
          type="button"
          className="execution-action"
          onClick={() => void onRetryFailed()}
          disabled={isProcessing || failedCount === 0}
          aria-label="Retry failed nodes"
        >
          <FaRedo aria-hidden="true" />
          Retry failed
        </button>
        <button
          type="button"
          className="execution-action"
          onClick={onOpenOutputs}
          disabled={outputCount === 0}
          aria-label="Open outputs"
        >
          <FaImages aria-hidden="true" />
          Open outputs
        </button>
      </div>
    </section>
  );
};

export default ExecutionDock;
