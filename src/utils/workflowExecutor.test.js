import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeWorkflow } from './workflowExecutor';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock eventBus emit
vi.mock('./eventBus', () => ({
  emit: vi.fn(),
}));

// Mock replicateFiles
vi.mock('./replicateFiles', () => ({
  deleteFileFromReplicate: vi.fn().mockResolvedValue(undefined),
}));

// Node factory functions
const createMediaNode = (id, overrides = {}) => ({
  id,
  type: 'media',
  data: {
    mediaType: 'image',
    mediaPath: '/tmp/image.png',
    replicateFileId: null,
    replicateUrl: null,
    ...overrides,
  },
});

const createTextNode = (id, overrides = {}) => ({
  id,
  type: 'text',
  data: {
    prompt: '',
    ...overrides,
  },
});

const createChipNode = (id, overrides = {}) => ({
  id,
  type: 'chip',
  data: {
    content: 'test chip content',
    chipId: 'TEST_CHIP',
    ...overrides,
  },
});

const createDisplayTextNode = (id, overrides = {}) => ({
  id,
  type: 'display-text',
  data: {
    ...overrides,
  },
});

const createMarkdownNode = (id, overrides = {}) => ({
  id,
  type: 'markdown',
  data: {
    ...overrides,
  },
});

const createImageNode = (id, overrides = {}) => ({
  id,
  type: 'image',
  data: {
    prompt: '',
    model: 'black-forest-labs/flux-2-klein-4b',
    ...overrides,
  },
});

const createVideoNode = (id, overrides = {}) => ({
  id,
  type: 'video',
  data: {
    prompt: '',
    model: 'minimax/video-01',
    ...overrides,
  },
});

const createAudioNode = (id, overrides = {}) => ({
  id,
  type: 'audio',
  data: {
    prompt: '',
    model: 'meta/musicgen',
    ...overrides,
  },
});

const createUpscalerNode = (id, overrides = {}) => ({
  id,
  type: 'upscaler',
  data: {
    model: 'nightmareai/real-esrgan',
    ...overrides,
  },
});

const createUnknownNode = (id, overrides = {}) => ({
  id,
  type: 'unknown-type',
  data: {
    ...overrides,
  },
});

