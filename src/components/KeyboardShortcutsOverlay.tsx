import React, { useEffect, useCallback } from 'react';
import { FaTimes } from 'react-icons/fa';
import './KeyboardShortcutsOverlay.css';

// =============================================================================
// Types
// =============================================================================

interface ShortcutItem {
  action: string;
  keys: string[];
  separator?: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// Shortcut Data
// =============================================================================

const shortcutSections: ShortcutSection[] = [
  {
    title: 'Node Operations',
    shortcuts: [
      { action: 'Delete selected nodes', keys: ['Delete'], separator: ' or ' },
      { action: 'Delete selected nodes (Mac)', keys: ['Backspace'] },
      { action: 'Duplicate selected nodes', keys: ['Ctrl', 'D'] },
      { action: 'Copy selected nodes', keys: ['Ctrl', 'C'] },
      { action: 'Paste nodes', keys: ['Ctrl', 'V'] },
    ],
  },
  {
    title: 'Grouping',
    shortcuts: [
      { action: 'Group selected nodes', keys: ['Ctrl', 'G'] },
      { action: 'Ungroup selected group', keys: ['Ctrl', 'Shift', 'G'] },
    ],
  },
  {
    title: 'History',
    shortcuts: [
      { action: 'Undo', keys: ['Ctrl', 'Z'] },
      { action: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
      { action: 'Redo (alternate)', keys: ['Ctrl', 'Y'] },
    ],
  },
  {
    title: 'Workflow',
    shortcuts: [
      { action: 'Run workflow', keys: ['Ctrl', 'Enter'] },
      { action: 'Show keyboard shortcuts', keys: ['?'] },
    ],
  },
];

// =============================================================================
// Component
// =============================================================================

/**
 * KeyboardShortcutsOverlay - Modal overlay showing available keyboard shortcuts
 *
 * Opens with '?' key, closes with Escape or clicking outside.
 */
export const KeyboardShortcutsOverlay: React.FC<KeyboardShortcutsOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="keyboard-shortcuts-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div className="keyboard-shortcuts-modal">
        <div className="keyboard-shortcuts-header">
          <h2 id="keyboard-shortcuts-title">Keyboard Shortcuts</h2>
          <button
            className="keyboard-shortcuts-close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            <FaTimes />
          </button>
        </div>

        <div className="keyboard-shortcuts-content">
          {shortcutSections.map((section) => (
            <div key={section.title} className="keyboard-shortcuts-section">
              <h3 className="keyboard-shortcuts-section-title">{section.title}</h3>
              <div className="keyboard-shortcuts-list">
                {section.shortcuts.map((shortcut, index) => (
                  <div key={index} className="keyboard-shortcut-item">
                    <span className="keyboard-shortcut-action">{shortcut.action}</span>
                    <div className="keyboard-shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {keyIndex > 0 && <span className="keyboard-shortcut-separator">+</span>}
                          <kbd className="keyboard-shortcut-key">{key}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="keyboard-shortcuts-footer">
          <span className="keyboard-shortcuts-footer-hint">
            Press <kbd>Esc</kbd> or click outside to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsOverlay;
