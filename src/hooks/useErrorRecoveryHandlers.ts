import { useCallback } from 'react';
import type { Node } from 'reactflow';

export interface ErrorRecoveryHandlersConfig {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  removeFailedNode: (nodeId: string) => void;
  clearFailedNodes: () => void;
  runWorkflow: (options?: {
    trigger?: string;
    resume?: boolean;
    retryNodeIds?: string[];
    retryFailed?: boolean;
    skipFailed?: boolean;
    continueOnError?: boolean;
  }) => void;
}

export interface ErrorRecoveryHandlersResult {
  handleRetryNode: (nodeId: string) => void;
  handleRetryAll: () => void;
  handleSkipErrors: () => void;
}

export function useErrorRecoveryHandlers({
  setNodes,
  removeFailedNode,
  clearFailedNodes,
  runWorkflow,
}: ErrorRecoveryHandlersConfig): ErrorRecoveryHandlersResult {
  const handleRetryNode = useCallback(
    (nodeId: string): void => {
      removeFailedNode(nodeId);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          className: n.id === nodeId ? (n.className || '').replace(' error', '') : n.className,
          data: n.id === nodeId ? { ...n.data, error: null } : n.data,
        }))
      );
      runWorkflow({ trigger: 'retry-node', resume: true, retryNodeIds: [nodeId] });
    },
    [removeFailedNode, runWorkflow, setNodes]
  );

  const handleRetryAll = useCallback((): void => {
    clearFailedNodes();
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        className: (n.className || '').replace(' error', ''),
        data: { ...n.data, error: null },
      }))
    );
    runWorkflow({ trigger: 'retry-all', resume: true, retryFailed: true });
  }, [clearFailedNodes, runWorkflow, setNodes]);

  const handleSkipErrors = useCallback((): void => {
    clearFailedNodes();
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        className: (n.className || '').replace(' error', ''),
        data: { ...n.data, error: null },
      }))
    );
    runWorkflow({ trigger: 'skip-errors', resume: true, skipFailed: true, continueOnError: true });
  }, [clearFailedNodes, runWorkflow, setNodes]);

  return {
    handleRetryNode,
    handleRetryAll,
    handleSkipErrors,
  };
}
