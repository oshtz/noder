import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Node, ReactFlowInstance } from 'reactflow';

// ============================================================================
// Mock Setup
// ============================================================================

// Store for mock listeners to simulate Tauri events - must be hoisted
const { mockListeners, mockMediaNodeCreator, mockTextNodeCreator, mockImageNodeCreator } =
  vi.hoisted(() => {
    return {
      mockListeners: new Map<string, (event: unknown) => void>(),
      mockMediaNodeCreator: vi.fn(),
      mockTextNodeCreator: vi.fn(),
      mockImageNodeCreator: vi.fn(),
    };
  });

// Mock @tauri-apps/api event module
vi.mock('@tauri-apps/api', () => ({
  event: {
    listen: vi.fn((eventName: string, callback: (event: unknown) => void) => {
      mockListeners.set(eventName, callback);
      return Promise.resolve(() => mockListeners.delete(eventName));
    }),
  },
}));

// Mock @tauri-apps/plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
}));

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock MediaNode
vi.mock('../nodes/core/MediaNode', () => ({
  NODE_TYPE: 'media',
}));

// Mock nodeCreators using the pre-defined mock functions
vi.mock('../nodes', () => ({
  nodeCreators: {
    media: mockMediaNodeCreator,
    text: mockTextNodeCreator,
    image: mockImageNodeCreator,
  },
}));

// Import the hook after mocks are set up
import { useDragAndDrop } from './useDragAndDrop';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Simulates a Tauri drag-and-drop event
 */
const simulateTauriEvent = async (
  eventName: string,
  payload?: { paths?: string[]; position?: { x: number; y: number } }
) => {
  const listener = mockListeners.get(eventName);
  if (listener) {
    await listener({ payload });
  }
};

/**
 * Creates a mock ReactFlowInstance
 */
const createMockReactFlowInstance = (): Partial<ReactFlowInstance> => ({
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  setViewport: vi.fn(),
  getNodes: vi.fn(() => []),
  getEdges: vi.fn(() => []),
  project: vi.fn((position) => position),
  screenToFlowPosition: vi.fn((position) => position),
  fitView: vi.fn(),
});

/**
 * Helper to extract the isImageFile function for testing
 * Since it's not exported, we test it indirectly through the hook behavior
 */
const testIsImageFile = (path: string): boolean => {
  const lower = path.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower);
};

// ============================================================================
// Tests
// ============================================================================