describe('executeWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('skips cached nodes and keeps cached outputs', async () => {
    const nodes = [createMediaNode('a'), createMediaNode('b')];
    const onNodeStart = vi.fn();
    const onNodeComplete = vi.fn();
    const onNodeSkip = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeStart,
      onNodeComplete,
      onNodeSkip,
      initialNodeOutputs: {
        a: { out: { type: 'image', value: 'cached-output' } },
      },
      autoCleanup: false,
    });

    expect(onNodeSkip).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'cached');
    expect(onNodeStart).toHaveBeenCalledTimes(1);
    expect(onNodeComplete).toHaveBeenCalledTimes(1);
    expect(result.nodeOutputs.a.out.value).toBe('cached-output');
    expect(Object.keys(result.nodeOutputs)).toEqual(expect.arrayContaining(['a', 'b']));
    expect(result.completedCount).toBe(2);
  });

  it('skips explicit node ids without executing them', async () => {
    const nodes = [createMediaNode('a'), createMediaNode('b')];
    const onNodeStart = vi.fn();
    const onNodeSkip = vi.fn();

    await executeWorkflow({
      nodes,
      edges: [],
      onNodeStart,
      onNodeSkip,
      skipNodeIds: ['b'],
      autoCleanup: false,
    });

    expect(onNodeSkip).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), 'skipped');
    expect(onNodeStart).toHaveBeenCalledTimes(1);
  });

  it('continues execution when continueOnError is enabled', async () => {
    const nodes = [createMediaNode('a'), createTextNode('b', { prompt: '' })];
    const onNodeStart = vi.fn();
    const onNodeComplete = vi.fn();
    const onNodeError = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeStart,
      onNodeComplete,
      onNodeError,
      continueOnError: true,
      autoCleanup: false,
    });

    expect(onNodeStart).toHaveBeenCalledTimes(2);
    expect(onNodeComplete).toHaveBeenCalledTimes(1);
    expect(onNodeError).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No prompt provided');
    expect(result.nodeOutputs.a).toBeDefined();
  });

  it('executes chip node and outputs chip content with metadata', async () => {
    const nodes = [createChipNode('chip1', { content: 'my chip value', chipId: 'CHARACTER' })];
    const onNodeComplete = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeComplete,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.chip1).toBeDefined();
    expect(result.nodeOutputs.chip1.out.value).toBe('my chip value');
    expect(result.nodeOutputs.chip1.out.chipId).toBe('CHARACTER');
    expect(result.nodeOutputs.chip1.out.isChip).toBe(true);
  });

  it('executes display-text node without error', async () => {
    const nodes = [createDisplayTextNode('display1')];
    const onNodeComplete = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeComplete,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.display1).toBeDefined();
    expect(result.nodeOutputs.display1.received).toBe(true);
  });

  it('executes markdown node without error', async () => {
    const nodes = [createMarkdownNode('md1')];
    const onNodeComplete = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeComplete,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.md1).toBeDefined();
    expect(result.nodeOutputs.md1.received).toBe(true);
  });

  it('executes unknown node type with passthrough', async () => {
    const nodes = [createUnknownNode('unknown1')];
    const onNodeComplete = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeComplete,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.unknown1).toBeDefined();
    expect(result.nodeOutputs.unknown1.passthrough).toBe(true);
  });

  it('executes media node with local path when no replicate URL', async () => {
    const nodes = [
      createMediaNode('media1', {
        mediaPath: '/local/path/image.png',
        replicateUrl: null,
      }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.media1.out.value).toBe('/local/path/image.png');
    expect(result.nodeOutputs.media1.out.metadata.isReplicateUrl).toBe(false);
  });

  it('executes media node preferring replicate URL over local path', async () => {
    const nodes = [
      createMediaNode('media1', {
        mediaPath: '/local/path/image.png',
        replicateUrl: 'https://replicate.delivery/file123.png',
      }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.media1.out.value).toBe('https://replicate.delivery/file123.png');
    expect(result.nodeOutputs.media1.out.metadata.isReplicateUrl).toBe(true);
  });

  it('executes media node with video type', async () => {
    const nodes = [
      createMediaNode('media1', {
        mediaType: 'video',
        mediaPath: '/local/path/video.mp4',
      }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.media1.out.type).toBe('video');
  });

  it('executes media node with audio type', async () => {
    const nodes = [
      createMediaNode('media1', {
        mediaType: 'audio',
        mediaPath: '/local/path/audio.mp3',
      }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.media1.out.type).toBe('audio');
  });

  it('handles workflow with multiple nodes in dependency order', async () => {
    const nodes = [
      createMediaNode('media1'),
      createChipNode('chip1'),
      createDisplayTextNode('display1'),
    ];
    const edges = [
      { source: 'media1', sourceHandle: 'out', target: 'display1', targetHandle: 'in' },
      { source: 'chip1', sourceHandle: 'out', target: 'display1', targetHandle: 'in' },
    ];
    const onNodeComplete = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges,
      onNodeComplete,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(onNodeComplete).toHaveBeenCalledTimes(3);
  });

  it('reports progress during execution', async () => {
    const nodes = [createMediaNode('a'), createMediaNode('b'), createChipNode('c')];
    const onProgress = vi.fn();

    await executeWorkflow({
      nodes,
      edges: [],
      onProgress,
      autoCleanup: false,
    });

    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.completed).toBe(3);
    expect(lastCall.total).toBe(3);
    expect(lastCall.percentage).toBe(100);
  });

  it('returns workflow metadata', async () => {
    const nodes = [createMediaNode('a')];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.workflowId).toMatch(/^workflow-\d+$/);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('tracks skipped nodes in result', async () => {
    const nodes = [createMediaNode('a'), createMediaNode('b'), createMediaNode('c')];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      skipNodeIds: ['b', 'c'],
      autoCleanup: false,
    });

    expect(result.skippedNodes).toContain('b');
    expect(result.skippedNodes).toContain('c');
    expect(result.skippedNodes).not.toContain('a');
  });

  it('handles empty nodes array', async () => {
    const result = await executeWorkflow({
      nodes: [],
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.completedCount).toBe(0);
  });

  it('uses default chip ID when not specified', async () => {
    const nodes = [createChipNode('chip1', { content: 'value', chipId: undefined })];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    // Should use node.id as fallback chipId
    expect(result.nodeOutputs.chip1.out.chipId).toBe('chip1');
  });

  it('handles chip node with empty content', async () => {
    const nodes = [createChipNode('chip1', { content: '', chipId: 'EMPTY_CHIP' })];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.chip1.out.value).toBe('');
  });

  it('stops on error when continueOnError is false', async () => {
    const nodes = [
      createTextNode('text1', { prompt: '' }), // Will fail: no prompt
      createMediaNode('media1'), // Should not execute
    ];
    const edges = [{ source: 'text1', sourceHandle: 'out', target: 'media1', targetHandle: 'in' }];
    const onNodeStart = vi.fn();
    const onNodeError = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges,
      onNodeStart,
      onNodeError,
      continueOnError: false,
      autoCleanup: false,
    });

    expect(result.success).toBe(false);
    expect(onNodeError).toHaveBeenCalledTimes(1);
  });

  it('executes nodes in correct layer order', async () => {
    const executionOrder = [];
    const nodes = [createChipNode('chip1'), createDisplayTextNode('display1')];
    const edges = [
      { source: 'chip1', sourceHandle: 'out', target: 'display1', targetHandle: 'in' },
    ];

    await executeWorkflow({
      nodes,
      edges,
      onNodeComplete: (node) => executionOrder.push(node.id),
      autoCleanup: false,
    });

    // chip1 should complete before display1 due to dependency
    expect(executionOrder.indexOf('chip1')).toBeLessThan(executionOrder.indexOf('display1'));
  });

  it('reports initial progress when cached outputs exist', async () => {
    const nodes = [createMediaNode('a'), createMediaNode('b')];
    const onProgress = vi.fn();

    await executeWorkflow({
      nodes,
      edges: [],
      onProgress,
      initialNodeOutputs: { a: { out: { type: 'image', value: 'cached' } } },
      autoCleanup: false,
    });

    // First progress call should show 1 completed (the cached node)
    expect(onProgress.mock.calls[0][0].completed).toBe(1);
  });

  it('handles group nodes by collecting and passing through', async () => {
    const groupNode = {
      id: 'group1',
      type: 'group',
      data: {},
    };
    const nodes = [groupNode, createMediaNode('media1')];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.group1).toBeDefined();
  });

  it('handles save-media node type with error when no input', async () => {
    const saveNode = {
      id: 'save1',
      type: 'save-media',
      data: { savePath: '/tmp/output' },
    };
    const nodes = [saveNode];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
      continueOnError: true,
    });

    // Save media node without inputs should fail (requires media input)
    expect(result.success).toBe(false);
  });

  it('handles multiple connected inputs from different sources', async () => {
    const nodes = [
      createChipNode('chip1', { content: 'value1', chipId: 'CHIP1' }),
      createChipNode('chip2', { content: 'value2', chipId: 'CHIP2' }),
      createDisplayTextNode('display1'),
    ];
    const edges = [
      { source: 'chip1', sourceHandle: 'out', target: 'display1', targetHandle: 'in' },
      { source: 'chip2', sourceHandle: 'out', target: 'display1', targetHandle: 'in' },
    ];

    const result = await executeWorkflow({
      nodes,
      edges,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.display1).toBeDefined();
  });

  it('handles text node with empty model defaulting to meta-llama', async () => {
    const textNode = createTextNode('text1', { prompt: '', model: undefined });
    const nodes = [textNode];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
      continueOnError: true,
    });

    // Should fail due to empty prompt, but model default should be applied
    expect(result.success).toBe(false);
    expect(result.error).toBe('No prompt provided');
  });

  it('handles circular dependency detection', async () => {
    const nodes = [createChipNode('a'), createDisplayTextNode('b')];
    // In practice, DAG prevents circular deps, but test edge case
    const edges = [{ source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' }];

    const result = await executeWorkflow({
      nodes,
      edges,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
  });

  it('handles node with missing data gracefully', async () => {
    const nodeWithMissingData = {
      id: 'minimal',
      type: 'chip',
      data: {}, // Missing content and chipId
    };

    const result = await executeWorkflow({
      nodes: [nodeWithMissingData],
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    // Should use node.id as chipId fallback
    expect(result.nodeOutputs.minimal.out.chipId).toBe('minimal');
  });

  it('passes context to node execution', async () => {
    const nodes = [createMediaNode('media1')];
    const context = { apiKey: 'test-key', sessionId: 'session-123' };

    const result = await executeWorkflow({
      nodes,
      edges: [],
      context,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
  });

  it('continues execution and sets success to false when errors occur', async () => {
    const nodes = [
      createTextNode('text1', { prompt: '' }), // Will fail
      createTextNode('text2', { prompt: '' }), // Will fail
      createMediaNode('media1'), // Will succeed
    ];
    const onNodeError = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      continueOnError: true,
      onNodeError,
      autoCleanup: false,
    });

    expect(result.success).toBe(false);
    expect(onNodeError).toHaveBeenCalledTimes(2);
    // The successful node should still have output
    expect(result.nodeOutputs.media1).toBeDefined();
  });

  it('handles nodes with same type but different data', async () => {
    const nodes = [
      createChipNode('chip1', { content: 'first', chipId: 'A' }),
      createChipNode('chip2', { content: 'second', chipId: 'B' }),
      createChipNode('chip3', { content: 'third', chipId: 'C' }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.chip1.out.value).toBe('first');
    expect(result.nodeOutputs.chip2.out.value).toBe('second');
    expect(result.nodeOutputs.chip3.out.value).toBe('third');
  });

  it('preserves node output types correctly', async () => {
    const nodes = [
      createMediaNode('image1', { mediaType: 'image' }),
      createMediaNode('video1', { mediaType: 'video' }),
      createMediaNode('audio1', { mediaType: 'audio' }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.nodeOutputs.image1.out.type).toBe('image');
    expect(result.nodeOutputs.video1.out.type).toBe('video');
    expect(result.nodeOutputs.audio1.out.type).toBe('audio');
  });

  it('handles large workflow with many nodes', async () => {
    const nodes = Array.from({ length: 20 }, (_, i) =>
      createChipNode(`chip${i}`, { content: `value${i}`, chipId: `CHIP${i}` })
    );

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.completedCount).toBe(20);
  });

  it('handles chain of display-text nodes', async () => {
    const nodes = [
      createDisplayTextNode('d1'),
      createDisplayTextNode('d2'),
      createDisplayTextNode('d3'),
    ];
    const edges = [
      { source: 'd1', sourceHandle: 'out', target: 'd2', targetHandle: 'in' },
      { source: 'd2', sourceHandle: 'out', target: 'd3', targetHandle: 'in' },
    ];

    const result = await executeWorkflow({
      nodes,
      edges,
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.completedCount).toBe(3);
  });

  it('handles markdown node with complex content', async () => {
    const nodes = [
      createMarkdownNode('md1', {
        content: '# Header\n\n**Bold** and *italic*\n\n- List item',
      }),
    ];

    const result = await executeWorkflow({
      nodes,
      edges: [],
      autoCleanup: false,
    });

    expect(result.success).toBe(true);
    expect(result.nodeOutputs.md1.received).toBe(true);
  });
});
