/**
 * Tests for assistantPrompt utility
 */

import { describe, it, expect } from 'vitest';
import { buildAssistantSystemPrompt } from './assistantPrompt';

describe('assistantPrompt', () => {
  describe('buildAssistantSystemPrompt', () => {
    it('should build a system prompt with empty inputs', () => {
      const result = buildAssistantSystemPrompt({});

      expect(result).toContain('# Identity & Purpose');
      expect(result).toContain('# Decision Framework');
      expect(result).toContain('# Tool Reference');
      expect(result).toContain('(none registered)');
      expect(result).toContain('(none listed)');
      expect(result).toContain('(none saved)');
    });

    it('should include node definitions', () => {
      const nodeDefinitions = [
        { type: 'text', label: 'Text Node', description: 'Generates text' },
        { type: 'image', label: 'Image Node', description: 'Generates images' },
      ];

      const result = buildAssistantSystemPrompt({ nodeDefinitions });

      expect(result).toContain('- text: Text Node (Generates text)');
      expect(result).toContain('- image: Image Node (Generates images)');
    });

    it('should include node handles', () => {
      const nodeDefinitions = [{ type: 'text', label: 'Text', description: 'Text gen' }];
      const nodeTypes = {
        text: {
          defaultData: {
            handles: [
              { id: 'input', type: 'target', dataType: 'text' },
              { id: 'output', type: 'source', dataType: 'text' },
            ],
          },
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeTypes });

      expect(result).toContain('- text: inputs input:text; outputs output:text');
    });

    it('should handle nodes with no handles', () => {
      const nodeDefinitions = [{ type: 'empty', label: 'Empty', description: 'No handles' }];
      const nodeTypes = {
        empty: {
          defaultData: {
            handles: [],
          },
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeTypes });

      expect(result).toContain('- empty: inputs none; outputs none');
    });

    it('should include node schema fields', () => {
      const nodeDefinitions = [{ type: 'text', label: 'Text', description: 'Text gen' }];
      const nodeSchemas = {
        text: {
          fields: [
            { key: 'prompt', type: 'textarea', default: '' },
            { key: 'temperature', type: 'slider', min: 0, max: 2, step: 0.1, default: 0.7 },
            { key: 'model', type: 'select', options: ['gpt-4', 'gpt-3.5'] },
          ],
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeSchemas });

      expect(result).toContain('- text: prompt (textarea, default: "")');
      expect(result).toContain('temperature (slider, min: 0, max: 2, step: 0.1, default: 0.7)');
      expect(result).toContain('model (select, options: gpt-4|gpt-3.5)');
    });

    it('should include workflow templates', () => {
      const workflowTemplates = [
        {
          id: 'text-gen',
          name: 'Text Generation',
          category: 'AI',
          description: 'Simple text generation',
          nodes: [{ id: 'text1', type: 'text', data: { prompt: 'Hello world', model: 'gpt-4' } }],
          edges: [{ source: 'input', target: 'text1' }],
        },
      ];

      const result = buildAssistantSystemPrompt({ workflowTemplates });

      expect(result).toContain('text-gen | Text Generation [AI] - Simple text generation');
      expect(result).toContain('text1:text');
      expect(result).toContain('prompt="Hello world"');
      expect(result).toContain('model="gpt-4"');
      expect(result).toContain('input -> text1');
    });

    it('should handle templates with missing fields', () => {
      const workflowTemplates = [
        {
          id: 'minimal',
          name: 'Minimal',
          nodes: [],
          edges: [],
        },
      ];

      const result = buildAssistantSystemPrompt({ workflowTemplates });

      expect(result).toContain('minimal | Minimal');
      expect(result).toContain('nodes: none');
      expect(result).toContain('edges: none');
    });

    it('should truncate long prompts in templates', () => {
      const longPrompt = 'A'.repeat(200);
      const workflowTemplates = [
        {
          id: 'long',
          name: 'Long',
          nodes: [{ id: 'n1', type: 'text', data: { prompt: longPrompt } }],
          edges: [],
        },
      ];

      const result = buildAssistantSystemPrompt({ workflowTemplates });

      // Should be truncated with ellipsis
      expect(result).toContain('...');
      expect(result).not.toContain(longPrompt);
    });

    it('should handle invalid template entries', () => {
      const workflowTemplates = [
        null,
        undefined,
        { id: 'valid', name: 'Valid', nodes: [], edges: [] },
      ];

      const result = buildAssistantSystemPrompt({ workflowTemplates });

      expect(result).toContain('(invalid template entry)');
      expect(result).toContain('valid | Valid');
    });

    it('should handle nodes with various handle types', () => {
      const nodeDefinitions = [{ type: 'custom', label: 'Custom', description: 'Custom node' }];
      const nodeTypes = {
        custom: {
          defaultData: {
            handles: [
              { id: 'in1', type: 'input', dataType: 'text' },
              { id: 'in2', type: 'target', dataType: 'image' },
              { id: 'out1', type: 'output', dataType: 'text' },
              { id: 'out2', type: 'source', dataType: 'video' },
            ],
          },
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeTypes });

      expect(result).toContain('inputs in1:text, in2:image');
      expect(result).toContain('outputs out1:text, out2:video');
    });

    it('should handle handles without dataType', () => {
      const nodeDefinitions = [{ type: 'untyped', label: 'Untyped', description: 'No data types' }];
      const nodeTypes = {
        untyped: {
          defaultData: {
            handles: [
              { id: 'in', type: 'target' },
              { id: 'out', type: 'source' },
            ],
          },
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeTypes });

      expect(result).toContain('in:any');
      expect(result).toContain('out:any');
    });

    it('should format edge with handles', () => {
      const workflowTemplates = [
        {
          id: 'handles',
          name: 'With Handles',
          nodes: [],
          edges: [{ source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' }],
        },
      ];

      const result = buildAssistantSystemPrompt({ workflowTemplates });

      expect(result).toContain('a:out -> b:in');
    });

    it('should format edge without handles', () => {
      const workflowTemplates = [
        {
          id: 'simple',
          name: 'Simple',
          nodes: [],
          edges: [{ source: 'a', target: 'b' }],
        },
      ];

      const result = buildAssistantSystemPrompt({ workflowTemplates });

      expect(result).toContain('a -> b');
    });

    it('should include all required prompt sections', () => {
      const result = buildAssistantSystemPrompt({});

      // Check all major sections are present
      expect(result).toContain('# Identity & Purpose');
      expect(result).toContain('# Decision Framework');
      expect(result).toContain('# Reasoning Protocol');
      expect(result).toContain('# Tool Reference');
      expect(result).toContain('# Common Patterns');
      expect(result).toContain('# Error Handling');
      expect(result).toContain('# Preferred Defaults');
      expect(result).toContain('# Available Node Types');
      expect(result).toContain('# Node Data Fields');
      expect(result).toContain('# Handle IDs by Node Type');
      expect(result).toContain('# Workflow Templates');
    });

    it('should include tool names in reference section', () => {
      const result = buildAssistantSystemPrompt({});

      expect(result).toContain('workflow_get_state');
      expect(result).toContain('workflow_get_node');
      expect(result).toContain('workflow_create');
      expect(result).toContain('workflow_connect');
      expect(result).toContain('workflow_update_node');
      expect(result).toContain('workflow_delete_nodes');
      expect(result).toContain('workflow_run');
      expect(result).toContain('workflow_validate');
    });

    it('should handle fields with number type', () => {
      const nodeDefinitions = [{ type: 'number', label: 'Number', description: 'Number input' }];
      const nodeSchemas = {
        number: {
          fields: [{ key: 'value', type: 'number', min: 0, max: 100, default: 50 }],
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeSchemas });

      expect(result).toContain('value (number, min: 0, max: 100, default: 50)');
    });

    it('should handle fields without type', () => {
      const nodeDefinitions = [{ type: 'untyped', label: 'Untyped', description: 'Untyped field' }];
      const nodeSchemas = {
        untyped: {
          fields: [{ key: 'field1', default: 'value' }],
        },
      };

      const result = buildAssistantSystemPrompt({ nodeDefinitions, nodeSchemas });

      expect(result).toContain('field1 (default: "value")');
    });
  });
});
