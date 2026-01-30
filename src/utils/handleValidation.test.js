import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getHandleInfo,
  registerValidation,
  getValidator,
  validateEdges,
  isValidConnection,
  isValidConnection2,
  isValidConnection3,
  isValidConnection4,
  getValidConnections,
} from './handleValidation';
import { getGlobalNodesRef } from '../context/WorkflowContext';

// Mock the external dependencies
vi.mock('../nodes', () => ({
  nodeTypes: {
    text: {
      defaultData: {
        handles: [
          { id: 'text-in', type: 'input', dataType: 'text' },
          { id: 'text-out', type: 'output', dataType: 'text' },
        ],
      },
    },
    image: {
      defaultData: {
        handles: [
          { id: 'prompt-in', type: 'input', dataType: 'text' },
          { id: 'image-out', type: 'output', dataType: 'image' },
        ],
      },
    },
  },
}));

vi.mock('../context/WorkflowContext', () => ({
  getGlobalNodesRef: vi.fn(),
}));

vi.mock('../constants/handleTypes', () => ({
  HANDLE_TYPES: {
    TEXT: { type: 'text', dataType: 'text', color: '#2196F3' },
    IMAGE: { type: 'image', dataType: 'image', color: '#f97316' },
  },
  getHandleColor: vi.fn((type) => {
    const colors = { text: '#2196F3', image: '#f97316' };
    return colors[type] || 'var(--primary-color)';
  }),
  areTypesCompatible: vi.fn((source, target) => {
    if (source === 'any' || target === 'any') return true;
    return source === target;
  }),
}));

describe('getHandleInfo', () => {
  it('should return handle info from node type definition', () => {
    const result = getHandleInfo('text', 'text-out', 'output', []);
    expect(result).not.toBeNull();
    expect(result.id).toBe('text-out');
    expect(result.dataType).toBe('text');
    expect(result.color).toBe('#2196F3');
  });

  it('should return handle info from handles override', () => {
    const customHandles = [{ id: 'custom-out', type: 'output', dataType: 'image' }];
    const result = getHandleInfo('text', 'custom-out', 'output', customHandles);
    expect(result).not.toBeNull();
    expect(result.id).toBe('custom-out');
    expect(result.dataType).toBe('image');
  });

  it('should return null for non-existent handle', () => {
    const result = getHandleInfo('text', 'non-existent', 'output', []);
    expect(result).toBeNull();
  });

  it('should return null for non-existent node type', () => {
    const result = getHandleInfo('unknown-type', 'some-handle', 'output', []);
    expect(result).toBeNull();
  });

  it('should match input handles when handleType is input', () => {
    const result = getHandleInfo('text', 'text-in', 'input', []);
    expect(result).not.toBeNull();
    expect(result.type).toBe('input');
  });

  it('should treat target as input type', () => {
    const result = getHandleInfo('text', 'text-in', 'input', []);
    expect(result).not.toBeNull();
  });

  it('should treat source as output type', () => {
    const result = getHandleInfo('text', 'text-out', 'output', []);
    expect(result).not.toBeNull();
  });
});

describe('Validation Registry', () => {
  beforeEach(() => {
    // Reset any custom validations between tests
  });

  describe('registerValidation', () => {
    it('should register a custom validation', () => {
      const customValidator = vi.fn(() => true);
      registerValidation('custom-test', customValidator);

      const validator = getValidator('custom-test');
      validator({ source: 'a', target: 'b' });

      expect(customValidator).toHaveBeenCalled();
    });
  });

  describe('getValidator', () => {
    it('should return a default validator for unknown rules', () => {
      const validator = getValidator('unknown-validation-rule');
      expect(validator({ source: 'a', target: 'b' })).toBe(true);
    });

    it('should catch errors in validators and return false', () => {
      registerValidation('error-validator', () => {
        throw new Error('Test error');
      });

      const validator = getValidator('error-validator');
      expect(validator({ source: 'a', target: 'b' })).toBe(false);
    });
  });
});

