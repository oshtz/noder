import React, { useCallback } from 'react';
import { createNode } from '../nodes';

export const useNodeSelector = (
  setNodes,
  setSelectorOpen,
  setSelectorPosition,
  selectorPosition,
  handleRemoveNode,
  handleRunWorkflow,
  screenToFlowPosition,
  handleAddNode
) => {
  const handleNodeSelect = useCallback((type) => {
    const flowPosition = screenToFlowPosition({
      x: selectorPosition.x,
      y: selectorPosition.y
    });
    handleAddNode(type, flowPosition);
    setSelectorOpen(false);
  }, [screenToFlowPosition, selectorPosition, handleAddNode, setSelectorOpen]);

  const onPaneDoubleClick = useCallback((event) => {
    const { clientX, clientY } = event;
    const { top, left } = event.target.getBoundingClientRect();
    
    console.log('Double click at:', { clientX, clientY });
    console.log('Flow container offset:', { left, top });
    console.log('Setting position:', { x: clientX, y: clientY });
    
    setSelectorPosition({ x: clientX, y: clientY });
    setSelectorOpen(true);
  }, [setSelectorPosition, setSelectorOpen]);

  return {
    handleNodeSelect,
    onPaneDoubleClick
  };
};
