import React from "react";
import { invoke } from '@tauri-apps/api/core';
import { useReactFlow } from 'reactflow';
import BaseNode from "../../components/BaseNode";
import { SchemaForm } from "../../components/SchemaForm";
import { NodeSettingsPopover } from "../../components/NodeSettingsPopover";
import { ReplicateModelPicker } from "../../components/ReplicateModelPicker";
import { MinimalPromptInput } from "../../components/MinimalPromptInput";
import { ImagePreviewStrip } from "../../components/ImagePreviewStrip";
import { HANDLE_TYPES } from "../../constants/handleTypes";
import { getNodeSchema, parseNodeData } from "../nodeSchemas";
import NodeSettingsClipboard from "../../components/NodeSettingsClipboard";
import { emit, on } from "../../utils/eventBus";
import { fetchModelSchema, buildReplicateInput } from "../../utils/replicateSchemaCache";

export const NODE_TYPE = "video";
const definition = getNodeSchema(NODE_TYPE);
const handles = definition?.handles || [];

export const createNode = ({ id, handleRemoveNode, position, defaultModel }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 320, height: 280 },
  data: {
    title: "Video Generation",
    onRemove: handleRemoveNode,
    handles,
    ...definition.defaults,
    ...(defaultModel ? { model: defaultModel } : {}),
    output: null,
    status: "idle"
  }
});

