/**
 * DAG-based Workflow Runner
 *
 * Executes workflow nodes in topological order based on edges,
 * supporting parallel execution and proper error handling.
 */

import type { Node, Edge } from 'reactflow';

// =============================================================================
// Types
// =============================================================================

/** Dependent node information from the graph */
export interface GraphDependent {
  targetId: string;
  sourceHandle: string | null | undefined;
  targetHandle: string | null | undefined;
}

/** Graph structure built from edges */
export interface DependencyGraph {
  /** Map of node ID to list of dependent nodes */
  graph: Record<string, GraphDependent[]>;
  /** Map of node ID to count of incoming edges */
  inDegree: Record<string, number>;
  /** Map of node ID to list of node IDs it depends on */
  dependencies: Record<string, string[]>;
}

/** Input data with source metadata */
export interface InputDataWithMeta {
  value?: unknown;
  sourceNode: string;
  sourceHandle: string | null | undefined;
  [key: string]: unknown;
}

/** Node inputs - single connection returns object, multiple returns array */
export type NodeInputs = Record<string, InputDataWithMeta | InputDataWithMeta[]>;

/** Node outputs stored by handle name */
export type NodeOutputs = Record<string, Record<string, unknown>>;

/** Execution context passed to nodes */
export interface ExecutionContext {
  apiKeys?: {
    replicate?: string;
    openrouter?: string;
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  [key: string]: unknown;
}

/** Progress callback data */
export interface ProgressData {
  completed: number;
  total: number;
  percentage: number;
}

/** Result of a single node execution */
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

/** Result of workflow execution */
export interface WorkflowExecutionResult {
  success: boolean;
  workflowId: string;
  duration: number;
  nodeOutputs: NodeOutputs;
  nodeErrors?: Record<string, Error>;
  error?: string;
  completedCount: number;
}

/** Options for running a workflow */
export interface RunWorkflowOptions {
  nodes: Node[];
  edges: Edge[];
  context?: ExecutionContext;
  onNodeStart?: (node: Node) => void;
  onNodeComplete?: (node: Node, output: Record<string, unknown>) => void;
  onNodeError?: (node: Node, error: Error) => void;
  onProgress?: (progress: ProgressData) => void;
}

/** Options for running a single node */
export interface RunSingleNodeOptions {
  nodeId: string;
  nodes: Node[];
  edges: Edge[];
  context?: ExecutionContext;
  onNodeStart?: (node: Node) => void;
  onNodeComplete?: (node: Node, output: Record<string, unknown>) => void;
  onNodeError?: (node: Node, error: Error) => void;
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Build a dependency graph from edges
 * @param nodes - Array of workflow nodes
 * @param edges - Array of workflow edges
 * @returns Dependency graph structure
 */
export function buildDependencyGraph(nodes: Node[], edges: Edge[]): DependencyGraph {
  const graph: Record<string, GraphDependent[]> = {};
  const inDegree: Record<string, number> = {};
  const dependencies: Record<string, string[]> = {};

  // Initialize all nodes
  nodes.forEach((node) => {
    graph[node.id] = [];
    inDegree[node.id] = 0;
    dependencies[node.id] = [];
  });

  // Build graph from edges
  edges.forEach((edge) => {
    // Source node produces output that target node consumes
    if (!graph[edge.source]) {
      graph[edge.source] = [];
    }
    graph[edge.source]?.push({
      targetId: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    });

    inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1;

    if (!dependencies[edge.target]) {
      dependencies[edge.target] = [];
    }
    if (!dependencies[edge.target]?.includes(edge.source)) {
      dependencies[edge.target]?.push(edge.source);
    }
  });

  return { graph, inDegree, dependencies };
}

/**
 * Topologically sort nodes for execution
 * @param nodes - Array of workflow nodes
 * @param graph - Dependency graph
 * @param inDegree - In-degree map
 * @returns Array of execution layers (each layer can execute in parallel)
 */
export function topologicalSort(
  nodes: Node[],
  graph: Record<string, GraphDependent[]>,
  inDegree: Record<string, number>
): Node[][] {
  const layers: Node[][] = [];
  const visited = new Set<string>();
  const remaining = new Map<string, number>(Object.entries(inDegree));

  while (visited.size < nodes.length) {
    // Find all nodes with no remaining dependencies
    const currentLayer = nodes.filter(
      (node) => !visited.has(node.id) && (remaining.get(node.id) || 0) === 0
    );

    if (currentLayer.length === 0) {
      // Cyclic dependency detected
      const unvisited = nodes.filter((n) => !visited.has(n.id));
      throw new Error(
        `Cyclic dependency detected. Cannot execute nodes: ${unvisited.map((n) => n.id).join(', ')}`
      );
    }

    layers.push(currentLayer);

    // Mark as visited and update in-degrees
    currentLayer.forEach((node) => {
      visited.add(node.id);
      const dependents = graph[node.id] || [];
      dependents.forEach((dep) => {
        const current = remaining.get(dep.targetId) || 0;
        remaining.set(dep.targetId, Math.max(0, current - 1));
      });
    });
  }

  return layers;
}

/**
 * Get input data for a node from its dependencies
 * Supports multiple connections to the same handle (collected as arrays)
 * @param node - Target node
 * @param edges - Workflow edges
 * @param nodes - All nodes
 * @param nodeOutputs - Map of node outputs
 * @returns Map of handle -> data (or array of data for multiple connections)
 */
export function getNodeInputs(
  node: Node,
  edges: Edge[],
  nodes: Node[],
  nodeOutputs: NodeOutputs
): NodeInputs {
  const inputs: NodeInputs = {};
  const inputsByHandle: Record<string, InputDataWithMeta[]> = {};

  const incomingEdges = edges.filter((e) => e.target === node.id);

  incomingEdges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return;

    const sourceOutput = nodeOutputs[edge.source];
    if (!sourceOutput) return;

    // Get the output from the specific handle
    const handleKey = edge.sourceHandle || 'default';
    const outputData = (sourceOutput[handleKey] || sourceOutput.default) as
      | Record<string, unknown>
      | undefined;

    if (!outputData) return;

    const dataWithMeta: InputDataWithMeta = {
      ...outputData,
      sourceNode: edge.source,
      sourceHandle: edge.sourceHandle,
    };

    // Track connections per handle for array support
    const targetHandle = edge.targetHandle || 'default';
    if (!inputsByHandle[targetHandle]) {
      inputsByHandle[targetHandle] = [];
    }
    inputsByHandle[targetHandle].push(dataWithMeta);
  });

