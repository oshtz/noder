import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { buildConnectionHint } from './connectionHints';

const nodes = [
  {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: {
      title: 'Image',
      handles: [{ id: 'image-out', type: 'output', dataType: 'image' }],
    },
  },
  {
    id: 'upscaler-1',
    type: 'upscaler',
    position: { x: 100, y: 0 },
    data: {
      title: 'Upscaler',
      handles: [{ id: 'image-in', type: 'input', dataType: 'image' }],
    },
  },
  {
    id: 'text-1',
    type: 'text',
    position: { x: 200, y: 0 },
    data: {
      title: 'Text',
      handles: [{ id: 'text-in', type: 'input', dataType: 'text' }],
    },
  },
] as Node[];

describe('connectionHints', () => {
  it('returns compatible target nodes for the active source handle', () => {
    const hint = buildConnectionHint(nodes, 'image-1', 'image-out', 'image');

    expect(hint?.sourceNodeLabel).toBe('Image');
    expect(hint?.compatibleTargets).toEqual([
      { nodeId: 'upscaler-1', label: 'Upscaler', handleId: 'image-in' },
    ]);
  });

  it('explains when no targets are compatible', () => {
    const hint = buildConnectionHint(nodes, 'image-1', 'image-out', 'audio');

    expect(hint?.compatibleTargets).toEqual([]);
    expect(hint?.invalidReason).toBe('No nodes accept audio output yet.');
  });
});
