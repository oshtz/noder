/**
 * TextNodePreview - Display component for text generation nodes.
 * Shows generated text with hover overlay for prompt input.
 */

import React, { MouseEvent } from 'react';
import { MinimalPromptInput } from './MinimalPromptInput';
import { ImagePreviewStrip } from './ImagePreviewStrip';

interface TextNodePreviewProps {
  nodeId: string;
  outputText: string | null;
  prompt: string;
  previewPrompt?: string;
  showChipPreview?: boolean;
  hasChipsConnected?: boolean;
  isProcessing: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * Text preview component with hover overlay for prompt input.
 * Shows the generated text and allows editing the prompt on hover.
 */
export const TextNodePreview: React.FC<TextNodePreviewProps> = ({
  nodeId,
  outputText,
  prompt,
  previewPrompt,
  showChipPreview = false,
  hasChipsConnected = false,
  isProcessing,
  onPromptChange,
  onSubmit,
}) => {
  if (isProcessing && !outputText) {
    return (
      <div
        style={{
          color: 'var(--text-color)',
          opacity: 0.5,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }}
      >
        Generating...
      </div>
    );
  }

  if (!outputText) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: '50px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            pointerEvents: 'auto',
            marginBottom: '8px',
          }}
        >
          <ImagePreviewStrip nodeId={nodeId} />
        </div>
        <MinimalPromptInput
          value={prompt}
          onChange={onPromptChange}
          onSubmit={onSubmit}
          placeholder="Type a prompt..."
          isProcessing={isProcessing}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="node-text-preview nodrag"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          padding: '12px',
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5',
        }}
      >
        {outputText}
      </div>
      <div
        className="prompt-overlay-container"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: '60px',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }}
        onMouseEnter={(e: MouseEvent<HTMLDivElement>) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e: MouseEvent<HTMLDivElement>) => (e.currentTarget.style.opacity = '0')}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            minHeight: '50px',
            pointerEvents: 'auto',
            paddingTop: '10px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              pointerEvents: 'auto',
              marginBottom: '8px',
            }}
          >
            <ImagePreviewStrip nodeId={nodeId} />
          </div>
          <MinimalPromptInput
            value={prompt}
            previewValue={previewPrompt}
            showPreview={showChipPreview && hasChipsConnected}
            onChange={onPromptChange}
            onSubmit={onSubmit}
            placeholder="Type a prompt..."
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </>
  );
};

export default TextNodePreview;
