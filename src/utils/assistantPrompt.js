const summarizeHandles = (handles = []) => {
  const inputs = handles.filter((handle) =>
    handle.type === "input" || handle.type === "target"
  );
  const outputs = handles.filter((handle) =>
    handle.type === "output" || handle.type === "source"
  );

  const formatList = (list) =>
    list.length
      ? list
          .map((handle) => {
            const dataType = handle.dataType || "any";
            return `${handle.id}:${dataType}`;
          })
          .join(", ")
      : "none";

  return {
    inputs: formatList(inputs),
    outputs: formatList(outputs)
  };
};

const formatField = (field) => {
  const parts = [];
  if (field.type) {
    parts.push(field.type);
  }
  if (field.type === "select" && Array.isArray(field.options) && field.options.length) {
    parts.push(`options: ${field.options.join("|")}`);
  }
  if (field.type === "number" || field.type === "slider") {
    if (typeof field.min === "number") parts.push(`min: ${field.min}`);
    if (typeof field.max === "number") parts.push(`max: ${field.max}`);
    if (typeof field.step === "number") parts.push(`step: ${field.step}`);
  }
  if (field.default !== undefined) {
    parts.push(`default: ${JSON.stringify(field.default)}`);
  }
  const meta = parts.length ? ` (${parts.join(", ")})` : "";
  return `${field.key}${meta}`;
};

const summarizeNodeFields = (nodeDefinitions = [], nodeSchemas = {}) => {
  const lines = [];
  nodeDefinitions.forEach((node) => {
    const schema = nodeSchemas?.[node.type];
    const fields = schema?.fields || [];
    if (!fields.length) return;
    const fieldList = fields.map((field) => formatField(field)).join(", ");
    lines.push(`- ${node.type}: ${fieldList}`);
  });
  return lines.join("\n");
};

const truncateText = (value, maxLen = 120) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
};

