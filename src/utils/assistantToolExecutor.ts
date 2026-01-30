import type { Node, Edge } from 'reactflow';
import { nodeCreators, nodeTypes } from '../nodes';
import { validateEdges, type EdgeValidationError } from './handleValidation';
import type { EdgeSpec, NodeSpec } from './assistantTools';

// Layout configuration for node positioning
const DEFAULT_LAYOUT = {
  origin: { x: 140, y: 160 },
  stepX: 260,
  stepY: 160,
} as const;

// Handle type definitions
interface Handle {
  id: string;
  type: 'input' | 'output' | 'target' | 'source';
  dataType?: string;
}

// Node data structure
interface NodeData {
  title?: string;
  onRemove?: (id: string) => void;
  handles?: Handle[];
  executionOrder?: number;
  output?: unknown;
  [key: string]: unknown;
}

// Extended node type with data
type WorkflowNode = Node<NodeData>;
type WorkflowEdge = Edge<{ isProcessing?: boolean }>;

// Tool call structure from OpenRouter
interface ToolCall {
  function?: {
    name: string;
    arguments?: string | Record<string, unknown>;
  };
  name?: string;
  arguments?: string | Record<string, unknown>;
}

// Parsed arguments with potential parse error
interface ParsedArgs extends Record<string, unknown> {
  __parseError?: string;
  __raw?: unknown;
}

// Tool executor configuration
interface ToolExecutorConfig {
  getNodes: () => WorkflowNode[];
  getEdges: () => WorkflowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkflowEdge[]>>;
  handleRemoveNode: (id: string) => void;
  setValidationErrors: React.Dispatch<React.SetStateAction<EdgeValidationError[]>>;
  runWorkflow: () => Promise<unknown>;
  focusCanvas?: () => void;
  allowedNodeTypes?: Set<string> | string[] | null;
}

// Result types for tool execution
interface CreateWorkflowResult {
  replaced?: boolean;
  idMap?: Record<string, string>;
  createdNodes?: Array<{ id: string; type: string }>;
  skippedNodes?: Array<{ node: NodeSpec; reason: string }>;
  createdEdges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>;
  skippedEdges?: Array<{ edge: EdgeSpec; reason: string }>;
  validationErrors?: EdgeValidationError[];
  error?: string;
  raw?: unknown;
}

interface ConnectWorkflowResult {
  createdEdges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>;
  skippedEdges?: Array<{ edge: EdgeSpec; reason: string }>;
  validationErrors?: EdgeValidationError[];
  error?: string;
  raw?: unknown;
}

interface ValidateWorkflowResult {
  totalEdges: number;
  validEdges: number;
  invalidEdges: number;
  validationErrors: EdgeValidationError[];
}

interface RunWorkflowResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

