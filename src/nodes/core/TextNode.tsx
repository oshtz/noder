/**
 * TextNode - A node for generating text using Replicate LLM models.
 * Supports text generation, speech-to-text, and multimodal inputs.
 */

import React, { useState, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { useEdges } from 'reactflow';
import BaseNode from '../../components/BaseNode';
import { SchemaForm } from '../../components/SchemaForm';
import { NodeSettingsPopover } from '../../components/NodeSettingsPopover';
import { ReplicateModelPicker } from '../../components/ReplicateModelPicker';
import TextNodePreview from '../../components/TextNodePreview';
import NodeSettingsClipboard from '../../components/NodeSettingsClipboard';
import { HANDLE_TYPES } from '../../constants/handleTypes';
import { getNodeSchema, parseNodeData, NodeSchemaDefinition } from '../nodeSchemas';
import { on } from '../../utils/eventBus';
import { useTextGeneration } from '../../hooks/useGeneration';
import type {
  TextNodeProps,
  CreateTextNodeParams,
  TextNodeData,
  TextFormState,
} from '../../types/textNode';

// =============================================================================
// Types for Events
// =============================================================================

interface ContentPayload {
  type: string;
  value?: string;
  url?: string;
  chipId?: string;
  isChip?: boolean;
}

interface NodeContentChangedEvent {
  detail: {
    targetId?: string;
    targetHandle?: string;
    content?: ContentPayload;
  };
}

// =============================================================================
// Constants
// =============================================================================

export const NODE_TYPE = 'text';
const definition = getNodeSchema(NODE_TYPE) as NodeSchemaDefinition;
const handles = definition?.handles || [];

// =============================================================================
// Node Factory
// =============================================================================

export const createNode = ({
  id,
  handleRemoveNode,
  position,
  defaultModel,
}: CreateTextNodeParams): {
  id: string;
  type: string;
  position: { x: number; y: number };
  style: { width: number; height: number };
  data: TextNodeData;
} => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 320, height: 280 },
  data: {
    title: 'Text',
    onRemove: handleRemoveNode,
    handles,
    ...definition.defaults,
    ...(defaultModel ? { model: defaultModel } : {}),
    output: null,
    status: 'idle',
  } as TextNodeData,
});

// =============================================================================
// TextNode Component
// =============================================================================

