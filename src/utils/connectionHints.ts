import type { Node } from 'reactflow';
import { areTypesCompatible } from '../constants/handleTypes';
import { nodeTypes as registeredNodeTypes } from '../nodes';
import type { NodeHandle } from '../types/components';

export interface ConnectionTargetHint {
  nodeId: string;
  label: string;
  handleId: string;
}

export interface ConnectionHint {
  sourceNodeLabel: string;
  sourceHandleType: string;
  compatibleTargets: ConnectionTargetHint[];
  invalidReason: string | null;
}

interface NodeTypeDefinition {
  defaultData?: {
    handles?: NodeHandle[];
  };
}

const isInputHandle = (handle: NodeHandle): boolean =>
  handle.type === 'input' || handle.type === 'target';

const getNodeLabel = (node: Node): string => {
  const data = node.data || {};
  return String(data.customTitle || data.title || data.label || node.type || node.id);
};

const getNodeHandles = (node: Node): NodeHandle[] => {
  const handlesFromNode = node.data?.handles;
  if (Array.isArray(handlesFromNode) && handlesFromNode.length > 0) {
    return handlesFromNode as NodeHandle[];
  }

  const nodeDefinition = registeredNodeTypes[node.type || ''] as NodeTypeDefinition | undefined;
  return (nodeDefinition?.defaultData?.handles || []) as NodeHandle[];
};

export const buildConnectionHint = (
  nodes: Node[],
  connectingNodeId: string | null,
  connectingHandleId: string | null,
  connectingHandleType: string | null
): ConnectionHint | null => {
  if (!connectingNodeId || !connectingHandleId) return null;

  const sourceNode = nodes.find((node) => node.id === connectingNodeId);
  if (!sourceNode) return null;

  const sourceHandle = getNodeHandles(sourceNode).find(
    (handle) => handle.id === connectingHandleId
  );
  const sourceHandleType =
    connectingHandleType && !['source', 'target', 'input', 'output'].includes(connectingHandleType)
      ? connectingHandleType
      : sourceHandle?.dataType || 'any';

  const compatibleTargets = nodes.flatMap((node) => {
    if (node.id === connectingNodeId) return [];
    return getNodeHandles(node)
      .filter((handle) => isInputHandle(handle))
      .filter((handle) => areTypesCompatible(sourceHandleType, handle.dataType || 'any'))
      .map((handle) => ({
        nodeId: node.id,
        label: getNodeLabel(node),
        handleId: handle.id,
      }));
  });

  return {
    sourceNodeLabel: getNodeLabel(sourceNode),
    sourceHandleType,
    compatibleTargets,
    invalidReason:
      compatibleTargets.length === 0 ? `No nodes accept ${sourceHandleType} output yet.` : null,
  };
};

export const getConnectionHintNodeClass = (
  node: Node,
  hint: ConnectionHint | null,
  connectingNodeId: string | null
): string => {
  if (!hint || !connectingNodeId) return '';
  if (node.id === connectingNodeId) return 'connection-source';
  const isCompatible = hint.compatibleTargets.some((target) => target.nodeId === node.id);
  return isCompatible ? 'connection-compatible' : 'connection-incompatible';
};