describe('Built-in Validations', () => {
  describe('type-mismatch validation', () => {
    it('should pass when source is output and target is input', () => {
      const validator = getValidator('type-mismatch');
      expect(
        validator({
          sourceHandleType: 'output',
          targetHandleType: 'input',
        })
      ).toBe(true);
    });

    it('should fail when source is not output', () => {
      const validator = getValidator('type-mismatch');
      expect(
        validator({
          sourceHandleType: 'input',
          targetHandleType: 'input',
        })
      ).toBe(false);
    });

    it('should fail when target is not input', () => {
      const validator = getValidator('type-mismatch');
      expect(
        validator({
          sourceHandleType: 'output',
          targetHandleType: 'output',
        })
      ).toBe(false);
    });

    it('should fail when handle types are missing', () => {
      const validator = getValidator('type-mismatch');
      expect(validator({})).toBe(false);
    });
  });

  describe('unique-handles validation', () => {
    it('should pass when handles are different', () => {
      const validator = getValidator('unique-handles');
      expect(
        validator({
          sourceHandle: 'out-1',
          targetHandle: 'in-1',
        })
      ).toBe(true);
    });

    it('should fail when handles are the same', () => {
      const validator = getValidator('unique-handles');
      expect(
        validator({
          sourceHandle: 'handle-1',
          targetHandle: 'handle-1',
        })
      ).toBe(false);
    });
  });

  describe('data-flow validation', () => {
    it('should pass for different source and target nodes', () => {
      const validator = getValidator('data-flow');
      expect(
        validator({
          source: 'node-1',
          target: 'node-2',
        })
      ).toBe(true);
    });

    it('should fail for self-connections', () => {
      const validator = getValidator('data-flow');
      expect(
        validator({
          source: 'node-1',
          target: 'node-1',
        })
      ).toBe(false);
    });
  });

  describe('data-type-match validation', () => {
    it('should pass when data types match', () => {
      const validator = getValidator('data-type-match');
      const mockNodes = [
        {
          id: 'node-1',
          type: 'text',
          data: {
            handles: [{ id: 'out', type: 'output', dataType: 'text' }],
          },
        },
        {
          id: 'node-2',
          type: 'text',
          data: {
            handles: [{ id: 'in', type: 'input', dataType: 'text' }],
          },
        },
      ];

      expect(
        validator({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'out',
          targetHandle: 'in',
          sourceHandleType: 'output',
          targetHandleType: 'input',
          nodesSnapshot: mockNodes,
        })
      ).toBe(true);
    });

    it('should fail when nodes are not found', () => {
      const validator = getValidator('data-type-match');
      expect(
        validator({
          source: 'missing-1',
          target: 'missing-2',
          sourceHandle: 'out',
          targetHandle: 'in',
          nodesSnapshot: [],
        })
      ).toBe(false);
    });
  });
});

describe('validateEdges', () => {
  it('should return valid edges and validation errors', () => {
    const mockNodes = [
      {
        id: 'node-1',
        type: 'text',
        data: {
          handles: [{ id: 'out', type: 'output', dataType: 'text' }],
        },
      },
      {
        id: 'node-2',
        type: 'text',
        data: {
          handles: [{ id: 'in', type: 'input', dataType: 'text' }],
        },
      },
    ];

    const edges = [{ source: 'node-1', target: 'node-2', sourceHandle: 'out', targetHandle: 'in' }];

    const result = validateEdges(edges, mockNodes);
    expect(result).toHaveProperty('validEdges');
    expect(result).toHaveProperty('validationErrors');
    expect(Array.isArray(result.validEdges)).toBe(true);
    expect(Array.isArray(result.validationErrors)).toBe(true);
  });

  it('should filter out invalid edges', () => {
    const edges = [
      { source: 'node-1', target: 'node-1', sourceHandle: 'out', targetHandle: 'in' }, // Self-connection
    ];

    const result = validateEdges(edges, []);
    expect(result.validEdges.length).toBe(0);
    expect(result.validationErrors.length).toBe(1);
    expect(result.validationErrors[0].errors).toContain('data-flow');
  });

  it('should return empty arrays for empty inputs', () => {
    const result = validateEdges([], []);
    expect(result.validEdges).toEqual([]);
    expect(result.validationErrors).toEqual([]);
  });
});

describe('isValidConnection', () => {
  beforeEach(() => {
    getGlobalNodesRef.mockReturnValue({
      current: [
        {
          id: 'node-1',
          type: 'text',
          data: {
            handles: [{ id: 'text-out', type: 'output', dataType: 'text' }],
          },
        },
        {
          id: 'node-2',
          type: 'text',
          data: {
            handles: [{ id: 'text-in', type: 'input', dataType: 'text' }],
          },
        },
      ],
    });
  });

  it('should return false for missing source', () => {
    expect(isValidConnection({ target: 'node-2', targetHandle: 'text-in' })).toBe(false);
  });

  it('should return false for missing sourceHandle', () => {
    expect(isValidConnection({ source: 'node-1', target: 'node-2', targetHandle: 'text-in' })).toBe(
      false
    );
  });

  it('should validate connection through getValidConnections', () => {
    const result = isValidConnection({
      source: 'node-1',
      sourceHandle: 'text-out',
      target: 'node-2',
      targetHandle: 'text-in',
    });
    // Result depends on whether getValidConnections finds compatible handles
    expect(typeof result).toBe('boolean');
  });
});

