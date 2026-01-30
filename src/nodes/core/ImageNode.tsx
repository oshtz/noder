/**
 * ImageNode - A node for generating images using Replicate models.
 * Supports text-to-image, image-to-image, and various image editing models.
 */

import React, { useState, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { useEdges, useNodes, Edge, Node } from 'reactflow';
import BaseNode from '../../components/BaseNode';
import { NodeSettingsPopover } from '../../components/NodeSettingsPopover';
import { ReplicateModelPicker } from '../../components/ReplicateModelPicker';
import ImageNodePreview from '../../components/ImageNodePreview';
import ImageNodeSettings from '../../components/ImageNodeSettings';
import { HANDLE_TYPES } from '../../constants/handleTypes';
import { getNodeSchema, parseNodeData, NodeSchemaDefinition } from '../nodeSchemas';
import { on } from '../../utils/eventBus';
import { useImageNodeSchema } from '../../hooks/useImageNodeSchema';
import { useImageGeneration } from '../../hooks/useGeneration';
import type {
  ImageNodeProps,
  CreateImageNodeParams,
  ImageNodeData,
  ImageFormState,
  ConnectedImagePreview,
  NodeContentChangedEvent,
} from '../../types/imageNode';

// =============================================================================
// Constants
// =============================================================================

export const NODE_TYPE = 'image';
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
}: CreateImageNodeParams): {
  id: string;
  type: string;
  position: { x: number; y: number };
  style: { width: number; height: number };
  data: ImageNodeData;
} => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 320, height: 280 },
  data: {
    title: 'Image Generation',
    onRemove: handleRemoveNode,
    handles,
    ...definition.defaults,
    ...(defaultModel ? { model: defaultModel } : {}),
    output: null,
    status: 'idle',
  } as ImageNodeData,
});

// =============================================================================
// ImageNode Component
// =============================================================================

const ImageNode: React.FC<ImageNodeProps> = ({ id, data, selected = false }) => {
  const edges = useEdges();
  const nodes = useNodes();

  // Form state
  const [formState, setFormState] = useState<ImageFormState>(
    () => parseNodeData(definition, data) as ImageFormState
  );
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [chipValues, setChipValues] = useState<Record<string, string>>({});
  const [showChipPreview, setShowChipPreview] = useState(true);
  const [connectedImagePreviews, setConnectedImagePreviews] = useState<ConnectedImagePreview[]>([]);

  // Schema hook
  const { dynamicFields, schemaStatus, schemaError, activeDefinition, refreshSchema } =
    useImageNodeSchema({
      modelId: formState.model,
      definition,
      formState,
      setFormState,
      data: data as Record<string, unknown>,
    });

  // Generation hook
  const {
    status,
    error,
    output: imageUrl,
    setOutput: setImageUrl,
    handleGenerate,
  } = useImageGeneration({
    nodeId: id,
    data,
    formState,
  });

  // Sync imageUrl with data.output
  useEffect(() => {
    if (data.output && data.output !== imageUrl) {
      setImageUrl(data.output);
    }
    if (!data.output && imageUrl) {
      setImageUrl(null);
    }
  }, [data.output, imageUrl, setImageUrl]);

  // Collect connected image previews
  const collectConnectedImagePreviews = useCallback((): void => {
    const imageEdges = edges.filter((e: Edge) => e.target === id && e.targetHandle === 'in');
    const previews: ConnectedImagePreview[] = imageEdges
      .map((edge: Edge) => {
        const sourceNode = nodes.find((n: Node) => n.id === edge.source);
        if (!sourceNode) return null;
        const sourceData = (sourceNode.data || {}) as ImageNodeData;
        const url =
          sourceData.convertedSrc ||
          sourceData.output ||
          (sourceData.mediaPath?.startsWith('data:') ? sourceData.mediaPath : null) ||
          sourceData.imageUrl ||
          null;
        return {
          sourceId: sourceNode.id,
          title: sourceData.title || sourceNode.type || sourceNode.id,
          url,
        };
      })
      .filter((p): p is ConnectedImagePreview => p !== null);

    setConnectedImagePreviews(previews);
  }, [edges, nodes, id]);

  useEffect(() => {
    if (selected) {
      collectConnectedImagePreviews();
    }
  }, [selected, collectConnectedImagePreviews]);

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
            collectConnectedImagePreviews();
          }
        }
      }
    };

    const off = on('nodeContentChanged', handleNodeContentChanged as (event: unknown) => void);
    return () => off();
  }, [id, data, collectConnectedImagePreviews]);

  // Clear previews when edges change
  useEffect(() => {
    const handleEdgesChange = (): void => {
      const imageEdges = edges.filter((e: Edge) => e.target === id && e.targetHandle === 'in');
      if (imageEdges.length === 0) {
        setConnectedImagePreviews([]);
      }
      collectConnectedImagePreviews();
    };

    const off = on('edgesChange', handleEdgesChange);
    return () => off();
  }, [collectConnectedImagePreviews, edges, id]);

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
    (next: ImageFormState) => {
      setFormState(next);
      Object.assign(data, next);
      if (next.model) {
        data.metadata = next.model.split('/').pop();
      }
    },
    [data]
  );

  const handleApplyClipboard = useCallback(
    (next: ImageFormState) => {
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

  const handleImageError = useCallback(() => {
    setImageUrl(null);
    data.output = null;
  }, [data, setImageUrl]);

  return (
    <>
      <BaseNode
        id={id}
        data={{
          ...data,
          title: 'Image Generation',
          metadata: data.metadata || (formState.model ? formState.model.split('/').pop() : null),
          onMetadataClick: () => setIsModelPickerOpen(true),
        }}
        handles={handles}
        selected={selected}
        error={error}
        isLoading={status === 'processing'}
        onSettingsClick={() => {}}
        contentStyle={{
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
        }}
        dragHandleStyle={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '16px',
          minHeight: 0,
          padding: 0,
          zIndex: 2,
        }}
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
              placeholder="Search for image models..."
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
          {(status === 'processing' || data.isProcessing) && (
            <div className="node-noise-overlay" aria-hidden="true" />
          )}
          <ImageNodePreview
            nodeId={id}
            imageUrl={imageUrl}
            prompt={formState.prompt || ''}
            previewPrompt={promptWithChips}
            showChipPreview={showChipPreview}
            hasChipsConnected={hasChipsConnected}
            isProcessing={status === 'processing'}
            onPromptChange={handlePromptChange}
            onSubmit={handleGenerate}
            onImageError={handleImageError}
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
        title="Image Generation Settings"
        renderToPortal={true}
      >
        <ImageNodeSettings
          nodeType={NODE_TYPE}
          formState={formState}
          activeDefinition={activeDefinition}
          schemaStatus={schemaStatus}
          schemaError={schemaError}
          dynamicFieldCount={dynamicFields.length}
          hasChipsConnected={hasChipsConnected}
          showChipPreview={showChipPreview}
          connectedImagePreviews={connectedImagePreviews}
          isProcessing={status === 'processing'}
          onFormChange={handleFormChange}
          onApplyClipboard={handleApplyClipboard}
          onToggleChipPreview={() => setShowChipPreview(!showChipPreview)}
          onRefreshSchema={refreshSchema}
          onGenerate={handleGenerate}
        />
      </NodeSettingsPopover>
    </>
  );
};

export default ImageNode;
