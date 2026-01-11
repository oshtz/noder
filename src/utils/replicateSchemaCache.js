/**
 * Replicate Model Schema Cache
 * 
 * Fetches and caches model schemas from Replicate API to enable:
 * - Dynamic input/output mapping
 * - Array input support (e.g., multiple images)
 * - Automatic parameter discovery
 */

import { invoke } from '@tauri-apps/api/core';

// In-memory cache for model schemas
const schemaCache = new Map();

/**
 * Fetch model schema from Replicate API
 * @param {string} modelId - Format: "owner/model-name" or "owner/model-name:version"
 * @returns {Promise<Object>} Model schema with input/output definitions
 */
export async function fetchModelSchema(modelId) {
  // Check cache first
  if (schemaCache.has(modelId)) {
    console.log(`[SchemaCache] Using cached schema for ${modelId}`);
    return schemaCache.get(modelId);
  }

  try {
    // Parse model ID (remove version if present)
    const [ownerAndModel] = modelId.split(':');
    const [owner, modelName] = ownerAndModel.split('/');

    if (!owner || !modelName) {
      throw new Error(`Invalid model ID format: ${modelId}`);
    }

    console.log(`[SchemaCache] Fetching schema for ${owner}/${modelName}`);

    // Fetch from Replicate API via Tauri command
    const modelData = await invoke('replicate_get_model', {
      owner,
      modelName
    });

    // Extract schema from latest version
    const schema = modelData?.latest_version?.openapi_schema;
    
    if (!schema) {
      throw new Error(`No schema found for model ${modelId}`);
    }

    // Parse and normalize the schema
    const normalizedSchema = normalizeSchema(schema, modelId);
    
    // Cache it
    schemaCache.set(modelId, normalizedSchema);
    
    console.log(`[SchemaCache] Cached schema for ${modelId}:`, normalizedSchema);
    
    return normalizedSchema;
  } catch (error) {
    console.error(`[SchemaCache] Failed to fetch schema for ${modelId}:`, error);
    throw error;
  }
}

/**
 * Normalize Replicate OpenAPI schema to our internal format
 */
function normalizeSchema(openapiSchema, modelId) {
  const inputSchema = openapiSchema?.components?.schemas?.Input;
  const outputSchema = openapiSchema?.components?.schemas?.Output;
  const allSchemas = openapiSchema?.components?.schemas || {};

  if (!inputSchema) {
    console.warn(`[SchemaCache] No input schema found for ${modelId}`);
  }

  // Helper to resolve $ref references
  const resolveRef = (ref) => {
    if (!ref || typeof ref !== 'string') return null;
    // Format: "#/components/schemas/aspect_ratio"
    const match = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match && allSchemas[match[1]]) {
      return allSchemas[match[1]];
    }
    return null;
  };

  // Helper to resolve allOf with $ref
  const resolveAllOf = (prop) => {
    if (!prop.allOf || !Array.isArray(prop.allOf)) return prop;

    let resolved = { ...prop };
    delete resolved.allOf;

    for (const item of prop.allOf) {
      if (item.$ref) {
        const refSchema = resolveRef(item.$ref);
        if (refSchema) {
          // Merge referenced schema properties
          resolved = { ...refSchema, ...resolved };
        }
      } else {
        // Merge inline schema
        resolved = { ...item, ...resolved };
      }
    }

    return resolved;
  };

  const normalized = {
    modelId,
    inputs: {},
    outputs: {},
    required: inputSchema?.required || []
  };

  // Parse input properties
  if (inputSchema?.properties) {
    Object.entries(inputSchema.properties).forEach(([key, rawProp]) => {
      // Resolve allOf/$ref if present
      const prop = resolveAllOf(rawProp);

      // Debug: log resolved property for fields that had allOf
      if (rawProp.allOf) {
        console.log(`[normalizeSchema] ${key} resolved from allOf:`, { type: prop.type, enum: prop.enum });
      }

      normalized.inputs[key] = {
        type: prop.type,
        format: prop.format,
        description: prop.description || rawProp.description,
        default: prop.default ?? rawProp.default,
        enum: prop.enum,
        minimum: prop.minimum,
        maximum: prop.maximum,
        minLength: prop.minLength,
        maxLength: prop.maxLength,
        contentMediaType: prop.contentMediaType,
        items: prop.items, // For array types
        anyOf: prop.anyOf,
        oneOf: prop.oneOf,
        allOf: prop.allOf,
        required: normalized.required.includes(key),
        order: rawProp['x-order'] || prop['x-order'] || 999
      };
    });
  }

  // Parse output schema
  if (outputSchema) {
    normalized.outputs = {
      type: outputSchema.type,
      format: outputSchema.format,
      items: outputSchema.items
    };
  }

  return normalized;
}

