import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  WORKFLOW_SCHEMA_VERSION,
  WORKFLOW_SCHEMA_ID,
  LOCAL_WORKFLOW_KEY,
  buildWorkflowDocument,
  migrateWorkflowDocument,
} from './workflowSchema';

describe('Workflow Schema Constants', () => {
  it('should export correct schema version', () => {
    expect(WORKFLOW_SCHEMA_VERSION).toBe('0.1.0');
  });

  it('should export correct schema ID', () => {
    expect(WORKFLOW_SCHEMA_ID).toBe('noder.workflow@0.1');
  });

  it('should export local workflow key', () => {
    expect(LOCAL_WORKFLOW_KEY).toBe('noder-workflow');
  });
});

describe('buildWorkflowDocument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-13T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a default workflow document', () => {
    const doc = buildWorkflowDocument();

    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('schema', WORKFLOW_SCHEMA_ID);
    expect(doc).toHaveProperty('version', WORKFLOW_SCHEMA_VERSION);
    expect(doc).toHaveProperty('metadata');
    expect(doc).toHaveProperty('nodes');
    expect(doc).toHaveProperty('edges');
    expect(doc).toHaveProperty('outputs');
  });

  it('should use provided id', () => {
    const doc = buildWorkflowDocument({ id: 'my-workflow' });
    expect(doc.id).toBe('my-workflow');
  });

  it('should use provided name as id fallback', () => {
    const doc = buildWorkflowDocument({ name: 'My Workflow' });
    expect(doc.id).toBe('My Workflow');
  });

  it('should set default name when none provided', () => {
    const doc = buildWorkflowDocument();
    expect(doc.metadata.name).toBe('Untitled Workflow');
  });

  it('should use provided nodes and edges', () => {
    const nodes = [{ id: 'node-1', type: 'text' }];
    const edges = [{ id: 'edge-1', source: 'a', target: 'b' }];

    const doc = buildWorkflowDocument({ nodes, edges });

    expect(doc.nodes).toEqual(nodes);
    expect(doc.edges).toEqual(edges);
  });

  it('should handle empty arrays for nodes and edges', () => {
    const doc = buildWorkflowDocument({ nodes: [], edges: [] });
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  it('should handle non-array nodes/edges gracefully', () => {
    const doc = buildWorkflowDocument({ nodes: 'invalid', edges: null });
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  it('should include viewport when provided', () => {
    const viewport = { x: 100, y: 200, zoom: 1.5 };
    const doc = buildWorkflowDocument({ viewport });
    expect(doc.viewport).toEqual(viewport);
  });

  it('should not include viewport when not provided', () => {
    const doc = buildWorkflowDocument();
    expect(doc).not.toHaveProperty('viewport');
  });

  it('should include outputs array', () => {
    const outputs = [{ nodeId: 'node-1', output: 'result' }];
    const doc = buildWorkflowDocument({ outputs });
    expect(doc.outputs).toEqual(outputs);
  });

  it('should set metadata timestamps', () => {
    const doc = buildWorkflowDocument();

    expect(doc.metadata.createdAt).toBe('2026-01-13T12:00:00.000Z');
    expect(doc.metadata.updatedAt).toBe('2026-01-13T12:00:00.000Z');
  });

  it('should use provided metadata', () => {
    const metadata = {
      name: 'Custom Workflow',
      description: 'A test workflow',
    };

    const doc = buildWorkflowDocument({ metadata });

    expect(doc.metadata.name).toBe('Custom Workflow');
    expect(doc.metadata.description).toBe('A test workflow');
  });

  it('should handle null metadata gracefully', () => {
    const doc = buildWorkflowDocument({ metadata: null });
    expect(doc.metadata.name).toBe('Untitled Workflow');
  });

  it('should set app metadata', () => {
    const doc = buildWorkflowDocument();
    expect(doc.metadata.app).toEqual({ product: 'noder', flavor: 'desktop' });
  });
});

describe('migrateWorkflowDocument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-13T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return default document for null input', () => {
    const doc = migrateWorkflowDocument(null);
    expect(doc.metadata.name).toBe('Untitled Workflow');
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  it('should return default document for undefined input', () => {
    const doc = migrateWorkflowDocument(undefined);
    expect(doc.metadata.name).toBe('Untitled Workflow');
  });

  it('should return default document for non-object input', () => {
    const doc = migrateWorkflowDocument('string');
    expect(doc.metadata.name).toBe('Untitled Workflow');
  });

  it('should migrate simple workflow object', () => {
    const raw = {
      id: 'workflow-1',
      name: 'Test Workflow',
      nodes: [{ id: 'node-1', type: 'text' }],
      edges: [{ id: 'edge-1', source: 'a', target: 'b' }],
    };

    const doc = migrateWorkflowDocument(raw);

    expect(doc.id).toBe('workflow-1');
    expect(doc.metadata.name).toBe('Test Workflow');
    expect(doc.nodes).toEqual(raw.nodes);
    expect(doc.edges).toEqual(raw.edges);
  });

  it('should unwrap Tauri workflow shape with data property', () => {
    const raw = {
      id: 'workflow-1',
      name: 'Wrapped Workflow',
      data: {
        nodes: [{ id: 'node-1', type: 'text' }],
        edges: [],
        metadata: { name: 'Inner Name' },
      },
    };

    const doc = migrateWorkflowDocument(raw);

    expect(doc.id).toBe('workflow-1');
    expect(doc.nodes).toEqual(raw.data.nodes);
    expect(doc.metadata.name).toBe('Inner Name');
  });

  it('should preserve viewport during migration', () => {
    const raw = {
      nodes: [],
      edges: [],
      viewport: { x: 50, y: 100, zoom: 2 },
    };

    const doc = migrateWorkflowDocument(raw);
    expect(doc.viewport).toEqual(raw.viewport);
  });

  it('should preserve outputs during migration', () => {
    const raw = {
      nodes: [],
      edges: [],
      outputs: [{ nodeId: 'node-1', output: 'test' }],
    };

    const doc = migrateWorkflowDocument(raw);
    expect(doc.outputs).toEqual(raw.outputs);
  });

  it('should set schema and version', () => {
    const raw = { nodes: [], edges: [] };
    const doc = migrateWorkflowDocument(raw);

    expect(doc.schema).toBe(WORKFLOW_SCHEMA_ID);
    expect(doc.version).toBe(WORKFLOW_SCHEMA_VERSION);
  });

  it('should update timestamps', () => {
    const raw = {
      nodes: [],
      edges: [],
      metadata: { createdAt: '2020-01-01T00:00:00.000Z' },
    };

    const doc = migrateWorkflowDocument(raw);

    expect(doc.metadata.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(doc.metadata.updatedAt).toBe('2026-01-13T12:00:00.000Z');
  });

  it('should handle deeply nested Tauri data shape', () => {
    const raw = {
      id: 'db-workflow-1',
      data: {
        id: 'inner-id',
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1' }],
        metadata: {
          name: 'DB Workflow',
          description: 'From database',
        },
      },
    };

    const doc = migrateWorkflowDocument(raw);

    expect(doc.id).toBe('db-workflow-1');
    expect(doc.nodes).toEqual(raw.data.nodes);
    expect(doc.edges).toEqual(raw.data.edges);
    expect(doc.metadata.name).toBe('DB Workflow');
    expect(doc.metadata.description).toBe('From database');
  });

  it('should fall back to outer properties when data is empty object', () => {
    const raw = {
      id: 'outer-id',
      name: 'Outer Name',
      nodes: [{ id: 'outer-node' }],
      data: {},
    };

    const doc = migrateWorkflowDocument(raw);

    expect(doc.id).toBe('outer-id');
    expect(doc.nodes).toEqual(raw.nodes);
  });
});
