import { useCallback, Dispatch, SetStateAction } from 'react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from 'reactflow';

export interface UseNodeHandlingReturn {
  handleNodesChange: (changes: NodeChange[]) => void;
  handleEdgesChange: (changes: EdgeChange[]) => void;
  handleConnect: (params: Connection) => void;
}

/**
 * Hook for handling node and edge changes in the workflow editor
 */
const useNodeHandling = (
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>
): UseNodeHandlingReturn => {
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        source: params.source || '',
        target: params.target || '',
        type: 'custom',
        animated: true,
        id: `e${params.source}-${params.target}-${Date.now()}`,
      };
      setEdges((eds) => eds.concat(newEdge));
    },
    [setEdges]
  );

  return {
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
  };
};

export default useNodeHandling;
