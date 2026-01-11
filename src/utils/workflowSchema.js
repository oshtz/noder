const nowIso = () => new Date().toISOString();

export const WORKFLOW_SCHEMA_VERSION = "0.1.0";
export const WORKFLOW_SCHEMA_ID = "noder.workflow@0.1";
export const LOCAL_WORKFLOW_KEY = "noder-workflow";

const baseMetadata = (input = {}) => {
  const createdAt = input.createdAt || nowIso();
  return {
    name: input.name || "Untitled Workflow",
    description: input.description || "",
    version: input.version || WORKFLOW_SCHEMA_VERSION,
    schema: input.schema || WORKFLOW_SCHEMA_ID,
    app: input.app || { product: "noder", flavor: "desktop" },
    createdAt,
    updatedAt: input.updatedAt || nowIso()
  };
};

export const buildWorkflowDocument = ({
  id,
  name,
  nodes = [],
  edges = [],
  viewport,
  outputs = [],
  metadata = {}
} = {}) => {
  const meta = baseMetadata({
    ...metadata,
    name: metadata.name || name || id || "Untitled Workflow"
  });

  return {
    id: id || name || meta.name,
    schema: WORKFLOW_SCHEMA_ID,
    version: meta.version,
    metadata: {
      ...meta,
      updatedAt: nowIso()
    },
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    outputs: Array.isArray(outputs) ? outputs : [],
    ...(viewport ? { viewport } : {})
  };
};

export const migrateWorkflowDocument = (raw = {}) => {
  if (!raw || typeof raw !== "object") {
    return buildWorkflowDocument();
  }

  // Unwrap Tauri workflow shape { id, name, data }
  const payload =
    raw.data && (raw.data.nodes || raw.data.edges || raw.data.metadata)
      ? raw.data
      : raw;

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : raw.nodes || [];
  const edges = Array.isArray(payload.edges) ? payload.edges : raw.edges || [];
  const outputs = Array.isArray(payload.outputs) ? payload.outputs : raw.outputs || [];
  const metadataInput = payload.metadata || raw.metadata || {};
  const viewport = payload.viewport || raw.viewport;

  const migrated = buildWorkflowDocument({
    id: raw.id || payload.id,
    name: payload.name || raw.name,
    nodes,
    edges,
    outputs,
    viewport,
    metadata: metadataInput
  });

  return migrated;
};
