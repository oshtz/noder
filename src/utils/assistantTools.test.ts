/**
 * Tests for assistantTools utility
 */

import { describe, it, expect } from 'vitest';
import { TOOL_RISK, TOOL_REGISTRY, getOpenRouterTools, getToolDefinition } from './assistantTools';

describe('assistantTools', () => {
  describe('TOOL_RISK', () => {
    it('should have all risk levels defined', () => {
      expect(TOOL_RISK.READ).toBe('read');
      expect(TOOL_RISK.WRITE).toBe('write');
      expect(TOOL_RISK.DESTRUCTIVE).toBe('destructive');
    });
  });

  describe('TOOL_REGISTRY', () => {
    it('should be an array of tool definitions', () => {
      expect(Array.isArray(TOOL_REGISTRY)).toBe(true);
      expect(TOOL_REGISTRY.length).toBeGreaterThan(0);
    });

    it('should have required properties on each tool', () => {
      TOOL_REGISTRY.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('risk');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect([TOOL_RISK.READ, TOOL_RISK.WRITE, TOOL_RISK.DESTRUCTIVE]).toContain(tool.risk);
      });
    });

    it('should have unique tool names', () => {
      const names = TOOL_REGISTRY.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should include read tools', () => {
      const readTools = TOOL_REGISTRY.filter((t) => t.risk === TOOL_RISK.READ);
      expect(readTools.length).toBeGreaterThan(0);

      const readToolNames = readTools.map((t) => t.name);
      expect(readToolNames).toContain('workflow_get_state');
      expect(readToolNames).toContain('workflow_get_node');
      expect(readToolNames).toContain('workflow_get_outputs');
      expect(readToolNames).toContain('workflow_validate');
    });

    it('should include write tools', () => {
      const writeTools = TOOL_REGISTRY.filter((t) => t.risk === TOOL_RISK.WRITE);
      expect(writeTools.length).toBeGreaterThan(0);

      const writeToolNames = writeTools.map((t) => t.name);
      expect(writeToolNames).toContain('workflow_create');
      expect(writeToolNames).toContain('workflow_connect');
      expect(writeToolNames).toContain('workflow_update_node');
      expect(writeToolNames).toContain('workflow_run');
    });

    it('should include destructive tools', () => {
      const destructiveTools = TOOL_REGISTRY.filter((t) => t.risk === TOOL_RISK.DESTRUCTIVE);
      expect(destructiveTools.length).toBeGreaterThan(0);

      const destructiveToolNames = destructiveTools.map((t) => t.name);
      expect(destructiveToolNames).toContain('workflow_clear');
    });

    describe('workflow_create tool', () => {
      it('should have correct parameters', () => {
        const tool = TOOL_REGISTRY.find((t) => t.name === 'workflow_create');
        expect(tool).toBeDefined();
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties).toHaveProperty('replace');
        expect(tool.parameters.properties).toHaveProperty('nodes');
        expect(tool.parameters.properties).toHaveProperty('edges');
        expect(tool.parameters.required).toContain('nodes');
      });

      it('should have correct node item schema', () => {
        const tool = TOOL_REGISTRY.find((t) => t.name === 'workflow_create');
        const nodesSchema = tool.parameters.properties.nodes;
        expect(nodesSchema.type).toBe('array');
        expect(nodesSchema.items.properties).toHaveProperty('id');
        expect(nodesSchema.items.properties).toHaveProperty('type');
        expect(nodesSchema.items.properties).toHaveProperty('label');
        expect(nodesSchema.items.properties).toHaveProperty('position');
        expect(nodesSchema.items.properties).toHaveProperty('data');
        expect(nodesSchema.items.required).toContain('id');
        expect(nodesSchema.items.required).toContain('type');
      });
    });

    describe('workflow_connect tool', () => {
      it('should have correct parameters', () => {
        const tool = TOOL_REGISTRY.find((t) => t.name === 'workflow_connect');
        expect(tool).toBeDefined();
        expect(tool.parameters.properties).toHaveProperty('connections');
        expect(tool.parameters.required).toContain('connections');
      });
    });

    describe('workflow_update_node tool', () => {
      it('should have correct parameters', () => {
        const tool = TOOL_REGISTRY.find((t) => t.name === 'workflow_update_node');
        expect(tool).toBeDefined();
        expect(tool.parameters.properties).toHaveProperty('nodeId');
        expect(tool.parameters.properties).toHaveProperty('data');
        expect(tool.parameters.properties).toHaveProperty('label');
        expect(tool.parameters.required).toContain('nodeId');
      });
    });

    describe('workflow_delete_nodes tool', () => {
      it('should have correct parameters', () => {
        const tool = TOOL_REGISTRY.find((t) => t.name === 'workflow_delete_nodes');
        expect(tool).toBeDefined();
        expect(tool.parameters.properties).toHaveProperty('nodeIds');
        expect(tool.parameters.required).toContain('nodeIds');
      });
    });

    describe('workflow_clear tool', () => {
      it('should require confirmation', () => {
        const tool = TOOL_REGISTRY.find((t) => t.name === 'workflow_clear');
        expect(tool).toBeDefined();
        expect(tool.parameters.properties).toHaveProperty('confirm');
        expect(tool.parameters.required).toContain('confirm');
      });
    });
  });

  describe('getOpenRouterTools', () => {
    it('should return tools in OpenRouter format', () => {
      const tools = getOpenRouterTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(TOOL_REGISTRY.length);
    });

    it('should have correct structure for each tool', () => {
      const tools = getOpenRouterTools();

      tools.forEach((tool) => {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool).toHaveProperty('function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
      });
    });

    it('should preserve tool names from registry', () => {
      const tools = getOpenRouterTools();
      const openRouterNames = tools.map((t) => t.function.name);
      const registryNames = TOOL_REGISTRY.map((t) => t.name);

      expect(openRouterNames).toEqual(registryNames);
    });

    it('should preserve descriptions and parameters', () => {
      const tools = getOpenRouterTools();

      tools.forEach((tool, index) => {
        const original = TOOL_REGISTRY[index];
        expect(tool.function.description).toBe(original.description);
        expect(tool.function.parameters).toEqual(original.parameters);
      });
    });
  });

  describe('getToolDefinition', () => {
    it('should return tool definition by name', () => {
      const tool = getToolDefinition('workflow_create');

      expect(tool).not.toBeNull();
      expect(tool.name).toBe('workflow_create');
      expect(tool.description).toBeDefined();
      expect(tool.risk).toBe(TOOL_RISK.WRITE);
    });

    it('should return null for unknown tool', () => {
      const tool = getToolDefinition('nonexistent_tool');

      expect(tool).toBeNull();
    });

    it('should return all registered tools', () => {
      TOOL_REGISTRY.forEach((registeredTool) => {
        const found = getToolDefinition(registeredTool.name);
        expect(found).toBe(registeredTool);
      });
    });

    it('should handle empty string', () => {
      const tool = getToolDefinition('');
      expect(tool).toBeNull();
    });

    it('should handle undefined', () => {
      const tool = getToolDefinition(undefined);
      expect(tool).toBeNull();
    });

    it('should be case-sensitive', () => {
      const tool = getToolDefinition('WORKFLOW_CREATE');
      expect(tool).toBeNull();
    });
  });

  describe('tool consistency', () => {
    it('should have descriptions that are helpful', () => {
      TOOL_REGISTRY.forEach((tool) => {
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });

    it('should have parameters with type: object', () => {
      TOOL_REGISTRY.forEach((tool) => {
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties).toBeDefined();
      });
    });

    it('should have valid required arrays (if present)', () => {
      TOOL_REGISTRY.forEach((tool) => {
        if (tool.parameters.required) {
          expect(Array.isArray(tool.parameters.required)).toBe(true);
          tool.parameters.required.forEach((req) => {
            expect(tool.parameters.properties).toHaveProperty(req);
          });
        }
      });
    });
  });
});
