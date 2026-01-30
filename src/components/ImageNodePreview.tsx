/**
 * ImageNodePreview - Display component for image generation nodes.
 * Shows generated image with hover overlay for prompt input.
 */

import React, { MouseEvent, SyntheticEvent } from 'react';
import { MinimalPromptInput } from './MinimalPromptInput';
import { ImagePreviewStrip } from './ImagePreviewStrip';

interface ImageNodePreviewProps {
  nodeId: string;
  imageUrl: string | null;
  prompt: string;
  previewPrompt?: string;
  showChipPreview?: boolean;
  hasChipsConnected?: boolean;
  isProcessing: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onImageError: () => void;
}

/**
 * Image preview component with hover overlay for prompt input.
 * Shows the generated image and allows editing the prompt on hover.
 */
export const ImageNodePreview: React.FC<ImageNodePreviewProps> = ({
  nodeId,
  imageUrl,
  prompt,
  previewPrompt,
  showChipPreview = false,
  hasChipsConnected = false,
  isProcessing,
  onPromptChange,
  onSubmit,
  onImageError,
}) => {
  if (isProcessing && !imageUrl) {
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

  if (!imageUrl) {
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
          placeholder="Type something or generate without a prompt"
          isProcessing={isProcessing}
        />
      </div>
    );
  }

  return (
    <>
      <img
        src={imageUrl}
        alt={prompt || 'Generated image'}
        className="node-preview-image nodrag"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        onError={(_e: SyntheticEvent<HTMLImageElement>) => {
          console.error('Failed to load image preview:', {
            url: imageUrl?.substring(0, 100) + (imageUrl?.length > 100 ? '...' : ''),
            isDataUrl: imageUrl?.startsWith('data:'),
            isHttpUrl: imageUrl?.startsWith('http'),
          });
          onImageError();
        }}
      />
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
            placeholder="Type something or generate without a prompt"
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </>
  );
};

export default ImageNodePreview;
