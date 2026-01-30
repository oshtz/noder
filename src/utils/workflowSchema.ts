/**
 * Workflow Schema Utilities
 *
 * Functions for building and migrating workflow documents
 * with consistent metadata and versioning.
 */

import type { Node, Edge, Viewport } from 'reactflow';
import type { WorkflowOutput } from '../types/components';

// =============================================================================
// Constants
// =============================================================================

export const WORKFLOW_SCHEMA_VERSION = '0.1.0';
export const WORKFLOW_SCHEMA_ID = 'noder.workflow@0.1';
export const LOCAL_WORKFLOW_KEY = 'noder-workflow';

// =============================================================================
// Types
// =============================================================================

/** Application info embedded in workflow metadata */
export interface WorkflowApp {
  product: string;
  flavor: string;
}

/** Workflow metadata */
export interface WorkflowMetadata {
  name: string;
  description: string;
  version: string;
  schema: string;
  app: WorkflowApp;
  createdAt: string;
  updatedAt: string;
}

/** Complete workflow document structure */
export interface WorkflowDocument {
  id: string;
  /** Convenience accessor - same as metadata.name */
  name?: string;
  schema: string;
  version: string;
  metadata: WorkflowMetadata;
  nodes: Node[];
  edges: Edge[];
  outputs: WorkflowOutput[];
  viewport?: Viewport;
}

/** Input for building workflow metadata */
export interface MetadataInput {
  name?: string;
  description?: string;
  version?: string;
  schema?: string;
  app?: WorkflowApp;
  createdAt?: string;
  updatedAt?: string;
}

/** Input for building a workflow document */
export interface BuildWorkflowInput {
  id?: string;
  name?: string;
  nodes?: Node[];
  edges?: Edge[];
  viewport?: Viewport;
  outputs?: WorkflowOutput[];
  metadata?: MetadataInput;
}

/** Raw workflow data from Tauri backend - inner data shape */
interface TauriWorkflowInnerData {
  id?: string;
  name?: string;
  nodes?: unknown[];
  edges?: unknown[];
  outputs?: unknown[];
  viewport?: Viewport;
  metadata?: MetadataInput;
}

/** Raw workflow data from Tauri backend */
export interface TauriWorkflowPayload {
  id?: string;
  name?: string;
  nodes?: unknown[];
  edges?: unknown[];
  outputs?: unknown[];
  viewport?: Viewport;
  metadata?: MetadataInput;
  data?: TauriWorkflowInnerData;
}

// =============================================================================
// Helper Functions
// =============================================================================

/** Get current ISO timestamp */
const nowIso = (): string => new Date().toISOString();

/**
 * Build base metadata with defaults
 * @param input - Partial metadata input
 * @returns Complete metadata object
 */
const baseMetadata = (input: MetadataInput = {}): WorkflowMetadata => {
  const createdAt = input.createdAt || nowIso();
  return {
    name: input.name || 'Untitled Workflow',
    description: input.description || '',
    version: input.version || WORKFLOW_SCHEMA_VERSION,
    schema: input.schema || WORKFLOW_SCHEMA_ID,
    app: input.app || { product: 'noder', flavor: 'desktop' },
    createdAt,
    updatedAt: input.updatedAt || nowIso(),
  };
};

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Build a complete workflow document with proper metadata
 * @param input - Workflow data input
 * @returns Complete workflow document
 */
export const buildWorkflowDocument = ({
  id,
  name,
  nodes = [],
  edges = [],
  viewport,
  outputs = [],
  metadata = {},
}: BuildWorkflowInput = {}): WorkflowDocument => {
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};
  const meta = baseMetadata({
    ...safeMetadata,
    name: safeMetadata.name || name || id || 'Untitled Workflow',
  });

  const documentName = meta.name;
  const document: WorkflowDocument = {
    id: id || name || documentName,
    name: documentName,
    schema: WORKFLOW_SCHEMA_ID,
    version: meta.version,
    metadata: {
      ...meta,
      updatedAt: nowIso(),
    },
    nodes: Array.isArray(nodes) ? (nodes as Node[]) : [],
    edges: Array.isArray(edges) ? (edges as Edge[]) : [],
    outputs: Array.isArray(outputs) ? (outputs as WorkflowOutput[]) : [],
  };

  if (viewport) {
    document.viewport = viewport;
  }

  return document;
};

/**
 * Migrate a raw workflow payload to the current schema
 * Handles both direct workflow data and Tauri-wrapped { id, name, data } format
 * @param raw - Raw workflow data (may be incomplete or old format)
 * @returns Complete workflow document in current schema
 */
export const migrateWorkflowDocument = (
  raw: TauriWorkflowPayload | null = {}
): WorkflowDocument => {
  if (!raw || typeof raw !== 'object') {
    return buildWorkflowDocument();
  }

  // Unwrap Tauri workflow shape { id, name, data }
  const hasInnerData = raw.data && (raw.data.nodes || raw.data.edges || raw.data.metadata);
  const payload = hasInnerData ? (raw.data ?? raw) : raw;

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : (raw.nodes as unknown[]) || [];
  const edges = Array.isArray(payload.edges) ? payload.edges : (raw.edges as unknown[]) || [];
  const outputs = Array.isArray(payload.outputs)
    ? payload.outputs
    : (raw.outputs as unknown[]) || [];
  const metadataInput = payload.metadata || raw.metadata || {};
  const viewport = payload.viewport || raw.viewport;

  const migrated = buildWorkflowDocument({
    id: raw.id || payload.id,
    name: payload.name || raw.name,
    nodes: nodes as Node[],
    edges: edges as Edge[],
    outputs: outputs as WorkflowOutput[],
    viewport,
    metadata: metadataInput,
  });

  return migrated;
};
