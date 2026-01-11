import { useCallback } from 'react';
import { areTypesCompatible, getHandleColor } from '../constants/handleTypes';

export const useEdgeHandling = (setEdges, edgesRef, nodesRef, currentTheme, themes) => {
  const onConnect = useCallback((params) => {
    // Extract handle types from handle IDs (format: "type-input" or "type-output")
    const sourceType = params.sourceHandle?.split('-')[0];
    const targetType = params.targetHandle?.split('-')[0];
    
    // Validate type compatibility
    if (sourceType && targetType && !areTypesCompatible(sourceType, targetType)) {
      console.warn(`Incompatible types: ${sourceType} -> ${targetType}`);
      return;
    }
    
    // Check if the exact same connection already exists (same source, sourceHandle, target, targetHandle)
    const connectionExists = edgesRef.current.some(
      edge => edge.source === params.source &&
              edge.sourceHandle === params.sourceHandle &&
              edge.target === params.target &&
              edge.targetHandle === params.targetHandle
    );
    
    if (connectionExists) {
      console.warn('This exact connection already exists');
      return;
    }

    setEdges((eds) => {
      // Allow multiple connections to the same input handle
      const filteredEdges = eds;
      
      // Get source and target node dimensions
      const sourceNode = nodesRef.current.find(n => n.id === params.source);
      const targetNode = nodesRef.current.find(n => n.id === params.target);
      
      // Create new edge with type-based color and node dimensions
      const edgeColor = sourceType ? getHandleColor(sourceType) : themes[currentTheme]['--text-color'];
      const edge = {
        ...params,
        id: `e${params.source}-${params.target}-${params.targetHandle}-${Date.now()}`,
        type: 'default',
        animated: true,
        style: {
          stroke: edgeColor,
          strokeWidth: 2
        },
        data: {
          sourceNodeWidth: sourceNode?.width || sourceNode?.style?.width || 200,
          sourceNodeHeight: sourceNode?.height || sourceNode?.style?.height || 200,
          targetNodeWidth: targetNode?.width || targetNode?.style?.width || 200,
          targetNodeHeight: targetNode?.height || targetNode?.style?.height || 200,
        }
      };
      
      return [...filteredEdges, edge];
    });
  }, [setEdges, edgesRef, currentTheme, themes]);

  return {
    onConnect
  };
};
