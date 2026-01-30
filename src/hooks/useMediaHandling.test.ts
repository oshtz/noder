import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaHandling } from './useMediaHandling';
import type { ReactFlowInstance, Node } from 'reactflow';
import type { DragEvent } from 'react';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock workflowHelpers
vi.mock('../utils/workflowHelpers', () => ({
  isImageFile: vi.fn((filename: string) => {
    const lower = filename.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower);
  }),
}));

// Helper to create mock ReactFlow instance
const createMockReactFlowInstance = (overrides?: Partial<ReactFlowInstance>): ReactFlowInstance =>
  ({
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setViewport: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
    toObject: vi.fn(),
    getNodes: vi.fn(() => []),
    getNode: vi.fn(),
    getEdges: vi.fn(() => []),
    getEdge: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    deleteElements: vi.fn(),
    project: vi.fn(),
    screenToFlowPosition: vi.fn(),
    flowToScreenPosition: vi.fn(),
    viewportInitialized: true,
    ...overrides,
  }) as unknown as ReactFlowInstance;

// Helper to create mock DragEvent
const createMockDragEvent = (
  overrides?: Partial<DragEvent<HTMLDivElement>>
): DragEvent<HTMLDivElement> => {
  const dataTransferData: Record<string, string> = {};
  const files: File[] = [];

  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 100,
    clientY: 100,
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
      }),
    } as HTMLElement,
    dataTransfer: {
      types: Object.keys(dataTransferData),
      getData: vi.fn((type: string) => dataTransferData[type] || ''),
      setData: (type: string, data: string) => {
        dataTransferData[type] = data;
      },
      files: files as unknown as FileList,
      dropEffect: 'none' as DataTransfer['dropEffect'],
      effectAllowed: 'all' as DataTransfer['effectAllowed'],
      items: [] as unknown as DataTransferItemList,
      clearData: vi.fn(),
      setDragImage: vi.fn(),
    },
    ...overrides,
  } as unknown as DragEvent<HTMLDivElement>;
};

