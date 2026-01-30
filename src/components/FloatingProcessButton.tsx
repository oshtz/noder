import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaGripLines, FaPlay } from 'react-icons/fa';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useExecutionStore } from '../stores/useExecutionStore';

export interface ButtonPosition {
  x: number;
  y: number;
}

export interface FloatingProcessButtonProps {
  /** Called when the button is clicked */
  onClick: () => void;
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

/**
 * FloatingProcessButton - Draggable workflow run button
 * Features:
 * - Draggable when unlocked
 * - Position persistence via Zustand store
 * - Processing state with spinner from execution store
 */
const FloatingProcessButton: React.FC<FloatingProcessButtonProps> = ({ onClick }) => {
  // Read state from Zustand stores
  const isProcessing = useExecutionStore((s) => s.isProcessing);
  const isUnlocked = useSettingsStore((s) => s.runButtonUnlocked);
  const position = useSettingsStore((s) => s.runButtonPosition);
  const onPositionChange = useSettingsStore((s) => s.setRunButtonPosition);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const positionRef = useRef<ButtonPosition | null>(position);
  const [isDragging, setIsDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState<ButtonPosition | null>(position);

  const clampPosition = useCallback((candidate: ButtonPosition | null): ButtonPosition | null => {
    if (!candidate) return null;
    const button = buttonRef.current;
    const width = button?.offsetWidth || 0;
    const height = button?.offsetHeight || 0;
    const padding = 8;
    const maxX = window.innerWidth - width - padding;
    const maxY = window.innerHeight - height - padding;
    const clampedX = clamp(candidate.x, padding, Math.max(padding, maxX));
    const clampedY = clamp(candidate.y, padding, Math.max(padding, maxY));
    return { x: Math.round(clampedX), y: Math.round(clampedY) };
  }, []);

  useEffect(() => {
    positionRef.current = position;
    if (isDragging) return;
    if (!position) {
      setLocalPosition(null);
      return;
    }
    const nextPosition = clampPosition(position);
    positionRef.current = nextPosition;
    setLocalPosition(nextPosition);
    if (
      typeof onPositionChange === 'function' &&
      nextPosition &&
      (nextPosition.x !== position.x || nextPosition.y !== position.y)
    ) {
      onPositionChange(nextPosition);
    }
  }, [position, isDragging, onPositionChange, clampPosition]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) > 3) {
        dragState.moved = true;
      }

      const padding = 8;
      const maxX = window.innerWidth - dragState.width - padding;
      const maxY = window.innerHeight - dragState.height - padding;
      const nextX = clamp(event.clientX - dragState.offsetX, padding, Math.max(padding, maxX));
      const nextY = clamp(event.clientY - dragState.offsetY, padding, Math.max(padding, maxY));
      const nextPosition = { x: Math.round(nextX), y: Math.round(nextY) };

      positionRef.current = nextPosition;
      setLocalPosition(nextPosition);
    };

    const handleMouseUp = () => {
      const dragState = dragStateRef.current;
      if (dragState?.moved) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (typeof onPositionChange === 'function') {
          onPositionChange(positionRef.current as ButtonPosition);
        }
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

  useEffect(() => {
    const handleResize = () => {
      if (isDragging) return;
      const current = positionRef.current;
      if (!current) return;
      const nextPosition = clampPosition(current);
      if (!nextPosition) return;
      if (nextPosition.x === current.x && nextPosition.y === current.y) return;
      positionRef.current = nextPosition;
      setLocalPosition(nextPosition);
      if (typeof onPositionChange === 'function') {
        onPositionChange(nextPosition);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDragging, onPositionChange, clampPosition]);

  const handleDragStart = (event: React.MouseEvent) => {
    if (!isUnlocked) return;
    event.preventDefault();
    event.stopPropagation();

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const startPosition = positionRef.current || { x: rect.left, y: rect.top };
    positionRef.current = startPosition;
    setLocalPosition(startPosition);

    dragStateRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    setIsDragging(true);
  };

  const handleButtonClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClick();
  };

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: 'calc(20px + var(--assistant-panel-offset, 0px))',
    padding: '10px 20px',
    backgroundColor: isProcessing ? 'var(--disabled-color, #888)' : 'var(--primary-color)',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: isProcessing ? 'wait' : 'pointer',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    opacity: isProcessing ? 0.8 : 1,
  };

  if (localPosition) {
    baseStyle.left = `${localPosition.x}px`;
    baseStyle.top = `${localPosition.y}px`;
    baseStyle.right = 'auto';
    baseStyle.bottom = 'auto';
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleButtonClick}
      disabled={isProcessing}
      data-testid="run-workflow-button"
      aria-label={isProcessing ? 'Workflow processing' : 'Run workflow'}
      aria-busy={isProcessing}
      style={baseStyle}
    >
      {isUnlocked && (
        <span
          role="button"
          aria-label="Drag to reposition button"
          tabIndex={0}
          onMouseDown={handleDragStart}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
            }
          }}
          title="Drag to reposition"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            marginRight: '2px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <FaGripLines size={12} aria-hidden="true" />
        </span>
      )}
      {isProcessing ? (
        <>
          <div
            role="status"
            aria-label="Processing"
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #fff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Processing...
        </>
      ) : (
        <>
          <FaPlay size={16} aria-hidden="true" />
          Run Workflow
        </>
      )}
    </button>
  );
};

export default FloatingProcessButton;
