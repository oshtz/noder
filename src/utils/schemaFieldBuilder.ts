/**
 * Utility functions for building dynamic form fields from Replicate model schemas.
 * Used by ImageNode, VideoNode, AudioNode, etc. to create forms based on model capabilities.
 */

// =============================================================================
// Types
// =============================================================================

export interface SchemaInputField {
  type?: string;
  format?: string;
  contentMediaType?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  order?: number;
  required?: boolean;
  anyOf?: SchemaInputField[];
  oneOf?: SchemaInputField[];
  allOf?: SchemaInputField[];
  items?: SchemaInputField;
}

export interface ModelSchema {
  inputs?: Record<string, SchemaInputField>;
}

export interface DynamicField {
  key: string;
  label: string;
  type: string;
  mediaType?: string;
  isArray?: boolean;
  role?: string;
  help?: string;
  order?: number;
  required?: boolean;
  options?: string[];
  default?: unknown;
  placeholder?: string;
  valueType?: string;
  min?: number;
  max?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

export const toTitleCase = (value: string): string =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const shouldUseTextarea = (key: string, fieldDef: SchemaInputField | null): boolean => {
  const lowerKey = key.toLowerCase();
  if (
    lowerKey.includes('prompt') ||
    lowerKey.includes('description') ||
    lowerKey.includes('caption')
  ) {
    return true;
  }
  return fieldDef?.type === 'string' && (fieldDef?.maxLength || 0) > 200;
};

const resolveDefinition = (
  fieldDef: SchemaInputField | undefined
): SchemaInputField | undefined => {
  if (!fieldDef) return fieldDef;
  if (fieldDef.type) return fieldDef;
  const variants = fieldDef.anyOf || fieldDef.oneOf || fieldDef.allOf;
  if (!Array.isArray(variants)) return fieldDef;
  const resolved = variants.find((variant) => variant?.type);
  return resolved ? { ...fieldDef, ...resolved } : fieldDef;
};

const isUriLike = (fieldDef: SchemaInputField | undefined): boolean => {
  const format = fieldDef?.format;
  return format === 'uri' || format === 'data-uri' || format === 'binary' || format === 'base64';
};

const isMediaType = (fieldDef: SchemaInputField | undefined, prefix: string): boolean =>
  typeof fieldDef?.contentMediaType === 'string' && fieldDef.contentMediaType.startsWith(prefix);

const detectMediaInputType = (
  key: string,
  fieldDef: SchemaInputField
): { mediaType: string; isArray: boolean; role?: string } | null => {
  const lowerKey = key.toLowerCase();
  const resolved = resolveDefinition(fieldDef);
  const resolvedItems = resolved?.type === 'array' ? resolveDefinition(resolved.items) : null;

  // Check for mask first
  if (lowerKey.includes('mask')) {
    return { mediaType: 'mask', isArray: resolved?.type === 'array' };
  }

  // Check for image fields
  const isImageField =
    lowerKey.includes('image') ||
    lowerKey.includes('img') ||
    lowerKey.includes('photo') ||
    isMediaType(resolved, 'image/') ||
    (resolved?.type === 'array' && isMediaType(resolvedItems || undefined, 'image/'));

  if (
    isImageField &&
    (isUriLike(resolved) ||
      (resolved?.type === 'array' && isUriLike(resolvedItems || undefined)) ||
      resolved?.type === 'string')
  ) {
    const isStyleRef =
      lowerKey.includes('style') || lowerKey.includes('reference') || lowerKey.includes('ref_');
    return {
      mediaType: 'image',
      isArray: resolved?.type === 'array',
      role: isStyleRef ? 'style_reference' : 'pending',
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

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Build dynamic form fields from a Replicate model schema.
 * Analyzes the schema inputs and creates appropriate field definitions.
 */
export const buildDynamicFieldsFromSchema = (schema: ModelSchema): DynamicField[] => {
  const inputs = schema?.inputs || {};

  console.log('[buildDynamicFieldsFromSchema] All schema input keys:', Object.keys(inputs));
  Object.entries(inputs).forEach(([key, def]) => {
    console.log(`[buildDynamicFieldsFromSchema] ${key}:`, {
      type: def?.type,
      enum: def?.enum,
      anyOf: def?.anyOf,
    });
  });

  const fields: DynamicField[] = Object.entries(inputs)
    .map(([key, rawFieldDef]): DynamicField | null => {
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
          required: rawFieldDef.required,
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
            valueType: 'array',
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
          valueType: allNumbers ? 'number' : allBooleans ? 'boolean' : undefined,
        };
      }

      if (fieldDef.type === 'boolean') {
        return {
          key,
          label: toTitleCase(key),
          type: 'boolean',
          default: fieldDef.default,
          help: fieldDef.description,
          order: fieldDef.order ?? 999,
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
          order: fieldDef.order ?? 999,
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
          order: fieldDef.order ?? 999,
        };
      }

      return null;
    })
    .filter((f): f is DynamicField => f !== null)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Post-process: resolve 'pending' image field roles based on mask presence
  const hasMaskFields = fields.some((f) => f.type === 'media-input' && f.mediaType === 'mask');
  fields.forEach((field) => {
    if (field.type === 'media-input' && field.role === 'pending') {
      field.role = hasMaskFields ? 'primary' : 'img2img';
    }
  });

  return fields;
};

/**
 * Merge base node definition fields with dynamic fields from model schema.
 * Dynamic fields take precedence, and base fields are filtered to avoid duplicates.
 */
export const mergeDefinitionFields = (
  baseFields: DynamicField[] = [],
  dynamicFields: DynamicField[] = []
): DynamicField[] => {
  if (!dynamicFields.length) return baseFields;
  const merged: DynamicField[] = [];
  const seen = new Set<string>();
  const toCamelCase = (value: string): string =>
    value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const dynamicCamelKeys = new Set(dynamicFields.map((field) => toCamelCase(field.key)));
  const dynamicKeys = new Set(dynamicFields.map((field) => field.key));

  // Check if model uses aspect_ratio instead of width/height
  const hasAspectRatio = dynamicKeys.has('aspect_ratio') || dynamicCamelKeys.has('aspectRatio');
  const dimensionFieldsToHide = hasAspectRatio ? new Set(['width', 'height']) : new Set<string>();

  console.log('[mergeDefinitionFields] Dynamic field keys:', Array.from(dynamicKeys));
  console.log('[mergeDefinitionFields] hasAspectRatio:', hasAspectRatio);
  console.log('[mergeDefinitionFields] Will hide:', Array.from(dimensionFieldsToHide));

  const pushField = (field: DynamicField | undefined): void => {
    if (!field || !field.key || seen.has(field.key)) return;
    seen.add(field.key);
    merged.push(field);
  };

  const modelField = baseFields.find((field) => field.key === 'model');
  pushField(modelField);
  dynamicFields.forEach(pushField);
  baseFields.forEach((field) => {
    if (dynamicCamelKeys.has(field.key)) return;
    if (dimensionFieldsToHide.has(field.key)) return;
    pushField(field);
  });

  return merged;
};
