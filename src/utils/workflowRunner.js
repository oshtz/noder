/**
 * DAG-based Workflow Runner
 *
 * Executes workflow nodes in topological order based on edges,
 * supporting parallel execution and proper error handling.
 */

/**
 * Build a dependency graph from edges
 * @param {Array} nodes - Array of workflow nodes
 * @param {Array} edges - Array of workflow edges
 * @returns {Object} { graph, inDegree, dependencies }
 */
export function buildDependencyGraph(nodes, edges) {
  const graph = {}; // node -> list of dependent nodes
  const inDegree = {}; // node -> count of incoming edges
  const dependencies = {}; // node -> list of nodes it depends on

  // Initialize all nodes
  nodes.forEach(node => {
    graph[node.id] = [];
    inDegree[node.id] = 0;
    dependencies[node.id] = [];
  });

  // Build graph from edges
  edges.forEach(edge => {
    // Source node produces output that target node consumes
    graph[edge.source] = graph[edge.source] || [];
    graph[edge.source].push({
      targetId: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    });

    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;

    dependencies[edge.target] = dependencies[edge.target] || [];
    if (!dependencies[edge.target].includes(edge.source)) {
      dependencies[edge.target].push(edge.source);
    }
  });

  return { graph, inDegree, dependencies };
}

/**
 * Topologically sort nodes for execution
 * @param {Array} nodes - Array of workflow nodes
 * @param {Object} graph - Dependency graph
 * @param {Object} inDegree - In-degree map
 * @returns {Array} Array of execution layers (each layer can execute in parallel)
 */
export function topologicalSort(nodes, graph, inDegree) {
  const layers = [];
  const visited = new Set();
  const remaining = new Map(Object.entries(inDegree));

  while (visited.size < nodes.length) {
    // Find all nodes with no remaining dependencies
    const currentLayer = nodes.filter(node =>
      !visited.has(node.id) && (remaining.get(node.id) || 0) === 0
    );

    if (currentLayer.length === 0) {
      // Cyclic dependency detected
      const unvisited = nodes.filter(n => !visited.has(n.id));
      throw new Error(
        `Cyclic dependency detected. Cannot execute nodes: ${unvisited.map(n => n.id).join(', ')}`
      );
    }

    layers.push(currentLayer);

    // Mark as visited and update in-degrees
    currentLayer.forEach(node => {
      visited.add(node.id);
      const dependents = graph[node.id] || [];
      dependents.forEach(dep => {
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
 * @param {Object} node - Target node
 * @param {Array} edges - Workflow edges
 * @param {Array} nodes - All nodes
 * @param {Object} nodeOutputs - Map of node outputs
 * @returns {Object} Map of handle -> data (or array of data for multiple connections)
 */
export function getNodeInputs(node, edges, nodes, nodeOutputs) {
  const inputs = {};
  const inputsByHandle = {}; // Track multiple connections per handle

  const incomingEdges = edges.filter(e => e.target === node.id);

  incomingEdges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return;

    const sourceOutput = nodeOutputs[edge.source];
    if (!sourceOutput) return;

    // Get the output from the specific handle
    const outputData = sourceOutput[edge.sourceHandle] || sourceOutput.default;
    
    if (!outputData) return;

    const dataWithMeta = {
      ...outputData,
      sourceNode: edge.source,
      sourceHandle: edge.sourceHandle
    };

    // Track connections per handle for array support
    if (!inputsByHandle[edge.targetHandle]) {
      inputsByHandle[edge.targetHandle] = [];
    }
    inputsByHandle[edge.targetHandle].push(dataWithMeta);
  });

  // Convert to final format: single connection = object, multiple = array
  Object.entries(inputsByHandle).forEach(([handle, connections]) => {
    if (connections.length === 1) {
      inputs[handle] = connections[0];
    } else {
      // Multiple connections - keep as array
      inputs[handle] = connections;
    }
  });

  return inputs;
}

/**
 * Execute a single node
 * @param {Object} node - Node to execute
 * @param {Object} inputs - Input data for the node
 * @param {Object} context - Execution context (API keys, etc.)
 * @returns {Promise<Object>} Node output
 */
export async function executeNode(node, inputs, context) {
  const { type, data } = node;

  switch (type) {
    case 'display-text':
    case 'markdown':
      // Output nodes just receive and display data
      return {
        input: inputs['text-in']?.value || ''
      };

    default:
      // For custom or unknown nodes, just pass through
      return { passthrough: true };
  }
}

/**
 * Run workflow using DAG-based execution
 * @param {Object} params - Execution parameters
 * @returns {Promise<Object>} Execution results
 */
export async function runWorkflowDAG({
  nodes,
  edges,
  context = {},
  onNodeStart = () => {},
  onNodeComplete = () => {},
  onNodeError = () => {},
  onProgress = () => {}
}) {
  const startTime = Date.now();
  const workflowId = `workflow-${startTime}`;
  const nodeOutputs = {};
  const nodeErrors = {};
  let completedCount = 0;

  try {
    // Build dependency graph
    const { graph, inDegree, dependencies } = buildDependencyGraph(nodes, edges);

    // Get execution layers via topological sort
    const layers = topologicalSort(nodes, graph, inDegree);

    console.log(`[WorkflowRunner] Executing ${nodes.length} nodes in ${layers.length} layers`);

    // Execute each layer
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      console.log(`[WorkflowRunner] Layer ${layerIndex + 1}: ${layer.length} nodes`);

      // Execute all nodes in this layer in parallel
      const layerPromises = layer.map(async (node) => {
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
            percentage: Math.round((completedCount / nodes.length) * 100)
          });

          onNodeComplete(node, output);

          return { nodeId: node.id, success: true, output };
        } catch (error) {
          console.error(`[WorkflowRunner] Error executing node ${node.id}:`, error);
          nodeErrors[node.id] = error;
          onNodeError(node, error);

          // Halt execution on error
          throw new Error(`Node ${node.id} failed: ${error.message}`);
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
      completedCount
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[WorkflowRunner] Workflow failed:`, error);

    return {
      success: false,
      workflowId,
      duration,
      error: error.message,
      nodeOutputs,
      nodeErrors,
      completedCount
    };
  }
}

/**
 * Execute a single node and its downstream dependencies
 * @param {Object} params - Execution parameters
 * @returns {Promise<Object>} Execution results
 */
export async function runSingleNode({
  nodeId,
  nodes,
  edges,
  context = {},
  onNodeStart = () => {},
  onNodeComplete = () => {},
  onNodeError = () => {}
}) {
  const targetNode = nodes.find(n => n.id === nodeId);
  if (!targetNode) {
    throw new Error(`Node ${nodeId} not found`);
  }

  // Build dependency graph
  const { graph, dependencies } = buildDependencyGraph(nodes, edges);

  // Get all upstream dependencies
  const upstream = new Set();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    const deps = dependencies[current] || [];
    deps.forEach(dep => {
      if (!upstream.has(dep)) {
        upstream.add(dep);
        queue.push(dep);
      }
    });
  }

  // Create subgraph with target node and its dependencies
  const subgraphNodes = nodes.filter(n =>
    upstream.has(n.id) || n.id === nodeId
  );

  // Run the subgraph
  return runWorkflowDAG({
    nodes: subgraphNodes,
    edges: edges.filter(e =>
      subgraphNodes.find(n => n.id === e.source) &&
      subgraphNodes.find(n => n.id === e.target)
    ),
    context,
    onNodeStart,
    onNodeComplete,
    onNodeError
  });
}
