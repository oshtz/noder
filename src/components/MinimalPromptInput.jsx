import React from 'react';
import './MinimalPromptInput.css';
import ShinyText from './ShinyText';
import { TiArrowRightThick } from "react-icons/ti";

export const MinimalPromptInput = ({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = "Type something or generate without a prompt",
  isProcessing = false,
  previewValue = null, // Shows the prompt with chip replacements applied
  showPreview = false // Controlled from parent (settings panel)
}) => {
  const textareaRef = React.useRef(null);
  const maxHeight = 160;

  // Check if there are chip placeholders that have been replaced
  const hasChipReplacements = previewValue && previewValue !== value;
  const displayValue = showPreview && hasChipReplacements ? previewValue : value;

  const resizeTextarea = (element) => {
    const target = element || textareaRef.current;
    if (!target) return;
    target.style.height = '0px';
    const nextHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  React.useLayoutEffect(() => {
    resizeTextarea();
  }, [displayValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="minimal-prompt-input">
      <div className="minimal-prompt-wrapper">
        {!displayValue && (
          <div className="minimal-prompt-placeholder">
            <ShinyText text={placeholder} speed={3} />
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="minimal-prompt-field nodrag"
          value={displayValue}
          onChange={(e) => {
            if (!showPreview || !hasChipReplacements) {
              resizeTextarea(e.target);
              onChange(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder=""
          disabled={isProcessing || (showPreview && hasChipReplacements)}
          rows={1}
          style={showPreview && hasChipReplacements ? { color: 'var(--primary-color, #6366f1)' } : undefined}
        />
      </div>
      <button
        className="minimal-prompt-submit nodrag"
        onClick={onSubmit}
        disabled={isProcessing}
        title="Generate (Tab)"
      >
        <TiArrowRightThick />
      </button>
    </div>
  );
};

export default MinimalPromptInput;
