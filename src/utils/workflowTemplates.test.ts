/**
 * Tests for workflowTemplates utility functions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  workflowTemplates,
  validateTemplates,
  getTemplateById,
  getTemplatesByCategory,
  applyTemplate,
  type TemplateCategory,
} from './workflowTemplates';

describe('workflowTemplates', () => {
  describe('workflowTemplates array', () => {
    it('should have at least one template', () => {
      expect(workflowTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates with required properties', () => {
      workflowTemplates.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(typeof template.id).toBe('string');
        expect(template.name).toBeDefined();
        expect(typeof template.name).toBe('string');
        expect(template.description).toBeDefined();
        expect(template.icon).toBeDefined();
        expect(template.category).toBeDefined();
        expect(['beginner', 'intermediate', 'advanced']).toContain(template.category);
        expect(Array.isArray(template.nodes)).toBe(true);
        expect(Array.isArray(template.edges)).toBe(true);
      });
    });

    it('should have unique template IDs', () => {
      const ids = workflowTemplates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have templates in each category', () => {
      const categories = new Set(workflowTemplates.map((t) => t.category));
      expect(categories.has('beginner')).toBe(true);
      expect(categories.has('intermediate')).toBe(true);
      expect(categories.has('advanced')).toBe(true);
    });
  });

  describe('validateTemplates', () => {
    it('should return issues array', () => {
      const issues = validateTemplates();
      // brand-campaign-mixed intentionally has orphan nodes (standalone images)
      // This is expected behavior for that template
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should detect intentional orphan nodes in brand-campaign-mixed template', () => {
      const issues = validateTemplates();
      // The brand-campaign-mixed template has standalone image nodes by design
      const orphanIssue = issues.find(
        (i) => i.includes('brand-campaign-mixed') && i.includes('orphan')
      );
      expect(orphanIssue).toBeDefined();
    });

    it('should not have duplicate template IDs', () => {
      const issues = validateTemplates();
      const duplicateIdIssue = issues.find((i) => i.includes('Duplicate template IDs'));
      expect(duplicateIdIssue).toBeUndefined();
    });

    it('should not have duplicate node IDs within templates', () => {
      const issues = validateTemplates();
      const duplicateNodeIdIssue = issues.find((i) => i.includes('duplicate node IDs'));
      expect(duplicateNodeIdIssue).toBeUndefined();
    });

    it('should not have edges referencing non-existent nodes', () => {
      const issues = validateTemplates();
      const nonExistentNodeIssue = issues.find((i) => i.includes('non-existent'));
      expect(nonExistentNodeIssue).toBeUndefined();
    });

    it('should not have templates with missing names', () => {
      const issues = validateTemplates();
      const missingNameIssue = issues.find((i) => i.includes('missing name'));
      expect(missingNameIssue).toBeUndefined();
    });
  });

  describe('getTemplateById', () => {
    it('should return template by valid ID', () => {
      const firstTemplate = workflowTemplates[0];
      const result = getTemplateById(firstTemplate.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(firstTemplate.id);
    });

    it('should return undefined for non-existent ID', () => {
      const result = getTemplateById('non-existent-template-id');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty ID', () => {
      const result = getTemplateById('');
      expect(result).toBeUndefined();
    });

    it('should return correct template for character-concept-sheet', () => {
      const result = getTemplateById('character-concept-sheet');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Character Concept Sheet');
      expect(result?.category).toBe('beginner');
    });

    it('should return correct template for ai-prompt-to-image', () => {
      const result = getTemplateById('ai-prompt-to-image');
      expect(result).toBeDefined();
      expect(result?.name).toBe('AI Prompt Generator');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return beginner templates', () => {
      const result = getTemplatesByCategory('beginner');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((template) => {
        expect(template.category).toBe('beginner');
      });
    });

    it('should return intermediate templates', () => {
      const result = getTemplatesByCategory('intermediate');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((template) => {
        expect(template.category).toBe('intermediate');
      });
    });

    it('should return advanced templates', () => {
      const result = getTemplatesByCategory('advanced');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((template) => {
        expect(template.category).toBe('advanced');
      });
    });

    it('should return empty array for invalid category', () => {
      const result = getTemplatesByCategory('invalid' as TemplateCategory);
      expect(result).toEqual([]);
    });
  });

  describe('applyTemplate', () => {
    const mockHandleRemoveNode = vi.fn();

    it('should return empty arrays for null template', () => {
      const result = applyTemplate(null, mockHandleRemoveNode);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should return empty arrays for undefined template', () => {
      const result = applyTemplate(undefined, mockHandleRemoveNode);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should apply template and add onRemove handler to nodes', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      expect(result.nodes.length).toBe(template!.nodes.length);
      result.nodes.forEach((node) => {
        expect(node.data.onRemove).toBe(mockHandleRemoveNode);
      });
    });

    it('should apply template with correct edge processing', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      expect(result.edges.length).toBe(template!.edges.length);
      result.edges.forEach((edge) => {
        expect(edge.animated).toBe(false);
        expect(edge.data?.isProcessing).toBe(false);
      });
    });

    it('should calculate node size based on aspect ratio string', () => {
      // Get a template with image nodes that have aspect_ratio
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      // Find an image node
      const imageNode = result.nodes.find((n) => n.type === 'image');
      expect(imageNode).toBeDefined();
      expect(imageNode?.style).toBeDefined();
      expect(imageNode?.style?.width).toBeGreaterThan(0);
      expect(imageNode?.style?.height).toBeGreaterThan(0);
    });

    it('should handle 16:9 aspect ratio', () => {
      const template = getTemplateById('thumbnail-generator');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const imageNode = result.nodes.find((n) => n.type === 'image');
      expect(imageNode).toBeDefined();
      // 16:9 ratio with base width 360 would give height of about 202
      expect(imageNode?.style?.width).toBe(360);
      expect(imageNode?.style?.height).toBeGreaterThan(150);
      expect(imageNode?.style?.height).toBeLessThan(300);
    });

    it('should handle 1:1 aspect ratio', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const imageNode = result.nodes.find(
        (n) => n.type === 'image' && n.data?.aspect_ratio === '1:1'
      );
      expect(imageNode).toBeDefined();
      // 1:1 ratio means width and height should be equal
      expect(imageNode?.style?.width).toBe(360);
      expect(imageNode?.style?.height).toBe(360);
    });

    it('should preserve existing node data', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const textNode = result.nodes.find((n) => n.type === 'text');
      expect(textNode).toBeDefined();
      expect(textNode?.data.prompt).toBeDefined();
      expect(textNode?.data.systemPrompt).toBeDefined();
    });

    it('should handle chip nodes', () => {
      const template = getTemplateById('character-concept-sheet');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const chipNode = result.nodes.find((n) => n.type === 'chip');
      expect(chipNode).toBeDefined();
      expect(chipNode?.data.chipId).toBeDefined();
      expect(chipNode?.data.content).toBeDefined();
    });

    it('should handle upscaler nodes', () => {
      const template = getTemplateById('character-concept-sheet');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const upscalerNode = result.nodes.find((n) => n.type === 'upscaler');
      expect(upscalerNode).toBeDefined();
      expect(upscalerNode?.data.scale).toBeDefined();
    });

    it('should deep clone template data to avoid mutations', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const originalPrompt = template!.nodes[0]?.data?.prompt;
      const result = applyTemplate(template!, mockHandleRemoveNode);

      // Modify the result
      result.nodes[0].data.prompt = 'modified';

      // Original should be unchanged
      expect(template!.nodes[0]?.data?.prompt).toBe(originalPrompt);
    });

    it('should handle templates with multiple chips', () => {
      const template = getTemplateById('animation-keyframes');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const chipNodes = result.nodes.filter((n) => n.type === 'chip');
      expect(chipNodes.length).toBe(2); // CHARACTER and STYLE chips
    });

    it('should handle 21:9 aspect ratio for cinematic frames', () => {
      const template = getTemplateById('storyboard-sequence');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const imageNode = result.nodes.find(
        (n) => n.type === 'image' && n.data?.aspect_ratio === '21:9'
      );
      expect(imageNode).toBeDefined();
      // 21:9 ratio is ultra-wide, height should be clamped
      expect(imageNode?.style?.width).toBe(360);
      expect(imageNode?.style?.height).toBeGreaterThanOrEqual(200);
    });

    it('should handle 3:2 aspect ratio', () => {
      const template = getTemplateById('brand-photo-generator');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const imageNode = result.nodes.find(
        (n) => n.type === 'image' && n.data?.aspect_ratio === '3:2'
      );
      expect(imageNode).toBeDefined();
      // 3:2 ratio with base width 360 would give height of 240
      expect(imageNode?.style?.width).toBe(360);
      expect(imageNode?.style?.height).toBe(240);
    });

    it('should handle 3:4 aspect ratio (portrait)', () => {
      const template = getTemplateById('character-concept-sheet');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const imageNode = result.nodes.find(
        (n) => n.type === 'image' && n.data?.aspect_ratio === '3:4'
      );
      expect(imageNode).toBeDefined();
      // 3:4 ratio with base width 360 would give height of 480
      expect(imageNode?.style?.width).toBe(360);
      expect(imageNode?.style?.height).toBe(480);
    });

    it('should handle 4:3 aspect ratio', () => {
      const template = getTemplateById('editorial-photo-series');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      const imageNode = result.nodes.find(
        (n) => n.type === 'image' && n.data?.aspect_ratio === '4:3'
      );
      expect(imageNode).toBeDefined();
      // 4:3 ratio with base width 360 would give height of 270
      expect(imageNode?.style?.width).toBe(360);
      expect(imageNode?.style?.height).toBe(270);
    });

    it('should preserve node position', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      result.nodes.forEach((node, index) => {
        expect(node.position).toEqual(template!.nodes[index].position);
      });
    });

    it('should preserve node id', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      result.nodes.forEach((node, index) => {
        expect(node.id).toBe(template!.nodes[index].id);
      });
    });

    it('should preserve edge structure', () => {
      const template = getTemplateById('ai-prompt-to-image');
      expect(template).toBeDefined();

      const result = applyTemplate(template!, mockHandleRemoveNode);

      result.edges.forEach((edge, index) => {
        expect(edge.id).toBe(template!.edges[index].id);
        expect(edge.source).toBe(template!.edges[index].source);
        expect(edge.target).toBe(template!.edges[index].target);
        expect(edge.sourceHandle).toBe(template!.edges[index].sourceHandle);
        expect(edge.targetHandle).toBe(template!.edges[index].targetHandle);
      });
    });
  });

  describe('template node validation', () => {
    it('should have valid node IDs in all templates', () => {
      workflowTemplates.forEach((template) => {
        const nodeIds = template.nodes.map((n) => n.id);
        const uniqueNodeIds = new Set(nodeIds);
        expect(uniqueNodeIds.size).toBe(nodeIds.length);
      });
    });

    it('should have edges referencing existing nodes', () => {
      workflowTemplates.forEach((template) => {
        const nodeIds = new Set(template.nodes.map((n) => n.id));
        template.edges.forEach((edge) => {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        });
      });
    });

    it('should have valid node types', () => {
      const validTypes = [
        'text',
        'image',
        'video',
        'audio',
        'chip',
        'upscaler',
        'media',
        'markdown',
        'group',
        'displayText',
      ];
      workflowTemplates.forEach((template) => {
        template.nodes.forEach((node) => {
          expect(validTypes).toContain(node.type);
        });
      });
    });

    it('should have valid positions for all nodes', () => {
      workflowTemplates.forEach((template) => {
        template.nodes.forEach((node) => {
          expect(typeof node.position.x).toBe('number');
          expect(typeof node.position.y).toBe('number');
          expect(node.position.x).toBeGreaterThanOrEqual(0);
          expect(node.position.y).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should have execution order defined for nodes that need it', () => {
      workflowTemplates.forEach((template) => {
        const hasEdges = template.edges.length > 0;
        if (hasEdges) {
          template.nodes.forEach((node) => {
            expect(node.data.executionOrder).toBeDefined();
            expect(typeof node.data.executionOrder).toBe('number');
          });
        }
      });
    });
  });

  describe('specific template tests', () => {
    describe('character-concept-sheet', () => {
      it('should have correct structure', () => {
        const template = getTemplateById('character-concept-sheet');
        expect(template).toBeDefined();
        expect(template?.nodes.length).toBe(5); // 1 chip, 2 images, 2 upscalers
        expect(template?.edges.length).toBe(4);
      });

      it('should have chip connected to both images', () => {
        const template = getTemplateById('character-concept-sheet');
        expect(template).toBeDefined();

        const chipEdges = template!.edges.filter((e) => e.source === 'chip-character');
        expect(chipEdges.length).toBe(2);
      });
    });

    describe('concept-variations', () => {
      it('should have text node connected to multiple images', () => {
        const template = getTemplateById('concept-variations');
        expect(template).toBeDefined();

        const textEdges = template!.edges.filter((e) => e.source === 'text-1');
        expect(textEdges.length).toBe(3); // Connected to 3 image nodes
      });
    });

    describe('brand-campaign-mixed', () => {
      it('should have both connected and standalone image nodes', () => {
        const template = getTemplateById('brand-campaign-mixed');
        expect(template).toBeDefined();

        // Should have 1 text, 3 images, 1 upscaler
        expect(template!.nodes.length).toBe(5);

        // Only 2 edges (text->image-1, image-1->upscaler)
        expect(template!.edges.length).toBe(2);

        // image-2 and image-3 are standalone
        const connectedTargets = new Set(template!.edges.map((e) => e.target));
        expect(connectedTargets.has('image-2')).toBe(false);
        expect(connectedTargets.has('image-3')).toBe(false);
      });
    });
  });
});
