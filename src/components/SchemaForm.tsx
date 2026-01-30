import React, { useState, ChangeEvent } from 'react';
import { ReplicateModelPicker } from './ReplicateModelPicker';
import { ZodSchema } from 'zod';

// =============================================================================
// Types
// =============================================================================

type FieldType = 'text' | 'textarea' | 'select' | 'slider' | 'number' | 'boolean' | 'media-input';

type ValueType = 'string' | 'number' | 'boolean' | 'array';

interface FieldDefinition {
  key: string;
  label: string;
  type?: FieldType;
  valueType?: ValueType;
  placeholder?: string;
  help?: string;
  options?: string[];
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  mediaType?: string;
  role?: string;
  isArray?: boolean;
}

interface SchemaDefinition {
  type?: string;
  fields?: FieldDefinition[];
  zod?: ZodSchema;
  allowPassthrough?: boolean;
}

interface ConnectedMediaItem {
  sourceId?: string;
  url?: string;
  title?: string;
}

interface ConnectedInputs {
  [mediaType: string]: ConnectedMediaItem[];
}

interface ChangeMetadata {
  path: string;
  value: unknown;
  valid: boolean;
}

interface SchemaFormProps {
  definition: SchemaDefinition;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>, metadata: ChangeMetadata) => void;
  connectedInputs?: ConnectedInputs;
}

// =============================================================================
// Helper Functions
// =============================================================================

const coerceValue = (field: FieldDefinition, value: unknown): unknown => {
  if (field?.valueType === 'number') {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
  }
  if (field?.valueType === 'boolean') {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  }
  if (field?.valueType === 'array') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }
  if (field?.type === 'boolean') {
    if (typeof value === 'boolean') return value;
    return value === 'true';
  }
  if (field?.type === 'number' || field?.type === 'slider') {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
  }
  return value;
};

// =============================================================================
// SchemaForm Component
// =============================================================================

export const SchemaForm: React.FC<SchemaFormProps> = ({
  definition,
  values,
  onChange,
  connectedInputs = {},
}) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleFieldChange = (field: FieldDefinition, rawValue: unknown): void => {
    const coerced = coerceValue(field, rawValue);
    const next = {
      ...values,
      [field.key]: coerced,
    };

    if (definition.zod) {
      const parser = definition.allowPassthrough ? definition.zod.passthrough() : definition.zod;
      const parsed = parser.safeParse(next);
      if (!parsed.success) {
        const fieldErrors = parsed.error.formErrors.fieldErrors as Record<string, string[]>;
        setErrors(fieldErrors);
        onChange(next, { path: field.key, value: coerced, valid: false });
        return;
      }

      setErrors({});
      onChange(parsed.data as Record<string, unknown>, {
        path: field.key,
        value: (parsed.data as Record<string, unknown>)[field.key],
        valid: true,
      });
      return;
    }

    setErrors({});
    onChange(next, { path: field.key, value: coerced, valid: true });
  };

  const renderField = (field: FieldDefinition): JSX.Element => {
    // Check if this is a model field for Replicate nodes
    const isReplicateModel = field.key === 'model' && definition.type?.startsWith('replicate-');

    if (isReplicateModel) {
      // Map node types to Replicate collection slugs
      const collectionMap: Record<string, string[]> = {
        text: ['language-models', 'speech-to-text', 'official'],
        image: ['text-to-image', 'image-editing', 'official'],
        upscaler: ['super-resolution', 'official'],
        video: ['text-to-video', 'ai-enhance-videos', 'official'],
        audio: ['ai-music-generation', 'text-to-speech', 'official'],
      };

      const collectionSlug = definition.type ? collectionMap[definition.type] || null : null;

      return (
        <ReplicateModelPicker
          value={(values[field.key] as string) ?? ''}
          onChange={(newValue) => handleFieldChange(field, newValue)}
          placeholder={field.placeholder || 'Select or search for a model...'}
          collectionSlug={collectionSlug}
        />
      );
    }

    const commonProps = {
      id: `${definition.type}-${field.key}`,
      value: (values[field.key] as string | number) ?? '',
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleFieldChange(field, e.target.value),
    };

    switch (field.type) {
      case 'textarea':
        return <textarea {...commonProps} placeholder={field.placeholder} rows={field.rows || 3} />;
      case 'select':
        return (
          <select {...commonProps}>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case 'slider':
        return (
          <div className="schema-field--slider">
            <input
              {...commonProps}
              type="range"
              min={field.min ?? 0}
              max={field.max ?? 1}
              step={field.step ?? 0.1}
            />
            <span className="schema-field--value">{values[field.key] as string | number}</span>
          </div>
        );
      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
          />
        );
      case 'boolean':
        return (
          <label className="schema-field--checkbox">
            <input
              id={`${definition.type}-${field.key}`}
              type="checkbox"
              checked={Boolean(values[field.key])}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleFieldChange(field, e.target.checked)
              }
            />
          </label>
        );
      case 'media-input': {
        const mediaType = field.mediaType || 'image';

        // Skip primary (inpainting) and mask fields - not yet implemented
        if (field.role === 'primary' || mediaType === 'mask') {
          return (
            <div className="schema-field--media-input">
              <div className="schema-field--media-empty schema-field--media-disabled">
                Inpainting not yet supported
              </div>
            </div>
          );
        }

        // Get connected inputs for this media type
        const connectedItems = connectedInputs[mediaType] || [];
        const hasConnections = connectedItems.length > 0;

        return (
          <div className="schema-field--media-input">
            {hasConnections ? (
              <div className="schema-field--media-previews">
                {connectedItems.map((item, index) => (
                  <div key={item.sourceId || index} className="schema-field--media-preview">
                    {item.url ? (
                      <img
                        src={item.url}
                        alt={item.title || `${mediaType} ${index + 1}`}
                        className="schema-field--media-thumbnail"
                      />
                    ) : (
                      <div className="schema-field--media-placeholder">
                        {item.title || 'Pending...'}
                      </div>
                    )}
                    <span className="schema-field--media-title" title={item.title}>
                      {item.title || `Input ${index + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="schema-field--media-empty">
                Connect {field.isArray ? `${mediaType}(s)` : `a ${mediaType}`} to this node
              </div>
            )}
          </div>
        );
      }
      default:
        return <input {...commonProps} type="text" placeholder={field.placeholder} />;
    }
  };

  return (
    <div className="schema-form">
      {(definition.fields || []).map((field) => (
        <label key={field.key} className="schema-field">
          <div className="schema-field--label">
            <span>{field.label}</span>
            {field.help && <small>{field.help}</small>}
          </div>
          {renderField(field)}
          {errors[field.key] && (
            <div className="schema-field--error">{errors[field.key].join(', ')}</div>
          )}
        </label>
      ))}
    </div>
  );
};

export default SchemaForm;
