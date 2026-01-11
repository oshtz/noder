import React from "react";
import { invoke } from '@tauri-apps/api/core';
import BaseNode from "../../components/BaseNode";
import { SchemaForm } from "../../components/SchemaForm";
import { NodeSettingsPopover } from "../../components/NodeSettingsPopover";
import { ReplicateModelPicker } from "../../components/ReplicateModelPicker";
import NodeSettingsClipboard from "../../components/NodeSettingsClipboard";
import { HANDLE_TYPES } from "../../constants/handleTypes";
import { getNodeSchema, parseNodeData } from "../nodeSchemas";
import { emit, on } from "../../utils/eventBus";
import { fetchModelSchema, buildReplicateInput } from "../../utils/replicateSchemaCache";

export const NODE_TYPE = "upscaler";
const definition = getNodeSchema(NODE_TYPE);
const handles = definition?.handles || [];

export const createNode = ({ id, handleRemoveNode, position, defaultModel }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 320, height: 280 },
  data: {
    title: "Upscaler",
    onRemove: handleRemoveNode,
    handles,
    ...definition.defaults,
    ...(defaultModel ? { model: defaultModel } : {}),
    output: null,
    status: "idle"
  }
});

const UpscalerNode = ({ id, data, selected }) => {
  const [formState, setFormState] = React.useState(() => parseNodeData(definition, data));
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [outputUrl, setOutputUrl] = React.useState(data.output || null);
  const [inputImages, setInputImages] = React.useState(data.inputImages || []);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (data.output && data.output !== outputUrl) {
      setOutputUrl(data.output);
    }
  }, [data.output, outputUrl]);

  // Listen for input from connected nodes
  React.useEffect(() => {
    const handleNodeContentChanged = (event) => {
      const { targetId, content, targetHandle } = event.detail;

      if (targetId === id && targetHandle === 'in') {
        if (content?.type === HANDLE_TYPES.TEXT.type) {
          const nextPrompt = content.value || "";
          setFormState(prev => {
            const next = { ...prev, prompt: nextPrompt };
            data.prompt = nextPrompt;
            return next;
          });
        } else if (content?.type === HANDLE_TYPES.IMAGE.type) {
          const imgUrl = content.value || content.url;
          if (!imgUrl) return;
          setInputImages([imgUrl]);
          data.inputImages = [imgUrl];
        }
      }
    };

    const offNodeContentChanged = on("nodeContentChanged", handleNodeContentChanged);
    return () => offNodeContentChanged();
  }, [id, data]);

  // Clear input images when edges change
  React.useEffect(() => {
    const handleEdgesChange = () => {
      const edges = window.edgesRef?.current || [];
      const imageEdges = edges.filter(e => e.target === id && e.targetHandle === 'in');

      if (imageEdges.length === 0) {
        setInputImages([]);
        data.inputImages = [];
      }
    };

    const offEdgesChange = on('edgesChange', handleEdgesChange);
    return () => offEdgesChange();
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
      type: HANDLE_TYPES.IMAGE.type,
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
      if (!formState.model.trim()) {
        throw new Error("Please specify a model");
      }

      const fallbackImage = formState.imageUrl?.trim();
      const collectedImages = inputImages.length > 0
        ? inputImages
        : (fallbackImage ? [fallbackImage] : []);

      if (collectedImages.length === 0) {
        throw new Error("Connect an image or provide an image URL");
      }

      let input = null;

      try {
        const schema = await fetchModelSchema(formState.model);
        const connectedInputs = {
          text: formState.prompt?.trim() ? [formState.prompt.trim()] : [],
          image: collectedImages,
          video: [],
          audio: []
        };
        input = buildReplicateInput(schema, connectedInputs, formState);
      } catch (schemaError) {
        console.warn(`[Upscaler] Schema fetch failed, using fallback:`, schemaError);
        input = { image: collectedImages[0] };
        if (formState.prompt?.trim()) {
          input.prompt = formState.prompt.trim();
        }
        if (formState.scale) {
          input.scale = formState.scale;
        }
      }

      console.log("Creating Replicate upscaler prediction:", { model: formState.model, input });

      const prediction = await invoke('replicate_create_prediction', {
        model: formState.model,
        input
      });

      let currentPrediction = prediction;
      const maxAttempts = 120;
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
      }

      if (currentPrediction.status === "succeeded") {
        const output = currentPrediction.output;
        let result;

        if (Array.isArray(output) && output.length > 0) {
          result = output[0];
        } else if (typeof output === 'string') {
          result = output;
        } else {
          throw new Error("Unexpected output format");
        }

        data.output = result;
        data.metadata = formState.model.split('/').pop() || formState.model;
        setOutputUrl(result);
        dispatchOutput(result);
      } else if (currentPrediction.status === "failed") {
        throw new Error(currentPrediction.error || "Prediction failed");
      } else if (currentPrediction.status === "canceled") {
        throw new Error("Prediction was canceled");
      } else {
        throw new Error("Prediction timed out");
      }
    } catch (e) {
      console.error("Error upscaling image:", e);
      setError(e.message || e.toString() || "Failed to run model");
    } finally {
      setStatus("idle");
    }
  };

  // Only show output if we have actual upscaled result from API
  const previewUrl = outputUrl || null;

  return (
    <>
      <BaseNode
        id={id}
        data={{
          ...data,
          title: "Upscaler",
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
              placeholder="Search for upscaler models..."
              collectionSlug={["super-resolution", "official"]}
            />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Upscaled preview"
              className="node-preview-image nodrag"
              onError={() => setOutputUrl(null)}
            />
          ) : (
            <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '0 16px' }}>
              Connect an image to upscale
            </div>
          )}
        </div>
      </BaseNode>

      <NodeSettingsPopover
        isOpen={selected}
        onClose={() => {}}
        title="Upscaler Settings"
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
          }}
          disabled={status === "processing"}
          style={{ marginTop: 12, width: '100%' }}
        >
          {status === "processing" ? "Upscaling..." : "Run Upscaler"}
        </button>
      </NodeSettingsPopover>
    </>
  );
};

export default UpscalerNode;