const formatTemplateNode = (node = {}) => {
  if (!node || typeof node !== "object") return "unknown";
  const id = node.id || "node";
  const type = node.type || "unknown";
  const data = node.data && typeof node.data === "object" ? node.data : {};
  const previewParts = [];
  const sanitizePreview = (value, maxLen) =>
    truncateText(value, maxLen).replace(/"/g, '\\"');

  if (typeof data.prompt === "string" && data.prompt.trim()) {
    previewParts.push(`prompt="${sanitizePreview(data.prompt, 80)}"`);
  }
  if (typeof data.systemPrompt === "string" && data.systemPrompt.trim()) {
    previewParts.push(`systemPrompt="${sanitizePreview(data.systemPrompt, 80)}"`);
  }
  if (typeof data.model === "string" && data.model.trim()) {
    previewParts.push(`model="${sanitizePreview(data.model, 60)}"`);
  }

  const dataKeys = Object.keys(data).filter(
    (key) => !["prompt", "systemPrompt", "model"].includes(key)
  );
  const keysPart = dataKeys.length ? ` keys:[${dataKeys.join(", ")}]` : "";
  const previewPart = previewParts.length ? ` ${previewParts.join(" ")}` : "";
  return `${id}:${type}${keysPart}${previewPart}`;
};

const formatTemplateEdge = (edge = {}) => {
  if (!edge || typeof edge !== "object") return "unknown";
  const source = edge.source || "?";
  const target = edge.target || "?";
  const sourceHandle = edge.sourceHandle ? `:${edge.sourceHandle}` : "";
  const targetHandle = edge.targetHandle ? `:${edge.targetHandle}` : "";
  return `${source}${sourceHandle} -> ${target}${targetHandle}`;
};

const summarizeTemplates = (templates = []) => {
  const safeTemplates = Array.isArray(templates) ? templates : [];
  if (!safeTemplates.length) return "";
  return safeTemplates
    .map((template, index) => {
      if (!template || typeof template !== "object") {
        return `- template-${index + 1}: (invalid template entry)`;
      }
      const id = template.id || `template-${index + 1}`;
      const name = template.name || id;
      const category = template.category ? ` [${template.category}]` : "";
      const description = template.description ? ` - ${template.description}` : "";
      const nodes = Array.isArray(template.nodes) ? template.nodes : [];
      const edges = Array.isArray(template.edges) ? template.edges : [];
      const nodeSummary = nodes.length
        ? `nodes: ${nodes.map((node) => formatTemplateNode(node)).join("; ")}`
        : "nodes: none";
      const edgeSummary = edges.length
        ? `edges: ${edges.map((edge) => formatTemplateEdge(edge)).join("; ")}`
        : "edges: none";
      return `- ${id} | ${name}${category}${description}\n  ${nodeSummary}\n  ${edgeSummary}`;
    })
    .join("\n");
};

export const buildAssistantSystemPrompt = ({
  nodeDefinitions,
  nodeTypes,
  nodeSchemas,
  workflowTemplates
}) => {
  const nodeLines = (nodeDefinitions || [])
    .map((node) => `- ${node.type}: ${node.label} (${node.description})`)
    .join("\n");

  const handleLines = (nodeDefinitions || [])
    .map((node) => {
      const handles = nodeTypes?.[node.type]?.defaultData?.handles || [];
      const summary = summarizeHandles(handles);
      return `- ${node.type}: inputs ${summary.inputs}; outputs ${summary.outputs}`;
    })
    .join("\n");

  const fieldLines = summarizeNodeFields(nodeDefinitions || [], nodeSchemas || {});
  const templateLines = summarizeTemplates(workflowTemplates || []);

  return [
    "# Identity & Purpose",
    "You are Noder's in-app AI assistant - an intelligent agent that can inspect, reason about, and iteratively build complex workflows.",
    "Use tool calls to create, inspect, modify, and connect workflow nodes.",
    "Conversation history and tool results are included in the messages.",
    "Only claim changes after tool calls succeed.",
    "Ask for clarification if the request is ambiguous.",
    "",
    "# Decision Framework",
    "",
    "BEFORE making any changes:",
    "1. Use `workflow_get_state` to understand what exists",
    "2. Identify what needs to be added, modified, or removed",
    "3. Plan the sequence of operations",
    "",
    "WHEN the user asks to \"create\" or \"build\":",
    "- If workflow is empty or user says \"new\": use `workflow_create` with replace=true",
    "- If adding to existing: use `workflow_create` with replace=false",
    "- Always check state first to avoid duplicates",
    "",
    "WHEN the user asks to \"modify\" or \"change\":",
    "- Use `workflow_get_node` to see current values",
    "- Use `workflow_update_node` to make changes",
    "- Confirm changes by describing what was updated",
    "",
    "WHEN the user asks to \"connect\" or \"link\":",
    "- Use `workflow_get_state` to verify nodes exist",
    "- Use `workflow_connect` to add edges",
    "- Use `workflow_validate` to check for issues",
    "",
    "WHEN the user asks to \"run\" or \"execute\":",
    "- Use `workflow_validate` first to catch issues",
    "- Use `workflow_run` to execute",
    "- Use `workflow_get_outputs` to report results",
    "",
    "WHEN the user asks to \"delete\" or \"remove\":",
    "- Use `workflow_get_state` to confirm targets exist",
    "- Use `workflow_delete_nodes` or `workflow_delete_edges`",
    "- Report what was removed",
    "",
    "WHEN the user asks \"what's in the workflow\" or \"show me\":",
    "- Use `workflow_get_state` with include_data=true",
    "- Summarize the nodes, their connections, and key settings",
    "",
    "# Reasoning Protocol",
    "",
    "For complex requests, follow this pattern:",
    "",
    "1. UNDERSTAND: Parse the user's intent",
    "   - What is the desired outcome?",
    "   - What nodes/connections are needed?",
    "   - Are there ambiguities to clarify?",
    "",
    "2. INSPECT: Check current state",
    "   - Call `workflow_get_state`",
    "   - Identify what already exists",
    "   - Determine what's missing",
    "",
    "3. PLAN: Decide on actions",
    "   - List the tools to call and in what order",
    "   - Consider dependencies (create before connect)",
    "   - Anticipate potential issues",
    "",
    "4. EXECUTE: Make changes",
    "   - Call tools in the planned sequence",
    "   - Handle errors gracefully",
    "   - Adjust plan if needed",
    "",
    "5. VERIFY: Confirm success",
    "   - Call `workflow_validate` if connections were made",
    "   - Summarize what was done",
    "   - Ask if user wants to run the workflow",
    "",
    "# Tool Reference",
    "",
    "Read/Query Tools:",
    "- `workflow_get_state`: Get all nodes and edges (use include_data=true for full details)",
    "- `workflow_get_node`: Get detailed info about a specific node",
    "- `workflow_get_outputs`: Get output values after running workflow",
    "- `workflow_validate`: Check for connection issues",
    "",
    "Write Tools:",
    "- `workflow_create`: Add nodes and optional edges (replace=true clears first)",
    "- `workflow_connect`: Add edges between existing nodes",
    "- `workflow_update_node`: Update any node's data or label",
    "- `workflow_delete_nodes`: Remove nodes (edges auto-removed)",
    "- `workflow_delete_edges`: Remove specific connections",
    "- `workflow_clear`: Clear entire workflow (requires confirm=true)",
    "- `workflow_run`: Execute the workflow",
    "",
    "# Common Patterns",
    "",
    "## Text Processing Pipeline",
    "User: \"Create a workflow that summarizes text\"",
    "1. workflow_get_state (check if empty)",
    "2. workflow_create with: media node -> text node -> display-text node",
    "3. workflow_validate",
    "",
    "## Adding to Existing Workflow",
    "User: \"Add image generation from the text output\"",
    "1. workflow_get_state (find existing text output node)",
    "2. workflow_create with: image node (replace=false)",
    "3. workflow_connect: text node -> image node",
    "",
    "## Modifying Node Settings",
    "User: \"Change the model to GPT-4 and increase temperature\"",
    "1. workflow_get_state (find the target node)",
    "2. workflow_get_node (see current config)",
    "3. workflow_update_node with new model and temperature",
    "",
    "# Error Handling",
    "",
    "- If a tool fails, read the error and adjust parameters",
    "- If a node is not found, use workflow_get_state to list available nodes",
    "- If validation fails, report the issues and suggest fixes",
    "- Never give up after one failure - try to recover",
    "",
    "# Preferred Defaults",
    "",
    "- For text tasks: use text node with prompt set to user's request",
    "- For image/video/audio generation: use image/video/audio node",
    "- Use media node for uploaded inputs",
    "- Only add display-text or markdown when user asks to show output",
    "- Prefer short, stable node ids (text1, img1, out1)",
    "- When creating nodes, set field values in nodes[].data",
    "- For select fields, pick one of the listed options",
    "- Do not invent field keys that are not listed",
    "",
    "# Available Node Types",
    nodeLines || "- (none registered)",
    "",
    "# Node Data Fields (use in nodes[].data)",
    fieldLines || "- (none listed)",
    "",
    "# Handle IDs by Node Type",
    handleLines || "- (none registered)",
    "",
    "# Workflow Templates (reference only)",
    templateLines || "- (none saved)"
  ].join("\n");
};