const VideoNode = ({ id, data, selected }) => {
  const { getEdges, getNodes } = useReactFlow();
  const [formState, setFormState] = React.useState(() => parseNodeData(definition, data));
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [videoUrl, setVideoUrl] = React.useState(data.output || null);
  const [inputVideoUrl, setInputVideoUrl] = React.useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = React.useState(false);
  const [showChipPreview, setShowChipPreview] = React.useState(true); // Default ON

  React.useEffect(() => {
    if (data.output && data.output !== videoUrl) {
      setVideoUrl(data.output);
    }
    if (!data.output && videoUrl) {
      setVideoUrl(null);
    }
  }, [data.output, videoUrl]);

  // Store chip values for dynamic placeholder replacement
  const [chipValues, setChipValues] = React.useState({});

  // Check if any chips are connected
  const hasChipsConnected = Object.keys(chipValues).length > 0;

  // Compute prompt with chip placeholders replaced for preview
  const promptWithChips = React.useMemo(() => {
    let result = formState.prompt || '';
    Object.entries(chipValues).forEach(([chipId, value]) => {
      const pattern = new RegExp(`__${chipId}__`, 'gi');
      result = result.replace(pattern, value);
    });
    return result;
  }, [formState.prompt, chipValues]);

  // Listen for input from connected nodes
  React.useEffect(() => {
    const handleNodeContentChanged = (event) => {
      const { targetId, targetHandle, content } = event.detail;

      if (targetId === id) {
        // Handle chip inputs - store separately for placeholder replacement
        if (content?.isChip && content?.chipId) {
          setChipValues(prev => ({
            ...prev,
            [content.chipId]: content.value || ''
          }));
          data.chipValues = {
            ...(data.chipValues || {}),
            [content.chipId]: content.value || ''
          };
        } else if (targetHandle === "prompt-in" && content?.type === HANDLE_TYPES.TEXT.type) {
          setFormState(prev => {
            const next = { ...prev, prompt: content.value || "" };
            data.prompt = next.prompt;
            return next;
          });
        } else if (targetHandle === "image-in" && content?.type === HANDLE_TYPES.IMAGE.type) {
          setFormState(prev => {
            const next = { ...prev, imageUrl: content.value || "" };
            data.imageUrl = next.imageUrl;
            return next;
          });
        }
      }
    };

    const offNodeContentChanged = on("nodeContentChanged", handleNodeContentChanged);
    return () => offNodeContentChanged();
  }, [id, data]);

  // Close model picker when clicking outside
  React.useEffect(() => {
    if (!isModelPickerOpen) return;

    const handleClickOutside = (event) => {
      const modelPicker = event.target.closest('.replicate-model-picker');
      const metadataBadge = event.target.closest('.node-metadata-badge');
      
      if (!modelPicker && !metadataBadge) {
        setIsModelPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelPickerOpen]);

  const dispatchOutput = (value) => {
    const edges = window.edgesRef?.current || [];
    const outgoing = edges.filter((edge) => edge.source === id && edge.sourceHandle === "video-out");

    const payload = {
      type: HANDLE_TYPES.VIDEO.type,
      value,
      model: formState.model,
      fromWorkflow: true
    };

    outgoing.forEach((edge) => {
      emit("nodeContentChanged", {
        sourceId: id,
        targetId: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        content: payload
      });
    });
  };

  const handleGenerate = async () => {
    setStatus("processing");
    setError(null);

    try {
      const prompt = formState.prompt || data.content || "";

      if (!prompt.trim()) {
        throw new Error("Please provide a prompt");
      }

      if (!formState.model.trim()) {
        throw new Error("Please specify a model");
      }

      // Validate model format (should be owner/name)
      const modelParts = formState.model.trim().split('/');
      if (modelParts.length !== 2 || !modelParts[0] || !modelParts[1]) {
        throw new Error(
          `Invalid model format: "${formState.model}". ` +
          'Model must be in format "owner/name" (e.g., "minimax/video-01"). ' +
          'Please check the Replicate model page for the correct format.'
        );
      }

      // Build input for Replicate
      const input = { prompt };
      
      // Add optional parameters if provided
      if (formState.imageUrl && formState.imageUrl.trim()) {
        input.image = formState.imageUrl;
      }
      if (formState.duration) {
        input.duration = formState.duration;
      }
      if (formState.fps) {
        input.fps = formState.fps;
      }

      console.log("Creating Replicate video prediction:", { model: formState.model, input });

      const prediction = await invoke('replicate_create_prediction', {
        model: formState.model,
        input
      });

      console.log("Prediction created:", prediction);

      // Poll for completion - videos take longer
      let currentPrediction = prediction;
      const maxAttempts = 300; // 5 minutes for video generation
      let attempts = 0;

      while (
        currentPrediction.status !== "succeeded" &&
        currentPrediction.status !== "failed" &&
        currentPrediction.status !== "canceled" &&
        attempts < maxAttempts
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentPrediction = await invoke('replicate_get_prediction', {
          predictionId: currentPrediction.id
        });
        attempts++;
        
        // Log progress every 10 seconds
        if (attempts % 10 === 0) {
          console.log(`Polling attempt ${attempts}:`, currentPrediction.status);
        }
      }

      if (currentPrediction.status === "succeeded") {
        const output = currentPrediction.output;
        let result;

        // Handle different output formats
        if (Array.isArray(output) && output.length > 0) {
          result = output[0]; // Use first video
        } else if (typeof output === 'string') {
          result = output;
        } else {
          throw new Error("Unexpected output format");
        }

        data.output = result;
        data.metadata = formState.model.split('/').pop() || formState.model;
        setVideoUrl(result);
        dispatchOutput(result);
      } else if (currentPrediction.status === "failed") {
        throw new Error(currentPrediction.error || "Prediction failed");
      } else if (currentPrediction.status === "canceled") {
        throw new Error("Prediction was canceled");
      } else {
        throw new Error("Prediction timed out");
      }
    } catch (e) {
      console.error("Error generating video:", e);
      setError(e.message || e.toString() || "Failed to run model");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <>
      <BaseNode
        id={id}
        data={{
          ...data,
          title: "Video Generation",
          metadata: data.metadata || (formState.model ? formState.model.split('/').pop() : null),
          onMetadataClick: () => setIsModelPickerOpen(true)
        }}
        handles={handles}
        selected={selected}
        error={error}
        isLoading={status === "processing"}
        onSettingsClick={() => setIsSettingsOpen(true)}
      >
        {isModelPickerOpen && (
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10000,
              minWidth: '300px'
            }}
            className="nodrag"
            onClick={(e) => e.stopPropagation()}
          >
            <ReplicateModelPicker
              value={formState.model}
              onChange={(newModel) => {
                const next = { ...formState, model: newModel };
                setFormState(next);
                data.model = newModel;
                data.metadata = newModel.split('/').pop();
                setIsModelPickerOpen(false);
              }}
              placeholder="Search for video models..."
              collectionSlug={["text-to-video", "ai-enhance-videos", "official"]}
            />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {(status === "processing" || data.isProcessing) && (
            <div className="node-noise-overlay" aria-hidden="true" />
          )}
          {videoUrl ? (
            <>
              <video
                src={videoUrl}
                controls
                className="node-preview-video nodrag"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  console.error('Failed to load video preview:', e);
                  setVideoUrl(null);
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
                  pointerEvents: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
              >
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                  pointerEvents: 'none'
                }} />
                <div style={{
                  position: 'relative',
                  minHeight: '50px',
                  pointerEvents: 'auto',
                  paddingTop: '10px'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    pointerEvents: 'auto',
                    marginBottom: '8px'
                  }}>
                    <ImagePreviewStrip nodeId={id} />
                  </div>
                  <MinimalPromptInput
                    value={formState.prompt}
                    previewValue={promptWithChips}
                    showPreview={showChipPreview && hasChipsConnected}
                    onChange={(value) => {
                      const next = { ...formState, prompt: value };
                      setFormState(next);
                      data.prompt = value;
                    }}
                    onSubmit={handleGenerate}
                    placeholder="Type something or generate without a prompt"
                    isProcessing={status === "processing"}
                  />
                </div>
              </div>
            </>
          ) : status === "processing" ? (
            <div style={{
              color: 'var(--text-color)',
              opacity: 0.5,
              fontSize: '13px'
            }}>
              Generating...
            </div>
          ) : (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              minHeight: '50px'
            }}>
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                pointerEvents: 'auto',
                marginBottom: '8px'
              }}>
                <ImagePreviewStrip nodeId={id} />
              </div>
              <MinimalPromptInput
                value={formState.prompt}
                onChange={(value) => {
                  const next = { ...formState, prompt: value };
                  setFormState(next);
                  data.prompt = value;
                }}
                onSubmit={handleGenerate}
                placeholder="Type something or generate without a prompt"
                isProcessing={status === "processing"}
              />
            </div>
          )}
        </div>
        {error && (
          <div style={{
            color: '#ef4444',
            fontSize: '12px',
            marginTop: '8px',
            padding: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}
      </BaseNode>

      <NodeSettingsPopover
        isOpen={selected}
        onClose={() => {}}
        title="Video Generation Settings"
        renderToPortal={true}
      >
        <NodeSettingsClipboard
          nodeType={NODE_TYPE}
          values={formState}
          onApply={(next) => {
            setFormState(next);
            Object.assign(data, next);
            if (next.model) {
              data.metadata = next.model.split('/').pop();
            }
          }}
        />
        {hasChipsConnected && (
          <div className="chip-preview-toggle" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid var(--border-color, #333)',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-color)' }}>
              Show chip preview
            </span>
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
                cursor: 'pointer'
              }}
            >
              {showChipPreview ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
        <SchemaForm
          definition={definition}
          values={formState}
          onChange={(next) => {
            setFormState(next);
            Object.assign(data, next);
            if (next.model) {
              data.metadata = next.model.split('/').pop();
            }
          }}
        />
        <button
          className="primary-button"
          onClick={(e) => {
            e.preventDefault();
            handleGenerate();
            setIsSettingsOpen(false);
          }}
          disabled={status === "processing"}
          style={{ marginTop: 12, width: '100%' }}
        >
          {status === "processing" ? "Generating..." : "Generate Video"}
        </button>
      </NodeSettingsPopover>
    </>
  );
};

export default VideoNode;
