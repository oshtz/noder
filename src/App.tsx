import React, { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowInstance,
  useUpdateNodeInternals,
} from 'reactflow';
import CustomEdge from './components/CustomEdge';
import 'reactflow/dist/style.css';
import './App.css';

// Node imports
import { nodeDefinitions, nodeTypes as registeredNodeTypes } from './nodes';

// Utility imports
import { TEMPLATE_STORAGE_KEY } from './constants/app';
import { getValidator } from './utils/handleValidation';
import { emit } from './utils/eventBus';
import * as db from './utils/database';
import { workflowTemplates } from './utils/workflowTemplates';
import { getLayoutedElements, LAYOUT_DIRECTION } from './utils/layoutEngine';
import { sortNodesForReactFlow } from './utils/createNode';
import { normalizeTemplates, markEdgeGlows, prepareEdges } from './utils/workflowHelpers';
import { buildConnectionHint, getConnectionHintNodeClass } from './utils/connectionHints';

// Type imports
import type { Node, Edge, NodeTypes } from 'reactflow';
import type { Workflow } from './hooks/useWorkflowPersistence';
import type { ValidationError } from './types/components';
import type { WorkflowTemplate } from './utils/workflowTemplates';
import type { Database as GalleryDatabase, Output } from './components/gallery';

// Component imports
import NodeSelector from './components/NodeSelector';
import CommandDock from './components/CommandDock';
import NodeInspectorPanel from './components/NodeInspectorPanel';
import OutputFilmstrip from './components/OutputFilmstrip';
import ConnectionHintOverlay from './components/ConnectionHintOverlay';
import ValidationErrorsPanel from './components/ValidationErrorsPanel';
import Sidebar from './components/Sidebar';
import ErrorRecoveryPanel from './components/ErrorRecoveryPanel';
import ErrorBoundary from './components/ErrorBoundary';
import HelperLines from './components/HelperLines';

import EmptyWorkflowOverlay from './components/EmptyWorkflowOverlay';
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay';
import AppFeedback from './components/AppFeedback';
import WorkflowTitleChip from './components/WorkflowTitleChip';

// Lazy-loaded components for code splitting
const AssistantPanel = lazy(() => import('./components/AssistantPanel'));
const WelcomeScreen = lazy(() => import('./components/WelcomeScreen'));
const CanvasOutputGallery = lazy(() =>
  import('./components/OutputGallery').then((module) => ({ default: module.OutputGallery }))
);

// Hook imports
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDatabase } from './hooks/useDatabase';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useUpdateSystem } from './hooks/useUpdateSystem';
import { useWorkflowExecution } from './hooks/useWorkflowExecution';
import { useWorkflowPersistence } from './hooks/useWorkflowPersistence';
import { useWorkflowRunner } from './hooks/useWorkflowRunner';
import { useMediaHandling } from './hooks/useMediaHandling';
import { useNodeConnections } from './hooks/useNodeConnections';
import { useGroupOperations } from './hooks/useGroupOperations';
import { useAssistantConfig } from './hooks/useAssistantConfig';
import { useNodeOperations } from './hooks/useNodeOperations';
import { useWelcomeHandlers } from './hooks/useWelcomeHandlers';
import { useErrorRecoveryHandlers } from './hooks/useErrorRecoveryHandlers';
import { useWindowControls } from './hooks/useWindowControls';
import { useThemeEffect } from './hooks/useThemeEffect';
import { useInitialWorkflow } from './hooks/useInitialWorkflow';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useValidationErrors } from './hooks/useValidationErrors';
import { useContextualSurfaces } from './hooks/useContextualSurfaces';
import { useShowAssistantPanel, useSettingsStore } from './stores/useSettingsStore';
import { useExecutionProgress } from './stores/useExecutionStore';
import { useSidebarProps } from './hooks/useSidebarProps';
import { setGlobalWorkflowRefs } from './context/WorkflowContext';

import { logger } from './utils/logger';
// =============================================================================
// Node/Edge Types
// =============================================================================

