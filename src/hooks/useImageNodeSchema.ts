/**
 * Hook for managing Replicate model schema fetching and dynamic field generation.
 * Handles schema loading, error states, and default value application.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchModelSchema, clearSchemaCache } from '../utils/replicateSchemaCache';
import {
  buildDynamicFieldsFromSchema,
  mergeDefinitionFields,
  DynamicField,
  ModelSchema,
} from '../utils/schemaFieldBuilder';
import type { SchemaStatus, ImageFormState } from '../types/imageNode';
import type { NodeSchemaDefinition } from '../nodes/nodeSchemas';

interface UseImageNodeSchemaOptions {
  modelId: string;
  definition: NodeSchemaDefinition;
  formState: ImageFormState;
  setFormState: React.Dispatch<React.SetStateAction<ImageFormState>>;
  data: Record<string, unknown>;
}

interface UseImageNodeSchemaResult {
  dynamicFields: DynamicField[];
  schemaStatus: SchemaStatus;
  schemaError: string | null;
  activeDefinition: NodeSchemaDefinition & { allowPassthrough?: boolean };
  refreshSchema: () => void;
}

/**
 * Hook for fetching and managing Replicate model schemas.
 * Automatically fetches schema when model changes and builds dynamic form fields.
 */
export function useImageNodeSchema({
  modelId,
  definition,
  formState: _formState,
  setFormState,
  data,
}: UseImageNodeSchemaOptions): UseImageNodeSchemaResult {
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  const [schemaStatus, setSchemaStatus] = useState<SchemaStatus>('idle');
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Fetch schema when model changes
  useEffect(() => {
    let isCancelled = false;
    const trimmedModelId = modelId?.trim();

    if (!trimmedModelId) {
      setDynamicFields([]);
      setSchemaStatus('idle');
      setSchemaError(null);
      return undefined;
    }

    setSchemaStatus('loading');
    setSchemaError(null);

    fetchModelSchema(trimmedModelId)
      .then((schema: ModelSchema) => {
        if (isCancelled) return;
        const nextFields = buildDynamicFieldsFromSchema(schema);
        setDynamicFields(nextFields);
        setSchemaStatus('loaded');

        // Apply default values from schema
        if (nextFields.length) {
          const defaults: Record<string, unknown> = {};
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

            // Also update data object
            Object.entries(defaults).forEach(([key, value]) => {
              if (data[key] === undefined || data[key] === null || data[key] === '') {
                data[key] = value;
              }
            });
          }
        }
      })
      .catch((err: Error) => {
        if (isCancelled) return;
        setDynamicFields([]);
        setSchemaStatus('error');
        setSchemaError(err?.message || 'Failed to load model schema.');
      });

    return () => {
      isCancelled = true;
    };
  }, [modelId, data, setFormState]);

  // Build merged definition with dynamic fields
  const activeDefinition = useMemo(() => {
    if (!dynamicFields.length) return definition;
    return {
      ...definition,
      fields: mergeDefinitionFields((definition.fields || []) as DynamicField[], dynamicFields),
      allowPassthrough: true,
    };
  }, [dynamicFields, definition]);

  // Refresh schema function
  const refreshSchema = useCallback(() => {
    const trimmedModelId = modelId?.trim();
    if (!trimmedModelId) return;

    console.log('[useImageNodeSchema] Clearing schema cache and refetching for:', trimmedModelId);
    clearSchemaCache();
    setSchemaStatus('loading');
    setDynamicFields([]);

    fetchModelSchema(trimmedModelId)
      .then((schema: ModelSchema) => {
        console.log('[useImageNodeSchema] Refetched schema:', schema);
        const nextFields = buildDynamicFieldsFromSchema(schema);
        console.log('[useImageNodeSchema] Built dynamic fields:', nextFields);
        setDynamicFields(nextFields);
        setSchemaStatus('loaded');
      })
      .catch((err: Error) => {
        console.error('[useImageNodeSchema] Schema refetch failed:', err);
        setSchemaStatus('error');
        setSchemaError(err?.message || 'Failed to load model schema.');
      });
  }, [modelId]);

  return {
    dynamicFields,
    schemaStatus,
    schemaError,
    activeDefinition,
    refreshSchema,
  };
}
