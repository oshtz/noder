import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right';

export interface PopoverProps {
  /** Content to render inside the popover */
  children: React.ReactNode;
  /** Ref to the target element the popover is anchored to */
  targetRef: React.RefObject<HTMLElement>;
  /** Called when the popover should close */
  onClose: () => void;
  /** Position relative to target element */
  position?: PopoverPosition;
  /** Whether the popover is being dragged */
  isDragging?: boolean;
}

interface PopoverSize {
  width: number;
  height: number;
}

/**
 * Popover - Floating content anchored to a target element
 * Features:
 * - Click outside to close
 * - Escape key to close
 * - Smart positioning with viewport boundaries
 * - Rendered via portal for proper z-index
 */
const Popover: React.FC<PopoverProps> = ({
  children,
  targetRef,
  onClose,
  position = 'bottom',
  isDragging = false,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverSize, setPopoverSize] = useState<PopoverSize>({ width: 400, height: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        targetRef.current &&
        !targetRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, targetRef]);

  useEffect(() => {
    // Add ESC key listener to close popover
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  // Track popover size so positioning clamps to actual rendered width
  useLayoutEffect(() => {
    if (!popoverRef.current) return;

    const measure = () => {
      if (!popoverRef.current) return;
      const rect = popoverRef.current.getBoundingClientRect();
      setPopoverSize({
        width: rect.width || 400,
        height: rect.height || 0,
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(popoverRef.current);

    window.addEventListener('resize', measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [children]);

  if (!targetRef.current) return null;

  const targetRect = targetRef.current.getBoundingClientRect();
  const popoverWidth = popoverSize.width || 400;

  let popoverStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
  };

  // Position the popover based on the specified position
  switch (position) {
    case 'top':
      popoverStyle = {
        ...popoverStyle,
        bottom: `${window.innerHeight - targetRect.top + 5}px`,
        left: `${targetRect.left + targetRect.width / 2}px`,
        transform: 'translateX(-50%)',
      };
      break;
    case 'right': {
      // Center the popover vertically on screen
      const screenCenterY = window.innerHeight / 2;
      const leftPosition = targetRect.right + 12;

      // Check if popover would overflow viewport and adjust if needed
      const viewportWidth = window.innerWidth;
      const wouldOverflow = leftPosition + popoverWidth > viewportWidth;

      popoverStyle = {
        ...popoverStyle,
        top: `${screenCenterY}px`,
        left: wouldOverflow ? `${viewportWidth - popoverWidth - 16}px` : `${leftPosition}px`,
        transform: 'translateY(-50%)',
        maxHeight: `calc(100vh - 32px)`,
      };
      break;
    }
    case 'left':
      popoverStyle = {
        ...popoverStyle,
        top: `${targetRect.top}px`,
        right: `${window.innerWidth - targetRect.left + 5}px`,
      };
      break;
    case 'bottom':
    default:
      popoverStyle = {
        ...popoverStyle,
        top: `${targetRect.bottom + 5}px`,
        left: `${targetRect.left + targetRect.width / 2}px`,
        transform: 'translateX(-50%)',
      };
      break;
  }

  return createPortal(
    <div
      ref={popoverRef}
      className={`popover${isDragging ? ' dragging' : ''}`}
      style={popoverStyle}
    >
      {children}
    </div>,
    document.body
  );
};

export default Popover;
