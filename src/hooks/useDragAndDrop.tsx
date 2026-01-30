import { useEffect, useState } from 'react';
import { event } from '@tauri-apps/api';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { Node, Edge, ReactFlowInstance } from 'reactflow';
import { NODE_TYPE as MEDIA_NODE_TYPE } from '../nodes/core/MediaNode';
import { nodeCreators } from '../nodes';

// ============================================================================
// Types
// ============================================================================

interface DragEvent {
  payload?: {
    paths?: string[];
    position?: { x: number; y: number };
  };
}

interface WorkflowData {
  nodes: Array<{
    id: string;
    type: string;
    position?: { x: number; y: number };
    style?: React.CSSProperties;
    className?: string;
    dragHandle?: string;
    data: {
      savedContent?: string;
      content?: string;
      [key: string]: unknown;
    };
  }>;
  edges: Edge[];
}

export interface UseDragAndDropReturn {
  isDragging: boolean;
  dragCounter: number;
}

// Extend window to include nodeId
declare global {
  interface Window {
    nodeId?: number;
  }
}

// ============================================================================
// Helpers
// ============================================================================

// Helper to detect image files
const isImageFile = (path: string): boolean => {
  const lower = path.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower);
};

// ============================================================================
// Hook Implementation
// ============================================================================

export const useDragAndDrop = (
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  handleRemoveNode: (nodeId: string) => void,
  handleRunWorkflow: () => void,
  reactFlowInstance: ReactFlowInstance | null
): UseDragAndDropReturn => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  useEffect(() => {
    const promises: Promise<() => void>[] = [];

    // Drag enter event
    promises.push(
      event.listen('tauri://drag-enter', (evt: DragEvent) => {
        console.log('Drag enter event:', evt);
        setIsDragging(true);
        setDragCounter((prev) => prev + 1);
      })
    );

    // Drag leave event
    promises.push(
      event.listen('tauri://drag-leave', (evt: DragEvent) => {
        console.log('Drag leave event:', evt);
        setDragCounter((prev) => {
          const newCount = Math.max(0, prev - 1);
          if (newCount === 0) {
            setIsDragging(false);
          }
          return newCount;
        });
      })
    );

    // Drag over event
    promises.push(
      event.listen('tauri://drag-over', (evt: DragEvent) => {
        console.log('Drag over event:', evt);
      })
    );

    // Drop event
    promises.push(
      event.listen('tauri://drag-drop', async (evt: DragEvent) => {
        console.log('Drop event:', evt);
        setIsDragging(false);
        setDragCounter(0);

        if (evt.payload && evt.payload.paths && evt.payload.paths.length > 0) {
          const paths = evt.payload.paths;

          // Check if any dropped files are images
          const imagePaths = paths.filter(isImageFile);

          if (imagePaths.length > 0) {
            // Handle image files - create media nodes
            try {
              // Get drop position from event and convert to flow coordinates
              const dropPosition = evt.payload.position || { x: 100, y: 100 };
              let flowX = dropPosition.x;
              let flowY = dropPosition.y;

              if (reactFlowInstance) {
                // Get the flow wrapper bounds to calculate relative position
                const flowWrapper = document.querySelector('.flow-wrapper');
                const bounds = flowWrapper?.getBoundingClientRect() || { left: 0, top: 0 };
                const viewport = reactFlowInstance.getViewport();

                // Convert screen coordinates to flow coordinates
                flowX = (dropPosition.x - bounds.left - viewport.x) / viewport.zoom;
                flowY = (dropPosition.y - bounds.top - viewport.y) / viewport.zoom;
              }

              for (let i = 0; i < imagePaths.length; i++) {
                const filePath = imagePaths[i];
                const pathParts = filePath?.split(/[/\\]/);
                const filename = pathParts?.[pathParts.length - 1] || 'unknown';

                // Read file as base64 using Tauri command
                const base64Data = await invoke<string>('read_file_as_base64', {
                  filePath: filePath,
                });

                // Save to uploads folder via Tauri
                const savedPath = await invoke<string>('save_uploaded_file', {
                  filename,
                  data: base64Data,
                });

                // Create media node at drop position (offset each one if multiple)
                const nodeId = `media-${Date.now()}-${i}`;
                const nodeCreator = nodeCreators[MEDIA_NODE_TYPE];
                if (!nodeCreator) continue;

                const newNode = nodeCreator({
                  id: nodeId,
                  handleRemoveNode,
                  position: { x: flowX + i * 50, y: flowY + i * 50 },
                });

                // Set the media path and type
                newNode.data = {
                  ...newNode.data,
                  mediaPath: savedPath,
                  mediaType: 'image',
                };

                setNodes((nds) => [...nds, newNode]);
              }
            } catch (error) {
              console.error('Error handling dropped image:', error);
            }
            return;
          }

          // Handle JSON workflow files (existing logic)
          try {
            const firstPath = paths[0];
            if (!firstPath) return;

            const content = await readTextFile(firstPath);
            const workflow = JSON.parse(content) as WorkflowData;

            // Update nodeId counter to prevent conflicts
            const maxId = Math.max(...workflow.nodes.map((n) => parseInt(n.id)));
            window.nodeId = maxId + 1;

            // First parse and validate the workflow
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reconstructedNodes: Node[] = workflow.nodes
              .map((node) => {
                // Deep clone the node to avoid reference issues
                const clonedNode = JSON.parse(JSON.stringify(node));

                // Create node using registry defaults
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const nodeCreator = (nodeCreators as any)[node.type];
                if (!nodeCreator) return null;

                const newNode = nodeCreator({
                  id: clonedNode.id,
                  handleRemoveNode,
                  position: clonedNode.position || { x: 100, y: 100 },
                  style: clonedNode.style,
                  className: clonedNode.className,
                  dragHandle: clonedNode.dragHandle,
                });

                // Preserve the saved content for display nodes
                if (newNode && node.data.savedContent) {
                  (newNode.data as { content?: string; savedContent?: string }).content =
                    node.data.savedContent;
                  (newNode.data as { savedContent?: string }).savedContent = node.data.savedContent;
                }

                return newNode as Node;
              })
              .filter((node): node is Node => node !== null);

            setNodes(reconstructedNodes);
            // Ensure edges have type: 'custom' for proper rendering
            const processedEdges = workflow.edges.map((edge) => ({
              ...edge,
              type: 'custom',
              animated: false,
              data: {
                ...edge.data,
                isProcessing: false,
              },
            }));
            setEdges(processedEdges);
          } catch (error) {
            console.error('Error loading workflow:', error);
            alert('Error loading workflow file');
          }
        }
      })
    );

    return () => {
      // Cleanup all listeners
      promises.forEach((promise) => {
        promise.then((unlisten) => unlisten());
      });
    };
  }, [handleRemoveNode, handleRunWorkflow, setNodes, setEdges, reactFlowInstance]);

  // Debug isDragging state
  useEffect(() => {
    console.log('isDragging state changed:', isDragging);
  }, [isDragging]);

  return {
    isDragging,
    dragCounter,
  };
};