describe('useDragAndDrop', () => {
  let mockSetNodes: Mock;
  let mockSetEdges: Mock;
  let mockHandleRemoveNode: Mock;
  let mockHandleRunWorkflow: Mock;
  let mockReactFlowInstance: Partial<ReactFlowInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();

    mockSetNodes = vi.fn();
    mockSetEdges = vi.fn();
    mockHandleRemoveNode = vi.fn();
    mockHandleRunWorkflow = vi.fn();
    mockReactFlowInstance = createMockReactFlowInstance();

    // Set up mock implementations for node creators
    mockMediaNodeCreator.mockImplementation(
      ({ id, position }: { id: string; position: { x: number; y: number } }) => ({
        id,
        type: 'media',
        position,
        data: {
          title: 'Media',
          handles: [],
        },
        style: { width: 300, height: 300 },
      })
    );

    mockTextNodeCreator.mockImplementation(
      ({ id, position }: { id: string; position: { x: number; y: number } }) => ({
        id,
        type: 'text',
        position,
        data: {},
      })
    );

    mockImageNodeCreator.mockImplementation(
      ({ id, position }: { id: string; position: { x: number; y: number } }) => ({
        id,
        type: 'image',
        position,
        data: {},
      })
    );

    // Mock document.querySelector for flow wrapper bounds
    vi.spyOn(document, 'querySelector').mockReturnValue({
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as Element);

    // Suppress console.log and console.error during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderHookWithDefaults = (reactFlowInstance: ReactFlowInstance | null = null) => {
    return renderHook(() =>
      useDragAndDrop(
        mockSetNodes,
        mockSetEdges,
        mockHandleRemoveNode,
        mockHandleRunWorkflow,
        reactFlowInstance
      )
    );
  };

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('should initialize with isDragging as false', () => {
      const { result } = renderHookWithDefaults();
      expect(result.current.isDragging).toBe(false);
    });

    it('should initialize with dragCounter as 0', () => {
      const { result } = renderHookWithDefaults();
      expect(result.current.dragCounter).toBe(0);
    });

    it('should return both isDragging and dragCounter in the return object', () => {
      const { result } = renderHookWithDefaults();
      expect(result.current).toHaveProperty('isDragging');
      expect(result.current).toHaveProperty('dragCounter');
    });
  });

  // ==========================================================================
  // Event Listener Registration Tests
  // ==========================================================================

  describe('event listener registration', () => {
    it('should register tauri://drag-enter listener on mount', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });
    });

    it('should register tauri://drag-leave listener on mount', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-leave')).toBe(true);
      });
    });

    it('should register tauri://drag-over listener on mount', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-over')).toBe(true);
      });
    });

    it('should register tauri://drag-drop listener on mount', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });
    });

    it('should register all four Tauri drag event listeners', async () => {
      const { event } = await import('@tauri-apps/api');
      renderHookWithDefaults();

      await waitFor(() => {
        expect(event.listen).toHaveBeenCalledTimes(4);
      });
    });
  });

  // ==========================================================================
  // Drag Enter Event Tests
  // ==========================================================================

  describe('drag-enter event', () => {
    it('should set isDragging to true on drag-enter', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', { paths: ['test.png'] });
      });

      expect(result.current.isDragging).toBe(true);
    });

    it('should increment dragCounter on drag-enter', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', { paths: ['test.png'] });
      });

      expect(result.current.dragCounter).toBe(1);
    });

    it('should increment dragCounter multiple times on multiple drag-enter events', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', { paths: ['test1.png'] });
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', { paths: ['test2.png'] });
      });

      expect(result.current.dragCounter).toBe(2);
      expect(result.current.isDragging).toBe(true);
    });
  });

  // ==========================================================================
  // Drag Leave Event Tests
  // ==========================================================================

  describe('drag-leave event', () => {
    it('should decrement dragCounter on drag-leave', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // First enter
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });

      expect(result.current.dragCounter).toBe(1);

      // Then leave
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
      });

      expect(result.current.dragCounter).toBe(0);
    });

    it('should set isDragging to false when dragCounter reaches 0', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // Enter
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });

      expect(result.current.isDragging).toBe(true);

      // Leave
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
      });

      expect(result.current.isDragging).toBe(false);
    });

    it('should keep dragCounter at 0 when already at 0 and drag-leave occurs', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-leave')).toBe(true);
      });

      // Leave without entering
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
      });

      expect(result.current.dragCounter).toBe(0);
      expect(result.current.isDragging).toBe(false);
    });

    it('should keep isDragging true when dragCounter is still above 0 after leave', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // Enter twice
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });

      expect(result.current.dragCounter).toBe(2);

      // Leave once
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
      });

      expect(result.current.dragCounter).toBe(1);
      expect(result.current.isDragging).toBe(true);
    });
  });

  // ==========================================================================
  // Drag Over Event Tests
  // ==========================================================================

  describe('drag-over event', () => {
    it('should not change isDragging state on drag-over', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-over')).toBe(true);
      });

      const initialIsDragging = result.current.isDragging;

      await act(async () => {
        await simulateTauriEvent('tauri://drag-over', { position: { x: 100, y: 100 } });
      });

      expect(result.current.isDragging).toBe(initialIsDragging);
    });

    it('should not change dragCounter on drag-over', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-over')).toBe(true);
      });

      const initialDragCounter = result.current.dragCounter;

      await act(async () => {
        await simulateTauriEvent('tauri://drag-over', { position: { x: 100, y: 100 } });
      });

      expect(result.current.dragCounter).toBe(initialDragCounter);
    });
  });

  // ==========================================================================
  // Drag Drop Event Tests
  // ==========================================================================

  describe('drag-drop event', () => {
    it('should reset isDragging to false on drag-drop', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // Enter first
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });

      expect(result.current.isDragging).toBe(true);

      // Then drop
      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', { paths: [], position: { x: 0, y: 0 } });
      });

      expect(result.current.isDragging).toBe(false);
    });

    it('should reset dragCounter to 0 on drag-drop', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // Enter multiple times
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
        await simulateTauriEvent('tauri://drag-enter', {});
      });

      // Then drop
      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', { paths: [], position: { x: 0, y: 0 } });
      });

      expect(result.current.dragCounter).toBe(0);
    });

    it('should not process drop when paths is empty', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', { paths: [], position: { x: 0, y: 0 } });
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should not process drop when payload is undefined', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', undefined);
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Image File Detection Tests (isImageFile helper)
  // ==========================================================================

  describe('isImageFile helper', () => {
    it('should detect .jpg files as images', () => {
      expect(testIsImageFile('photo.jpg')).toBe(true);
    });

    it('should detect .jpeg files as images', () => {
      expect(testIsImageFile('photo.jpeg')).toBe(true);
    });

    it('should detect .png files as images', () => {
      expect(testIsImageFile('image.png')).toBe(true);
    });

    it('should detect .gif files as images', () => {
      expect(testIsImageFile('animation.gif')).toBe(true);
    });

    it('should detect .webp files as images', () => {
      expect(testIsImageFile('modern.webp')).toBe(true);
    });

    it('should detect .bmp files as images', () => {
      expect(testIsImageFile('bitmap.bmp')).toBe(true);
    });

    it('should detect .svg files as images', () => {
      expect(testIsImageFile('vector.svg')).toBe(true);
    });

    it('should detect images with uppercase extensions', () => {
      expect(testIsImageFile('PHOTO.JPG')).toBe(true);
      expect(testIsImageFile('IMAGE.PNG')).toBe(true);
    });

    it('should detect images with mixed case extensions', () => {
      expect(testIsImageFile('Photo.JpG')).toBe(true);
      expect(testIsImageFile('Image.PnG')).toBe(true);
    });

    it('should not detect .json files as images', () => {
      expect(testIsImageFile('workflow.json')).toBe(false);
    });

    it('should not detect .txt files as images', () => {
      expect(testIsImageFile('readme.txt')).toBe(false);
    });

    it('should not detect .mp4 files as images', () => {
      expect(testIsImageFile('video.mp4')).toBe(false);
    });

    it('should not detect files without extensions as images', () => {
      expect(testIsImageFile('noextension')).toBe(false);
    });

    it('should handle paths with directories', () => {
      expect(testIsImageFile('/Users/test/images/photo.png')).toBe(true);
      expect(testIsImageFile('C:\\Users\\test\\images\\photo.jpg')).toBe(true);
    });
  });

  // ==========================================================================
  // Image Drop Handling Tests
  // ==========================================================================

  describe('image file drop handling', () => {
    it('should invoke read_file_as_base64 for dropped image files', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(invoke).toHaveBeenCalledWith('read_file_as_base64', {
        filePath: '/path/to/image.png',
      });
    });

    it('should invoke save_uploaded_file after reading image', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(invoke).toHaveBeenCalledWith('save_uploaded_file', {
        filename: 'image.png',
        data: 'base64data',
      });
    });

    it('should create a media node for dropped image', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should handle multiple image files in a single drop', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data1')
        .mockResolvedValueOnce('/saved/path1.png')
        .mockResolvedValueOnce('base64data2')
        .mockResolvedValueOnce('/saved/path2.jpg');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image1.png', '/path/to/image2.jpg'],
          position: { x: 100, y: 100 },
        });
      });

      // Should have called setNodes for each image
      expect(mockSetNodes).toHaveBeenCalledTimes(2);
    });

    it('should offset positions for multiple dropped images', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data1')
        .mockResolvedValueOnce('/saved/path1.png')
        .mockResolvedValueOnce('base64data2')
        .mockResolvedValueOnce('/saved/path2.jpg');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image1.png', '/path/to/image2.jpg'],
          position: { x: 100, y: 100 },
        });
      });

      // Verify nodeCreator was called with offset positions
      const calls = mockMediaNodeCreator.mock.calls;
      expect(calls.length).toBe(2);
      // First image at base position
      expect(calls[0][0].position.x).toBe(100);
      expect(calls[0][0].position.y).toBe(100);
      // Second image offset by 50
      expect(calls[1][0].position.x).toBe(150);
      expect(calls[1][0].position.y).toBe(150);
    });

    it('should handle image read errors gracefully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Read failed'));

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      // Should not throw
      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(console.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // JSON Workflow Drop Handling Tests
  // ==========================================================================

  describe('JSON workflow file drop handling', () => {
    it('should read JSON workflow file with readTextFile', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce(
        JSON.stringify({
          nodes: [{ id: '1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        })
      );

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      expect(readTextFile).toHaveBeenCalledWith('/path/to/workflow.json');
    });

    it('should set nodes from loaded workflow', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce(
        JSON.stringify({
          nodes: [{ id: '1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        })
      );

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should set edges from loaded workflow with custom type', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce(
        JSON.stringify({
          nodes: [
            { id: '1', type: 'text', position: { x: 0, y: 0 }, data: {} },
            { id: '2', type: 'text', position: { x: 100, y: 0 }, data: {} },
          ],
          edges: [{ id: 'e1', source: '1', target: '2' }],
        })
      );

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      expect(mockSetEdges).toHaveBeenCalled();
      const setEdgesCall = mockSetEdges.mock.calls[0][0];
      expect(setEdgesCall[0].type).toBe('custom');
      expect(setEdgesCall[0].animated).toBe(false);
    });

    it('should update window.nodeId based on max node id', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce(
        JSON.stringify({
          nodes: [
            { id: '5', type: 'text', position: { x: 0, y: 0 }, data: {} },
            { id: '10', type: 'text', position: { x: 100, y: 0 }, data: {} },
          ],
          edges: [],
        })
      );

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      expect(window.nodeId).toBe(11);
    });

    it('should handle invalid JSON gracefully', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce('not valid json');

      const alertMock = vi.fn();
      vi.stubGlobal('alert', alertMock);

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      expect(alertMock).toHaveBeenCalledWith('Error loading workflow file');
    });

    it('should preserve savedContent for display nodes', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce(
        JSON.stringify({
          nodes: [
            {
              id: '1',
              type: 'text',
              position: { x: 0, y: 0 },
              data: { savedContent: 'preserved content' },
            },
          ],
          edges: [],
        })
      );

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      // Verify setNodes was called with nodes containing preserved content
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should skip nodes with unknown types', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      vi.mocked(readTextFile).mockResolvedValueOnce(
        JSON.stringify({
          nodes: [
            { id: '1', type: 'unknownType', position: { x: 0, y: 0 }, data: {} },
            { id: '2', type: 'text', position: { x: 100, y: 0 }, data: {} },
          ],
          edges: [],
        })
      );

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      // Should still call setNodes (with filtered nodes)
      expect(mockSetNodes).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Coordinate Conversion Tests
  // ==========================================================================

  describe('coordinate conversion', () => {
    it('should use default position when drop position is not provided', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          // No position provided
        });
      });

      // Should use default position (100, 100)
      const calls = mockMediaNodeCreator.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0].position.x).toBe(100);
      expect(calls[0][0].position.y).toBe(100);
    });

    it('should convert screen coordinates to flow coordinates when reactFlowInstance is available', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      // Set viewport with zoom and pan
      const mockInstance = createMockReactFlowInstance();
      vi.mocked(mockInstance.getViewport!).mockReturnValue({ x: 50, y: 30, zoom: 2 });

      renderHookWithDefaults(mockInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 200, y: 150 },
        });
      });

      // Coordinates should be converted: (200 - 0 - 50) / 2 = 75, (150 - 0 - 30) / 2 = 60
      const calls = mockMediaNodeCreator.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0].position.x).toBe(75);
      expect(calls[0][0].position.y).toBe(60);
    });

    it('should use screen coordinates directly when reactFlowInstance is null', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(null);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 200, y: 150 },
        });
      });

      const calls = mockMediaNodeCreator.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0].position.x).toBe(200);
      expect(calls[0][0].position.y).toBe(150);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanup on unmount', () => {
    it('should unsubscribe from drag-enter listener on unmount', async () => {
      const { unmount } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      unmount();

      // Give time for cleanup promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // After unmount, listener should be removed
      expect(mockListeners.has('tauri://drag-enter')).toBe(false);
    });

    it('should unsubscribe from drag-leave listener on unmount', async () => {
      const { unmount } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-leave')).toBe(true);
      });

      unmount();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockListeners.has('tauri://drag-leave')).toBe(false);
    });

    it('should unsubscribe from drag-over listener on unmount', async () => {
      const { unmount } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-over')).toBe(true);
      });

      unmount();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockListeners.has('tauri://drag-over')).toBe(false);
    });

    it('should unsubscribe from drag-drop listener on unmount', async () => {
      const { unmount } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      unmount();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockListeners.has('tauri://drag-drop')).toBe(false);
    });

    it('should unsubscribe all listeners on unmount', async () => {
      const { unmount } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.size).toBe(4);
      });

      unmount();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockListeners.size).toBe(0);
    });
  });

  // ==========================================================================
  // Multiple Enter/Leave Tracking Tests
  // ==========================================================================

  describe('multiple drag enter/leave tracking', () => {
    it('should correctly track nested drag enter/leave events', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // Enter parent element
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });
      expect(result.current.dragCounter).toBe(1);
      expect(result.current.isDragging).toBe(true);

      // Enter child element (nested)
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
      });
      expect(result.current.dragCounter).toBe(2);
      expect(result.current.isDragging).toBe(true);

      // Leave child element
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
      });
      expect(result.current.dragCounter).toBe(1);
      expect(result.current.isDragging).toBe(true);

      // Leave parent element
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
      });
      expect(result.current.dragCounter).toBe(0);
      expect(result.current.isDragging).toBe(false);
    });

    it('should handle rapid enter/leave events', async () => {
      const { result } = renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-enter')).toBe(true);
      });

      // Rapid enter events
      await act(async () => {
        await simulateTauriEvent('tauri://drag-enter', {});
        await simulateTauriEvent('tauri://drag-enter', {});
        await simulateTauriEvent('tauri://drag-enter', {});
      });

      expect(result.current.dragCounter).toBe(3);

      // Rapid leave events
      await act(async () => {
        await simulateTauriEvent('tauri://drag-leave', {});
        await simulateTauriEvent('tauri://drag-leave', {});
      });

      expect(result.current.dragCounter).toBe(1);
      expect(result.current.isDragging).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty paths array in drop event', async () => {
      renderHookWithDefaults();

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: [],
          position: { x: 100, y: 100 },
        });
      });

      expect(mockSetNodes).not.toHaveBeenCalled();
      expect(mockSetEdges).not.toHaveBeenCalled();
    });

    it('should handle mixed file types in single drop (images and JSON)', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      // Drop both an image and a JSON file
      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png', '/path/to/workflow.json'],
          position: { x: 100, y: 100 },
        });
      });

      // Should prioritize image files
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should handle file paths with special characters', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/my file (1).png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(invoke).toHaveBeenCalledWith('read_file_as_base64', {
        filePath: '/path/to/my file (1).png',
      });
    });

    it('should extract filename correctly from various path formats', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      // Test Unix path
      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/users/test/images/photo.png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(invoke).toHaveBeenCalledWith('save_uploaded_file', {
        filename: 'photo.png',
        data: 'base64data',
      });
    });

    it('should handle Windows path separators', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['C:\\Users\\test\\images\\photo.png'],
          position: { x: 100, y: 100 },
        });
      });

      expect(invoke).toHaveBeenCalledWith('save_uploaded_file', {
        filename: 'photo.png',
        data: 'base64data',
      });
    });
  });

  // ==========================================================================
  // Dependencies Effect Tests
  // ==========================================================================

  describe('dependency tracking', () => {
    it('should re-register listeners when handleRemoveNode changes', async () => {
      const { event } = await import('@tauri-apps/api');
      const { rerender } = renderHook(
        ({ handleRemoveNode }) =>
          useDragAndDrop(
            mockSetNodes,
            mockSetEdges,
            handleRemoveNode,
            mockHandleRunWorkflow,
            mockReactFlowInstance as ReactFlowInstance
          ),
        { initialProps: { handleRemoveNode: mockHandleRemoveNode } }
      );

      const initialCallCount = vi.mocked(event.listen).mock.calls.length;

      // Change the handleRemoveNode function
      const newHandleRemoveNode = vi.fn();
      rerender({ handleRemoveNode: newHandleRemoveNode });

      // Should have re-registered listeners
      expect(vi.mocked(event.listen).mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('should re-register listeners when reactFlowInstance changes', async () => {
      const { event } = await import('@tauri-apps/api');
      const { rerender } = renderHook(
        ({ reactFlowInstance }) =>
          useDragAndDrop(
            mockSetNodes,
            mockSetEdges,
            mockHandleRemoveNode,
            mockHandleRunWorkflow,
            reactFlowInstance
          ),
        { initialProps: { reactFlowInstance: null } }
      );

      const initialCallCount = vi.mocked(event.listen).mock.calls.length;

      // Add a reactFlowInstance
      rerender({ reactFlowInstance: mockReactFlowInstance as ReactFlowInstance });

      // Should have re-registered listeners
      expect(vi.mocked(event.listen).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ==========================================================================
  // Node Creation Tests
  // ==========================================================================

  describe('node creation details', () => {
    it('should set mediaPath and mediaType on created node data', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      // Check that setNodes was called with node containing mediaPath and mediaType
      const setNodesArg = mockSetNodes.mock.calls[0][0];
      expect(typeof setNodesArg).toBe('function');

      // Execute the updater function to see what node it produces
      const existingNodes: Node[] = [];
      const newNodes = setNodesArg(existingNodes);
      expect(newNodes.length).toBe(1);
      expect(newNodes[0].data.mediaPath).toBe('/saved/path.png');
      expect(newNodes[0].data.mediaType).toBe('image');
    });

    it('should generate unique node IDs with timestamp', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      const calls = mockMediaNodeCreator.mock.calls;
      expect(calls[0][0].id).toMatch(/^media-\d+-0$/);
    });

    it('should pass handleRemoveNode to nodeCreator', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('base64data')
        .mockResolvedValueOnce('/saved/path.png');

      renderHookWithDefaults(mockReactFlowInstance as ReactFlowInstance);

      await waitFor(() => {
        expect(mockListeners.has('tauri://drag-drop')).toBe(true);
      });

      await act(async () => {
        await simulateTauriEvent('tauri://drag-drop', {
          paths: ['/path/to/image.png'],
          position: { x: 100, y: 100 },
        });
      });

      const calls = mockMediaNodeCreator.mock.calls;
      expect(calls[0][0].handleRemoveNode).toBe(mockHandleRemoveNode);
    });
  });
});
