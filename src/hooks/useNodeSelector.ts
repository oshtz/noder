import { useCallback, Dispatch, SetStateAction } from 'react';
import { Node, XYPosition } from 'reactflow';

export interface SelectorPosition {
  x: number;
  y: number;
}

export interface UseNodeSelectorParams {
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setSelectorOpen: Dispatch<SetStateAction<boolean>>;
  setSelectorPosition: Dispatch<SetStateAction<SelectorPosition>>;
  selectorPosition: SelectorPosition;
  handleRemoveNode: (nodeId: string) => void;
  handleRunWorkflow: () => void;
  screenToFlowPosition: (position: { x: number; y: number }) => XYPosition;
  handleAddNode: (type: string, position: XYPosition) => void;
}

export interface UseNodeSelectorReturn {
  handleNodeSelect: (type: string) => void;
  onPaneDoubleClick: (event: React.MouseEvent) => void;
}

/**
 * Hook for handling node selector interactions in the workflow editor
 */
export const useNodeSelector = (
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setSelectorOpen: Dispatch<SetStateAction<boolean>>,
  setSelectorPosition: Dispatch<SetStateAction<SelectorPosition>>,
  selectorPosition: SelectorPosition,
  handleRemoveNode: (nodeId: string) => void,
  handleRunWorkflow: () => void,
  screenToFlowPosition: (position: { x: number; y: number }) => XYPosition,
  handleAddNode: (type: string, position: XYPosition) => void
): UseNodeSelectorReturn => {
  const handleNodeSelect = useCallback(
    (type: string) => {
      const flowPosition = screenToFlowPosition({
        x: selectorPosition.x,
        y: selectorPosition.y,
      });
      handleAddNode(type, flowPosition);
      setSelectorOpen(false);
    },
    [screenToFlowPosition, selectorPosition, handleAddNode, setSelectorOpen]
  );

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const { clientX, clientY } = event;
      const target = event.target as HTMLElement;
      const { top, left } = target.getBoundingClientRect();

      console.log('Double click at:', { clientX, clientY });
      console.log('Flow container offset:', { left, top });
      console.log('Setting position:', { x: clientX, y: clientY });

      setSelectorPosition({ x: clientX, y: clientY });
      setSelectorOpen(true);
    },
    [setSelectorPosition, setSelectorOpen]
  );

  return {
    handleNodeSelect,
    onPaneDoubleClick,
  };
};

export default useNodeSelector;
