import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FaGripLines, FaPlay } from 'react-icons/fa';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const FloatingProcessButton = ({
  onClick,
  isProcessing,
  isUnlocked = false,
  position = null,
  onPositionChange
}) => {
  const buttonRef = useRef(null);
  const dragStateRef = useRef(null);
  const suppressClickRef = useRef(false);
  const positionRef = useRef(position);
  const [isDragging, setIsDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState(position);

  const clampPosition = (candidate) => {
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
  };

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
  }, [position, isDragging, onPositionChange]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (event) => {
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
          onPositionChange(positionRef.current);
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
  }, [isDragging, onPositionChange]);

  const handleDragStart = (event) => {
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
      moved: false
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

  const baseStyle = {
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
    opacity: isProcessing ? 0.8 : 1
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
      style={baseStyle}
    >
      {isUnlocked && (
        <span
          onMouseDown={handleDragStart}
          onClick={(event) => event.stopPropagation()}
          title="Drag to reposition"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            marginRight: '2px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <FaGripLines size={12} />
        </span>
      )}
      {isProcessing ? (
        <>
          <div 
            style={{ 
              width: '16px', 
              height: '16px', 
              border: '2px solid #fff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} 
          />
          Processing...
        </>
      ) : (
        <>
          <FaPlay size={16} />
          Run Workflow
        </>
      )}
    </button>
  );
};

FloatingProcessButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool.isRequired,
  isUnlocked: PropTypes.bool,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  }),
  onPositionChange: PropTypes.func
};

export default FloatingProcessButton;