const TextNode: React.FC<TextNodeProps> = ({ id, data, selected = false }) => {
  const _edges = useEdges();

  // Form state
  const [formState, setFormState] = useState<TextFormState>(
    () => parseNodeData(definition, data) as TextFormState
  );
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [chipValues, setChipValues] = useState<Record<string, string>>({});
  const [showChipPreview, setShowChipPreview] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(data.imageUrl || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(data.audioUrl || null);

  // Generation hook
  const {
    status,
    error,
    output: outputText,
    setOutput: setOutputText,
    handleGenerate,
  } = useTextGeneration({
    nodeId: id,
    data,
    formState,
    connectedInputs: {
      image: imageUrl,
      audio: audioUrl,
    },
  });

  // Sync outputText with data.output
  useEffect(() => {
    if (data.output && data.output !== outputText) {
      setOutputText(data.output);
    }
    if (!data.output && outputText) {
      setOutputText(null);
    }
  }, [data.output, outputText, setOutputText]);

  // Sync form state with data changes
  useEffect(() => {
    const next = parseNodeData(definition, data) as TextFormState;
    setFormState((prev) => {
      if (
        prev.prompt === next.prompt &&
        prev.systemPrompt === next.systemPrompt &&
        prev.model === next.model &&
        prev.temperature === next.temperature &&
        prev.maxTokens === next.maxTokens &&
        prev.destinationFolder === next.destinationFolder
      ) {
        return prev;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.prompt,
    data.systemPrompt,
    data.model,
    data.temperature,
    data.maxTokens,
    data.destinationFolder,
  ]);

  // Listen for input from connected nodes
  useEffect(() => {
    const handleNodeContentChanged = (event: NodeContentChangedEvent): void => {
      const { targetId, content, targetHandle } = event.detail;

      if (targetId === id) {
        if (content?.isChip && content?.chipId) {
          setChipValues((prev) => ({
            ...prev,
            [content.chipId as string]: content.value || '',
          }));
          data.chipValues = {
            ...(data.chipValues || {}),
            [content.chipId as string]: content.value || '',
          };
        } else if (targetHandle === 'in') {
          if (content?.type === HANDLE_TYPES.TEXT.type) {
            setFormState((prev) => {
              const next = { ...prev, prompt: content.value || '' };
              data.prompt = next.prompt;
              return next;
            });
          } else if (content?.type === HANDLE_TYPES.IMAGE.type) {
            const imgUrl = content.value || content.url;
            setImageUrl(imgUrl || null);
            data.imageUrl = imgUrl;
          } else if (content?.type === HANDLE_TYPES.AUDIO.type) {
            const nextAudio = content.value || content.url;
            setAudioUrl(nextAudio || null);
            data.audioUrl = nextAudio;
          }
        }
      }
    };

    const off = on('nodeContentChanged', handleNodeContentChanged as (event: unknown) => void);
    return () => off();
  }, [id, data]);

  // Close model picker on outside click
  useEffect(() => {
    if (!isModelPickerOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent): void => {
      const target = event.target as Element;
      const modelPicker = target.closest('.replicate-model-picker');
      const metadataBadge = target.closest('.node-metadata-badge');

      if (!modelPicker && !metadataBadge) {
        setIsModelPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelPickerOpen]);

  // Computed values
  const hasChipsConnected = Object.keys(chipValues).length > 0;
  const promptWithChips = useMemo(() => {
    let result = formState.prompt || '';
    Object.entries(chipValues).forEach(([chipId, value]) => {
      const pattern = new RegExp(`__${chipId}__`, 'gi');
      result = result.replace(pattern, value);
    });
    return result;
  }, [formState.prompt, chipValues]);

  // Handlers
  const handlePromptChange = useCallback(
    (value: string) => {
      setFormState((prev) => {
        const next = { ...prev, prompt: value };
        data.prompt = value;
        return next;
      });
    },
    [data]
  );

  const handleFormChange = useCallback(
    (next: TextFormState) => {
      setFormState(next);
      Object.assign(data, next);
      if (next.model) {
        data.metadata = next.model.split('/').pop();
      }
    },
    [data]
  );

  const handleModelSelect = useCallback(
    (newModel: string) => {
      const next = { ...formState, model: newModel };
      setFormState(next);
      data.model = newModel;
      data.metadata = newModel.split('/').pop();
      setIsModelPickerOpen(false);
    },
    [formState, data]
  );

  return (
    <>
      <BaseNode
        id={id}
        data={{
          ...data,
          title: 'Text',
          metadata: data.metadata || (formState.model ? formState.model.split('/').pop() : null),
          onMetadataClick: () => setIsModelPickerOpen(true),
        }}
        handles={handles}
        selected={selected}
        error={error}
        isLoading={status === 'processing'}
        onSettingsClick={() => {}}
      >
        {isModelPickerOpen && (
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10000,
              minWidth: '300px',
            }}
            className="nodrag"
            onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          >
            <ReplicateModelPicker
              value={formState.model}
              onChange={handleModelSelect}
              placeholder="Search for text models..."
              collectionSlug={null}
            />
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <TextNodePreview
            nodeId={id}
            outputText={outputText}
            prompt={formState.prompt || ''}
            previewPrompt={promptWithChips}
            showChipPreview={showChipPreview}
            hasChipsConnected={hasChipsConnected}
            isProcessing={status === 'processing'}
            onPromptChange={handlePromptChange}
            onSubmit={handleGenerate}
          />
        </div>

        {error && (
          <div
            style={{
              color: '#ef4444',
              fontSize: '12px',
              marginTop: '8px',
              padding: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}
      </BaseNode>

      <NodeSettingsPopover
        isOpen={selected}
        onClose={() => {}}
        title="Text Settings"
        renderToPortal={true}
      >
        <NodeSettingsClipboard
          nodeType={NODE_TYPE}
          values={formState}
          onApply={(next: TextFormState) => {
            setFormState(next);
            Object.assign(data, next);
            if (next.model) {
              data.metadata = next.model.split('/').pop();
            }
          }}
        />
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
              onClick={() => setShowChipPreview(!showChipPreview)}
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
        <SchemaForm definition={definition} values={formState} onChange={handleFormChange} />
        <button
          className="primary-button"
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            handleGenerate();
          }}
          disabled={status === 'processing'}
          style={{ marginTop: 12, width: '100%' }}
        >
          {status === 'processing' ? 'Generating...' : 'Generate Text'}
        </button>
      </NodeSettingsPopover>
    </>
  );
};

export default TextNode;
