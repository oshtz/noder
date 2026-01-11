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

export const NODE_TYPE = "text";
const definition = getNodeSchema(NODE_TYPE);
const handles = definition?.handles || [];

export const createNode = ({ id, handleRemoveNode, position, defaultModel }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 320, height: 280 },
  data: {
    title: "Text",
    onRemove: handleRemoveNode,
    handles,
    ...definition.defaults,
    ...(defaultModel ? { model: defaultModel } : {}),
    output: null,
    status: "idle"
  }
});

const TextNode = ({ id, data, selected }) => {
  const { getEdges, getNodes } = useReactFlow();
  const [formState, setFormState] = React.useState(() => parseNodeData(definition, data));
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [outputText, setOutputText] = React.useState(data.output || null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState(data.imageUrl || null);
  const [audioUrl, setAudioUrl] = React.useState(data.audioUrl || null);
  const [showChipPreview, setShowChipPreview] = React.useState(true); // Default ON
  
  React.useEffect(() => {
    if (data.output && data.output !== outputText) {
      setOutputText(data.output);
    }
    if (!data.output && outputText) {
      setOutputText(null);
    }
  }, [data.output, outputText]);

  React.useEffect(() => {
    const next = parseNodeData(definition, data);
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
  }, [
    data.prompt,
    data.systemPrompt,
    data.model,
    data.temperature,
    data.maxTokens,
    data.destinationFolder
  ]);

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

  // Listen for input from connected nodes (single handle accepts all types)
  React.useEffect(() => {
    const handleNodeContentChanged = (event) => {
      const { targetId, content, targetHandle } = event.detail;

      if (targetId === id) {
        // Handle chip inputs - store separately for placeholder replacement
        // Chips can connect to any handle and affect the prompt
        if (content?.isChip && content?.chipId) {
          setChipValues(prev => ({
            ...prev,
            [content.chipId]: content.value || ''
          }));
          // Store in node data for workflow execution
          data.chipValues = {
            ...(data.chipValues || {}),
            [content.chipId]: content.value || ''
          };
        } else if (targetHandle === 'in') {
          // Non-chip inputs only work on the 'in' handle
          if (content?.type === HANDLE_TYPES.TEXT.type) {
            // Regular text input replaces prompt
            setFormState(prev => {
              const next = { ...prev, prompt: content.value || "" };
              data.prompt = next.prompt;
              return next;
            });
          } else if (content?.type === HANDLE_TYPES.IMAGE.type) {
            // Handle image input for multimodal models
            const imgUrl = content.value || content.url;
            setImageUrl(imgUrl);
            data.imageUrl = imgUrl;
          } else if (content?.type === HANDLE_TYPES.AUDIO.type) {
            const nextAudio = content.value || content.url;
            setAudioUrl(nextAudio);
            data.audioUrl = nextAudio;
          }
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
    const outgoing = edges.filter((edge) => edge.source === id && edge.sourceHandle === "out");

    const payload = {
      type: HANDLE_TYPES.TEXT.type,
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

      if (!prompt.trim() && !audioUrl) {
        throw new Error("Please provide a prompt or audio input");
      }

      if (!formState.model.trim()) {
        throw new Error("Please specify a model");
      }

      let input;

      try {
        const schema = await fetchModelSchema(formState.model);
        const connectedInputs = {
          text: prompt.trim() ? [prompt.trim()] : [],
          image: imageUrl ? [imageUrl] : [],
          video: [],
          audio: audioUrl ? [audioUrl] : []
        };

        input = buildReplicateInput(schema, connectedInputs, formState);
      } catch (schemaError) {
        console.warn("Schema fetch failed, using fallback:", schemaError);
        input = {};

        if (prompt.trim()) {
          input.prompt = prompt;
        }

        if (imageUrl) {
          input.image = imageUrl;
        }

        if (audioUrl) {
          input.audio = audioUrl;
        }

        // Add optional parameters if provided
        if (formState.systemPrompt && formState.systemPrompt.trim()) {
          input.system_prompt = formState.systemPrompt;
        }
        if (formState.temperature !== undefined) {
          input.temperature = formState.temperature;
        }
        if (formState.maxTokens) {
          input.max_tokens = formState.maxTokens;
        }
      }

      console.log("Creating Replicate text prediction:", { model: formState.model, input });

      const prediction = await invoke('replicate_create_prediction', {
        model: formState.model,
        input
      });

      console.log("Prediction created:", prediction);

      // Poll for completion
      let currentPrediction = prediction;
      const maxAttempts = 120; // 2 minutes for LLM responses
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
        console.log(`Polling attempt ${attempts}:`, currentPrediction.status);
      }

      if (currentPrediction.status === "succeeded") {
        const output = currentPrediction.output;
        let result;

        // Handle different output formats
        if (Array.isArray(output)) {
          result = output.join('');
        } else if (typeof output === 'string') {
          result = output;
        } else {
          result = JSON.stringify(output);
        }

        data.output = result;
        data.metadata = formState.model.split('/').pop() || formState.model;
        setOutputText(result);
        dispatchOutput(result);
      } else if (currentPrediction.status === "failed") {
        throw new Error(currentPrediction.error || "Prediction failed");
      } else if (currentPrediction.status === "canceled") {
        throw new Error("Prediction was canceled");
      } else {
        throw new Error("Prediction timed out");
      }
    } catch (e) {
      console.error("Error generating text:", e);
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
          title: "Text",
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
              placeholder="Search for text models..."
              collectionSlug={["language-models", "speech-to-text", "official"]}
            />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {outputText ? (
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
                  lineHeight: '1.5'
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
                    <ImagePreviewStrip
                      nodeId={id}
                      edges={getEdges()}
                      nodes={getNodes()}
                    />
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
                    placeholder="Type a prompt..."
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
                <ImagePreviewStrip
                  nodeId={id}
                  edges={getEdges()}
                  nodes={getNodes()}
                />
              </div>
              <MinimalPromptInput
                value={formState.prompt}
                onChange={(value) => {
                  const next = { ...formState, prompt: value };
                  setFormState(next);
                  data.prompt = value;
                }}
                onSubmit={handleGenerate}
                placeholder="Type a prompt..."
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
        title="Text Settings"
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
          {status === "processing" ? "Generating..." : "Generate Text"}
        </button>
      </NodeSettingsPopover>
    </>
  );
};

export default TextNode;