/**
 * Determine which input fields should receive which data types
 * @param {Object} schema - Normalized schema
 * @returns {Object} Mapping of data types to input field names
 */
export function getInputMapping(schema) {
  const mapping = {
    text: [],
    image: [],
    video: [],
    audio: [],
    mask: []
  };

  const resolveDefinition = (fieldDef) => {
    if (!fieldDef) return fieldDef;
    if (fieldDef.type) return fieldDef;
    const variants = fieldDef.anyOf || fieldDef.oneOf || fieldDef.allOf;
    if (!Array.isArray(variants)) return fieldDef;
    const resolved = variants.find((variant) => variant?.type);
    return resolved ? { ...fieldDef, ...resolved } : fieldDef;
  };

  const isUriLike = (fieldDef) => {
    const format = fieldDef?.format;
    return (
      format === 'uri' ||
      format === 'data-uri' ||
      format === 'binary' ||
      format === 'base64'
    );
  };

  const isMediaType = (fieldDef, prefix) =>
    typeof fieldDef?.contentMediaType === 'string' &&
    fieldDef.contentMediaType.startsWith(prefix);

  const isMaskFieldName = (name) => name.includes('mask');

  const isStyleReferenceFieldName = (name) =>
    name.includes('style') || name.includes('reference') || name.includes('ref_');

  const isImageFieldName = (name) =>
    name.includes('image') || name.includes('img') || name.includes('photo');

  const isVideoFieldName = (name) => name.includes('video');

  const isAudioFieldName = (name) => name.includes('audio');

  Object.entries(schema.inputs).forEach(([fieldName, fieldDef]) => {
    const resolved = resolveDefinition(fieldDef);
    const lowerName = fieldName.toLowerCase();
    const isMaskField = isMaskFieldName(lowerName);

    // Text inputs
    if (resolved.type === 'string' && !resolved.format) {
      // Common prompt field names
      if (fieldName.toLowerCase().includes('prompt') || 
          fieldName.toLowerCase().includes('text') ||
          fieldName.toLowerCase().includes('description')) {
        mapping.text.push(fieldName);
      }
    }

    // Image inputs (URI or array of URIs)
    const resolvedItems = resolved.type === 'array' ? resolveDefinition(resolved.items) : null;
    if (isMaskField) {
      const maskItems = resolved.type === 'array' ? resolveDefinition(resolved.items) : null;
      mapping.mask.push({
        field: fieldName,
        isArray: resolved.type === 'array',
        maxItems: maskItems?.maxItems || resolved?.maxItems
      });
      return;
    }

    const imageByMediaType =
      isMediaType(resolved, 'image/') ||
      (resolved.type === 'array' && isMediaType(resolvedItems, 'image/'));
    const imageByName = isImageFieldName(lowerName);
    if (
      imageByMediaType ||
      (imageByName && (
        isUriLike(resolved) ||
        (resolved.type === 'array' && isUriLike(resolvedItems)) ||
        resolved.type === 'string'
      ))
    ) {
      // Classify image field role:
      // - 'style_reference': fields for style/reference images
      // - 'img2img': general image-to-image fields (when no mask exists)
      // - 'primary': main image field for inpainting (only when mask field exists)
      const isStyleRef = isStyleReferenceFieldName(lowerName);

      mapping.image.push({
        field: fieldName,
        isArray: resolved.type === 'array',
        maxItems: resolvedItems?.maxItems || resolved?.maxItems,
        role: isStyleRef ? 'style_reference' : 'pending' // Will be resolved after loop
      });
    }

    // Video inputs
    const videoByMediaType = isMediaType(resolved, 'video/');
    if (
      videoByMediaType ||
      ((isUriLike(resolved) || isMediaType(resolved, 'video/')) && isVideoFieldName(lowerName))
    ) {
      mapping.video.push({
        field: fieldName,
        isArray: resolved.type === 'array'
      });
    }

    // Audio inputs
    const audioByMediaType = isMediaType(resolved, 'audio/');
    if (
      audioByMediaType ||
      ((isUriLike(resolved) || isMediaType(resolved, 'audio/')) && isAudioFieldName(lowerName))
    ) {
      mapping.audio.push({
        field: fieldName,
        isArray: resolved.type === 'array'
      });
    }
  });

  // Post-process: resolve 'pending' image field roles based on mask presence
  // If model has mask fields, 'pending' becomes 'primary' (inpainting)
  // If model has no mask fields, 'pending' becomes 'img2img' (general image input)
  const hasMaskFields = mapping.mask.length > 0;
  mapping.image.forEach((entry) => {
    if (entry.role === 'pending') {
      entry.role = hasMaskFields ? 'primary' : 'img2img';
    }
  });

  return mapping;
}

