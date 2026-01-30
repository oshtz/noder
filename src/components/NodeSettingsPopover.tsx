import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import './NodeSettingsPopover.css';

const STORAGE_KEY = 'nodeSettingsPopoverWidth';
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 240;
const MAX_WIDTH = 600;

export interface NodeSettingsPopoverProps {
  /** Whether the popover is visible */
  isOpen: boolean;
  /** Called when the popover should close */
  onClose: () => void;
  /** Content to render inside the popover */
  children: React.ReactNode;
  /** Title displayed in the popover header */
  title?: string;
  /** Whether to render using a portal at app level */
  renderToPortal?: boolean;
}

/**
 * NodeSettingsPopover - Resizable side panel for node settings
 * Features:
 * - Resizable width with drag handle
 * - Persisted width to localStorage
 * - Optional portal rendering for proper z-index handling
 */
export const NodeSettingsPopover: React.FC<NodeSettingsPopoverProps> = ({
  isOpen,
  onClose: _onClose,
  children,
  title,
  renderToPortal = false,
}) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, width.toString());
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width based on mouse position from the right edge
      const newWidth = window.innerWidth - e.clientX - 20; // 20px is the right margin
      setWidth(Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH));
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add global mouse event listeners when resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={popoverRef}
      className={`node-settings-popover ${isResizing ? 'is-resizing' : ''}`}
      style={{ width: `${width}px` }}
    >
      <div className="popover-resize-handle" onMouseDown={handleMouseDown} title="Drag to resize" />
      <div className="popover-header">
        <h3>{title || 'Node Settings'}</h3>
      </div>
      <div className="popover-content">{children}</div>
    </div>
  );

  // Render to portal at app level if requested
  if (renderToPortal) {
    const portalRoot = document.getElementById('global-node-settings-portal');
    if (!portalRoot) return content; // Fallback to normal render
    return ReactDOM.createPortal(content, portalRoot);
  }

  return content;
};

export default NodeSettingsPopover;
