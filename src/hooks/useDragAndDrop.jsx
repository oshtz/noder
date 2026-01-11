import React, { useEffect, useState } from 'react';
import { event } from '@tauri-apps/api';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { NODE_TYPE as MEDIA_NODE_TYPE } from '../nodes/core/MediaNode';
import { nodeCreators } from '../nodes';

// Helper to detect image files
const isImageFile = (path) => {
  const lower = path.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower);
};

export const useDragAndDrop = (setNodes, setEdges, handleRemoveNode, handleRunWorkflow, reactFlowInstance) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  useEffect(() => {
    const promises = [];

    // Drag enter event
    promises.push(
      event.listen('tauri://drag-enter', (event) => {
        console.log('Drag enter event:', event);
        setIsDragging(true);
        setDragCounter(prev => prev + 1);
      })
    );

    // Drag leave event
    promises.push(
      event.listen('tauri://drag-leave', (event) => {
        console.log('Drag leave event:', event);
        setDragCounter(prev => {
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
      event.listen('tauri://drag-over', (event) => {
        console.log('Drag over event:', event);
      })
    );

    // Drop event
    promises.push(
      event.listen('tauri://drag-drop', async (event) => {
        console.log('Drop event:', event);
        setIsDragging(false);
        setDragCounter(0);

        if (event.payload && event.payload.paths && event.payload.paths.length > 0) {
          const paths = event.payload.paths;

          // Check if any dropped files are images
          const imagePaths = paths.filter(isImageFile);

          if (imagePaths.length > 0) {
            // Handle image files - create media nodes
            try {
              // Get drop position from event and convert to flow coordinates
              const dropPosition = event.payload.position || { x: 100, y: 100 };
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
                const filename = filePath.split(/[/\\]/).pop();

                // Read file as base64 using Tauri command
                const base64Data = await invoke('read_file_as_base64', {
                  filePath: filePath
                });

                // Save to uploads folder via Tauri
                const savedPath = await invoke('save_uploaded_file', {
                  filename,
                  data: base64Data
                });

                // Create media node at drop position (offset each one if multiple)
                const nodeId = `media-${Date.now()}-${i}`;
                const newNode = nodeCreators[MEDIA_NODE_TYPE]({
                  id: nodeId,
                  handleRemoveNode,
                  position: { x: flowX + (i * 50), y: flowY + (i * 50) }
                });

                // Set the media path and type
                newNode.data = {
                  ...newNode.data,
                  mediaPath: savedPath,
                  mediaType: 'image'
                };

                setNodes(nds => [...nds, newNode]);
              }
            } catch (error) {
              console.error('Error handling dropped image:', error);
            }
            return;
          }

          // Handle JSON workflow files (existing logic)
          try {
            const content = await readTextFile(paths[0]);
            const workflow = JSON.parse(content);
              
            // Update nodeId counter to prevent conflicts
            const maxId = Math.max(...workflow.nodes.map(n => parseInt(n.id)));
            window.nodeId = maxId + 1;

            // First parse and validate the workflow
            const reconstructedNodes = workflow.nodes.map(node => {
              // Deep clone the node to avoid reference issues
              const clonedNode = JSON.parse(JSON.stringify(node));
              
              // Create node using registry defaults
              const newNode = nodeCreators[node.type]({
                id: clonedNode.id,
                handleRemoveNode,
                handleRunWorkflow,
                position: clonedNode.position || { x: 100, y: 100 },
                style: clonedNode.style,
                className: clonedNode.className,
                dragHandle: clonedNode.dragHandle
              });
              
              // Preserve the saved content for display nodes
              if (newNode && node.data.savedContent) {
                newNode.data.content = node.data.savedContent;
                newNode.data.savedContent = node.data.savedContent;
              }
              
              return newNode;
            });

            setNodes(reconstructedNodes);
            setEdges(workflow.edges);
          } catch (error) {
            console.error('Error loading workflow:', error);
            alert('Error loading workflow file');
          }
        }
      })
    );

    return () => {
      // Cleanup all listeners
      promises.forEach(promise => {
        promise.then(unlisten => unlisten());
      });
    };
  }, [handleRemoveNode, handleRunWorkflow, setNodes, setEdges, reactFlowInstance]);

  // Debug isDragging state
  useEffect(() => {
    console.log('isDragging state changed:', isDragging);
  }, [isDragging]);

  return {
    isDragging,
    dragCounter
  };
};