/**
 * Determine output data type from schema
 * @param {Object} schema - Normalized schema
 * @returns {string} Output type: 'text', 'image', 'video', 'audio', or 'unknown'
 */
export function getOutputType(schema) {
  const output = schema.outputs;

  // Array of URIs (common for image/video outputs)
  if (output.type === 'array' && output.items?.format === 'uri') {
    return 'image'; // Default to image, can be refined
  }

  // Single URI
  if (output.format === 'uri') {
    return 'image'; // Default to image
  }

  // String output (text generation)
  if (output.type === 'string') {
    return 'text';
  }

  return 'unknown';
}

/**
 * Build input object for Replicate API from connected node data
 * @param {Object} schema - Normalized schema
 * @param {Object} connectedInputs - Data from connected nodes { text: [], image: [], etc }
 * @param {Object} nodeData - Node's own data/settings
 * @returns {Object} Input object ready for Replicate API
 */
export function buildReplicateInput(schema, connectedInputs, nodeData) {
  const input = {};
  const mapping = getInputMapping(schema);
  const connectedImages = Array.isArray(connectedInputs.image) ? connectedInputs.image : [];
  const toCamelCase = (value) =>
    value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const getNodeDataValue = (fieldName) => {
    if (nodeData[fieldName] !== undefined && nodeData[fieldName] !== null) {
      return nodeData[fieldName];
    }
    const camel = toCamelCase(fieldName);
    if (camel !== fieldName && nodeData[camel] !== undefined && nodeData[camel] !== null) {
      return nodeData[camel];
    }
    return undefined;
  };

  // Map text inputs
  if (connectedInputs.text?.length > 0 && mapping.text.length > 0) {
    // Use first text input for first prompt field
    const primaryPromptField = mapping.text[0];
    input[primaryPromptField] = connectedInputs.text[0];
  }

  if (nodeData?.prompt && mapping.text.length > 0) {
    const promptField =
      mapping.text.find((field) => field === 'prompt') ||
      mapping.text.find((field) => field.includes('prompt') && !field.includes('negative')) ||
      mapping.text[0];
    if (input[promptField] === undefined) {
      input[promptField] = nodeData.prompt;
    }
  }

  // Map image inputs - style_reference and img2img fields
  // Primary (inpainting) fields are intentionally skipped - inpainting requires explicit mask handling
  const usableImageFields = mapping.image.filter(
    (f) => f.role === 'style_reference' || f.role === 'img2img'
  );

  usableImageFields.forEach(({ field, isArray }) => {
    if (connectedImages.length > 0) {
      if (isArray) {
        input[field] = connectedImages;
      } else {
        input[field] = connectedImages[0];
      }
    }
  });

  // Note: mask and primary (inpainting) image fields are intentionally not mapped
  // Inpainting functionality is not yet implemented

  // Map video inputs
  mapping.video.forEach(({ field, isArray }) => {
    if (connectedInputs.video?.length > 0) {
      input[field] = isArray ? connectedInputs.video : connectedInputs.video[0];
    }
  });

  // Map audio inputs
  mapping.audio.forEach(({ field, isArray }) => {
    if (connectedInputs.audio?.length > 0) {
      input[field] = isArray ? connectedInputs.audio : connectedInputs.audio[0];
    }
  });

  // Add node's own settings (width, height, etc.)
  Object.entries(schema.inputs).forEach(([fieldName, fieldDef]) => {
    // Skip if already set from connections
    if (input[fieldName] !== undefined) return;

    // Use node data if available
    const nodeValue = getNodeDataValue(fieldName);
    if (nodeValue !== undefined) {
      input[fieldName] = nodeValue;
    }
    // Use default value if available
    else if (fieldDef.default !== undefined) {
      input[fieldName] = fieldDef.default;
    }
  });

  return input;
}

/**
 * Clear schema cache (useful for testing or forcing refresh)
 */
export function clearSchemaCache() {
  schemaCache.clear();
  console.log('[SchemaCache] Cache cleared');
}

/**
 * Get cached schema without fetching
 */
export function getCachedSchema(modelId) {
  return schemaCache.get(modelId);
}
