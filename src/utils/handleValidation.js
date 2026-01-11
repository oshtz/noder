import { nodeTypes } from "../nodes";
import { HANDLE_TYPES, getHandleColor, areTypesCompatible } from "../constants/handleTypes";

// Get handle info from node type definition
export const getHandleInfo = (nodeType, handleId, handleType, handlesOverride) => {
  const nodeDefinition = nodeTypes[nodeType]?.defaultData;
  const matchesHandle = (handle) =>
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
  const resolvedDataType = handle.dataType || fallbackHandle?.dataType || 'any';

  return {
    ...handle,
    dataType: resolvedDataType,
    color: getHandleColor(resolvedDataType)
  };
};

// Validate connection between handles
export const isValidConnection = (connection) => {
  return getValidConnections(
    connection.source,
    connection.sourceHandle,
    'output'
  ).includes(connection.targetHandle);
};

// Validate connection between handles
export const isValidConnection2 = (connection) => {
  const { source, sourceHandle, target, targetHandle } = connection;
  
  try {
    // Get source and target node types from the nodes
    const sourceNode = window.nodesRef?.current?.find(n => n.id === source);
    const targetNode = window.nodesRef?.current?.find(n => n.id === target);
    
    if (!sourceNode || !targetNode) return false;

    // Determine handle types - for ReactFlow's onConnect they'll be undefined
    const sourceType = connection.sourceHandleType || 'output';
    const targetType = connection.targetHandleType || 'input';

    // Get handle information
    const sourceHandleInfo = getHandleInfo(
      sourceNode.type,
      sourceHandle,
      sourceType,
      sourceNode.data?.handles
    );
    const targetHandleInfo = getHandleInfo(
      targetNode.type,
      targetHandle,
      targetType,
      targetNode.data?.handles
    );

    if (!sourceHandleInfo || !targetHandleInfo) {
      return false;
    }

    // Check if handle types are valid (output -> input)
    if (sourceHandleInfo.type !== 'output' || targetHandleInfo.type !== 'input') {
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

export const isValidConnection3 = (connection) => {
  // Add actual validation logic
  return true;
};

export const isValidConnection4 = (connection) => {
  // Add actual validation logic
  return true;
};

// Get valid connections for a handle
export const getValidConnections = (nodeId, handleId, handleType) => {
  // Get the node's type
  const node = window.nodesRef?.current?.find(n => n.id === nodeId);
  if (!node) return [];

  // Get the handle info
  const handle = getHandleInfo(node.type, handleId, handleType, node.data?.handles);
  if (!handle) return [];

  // Get all nodes
  const allNodes = window.nodesRef?.current || [];

  // For each node, check if it has a compatible handle
  return allNodes.flatMap(otherNode => {
    if (otherNode.id === nodeId) return []; // Skip self

    const nodeDefinition = nodeTypes[otherNode.type]?.defaultData;
    const handlesFromNode = otherNode.data?.handles;
    const handles =
      Array.isArray(handlesFromNode) && handlesFromNode.length
        ? handlesFromNode
        : nodeDefinition?.handles || [];
    if (!handles.length) return [];

    return handles
      .filter(h => {
        // If this is a source handle, look for target handles
        if (handle.type === 'output' && h.type === 'input') {
          return areTypesCompatible(handle.dataType, h.dataType);
        }
        // If this is a target handle, look for source handles
        if (handle.type === 'input' && h.type === 'output') {
          return areTypesCompatible(h.dataType, handle.dataType);
        }
        return false;
      })
      .map(h => ({
        nodeId: otherNode.id,
        handleId: h.id
      }));
  });
};

// Validation registry
const validationRegistry = new Map();

export const registerValidation = (name, validator) => {
  validationRegistry.set(name, validator);
};

export const getValidator = (name) => {
  const validator = validationRegistry.get(name);
  if (!validator) {
    console.warn(`Validation rule '${name}' not found, defaulting to true`);
    return () => true;
  }
  return (connection) => {
    try {
      return validator(connection);
    } catch (error) {
      console.error(`Error in validation rule '${name}':`, error);
      return false;
    }
  };
};

// Register core validations
registerValidation('type-mismatch', (connection) => {
  if (!connection.sourceHandleType || !connection.targetHandleType) {
    return false;
  }
  return connection.sourceHandleType === 'output' && connection.targetHandleType === 'input';
});

registerValidation('unique-handles', (connection) => {
  return connection.sourceHandle !== connection.targetHandle;
});

registerValidation('data-flow', (connection) => {
  // Prevent self-connections
  if (connection.source === connection.target) {
    return false;
  }
  
  // Add more data flow validation as needed
  return true;
});

registerValidation('data-type-match', (connection) => {
  const { source, target, sourceHandle, targetHandle } = connection;
  const nodes = connection.nodesSnapshot || window.nodesRef?.current || [];
  const sourceNode = nodes?.find((n) => n.id === source);
  const targetNode = nodes?.find((n) => n.id === target);

  if (!sourceNode || !targetNode) return false;

  const sourceHandleInfo = getHandleInfo(
    sourceNode.type,
    sourceHandle,
    connection.sourceHandleType || 'output',
    sourceNode.data?.handles
  );
  const targetHandleInfo = getHandleInfo(
    targetNode.type,
    targetHandle,
    connection.targetHandleType || 'input',
    targetNode.data?.handles
  );

  if (!sourceHandleInfo || !targetHandleInfo) return false;

  return areTypesCompatible(sourceHandleInfo.dataType, targetHandleInfo.dataType);
});

export const validateEdges = (edges, nodes) => {
  const validationErrors = [];
  const validations = ['type-mismatch', 'unique-handles', 'data-flow', 'data-type-match'];
  
  const validEdges = edges.filter(edge => {
    const errors = [];
    const isValid = validations.every(validationName => {
      const result = getValidator(validationName)({
        ...edge,
        sourceHandleType: 'output',
        targetHandleType: 'input',
        nodesSnapshot: nodes
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
