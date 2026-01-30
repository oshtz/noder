import { useState, useEffect, useCallback } from 'react';
import { Edge } from 'reactflow';
import { emit } from '../utils/eventBus';

// =============================================================================
// Types
// =============================================================================

export interface ContentPayload {
  type: string;
  value: string;
  model?: string;
  fromWorkflow?: boolean;
}

export interface UseNodeOutputOptions {
  /** The node's unique ID */
  nodeId: string;
  /** The node's data object (from ReactFlow) */
  data: Record<string, unknown>;
  /** Current edges in the workflow */
  edges: Edge[];
  /** Handle type for output (e.g., 'image', 'text', 'video', 'audio') */
  handleType: string;
  /** Source handle ID (e.g., 'out', 'video-out', 'audio-out') */
  sourceHandle: string;
  /** Current model being used (optional, for metadata) */
  model?: string;
  /** Called when output value changes */
  onOutputChange?: (value: string | null) => void;
}

export interface UseNodeOutputReturn {
  /** Current output value */
  outputValue: string | null;
  /** Update output value locally */
  setOutputValue: React.Dispatch<React.SetStateAction<string | null>>;
  /** Dispatch output to all connected downstream nodes */
  dispatchOutput: (value: string) => void;
  /** Sync local state with data.output */
  syncWithData: () => void;
  /** Clear output value */
  clearOutput: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useNodeOutput - Shared hook for node output state and dispatch
 *
 * Centralizes the output state management and event emission patterns
 * used across all node types.
 *
 * @example
 * ```tsx
 * const {
 *   outputValue,
 *   setOutputValue,
 *   dispatchOutput,
 *   syncWithData,
 * } = useNodeOutput({
 *   nodeId: id,
 *   data,
 *   edges,
 *   handleType: HANDLE_TYPES.IMAGE.type,
 *   sourceHandle: 'out',
 *   model: formState.model,
 *   onOutputChange: (value) => {
 *     console.log('Output changed:', value);
 *   },
 * });
 *
 * // After prediction completes
 * dispatchOutput(imageUrl);
 * ```
 */
export function useNodeOutput(options: UseNodeOutputOptions): UseNodeOutputReturn {
  const { nodeId, data, edges, handleType, sourceHandle, model, onOutputChange } = options;

  const [outputValue, setOutputValue] = useState<string | null>((data.output as string) || null);

  // Sync local state with data.output when it changes externally
  useEffect(() => {
    const dataOutput = data.output as string | undefined;

    if (dataOutput && dataOutput !== outputValue) {
      setOutputValue(dataOutput);
      onOutputChange?.(dataOutput);
    } else if (!dataOutput && outputValue) {
      setOutputValue(null);
      onOutputChange?.(null);
    }
  }, [data.output, outputValue, onOutputChange]);

  // Manual sync function for explicit synchronization
  const syncWithData = useCallback(() => {
    const dataOutput = data.output as string | undefined;
    if (dataOutput !== outputValue) {
      setOutputValue(dataOutput || null);
    }
  }, [data.output, outputValue]);

  // Clear output
  const clearOutput = useCallback(() => {
    setOutputValue(null);
    data.output = undefined;
    onOutputChange?.(null);
  }, [data, onOutputChange]);

  // Dispatch output to connected downstream nodes
  const dispatchOutput = useCallback(
    (value: string): void => {
      // Update local state
      setOutputValue(value);

      // Update data object for persistence
      data.output = value;

      // Notify callback
      onOutputChange?.(value);

      // Find all outgoing edges from this node's output handle
      const outgoingEdges = edges.filter(
        (edge: Edge) => edge.source === nodeId && edge.sourceHandle === sourceHandle
      );

      if (outgoingEdges.length === 0) {
        return;
      }

      // Build payload
      const payload: ContentPayload = {
        type: handleType,
        value,
        fromWorkflow: true,
      };

      if (model) {
        payload.model = model;
      }

      // Emit content changed events to all connected nodes
      outgoingEdges.forEach((edge: Edge) => {
        emit('nodeContentChanged', {
          sourceId: nodeId,
          targetId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          content: payload,
        });
      });

      console.log(
        `Dispatched ${handleType} output from ${nodeId} to ${outgoingEdges.length} connected node(s)`
      );
    },
    [nodeId, edges, handleType, sourceHandle, model, data, onOutputChange]
  );

  return {
    outputValue,
    setOutputValue,
    dispatchOutput,
    syncWithData,
    clearOutput,
  };
}

export default useNodeOutput;
