/**
 * Hook for running workflow execution
 * Extracted from App.tsx to reduce component size
 */

import { useCallback, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import { executeWorkflow } from '../utils/workflowExecutor';
import * as db from '../utils/database';
import { PREVIEW_NODE_TYPES } from '../constants/app';
import { isTauriRuntime } from '../utils/runtime';
import {
  getPrimaryOutput,
  persistOutputToLocal,
  getOutputTypeFromNodeType,
} from '../utils/workflowHelpers';
import type { Workflow, WorkflowHistoryEntry } from './useWorkflowPersistence';
import type { WorkflowMetadata } from '../utils/workflowSchema';
import type { FailedNode, ExecutionState } from './useWorkflowExecution';
import type { ValidationError } from '../types/components';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useExecutionStore, type NodeOutput as StoreNodeOutput } from '../stores/useExecutionStore';

import { logger } from '../utils/logger';

const DESKTOP_RUNTIME_REQUIRED_MESSAGE =
  'Workflow execution requires the desktop runtime. Open the desktop app to run provider-backed nodes.';

// Local types
interface NodeData {
  prompt?: string;
  text?: string;
  model?: string;
  [key: string]: unknown;
}

interface RunWorkflowOptions {
  targetNodeIds?: string[] | null;
  trigger?: string;
  resume?: boolean;
  retryNodeIds?: string[] | null;
  retryFailed?: boolean;
  skipFailed?: boolean;
  continueOnError?: boolean;
}

interface WorkflowResult {
  success: boolean;
  error?: string;
  duration?: number;
  completedCount?: number;
  nodeOutputs?: Record<string, unknown>;
}

interface LocalHistoryEntry {
  id: string;
  workflowId: string | null;
  workflowName: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  success: boolean;
  nodeCount: number;
  completedCount: number;
  outputCount: number;
  error: string | null;
  trigger: string;
  scope: string[] | string;
}

// ============================================================================
// Types
// ============================================================================

export interface UseWorkflowRunnerOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  setWorkflowOutputs: React.Dispatch<React.SetStateAction<unknown[]>>;

  // Execution state from useWorkflowExecution
  isProcessing: boolean;
  executionStateRef: React.MutableRefObject<ExecutionState>;
  nodeTimingsRef: React.MutableRefObject<Record<string, number>>;
  setIsProcessing: (value: boolean) => void;
  setCurrentWorkflowId: (id: string | null) => void;
  setFailedNodes: React.Dispatch<React.SetStateAction<FailedNode[]>>;
  setShowErrorRecovery: (value: boolean) => void;

  // Workflow info
  activeWorkflow: Workflow | null;
  workflowMetadata: WorkflowMetadata | null;
  appendWorkflowHistory: (entry: WorkflowHistoryEntry) => void;
}

