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
import { fetchModelSchema, buildReplicateInput, clearSchemaCache } from "../../utils/replicateSchemaCache";

export const NODE_TYPE = "image";
const definition = getNodeSchema(NODE_TYPE);
const handles = definition?.handles || [];

const toTitleCase = (value) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const shouldUseTextarea = (key, fieldDef) => {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('prompt') || lowerKey.includes('description') || lowerKey.includes('caption')) {
    return true;
  }
  return fieldDef?.type === 'string' && (fieldDef?.maxLength || 0) > 200;
};

const buildDynamicFieldsFromSchema = (schema) => {
  const inputs = schema?.inputs || {};

  // Debug: log all input keys and their types
  console.log('[buildDynamicFieldsFromSchema] All schema input keys:', Object.keys(inputs));
  Object.entries(inputs).forEach(([key, def]) => {
    console.log(`[buildDynamicFieldsFromSchema] ${key}:`, { type: def?.type, enum: def?.enum, anyOf: def?.anyOf });
  });

  const resolveDefinition = (fieldDef) => {
    if (!fieldDef) return fieldDef;
    if (fieldDef.type) return fieldDef;
    const variants = fieldDef.anyOf || fieldDef.oneOf || fieldDef.allOf;
    if (!Array.isArray(variants)) return fieldDef;
    const resolved = variants.find((variant) => variant?.type);
    return resolved ? { ...fieldDef, ...resolved } : fieldDef;
  };

  // Helper to detect media input types
  const isUriLike = (fieldDef) => {
    const format = fieldDef?.format;
    return format === 'uri' || format === 'data-uri' || format === 'binary' || format === 'base64';
  };

  const isMediaType = (fieldDef, prefix) =>
    typeof fieldDef?.contentMediaType === 'string' &&
    fieldDef.contentMediaType.startsWith(prefix);

  const detectMediaInputType = (key, fieldDef) => {
    const lowerKey = key.toLowerCase();
    const resolved = resolveDefinition(fieldDef);
    const resolvedItems = resolved?.type === 'array' ? resolveDefinition(resolved.items) : null;

    // Check for mask first
    if (lowerKey.includes('mask')) {
      return { mediaType: 'mask', isArray: resolved?.type === 'array' };
    }

    // Check for image fields
    const isImageField =
      lowerKey.includes('image') || lowerKey.includes('img') || lowerKey.includes('photo') ||
      isMediaType(resolved, 'image/') ||
      (resolved?.type === 'array' && isMediaType(resolvedItems, 'image/'));

    if (isImageField && (isUriLike(resolved) || (resolved?.type === 'array' && isUriLike(resolvedItems)) || resolved?.type === 'string')) {
      const isStyleRef = lowerKey.includes('style') || lowerKey.includes('reference') || lowerKey.includes('ref_');
      return {
        mediaType: 'image',
        isArray: resolved?.type === 'array',
        role: isStyleRef ? 'style_reference' : 'pending' // Will be resolved after all fields are collected
      };
    }

    // Check for video fields
    const isVideoField = lowerKey.includes('video') || isMediaType(resolved, 'video/');
    if (isVideoField && (isUriLike(resolved) || resolved?.type === 'string')) {
      return { mediaType: 'video', isArray: resolved?.type === 'array' };
    }

    // Check for audio fields
    const isAudioField = lowerKey.includes('audio') || isMediaType(resolved, 'audio/');
    if (isAudioField && (isUriLike(resolved) || resolved?.type === 'string')) {
      return { mediaType: 'audio', isArray: resolved?.type === 'array' };
    }

    return null;
  };

  const fields = Object.entries(inputs)
    .map(([key, rawFieldDef]) => {
      const fieldDef = resolveDefinition(rawFieldDef);
      if (!fieldDef?.type) return null;
      if (fieldDef.type === 'object') return null;

      // Check if this is a media input field
      const mediaInfo = detectMediaInputType(key, rawFieldDef);
      if (mediaInfo) {
        return {
          key,
          label: toTitleCase(key),
          type: 'media-input',
          mediaType: mediaInfo.mediaType,
          isArray: mediaInfo.isArray,
          role: mediaInfo.role,
          help: fieldDef.description,
          order: fieldDef.order ?? 999,
          required: rawFieldDef.required
        };
      }

      if (fieldDef.type === 'array') {
        const resolvedItems = resolveDefinition(fieldDef.items);
        const itemType = resolvedItems?.type;
        if (itemType === 'string') {
          return {
            key,
            label: toTitleCase(key),
            type: 'textarea',
            placeholder: 'Comma-separated values',
            help: fieldDef.description,
            default: fieldDef.default,
            order: fieldDef.order ?? 999,
            valueType: 'array'
          };
        }
        return null;
      }

      if (Array.isArray(fieldDef.enum) && fieldDef.enum.length > 0) {
        const optionValues = fieldDef.enum;
        const optionStrings = optionValues.map((option) => String(option));
        const allNumbers = optionValues.every((option) => typeof option === 'number');
        const allBooleans = optionValues.every((option) => typeof option === 'boolean');
        return {
          key,
          label: toTitleCase(key),
          type: 'select',
          options: optionStrings,
          default: fieldDef.default,
          help: fieldDef.description,
          order: fieldDef.order ?? 999,
          valueType: allNumbers ? 'number' : allBooleans ? 'boolean' : undefined
        };
      }

      if (fieldDef.type === 'boolean') {
        return {
          key,
          label: toTitleCase(key),
          type: 'boolean',
          default: fieldDef.default,
          help: fieldDef.description,
          order: fieldDef.order ?? 999
        };
      }

      if (fieldDef.type === 'number' || fieldDef.type === 'integer') {
        return {
          key,
          label: toTitleCase(key),
          type: 'number',
          min: fieldDef.minimum,
          max: fieldDef.maximum,
          default: fieldDef.default,
          help: fieldDef.description,
          order: fieldDef.order ?? 999
        };
      }

      if (fieldDef.type === 'string') {
        const isTextarea = shouldUseTextarea(key, fieldDef);
        return {
          key,
          label: toTitleCase(key),
          type: isTextarea ? 'textarea' : 'text',
          placeholder: fieldDef.format === 'uri' ? 'https://...' : undefined,
          default: fieldDef.default,
          help: fieldDef.description,
          order: fieldDef.order ?? 999
        };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Post-process: resolve 'pending' image field roles based on mask presence
  // If model has mask fields, 'pending' becomes 'primary' (inpainting)
  // If model has no mask fields, 'pending' becomes 'img2img' (general image input)
  const hasMaskFields = fields.some((f) => f.type === 'media-input' && f.mediaType === 'mask');
  fields.forEach((field) => {
    if (field.type === 'media-input' && field.role === 'pending') {
      field.role = hasMaskFields ? 'primary' : 'img2img';
    }
  });

  return fields;
};

const mergeDefinitionFields = (baseFields = [], dynamicFields = []) => {
  if (!dynamicFields.length) return baseFields;
  const merged = [];
  const seen = new Set();
  const toCamelCase = (value) =>
    value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const dynamicCamelKeys = new Set(
    dynamicFields.map((field) => toCamelCase(field.key))
  );
  const dynamicKeys = new Set(dynamicFields.map((field) => field.key));

  // Check if model uses aspect_ratio instead of width/height
  // Check both snake_case and camelCase versions
  const hasAspectRatio = dynamicKeys.has('aspect_ratio') || dynamicCamelKeys.has('aspectRatio');
  const dimensionFieldsToHide = hasAspectRatio ? new Set(['width', 'height']) : new Set();

  console.log('[mergeDefinitionFields] Dynamic field keys:', Array.from(dynamicKeys));
  console.log('[mergeDefinitionFields] hasAspectRatio:', hasAspectRatio);
  console.log('[mergeDefinitionFields] Will hide:', Array.from(dimensionFieldsToHide));

  const pushField = (field) => {
    if (!field || !field.key || seen.has(field.key)) return;
    seen.add(field.key);
    merged.push(field);
  };

  const modelField = baseFields.find((field) => field.key === 'model');
  pushField(modelField);
  dynamicFields.forEach(pushField);
  baseFields.forEach((field) => {
    if (dynamicCamelKeys.has(field.key)) return;
    // Hide width/height when aspect_ratio is available from model schema
    if (dimensionFieldsToHide.has(field.key)) return;
    pushField(field);
  });

  return merged;
};

export const createNode = ({ id, handleRemoveNode, position, defaultModel }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 320, height: 280 },
  data: {
    title: "Image Generation",
    onRemove: handleRemoveNode,
    handles,
    ...definition.defaults,
    ...(defaultModel ? { model: defaultModel } : {}),
    output: null,
    status: "idle"
  }
});

const ImageNode = ({ id, data, selected }) => {
  const { getEdges, getNodes } = useReactFlow();
  const [formState, setFormState] = React.useState(() => parseNodeData(definition, data));
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [imageUrl, setImageUrl] = React.useState(data.output || null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = React.useState(false);
  const [inputImages, setInputImages] = React.useState(data.inputImages || []);
  const [dynamicFields, setDynamicFields] = React.useState([]);
  const [schemaStatus, setSchemaStatus] = React.useState('idle');
  const [schemaError, setSchemaError] = React.useState(null);
  const [connectedImagePreviews, setConnectedImagePreviews] = React.useState([]);
  const [showChipPreview, setShowChipPreview] = React.useState(true); // Default ON
  
  React.useEffect(() => {
    if (data.output && data.output !== imageUrl) {
      setImageUrl(data.output);
    }
    if (!data.output && imageUrl) {
      setImageUrl(null);
    }
  }, [data.output, imageUrl]);

  const collectConnectedImagePreviews = React.useCallback(() => {
    const edges = getEdges();
    const nodes = getNodes();
    const imageEdges = edges.filter(e => e.target === id && e.targetHandle === 'in');
    const previews = imageEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) return null;
      const sourceData = sourceNode.data || {};
      const url = sourceData.convertedSrc
        || sourceData.output
        || (sourceData.mediaPath?.startsWith('data:') ? sourceData.mediaPath : null)
        || sourceData.imageUrl
        || null;
      return {
        sourceId: sourceNode.id,
        title: sourceData.title || sourceNode.type || sourceNode.id,
        url
      };
    }).filter(Boolean);

    setConnectedImagePreviews(previews);
  }, [getEdges, getNodes, id]);

  React.useEffect(() => {
    if (selected) {
      collectConnectedImagePreviews();
    }
  }, [selected, collectConnectedImagePreviews]);

  const activeDefinition = React.useMemo(() => {
    if (!dynamicFields.length) return definition;
    return {
      ...definition,
      fields: mergeDefinitionFields(definition.fields || [], dynamicFields),
      allowPassthrough: true
    };
  }, [dynamicFields]);

  React.useEffect(() => {
    let isCancelled = false;
    const modelId = formState.model?.trim();
    if (!modelId) {
      setDynamicFields([]);
      setSchemaStatus('idle');
      setSchemaError(null);
      return undefined;
    }

    setSchemaStatus('loading');
    setSchemaError(null);

    fetchModelSchema(modelId)
      .then((schema) => {
        if (isCancelled) return;
        const nextFields = buildDynamicFieldsFromSchema(schema);
        setDynamicFields(nextFields);
        setSchemaStatus('loaded');

        if (nextFields.length) {
          const defaults = {};
          nextFields.forEach((field) => {
            if (field.default !== undefined) {
              defaults[field.key] = field.default;
            }
          });

          if (Object.keys(defaults).length) {
            setFormState((prev) => {
              const next = { ...prev };
              Object.entries(defaults).forEach(([key, value]) => {
                if (next[key] === undefined || next[key] === null || next[key] === '') {
                  next[key] = value;
                }
              });
              return next;
            });

            Object.entries(defaults).forEach(([key, value]) => {
              if (data[key] === undefined || data[key] === null || data[key] === '') {
                data[key] = value;
              }
            });
          }
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setDynamicFields([]);
        setSchemaStatus('error');
        setSchemaError(err?.message || 'Failed to load model schema.');
      });

    return () => {
      isCancelled = true;
    };
  }, [formState.model]);

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
            // Collect all image inputs (supports multiple connections)
            const imgUrl = content.value || content.url;
            setInputImages(prev => {
              const updated = [...prev, imgUrl];
              data.inputImages = updated;
              return updated;
            });
            collectConnectedImagePreviews();
          }
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
        setConnectedImagePreviews([]);
      }
      collectConnectedImagePreviews();
    };

    const offEdgesChange = on('edgesChange', handleEdgesChange);
    return () => offEdgesChange();
  }, [id, data, collectConnectedImagePreviews]);

  // Close model picker when clicking outside
  React.useEffect(() => {
    if (!isModelPickerOpen) return;

    const handleClickOutside = (event) => {
      // Check if click is outside the model picker
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

  // Helper function to convert HTTP URL to data URL
  const urlToDataUrl = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`Failed to convert URL to data URL: ${url}`, error);
      throw error;
    }
  };

  const handleGenerate = async () => {
    setStatus("processing");
    setError(null);

    try {
      if (!formState.model.trim()) {
        throw new Error("Please specify a model");
      }

      const prompt = formState.prompt || data.content || "";

      // Collect all connected images from edges at generation time
      const edges = getEdges();
      const connectedImageEdges = edges.filter(e => e.target === id && e.targetHandle === 'in');
      const nodes = getNodes();
      
      const collectedImages = [];
      
      for (const edge of connectedImageEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) {
          let imageUrl = null;
          
          if (sourceNode.data.convertedSrc) {
            // From Media nodes - already a base64 data URL
            imageUrl = sourceNode.data.convertedSrc;
            collectedImages.push(imageUrl);
          } else if (sourceNode.data.output) {
            // From Replicate Image nodes - HTTP URL that might be expired
            // Convert to data URL to avoid 404 errors
            try {
              console.log(`Converting Replicate output URL to data URL: ${sourceNode.data.output}`);
              const dataUrl = await urlToDataUrl(sourceNode.data.output);
              collectedImages.push(dataUrl);
            } catch (error) {
              console.warn(`Failed to convert image URL, skipping: ${sourceNode.data.output}`, error);
            }
          } else if (sourceNode.data.mediaPath) {
            // Fallback to mediaPath (though it might be a local file)
            if (sourceNode.data.mediaPath.startsWith('data:')) {
              collectedImages.push(sourceNode.data.mediaPath);
            } else {
              console.warn(`Skipping local file path: ${sourceNode.data.mediaPath}`);
            }
          }
        }
      }

      console.log("Generating with model:", formState.model);
      console.log("Connected image edges:", connectedImageEdges.length);
      console.log("Collected images as data URLs:", collectedImages.length);

      let input;

      try {
        // Try schema-based input building
        const schema = await fetchModelSchema(formState.model);
        
        const connectedInputs = {
          text: prompt ? [prompt] : [],
          image: collectedImages,
          video: [],
          audio: []
        };

        input = buildReplicateInput(schema, connectedInputs, formState);
        console.log("Built input from schema:", input);
      } catch (schemaError) {
        // Fallback to manual input building
        console.warn("Schema fetch failed, using fallback:", schemaError);
        
        if (!prompt.trim()) {
          throw new Error("Please provide a prompt");
        }

        input = { prompt };
        
        // Add input images for img2img models
        if (collectedImages && collectedImages.length > 0) {
          if (collectedImages.length === 1) {
            input.image = collectedImages[0];
          } else {
            input.image_input = collectedImages;
          }
        }
        
        // Add optional parameters if provided
        if (formState.negativePrompt && formState.negativePrompt.trim()) {
          input.negative_prompt = formState.negativePrompt;
        }
        if (formState.width) {
          input.width = formState.width;
        }
        if (formState.height) {
          input.height = formState.height;
        }
        if (formState.numOutputs) {
          input.num_outputs = formState.numOutputs;
        }
      }

      console.log("Creating Replicate image prediction:", { model: formState.model, input });

      const prediction = await invoke('replicate_create_prediction', {
        model: formState.model,
        input
      });

      console.log("Prediction created:", prediction);

      // Poll for completion
      let currentPrediction = prediction;
      const maxAttempts = 120; // 2 minutes for image generation
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
        if (Array.isArray(output) && output.length > 0) {
          result = output[0]; // Use first image
        } else if (typeof output === 'string') {
          result = output;
        } else {
          throw new Error("Unexpected output format");
        }

        data.output = result;
        data.metadata = formState.model.split('/').pop() || formState.model;
        setImageUrl(result);
        dispatchOutput(result);
      } else if (currentPrediction.status === "failed") {
        throw new Error(currentPrediction.error || "Prediction failed");
      } else if (currentPrediction.status === "canceled") {
        throw new Error("Prediction was canceled");
      } else {
        throw new Error("Prediction timed out");
      }
    } catch (e) {
      console.error("Error generating image:", e);
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
          title: "Image Generation",
          metadata: data.metadata || (formState.model ? formState.model.split('/').pop() : null),
          onMetadataClick: () => setIsModelPickerOpen(true)
        }}
        handles={handles}
        selected={selected}
        error={error}
        isLoading={status === "processing"}
        onSettingsClick={() => setIsSettingsOpen(true)}
        contentStyle={{
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden'
        }}
        dragHandleStyle={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '16px',
          minHeight: 0,
          padding: 0,
          zIndex: 2
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
              placeholder="Search for image models..."
              collectionSlug={["text-to-image", "image-editing", "official"]}
            />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {(status === "processing" || data.isProcessing) && (
            <div className="node-noise-overlay" aria-hidden="true" />
          )}
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={formState.prompt || "Generated image"}
                className="node-preview-image nodrag"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  console.error('Failed to load image preview:', {
                    url: imageUrl?.substring(0, 100) + (imageUrl?.length > 100 ? '...' : ''),
                    isDataUrl: imageUrl?.startsWith('data:'),
                    isHttpUrl: imageUrl?.startsWith('http')
                  });
                  // Clear both state and data to prevent retry loop
                  setImageUrl(null);
                  data.output = null;
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
        title="Image Generation Settings"
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
        {schemaStatus === 'loading' && (
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            Loading model schema...
          </div>
        )}
        {schemaStatus === 'loaded' && dynamicFields.length > 0 && (
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            Model parameters loaded ({dynamicFields.length})
          </div>
        )}
        {schemaStatus === 'error' && (
          <div style={{ fontSize: '12px', color: '#ef4444' }}>
            {schemaError || 'Unable to load model parameters.'}
          </div>
        )}
        <button
          onClick={() => {
            const modelId = formState.model?.trim();
            if (modelId) {
              console.log('[ImageNode] Clearing schema cache and refetching for:', modelId);
              clearSchemaCache();
              setSchemaStatus('loading');
              setDynamicFields([]);
              fetchModelSchema(modelId)
                .then((schema) => {
                  console.log('[ImageNode] Refetched schema:', schema);
                  const nextFields = buildDynamicFieldsFromSchema(schema);
                  console.log('[ImageNode] Built dynamic fields:', nextFields);
                  setDynamicFields(nextFields);
                  setSchemaStatus('loaded');
                })
                .catch((err) => {
                  console.error('[ImageNode] Schema refetch failed:', err);
                  setSchemaStatus('error');
                  setSchemaError(err?.message || 'Failed to load model schema.');
                });
            }
          }}
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            marginBottom: '8px',
            background: 'transparent',
            border: '1px solid var(--border-color, #444)',
            borderRadius: '4px',
            color: 'var(--text-color)',
            cursor: 'pointer',
            opacity: 0.7
          }}
        >
          🔄 Refresh Model Schema
        </button>
        <SchemaForm
          definition={activeDefinition}
          values={formState}
          onChange={(next) => {
            setFormState(next);
            Object.assign(data, next);
            if (next.model) {
              data.metadata = next.model.split('/').pop();
            }
          }}
          connectedInputs={{
            image: connectedImagePreviews
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
          {status === "processing" ? "Generating..." : "Generate Image"}
        </button>
      </NodeSettingsPopover>
    </>
  );
};

export default ImageNode;
