import { useState, useEffect, useMemo, useCallback } from 'react';
import { on } from '../utils/eventBus';

// =============================================================================
// Types
// =============================================================================

export interface ContentPayload {
  type?: string;
  value?: string;
  isChip?: boolean;
  chipId?: string;
  model?: string;
  fromWorkflow?: boolean;
  fromUpload?: boolean;
}

export interface NodeContentChangedEvent {
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
  content?: ContentPayload;
}

export interface UseNodeInputsOptions<T extends Record<string, unknown>> {
  /** The node's unique ID */
  nodeId: string;
  /** The node's data object (from ReactFlow) */
  data: T;
  /** Initial form state based on node type */
  initialFormState: T;
  /** Accepted input handle types (e.g., ['text', 'image']) */
  acceptedInputTypes?: string[];
  /** Map of targetHandle to expected type for multi-handle nodes */
  handleTypeMap?: Record<string, string>;
  /** Called when content is received from a connected node */
  onContentReceived?: (type: string, value: string, targetHandle?: string) => void;
  /** Called when chip values change */
  onChipValuesChange?: (chipValues: Record<string, string>) => void;
}

export interface UseNodeInputsReturn<T extends Record<string, unknown>> {
  /** Current form state */
  formState: T;
  /** Update form state */
  setFormState: React.Dispatch<React.SetStateAction<T>>;
  /** Current chip values (chipId -> replacement value) */
  chipValues: Record<string, string>;
  /** Whether any chips are connected */
  hasChipsConnected: boolean;
  /** Prompt text with chip placeholders replaced */
  promptWithChips: string;
  /** Whether to show chip preview in UI */
  showChipPreview: boolean;
  /** Toggle chip preview visibility */
  setShowChipPreview: React.Dispatch<React.SetStateAction<boolean>>;
  /** Sync form state with node data */
  syncWithData: () => void;
  /** Clear all chip values */
  clearChipValues: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useNodeInputs - Shared hook for node input handling and chip management
 *
 * Centralizes the common input collection, chip replacement, and form state
 * management patterns used across all node types.
 *
 * @example
 * ```tsx
 * const {
 *   formState,
 *   setFormState,
 *   chipValues,
 *   hasChipsConnected,
 *   promptWithChips,
 *   showChipPreview,
 *   setShowChipPreview,
 * } = useNodeInputs({
 *   nodeId: id,
 *   data,
 *   initialFormState: { prompt: '', model: 'default-model' },
 *   acceptedInputTypes: ['text', 'prompt'],
 *   onContentReceived: (type, value) => {
 *     console.log(`Received ${type}: ${value}`);
 *   },
 * });
 * ```
 */
export function useNodeInputs<T extends Record<string, unknown>>(
  options: UseNodeInputsOptions<T>
): UseNodeInputsReturn<T> {
  const {
    nodeId,
    data,
    initialFormState,
    acceptedInputTypes = ['text', 'prompt'],
    handleTypeMap = {},
    onContentReceived,
    onChipValuesChange,
  } = options;

  // Form state management
  const [formState, setFormState] = useState<T>(() => {
    // Merge initial state with any existing data
    const merged = { ...initialFormState };
    for (const key in initialFormState) {
      if (data[key] !== undefined) {
        (merged as Record<string, unknown>)[key] = data[key];
      }
    }
    return merged;
  });

  // Chip values (chipId -> replacement value)
  const [chipValues, setChipValues] = useState<Record<string, string>>({});
  const [showChipPreview, setShowChipPreview] = useState(false);

  // Derived state
  const hasChipsConnected = Object.keys(chipValues).length > 0;

  // Replace chip placeholders in prompt
  const promptWithChips = useMemo(() => {
    const prompt = (formState as Record<string, unknown>).prompt;
    if (typeof prompt !== 'string') return '';

    let result = prompt;
    Object.entries(chipValues).forEach(([chipId, value]) => {
      // Match both __chipId__ and ${chipId} patterns
      const underscorePattern = new RegExp(`__${chipId}__`, 'gi');
      const bracketPattern = new RegExp(`\\$\\{${chipId}\\}`, 'gi');
      result = result.replace(underscorePattern, value);
      result = result.replace(bracketPattern, value);
    });
    return result;
  }, [formState, chipValues]);

  // Sync with data changes
  const syncWithData = useCallback(() => {
    const synced = { ...formState };
    let changed = false;

    for (const key in initialFormState) {
      if (data[key] !== undefined && data[key] !== synced[key]) {
        (synced as Record<string, unknown>)[key] = data[key];
        changed = true;
      }
    }

    if (changed) {
      setFormState(synced);
    }
  }, [formState, data, initialFormState]);

  // Clear chip values
  const clearChipValues = useCallback(() => {
    setChipValues({});
  }, []);

  // Listen for content changes from connected nodes
  useEffect(() => {
    const handleNodeContentChanged = (event: NodeContentChangedEvent): void => {
      const { targetId, content, targetHandle } = event;

      // Only process events for this node
      if (targetId !== nodeId) return;

      // Handle chip content
      if (content?.isChip && content?.chipId) {
        const newChipValues = {
          ...chipValues,
          [content.chipId]: content.value || '',
        };
        setChipValues(newChipValues);

        // Also update data object for persistence
        (data as Record<string, unknown>).chipValues = newChipValues;

        onChipValuesChange?.(newChipValues);
        return;
      }

      // Handle regular content
      if (content?.type && content?.value !== undefined) {
        // Check if we accept this input type
        const expectedType = handleTypeMap[targetHandle || ''] || null;
        const isAccepted =
          acceptedInputTypes.includes(content.type) ||
          (expectedType && expectedType === content.type);

        if (isAccepted) {
          onContentReceived?.(content.type, content.value, targetHandle);
        }
      }
    };

    const unsubscribe = on('nodeContentChanged', handleNodeContentChanged);
    return () => unsubscribe();
  }, [
    nodeId,
    data,
    chipValues,
    acceptedInputTypes,
    handleTypeMap,
    onContentReceived,
    onChipValuesChange,
  ]);

  // Notify when chip values change
  useEffect(() => {
    if (hasChipsConnected) {
      onChipValuesChange?.(chipValues);
    }
  }, [chipValues, hasChipsConnected, onChipValuesChange]);

  return {
    formState,
    setFormState,
    chipValues,
    hasChipsConnected,
    promptWithChips,
    showChipPreview,
    setShowChipPreview,
    syncWithData,
    clearChipValues,
  };
}

export default useNodeInputs;
