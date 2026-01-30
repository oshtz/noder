import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toTitleCase,
  shouldUseTextarea,
  buildDynamicFieldsFromSchema,
  mergeDefinitionFields,
  type SchemaInputField,
  type ModelSchema,
  type DynamicField,
} from './schemaFieldBuilder';

// Mock console.log to avoid noise in tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// =============================================================================
// toTitleCase Tests
// =============================================================================

describe('schemaFieldBuilder', () => {
  describe('toTitleCase', () => {
    it('should convert snake_case to Title Case', () => {
      expect(toTitleCase('hello_world')).toBe('Hello World');
      expect(toTitleCase('foo_bar_baz')).toBe('Foo Bar Baz');
    });

    it('should convert kebab-case to Title Case', () => {
      expect(toTitleCase('hello-world')).toBe('Hello World');
      expect(toTitleCase('foo-bar-baz')).toBe('Foo Bar Baz');
    });

    it('should capitalize single words', () => {
      expect(toTitleCase('hello')).toBe('Hello');
      expect(toTitleCase('world')).toBe('World');
    });

    it('should handle multiple underscores/hyphens', () => {
      expect(toTitleCase('foo__bar')).toBe('Foo Bar');
      expect(toTitleCase('foo--bar')).toBe('Foo Bar');
      expect(toTitleCase('foo_-_bar')).toBe('Foo Bar');
    });

    it('should handle already capitalized words', () => {
      expect(toTitleCase('HelloWorld')).toBe('HelloWorld');
      expect(toTitleCase('Hello_World')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(toTitleCase('')).toBe('');
    });
  });

  // =============================================================================
  // shouldUseTextarea Tests
  // =============================================================================

  describe('shouldUseTextarea', () => {
    it('should return true for prompt fields', () => {
      expect(shouldUseTextarea('prompt', null)).toBe(true);
      expect(shouldUseTextarea('negative_prompt', null)).toBe(true);
      expect(shouldUseTextarea('text_prompt', null)).toBe(true);
      expect(shouldUseTextarea('PROMPT', null)).toBe(true);
    });

    it('should return true for description fields', () => {
      expect(shouldUseTextarea('description', null)).toBe(true);
      expect(shouldUseTextarea('image_description', null)).toBe(true);
      expect(shouldUseTextarea('DESCRIPTION', null)).toBe(true);
    });

    it('should return true for caption fields', () => {
      expect(shouldUseTextarea('caption', null)).toBe(true);
      expect(shouldUseTextarea('image_caption', null)).toBe(true);
      expect(shouldUseTextarea('CAPTION', null)).toBe(true);
    });

    it('should return true for strings with maxLength > 200', () => {
      const fieldDef: SchemaInputField = { type: 'string', maxLength: 500 };
      expect(shouldUseTextarea('some_field', fieldDef)).toBe(true);
    });

    it('should return false for strings with maxLength <= 200', () => {
      const fieldDef: SchemaInputField = { type: 'string', maxLength: 100 };
      expect(shouldUseTextarea('some_field', fieldDef)).toBe(false);
    });

    it('should return false for non-prompt string fields', () => {
      const fieldDef: SchemaInputField = { type: 'string' };
      expect(shouldUseTextarea('width', fieldDef)).toBe(false);
      expect(shouldUseTextarea('model', fieldDef)).toBe(false);
      expect(shouldUseTextarea('seed', fieldDef)).toBe(false);
    });

    it('should return false for null field definition', () => {
      expect(shouldUseTextarea('width', null)).toBe(false);
    });
  });

  // =============================================================================
  // buildDynamicFieldsFromSchema Tests
  // =============================================================================

  describe('buildDynamicFieldsFromSchema', () => {
    describe('basic field types', () => {
      it('should handle empty schema', () => {
        const schema: ModelSchema = {};
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toEqual([]);
      });

      it('should handle schema with no inputs', () => {
        const schema: ModelSchema = { inputs: undefined };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toEqual([]);
      });

      it('should create string field', () => {
        const schema: ModelSchema = {
          inputs: {
            name: { type: 'string', description: 'A name' },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'name',
          label: 'Name',
          type: 'text',
          help: 'A name',
        });
      });

      it('should create textarea for prompt fields', () => {
        const schema: ModelSchema = {
          inputs: {
            prompt: { type: 'string', description: 'The prompt' },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].type).toBe('textarea');
      });

      it('should create number field', () => {
        const schema: ModelSchema = {
          inputs: {
            width: {
              type: 'integer',
              minimum: 64,
              maximum: 2048,
              default: 512,
              description: 'Image width',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'width',
          label: 'Width',
          type: 'number',
          min: 64,
          max: 2048,
          default: 512,
        });
      });

      it('should create boolean field', () => {
        const schema: ModelSchema = {
          inputs: {
            enable_safety: {
              type: 'boolean',
              default: true,
              description: 'Enable safety filter',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'enable_safety',
          label: 'Enable Safety',
          type: 'boolean',
          default: true,
        });
      });

      it('should create select field for enum', () => {
        const schema: ModelSchema = {
          inputs: {
            aspect_ratio: {
              type: 'string',
              enum: ['1:1', '16:9', '9:16'],
              default: '1:1',
              description: 'Aspect ratio',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'aspect_ratio',
          label: 'Aspect Ratio',
          type: 'select',
          options: ['1:1', '16:9', '9:16'],
          default: '1:1',
        });
      });

      it('should detect number enum valueType', () => {
        const schema: ModelSchema = {
          inputs: {
            num_outputs: {
              type: 'integer',
              enum: [1, 2, 4],
              default: 1,
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].valueType).toBe('number');
      });

      it('should detect boolean enum valueType', () => {
        const schema: ModelSchema = {
          inputs: {
            flag: {
              type: 'string',
              enum: [true, false],
              default: true,
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].valueType).toBe('boolean');
      });
    });

    describe('media input fields', () => {
      it('should detect image field', () => {
        const schema: ModelSchema = {
          inputs: {
            image: {
              type: 'string',
              format: 'uri',
              description: 'Input image',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'image',
          type: 'media-input',
          mediaType: 'image',
        });
      });

      it('should detect mask field', () => {
        const schema: ModelSchema = {
          inputs: {
            mask: {
              type: 'string',
              format: 'uri',
              description: 'Mask image',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'mask',
          type: 'media-input',
          mediaType: 'mask',
        });
      });

      it('should detect video field', () => {
        const schema: ModelSchema = {
          inputs: {
            video: {
              type: 'string',
              format: 'uri',
              contentMediaType: 'video/mp4',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0]).toMatchObject({
          type: 'media-input',
          mediaType: 'video',
        });
      });

      it('should detect audio field', () => {
        const schema: ModelSchema = {
          inputs: {
            audio: {
              type: 'string',
              format: 'uri',
              contentMediaType: 'audio/wav',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0]).toMatchObject({
          type: 'media-input',
          mediaType: 'audio',
        });
      });

      it('should detect style_reference role', () => {
        const schema: ModelSchema = {
          inputs: {
            style_image: {
              type: 'string',
              format: 'uri',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].role).toBe('style_reference');
      });

      it('should detect reference role', () => {
        const schema: ModelSchema = {
          inputs: {
            reference_image: {
              type: 'string',
              format: 'uri',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].role).toBe('style_reference');
      });

      it('should set primary role when mask is present', () => {
        const schema: ModelSchema = {
          inputs: {
            image: {
              type: 'string',
              format: 'uri',
            },
            mask: {
              type: 'string',
              format: 'uri',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        const imageField = fields.find((f) => f.key === 'image');
        expect(imageField?.role).toBe('primary');
      });

      it('should set img2img role when no mask', () => {
        const schema: ModelSchema = {
          inputs: {
            input_image: {
              type: 'string',
              format: 'uri',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].role).toBe('img2img');
      });

      it('should detect array of images', () => {
        const schema: ModelSchema = {
          inputs: {
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
                contentMediaType: 'image/*',
              },
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0]).toMatchObject({
          type: 'media-input',
          mediaType: 'image',
          isArray: true,
        });
      });
    });

    describe('array fields', () => {
      it('should create textarea for string array', () => {
        const schema: ModelSchema = {
          inputs: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'tags',
          type: 'textarea',
          placeholder: 'Comma-separated values',
          valueType: 'array',
        });
      });

      it('should skip non-string arrays', () => {
        const schema: ModelSchema = {
          inputs: {
            numbers: {
              type: 'array',
              items: { type: 'integer' },
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(0);
      });
    });

    describe('field ordering', () => {
      it('should sort fields by order property', () => {
        const schema: ModelSchema = {
          inputs: {
            last: { type: 'string', order: 3 },
            first: { type: 'string', order: 1 },
            middle: { type: 'string', order: 2 },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields.map((f) => f.key)).toEqual(['first', 'middle', 'last']);
      });

      it('should use 999 as default order', () => {
        const schema: ModelSchema = {
          inputs: {
            ordered: { type: 'string', order: 1 },
            unordered: { type: 'string' },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].key).toBe('ordered');
        expect(fields[1].key).toBe('unordered');
      });
    });

    describe('anyOf/oneOf/allOf resolution', () => {
      it('should resolve anyOf definitions', () => {
        const schema: ModelSchema = {
          inputs: {
            ratio: {
              anyOf: [{ type: 'string', enum: ['1:1', '16:9'] }, { type: 'null' }],
              description: 'Aspect ratio',
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({
          key: 'ratio',
          type: 'select',
          options: ['1:1', '16:9'],
        });
      });

      it('should resolve oneOf definitions', () => {
        const schema: ModelSchema = {
          inputs: {
            value: {
              oneOf: [{ type: 'number', minimum: 0, maximum: 100 }],
            },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].type).toBe('number');
      });
    });

    describe('field filtering', () => {
      it('should skip fields without type', () => {
        const schema: ModelSchema = {
          inputs: {
            valid: { type: 'string' },
            invalid: { description: 'No type' } as SchemaInputField,
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0].key).toBe('valid');
      });

      it('should skip object type fields', () => {
        const schema: ModelSchema = {
          inputs: {
            complex: { type: 'object' },
            simple: { type: 'string' },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0].key).toBe('simple');
      });
    });

    describe('URI format handling', () => {
      it('should add placeholder for URI format', () => {
        const schema: ModelSchema = {
          inputs: {
            url: { type: 'string', format: 'uri' },
          },
        };
        const fields = buildDynamicFieldsFromSchema(schema);
        expect(fields[0].placeholder).toBe('https://...');
      });
    });
  });

  // =============================================================================
  // mergeDefinitionFields Tests
  // =============================================================================

  describe('mergeDefinitionFields', () => {
    it('should return base fields when no dynamic fields', () => {
      const baseFields: DynamicField[] = [
        { key: 'prompt', label: 'Prompt', type: 'textarea' },
        { key: 'width', label: 'Width', type: 'number' },
      ];
      const result = mergeDefinitionFields(baseFields, []);
      expect(result).toEqual(baseFields);
    });

    it('should prioritize dynamic fields over base fields', () => {
      const baseFields: DynamicField[] = [
        { key: 'prompt', label: 'Prompt', type: 'textarea' },
        { key: 'width', label: 'Width', type: 'number', default: 512 },
      ];
      const dynamicFields: DynamicField[] = [
        { key: 'width', label: 'Width', type: 'number', default: 1024 },
      ];
      const result = mergeDefinitionFields(baseFields, dynamicFields);
      const widthField = result.find((f) => f.key === 'width');
      expect(widthField?.default).toBe(1024);
    });

    it('should keep model field first', () => {
      const baseFields: DynamicField[] = [
        { key: 'width', label: 'Width', type: 'number' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'height', label: 'Height', type: 'number' },
      ];
      const dynamicFields: DynamicField[] = [{ key: 'seed', label: 'Seed', type: 'number' }];
      const result = mergeDefinitionFields(baseFields, dynamicFields);
      expect(result[0].key).toBe('model');
    });

    it('should avoid duplicate fields', () => {
      const baseFields: DynamicField[] = [{ key: 'prompt', label: 'Prompt', type: 'textarea' }];
      const dynamicFields: DynamicField[] = [{ key: 'prompt', label: 'Prompt', type: 'textarea' }];
      const result = mergeDefinitionFields(baseFields, dynamicFields);
      const promptFields = result.filter((f) => f.key === 'prompt');
      expect(promptFields).toHaveLength(1);
    });

    it('should hide width/height when aspect_ratio is present', () => {
      const baseFields: DynamicField[] = [
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'width', label: 'Width', type: 'number' },
        { key: 'height', label: 'Height', type: 'number' },
      ];
      const dynamicFields: DynamicField[] = [
        { key: 'aspect_ratio', label: 'Aspect Ratio', type: 'select' },
      ];
      const result = mergeDefinitionFields(baseFields, dynamicFields);
      expect(result.find((f) => f.key === 'width')).toBeUndefined();
      expect(result.find((f) => f.key === 'height')).toBeUndefined();
      expect(result.find((f) => f.key === 'aspect_ratio')).toBeDefined();
    });

    it('should handle camelCase to snake_case matching', () => {
      const baseFields: DynamicField[] = [
        { key: 'numOutputs', label: 'Num Outputs', type: 'number' },
      ];
      const dynamicFields: DynamicField[] = [
        { key: 'num_outputs', label: 'Num Outputs', type: 'number' },
      ];
      const result = mergeDefinitionFields(baseFields, dynamicFields);
      // Should only have one field (dynamic takes precedence)
      const numOutputFields = result.filter(
        (f) => f.key === 'numOutputs' || f.key === 'num_outputs'
      );
      expect(numOutputFields).toHaveLength(1);
    });

    it('should handle empty base fields', () => {
      const dynamicFields: DynamicField[] = [{ key: 'prompt', label: 'Prompt', type: 'textarea' }];
      const result = mergeDefinitionFields([], dynamicFields);
      expect(result).toEqual(dynamicFields);
    });

    it('should handle undefined base fields', () => {
      const dynamicFields: DynamicField[] = [{ key: 'prompt', label: 'Prompt', type: 'textarea' }];
      const result = mergeDefinitionFields(undefined, dynamicFields);
      expect(result).toEqual(dynamicFields);
    });

    it('should include all base fields when no dynamic fields', () => {
      const baseFields: DynamicField[] = [
        { key: 'first', label: 'First', type: 'text' },
        { key: 'valid', label: 'Valid', type: 'text' },
      ];
      const dynamicFields: DynamicField[] = [];
      const result = mergeDefinitionFields(baseFields, dynamicFields);
      expect(result).toHaveLength(2);
      expect(result.find((f) => f.key === 'valid')).toBeDefined();
    });
  });

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('integration', () => {
    it('should process a complete image generation schema', () => {
      const schema: ModelSchema = {
        inputs: {
          prompt: {
            type: 'string',
            description: 'Text description of image',
            order: 1,
            required: true,
          },
          negative_prompt: {
            type: 'string',
            description: 'What to avoid',
            order: 2,
          },
          aspect_ratio: {
            type: 'string',
            enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
            default: '1:1',
            order: 3,
          },
          num_outputs: {
            type: 'integer',
            minimum: 1,
            maximum: 4,
            default: 1,
            order: 4,
          },
          seed: {
            type: 'integer',
            description: 'Random seed',
            order: 5,
          },
        },
      };

      const fields = buildDynamicFieldsFromSchema(schema);
      expect(fields).toHaveLength(5);
      expect(fields[0].key).toBe('prompt');
      expect(fields[0].type).toBe('textarea');
      expect(fields[1].key).toBe('negative_prompt');
      expect(fields[2].key).toBe('aspect_ratio');
      expect(fields[2].type).toBe('select');
      expect(fields[3].key).toBe('num_outputs');
      expect(fields[3].type).toBe('number');
    });

    it('should process an inpainting schema with mask', () => {
      const schema: ModelSchema = {
        inputs: {
          image: {
            type: 'string',
            format: 'uri',
            description: 'Source image',
            order: 1,
          },
          mask: {
            type: 'string',
            format: 'uri',
            description: 'Mask image',
            order: 2,
          },
          prompt: {
            type: 'string',
            description: 'What to generate in masked area',
            order: 3,
          },
        },
      };

      const fields = buildDynamicFieldsFromSchema(schema);
      expect(fields).toHaveLength(3);

      const imageField = fields.find((f) => f.key === 'image');
      expect(imageField?.type).toBe('media-input');
      expect(imageField?.mediaType).toBe('image');
      expect(imageField?.role).toBe('primary');

      const maskField = fields.find((f) => f.key === 'mask');
      expect(maskField?.type).toBe('media-input');
      expect(maskField?.mediaType).toBe('mask');
    });

    it('should merge base fields with dynamic schema', () => {
      const baseFields: DynamicField[] = [
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'prompt', label: 'Prompt', type: 'textarea' },
        { key: 'width', label: 'Width', type: 'number', default: 512 },
        { key: 'height', label: 'Height', type: 'number', default: 512 },
      ];

      const schema: ModelSchema = {
        inputs: {
          prompt: { type: 'string', order: 1 },
          aspect_ratio: { type: 'string', enum: ['1:1', '16:9'], order: 2 },
          seed: { type: 'integer', order: 3 },
        },
      };

      const dynamicFields = buildDynamicFieldsFromSchema(schema);
      const merged = mergeDefinitionFields(baseFields, dynamicFields);

      // Model should be first
      expect(merged[0].key).toBe('model');

      // width/height should be hidden (aspect_ratio present)
      expect(merged.find((f) => f.key === 'width')).toBeUndefined();
      expect(merged.find((f) => f.key === 'height')).toBeUndefined();

      // aspect_ratio should be present
      expect(merged.find((f) => f.key === 'aspect_ratio')).toBeDefined();
    });
  });
});
