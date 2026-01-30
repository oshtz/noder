/**
 * Tests for workflowHelpers utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import {
  normalizeTemplates,
  normalizeHandleId,
  markEdgeGlows,
  prepareEdges,
  persistOutputToLocal,
  getPrimaryOutput,
  isImageFile,
  getOutputTypeFromNodeType,
} from './workflowHelpers';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock handleValidation
import { validateEdges } from './handleValidation';
vi.mock('./handleValidation', () => ({
  validateEdges: vi.fn((edges: Edge[], _nodes: Node[]) => ({
    validEdges: edges,
    validationErrors: [],
  })),
}));

// Mock LEGACY_HANDLE_ALIASES
vi.mock('../constants/app', () => ({
  LEGACY_HANDLE_ALIASES: {
    imageNode: {
      source: { 'old-source': 'image-out' },
      target: { 'old-target': 'image-in' },
    },
  },
}));

describe('workflowHelpers', () => {
  describe('normalizeTemplates', () => {
    it('should return empty array for non-array input', () => {
      expect(normalizeTemplates(null)).toEqual([]);
      expect(normalizeTemplates(undefined)).toEqual([]);
      expect(normalizeTemplates('string')).toEqual([]);
      expect(normalizeTemplates(123)).toEqual([]);
      expect(normalizeTemplates({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(normalizeTemplates([])).toEqual([]);
    });

    it('should normalize templates with missing properties', () => {
      const templates = [{}];
      const result = normalizeTemplates(templates);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Untitled');
      expect(result[0].description).toBe('');
      expect(result[0].icon).toBe('file');
      expect(result[0].category).toBe('beginner');
      expect(result[0].nodes).toEqual([]);
      expect(result[0].edges).toEqual([]);
      expect(result[0].id).toMatch(/^template-\d+$/);
    });

    it('should preserve valid template properties', () => {
      const templates = [
        {
          id: 'test-id',
          name: 'Test Template',
          description: 'A test template',
          icon: 'star',
          category: 'advanced',
          nodes: [{ id: 'node1' }],
          edges: [{ id: 'edge1' }],
        },
      ];

      const result = normalizeTemplates(templates);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-id');
      expect(result[0].name).toBe('Test Template');
      expect(result[0].description).toBe('A test template');
      expect(result[0].icon).toBe('star');
      expect(result[0].category).toBe('advanced');
      expect(result[0].nodes).toEqual([{ id: 'node1' }]);
      expect(result[0].edges).toEqual([{ id: 'edge1' }]);
    });

    it('should handle non-array nodes and edges', () => {
      const templates = [
        {
          id: 'test',
          name: 'Test',
          nodes: 'not-an-array',
          edges: { key: 'value' },
        },
      ];

      const result = normalizeTemplates(templates);

      expect(result[0].nodes).toEqual([]);
      expect(result[0].edges).toEqual([]);
    });

    it('should handle null items in array', () => {
      const templates = [null, undefined, { id: 'valid' }];
      const result = normalizeTemplates(templates);

      expect(result).toHaveLength(3);
      expect(result[2].id).toBe('valid');
    });
  });

  describe('normalizeHandleId', () => {
    const nodesById: Record<string, Node> = {
      node1: { id: 'node1', type: 'imageNode', position: { x: 0, y: 0 }, data: {} },
      node2: { id: 'node2', type: 'textNode', position: { x: 0, y: 0 }, data: {} },
    };

    it('should return null/undefined for falsy handleId', () => {
      expect(normalizeHandleId('node1', null, 'source', nodesById)).toBeNull();
      expect(normalizeHandleId('node1', undefined, 'source', nodesById)).toBeUndefined();
      expect(normalizeHandleId('node1', '', 'source', nodesById)).toBe('');
    });

    it('should return handleId if node not found', () => {
      expect(normalizeHandleId('nonexistent', 'old-source', 'source', nodesById)).toBe(
        'old-source'
      );
    });

    it('should normalize legacy source handle', () => {
      expect(normalizeHandleId('node1', 'old-source', 'source', nodesById)).toBe('image-out');
    });

    it('should normalize legacy target handle', () => {
      expect(normalizeHandleId('node1', 'old-target', 'target', nodesById)).toBe('image-in');
    });

    it('should return original handleId if no alias exists', () => {
      expect(normalizeHandleId('node1', 'unknown-handle', 'source', nodesById)).toBe(
        'unknown-handle'
      );
      expect(normalizeHandleId('node2', 'any-handle', 'source', nodesById)).toBe('any-handle');
    });

    it('should handle empty nodesById', () => {
      expect(normalizeHandleId('node1', 'test', 'source', {})).toBe('test');
    });
  });

  describe('markEdgeGlows', () => {
    it('should return empty array for empty input', () => {
      expect(markEdgeGlows([])).toEqual([]);
    });

    it('should mark first edge with both glows', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const result = markEdgeGlows(edges);

      expect(result[0].data?.showSourceGlow).toBe(true);
      expect(result[0].data?.showTargetGlow).toBe(true);
    });

    it('should not mark duplicate source/target with glow', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'a', target: 'c', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const result = markEdgeGlows(edges);

      expect(result[0].data?.showSourceGlow).toBe(true);
      expect(result[0].data?.showTargetGlow).toBe(true);
      expect(result[1].data?.showSourceGlow).toBe(false); // Same source:sourceHandle
      expect(result[1].data?.showTargetGlow).toBe(true); // Different target:targetHandle
    });

    it('should preserve existing edge data', () => {
      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          sourceHandle: 'out',
          targetHandle: 'in',
          data: { isProcessing: true, edgeType: 'bezier' },
        },
      ];

      const result = markEdgeGlows(edges);

      expect(result[0].data?.isProcessing).toBe(true);
      expect(result[0].data?.edgeType).toBe('bezier');
      expect(result[0].data?.showSourceGlow).toBe(true);
    });

    it('should handle different handles on same nodes', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'out1', targetHandle: 'in1' },
        { id: 'e2', source: 'a', target: 'b', sourceHandle: 'out2', targetHandle: 'in2' },
      ];

      const result = markEdgeGlows(edges);

      expect(result[0].data?.showSourceGlow).toBe(true);
      expect(result[0].data?.showTargetGlow).toBe(true);
      expect(result[1].data?.showSourceGlow).toBe(true); // Different sourceHandle
      expect(result[1].data?.showTargetGlow).toBe(true); // Different targetHandle
    });
  });

  describe('prepareEdges', () => {
    const mockNodes: Node[] = [
      { id: 'node1', type: 'imageNode', position: { x: 0, y: 0 }, data: {} },
      { id: 'node2', type: 'textNode', position: { x: 100, y: 0 }, data: {} },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty array for empty edges', () => {
      expect(prepareEdges([], mockNodes)).toEqual([]);
    });

    it('should process edges with custom type', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node1', target: 'node2', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const result = prepareEdges(edges, mockNodes);

      expect(result[0].type).toBe('custom');
      expect(result[0].animated).toBe(false);
      expect(result[0].data?.isProcessing).toBe(false);
    });

    it('should generate consistent edge IDs', () => {
      const edges: Edge[] = [
        { id: 'old-id', source: 'node1', target: 'node2', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const result = prepareEdges(edges, mockNodes);

      expect(result[0].id).toBe('enode1-out-node2-in');
    });

    it('should handle undefined edges parameter', () => {
      expect(prepareEdges(undefined, mockNodes)).toEqual([]);
    });

    it('should handle undefined nodes parameter', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node1', target: 'node2', sourceHandle: 'out', targetHandle: 'in' },
      ];

      // Should not throw
      expect(() => prepareEdges(edges, undefined)).not.toThrow();
    });

    it('should populate validationErrorsRef when validation errors occur', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node1', target: 'node2', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const validationErrorsRef = { current: [] as any[] };

      // Mock validateEdges to return some validation errors
      (validateEdges as any).mockReturnValueOnce({
        validEdges: edges,
        validationErrors: [{ message: 'Test error', edgeId: 'e1' }],
      });

      prepareEdges(edges, mockNodes, validationErrorsRef);

      expect(validationErrorsRef.current).toContainEqual({ message: 'Test error', edgeId: 'e1' });
    });

    it('should append to existing validation errors', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node1', target: 'node2', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const validationErrorsRef = { current: [{ message: 'Existing error' }] as any[] };

      (validateEdges as any).mockReturnValueOnce({
        validEdges: edges,
        validationErrors: [{ message: 'New error' }],
      });

      prepareEdges(edges, mockNodes, validationErrorsRef);

      expect(validationErrorsRef.current).toHaveLength(2);
      expect(validationErrorsRef.current).toContainEqual({ message: 'Existing error' });
      expect(validationErrorsRef.current).toContainEqual({ message: 'New error' });
    });

    it('should handle null current in validationErrorsRef', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node1', target: 'node2', sourceHandle: 'out', targetHandle: 'in' },
      ];

      const validationErrorsRef = { current: null as any };

      (validateEdges as any).mockReturnValueOnce({
        validEdges: edges,
        validationErrors: [{ message: 'Test error' }],
      });

      prepareEdges(edges, mockNodes, validationErrorsRef);

      // Should still work and include the new error
      expect(validationErrorsRef.current).toContainEqual({ message: 'Test error' });
    });
  });

  describe('persistOutputToLocal', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return url unchanged for text output type', async () => {
      const result = await persistOutputToLocal('https://example.com/text', 'text', 'node1');
      expect(result).toBe('https://example.com/text');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should return url unchanged for non-http url', async () => {
      const result = await persistOutputToLocal('/local/path/image.png', 'image', 'node1');
      expect(result).toBe('/local/path/image.png');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should return url unchanged for empty url', async () => {
      const result = await persistOutputToLocal('', 'image', 'node1');
      expect(result).toBe('');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should download and save image file', async () => {
      (invoke as any).mockResolvedValueOnce('/saved/path/image.png');

      const result = await persistOutputToLocal('https://example.com/image.png', 'image', 'node1');

      expect(invoke).toHaveBeenCalledWith('download_and_save_file', {
        url: 'https://example.com/image.png',
        filename: expect.stringMatching(/^noder-image-\d+\.png$/),
        destinationFolder: null,
      });
      expect(result).toBe('/saved/path/image.png');
    });

    it('should download and save video file', async () => {
      (invoke as any).mockResolvedValueOnce('/saved/path/video.mp4');

      const result = await persistOutputToLocal('https://example.com/video.mp4', 'video', 'node1');

      expect(invoke).toHaveBeenCalledWith('download_and_save_file', {
        url: 'https://example.com/video.mp4',
        filename: expect.stringMatching(/^noder-video-\d+\.mp4$/),
        destinationFolder: null,
      });
      expect(result).toBe('/saved/path/video.mp4');
    });

    it('should download and save audio file', async () => {
      (invoke as any).mockResolvedValueOnce('/saved/path/audio.mp3');

      const result = await persistOutputToLocal('https://example.com/audio.mp3', 'audio', 'node1');

      expect(invoke).toHaveBeenCalledWith('download_and_save_file', {
        url: 'https://example.com/audio.mp3',
        filename: expect.stringMatching(/^noder-audio-\d+\.mp3$/),
        destinationFolder: null,
      });
      expect(result).toBe('/saved/path/audio.mp3');
    });

    it('should use bin extension for unknown output type', async () => {
      (invoke as any).mockResolvedValueOnce('/saved/path/file.bin');

      const result = await persistOutputToLocal('https://example.com/data', 'unknown', 'node1');

      expect(invoke).toHaveBeenCalledWith('download_and_save_file', {
        url: 'https://example.com/data',
        filename: expect.stringMatching(/^noder-unknown-\d+\.bin$/),
        destinationFolder: null,
      });
      expect(result).toBe('/saved/path/file.bin');
    });

    it('should return original url on download error', async () => {
      (invoke as any).mockRejectedValueOnce(new Error('Download failed'));

      const result = await persistOutputToLocal('https://example.com/image.png', 'image', 'node1');

      expect(result).toBe('https://example.com/image.png');
    });

    it('should handle https urls', async () => {
      (invoke as any).mockResolvedValueOnce('/saved/path/image.png');

      await persistOutputToLocal('https://example.com/image.png', 'image', 'node1');

      expect(invoke).toHaveBeenCalled();
    });

    it('should handle http urls', async () => {
      (invoke as any).mockResolvedValueOnce('/saved/path/image.png');

      await persistOutputToLocal('http://example.com/image.png', 'image', 'node1');

      expect(invoke).toHaveBeenCalled();
    });
  });

  describe('getPrimaryOutput', () => {
    it('should return null for null/undefined input', () => {
      expect(getPrimaryOutput(null)).toBeNull();
      expect(getPrimaryOutput(undefined)).toBeNull();
    });

    it('should return null for non-object input', () => {
      expect(getPrimaryOutput('string')).toBeNull();
      expect(getPrimaryOutput(123)).toBeNull();
      expect(getPrimaryOutput(true)).toBeNull();
    });

    it('should extract output from "out" property', () => {
      const output = {
        out: { type: 'image', value: 'https://example.com/image.png' },
      };

      const result = getPrimaryOutput(output);

      expect(result).toEqual({ type: 'image', value: 'https://example.com/image.png' });
    });

    it('should extract output with metadata', () => {
      const output = {
        out: {
          type: 'image',
          value: 'https://example.com/image.png',
          metadata: { model: 'flux-2-klein-4b' },
        },
      };

      const result = getPrimaryOutput(output);

      expect(result?.metadata?.model).toBe('flux-2-klein-4b');
    });

    it('should fallback to image-out', () => {
      const output = {
        'image-out': { type: 'image', value: 'https://example.com/image.png' },
      };

      const result = getPrimaryOutput(output);

      expect(result).toEqual({ type: 'image', value: 'https://example.com/image.png' });
    });

    it('should fallback to video-out', () => {
      const output = {
        'video-out': { type: 'video', value: 'https://example.com/video.mp4' },
      };

      const result = getPrimaryOutput(output);

      expect(result).toEqual({ type: 'video', value: 'https://example.com/video.mp4' });
    });

    it('should fallback to audio-out', () => {
      const output = {
        'audio-out': { type: 'audio', value: 'https://example.com/audio.mp3' },
      };

      const result = getPrimaryOutput(output);

      expect(result).toEqual({ type: 'audio', value: 'https://example.com/audio.mp3' });
    });

    it('should fallback to text-out', () => {
      const output = {
        'text-out': { type: 'text', value: 'Hello world' },
      };

      const result = getPrimaryOutput(output);

      expect(result).toEqual({ type: 'text', value: 'Hello world' });
    });

    it('should return null if no valid output found', () => {
      const output = {
        'unknown-key': { type: 'text', value: 'test' },
      };

      expect(getPrimaryOutput(output)).toBeNull();
    });

    it('should prefer "out" over fallback keys', () => {
      const output = {
        out: { type: 'image', value: 'primary' },
        'image-out': { type: 'image', value: 'fallback' },
      };

      const result = getPrimaryOutput(output);

      expect(result?.value).toBe('primary');
    });

    it('should return null if out property exists but has no value', () => {
      const output = {
        out: { type: 'image' }, // no value property
      };

      expect(getPrimaryOutput(output)).toBeNull();
    });
  });

  describe('isImageFile', () => {
    it('should return true for jpg files', () => {
      expect(isImageFile('image.jpg')).toBe(true);
      expect(isImageFile('IMAGE.JPG')).toBe(true);
    });

    it('should return true for jpeg files', () => {
      expect(isImageFile('image.jpeg')).toBe(true);
      expect(isImageFile('photo.JPEG')).toBe(true);
    });

    it('should return true for png files', () => {
      expect(isImageFile('screenshot.png')).toBe(true);
      expect(isImageFile('icon.PNG')).toBe(true);
    });

    it('should return true for gif files', () => {
      expect(isImageFile('animation.gif')).toBe(true);
    });

    it('should return true for webp files', () => {
      expect(isImageFile('modern.webp')).toBe(true);
    });

    it('should return true for bmp files', () => {
      expect(isImageFile('bitmap.bmp')).toBe(true);
    });

    it('should return true for svg files', () => {
      expect(isImageFile('vector.svg')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile('document.pdf')).toBe(false);
      expect(isImageFile('video.mp4')).toBe(false);
      expect(isImageFile('audio.mp3')).toBe(false);
      expect(isImageFile('data.json')).toBe(false);
      expect(isImageFile('script.js')).toBe(false);
    });

    it('should return false for files without extension', () => {
      expect(isImageFile('noextension')).toBe(false);
    });

    it('should handle filenames with multiple dots', () => {
      expect(isImageFile('my.photo.2024.jpg')).toBe(true);
      expect(isImageFile('file.backup.txt')).toBe(false);
    });

    it('should handle paths with directories', () => {
      expect(isImageFile('/path/to/image.png')).toBe(true);
      expect(isImageFile('C:\\Users\\Photos\\pic.jpg')).toBe(true);
    });
  });

  describe('getOutputTypeFromNodeType', () => {
    it('should return "image" for upscaler node', () => {
      expect(getOutputTypeFromNodeType('upscaler')).toBe('image');
    });

    it('should return "image" for nodes containing "image"', () => {
      expect(getOutputTypeFromNodeType('imageNode')).toBe('image');
      expect(getOutputTypeFromNodeType('image-generator')).toBe('image');
      expect(getOutputTypeFromNodeType('my-image-node')).toBe('image');
    });

    it('should return "video" for nodes containing "video"', () => {
      expect(getOutputTypeFromNodeType('videoNode')).toBe('video');
      expect(getOutputTypeFromNodeType('video-generator')).toBe('video');
      expect(getOutputTypeFromNodeType('my-video-node')).toBe('video');
    });

    it('should return "audio" for nodes containing "audio"', () => {
      expect(getOutputTypeFromNodeType('audioNode')).toBe('audio');
      expect(getOutputTypeFromNodeType('audio-generator')).toBe('audio');
      expect(getOutputTypeFromNodeType('my-audio-node')).toBe('audio');
    });

    it('should return "text" for other node types', () => {
      expect(getOutputTypeFromNodeType('textNode')).toBe('text');
      expect(getOutputTypeFromNodeType('chat')).toBe('text');
      expect(getOutputTypeFromNodeType('markdown')).toBe('text');
      expect(getOutputTypeFromNodeType('unknown')).toBe('text');
    });

    it('should prioritize image over video if both present', () => {
      // Contains both "image" and "video"
      expect(getOutputTypeFromNodeType('image-to-video')).toBe('image');
    });
  });
});
