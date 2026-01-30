/**
 * Hook for running workflow execution
 * Extracted from App.tsx to reduce component size
 */

import { useCallback, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import { executeWorkflow } from '../utils/workflowExecutor';
import * as db from '../utils/database';
import { PREVIEW_NODE_TYPES } from '../constants/app';
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
        console.log('[Workflow] Workflow is already running');
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
        console.warn('[Workflow] No nodes to execute for the requested scope');
        return;
      }

      const startedAt = Date.now();
      const workflowId = `workflow-${Date.now()}`;
      currentWorkflowIdRef.current = workflowId;
      setCurrentWorkflowId(workflowId);
      nodeTimingsRef.current = {};

      let workflowResult: WorkflowResult | null = null;
      let workflowError: Error | null = null;
      const runFailedNodeIds = new Set<string>();

      try {
        setIsProcessing(true);
        console.log('[Workflow] Starting DAG-based workflow execution');

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
          initialNodeOutputs: initialNodeOutputs as Record<string, unknown>,
          skipNodeIds: effectiveSkipNodeIds,
          continueOnError: allowPartial,
          onNodeStart: (node: Node): void => {
            console.log(`[Workflow] Starting node: ${node.id} (${node.type})`);
            nodeTimingsRef.current[node.id] = Date.now();
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
            console.log(`[Workflow] Completed node: ${node.id}`, output);
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
                console.log('[Persist] Starting persist for node:', node.id, 'type:', outputType);

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
                    console.log('[Persist] Output saved to database. ID:', savedId);
                  } catch (dbErr) {
                    console.error('[Persist] Database save failed:', dbErr);
                  }

                  setWorkflowOutputs((prev) => [...prev, outputData]);
                } catch (err) {
                  console.error('Failed to persist and save output:', err);

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
                    console.error('Failed to save fallback output:', e);
                  }
                  setWorkflowOutputs((prev) => [...prev, fallbackData]);
                }
              };

              persistAndSaveOutput();
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
            console.error(`[Workflow] Error in node ${node.id}:`, error);
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
            console.log(
              `[Workflow] Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`
            );
          },
        })) as WorkflowResult;

        if (workflowResult.success) {
          console.log('[Workflow] Workflow completed successfully', workflowResult);
        } else if (!allowPartial) {
          throw new Error(workflowResult.error || 'Workflow execution failed');
        } else {
          console.log('[Workflow] Workflow completed with errors', workflowResult);
        }
      } catch (error) {
        console.error('[Workflow] Error during workflow execution:', error);
        workflowError = error as Error;
        setValidationErrors((prev) => [
          ...prev,
          {
            message: `Workflow error: ${(error as Error).message}`,
            type: 'error',
          },
        ]);
      } finally {
        if (workflowResult && workflowResult.success === false) {
          executionStateRef.current = {
            nodeOutputs: (workflowResult.nodeOutputs || {}) as Record<string, unknown>,
            scopeNodeIds: Array.from(scopedNodeIdSet),
            failedNodeIds: Array.from(runFailedNodeIds),
          };
        } else {
          executionStateRef.current = {
            nodeOutputs: {},
            scopeNodeIds: [],
            failedNodeIds: [],
          };
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
        console.log('[Workflow] Execution completed');
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

  return {
    runWorkflow,
    getExecutionScope,
  };
}