const nodeTypes = Object.fromEntries(
  Object.entries(registeredNodeTypes).map(([type, def]) => [
    type,
    (def as unknown as { component: React.ComponentType }).component,
  ])
) as NodeTypes;

const edgeTypes = { custom: CustomEdge };

// =============================================================================
// App Component
// =============================================================================

function App(): React.ReactElement {
  const database = useDatabase();

  // Initial workflow loading
  const {
    initialNodes,
    initialEdges,
    initialOutputs,
    initialValidationErrors,
    showWelcomeInitially,
  } = useInitialWorkflow();

  const takeSnapshotRef = useRef<((force?: boolean) => void) | null>(null);

  // Core state - initialize edges as empty to prevent "handle not found" errors
  // Edges will be set after ReactFlow and node handles are ready
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const pendingEdgesRef = useRef<Edge[]>(initialEdges);

  // Settings
  const showAssistantPanel = useShowAssistantPanel();
  const edgeType = useSettingsStore((s) => s.edgeType);
  const defaultTextModel = useSettingsStore((s) => s.defaultTextModel);
  const defaultImageModel = useSettingsStore((s) => s.defaultImageModel);
  const defaultVideoModel = useSettingsStore((s) => s.defaultVideoModel);
  const defaultAudioModel = useSettingsStore((s) => s.defaultAudioModel);
  const defaultUpscalerModel = useSettingsStore((s) => s.defaultUpscalerModel);

  // Load settings into Zustand store from Tauri backend on mount
  useEffect(() => {
    useSettingsStore
      .getState()
      .loadFromTauri()
      .catch((err) => {
        logger.warn('Failed to load settings from Tauri:', err);
      });
  }, []);

  // UI state
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  // Hook to force ReactFlow to update node internals (recalculate handle positions)
  const updateNodeInternals = useUpdateNodeInternals();

  // Initialize edges after ReactFlow is ready and nodes have mounted their handles
  const hasInitializedEdges = useRef(false);
  useEffect(() => {
    if (reactFlowInstance && !hasInitializedEdges.current && pendingEdgesRef.current.length > 0) {
      hasInitializedEdges.current = true;

      // Short delay to ensure Handle components have mounted in DOM
      requestAnimationFrame(() => {
        // Force ReactFlow to update node internals for all nodes
        // This recalculates handle positions and registers them in the store
        const nodeIds = nodes.map((n) => n.id);
        nodeIds.forEach((id) => updateNodeInternals(id));

        // Set edges after a brief delay to ensure handles are registered
        requestAnimationFrame(() => {
          setEdges(pendingEdgesRef.current);
          pendingEdgesRef.current = [];
        });
      });
    }
  }, [reactFlowInstance, nodes, updateNodeInternals]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [workflowOutputs, setWorkflowOutputs] = useState<unknown[]>(initialOutputs);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(showWelcomeInitially);
  const [hideEmptyHint, setHideEmptyHint] = useState<boolean>(false);
  const [welcomePinned, setWelcomePinned] = useState<boolean>(false);
  const [showCanvasGallery, setShowCanvasGallery] = useState<boolean>(false);
  const [workflowTemplatesState] = useState<WorkflowTemplate[]>(() => {
    try {
      const storedTemplates = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (storedTemplates) return normalizeTemplates(JSON.parse(storedTemplates));
    } catch (error) {
      logger.error('Failed to parse stored workflow templates:', error);
    }
    return normalizeTemplates(workflowTemplates);
  });
  const [helperLines, setHelperLines] = useState<{
    horizontal: number | null;
    vertical: number | null;
  }>({ horizontal: null, vertical: null });
  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false);

  // Validation errors
  const {
    validationErrors,
    setValidationErrors,
    handleDismissError,
    clearAllErrors,
    addMigrationErrors,
  } = useValidationErrors(initialValidationErrors);

  // Workflow persistence hook
  const {
    activeWorkflow,
    hasUnsavedChanges,
    workflowMetadata,
    saveWorkflow,
    loadWorkflow,
    saveCurrentWorkflow,
    exportWorkflow,
    appendWorkflowHistory,
  } = useWorkflowPersistence({
    nodes,
    edges,
    setNodes,
    setEdges,
    setValidationErrors: addMigrationErrors,
    reactFlowInstance,
    prepareEdges: (rawEdges, nodeList, migrationErrorsRef) => {
      const ref = { current: [] as ValidationError[] };
      const result = prepareEdges(rawEdges, nodeList, ref);
      if (migrationErrorsRef) migrationErrorsRef.current = ref.current.map((e) => e.message);
      return result;
    },
  });

  // Execution state hook
  const {
    isProcessing,
    failedNodes,
    showErrorRecovery,
    executionStateRef,
    nodeTimingsRef,
    setIsProcessing,
    setCurrentWorkflowId,
    removeFailedNode,
    clearFailedNodes,
    closeErrorRecovery,
    setFailedNodes,
    setShowErrorRecovery,
  } = useWorkflowExecution();

  // Update system hook
  const updateSystem = useUpdateSystem();

  // Refs for current nodes/edges
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setGlobalWorkflowRefs(
      nodesRef as React.MutableRefObject<Node[]>,
      edgesRef as React.MutableRefObject<Edge[]>
    );
  }, [nodes, edges]);

  // Node operations hook
  const {
    handleRemoveNode,
    handleAddNode,
    moveNodeOrder,
    handleNodesChange,
    handleEdgesChange,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
  } = useNodeOperations({
    nodes,
    edges,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    setHelperLines,
    takeSnapshotRef,
    showWelcome,
    setShowWelcome,
    setWelcomePinned,
    defaultTextModel,
    defaultImageModel,
    defaultVideoModel,
    defaultAudioModel,
    defaultUpscalerModel,
  });

  // Workflow runner hook - API keys are read from useSettingsStore internally
  const { runWorkflow, stopWorkflow } = useWorkflowRunner({
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
  });

  // Media handling hook
  const { handleImageDrop } = useMediaHandling({ reactFlowInstance, handleAddNode, setNodes });

  // Node connections hook
  const {
    connectingNodeId,
    connectingHandleId,
    connectingHandleType,
    onConnectStart,
    onConnectEnd,
    onConnect,
  } = useNodeConnections({
    nodes,
    edges,
    setNodes,
    setEdges,
    setValidationErrors,
    edgeType,
    moveNodeOrder,
  });

  // Undo/redo hook
  const { undo, redo, takeSnapshot, canUndo, canRedo } = useUndoRedo({
    nodes,
    edges,
    setNodes,
    setEdges,
    maxHistory: 50,
  });

  takeSnapshotRef.current = takeSnapshot;

  // Group operations hook
  const { groupSelectedNodes, handleUngroupSelected, hasSelection, hasGroupSelected } =
    useGroupOperations({ nodes, setNodes, takeSnapshot, handleRemoveNode });

  // Screen reader announcements for workflow status
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const executionProgress = useExecutionProgress();
  const { current: currentNodeId, processed, total } = executionProgress;
  const normalizedWorkflowOutputs = workflowOutputs as Output[];

  const connectionHint = useMemo(
    () => buildConnectionHint(nodes, connectingNodeId, connectingHandleId, connectingHandleType),
    [nodes, connectingNodeId, connectingHandleId, connectingHandleType]
  );

  const flowNodes = useMemo(
    () =>
      sortNodesForReactFlow(
        nodes.map((node) => {
          const connectionClass = getConnectionHintNodeClass(
            node,
            connectionHint,
            connectingNodeId
          );
          const nextData = { ...node.data, usePersistentInspector: true };
          if (!connectionClass) {
            return {
              ...node,
              data: nextData,
            };
          }
          const baseClassName = (node.className || '').replace(
            /\s?connection-(source|compatible|incompatible)/g,
            ''
          );
          return {
            ...node,
            data: nextData,
            className: `${baseClassName} ${connectionClass}`.trim(),
          };
        })
      ),
    [nodes, connectionHint, connectingNodeId]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const selectedIncomingEdges = useMemo(
    () => (selectedNodeId ? edges.filter((edge) => edge.target === selectedNodeId) : []),
    [edges, selectedNodeId]
  );
  const selectedOutgoingEdges = useMemo(
    () => (selectedNodeId ? edges.filter((edge) => edge.source === selectedNodeId) : []),
    [edges, selectedNodeId]
  );
  const selectedFailedNode = useMemo(
    () => failedNodes.find((failedNode) => failedNode.id === selectedNodeId) || null,
    [failedNodes, selectedNodeId]
  );
  const currentNodeName = useMemo(() => {
    const currentNode = nodes.find((node) => node.id === currentNodeId);
    if (!currentNode) return '';
    const data = currentNode.data || {};
    return String(
      data.customTitle || data.title || data.label || currentNode.type || currentNode.id
    );
  }, [currentNodeId, nodes]);
  const dockTotal = isProcessing || total > 0 ? total : nodes.length;
  const dockProcessed = isProcessing ? processed : 0;
  const contextualSurfaces = useContextualSurfaces({
    selectedNodeId,
    failedNodeIds: failedNodes.map((failedNode) => failedNode.id),
    outputCount: normalizedWorkflowOutputs.length,
    isProcessing,
  });

  useEffect(() => {
    if (isProcessing && currentNodeId) {
      const currentNode = nodes.find((n) => n.id === currentNodeId);
      const nodeName = currentNode?.data?.label || currentNode?.type || 'node';
      setStatusAnnouncement(`Processing node: ${nodeName}`);
    } else if (isProcessing && total > 0) {
      setStatusAnnouncement(`Workflow running: ${processed} of ${total} nodes complete`);
    }
  }, [isProcessing, currentNodeId, processed, total, nodes]);

  // Announce workflow start/end
  const prevIsProcessingRef = useRef(isProcessing);
  useEffect(() => {
    if (isProcessing && !prevIsProcessingRef.current) {
      setStatusAnnouncement('Workflow started');
    } else if (!isProcessing && prevIsProcessingRef.current) {
      if (failedNodes.length > 0) {
        setStatusAnnouncement(`Workflow failed: ${failedNodes.length} node(s) had errors`);
      } else {
        setStatusAnnouncement('Workflow completed successfully');
      }
    }
    prevIsProcessingRef.current = isProcessing;
  }, [isProcessing, failedNodes.length]);

  // Assistant config hook
  const { assistantSystemPrompt, executeToolCall } = useAssistantConfig({
    nodes,
    edges,
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    setValidationErrors,
    handleRemoveNode,
    runWorkflow,
    reactFlowInstance,
    workflowTemplates: workflowTemplatesState,
  });

  // Drag and drop hook
  useDragAndDrop(setNodes, setEdges, handleRemoveNode, runWorkflow, reactFlowInstance);

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    nodes,
    edges,
    setNodes,
    setEdges,
    handleRemoveNode,
    reactFlowInstance,
    onGroupSelection: groupSelectedNodes,
    onUngroupSelection: handleUngroupSelected,
    onRunWorkflow: runWorkflow,
    isProcessing,
    onShowShortcuts: () => setShowShortcutsOverlay(true),
  });

  // Window controls & theme hooks
  useWindowControls();
  useThemeEffect();

  // Auto-update hook
  useAutoUpdate({
    updateSupported: updateSystem.updateSupported,
    checkForUpdate: updateSystem.checkForUpdate,
    downloadUpdate: updateSystem.downloadUpdate,
    installUpdate: updateSystem.installUpdate,
  });

  // Open node selector helper
  const openNodeSelectorAt = useCallback((event?: React.MouseEvent<HTMLButtonElement>): void => {
    const flowWrapper = document.querySelector('.react-flow__renderer');
    if (!flowWrapper) return;
    const bounds = flowWrapper.getBoundingClientRect();
    let x = bounds.left + bounds.width / 2;
    let y = bounds.top + bounds.height / 2;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = Math.min(Math.max(rect.left + rect.width / 2, bounds.left + 24), bounds.right - 24);
      y = Math.min(Math.max(rect.bottom + 12, bounds.top + 24), bounds.bottom - 24);
    }
    emit('openNodeSelector', {
      position: { x, y },
      clickPosition: { x: x - bounds.left, y: y - bounds.top },
      connectionContext: null,
    });
  }, []);

  // Welcome handlers hook
  const welcomeHandlers = useWelcomeHandlers({
    setShowWelcome,
    setWelcomePinned,
    setHideEmptyHint,
    setSidebarOpen,
    setNodes,
    setEdges,
    loadWorkflow,
    handleRemoveNode,
    reactFlowInstance,
    openNodeSelectorAt,
  });

  // Error recovery handlers hook
  const errorRecoveryHandlers = useErrorRecoveryHandlers({
    setNodes,
    removeFailedNode,
    clearFailedNodes,
    runWorkflow,
  });

  // Sidebar props hook
  const handleLoadWorkflow = useCallback(
    async (workflow: Workflow): Promise<void> => {
      await loadWorkflow(workflow, {
        onBeforeLoad: () => {
          if (showWelcome) {
            setShowWelcome(false);
            setWelcomePinned(false);
          }
        },
      });
    },
    [loadWorkflow, showWelcome]
  );

  const { sidebarProps } = useSidebarProps({
    activeWorkflow,
    hasUnsavedChanges,
    workflowOutputs,
    workflowTemplates: workflowTemplatesState,
    loadWorkflow,
    saveCurrentWorkflow,
    saveWorkflow,
    exportWorkflow,
    handleLoadTemplate: welcomeHandlers.handleLoadTemplate,
    handleLoadWorkflow,
    sidebarOpen,
    setSidebarOpen,
    setShowWelcome,
    setWelcomePinned,
    setNodes,
    setEdges,
    database,
    ...updateSystem,
  });

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load outputs from database
  useEffect(() => {
    db.getOutputs({ limit: 100 })
      .then((outputs) => outputs?.length && setWorkflowOutputs(outputs))
      .catch((err) => logger.error('Failed to load outputs:', err));
  }, []);

  // Update edge type when setting changes
  useEffect(() => {
    setEdges((eds) => eds.map((edge) => ({ ...edge, data: { ...edge.data, edgeType } })));
  }, [edgeType]);

  // Hydrate nodes with onRemove handler
  useEffect(() => {
    let needsHydration = false;
    const hydratedNodes = nodes.map((node, index) => {
      if (typeof node.data?.onRemove === 'function' && node.data?.executionOrder != null) {
        return node;
      }
      needsHydration = true;
      return {
        ...node,
        data: {
          ...node.data,
          executionOrder: node.data?.executionOrder ?? index + 1,
          onRemove: (nodeId: string) => {
            setNodes((curr) => curr.filter((n) => n.id !== nodeId));
            setEdges((eds) =>
              markEdgeGlows(eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
            );
          },
        },
      };
    });
    if (needsHydration) setNodes(hydratedNodes);
  }, [nodes]);

  // Welcome screen auto-hide
  useEffect(() => {
    if (showWelcome && nodes.length > 0 && !welcomePinned) setShowWelcome(false);
  }, [nodes.length, showWelcome, welcomePinned]);

  useEffect(() => {
    if (nodes.length > 0 && hideEmptyHint) setHideEmptyHint(false);
  }, [nodes.length, hideEmptyHint]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const autoLayout = useCallback(
    (
      direction: (typeof LAYOUT_DIRECTION)[keyof typeof LAYOUT_DIRECTION] = LAYOUT_DIRECTION.TOP_BOTTOM
    ): void => {
      const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, {
        direction,
        nodeSpacing: 80,
        rankSpacing: 120,
      });
      takeSnapshot(true);
      setNodes(layoutedNodes as Node[]);
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 50);
    },
    [nodes, edges, setNodes, reactFlowInstance, takeSnapshot]
  );

  const handleRunNode = useCallback(
    (nodeId: string): void => {
      void runWorkflow({ targetNodeIds: [nodeId], trigger: 'inspector-node-run' });
    },
    [runWorkflow]
  );

  const handleRetryNode = useCallback(
    (nodeId: string): void => {
      void runWorkflow({
        resume: true,
        retryNodeIds: [nodeId],
        continueOnError: true,
        trigger: 'inspector-node-retry',
      });
    },
    [runWorkflow]
  );

  const handleRetryFailed = useCallback((): void => {
    void runWorkflow({
      resume: true,
      retryFailed: true,
      continueOnError: true,
      trigger: 'execution-dock-retry-failed',
    });
  }, [runWorkflow]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${
        showCanvasGallery ? 'gallery-open' : ''
      } ${!showWelcome && contextualSurfaces.showOutputTray ? 'has-output-filmstrip' : ''}`}
    >
      <div id="global-node-settings-portal" />

      {/* Screen reader live region for workflow status announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {statusAnnouncement}
      </div>

      {showWelcome && (
        <Suspense fallback={<div className="loading-placeholder">Loading...</div>}>
          <WelcomeScreen
            onBuildWithAI={welcomeHandlers.handleBuildWithAI}
            onStartFromScratch={welcomeHandlers.handleCreateWorkflowFromWelcome}
            onLoadWorkflow={welcomeHandlers.handleLoadWorkflowFromWelcome}
            onLoadTemplate={
              welcomeHandlers.handleLoadTemplate as unknown as (t: {
                id: string;
                name: string;
                description: string;
                icon: string;
                category: string;
              }) => void
            }
            templates={workflowTemplatesState}
          />
        </Suspense>
      )}

      <ErrorBoundary level={'sidebar' as 'canvas' | 'node' | 'component'} showDetails={false}>
        <Sidebar {...sidebarProps} />
      </ErrorBoundary>

      {!showWelcome && (
        <WorkflowTitleChip
          activeWorkflow={activeWorkflow}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={saveCurrentWorkflow}
        />
      )}

      <ErrorBoundary level="canvas" showDetails={false}>
        <div className="flow-wrapper">
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd as (event: MouseEvent | TouchEvent) => void}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={(instance) => {
              setReactFlowInstance(instance);
              setZoomPercent(Math.round(instance.getZoom() * 100));
            }}
            onMoveEnd={(_, viewport) => {
              setZoomPercent(Math.round(viewport.zoom * 100));
            }}
            fitView
            defaultEdgeOptions={{ type: 'custom', animated: false }}
            isValidConnection={(params) =>
              ['type-mismatch', 'unique-handles', 'data-flow', 'data-type-match'].every((name) =>
                getValidator(name)({
                  ...params,
                  sourceHandleType: 'output',
                  targetHandleType: 'input',
                })
              )
            }
            onDrop={handleImageDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            nodesFocusable={false}
            nodesConnectable
            elementsSelectable
            panOnDrag
            zoomOnScroll
            panOnScroll={false}
            zoomOnDoubleClick={false}
            snapToGrid={false}
            nodeDragThreshold={1}
            selectNodesOnDrag
            noDragClassName="nodrag"
          >
            <Background />
            <Controls />
            <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
            <MiniMap
              className="app-minimap"
              position="bottom-left"
              nodeColor="var(--primary-color)"
              nodeStrokeColor="var(--node-border)"
              nodeBorderRadius={3}
              nodeStrokeWidth={1}
              maskColor="rgba(0, 0, 0, 0.35)"
              style={{ margin: 16, left: 92, bottom: 'var(--minimap-bottom-offset, 0px)' }}
              pannable
              zoomable
            />
            {validationErrors.length > 0 && (
              <ValidationErrorsPanel
                errors={validationErrors}
                onDismiss={handleDismissError}
                onClearAll={clearAllErrors}
              />
            )}
            <NodeSelector
              nodeDefinitions={nodeDefinitions}
              onAddNode={(type, position) => handleAddNode(type, position) || undefined}
              screenToFlowPosition={(pos) => {
                if (!reactFlowInstance) return pos;
                const { zoom, x: panX, y: panY } = reactFlowInstance.getViewport();
                return { x: (pos.x - panX) / zoom, y: (pos.y - panY) / zoom };
              }}
            />
          </ReactFlow>

          {!showWelcome && nodes.length === 0 && !hideEmptyHint && (
            <EmptyWorkflowOverlay
              onBuildWithAI={welcomeHandlers.handleBuildWithAI}
              onStartFromScratch={welcomeHandlers.handleStartFromScratch}
            />
          )}
        </div>
      </ErrorBoundary>

      {!showWelcome && <ConnectionHintOverlay hint={connectionHint} />}

      {!showWelcome && contextualSurfaces.showInspector && (
        <NodeInspectorPanel
          selectedNode={selectedNode}
          incomingEdges={selectedIncomingEdges}
          outgoingEdges={selectedOutgoingEdges}
          outputs={normalizedWorkflowOutputs}
          failedNode={selectedFailedNode}
          onRunNode={handleRunNode}
          onRetryNode={handleRetryNode}
          onDeleteNode={(nodeId) => void handleRemoveNode(nodeId)}
          onMoveNodeOrder={moveNodeOrder}
          onClose={contextualSurfaces.closeInspector}
        />
      )}

      {!showWelcome && contextualSurfaces.showOutputTray && (
        <OutputFilmstrip
          outputs={normalizedWorkflowOutputs}
          nodes={nodes}
          onOpenGallery={() => setShowCanvasGallery(true)}
          onClose={contextualSurfaces.closeOutputTray}
        />
      )}

      {showCanvasGallery && (
        <div className="canvas-gallery-panel">
          <Suspense fallback={<div className="loading-placeholder">Loading gallery...</div>}>
            <CanvasOutputGallery
              outputs={normalizedWorkflowOutputs}
              onClose={() => setShowCanvasGallery(false)}
              database={database as unknown as GalleryDatabase}
            />
          </Suspense>
        </div>
      )}

      {!showWelcome && (
        <CommandDock
          mode={contextualSurfaces.mode}
          isProcessing={isProcessing}
          processed={dockProcessed}
          total={dockTotal}
          failedCount={failedNodes.length}
          outputCount={normalizedWorkflowOutputs.length}
          currentNodeName={currentNodeName}
          zoomPercent={zoomPercent}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={hasSelection}
          hasGroupSelected={hasGroupSelected}
          onRun={() => runWorkflow()}
          onStop={stopWorkflow}
          onRetryFailed={handleRetryFailed}
          onOpenOutputs={contextualSurfaces.openOutputTray}
          onUndo={undo}
          onRedo={redo}
          onAutoLayout={autoLayout}
          onGroupSelected={groupSelectedNodes}
          onUngroupSelected={handleUngroupSelected}
        />
      )}

      {showAssistantPanel && (
        <ErrorBoundary level={'component' as 'canvas' | 'node' | 'component'} showDetails={false}>
          <Suspense fallback={<div className="loading-placeholder">Loading assistant...</div>}>
            <AssistantPanel
              systemPrompt={assistantSystemPrompt}
              executeToolCall={executeToolCall}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {showErrorRecovery && failedNodes.length > 0 && (
        <ErrorRecoveryPanel
          failedNodes={failedNodes}
          onRetry={errorRecoveryHandlers.handleRetryNode}
          onRetryAll={errorRecoveryHandlers.handleRetryAll}
          onSkip={errorRecoveryHandlers.handleSkipErrors}
          onClose={closeErrorRecovery}
        />
      )}

      <KeyboardShortcutsOverlay
        isOpen={showShortcutsOverlay}
        onClose={() => setShowShortcutsOverlay(false)}
      />
      <AppFeedback />
    </div>
  );
}

export default App;
