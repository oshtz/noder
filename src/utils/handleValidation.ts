/**
 * Handle Validation Utilities
 *
 * Functions for validating connections between node handles,
 * ensuring type compatibility and valid data flow.
 */

import type { Node, Edge, Connection } from 'reactflow';
import { nodeTypes } from '../nodes';
import { getHandleColor, areTypesCompatible } from '../constants/handleTypes';
import { getGlobalNodesRef } from '../context/WorkflowContext';
import type { HandleDataType, NodeHandle } from '../types/components';

// =============================================================================
// Types
// =============================================================================

/** Handle type (internal representation) */
export type HandleType = 'input' | 'output' | 'source' | 'target';

/** Handle info result */
export interface HandleInfo extends NodeHandle {
  color: string;
}

/** Connection with additional type info */
export interface TypedConnection extends Connection {
  sourceHandleType?: HandleType;
  targetHandleType?: HandleType;
  nodesSnapshot?: Node[];
}

/** Validation result for edges */
export interface EdgeValidationResult {
  validEdges: Edge[];
  validationErrors: EdgeValidationError[];
}

/** Validation error for a single edge */
export interface EdgeValidationError {
  edge: Edge;
  errors: string[];
}

/** Compatible connection info */
export interface CompatibleConnection {
  nodeId: string;
  handleId: string;
}

/** Validator function type */
export type Validator = (connection: TypedConnection) => boolean;

// =============================================================================
// Node Definition Type
// =============================================================================

interface NodeDefaultData {
  handles?: NodeHandle[];
  [key: string]: unknown;
}

interface NodeTypeDefinition {
  defaultData?: NodeDefaultData;
  [key: string]: unknown;
}

// =============================================================================
// Handle Info Functions
// =============================================================================

/**
 * Get handle info from node type definition
 * @param nodeType - Type of the node
 * @param handleId - ID of the handle
 * @param handleType - Type of handle (input/output)
 * @param handlesOverride - Optional handles override from node data
 * @returns Handle info or null if not found
 */
export const getHandleInfo = (
  nodeType: string | undefined,
  handleId: string | null | undefined,
  handleType: HandleType | undefined,
  handlesOverride?: NodeHandle[]
): HandleInfo | null => {
  if (!nodeType || !handleId) return null;

  const nodeDefinition = (nodeTypes as Record<string, NodeTypeDefinition>)[nodeType]?.defaultData;

  const matchesHandle = (handle: NodeHandle): boolean =>
    handle.id === handleId &&
    (!handleType ||
      handle.type === handleType ||
      (handleType === 'output' && handle.type === 'source') ||
      (handleType === 'input' && handle.type === 'target'));

  const handlesFromNode = Array.isArray(handlesOverride) ? handlesOverride : [];
  let handle = handlesFromNode.find(matchesHandle);

  if (!handle) {
    const fallbackHandles = nodeDefinition?.handles || [];
    handle = fallbackHandles.find(matchesHandle);
  }

  if (!handle) return null;

  const fallbackHandle = nodeDefinition?.handles?.find((h) => h.id === handleId);
  const resolvedDataType = (handle.dataType || fallbackHandle?.dataType || 'any') as HandleDataType;

  return {
    ...handle,
    dataType: resolvedDataType,
    color: getHandleColor(resolvedDataType),
  };
};

// =============================================================================
// Connection Validation Functions
// =============================================================================

/**
 * Validate connection between handles (version 1)
 * @param connection - Connection to validate
 * @returns True if connection is valid
 */
export const isValidConnection = (connection: Connection): boolean => {
  if (!connection.source || !connection.sourceHandle) return false;

  return getValidConnections(connection.source, connection.sourceHandle, 'output').some(
    (c) => c.handleId === connection.targetHandle
  );
};

/**
 * Validate connection between handles (version 2 - more detailed)
 * @param connection - Connection to validate
 * @returns True if connection is valid
 */
