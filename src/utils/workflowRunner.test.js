import { describe, expect, it, vi } from 'vitest';
import {
  buildDependencyGraph,
  topologicalSort,
  getNodeInputs,
  executeNode,
  runWorkflowDAG,
  runSingleNode,
} from './workflowRunner';

describe('buildDependencyGraph', () => {
  it('initializes graph, inDegree, and dependencies for nodes', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [];

    const { graph, inDegree, dependencies } = buildDependencyGraph(nodes, edges);

    expect(graph).toEqual({ a: [], b: [] });
    expect(inDegree).toEqual({ a: 0, b: 0 });
    expect(dependencies).toEqual({ a: [], b: [] });
  });

  it('adds edges and tracks dependency metadata', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
      { source: 'a', target: 'c', sourceHandle: 'out', targetHandle: 'in' },
      { source: 'b', target: 'c', sourceHandle: 'out', targetHandle: 'in2' },
    ];

    const { graph, inDegree, dependencies } = buildDependencyGraph(nodes, edges);

    expect(graph.a.map((edge) => edge.targetId)).toEqual(['b', 'c']);
    expect(graph.b.map((edge) => edge.targetId)).toEqual(['c']);
    expect(graph.c).toEqual([]);

    expect(inDegree).toEqual({ a: 0, b: 1, c: 2 });
    expect(dependencies.b).toEqual(['a']);
    expect(dependencies.c).toEqual(['a', 'b']);
  });
});

describe('topologicalSort', () => {
  it('returns execution layers in dependency order', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
      { source: 'b', target: 'c', sourceHandle: 'out', targetHandle: 'in' },
    ];

    const { graph, inDegree } = buildDependencyGraph(nodes, edges);
    const layers = topologicalSort(nodes, graph, inDegree);

    const layerIds = layers.map((layer) => layer.map((node) => node.id));
    expect(layerIds).toEqual([['a'], ['b'], ['c']]);
  });

  it('groups independent nodes into the same layer', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const { graph, inDegree } = buildDependencyGraph(nodes, []);
    const layers = topologicalSort(nodes, graph, inDegree);

    const layerIds = layers.map((layer) => layer.map((node) => node.id));
    expect(layerIds).toEqual([['a', 'b']]);
  });

  it('throws on cyclic dependencies', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [
      { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
      { source: 'b', target: 'a', sourceHandle: 'out', targetHandle: 'in' },
    ];

    const { graph, inDegree } = buildDependencyGraph(nodes, edges);
    expect(() => topologicalSort(nodes, graph, inDegree)).toThrow(/Cyclic dependency detected/);
  });
});

describe('getNodeInputs', () => {
  it('collects single input with metadata', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [{ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }];
    const nodeOutputs = {
      a: {
        out: { type: 'text', value: 'hello' },
      },
    };

    const inputs = getNodeInputs(nodes[1], edges, nodes, nodeOutputs);

    expect(inputs.in).toMatchObject({
      type: 'text',
      value: 'hello',
      sourceNode: 'a',
      sourceHandle: 'out',
    });
  });

  it('groups multiple connections into arrays', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { source: 'a', target: 'c', sourceHandle: 'out', targetHandle: 'in' },
      { source: 'b', target: 'c', sourceHandle: 'out', targetHandle: 'in' },
    ];
    const nodeOutputs = {
      a: { out: { value: 'first' } },
      b: { out: { value: 'second' } },
    };

    const inputs = getNodeInputs(nodes[2], edges, nodes, nodeOutputs);

    expect(inputs.in).toHaveLength(2);
    expect(inputs.in[0].value).toBe('first');
    expect(inputs.in[1].value).toBe('second');
  });

  it('uses default output when handle is missing', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [{ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }];
    const nodeOutputs = {
      a: { default: { value: 'fallback' } },
    };

    const inputs = getNodeInputs(nodes[1], edges, nodes, nodeOutputs);

    expect(inputs.in.value).toBe('fallback');
  });

  it('ignores edges with missing outputs', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [{ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }];

    const inputs = getNodeInputs(nodes[1], edges, nodes, {});
    expect(inputs).toEqual({});
  });
});

describe('executeNode', () => {
  it('returns text input for display-text nodes', async () => {
    const output = await executeNode(
      { id: 'a', type: 'display-text', data: {} },
      { 'text-in': { value: 'hello' } },
      {}
    );

    expect(output).toEqual({ input: 'hello' });
  });

  it('returns text input for markdown nodes', async () => {
    const output = await executeNode(
      { id: 'a', type: 'markdown', data: {} },
      { 'text-in': { value: 'md' } },
      {}
    );

    expect(output).toEqual({ input: 'md' });
  });

  it('returns passthrough for unknown nodes', async () => {
    const output = await executeNode({ id: 'a', type: 'custom', data: {} }, {}, {});

    expect(output).toEqual({ passthrough: true });
  });
});

describe('runWorkflowDAG', () => {
  it('executes nodes and reports progress', async () => {
    const nodes = [
      { id: 'a', type: 'display-text', data: {} },
      { id: 'b', type: 'markdown', data: {} },
    ];
    const edges = [{ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'text-in' }];

    const onNodeStart = vi.fn();
    const onNodeComplete = vi.fn();
    const onProgress = vi.fn();

    const result = await runWorkflowDAG({
      nodes,
      edges,
      onNodeStart,
      onNodeComplete,
      onProgress,
    });

    expect(result.success).toBe(true);
    expect(result.completedCount).toBe(2);
    expect(Object.keys(result.nodeOutputs)).toEqual(['a', 'b']);
    expect(onNodeStart).toHaveBeenCalledTimes(2);
    expect(onNodeComplete).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalled();

    const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastProgress).toMatchObject({ completed: 2, total: 2, percentage: 100 });
  });

  it('halts and reports errors when a node fails', async () => {
    const onNodeError = vi.fn();
    const onNodeStart = vi.fn((node) => {
      if (node.id === 'fail') {
        throw new Error('boom');
      }
    });

    const result = await runWorkflowDAG({
      nodes: [{ id: 'fail', type: 'display-text', data: {} }],
      edges: [],
      onNodeError,
      onNodeStart,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Node fail failed: boom');
    expect(result.nodeErrors.fail).toBeInstanceOf(Error);
    expect(onNodeError).toHaveBeenCalledTimes(1);
  });
});

describe('runSingleNode', () => {
  it('executes upstream dependencies only', async () => {
    const nodes = [
      { id: 'a', type: 'display-text', data: {} },
      { id: 'b', type: 'display-text', data: {} },
      { id: 'c', type: 'display-text', data: {} },
      { id: 'd', type: 'display-text', data: {} },
    ];
    const edges = [
      { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'text-in' },
      { source: 'b', target: 'c', sourceHandle: 'out', targetHandle: 'text-in' },
    ];

    const result = await runSingleNode({
      nodeId: 'c',
      nodes,
      edges,
    });

    expect(result.success).toBe(true);
    expect(result.completedCount).toBe(3);
    expect(Object.keys(result.nodeOutputs)).toEqual(['a', 'b', 'c']);
    expect(result.nodeOutputs.d).toBeUndefined();
  });

  it('throws when the target node is missing', async () => {
    await expect(runSingleNode({ nodeId: 'missing', nodes: [], edges: [] })).rejects.toThrow(
      'Node missing not found'
    );
  });
});
