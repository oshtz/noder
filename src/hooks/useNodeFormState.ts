/**
 * Shared hook for managing node form state.
 * Handles form state, field updates, and syncing to node data.
 */

import { useState, useCallback, useEffect } from 'react';

interface BaseFormState {
  model: string;
  prompt?: string;
  [key: string]: unknown;
}

interface BaseNodeData {
  metadata?: string;
  [key: string]: unknown;
}

interface UseNodeFormStateOptions<
  TFormState extends BaseFormState,
  TNodeData extends BaseNodeData,
> {
  /** Initial form state */
  initialState: TFormState;
  /** Node data object to sync changes to */
  nodeData: TNodeData;
  /** Function to parse node data into form state */
  parseNodeData?: (data: TNodeData) => TFormState;
  /** Additional fields to watch for syncing */
  watchFields?: (keyof TFormState)[];
}

interface UseNodeFormStateReturn<TFormState extends BaseFormState> {
  /** Current form state */
  formState: TFormState;
  /** Set the entire form state */
  setFormState: React.Dispatch<React.SetStateAction<TFormState>>;
  /** Update a single field */
  updateField: <K extends keyof TFormState>(field: K, value: TFormState[K]) => void;
  /** Update multiple fields at once */
  updateFields: (updates: Partial<TFormState>) => void;
  /** Apply clipboard data to form */
  handleApplyClipboard: (clipboardData: TFormState) => void;
  /** Handle full form change (from SchemaForm) */
  handleFormChange: (next: TFormState) => void;
}

/**
 * Hook for managing node form state with automatic syncing to node data.
 *
 * @example
 * ```tsx
 * const { formState, updateField, handleFormChange, handleApplyClipboard } = useNodeFormState({
 *   initialState: parseNodeData(definition, data) as ImageFormState,
 *   nodeData: data,
 * });
 * ```
 */
export function useNodeFormState<TFormState extends BaseFormState, TNodeData extends BaseNodeData>({
  initialState,
  nodeData,
  parseNodeData,
  watchFields = [],
}: UseNodeFormStateOptions<TFormState, TNodeData>): UseNodeFormStateReturn<TFormState> {
  const [formState, setFormState] = useState<TFormState>(initialState);

  // Sync form state when watched fields change on node data
  useEffect(() => {
    if (!parseNodeData) return;

    const next = parseNodeData(nodeData);

    setFormState((prev) => {
      // Check if any watched fields have changed
      let hasChanges = false;
      for (const field of watchFields) {
        if (prev[field] !== next[field]) {
          hasChanges = true;
          break;
        }
      }

      // Also check standard fields
      if (prev.prompt !== next.prompt || prev.model !== next.model) {
        hasChanges = true;
      }

      return hasChanges ? next : prev;
    });
  }, [nodeData, parseNodeData, watchFields]);

  // Update a single field
  const updateField = useCallback(
    <K extends keyof TFormState>(field: K, value: TFormState[K]): void => {
      setFormState((prev) => {
        const next = { ...prev, [field]: value };

        // Sync to node data
        (nodeData as Record<string, unknown>)[field as string] = value;

        // Update metadata if model changed
        if (field === 'model' && typeof value === 'string') {
          nodeData.metadata = value.split('/').pop();
        }

        return next;
      });
    },
    [nodeData]
  );

  // Update multiple fields at once
  const updateFields = useCallback(
    (updates: Partial<TFormState>): void => {
      setFormState((prev) => {
        const next = { ...prev, ...updates };

        // Sync all updates to node data
        Object.assign(nodeData, updates);

        // Update metadata if model changed
        if (updates.model && typeof updates.model === 'string') {
          nodeData.metadata = updates.model.split('/').pop();
        }

        return next;
      });
    },
    [nodeData]
  );

  // Apply clipboard data to form
  const handleApplyClipboard = useCallback(
    (clipboardData: TFormState): void => {
      setFormState(clipboardData);
      Object.assign(nodeData, clipboardData);

      if (clipboardData.model) {
        nodeData.metadata = clipboardData.model.split('/').pop();
      }
    },
    [nodeData]
  );

  // Handle full form change (from SchemaForm)
  const handleFormChange = useCallback(
    (next: TFormState): void => {
      setFormState(next);
      Object.assign(nodeData, next);

      if (next.model) {
        nodeData.metadata = next.model.split('/').pop();
      }
    },
    [nodeData]
  );

  return {
    formState,
    setFormState,
    updateField,
    updateFields,
    handleApplyClipboard,
    handleFormChange,
  };
}

export default useNodeFormState;