interface GetStateResult {
  nodeCount: number;
  edgeCount: number;
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    data?: NodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

interface GetNodeResult {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: NodeData;
  handles: {
    inputs: string[];
    outputs: string[];
  };
  connections: {
    incoming: Array<{ from: string; handle?: string }>;
    outgoing: Array<{ to: string; handle?: string }>;
  };
  error?: string;
  raw?: unknown;
}

interface GetOutputsResult {
  outputs: Array<{
    nodeId: string;
    type: string;
    hasOutput: boolean;
    output: unknown;
    outputType: string | null;
  }>;
}

interface UpdateNodeResult {
  nodeId?: string;
  updated?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  error?: string;
  raw?: unknown;
}

interface DeleteNodesResult {
  deletedNodes?: string[];
  deletedEdges?: string[];
  notFound?: string[];
  remainingNodes?: number;
  remainingEdges?: number;
  error?: string;
  raw?: unknown;
}

interface DeleteEdgesResult {
  deletedEdges?: string[];
  remainingEdges?: number;
  error?: string;
  raw?: unknown;
}

interface ClearWorkflowResult {
  cleared?: boolean;
  deletedNodes?: number;
  deletedEdges?: number;
  error?: string;
  raw?: unknown;
}

interface SetPromptsResult {
  nodeId?: string;
  updated?: Record<string, unknown>;
  error?: string;
  raw?: unknown;
}

type ToolResult =
  | CreateWorkflowResult
  | ConnectWorkflowResult
  | ValidateWorkflowResult
  | RunWorkflowResult
  | GetStateResult
  | GetNodeResult
  | GetOutputsResult
  | UpdateNodeResult
  | DeleteNodesResult
  | DeleteEdgesResult
  | ClearWorkflowResult
  | SetPromptsResult
  | { error: string };

// Utility functions
const safeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizePosition = (
  position: { x?: number; y?: number } | undefined,
  index: number
): { x: number; y: number } => {
  if (position && typeof position === 'object') {
    const x = safeNumber(position.x, DEFAULT_LAYOUT.origin.x);
    const y = safeNumber(position.y, DEFAULT_LAYOUT.origin.y);
    return { x, y };
  }

  return {
    x: DEFAULT_LAYOUT.origin.x + index * DEFAULT_LAYOUT.stepX,
    y: DEFAULT_LAYOUT.origin.y + (index % 3) * DEFAULT_LAYOUT.stepY,
  };
};

const ensureUniqueId = (
  preferredId: string | undefined,
  existingIds: Set<string>,
  fallbackBase: string
): string => {
  let nextId = preferredId || fallbackBase;
  if (!nextId) {
    nextId = `node-${Date.now()}`;
  }
  let counter = 1;
  while (existingIds.has(nextId)) {
    nextId = `${nextId}-${counter}`;
    counter += 1;
  }
  existingIds.add(nextId);
  return nextId;
};

const getHandlesForNode = (nodeType: string): Handle[] =>
  (nodeTypes as Record<string, { defaultData?: { handles?: Handle[] } }>)?.[nodeType]?.defaultData
    ?.handles || [];

const pickHandle = (
  handles: Handle[],
  direction: 'input' | 'output',
  dataType?: string
): string | null => {
  const filtered = handles.filter((handle) => {
    if (direction === 'input') {
      return handle.type === 'input' || handle.type === 'target';
    }
    return handle.type === 'output' || handle.type === 'source';
  });

  if (dataType) {
    const match = filtered.find((handle) => handle.dataType === dataType);
    if (match) return match.id;
  }

  return filtered[0]?.id || null;
};

const parseToolArguments = (rawArgs: unknown): ParsedArgs => {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object') return rawArgs as ParsedArgs;
  try {
    return JSON.parse(rawArgs as string);
  } catch (error) {
    return { __parseError: (error as Error).message, __raw: rawArgs };
  }
};

interface BuildEdgeParams {
  edgeSpec: EdgeSpec;
  nodesById: Record<string, WorkflowNode>;
}

interface BuildEdgeResult {
  edge: WorkflowEdge | null;
  error: string | null;
}

const buildEdge = ({ edgeSpec, nodesById }: BuildEdgeParams): BuildEdgeResult => {
  const sourceNode = nodesById[edgeSpec.source];
  const targetNode = nodesById[edgeSpec.target];

  if (!sourceNode || !targetNode) {
    return {
      edge: null,
      error: `Missing source or target node: ${edgeSpec.source} -> ${edgeSpec.target}`,
    };
  }

  const sourceHandles = getHandlesForNode(sourceNode.type as string);
  const targetHandles = getHandlesForNode(targetNode.type as string);
  const inferredType = (() => {
    if (edgeSpec.dataType) return edgeSpec.dataType;
    if (edgeSpec.sourceHandle) {
      const source = sourceHandles.find((handle) => handle.id === edgeSpec.sourceHandle);
      return source?.dataType || null;
    }
    return null;
  })();
  const sourceHandle =
    edgeSpec.sourceHandle || pickHandle(sourceHandles, 'output', inferredType || undefined);
  const targetHandle =
    edgeSpec.targetHandle || pickHandle(targetHandles, 'input', inferredType || undefined);

  if (!sourceHandle || !targetHandle) {
    return {
      edge: null,
      error: `Could not resolve handles for ${edgeSpec.source} -> ${edgeSpec.target}`,
    };
  }

  const id = `e${edgeSpec.source}-${sourceHandle}-${edgeSpec.target}-${targetHandle}`;
  return {
    edge: {
      id,
      source: edgeSpec.source,
      target: edgeSpec.target,
      sourceHandle,
      targetHandle,
      type: 'custom',
      animated: false,
      data: { isProcessing: false },
    },
    error: null,
  };
};

/**
 * Create a tool executor with workflow manipulation capabilities
 */
export const createToolExecutor = ({
  getNodes,
  getEdges,
  setNodes,
  setEdges,
  handleRemoveNode,
  setValidationErrors,
  runWorkflow,
  focusCanvas,
  allowedNodeTypes,
}: ToolExecutorConfig) => {
  const allowedTypeSet = (() => {
    if (!allowedNodeTypes) return null;
    if (allowedNodeTypes instanceof Set) return allowedNodeTypes;
    if (Array.isArray(allowedNodeTypes)) return new Set(allowedNodeTypes);
    return null;
  })();

  const executeCreateWorkflow = (args: ParsedArgs): CreateWorkflowResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const nodesSpec = Array.isArray(args.nodes) ? (args.nodes as NodeSpec[]) : [];
    const edgesSpec = Array.isArray(args.edges) ? (args.edges as EdgeSpec[]) : [];
    const shouldReplace = Boolean(args.replace);
    const skippedNodes: Array<{ node: NodeSpec; reason: string }> = [];
    const filteredNodesSpec = nodesSpec.filter((spec) => {
      if (!allowedTypeSet || allowedTypeSet.has(spec.type)) return true;
      skippedNodes.push({
        node: spec,
        reason: `Node type "${spec.type}" is not allowed for assistant workflows.`,
      });
      return false;
    });

    const existingIds = new Set(shouldReplace ? [] : currentNodes.map((node) => node.id));
    const maxOrder = shouldReplace
      ? 0
      : currentNodes.reduce(
          (max, node) => Math.max(max, (node.data as NodeData)?.executionOrder || 0),
          0
        );

    const createdNodes: WorkflowNode[] = [];
    const nodeIdMap: Record<string, string> = {};

    filteredNodesSpec.forEach((spec, index) => {
      const fallbackId = `${spec.type || 'node'}-${Date.now()}-${index}`;
      const nodeId = ensureUniqueId(spec.id, existingIds, fallbackId);
      nodeIdMap[spec.id || nodeId] = nodeId;

      const createFn = (nodeCreators as Record<string, (opts: unknown) => WorkflowNode>)?.[
        spec.type
      ];
      const position = normalizePosition(spec.position, index);

      let newNode: WorkflowNode = createFn
        ? createFn({
            id: nodeId,
            handleRemoveNode,
            position,
          })
        : ({
            id: nodeId,
            type: spec.type,
            position,
            data: {
              title: spec.label || spec.type,
              onRemove: handleRemoveNode,
              handles: getHandlesForNode(spec.type),
            },
          } as WorkflowNode);

      newNode = {
        ...newNode,
        data: {
          ...(newNode.data as NodeData),
          ...spec.data,
          ...(spec.label ? { title: spec.label } : {}),
          executionOrder: maxOrder + createdNodes.length + 1,
        },
      } as WorkflowNode;

      createdNodes.push(newNode);
    });

    const nextNodes = shouldReplace ? createdNodes : [...currentNodes, ...createdNodes];
    const nodesById = nextNodes.reduce(
      (acc, node) => {
        acc[node.id] = node;
        return acc;
      },
      {} as Record<string, WorkflowNode>
    );

    const newEdges: WorkflowEdge[] = [];
    const skippedEdges: Array<{ edge: EdgeSpec; reason: string }> = [];

    edgesSpec.forEach((edgeSpec) => {
      const resolvedSpec = {
        ...edgeSpec,
        source: nodeIdMap[edgeSpec.source] || edgeSpec.source,
        target: nodeIdMap[edgeSpec.target] || edgeSpec.target,
      };
      const { edge, error } = buildEdge({ edgeSpec: resolvedSpec, nodesById });
      if (edge) {
        newEdges.push(edge);
      } else if (error) {
        skippedEdges.push({ edge: edgeSpec, reason: error });
      }
    });

    const { validEdges, validationErrors } = validateEdges(newEdges as Edge[], nextNodes as Node[]);
    if (validationErrors.length) {
      setValidationErrors((prev) => [...prev, ...validationErrors]);
    }

    const nextEdges = shouldReplace ? validEdges : [...currentEdges, ...validEdges];

    if (shouldReplace) {
      localStorage.removeItem('noder-nodes');
      localStorage.removeItem('noder-edges');
    }

    setNodes(nextNodes);
    setEdges(nextEdges as WorkflowEdge[]);
    if (typeof focusCanvas === 'function' && nextNodes.length) {
      setTimeout(() => focusCanvas(), 50);
    }

    return {
      replaced: shouldReplace,
      idMap: nodeIdMap,
      createdNodes: createdNodes.map((node) => ({
        id: node.id,
        type: node.type as string,
      })),
      skippedNodes,
      createdEdges: validEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? '',
        targetHandle: edge.targetHandle ?? '',
      })),
      skippedEdges,
      validationErrors,
    };
  };

  const executeConnectWorkflow = (args: ParsedArgs): ConnectWorkflowResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const connections = Array.isArray(args.connections) ? (args.connections as EdgeSpec[]) : [];
    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const nodesById = currentNodes.reduce(
      (acc, node) => {
        acc[node.id] = node;
        return acc;
      },
      {} as Record<string, WorkflowNode>
    );

    const newEdges: WorkflowEdge[] = [];
    const skippedEdges: Array<{ edge: EdgeSpec; reason: string }> = [];

    connections.forEach((edgeSpec) => {
      const { edge, error } = buildEdge({ edgeSpec, nodesById });
      if (edge) {
        newEdges.push(edge);
      } else if (error) {
        skippedEdges.push({ edge: edgeSpec, reason: error });
      }
    });

    const { validEdges, validationErrors } = validateEdges(
      newEdges as Edge[],
      currentNodes as Node[]
    );
    if (validationErrors.length) {
      setValidationErrors((prev) => [...prev, ...validationErrors]);
    }

    setEdges([...currentEdges, ...(validEdges as WorkflowEdge[])]);

    return {
      createdEdges: validEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? '',
        targetHandle: edge.targetHandle ?? '',
      })),
      skippedEdges,
      validationErrors,
    };
  };

  const executeValidateWorkflow = (): ValidateWorkflowResult => {
    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const { validEdges, validationErrors } = validateEdges(
      currentEdges as Edge[],
      currentNodes as Node[]
    );

    if (validationErrors.length) {
      setValidationErrors((prev) => [...prev, ...validationErrors]);
    }

    return {
      totalEdges: currentEdges.length,
      validEdges: validEdges.length,
      invalidEdges: validationErrors.length,
      validationErrors,
    };
  };

  const executeRunWorkflow = async (): Promise<RunWorkflowResult> => {
    try {
      const result = await runWorkflow();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message || String(error) };
    }
  };

  const executeTextNodeSetPrompts = (args: ParsedArgs): SetPromptsResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const currentNodes = getNodes() || [];
    const nodeId = typeof args.nodeId === 'string' ? args.nodeId : '';
    const textNodes = currentNodes.filter((node) => node.type === 'text');

    const targetNode = nodeId
      ? currentNodes.find((node) => node.id === nodeId)
      : textNodes.length === 1
        ? textNodes[0]
        : null;

    if (!targetNode) {
      if (!nodeId) {
        return {
          error: 'No nodeId provided and unable to resolve a single Text node to update.',
        };
      }
      return { error: `Text node not found: ${nodeId}` };
    }

    if (targetNode.type !== 'text') {
      return {
        error: `Node ${targetNode.id} is not a Text (text) node.`,
      };
    }

    const updates: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(args, 'prompt')) {
      updates.prompt = args.prompt ?? '';
    }
    if (Object.prototype.hasOwnProperty.call(args, 'systemPrompt')) {
      updates.systemPrompt = args.systemPrompt ?? '';
    }

    if (!Object.keys(updates).length) {
      return { error: 'No prompt fields provided to update.' };
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === targetNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            }
          : node
      )
    );

    return {
      nodeId: targetNode.id,
      updated: updates,
    };
  };

  // Phase 1: Read/Query Tools

  const executeGetState = (args: ParsedArgs): GetStateResult => {
    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const includeData = Boolean(args.include_data);

    const nodes = currentNodes.map((node) => {
      const base = {
        id: node.id,
        type: node.type as string,
        label: (node.data as NodeData)?.title || (node.type as string),
        position: node.position as { x: number; y: number },
        data: undefined as NodeData | undefined,
      };
      if (includeData) {
        base.data = (node.data as NodeData) || {};
      }
      return base;
    });

    const edges = currentEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return {
      nodeCount: currentNodes.length,
      edgeCount: currentEdges.length,
      nodes,
      edges,
    };
  };

  const executeGetNode = (args: ParsedArgs): GetNodeResult | { error: string; raw?: unknown } => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const nodeId = args.nodeId as string;
    if (!nodeId) {
      return { error: 'nodeId is required.' };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const targetNode = currentNodes.find((node) => node.id === nodeId);

    if (!targetNode) {
      return { error: `Node not found: ${nodeId}` };
    }

    const handles =
      (targetNode.data as NodeData)?.handles || getHandlesForNode(targetNode.type as string);
    const inputs = handles
      .filter((h: Handle) => h.type === 'input' || h.type === 'target')
      .map((h: Handle) => `${h.id}:${h.dataType || 'any'}`);
    const outputs = handles
      .filter((h: Handle) => h.type === 'output' || h.type === 'source')
      .map((h: Handle) => `${h.id}:${h.dataType || 'any'}`);

    const incoming = currentEdges
      .filter((e) => e.target === nodeId)
      .map((e) => ({ from: e.source, handle: e.sourceHandle }));
    const outgoing = currentEdges
      .filter((e) => e.source === nodeId)
      .map((e) => ({ to: e.target, handle: e.targetHandle }));

    return {
      id: targetNode.id,
      type: targetNode.type as string,
      label: (targetNode.data as NodeData)?.title || (targetNode.type as string),
      position: targetNode.position as { x: number; y: number },
      data: (targetNode.data as NodeData) || {},
      handles: { inputs, outputs },
      connections: { incoming, outgoing },
    };
  };

  const executeGetOutputs = (args: ParsedArgs): GetOutputsResult => {
    const currentNodes = getNodes() || [];
    const requestedIds = Array.isArray(args.nodeIds) ? (args.nodeIds as string[]) : [];

    const nodesToCheck = requestedIds.length
      ? currentNodes.filter((node) => requestedIds.includes(node.id))
      : currentNodes;

    const outputs = nodesToCheck.map((node) => {
      const output = (node.data as NodeData)?.output;
      const hasOutput = output !== undefined && output !== null && output !== '';

      let outputType: string = 'unknown';
      if (typeof output === 'string') {
        if (
          output.startsWith('http') &&
          (output.includes('.png') ||
            output.includes('.jpg') ||
            output.includes('.webp') ||
            output.includes('image'))
        ) {
          outputType = 'image_url';
        } else {
          outputType = 'text';
        }
      } else if (typeof output === 'object') {
        outputType = 'object';
      }

      return {
        nodeId: node.id,
        type: node.type as string,
        hasOutput,
        output: hasOutput ? output : null,
        outputType: hasOutput ? outputType : null,
      };
    });

    return { outputs };
  };

  // Phase 2: Mutation Tools

  const executeUpdateNode = (args: ParsedArgs): UpdateNodeResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const nodeId = args.nodeId as string;
    if (!nodeId) {
      return { error: 'nodeId is required.' };
    }

    const currentNodes = getNodes() || [];
    const targetNode = currentNodes.find((node) => node.id === nodeId);

    if (!targetNode) {
      return { error: `Node not found: ${nodeId}` };
    }

    const dataUpdates =
      args.data && typeof args.data === 'object' ? (args.data as Record<string, unknown>) : {};
    const labelUpdate = typeof args.label === 'string' ? args.label : null;

    if (!Object.keys(dataUpdates).length && !labelUpdate) {
      return { error: 'No updates provided. Provide data or label to update.' };
    }

    const previousValues: Record<string, unknown> = {};
    Object.keys(dataUpdates).forEach((key) => {
      previousValues[key] = (targetNode.data as NodeData)?.[key];
    });
    if (labelUpdate) {
      previousValues.title = (targetNode.data as NodeData)?.title;
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...dataUpdates,
                ...(labelUpdate ? { title: labelUpdate } : {}),
              },
            }
          : node
      )
    );

    return {
      nodeId,
      updated: {
        ...dataUpdates,
        ...(labelUpdate ? { title: labelUpdate } : {}),
      },
      previousValues,
    };
  };

  const executeDeleteNodes = (args: ParsedArgs): DeleteNodesResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const nodeIds = Array.isArray(args.nodeIds) ? (args.nodeIds as string[]) : [];
    if (!nodeIds.length) {
      return { error: 'nodeIds array is required and must not be empty.' };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const nodeIdSet = new Set(nodeIds);

    const deletedNodes = currentNodes
      .filter((node) => nodeIdSet.has(node.id))
      .map((node) => node.id);

    const notFound = nodeIds.filter((id) => !deletedNodes.includes(id));

    const deletedEdges = currentEdges
      .filter((edge) => nodeIdSet.has(edge.source) || nodeIdSet.has(edge.target))
      .map((edge) => edge.id);

    const remainingNodes = currentNodes.filter((node) => !nodeIdSet.has(node.id));
    const remainingEdges = currentEdges.filter(
      (edge) => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target)
    );

    setNodes(remainingNodes);
    setEdges(remainingEdges);

    return {
      deletedNodes,
      deletedEdges,
      notFound: notFound.length ? notFound : undefined,
      remainingNodes: remainingNodes.length,
      remainingEdges: remainingEdges.length,
    };
  };

  const executeDeleteEdges = (args: ParsedArgs): DeleteEdgesResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    const edgeSpecs = Array.isArray(args.edges)
      ? (args.edges as Array<{
          source: string;
          target: string;
          sourceHandle?: string;
          targetHandle?: string;
        }>)
      : [];
    if (!edgeSpecs.length) {
      return { error: 'edges array is required and must not be empty.' };
    }

    const currentEdges = getEdges() || [];
    const deletedEdgeIds: string[] = [];

    const matchesSpec = (
      edge: WorkflowEdge,
      spec: { source: string; target: string; sourceHandle?: string; targetHandle?: string }
    ): boolean => {
      if (edge.source !== spec.source || edge.target !== spec.target) {
        return false;
      }
      if (spec.sourceHandle && edge.sourceHandle !== spec.sourceHandle) {
        return false;
      }
      if (spec.targetHandle && edge.targetHandle !== spec.targetHandle) {
        return false;
      }
      return true;
    };

    const remainingEdges = currentEdges.filter((edge) => {
      const shouldDelete = edgeSpecs.some((spec) => matchesSpec(edge, spec));
      if (shouldDelete) {
        deletedEdgeIds.push(edge.id);
        return false;
      }
      return true;
    });

    setEdges(remainingEdges);

    return {
      deletedEdges: deletedEdgeIds,
      remainingEdges: remainingEdges.length,
    };
  };

  const executeClearWorkflow = (args: ParsedArgs): ClearWorkflowResult => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw,
      };
    }

    if (args.confirm !== true) {
      return {
        error: 'Must set confirm: true to clear the workflow.',
      };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const deletedNodeCount = currentNodes.length;
    const deletedEdgeCount = currentEdges.length;

    localStorage.removeItem('noder-nodes');
    localStorage.removeItem('noder-edges');
    setNodes([]);
    setEdges([]);

    return {
      cleared: true,
      deletedNodes: deletedNodeCount,
      deletedEdges: deletedEdgeCount,
    };
  };

  const executeToolCall = async (toolCall: ToolCall): Promise<ToolResult> => {
    const name = toolCall?.function?.name || toolCall?.name;
    const args = parseToolArguments(toolCall?.function?.arguments || toolCall?.arguments);

    switch (name) {
      case 'workflow_create':
        return executeCreateWorkflow(args);
      case 'workflow_connect':
        return executeConnectWorkflow(args);
      case 'workflow_validate':
        return executeValidateWorkflow();
      case 'workflow_run':
        return await executeRunWorkflow();
      case 'text_node_set_prompts':
        return executeTextNodeSetPrompts(args);
      // Phase 1: Read/Query Tools
      case 'workflow_get_state':
        return executeGetState(args);
      case 'workflow_get_node':
        return executeGetNode(args);
      case 'workflow_get_outputs':
        return executeGetOutputs(args);
      // Phase 2: Mutation Tools
      case 'workflow_update_node':
        return executeUpdateNode(args);
      case 'workflow_delete_nodes':
        return executeDeleteNodes(args);
      case 'workflow_delete_edges':
        return executeDeleteEdges(args);
      case 'workflow_clear':
        return executeClearWorkflow(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  };

  return { executeToolCall };
};

export type ToolExecutor = ReturnType<typeof createToolExecutor>;