export interface UseWorkflowRunnerReturn {
  runWorkflow: (options?: RunWorkflowOptions) => Promise<void>;
  stopWorkflow: () => void;
  getExecutionScope: (targetNodeIds: string[] | null) => { nodes: Node[]; edges: Edge[] };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWorkflowRunner({
  nodes,
  edges,
  setNodes,
  setEdges,
  setValidationErrors,
  setWorkflowOutputs,
  isProcessing,
  executionStateRef,
  nodeTimingsRef,
  setIsProcessing,
  setCurrentWorkflowId,
  setFailedNodes,
  setShowErrorRecovery,
  activeWorkflow,
  workflowMetadata,
  appendWorkflowHistory,
}: UseWorkflowRunnerOptions): UseWorkflowRunnerReturn {
  // Get API keys from settings store
  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey);
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);
  const replicateApiKey = useSettingsStore((s) => s.replicateApiKey);

  const currentWorkflowIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);

  /**
   * Gets the execution scope for a set of target nodes
   */
  const getExecutionScope = useCallback(
    (targetNodeIds: string[] | null): { nodes: Node[]; edges: Edge[] } => {
      if (!Array.isArray(targetNodeIds) || targetNodeIds.length === 0) {
        return { nodes, edges };
      }

      const incoming = new Map<string, string[]>();
      edges.forEach((edge) => {
        if (!incoming.has(edge.target)) {
          incoming.set(edge.target, []);
        }
        incoming.get(edge.target)?.push(edge.source);
      });

      const neededIds = new Set<string>();
      const stack = [...targetNodeIds];
      while (stack.length > 0) {
        const currentId = stack.pop() as string;
        if (neededIds.has(currentId)) continue;
        neededIds.add(currentId);
        const parents = incoming.get(currentId) || [];
        parents.forEach((parentId) => {
          if (!neededIds.has(parentId)) {
            stack.push(parentId);
          }
        });
      }

      return {
        nodes: nodes.filter((node) => neededIds.has(node.id)),
        edges: edges.filter((edge) => neededIds.has(edge.source) && neededIds.has(edge.target)),
      };
    },
    [edges, nodes]
  );

  /**
   * Gets downstream node IDs from a set of start IDs
   */
  const getDownstreamNodeIds = useCallback(
    (startIds: Set<string>, scopeEdges: Edge[]): Set<string> => {
      const adjacency = new Map<string, string[]>();
      scopeEdges.forEach((edge) => {
        if (!adjacency.has(edge.source)) {
          adjacency.set(edge.source, []);
        }
        adjacency.get(edge.source)?.push(edge.target);
      });

      const visited = new Set<string>();
      const stack = Array.from(startIds);
      while (stack.length > 0) {
        const current = stack.pop() as string;
        if (visited.has(current)) continue;
        visited.add(current);
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach((nextId) => {
          if (!visited.has(nextId)) {
            stack.push(nextId);
          }
        });
      }
      return visited;
    },
    []
  );

  /**
   * Main workflow execution function
   */
  const runWorkflow = useCallback(
    async (options: RunWorkflowOptions = {}): Promise<void> => {
      if (isProcessing) {
        logger.debug('[Workflow] Workflow is already running');
        return;
      }

      const {
        targetNodeIds = null,
        trigger = 'manual',
        resume = false,
        retryNodeIds = null,
        retryFailed = false,
        skipFailed = false,
        continueOnError = false,
      } = options;

      if (!resume) {
        executionStateRef.current = {
          nodeOutputs: {},
          scopeNodeIds: [],
          failedNodeIds: [],
        };
      }

      const hasResumeState = resume && executionStateRef.current?.nodeOutputs;
      const resumeScopeIds =
        hasResumeState &&
        Array.isArray(executionStateRef.current.scopeNodeIds) &&
        executionStateRef.current.scopeNodeIds.length > 0
          ? new Set(executionStateRef.current.scopeNodeIds)
          : null;

      const scopeFromTarget = resumeScopeIds ? null : getExecutionScope(targetNodeIds);
      const scopedNodes = resumeScopeIds
        ? nodes.filter((node) => resumeScopeIds.has(node.id))
        : (scopeFromTarget?.nodes ?? []);
      const scopedEdges = resumeScopeIds
        ? edges.filter((edge) => resumeScopeIds.has(edge.source) && resumeScopeIds.has(edge.target))
        : (scopeFromTarget?.edges ?? []);

      const scopedNodeIdSet = new Set(scopedNodes.map((node) => node.id));
      const initialNodeOutputs: Record<string, unknown> = {};
      if (hasResumeState) {
        Object.entries(executionStateRef.current.nodeOutputs || {}).forEach(([nodeId, output]) => {
          if (scopedNodeIdSet.has(nodeId)) {
            initialNodeOutputs[nodeId] = output;
          }
        });
      }

      const failedNodeIdSet = new Set<string>(
        hasResumeState && Array.isArray(executionStateRef.current.failedNodeIds)
          ? executionStateRef.current.failedNodeIds
          : []
      );

      failedNodeIdSet.forEach((nodeId) => {
        delete initialNodeOutputs[nodeId];
      });

      const retryNodeIdSet = new Set<string>();
      if (Array.isArray(retryNodeIds)) {
        retryNodeIds.forEach((nodeId) => {
          if (nodeId) retryNodeIdSet.add(nodeId);
        });
      }
      if (retryFailed) {
        failedNodeIdSet.forEach((nodeId) => retryNodeIdSet.add(nodeId));
      }

      if (retryNodeIdSet.size > 0) {
        const downstreamIds = getDownstreamNodeIds(retryNodeIdSet, scopedEdges);
        downstreamIds.forEach((nodeId) => retryNodeIdSet.add(nodeId));
        retryNodeIdSet.forEach((nodeId) => {
          delete initialNodeOutputs[nodeId];
        });
      }

      const effectiveSkipNodeIds = skipFailed ? Array.from(failedNodeIdSet) : [];
      const allowPartial = continueOnError || skipFailed;

      if (scopedNodes.length === 0) {
        logger.warn('[Workflow] No nodes to execute for the requested scope');
        return;
      }

      if (!isTauriRuntime()) {
        const failedNode = scopedNodes[0];
        const failedNodeIds = failedNode ? [failedNode.id] : [];

        if (failedNode) {
          useExecutionStore
            .getState()
            .addFailedNode(failedNode.id, DESKTOP_RUNTIME_REQUIRED_MESSAGE, failedNode);

          setFailedNodes((prev: FailedNode[]) => {
            const existing = prev.find((n) => n.id === failedNode.id);
            if (existing) return prev;
            return [
              ...prev,
              {
                id: failedNode.id,
                error: DESKTOP_RUNTIME_REQUIRED_MESSAGE,
                node: failedNode as Node,
              },
            ];
          });
        }

        setShowErrorRecovery(true);
        setValidationErrors((prev) => [
          ...prev,
          {
            type: 'runtime',
            message: `Workflow error: ${DESKTOP_RUNTIME_REQUIRED_MESSAGE}`,
          },
        ]);

        setNodes((nds) =>
          nds.map((n) => {
            if (!scopedNodeIdSet.has(n.id)) return n;

            const baseClassName = (n.className || 'react-flow__node-resizable')
              .replace(' processing', '')
              .replace(' error', '');

            return {
              ...n,
              className: failedNode?.id === n.id ? `${baseClassName} error` : baseClassName,
              data: {
                ...n.data,
                isProcessing: false,
                error: failedNode?.id === n.id ? DESKTOP_RUNTIME_REQUIRED_MESSAGE : null,
              },
            };
          })
        );

        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            data: {
              ...e.data,
              isProcessing: false,
            },
          }))
        );

        executionStateRef.current = {
          nodeOutputs: {},
          scopeNodeIds: Array.from(scopedNodeIdSet),
          failedNodeIds,
        };
        useExecutionStore.getState().setProgress(0, scopedNodes.length, null);
        useExecutionStore
          .getState()
          .endExecution({ success: false }, Array.from(scopedNodeIdSet), failedNodeIds);
        return;
      }

      const startedAt = Date.now();
      const workflowId = `workflow-${Date.now()}`;
      currentWorkflowIdRef.current = workflowId;
      stopRequestedRef.current = false;
      setCurrentWorkflowId(workflowId);
      nodeTimingsRef.current = {};
      useExecutionStore.getState().startExecution(workflowId, !resume);
      useExecutionStore.getState().setProgress(0, scopedNodes.length, null);

      let workflowResult: WorkflowResult | null = null;
      let workflowError: Error | null = null;
      const runFailedNodeIds = new Set<string>();
      const outputPersistenceTasks: Promise<void>[] = [];

      try {
        setIsProcessing(true);
        logger.debug('[Workflow] Starting DAG-based workflow execution');

        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            className: (n.className || 'react-flow__node-resizable')
              .replace(' processing', '')
              .replace(' error', ''),
            data: { ...n.data, error: null },
          }))
        );

        workflowResult = (await executeWorkflow({
          nodes: scopedNodes as unknown as Parameters<typeof executeWorkflow>[0]['nodes'],
          edges: scopedEdges as unknown as Parameters<typeof executeWorkflow>[0]['edges'],
          context: {
            openaiApiKey,
            anthropicApiKey,
            replicateApiKey,
          },
          initialNodeOutputs: initialNodeOutputs as Parameters<
            typeof executeWorkflow
          >[0]['initialNodeOutputs'],
          skipNodeIds: effectiveSkipNodeIds,
          continueOnError: allowPartial,
          shouldStop: () => stopRequestedRef.current,
          onNodeStart: (node: Node): void => {
            logger.debug(`[Workflow] Starting node: ${node.id} (${node.type})`);
            nodeTimingsRef.current[node.id] = Date.now();
            useExecutionStore.getState().recordNodeStart(node.id);
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id !== node.id) return n;
                return {
                  ...n,
                  className: `${(n.className || 'react-flow__node-resizable').replace(' processing', '')} processing`,
                  data: { ...n.data, isProcessing: true },
                };
              })
            );

            setEdges((eds) =>
              eds.map((e) => ({
                ...e,
                data: {
                  ...e.data,
                  isProcessing:
                    e.data?.isProcessing || e.source === node.id || e.target === node.id,
                },
              }))
            );
          },
          onNodeComplete: (node: Node, output: unknown): void => {
            logger.debug(`[Workflow] Completed node: ${node.id}`, output);
            useExecutionStore.getState().setNodeOutput(node.id, output as StoreNodeOutput);
            const outputPayload = getPrimaryOutput(output);
            const nodeStartedAt = nodeTimingsRef.current[node.id];
            const runDurationMs = nodeStartedAt ? Date.now() - nodeStartedAt : null;

            setNodes((nds) =>
              nds.map((n) => {
                if (n.id !== node.id) return n;

                const nextClassName = (n.className || 'react-flow__node-resizable').replace(
                  ' processing',
                  ''
                );
                const nextData: NodeData = { ...n.data, isProcessing: false };

                if (outputPayload && PREVIEW_NODE_TYPES.has(n.type as string)) {
                  nextData.output = outputPayload.value;
                  if (outputPayload.metadata?.model) {
                    nextData.metadata = outputPayload.metadata.model.split('/').pop();
                  }
                }
                if (runDurationMs !== null) {
                  nextData.lastRunDurationMs = runDurationMs;
                  nextData.lastRunAt = Date.now();
                }

                return {
                  ...n,
                  className: nextClassName,
                  data: nextData,
                };
              })
            );

            if (outputPayload && PREVIEW_NODE_TYPES.has(node.type as string)) {
              const outputType = getOutputTypeFromNodeType(node.type as string);

              const persistAndSaveOutput = async (): Promise<void> => {
                logger.debug('[Persist] Starting persist for node:', node.id, 'type:', outputType);

                try {
                  const localValue = await persistOutputToLocal(
                    outputPayload.value,
                    outputType,
                    node.id
                  );

                  const outputData = {
                    type: outputType,
                    value: localValue,
                    originalUrl: outputPayload.value,
                    nodeId: node.id,
                    nodeType: node.type,
                    prompt: (node.data as NodeData)?.prompt || (node.data as NodeData)?.text || '',
                    model: outputPayload.metadata?.model || (node.data as NodeData)?.model || '',
                    timestamp: Date.now(),
                    workflowId: currentWorkflowIdRef.current,
                  };

                  try {
                    const savedId = await db.saveOutput(outputData);
                    logger.debug('[Persist] Output saved to database. ID:', savedId);
                  } catch (dbErr) {
                    logger.error('[Persist] Database save failed:', dbErr);
                  }

                  setWorkflowOutputs((prev) => [...prev, outputData]);
                } catch (err) {
                  logger.error('Failed to persist and save output:', err);

                  const fallbackData = {
                    type: outputType,
                    value: outputPayload.value,
                    nodeId: node.id,
                    nodeType: node.type,
                    prompt: (node.data as NodeData)?.prompt || (node.data as NodeData)?.text || '',
                    model: outputPayload.metadata?.model || (node.data as NodeData)?.model || '',
                    timestamp: Date.now(),
                    workflowId: currentWorkflowIdRef.current,
                  };

                  try {
                    await db.saveOutput(fallbackData);
                  } catch (e) {
                    logger.error('Failed to save fallback output:', e);
                  }
                  setWorkflowOutputs((prev) => [...prev, fallbackData]);
                }
              };

              outputPersistenceTasks.push(persistAndSaveOutput());
            }

            setEdges((eds) =>
              eds.map((e) => {
                if (e.source !== node.id && e.target !== node.id) return e;
                return {
                  ...e,
                  data: {
                    ...e.data,
                    isProcessing: false,
                  },
                };
              })
            );
          },
          onNodeError: (node: Node, error: Error): void => {
            logger.error(`[Workflow] Error in node ${node.id}:`, error);
            useExecutionStore.getState().addFailedNode(node.id, error, node);
            const nodeStartedAt = nodeTimingsRef.current[node.id];
            const runDurationMs = nodeStartedAt ? Date.now() - nodeStartedAt : null;

            runFailedNodeIds.add(node.id);

            setFailedNodes((prev: FailedNode[]) => {
              const existing = prev.find((n) => n.id === node.id);
              if (existing) return prev;
              return [...prev, { id: node.id, error: error.message, node: node as Node }];
            });

            setShowErrorRecovery(true);

            setNodes((nds) =>
              nds.map((n) => {
                if (n.id !== node.id) return n;
                return {
                  ...n,
                  className: `${(n.className || 'react-flow__node-resizable').replace(' processing', '')} error`,
                  data: {
                    ...n.data,
                    isProcessing: false,
                    error: error.message,
                    ...(runDurationMs !== null
                      ? { lastRunDurationMs: runDurationMs, lastRunAt: Date.now() }
                      : {}),
                  },
                };
              })
            );

            setEdges((eds) =>
              eds.map((e) => {
                if (e.source !== node.id && e.target !== node.id) return e;
                return {
                  ...e,
                  data: {
                    ...e.data,
                    isProcessing: false,
                  },
                };
              })
            );
          },
          onProgress: (progress: {
            percentage: number;
            completed: number;
            total: number;
          }): void => {
            useExecutionStore
              .getState()
              .setProgress(
                progress.completed,
                progress.total,
                useExecutionStore.getState().currentNodeId
              );
            logger.debug(
              `[Workflow] Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`
            );
          },
        })) as WorkflowResult;

        if (workflowResult.success) {
          logger.debug('[Workflow] Workflow completed successfully', workflowResult);
        } else if (!allowPartial) {
          throw new Error(workflowResult.error || 'Workflow execution failed');
        } else {
          logger.debug('[Workflow] Workflow completed with errors', workflowResult);
        }
      } catch (error) {
        logger.error('[Workflow] Error during workflow execution:', error);
        workflowError = error as Error;
        setValidationErrors((prev) => [
          ...prev,
          {
            message: `Workflow error: ${(error as Error).message}`,
            type: 'error',
          },
        ]);
      } finally {
        if (outputPersistenceTasks.length > 0) {
          await Promise.allSettled(outputPersistenceTasks);
        }

        if (workflowResult && workflowResult.success === false) {
          executionStateRef.current = {
            nodeOutputs: (workflowResult.nodeOutputs || {}) as ExecutionState['nodeOutputs'],
            scopeNodeIds: Array.from(scopedNodeIdSet),
            failedNodeIds: Array.from(runFailedNodeIds),
          };
          useExecutionStore.getState().endExecution(
            {
              success: false,
              nodeOutputs: (workflowResult.nodeOutputs || {}) as Record<string, StoreNodeOutput>,
            },
            Array.from(scopedNodeIdSet),
            Array.from(runFailedNodeIds)
          );
        } else {
          executionStateRef.current = {
            nodeOutputs: {},
            scopeNodeIds: [],
            failedNodeIds: [],
          };
          useExecutionStore.getState().endExecution({ success: true });
        }

        const workflowName = activeWorkflow?.name || workflowMetadata?.name || 'Local Draft';
        const historyEntry: LocalHistoryEntry = {
          id: `run-${Date.now()}`,
          workflowId: activeWorkflow?.id || (workflowMetadata as { id?: string })?.id || null,
          workflowName,
          startedAt,
          finishedAt: Date.now(),
          durationMs: workflowResult?.duration ?? Date.now() - startedAt,
          success: workflowResult?.success === true,
          nodeCount: scopedNodes.length,
          completedCount: workflowResult?.completedCount ?? 0,
          outputCount: workflowResult?.nodeOutputs
            ? Object.keys(workflowResult.nodeOutputs).length
            : 0,
          error:
            workflowResult?.success === false
              ? workflowResult.error || null
              : workflowError?.message || null,
          trigger,
          scope: Array.isArray(targetNodeIds) && targetNodeIds.length > 0 ? targetNodeIds : 'full',
        };

        // Convert to simplified history entry format
        appendWorkflowHistory({
          id: historyEntry.id,
          name: historyEntry.workflowName,
          timestamp: historyEntry.finishedAt,
        });
        setIsProcessing(false);
        setCurrentWorkflowId(null);
        currentWorkflowIdRef.current = null;
        stopRequestedRef.current = false;
        logger.debug('[Workflow] Execution completed');
      }
    },
    [
      isProcessing,
      nodes,
      edges,
      getExecutionScope,
      getDownstreamNodeIds,
      openaiApiKey,
      anthropicApiKey,
      replicateApiKey,
      setNodes,
      setEdges,
      setValidationErrors,
      setWorkflowOutputs,
      setIsProcessing,
      setCurrentWorkflowId,
      setFailedNodes,
      setShowErrorRecovery,
      executionStateRef,
      nodeTimingsRef,
      activeWorkflow,
      workflowMetadata,
      appendWorkflowHistory,
    ]
  );

  const stopWorkflow = useCallback((): void => {
    if (!isProcessing) return;
    stopRequestedRef.current = true;
    logger.debug('[Workflow] Stop requested');
  }, [isProcessing]);

  return {
    runWorkflow,
    stopWorkflow,
    getExecutionScope,
  };
}
