/**
 * ImageNodeSettings - Settings panel content for image generation nodes.
 * Shows schema form, chip preview toggle, and generation controls.
 */

import React, { MouseEvent } from 'react';
import { SchemaForm } from './SchemaForm';
import NodeSettingsClipboard from './NodeSettingsClipboard';
import type { SchemaStatus, ImageFormState, ConnectedImagePreview } from '../types/imageNode';
import type { NodeSchemaDefinition } from '../nodes/nodeSchemas';

interface ImageNodeSettingsProps {
  nodeType: string;
  formState: ImageFormState;
  activeDefinition: NodeSchemaDefinition & { allowPassthrough?: boolean };
  schemaStatus: SchemaStatus;
  schemaError: string | null;
  dynamicFieldCount: number;
  hasChipsConnected: boolean;
  showChipPreview: boolean;
  connectedImagePreviews: ConnectedImagePreview[];
  isProcessing: boolean;
  onFormChange: (next: ImageFormState) => void;
  onApplyClipboard: (values: ImageFormState) => void;
  onToggleChipPreview: () => void;
  onRefreshSchema: () => void;
  onGenerate: () => void;
  onSettingsClose?: () => void;
}

/**
 * Settings panel content for ImageNode.
 * Renders inside NodeSettingsPopover when node is selected.
 */
export const ImageNodeSettings: React.FC<ImageNodeSettingsProps> = ({
  nodeType,
  formState,
  activeDefinition,
  schemaStatus,
  schemaError,
  dynamicFieldCount,
  hasChipsConnected,
  showChipPreview,
  connectedImagePreviews,
  isProcessing,
  onFormChange,
  onApplyClipboard,
  onToggleChipPreview,
  onRefreshSchema,
  onGenerate,
  onSettingsClose,
}) => {
  return (
    <>
      <NodeSettingsClipboard nodeType={nodeType} values={formState} onApply={onApplyClipboard} />

      {hasChipsConnected && (
        <div
          className="chip-preview-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid var(--border-color, #333)',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-color)' }}>Show chip preview</span>
          <button
            onClick={onToggleChipPreview}
            style={{
              background: showChipPreview ? 'var(--primary-color, #6366f1)' : 'transparent',
              border: '1px solid var(--primary-color, #6366f1)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: '600',
              color: showChipPreview ? 'white' : 'var(--primary-color, #6366f1)',
              cursor: 'pointer',
            }}
          >
            {showChipPreview ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {schemaStatus === 'loading' && (
        <div style={{ fontSize: '12px', opacity: 0.7 }}>Loading model schema...</div>
      )}

      {schemaStatus === 'loaded' && dynamicFieldCount > 0 && (
        <div style={{ fontSize: '12px', opacity: 0.7 }}>
          Model parameters loaded ({dynamicFieldCount})
        </div>
      )}

      {schemaStatus === 'error' && (
        <div style={{ fontSize: '12px', color: '#ef4444' }}>
          {schemaError || 'Unable to load model parameters.'}
        </div>
      )}

      <button
        onClick={onRefreshSchema}
        style={{
          fontSize: '11px',
          padding: '4px 8px',
          marginBottom: '8px',
          background: 'transparent',
          border: '1px solid var(--border-color, #444)',
          borderRadius: '4px',
          color: 'var(--text-color)',
          cursor: 'pointer',
          opacity: 0.7,
        }}
      >
        Refresh Model Schema
      </button>

      <SchemaForm
        definition={activeDefinition}
        values={formState}
        onChange={onFormChange}
        connectedInputs={{
          image: connectedImagePreviews,
        }}
      />

      <button
        className="primary-button"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          onGenerate();
          onSettingsClose?.();
        }}
        disabled={isProcessing}
        style={{ marginTop: 12, width: '100%' }}
      >
        {isProcessing ? 'Generating...' : 'Generate Image'}
      </button>
    </>
  );
};

export default ImageNodeSettings;
