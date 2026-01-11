import { nodeCreators, nodeTypes } from "../nodes";
import { validateEdges } from "./handleValidation";

const DEFAULT_LAYOUT = {
  origin: { x: 140, y: 160 },
  stepX: 260,
  stepY: 160
};

const safeNumber = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizePosition = (position, index) => {
  if (position && typeof position === "object") {
    const x = safeNumber(position.x, DEFAULT_LAYOUT.origin.x);
    const y = safeNumber(position.y, DEFAULT_LAYOUT.origin.y);
    return { x, y };
  }

  return {
    x: DEFAULT_LAYOUT.origin.x + index * DEFAULT_LAYOUT.stepX,
    y: DEFAULT_LAYOUT.origin.y + (index % 3) * DEFAULT_LAYOUT.stepY
  };
};

const ensureUniqueId = (preferredId, existingIds, fallbackBase) => {
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

const getHandlesForNode = (nodeType) =>
  nodeTypes?.[nodeType]?.defaultData?.handles || [];

const pickHandle = (handles, direction, dataType) => {
  const filtered = handles.filter((handle) => {
    if (direction === "input") {
      return handle.type === "input" || handle.type === "target";
    }
    return handle.type === "output" || handle.type === "source";
  });

  if (dataType) {
    const match = filtered.find((handle) => handle.dataType === dataType);
    if (match) return match.id;
  }

  return filtered[0]?.id || null;
};

const parseToolArguments = (rawArgs) => {
  if (!rawArgs) return {};
  if (typeof rawArgs === "object") return rawArgs;
  try {
    return JSON.parse(rawArgs);
  } catch (error) {
    return { __parseError: error.message, __raw: rawArgs };
  }
};

const buildEdge = ({ edgeSpec, nodesById }) => {
  const sourceNode = nodesById[edgeSpec.source];
  const targetNode = nodesById[edgeSpec.target];

  if (!sourceNode || !targetNode) {
    return {
      edge: null,
      error: `Missing source or target node: ${edgeSpec.source} -> ${edgeSpec.target}`
    };
  }

  const sourceHandles = getHandlesForNode(sourceNode.type);
  const targetHandles = getHandlesForNode(targetNode.type);
  const inferredType = (() => {
    if (edgeSpec.dataType) return edgeSpec.dataType;
    if (edgeSpec.sourceHandle) {
      const source = sourceHandles.find((handle) => handle.id === edgeSpec.sourceHandle);
      return source?.dataType || null;
    }
    return null;
  })();
  const sourceHandle =
    edgeSpec.sourceHandle ||
    pickHandle(sourceHandles, "output", inferredType);
  const targetHandle =
    edgeSpec.targetHandle ||
    pickHandle(targetHandles, "input", inferredType);

  if (!sourceHandle || !targetHandle) {
    return {
      edge: null,
      error: `Could not resolve handles for ${edgeSpec.source} -> ${edgeSpec.target}`
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
      type: "custom",
      animated: false,
      data: { isProcessing: false }
    },
    error: null
  };
};

export const createToolExecutor = ({
  getNodes,
  getEdges,
  setNodes,
  setEdges,
  handleRemoveNode,
  setValidationErrors,
  runWorkflow,
  focusCanvas,
  allowedNodeTypes
}) => {
  const allowedTypeSet = (() => {
    if (!allowedNodeTypes) return null;
    if (allowedNodeTypes instanceof Set) return allowedNodeTypes;
    if (Array.isArray(allowedNodeTypes)) return new Set(allowedNodeTypes);
    return null;
  })();

  const executeCreateWorkflow = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const nodesSpec = Array.isArray(args.nodes) ? args.nodes : [];
    const edgesSpec = Array.isArray(args.edges) ? args.edges : [];
    const shouldReplace = Boolean(args.replace);
    const skippedNodes = [];
    const filteredNodesSpec = nodesSpec.filter((spec) => {
      if (!allowedTypeSet || allowedTypeSet.has(spec.type)) return true;
      skippedNodes.push({
        node: spec,
        reason: `Node type "${spec.type}" is not allowed for assistant workflows.`
      });
      return false;
    });

    const existingIds = new Set(
      shouldReplace ? [] : currentNodes.map((node) => node.id)
    );
    const maxOrder = shouldReplace
      ? 0
      : currentNodes.reduce(
          (max, node) => Math.max(max, node.data?.executionOrder || 0),
          0
        );

    const createdNodes = [];
    const nodeIdMap = {};

    filteredNodesSpec.forEach((spec, index) => {
      const fallbackId = `${spec.type || "node"}-${Date.now()}-${index}`;
      const nodeId = ensureUniqueId(spec.id, existingIds, fallbackId);
      nodeIdMap[spec.id || nodeId] = nodeId;

      const createFn = nodeCreators[spec.type];
      const position = normalizePosition(spec.position, index);

      let newNode = createFn
        ? createFn({
            id: nodeId,
            handleRemoveNode,
            position
          })
        : {
            id: nodeId,
            type: spec.type,
            position,
            data: {
              title: spec.label || spec.type,
              onRemove: handleRemoveNode,
              handles: getHandlesForNode(spec.type)
            }
          };

      newNode = {
        ...newNode,
        data: {
          ...newNode.data,
          ...spec.data,
          ...(spec.label ? { title: spec.label } : {}),
          executionOrder: maxOrder + createdNodes.length + 1
        }
      };

      createdNodes.push(newNode);
    });

    const nextNodes = shouldReplace ? createdNodes : [...currentNodes, ...createdNodes];
    const nodesById = nextNodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});

    const newEdges = [];
    const skippedEdges = [];

    edgesSpec.forEach((edgeSpec) => {
      const resolvedSpec = {
        ...edgeSpec,
        source: nodeIdMap[edgeSpec.source] || edgeSpec.source,
        target: nodeIdMap[edgeSpec.target] || edgeSpec.target
      };
      const { edge, error } = buildEdge({ edgeSpec: resolvedSpec, nodesById });
      if (edge) {
        newEdges.push(edge);
      } else if (error) {
        skippedEdges.push({ edge: edgeSpec, reason: error });
      }
    });

    const { validEdges, validationErrors } = validateEdges(newEdges, nextNodes);
    if (validationErrors.length) {
      setValidationErrors((prev) => [...prev, ...validationErrors]);
    }

    const nextEdges = shouldReplace
      ? validEdges
      : [...currentEdges, ...validEdges];

    if (shouldReplace) {
      localStorage.removeItem("noder-nodes");
      localStorage.removeItem("noder-edges");
    }

    setNodes(nextNodes);
    setEdges(nextEdges);
    if (typeof focusCanvas === "function" && nextNodes.length) {
      setTimeout(() => focusCanvas(), 50);
    }

    return {
      replaced: shouldReplace,
      idMap: nodeIdMap,
      createdNodes: createdNodes.map((node) => ({
        id: node.id,
        type: node.type
      })),
      skippedNodes,
      createdEdges: validEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
      })),
      skippedEdges,
      validationErrors
    };
  };

  const executeConnectWorkflow = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const connections = Array.isArray(args.connections) ? args.connections : [];
    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const nodesById = currentNodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});

    const newEdges = [];
    const skippedEdges = [];

    connections.forEach((edgeSpec) => {
      const { edge, error } = buildEdge({ edgeSpec, nodesById });
      if (edge) {
        newEdges.push(edge);
      } else if (error) {
        skippedEdges.push({ edge: edgeSpec, reason: error });
      }
    });

    const { validEdges, validationErrors } = validateEdges(newEdges, currentNodes);
    if (validationErrors.length) {
      setValidationErrors((prev) => [...prev, ...validationErrors]);
    }

    setEdges([...currentEdges, ...validEdges]);

    return {
      createdEdges: validEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
      })),
      skippedEdges,
      validationErrors
    };
  };

  const executeValidateWorkflow = () => {
    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const { validEdges, validationErrors } = validateEdges(currentEdges, currentNodes);

    if (validationErrors.length) {
      setValidationErrors((prev) => [...prev, ...validationErrors]);
    }

    return {
      totalEdges: currentEdges.length,
      validEdges: validEdges.length,
      invalidEdges: validationErrors.length,
      validationErrors
    };
  };

  const executeRunWorkflow = async () => {
    try {
      const result = await runWorkflow();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  };

  const executeTextNodeSetPrompts = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const currentNodes = getNodes() || [];
    const nodeId = typeof args.nodeId === "string" ? args.nodeId : "";
    const textNodes = currentNodes.filter((node) => node.type === "text");

    const targetNode =
      nodeId
        ? currentNodes.find((node) => node.id === nodeId)
        : textNodes.length === 1
          ? textNodes[0]
          : null;

    if (!targetNode) {
      if (!nodeId) {
        return {
          error:
            "No nodeId provided and unable to resolve a single Text node to update."
        };
      }
      return { error: `Text node not found: ${nodeId}` };
    }

    if (targetNode.type !== "text") {
      return {
        error: `Node ${targetNode.id} is not a Text (text) node.`
      };
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(args, "prompt")) {
      updates.prompt = args.prompt ?? "";
    }
    if (Object.prototype.hasOwnProperty.call(args, "systemPrompt")) {
      updates.systemPrompt = args.systemPrompt ?? "";
    }

    if (!Object.keys(updates).length) {
      return { error: "No prompt fields provided to update." };
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === targetNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates
              }
            }
          : node
      )
    );

    return {
      nodeId: targetNode.id,
      updated: updates
    };
  };

  // Phase 1: Read/Query Tools

  const executeGetState = (args) => {
    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const includeData = Boolean(args.include_data);

    const nodes = currentNodes.map((node) => {
      const base = {
        id: node.id,
        type: node.type,
        label: node.data?.title || node.type,
        position: node.position
      };
      if (includeData) {
        base.data = node.data || {};
      }
      return base;
    });

    const edges = currentEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }));

    return {
      nodeCount: currentNodes.length,
      edgeCount: currentEdges.length,
      nodes,
      edges
    };
  };

  const executeGetNode = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const nodeId = args.nodeId;
    if (!nodeId) {
      return { error: "nodeId is required." };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const targetNode = currentNodes.find((node) => node.id === nodeId);

    if (!targetNode) {
      return { error: `Node not found: ${nodeId}` };
    }

    const handles = targetNode.data?.handles || getHandlesForNode(targetNode.type);
    const inputs = handles
      .filter((h) => h.type === "input" || h.type === "target")
      .map((h) => `${h.id}:${h.dataType || "any"}`);
    const outputs = handles
      .filter((h) => h.type === "output" || h.type === "source")
      .map((h) => `${h.id}:${h.dataType || "any"}`);

    const incoming = currentEdges
      .filter((e) => e.target === nodeId)
      .map((e) => ({ from: e.source, handle: e.sourceHandle }));
    const outgoing = currentEdges
      .filter((e) => e.source === nodeId)
      .map((e) => ({ to: e.target, handle: e.targetHandle }));

    return {
      id: targetNode.id,
      type: targetNode.type,
      label: targetNode.data?.title || targetNode.type,
      position: targetNode.position,
      data: targetNode.data || {},
      handles: { inputs, outputs },
      connections: { incoming, outgoing }
    };
  };

  const executeGetOutputs = (args) => {
    const currentNodes = getNodes() || [];
    const requestedIds = Array.isArray(args.nodeIds) ? args.nodeIds : [];

    const nodesToCheck = requestedIds.length
      ? currentNodes.filter((node) => requestedIds.includes(node.id))
      : currentNodes;

    const outputs = nodesToCheck.map((node) => {
      const output = node.data?.output;
      const hasOutput = output !== undefined && output !== null && output !== "";

      let outputType = "unknown";
      if (typeof output === "string") {
        if (output.startsWith("http") && (output.includes(".png") || output.includes(".jpg") || output.includes(".webp") || output.includes("image"))) {
          outputType = "image_url";
        } else {
          outputType = "text";
        }
      } else if (typeof output === "object") {
        outputType = "object";
      }

      return {
        nodeId: node.id,
        type: node.type,
        hasOutput,
        output: hasOutput ? output : null,
        outputType: hasOutput ? outputType : null
      };
    });

    return { outputs };
  };

  // Phase 2: Mutation Tools

  const executeUpdateNode = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const nodeId = args.nodeId;
    if (!nodeId) {
      return { error: "nodeId is required." };
    }

    const currentNodes = getNodes() || [];
    const targetNode = currentNodes.find((node) => node.id === nodeId);

    if (!targetNode) {
      return { error: `Node not found: ${nodeId}` };
    }

    const dataUpdates = args.data && typeof args.data === "object" ? args.data : {};
    const labelUpdate = typeof args.label === "string" ? args.label : null;

    if (!Object.keys(dataUpdates).length && !labelUpdate) {
      return { error: "No updates provided. Provide data or label to update." };
    }

    const previousValues = {};
    Object.keys(dataUpdates).forEach((key) => {
      previousValues[key] = targetNode.data?.[key];
    });
    if (labelUpdate) {
      previousValues.title = targetNode.data?.title;
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...dataUpdates,
                ...(labelUpdate ? { title: labelUpdate } : {})
              }
            }
          : node
      )
    );

    return {
      nodeId,
      updated: {
        ...dataUpdates,
        ...(labelUpdate ? { title: labelUpdate } : {})
      },
      previousValues
    };
  };

  const executeDeleteNodes = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const nodeIds = Array.isArray(args.nodeIds) ? args.nodeIds : [];
    if (!nodeIds.length) {
      return { error: "nodeIds array is required and must not be empty." };
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
      remainingEdges: remainingEdges.length
    };
  };

  const executeDeleteEdges = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    const edgeSpecs = Array.isArray(args.edges) ? args.edges : [];
    if (!edgeSpecs.length) {
      return { error: "edges array is required and must not be empty." };
    }

    const currentEdges = getEdges() || [];
    const deletedEdgeIds = [];

    const matchesSpec = (edge, spec) => {
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
      remainingEdges: remainingEdges.length
    };
  };

  const executeClearWorkflow = (args) => {
    if (args.__parseError) {
      return {
        error: `Invalid tool arguments: ${args.__parseError}`,
        raw: args.__raw
      };
    }

    if (args.confirm !== true) {
      return {
        error: "Must set confirm: true to clear the workflow."
      };
    }

    const currentNodes = getNodes() || [];
    const currentEdges = getEdges() || [];
    const deletedNodeCount = currentNodes.length;
    const deletedEdgeCount = currentEdges.length;

    localStorage.removeItem("noder-nodes");
    localStorage.removeItem("noder-edges");
    setNodes([]);
    setEdges([]);

    return {
      cleared: true,
      deletedNodes: deletedNodeCount,
      deletedEdges: deletedEdgeCount
    };
  };

  const executeToolCall = async (toolCall) => {
    const name = toolCall?.function?.name || toolCall?.name;
    const args = parseToolArguments(toolCall?.function?.arguments || toolCall?.arguments);

    switch (name) {
      case "workflow_create":
        return executeCreateWorkflow(args);
      case "workflow_connect":
        return executeConnectWorkflow(args);
      case "workflow_validate":
        return executeValidateWorkflow(args);
      case "workflow_run":
        return await executeRunWorkflow();
      case "text_node_set_prompts":
        return executeTextNodeSetPrompts(args);
      // Phase 1: Read/Query Tools
      case "workflow_get_state":
        return executeGetState(args);
      case "workflow_get_node":
        return executeGetNode(args);
      case "workflow_get_outputs":
        return executeGetOutputs(args);
      // Phase 2: Mutation Tools
      case "workflow_update_node":
        return executeUpdateNode(args);
      case "workflow_delete_nodes":
        return executeDeleteNodes(args);
      case "workflow_delete_edges":
        return executeDeleteEdges(args);
      case "workflow_clear":
        return executeClearWorkflow(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  };

  return { executeToolCall };
};