export const isValidConnection2 = (connection: TypedConnection): boolean => {
  const { source, sourceHandle, target, targetHandle } = connection;

  try {
    // Get source and target node types from the nodes
    const sourceNode = getGlobalNodesRef()?.current?.find((n) => n.id === source);
    const targetNode = getGlobalNodesRef()?.current?.find((n) => n.id === target);

    if (!sourceNode || !targetNode) return false;

    // Determine handle types - for ReactFlow's onConnect they'll be undefined
    const sourceType = connection.sourceHandleType || 'output';
    const targetType = connection.targetHandleType || 'input';

    // Get handle information
    const sourceHandleInfo = getHandleInfo(
      sourceNode.type,
      sourceHandle,
      sourceType,
      sourceNode.data?.handles as NodeHandle[] | undefined
    );
    const targetHandleInfo = getHandleInfo(
      targetNode.type,
      targetHandle,
      targetType,
      targetNode.data?.handles as NodeHandle[] | undefined
    );

    if (!sourceHandleInfo || !targetHandleInfo) {
      return false;
    }

    // Check if handle types are valid (output -> input)
    const isSourceOutput = sourceHandleInfo.type === 'output' || sourceHandleInfo.type === 'source';
    const isTargetInput = targetHandleInfo.type === 'input' || targetHandleInfo.type === 'target';

    if (!isSourceOutput || !isTargetInput) {
      return false;
    }

    // Check if data types are compatible
    if (!areTypesCompatible(sourceHandleInfo.dataType, targetHandleInfo.dataType)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating connection:', error);
    return false;
  }
};

/**
 * Validate connection (version 3 - permissive)
 * @param _connection - Connection to validate
 * @returns Always true
 */
export const isValidConnection3 = (_connection: Connection): boolean => {
  return true;
};

/**
 * Validate connection (version 4 - permissive)
 * @param _connection - Connection to validate
 * @returns Always true
 */
export const isValidConnection4 = (_connection: Connection): boolean => {
  return true;
};

// =============================================================================
// Compatible Connection Discovery
// =============================================================================

/**
 * Get valid connections for a handle
 * @param nodeId - ID of the node
 * @param handleId - ID of the handle
 * @param handleType - Type of handle
 * @returns Array of compatible connections
 */
export const getValidConnections = (
  nodeId: string,
  handleId: string,
  handleType: HandleType
): CompatibleConnection[] => {
  // Get the node's type
  const node = getGlobalNodesRef()?.current?.find((n) => n.id === nodeId);
  if (!node) return [];

  // Get the handle info
  const handle = getHandleInfo(
    node.type,
    handleId,
    handleType,
    node.data?.handles as NodeHandle[] | undefined
  );
  if (!handle) return [];

  // Get all nodes
  const allNodes = getGlobalNodesRef()?.current || [];

  // For each node, check if it has a compatible handle
  return allNodes.flatMap((otherNode) => {
    if (otherNode.id === nodeId) return []; // Skip self

    const nodeDefinition = (nodeTypes as Record<string, NodeTypeDefinition>)[otherNode.type || '']
      ?.defaultData;
    const handlesFromNode = otherNode.data?.handles as NodeHandle[] | undefined;
    const handles =
      Array.isArray(handlesFromNode) && handlesFromNode.length
        ? handlesFromNode
        : nodeDefinition?.handles || [];
    if (!handles.length) return [];

    return handles
      .filter((h) => {
        // If this is a source handle, look for target handles
        const isThisOutput = handle.type === 'output' || handle.type === 'source';
        const isOtherInput = h.type === 'input' || h.type === 'target';

        if (isThisOutput && isOtherInput) {
          return areTypesCompatible(handle.dataType, h.dataType);
        }

        // If this is a target handle, look for source handles
        const isThisInput = handle.type === 'input' || handle.type === 'target';
        const isOtherOutput = h.type === 'output' || h.type === 'source';

        if (isThisInput && isOtherOutput) {
          return areTypesCompatible(h.dataType, handle.dataType);
        }

        return false;
      })
      .map((h) => ({
        nodeId: otherNode.id,
        handleId: h.id,
      }));
  });
};

// =============================================================================
// Validation Registry
// =============================================================================

const validationRegistry = new Map<string, Validator>();

/**
 * Register a validation rule
 * @param name - Name of the validation rule
 * @param validator - Validator function
 */
export const registerValidation = (name: string, validator: Validator): void => {
  validationRegistry.set(name, validator);
};

/**
 * Get a validator by name
 * @param name - Name of the validation rule
 * @returns Validator function
 */
export const getValidator = (name: string): Validator => {
  const validator = validationRegistry.get(name);
  if (!validator) {
    console.warn(`Validation rule '${name}' not found, defaulting to true`);
    return () => true;
  }
  return (connection: TypedConnection): boolean => {
    try {
      return validator(connection);
    } catch (error) {
      console.error(`Error in validation rule '${name}':`, error);
      return false;
    }
  };
};

// =============================================================================
// Core Validations
// =============================================================================

// Register core validations
registerValidation('type-mismatch', (connection: TypedConnection): boolean => {
  if (!connection.sourceHandleType || !connection.targetHandleType) {
    return false;
  }
  return connection.sourceHandleType === 'output' && connection.targetHandleType === 'input';
});

registerValidation('unique-handles', (connection: TypedConnection): boolean => {
  return connection.sourceHandle !== connection.targetHandle;
});

registerValidation('data-flow', (connection: TypedConnection): boolean => {
  // Prevent self-connections
  if (connection.source === connection.target) {
    return false;
  }

  // Add more data flow validation as needed
  return true;
});

registerValidation('data-type-match', (connection: TypedConnection): boolean => {
  const { source, target, sourceHandle, targetHandle } = connection;
  const nodes = connection.nodesSnapshot || getGlobalNodesRef()?.current || [];
  const sourceNode = nodes?.find((n) => n.id === source);
  const targetNode = nodes?.find((n) => n.id === target);

  if (!sourceNode || !targetNode) return false;

  const sourceHandleInfo = getHandleInfo(
    sourceNode.type,
    sourceHandle,
    connection.sourceHandleType || 'output',
    sourceNode.data?.handles as NodeHandle[] | undefined
  );
  const targetHandleInfo = getHandleInfo(
    targetNode.type,
    targetHandle,
    connection.targetHandleType || 'input',
    targetNode.data?.handles as NodeHandle[] | undefined
  );

  if (!sourceHandleInfo || !targetHandleInfo) return false;

  return areTypesCompatible(sourceHandleInfo.dataType, targetHandleInfo.dataType);
});

// =============================================================================
// Edge Validation
// =============================================================================

/**
 * Validate all edges against registered validators
 * @param edges - Edges to validate
 * @param nodes - Nodes for context
 * @returns Validation result with valid edges and errors
 */
export const validateEdges = (edges: Edge[], nodes: Node[]): EdgeValidationResult => {
  const validationErrors: EdgeValidationError[] = [];
  // Skip data-type-match validation to allow previously saved edges to load correctly.
  // The data-type-match validation uses getHandleInfo which may fail to find handles
  // if node type definitions change between versions. Data type matching is still
  // enforced when creating new connections via ReactFlow's isValidConnection callback.
  const validations = ['type-mismatch', 'unique-handles', 'data-flow'];

  const validEdges = edges.filter((edge) => {
    const errors: string[] = [];
    const isValid = validations.every((validationName) => {
      const result = getValidator(validationName)({
        ...edge,
        sourceHandleType: 'output',
        targetHandleType: 'input',
        nodesSnapshot: nodes,
      });
      if (!result) errors.push(validationName);
      return result;
    });

    if (!isValid) {
      validationErrors.push({ edge, errors });
    }
    return isValid;
  });

  return { validEdges, validationErrors };
};