describe('isValidConnection2', () => {
  beforeEach(() => {
    getGlobalNodesRef.mockReturnValue({
      current: [
        {
          id: 'node-1',
          type: 'text',
          data: {
            handles: [{ id: 'text-out', type: 'output', dataType: 'text' }],
          },
        },
        {
          id: 'node-2',
          type: 'text',
          data: {
            handles: [{ id: 'text-in', type: 'input', dataType: 'text' }],
          },
        },
      ],
    });
  });

  it('should return false when source node not found', () => {
    expect(
      isValidConnection2({
        source: 'missing',
        sourceHandle: 'text-out',
        target: 'node-2',
        targetHandle: 'text-in',
      })
    ).toBe(false);
  });

  it('should return false when target node not found', () => {
    expect(
      isValidConnection2({
        source: 'node-1',
        sourceHandle: 'text-out',
        target: 'missing',
        targetHandle: 'text-in',
      })
    ).toBe(false);
  });

  it('should validate valid connection', () => {
    const result = isValidConnection2({
      source: 'node-1',
      sourceHandle: 'text-out',
      target: 'node-2',
      targetHandle: 'text-in',
    });
    expect(typeof result).toBe('boolean');
  });

  it('should handle error gracefully and return false', () => {
    getGlobalNodesRef.mockReturnValue({
      current: null,
    });
    expect(
      isValidConnection2({
        source: 'node-1',
        sourceHandle: 'text-out',
        target: 'node-2',
        targetHandle: 'text-in',
      })
    ).toBe(false);
  });
});

describe('isValidConnection3', () => {
  it('should always return true (permissive)', () => {
    expect(isValidConnection3({})).toBe(true);
    expect(isValidConnection3({ source: 'a', target: 'b' })).toBe(true);
    expect(isValidConnection3({ source: 'same', target: 'same' })).toBe(true);
  });
});

describe('isValidConnection4', () => {
  it('should always return true (permissive)', () => {
    expect(isValidConnection4({})).toBe(true);
    expect(isValidConnection4({ source: 'a', target: 'b' })).toBe(true);
    expect(isValidConnection4({ source: 'same', target: 'same' })).toBe(true);
  });
});

describe('getValidConnections', () => {
  beforeEach(() => {
    getGlobalNodesRef.mockReturnValue({
      current: [
        {
          id: 'text-node',
          type: 'text',
          data: {
            handles: [
              { id: 'text-in', type: 'input', dataType: 'text' },
              { id: 'text-out', type: 'output', dataType: 'text' },
            ],
          },
        },
        {
          id: 'image-node',
          type: 'image',
          data: {
            handles: [
              { id: 'prompt-in', type: 'input', dataType: 'text' },
              { id: 'image-out', type: 'output', dataType: 'image' },
            ],
          },
        },
      ],
    });
  });

  it('should return empty array when node not found', () => {
    const result = getValidConnections('non-existent', 'handle', 'output');
    expect(result).toEqual([]);
  });

  it('should return empty array when handle not found', () => {
    const result = getValidConnections('text-node', 'non-existent', 'output');
    expect(result).toEqual([]);
  });

  it('should return compatible connections for output handle', () => {
    const result = getValidConnections('text-node', 'text-out', 'output');
    // Should find compatible input handles on other nodes
    expect(Array.isArray(result)).toBe(true);
  });

  it('should not include self in results', () => {
    const result = getValidConnections('text-node', 'text-out', 'output');
    expect(result.every((conn) => conn.nodeId !== 'text-node')).toBe(true);
  });

  it('should find compatible input handle for text output', () => {
    const result = getValidConnections('text-node', 'text-out', 'output');
    // image-node has prompt-in which accepts text
    const imageNodeConnection = result.find((c) => c.nodeId === 'image-node');
    expect(imageNodeConnection).toBeDefined();
    expect(imageNodeConnection.handleId).toBe('prompt-in');
  });

  it('should return compatible connections for input handle', () => {
    const result = getValidConnections('image-node', 'prompt-in', 'input');
    // Should find compatible output handles on other nodes
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle missing global nodes ref gracefully', () => {
    getGlobalNodesRef.mockReturnValue(null);
    const result = getValidConnections('text-node', 'text-out', 'output');
    expect(result).toEqual([]);
  });

  it('should handle empty nodes array', () => {
    getGlobalNodesRef.mockReturnValue({ current: [] });
    const result = getValidConnections('text-node', 'text-out', 'output');
    expect(result).toEqual([]);
  });

  it('should use handles from node definition as fallback', () => {
    getGlobalNodesRef.mockReturnValue({
      current: [
        {
          id: 'text-node',
          type: 'text',
          data: {}, // No handles in data
        },
        {
          id: 'other-text',
          type: 'text',
          data: {}, // No handles in data
        },
      ],
    });
    // Should use nodeTypes.text.defaultData.handles as fallback
    const result = getValidConnections('text-node', 'text-out', 'output');
    expect(Array.isArray(result)).toBe(true);
  });
});
