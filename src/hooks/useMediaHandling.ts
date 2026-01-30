/**
 * Hook for handling media drag/drop/paste operations
 * Extracted from App.tsx to reduce component size
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DragEvent } from 'react';
import type { ReactFlowInstance, Node } from 'reactflow';
import { invoke } from '@tauri-apps/api/core';
import { isImageFile } from '../utils/workflowHelpers';

// ============================================================================
// Types
// ============================================================================

export interface GalleryDragData {
  type: string;
  value: string;
  prompt?: string;
  model?: string;
}

export interface UseMediaHandlingOptions {
  reactFlowInstance: ReactFlowInstance | null;
  handleAddNode: (type: string, position: { x: number; y: number }) => string | null;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

export interface UseMediaHandlingReturn {
  handleImageDrop: (e: DragEvent<HTMLDivElement>) => Promise<void>;
  handleGalleryDragStart: (dragData: GalleryDragData, startX: number, startY: number) => void;
  handleGalleryDragEnd: (clientX: number, clientY: number) => void;
  lastMousePositionRef: React.MutableRefObject<{ x: number; y: number }>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMediaHandling({
  reactFlowInstance,
  handleAddNode,
  setNodes,
}: UseMediaHandlingOptions): UseMediaHandlingReturn {
  const galleryDragDataRef = useRef<{
    data: GalleryDragData;
    startX: number;
    startY: number;
  } | null>(null);

  const lastMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * Creates a media node from gallery drag data
   */
  const createMediaNodeFromGallery = useCallback(
    (dragData: GalleryDragData, dropX: number, dropY: number): void => {
      const flowWrapper = document.querySelector('.react-flow');
      if (!flowWrapper) {
        console.error('[Gallery Drag] ReactFlow wrapper not found');
        return;
      }

      const bounds = flowWrapper.getBoundingClientRect();
      if (
        dropX < bounds.left ||
        dropX > bounds.right ||
        dropY < bounds.top ||
        dropY > bounds.bottom
      ) {
        console.log('[Gallery Drag] Drop outside canvas bounds');
        return;
      }

      if (!reactFlowInstance) {
        console.error('[Gallery Drag] ReactFlow instance not available');
        return;
      }

      const viewport = reactFlowInstance.getViewport();
      const x = (dropX - bounds.left - viewport.x) / viewport.zoom;
      const y = (dropY - bounds.top - viewport.y) / viewport.zoom;

      console.log('[Gallery Drag] Creating node at:', { x, y });

      const nodeId = handleAddNode('media', { x, y });
      console.log('[Gallery Drag] Created node:', nodeId);

      setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    mediaPath: dragData.value,
                    mediaType: dragData.type,
                    ...(dragData.prompt ? { prompt: dragData.prompt } : {}),
                    ...(dragData.model ? { model: dragData.model } : {}),
                  },
                }
              : n
          )
        );
        console.log('[Gallery Drag] Node data updated');
      }, 50);
    },
    [reactFlowInstance, handleAddNode, setNodes]
  );

  /**
   * Handles gallery drag start
   */
  const handleGalleryDragStart = useCallback(
    (dragData: GalleryDragData, startX: number, startY: number): void => {
      console.log('[Gallery Drag] Start - storing data:', dragData, 'at:', startX, startY);
      galleryDragDataRef.current = {
        data: dragData,
        startX,
        startY,
      };

      const handleMouseUp = (e: globalThis.MouseEvent): void => {
        const stored = galleryDragDataRef.current;
        galleryDragDataRef.current = null;
        document.removeEventListener('mouseup', handleMouseUp);

        if (!stored) return;

        const distance = Math.sqrt(
          Math.pow(e.clientX - stored.startX, 2) + Math.pow(e.clientY - stored.startY, 2)
        );

        console.log('[Gallery Drag] MouseUp at:', e.clientX, e.clientY, 'distance:', distance);

        if (distance < 30) {
          console.log('[Gallery Drag] Not enough movement, ignoring');
          return;
        }

        createMediaNodeFromGallery(stored.data, e.clientX, e.clientY);
      };

      setTimeout(() => {
        document.addEventListener('mouseup', handleMouseUp, { once: true });
      }, 50);
    },
    [createMediaNodeFromGallery]
  );

  /**
   * Handles gallery drag end
   */
  const handleGalleryDragEnd = useCallback((clientX: number, clientY: number): void => {
    console.log('[Gallery Drag] DragEnd event at:', clientX, clientY);
  }, []);

  /**
   * Handles global drag over for gallery items
   */
  useEffect(() => {
    const handleGlobalDragOver = (e: globalThis.DragEvent): void => {
      if (
        e.dataTransfer?.types.includes('application/json') ||
        e.dataTransfer?.types.includes('text/plain')
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleGlobalDrop = async (e: globalThis.DragEvent): Promise<void> => {
      let jsonData = e.dataTransfer?.getData('application/json');
      if (!jsonData) {
        jsonData = e.dataTransfer?.getData('text/plain');
      }

      if (!jsonData) return;

      try {
        const dragData = JSON.parse(jsonData);
        if (dragData.type !== 'gallery-output' || !dragData.output) return;

        e.preventDefault();
        e.stopPropagation();

        console.log('[Global Drop] Gallery output detected:', dragData.output);
        const { output } = dragData;

        if (!reactFlowInstance) {
          console.error('[Global Drop] ReactFlow instance not available');
          return;
        }

        const flowWrapper = document.querySelector('.react-flow');
        if (!flowWrapper) {
          console.error('[Global Drop] ReactFlow wrapper not found');
          return;
        }

        const bounds = flowWrapper.getBoundingClientRect();
        const viewport = reactFlowInstance.getViewport();
        const x = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
        const y = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

        console.log('[Global Drop] Drop position:', { x, y });

        const nodeId = handleAddNode('media', { x, y });
        console.log('[Global Drop] Created node:', nodeId);

        setTimeout(() => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      mediaPath: output.value,
                      mediaType: output.type,
                      ...(output.prompt ? { prompt: output.prompt } : {}),
                      ...(output.model ? { model: output.model } : {}),
                    },
                  }
                : n
            )
          );
          console.log('[Global Drop] Node data updated');
        }, 50);
      } catch (err) {
        // Not gallery JSON data, ignore
      }
    };

    document.addEventListener('dragover', handleGlobalDragOver as EventListener);
    document.addEventListener('drop', handleGlobalDrop as unknown as EventListener);

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver as EventListener);
      document.removeEventListener('drop', handleGlobalDrop as unknown as EventListener);
    };
  }, [reactFlowInstance, handleAddNode, setNodes]);

  /**
   * Tracks mouse position for paste operations
   */
  useEffect(() => {
    const flowWrapper = document.querySelector('.flow-wrapper');
    if (!flowWrapper) return;

    const handleMouseMove = (e: globalThis.MouseEvent): void => {
      const bounds = flowWrapper.getBoundingClientRect();
      lastMousePositionRef.current = {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      };
    };

    flowWrapper.addEventListener('mousemove', handleMouseMove as EventListener);
    return () => flowWrapper.removeEventListener('mousemove', handleMouseMove as EventListener);
  }, []);

  /**
   * Handles clipboard paste for images
   */
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = async (event): Promise<void> => {
            try {
              const base64Data = event.target?.result as string;
              const ext = item.type.split('/')[1] || 'png';
              const filename = `pasted-image-${Date.now()}.${ext}`;

              const savedPath = (await invoke('save_uploaded_file', {
                filename,
                data: base64Data,
              })) as string;

              const viewport = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
              const mousePos = lastMousePositionRef.current;
              const flowX = (mousePos.x - viewport.x) / viewport.zoom;
              const flowY = (mousePos.y - viewport.y) / viewport.zoom;

              const nodeId = handleAddNode('media', { x: flowX, y: flowY });

              setTimeout(() => {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === nodeId
                      ? {
                          ...n,
                          data: { ...n.data, mediaPath: savedPath, mediaType: 'image' },
                        }
                      : n
                  )
                );
              }, 50);
            } catch (error) {
              console.error('Error saving pasted image:', error);
            }
          };

          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [reactFlowInstance, handleAddNode, setNodes]);

  /**
   * Handles image drop on the canvas
   */
  const handleImageDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>): Promise<void> => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Drop] Drop event triggered on canvas');
      console.log('[Drop] dataTransfer types:', e.dataTransfer.types);

      try {
        let jsonData = e.dataTransfer.getData('application/json');
        if (!jsonData) {
          jsonData = e.dataTransfer.getData('text/plain');
        }
        console.log('[Drop] JSON data:', jsonData?.substring(0, 200));

        if (jsonData) {
          const dragData = JSON.parse(jsonData);
          console.log('[Drop] Parsed drag data:', dragData);

          if (dragData.type === 'gallery-output' && dragData.output) {
            console.log('[Drop] Gallery output detected:', dragData.output);
            const { output } = dragData;

            if (!reactFlowInstance) {
              console.error('[Drop] ReactFlow instance not available');
              return;
            }

            const flowWrapper = document.querySelector('.react-flow__renderer');
            if (!flowWrapper) {
              console.error('[Drop] ReactFlow wrapper not found');
              return;
            }

            const bounds = flowWrapper.getBoundingClientRect();
            const viewport = reactFlowInstance.getViewport();
            const x = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
            const y = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

            console.log('[Drop] Drop position:', { x, y });

            const nodeId = handleAddNode('media', { x, y });
            console.log('[Drop] Created node:', nodeId);

            setTimeout(() => {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === nodeId
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          mediaPath: output.value,
                          mediaType: output.type,
                          ...(output.prompt ? { prompt: output.prompt } : {}),
                          ...(output.model ? { model: output.model } : {}),
                        },
                      }
                    : n
                )
              );
              console.log('[Drop] Node data updated');
            }, 50);

            console.log('[Gallery Drop] Successfully created media node from gallery output:', {
              nodeId,
              output,
            });
            return;
          } else {
            console.log('[Drop] Not a gallery output type');
          }
        } else {
          console.log('[Drop] No JSON data in dataTransfer');
        }
      } catch (err) {
        console.log('[Gallery Drop] Error parsing JSON or not a gallery item:', err);
      }

      const files = Array.from(e.dataTransfer?.files || []);
      const imageFiles = files.filter(
        (file) => file.type.startsWith('image/') || isImageFile(file.name)
      );

      if (imageFiles.length === 0) return;

      const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const viewport = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
      const baseX = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
      const baseY = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        if (!file) continue;

        const reader = new FileReader();
        const fileName = file.name;

        reader.onload = async (event): Promise<void> => {
          try {
            const base64Data = event.target?.result as string;
            const savedPath = (await invoke('save_uploaded_file', {
              filename: fileName,
              data: base64Data,
            })) as string;

            const position = {
              x: baseX + i * 50,
              y: baseY + i * 50,
            };

            const nodeId = handleAddNode('media', position);

            setTimeout(() => {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === nodeId
                    ? {
                        ...n,
                        data: { ...n.data, mediaPath: savedPath, mediaType: 'image' },
                      }
                    : n
                )
              );
            }, 50);
          } catch (error) {
            console.error('Error saving dropped image:', error);
          }
        };

        reader.readAsDataURL(file);
      }
    },
    [reactFlowInstance, handleAddNode, setNodes]
  );

  return {
    handleImageDrop,
    handleGalleryDragStart,
    handleGalleryDragEnd,
    lastMousePositionRef,
  };
}
