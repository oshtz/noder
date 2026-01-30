/**
 * Tests for replicateSchemaCache utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  fetchModelSchema,
  getInputMapping,
  getOutputType,
  buildReplicateInput,
  clearSchemaCache,
  getCachedSchema,
} from './replicateSchemaCache';

describe('replicateSchemaCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSchemaCache();
  });

  describe('fetchModelSchema', () => {
    it('should fetch and normalize model schema', async () => {
      const mockModelData = {
        latest_version: {
          openapi_schema: {
            components: {
              schemas: {
                Input: {
                  properties: {
                    prompt: { type: 'string', description: 'Text prompt' },
                    width: { type: 'integer', default: 512 },
                  },
                  required: ['prompt'],
                },
                Output: {
                  type: 'array',
                  items: { format: 'uri' },
                },
              },
            },
          },
        },
      };

      invoke.mockResolvedValueOnce(mockModelData);

      const schema = await fetchModelSchema('owner/model-name');

      expect(invoke).toHaveBeenCalledWith('replicate_get_model', {
        owner: 'owner',
        modelName: 'model-name',
      });

      expect(schema.modelId).toBe('owner/model-name');
      expect(schema.inputs.prompt.type).toBe('string');
      expect(schema.inputs.prompt.required).toBe(true);
      expect(schema.inputs.width.default).toBe(512);
      expect(schema.outputs.type).toBe('array');
    });

    it('should handle model ID with version', async () => {
      const mockModelData = {
        latest_version: {
          openapi_schema: {
            components: {
              schemas: {
                Input: { properties: {} },
                Output: { type: 'string' },
              },
            },
          },
        },
      };

      invoke.mockResolvedValueOnce(mockModelData);

      await fetchModelSchema('owner/model-name:version-hash');

      expect(invoke).toHaveBeenCalledWith('replicate_get_model', {
        owner: 'owner',
        modelName: 'model-name',
      });
    });

    it('should use cached schema on subsequent calls', async () => {
      const mockModelData = {
        latest_version: {
          openapi_schema: {
            components: {
              schemas: {
                Input: { properties: {} },
                Output: { type: 'string' },
              },
            },
          },
        },
      };

      invoke.mockResolvedValueOnce(mockModelData);

      await fetchModelSchema('owner/model');
      await fetchModelSchema('owner/model');

      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid model ID', async () => {
      await expect(fetchModelSchema('invalid')).rejects.toThrow('Invalid model ID format');
    });

    it('should throw when no schema found', async () => {
      invoke.mockResolvedValueOnce({ latest_version: null });

      await expect(fetchModelSchema('owner/model')).rejects.toThrow('No schema found');
    });

    it('should resolve allOf references', async () => {
      const mockModelData = {
        latest_version: {
          openapi_schema: {
            components: {
              schemas: {
                aspect_ratio: {
                  type: 'string',
                  enum: ['1:1', '16:9', '9:16'],
                },
                Input: {
                  properties: {
                    ratio: {
                      allOf: [{ $ref: '#/components/schemas/aspect_ratio' }],
                      description: 'Aspect ratio',
                    },
                  },
                  required: [],
                },
                Output: { type: 'string' },
              },
            },
          },
        },
      };

      invoke.mockResolvedValueOnce(mockModelData);

      const schema = await fetchModelSchema('owner/model');

      expect(schema.inputs.ratio.type).toBe('string');
      expect(schema.inputs.ratio.enum).toEqual(['1:1', '16:9', '9:16']);
    });
  });

  describe('getInputMapping', () => {
    it('should map text prompt fields', () => {
      const schema = {
        inputs: {
          prompt: { type: 'string' },
          negative_prompt: { type: 'string' },
          text: { type: 'string' },
          description: { type: 'string' },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.text).toContain('prompt');
      expect(mapping.text).toContain('text');
      expect(mapping.text).toContain('description');
    });

    it('should map image URI fields', () => {
      const schema = {
        inputs: {
          image: { type: 'string', format: 'uri' },
          image_path: { type: 'string', format: 'data-uri' },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.image).toHaveLength(2);
      expect(mapping.image[0].field).toBe('image');
      expect(mapping.image[0].isArray).toBe(false);
    });

    it('should map array image fields', () => {
      const schema = {
        inputs: {
          images: {
            type: 'array',
            items: { format: 'uri' },
            contentMediaType: 'image/png',
          },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.image).toHaveLength(1);
      expect(mapping.image[0].field).toBe('images');
      expect(mapping.image[0].isArray).toBe(true);
    });

    it('should detect mask fields', () => {
      const schema = {
        inputs: {
          mask: { type: 'string', format: 'uri' },
          mask_image: { type: 'string', format: 'uri' },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.mask).toHaveLength(2);
    });

    it('should classify image fields based on mask presence', () => {
      // Without mask - img2img
      const schemaNoMask = {
        inputs: {
          image: { type: 'string', format: 'uri' },
        },
      };

      const mappingNoMask = getInputMapping(schemaNoMask);
      expect(mappingNoMask.image[0].role).toBe('img2img');

      // With mask - primary
      const schemaWithMask = {
        inputs: {
          image: { type: 'string', format: 'uri' },
          mask: { type: 'string', format: 'uri' },
        },
      };

      const mappingWithMask = getInputMapping(schemaWithMask);
      const imageField = mappingWithMask.image.find((f) => f.field === 'image');
      expect(imageField.role).toBe('primary');
    });

    it('should detect style reference fields', () => {
      const schema = {
        inputs: {
          style_image: { type: 'string', format: 'uri' },
          reference_img: { type: 'string', format: 'uri' },
        },
      };

      const mapping = getInputMapping(schema);

      const styleField = mapping.image.find((f) => f.field === 'style_image');
      const refField = mapping.image.find((f) => f.field === 'reference_img');

      expect(styleField.role).toBe('style_reference');
      expect(refField.role).toBe('style_reference');
    });

    it('should map video fields', () => {
      const schema = {
        inputs: {
          video: { type: 'string', format: 'uri', contentMediaType: 'video/mp4' },
          video_url: { type: 'string', format: 'uri' },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.video.length).toBeGreaterThanOrEqual(1);
    });

    it('should map audio fields', () => {
      const schema = {
        inputs: {
          audio: { type: 'string', format: 'uri', contentMediaType: 'audio/mpeg' },
          audio_file: { type: 'string', format: 'uri' },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.audio.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle anyOf/oneOf definitions', () => {
      const schema = {
        inputs: {
          image: {
            anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }],
          },
        },
      };

      const mapping = getInputMapping(schema);

      expect(mapping.image).toHaveLength(1);
    });
  });

  describe('getOutputType', () => {
    it('should detect image output (array of URIs)', () => {
      const schema = {
        outputs: {
          type: 'array',
          items: { format: 'uri' },
        },
      };

      expect(getOutputType(schema)).toBe('image');
    });

    it('should detect image output (single URI)', () => {
      const schema = {
        outputs: {
          format: 'uri',
        },
      };

      expect(getOutputType(schema)).toBe('image');
    });

    it('should detect text output', () => {
      const schema = {
        outputs: {
          type: 'string',
        },
      };

      expect(getOutputType(schema)).toBe('text');
    });

    it('should return unknown for unrecognized output', () => {
      const schema = {
        outputs: {
          type: 'object',
        },
      };

      expect(getOutputType(schema)).toBe('unknown');
    });
  });

  describe('buildReplicateInput', () => {
    it('should map connected text inputs to prompt fields', () => {
      const schema = {
        inputs: {
          prompt: { type: 'string' },
          width: { type: 'integer', default: 512 },
        },
      };

      const connectedInputs = {
        text: ['A beautiful sunset'],
        image: [],
      };

      const input = buildReplicateInput(schema, connectedInputs, {});

      expect(input.prompt).toBe('A beautiful sunset');
    });

    it('should use node data prompt when no connected text', () => {
      const schema = {
        inputs: {
          prompt: { type: 'string' },
        },
      };

      const connectedInputs = { text: [], image: [] };
      const nodeData = { prompt: 'Node prompt' };

      const input = buildReplicateInput(schema, connectedInputs, nodeData);

      expect(input.prompt).toBe('Node prompt');
    });

    it('should map connected images to image fields', () => {
      const schema = {
        inputs: {
          image: { type: 'string', format: 'uri' },
        },
      };

      const connectedInputs = {
        text: [],
        image: ['https://example.com/img.png'],
      };

      const input = buildReplicateInput(schema, connectedInputs, {});

      expect(input.image).toBe('https://example.com/img.png');
    });

    it('should map array of images to array fields', () => {
      const schema = {
        inputs: {
          images: {
            type: 'array',
            items: { format: 'uri' },
          },
        },
      };

      const connectedInputs = {
        text: [],
        image: ['https://example.com/1.png', 'https://example.com/2.png'],
      };

      const input = buildReplicateInput(schema, connectedInputs, {});

      expect(input.images).toEqual(['https://example.com/1.png', 'https://example.com/2.png']);
    });

    it('should add node settings from nodeData', () => {
      const schema = {
        inputs: {
          width: { type: 'integer' },
          height: { type: 'integer' },
          steps: { type: 'integer', default: 20 },
        },
      };

      const connectedInputs = { text: [], image: [] };
      const nodeData = { width: 1024, height: 768 };

      const input = buildReplicateInput(schema, connectedInputs, nodeData);

      expect(input.width).toBe(1024);
      expect(input.height).toBe(768);
      expect(input.steps).toBe(20); // default value
    });

    it('should handle camelCase to snake_case field mapping', () => {
      const schema = {
        inputs: {
          num_steps: { type: 'integer' },
          cfg_scale: { type: 'number' },
        },
      };

      const connectedInputs = { text: [], image: [] };
      const nodeData = { numSteps: 30, cfgScale: 7.5 };

      const input = buildReplicateInput(schema, connectedInputs, nodeData);

      expect(input.num_steps).toBe(30);
      expect(input.cfg_scale).toBe(7.5);
    });

    it('should map video inputs', () => {
      const schema = {
        inputs: {
          video: { type: 'string', format: 'uri', contentMediaType: 'video/mp4' },
        },
      };

      const connectedInputs = {
        text: [],
        image: [],
        video: ['https://example.com/video.mp4'],
      };

      const input = buildReplicateInput(schema, connectedInputs, {});

      expect(input.video).toBe('https://example.com/video.mp4');
    });

    it('should map audio inputs', () => {
      const schema = {
        inputs: {
          audio: { type: 'string', format: 'uri', contentMediaType: 'audio/mpeg' },
        },
      };

      const connectedInputs = {
        text: [],
        image: [],
        audio: ['https://example.com/audio.mp3'],
      };

      const input = buildReplicateInput(schema, connectedInputs, {});

      expect(input.audio).toBe('https://example.com/audio.mp3');
    });

    it('should not override connected inputs with node data', () => {
      const schema = {
        inputs: {
          prompt: { type: 'string' },
        },
      };

      const connectedInputs = {
        text: ['Connected prompt'],
        image: [],
      };
      const nodeData = { prompt: 'Node prompt' };

      const input = buildReplicateInput(schema, connectedInputs, nodeData);

      expect(input.prompt).toBe('Connected prompt');
    });
  });

  describe('clearSchemaCache', () => {
    it('should clear the cache', async () => {
      const mockModelData = {
        latest_version: {
          openapi_schema: {
            components: {
              schemas: {
                Input: { properties: {} },
                Output: { type: 'string' },
              },
            },
          },
        },
      };

      invoke.mockResolvedValue(mockModelData);

      await fetchModelSchema('owner/model');
      expect(getCachedSchema('owner/model')).toBeDefined();

      clearSchemaCache();
      expect(getCachedSchema('owner/model')).toBeUndefined();
    });
  });

  describe('getCachedSchema', () => {
    it('should return undefined for uncached model', () => {
      expect(getCachedSchema('owner/model')).toBeUndefined();
    });

    it('should return cached schema', async () => {
      const mockModelData = {
        latest_version: {
          openapi_schema: {
            components: {
              schemas: {
                Input: { properties: { prompt: { type: 'string' } } },
                Output: { type: 'string' },
              },
            },
          },
        },
      };

      invoke.mockResolvedValueOnce(mockModelData);

      await fetchModelSchema('owner/model');
      const cached = getCachedSchema('owner/model');

      expect(cached).toBeDefined();
      expect(cached.inputs.prompt).toBeDefined();
    });
  });
});
