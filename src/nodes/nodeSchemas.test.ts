/**
 * Tests for nodeSchemas
 */

import { describe, it, expect } from 'vitest';
import { NODE_SCHEMAS, getNodeSchema, parseNodeData, type NodeType } from './nodeSchemas';

describe('nodeSchemas', () => {
  describe('NODE_SCHEMAS', () => {
    it('contains all expected node types', () => {
      const expectedTypes: NodeType[] = [
        'text',
        'image',
        'upscaler',
        'video',
        'audio',
        'chip',
        'media',
      ];

      expectedTypes.forEach((type) => {
        expect(NODE_SCHEMAS[type]).toBeDefined();
        expect(NODE_SCHEMAS[type].type).toBe(type);
      });
    });

    it('has titles for all node types', () => {
      expect(NODE_SCHEMAS.text.title).toBe('Text (LLM)');
      expect(NODE_SCHEMAS.image.title).toBe('Image Generation');
      expect(NODE_SCHEMAS.upscaler.title).toBe('Upscaler');
      expect(NODE_SCHEMAS.video.title).toBe('Video');
      expect(NODE_SCHEMAS.audio.title).toBe('Audio');
      expect(NODE_SCHEMAS.chip.title).toBe('Chip');
      expect(NODE_SCHEMAS.media.title).toBe('Media');
    });

    it('has zod schema for validation', () => {
      Object.values(NODE_SCHEMAS).forEach((schema) => {
        expect(schema.zod).toBeDefined();
        expect(typeof schema.zod.safeParse).toBe('function');
      });
    });

    it('has defaults for all schemas', () => {
      Object.values(NODE_SCHEMAS).forEach((schema) => {
        expect(schema.defaults).toBeDefined();
        expect(typeof schema.defaults).toBe('object');
      });
    });
  });

  describe('text schema', () => {
    const textSchema = NODE_SCHEMAS.text;

    it('has correct fields', () => {
      const fieldKeys = textSchema.fields.map((f) => f.key);
      expect(fieldKeys).toContain('model');
      expect(fieldKeys).toContain('prompt');
      expect(fieldKeys).toContain('systemPrompt');
      expect(fieldKeys).toContain('temperature');
      expect(fieldKeys).toContain('maxTokens');
    });

    it('has correct default model', () => {
      expect(textSchema.defaults.model).toBe('openai/gpt-4o-mini');
    });

    it('validates temperature range', () => {
      const result = textSchema.zod.safeParse({ temperature: 0.5 });
      expect(result.success).toBe(true);

      const invalidResult = textSchema.zod.safeParse({ temperature: 3 });
      expect(invalidResult.success).toBe(false);
    });

    it('has input and output handles', () => {
      const handleIds = textSchema.handles.map((h) => h.id);
      expect(handleIds).toContain('in');
      expect(handleIds).toContain('out');
    });
  });

  describe('image schema', () => {
    const imageSchema = NODE_SCHEMAS.image;

    it('has correct fields', () => {
      const fieldKeys = imageSchema.fields.map((f) => f.key);
      expect(fieldKeys).toContain('model');
      expect(fieldKeys).toContain('prompt');
      expect(fieldKeys).toContain('negativePrompt');
      expect(fieldKeys).toContain('width');
      expect(fieldKeys).toContain('height');
      expect(fieldKeys).toContain('numOutputs');
    });

    it('has correct default dimensions', () => {
      expect(imageSchema.defaults.width).toBe(1024);
      expect(imageSchema.defaults.height).toBe(1024);
    });

    it('validates dimension range', () => {
      const result = imageSchema.zod.safeParse({ width: 512, height: 512 });
      expect(result.success).toBe(true);

      const invalidResult = imageSchema.zod.safeParse({ width: 100 });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('video schema', () => {
    const videoSchema = NODE_SCHEMAS.video;

    it('has single unified input handle that accepts any type', () => {
      const targetHandles = videoSchema.handles.filter((h) => h.type === 'target');
      expect(targetHandles.length).toBe(1);
      expect(targetHandles[0].id).toBe('in');
      expect(targetHandles[0].dataType).toBe('any'); // Accepts text, image, or video
    });

    it('has video output handle', () => {
      const sourceHandles = videoSchema.handles.filter((h) => h.type === 'source');
      expect(sourceHandles.length).toBe(1);
      expect(sourceHandles[0].id).toBe('video-out');
    });
  });

  describe('chip schema', () => {
    const chipSchema = NODE_SCHEMAS.chip;

    it('has input and output handles', () => {
      const targetHandles = chipSchema.handles.filter((h) => h.type === 'target');
      const sourceHandles = chipSchema.handles.filter((h) => h.type === 'source');

      expect(targetHandles.length).toBe(1);
      expect(targetHandles[0].id).toBe('in');
      expect(targetHandles[0].dataType).toBe('text');

      expect(sourceHandles.length).toBe(1);
      expect(sourceHandles[0].id).toBe('out');
      expect(sourceHandles[0].dataType).toBe('text');
    });

    it('has content and chipId fields', () => {
      const fieldKeys = chipSchema.fields.map((f) => f.key);
      expect(fieldKeys).toContain('content');
      expect(fieldKeys).toContain('chipId');
    });
  });

  describe('media schema', () => {
    const mediaSchema = NODE_SCHEMAS.media;

    it('has mediaType select field', () => {
      const mediaTypeField = mediaSchema.fields.find((f) => f.key === 'mediaType');
      expect(mediaTypeField).toBeDefined();
      expect(mediaTypeField?.type).toBe('select');
    });

    it('has correct media type options', () => {
      const mediaTypeField = mediaSchema.fields.find((f) => f.key === 'mediaType') as any;
      expect(mediaTypeField?.options).toContain('image');
      expect(mediaTypeField?.options).toContain('video');
      expect(mediaTypeField?.options).toContain('audio');
    });
  });

  describe('getNodeSchema', () => {
    it('returns schema for valid node type', () => {
      const schema = getNodeSchema('text');
      expect(schema).toBe(NODE_SCHEMAS.text);
    });

    it('returns undefined for invalid node type', () => {
      const schema = getNodeSchema('nonexistent');
      expect(schema).toBeUndefined();
    });

    it('works with all node types', () => {
      const types: NodeType[] = ['text', 'image', 'upscaler', 'video', 'audio', 'chip', 'media'];
      types.forEach((type) => {
        const schema = getNodeSchema(type);
        expect(schema).toBeDefined();
        expect(schema?.type).toBe(type);
      });
    });
  });

  describe('parseNodeData', () => {
    it('returns defaults when no data provided', () => {
      const schema = NODE_SCHEMAS.text;
      const result = parseNodeData(schema);

      expect(result.model).toBe('openai/gpt-4o-mini');
      expect(result.prompt).toBe('');
      expect(result.temperature).toBe(0.7);
    });

    it('merges provided data with defaults', () => {
      const schema = NODE_SCHEMAS.text;
      const result = parseNodeData(schema, {
        prompt: 'Custom prompt',
        temperature: 0.5,
      });

      expect(result.prompt).toBe('Custom prompt');
      expect(result.temperature).toBe(0.5);
      expect(result.model).toBe('openai/gpt-4o-mini'); // default preserved
    });

    it('validates and returns defaults for invalid data', () => {
      const schema = NODE_SCHEMAS.image;
      const result = parseNodeData(schema, {
        width: 'invalid', // should be number
      });

      // Should fall back to defaults when validation fails
      expect(typeof result.width).toBe('number');
    });

    it('handles null and undefined data', () => {
      const schema = NODE_SCHEMAS.chip;

      const nullResult = parseNodeData(schema, null);
      expect(nullResult).toBeDefined();

      const undefinedResult = parseNodeData(schema, undefined);
      expect(undefinedResult).toBeDefined();
    });

    it('ignores null/undefined values in data', () => {
      const schema = NODE_SCHEMAS.text;
      const result = parseNodeData(schema, {
        prompt: 'Set value',
        temperature: null,
        maxTokens: undefined,
      });

      expect(result.prompt).toBe('Set value');
      expect(result.temperature).toBe(0.7); // default, not null
      expect(result.maxTokens).toBe(512); // default, not undefined
    });

    it('preserves unknown fields with passthrough', () => {
      const schema = NODE_SCHEMAS.image;
      const result = parseNodeData(schema, {
        aspect_ratio: '16:9', // field not in schema definition
        prompt: 'Test',
      });

      // With passthrough(), unknown fields should be preserved
      expect(result.aspect_ratio).toBe('16:9');
    });
  });

  describe('field types', () => {
    it('correctly identifies text fields', () => {
      const textFields = NODE_SCHEMAS.text.fields.filter(
        (f) => f.type === 'text' || f.type === 'textarea'
      );
      expect(textFields.length).toBeGreaterThan(0);
    });

    it('correctly identifies number/slider fields', () => {
      const numberFields = NODE_SCHEMAS.text.fields.filter(
        (f) => f.type === 'number' || f.type === 'slider'
      );
      expect(numberFields.length).toBeGreaterThan(0);
    });

    it('correctly identifies select fields', () => {
      const selectFields = NODE_SCHEMAS.media.fields.filter((f) => f.type === 'select');
      expect(selectFields.length).toBeGreaterThan(0);
    });
  });

  describe('zod validation', () => {
    it('coerces empty string to number default', () => {
      const schema = NODE_SCHEMAS.image;
      const result = schema.zod.safeParse({ width: '' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.width).toBe(1024); // default value
      }
    });

    it('coerces string numbers to numbers', () => {
      const schema = NODE_SCHEMAS.image;
      const result = schema.zod.safeParse({ width: '512' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.width).toBe(512);
      }
    });

    it('validates select field options', () => {
      const schema = NODE_SCHEMAS.media;
      const validResult = schema.zod.safeParse({ mediaType: 'image' });
      expect(validResult.success).toBe(true);

      const invalidResult = schema.zod.safeParse({ mediaType: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('handle definitions', () => {
    it('all handles have required properties', () => {
      Object.values(NODE_SCHEMAS).forEach((schema) => {
        schema.handles.forEach((handle) => {
          expect(handle.id).toBeDefined();
          expect(handle.type).toMatch(/^(source|target)$/);
          expect(handle.position).toBeDefined();
          expect(handle.dataType).toBeDefined();
        });
      });
    });

    it('upscaler uses IMAGE data type', () => {
      const upscalerSchema = NODE_SCHEMAS.upscaler;
      expect(upscalerSchema.handles[0].dataType).toBe('image');
      expect(upscalerSchema.handles[1].dataType).toBe('image');
    });
  });
});
