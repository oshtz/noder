import { useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { Edge, Node, Connection } from 'reactflow';
import { getHandleColor } from '../constants/handleTypes';
import { ThemeColors } from '../constants/themes';

export interface UseEdgeHandlingParams {
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  edgesRef: MutableRefObject<Edge[]>;
  nodesRef: MutableRefObject<Node[]>;
  currentTheme: string;
  themes: Record<string, ThemeColors>;
}

export interface UseEdgeHandlingReturn {
  onConnect: (params: Connection) => void;
}

/**
 * Hook for handling edge connections in the workflow editor
 */
export const useEdgeHandling = (
  setEdges: Dispatch<SetStateAction<Edge[]>>,
  edgesRef: MutableRefObject<Edge[]>,
  nodesRef: MutableRefObject<Node[]>,
  currentTheme: string,
  themes: Record<string, ThemeColors>
): UseEdgeHandlingReturn => {
  const onConnect = useCallback(
    (params: Connection) => {
      // Type compatibility is validated by isValidConnection prop in ReactFlow
      // which uses the actual dataType from handle definitions

      // Get source type for edge coloring (extract from handle ID if possible)
      const sourceType = params.sourceHandle?.split('-')[0];

      // Check if the exact same connection already exists (same source, sourceHandle, target, targetHandle)
      const connectionExists = edgesRef.current.some(
        (edge) =>
          edge.source === params.source &&
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
        const sourceNode = nodesRef.current.find((n) => n.id === params.source);
        const targetNode = nodesRef.current.find((n) => n.id === params.target);

        // Get theme's text color as fallback
        const themeTextColor = themes[currentTheme]?.['--text-color'] || '#ffffff';

        // Create new edge with type-based color and node dimensions
        const edgeColor = sourceType ? getHandleColor(sourceType) : themeTextColor;

        const edge: Edge = {
          ...params,
          id: `e${params.source}-${params.target}-${params.targetHandle}-${Date.now()}`,
          source: params.source || '',
          target: params.target || '',
          type: 'custom',
          animated: false,
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
          },
          data: {
            handleColor: edgeColor,
            sourceNodeWidth: sourceNode?.width || (sourceNode?.style?.width as number) || 200,
            sourceNodeHeight: sourceNode?.height || (sourceNode?.style?.height as number) || 200,
            targetNodeWidth: targetNode?.width || (targetNode?.style?.width as number) || 200,
            targetNodeHeight: targetNode?.height || (targetNode?.style?.height as number) || 200,
          },
        };

        return [...filteredEdges, edge];
      });
    },
    [setEdges, edgesRef, nodesRef, currentTheme, themes]
  );

  return {
    onConnect,
  };
};

export default useEdgeHandling;
