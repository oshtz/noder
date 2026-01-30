import React, { useRef, useLayoutEffect } from 'react';
import { TiArrowRightThick } from 'react-icons/ti';
import ShinyText from './ShinyText';
import './MinimalPromptInput.css';

export interface MinimalPromptInputProps {
  /** Current input value */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** Called when submitting (Tab key or button click) */
  onSubmit: () => void;
  /** Placeholder text shown when empty */
  placeholder?: string;
  /** Whether processing is in progress (disables input) */
  isProcessing?: boolean;
  /** Preview value showing prompt with chip replacements applied */
  previewValue?: string | null;
  /** Whether to show the preview value instead of the actual value */
  showPreview?: boolean;
}

/**
 * MinimalPromptInput - Clean prompt input with auto-resize
 * Features:
 * - Auto-resizing textarea
 * - Tab key to submit
 * - Preview mode for showing chip replacements
 * - Animated placeholder text
 */
export const MinimalPromptInput: React.FC<MinimalPromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type something or generate without a prompt',
  isProcessing = false,
  previewValue = null,
  showPreview = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxHeight = 160;

  // Check if there are chip placeholders that have been replaced
  const hasChipReplacements = previewValue !== null && previewValue !== value;
  const displayValue = showPreview && hasChipReplacements ? previewValue : value;

  const resizeTextarea = (element?: HTMLTextAreaElement | null): void => {
    const target = element || textareaRef.current;
    if (!target) return;
    target.style.height = '0px';
    const nextHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useLayoutEffect(() => {
    resizeTextarea();
  }, [displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    if (!showPreview || !hasChipReplacements) {
      resizeTextarea(e.target);
      onChange(e.target.value);
    }
  };

  return (
    <div className="minimal-prompt-input" role="group" aria-label="Prompt input">
      <div className="minimal-prompt-wrapper">
        {!displayValue && (
          <div className="minimal-prompt-placeholder" aria-hidden="true">
            <ShinyText text={placeholder} speed={3} />
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="minimal-prompt-field nodrag"
          value={displayValue || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder=""
          disabled={isProcessing || (showPreview && hasChipReplacements)}
          rows={1}
          aria-label="Enter your prompt"
          aria-describedby="prompt-hint"
          style={
            showPreview && hasChipReplacements
              ? { color: 'var(--primary-color, #6366f1)' }
              : undefined
          }
        />
        <span id="prompt-hint" className="visually-hidden">
          Press Tab to submit
        </span>
      </div>
      <button
        className="minimal-prompt-submit nodrag"
        onClick={onSubmit}
        disabled={isProcessing}
        aria-label="Submit prompt"
        title="Generate (Tab)"
      >
        <TiArrowRightThick aria-hidden="true" />
      </button>
    </div>
  );
};

export default MinimalPromptInput;