// Helper to create mock file
const createMockFile = (name: string, type: string, size = 1024): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('useMediaHandling', () => {
  let mockReactFlowInstance: ReactFlowInstance;
  let mockHandleAddNode: ReturnType<typeof vi.fn>;
  let mockSetNodes: ReturnType<typeof vi.fn>;
  let mockFlowWrapper: HTMLDivElement;
  let mockReactFlowElement: HTMLDivElement;
  let mockReactFlowRendererElement: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Silence console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockReactFlowInstance = createMockReactFlowInstance();
    mockHandleAddNode = vi.fn(() => 'new-node-id');
    mockSetNodes = vi.fn();

    // Create DOM elements for querySelector
    mockFlowWrapper = document.createElement('div');
    mockFlowWrapper.className = 'flow-wrapper';
    mockFlowWrapper.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    mockReactFlowElement = document.createElement('div');
    mockReactFlowElement.className = 'react-flow';
    mockReactFlowElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    mockReactFlowRendererElement = document.createElement('div');
    mockReactFlowRendererElement.className = 'react-flow__renderer';
    mockReactFlowRendererElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    document.body.appendChild(mockFlowWrapper);
    document.body.appendChild(mockReactFlowElement);
    document.body.appendChild(mockReactFlowRendererElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Clean up DOM
    if (mockFlowWrapper.parentNode) {
      mockFlowWrapper.parentNode.removeChild(mockFlowWrapper);
    }
    if (mockReactFlowElement.parentNode) {
      mockReactFlowElement.parentNode.removeChild(mockReactFlowElement);
    }
    if (mockReactFlowRendererElement.parentNode) {
      mockReactFlowRendererElement.parentNode.removeChild(mockReactFlowRendererElement);
    }
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should return handleImageDrop function', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(typeof result.current.handleImageDrop).toBe('function');
    });

    it('should return handleGalleryDragStart function', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(typeof result.current.handleGalleryDragStart).toBe('function');
    });

    it('should return handleGalleryDragEnd function', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(typeof result.current.handleGalleryDragEnd).toBe('function');
    });

    it('should return lastMousePositionRef', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(result.current.lastMousePositionRef).toBeDefined();
      expect(result.current.lastMousePositionRef.current).toEqual({ x: 0, y: 0 });
    });

    it('should initialize with null reactFlowInstance', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: null,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(result.current.handleImageDrop).toBeDefined();
    });
  });

  // ============================================================================
  // handleGalleryDragStart Tests
  // ============================================================================

  describe('handleGalleryDragStart', () => {
    it('should store drag data when called', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
        prompt: 'test prompt',
        model: 'test-model',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      // Verify the function was called without error
      expect(console.log).toHaveBeenCalledWith(
        '[Gallery Drag] Start - storing data:',
        dragData,
        'at:',
        100,
        200
      );
    });

    it('should set up mouseup event listener', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      // Advance timer for the setTimeout
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), {
        once: true,
      });
    });

    it('should not create node if mouse movement is less than 30 pixels', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      // Advance timer for the setTimeout
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Simulate mouseup with minimal movement (< 30 pixels)
      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: 105,
        clientY: 205,
        bubbles: true,
      });

      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should create node if mouse movement is 30 pixels or more', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
        prompt: 'test prompt',
        model: 'test-model',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      // Advance timer for the setTimeout
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Simulate mouseup with sufficient movement (>= 30 pixels)
      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 300,
        bubbles: true,
      });

      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(mockHandleAddNode).toHaveBeenCalledWith('media', expect.any(Object));
    });

    it('should not create node when reactFlowInstance is null', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: null,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 300,
        bubbles: true,
      });

      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should not create node when drop is outside canvas bounds', () => {
      mockReactFlowElement.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        right: 500,
        bottom: 400,
        width: 400,
        height: 300,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Drop outside bounds (before left edge)
      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: 50,
        clientY: 200,
        bubbles: true,
      });

      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should update node data with media info after creation', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
        prompt: 'test prompt',
        model: 'test-model',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 300,
        bubbles: true,
      });

      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      // Advance timer for the setTimeout in createMediaNodeFromGallery
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // handleGalleryDragEnd Tests
  // ============================================================================

  describe('handleGalleryDragEnd', () => {
    it('should log drag end event', () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      act(() => {
        result.current.handleGalleryDragEnd(100, 200);
      });

      expect(console.log).toHaveBeenCalledWith('[Gallery Drag] DragEnd event at:', 100, 200);
    });
  });

  // ============================================================================
  // handleImageDrop Tests
  // ============================================================================

  describe('handleImageDrop', () => {
    it('should prevent default and stop propagation', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const mockEvent = createMockDragEvent();

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should handle gallery output JSON data from application/json', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/gallery/image.png',
          prompt: 'gallery prompt',
          model: 'gallery-model',
        },
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      expect(mockHandleAddNode).toHaveBeenCalledWith('media', expect.any(Object));
    });

    it('should handle gallery output JSON data from text/plain fallback', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'video',
          value: '/path/to/video.mp4',
        },
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'text/plain') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['text/plain'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      expect(mockHandleAddNode).toHaveBeenCalledWith('media', expect.any(Object));
    });

    it('should not process non-gallery-output JSON data', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const otherData = {
        type: 'some-other-type',
        data: 'some data',
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(otherData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return 'invalid json{';
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      // Should not throw, should handle gracefully
      expect(console.log).toHaveBeenCalledWith(
        '[Gallery Drop] Error parsing JSON or not a gallery item:',
        expect.any(Error)
      );
    });

    it('should not create node when reactFlowInstance is null for gallery drop', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: null,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/image.png',
        },
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should handle dropped image files', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/image.png');

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageFile = createMockFile('test-image.png', 'image/png');

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [imageFile],
        writable: false,
      });

      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        result.current.handleImageDrop(mockEvent);

        // Trigger FileReader onload
        if (mockFileReader.onload) {
          mockFileReader.onload({
            target: { result: 'data:image/png;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    });

    it('should handle multiple dropped image files', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/image.png');

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageFile1 = createMockFile('test-image1.png', 'image/png');
      const imageFile2 = createMockFile('test-image2.jpg', 'image/jpeg');

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [imageFile1, imageFile2],
        writable: false,
      });

      const fileReaders: Array<{
        readAsDataURL: ReturnType<typeof vi.fn>;
        onload: ((event: ProgressEvent<FileReader>) => void) | null;
      }> = [];
      vi.spyOn(global, 'FileReader').mockImplementation(() => {
        const reader = {
          readAsDataURL: vi.fn(),
          onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
          result: 'data:image/png;base64,testdata',
        };
        fileReaders.push(reader);
        return reader as unknown as FileReader;
      });

      await act(async () => {
        result.current.handleImageDrop(mockEvent);

        // Trigger FileReader onload for each file
        for (const reader of fileReaders) {
          if (reader.onload) {
            reader.onload({
              target: { result: 'data:image/png;base64,testdata' },
            } as ProgressEvent<FileReader>);
          }
        }

        await vi.runAllTimersAsync();
      });

      expect(fileReaders.length).toBe(2);
    });

    it('should filter out non-image files from dropped files', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const textFile = createMockFile('document.txt', 'text/plain');
      const pdfFile = createMockFile('document.pdf', 'application/pdf');

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [textFile, pdfFile],
        writable: false,
      });

      const fileReaders: Array<{ readAsDataURL: ReturnType<typeof vi.fn> }> = [];
      vi.spyOn(global, 'FileReader').mockImplementation(() => {
        const reader = {
          readAsDataURL: vi.fn(),
          onload: null,
          result: '',
        };
        fileReaders.push(reader);
        return reader as unknown as FileReader;
      });

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      // No FileReaders should be created for non-image files
      expect(fileReaders.length).toBe(0);
    });

    it('should handle file save error gracefully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageFile = createMockFile('test-image.png', 'image/png');

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [imageFile],
        writable: false,
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        result.current.handleImageDrop(mockEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/png;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(console.error).toHaveBeenCalledWith('Error saving dropped image:', expect.any(Error));
    });

    it('should calculate correct drop position with viewport offset', async () => {
      const mockViewport = { x: 50, y: 75, zoom: 2 };
      const mockRFInstance = createMockReactFlowInstance({
        getViewport: vi.fn(() => mockViewport),
      });

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockRFInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/image.png',
        },
      };

      const mockEvent = createMockDragEvent();
      mockEvent.clientX = 200;
      mockEvent.clientY = 150;
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      // Position calculation: (clientX - bounds.left - viewport.x) / viewport.zoom
      // x: (200 - 0 - 50) / 2 = 75
      // y: (150 - 0 - 75) / 2 = 37.5
      expect(mockHandleAddNode).toHaveBeenCalledWith('media', { x: 75, y: 37.5 });
    });

    it('should use default viewport when reactFlowInstance is null for file drop', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/image.png');

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: null,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageFile = createMockFile('test-image.png', 'image/png');

      const mockEvent = createMockDragEvent();
      mockEvent.clientX = 100;
      mockEvent.clientY = 100;
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [imageFile],
        writable: false,
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        result.current.handleImageDrop(mockEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/png;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      // With default viewport { x: 0, y: 0, zoom: 1 }, position should equal client position
      expect(mockHandleAddNode).toHaveBeenCalledWith('media', { x: 100, y: 100 });
    });
  });

  // ============================================================================
  // Global Drag Over Effect Tests
  // ============================================================================

  describe('global drag over effect', () => {
    it('should add dragover event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
    });

    it('should add drop event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    it('should handle global drop with gallery output', async () => {
      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/image.png',
          prompt: 'test prompt',
        },
      };

      const dropEvent = new Event('drop', { bubbles: true }) as Event & {
        dataTransfer: DataTransfer;
        clientX: number;
        clientY: number;
      };
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          types: ['application/json'],
          getData: (type: string) => {
            if (type === 'application/json') return JSON.stringify(galleryData);
            return '';
          },
        },
      });
      Object.defineProperty(dropEvent, 'clientX', { value: 100 });
      Object.defineProperty(dropEvent, 'clientY', { value: 100 });

      await act(async () => {
        document.dispatchEvent(dropEvent);
        await vi.runAllTimersAsync();
      });

      expect(mockHandleAddNode).toHaveBeenCalledWith('media', expect.any(Object));
    });
  });

  // ============================================================================
  // Mouse Position Tracking Effect Tests
  // ============================================================================

  describe('mouse position tracking effect', () => {
    it('should track mouse position on flow-wrapper mousemove', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      // Simulate mousemove event on flow-wrapper
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 250,
        bubbles: true,
      });

      act(() => {
        mockFlowWrapper.dispatchEvent(mouseMoveEvent);
      });

      // The position should be relative to the flow wrapper bounds
      expect(result.current.lastMousePositionRef.current).toEqual({
        x: 150,
        y: 250,
      });
    });

    it('should not crash when flow-wrapper is not found', () => {
      // Remove flow-wrapper before rendering hook
      if (mockFlowWrapper.parentNode) {
        mockFlowWrapper.parentNode.removeChild(mockFlowWrapper);
      }

      expect(() => {
        renderHook(() =>
          useMediaHandling({
            reactFlowInstance: mockReactFlowInstance,
            handleAddNode: mockHandleAddNode,
            setNodes: mockSetNodes,
          })
        );
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Clipboard Paste Effect Tests
  // ============================================================================

  describe('clipboard paste effect', () => {
    it('should add paste event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
    });

    it('should remove paste event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function));
    });

    it('should handle image paste from clipboard', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/pasted-image.png');

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageBlob = new Blob([''], { type: 'image/png' });
      const mockFile = new File([imageBlob], 'pasted.png', { type: 'image/png' });

      const mockClipboardItem = {
        type: 'image/png',
        getAsFile: () => mockFile,
      };

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [mockClipboardItem],
        },
      });
      Object.defineProperty(pasteEvent, 'preventDefault', {
        value: vi.fn(),
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        document.dispatchEvent(pasteEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/png;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(mockFileReader.readAsDataURL).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith(
        'save_uploaded_file',
        expect.objectContaining({
          data: 'data:image/png;base64,testdata',
        })
      );
    });

    it('should not process non-image clipboard items', async () => {
      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const mockClipboardItem = {
        type: 'text/plain',
        getAsString: vi.fn(),
      };

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [mockClipboardItem],
        },
      });

      const fileReaderSpy = vi.spyOn(global, 'FileReader');

      await act(async () => {
        document.dispatchEvent(pasteEvent);
      });

      expect(fileReaderSpy).not.toHaveBeenCalled();
    });

    it('should handle paste error gracefully', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValue(new Error('Save failed'));

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageBlob = new Blob([''], { type: 'image/png' });
      const mockFile = new File([imageBlob], 'pasted.png', { type: 'image/png' });

      const mockClipboardItem = {
        type: 'image/png',
        getAsFile: () => mockFile,
      };

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [mockClipboardItem],
        },
      });
      Object.defineProperty(pasteEvent, 'preventDefault', {
        value: vi.fn(),
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        document.dispatchEvent(pasteEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/png;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(console.error).toHaveBeenCalledWith('Error saving pasted image:', expect.any(Error));
    });

    it('should skip clipboard item if getAsFile returns null', async () => {
      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const mockClipboardItem = {
        type: 'image/png',
        getAsFile: () => null,
      };

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [mockClipboardItem],
        },
      });
      Object.defineProperty(pasteEvent, 'preventDefault', {
        value: vi.fn(),
      });

      const fileReaderSpy = vi.spyOn(global, 'FileReader');

      await act(async () => {
        document.dispatchEvent(pasteEvent);
      });

      expect(fileReaderSpy).not.toHaveBeenCalled();
    });

    it('should use correct extension based on image type', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/pasted-image.jpg');

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageBlob = new Blob([''], { type: 'image/jpeg' });
      const mockFile = new File([imageBlob], 'pasted.jpg', { type: 'image/jpeg' });

      const mockClipboardItem = {
        type: 'image/jpeg',
        getAsFile: () => mockFile,
      };

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [mockClipboardItem],
        },
      });
      Object.defineProperty(pasteEvent, 'preventDefault', {
        value: vi.fn(),
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        document.dispatchEvent(pasteEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/jpeg;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(invoke).toHaveBeenCalledWith(
        'save_uploaded_file',
        expect.objectContaining({
          filename: expect.stringMatching(/pasted-image-\d+\.jpeg/),
        })
      );
    });

    it('should use png as default extension for unknown image types', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/pasted-image.png');

      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageBlob = new Blob([''], { type: 'image/' }); // No specific subtype
      const mockFile = new File([imageBlob], 'pasted', { type: 'image/' });

      const mockClipboardItem = {
        type: 'image/',
        getAsFile: () => mockFile,
      };

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [mockClipboardItem],
        },
      });
      Object.defineProperty(pasteEvent, 'preventDefault', {
        value: vi.fn(),
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        document.dispatchEvent(pasteEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(invoke).toHaveBeenCalledWith(
        'save_uploaded_file',
        expect.objectContaining({
          filename: expect.stringMatching(/pasted-image-\d+\.png/),
        })
      );
    });
  });

  // ============================================================================
  // Node Data Update Tests
  // ============================================================================

  describe('node data updates', () => {
    it('should update node with mediaPath and mediaType after gallery drop', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'video',
          value: '/path/to/video.mp4',
          prompt: 'video prompt',
          model: 'video-model',
        },
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
        await vi.advanceTimersByTime(50);
      });

      expect(mockSetNodes).toHaveBeenCalled();

      // Get the updater function that was passed to setNodes
      const setNodesCall = mockSetNodes.mock.calls[0];
      const updaterFn = setNodesCall[0];

      // Test the updater function
      const testNodes: Node[] = [
        { id: 'new-node-id', type: 'media', position: { x: 0, y: 0 }, data: {} },
        { id: 'other-node', type: 'text', position: { x: 100, y: 100 }, data: {} },
      ];

      const updatedNodes = updaterFn(testNodes);

      expect(updatedNodes[0].data).toEqual({
        mediaPath: '/path/to/video.mp4',
        mediaType: 'video',
        prompt: 'video prompt',
        model: 'video-model',
      });
      expect(updatedNodes[1].data).toEqual({});
    });

    it('should not include prompt if not provided in gallery data', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/image.png',
        },
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
        await vi.advanceTimersByTime(50);
      });

      const setNodesCall = mockSetNodes.mock.calls[0];
      const updaterFn = setNodesCall[0];

      const testNodes: Node[] = [
        { id: 'new-node-id', type: 'media', position: { x: 0, y: 0 }, data: {} },
      ];

      const updatedNodes = updaterFn(testNodes);

      expect(updatedNodes[0].data).toEqual({
        mediaPath: '/path/to/image.png',
        mediaType: 'image',
      });
      expect(updatedNodes[0].data.prompt).toBeUndefined();
      expect(updatedNodes[0].data.model).toBeUndefined();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle missing react-flow element gracefully', async () => {
      if (mockReactFlowElement.parentNode) {
        mockReactFlowElement.parentNode.removeChild(mockReactFlowElement);
      }

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const dragData = {
        type: 'image',
        value: '/path/to/image.png',
      };

      act(() => {
        result.current.handleGalleryDragStart(dragData, 100, 200);
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      const mouseUpEvent = new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 300,
        bubbles: true,
      });

      act(() => {
        document.dispatchEvent(mouseUpEvent);
      });

      expect(console.error).toHaveBeenCalledWith('[Gallery Drag] ReactFlow wrapper not found');
    });

    it('should handle missing react-flow__renderer element for handleImageDrop', async () => {
      if (mockReactFlowRendererElement.parentNode) {
        mockReactFlowRendererElement.parentNode.removeChild(mockReactFlowRendererElement);
      }

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/image.png',
        },
      };

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      expect(console.error).toHaveBeenCalledWith('[Drop] ReactFlow wrapper not found');
    });

    it('should handle clipboard paste without clipboardData', async () => {
      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: null,
      });

      await act(async () => {
        document.dispatchEvent(pasteEvent);
      });

      // Should not crash
      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should handle clipboard paste without items', async () => {
      renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const pasteEvent = new Event('paste') as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: null,
        },
      });

      await act(async () => {
        document.dispatchEvent(pasteEvent);
      });

      // Should not crash
      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should handle null dataTransfer in drop event', async () => {
      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 100,
        currentTarget: {
          getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
          }),
        },
        dataTransfer: {
          types: [],
          getData: () => '',
          files: [],
        },
      } as unknown as DragEvent<HTMLDivElement>;

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      // Should not crash, no nodes created
      expect(mockHandleAddNode).not.toHaveBeenCalled();
    });

    it('should handle files dropped with isImageFile check for extension', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/image.webp');

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      // File with image extension but no MIME type
      const imageFile = createMockFile('test-image.webp', '');

      const mockEvent = createMockDragEvent();
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [imageFile],
        writable: false,
      });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/webp;base64,testdata',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      );

      await act(async () => {
        result.current.handleImageDrop(mockEvent);

        if (mockFileReader.onload) {
          await mockFileReader.onload({
            target: { result: 'data:image/webp;base64,testdata' },
          } as ProgressEvent<FileReader>);
        }

        await vi.runAllTimersAsync();
      });

      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    });
  });

  // ============================================================================
  // Callback Stability Tests
  // ============================================================================

  describe('callback stability', () => {
    it('should maintain stable handleImageDrop reference', () => {
      const { result, rerender } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const firstRef = result.current.handleImageDrop;

      rerender();

      expect(result.current.handleImageDrop).toBe(firstRef);
    });

    it('should maintain stable handleGalleryDragStart reference', () => {
      const { result, rerender } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const firstRef = result.current.handleGalleryDragStart;

      rerender();

      expect(result.current.handleGalleryDragStart).toBe(firstRef);
    });

    it('should maintain stable handleGalleryDragEnd reference', () => {
      const { result, rerender } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const firstRef = result.current.handleGalleryDragEnd;

      rerender();

      expect(result.current.handleGalleryDragEnd).toBe(firstRef);
    });

    it('should update callbacks when dependencies change', () => {
      const { result, rerender } = renderHook(
        ({ rfInstance }) =>
          useMediaHandling({
            reactFlowInstance: rfInstance,
            handleAddNode: mockHandleAddNode,
            setNodes: mockSetNodes,
          }),
        { initialProps: { rfInstance: mockReactFlowInstance } }
      );

      const firstRef = result.current.handleImageDrop;

      const newRfInstance = createMockReactFlowInstance();
      rerender({ rfInstance: newRfInstance });

      // Reference should change when dependencies change
      expect(result.current.handleImageDrop).not.toBe(firstRef);
    });
  });

  // ============================================================================
  // Position Calculation Tests
  // ============================================================================

  describe('position calculations', () => {
    it('should offset positions for multiple dropped files', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/saved/path/image.png');

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockReactFlowInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const imageFile1 = createMockFile('image1.png', 'image/png');
      const imageFile2 = createMockFile('image2.png', 'image/png');
      const imageFile3 = createMockFile('image3.png', 'image/png');

      const mockEvent = createMockDragEvent();
      mockEvent.clientX = 100;
      mockEvent.clientY = 100;
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
      (mockEvent.dataTransfer as DataTransfer).types = [];
      Object.defineProperty(mockEvent.dataTransfer, 'files', {
        value: [imageFile1, imageFile2, imageFile3],
        writable: false,
      });

      const fileReaders: Array<{
        readAsDataURL: ReturnType<typeof vi.fn>;
        onload: ((event: ProgressEvent<FileReader>) => void) | null;
      }> = [];
      vi.spyOn(global, 'FileReader').mockImplementation(() => {
        const reader = {
          readAsDataURL: vi.fn(),
          onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
          result: 'data:image/png;base64,testdata',
        };
        fileReaders.push(reader);
        return reader as unknown as FileReader;
      });

      await act(async () => {
        result.current.handleImageDrop(mockEvent);

        for (const reader of fileReaders) {
          if (reader.onload) {
            reader.onload({
              target: { result: 'data:image/png;base64,testdata' },
            } as ProgressEvent<FileReader>);
          }
        }

        await vi.runAllTimersAsync();
      });

      // Each file should be offset by 50 pixels
      expect(mockHandleAddNode).toHaveBeenNthCalledWith(1, 'media', { x: 100, y: 100 });
      expect(mockHandleAddNode).toHaveBeenNthCalledWith(2, 'media', { x: 150, y: 150 });
      expect(mockHandleAddNode).toHaveBeenNthCalledWith(3, 'media', { x: 200, y: 200 });
    });

    it('should calculate position correctly with zoom level', async () => {
      const mockViewport = { x: 0, y: 0, zoom: 0.5 };
      const mockRFInstance = createMockReactFlowInstance({
        getViewport: vi.fn(() => mockViewport),
      });

      const { result } = renderHook(() =>
        useMediaHandling({
          reactFlowInstance: mockRFInstance,
          handleAddNode: mockHandleAddNode,
          setNodes: mockSetNodes,
        })
      );

      const galleryData = {
        type: 'gallery-output',
        output: {
          type: 'image',
          value: '/path/to/image.png',
        },
      };

      const mockEvent = createMockDragEvent();
      mockEvent.clientX = 100;
      mockEvent.clientY = 100;
      (mockEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => {
          if (type === 'application/json') return JSON.stringify(galleryData);
          return '';
        }
      );
      (mockEvent.dataTransfer as DataTransfer).types = ['application/json'];

      await act(async () => {
        await result.current.handleImageDrop(mockEvent);
      });

      // Position with zoom 0.5: (100 - 0 - 0) / 0.5 = 200
      expect(mockHandleAddNode).toHaveBeenCalledWith('media', { x: 200, y: 200 });
    });
  });
});