  // Convert to final format: single connection = object, multiple = array
  Object.entries(inputsByHandle).forEach(([handle, connections]) => {
    if (connections.length === 1 && connections[0]) {
      inputs[handle] = connections[0];
    } else if (connections.length > 1) {
      // Multiple connections - keep as array
      inputs[handle] = connections;
    }
  });

  return inputs;
}

/**
 * Execute a single node
 * @param node - Node to execute
 * @param inputs - Input data for the node
 * @param _context - Execution context (API keys, etc.)
 * @returns Node output
 */
export async function executeNode(
  node: Node,
  inputs: NodeInputs,
  _context: ExecutionContext
): Promise<Record<string, unknown>> {
  const { type } = node;

  switch (type) {
    case 'display-text':
    case 'markdown': {
      // Output nodes just receive and display data
      const textInput = inputs['text-in'];
      const value = Array.isArray(textInput)
        ? textInput.map((i) => i.value).join('')
        : (textInput as InputDataWithMeta | undefined)?.value || '';
      return {
        input: value,
      };
    }

    default:
      // For custom or unknown nodes, just pass through
      return { passthrough: true };
  }
}

/**
 * Run workflow using DAG-based execution
 * @param params - Execution parameters
 * @returns Execution results
 */
export async function runWorkflowDAG({
  nodes,
  edges,
  context = {},
  onNodeStart = () => {},
  onNodeComplete = () => {},
  onNodeError = () => {},
  onProgress = () => {},
}: RunWorkflowOptions): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const workflowId = `workflow-${startTime}`;
  const nodeOutputs: NodeOutputs = {};
  const nodeErrors: Record<string, Error> = {};
  let completedCount = 0;

  try {
    // Build dependency graph
    const { graph, inDegree } = buildDependencyGraph(nodes, edges);

    // Get execution layers via topological sort
    const layers = topologicalSort(nodes, graph, inDegree);

    console.log(`[WorkflowRunner] Executing ${nodes.length} nodes in ${layers.length} layers`);

    // Execute each layer
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex] ?? [];
      console.log(`[WorkflowRunner] Layer ${layerIndex + 1}: ${layer.length} nodes`);

      // Execute all nodes in this layer in parallel
      const layerPromises = layer.map(async (node): Promise<NodeExecutionResult> => {
        try {
          onNodeStart(node);

          // Get inputs for this node
          const inputs = getNodeInputs(node, edges, nodes, nodeOutputs);

          // Execute the node
          const output = await executeNode(node, inputs, context);

          // Store output
          nodeOutputs[node.id] = output;

          completedCount++;
          onProgress({
            completed: completedCount,
            total: nodes.length,
            percentage: Math.round((completedCount / nodes.length) * 100),
          });

          onNodeComplete(node, output);

          return { nodeId: node.id, success: true, output };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[WorkflowRunner] Error executing node ${node.id}:`, err);
          nodeErrors[node.id] = err;
          onNodeError(node, err);

          // Halt execution on error
          throw new Error(`Node ${node.id} failed: ${err.message}`);
        }
      });

      // Wait for all nodes in this layer to complete
      await Promise.all(layerPromises);
    }

    const duration = Date.now() - startTime;
    console.log(`[WorkflowRunner] Workflow completed in ${duration}ms`);

    return {
      success: true,
      workflowId,
      duration,
      nodeOutputs,
      completedCount,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[WorkflowRunner] Workflow failed:`, err);

    return {
      success: false,
      workflowId,
      duration,
      error: err.message,
      nodeOutputs,
      nodeErrors,
      completedCount,
    };
  }
}

/**
 * Execute a single node and its downstream dependencies
 * @param params - Execution parameters
 * @returns Execution results
 */
export async function runSingleNode({
  nodeId,
  nodes,
  edges,
  context = {},
  onNodeStart = () => {},
  onNodeComplete = () => {},
  onNodeError = () => {},
}: RunSingleNodeOptions): Promise<WorkflowExecutionResult> {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    throw new Error(`Node ${nodeId} not found`);
  }

  // Build dependency graph
  const { dependencies } = buildDependencyGraph(nodes, edges);

  // Get all upstream dependencies
  const upstream = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift() ?? '';
    const deps = dependencies[current] || [];
    deps.forEach((dep) => {
      if (!upstream.has(dep)) {
        upstream.add(dep);
        queue.push(dep);
      }
    });
  }

  // Create subgraph with target node and its dependencies
  const subgraphNodes = nodes.filter((n) => upstream.has(n.id) || n.id === nodeId);

  // Run the subgraph
  return runWorkflowDAG({
    nodes: subgraphNodes,
    edges: edges.filter(
      (e) =>
        subgraphNodes.find((n) => n.id === e.source) && subgraphNodes.find((n) => n.id === e.target)
    ),
    context,
    onNodeStart,
    onNodeComplete,
    onNodeError,
  });
}
