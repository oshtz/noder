import { useCallback } from 'react';
import { createNode } from '../nodes';

const useNodeHandling = (setNodes, setEdges) => {
  const handleNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  const handleEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  const handleConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      type: 'custom',
      animated: true,
      id: `e${params.source}-${params.target}-${Date.now()}`
    };
    setEdges((eds) => eds.concat(newEdge));
  }, [setEdges]);

  return {
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
  };
};

export default useNodeHandling;
